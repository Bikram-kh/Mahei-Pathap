import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyGroupsService } from '../functions/mahei-study-groups/src/service.js';
import { MESSAGE_PAGE_SIZE } from '../functions/mahei-study-groups/src/messages.js';
import { createFakeDb, createFakeProviders, fakeSanitize } from './helpers/study-groups-fakes.js';

const USERS = { owner: 'Olivia Owner', ann: 'Ann', bob: 'Bob', eve: 'Eve' };

function harness({ providers: providerOptions, users = USERS } = {}) {
  const db = createFakeDb({
    users,
    personalNotes: {
      annNote: { $id: 'annNote', userId: 'ann', title: 'Algebra', content: 'mahei-rich-v1:<p>x squared</p>' },
      bobNote: { $id: 'bobNote', userId: 'bob', title: 'Private', content: 'secret' },
    },
  });
  const providers = createFakeProviders(providerOptions);
  let clock = Date.UTC(2026, 0, 1);
  let tokens = 0;
  let requests = 0;
  const service = createStudyGroupsService({
    db, providers, sanitize: fakeSanitize, now: () => clock,
    newToken: () => `token${String((tokens += 1)).padStart(2, '0')}`.padEnd(40, 'x'),
  });
  const call = (userId, action, body = {}) => service.run(userId, action, { requestId: `req-${(requests += 1)}`, ...body });
  const advance = (ms) => { clock += ms; };
  return { db, providers, call, advance };
}

const status = (code) => (error) => error.status === code;

async function groupWithMembers(h, memberIds = ['ann']) {
  const { group } = await h.call('owner', 'createGroup', { name: 'Maths crew', subject: 'Maths', description: 'Exam prep' });
  for (const userId of memberIds) {
    const { token } = await h.call('owner', 'createInvite', { groupId: group.$id });
    await h.call(userId, 'joinGroup', { token });
  }
  return group.$id;
}

/* ---------- groups ---------- */

test('creating a group makes a team, an owner membership and is idempotent per request', async () => {
  const h = harness();
  const first = await h.call('owner', 'createGroup', { name: ' Maths crew ', requestId: 'same' });
  const again = await h.call('owner', 'createGroup', { name: ' Maths crew ', requestId: 'same' });
  assert.equal(first.group.$id, again.group.$id);
  assert.equal(first.group.name, 'Maths crew');
  assert.equal(first.group.ownerId, 'owner');
  assert.equal(first.group.memberCount, 1);
  assert.ok(h.db.teams.get(first.group.$id).members.has('owner'));
  assert.equal(h.db.tables.get('groups').size, 1);
});

test('creating a group rejects blank and oversized names', async () => {
  const h = harness();
  await assert.rejects(h.call('owner', 'createGroup', { name: '   ' }), status(400));
  await assert.rejects(h.call('owner', 'createGroup', { name: 'x'.repeat(81) }), status(400));
  await assert.rejects(h.call('owner', 'createGroup', { name: 'ok', description: 'y'.repeat(501) }), status(400));
});

test('listGroups shows only the groups the caller belongs to', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  assert.deepEqual((await h.call('owner', 'listGroups')).groups.map((g) => g.$id), [groupId]);
  assert.deepEqual((await h.call('ann', 'listGroups')).groups.map((g) => g.$id), [groupId]);
  assert.deepEqual((await h.call('eve', 'listGroups')).groups, []);
});

test('a non-member cannot read or write a group and cannot tell whether it exists', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h);
  for (const action of ['getGroup', 'listMessages']) {
    await assert.rejects(h.call('eve', action, { groupId }), status(404));
  }
  await assert.rejects(h.call('eve', 'sendMessage', { groupId, body: 'hi' }), status(404));
  await assert.rejects(h.call('eve', 'getGroup', { groupId: 'does-not-exist' }), status(404));
});

test('getGroup returns members, notes and (for the owner only) active invitations', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await h.call('owner', 'createInvite', { groupId });
  const asOwner = await h.call('owner', 'getGroup', { groupId });
  const asMember = await h.call('ann', 'getGroup', { groupId });
  assert.deepEqual(asOwner.members.map((m) => m.userId).sort(), ['ann', 'owner']);
  assert.ok(asOwner.invites.length >= 1);
  assert.equal(asMember.invites.length, 0);
  assert.equal(asOwner.call, null);
  assert.ok(!JSON.stringify(asOwner).includes('token01'), 'invitation secrets are never returned by getGroup');
});

