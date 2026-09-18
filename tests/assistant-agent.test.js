import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_ACTIONS, normalizeAction } from "../functions/mahei-ai-agent/src/main.js";

test("assistant action contract includes every supported website action", () => {
  assert.deepEqual(
    [...ALLOWED_ACTIONS].sort(),
    [
      "add_skill_video",
      "complete_task",
      "create_assignment",
      "create_calendar_event",
      "create_goal",
      "create_note",
      "create_skill",
      "create_task",
      "none",
      "open_ai_teacher",
      "open_page",
      "prepare_focus_session",
      "save_daily_review",
      "set_assignment_progress",
      "set_goal_progress",
      "set_skill_progress",
      "set_video_watched",
      "start_study_plan",
      "submit_suggestion",
    ].sort(),
  );
});

test("unknown and malformed model actions become safe no-ops", () => {
  assert.equal(normalizeAction({ action: "delete_everything" }).action, "none");
  assert.deepEqual(normalizeAction(null).parameters, {});
  assert.deepEqual(normalizeAction({ action: "create_task", parameters: [] }).parameters, {});
});

test("valid actions preserve parameters and bound reply length", () => {
  const value = normalizeAction({
    action: "create_task",
    parameters: { title: "Revise algebra" },
    reply: "x".repeat(700),
  });
  assert.equal(value.action, "create_task");
  assert.equal(value.parameters.title, "Revise algebra");
  assert.equal(value.reply.length, 500);
});

test("calendar event action preserves scheduling parameters", () => {
  const value = normalizeAction({
    action: "create_calendar_event",
    parameters: {
      title: "Physics revision",
      date: "2026-09-19",
      startTime: "16:00",
    },
    reply: "I can add this event.",
  });
  assert.equal(value.action, "create_calendar_event");
  assert.equal(value.parameters.date, "2026-09-19");
  assert.equal(value.parameters.startTime, "16:00");
});
