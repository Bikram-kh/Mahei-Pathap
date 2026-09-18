import React from "react";
import { isRichNoteContent, RICH_NOTE_PREFIX, sanitizeNoteHtml } from "../lib/noteContent";

export default function NoteContent({ content }) {
  if (!isRichNoteContent(content)) return <p className="note-plain-content">{content}</p>;
  const html = sanitizeNoteHtml(content.slice(RICH_NOTE_PREFIX.length));
  return <div className="note-rich-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