/* ---------- invitations ---------- */

test('only the owner can create or revoke invitations', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await assert.rejects(h.call('ann', 'createInvite', { groupId }), status(403));
  const { invite } = await h.call('owner', 'createInvite', { groupId });
  await assert.rejects(h.call('ann', 'revokeInvite', { groupId, inviteId: invite.$id }), status(403));
});

test('a valid invitation previews the group, then joins it once', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const { token } = await h.call('owner', 'createInvite', { groupId });
  const preview = await h.call('bob', 'previewInvite', { token });
  assert.equal(preview.group.name, 'Maths crew');
  assert.equal(preview.alreadyMember, false);
  const joined = await h.call('bob', 'joinGroup', { token });
  assert.equal(joined.group.memberCount, 2);
  assert.ok(h.db.teams.get(groupId).members.has('bob'));
  const again = await h.call('bob', 'joinGroup', { token });
  assert.equal(again.group.memberCount, 2, 'joining twice does not add a second membership');
  assert.equal((await h.call('bob', 'previewInvite', { token })).alreadyMember, true);
});

test('expired, revoked, malformed and unknown invitations are rejected', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const expiring = await h.call('owner', 'createInvite', { groupId });
  h.advance(7 * 24 * 60 * 60 * 1000 + 1000);
  await assert.rejects(h.call('bob', 'joinGroup', { token: expiring.token }), status(410));
  const revoked = await h.call('owner', 'createInvite', { groupId });
  await h.call('owner', 'revokeInvite', { groupId, inviteId: revoked.invite.$id });
  await assert.rejects(h.call('bob', 'previewInvite', { token: revoked.token }), status(410));
  await assert.rejects(h.call('bob', 'previewInvite', { token: '<script>' }), status(400));
  await assert.rejects(h.call('bob', 'previewInvite', { token: 'z'.repeat(40) }), status(404));
});

test('a group stops accepting members at 20', async () => {
  const users = { owner: 'Owner', late: 'Late' };
  for (let i = 1; i < 20; i += 1) users[`m${i}`] = `Member ${i}`;
  const h = harness({ users });
  const groupId = await groupWithMembers(h, Array.from({ length: 19 }, (_, i) => `m${i + 1}`));
  const { token } = await h.call('owner', 'createInvite', { groupId });
  await assert.rejects(h.call('late', 'joinGroup', { token }), status(409));
  assert.equal((await h.call('owner', 'getGroup', { groupId })).group.memberCount, 20);
});

test('an archived group refuses new members', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const { token } = await h.call('owner', 'createInvite', { groupId });
  await h.call('owner', 'archiveGroup', { groupId });
  await assert.rejects(h.call('bob', 'joinGroup', { token }), status(409));
});

/* ---------- messages ---------- */

test('messages are stored with the sender name, returned oldest first and are idempotent', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await h.call('ann', 'sendMessage', { groupId, body: 'hello', requestId: 'dup' });
  const repeat = await h.call('ann', 'sendMessage', { groupId, body: 'hello', requestId: 'dup' });
  await h.call('owner', 'sendMessage', { groupId, body: 'welcome' });
  const { messages } = await h.call('owner', 'listMessages', { groupId });
  assert.deepEqual(messages.map((m) => m.body), ['hello', 'welcome']);
  assert.equal(messages[0].senderName, 'Ann');
  assert.equal(repeat.message.$id, messages[0].$id);
});

test('messages reject empty and oversized bodies', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  await assert.rejects(h.call('owner', 'sendMessage', { groupId, body: '   ' }), status(400));
  await assert.rejects(h.call('owner', 'sendMessage', { groupId, body: 'x'.repeat(4001) }), status(400));
});

test('history is paginated newest page first with a cursor for earlier messages', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const total = MESSAGE_PAGE_SIZE + 5;
  for (let i = 1; i <= total; i += 1) {
    h.advance(3000);
    await h.call('owner', 'sendMessage', { groupId, body: `m${i}` });
  }
  const recent = await h.call('owner', 'listMessages', { groupId });
  assert.equal(recent.messages.length, MESSAGE_PAGE_SIZE);
  assert.equal(recent.messages.at(-1).body, `m${total}`);
  assert.ok(recent.cursor);
  const older = await h.call('owner', 'listMessages', { groupId, cursor: recent.cursor });
  assert.deepEqual(older.messages.map((m) => m.body), ['m1', 'm2', 'm3', 'm4', 'm5']);
  assert.equal(older.cursor, null);
});

