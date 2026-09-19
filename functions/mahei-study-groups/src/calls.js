import { assertActive, fail } from './policy.js';
import { callDocId, requireMember, requireOwner, teamRead } from './access.js';
import { announce } from './messages.js';
import { publicCall } from './views.js';

// One document per group holds its current session, so a group can never have two active calls.
export async function startCall(ctx, body) {
  const { group, member } = await requireOwner(ctx, body.groupId);
  assertActive(group);
  return ctx.db.lock(`call:${group.$id}`, async () => {
    const id = callDocId(group.$id);
    const existing = await ctx.db.optional('calls', id);
    if (existing?.status === 'active') return { call: publicCall(existing) };

    const roomName = `group-${group.$id}-${ctx.newId()}`;
    await ctx.providers.startCall(roomName);
    const data = {
      groupId: group.$id, userId: ctx.userId, startedBy: ctx.userId, status: 'active',
      roomName, startedAt: ctx.iso(), createdAt: existing?.createdAt || ctx.iso(),
    };
    const call = existing
      ? await ctx.db.update('calls', id, data)
      : await ctx.db.create('calls', id, data, teamRead(group.$id));
    await announce(ctx, group, `${member.name} started a study session.`);
    return { call: publicCall(call) };
  });
}

export async function joinCall(ctx, body) {
  const { group, member } = await requireMember(ctx, body.groupId);
  const call = await ctx.db.optional('calls', callDocId(group.$id));
  if (call?.status !== 'active') fail('There is no active study session right now.', 409);
  return ctx.providers.joinCall(call, { $id: ctx.userId, name: member.name });
}

export async function endCall(ctx, body) {
  const { group } = await requireOwner(ctx, body.groupId);
  const call = await ctx.db.optional('calls', callDocId(group.$id));
  if (call?.status !== 'active') return { call: call ? publicCall(call) : null };
  await ctx.providers.endCall(call);
  const ended = await ctx.db.update('calls', call.$id, { ...call, status: 'ended', endedAt: ctx.iso() });
  return { call: publicCall(ended) };
}
