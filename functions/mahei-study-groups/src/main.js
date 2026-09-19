import { createAppwrite } from './appwrite.js';
import { createStudyGroupsService } from './service.js';

const PROVIDER_METHODS = ['createNote', 'authorize', 'rotateNote', 'deleteNote', 'startCall', 'joinCall', 'endCall', 'removeParticipant'];

// Video and collaboration SDKs are heavy, so they load only when an action actually needs them.
function lazyProviders() {
  let loaded;
  const load = async () => {
    loaded ??= (await import('./providers.js')).createProviders();
    return loaded;
  };
  return Object.fromEntries(PROVIDER_METHODS.map((name) => [name, async (...args) => (await load())[name](...args)]));
}

const lazySanitize = async (content) => (await import('./sanitize.js')).sanitizeImportedNote(content);

function parseBody(req) {
  const body = req.bodyJson ?? (req.body ? JSON.parse(req.body) : {});
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Request body must be an object.');
  return body;
}

export function createHandler(deps = {}) {
  const providers = deps.providers ?? lazyProviders();
  return async ({ req, res, log = () => {}, error = () => {} }) => {
    const userId = req.headers?.['x-appwrite-user-id'];
    if (!userId) return res.json({ success: false, error: 'Sign in to use Study Groups.' }, 401);

    let body;
    try { body = parseBody(req); } catch { return res.json({ success: false, error: 'Send a JSON request body.' }, 400); }

    try {
      const service = createStudyGroupsService({
        db: deps.db ?? createAppwrite(req), providers, sanitize: deps.sanitize ?? lazySanitize, now: deps.now, log,
      });
      return res.json({ success: true, ...await service.run(userId, body.action, body) });
    } catch (err) {
      if (err.expose) return res.json({ success: false, error: err.message }, err.status || 400);
      error(`Study Groups action "${body.action}" failed: ${err.stack || err.message}`);
      return res.json({ success: false, error: 'Study Groups could not complete this request. Please try again.' }, 500);
    }
  };
}

export default createHandler();
