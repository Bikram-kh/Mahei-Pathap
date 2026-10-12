import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckSquare,
  Clock3,
  FileText,
  GraduationCap,
  Target,
  Trophy,
  User,
  Users,
} from "lucide-react";
import BrandMark from "./BrandMark.jsx";
import "./LandingPage.css";

const QUICK_LINKS = [
  {
    icon: CalendarDays,
    tone: "lime",
    title: "Plan your day",
    text: "Bring your tasks, notes and goals together in one place.",
    href: "#features",
  },
  {
    icon: Target,
    tone: "white",
    title: "Find your focus",
    text: "Stay on track with focus sessions and a calmer study routine.",
    href: "#how",
  },
  {
    icon: Users,
    tone: "salmon",
    title: "Learn together",
    text: "Join study groups, share notes and make progress with your people.",
    href: "#groups",
  },
];

const FEATURES = [
  {
    icon: CheckSquare,
    tone: "forest",
    title: "Tasks and assignments",
    text: "Plan the day, track deadlines and tick things off without switching apps.",
  },
  {
    icon: Clock3,
    tone: "persimmon",
    title: "Focus sessions",
    text: "A Pomodoro timer that turns every focused minute into XP.",
  },
  {
    icon: BookOpen,
    tone: "forest",
    title: "Notes and Notes Store",
    text: "Write rich notes, keep them tidy, and discover notes shared by other students.",
  },
  {
    icon: Users,
    tone: "persimmon",
    title: "Study Groups",
    text: "Private groups with chat, shared notes, PDFs and video sessions.",
  },
  {
    icon: GraduationCap,
    tone: "forest",
    title: "AI Teacher",
    text: "Ask a question in plain language and get a step-by-step explanation.",
  },
  {
    icon: Trophy,
    tone: "persimmon",
    title: "Leaderboard and roadmap",
    text: "Earn XP as you progress and see how you rank on the monthly leaderboard.",
  },
];

const GROUP_POINTS = [
  "Invite friends with a private link",
  "Get notified when someone posts",
  "Keep notes and files in one place",
];

const STEPS = [
  {
    number: "01",
    title: "Plan",
    text: "Add tasks and assignments, set goals and see your week on the calendar.",
  },
  {
    number: "02",
    title: "Focus",
    text: "Start a Pomodoro session. Every focused minute earns XP.",
  },
  {
    number: "03",
    title: "Grow together",
    text: "Study with friends, ask the AI Teacher and climb the monthly leaderboard.",
  },
];

