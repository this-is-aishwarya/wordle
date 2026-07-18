(function (global) {
  'use strict';

  function appBaseUrl(currentUrl) {
    return new URL('.', currentUrl).toString();
  }

  function buildPuzzleUrl(currentUrl, { word, len, tries }) {
    const url = new URL(appBaseUrl(currentUrl));
    url.searchParams.set('word', String(word));
    url.searchParams.set('len', String(len));
    url.searchParams.set('tries', String(tries));
    return url.toString();
  }

  const api = { appBaseUrl, buildPuzzleUrl };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.WordleBaseUrl = api;
})(typeof window !== 'undefined' ? window : globalThis);
