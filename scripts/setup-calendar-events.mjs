// Run once from a trusted terminal; never expose APPWRITE_API_KEY in Vite.
const requiredNames = [
  "APPWRITE_ENDPOINT",
  "APPWRITE_PROJECT_ID",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
];

for (const name of requiredNames) {
  if (!process.env[name]) throw new Error(`Set ${name} before running this script.`);
}

const endpoint = process.env.APPWRITE_ENDPOINT.replace(/\/$/, "");
const databaseId = process.env.APPWRITE_DATABASE_ID;
const collectionId = process.env.CALENDAR_EVENTS_COLLECTION_ID || "calendar-events";
const collectionBase = `${endpoint}/databases/${encodeURIComponent(databaseId)}/collections`;
const collectionUrl = `${collectionBase}/${encodeURIComponent(collectionId)}`;
const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
};

async function call(url, method = "GET", body) {
  const response = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function waitForAttribute(key) {
  const url = `${collectionUrl}/attributes/${encodeURIComponent(key)}`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await call(url);
    if (result.ok && result.data.status === "available") return;
    if (["failed", "stuck"].includes(result.data?.status)) {
      throw new Error(`Attribute ${key} could not be created.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Attribute ${key} is still being created. Check Appwrite Console.`);
}

let collection = await call(collectionUrl);
if (collection.status === 404) {
  collection = await call(collectionBase, "POST", {
    collectionId,
    name: "Calendar Events",
    permissions: ['create("users")'],
    documentSecurity: true,
    enabled: true,
  });
}
if (!collection.ok) {
  throw new Error(`Unable to prepare calendar collection (HTTP ${collection.status}).`);
}
if (collection.data.documentSecurity !== true) {
  throw new Error("Calendar Events must have document security enabled.");
}

const attributes = [
  { key: "userId", size: 64, required: true },
  { key: "title", size: 200, required: true },
  { key: "date", size: 10, required: true },
  { key: "startTime", size: 5, required: false, default: "" },
  { key: "endTime", size: 5, required: false, default: "" },
  { key: "description", size: 1000, required: false, default: "" },
  { key: "category", size: 40, required: false, default: "Study" },
];

for (const attribute of attributes) {
  const attributeUrl = `${collectionUrl}/attributes/${encodeURIComponent(attribute.key)}`;
  let result = await call(attributeUrl);
  if (result.status === 404) {
    result = await call(`${collectionUrl}/attributes/string`, "POST", {
      ...attribute,
      array: false,
      encrypt: false,
    });
  }
  if (!result.ok) {
    throw new Error(`Unable to prepare ${attribute.key} (HTTP ${result.status}).`);
  }
  await waitForAttribute(attribute.key);
}

let index = await call(`${collectionUrl}/indexes/userId_date`);
if (index.status === 404) {
  index = await call(`${collectionUrl}/indexes`, "POST", {
    key: "userId_date",
    type: "key",
    attributes: ["userId", "date"],
    orders: ["ASC", "ASC"],
  });
}
if (!index.ok) throw new Error(`Unable to prepare the calendar index (HTTP ${index.status}).`);

console.log(`Calendar storage is ready. Set VITE_APPWRITE_CALENDAR_EVENTS_COLLECTION_ID=${collectionId}.`);
