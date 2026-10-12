import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, Send, Sparkles, X } from "lucide-react";
import AiResponse from "./AiResponse.jsx";
import "./AssistantLauncher.css";

/**
 * Floating Mahei Assistance button with a compact chat panel.
 * Presentational: the conversation state and send logic live in App and are
 * shared with the full Mahei Assistance page. This component only owns whether
 * the panel is open.
 */
export default function AssistantLauncher({
  message,
  reply,
  submittedMessage,
  loading,
  error,
  quickPrompts,
  onMessageChange,
  onSend,
  onKeyDown,
  onQuickPrompt,
  onClear,
  onOpenFullPage,
}) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const panelId = useId();
  const toggleRef = useRef(null);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const wasOpenRef = useRef(false);
  const lastReplyRef = useRef(reply);

  // Flag a reply that arrived while the panel was closed.
  useEffect(() => {
    if (reply && reply !== lastReplyRef.current && !open) setHasUnread(true);
    lastReplyRef.current = reply;
  }, [reply, open]);

  // Move focus into the panel on open, and back to the button on close.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    const body = bodyRef.current;
    if (open && body) body.scrollTop = body.scrollHeight;
  }, [open, reply, submittedMessage, loading, error]);

  function togglePanel() {
    setOpen((current) => !current);
    setHasUnread(false);
  }

  function handlePanelKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
    }
  }

  const canSend = !loading && message.trim().length > 0;
  const hasConversation = Boolean(submittedMessage);

  return (
    <>
      {open && (
        <section
          id={panelId}
          className="asst-panel"
          role="dialog"
          aria-label="Mahei Assistance"
          onKeyDown={handlePanelKeyDown}
        >
          <header className="asst-header">
            <div className="asst-title">
              <span className="asst-title-icon">
                <Sparkles size={16} aria-hidden="true" />
              </span>
              <strong>Mahei Assistance</strong>
            </div>

            <div className="asst-header-actions">
              {(reply || submittedMessage) && (
                <button type="button" className="asst-text-button" onClick={onClear}>
                  New chat
                </button>
              )}
              <button
                type="button"
                className="asst-icon-button"
                aria-label="Open full page"
                title="Open full page"
                onClick={onOpenFullPage}
              >
                <Maximize2 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="asst-icon-button"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="asst-body" ref={bodyRef}>
            {!hasConversation && (
              <div className="asst-empty">
                <p>Ask me to plan your day, add a task, or explain a topic.</p>
                <span className="asst-label">Try asking</span>
                <div className="asst-chips">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="asst-chip"
                      disabled={loading}
                      onClick={() => onQuickPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasConversation && <div className="asst-bubble asst-bubble-user">{submittedMessage}</div>}

            {loading && (
              <div className="asst-thinking" role="status">
                Thinking...
              </div>
            )}

            {!loading && reply && (
              <div className="asst-bubble asst-bubble-reply">
                <AiResponse>{reply}</AiResponse>
              </div>
            )}

            {error && (
              <p className="asst-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="asst-footer">
            <div className="asst-composer">
              <label className="asst-sr-only" htmlFor={`${panelId}-message`}>
                Message Mahei Assistance
              </label>
              <textarea
                id={`${panelId}-message`}
                ref={inputRef}
                rows={2}
                value={message}
                placeholder="Ask Mahei anything..."
                onChange={(event) => onMessageChange(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className="asst-send"
                aria-label="Send message"
                disabled={!canSend}
                onClick={onSend}
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
            <span className="asst-hint">Ctrl+Enter to send</span>
          </div>
        </section>
      )}

      <button
        type="button"
        ref={toggleRef}
        className="asst-fab"
        aria-label={open ? "Close Mahei Assistance" : "Open Mahei Assistance"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={togglePanel}
      >
        {open ? <X size={24} aria-hidden="true" /> : <Sparkles size={24} aria-hidden="true" />}
        {hasUnread && <span className="asst-dot" aria-hidden="true" />}
      </button>
    </>
  );
}
