# Focus XP and Leaderboard Function

This Appwrite Node.js Function (originally named `mahei-discord-integration`; the name and ID are kept so existing deployments keep working) handles three actions:

- `start_focus` and `complete_focus`: trusted 25-minute focus sessions. The server records its own start and completion times and awards 10 XP only after at least 25 measured minutes.
- `get_leaderboard`: the monthly ranking shown on the in-app Leaderboard page.

Full setup (collections, scopes, variables, XP rules and privacy) is in [`FOCUS_XP_SETUP.md`](../../FOCUS_XP_SETUP.md).

## Function configuration

- Runtime: Node.js 20 or newer
- Entrypoint: `src/main.js`
- Build command: none
- Execute access: authenticated users only
- Dynamic-key scopes: `documents.read`, `documents.write`, `databases.read`, `databases.write` and `users.read`

`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are injected by Appwrite. Do not create them manually.
