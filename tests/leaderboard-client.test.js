import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFocusTime, leaderboardMonths, medalFor, monthTitle, roadmapXpMessage } from '../src/lib/leaderboard.js';

test('month options are this month and last month, including across a year boundary', () => {
  assert.deepEqual(leaderboardMonths(new Date('2026-09-19T10:00:00Z')).map(m => [m.key, m.label]), [['2026-09', 'This month'], ['2026-08', 'Last month']]);
  assert.deepEqual(leaderboardMonths(new Date('2027-01-02T00:00:00Z')).map(m => m.key), ['2027-01', '2026-12']);
});

test('month titles are readable and use UTC so they match the server month', () => {
  assert.equal(monthTitle('2026-09'), 'September 2026');
  assert.equal(monthTitle('2027-01'), 'January 2027');
  assert.equal(monthTitle('nonsense'), '');
});

test('focus time is shown in hours and minutes', () => {
  assert.equal(formatFocusTime(0), '0m');
  assert.equal(formatFocusTime(45), '45m');
  assert.equal(formatFocusTime(60), '1h');
  assert.equal(formatFocusTime(75), '1h 15m');
  assert.equal(formatFocusTime(-5), '0m');
  assert.equal(formatFocusTime('abc'), '0m');
});

test('only the top three ranks get a medal', () => {
  assert.deepEqual([1, 2, 3, 4, 0].map(medalFor), ['gold', 'silver', 'bronze', null, null]);
});

test('roadmap XP messages explain what happened without overpromising', () => {
  assert.match(roadmapXpMessage({ status: 'awarded', points: 20 }), /20 XP/);
  assert.match(roadmapXpMessage({ status: 'already-awarded', points: 0 }), /already/i);
  assert.match(roadmapXpMessage({ status: 'failed', points: 0 }), /could not/i);
  assert.equal(roadmapXpMessage(undefined), '');
  assert.equal(roadmapXpMessage({ status: 'unknown' }), '');
});
