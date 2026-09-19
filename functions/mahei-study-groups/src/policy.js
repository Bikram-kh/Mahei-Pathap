import { createHash } from 'node:crypto';

export const MAX_MEMBERS = 20;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9_]{1,36}$/;

export const stableId = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);

// Errors made with fail() are safe to show to the student; anything else is logged and hidden.
export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  throw error;
}

export function validText(value, label, max, optional = false) {
  const text = String(value ?? '').trim();
  if ((!optional && !text) || text.length > max) {
    fail(`${label} must be ${optional ? 'at most' : 'between 1 and'} ${max} characters.`);
  }
  return text;
}

export function validRecordId(value, label = 'Item') {
  const id = String(value ?? '');
  if (!RECORD_ID_PATTERN.test(id)) fail(`${label} not found.`, 404);
  return id;
}

export function validInviteToken(token) {
  if (typeof token !== 'string' || !INVITE_TOKEN_PATTERN.test(token)) fail('This invitation link is not valid.');
  return token;
}

export function assertOwner(group, userId) {
  if (group.ownerId !== userId) fail('Only the group owner can do this.', 403);
}

export function assertActive(group) {
  if (group.status !== 'active') fail('This group is archived and is read-only.', 409);
}

export function invitationValid(invite, count, nowMs = Date.now()) {
  if (invite.revoked || Date.parse(invite.expiresAt) <= nowMs) fail('This invitation has expired or was revoked.', 410);
  if (count >= MAX_MEMBERS) fail(`This group already has ${MAX_MEMBERS} members.`, 409);
}
