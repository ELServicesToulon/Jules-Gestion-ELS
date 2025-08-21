/**
 * Stockage Token + Session via ScriptProperties.
 * Clés: token:<token>, session:<sessionId>
 */
const TOKEN_PREFIX = 'token:';
const SESSION_PREFIX = 'session:';
const TOKEN_TTL_MINUTES_DEFAULT = 15;
const SESSION_TTL_HOURS_DEFAULT = 12;

function createMagicToken(email, ttlMinutes) {
  const p = PropertiesService.getScriptProperties();
  const token = Utilities.getUuid().replace(/-/g, '');
  const now = Date.now();
  const conf = getConfiguration();
  const ttl = (ttlMinutes || conf.TOKEN_TTL_MINUTES || TOKEN_TTL_MINUTES_DEFAULT) * 60 * 1000;
  const record = JSON.stringify({ email: email.toLowerCase(), created: now, exp: now + ttl, used: false });
  p.setProperty(TOKEN_PREFIX + token, record);
  return token;
}

function validateAndConsumeToken(token) {
  const p = PropertiesService.getScriptProperties();
  const raw = p.getProperty(TOKEN_PREFIX + token);
  if (!raw) return { ok: false, error: 'TOKEN_NOT_FOUND' };
  const data = JSON.parse(raw);
  if (data.used) return { ok: false, error: 'TOKEN_ALREADY_USED' };
  if (Date.now() > data.exp) return { ok: false, error: 'TOKEN_EXPIRED' };
  data.used = true;
  p.setProperty(TOKEN_PREFIX + token, JSON.stringify(data));
  return { ok: true, email: data.email };
}

function createSession(email, ttlHours) {
  const p = PropertiesService.getScriptProperties();
  const id = Utilities.getUuid().replace(/-/g, '');
  const now = Date.now();
  const conf = getConfiguration();
  const ttl = (ttlHours || conf.SESSION_TTL_HOURS || SESSION_TTL_HOURS_DEFAULT) * 60 * 60 * 1000;
  const record = JSON.stringify({ email: email.toLowerCase(), created: now, exp: now + ttl });
  p.setProperty(SESSION_PREFIX + id, record);
  return id;
}

function validateSession(sessionId) {
  if (!sessionId) return { ok: false, error: 'NO_SESSION' };
  const p = PropertiesService.getScriptProperties();
  const raw = p.getProperty(SESSION_PREFIX + sessionId);
  if (!raw) return { ok: false, error: 'SESSION_NOT_FOUND' };
  const data = JSON.parse(raw);
  if (Date.now() > data.exp) {
    p.deleteProperty(SESSION_PREFIX + sessionId);
    return { ok: false, error: 'SESSION_EXPIRED' };
  }
  return { ok: true, email: data.email };
}

function destroySession(sessionId) {
  if (sessionId) PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + sessionId);
  return { ok: true };
}

// Nettoyage optionnel
function _gcTokensAndSessions() {
  const p = PropertiesService.getScriptProperties();
  const all = p.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(k => {
    if (k.startsWith(TOKEN_PREFIX) || k.startsWith(SESSION_PREFIX)) {
      try {
        const v = JSON.parse(all[k]);
        if (v.exp && now > v.exp) p.deleteProperty(k);
      } catch (e) {}
    }
  });
}
