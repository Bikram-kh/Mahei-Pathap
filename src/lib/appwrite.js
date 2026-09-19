import { Account, Client, Databases, Functions, Storage, Teams, Query } from "appwrite";

const endpoint =
  import.meta.env.VITE_APPWRITE_ENDPOINT ||
  "https://cloud.appwrite.io/v1";

const projectId =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "";

const databaseId =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "";

const tasksCollectionId =
  import.meta.env.VITE_APPWRITE_TASKS_COLLECTION_ID || "";

const assignmentsCollectionId =
  import.meta.env.VITE_APPWRITE_ASSIGNMENTS_COLLECTION_ID || "";

const skillsCollectionId =
  import.meta.env.VITE_APPWRITE_SKILLS_COLLECTION_ID || "";

const goalsCollectionId =
  import.meta.env.VITE_APPWRITE_GOALS_COLLECTION_ID || "";

const focusCollectionId =
  import.meta.env.VITE_APPWRITE_FOCUS_COLLECTION_ID || "";

const notesCollectionId =
  import.meta.env.VITE_APPWRITE_NOTES_COLLECTION_ID || "";

const calendarEventsCollectionId =
  import.meta.env.VITE_APPWRITE_CALENDAR_EVENTS_COLLECTION_ID || "";

const suggestionsCollectionId =
  import.meta.env.VITE_APPWRITE_SUGGESTIONS_COLLECTION_ID || "";

const announcementsCollectionId =
  import.meta.env.VITE_APPWRITE_ANNOUNCEMENTS_COLLECTION_ID || "";

const profileSettingsCollectionId =
  import.meta.env.VITE_APPWRITE_PROFILE_SETTINGS_COLLECTION_ID || "";

const donationSettingsCollectionId =
  import.meta.env.VITE_APPWRITE_DONATION_SETTINGS_COLLECTION_ID || "";

const announcementDismissalsCollectionId =
  import.meta.env.VITE_APPWRITE_ANNOUNCEMENT_DISMISSALS_COLLECTION_ID || "";

// Runs trusted focus sessions, XP and the leaderboard. The old variable name is still accepted.
const focusFunctionId =
  import.meta.env.VITE_APPWRITE_FOCUS_FUNCTION_ID ||
  import.meta.env.VITE_APPWRITE_DISCORD_INTEGRATION_FUNCTION_ID ||
  "";
const notesStoreCollectionId = import.meta.env.VITE_APPWRITE_NOTES_STORE_COLLECTION_ID || "";
const notesStorePurchasesCollectionId = import.meta.env.VITE_APPWRITE_NOTES_STORE_PURCHASES_COLLECTION_ID || "";
const notesStoreBucketId = import.meta.env.VITE_APPWRITE_NOTES_STORE_BUCKET_ID || "";
const notesStoreFunctionId = import.meta.env.VITE_APPWRITE_NOTES_STORE_FUNCTION_ID || "";


/* =========================================================
   APPWRITE CLIENT
   ========================================================= */

const client = new Client();

client
  .setEndpoint(endpoint)
  .setProject(projectId);


/* =========================================================
   APPWRITE SERVICES
   ========================================================= */

export const account = new Account(client);

export const databases = new Databases(client);

export const teams = new Teams(client);

export const functions = new Functions(client);
export const storage = new Storage(client);


/* =========================================================
   DATABASE / COLLECTION IDS
   ========================================================= */

export const APPWRITE_DATABASE_ID = databaseId;

export const APPWRITE_TASKS_COLLECTION_ID =
  tasksCollectionId;

export const APPWRITE_ASSIGNMENTS_COLLECTION_ID =
  assignmentsCollectionId;

export const APPWRITE_SKILLS_COLLECTION_ID =
  skillsCollectionId;

export const APPWRITE_GOALS_COLLECTION_ID =
  goalsCollectionId;

export const APPWRITE_FOCUS_COLLECTION_ID =
  focusCollectionId;

export const APPWRITE_NOTES_COLLECTION_ID =
  notesCollectionId;

export const APPWRITE_CALENDAR_EVENTS_COLLECTION_ID =
  calendarEventsCollectionId;

export const APPWRITE_SUGGESTIONS_COLLECTION_ID =
  suggestionsCollectionId;

export const APPWRITE_ANNOUNCEMENTS_COLLECTION_ID =
  announcementsCollectionId;

export const APPWRITE_PROFILE_SETTINGS_COLLECTION_ID =
  profileSettingsCollectionId;

export const APPWRITE_DONATION_SETTINGS_COLLECTION_ID =
  donationSettingsCollectionId;

export const APPWRITE_ANNOUNCEMENT_DISMISSALS_COLLECTION_ID =
  announcementDismissalsCollectionId;

