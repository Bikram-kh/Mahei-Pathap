import React, { useState } from "react";
import { LiveKitRoom, PreJoin, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { studyGroupsRequest } from "../../lib/studyGroups";
import "./GroupProviders.css";

export default function GroupVideoSession({ groupId, call, userName, isOwner, onClose, onCallChanged }) {
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const join = async (choices) => {
    setBusy(true); setError("");
    try {
      const result = await studyGroupsRequest("joinCall", { groupId, callId: call?.$id });
      if (!result.token || !result.serverUrl) throw new Error("Video sessions are not configured yet. Please contact the group owner.");
      setConnection({ ...result, choices });
    } catch (err) { setError(err.message || "Unable to join this session. Try again."); }
    finally { setBusy(false); }
  };
  const end = async () => {
    setBusy(true); setError("");
    try {
      await studyGroupsRequest("endCall", { groupId });
      setConnection(null); onCallChanged?.(); onClose?.();
    } catch (err) { setError(err.message || "Unable to end the session."); }
    finally { setBusy(false); }
  };
  return <section className="group-video-session" aria-label="Study video session">
    <div className="group-provider-heading"><h3>Study session</h3><button type="button" onClick={onClose}>Close / leave</button></div>
    <p>Up to 8 participants. Group chat stays available below. This session is not recorded.</p>
    {error && <p role="alert" className="group-provider-error">{error}</p>}
    {!connection ? <div data-lk-theme="default" className="group-call-preview">
      <p>Check your camera and microphone before joining. You can also join with both off.</p>
      {busy ? <p role="status">Joining session…</p> : <PreJoin defaults={{ username: userName || "Student", videoEnabled: false, audioEnabled: false }} persistUserChoices={false} onSubmit={join} onError={(err) => setError(`Device preview unavailable: ${err.message}. You can join with the camera and microphone off.`)} joinLabel="Join study session" />}
    </div> : <LiveKitRoom token={connection.token} serverUrl={connection.serverUrl}
      connect audio={connection.choices.audioEnabled ? { deviceId: connection.choices.audioDeviceId } : false}
      video={connection.choices.videoEnabled ? { deviceId: connection.choices.videoDeviceId } : false}
      data-lk-theme="default" className="group-livekit-room"
      onError={(err) => setError(err.message || "The call connection failed. Leave and rejoin to try again.")}
      onDisconnected={() => { setConnection(null); setError("You have left the session, or the owner ended it. Refresh the group to check its status."); onCallChanged?.(); }}>
      <VideoConference />
    </LiveKitRoom>}
    {isOwner && <div className="group-end-call">
      {!confirmEnd ? <button type="button" disabled={busy} onClick={() => setConfirmEnd(true)}>End session for everyone</button> : <><p>End this study session for all participants?</p><button type="button" disabled={busy} onClick={end}>Yes, end session</button><button type="button" disabled={busy} onClick={() => setConfirmEnd(false)}>Keep session open</button></>}
    </div>}
  </section>;
}
