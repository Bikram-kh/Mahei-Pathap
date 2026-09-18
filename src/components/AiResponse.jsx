import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkLineBreaks } from '../lib/aiFormatting.js';
import './AiResponse.css';

const plugins = [remarkGfm, remarkLineBreaks];
const components = {
  h1: ({ children }) => <h4>{children}</h4>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h4>{children}</h4>,
  h5: ({ children }) => <h4>{children}</h4>,
  h6: ({ children }) => <h4>{children}</h4>,
  table: ({ children }) => <div className="ai-response-table" role="region" aria-label="Comparison table" tabIndex={0}><table>{children}</table></div>,
  a: ({ children, href }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
};

export default function AiResponse({ children }) {
  return <div className="ai-response"><Markdown remarkPlugins={plugins} components={components} skipHtml disallowedElements={['img']}>{String(children || '')}</Markdown></div>;
}
