function requestMagicLink(email) {
  email = (email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'EMAIL_REQUIRED' };

  // 1) Créer le token (usage unique)
  var token = createMagicToken(email);
  if (!token) return { ok: false, error: 'TOKEN_CREATE_FAILED' };

  // 2) Normaliser l’URL de base (exec), sans query/fragment
  var base = (getConfiguration().WEBAPP_URL || ScriptApp.getService().getUrl() || '').trim();
  base = base.split('#')[0].split('?')[0]; // IMPORTANT

  // 3) Construire l’URL AVEC le token
  var url = base + '?page=client&auth=' + encodeURIComponent(token);

  // 4) Log (contrôle immédiat dans Exécutions/Logs)
  Logger.log('MAGIC_LINK for %s → %s', email, url);

  // 5) Envoyer e-mail HTML + lien texte de secours
  var subject = 'Accès à votre espace client — EL Services';
  var html = ''
    + '<p>Bonjour,</p>'
    + '<p><a href="' + url + '"><strong>Ouvrir mon espace client</strong></a></p>'
    + '<p>Si le bouton ne s’ouvre pas, copiez-collez ce lien dans votre navigateur :</p>'
    + '<p><code style="word-break:break-all;">' + url + '</code></p>'
    + '<p>Le lien expire dans ' + (getConfiguration().TOKEN_TTL_MINUTES || 15) + ' minutes (usage unique).</p>'
    + '<p>— EL Services</p>';

  MailApp.sendEmail({ to: email, subject: subject, htmlBody: html, name: 'EL Services' });
  return { ok: true, url: url };
}

function validateMagicLinkAndCreateSession(token) {
  var res = validateAndConsumeToken(token);
  if (!res.ok) return res;
  var sessionId = createSession(res.email);
  return { ok: true, sessionId: sessionId, email: res.email };
}

/**
 * Génère un lien magique SANS envoyer d'email (usage admin/test).
 * Retourne { ok, url, email }.
 */
function adminGenerateMagicLink(email) {
  var admin = (getConfiguration().ADMIN_EMAIL || '').toLowerCase();
  var caller = (Session.getActiveUser().getEmail() || '').toLowerCase();
  // Si Apps Script nous donne l'email de l'appelant et qu'il n'est pas admin → on bloque.
  if (admin && caller && caller !== admin) {
    return { ok: false, error: 'NOT_ADMIN' };
  }

  email = (email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'EMAIL_REQUIRED' };

  var token = createMagicToken(email);
  if (!token) return { ok: false, error: 'TOKEN_CREATE_FAILED' };

  var base = (getConfiguration().WEBAPP_URL || ScriptApp.getService().getUrl() || '').trim();
  base = base.split('#')[0].split('?')[0]; // nettoie hash & query
  var url = base + '?page=client&auth=' + encodeURIComponent(token);

  Logger.log('ADMIN MAGIC_LINK for %s => %s', email, url);
  return { ok: true, url: url, email: email };
}
