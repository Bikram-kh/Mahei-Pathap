import test from "node:test";
import assert from "node:assert/strict";
import {
  createStudentProfile,
  normalizeStudentProfile,
} from "../src/lib/studentProfile.js";

test("student profile starts with safe learning defaults", () => {
  assert.deepEqual(createStudentProfile("Asha"), {
    name: "Asha",
    avatar: "🦊",
    level: "",
    school: "",
    language: "English",
    dailyMinutes: 30,
    bio: "",
  });
});

test("student profile trims text, bounds lengths and validates choices", () => {
  const profile = normalizeStudentProfile({
    name: `  ${"A".repeat(140)}  `,
    avatar: "not-an-avatar",
    level: "  Class 10  ",
    school: "  Mahei School  ",
    language: "Manipuri",
    dailyMinutes: 999,
    bio: `  ${"B".repeat(700)}  `,
  });

  assert.equal(profile.name.length, 128);
  assert.equal(profile.avatar, "🦊");
  assert.equal(profile.level, "Class 10");
  assert.equal(profile.school, "Mahei School");
  assert.equal(profile.language, "Manipuri");
  assert.equal(profile.dailyMinutes, 180);
  assert.equal(profile.bio.length, 500);
});

test("student profile falls back when stored data is malformed", () => {
  const profile = normalizeStudentProfile(null, "Student");
  assert.equal(profile.name, "Student");
  assert.equal(profile.language, "English");
  assert.equal(profile.dailyMinutes, 30);
});