test('authors delete their own messages and the owner can delete any', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann', 'bob']);
  const { message: annMsg } = await h.call('ann', 'sendMessage', { groupId, body: 'mine' });
  const { message: bobMsg } = await h.call('bob', 'sendMessage', { groupId, body: 'his' });
  await assert.rejects(h.call('ann', 'deleteMessage', { groupId, messageId: bobMsg.$id }), status(403));
  await h.call('ann', 'deleteMessage', { groupId, messageId: annMsg.$id });
  await h.call('owner', 'deleteMessage', { groupId, messageId: bobMsg.$id });
  const { messages } = await h.call('owner', 'listMessages', { groupId });
  assert.deepEqual(messages.filter((m) => m.type !== 'system'), []);
});

test('archived groups stay readable but reject messages', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await h.call('ann', 'sendMessage', { groupId, body: 'before' });
  await h.call('owner', 'archiveGroup', { groupId });
  await assert.rejects(h.call('ann', 'sendMessage', { groupId, body: 'after' }), status(409));
  assert.ok((await h.call('ann', 'listMessages', { groupId })).messages.some((m) => m.body === 'before'));
  assert.equal((await h.call('ann', 'getGroup', { groupId })).group.status, 'archived');
});

test('messages are rate limited per member and recover after the window', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  let blocked = null;
  for (let i = 0; i < 40 && !blocked; i += 1) {
    try { await h.call('owner', 'sendMessage', { groupId, body: `spam ${i}` }); } catch (error) { blocked = error; }
  }
  assert.equal(blocked?.status, 429);
  h.advance(61 * 1000);
  await h.call('owner', 'sendMessage', { groupId, body: 'calm again' });
});

test('two identical sends arriving at once store a single message', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const [a, b] = await Promise.all([
    h.call('owner', 'sendMessage', { groupId, body: 'once', requestId: 'race' }),
    h.call('owner', 'sendMessage', { groupId, body: 'once', requestId: 'race' }),
  ]);
  assert.equal(a.message.$id, b.message.$id);
  assert.equal((await h.call('owner', 'listMessages', { groupId })).messages.length, 1);
});

test('the rate limiter keeps one record per person and action however long it runs', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  for (let minute = 0; minute < 5; minute += 1) {
    await h.call('owner', 'sendMessage', { groupId, body: `minute ${minute}` });
    h.advance(61 * 1000);
  }
  const counters = [...h.db.tables.get('internal').values()].filter((doc) => doc.kind === 'rate' && doc.userId === 'owner');
  assert.equal(counters.length, new Set(counters.map((doc) => doc.$id)).size);
  assert.ok(counters.length <= 3, `expected a handful of counters, found ${counters.length}`);
});

/* ---------- membership changes ---------- */

test('removing a member revokes team, note, and call access', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann', 'bob']);
  const { note } = await h.call('owner', 'createNote', { groupId, title: 'Shared' });
  await h.call('owner', 'startCall', { groupId });
  await h.call('ann', 'joinCall', { groupId });
  await h.call('owner', 'removeMember', { groupId, userId: 'ann' });

  assert.ok(!h.db.teams.get(groupId).members.has('ann'));
  await assert.rejects(h.call('ann', 'getGroup', { groupId }), status(404));
  await assert.rejects(h.call('ann', 'liveblocksAuth', { groupId, noteId: note.$id }), status(404));
  assert.ok(h.providers.removed.some((r) => r.userId === 'ann'), 'active call participant is disconnected');
  const [room] = [...h.providers.rooms.values()];
  assert.ok(!room.users.has('ann') && room.users.has('bob'), 'editing access is revoked, others keep theirs');
  const stored = await h.db.get('notes', note.$id);
  assert.notEqual(stored.roomId, note.roomId, 'the room id rotates so open sockets are dropped');
  assert.equal((await h.call('owner', 'getGroup', { groupId })).group.memberCount, 2);
});

test('only the owner can remove members and the owner cannot be removed', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann', 'bob']);
  await assert.rejects(h.call('ann', 'removeMember', { groupId, userId: 'bob' }), status(403));
  await assert.rejects(h.call('owner', 'removeMember', { groupId, userId: 'owner' }), status(400));
  await assert.rejects(h.call('owner', 'removeMember', { groupId, userId: 'eve' }), status(404));
});

