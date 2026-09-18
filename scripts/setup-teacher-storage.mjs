// Run once from a trusted terminal; never expose APPWRITE_API_KEY in Vite.
const names = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_DATABASE_ID', 'APPWRITE_API_KEY'];
for (const name of names) if (!process.env[name]) throw new Error(`Set ${name} before running this script.`);
const endpoint = process.env.APPWRITE_ENDPOINT.replace(/\/$/, '');
const databaseId = process.env.APPWRITE_DATABASE_ID;
const collectionId = process.env.TEACHER_COLLECTION_ID || 'teacher-learning';
const base = `${endpoint}/databases/${encodeURIComponent(databaseId)}/collections`;
const url = `${base}/${encodeURIComponent(collectionId)}`;
const headers = { 'Content-Type': 'application/json', 'X-Appwrite-Project': process.env.APPWRITE_PROJECT_ID, 'X-Appwrite-Key': process.env.APPWRITE_API_KEY };
async function call(path, method = 'GET', body) {
  const response = await fetch(path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}
let collection = await call(url);
if (collection.status === 404 && collection.data.type === 'collection_not_found') {
  collection = await call(base, 'POST', { collectionId, name: 'AI Teacher Learning', permissions: [], documentSecurity: true, enabled: true });
}
if (!collection.ok) throw new Error(`Unable to prepare teacher collection (HTTP ${collection.status}). Check the endpoint, database and setup-key permissions.`);
if ((collection.data.$permissions || []).length || collection.data.documentSecurity !== true) throw new Error('Existing collection must have no collection permissions and document security enabled. Use a new dedicated collection.');
let attribute = await call(`${url}/attributes/state`);
if (attribute.status === 404) {
  attribute = await call(`${url}/attributes/string`, 'POST', { key: 'state', size: 250000, required: true, array: false });
}
if (!attribute.ok) throw new Error(`Unable to prepare the state attribute (HTTP ${attribute.status}).`);
if (attribute.data.type !== 'string' || attribute.data.size < 250000 || attribute.data.array) throw new Error('Existing state attribute must be a non-array string of at least 250000 characters.');
for (let attempt = 0; attempt < 30; attempt++) {
  attribute = await call(`${url}/attributes/state`);
  if (attribute.ok && attribute.data.status === 'available') {
    console.log(`Teacher storage is ready. Set TEACHER_COLLECTION_ID=${collectionId} in the AI Teacher function.`);
    process.exit(0);
  }
  if (['failed', 'stuck'].includes(attribute.data.status)) throw new Error('Attribute creation failed. Check the collection in Appwrite Console.');
  await new Promise(resolve => setTimeout(resolve, 2000));
}
throw new Error('Attribute is still being created. Check Appwrite Console, then rerun this script.');
