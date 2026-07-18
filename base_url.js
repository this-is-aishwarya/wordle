(function (global) {
  'use strict';

  function appBaseUrl(currentUrl) {
    const url = new URL(currentUrl);
    const pathname = url.pathname;
    const basePath = pathname.match(/\/[^/]+\.[^/]+$/i)
      ? pathname.replace(/[^/]+$/, '')
      : pathname.replace(/\/?$/, '/');
    return `${url.origin}${basePath}`;
  }

  function encodePuzzleToken(word, len, tries) {
    const payload = JSON.stringify({ w: String(word).toUpperCase(), len: Number(len), tries: Number(tries) });
    if (typeof btoa === 'function') return btoa(payload);
    if (typeof Buffer !== 'undefined') return Buffer.from(payload, 'utf8').toString('base64');
    return payload;
  }

  function decodePuzzleToken(token) {
    if (!token) return null;
    try {
      const payload = typeof atob === 'function'
        ? atob(token)
        : (typeof Buffer !== 'undefined' ? Buffer.from(token, 'base64').toString('utf8') : token);
      const parsed = JSON.parse(payload);
      return { word: String(parsed.w || '').toUpperCase(), len: Number(parsed.len), tries: Number(parsed.tries) };
    } catch (_) {
      return null;
    }
  }

  function buildPuzzleUrl(currentUrl, { word, len, tries }) {
    const url = new URL(appBaseUrl(currentUrl));
    if (word) {
      url.searchParams.set('puzzle', encodePuzzleToken(word, len, tries));
    } else {
      url.searchParams.delete('puzzle');
    }
    url.searchParams.delete('word');
    url.searchParams.set('len', String(len));
    url.searchParams.set('tries', String(tries));
    return url.toString();
  }

  const api = { appBaseUrl, buildPuzzleUrl, encodePuzzleToken, decodePuzzleToken };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.WordleBaseUrl = api;
})(typeof window !== 'undefined' ? window : globalThis);
