import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/mahei-study-groups/src/main.js';
import { createFakeDb, createFakeProviders, fakeSanitize } from './helpers/study-groups-fakes.js';

function invoke(handler, { userId = 'owner', body = {}, raw } = {}) {
  const sent = {};
  const logs = [];
  const req = { headers: userId ? { 'x-appwrite-user-id': userId } : {}, ...(raw !== undefined ? { body: raw } : { bodyJson: body }) };
  const res = { json: (payload, code = 200) => Object.assign(sent, { payload, code }) };
  return handler({ req, res, log: (m) => logs.push(m), error: (m) => logs.push(`ERROR ${m}`) }).then(() => ({ ...sent, logs }));
}

const build = (dbOverrides = {}) => createHandler({
  db: Object.assign(createFakeDb({ users: { owner: 'Olivia' } }), dbOverrides),
  providers: createFakeProviders(),
  sanitize: fakeSanitize,
});

test('a request without a signed-in user is refused', async () => {
  const { code, payload } = await invoke(build(), { userId: '', body: { action: 'listGroups' } });
  assert.equal(code, 401);
  assert.equal(payload.success, false);
});

test('unknown actions and unreadable bodies get a clear 400', async () => {
  const handler = build();
  assert.equal((await invoke(handler, { body: { action: 'dropEverything' } })).code, 400);
  assert.equal((await invoke(handler, { raw: '{not json' })).code, 400);
  assert.equal((await invoke(handler, { body: {} })).code, 400);
});

test('a successful action returns the result inside the success envelope', async () => {
  const handler = build();
  const created = await invoke(handler, { body: { action: 'createGroup', name: 'Physics', requestId: 'r1' } });
  assert.equal(created.code, 200);
  assert.equal(created.payload.success, true);
  assert.equal(created.payload.group.name, 'Physics');
  const listed = await invoke(handler, { body: { action: 'listGroups' } });
  assert.equal(listed.payload.groups.length, 1);
});

test('expected errors keep their message and status, unexpected ones are hidden from the client', async () => {
  const handler = build();
  const blank = await invoke(handler, { body: { action: 'createGroup', name: ' ', requestId: 'r2' } });
  assert.equal(blank.code, 400);
  assert.match(blank.payload.error, /Group name/);

  const broken = build({ byUser: async () => { throw new Error('database password is hunter2'); } });
  const failed = await invoke(broken, { body: { action: 'listGroups' } });
  assert.equal(failed.code, 500);
  assert.doesNotMatch(failed.payload.error, /hunter2/);
  assert.ok(failed.logs.some((line) => line.includes('hunter2')), 'the detail is logged for the operator');
});
