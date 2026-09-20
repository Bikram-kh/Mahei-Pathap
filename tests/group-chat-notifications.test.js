import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRealtimeEvent,
  clearGroupUnread,
  decodeGroupRealtimeDocument,
  incrementUnread,
  notificationPreview,
  notificationTitle,
  planMessageAlert,
  pruneUnread,
  readUnreadCounts,
  shouldNotifyForMessage,
} from '../src/lib/groupChatNotifications.js';

test('decodes packed Appwrite group message documents', () => {
  const message = decodeGroupRealtimeDocument({
    $id: 'message-1',
    groupId: 'group-1',
    userId: 'friend',
    payload: JSON.stringify({
      groupId: 'group-1',
      userId: 'friend',
      senderName: 'Friend',
      body: 'Revision starts at 7',
      type: 'message',
    }),
  });
  assert.equal(message.$id, 'message-1');
  assert.equal(message.body, 'Revision starts at 7');
  assert.equal(message.senderName, 'Friend');
});

test('notifies only for another member chat message', () => {
  const groups = new Set(['group-1']);
  const base = { groupId: 'group-1', userId: 'friend', type: 'message', body: 'Hello' };
  assert.equal(shouldNotifyForMessage(base, 'me', groups), true);
  assert.equal(shouldNotifyForMessage({ ...base, userId: 'me' }, 'me', groups), false);
  assert.equal(shouldNotifyForMessage({ ...base, type: 'system' }, 'me', groups), false);
  assert.equal(shouldNotifyForMessage({ ...base, groupId: 'private-group' }, 'me', groups), false);
  assert.equal(shouldNotifyForMessage(null, 'me', groups), false);
});

test('stored unread counts are bounded and malformed state is ignored', () => {
  const storage = { getItem: () => JSON.stringify({ good: 4, negative: -2, text: '8', huge: 5000 }) };
  assert.deepEqual(readUnreadCounts(storage, 'me'), { good: 4, huge: 999 });
  assert.deepEqual(readUnreadCounts({ getItem: () => '{bad json' }, 'me'), {});
});

test('notification previews stay short and single-line', () => {
  assert.equal(notificationPreview(' one\n two '), 'one two');
  assert.equal(notificationPreview('x'.repeat(200)).length, 123);
  assert.match(notificationPreview('x'.repeat(200)), /…$/);
});

const friendMessage = { groupId: 'group-1', userId: 'friend', type: 'message', body: 'Hello' };
const alertContext = {
  userId: 'me',
  memberGroupIds: new Set(['group-1']),
  activeGroupId: '',
  isAttending: true,
  permission: 'granted',
};

test('a friend message in a group I am not viewing counts as unread and shows a desktop alert', () => {
  assert.deepEqual(planMessageAlert({ ...alertContext, message: friendMessage }), { countUnread: true, showDesktop: true });
});

test('without browser permission the message still counts as unread but shows no desktop alert', () => {
  assert.deepEqual(
    planMessageAlert({ ...alertContext, message: friendMessage, permission: 'default' }),
    { countUnread: true, showDesktop: false },
  );
});

test('a message in the chat I am actively reading is not counted or announced', () => {
  assert.deepEqual(
    planMessageAlert({ ...alertContext, message: friendMessage, activeGroupId: 'group-1' }),
    { countUnread: false, showDesktop: false },
  );
});

test('the open chat still notifies when the page is hidden or unfocused', () => {
  assert.deepEqual(
    planMessageAlert({ ...alertContext, message: friendMessage, activeGroupId: 'group-1', isAttending: false }),
    { countUnread: true, showDesktop: true },
  );
});

test('denied or unsupported notification permission never shows a desktop alert', () => {
  for (const permission of ['denied', 'unsupported']) {
    assert.deepEqual(
      planMessageAlert({ ...alertContext, message: friendMessage, permission }),
      { countUnread: true, showDesktop: false },
    );
  }
});

test('my own messages and non-member groups never alert', () => {
  const none = { countUnread: false, showDesktop: false };
  assert.deepEqual(planMessageAlert({ ...alertContext, message: { ...friendMessage, userId: 'me' } }), none);
  assert.deepEqual(planMessageAlert({ ...alertContext, message: { ...friendMessage, groupId: 'other' } }), none);
  assert.deepEqual(planMessageAlert({ ...alertContext, message: null }), none);
});

test('classifies realtime events by collection and action', () => {
  const db = 'databases.main.collections';
  assert.deepEqual(classifyRealtimeEvent([`${db}.study-group-messages.documents.m1.create`]), { messageCreated: true, membershipChanged: false });
  assert.deepEqual(classifyRealtimeEvent([`${db}.study-group-messages.documents.m1.delete`]), { messageCreated: false, membershipChanged: false });
  assert.deepEqual(classifyRealtimeEvent([`${db}.study-group-members.documents.u1.delete`]), { messageCreated: false, membershipChanged: true });
  assert.deepEqual(classifyRealtimeEvent([`${db}.study-group-members.documents.u1.update`]), { messageCreated: false, membershipChanged: false });
  assert.deepEqual(classifyRealtimeEvent(undefined), { messageCreated: false, membershipChanged: false });
});

test('notification titles name the sender and group with safe fallbacks', () => {
  assert.equal(notificationTitle({ senderName: 'Asha' }, { name: 'Physics' }), 'Asha · Physics');
  assert.equal(notificationTitle({}, undefined), 'New message · Study Group');
});

test('unread counts increment per group, cap at 999, and clear without mutating', () => {
  const start = { a: 998 };
  assert.deepEqual(incrementUnread(start, 'a'), { a: 999 });
  assert.deepEqual(incrementUnread({ a: 999 }, 'a'), { a: 999 });
  assert.deepEqual(incrementUnread(start, 'b'), { a: 998, b: 1 });
  assert.deepEqual(start, { a: 998 });
  assert.deepEqual(clearGroupUnread({ a: 2, b: 1 }, 'a'), { b: 1 });
  const untouched = { b: 1 };
  assert.equal(clearGroupUnread(untouched, 'missing'), untouched);
});

test('unread counts for groups the person no longer belongs to are pruned', () => {
  const counts = { kept: 2, left: 5 };
  assert.deepEqual(pruneUnread(counts, new Set(['kept'])), { kept: 2 });
  const stable = { kept: 2 };
  assert.equal(pruneUnread(stable, new Set(['kept'])), stable);
});

test('unusable stored unread values fall back to no unread', () => {
  const stored = value => ({ getItem: () => value });
  assert.deepEqual(readUnreadCounts(stored('null'), 'me'), {});
  assert.deepEqual(readUnreadCounts(stored('[1,2]'), 'me'), {});
  assert.deepEqual(readUnreadCounts(stored(JSON.stringify({ half: 1.5 })), 'me'), {});
  assert.deepEqual(readUnreadCounts({ getItem: () => { throw new Error('blocked'); } }, 'me'), {});
  assert.deepEqual(readUnreadCounts(stored('{"a":1}'), ''), {});
});

test('a malformed message payload decodes to null', () => {
  assert.equal(decodeGroupRealtimeDocument({ $id: 'm', payload: '{not json' }), null);
});