test('members can leave, but the owner must transfer or archive first', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await assert.rejects(h.call('owner', 'leaveGroup', { groupId }), status(409));
  await h.call('ann', 'leaveGroup', { groupId });
  assert.ok(!h.db.teams.get(groupId).members.has('ann'));
  assert.deepEqual((await h.call('ann', 'listGroups')).groups, []);
});

test('ownership transfers only to an existing member', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await assert.rejects(h.call('owner', 'transferOwnership', { groupId, userId: 'eve' }), status(404));
  await assert.rejects(h.call('ann', 'transferOwnership', { groupId, userId: 'ann' }), status(403));
  await h.call('owner', 'transferOwnership', { groupId, userId: 'ann' });
  await assert.rejects(h.call('owner', 'createInvite', { groupId }), status(403));
  await h.call('ann', 'createInvite', { groupId });
  await h.call('owner', 'leaveGroup', { groupId });
});

test('archiving ends the call, makes notes read-only and blocks further changes', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  const { note } = await h.call('owner', 'createNote', { groupId, title: 'Shared' });
  await h.call('owner', 'startCall', { groupId });
  await assert.rejects(h.call('ann', 'archiveGroup', { groupId }), status(403));
  await h.call('owner', 'archiveGroup', { groupId });

  assert.equal(h.providers.calls.size, 0, 'video room is closed');
  const [room] = [...h.providers.rooms.values()];
  assert.equal(room.readOnly, true);
  const { authorization } = await h.call('ann', 'liveblocksAuth', { groupId, noteId: note.$id });
  assert.ok(authorization.token);
  await assert.rejects(h.call('owner', 'createNote', { groupId, title: 'More' }), status(409));
  await assert.rejects(h.call('owner', 'createInvite', { groupId }), status(409));
  await assert.rejects(h.call('owner', 'startCall', { groupId }), status(409));
  await h.call('ann', 'leaveGroup', { groupId });
});

/* ---------- notes ---------- */

test('a new shared note creates a collaboration room for every member and announces itself', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  const { note } = await h.call('ann', 'createNote', { groupId, title: ' Revision ' });
  assert.equal(note.title, 'Revision');
  assert.equal(note.kind, 'collaborative');
  assert.ok(note.roomId.startsWith(`group:${groupId}:note:`));
  assert.deepEqual([...h.providers.rooms.get(note.roomId).users].sort(), ['ann', 'owner']);
  const { messages } = await h.call('owner', 'listMessages', { groupId });
  assert.ok(messages.some((m) => m.noteId === note.$id));
});

test('copying a personal note sanitises it and only works for its owner', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann', 'bob']);
  const { note } = await h.call('ann', 'createNote', { groupId, title: 'Algebra copy', sourceNoteId: 'annNote' });
  assert.equal(h.providers.rooms.get(note.roomId).html, 'SAFE(mahei-rich-v1:<p>x squared</p>)');
  await assert.rejects(h.call('ann', 'createNote', { groupId, title: 'Stolen', sourceNoteId: 'bobNote' }), status(403));
  await assert.rejects(h.call('ann', 'createNote', { groupId, title: 'Missing', sourceNoteId: 'nope' }), status(404));
});

test('collaboration that is not configured fails clearly and leaves nothing behind', async () => {
  const h = harness({ providers: { collaboration: false } });
  const groupId = await groupWithMembers(h, []);
  await assert.rejects(h.call('owner', 'createNote', { groupId, title: 'Shared' }), status(503));
  assert.equal((await h.call('owner', 'getGroup', { groupId })).notes.length, 0);
});

test('liveblocks authorization needs membership and a collaborative note in the same group', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  const other = await groupWithMembers(h, []);
  const { note } = await h.call('owner', 'createNote', { groupId, title: 'Shared' });
  const ok = await h.call('ann', 'liveblocksAuth', { groupId, noteId: note.$id });
  assert.ok(ok.authorization.token);
  await assert.rejects(h.call('eve', 'liveblocksAuth', { groupId, noteId: note.$id }), status(404));
  await assert.rejects(h.call('owner', 'liveblocksAuth', { groupId: other, noteId: note.$id }), status(404));
});

test('the author and the owner can delete a shared note, other members cannot', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann', 'bob']);
  const { note } = await h.call('ann', 'createNote', { groupId, title: 'Ann note' });
  await assert.rejects(h.call('bob', 'deleteNote', { groupId, noteId: note.$id }), status(403));
  await h.call('owner', 'deleteNote', { groupId, noteId: note.$id });
  assert.equal(h.providers.rooms.size, 0);
  assert.equal((await h.call('ann', 'getGroup', { groupId })).notes.length, 0);
});

