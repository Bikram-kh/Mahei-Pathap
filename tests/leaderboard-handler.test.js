import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../functions/mahei-discord-integration/src/main.js';

const MONTH = new Date().toISOString().slice(0, 7);
const ENV = {
  APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.test/v1',
  APPWRITE_FUNCTION_PROJECT_ID: 'proj',
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_FOCUS_SESSIONS_COLLECTION_ID: 'focus_sessions',
  APPWRITE_USER_MONTHLY_STATS_COLLECTION_ID: 'user_monthly_stats',
};
const AUTH = { 'x-appwrite-user-id': 'me', 'x-appwrite-key': 'dynamic-key' };
const statsRow = (id, xp) => ({ appwrite_user_id: id, month_key: MONTH, xp, focus_minutes: xp * 2.5, focus_sessions: xp / 10, updated_at: `${MONTH}-05T00:00:00.000Z` });

// Runs the real function entrypoint against a fake Appwrite REST API.
async function call(body, { headers = AUTH, rows = [], users = {} } = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, ENV);
  const requests = [];
  const errors = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    requests.push({ path: parsed.pathname, search: parsed.search, headers: options.headers });
    const reply = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
    if (parsed.pathname.endsWith('/tables/user_monthly_stats/rows')) {
      const queries = parsed.searchParams.getAll('queries[]').map(q => JSON.parse(q));
      const value = method => queries.find(q => q.method === method)?.values[0];
      const offset = value('offset') ?? 0, limit = value('limit') ?? 25;
      return reply({ rows: rows.slice(offset, offset + limit), total: rows.length });
    }
    const userId = decodeURIComponent(parsed.pathname.split('/users/')[1] || '');
    if (users[userId]) return reply(users[userId]);
    return reply({ message: 'The current user is not authorized (missing scope: users.read)' }, 401);
  };
  try {
    const response = await handler({
      req: { method: 'POST', headers, bodyJson: body },
      res: { json: (payload, status = 200) => ({ body: payload, status }) },
      log: () => {},
      error: message => errors.push(message),
    });
    return { ...response, requests, errors };
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(ENV)) key in saved ? (process.env[key] = saved[key]) : delete process.env[key];
  }
}

test('get_leaderboard ranks stats rows and resolves public names through the server key', async () => {
  const result = await call({ action: 'get_leaderboard' }, {
    rows: [statsRow('a', 30), statsRow('me', 50)],
    users: { a: { name: 'Asha Sharma', prefs: {} }, me: { name: 'Meera Nair', prefs: {} } },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.deepEqual(result.body.entries.map(e => [e.rank, e.name, e.xp, e.isYou]), [[1, 'Meera N.', 50, true], [2, 'Asha S.', 30, false]]);
  assert.deepEqual(result.body.you, { rank: 1, xp: 50, focusMinutes: 125, focusSessions: 5 });
  assert.ok(result.requests.every(r => r.headers['X-Appwrite-Key'] === 'dynamic-key'));
  assert.doesNotMatch(JSON.stringify(result.body), /"a"|appwrite_user_id|userId/);
});

test('get_leaderboard reads every page of stats and uses only pagination queries', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => statsRow(`s${i}`, 10 + (i % 7)));
  const result = await call({ action: 'get_leaderboard' }, { rows });
  const pages = result.requests.filter(r => r.path.endsWith('/user_monthly_stats/rows'));
  assert.equal(result.body.totalParticipants, 150);
  assert.equal(pages.length, 2);
  for (const page of pages) {
    const methods = new URL(`https://x${page.path}${page.search}`).searchParams.getAll('queries[]').map(q => JSON.parse(q).method);
    assert.deepEqual(methods.sort(), ['limit', 'offset']);
  }
});

test('get_leaderboard still works when student names cannot be read', async () => {
  const result = await call({ action: 'get_leaderboard' }, { rows: [statsRow('a', 30)], users: {} });
  assert.equal(result.status, 200);
  assert.equal(result.body.entries[0].name, 'Student');
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /users\.read/);
});

test('get_leaderboard requires a signed-in user', async () => {
  const result = await call({ action: 'get_leaderboard' }, { headers: {} });
  assert.equal(result.status, 401);
});

test('get_leaderboard rejects an invalid month with a clear message', async () => {
  const result = await call({ action: 'get_leaderboard', monthKey: '2026-9' });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /valid month/i);
});
