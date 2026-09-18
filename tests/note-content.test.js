import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const {
  RICH_NOTE_PREFIX,
  decodeNoteToHtml,
  encodeRichNote,
  isRichNoteContent,
  noteContentToPlainText,
} = await import("../src/lib/noteContent.js");

test("rich notes keep safe study formatting and remove executable content", () => {
  const stored = encodeRichNote('<h2>Algebra</h2><p onclick="steal()"><strong>Rule</strong><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://example.com">safe</a></p>');
  assert.ok(stored.startsWith(RICH_NOTE_PREFIX));
  assert.match(stored, /<h2>Algebra<\/h2>/);
  assert.match(stored, /<strong>Rule<\/strong>/);
  assert.doesNotMatch(stored, /script|onclick|javascript:/i);
  assert.match(stored, /href="https:\/\/example.com"/);
  assert.match(stored, /rel="noopener noreferrer"/);
});

test("legacy plain notes are escaped for editing and remain readable", () => {
  const legacy = "First line\nSecond <script>line</script>";
  const html = decodeNoteToHtml(legacy);
  assert.match(html, /First line<br>Second &lt;script&gt;line&lt;\/script&gt;/);
  assert.equal(noteContentToPlainText(legacy), legacy);
  assert.equal(isRichNoteContent(legacy), false);
});

test("rich note content becomes clean plain text for Mahei Assistance", () => {
  const stored = encodeRichNote("<h2>Fractions</h2><ul><li>Revise equivalents</li><li>Practise addition</li></ul>");
  const plain = noteContentToPlainText(stored);
  assert.match(plain, /Fractions\nRevise equivalents\nPractise addition/);
  assert.doesNotMatch(plain, /<[^>]+>/);
});
