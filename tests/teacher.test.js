import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/mahei-ai-teacher/src/main.js';
import { validateProfile, validateQuiz, validateRoadmap, gradeQuiz, publicState } from '../functions/mahei-ai-teacher/src/learning.js';
import { ROADMAP_COMPLETION_XP, monthlyStatsRowId } from '../functions/mahei-ai-teacher/src/xp.js';
import { createHash } from 'node:crypto';

const profile = { level: 'Class 10', subject: 'Math', language: 'English', goal: 'Understand algebra', minutes: 25, syllabus: 'Linear equations, substitution and simple word problems.' };
const quiz = { questions: Array.from({ length: 3 }, (_, i) => ({ prompt: `Solve x + ${i + 1} = ${i + 3}`, options: ['1', '2', '3', '4'], correctIndex: 1, explanation: 'Subtract the constant from both sides to get x = 2.' })) };
const roadmap = { topics: ['Linear equations', 'Substitution', 'Word problems'].map(title => ({ title, objective: `Practise ${title}` })) };
function response(value, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(value) }; }
function fixture({ replies = [], limit = '40', youtubeKey, videos = [] } = {}) {
  const docs = new Map();
  const stats = new Map();
  const calls = [];
  let failSave = false;
  let failStats = false;
  const fetcher = async (url, options = {}) => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.includes('api.groq.com')) {
      calls.push(body);
      const value = replies.shift();
      if (value instanceof Error) throw value;
      if (!value) return response({}, 502);
      return response({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] });
    }
    if (url.includes('googleapis.com/youtube')) {
      const video = videos.shift();
      if (video instanceof Error) throw video;
      return response({ items: video ? [{ id: { videoId: video.id }, snippet: { title: video.title } }] : [] });
    }
    if (url.includes('/collections/user_monthly_stats/documents')) {
      const rowId = method === 'POST' ? body.documentId : decodeURIComponent(url.split('/').at(-1));
      if (failStats) return response({ message: 'stats unavailable' }, 500);
      if (method === 'GET') return stats.has(rowId) ? response({ $id: rowId, ...stats.get(rowId) }) : response({ type: 'document_not_found' }, 404);
      if (method === 'POST' && stats.has(rowId)) return response({}, 409);
      stats.set(rowId, { ...(method === 'PATCH' ? stats.get(rowId) : {}), ...body.data });
      return response({ $id: rowId, ...stats.get(rowId) });
    }
    const id = method === 'POST' ? body.documentId : decodeURIComponent(url.split('/').at(-1));
    if (method === 'GET') return docs.has(id) ? response({ state: docs.get(id) }) : response({ type: 'document_not_found' }, 404);
    if (method === 'DELETE') { docs.delete(id); return response({}); }
    if (method === 'POST' && docs.has(id)) return response({}, 409);
    if (failSave && id === 'student-a') return response({}, 500);
    if (method === 'POST') assert.deepEqual(body.permissions, []);
    docs.set(id, body.data.state);
    return response({ state: body.data.state });
  };
  const handler = createHandler({ fetcher, env: { APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.test/v1', APPWRITE_FUNCTION_PROJECT_ID: 'project', TEACHER_DATABASE_ID: 'db', TEACHER_COLLECTION_ID: 'teacher', GROQ_API_KEY: 'fake-test-key', TEACHER_DAILY_AI_LIMIT: limit, ...(youtubeKey ? { YOUTUBE_API_KEY: youtubeKey } : {}) } });
  let number = 0;
  const invoke = async (body = {}, user = 'student-a', method = 'POST') => {
    let result;
    await handler({ req: { method, headers: { ...(user ? { 'x-appwrite-user-id': user } : {}), 'x-appwrite-key': 'fake-dynamic' }, body: typeof body === 'string' ? body : { requestId: `request-${++number}`, ...body } }, res: { json: (data, status = 200) => { result = { status, ...data }; return result; } } });
    return result;
  };
  return { docs, stats, calls, replies, invoke, setFailSave: value => { failSave = value; }, setFailStats: value => { failStats = value; } };
}
async function setup(f) { f.replies.push(quiz, quiz); return f.invoke({ action: 'setup', profile }); }
async function startLesson(f) {
  const started = await setup(f);
  f.replies.push(roadmap);
  return f.invoke({ action: 'grade', revision: 1, quizId: started.state.quiz.id, answers: [1, 0, 1] });
}

test('validates profiles and AI-generated structures', () => {
  assert.equal(validateProfile(profile).minutes, 25);
  assert.throws(() => validateProfile({ ...profile, minutes: 0 }));
  assert.throws(() => validateProfile({ ...profile, syllabus: '' }));
  assert.throws(() => validateQuiz({ questions: [] }));
  assert.throws(() => validateQuiz({ questions: quiz.questions.map(q => ({ ...q, correctIndex: 8 })) }));
  assert.throws(() => validateQuiz({ questions: quiz.questions.map(q => ({ ...q, options: ['a', 'a', 'b', 'c'] })) }));
  assert.throws(() => validateRoadmap({ topics: [] }, 25));
  assert.equal(validateRoadmap(roadmap, 25)[0].minutes, 25);
});
test('server grading validates answers and never exposes an active answer key', () => {
  const active = { ...quiz, id: 'quiz1' };
  const safe = publicState({ quiz: active, usage: { count: 2 }, lastRequestId: 'secret' });
  assert.equal(safe.quiz.questions[0].correctIndex, undefined);
  assert.equal(safe.quiz.questions[0].explanation, undefined);
  assert.equal(safe.usage, undefined);
  assert.throws(() => gradeQuiz(active, [1, 0]));
  assert.equal(gradeQuiz(active, [1, 0, 1]).score, 2);
});
test('requires authentication, POST and well-formed requests', async () => {
  const f = fixture();
  assert.equal((await f.invoke({}, null)).status, 401);
  assert.equal((await f.invoke({}, 'student-a', 'GET')).status, 405);
  assert.equal((await f.invoke('{')).status, 400);
  assert.equal((await f.invoke({ action: 'delete' })).status, 400);
  assert.equal((await f.invoke({ action: 'load' })).state, null);
});
test('full journey saves profile, diagnoses, teaches, revises and advances', async () => {
  const f = fixture();
  const ready = await startLesson(f);
  assert.equal(ready.status, 200);
  assert.equal(ready.state.currentTopicId, 'topic1');
  assert.equal(ready.state.results[0].score, 2);
  f.replies.push('A linear equation has an unknown. Try x + 1 = 3.');
  const chat = await f.invoke({ action: 'chat', revision: 2, message: 'Please teach me.' });
  assert.equal(chat.state.messages.length, 2);
  f.replies.push(quiz, quiz);
  const check = await f.invoke({ action: 'quiz', revision: 3 });
  assert.equal(check.state.quiz.questions[0].correctIndex, undefined);
  const failed = await f.invoke({ action: 'grade', revision: 4, quizId: check.state.quiz.id, answers: [0, 0, 0] });
  assert.equal(failed.state.roadmap[0].status, 'revision');
  assert.equal(failed.state.currentTopicId, 'topic1');
  f.replies.push(quiz, quiz);
  const retry = await f.invoke({ action: 'quiz', revision: 5 });
  const passed = await f.invoke({ action: 'grade', revision: 6, quizId: retry.state.quiz.id, answers: [1, 1, 1] });
  assert.equal(passed.state.roadmap[0].status, 'complete');
  assert.equal(passed.state.currentTopicId, 'topic2');
  assert.deepEqual((await f.invoke({ action: 'load' })).state, passed.state);
  assert.equal((await f.invoke({ action: 'load' }, 'student-b')).state, null);
});
test('chat replies attach a real video link when YOUTUBE_API_KEY is configured', async () => {
  const f = fixture({ youtubeKey: 'fake-youtube-key', videos: [{ id: 'abc123', title: 'Linear equations explained' }] });
  await startLesson(f);
  f.replies.push('A linear equation has an unknown. Try x + 1 = 3.');
  const chat = await f.invoke({ action: 'chat', revision: 2, message: 'Please teach me.' });
  const reply = chat.state.messages[1].content;
  assert.ok(reply.includes('[Linear equations explained](https://www.youtube.com/watch?v=abc123)'));
});
test('chat replies are unaffected when the video lookup finds nothing or fails', async () => {
  const f = fixture({ youtubeKey: 'fake-youtube-key', videos: [null] });
  await startLesson(f);
  f.replies.push('A linear equation has an unknown. Try x + 1 = 3.');
  const chat = await f.invoke({ action: 'chat', revision: 2, message: 'Please teach me.' });
  assert.equal(chat.state.messages[1].content, 'A linear equation has an unknown. Try x + 1 = 3.');

  const failing = fixture({ youtubeKey: 'fake-youtube-key', videos: [new Error('network down')] });
  await startLesson(failing);
  failing.replies.push('A linear equation has an unknown. Try x + 1 = 3.');
  const failedLookup = await failing.invoke({ action: 'chat', revision: 2, message: 'Please teach me.' });
  assert.equal(failedLookup.state.messages[1].content, 'A linear equation has an unknown. Try x + 1 = 3.');
});
test('AI Teacher receives saved Mahei Assistance study plans as lesson context', async () => {
  const f = fixture();
  await startLesson(f);
  f.replies.push('Let us begin with equivalent fractions.');
  const savedPlan = {
    title: 'Mathematics: Fractions and decimals',
    deadline: '2026-09-17',
    estTime: 53,
    status: 'Pending',
    notes: 'AI TEACHER STUDY PLAN\nBegin with fraction models and equivalent fractions.',
  };
  const result = await f.invoke({
    action: 'chat',
    revision: 2,
    message: 'Teach me from my saved plan.',
    learningContext: { studyPlans: [savedPlan] },
  });
  assert.equal(result.status, 200);
  const context = JSON.parse(f.calls.at(-1).messages[1].content);
  assert.equal(context.savedStudyPlans[0].title, savedPlan.title);
  assert.match(context.savedStudyPlans[0].plan, /equivalent fractions/);
});
test('students can create and switch between saved subject sessions', async () => {
  const f = fixture();
  const maths = await startLesson(f);
  const mathsSessionId = maths.activeSessionId;
  const callsBeforeNewSession = f.calls.length;

  const fresh = await f.invoke({ action: 'new_session', revision: maths.state.revision });
  assert.equal(fresh.state, null);
  assert.equal(fresh.sessions.length, 2);
  assert.notEqual(fresh.activeSessionId, mathsSessionId);
  assert.equal(f.calls.length, callsBeforeNewSession);

  const scienceProfile = { ...profile, subject: 'Science', goal: 'Understand electricity', syllabus: 'Current, voltage, resistance and simple circuits.' };
  f.replies.push(quiz, quiz);
  const science = await f.invoke({ action: 'setup', revision: 0, profile: scienceProfile });
  assert.equal(science.state.profile.subject, 'Science');
  assert.equal(science.sessions.find(session => session.id === science.activeSessionId).subject, 'Science');

  const switched = await f.invoke({ action: 'switch_session', sessionId: mathsSessionId });
  assert.equal(switched.state.profile.subject, 'Math');
  assert.equal(switched.activeSessionId, mathsSessionId);
  assert.equal(switched.sessions.length, 2);
  assert.equal((await f.invoke({ action: 'load' })).state.profile.subject, 'Math');
});
test('students can delete a subject and deleting the active subject switches safely', async () => {
  const f = fixture();
  const maths = await startLesson(f);
  const mathsSessionId = maths.activeSessionId;
  const fresh = await f.invoke({ action: 'new_session', revision: maths.state.revision });
  const newSessionId = fresh.activeSessionId;

  const deleted = await f.invoke({ action: 'delete_session', sessionId: newSessionId });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.sessions.length, 1);
  assert.equal(deleted.activeSessionId, mathsSessionId);
  assert.equal(deleted.state.profile.subject, 'Math');
  assert.equal([...f.docs.keys()].filter(key => key.startsWith('ses')).length, 1);

  const onlySession = await f.invoke({ action: 'delete_session', sessionId: mathsSessionId });
  assert.equal(onlySession.status, 400);
  assert.equal((await f.invoke({ action: 'load' })).state.profile.subject, 'Math');
});
test('retries do not regenerate or regrade, and stale revisions are rejected', async () => {
  const f = fixture({ replies: [quiz, quiz] });
  const body = { action: 'setup', profile, requestId: 'same-request' };
  const first = await f.invoke(body);
  const duplicate = await f.invoke(body);
  assert.deepEqual(duplicate.state, first.state);
  assert.equal(f.calls.length, 2);
  assert.equal((await f.invoke({ action: 'grade', revision: 0, quizId: first.state.quiz.id, answers: [1, 1, 1] })).status, 409);
  assert.equal((await f.invoke({ action: 'grade', revision: 1, quizId: 'wrong', answers: [1, 1, 1] })).status, 409);
});
test('AI and save failures preserve previously saved progress and release the lock', async () => {
  const f = fixture();
  await startLesson(f);
  const before = f.docs.get('student-a');
  assert.equal((await f.invoke({ action: 'chat', revision: 2, message: 'Teach me' })).status, 502);
  assert.equal(f.docs.get('student-a'), before);
  f.replies.push('A new lesson'); f.setFailSave(true);
  assert.equal((await f.invoke({ action: 'chat', revision: 2, message: 'Teach me' })).status, 503);
  assert.equal(f.docs.get('student-a'), before);
  assert.ok(![...f.docs.keys()].some(k => k.startsWith('lock')));
});
test('daily AI allowance includes failed calls', async () => {
  const f = fixture({ limit: '1' });
  assert.equal((await f.invoke({ action: 'setup', profile })).status, 502);
  assert.equal((await f.invoke({ action: 'setup', profile })).status, 429);
  assert.equal(f.calls.length, 1);
});
test('invalid AI content is not saved and chatting cannot bypass an active quiz', async () => {
  const f = fixture({ replies: [{ questions: [] }] });
  assert.equal((await f.invoke({ action: 'setup', profile })).status, 502);
  assert.equal(f.docs.has('student-a'), false);
  await setup(f);
  const calls = f.calls.length;
  assert.equal((await f.invoke({ action: 'chat', revision: 1, message: 'Tell me the answers' })).status, 400);
  assert.equal(f.calls.length, calls);
});

test('concurrent requests are serialized and cannot overwrite a saved lesson', async () => {
  const f = fixture();
  await startLesson(f);
  f.replies.push('One saved lesson');
  const results = await Promise.all([
    f.invoke({ action: 'chat', revision: 2, message: 'Teach me' }),
    f.invoke({ action: 'chat', revision: 2, message: 'A second request' }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const loaded = await f.invoke({ action: 'load' });
  assert.equal(loaded.state.messages.length, 2);
  assert.equal(loaded.state.revision, 3);
});

test('missing collection is a configuration error, not an empty student profile', async () => {
  const handler = createHandler({ env: { APPWRITE_FUNCTION_API_ENDPOINT:'https://appwrite.test/v1',APPWRITE_FUNCTION_PROJECT_ID:'p',APPWRITE_DATABASE_ID:'d',TEACHER_COLLECTION_ID:'c' }, fetcher: async()=>response({type:'collection_not_found'},404) });
  let result;
  await handler({req:{method:'POST',headers:{'x-appwrite-user-id':'student-a','x-appwrite-key':'fake'},body:{action:'load'}},res:{json:(data,status)=>{result={...data,status};}}});
  assert.equal(result.status,503);
  assert.equal(result.success,false);
});

const monthKey = () => new Date().toISOString().slice(0, 7);
const statsRowFor = f => f.stats.get(monthlyStatsRowId('student-a', monthKey()));
// Passes every topic of the roadmap. With holdFinalGrade the last quiz is generated but not yet graded.
async function finishRoadmap(f, { holdFinalGrade = false } = {}) {
  let last = await startLesson(f);
  let revision = 2;
  const statsSizes = [];
  const topicCount = last.state.roadmap.length;
  for (let i = 0; i < topicCount; i += 1) {
    f.replies.push(quiz, quiz);
    const check = await f.invoke({ action: 'quiz', revision });
    revision += 1;
    if (holdFinalGrade && i === topicCount - 1) return { hold: { revision, quizId: check.state.quiz.id }, statsSizes };
    last = await f.invoke({ action: 'grade', revision, quizId: check.state.quiz.id, answers: [1, 1, 1] });
    revision += 1;
    statsSizes.push(f.stats.size);
  }
  return { last, statsSizes };
}
const finalGrade = (f, hold) => f.invoke({ action: 'grade', revision: hold.revision, quizId: hold.quizId, answers: [1, 1, 1] });

test('roadmap XP is worth 20 and shares the monthly stats row that focus XP uses', () => {
  assert.equal(ROADMAP_COMPLETION_XP, 20);
  const expected = 'month_' + createHash('sha256').update('student-a:2026-09').digest('hex').slice(0, 28);
  assert.equal(monthlyStatsRowId('student-a', '2026-09'), expected);
});
test('completing the whole roadmap awards 20 XP once and records it on the saved progress', async () => {
  const f = fixture();
  const { last, statsSizes } = await finishRoadmap(f);
  assert.deepEqual(statsSizes, [0, 0, 1]);
  assert.equal(last.state.currentTopicId, null);
  assert.equal(last.state.roadmapXp.status, 'awarded');
  assert.equal(last.state.roadmapXp.points, 20);
  const row = statsRowFor(f);
  assert.equal(row.xp, 20);
  assert.equal(row.appwrite_user_id, 'student-a');
  assert.equal(row.month_key, monthKey());
  assert.equal(row.focus_minutes, 0);
  assert.equal(row.focus_sessions, 0);
  assert.equal(typeof row.updated_at, 'string');
  assert.equal((await f.invoke({ action: 'load' })).state.roadmapXp.points, 20);
});
test('roadmap XP is added to XP already earned from focus sessions this month', async () => {
  const f = fixture();
  f.stats.set(monthlyStatsRowId('student-a', monthKey()), { appwrite_user_id: 'student-a', month_key: monthKey(), xp: 30, focus_minutes: 75, focus_sessions: 3, updated_at: '2026-09-01T00:00:00.000Z' });
  await finishRoadmap(f);
  const row = statsRowFor(f);
  assert.equal(row.xp, 50);
  assert.equal(row.focus_minutes, 75);
  assert.equal(row.focus_sessions, 3);
});
test('a retry after a failed save never awards the roadmap XP twice', async () => {
  const f = fixture();
  const { hold } = await finishRoadmap(f, { holdFinalGrade: true });
  f.setFailSave(true);
  assert.equal((await finalGrade(f, hold)).status, 503);
  assert.equal(statsRowFor(f).xp, 20);
  f.setFailSave(false);
  const retried = await finalGrade(f, hold);
  assert.equal(retried.status, 200);
  assert.equal(retried.state.roadmapXp.status, 'already-awarded');
  assert.equal(retried.state.roadmapXp.points, 0);
  assert.equal(statsRowFor(f).xp, 20);
});
test('a failed XP write never blocks the lesson and leaves the award claimable', async () => {
  const f = fixture();
  const { hold } = await finishRoadmap(f, { holdFinalGrade: true });
  f.setFailStats(true);
  const result = await finalGrade(f, hold);
  assert.equal(result.status, 200);
  assert.equal(result.state.currentTopicId, null);
  assert.ok(result.state.roadmap.every(topic => topic.status === 'complete'));
  assert.equal(result.state.roadmapXp.status, 'failed');
  assert.equal(result.state.roadmapXp.points, 0);
  assert.equal(f.stats.size, 0);
  assert.equal([...f.docs.keys()].some(id => id.startsWith('rmxp')), false);
});
