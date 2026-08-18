import { Account, Client, Databases, Query } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID || "";
const tasksCollectionId = import.meta.env.VITE_APPWRITE_TASKS_COLLECTION_ID || "";
const assignmentsCollectionId = import.meta.env.VITE_APPWRITE_ASSIGNMENTS_COLLECTION_ID || "";
const skillsCollectionId = import.meta.env.VITE_APPWRITE_SKILLS_COLLECTION_ID || "";
const goalsCollectionId = import.meta.env.VITE_APPWRITE_GOALS_COLLECTION_ID || "";
const focusCollectionId = import.meta.env.VITE_APPWRITE_FOCUS_COLLECTION_ID || "";
const notesCollectionId = import.meta.env.VITE_APPWRITE_NOTES_COLLECTION_ID || "";

const client = new Client();

client.setEndpoint(endpoint).setProject(projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const APPWRITE_DATABASE_ID = databaseId;
export const APPWRITE_TASKS_COLLECTION_ID = tasksCollectionId;
export const APPWRITE_ASSIGNMENTS_COLLECTION_ID = assignmentsCollectionId;
export const APPWRITE_SKILLS_COLLECTION_ID = skillsCollectionId;
export const APPWRITE_GOALS_COLLECTION_ID = goalsCollectionId;
export const APPWRITE_FOCUS_COLLECTION_ID = focusCollectionId;
export const APPWRITE_NOTES_COLLECTION_ID = notesCollectionId;
export const isAppwriteConfigured = Boolean(
  projectId &&
    databaseId &&
    tasksCollectionId &&
    assignmentsCollectionId &&
    skillsCollectionId &&
    goalsCollectionId &&
    focusCollectionId &&
    notesCollectionId
);
export { Query };
