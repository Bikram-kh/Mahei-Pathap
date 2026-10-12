const ASSISTANT_PAGE_ID = "ai-coach";

/** Prompts offered as one-tap suggestions on both the full page and the floating panel. */
export const ASSISTANT_QUICK_PROMPTS = [
  "What should I study today?",
  "Create a task to revise maths today",
  "Add a calendar event for my exam tomorrow",
  "Open my AI Teacher lesson",
  "Prepare a focus session for algebra",
];

// Agent actions whose result is only rendered on the full assistant page.
// Every other page-changing action already calls navigate() inside handleAiAgent.
const ACTION_PAGES = {
  start_study_plan: ASSISTANT_PAGE_ID,
};

/**
 * The floating launcher is for signed-in users only, and is hidden on the full
 * assistant page: that page already is the assistant, and both share the same
 * input state so they must never be mounted together.
 */
export function shouldShowAssistantLauncher({ isAuthenticated, activePage }) {
  return Boolean(isAuthenticated) && activePage !== ASSISTANT_PAGE_ID;
}

/** Page to open after an agent action, or null when the current page is fine. */
export function pageForAgentAction(action) {
  return Object.hasOwn(ACTION_PAGES, action) ? ACTION_PAGES[action] : null;
}
