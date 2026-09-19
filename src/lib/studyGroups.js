import { client, functions, storage, APPWRITE_DATABASE_ID } from './appwrite';
const functionId = import.meta.env.VITE_APPWRITE_STUDY_GROUPS_FUNCTION_ID || 'mahei-study-groups';
export const requestId = () => crypto.randomUUID();
export async function studyGroupsRequest(action, payload = {}) {
  const execution = await functions.createExecution(functionId, JSON.stringify({ action, ...payload }), false, '/', 'POST', { 'Content-Type': 'application/json' });
  let result;
  try { result = JSON.parse(execution.responseBody || '{}'); } catch { throw new Error('Study Groups returned an unreadable response. Please try again.'); }
  if (!result.success || execution.responseStatusCode >= 400) throw new Error(result.error || result.message || 'Study Groups is unavailable. Please ask the administrator to complete setup.');
  return result;
}
export function subscribeToStudyGroups(callback) {
  const ids = ['study-groups', 'study-group-members', 'study-group-messages', 'study-group-notes', 'study-group-calls'];
  return client.subscribe(ids.map(id => `databases.${APPWRITE_DATABASE_ID}.collections.${id}.documents`), callback);
}
export function mergeGroupMessages(current, incoming) {
  const messages = new Map(current.map(item => [item.$id || item.id, item]));
  for (const item of incoming) messages.set(item.$id || item.id, item);
  return [...messages.values()].sort((a,b) => String(a.$createdAt || a.createdAt || '').localeCompare(String(b.$createdAt || b.createdAt || '')));
}
export function invitationFromInput(value) {
  const trimmed = value.trim();
  try { return new URL(trimmed).searchParams.get('groupInvite') || trimmed; } catch { return trimmed; }
}
export function groupFileUrl(fileId) {
  return storage.getFileDownload(import.meta.env.VITE_APPWRITE_GROUP_FILES_BUCKET_ID || 'study-group-files', fileId).toString();
}
