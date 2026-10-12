import assert from "node:assert/strict";
import test from "node:test";

import { groupNavigation } from "../src/lib/navGroups.js";

const item = (id) => ({ id, label: id });

test("groups navigation items under Workspace, Learn, Community and Account", () => {
  const groups = groupNavigation([
    item("dashboard"),
    item("notes"),
    item("study-groups"),
    item("profile"),
  ]);

  assert.deepEqual(
    groups.map((group) => group.title),
    ["Workspace", "Learn", "Community", "Account"],
  );
});

test("keeps the original relative order of items inside a group", () => {
  const groups = groupNavigation([
    item("focus"),
    item("dashboard"),
    item("tasks"),
  ]);

  assert.deepEqual(
    groups[0].items.map((entry) => entry.id),
    ["focus", "dashboard", "tasks"],
  );
});

test("omits groups that have no items", () => {
  const groups = groupNavigation([item("dashboard")]);

  assert.deepEqual(
    groups.map((group) => group.title),
    ["Workspace"],
  );
});

test("puts items with an unknown id in a trailing More group instead of dropping them", () => {
  const groups = groupNavigation([item("dashboard"), item("brand-new-page")]);

  const last = groups[groups.length - 1];
  assert.equal(last.title, "More");
  assert.deepEqual(
    last.items.map((entry) => entry.id),
    ["brand-new-page"],
  );
});

test("does not mutate the input array", () => {
  const input = Object.freeze([item("dashboard"), item("notes")]);

  assert.doesNotThrow(() => groupNavigation(input));
  assert.equal(input.length, 2);
});

test("returns an empty list for empty or missing input", () => {
  assert.deepEqual(groupNavigation([]), []);
  assert.deepEqual(groupNavigation(undefined), []);
});
