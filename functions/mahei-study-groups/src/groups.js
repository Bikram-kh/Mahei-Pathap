import { assertActive, assertOwner, fail, stableId, validRecordId, validText } from './policy.js';
import { HOUR_MS, callDocId, memberDocId, rateLimit, requireMember, requireOwner, teamRead } from './access.js';
import { publicCall, publicGroup, publicInvite, publicMember, publicNote, visibleNote } from './views.js';

const MAX_GROUPS_PER_PERSON = 20;
const GROUPS_CREATED_PER_HOUR = 5;

export async function createGroup(ctx, body) {
  const name = validText(body.name, 'Group name', 80);
  const subject = validText(body.subject, 'Subject', 80, true);
  const description = validText(body.description, 'Description', 500, true);
  const groupId = stableId('group', ctx.userId, validText(body.requestId, 'Request id', 80));

  const existing = await ctx.db.optional('groups', groupId);
  if (existing) return { group: publicGroup(existing) };

  await rateLimit(ctx, 'createGroup', GROUPS_CREATED_PER_HOUR, HOUR_MS);
  if ((await ctx.db.byUser('members', ctx.userId)).length >= MAX_GROUPS_PER_PERSON) {
    fail(`You can belong to at most ${MAX_GROUPS_PER_PERSON} study groups.`, 409);
  }
  const ownerName = await ctx.userName();
  const permissions = teamRead(groupId);
  await ctx.db.createTeam(groupId, name);
  try {
    const group = await ctx.db.create('groups', groupId, {
      groupId, userId: ctx.userId, ownerId: ctx.userId, name, subject, description,
      status: 'active', memberCount: 1, createdAt: ctx.iso(),
    }, permissions);
    await ctx.db.create('members', memberDocId(groupId, ctx.userId), {
      groupId, userId: ctx.userId, name: ownerName, role: 'owner', joinedAt: ctx.iso(), createdAt: ctx.iso(),
    }, permissions);
    await ctx.db.addTeamMember(groupId, ctx.userId);
    return { group: publicGroup(group) };
  } catch (error) {
    await ctx.db.delete('members', memberDocId(groupId, ctx.userId));
    await ctx.db.delete('groups', groupId);
    await ctx.db.deleteTeam(groupId).catch(() => {});
    throw error;
  }
}

export async function listGroups(ctx) {
  const memberships = await ctx.db.byUser('members', ctx.userId);
  const groups = await Promise.all(memberships.map((member) => ctx.db.optional('groups', member.groupId)));
  return { groups: groups.filter(Boolean).map(publicGroup) };
}

export async function getGroup(ctx, body) {
  const { group } = await requireMember(ctx, body.groupId);
  const isOwner = group.ownerId === ctx.userId;
  const [members, notes, invites, call] = await Promise.all([
    ctx.db.byGroup('members', group.$id),
    ctx.db.byGroup('notes', group.$id),
    isOwner ? ctx.db.byGroup('invites', group.$id) : [],
    ctx.db.optional('calls', callDocId(group.$id)),
  ]);
  return {
    group: publicGroup(group),
    members: members.map(publicMember),
    notes: notes.filter((note) => visibleNote(note, ctx.userId)).map(publicNote),
    invites: invites.filter((invite) => !invite.revoked && Date.parse(invite.expiresAt) > ctx.now()).map(publicInvite),
    call: call ? publicCall(call) : null,
  };
}

const isCollaborative = (note) => note.kind === 'collaborative' && Boolean(note.roomId);

async function rotateNoteRooms(ctx, group, members, readOnly) {
  const notes = await ctx.db.byGroup('notes', group.$id);
  for (const note of notes.filter(isCollaborative)) {
    const roomId = await ctx.providers.rotateNote(note, members, readOnly);
    await ctx.db.update('notes', note.$id, { ...note, roomId });
  }
}

// Provider access is revoked first, so a failure leaves the person a member and the removal can simply be retried.
async function revokeProviderAccess(ctx, group, userId, remaining) {
  await rotateNoteRooms(ctx, group, remaining, group.status !== 'active');
  const call = await ctx.db.optional('calls', callDocId(group.$id));
  if (call?.status === 'active') await ctx.providers.removeParticipant(call, userId);
}

async function detachMember(ctx, group, userId) {
  await ctx.db.lock(`group:${group.$id}`, async () => {
    const members = await ctx.db.byGroup('members', group.$id);
    const remaining = members.filter((member) => member.userId !== userId);
    await revokeProviderAccess(ctx, group, userId, remaining);
    await ctx.db.removeTeamMember(group.$id, userId);
    await ctx.db.delete('members', memberDocId(group.$id, userId));
    await ctx.db.update('groups', group.$id, { ...group, memberCount: remaining.length });
  });
}

export async function removeMember(ctx, body) {
  const { group } = await requireOwner(ctx, body.groupId);
  assertActive(group);
  const targetId = validRecordId(body.userId, 'Member');
  if (targetId === group.ownerId) fail('The owner cannot be removed. Transfer ownership first.');
  if (!await ctx.db.optional('members', memberDocId(group.$id, targetId))) fail('That person is not a member of this group.', 404);
  await detachMember(ctx, group, targetId);
  return {};
}

export async function leaveGroup(ctx, body) {
  const { group } = await requireMember(ctx, body.groupId);
  if (group.ownerId === ctx.userId) fail('Transfer ownership or archive the group before leaving it.', 409);
  await detachMember(ctx, group, ctx.userId);
  return {};
}

export async function transferOwnership(ctx, body) {
  const { group, member: current } = await requireOwner(ctx, body.groupId);
  assertActive(group);
  const targetId = validRecordId(body.userId, 'Member');
  if (targetId === ctx.userId) fail('You already own this group.');
  const target = await ctx.db.optional('members', memberDocId(group.$id, targetId));
  if (!target) fail('That person is not a member of this group.', 404);
  const updated = await ctx.db.update('groups', group.$id, { ...group, ownerId: targetId });
  await ctx.db.update('members', memberDocId(group.$id, targetId), { ...target, role: 'owner' });
  await ctx.db.update('members', memberDocId(group.$id, ctx.userId), { ...current, role: 'member' });
  return { group: publicGroup(updated) };
}

// Archiving closes the call and makes every shared note read-only before the group itself is marked archived.
export async function archiveGroup(ctx, body) {
  const { group } = await requireOwner(ctx, body.groupId);
  assertOwner(group, ctx.userId);
  if (group.status === 'archived') return { group: publicGroup(group) };
  return ctx.db.lock(`group:${group.$id}`, async () => {
    const call = await ctx.db.optional('calls', callDocId(group.$id));
    if (call?.status === 'active') {
      await ctx.providers.endCall(call);
      await ctx.db.update('calls', call.$id, { ...call, status: 'ended', endedAt: ctx.iso() });
    }
    await rotateNoteRooms(ctx, group, await ctx.db.byGroup('members', group.$id), true);
    const archived = await ctx.db.update('groups', group.$id, { ...group, status: 'archived' });
    return { group: publicGroup(archived) };
  });
}
