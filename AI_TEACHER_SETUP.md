# Mahei-pathap AI Teacher

This update adds an **AI Teacher** section to the existing React/Vite app. It uses the project's existing Appwrite and Groq architecture. No human teacher is needed for lessons, roadmaps, quizzes or grading.

## What is included

- Learning profile: class/exam, subject, language, goal, daily time, and pasted syllabus/reference material.
- Three-question starting assessment, with a second AI pass reviewing the question/answer pairs.
- A personalised roadmap of 3–10 session-sized topics.
- Today's session, conversational lessons, hints and practice.
- Optional real YouTube video link attached to each lesson reply (requires `YOUTUBE_API_KEY`).
- Three-question topic quizzes. Two correct answers advance the roadmap; otherwise the topic is marked for revision.
- Account-based storage: profile, roadmap, latest 20 conversation messages and latest 8 quiz results. Returning students continue from their next unfinished topic.
- Server-side quiz grading and private answer keys; keys are not returned to the browser until grading.
- Input validation, retry deduplication, stale-page detection, per-student request locking and a configurable daily AI call allowance.
- Existing Coach, Planner, tasks, focus and other features remain available.

This is the first AI-teacher version. It does not add weekly/monthly assessments, document uploads, a notes marketplace, webcam monitoring or automatic creation of items in the existing Tasks collection. Daily learning tasks appear inside AI Teacher. It supports one active subject/profile per account; changing subjects and long-term conversation archives are follow-up work. AI review checks can still miss factual errors, and a three-question quiz is not a formal mastery assessment.

## Activate it

The archive contains source code, not a deployed service. Your existing Appwrite project must be configured before live AI teaching will work. No live credentials are included.

### 1. Restore the existing website configuration

Use Node.js 20 or newer. Run `npm ci`. Copy `.env.example` to `.env` and fill in your existing public Vite configuration. Add:

```dotenv
VITE_APPWRITE_AI_TEACHER_FUNCTION_ID=mahei-ai-teacher
```

Keep `GROQ_API_KEY` and Appwrite administrative API keys **out of** `.env` variables prefixed with `VITE_`, source code, and browser storage.

### 2. Create private teacher storage

Use your existing Appwrite database. Create a dedicated collection:

| Setting | Value |
| --- | --- |
| Collection ID | `teacher-learning` |
| Collection permissions | None |
| Document security | Enabled |
| Attribute key | `state` |
| Attribute type | String |
| Attribute size | `250000` |
| Required | Yes |
| Array | No |

Wait for the attribute status to become **available**. No indexes are needed. The function handles all access through the authenticated execution identity. Do not give client users collection read or write access: documents include private quiz keys.

