// Wordle — single-file vanilla JS app.
// Modes:
//   - HOST:  no `?word=` in URL, shows a form to build a shareable puzzle link.
//   - PLAYER: `?word=APPLE&len=5&tries=6` (etc.) loads the game board.
// Persistence: localStorage, keyed by `${word}|${len}|${tries}`.
// Dictionary: `data/words.json` (user-curated). If empty, the user has not
// added any words yet, so no guess is considered valid (and the host form
// will not let you create a link). The fetched file is cached in memory and
// also embedded in the page as a fallback for `file://` opens.

(() => {
  'use strict';

  // ----------------------------------------------------------------
  // Configuration & URL parsing
  // ----------------------------------------------------------------

  const DEFAULTS = { len: 5, tries: 6, dictPath: 'data/words.json' };
  const LIMITS   = { len: [3, 8], tries: [3, 12] };
  const KEYBOARD_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','BACKSPACE'],
  ];

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const isLetters = (s) => /^[A-Z]+$/.test(s);

  function parseConfig(search) {
    const params = new URLSearchParams(search);
    const len   = clamp(parseInt(params.get('len')   ?? DEFAULTS.len,   10) || DEFAULTS.len,   ...LIMITS.len);
    const tries = clamp(parseInt(params.get('tries') ?? DEFAULTS.tries, 10) || DEFAULTS.tries, ...LIMITS.tries);
    const dictPath = params.get('dict') || DEFAULTS.dictPath;
    const rawWord = (params.get('word') || '').trim().toUpperCase();

    if (!rawWord) {
      return { mode: 'host', len, tries, dictPath, word: null };
    }
    if (!isLetters(rawWord) || rawWord.length !== len) {
      return { mode: 'host', len, tries, dictPath, word: null, invalid: rawWord };
    }
    return { mode: 'player', len, tries, dictPath, word: rawWord };
  }

  const baseUrlHelpers = globalThis.WordleBaseUrl || {};

  function buildAppBaseUrl(currentUrl = location.href) {
    return baseUrlHelpers.appBaseUrl ? baseUrlHelpers.appBaseUrl(currentUrl) : currentUrl;
  }

  function buildPuzzleUrl(currentUrl, { word, len, tries }) {
    return baseUrlHelpers.buildPuzzleUrl
      ? baseUrlHelpers.buildPuzzleUrl(currentUrl, { word, len, tries })
      : `${currentUrl}`;
  }

  // ----------------------------------------------------------------
  // Dictionary loading
  // ----------------------------------------------------------------

  async function loadDictionary(dictPath) {
    // Try fetch first (works for http:// and any server-served path).
    try {
      const res = await fetch(dictPath, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return normalizeWords(data);
      }
    } catch (_) { /* fall through to inline fallback */ }

    // Fallback: inline <script type="application/json"> block in index.html.
    const inline = document.getElementById('words-data');
    if (inline) {
      try {
        const data = JSON.parse(inline.textContent);
        return normalizeWords(data);
      } catch (_) { /* fall through to empty */ }
    }
    return new Set();
  }

  function normalizeWords(data) {
    if (!Array.isArray(data)) return new Set();
    return new Set(data.map((w) => String(w).toLowerCase()).filter(isLettersLower));
  }

  function isLettersLower(s) { return /^[a-z]+$/.test(s); }

  // ----------------------------------------------------------------
  // Scoring — two-pass, handles duplicates correctly
  // ----------------------------------------------------------------

  function scoreGuess(guess, target) {
    const L = guess.length;
    const scores = new Array(L).fill(null);
    const remaining = Object.create(null);

    // Pass 1: exact matches (green) — and tally what's left over in target.
    for (let i = 0; i < L; i++) {
      if (guess[i] === target[i]) {
        scores[i] = 'correct';
      } else {
        const t = target[i];
        remaining[t] = (remaining[t] || 0) + 1;
      }
    }
    // Pass 2: yellow / gray for the unmatched positions.
    for (let i = 0; i < L; i++) {
      if (scores[i] === 'correct') continue;
      const g = guess[i];
      if ((remaining[g] || 0) > 0) {
        scores[i] = 'present';
        remaining[g] -= 1;
      } else {
        scores[i] = 'absent';
      }
    }
    return scores;
  }

  // ----------------------------------------------------------------
  // Validation
  // ----------------------------------------------------------------

  function isValidGuess(guess, len, dict) {
    if (guess.length !== len) return { ok: false, reason: 'short' };
    if (!isLetters(guess))   return { ok: false, reason: 'short' };
    if (dict.size === 0)     return { ok: false, reason: 'empty-dict' };
    if (dict.has(guess.toLowerCase())) return { ok: true };
    return { ok: false, reason: 'unknown' };
  }

  // ----------------------------------------------------------------
  // State persistence
  // ----------------------------------------------------------------

  function stateKey(cfg) { return `${cfg.word}|${cfg.len}|${cfg.tries}`; }

  function loadState(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.word == null) return null;
      return s;
    } catch (_) { return null; }
  }

  function saveState(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { /* quota / private mode */ }
  }

  function clearState(key) {
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
  }

  // ----------------------------------------------------------------
  // DOM helpers
  // ----------------------------------------------------------------

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class')      n.className = v;
      else if (k === 'text')  n.textContent = v;
      else if (k === 'html')  n.innerHTML = v;
      else if (k === 'attrs') for (const [a, av] of Object.entries(v)) n.setAttribute(a, av);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n[k] = v;
    }
    for (const c of [].concat(children)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  };

  // ----------------------------------------------------------------
  // Player mode — DOM build
  // ----------------------------------------------------------------

  function initPlayerDOM(cfg) {
    const app = $('#app');
    app.dataset.mode = 'player';
    app.style.setProperty('--len',   cfg.len);
    app.style.setProperty('--tries', cfg.tries);

    $('#player-view').hidden = false;
    $('#host-view').hidden = true;

    const board = $('#board');
    board.innerHTML = '';
    for (let r = 0; r < cfg.tries; r++) {
      const row = el('div', { class: 'row', attrs: { role: 'row' } });
      board.appendChild(row);
      for (let c = 0; c < cfg.len; c++) {
        row.appendChild(el('div', {
          class: 'tile',
          attrs: { 'data-row': r, 'data-col': c, role: 'gridcell', 'aria-label': `Row ${r+1} column ${c+1}` },
        }));
      }
    }

    const kb = $('#keyboard');
    kb.innerHTML = '';
    const rowClass = ['top', 'middle', 'bottom'];
    KEYBOARD_ROWS.forEach((row, i) => {
      const rowEl = el('div', { class: 'kb-row ' + rowClass[i] });
      row.forEach((label) => {
        const k = el('button', {
          class: 'key' + (label.length > 1 ? ' wide' : ''),
          text: label === 'BACKSPACE' ? '⌫' : label,
          attrs: {
            type: 'button',
            'data-key': label,
            'aria-label': label === 'BACKSPACE' ? 'Backspace' : label === 'ENTER' ? 'Enter' : `Letter ${label}`,
          },
        });
        rowEl.appendChild(k);
      });
      kb.appendChild(rowEl);
    });

    $('#back-to-host').onclick = () => { location.href = buildAppBaseUrl(location.href); };
  }

  // ----------------------------------------------------------------
  // Renderers
  // ----------------------------------------------------------------

  function renderRow(rowEl, guess, scores, { flip = false, flipDelayStep = 50 } = {}) {
    const tiles = rowEl.children;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const letter = guess[i] || '';
      const cls = scores[i] || '';

      if (flip && letter) {
        // Build the two-face structure for a flip animation.
        t.className = 'tile flip';
        t.style.setProperty('--flip-delay', `${i * flipDelayStep}ms`);
        t.style.setProperty('--flip-color', `var(--${cls})`);
        t.innerHTML = '';
        t.appendChild(el('div', { class: 'tile-face', text: letter }));
        t.appendChild(el('div', { class: 'tile-back ' + cls, text: letter }));
      } else {
        t.className = 'tile' + (letter ? ' filled' : '') + (cls ? ' ' + cls : '');
        t.textContent = letter;
      }
    }
  }

  function renderRowStatic(rowEl, guess, scores) {
    // Used on initial restore — no flip, just paint the result.
    const tiles = rowEl.children;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const letter = guess[i] || '';
      const cls = scores[i] || '';
      t.className = 'tile' + (letter ? ' filled' : '') + (cls ? ' ' + cls : '');
      t.textContent = letter;
    }
  }

  function renderKeyboard(letterStates) {
    document.querySelectorAll('.key').forEach((k) => {
      const key = k.dataset.key;
      if (!key || key.length !== 1) return; // skip ENTER / BACKSPACE
      const s = letterStates[key];
      k.classList.remove('correct', 'present', 'absent');
      if (s) k.classList.add(s);
    });
  }

  function shakeCurrentRow() {
    const row = currentRowEl();
    if (!row) return;
    row.classList.add('shake');
    setTimeout(() => row.classList.remove('shake'), 400);
  }

  function currentRowEl() {
    const r = state.currentRow;
    const rows = document.querySelectorAll('#board .row');
    return r < rows.length ? rows[r] : null;
  }

  // ----------------------------------------------------------------
  // Toast
  // ----------------------------------------------------------------

  let toastTimer = null;
  function showToast(text, ms = 1200) {
    const m = $('#message');
    m.textContent = text;
    m.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => m.classList.remove('show'), ms);
  }

  // ----------------------------------------------------------------
  // Letter-state merge (correct > present > absent)
  // ----------------------------------------------------------------

  const RANK = { absent: 0, present: 1, correct: 2 };
  function updateLetterStates(prev, guess, scores) {
    const out = { ...prev };
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const newS = scores[i];
      const oldS = out[ch];
      if (!oldS || RANK[newS] > RANK[oldS]) out[ch] = newS;
    }
    return out;
  }

  // ----------------------------------------------------------------
  // End-of-game banner
  // ----------------------------------------------------------------

  const WIN_TIERS = ['Magnificent', 'Impressive', 'Great', 'Solid', 'Phew', 'Close one', 'Lucky', 'Barely'];
  function tierFor(triesUsed) { return WIN_TIERS[Math.min(triesUsed - 1, WIN_TIERS.length - 1)] || 'Nice'; }

  function showEndBanner(kind, ctx) {
    const banner = $('#banner');
    banner.innerHTML = '';
    banner.hidden = false;

    if (kind === 'win') {
      const title = el('h2', { class: 'banner-title', text: `${tierFor(ctx.triesUsed)}!` });
      const sub   = el('p',   { class: 'banner-sub',   text: 'You got it.' });
      const row   = el('div', { class: 'banner-row' }, [
        el('div', { class: 'banner-score', text: `${ctx.triesUsed} / ${ctx.totalTries}` }),
        buildShareButton(ctx),
      ]);
      banner.append(title, sub, row, buildPlayAgainLink());
    } else {
      const sub  = el('p',  { class: 'banner-sub', text: 'Better luck next time.' });
      const target = buildTargetTiles(ctx.target, ctx.cfg.len);
      const title = el('h2', { class: 'banner-title', text: 'The word was' });
      banner.append(title, target, sub, buildPlayAgainLink());
    }
  }

  function buildTargetTiles(word, len) {
    const row = el('div', { class: 'banner-target', attrs: { 'aria-label': `Answer: ${word}` } });
    for (let i = 0; i < len; i++) {
      row.appendChild(el('div', { class: 'tile correct', text: word[i] }));
    }
    return row;
  }

  function buildShareButton(ctx) {
    const btn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Share' });
    btn.addEventListener('click', async () => {
      const lines = state.guesses.map((g) => g.split('').map((ch, i) => {
        const s = state.scores[state.guesses.indexOf(g)][i];
        return s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛';
      }).join(''));
      const text = `Wordle (custom) ${ctx.triesUsed}/${ctx.totalTries}\n` + lines.join('\n');
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Share'; }, 1200);
      } catch (_) {
        // Fallback: select-and-copy via a temporary textarea.
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); btn.textContent = 'Copied!'; } catch (__) { btn.textContent = 'Copy failed'; }
        document.body.removeChild(ta);
      }
    });
    return btn;
  }

  function buildPlayAgainLink() {
    const a = el('a', {
      class: 'btn btn-ghost',
      text: 'Play again with a new word',
      attrs: { href: buildAppBaseUrl(location.href) },
    });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      clearState(stateKey(ctxCfg));
      location.href = location.pathname;
    });
    return a;
  }

  // ----------------------------------------------------------------
  // Input handling
  // ----------------------------------------------------------------

  function attachInput() {
    document.addEventListener('keydown', onKey);
    document.querySelectorAll('.key').forEach((k) => {
      k.addEventListener('click', () => onKey({ key: k.dataset.key }));
    });
  }

  function onKey(e) {
    if (state.status !== 'playing') return;
    const k = e.key || '';
    let action = null;
    if (k === 'Enter')      action = 'ENTER';
    else if (k === 'Backspace') action = 'BACKSPACE';
    else {
      const ch = (k.length === 1 ? k : '').toUpperCase();
      if (isLetters(ch)) action = ch;
    }
    if (!action) return;
    if (e.preventDefault) e.preventDefault();
    handleAction(action);
  }

  function handleAction(action) {
    if (action === 'BACKSPACE') {
      if (state.rowLetters.length > 0) {
        state.rowLetters.pop();
        paintInProgressRow();
      }
      return;
    }
    if (action === 'ENTER') {
      submitGuess();
      return;
    }
    // Letter
    if (state.rowLetters.length >= ctxCfg.len) return;
    state.rowLetters.push(action);
    paintInProgressRow();
  }

  function paintInProgressRow() {
    const row = currentRowEl();
    if (!row) return;
    // Paint just the current in-progress row (no colors).
    const guess = padRow(state.rowLetters, ctxCfg.len);
    const blank = new Array(ctxCfg.len).fill('');
    renderRow(row, guess, blank, { flip: false });
  }

  function padRow(arr, len) {
    const out = arr.slice(0, len);
    while (out.length < len) out.push('');
    return out;
  }

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------

  function submitGuess() {
    const guess = state.rowLetters.join('');
    if (guess.length !== ctxCfg.len) {
      showToast('Not enough letters');
      shakeCurrentRow();
      return;
    }
    if (!isLetters(guess)) {
      showToast('Letters only');
      shakeCurrentRow();
      return;
    }
    if (dict.size === 0) {
      showToast('Word list is empty — add words to data/words.json');
      shakeCurrentRow();
      return;
    }
    if (!dict.has(guess.toLowerCase())) {
      showToast('Not in word list');
      shakeCurrentRow();
      return;
    }

    const scores = scoreGuess(guess, ctxCfg.word);
    state.guesses.push(guess);
    state.scores.push(scores);
    state.letterStates = updateLetterStates(state.letterStates, guess, scores);

    const row = currentRowEl();
    renderRow(row, guess, scores, { flip: true });
    renderKeyboard(state.letterStates);

    const won = scores.every((s) => s === 'correct');
    const outOfTries = state.currentRow >= ctxCfg.tries - 1;

    if (won) {
      state.status = 'won';
      // Pulse the winning row, then show the banner.
      setTimeout(() => {
        [...row.children].forEach((t) => t.classList.add('pulse'));
        showEndBanner('win', {
          triesUsed: state.guesses.length,
          totalTries: ctxCfg.tries,
        });
      }, 600);
    } else if (outOfTries) {
      state.status = 'lost';
      setTimeout(() => {
        showEndBanner('lose', { target: ctxCfg.word, cfg: ctxCfg });
      }, 600);
    } else {
      state.currentRow += 1;
      state.rowLetters = [];
    }

    saveState(stateKey(ctxCfg), state);
  }

  // ----------------------------------------------------------------
  // Player boot
  // ----------------------------------------------------------------

  let ctxCfg = null;
  let dict = new Set();
  let state = null;

  async function bootPlayer(cfg) {
    ctxCfg = cfg;
    initPlayerDOM(cfg);
    dict = await loadDictionary(cfg.dictPath);

    const restored = loadState(stateKey(cfg));
    state = restored || freshState(cfg);

    // If the persisted state was for a different puzzle, ignore it.
    if (restored && (restored.word !== cfg.word || restored.len !== cfg.len || restored.tries !== cfg.tries)) {
      state = freshState(cfg);
    }

    // Paint restored board.
    const rows = document.querySelectorAll('#board .row');
    for (let i = 0; i < state.guesses.length && i < cfg.tries; i++) {
      renderRowStatic(rows[i], state.guesses[i], state.scores[i]);
    }
    renderKeyboard(state.letterStates);

    if (state.status === 'won') {
      showEndBanner('win', { triesUsed: state.guesses.length, totalTries: cfg.tries });
    } else if (state.status === 'lost') {
      showEndBanner('lose', { target: cfg.word, cfg });
    } else {
      attachInput();
    }
  }

  function freshState(cfg) {
    return {
      word: cfg.word,
      len: cfg.len,
      tries: cfg.tries,
      guesses: [],
      scores: [],
      currentRow: 0,
      rowLetters: [],
      status: 'playing',
      letterStates: {},
    };
  }

  // ----------------------------------------------------------------
  // Host mode
  // ----------------------------------------------------------------

  async function bootHost(cfg) {
    $('#app').dataset.mode = 'host';
    $('#host-view').hidden = false;
    $('#player-view').hidden = true;

    // Preload the dictionary so we can validate the host's chosen word.
    dict = await loadDictionary(cfg.dictPath);

    const wordInput  = $('#host-word');
    const lenInput   = $('#host-len');
    const triesInput = $('#host-tries');
    const errEl      = $('#host-error');
    const result     = $('#host-result');
    const linkEl     = $('#host-link');
    const copyBtn    = $('#host-copy');
    const openLink   = $('#host-open');
    const form       = $('#host-form');

    lenInput.value   = cfg.len;
    triesInput.value = cfg.tries;

    // If we landed here with an invalid word from the URL, surface it.
    if (cfg.invalid) {
      errEl.textContent = `The URL had an invalid word "${cfg.invalid}". Use this form to make a valid one.`;
      errEl.hidden = false;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      errEl.hidden = true;
      result.hidden = true;

      const raw = (wordInput.value || '').trim().toUpperCase();
      const len = clamp(parseInt(lenInput.value, 10) || DEFAULTS.len, ...LIMITS.len);
      const tries = clamp(parseInt(triesInput.value, 10) || DEFAULTS.tries, ...LIMITS.tries);

      if (!isLetters(raw)) { showHostError(errEl, 'Word must be letters A–Z.'); return; }
      if (raw.length !== len) { showHostError(errEl, `Word length must be ${len} (got ${raw.length}).`); return; }
      if (dict.size === 0) {
        showHostError(errEl, 'data/words.json is empty. Add words first, then reload.');
        return;
      }
      if (!dict.has(raw.toLowerCase())) {
        showHostError(errEl, `"${raw}" is not in data/words.json. Add it, then retry.`);
        return;
      }

      const url = buildPuzzleUrl(location.href, { word: raw, len, tries });
      linkEl.value = url;
      openLink.href = url;
      result.hidden = false;

      // Auto-copy to clipboard.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkEl.value).catch(() => {});
      }
    });

    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(linkEl.value); copyBtn.textContent = 'Copied!'; }
      catch (_) { /* ignore */ }
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
    });
  }

  function showHostError(el_, msg) { el_.textContent = msg; el_.hidden = false; }

  // ----------------------------------------------------------------
  // Boot
  // ----------------------------------------------------------------

  function boot() {
    const cfg = parseConfig(location.search);
    if (cfg.mode === 'host') bootHost(cfg);
    else                     bootPlayer(cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
