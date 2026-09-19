# Study Groups Setup

Private groups of up to 20 students with chat, shared notes (live co-editing or PDF) and video study sessions of up to 8 people. Design and rules are in [`Group study.md`](Group%20study.md).

Everything the browser does goes through one Appwrite Function, `mahei-study-groups`. The function reads the signed-in user from Appwrite (never from the request), checks group membership and ownership on every action, and only then talks to Appwrite, Liveblocks or LiveKit.

## What is built

| Part | Where |
| --- | --- |
| Study Groups page, chat, notes, members, invitations | `src/components/StudyGroupsPage.jsx`, `src/components/groups/` |
| Invitation link kept through sign-in | `src/lib/groupInvitation.js` |
| Backend function (22 actions) | `functions/mahei-study-groups/src/` |
| One-time provisioning script | `scripts/setup-study-groups.mjs` |
| Tests (fake Appwrite and providers) | `tests/study-groups-*.test.js`, `tests/helpers/study-groups-fakes.js` |

Function actions: `createGroup`, `listGroups`, `getGroup`, `removeMember`, `leaveGroup`, `transferOwnership`, `archiveGroup`, `createInvite`, `revokeInvite`, `previewInvite`, `joinGroup`, `sendMessage`, `listMessages`, `deleteMessage`, `createNote`, `deleteNote`, `preparePdf`, `finalizePdf`, `liveblocksAuth`, `startCall`, `joinCall`, `endCall`.

## Accounts you need

- **Liveblocks** (live note editing): create a project and copy its **secret key**.
- **LiveKit Cloud** (video): create a project and copy the **WebSocket URL**, **API key** and **API secret**.

Until these are set the app shows "not configured yet" messages for notes and video. Chat, invitations and PDFs work without them.

## 1. Create the Appwrite resources

Log in with the Appwrite CLI, link the project, then run (this only adds resources and skips ones that already exist):

```bash
APPWRITE_DATABASE_ID=<your database id> node scripts/setup-study-groups.mjs
```

It creates seven collections (`study-groups`, `study-group-members`, `study-group-messages`, `study-group-invites`, `study-group-notes`, `study-group-calls`, `study-group-internal`), the `study-group-files` bucket (PDF only, 25 MB, create-only for users) and the function.

Every collection stores `groupId`, `userId`, `payload` (JSON text) and `createdAt`, has document security on and no collection-level permissions. Invitations and internal records have no read permission at all, so only the function can see them. Everything else is readable only by the group's Appwrite team.

## 2. Function variables

| Variable | Value |
| --- | --- |
| `APPWRITE_DATABASE_ID` | Your database id |
| `APPWRITE_NOTES_COLLECTION_ID` | The id of the personal **Notes** collection (used to copy a personal note into a group) |
| `LIVEBLOCKS_SECRET_KEY` | Liveblocks secret key |
| `LIVEKIT_URL` | LiveKit WebSocket URL, e.g. `wss://your-project.livekit.cloud` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit credentials |
| `STUDY_GROUP_FILES_BUCKET_ID` | Optional, defaults to `study-group-files` |

Never put these in the browser build. `APPWRITE_FUNCTION_API_ENDPOINT`, `APPWRITE_FUNCTION_PROJECT_ID` and the function key are supplied by Appwrite.

The frontend needs no new variables. `VITE_APPWRITE_STUDY_GROUPS_FUNCTION_ID` and `VITE_APPWRITE_GROUP_FILES_BUCKET_ID` are optional overrides.

## 3. Deploy the function

Deploy only `mahei-study-groups` (its `package.json` installs the LiveKit, Liveblocks, Tiptap and sanitiser packages at build time):

```bash
appwrite functions create-deployment --function-id mahei-study-groups --code functions/mahei-study-groups --activate true
```

## Access rules the function enforces

- Non-members always get "Group not found", so group ids cannot be probed.
- Only the owner can create or revoke invitations, remove members, transfer ownership, archive, and start or end video sessions.
- Invitations are random 256-bit tokens that expire after 7 days. Only a hash is stored, and the token is shown once, to the owner. Joining is explicit and idempotent, and a full (20) or archived group refuses new members.
- Removing a member, or a member leaving, revokes their team membership, rotates every shared-note room so open editors are disconnected, and removes them from any active call.
- Archiving ends the call, makes shared notes read-only and blocks new messages, notes, invitations and calls.
- PDFs are uploaded by the browser to a create-only bucket, then the function checks the size and the `%PDF-` header before sharing the file with the group's team. Anything else is deleted.
- Copied personal notes are sanitised on the server. Paid Notes Store files are never copied.
- Messages, groups, invitations, notes and PDFs are rate limited per person. Unexpected errors are logged for you and shown to students as a generic message.

## Testing

Run the tests on **Node 22 or newer**, like the Appwrite runtime (`node-26`). Node 18 cannot load the HTML sanitiser, so `tests/study-groups-sanitize.test.js` fails there; every other test passes.

```bash
npx -y node@22 --test tests/*.test.js
```

## Not yet verified against the real services

The tests use in-memory fakes, so these need a check with real accounts before you switch the feature on for everyone (see the rollout notes in `Group study.md`):

- Two accounts chatting and reconnecting, and one account receiving realtime updates.
- Adding a member to a team with the function key (it should be confirmed automatically).
- Live co-editing with two accounts, and Liveblocks room rotation when a member is removed.
- A LiveKit call with 8 people, screen sharing, and the owner ending it.
- A PDF upload from the browser into the create-only bucket.
