import { assertOwner, fail, stableId, validRecordId } from './policy.js';
import { teamRead } from './appwrite.js';

export { teamRead };

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;

export const memberDocId = (groupId, userId) => stableId('member', groupId, userId);
export const callDocId = (groupId) => stableId('call', groupId);
export const inviteDocId = (token) => stableId('invite', token);

// Non-members get the same "not found" as a group that does not exist, so ids cannot be probed.
export async function requireMember(ctx, groupId) {
  const id = validRecordId(groupId, 'Group');
  const member = await ctx.db.optional('members', memberDocId(id, ctx.userId));
  const group = member && await ctx.db.optional('groups', id);
  if (!group) fail('Group not found.', 404);
  return { group, member };
}

export async function requireOwner(ctx, groupId) {
  const found = await requireMember(ctx, groupId);
  assertOwner(found.group, ctx.userId);
  return found;
}

export async function requireRecord(ctx, collection, id, groupId, label) {
  const record = await ctx.db.optional(collection, validRecordId(id, label));
  if (!record || record.groupId !== groupId) fail(`${label} not found.`, 404);
  return record;
}

// Fixed-window counter: at most `limit` calls per `windowMs` per person and action.
// One record per person and action is reused for every window, so the internal collection never grows.
export async function rateLimit(ctx, action, limit, windowMs) {
  const id = stableId('rate', ctx.userId, action);
  const windowStart = Math.floor(ctx.now() / windowMs) * windowMs;
  const fresh = { kind: 'rate', userId: ctx.userId, windowStart, count: 1, createdAt: ctx.iso() };

  const counter = await ctx.db.optional('internal', id);
  if (!counter) {
    try { await ctx.db.create('internal', id, fresh); return; } catch (error) {
      if (error.status !== 409) throw error;
    }
    return rateLimit(ctx, action, limit, windowMs);
  }
  if (counter.windowStart !== windowStart) {
    await ctx.db.update('internal', id, fresh);
    return;
  }
  if (counter.count >= limit) fail('You are doing that too quickly. Please wait a moment and try again.', 429);
  await ctx.db.update('internal', id, { ...counter, count: counter.count + 1 });
}
