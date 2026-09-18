import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, BookOpen, CheckCircle2, ArrowRight, Send, RefreshCw, Plus, Trash2, X } from 'lucide-react';
import { teacherRequest } from '../lib/appwrite';
import './AiTeacher.css';
import AiResponse from './AiResponse.jsx';
import { teacherResources } from '../lib/teacherResources.js';

function LearningResources({ messages, index, profile, topic }) {
  const links = teacherResources(messages, index, profile, topic);
  if (!links.length) return null;
  return <section className="teacher-resources" aria-label="Related learning resources">
    <h4>Watch this lesson</h4>
    <p>{links[0].provider} · English</p>
    <div className="teacher-resource-links">{links.map(link => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true"> ↗</span><span className="teacher-sr-only"> (opens in a new tab)</span></a>)}</div>
    <small>Opens the specific lesson video in a new tab.</small>
  </section>;
}

const initialProfile = { level: '', subject: '', language: 'English', goal: '', minutes: 25, syllabus: '' };
export default function AiTeacher({ userId, studyPlans = [], request = teacherRequest }) {
  const [state, setState] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState({});
  const [tab, setTab] = useState('learn');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const mounted = useRef(true);
  const pending = useRef(null);
  const inFlight = useRef(false);
  const chatEnd = useRef(null);
  const messagesRef = useRef(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const value = await request({ action: 'load', learningContext: { studyPlans } });
      if (mounted.current) setState(value);
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [userId]);
  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [state?.messages?.length, state?.activeSessionId]);
  useEffect(() => { setSessionOpen(false); }, [state?.activeSessionId]);

  async function run(action, data = {}) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    const signature = JSON.stringify({ action, ...data });
    const previous = pending.current;
    const requestId = previous?.signature === signature ? previous.id : crypto.randomUUID();
    pending.current = { signature, id: requestId };
    try {
      const value = await request({ action, ...data, learningContext: { studyPlans }, requestId, revision: state?.revision || 0 });
      if (!mounted.current) return;
      setState(value); pending.current = null;
      if (action === 'chat') setMessage('');
      if (action === 'grade' || action === 'quiz' || action === 'setup') setAnswers({});
      if (action === 'grade') setTab('learn');
      if (action === 'new_session') { setProfile(initialProfile); setMessage(''); setAnswers({}); setTab('learn'); }
      if (action === 'switch_session') { setMessage(''); setAnswers({}); setTab('learn'); }
      if (action === 'delete_session') { setDeleteCandidate(null); setMessage(''); setAnswers({}); setTab('learn'); }
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  const topic = state?.roadmap.find(t => t.id === state.currentTopicId);
  const completed = state?.roadmap.filter(t => t.status === 'complete').length || 0;
  const latest = state?.results.at(-1);
  const fields = [ ['level', 'Class or exam', 'For example: Class 10, CBSE', 120], ['subject', 'Subject', 'For example: Mathematics', 120], ['language', 'Learning language', 'Your preferred language', 80], ['goal', 'Your learning goal', 'What would you like to understand or achieve?', 500] ];

  const workspace = Boolean(state?.profile && !state.quiz && tab === 'learn' && !overviewOpen);
  return <section className={`teacher-page ${workspace ? 'teacher-workspace' : ''}`}>
    {state?.profile && <div className="teacher-workspace-controls"><button type="button" className="secondary-button" aria-expanded={overviewOpen} onClick={() => setOverviewOpen(value => !value)}>{overviewOpen ? 'Back to conversation' : 'Subjects & learning overview'}</button></div>}
    <header className="teacher-heading"><div><p className="teacher-eyebrow"><Sparkles size={16} /> YOUR PERSONAL AI TEACHER</p><h2>A little progress. Every day.</h2><p>Learn at your pace, ask anything, and turn understanding into practice.</p></div><span className="teacher-badge">Learn · Practise · Grow</span></header>
    {error && <div className="teacher-error" role="alert"><span>{error}</span><button type="button" disabled={busy || loading} onClick={load}><RefreshCw size={15} /> Reload saved progress</button></div>}
    <div className="teacher-status" role="status" aria-live="polite">{busy ? 'Your AI teacher is preparing and saving your next step…' : loading ? 'Loading your learning space…' : ''}</div>
    {state?.sessions?.length > 0 && <section className="teacher-sessions" aria-label="Saved subject sessions"><div className="teacher-sessions-heading"><div><p className="teacher-eyebrow">MY SUBJECTS</p><h3>Switch learning session</h3></div><button type="button" className="dark-button" disabled={busy || state.sessions.length >= 6} onClick={() => run('new_session')}><Plus size={16} /> New subject</button></div><div className="teacher-session-list">{state.sessions.map(session => <article key={session.id} className={`teacher-session-card ${session.id === state.activeSessionId ? 'active' : ''}`}><button type="button" className="teacher-session-switch" aria-pressed={session.id === state.activeSessionId} disabled={busy || session.id === state.activeSessionId} onClick={() => run('switch_session', { sessionId: session.id })}><strong>{session.subject}</strong><span>{session.level}</span><small>{session.total ? `${session.completed}/${session.total} topics complete` : 'Setup in progress'}</small></button><button type="button" className="teacher-session-delete" aria-label={`Delete ${session.subject} subject`} title="Delete subject" disabled={busy || state.sessions.length === 1} onClick={() => setDeleteCandidate(session)}><Trash2 size={15} /></button></article>)}</div>{state.sessions.length === 1 && <p className="teacher-session-note">Keep at least one subject. Add another subject before deleting this one.</p>}</section>}
    {deleteCandidate && <div className="teacher-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setDeleteCandidate(null); }}><section className="teacher-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-subject-title" aria-describedby="delete-subject-description"><button type="button" className="teacher-confirm-close" aria-label="Close confirmation" disabled={busy} onClick={() => setDeleteCandidate(null)}><X size={18} /></button><div className="teacher-confirm-icon"><Trash2 size={22} /></div><p className="teacher-eyebrow">DELETE SUBJECT</p><h3 id="delete-subject-title">Delete {deleteCandidate.subject}?</h3><p id="delete-subject-description">This will permanently remove its lessons, messages, roadmap and quiz progress.</p><div className="teacher-confirm-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setDeleteCandidate(null)}>Keep subject</button><button type="button" className="teacher-danger-button" disabled={busy} onClick={() => run('delete_session', { sessionId: deleteCandidate.id })}>{busy ? 'Deleting…' : 'Yes, delete subject'}</button></div></section></div>}
    {studyPlans.length > 0 && <div className="teacher-linked-plan"><div><p className="teacher-eyebrow">PLAN FROM MAHEI ASSISTANCE</p><strong>{studyPlans[0].title}</strong><span>Your AI teacher can read this saved plan and use it in lessons.</span></div>{state?.profile && <button type="button" className="secondary-button" disabled={busy || Boolean(state.quiz)} onClick={() => { setTab('learn'); run('chat', { message: `Teach me from my saved study plan: ${studyPlans[0].title}. Begin with the first unfinished learning step.` }); }}>Teach this plan</button>}</div>}
    {loading ? <div className="teacher-card">Opening your learning space…</div> : !state?.profile ? <div className="teacher-onboarding">
      <aside className="teacher-welcome"><BookOpen size={36} /><h3>A teacher that starts with you.</h3><p>Tell Mahei what you want to learn. A short starting quiz helps your AI teacher choose where to begin.</p><ol><li>Share your syllabus</li><li>Try three starting questions</li><li>Get your roadmap and first lesson</li></ol><p className="teacher-small">Lessons, practice, and feedback are generated by AI. Your profile and progress are saved to your account.</p></aside>
      <form className="teacher-card teacher-form" onSubmit={e => { e.preventDefault(); run('setup', { profile }); }}>
        <h3>Make this your learning space</h3><div className="teacher-form-grid">{fields.map(([name, label, placeholder, max]) => <label key={name}>{label}<input required maxLength={max} value={profile[name]} placeholder={placeholder} disabled={busy} onChange={e => setProfile(p => ({ ...p, [name]: e.target.value }))} /></label>)}</div>
        <label>Daily study time <select value={profile.minutes} disabled={busy} onChange={e => setProfile(p => ({ ...p, minutes: Number(e.target.value) }))}>{[10, 15, 25, 30, 45, 60, 90, 120, 180].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
        <label>Syllabus and reference material<textarea required rows={6} maxLength={12000} disabled={busy} value={profile.syllabus} onChange={e => setProfile(p => ({ ...p, syllabus: e.target.value }))} placeholder="Paste the topics you need to cover. Add relevant textbook passages or notes to help the AI teach from your material." /></label>
        <p className="teacher-small">Start with one subject and a manageable group of topics. AI can make mistakes; ask it to explain or revisit an answer that seems wrong.</p>
        <button className="dark-button" disabled={busy} type="submit">{busy ? 'Preparing your starting quiz…' : 'Build my learning journey'}<ArrowRight size={17} /></button>
      </form>
    </div> : <>
      <div className="teacher-summary"><div><span className="teacher-eyebrow">{state.profile.subject} · {state.profile.level}</span><h3>{state.profile.goal}</h3><p>{state.profile.language} · {state.profile.minutes} minutes a day</p></div><div className="teacher-progress"><strong>{completed}<span> / {state.roadmap.length || '—'}</span></strong><span>topics completed</span></div></div>
      <nav className="teacher-tabs" aria-label="Learning sections">{[['learn', 'Today & teacher'], ['roadmap', 'My roadmap'], ['results', 'My progress']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {state.quiz && <form className="teacher-card teacher-quiz" onSubmit={e => { e.preventDefault(); run('grade', { quizId: state.quiz.id, answers: state.quiz.questions.map(q => answers[q.id]) }); }}><p className="teacher-eyebrow">{state.quiz.kind === 'diagnostic' ? 'YOUR STARTING POINT' : 'CHECK YOUR UNDERSTANDING'}</p><h3>{state.quiz.kind === 'diagnostic' ? 'Let’s find where to begin.' : topic?.title}</h3><p>Choose one answer for each question. You’ll see explanations after submitting.</p>{state.quiz.questions.map((q, index) => <fieldset key={q.id} disabled={busy}><legend>{index + 1}. {q.prompt}</legend>{q.options.map((option, i) => <label className={answers[q.id] === i ? 'chosen' : ''} key={i}><input type="radio" name={q.id} required checked={answers[q.id] === i} onChange={() => setAnswers(a => ({ ...a, [q.id]: i }))} />{option}</label>)}</fieldset>)}<button className="dark-button" disabled={busy || state.quiz.questions.some(q => answers[q.id] === undefined)}>Submit answers <ArrowRight size={16} /></button></form>}
      {tab === 'learn' && !state.quiz && <div className="teacher-learning-grid teacher-chat-layout">{sessionOpen && <aside id="teacher-study-session" className="teacher-card teacher-today" aria-label="Study session"><button type="button" className="teacher-session-close secondary-button" onClick={() => setSessionOpen(false)}>Close study session <X size={15}/></button><p className="teacher-eyebrow">YOUR NEXT STUDY SESSION</p><h3>{topic?.title || 'Roadmap completed!'}</h3><p>{topic?.objective || 'Keep asking questions or revisit anything you want to understand better.'}</p>{topic?.status === 'revision' && <p className="teacher-revision">Let’s revisit this topic before moving forward.</p>}{topic && <><ol><li>Learn with your AI teacher</li><li>Try guided practice</li><li>Take a three-question quiz</li></ol><p className="teacher-small">Aim for {topic.minutes} minutes. If you miss a day, continue from this session.</p><button className="dark-button" disabled={busy} onClick={() => run('chat', { message: `Teach me ${topic.title}. Start with a short explanation and a practice question.` })}>Start this lesson <BookOpen size={16} /></button><button className="secondary-button" disabled={busy} onClick={() => run('quiz')}>Check my understanding</button></>}{latest && <div className="teacher-last-result"><strong>Last check: {latest.score}/{latest.total}</strong><p>{latest.kind === 'diagnostic' ? 'Your starting answers helped shape this roadmap.' : latest.passed ? 'Ready for the next step.' : 'Your teacher will help you work through the mistakes.'}</p><button className="teacher-link" onClick={() => setTab('results')}>Review answers</button></div>}</aside>}
        <div className="teacher-card teacher-conversation" onKeyDown={event => { if (event.key === 'Escape') setSessionOpen(false); }}><div className="teacher-chat-title"><Sparkles size={19} /><h3>Mahei, your AI teacher</h3><button type="button" className="secondary-button teacher-study-toggle" aria-expanded={sessionOpen} aria-controls="teacher-study-session" onClick={() => setSessionOpen(value => !value)}><BookOpen size={16}/>{sessionOpen ? 'Hide study session' : 'Study session'}</button><span>Saved to your account</span></div><div ref={messagesRef} className="teacher-messages" aria-label="Lesson conversation">{!state.messages.length && <div className="teacher-chat-empty"><BookOpen size={30} /><h3>Let’s make it make sense.</h3><p>Start your lesson or ask a question below. Your teacher will guide you one step at a time.</p></div>}{state.messages.map((m, i) => <article key={i} className={`teacher-message ${m.role}`}><strong>{m.role === 'user' ? 'You' : 'Mahei'}</strong>{m.role === 'assistant' ? <><AiResponse>{m.content}</AiResponse><LearningResources messages={state.messages} index={i} profile={state.profile} topic={topic?.title} /></> : <div>{m.content}</div>}</article>)}<div ref={chatEnd} /></div><form onSubmit={e => { e.preventDefault(); run('chat', { message }); }}><label className="teacher-sr-only" htmlFor="teacher-message">Ask your AI teacher</label><textarea id="teacher-message" maxLength={2000} rows={3} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder="Ask a question, share your answer, or request a simpler explanation…"/><button className="dark-button" disabled={busy || !message.trim()}><Send size={16} /> Send</button></form><p className="teacher-small">Your recent conversation is saved. Quiz results guide what to study next.</p></div></div>}
      {tab === 'roadmap' && <div className="teacher-card"><h3>Your learning roadmap</h3><p>Pass a topic check with at least 2 out of 3 correct answers to move forward. This is a practice signal, not a formal mastery score.</p>{!state.roadmap.length && <p>Complete your starting quiz to create your roadmap.</p>}<ol className="teacher-roadmap">{state.roadmap.map((t, i) => <li key={t.id} className={t.id === state.currentTopicId ? 'current' : ''}><span className="teacher-step">{t.status === 'complete' ? <CheckCircle2 size={22} /> : i + 1}</span><div><h4>{t.title}</h4><p>{t.objective}</p><span className="teacher-small">{t.minutes} min · {t.status === 'complete' ? 'Completed' : t.status === 'revision' ? 'Needs revision' : t.id === state.currentTopicId ? 'Up next' : 'Upcoming'}</span></div></li>)}</ol></div>}
      {tab === 'results' && <div className="teacher-card"><h3>Your progress and feedback</h3>{!state.results.length && <p>Your quiz feedback will appear here.</p>}{[...state.results].reverse().map(result => <section className="teacher-result" key={result.quizId}><h4>{result.kind === 'diagnostic' ? 'Starting assessment' : state.roadmap.find(t => t.id === result.topicId)?.title} <span>{result.score}/{result.total}</span></h4><p className="teacher-small">{new Date(result.date).toLocaleDateString()}</p>{result.feedback.map((f, i) => <div key={i} className="teacher-feedback"><strong>{f.passed ? '✓' : '↻'} {f.prompt}</strong><p>Your answer: {f.selected}</p>{!f.passed && <p>Correct answer: {f.correct}</p>}<AiResponse>{f.explanation}</AiResponse></div>)}</section>)}</div>}
    </>}
  </section>;
}
