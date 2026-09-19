# Study Groups for Mahei-Pathap

## Summary

Add a **Study Groups** page where students create private groups, invite friends, chat, edit shared notes together, and join video study sessions.

Confirmed choices:

- Up to **20 members** per group.
- Invitations through shareable links.
- Video calls inside Mahei, with up to **8 participants**.
- Only the group owner can start or end calls.
- Simultaneous note editing using a managed service.

Use Appwrite for membership, chat, and files; **LiveKit Cloud** for calls; and **Liveblocks** with the existing Tiptap editor for collaborative notes.

## Student experience

### Groups and invitations

- Add **Study Groups** to the sidebar, with **Create group** and **Join group** actions.
- Creation asks for a group name, optional subject, and description.
- Each group has **Chat**, **Notes**, and **Members** tabs.
- The owner generates, copies, and revokes invitation links. Links expire after seven days.
- Friends open the link, sign in or register, review the group name, and explicitly join.
- Preserve the invitation through authentication. Handle expired links, full groups, and existing membership clearly.
- Members can leave. The owner can remove members, transfer ownership, or archive the group.
- Archived groups remain readable but cannot accept new messages, edits, members, or calls.

### Group chat

- Deliver messages without refreshing, with sender name, timestamp, sending state, and retry on failure.
- Load recent messages first and paginate older history.
- Authors can delete their own messages; the owner can remove any message.
- Display shared-note cards and study-session announcements in the conversation.
- Reconnect and fetch missed messages without duplicates.

### Shared notes

- Members can create a collaborative note, share a copy of one of their personal notes, or upload a PDF up to 25 MB.
- Shared copies remain independent of personal notes.
- All current members can edit collaborative notes simultaneously, with collaborator names, cursors, and saving/reconnection status.
- Preserve the existing formatting toolbar and safe rendering.
- PDFs remain downloadable attachments, not collaboratively editable documents.
- Note creators and the group owner can delete shared notes with confirmation.
- Paid Notes Store files are not copied into groups through this feature.

### Video study sessions

- The owner selects **Start study session**; members see **Join session**.
- Show a camera/microphone preview before joining.
- Provide camera, microphone, participant grid, screen sharing, and leave controls.
- Keep group chat accessible during calls.
- Allow one active call per group. Enforce the eight-person limit server-side.
- Only the owner can end the call for everyone; members can leave individually.
- Handle denied device permissions, disconnects, full calls, and owner reconnection.
- No recording in the first release.

## Implementation and access control

- Create separate Appwrite resources for groups, messages, invitations, shared-note metadata, call sessions, and group files.
- Use one Appwrite team per group. Keep the existing platform-admin team separate.
- Add a `mahei-study-groups` function for membership changes, invitations, message mutations, note/file operations, and provider authorization.
- Derive identity from the authenticated Appwrite execution. Validate group membership and ownership on every protected action.
- Keep membership administration server-controlled. Scope document and file reads to the group’s team.
- Use Appwrite Realtime for chat and group updates; unsubscribe on logout or group switching.
- Store collaborative document content in Liveblocks and its group/title/author metadata in Appwrite. Avoid competing document copies in both systems.
- Issue room-specific Liveblocks authorization and short-lived LiveKit tokens only after membership checks.
- Removing a member must revoke access to files, chat, collaborative editing, and active calls—not merely hide the group.
- Validate uploads and sanitize imported note content. Add rate limits and duplicate-request protection for invitations and mutations.
- Lazy-load video and collaboration components so other pages retain their current loading performance.

## Verification and rollout

- Test invitations across sign-up, expiry, revocation, repeated joining, and capacity limits.
- Verify two accounts receive chat updates immediately and recover missed messages after reconnecting.
- Verify simultaneous note edits survive reloads without overwriting each other.
- Test unauthorized direct requests and removed-member access, including already-open editing and call sessions.
- Test call ownership, participant limits, screen sharing, device denial, and cleanup after leaving.
- Check desktop/mobile layouts, keyboard access, existing automated tests, and production build.
- Deploy resources and functions additively; preserve existing personal notes and study progress.

## Assumptions and setup

- Groups are private; there is no public directory.
- Owners share invitation links themselves; automated email invitations are excluded.
- AI Teacher and Mahei Assistance do not read private group conversations in this release.
- LiveKit Cloud and Liveblocks accounts and server-side credentials are required. Keep secrets out of browser configuration.
- Show explicit setup-unavailable states until these services are configured; do not present simulated calls or collaboration as working.
- Complete multi-account acceptance testing before enabling the feature for all users.

