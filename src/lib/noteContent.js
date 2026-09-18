import DOMPurify from "dompurify";

export const RICH_NOTE_PREFIX = "mahei-rich-v1:";
export const MAX_NOTE_CONTENT_LENGTH = 5000;

const ALLOWED_TAGS = [
  "p", "h2", "h3", "strong", "em", "ul", "ol", "li", "blockquote", "mark", "a", "br",
];

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export function isRichNoteContent(content) {
  return typeof content === "string" && content.startsWith(RICH_NOTE_PREFIX);
}

export function sanitizeNoteHtml(html) {
  const purifier = typeof DOMPurify?.sanitize === "function"
    ? DOMPurify
    : typeof window !== "undefined" && typeof DOMPurify === "function"
      ? DOMPurify(window)
      : null;
  if (!purifier) {
    return String(html || "");
  }

  const clean = purifier.sanitize(String(html || ""), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });

  const wrapper = document.createElement("div");
  wrapper.innerHTML = clean;
  wrapper.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!/^https?:\/\//i.test(href)) {
      link.replaceWith(...link.childNodes);
      return;
    }
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
  return wrapper.innerHTML;
}

export function decodeNoteToHtml(content) {
  if (isRichNoteContent(content)) {
    return sanitizeNoteHtml(content.slice(RICH_NOTE_PREFIX.length));
  }
  const escaped = escapeHtml(content);
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>") || "<br>"}</p>`)
    .join("");
}

export function noteHtmlToPlainText(html) {
  const clean = sanitizeNoteHtml(html);
  if (typeof document !== "undefined") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = clean
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h2|h3|li|blockquote)>/gi, "</$1>\n");
    return (wrapper.textContent || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  return clean.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>|<\/h[23]>|<\/li>|<\/blockquote>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

export function noteContentToPlainText(content) {
  return isRichNoteContent(content)
    ? noteHtmlToPlainText(content.slice(RICH_NOTE_PREFIX.length))
    : String(content || "").trim();
}

export function encodeRichNote(html) {
  return `${RICH_NOTE_PREFIX}${sanitizeNoteHtml(html)}`;
}
