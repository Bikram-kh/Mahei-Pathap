import React, { useCallback, useEffect, useState } from "react";
import { LiveblocksProvider, RoomProvider, useStatus, useSyncStatus, useOthers, useSelf, useErrorListener } from "@liveblocks/react";
import { useLiveblocksExtension, useIsEditorReady } from "@liveblocks/react-tiptap";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Quote, Highlighter, Link2, Unlink, Undo2, Redo2 } from "lucide-react";
import { studyGroupsRequest } from "../../lib/studyGroups";
import { sanitizeNoteHtml } from "../../lib/noteContent";
import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-tiptap/styles.css";
import "../RichTextEditor.css";
import "./GroupProviders.css";

function CollaborativeEditor({ readOnly }) {
  const status = useStatus();
  const sync = useSyncStatus();
  const others = useOthers();
  const self = useSelf();
  const ready = useIsEditorReady();
  const [error, setError] = useState("");
  useErrorListener(event => setError(event.message || "Collaboration connection failed. Close and reopen this note to try again."));
  const liveblocks = useLiveblocksExtension({ field: "default", comments: false, mentions: false, ai: false });
  const editable = !readOnly && ready && status === "connected" && self?.canWrite !== false;
  const editor = useEditor({
    extensions: [liveblocks, StarterKit.configure({ undoRedo: false, link: false, heading: { levels: [2, 3] }, codeBlock: false, code: false, horizontalRule: false }),
      Link.configure({ openOnClick: false, protocols: ["http", "https"], defaultProtocol: "https", HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" }, isAllowedUri: url => /^https?:\/\//i.test(url) }),
      Highlight, Placeholder.configure({ placeholder: "Write your group's study notes…" })],
    immediatelyRender: false,
    editable: false,
    editorProps: { transformPastedHTML: sanitizeNoteHtml },
  });
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  const state = useEditorState({ editor, selector: ({ editor: e }) => e ? {
    format: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
    marks: ["bold", "italic", "bulletList", "orderedList", "blockquote", "highlight", "link"].filter(mark => e.isActive(mark)),
    undo: e.can().undo(), redo: e.can().redo(),
  } : null });
  const setLink = () => {
    const input = window.prompt("Enter a link beginning with https:// or http://", editor.getAttributes("link").href || "https://");
    if (input === null) return;
    if (!input.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    if (!/^https?:\/\//i.test(input.trim())) { setError("Links must begin with https:// or http://."); return; }
    setError(""); editor.chain().focus().extendMarkRange("link").setLink({ href: input.trim() }).run();
  };
  const button = (label, mark, Icon, command, disabled = false) => <button type="button" key={label} title={label} aria-label={label} aria-pressed={Boolean(mark && state?.marks.includes(mark))} className={state?.marks.includes(mark) ? "is-active" : ""} disabled={!editable || disabled} onClick={command}><Icon size={17} /></button>;
  return <>
    <p className="group-collaboration-status" role="status">{status !== "connected" ? `${status === "reconnecting" ? "Reconnecting" : "Connecting"}… Editing resumes when connected.` : !ready ? "Loading shared document…" : readOnly ? "Archived group · read only" : sync === "synchronized" ? "All changes saved" : "Saving changes…"}</p>
    {error && <p role="alert" className="group-provider-error">{error}</p>}
    <div className="group-collaborators" aria-label="People editing this note">{self && <span>{self.info?.name || "You"} (you)</span>}{others.map(person => <span key={person.connectionId}>{person.info?.name || "Group member"}</span>)}</div>
    <div className="rich-editor" aria-label="Collaborative note editor">
      {editor && state && <div className="rich-editor-toolbar" role="toolbar" aria-label="Text formatting">
        <select aria-label="Text style" value={state.format} disabled={!editable} onChange={event => { const chain = editor.chain().focus(); event.target.value === "p" ? chain.setParagraph().run() : chain.setHeading({ level: event.target.value === "h2" ? 2 : 3 }).run(); }}><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>
        {button("Bold", "bold", Bold, () => editor.chain().focus().toggleBold().run())}
        {button("Italic", "italic", Italic, () => editor.chain().focus().toggleItalic().run())}
        {button("Highlight", "highlight", Highlighter, () => editor.chain().focus().toggleHighlight().run())}
        {button("Bullet list", "bulletList", List, () => editor.chain().focus().toggleBulletList().run())}
        {button("Numbered list", "orderedList", ListOrdered, () => editor.chain().focus().toggleOrderedList().run())}
        {button("Blockquote", "blockquote", Quote, () => editor.chain().focus().toggleBlockquote().run())}
        {button("Add or edit link", "link", Link2, setLink)}
        {button("Remove link", null, Unlink, () => editor.chain().focus().unsetLink().run(), !state.marks.includes("link"))}
        {button("Undo", null, Undo2, () => editor.chain().focus().undo().run(), !state.undo)}
        {button("Redo", null, Redo2, () => editor.chain().focus().redo().run(), !state.redo)}
      </div>}
      <EditorContent editor={editor} />
    </div>
  </>;
}

export default function GroupCollaborativeNote({ groupId, note, readOnly = false, onClose }) {
  const [authError, setAuthError] = useState("");
  const authenticate = useCallback(async room => {
    try {
      const result = await studyGroupsRequest("liveblocksAuth", { groupId, noteId: note.$id, room });
      const authorization = result.authorization || result;
      if (!authorization.token) throw new Error("Collaborative notes are not configured yet.");
      return authorization;
    } catch (err) { setAuthError(err.message || "Unable to open this shared note."); throw err; }
  }, [groupId, note.$id, note.roomId]);
  return <section className="group-collaborative-note" aria-label="Shared note">
    <div className="group-provider-heading"><h3>{note.title}</h3><button type="button" onClick={onClose}>Close note</button></div>
    {authError ? <p className="group-provider-error" role="alert">{authError}</p> : !note.roomId ? <p role="status">This shared note is not ready. Close it and refresh the group.</p> : <LiveblocksProvider key={note.roomId} authEndpoint={authenticate} preventUnsavedChanges>
      <RoomProvider id={note.roomId} initialPresence={{}}><CollaborativeEditor readOnly={readOnly} /></RoomProvider>
    </LiveblocksProvider>}
  </section>;
}
