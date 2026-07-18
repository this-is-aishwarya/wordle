# Custom Wordle

A no-build, single-folder Wordle you can run by double-clicking `index.html`.
Pick the word, share the link, watch the other person guess it.

- **Host**: opens the page with no URL params → fills in a word → gets a shareable link.
- **Player**: opens `index.html?word=APPLE&len=5&tries=6` (or whatever you set) → plays the game.

The word list is yours to curate — see `data/words.json`.

---

## Run it

Either:

1. **Double-click `index.html`.** Works in every modern browser. The word list is
   loaded via `fetch()`; if your browser blocks `fetch()` from `file://` URLs
   (some do), the page falls back to an inline copy of the list (if you've
   inlined it — see below).
2. **Serve the folder.** From this directory, run:
   ```
   python3 -m http.server 8000
   ```
   then open <http://localhost:8000>.

No build step, no `npm install`, no dependencies.

---

## Make a puzzle

1. Open `index.html` in your browser.
2. Type the word (e.g. `apple`), pick a length and number of tries, click
   **Generate link**. The link is auto-copied to your clipboard and shown on
   the page.
3. Send the link to whoever you want to play.

The link looks like `index.html?word=APPLE&len=5&tries=6`. When the player
opens it, the game starts.

### URL parameters

| Param  | Default | Range  | Notes |
|--------|---------|--------|-------|
| `word` | —       | 3–8 letters, A–Z | Sets the target. Required for player mode. |
| `len`  | 5       | 3–8    | Word length. If `word` is set, it must match. |
| `tries`| 6       | 3–12   | Number of guesses. |
| `dict` | `data/words.json` | path | Custom dictionary path. |

---

## Add words

The validation list is `data/words.json`. Open it in any text editor and add
one lowercase word per line, e.g.:

```json
["apple", "banana", "crane", "drive", "eagle"]
```

- Words are case-insensitive; keep them lowercase.
- No duplicates needed (they're ignored).
- Empty array means no words are valid — the host form will refuse to make a
  puzzle until you add some.

If the file is empty, the page shows a friendly message instead of letting
you create a broken puzzle.

---

## Inlining the dictionary (optional, for `file://` use)

Browsers that block `fetch()` from `file://` URLs (e.g. some Chrome configs)
fall back to an inline `<script type="application/json">` block in
`index.html`. To keep the data file as the source of truth, regenerate the
inline block whenever you update `data/words.json`.

There's no script for this — just paste the JSON inside the `<script>` tag
in `index.html`:

```html
<script type="application/json" id="words-data">
["apple","banana","crane", ...]
</script>
```

The app reads from the `data/words.json` file first; only if `fetch()` fails
does it use the inline block.

---

## How gameplay works

- Type a 5-letter word. Hit **Enter** to submit, **Backspace** to delete, or
  use the on-screen keyboard.
- If the word is in your word list, the letters flip and turn:
  - 🟩 green: correct letter, correct spot
  - 🟨 yellow: correct letter, wrong spot
  - ⬛ gray: not in the word
- Invalid words (not in the list, or wrong length) shake the row, show a
  toast, and **do not** count against you.
- Win in `X / Y` tries, or run out and the answer is revealed.
- A **Share** button on the win screen copies emoji-grid results to the
  clipboard.
- Refresh-safe: in-progress games are saved to `localStorage` and resumed on
  reload.

Duplicate letters are handled correctly: a letter can never be marked
yellow more times than it appears in the target outside of green positions.

---

## Reset / Play again

From a win/lose banner, click **Play again with a new word**. This clears the
saved state for the current puzzle and takes you back to the host form.

To clear everything, open devtools → Application → Local Storage → delete
the `wordle:*` keys (or just clear site data for `localhost` / the file).

---

## Files

```
index.html         Page shell (host form + player view)
styles.css         All styling
app.js             All game logic
data/words.json    Your word list (edit this)
README.md          This file
```

---

## License

Code: MIT.

Word list: the contents of `data/words.json` are yours to choose and license.
If you copy a list from elsewhere, keep the upstream license/attribution in
this directory.
