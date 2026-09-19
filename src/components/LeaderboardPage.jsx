import React, { useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, Timer, Trophy } from "lucide-react";
import { formatFocusTime, leaderboardMonths, medalFor, monthTitle } from "../lib/leaderboard";
import "./LeaderboardPage.css";

const sessionsLabel = (count) => `${count} session${count === 1 ? "" : "s"}`;

export default function LeaderboardPage({ onLoad, onSetAnonymous, onStartFocus }) {
  const months = useMemo(() => leaderboardMonths(), []);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const [board, setBoard] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const loadRef = useRef(onLoad);
  loadRef.current = onLoad;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    Promise.resolve(loadRef.current(monthKey))
      .then((result) => {
        if (cancelled) return;
        if (!result) return setStatus("unavailable");
        setBoard(result);
        setStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught?.message || "The leaderboard could not be loaded.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [monthKey, reloadTick]);

  async function changePrivacy(anonymous) {
    setSavingPrivacy(true);
    setError("");
    try {
      await onSetAnonymous(anonymous);
      setReloadTick((tick) => tick + 1);
    } catch (caught) {
      setError(caught?.message || "Your privacy setting could not be saved.");
    } finally {
      setSavingPrivacy(false);
    }
  }

  const isCurrentMonth = monthKey === months[0].key;
  const title = monthTitle(monthKey);

  return (
    <div className="leaderboard-page page-stack">
      <section className="leaderboard-hero card">
        <div className="leaderboard-hero-icon" aria-hidden="true"><Trophy size={30} /></div>
        <div className="leaderboard-hero-copy">
          <span className="section-label">Monthly focus ranking</span>
          <h3>Leaderboard</h3>
          <p>Earn 10 XP for every verified 25-minute focus session and 20 XP for completing an AI Teacher roadmap. Rankings reset each month.</p>
        </div>
        <div className="leaderboard-months" role="group" aria-label="Choose month">
          {months.map((month) => (
            <button
              key={month.key}
              type="button"
              className={month.key === monthKey ? "active" : ""}
              aria-pressed={month.key === monthKey}
              onClick={() => setMonthKey(month.key)}
            >
              {month.label}
            </button>
          ))}
        </div>
      </section>

      {status === "loading" && <p className="leaderboard-status" role="status">Loading the {title} leaderboard…</p>}

      {status === "unavailable" && (
        <div className="empty-state" role="status">
          <span>🏆</span>
          <p>The leaderboard is not connected yet. Ask the administrator to finish the focus service setup.</p>
        </div>
      )}

      {error && (
        <div className="leaderboard-alert" role="alert">
          <span>{error}</span>
          {status === "error" && (
            <button type="button" className="small-button" onClick={() => setReloadTick((tick) => tick + 1)}>Try again</button>
          )}
        </div>
      )}

      {status === "ready" && board && (
        <>
          <section className="leaderboard-standing card" aria-labelledby="leaderboard-standing-title">
            <h4 id="leaderboard-standing-title">Your standing · {title}</h4>
            {board.you ? (
              <div className="leaderboard-stats">
                <div><strong>#{board.you.rank}</strong><span>of {board.totalParticipants} {board.totalParticipants === 1 ? "student" : "students"}</span></div>
                <div><strong>{board.you.xp}</strong><span>XP</span></div>
                <div><strong>{formatFocusTime(board.you.focusMinutes)}</strong><span>focused</span></div>
                <div><strong>{board.you.focusSessions}</strong><span>{board.you.focusSessions === 1 ? "session" : "sessions"}</span></div>
              </div>
            ) : (
              <div className="leaderboard-nostanding">
                <p>{isCurrentMonth ? "You have not completed a focus session this month yet." : `You did not complete a focus session in ${title}.`}</p>
                {isCurrentMonth && (
                  <button type="button" className="dark-button" onClick={onStartFocus}><Timer size={16} /> Start a focus session</button>
                )}
              </div>
            )}
            <label className="leaderboard-privacy">
              <input
                type="checkbox"
                checked={board.anonymous}
                disabled={savingPrivacy}
                onChange={(event) => changePrivacy(event.target.checked)}
              />
              <span><EyeOff size={14} aria-hidden="true" /> Show me as “Anonymous student” to others</span>
            </label>
          </section>

          {board.entries.length ? (
            <section className="card leaderboard-board">
              <ol className="leaderboard-list" aria-label={`Leaderboard for ${title}`}>
                {board.entries.map((entry, index) => (
                  <li key={`${entry.rank}-${index}`} className={entry.isYou ? "is-you" : ""}>
                    <span className={`leaderboard-rank ${medalFor(entry.rank) || ""}`}>{entry.rank}</span>
                    <span className="leaderboard-name">{entry.name}{entry.isYou && <em>You</em>}</span>
                    <span className="leaderboard-xp"><strong>{entry.xp}</strong> XP</span>
                    <span className="leaderboard-time">{formatFocusTime(entry.focusMinutes)} · {sessionsLabel(entry.focusSessions)}</span>
                  </li>
                ))}
              </ol>
              <p className="leaderboard-note">
                {board.totalParticipants > board.entries.length ? `Showing the top ${board.entries.length} of ${board.totalParticipants} students. ` : ""}
                Equal XP is ordered by focus time, and students with identical results share a rank.
              </p>
            </section>
          ) : (
            <div className="empty-state">
              <span>⏱️</span>
              <p>No focus sessions have been completed in {title} yet.{isCurrentMonth ? " Finish one to take the first place!" : ""}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
