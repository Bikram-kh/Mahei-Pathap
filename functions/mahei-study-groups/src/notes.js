import { MAX_PDF_BYTES, assertActive, assertOwner, fail, stableId, validRecordId, validText } from './policy.js';
import { HOUR_MS, rateLimit, requireMember, requireRecord, teamRead } from './access.js';
import { announce } from './messages.js';
import { publicNote } from './views.js';

const MAX_NOTES_PER_GROUP = 100;
const NOTES_PER_HOUR = 20;
const PDFS_PER_HOUR = 10;
const TITLE_LIMIT = 150;
const PDF_REJECTED = 'Choose a PDF smaller than 25 MB.';

async function assertNoteCapacity(ctx, group) {
  if ((await ctx.db.byGroup('notes', group.$id)).length >= MAX_NOTES_PER_GROUP) {
    fail(`A group can hold at most ${MAX_NOTES_PER_GROUP} shared notes.`, 409);
  }
}

// A copy is independent of the original: it is read once, sanitised, and never linked back.
async function importedHtml(ctx, sourceNoteId) {
  if (!sourceNoteId) return '';
  let source;
  try {
    source = await ctx.db.personalNote(validRecordId(sourceNoteId, 'Note'));
  } catch (error) {
    if (error.status === 404) fail('That note could not be found.', 404);
    throw error;
  }
  if (source.userId !== ctx.userId) fail('You can only share your own notes.', 403);
  return ctx.sanitize(source.content);
}

export async function createNote(ctx, body) {
  const { group, member } = await requireMember(ctx, body.groupId);
  assertActive(group);
  const title = validText(body.title, 'Title', TITLE_LIMIT);
  await rateLimit(ctx, 'createNote', NOTES_PER_HOUR, HOUR_MS);
  await assertNoteCapacity(ctx, group);
  const html = await importedHtml(ctx, body.sourceNoteId);
  const members = await ctx.db.byGroup('members', group.$id);
  const roomId = `group:${group.$id}:note:${ctx.newId()}`;

  await ctx.providers.createNote(roomId, members, html);
  let note;
  try {
    note = await ctx.db.create('notes', ctx.newId(), {
      groupId: group.$id, userId: ctx.userId, authorId: ctx.userId, authorName: member.name,
      title, kind: 'collaborative', roomId, createdAt: ctx.iso(),
    }, teamRead(group.$id));
  } catch (error) {
    await ctx.providers.deleteNote(roomId).catch(() => {});
    throw error;
  }
  await announce(ctx, group, `${member.name} shared a note: ${title}`, { noteId: note.$id });
  return { note: publicNote(note) };
}

export async function deleteNote(ctx, body) {
  const { group } = await requireMember(ctx, body.groupId);
  assertActive(group);
  const note = await requireRecord(ctx, 'notes', body.noteId, group.$id, 'Note');
  if (note.authorId !== ctx.userId) assertOwner(group, ctx.userId);
  if (note.kind === 'collaborative') await ctx.providers.deleteNote(note.roomId);
  else if (note.fileId) await ctx.db.deleteFile(note.fileId);
  await ctx.db.delete('notes', note.$id);
  return {};
}

const ticket = (ctx, note) => ({ bucketId: ctx.db.bucketId, fileId: note.fileId, note: publicNote(note) });

// Step 1 of a PDF share: reserve a file id. The browser then uploads straight to storage (create-only bucket).
export async function preparePdf(ctx, body) {
  const { group, member } = await requireMember(ctx, body.groupId);
  assertActive(group);
  const title = validText(body.title, 'Title', TITLE_LIMIT);
  const fileName = validText(body.fileName, 'File name', 200);
  const size = Number(body.size);
  if (!/\.pdf$/i.test(fileName) || !Number.isInteger(size) || size < 1 || size > MAX_PDF_BYTES) fail(PDF_REJECTED);

  const noteId = stableId('pdf', group.$id, ctx.userId, validText(body.requestId, 'Request id', 80));
  const existing = await ctx.db.optional('notes', noteId);
  if (existing) return ticket(ctx, existing);

  await rateLimit(ctx, 'preparePdf', PDFS_PER_HOUR, HOUR_MS);
  await assertNoteCapacity(ctx, group);
  const note = await ctx.db.create('notes', noteId, {
    groupId: group.$id, userId: ctx.userId, authorId: ctx.userId, authorName: member.name,
    title, kind: 'upload', fileId: ctx.newId(), size, createdAt: ctx.iso(),
  }, teamRead(group.$id));
  return ticket(ctx, note);
}

async function rejectUpload(ctx, note, message) {
  await ctx.db.deleteFile(note.fileId);
  await ctx.db.delete('notes', note.$id);
  fail(message);
}

async function uploadedFile(ctx, note) {
  try {
    return await ctx.db.file(note.fileId);
  } catch (error) {
    if (error.status === 404) fail('Upload the PDF before finishing.', 409);
    throw error;
  }
}

// Step 2: check the stored file really is a PDF of an allowed size, then share it with the group's team only.
export async function finalizePdf(ctx, body) {
  const { group, member } = await requireMember(ctx, body.groupId);
  assertActive(group);
  const note = await requireRecord(ctx, 'notes', body.noteId, group.$id, 'Note');
  if (note.kind !== 'upload') fail('This upload has already been finished.', 409);
  if (note.authorId !== ctx.userId) fail('Only the person who uploaded this file can finish it.', 403);

  const file = await uploadedFile(ctx, note);
  const bytes = file.sizeOriginal ?? file.size;
  if (bytes > MAX_PDF_BYTES || !await ctx.db.pdfSignature(note.fileId)) await rejectUpload(ctx, note, 'That file is not a valid PDF under 25 MB.');

  await ctx.db.publishFile(note.fileId, group.$id);
  const shared = await ctx.db.update('notes', note.$id, { ...note, kind: 'pdf' });
  await announce(ctx, group, `${member.name} shared a PDF: ${note.title}`, { noteId: note.$id });
  return { note: publicNote(shared) };
}

// The room comes from our own record, never from what the browser asks for.
export async function liveblocksAuth(ctx, body) {
  const { group, member } = await requireMember(ctx, body.groupId);
  const note = await requireRecord(ctx, 'notes', body.noteId, group.$id, 'Note');
  if (note.kind !== 'collaborative') fail('Note not found.', 404);
  const members = await ctx.db.byGroup('members', group.$id);
  const authorization = await ctx.providers.authorize(
    note.roomId, { $id: ctx.userId, name: member.name }, members, group.status !== 'active',
  );
  return { authorization };
}
