export const STUDENT_AVATARS = ["🦊", "🌱", "📚", "🎓", "🧠", "⭐", "🐼", "🐯"];
export const STUDENT_LANGUAGES = ["English", "Manipuri", "Hindi", "Bengali", "Other"];

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function createStudentProfile(name = "") {
  return {
    name: cleanText(name, 128),
    avatar: "🦊",
    level: "",
    school: "",
    language: "English",
    dailyMinutes: 30,
    bio: "",
  };
}

export function normalizeStudentProfile(value, fallbackName = "") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const minutes = Number(source.dailyMinutes);
  return {
    name: cleanText(source.name || fallbackName, 128),
    avatar: STUDENT_AVATARS.includes(source.avatar) ? source.avatar : "🦊",
    level: cleanText(source.level, 80),
    school: cleanText(source.school, 160),
    language: STUDENT_LANGUAGES.includes(source.language) ? source.language : "English",
    dailyMinutes: Number.isFinite(minutes)
      ? Math.max(10, Math.min(180, Math.round(minutes)))
      : 30,
    bio: cleanText(source.bio, 500),
  };
}
