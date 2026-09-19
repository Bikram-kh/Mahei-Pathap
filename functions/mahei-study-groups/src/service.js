import { randomBytes } from 'node:crypto';
import { fail } from './policy.js';
import { newId as generateId } from './appwrite.js';
import { archiveGroup, createGroup, getGroup, leaveGroup, listGroups, removeMember, transferOwnership } from './groups.js';
import { createInvite, joinGroup, previewInvite, revokeInvite } from './invites.js';
import { deleteMessage, listMessages, sendMessage } from './messages.js';
import { createNote, deleteNote, finalizePdf, liveblocksAuth, preparePdf } from './notes.js';
import { endCall, joinCall, startCall } from './calls.js';

const ACTIONS = {
  createGroup, listGroups, getGroup, removeMember, leaveGroup, transferOwnership, archiveGroup,
  createInvite, revokeInvite, previewInvite, joinGroup,
  sendMessage, listMessages, deleteMessage,
  createNote, deleteNote, preparePdf, finalizePdf, liveblocksAuth,
  startCall, joinCall, endCall,
};

const DEFAULT_NAME = 'Student';
const NAME_LIMIT = 80;
const newToken = () => randomBytes(32).toString('base64url');

export function createStudyGroupsService({
  db, providers, sanitize, now = Date.now, newToken: makeToken = newToken, newId = generateId, log = () => {},
}) {
  return {
    async run(userId, action, body = {}) {
      const handler = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null;
      if (!handler) fail('Unsupported action.');
      let cachedName;
      const ctx = {
        db, providers, sanitize, userId, now, newId, log,
        newToken: makeToken,
        iso: () => new Date(now()).toISOString(),
        async userName() {
          cachedName ??= String((await db.user(userId)).name || DEFAULT_NAME).slice(0, NAME_LIMIT);
          return cachedName;
        },
      };
      return handler(ctx, body);
    },
  };
}
