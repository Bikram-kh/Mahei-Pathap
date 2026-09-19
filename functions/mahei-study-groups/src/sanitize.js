import sanitizeHtml from 'sanitize-html';
import { fail } from './policy.js';

const MAX_IMPORT_LENGTH = 100000;
const RICH_PREFIX = 'mahei-rich-v1:';

const escapeHtml = (text) => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

// Loaded lazily by the handler: only note copies need the HTML sanitiser.
export function sanitizeImportedNote(content) {
  const value = String(content || '');
  if (value.length > MAX_IMPORT_LENGTH) fail('The imported note is too long.');
  const html = value.startsWith(RICH_PREFIX)
    ? value.slice(RICH_PREFIX.length)
    : `<p>${escapeHtml(value).replace(/\r?\n/g, '<br />')}</p>`;
  return sanitizeHtml(html, {
    allowedTags: ['p', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'blockquote', 'mark', 'a', 'br'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['https', 'http'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attribs) => ({ tagName: 'a', attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
    },
  });
}