Alternatively, use `node scripts/setup-teacher-storage.mjs` from a trusted terminal with these environment variables already set: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_DATABASE_ID`, and an administrative `APPWRITE_API_KEY` with the database/collection/attribute permissions needed for setup. `TEACHER_COLLECTION_ID` optionally overrides the collection ID. The script does not deploy a function or alter an existing collection's permissions.

### 3. Deploy the new Appwrite function

Create a function with ID `mahei-ai-teacher` and upload `functions/mahei-ai-teacher` (its contents must be at the deployment root). Configuration is also included in `appwrite.config.json`; select only the new function if deploying via CLI.

| Setting | Value |
| --- | --- |
| Runtime | Node.js 22 |
| Entrypoint | `src/main.js` |
| Build command | `npm install` |
| Execution access | Signed-in users only (`users`) |
| Dynamic API key scopes | `documents.read`, `documents.write` |
| Timeout | 180 seconds |

Add function environment variables:

```dotenv
GROQ_API_KEY=your-server-side-key
GROQ_MODEL=openai/gpt-oss-120b
TEACHER_DATABASE_ID=your-existing-database-id
TEACHER_COLLECTION_ID=teacher-learning
TEACHER_DAILY_AI_LIMIT=40
YOUTUBE_API_KEY=your-youtube-data-api-key
```

`YOUTUBE_API_KEY` is optional. When set, each lesson reply includes a real YouTube video link found via the YouTube Data API v3 for the topic just taught. Without it, replies are unchanged — the lookup silently no-ops rather than failing the request. Create a key in Google Cloud Console by enabling "YouTube Data API v3" on a project and generating an API key under Credentials.

Appwrite provides the function endpoint, project ID, authenticated user ID, and dynamic API key at execution time. Keep execution restricted to authenticated users. Call it through Appwrite `createExecution`, as the included client does.

Each quiz uses two AI calls (generation and review). A diagnostic submission uses one call to create the roadmap, and each chat message uses one. Topic grading uses no AI call. The allowance is counted by UTC day and includes failed AI attempts. It is a per-student limit, not a global billing cap; configure a separate provider spending limit for a public launch.

### 4. Build and try it

Run `npm run build`, then use your normal website deployment workflow. For local use, run `npm run dev`.

Sign in and open **AI Teacher** in the sidebar. Complete the profile, starting quiz, first lesson, and topic quiz. Reload the page and confirm that progress remains. Test a second account to confirm its learning space is separate.

## Verification performed on the update

- Production Vite build.
- Automated offline backend tests using simulated Appwrite/Groq responses: full learning journey, deterministic grading, answer-key hiding, account isolation, malformed input, retries, stale revisions, service/save failures, daily limits, and quiz validation.
- Browser checks with a simulated teacher service: setup, assessment, lessons, draft preservation after failure, reload, revision flow, roadmap, feedback, and mobile layout.

Live Groq answer quality and deployment to your Appwrite project have not been tested. No existing cloud data has been changed.

## Operations and recovery

Learning documents use the student's account ID. Documents prefixed `use` store daily allowances; documents prefixed `lock` serialize updates so two tabs cannot overwrite progress. Locks are removed after each request. If Appwrite forcibly stops a function, an administrator should confirm that its execution has ended before deleting that student's stale `lock` document. Never remove an active lock. The lock's `state` includes its user ID and start time.

If a client loses the response after a successful save, retrying the same action reuses its request ID. Reloading always retrieves server-saved progress. A stale browser receives a message to reload before continuing. AI failures preserve saved learning progress but consume the reserved AI allowance.

For a fresh subject during the pilot, an administrator may back up and remove that student's learning document after the student requests a reset. There is no in-app profile reset yet.

## Files changed

- `src/components/AiTeacher.jsx` and `AiTeacher.css`: learning interface.
- `src/App.jsx` and `src/lib/appwrite.js`: navigation and function client.
- `functions/mahei-ai-teacher`: private persistence, AI generation, quizzes and progression.
- `.env.example`, `appwrite.config.json`, `package.json`: configuration and test command.
- `scripts/setup-teacher-storage.mjs`, `tests/teacher.test.js`: setup helper and regression checks.

## API reference

The function accepts POST requests with `action`: `load`, `setup`, `chat`, `quiz`, or `grade`. Mutations include `requestId` and `revision`. Setup sends `profile`; chat sends `message`; grading sends `quizId` and a zero-based `answers` array. Responses contain `{ success, state }`, or `{ success: false, error }` with an appropriate HTTP status. The user ID is derived from Appwrite's authenticated request headers, never from the request body.

Reference documentation: [Appwrite function development](https://appwrite.io/docs/products/functions/develop), [Groq structured outputs](https://console.groq.com/docs/structured-outputs).

## Roadmap XP

Finishing every topic of a roadmap awards **20 XP once per subject session**. The XP is added to the same monthly `user_monthly_stats` row that focus sessions use, so it appears on the in-app Leaderboard.

- No new variables or scopes are needed. The function uses its existing `documents.read` / `documents.write` scopes and the `TEACHER_DATABASE_ID` database. Optionally set `APPWRITE_USER_MONTHLY_STATS_COLLECTION_ID` if your stats collection is not called `user_monthly_stats`.
- A private claim document (`rmxp…`) is created in the teacher collection before XP is added, so retries can never award the same roadmap twice.
- If the XP write fails, the lesson still completes and the student is told the bonus could not be added.
