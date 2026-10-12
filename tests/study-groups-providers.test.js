import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviders } from '../functions/mahei-study-groups/src/providers.js';

const env = {
  LIVEKIT_URL: 'wss://example.livekit.test',
  LIVEKIT_API_KEY: 'test-key',
  LIVEKIT_API_SECRET: 'test-secret-that-is-long-enough-for-signing',
};
const call = { roomName: 'group-1-room' };
const user = { $id: 'user-1', name: 'Asha' };

// LiveKit answers with a Twirp error such as { code: 'not_found', status: 404 } when a room has closed.
const roomMissing = () => Object.assign(new Error('requested room does not exist'), { code: 'not_found', status: 404 });

function fakeRoomClient(overrides = {}) {
  const calls = [];
  return {
    calls,
    listParticipants: async () => [],
    createRoom: async (options) => { calls.push(['createRoom', options]); },
    deleteRoom: async (name) => { calls.push(['deleteRoom', name]); },
    removeParticipant: async (room, id) => { calls.push(['removeParticipant', room, id]); },
    ...overrides,
  };
}

const providersWith = (client) => createProviders(env, { createRoomClient: () => client });

test('joining a session whose LiveKit room already closed reopens the room and returns a token', async () => {
  const client = fakeRoomClient({ listParticipants: async () => { throw roomMissing(); } });

  const result = await providersWith(client).joinCall(call, user);

  assert.ok(result.token, 'a join token is issued');
  assert.equal(result.serverUrl, env.LIVEKIT_URL);
  assert.deepEqual(client.calls, [['createRoom', { name: 'group-1-room', maxParticipants: 8, emptyTimeout: 600, departureTimeout: 60 }]]);
});

test('joining a live room does not recreate it', async () => {
  const client = fakeRoomClient({ listParticipants: async () => [{ identity: 'someone-else' }] });

  const result = await providersWith(client).joinCall(call, user);

  assert.ok(result.token);
  assert.deepEqual(client.calls, []);
});

test('joining still fails clearly when the session is full', async () => {
  const full = Array.from({ length: 8 }, (_, index) => ({ identity: `member-${index}` }));
  const client = fakeRoomClient({ listParticipants: async () => full });

  await assert.rejects(providersWith(client).joinCall(call, user), { status: 409, expose: true });
});

test('joining surfaces unexpected LiveKit failures instead of hiding them', async () => {
  const client = fakeRoomClient({ listParticipants: async () => { throw new Error('LiveKit is unreachable'); } });

  await assert.rejects(providersWith(client).joinCall(call, user), /unreachable/);
  assert.deepEqual(client.calls, []);
});

test('ending a session whose room already closed succeeds', async () => {
  const client = fakeRoomClient({ deleteRoom: async () => { throw roomMissing(); } });

  await assert.doesNotReject(providersWith(client).endCall(call));
});

test('ending a session still reports unexpected LiveKit failures', async () => {
  const client = fakeRoomClient({ deleteRoom: async () => { throw new Error('LiveKit is unreachable'); } });

  await assert.rejects(providersWith(client).endCall(call), /unreachable/);
});

test('removing a member from a closed room succeeds', async () => {
  const client = fakeRoomClient({ removeParticipant: async () => { throw roomMissing(); } });

  await assert.doesNotReject(providersWith(client).removeParticipant(call, 'user-2'));
});
