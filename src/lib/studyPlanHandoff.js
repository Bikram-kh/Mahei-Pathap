// Turns a saved Mahei Assistance study plan into what AI Teacher needs to build a roadmap,
// so a student arriving from the assistant never has to fill in the setup form.

const SAVED_PLAN_HEADER = "AI TEACHER STUDY PLAN";
const LIMITS = { title: 200, subject: 120, level: 120, goal: 500, plan: 8000 };
const MINUTE_OPTIONS = [10, 15, 25, 30, 45, 60, 90, 120, 180];
const DEFAULT_MINUTES = 25;

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const positiveInteger = (value) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** "25 minutes" -> 25, "1 hour" -> 60, "1.5 hours" -> 90; anything else -> null. */
export function parseStudyMinutes(answer) {
  const match = String(answer ?? "").match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return positiveInteger(/^h/i.test(match[2]) ? amount * 60 : amount);
}

// A saved plan task stores its details in the notes:
// "AI TEACHER STUDY PLAN\nClass or level: ..\nLearning goal: ..\n\n<plan text>", titled "<Subject>: <Topic>".
function readSavedTask(task) {
  const lines = String(task?.notes ?? "").split("\n");
  const details = {};
  let planStart = 0;

  if (lines[0]?.trim() === SAVED_PLAN_HEADER) {
    planStart = 1;
    while (planStart < lines.length && lines[planStart].trim() !== "") {
      const match = lines[planStart].match(/^(Class or level|Learning goal):\s*(.*)$/);
      if (match) details[match[1]] = match[2].trim();
      planStart += 1;
    }
  }

  const title = String(task?.title ?? "").trim();
  const colon = title.indexOf(": ");

  return {
    subject: colon > 0 ? title.slice(0, colon) : title,
    level: details["Class or level"] ?? "",
    goal: details["Learning goal"] ?? "",
    plan: lines.slice(planStart).join("\n").trim(),
  };
}

function buildGoal(context, saved) {
  const parts = [clean(context?.goal || saved.goal, LIMITS.goal)];
  const confidence = clean(context?.confidence, 80);
  const deadline = clean(context?.deadline, 80);
  if (confidence) parts.push(`Starting confidence: ${confidence}`);
  if (deadline && !/^no deadline$/i.test(deadline)) parts.push(`Deadline: ${deadline}`);
  return parts.filter(Boolean).join(". ").slice(0, LIMITS.goal);
}

/**
 * Builds the handoff from the live interview answers and plan text when available
 * (right after generating a plan), otherwise from the saved plan task alone
 * (returning later). Returns null when there is no subject or no plan text.
 */
export function buildPlanHandoff({ task, context, planText } = {}) {
  const saved = readSavedTask(task);
  const subject = clean(context?.subject || saved.subject, LIMITS.subject);
  const plan = clean(planText, LIMITS.plan) || clean(saved.plan, LIMITS.plan);
  if (!subject || !plan) return null;

  const topic = clean(context?.topic, LIMITS.title);
  const fallbackTitle = topic ? `${subject}: ${topic}` : `${subject} study plan`;

  return {
    id: task?.id ?? null,
    title: clean(task?.title, LIMITS.title) || fallbackTitle.slice(0, LIMITS.title),
    subject,
    level: clean(context?.level || saved.level, LIMITS.level),
    goal: buildGoal(context, saved),
    minutes: parseStudyMinutes(context?.time) ?? positiveInteger(task?.estTime),
    plan,
  };
}

function nearestMinuteOption(minutes) {
  if (!Number.isFinite(minutes)) return DEFAULT_MINUTES;
  return MINUTE_OPTIONS.reduce((best, option) =>
    Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best,
  );
}

/** Prefills AI Teacher's manual setup form from a handoff (the fallback when the import fails). */
export function planToProfile(handoff) {
  return {
    level: handoff.level,
    subject: handoff.subject,
    language: "English",
    goal: handoff.goal,
    minutes: nearestMinuteOption(handoff.minutes),
    syllabus: handoff.plan,
  };
}

/** Newest saved plan first. Saved plans are dated by their deadline, which defaults to the day they were made. */
export function sortPlansNewestFirst(plans) {
  return [...plans].sort((a, b) => String(b.deadline ?? "").localeCompare(String(a.deadline ?? "")));
}
