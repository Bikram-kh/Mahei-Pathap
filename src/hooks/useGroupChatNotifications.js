import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { studyGroupsRequest, subscribeToStudyGroups } from '../lib/studyGroups';
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
  writeUnreadCounts,
} from '../lib/groupChatNotifications';

const currentPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
const isAttending = () => !document.hidden && document.hasFocus();

// Unread counts live per tab: every tab hears the same realtime events, so sharing counts between tabs would double count.
function tabStorage() {
  try { return window.sessionStorage; } catch { return null; }
}

export default function useGroupChatNotifications({ user, activeGroupId = '', onOpenGroup }) {
  const userId = user?.$id;
  const [unreadByGroup, setUnreadByGroup] = useState(() => readUnreadCounts(tabStorage(), userId));
  const [permission, setPermission] = useState(currentPermission);
  const groupsRef = useRef(new Map());
  const refreshRef = useRef(null);
  const activeGroupRef = useRef(activeGroupId);
  const openGroupRef = useRef(onOpenGroup);

  useEffect(() => {
    activeGroupRef.current = activeGroupId;
    openGroupRef.current = onOpenGroup;
  });

  // The chat page already loads the person's groups; it hands them over so leaving or joining is reflected at once.
  const syncMemberships = useCallback(groups => {
    groupsRef.current = new Map(groups.map(group => [group.$id || group.id, group]));
    setUnreadByGroup(current => pruneUnread(current, new Set(groupsRef.current.keys())));
  }, []);

  const refreshMemberships = useCallback(() => {
    if (!refreshRef.current) {
      refreshRef.current = studyGroupsRequest('listGroups')
        .then(result => syncMemberships(result.groups || []))
        .finally(() => { refreshRef.current = null; });
    }
    return refreshRef.current;
  }, [syncMemberships]);

  useEffect(() => {
    groupsRef.current = new Map();
    refreshRef.current = null;
    setUnreadByGroup(readUnreadCounts(tabStorage(), userId));
    // A failed refresh is retried when the next message or membership event arrives.
    if (userId) refreshMemberships().catch(() => {});
  }, [userId, refreshMemberships]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    const openNotifications = new Set();

    const announce = message => {
      try {
        const notification = new Notification(notificationTitle(message, groupsRef.current.get(message.groupId)), {
          body: notificationPreview(message.body),
          icon: '/favicon.ico',
          tag: `mahei-group-${message.groupId}`,
        });
        openNotifications.add(notification);
        notification.onclose = () => openNotifications.delete(notification);
        notification.onclick = () => {
          window.focus();
          openGroupRef.current?.(message.groupId);
          notification.close();
        };
      } catch { /* unread badges remain available if the browser cannot show a desktop notification */ }
    };

    const handleMessage = async message => {
      // A group created or joined this session may not be known yet; learn about it before deciding.
      if (!groupsRef.current.has(message.groupId)) await refreshMemberships().catch(() => {});
      if (!active) return;
      const plan = planMessageAlert({
        message,
        userId,
        memberGroupIds: new Set(groupsRef.current.keys()),
        activeGroupId: activeGroupRef.current,
        isAttending: isAttending(),
        permission: currentPermission(),
      });
      if (plan.countUnread) setUnreadByGroup(current => incrementUnread(current, message.groupId));
      if (plan.showDesktop) announce(message);
    };

    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToStudyGroups(event => {
        const { messageCreated, membershipChanged } = classifyRealtimeEvent(event.events);
        if (membershipChanged) refreshMemberships().catch(() => {});
        if (!messageCreated) return;
        const message = decodeGroupRealtimeDocument(event.payload);
        if (message?.type === 'message' && message.userId !== userId) handleMessage(message);
      });
    } catch { /* the chat page's polling keeps chat data current when realtime is unavailable */ }

    return () => {
      active = false;
      unsubscribe();
      openNotifications.forEach(notification => notification.close());
    };
  }, [userId, refreshMemberships]);

  useEffect(() => {
    writeUnreadCounts(tabStorage(), userId, unreadByGroup);
  }, [unreadByGroup, userId]);

  useEffect(() => {
    const attend = () => {
      setPermission(currentPermission());
      if (isAttending() && activeGroupRef.current) {
        setUnreadByGroup(current => clearGroupUnread(current, activeGroupRef.current));
      }
    };
    document.addEventListener('visibilitychange', attend);
    window.addEventListener('focus', attend);
    return () => {
      document.removeEventListener('visibilitychange', attend);
      window.removeEventListener('focus', attend);
    };
  }, []);

  const markGroupRead = useCallback(groupId => {
    if (groupId) setUnreadByGroup(current => clearGroupUnread(current, groupId));
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return 'unsupported'; }
    // Older Safari answers through a callback and returns nothing, so fall back to the live permission.
    const result = (await Notification.requestPermission()) || currentPermission();
    setPermission(result);
    return result;
  }, []);

  const totalUnread = useMemo(() => Object.values(unreadByGroup).reduce((sum, count) => sum + count, 0), [unreadByGroup]);
  return { unreadByGroup, totalUnread, permission, markGroupRead, requestPermission, syncMemberships };
}