/* ---------- PDFs ---------- */

const uploadFor = (h, ticket, { isPdf = true, size = 1024 } = {}) => h.db.files.set(ticket.fileId, { size, isPdf, mimeType: 'application/pdf' });

test('a PDF is prepared, uploaded by the client, validated and published to the team only', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  const ticket = await h.call('ann', 'preparePdf', { groupId, title: 'Past paper', fileName: 'paper.pdf', size: 2048 });
  assert.equal(ticket.bucketId, 'study-group-files');
  assert.equal(ticket.note.kind, 'upload');
  uploadFor(h, ticket);
  const done = await h.call('ann', 'finalizePdf', { groupId, noteId: ticket.note.$id });
  assert.equal(done.note.kind, 'pdf');
  assert.equal(h.db.files.get(ticket.fileId).readTeam, groupId);
  const { notes } = await h.call('owner', 'getGroup', { groupId });
  assert.deepEqual(notes.map((n) => [n.title, n.kind]), [['Past paper', 'pdf']]);
});

test('PDF requests reject wrong types and files over 25 MB before anything is stored', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  await assert.rejects(h.call('owner', 'preparePdf', { groupId, title: 't', fileName: 'run.exe', size: 10 }), status(400));
  await assert.rejects(h.call('owner', 'preparePdf', { groupId, title: 't', fileName: 'big.pdf', size: 25 * 1024 * 1024 + 1 }), status(400));
  assert.equal(h.db.tables.get('notes')?.size ?? 0, 0);
});

test('a file that is not really a PDF is deleted and the note removed', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const ticket = await h.call('owner', 'preparePdf', { groupId, title: 'Fake', fileName: 'fake.pdf', size: 100 });
  uploadFor(h, ticket, { isPdf: false });
  await assert.rejects(h.call('owner', 'finalizePdf', { groupId, noteId: ticket.note.$id }), status(400));
  assert.equal(h.db.files.size, 0);
  assert.equal(h.db.tables.get('notes').size, 0);
});

test('only the uploader can finalise a pending PDF', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  const ticket = await h.call('ann', 'preparePdf', { groupId, title: 'Mine', fileName: 'mine.pdf', size: 100 });
  uploadFor(h, ticket);
  await assert.rejects(h.call('owner', 'finalizePdf', { groupId, noteId: ticket.note.$id }), status(403));
});

/* ---------- video sessions ---------- */

test('only the owner starts and ends a session; members join with a short-lived token', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, ['ann']);
  await assert.rejects(h.call('ann', 'startCall', { groupId }), status(403));
  const started = await h.call('owner', 'startCall', { groupId });
  assert.equal(started.call.status, 'active');
  const again = await h.call('owner', 'startCall', { groupId });
  assert.equal(again.call.$id, started.call.$id, 'there is only ever one active call per group');
  assert.equal(h.providers.calls.size, 1);
  const joined = await h.call('ann', 'joinCall', { groupId });
  assert.equal(joined.token, 'lk-ann');
  assert.equal(joined.serverUrl, 'wss://example.test');
  await assert.rejects(h.call('ann', 'endCall', { groupId }), status(403));
  await h.call('owner', 'endCall', { groupId });
  assert.equal(h.providers.calls.size, 0);
  await assert.rejects(h.call('ann', 'joinCall', { groupId }), status(409));
  assert.equal((await h.call('ann', 'getGroup', { groupId })).call.status, 'ended');
});

test('a group can start a new session after the previous one ended', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  const first = await h.call('owner', 'startCall', { groupId });
  await h.call('owner', 'endCall', { groupId });
  const second = await h.call('owner', 'startCall', { groupId });
  assert.equal(second.call.status, 'active');
  assert.notEqual(second.call.roomName, first.call.roomName);
});

test('video that is not configured fails clearly and does not mark the call active', async () => {
  const h = harness({ providers: { video: false } });
  const groupId = await groupWithMembers(h, []);
  await assert.rejects(h.call('owner', 'startCall', { groupId }), status(503));
  assert.equal((await h.call('owner', 'getGroup', { groupId })).call, null);
});

test('non-members cannot join a call', async () => {
  const h = harness();
  const groupId = await groupWithMembers(h, []);
  await h.call('owner', 'startCall', { groupId });
  await assert.rejects(h.call('eve', 'joinCall', { groupId }), status(404));
});
