import React, { useEffect, useState } from "react";
import {
  Building2,
  Clock3,
  GraduationCap,
  Languages,
  Mail,
  Pencil,
  Save,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  normalizeStudentProfile,
  STUDENT_AVATARS,
  STUDENT_LANGUAGES,
} from "../lib/studentProfile";
import "./ProfilePage.css";

export default function ProfilePage({ profile, email, onSave }) {
  const [draft, setDraft] = useState(profile);
  const [editing, setEditing] = useState(
    () => !profile.level && !profile.school && !profile.bio,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setDraft(profile), [profile]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    const normalized = normalizeStudentProfile(draft, profile.name);
    if (!normalized.name) {
      setError("Enter your name before saving your profile.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(normalized);
      setDraft(normalized);
      setEditing(false);
      setMessage("Your profile has been saved.");
    } catch (saveError) {
      setError(saveError.message || "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setDraft(profile);
    setEditing(false);
    setError("");
  }

  return (
    <div className="profile-page page-stack">
      <section className="profile-hero card">
        <div className="profile-avatar-large" aria-hidden="true">
          {profile.avatar}
        </div>
        <div className="profile-hero-copy">
          <span className="section-label"><Sparkles size={13} /> Student profile</span>
          <h3>{profile.name || "Mahei-Pathap student"}</h3>
          <p>{profile.bio || "Add a few details so Mahei can make your study support more personal."}</p>
          <div className="profile-summary-chips">
            {profile.level && <span><GraduationCap size={14} />{profile.level}</span>}
            {profile.language && <span><Languages size={14} />{profile.language}</span>}
            <span><Clock3 size={14} />{profile.dailyMinutes} minutes daily</span>
          </div>
        </div>
        {!editing && (
          <button className="dark-button" type="button" onClick={() => { setEditing(true); setMessage(""); }}>
            <Pencil size={15} /> Edit profile
          </button>
        )}
      </section>

      {editing ? (
        <form className="profile-form card" onSubmit={submit}>
          <div className="profile-form-heading">
            <div>
              <span className="section-label">Personalize your workspace</span>
              <h3>Your details</h3>
            </div>
            <button type="button" className="icon-button" aria-label="Cancel editing" onClick={cancelEditing}>
              <X size={18} />
            </button>
          </div>

          <fieldset className="profile-avatar-picker">
            <legend>Choose an avatar</legend>
            <div>
              {STUDENT_AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  className={draft.avatar === avatar ? "selected" : ""}
                  aria-label={`Use ${avatar} avatar`}
                  aria-pressed={draft.avatar === avatar}
                  onClick={() => update("avatar", avatar)}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="profile-fields">
            <label className="field-group">
              <span><User size={14} /> Display name</span>
              <input required maxLength={128} value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label className="field-group">
              <span><Mail size={14} /> Email</span>
              <input value={email || "Local profile"} readOnly disabled />
            </label>
            <label className="field-group">
              <span><GraduationCap size={14} /> Class or learning level</span>
              <input maxLength={80} value={draft.level} placeholder="Example: Class 10" onChange={(event) => update("level", event.target.value)} />
            </label>
            <label className="field-group">
              <span><Building2 size={14} /> School or institution</span>
              <input maxLength={160} value={draft.school} placeholder="Optional" onChange={(event) => update("school", event.target.value)} />
            </label>
            <label className="field-group">
              <span><Languages size={14} /> Preferred language</span>
              <select value={draft.language} onChange={(event) => update("language", event.target.value)}>
                {STUDENT_LANGUAGES.map((language) => <option key={language}>{language}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span><Clock3 size={14} /> Daily study target</span>
              <select value={draft.dailyMinutes} onChange={(event) => update("dailyMinutes", Number(event.target.value))}>
                {[15, 25, 30, 45, 60, 90, 120, 180].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </label>
            <label className="field-group profile-bio-field">
              <span>Short bio</span>
              <textarea maxLength={500} rows={5} value={draft.bio} placeholder="Tell Mahei what you are studying or working toward." onChange={(event) => update("bio", event.target.value)} />
              <small>{draft.bio.length}/500 characters</small>
            </label>
          </div>

          {error && <p className="profile-form-error" role="alert">{error}</p>}
          <div className="profile-form-actions">
            <button type="button" className="secondary-button" onClick={cancelEditing}>Cancel</button>
            <button className="primary-button orange" disabled={saving}>
              <Save size={15} /> {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      ) : (
        <section className="profile-details card">
          <div><span>Class or level</span><strong>{profile.level || "Not added"}</strong></div>
          <div><span>School</span><strong>{profile.school || "Not added"}</strong></div>
          <div><span>Preferred language</span><strong>{profile.language}</strong></div>
          <div><span>Daily study target</span><strong>{profile.dailyMinutes} minutes</strong></div>
        </section>
      )}

      {message && <p className="profile-save-message" role="status">{message}</p>}
    </div>
  );
}
