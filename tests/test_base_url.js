const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPuzzleUrl } = require('../base_url.js');

test('buildPuzzleUrl preserves the app base path on deployed subdirectories', () => {
  const url = buildPuzzleUrl('https://example.netlify.app/wordle/index.html', {
    word: 'APPLE',
    len: 5,
    tries: 6,
  });

  assert.equal(url, 'https://example.netlify.app/wordle/?word=APPLE&len=5&tries=6');
});

test('buildPuzzleUrl works from the directory root without losing the base path', () => {
  const url = buildPuzzleUrl('https://example.netlify.app/wordle/', {
    word: 'APPLE',
    len: 5,
    tries: 6,
  });

  assert.equal(url, 'https://example.netlify.app/wordle/?word=APPLE&len=5&tries=6');
});
