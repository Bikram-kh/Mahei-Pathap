export class TeacherError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validateProfile(input) {
  const limits = { level: 120, subject: 120, language: 80, goal: 500, syllabus: 12000 };
  if (!input || typeof input !== 'object') throw new TeacherError('Complete your learning profile.');
  const profile = {};
  for (const [key, max] of Object.entries(limits)) {
    if (!text(input[key], max)) throw new TeacherError(`Please provide ${key} (up to ${max} characters).`);
    profile[key] = input[key].trim();
  }
  const minutes = Number(input.minutes);
  if (!Number.isInteger(minutes) || minutes < 10 || minutes > 180) throw new TeacherError('Choose 10–180 study minutes per day.');
  return { ...profile, minutes };
}
export function validateQuiz(value) {
  if (!Array.isArray(value?.questions) || value.questions.length !== 3) throw new TeacherError('The AI quiz could not be checked. Please try again.', 502);
  const questions = value.questions.map((q, i) => {
    if (!text(q.prompt, 1200) || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(o => text(o, 600)) || new Set(q.options.map(o => o.trim().toLowerCase())).size !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3 || !text(q.explanation, 1800)) {
      throw new TeacherError('The AI quiz could not be checked. Please try again.', 502);
    }
    return { id: `q${i + 1}`, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation };
  });
  return questions;
}
export function validateRoadmap(value, dailyMinutes) {
  if (!Array.isArray(value?.topics) || value.topics.length < 3 || value.topics.length > 10) throw new TeacherError('The AI roadmap could not be checked. Please try again.', 502);
  return value.topics.map((t, i) => {
    if (!text(t.title, 160) || !text(t.objective, 700)) throw new TeacherError('The AI roadmap could not be checked. Please try again.', 502);
    return { id: `topic${i + 1}`, title: t.title, objective: t.objective, minutes: dailyMinutes, status: 'pending' };
  });
}
export function gradeQuiz(quiz, answers) {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length || !answers.every(a => Number.isInteger(a) && a >= 0 && a < 4)) throw new TeacherError('Answer every question before submitting.');
  const feedback = quiz.questions.map((q, i) => ({ prompt: q.prompt, selected: q.options[answers[i]], correct: q.options[q.correctIndex], explanation: q.explanation, passed: answers[i] === q.correctIndex }));
  const score = feedback.filter(f => f.passed).length;
  return { quizId: quiz.id, kind: quiz.kind, topicId: quiz.topicId, score, total: feedback.length, passed: score >= 2, feedback, date: new Date().toISOString() };
}
export function publicState(state) {
  if (!state) return null;
  const { usage, lastRequestId, ...safe } = state;
  return { ...safe, quiz: state.quiz ? { id: state.quiz.id, kind: state.quiz.kind, topicId: state.quiz.topicId, questions: state.quiz.questions.map(({ correctIndex, explanation, ...q }) => q) } : null };
}
export function applyResult(state, result) {
  state.results = [...state.results, result].slice(-8);
  state.quiz = null;
  if (result.kind === 'topic') {
    const topic = state.roadmap.find(t => t.id === result.topicId);
    if (topic) topic.status = result.passed ? 'complete' : 'revision';
    state.currentTopicId = state.roadmap.find(t => t.status !== 'complete')?.id || null;
  }
  return state;
}
