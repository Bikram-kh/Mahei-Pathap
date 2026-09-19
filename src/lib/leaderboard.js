const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MEDALS = { 1: "gold", 2: "silver", 3: "bronze" };

// The server buckets XP by UTC month, so the page must name months the same way.
const monthKeyOf = (date) => date.toISOString().slice(0, 7);

export function leaderboardMonths(now = new Date()) {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return [
    { key: monthKeyOf(now), label: "This month" },
    { key: monthKeyOf(previous), label: "Last month" },
  ];
}

export function monthTitle(key) {
  const match = MONTH_KEY.exec(key || "");
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatFocusTime(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export const medalFor = (rank) => MEDALS[rank] ?? null;

// What the AI Teacher tells a student after their roadmap XP was (or was not) added.
export function roadmapXpMessage(roadmapXp) {
  switch (roadmapXp?.status) {
    case "awarded":
      return `🎉 Roadmap complete! You earned ${roadmapXp.points} XP, now counted on the leaderboard.`;
    case "already-awarded":
      return "Roadmap complete! The XP for this roadmap is already on your leaderboard score.";
    case "failed":
      return "Roadmap complete! We could not add your bonus XP just now.";
    default:
      return "";
  }
}
