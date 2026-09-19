import { assertActive, assertOwner, stableId, validRecordId, validText } from './policy.js';
import { MINUTE_MS, rateLimit, requireMember, requireRecord, teamRead } from './access.js';
import { publicMessage } from './views.js';

export const MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_LENGTH = 4000;
const MESSAGES_PER_MINUTE = 20;

export async function sendMessage(ctx, body) {
  const { group, member } = await requireMember(ctx, body.groupId);
  assertActive(group);
  const text = validText(body.body, 'Message', MAX_MESSAGE_LENGTH);
  const messageId = stableId('message', group.$id, ctx.userId, validText(body.requestId, 'Request id', 80));

  const existing = await ctx.db.optional('messages', messageId);
  if (existing) return { message: publicMessage(existing) };

  await rateLimit(ctx, 'sendMessage', MESSAGES_PER_MINUTE, MINUTE_MS);
  try {
    const message = await ctx.db.create('messages', messageId, {
      groupId: group.$id, userId: ctx.userId, senderName: member.name, body: text, type: 'message', createdAt: ctx.iso(),
    }, teamRead(group.$id));
    return { message: publicMessage(message) };
  } catch (error) {
    // The same request arrived twice at once; the first one won, so return its message.
    const winner = error.status === 409 && await ctx.db.optional('messages', messageId);
    if (!winner) throw error;
    return { message: publicMessage(winner) };
  }
}

// Group updates ("a note was shared", "a study session started") appear in the conversation as system messages.
export async function announce(ctx, group, text, extra = {}) {
  await ctx.db.create('messages', ctx.newId(), {
    groupId: group.$id, userId: ctx.userId, senderName: '', body: text, type: 'system', createdAt: ctx.iso(), ...extra,
  }, teamRead(group.$id));
}

// Returns the newest page in oldest-first order; `cursor` is the id to pass back to load earlier messages.
export async function listMessages(ctx, body) {
  const { group } = await requireMember(ctx, body.groupId);
  const after = body.cursor ? validRecordId(body.cursor, 'Message') : null;
  const page = await ctx.db.byGroup('messages', group.$id, { newestFirst: true, limit: MESSAGE_PAGE_SIZE, after });
  const oldestOnPage = page.at(-1);
  const hasMore = page.length === MESSAGE_PAGE_SIZE;
  return { messages: page.map(publicMessage).reverse(), cursor: hasMore ? oldestOnPage.$id : null };
}

export async function deleteMessage(ctx, body) {
  const { group } = await requireMember(ctx, body.groupId);
  assertActive(group);
  const message = await requireRecord(ctx, 'messages', body.messageId, group.$id, 'Message');
  if (message.userId !== ctx.userId) assertOwner(group, ctx.userId);
  await ctx.db.delete('messages', message.$id);
  return {};
}