export const APPWRITE_FOCUS_FUNCTION_ID = focusFunctionId;
export const APPWRITE_NOTES_STORE_COLLECTION_ID = notesStoreCollectionId;
export const APPWRITE_NOTES_STORE_PURCHASES_COLLECTION_ID = notesStorePurchasesCollectionId;
export const APPWRITE_NOTES_STORE_BUCKET_ID = notesStoreBucketId;


/* =========================================================
   APPWRITE CONFIGURATION CHECK
   ========================================================= */

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


/* =========================================================
   ADMIN MEMBERSHIP COMPATIBILITY
   =========================================================

   Your auth.js uses:

       account.listMemberships()

   Appwrite provides team memberships through the Teams API,
   not the Account API.

   This compatibility function allows your existing auth.js
   to continue using account.listMemberships().
   ========================================================= */

account.listMemberships = async () => {
  const teamList = await teams.list();

  const membershipLists = await Promise.all(
    (teamList.teams || []).map(async (team) => {

      const result = await teams.listMemberships(team.$id);

      return (result.memberships || []).map((membership) => ({
        ...membership,

        teamName: team.name,

        teamId: team.$id,
      }));
    })
  );

  const memberships = membershipLists.flat();

  return {
    memberships,

    total: memberships.length,
  };
};


/* =========================================================
   QUERY
   ========================================================= */

export { Query };

export async function notesStoreRequest(payload) {
  if (!notesStoreFunctionId) throw new Error("Notes Store payments are not configured.");
  const execution = await functions.createExecution(notesStoreFunctionId, JSON.stringify(payload), false, "/", "POST", { "Content-Type": "application/json" });
  const response = JSON.parse(execution.responseBody || "{}");
  if (!response.success) throw new Error(response.error || "Notes Store request failed.");
  return response;
}




export async function askAiCoach(message, context = {}) {
  const functionId = import.meta.env.VITE_APPWRITE_AI_COACH_FUNCTION_ID;

  if (!functionId) {
    throw new Error("Mahei Assistance function ID is not configured.");
  }

  const execution = await functions.createExecution(
    functionId,
    JSON.stringify({ message, context }),
    false,
    "/",
    "POST",
    {
      "Content-Type": "application/json",
    }
  );

  const response = JSON.parse(execution.responseBody || "{}");

  if (!response.success) {
    throw new Error(response.error || "Mahei Assistance request failed.");
  }

  return response.reply;
}


export async function generateStudyPlan(context = {}) {
  const functionId = import.meta.env.VITE_APPWRITE_AI_PLANNER_FUNCTION_ID;

  if (!functionId) {
    throw new Error("AI Planner function ID is not configured.");
  }

  const execution = await functions.createExecution(
    functionId,
    JSON.stringify({ context }),
    false,
    "/",
    "POST",
    {
      "Content-Type": "application/json",
    }
  );

  const response = JSON.parse(execution.responseBody || "{}");

  if (!response.success) {
    throw new Error(response.error || "AI Study Planner request failed.");
  }

  return response.reply;
}

export async function generateAiAgentAction(message, context = {}) {
  const functionId = import.meta.env.VITE_APPWRITE_AI_AGENT_FUNCTION_ID;

  if (!functionId) {
    throw new Error("AI Agent function ID is not configured.");
  }

  const execution = await functions.createExecution(
    functionId,
    JSON.stringify({ message, context }),
    false,
    "/",
    "POST",
    {
      "Content-Type": "application/json",
    }
  );

  const response = JSON.parse(execution.responseBody || "{}");

  if (!response.success) {
    throw new Error(response.error || "AI Agent request failed.");
  }

  return response;
}
export async function teacherRequest(payload) {
  const functionId = import.meta.env.VITE_APPWRITE_AI_TEACHER_FUNCTION_ID;
  if (!functionId) throw new Error('AI Teacher is not connected yet. Add VITE_APPWRITE_AI_TEACHER_FUNCTION_ID and follow AI_TEACHER_SETUP.md.');
  const execution = await functions.createExecution(functionId, JSON.stringify(payload), false, '/', 'POST', { 'Content-Type': 'application/json' });
  let response;
  try { response = JSON.parse(execution.responseBody || '{}'); }
  catch { throw new Error('AI Teacher returned an unreadable response. Please retry.'); }
  if (!response.success) throw new Error(response.error || 'AI Teacher could not complete this request. Please retry.');
  return {
    ...(response.state || {
      profile: null,
      quiz: null,
      roadmap: [],
      currentTopicId: null,
      messages: [],
      results: [],
      revision: 0,
    }),
    sessions: response.sessions || [],
    activeSessionId: response.activeSessionId || null,
  };
}