function Brand({ onDark = false }) {
  return (
    <div className="lp-brand">
      <span className="lp-brand-mark">
        <BrandMark size={52} onDark={onDark} />
      </span>
      <span className="lp-brand-name">
        <span>Mahei</span> <span>Pathap</span>
      </span>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="lp-preview" aria-hidden="true">
      <div className="lp-preview-card lp-preview-tasks">
        <div className="lp-preview-head">
          <strong>Today</strong>
          <span className="lp-chip lp-chip-forest">3 tasks</span>
        </div>
        <div className="lp-preview-row">
          <span className="lp-check lp-check-on">
            <Check size={14} strokeWidth={3} />
          </span>
          <span>Plan this week</span>
        </div>
        <div className="lp-preview-row">
          <span className="lp-check" />
          <span>Finish physics problem set</span>
        </div>
        <div className="lp-preview-row">
          <span className="lp-check" />
          <span>Revise chemistry notes</span>
        </div>
      </div>

      <div className="lp-preview-card lp-preview-focus">
        <span>Focus session</span>
        <strong>18:42</strong>
        <div className="lp-progress">
          <div className="lp-progress-fill" />
        </div>
      </div>

      <div className="lp-preview-card lp-preview-group">
        <strong>Study together</strong>
        <div className="lp-avatars">
          <span className="lp-avatar lp-avatar-lime">
            <User size={20} aria-hidden="true" />
          </span>
          <span className="lp-avatar lp-avatar-white">
            <User size={20} aria-hidden="true" />
          </span>
          <span className="lp-avatar lp-avatar-purple">
            <User size={20} aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupPreview() {
  return (
    <div className="lp-chat" aria-hidden="true">
      <div className="lp-chat-head">
        <div>
          <strong>Physics, Class 12</strong>
          <small>6 members, 3 online</small>
        </div>
        <span className="lp-live">Join live</span>
      </div>
      <div className="lp-bubble lp-bubble-them">
        <span className="lp-avatar">M</span>
        <p>Did anyone finish question 7?</p>
      </div>
      <div className="lp-bubble lp-bubble-me">
        <p>Yes! I will share my notes in a minute.</p>
      </div>
      <div className="lp-file">
        <span className="lp-file-icon">
          <FileText size={18} />
        </span>
        <div>
          <strong>Problem set 4, worked answers</strong>
          <small>Shared note</small>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onLogin, onSignup }) {
  return (
    <div className="lp">
      <div className="lp-topbar">
        <header className="lp-header">
          <Brand />

          <nav className="lp-nav" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#groups">Study Groups</a>
            <a href="#how">How it works</a>
          </nav>

          <div className="lp-header-actions">
            <button type="button" className="lp-btn lp-btn-ghost" onClick={onLogin}>
              Log in
            </button>
            <button type="button" className="lp-btn lp-btn-primary" onClick={onSignup}>
              Get started
            </button>
          </div>
        </header>
      </div>

      <main>
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-hero-copy">
            <span className="lp-pill">
              <GraduationCap size={20} aria-hidden="true" />
              Made for students
            </span>
            <h1 id="lp-hero-title">
              Study with <span className="lp-hero-mark">focus.</span>
              <br />
              Grow with your people.
            </h1>
            <p>
              Your <strong>tasks, notes,</strong> focus sessions and study groups
              {" "}&mdash; together in one workspace.
            </p>
            <div className="lp-hero-actions">
              <button type="button" className="lp-btn lp-btn-primary lp-btn-large" onClick={onSignup}>
                Get started
                <ArrowRight size={20} aria-hidden="true" />
              </button>
              <a className="lp-btn lp-btn-secondary lp-btn-large" href="#how">
                See how it works
              </a>
            </div>
          </div>

          <figure className="lp-preview-figure">
            <HeroPreview />
            <figcaption>Illustrative preview with sample data, not a live account.</figcaption>
          </figure>
        </section>

        <section className="lp-quick" aria-label="Highlights">
          {QUICK_LINKS.map(({ icon: Icon, tone, title, text, href }) => (
            <a className={`lp-quick-card lp-quick-${tone}`} href={href} key={title}>
              <span className="lp-quick-icon">
                <Icon size={32} aria-hidden="true" />
              </span>
              <span className="lp-quick-copy">
                <strong>{title}</strong>
                <span>{text}</span>
              </span>
              <ArrowRight size={24} aria-hidden="true" />
            </a>
          ))}
        </section>

        <section className="lp-section" id="features" aria-labelledby="lp-features-title">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Everything in one place</span>
            <h2 id="lp-features-title">A calmer way to get things done</h2>
            <p>
              Stop juggling apps. Plan, focus, learn and study together without
              leaving your workspace.
            </p>
          </div>

          <div className="lp-feature-grid">
            {FEATURES.map(({ icon: Icon, tone, title, text }) => (
              <article className="lp-feature" key={title}>
                <span className={`lp-feature-icon lp-tone-${tone}`}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-groups" id="groups" aria-labelledby="lp-groups-title">
          <div className="lp-groups-copy">
            <span className="lp-eyebrow lp-eyebrow-light">Study Groups</span>
            <h2 id="lp-groups-title">Study together, even when you are apart</h2>
            <p>Chat, share notes and PDFs, and jump into a video session, all inside your group.</p>
            <ul>
              {GROUP_POINTS.map((point) => (
                <li key={point}>
                  <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-light lp-btn-large" onClick={onSignup}>
              Create your account
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>

          <figure className="lp-preview-figure lp-preview-figure-light">
            <GroupPreview />
            <figcaption>Illustrative preview with sample messages.</figcaption>
          </figure>
        </section>

        <section className="lp-section" id="how" aria-labelledby="lp-how-title">
          <h2 id="lp-how-title">How it works</h2>
          <ol className="lp-steps">
            {STEPS.map(({ number, title, text }) => (
              <li key={number}>
                <span className="lp-step-number">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <h2 id="lp-cta-title">Ready to make today count?</h2>
          <div className="lp-hero-actions">
            <button type="button" className="lp-btn lp-btn-primary lp-btn-large" onClick={onSignup}>
              Get started
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="lp-btn lp-btn-secondary lp-btn-large" onClick={onLogin}>
              Log in
            </button>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <Brand onDark />
        <small>© {new Date().getFullYear()} Mahei-Pathap. All rights reserved.</small>
      </footer>
    </div>
  );
}
