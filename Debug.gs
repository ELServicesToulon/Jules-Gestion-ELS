/** =================================================================
 *  Debug.gs — Outils de debug pour Apps Script (WebApp HTMLService)
 *  Coller tel quel. Aucun autre fichier requis.
 *  - Journalise dans Logger et dans une feuille "DEBUG_LOGS" si possible
 *  - Fournit des endpoints de test: DBG_ping, DBG_echo, DBG_call
 *  - Uniformise les réponses: { ok: true|false, data?, error? }
 *  ================================================================= */

const DBG_SHEET_NAME = 'DEBUG_LOGS';
const DBG_PROP_KEY   = 'ELS_DEBUG_ENABLED';

/** Active/désactive le debug de façon persistante (Script Properties). */
function DBG_setEnabled(enabled) {
  PropertiesService.getScriptProperties().setProperty(DBG_PROP_KEY, String(!!enabled));
  return { ok: true, data: { enabled: DBG_isEnabled() } };
}

/** Retourne l’état du debug. */
function DBG_isEnabled() {
  const v = PropertiesService.getScriptProperties().getProperty(DBG_PROP_KEY);
  return v === 'true';
}

/** Ping basique pour tester la chaîne google.script.run. */
function DBG_ping() {
  return DBG_ok({
    now: DBG_isoNow_(),
    userEmail: safeGetUserEmail_(),
    debug: DBG_isEnabled(),
    scriptId: ScriptApp.getScriptId()
  });
}

/** Echo (retourne ce qu’on envoie) — utile pour tester les handlers. */
function DBG_echo(anything) {
  return DBG_ok({ received: anything, at: DBG_isoNow_() });
}

/**
 * Appel indirect: exécute une fonction server par son nom avec ses args.
 * Usage (client): google.script.run.DBG_call('nomDeTaFonction', [arg1, arg2])
 * ⚠️ À utiliser pour tester seulement.
 */
function DBG_call(fnName, args) {
  try {
    if (!fnName) throw new Error('DBG_call: fnName manquant');
    const tgt = (globalThis || this)[fnName];
    if (typeof tgt !== 'function') throw new new Error(`DBG_call: fonction introuvable: ${fnName}`);
    const res = tgt.apply(null, Array.isArray(args) ? args : []);
    return DBG_ok({ called: fnName, result: res });
  } catch (err) {
    DBG_log_('ERROR', 'DBG_call failed', { fnName, message: String(err), stack: err && err.stack });
    return DBG_err_(err);
  }
}

/** ========================= Helpers réponse ========================= */

function DBG_ok(data) {
  DBG_log_('INFO', 'OK', data);
  return { ok: true, data: data };
}

function DBG_err_(err) {
  const payload = {
    message: err && err.message ? String(err.message) : String(err),
    stack: err && err.stack ? String(err.stack) : null
  };
  DBG_log_('ERROR', payload.message, payload);
  return { ok: false, error: payload };
}

/** ========================= Journalisation ========================== */

function DBG_log_(level, message, details) {
  try {
    const entry = {
      ts: DBG_isoNow_(),
      level: level,
      message: String(message || ''),
      details: details || {},
      user: safeGetUserEmail_(),
      scriptId: ScriptApp.getScriptId()
    };
    // Logger (Stackdriver)
    Logger.log('%s %s — %s %s', entry.ts, level, entry.message, JSON.stringify(entry.details));

    if (!DBG_isEnabled()) return;

    // Écriture optionnelle dans une feuille de calcul si disponible
    const sh = DBG_getLogSheet_();
    if (sh) {
      sh.insertRowBefore(1);
      sh.getRange(1, 1, 1, 6).setValues([[
        entry.ts,
        level,
        entry.message,
        JSON.stringify(entry.details),
        entry.user,
        entry.scriptId
      ]]);
      // Garde max 1000 lignes
      const last = sh.getLastRow();
      if (last > 1000) sh.deleteRows(1001, last - 1000);
    } else {
      // Fallback: on garde un petit ring buffer en Properties
      const sp = PropertiesService.getScriptProperties();
      const raw = sp.getProperty('DBG_RING') || '[]';
      const arr = JSON.parse(raw);
      arr.unshift(entry);
      if (arr.length > 50) arr.pop();
      sp.setProperty('DBG_RING', JSON.stringify(arr));
    }
  } catch (e) {
    // Évite toute exception dans le logger
    Logger.log('DBG_log_ failed: %s', e);
  }
}

function DBG_getLogSheet_() {
  try {
    const ss = SpreadsheetApp.getActive();
    if (!ss) return null;
    let sh = ss.getSheetByName(DBG_SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(DBG_SHEET_NAME);
      sh.getRange(1, 1, 1, 6).setValues([['ts','level','message','details','user','scriptId']]);
      sh.protect().setWarningOnly(true); // protection douce
      sh.insertRowBefore(2); // pour la première insertion
    }
    return sh;
  } catch (e) {
    return null; // script non lié à un Sheet
  }
}

/** ========================= Utilitaires ============================= */

function DBG_isoNow_() {
  const tz = Session.getScriptTimeZone() || 'Europe/Paris';
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function safeGetUserEmail_() {
  try {
    const em = Session.getActiveUser().getEmail();
    return em || null;
  } catch (e) {
    return null;
  }
}

/** ================== Aides pour doGet/doPost (optionnel) ============= */

/** À appeler au début de doGet(e) pour tracer les params. */
function DBG_traceDoGet(e) {
  DBG_log_('INFO', 'doGet', { query: e && e.parameter ? e.parameter : {} });
}

/** À appeler au début de doPost(e) pour tracer les payloads. */
function DBG_traceDoPost(e) {
  const body = e && e.postData ? { type: e.postData.type, length: (e.postData.contents||'').length } : {};
  DBG_log_('INFO', 'doPost', body);
}
