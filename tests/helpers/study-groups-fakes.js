// In-memory stand-ins for Appwrite and the video/collaboration providers,
// implementing the same interface as functions/mahei-study-groups/src/appwrite.js.
const httpError = (status, message) => Object.assign(new Error(message), { status });

export function createFakeDb({ users = {}, personalNotes = {} } = {}) {
  const tables = new Map();
  const teams = new Map();
  const files = new Map();
  const permissions = new Map();
  const table = (name) => tables.get(name) || tables.set(name, new Map()).get(name);
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + (tick += 1000)).toISOString();

  return {
    bucketId: 'study-group-files',
    tables, teams, files, permissions,
    async get(collection, id) {
      const doc = table(collection).get(id);
      if (!doc) throw httpError(404, 'Document not found');
      return structuredClone(doc);
    },
    async optional(collection, id) {
      const doc = table(collection).get(id);
      return doc ? structuredClone(doc) : null;
    },
    async create(collection, id, data, perms = []) {
      if (table(collection).has(id)) throw httpError(409, 'Document already exists');
      const doc = { ...structuredClone(data), $id: id, $createdAt: stamp() };
      table(collection).set(id, doc);
      permissions.set(`${collection}/${id}`, perms);
      return structuredClone(doc);
    },
    async update(collection, id, data) {
      const current = table(collection).get(id);
      if (!current) throw httpError(404, 'Document not found');
      const doc = { ...current, ...structuredClone(data), $id: id };
      table(collection).set(id, doc);
      return structuredClone(doc);
    },
    async delete(collection, id) { table(collection).delete(id); },
    async byGroup(collection, groupId, { newestFirst = false, limit = 100, after = null } = {}) {
      let items = [...table(collection).values()].filter((doc) => doc.groupId === groupId);
      items.sort((a, b) => a.$createdAt.localeCompare(b.$createdAt));
      if (newestFirst) items.reverse();
      if (after) items = items.slice(items.findIndex((doc) => doc.$id === after) + 1);
      return structuredClone(items.slice(0, limit));
    },
    async byUser(collection, userId) {
      return structuredClone([...table(collection).values()].filter((doc) => doc.userId === userId));
    },
    async lock(key, fn) { return fn(); },
    async user(id) {
      if (!users[id]) throw httpError(404, 'User not found');
      return { $id: id, name: users[id] };
    },
    async personalNote(id) {
      if (!personalNotes[id]) throw httpError(404, 'Note not found');
      return structuredClone(personalNotes[id]);
    },
    async createTeam(id, name) { teams.set(id, { name, members: new Set() }); },
    async deleteTeam(id) { teams.delete(id); },
    async addTeamMember(teamId, userId) { teams.get(teamId).members.add(userId); },
    async removeTeamMember(teamId, userId) { teams.get(teamId)?.members.delete(userId); },
    async file(id) {
      const file = files.get(id);
      if (!file) throw httpError(404, 'File not found');
      return { ...file };
    },
    async publishFile(id, groupId) { files.get(id).readTeam = groupId; },
    async deleteFile(id) { files.delete(id); },
    async pdfSignature(id) { return files.get(id)?.isPdf === true; },
  };
}

export function createFakeProviders({ collaboration = true, video = true } = {}) {
  const rooms = new Map();
  const calls = new Map();
  const removed = [];
  const unavailable = (what) => httpError(503, `${what} are not configured yet.`);
  let roomCounter = 0;
  return {
    status: { collaboration, video },
    rooms, calls, removed,
    async createNote(roomId, members, html) {
      if (!collaboration) throw unavailable('Collaborative notes');
      rooms.set(roomId, { html, users: new Set(members.map((m) => m.userId)), readOnly: false });
    },
    async authorize(roomId, user, members, readOnly) {
      if (!collaboration) throw unavailable('Collaborative notes');
      const room = rooms.get(roomId);
      room.users = new Set(members.map((m) => m.userId));
      room.readOnly = readOnly;
      return { token: `lb-${user.$id}-${roomId}` };
    },
    async rotateNote(note, members, readOnly) {
      const room = rooms.get(note.roomId);
      rooms.delete(note.roomId);
      const next = `${note.roomId}-r${(roomCounter += 1)}`;
      rooms.set(next, { ...room, users: new Set(members.map((m) => m.userId)), readOnly });
      return next;
    },
    async deleteNote(roomId) { rooms.delete(roomId); },
    async startCall(roomName) {
      if (!video) throw unavailable('Video study sessions');
      calls.set(roomName, { participants: new Set() });
    },
    async joinCall(call, user) {
      if (!video) throw unavailable('Video study sessions');
      calls.get(call.roomName).participants.add(user.$id);
      return { token: `lk-${user.$id}`, serverUrl: 'wss://example.test' };
    },
    async endCall(call) { calls.delete(call.roomName); },
    async removeParticipant(call, userId) { removed.push({ room: call.roomName, userId }); calls.get(call.roomName)?.participants.delete(userId); },
  };
}

export const fakeSanitize = (content) => `SAFE(${content})`;
