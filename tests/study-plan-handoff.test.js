import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlanHandoff,
  parseStudyMinutes,
  planToProfile,
  sortPlansNewestFirst,
} from "../src/lib/studyPlanHandoff.js";

const context = {
  subject: "Mathematics",
  level: "College / University",
  topic: "from basic to btech level",
  goal: "Understand the basics",
  time: "1 hour",
  confidence: "Just starting",
  deadline: "This week",
};
const planText = "TODAY'S STUDY PLAN\n1. Vectors — 10 min\nTOTAL: 60 minutes";

test("builds the handoff from the interview answers and the generated plan", () => {
  const handoff = buildPlanHandoff({
    context,
    planText,
    task: { id: "task-1", title: "Mathematics: from basic to btech level", estTime: 60 },
  });

  assert.equal(handoff.id, "task-1");
  assert.equal(handoff.title, "Mathematics: from basic to btech level");
  assert.equal(handoff.subject, "Mathematics");
  assert.equal(handoff.level, "College / University");
  assert.equal(handoff.minutes, 60);
  assert.equal(handoff.plan, planText);
  assert.match(handoff.goal, /Understand the basics/);
  assert.match(handoff.goal, /Just starting/);
  assert.match(handoff.goal, /This week/);
});

test("leaves confidence and deadline out of the goal when the answer is missing or 'No deadline'", () => {
  const handoff = buildPlanHandoff({
    context: { ...context, confidence: "", deadline: "No deadline" },
    planText,
  });

  assert.equal(handoff.goal, "Understand the basics");
});

test("reads study minutes from the interview's free-text time answer", () => {
  assert.equal(parseStudyMinutes("25 minutes"), 25);
  assert.equal(parseStudyMinutes("90 minutes"), 90);
  assert.equal(parseStudyMinutes("1 hour"), 60);
  assert.equal(parseStudyMinutes("2 hours"), 120);
  assert.equal(parseStudyMinutes("1.5 hours"), 90);
  assert.equal(parseStudyMinutes("as long as it takes"), null);
  assert.equal(parseStudyMinutes(""), null);
  assert.equal(parseStudyMinutes(undefined), null);
});

test("rebuilds the handoff from a saved plan task when the interview answers are gone", () => {
  const handoff = buildPlanHandoff({
    task: {
      id: "task-9",
      title: "Physics: Forces and motion",
      estTime: 45,
      notes:
        "AI TEACHER STUDY PLAN\nClass or level: Class 10\nLearning goal: Revise for an exam\n\nTODAY'S STUDY PLAN\n1. Newton's laws — 10 min",
    },
  });

  assert.equal(handoff.id, "task-9");
  assert.equal(handoff.subject, "Physics");
  assert.equal(handoff.level, "Class 10");
  assert.equal(handoff.goal, "Revise for an exam");
  assert.equal(handoff.minutes, 45);
  assert.equal(handoff.title, "Physics: Forces and motion");
  assert.ok(handoff.plan.startsWith("TODAY'S STUDY PLAN"), "the notes header lines are not part of the plan");
});

test("uses the whole task title as the subject when it has no colon", () => {
  const handoff = buildPlanHandoff({
    task: { id: "t", title: "Organic chemistry", notes: "AI TEACHER STUDY PLAN\n\n1. Alkanes — 10 min" },
  });

  assert.equal(handoff.subject, "Organic chemistry");
});

test("interview answers win over the saved task, and gaps fall back to it", () => {
  const handoff = buildPlanHandoff({
    context: { subject: "Mathematics", topic: "Matrices" },
    planText,
    task: { id: "t", title: "Old title: x", estTime: 30, notes: "AI TEACHER STUDY PLAN\nClass or level: Class 9\nLearning goal: Old goal\n\nold" },
  });

  assert.equal(handoff.subject, "Mathematics");
  assert.equal(handoff.level, "Class 9");
  assert.equal(handoff.minutes, 30);
  assert.equal(handoff.plan, planText);
});

test("returns null when there is no usable plan or subject", () => {
  assert.equal(buildPlanHandoff(), null);
  assert.equal(buildPlanHandoff({}), null);
  assert.equal(buildPlanHandoff({ context, planText: "   " }), null);
  assert.equal(buildPlanHandoff({ task: { id: "t", title: "", notes: "" } }), null);
});

test("trims oversized fields to what the teacher accepts", () => {
  const handoff = buildPlanHandoff({
    context: { ...context, subject: "S".repeat(300), goal: "G".repeat(900), confidence: "", deadline: "" },
    planText: "P".repeat(9000),
  });

  assert.equal(handoff.subject.length, 120);
  assert.equal(handoff.goal.length, 500);
  assert.equal(handoff.plan.length, 8000);
});

test("prefills the manual form from a handoff, snapping minutes to an available option", () => {
  const handoff = buildPlanHandoff({ context: { ...context, time: "50 minutes" }, planText });
  const profile = planToProfile(handoff);

  assert.equal(profile.subject, "Mathematics");
  assert.equal(profile.level, "College / University");
  assert.equal(profile.language, "English");
  assert.equal(profile.syllabus, planText);
  assert.equal(profile.minutes, 45);

  assert.equal(planToProfile({ ...handoff, minutes: 53 }).minutes, 60);
  assert.equal(planToProfile({ ...handoff, minutes: null }).minutes, 25);
  assert.equal(planToProfile({ ...handoff, minutes: 500 }).minutes, 180);
});

test("sorts saved plans newest first by saved date without mutating the input", () => {
  const plans = [
    { id: "old", deadline: "2026-09-10" },
    { id: "undated" },
    { id: "new", deadline: "2026-09-21" },
    { id: "same-a", deadline: "2026-09-15" },
    { id: "same-b", deadline: "2026-09-15" },
  ];
  const before = plans.map((plan) => plan.id);
  const sorted = sortPlansNewestFirst(plans);

  assert.deepEqual(sorted.map((plan) => plan.id), ["new", "same-a", "same-b", "old", "undated"]);
  assert.deepEqual(plans.map((plan) => plan.id), before);
});
