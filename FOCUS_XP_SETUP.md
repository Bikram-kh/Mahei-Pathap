# Focus XP and Leaderboard Setup

Students earn XP from server-verified activity, and the in-app **Leaderboard** ranks them each month. The browser never grants XP itself: an Appwrite Function checks the activity and writes the totals.

## XP rules

| Activity | XP | Where it is checked |
| --- | --- | --- |
| A completed 25-minute focus session | 10 | `mahei-discord-integration` function (the server measures the elapsed time) |
| Finishing every topic of an AI Teacher roadmap | 20, once per subject session | `mahei-ai-teacher` function (see `AI_TEACHER_SETUP.md`) |

Both write to the same monthly row, so they add up. Rankings reset each calendar month (UTC).

## Collections (existing Appwrite database)

### `focus_sessions`

| Attribute | Type | Required | Purpose |
| --- | --- | --- | --- |
| `appwrite_user_id` | string (36) | yes | Session owner. |
| `subject` | string (256) | yes | Focus subject. |
| `started_at` | datetime | yes | Server-recorded start time. |
| `completed_at` | datetime | no | Server-recorded completion time. |
| `duration_minutes` | integer | yes | Validated duration. |
| `status` | string (24) | yes | `active`, `completed`, or `abandoned`. |
| `xp_awarded` | integer | yes | XP actually awarded for this session. |

Index `appwrite_user_id` and `completed_at`.

### `user_monthly_stats`

| Attribute | Type | Required | Purpose |
| --- | --- | --- | --- |
| `appwrite_user_id` | string (36) | yes | Appwrite user ID. |
| `month_key` | string (7) | yes | Calendar month in `YYYY-MM`. |
| `xp` | integer | yes | Total XP for the month. |
| `focus_minutes` | integer | yes | Total validated focus minutes. |
| `focus_sessions` | integer | yes | Total completed validated sessions. |
| `updated_at` | datetime | yes | Latest update time. |

Create a composite unique index for `appwrite_user_id` and `month_key`. Neither collection needs client-facing permissions; only the functions read and write them.

## Function: `mahei-discord-integration`

The function keeps its original name and ID so existing deployments and environment variables keep working. It handles three actions: `start_focus`, `complete_focus` and `get_leaderboard`.

- Runtime: Node.js 20 or newer. Entrypoint: `src/main.js`. Execute access: authenticated users only.
- Scopes: `documents.read`, `documents.write`, `databases.read`, `databases.write` and **`users.read`** (needed to show student names on the leaderboard; without it every name appears as "Student").

Function variables (not Vite variables):

```text
APPWRITE_DATABASE_ID=
APPWRITE_FOCUS_SESSIONS_COLLECTION_ID=focus_sessions
APPWRITE_USER_MONTHLY_STATS_COLLECTION_ID=user_monthly_stats
```

## Browser configuration

Add the function's ID to the webapp environment:

```text
VITE_APPWRITE_FOCUS_FUNCTION_ID=
```

The older name `VITE_APPWRITE_DISCORD_INTEGRATION_FUNCTION_ID` is still accepted, so existing deployments do not need to change. Never put a server API key in the Vite environment.

## Leaderboard privacy

- Other students see a name as "First L." (an email-style account name shows as "Student").
- Other students' account IDs are never sent to the browser.
- A student can choose to appear as "Anonymous student" from the Leaderboard page. The choice is saved in their account preferences (`leaderboardAnonymous`).
