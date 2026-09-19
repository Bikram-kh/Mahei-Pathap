// What the browser is allowed to see. Internal fields (payload wrappers, hashes) never leave the function.
const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

export const publicGroup = (group) => pick(group, ['$id', 'name', 'subject', 'description', 'status', 'ownerId', 'memberCount', 'createdAt']);

export const publicMember = (member) => pick(member, ['userId', 'name', 'role', 'joinedAt']);

export const publicMessage = (message) => pick(message, ['$id', 'groupId', 'userId', 'senderName', 'body', 'type', 'noteId', 'createdAt']);

export const publicNote = (note) => pick(note, ['$id', 'groupId', 'title', 'kind', 'roomId', 'fileId', 'authorId', 'authorName', 'createdAt']);

export const publicInvite = (invite) => pick(invite, ['$id', 'groupId', 'expiresAt', 'revoked', 'createdAt']);

export const publicCall = (call) => pick(call, ['$id', 'groupId', 'status', 'roomName', 'startedBy', 'startedAt', 'endedAt']);

// Pending uploads are only shown to the person who is still uploading them.
export const visibleNote = (note, userId) => note.kind !== 'upload' || note.authorId === userId;
