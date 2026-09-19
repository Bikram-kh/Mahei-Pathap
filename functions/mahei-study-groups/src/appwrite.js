import { randomUUID } from 'node:crypto';
import { fail, stableId } from './policy.js';

export const COLLECTIONS = {
  groups: 'study-groups',
  members: 'study-group-members',
  messages: 'study-group-messages',
  invites: 'study-group-invites',
  notes: 'study-group-notes',
  calls: 'study-group-calls',
  internal: 'study-group-internal',
};

const REQUEST_TIMEOUT_MS = 25000;
const PAGE_LIMIT = 100;
const STALE_LOCK_MS = 60 * 1000;
const NO_VALUE = 'none';

export const newId = () => randomUUID().replaceAll('-', '');
export const teamRead = (teamId) => [`read("team:${teamId}")`];

// Appwrite's JSON query format, e.g. {"method":"equal","attribute":"groupId","values":["x"]}
export const query = (method, attribute, values) => JSON.stringify({
  method,
  ...(attribute ? { attribute } : {}),
  ...(values !== undefined ? { values: Array.isArray(values) ? values : [values] } : {}),
});

// Every collection stores the same four fields; the real record lives in `payload`.
const pack = (data) => ({
  groupId: data.groupId || NO_VALUE,
  userId: data.userId || data.authorId || NO_VALUE,
  payload: JSON.stringify(data),
  createdAt: data.createdAt || new Date().toISOString(),
});

const unpack = (document) => ({
  ...JSON.parse(document.payload),
  $id: document.$id,
  $createdAt: document.$createdAt,
  $updatedAt: document.$updatedAt,
});

const withoutSystemFields = (data) => {
  const { $id, $createdAt, $updatedAt, ...clean } = data;
  return clean;
};

export function createAppwrite(req, env = process.env) {
  const endpoint = (env.APPWRITE_FUNCTION_API_ENDPOINT || env.APPWRITE_ENDPOINT || '').replace(/\/$/, '');
  const database = env.APPWRITE_DATABASE_ID;
  const bucketId = env.STUDY_GROUP_FILES_BUCKET_ID || 'study-group-files';
  const headers = {
    'X-Appwrite-Project': env.APPWRITE_FUNCTION_PROJECT_ID || env.APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': req.headers?.['x-appwrite-key'] || env.APPWRITE_FUNCTION_API_KEY,
    'Content-Type': 'application/json',
  };

  async function api(path, method = 'GET', body) {
    const response = await fetch(endpoint + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'Study groups storage request failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  const documents = (collection, id = '') => `/databases/${encodeURIComponent(database)}/collections/${COLLECTIONS[collection] || collection}/documents${id ? `/${encodeURIComponent(id)}` : ''}`;
  const listPath = (collection, queries) => `${documents(collection)}?${new URLSearchParams(queries.map((item) => ['queries[]', item]))}`;
  const files = (id = '') => `/storage/buckets/${bucketId}/files${id ? `/${encodeURIComponent(id)}` : ''}`;

  const db = {
    bucketId,

    async get(collection, id) { return unpack(await api(documents(collection, id))); },

    async optional(collection, id) {
      try { return await db.get(collection, id); } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },

    async create(collection, id, data, permissions = []) {
      return unpack(await api(documents(collection), 'POST', { documentId: id, data: pack(data), permissions }));
    },

    async update(collection, id, data, permissions) {
      const body = { data: pack(withoutSystemFields(data)), ...(permissions ? { permissions } : {}) };
      return unpack(await api(documents(collection, id), 'PATCH', body));
    },

    async delete(collection, id) {
      try { await api(documents(collection, id), 'DELETE'); } catch (error) {
        if (error.status !== 404) throw error;
      }
    },

    async byGroup(collection, groupId, { newestFirst = false, limit = PAGE_LIMIT, after = null } = {}) {
      const queries = [
        query('equal', 'groupId', groupId),
        query(newestFirst ? 'orderDesc' : 'orderAsc', 'createdAt'),
        query('limit', null, Math.min(limit, PAGE_LIMIT)),
        ...(after ? [query('cursorAfter', null, after)] : []),
      ];
      return (await api(listPath(collection, queries))).documents.map(unpack);
    },

    async byUser(collection, userId) {
      const queries = [query('equal', 'userId', userId), query('limit', null, PAGE_LIMIT)];
      return (await api(listPath(collection, queries))).documents.map(unpack);
    },

    // A best-effort mutex built on document ids. Locks older than a minute are treated as abandoned.
    async lock(key, fn) {
      const id = stableId('lock', key);
      const acquire = () => db.create('internal', id, { kind: 'lock', key, startedAt: new Date().toISOString() });
      try { await acquire(); } catch (error) {
        if (error.status !== 409) throw error;
        const held = await db.optional('internal', id);
        if (held && Date.now() - Date.parse(held.startedAt) < STALE_LOCK_MS) {
          fail('Another group update is in progress. Please try again shortly.', 409);
        }
        await db.delete('internal', id);
        await acquire();
      }
      try { return await fn(); } finally { await db.delete('internal', id); }
    },

    async user(id) { return api(`/users/${encodeURIComponent(id)}`); },

    async personalNote(id) {
      const collection = env.APPWRITE_NOTES_COLLECTION_ID || 'notes';
      return api(`/databases/${encodeURIComponent(database)}/collections/${collection}/documents/${encodeURIComponent(id)}`);
    },

    async createTeam(id, name) { return api('/teams', 'POST', { teamId: id, name, roles: ['member'] }); },
    async deleteTeam(id) { return api(`/teams/${id}`, 'DELETE'); },

    async addTeamMember(teamId, userId) { return api(`/teams/${teamId}/memberships`, 'POST', { roles: ['member'], userId }); },

    async removeTeamMember(teamId, userId) {
      const found = await api(`/teams/${teamId}/memberships?${new URLSearchParams({ 'queries[]': query('equal', 'userId', userId) })}`);
      for (const membership of found.memberships || []) {
        try { await api(`/teams/${teamId}/memberships/${membership.$id}`, 'DELETE'); } catch (error) {
          if (error.status !== 404) throw error;
        }
      }
    },

    async file(id) { return api(files(id)); },
    async publishFile(id, groupId) { return api(files(id), 'PUT', { permissions: teamRead(groupId) }); },

    async deleteFile(id) {
      try { return await api(files(id), 'DELETE'); } catch (error) {
        if (error.status !== 404) throw error;
        return null;
      }
    },

    // Reads only the first bytes of the upload: a PDF starts with "%PDF-".
    async pdfSignature(id) {
      const response = await fetch(`${endpoint}${files(id)}/download`, {
        headers: { ...headers, Range: 'bytes=0-7' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) fail('Cannot validate the uploaded PDF.');
      const reader = response.body.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      return Buffer.from(value || []).subarray(0, 5).toString('ascii') === '%PDF-';
    },
  };
  return db;
}
