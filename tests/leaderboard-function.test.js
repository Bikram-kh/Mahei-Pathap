import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentMonthKey,
  getLeaderboard,
  isValidMonthKey,
  publicName,
  rankRows,
} from '../functions/mahei-discord-integration/src/leaderboard.js';

const NOW = new Date('2026-09-19T10:00:00Z');
const row = (id, xp, minutes, updatedAt = '2026-09-10T00:00:00Z', month = '2026-09') => ({
  appwrite_user_id: id, month_key: month, xp, focus_minutes: minutes, focus_sessions: xp / 10, updated_at: updatedAt,
});
const usersById = {
  u1: { name: 'Asha Kumari Sharma', prefs: {} },
  u2: { name: 'bikram', prefs: {} },
  u3: { name: 'Chandra Rao', prefs: { leaderboardAnonymous: true } },
  u4: { name: 'dev@example.com', prefs: {} },
  me: { name: 'Meera Nair', prefs: {} },
};
const deps = (rows, users = usersById) => ({
  now: NOW,
  listRows: async () => rows,
  getUser: async id => { if (!users[id]) throw new Error('not found'); return users[id]; },
});

test('month keys are validated and default to the current UTC month', () => {
  assert.equal(currentMonthKey(NOW), '2026-09');
  assert.equal(isValidMonthKey('2026-09'), true);
  for (const bad of ['2026-13', '2026-00', '26-09', '2026-9', '2026-09-01', '', null, undefined, 202609])
    assert.equal(isValidMonthKey(bad), false, String(bad));
});

test('display names show first name and last initial and never expose an email', () => {
  assert.equal(publicName({ name: 'Asha Kumari Sharma', prefs: {} }), 'Asha S.');
  assert.equal(publicName({ name: '  bikram  ', prefs: {} }), 'bikram');
  assert.equal(publicName({ name: '', prefs: {} }), 'Student');
  assert.equal(publicName({ name: 'dev@example.com', prefs: {} }), 'Student');
  assert.equal(publicName(null), 'Student');
  assert.equal(publicName({ name: 'x'.repeat(80), prefs: {} }).length, 24);
});

test('students who opt out appear as Anonymous student', () => {
  assert.equal(publicName({ name: 'Chandra Rao', prefs: { leaderboardAnonymous: true } }), 'Anonymous student');
  assert.equal(publicName({ name: 'Chandra Rao', prefs: { leaderboardAnonymous: 'yes' } }), 'Chandra R.');
});

test('ranking uses only the requested month, orders by XP then focus minutes, and shares ties', () => {
  const ranked = rankRows([
    row('a', 30, 75), row('b', 50, 125), row('c', 30, 80), row('d', 30, 80, '2026-09-05T00:00:00Z'),
    row('old', 999, 999, '2026-08-01T00:00:00Z', '2026-08'), row('zero', 0, 0), { month_key: '2026-09', xp: 10 },
  ], '2026-09');
  assert.deepEqual(ranked.map(r => r.userId), ['b', 'd', 'c', 'a']);
  assert.deepEqual(ranked.map(r => r.rank), [1, 2, 2, 4]);
});

test('ranking tolerates missing or non-numeric stats', () => {
  const ranked = rankRows([{ appwrite_user_id: 'a', month_key: '2026-09', xp: '20', focus_minutes: null }], '2026-09');
  assert.equal(ranked[0].xp, 20);
  assert.equal(ranked[0].focusMinutes, 0);
  assert.equal(ranked[0].focusSessions, 0);
});

test('leaderboard returns top entries with public names and marks the caller', async () => {
  const result = await getLeaderboard({ userId: 'u2', ...deps([row('u1', 50, 125), row('u2', 30, 75), row('u3', 20, 50), row('u4', 10, 25)]) });
  assert.equal(result.monthKey, '2026-09');
  assert.equal(result.totalParticipants, 4);
  assert.deepEqual(result.entries.map(e => [e.rank, e.name, e.xp, e.isYou]), [
    [1, 'Asha S.', 50, false], [2, 'bikram', 30, true], [3, 'Anonymous student', 20, false], [4, 'Student', 10, false],
  ]);
  assert.deepEqual(result.you, { rank: 2, xp: 30, focusMinutes: 75, focusSessions: 3 });
  assert.equal(result.anonymous, false);
});

test('leaderboard never exposes other students\' account ids', async () => {
  const result = await getLeaderboard({ userId: 'u2', ...deps([row('u1', 50, 125), row('u2', 30, 75)]) });
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /u1/);
  assert.doesNotMatch(text, /appwrite_user_id|userId/);
});

test('a caller outside the top list still receives their own rank', async () => {
  const many = Array.from({ length: 25 }, (_, i) => row(`p${i}`, 500 - i * 10, 1000 - i * 20));
  const users = { ...usersById, me: { name: 'Meera Nair', prefs: {} } };
  const result = await getLeaderboard({ userId: 'me', limit: 20, ...deps([...many, row('me', 10, 25)], users) });
  assert.equal(result.entries.length, 20);
  assert.equal(result.entries.some(e => e.isYou), false);
  assert.equal(result.you.rank, 26);
  assert.equal(result.totalParticipants, 26);
});

test('a caller with no sessions this month gets an empty standing and their privacy setting', async () => {
  const users = { ...usersById, me: { name: 'Meera Nair', prefs: { leaderboardAnonymous: true } } };
  const result = await getLeaderboard({ userId: 'me', ...deps([row('u1', 50, 125)], users) });
  assert.equal(result.you, null);
  assert.equal(result.anonymous, true);
});

test('an unreadable user record falls back to a generic name instead of failing', async () => {
  const result = await getLeaderboard({ userId: 'u1', ...deps([row('ghost', 50, 125), row('u1', 30, 75)]) });
  assert.equal(result.entries[0].name, 'Student');
  assert.equal(result.entries[1].name, 'Asha S.');
});

test('an empty month returns an empty board', async () => {
  const result = await getLeaderboard({ userId: 'u1', ...deps([]) });
  assert.deepEqual(result.entries, []);
  assert.equal(result.totalParticipants, 0);
  assert.equal(result.you, null);
});

test('previous months are supported; invalid and future months are rejected', async () => {
  const past = await getLeaderboard({ userId: 'u1', monthKey: '2026-08', ...deps([row('u1', 40, 100, '2026-08-05T00:00:00Z', '2026-08')]) });
  assert.equal(past.monthKey, '2026-08');
  assert.equal(past.entries.length, 1);
  await assert.rejects(getLeaderboard({ userId: 'u1', monthKey: '2026-9', ...deps([]) }), /valid month/i);
  await assert.rejects(getLeaderboard({ userId: 'u1', monthKey: '2026-10', ...deps([]) }), /future/i);
});
