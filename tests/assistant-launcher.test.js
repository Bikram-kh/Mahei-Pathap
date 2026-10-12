import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSISTANT_QUICK_PROMPTS,
  pageForAgentAction,
  shouldShowAssistantLauncher,
} from "../src/lib/assistantLauncher.js";

test("shows the launcher to signed-in users on ordinary pages", () => {
  for (const activePage of ["dashboard", "tasks", "notes", "study-groups", "ai-teacher"]) {
    assert.equal(
      shouldShowAssistantLauncher({ isAuthenticated: true, activePage }),
      true,
      `expected the launcher on ${activePage}`,
    );
  }
});

test("hides the launcher on the full Mahei Assistance page", () => {
  assert.equal(
    shouldShowAssistantLauncher({ isAuthenticated: true, activePage: "ai-coach" }),
    false,
  );
});

test("hides the launcher when the user is signed out", () => {
  assert.equal(
    shouldShowAssistantLauncher({ isAuthenticated: false, activePage: "dashboard" }),
    false,
  );
});

test("routes the study-plan action to the full page, where its interview is rendered", () => {
  assert.equal(pageForAgentAction("start_study_plan"), "ai-coach");
});

test("has no page for actions that need no redirect, or for unknown input", () => {
  for (const action of ["none", "create_task", "open_page", "prepare_focus_session", "constructor", "__proto__", "", undefined, null]) {
    assert.equal(pageForAgentAction(action), null, `expected null for ${String(action)}`);
  }
});

test("offers a non-empty list of unique quick prompts", () => {
  assert.ok(ASSISTANT_QUICK_PROMPTS.length > 0);
  assert.ok(ASSISTANT_QUICK_PROMPTS.every((prompt) => typeof prompt === "string" && prompt.trim()));
  assert.equal(new Set(ASSISTANT_QUICK_PROMPTS).size, ASSISTANT_QUICK_PROMPTS.length);
});
