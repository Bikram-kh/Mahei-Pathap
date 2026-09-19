export const LEADERBOARD_LIMIT = 20;

const MAX_NAME_LENGTH = 24;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidMonthKey = (value) => typeof value === "string" && MONTH_KEY.test(value);

export const currentMonthKey = (now = new Date()) => now.toISOString().slice(0, 7);

const count = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

// Only what other students may see: "First L.", a generic label, or an opt-out label.
// Never an email address, even when the account name was set to one.
export function publicName(user) {
  if (user?.prefs?.leaderboardAnonymous === true) return "Anonymous student";
  const parts = String(user?.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.some((part) => part.includes("@"))) return "Student";
  const first = parts[0].slice(0, MAX_NAME_LENGTH);
  if (parts.length === 1) return first;
  return `${first.slice(0, MAX_NAME_LENGTH - 3)} ${parts.at(-1)[0].toUpperCase()}.`;
}

// Order: XP, then focus minutes, then who got there first. Equal XP and minutes share a rank.
export function rankRows(rows, monthKey) {
  const entries = rows
    .filter((row) => row?.month_key === monthKey && row.appwrite_user_id)
    .map((row) => ({
      userId: String(row.appwrite_user_id),
      xp: count(row.xp),
      focusMinutes: count(row.focus_minutes),
      focusSessions: count(row.focus_sessions),
      updatedAt: String(row.updated_at || ""),
    }))
    .filter((entry) => entry.xp > 0)
    .sort(
      (a, b) =>
        b.xp - a.xp ||
        b.focusMinutes - a.focusMinutes ||
        a.updatedAt.localeCompare(b.updatedAt) ||
        a.userId.localeCompare(b.userId),
    );

  let rank = 0;
  return entries.map((entry, index) => {
    const previous = entries[index - 1];
    if (!previous || previous.xp !== entry.xp || previous.focusMinutes !== entry.focusMinutes) rank = index + 1;
    return { ...entry, rank };
  });
}

async function lookupUser(getUser, id) {
  try {
    return await getUser(id);
  } catch {
    return null;
  }
}

export async function getLeaderboard({
  userId,
  monthKey,
  limit = LEADERBOARD_LIMIT,
  now = new Date(),
  listRows,
  getUser,
}) {
  const month = monthKey ?? currentMonthKey(now);
  if (!isValidMonthKey(month)) throw new Error("Choose a valid month.");
  if (month > currentMonthKey(now)) throw new Error("The leaderboard for a future month is not available.");

  const ranked = rankRows(await listRows(), month);
  const top = ranked.slice(0, limit);
  const mine = ranked.find((entry) => entry.userId === userId) || null;

  const ids = [...new Set([...top.map((entry) => entry.userId), userId])];
  const users = new Map(await Promise.all(ids.map(async (id) => [id, await lookupUser(getUser, id)])));

  return {
    monthKey: month,
    totalParticipants: ranked.length,
    entries: top.map((entry) => ({
      rank: entry.rank,
      name: publicName(users.get(entry.userId)),
      xp: entry.xp,
      focusMinutes: entry.focusMinutes,
      focusSessions: entry.focusSessions,
      isYou: entry.userId === userId,
    })),
    you: mine && {
      rank: mine.rank,
      xp: mine.xp,
      focusMinutes: mine.focusMinutes,
      focusSessions: mine.focusSessions,
    },
    anonymous: users.get(userId)?.prefs?.leaderboardAnonymous === true,
    generatedAt: now.toISOString(),
  };
}
