import { createHash } from 'node:crypto';

export const ROADMAP_COMPLETION_XP = 20;

const sha = value => createHash('sha256').update(value).digest('hex');
const whole = value => Math.max(0, Math.floor(Number(value) || 0));

// Same row the focus-session XP writes to, so both add up on the leaderboard.
export const monthlyStatsRowId = (userId, monthKey) => `month_${sha(`${userId}:${monthKey}`).slice(0, 28)}`;

// One claim per student and subject session. Creating it is the atomic "first time only" check.
export const roadmapClaimId = (userId, sessionId) => `rmxp${sha(`${userId}:${sessionId}:roadmap-xp`).slice(0, 30)}`;

export function roadmapJustCompleted(state, result) {
  return result.kind === 'topic'
    && result.passed
    && !state.roadmapXp
    && state.roadmap.length > 0
    && state.roadmap.every(topic => topic.status === 'complete');
}

export async function addMonthlyXp({ stats, userId, points, now = new Date() }) {
  const monthKey = now.toISOString().slice(0, 7);
  const rowId = monthlyStatsRowId(userId, monthKey);
  const updatedAt = now.toISOString();
  // Two attempts: if another request creates the row first, re-read it and add to it.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const row = await stats.get(rowId);
    if (row) {
      await stats.update(rowId, { xp: whole(row.xp) + points, updated_at: updatedAt });
      return;
    }
    const created = await stats.create(rowId, { appwrite_user_id: userId, month_key: monthKey, xp: points, focus_minutes: 0, focus_sessions: 0, updated_at: updatedAt });
    if (created === 'created') return;
  }
  throw new Error('The monthly XP row could not be updated.');
}

// Never throws: a problem awarding XP must not undo or block the student's finished lesson.
export async function awardRoadmapXp({ userId, sessionId, claims, stats, now = new Date(), log = () => {} }) {
  const claimId = roadmapClaimId(userId, sessionId);
  let claimed = false;
  try {
    const claim = await claims.create(claimId, { kind: 'roadmap-xp-claim', userId, sessionId, points: ROADMAP_COMPLETION_XP, claimedAt: now.toISOString() });
    if (claim === 'exists') return { status: 'already-awarded', points: 0 };
    claimed = true;
    await addMonthlyXp({ stats, userId, points: ROADMAP_COMPLETION_XP, now });
    return { status: 'awarded', points: ROADMAP_COMPLETION_XP, awardedAt: now.toISOString() };
  } catch (caught) {
    log(`Roadmap XP could not be awarded: ${caught?.message || caught}`);
    if (claimed) await claims.release(claimId).catch(() => {});
    return { status: 'failed', points: 0 };
  }
}
