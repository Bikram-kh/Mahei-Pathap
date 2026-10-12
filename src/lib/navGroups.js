/**
 * Sidebar sections. Order here is the order the sections appear in the UI;
 * order of ids inside a section is decided by the caller's item order.
 */
export const NAV_GROUPS = [
  {
    title: "Workspace",
    ids: ["dashboard", "tasks", "assignments", "calendar", "focus", "review", "analytics"],
  },
  {
    title: "Learn",
    ids: ["skills", "goals", "notes", "notes-store", "ai-teacher", "ai-coach"],
  },
  {
    title: "Community",
    ids: ["study-groups", "leaderboard", "announcements", "suggestions"],
  },
  {
    title: "Account",
    ids: ["profile", "admin"],
  },
];

const FALLBACK_TITLE = "More";

/**
 * Splits a flat navigation list into titled sections without mutating it.
 * Items whose id is not in NAV_GROUPS land in a trailing "More" section so a
 * newly added page is never silently hidden from the sidebar.
 */
export function groupNavigation(items = []) {
  const titleById = new Map(
    NAV_GROUPS.flatMap(({ title, ids }) => ids.map((id) => [id, title])),
  );

  const itemsByTitle = new Map();
  for (const item of items) {
    const title = titleById.get(item.id) ?? FALLBACK_TITLE;
    itemsByTitle.set(title, [...(itemsByTitle.get(title) ?? []), item]);
  }

  return [...NAV_GROUPS.map(({ title }) => title), FALLBACK_TITLE]
    .filter((title) => itemsByTitle.has(title))
    .map((title) => ({ title, items: itemsByTitle.get(title) }));
}
