import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImportedNote } from '../functions/mahei-study-groups/src/sanitize.js';

// sanitize-html needs a Node version that can require() ES modules (Node 22+, like the Appwrite runtime).
test('note import removes executable HTML and preserves safe semantic formatting', () => {
  const html = sanitizeImportedNote('mahei-rich-v1:<h2>Study</h2><script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">bad</a><mark>good</mark><img src=x onerror=bad()>');
  assert.match(html, /<h2>Study<\/h2>/);
  assert.match(html, /<mark>good<\/mark>/);
  assert.doesNotMatch(html, /script|javascript|onclick|onerror|<img/);
});

test('plain-text notes are escaped and keep their line breaks', () => {
  assert.match(sanitizeImportedNote('one\ntwo'), /one<br\s*\/>two/);
  assert.doesNotMatch(sanitizeImportedNote('<b onclick="x">hi</b>'), /<b onclick/);
});

test('links open safely in a new tab and oversized notes are refused', () => {
  assert.match(sanitizeImportedNote('mahei-rich-v1:<a href="https://example.com">x</a>'), /rel="noopener noreferrer"/);
  assert.throws(() => sanitizeImportedNote('x'.repeat(100001)), (error) => error.status === 400);
});
