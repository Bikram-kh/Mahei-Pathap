const KEY = 'mahei.pendingGroupInvitation.v1';
const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);

// Keep the capability in this tab through login/OAuth; never join automatically.
export function captureGroupInvitation(href, storage) {
  let incoming = '';
  try { incoming = new URL(href).searchParams.get('groupInvite') || ''; } catch { /* no URL */ }
  try {
    if (validToken(incoming)) storage?.setItem(KEY, incoming);
    const pending = storage?.getItem(KEY);
    return validToken(incoming) ? incoming : validToken(pending) ? pending : '';
  } catch { return validToken(incoming) ? incoming : ''; }
}
export function clearGroupInvitation(storage) {
  try { storage?.removeItem(KEY); } catch { /* storage unavailable */ }
}
