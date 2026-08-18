import { Account, Client, Databases, Query } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID || "";
const notesCollectionId = import.meta.env.VITE_APPWRITE_NOTES_COLLECTION_ID || "";

const client = new Client();

client.setEndpoint(endpoint).setProject(projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const APPWRITE_DATABASE_ID = databaseId;
export const APPWRITE_NOTES_COLLECTION_ID = notesCollectionId;
export const isAppwriteConfigured = Boolean(projectId && databaseId && notesCollectionId);
export { Query };
