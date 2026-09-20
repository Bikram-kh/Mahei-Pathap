const STORAGE_PREFIX = 'mahei.groupUnread.v1:';
const MAX_UNREAD = 999;

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function decodeGroupRealtimeDocument(document) {
  if (!document || typeof document !== 'object') return null;
  try {
    const data = typeof document.payload === 'string' ? JSON.parse(document.payload) : document;
    if (!data || typeof data !== 'object') return null;
    return {
      ...data,
      $id: document.$id || data.$id || '',
      $createdAt: document.$createdAt || data.$createdAt || data.createdAt || '',
      groupId: data.groupId || document.groupId || '',
      userId: data.userId || document.userId || '',
    };
  } catch {
    return null;
  }
}

export function shouldNotifyForMessage(message, userId, memberGroupIds) {
  return Boolean(
    message &&
    message.type === 'message' &&
    message.body &&
    message.userId &&
    message.userId !== userId &&
    memberGroupIds?.has(message.groupId),
  );
}

// Decides what an incoming message should do for this viewer: bump the unread badge, show a desktop alert, or nothing.
// A chat the person is actively reading (right group, page visible and focused) stays silent.
export function planMessageAlert({ message, userId, memberGroupIds, activeGroupId, isAttending, permission }) {
  if (!shouldNotifyForMessage(message, userId, memberGroupIds)) return { countUnread: false, showDesktop: false };
  const isReading = activeGroupId === message.groupId && isAttending;
  return { countUnread: !isReading, showDesktop: !isReading && permission === 'granted' };
}

// Appwrite realtime event names look like `databases.<db>.collections.<collection>.documents.<id>.<action>`.
export function classifyRealtimeEvent(events) {
  const names = Array.isArray(events) ? events : [];
  const matches = (collection, action) => names.some(name => name.includes(`.${collection}.`) && name.endsWith(`.${action}`));
  return {
    messageCreated: matches('study-group-messages', 'create'),
    membershipChanged: matches('study-group-members', 'create') || matches('study-group-members', 'delete'),
  };
}

export function notificationTitle(message, group) {
  return `${message.senderName || 'New message'} · ${group?.name || 'Study Group'}`;
}

export function notificationPreview(value, maxLength = 122) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

export function readUnreadCounts(storage, userId) {
  if (!userId) return {};
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey(userId)) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([groupId, count]) =>
      Number.isInteger(count) && count > 0
        ? [[groupId, Math.min(count, MAX_UNREAD)]]
        : [],
    ));
  } catch {
    return {};
  }
}

export function writeUnreadCounts(storage, userId, counts) {
  if (!userId) return;
  try { storage?.setItem(storageKey(userId), JSON.stringify(counts)); } catch { /* storage may be unavailable */ }
}

export function incrementUnread(counts, groupId) {
  return { ...counts, [groupId]: Math.min((counts[groupId] || 0) + 1, MAX_UNREAD) };
}

export function clearGroupUnread(counts, groupId) {
  if (!counts[groupId]) return counts;
  const next = { ...counts };
  delete next[groupId];
  return next;
}

// Drops counts for groups the person has left, been removed from, or that were deleted.
export function pruneUnread(counts, memberGroupIds) {
  const entries = Object.entries(counts);
  const kept = entries.filter(([groupId]) => memberGroupIds.has(groupId));
  return kept.length === entries.length ? counts : Object.fromEntries(kept);
}
