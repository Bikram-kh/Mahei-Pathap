import React from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold, Italic, List, ListOrdered, Quote, Highlighter, Link2, Unlink,
  Undo2, Redo2,
} from "lucide-react";
import { MAX_NOTE_CONTENT_LENGTH, sanitizeNoteHtml } from "../lib/noteContent";
import "./RichTextEditor.css";

function ToolbarButton({ active = false, disabled = false, label, onClick, children }) {
  return <button type="button" className={active ? "is-active" : ""} disabled={disabled} aria-label={label} aria-pressed={active} title={label} onClick={onClick}>{children}</button>;
}

export default function RichTextEditor({ value, onChange, disabled = false }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https"],
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        validate: href => /^https?:\/\//i.test(href),
      }),
      Highlight,
      Placeholder.configure({ placeholder: "Write down your thoughts…" }),
      CharacterCount,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => onChange(sanitizeNoteHtml(currentEditor.getHTML())),
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor ? ({
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      bulletList: currentEditor.isActive("bulletList"),
      orderedList: currentEditor.isActive("orderedList"),
      blockquote: currentEditor.isActive("blockquote"),
      highlight: currentEditor.isActive("highlight"),
      link: currentEditor.isActive("link"),
      paragraph: currentEditor.isActive("paragraph"),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      heading3: currentEditor.isActive("heading", { level: 3 }),
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
      characters: currentEditor.storage.characterCount.characters(),
    }) : null,
  });

  if (!editor || !editorState) return <div className="rich-editor-loading">Opening editor…</div>;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "https://";
    const url = window.prompt("Enter a full link beginning with http:// or https://", previousUrl);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert("Please enter a link beginning with http:// or https://");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const format = editorState.heading2 ? "heading2" : editorState.heading3 ? "heading3" : "paragraph";

  return <div className="rich-editor" aria-label="Note editor">
    <div className="rich-editor-toolbar" role="toolbar" aria-label="Text formatting">
      <select aria-label="Text style" title="Text style" value={format} disabled={disabled} onChange={event => {
        const chain = editor.chain().focus();
        if (event.target.value === "heading2") chain.toggleHeading({ level: 2 }).run();
        else if (event.target.value === "heading3") chain.toggleHeading({ level: 3 }).run();
        else chain.setParagraph().run();
      }}>
        <option value="paragraph">Paragraph</option>
        <option value="heading2">Heading</option>
        <option value="heading3">Subheading</option>
      </select>
      <span className="rich-editor-divider" aria-hidden="true" />
      <ToolbarButton label="Bold" active={editorState.bold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></ToolbarButton>
      <ToolbarButton label="Italic" active={editorState.italic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></ToolbarButton>
      <ToolbarButton label="Highlight" active={editorState.highlight} disabled={disabled} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={17} /></ToolbarButton>
      <span className="rich-editor-divider" aria-hidden="true" />
      <ToolbarButton label="Bullet list" active={editorState.bulletList} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={17} /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={editorState.orderedList} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></ToolbarButton>
      <ToolbarButton label="Blockquote" active={editorState.blockquote} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={17} /></ToolbarButton>
      <span className="rich-editor-divider" aria-hidden="true" />
      <ToolbarButton label="Add or edit link" active={editorState.link} disabled={disabled} onClick={setLink}><Link2 size={17} /></ToolbarButton>
      <ToolbarButton label="Remove link" disabled={disabled || !editorState.link} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink size={17} /></ToolbarButton>
      <span className="rich-editor-divider" aria-hidden="true" />
      <ToolbarButton label="Undo" disabled={disabled || !editorState.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></ToolbarButton>
      <ToolbarButton label="Redo" disabled={disabled || !editorState.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></ToolbarButton>
    </div>
    <EditorContent editor={editor} />
    <div className="rich-editor-count" aria-live="polite">{editorState.characters.toLocaleString()} characters · formatted content limit {MAX_NOTE_CONTENT_LENGTH.toLocaleString()}</div>
  </div>;
}
