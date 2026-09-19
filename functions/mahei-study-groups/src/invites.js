import { INVITE_TTL_MS, assertActive, fail, invitationValid, validInviteToken } from './policy.js';
import { HOUR_MS, MINUTE_MS, inviteDocId, memberDocId, rateLimit, requireOwner, requireRecord } from './access.js';
import { publicGroup, publicInvite } from './views.js';

const INVITES_PER_HOUR = 30;
const LOOKUPS_PER_MINUTE = 30;
const INVALID_LINK = 'This invitation link is not valid.';

// The token is the secret: only its hash is stored, and it is returned once, to the owner who created it.
export async function createInvite(ctx, body) {
  const { group } = await requireOwner(ctx, body.groupId);
  assertActive(group);
  await rateLimit(ctx, 'createInvite', INVITES_PER_HOUR, HOUR_MS);
  const token = ctx.newToken();
  const invite = await ctx.db.create('invites', inviteDocId(token), {
    groupId: group.$id, userId: ctx.userId, createdBy: ctx.userId,
    expiresAt: new Date(ctx.now() + INVITE_TTL_MS).toISOString(), revoked: false, createdAt: ctx.iso(),
  });
  return { token, invite: publicInvite(invite) };
}

export async function revokeInvite(ctx, body) {
  const { group } = await requireOwner(ctx, body.groupId);
  const invite = await requireRecord(ctx, 'invites', body.inviteId, group.$id, 'Invitation');
  return { invite: publicInvite(await ctx.db.update('invites', invite.$id, { ...invite, revoked: true })) };
}

async function findInvite(ctx, rawToken) {
  const token = validInviteToken(rawToken);
  await rateLimit(ctx, 'inviteLookup', LOOKUPS_PER_MINUTE, MINUTE_MS);
  const invite = await ctx.db.optional('invites', inviteDocId(token));
  const group = invite && await ctx.db.optional('groups', invite.groupId);
  if (!group) fail(INVALID_LINK, 404);
  return { invite, group };
}

const preview = (group, alreadyMember, invite) => ({
  group: { name: group.name, subject: group.subject, description: group.description, memberCount: group.memberCount },
  alreadyMember,
  expiresAt: invite.expiresAt,
});

export async function previewInvite(ctx, body) {
  const { invite, group } = await findInvite(ctx, body.token);
  assertActive(group);
  const isMember = Boolean(await ctx.db.optional('members', memberDocId(group.$id, ctx.userId)));
  if (!isMember) invitationValid(invite, group.memberCount, ctx.now());
  return preview(group, isMember, invite);
}

export async function joinGroup(ctx, body) {
  const { invite, group: seen } = await findInvite(ctx, body.token);
  return ctx.db.lock(`group:${seen.$id}`, async () => {
    const group = await ctx.db.get('groups', seen.$id);
    const memberId = memberDocId(group.$id, ctx.userId);
    if (await ctx.db.optional('members', memberId)) return { group: publicGroup(group), groupId: group.$id, alreadyMember: true };

    assertActive(group);
    const members = await ctx.db.byGroup('members', group.$id);
    invitationValid(invite, members.length, ctx.now());
    const name = await ctx.userName();
    await ctx.db.create('members', memberId, {
      groupId: group.$id, userId: ctx.userId, name, role: 'member', joinedAt: ctx.iso(), createdAt: ctx.iso(),
    }, [`read("team:${group.$id}")`]);
    try {
      await ctx.db.addTeamMember(group.$id, ctx.userId);
    } catch (error) {
      await ctx.db.delete('members', memberId);
      throw error;
    }
    const updated = await ctx.db.update('groups', group.$id, { ...group, memberCount: members.length + 1 });
    return { group: publicGroup(updated), groupId: group.$id, alreadyMember: false };
  });
}
