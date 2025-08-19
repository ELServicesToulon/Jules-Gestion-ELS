function requestMagicLink(email) {
  email = (email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'EMAIL_REQUIRED' };

  // (Optionnel) vérifier que l'email appartient à un client connu
  // if (!isKnownClient(email)) return { ok:false, error:'UNKNOWN_EMAIL' };

  var token = createMagicToken(email);
  var baseUrl = getConfiguration().WEBAPP_URL || ScriptApp.getService().getUrl();
  var url = baseUrl + '?page=client&auth=' + encodeURIComponent(token);

  var subject = 'Accès à votre espace client — EL Services';
  var htmlBody =
    '<p>Bonjour,</p>' +
    '<p>Cliquez pour ouvrir votre espace client :</p>' +
    '<p><a href="' + url + '"><strong>Ouvrir mon espace client</strong></a></p>' +
    '<p>Ce lien expire dans ' + (getConfiguration().TOKEN_TTL_MINUTES || 15) + ' minutes et n’est utilisable qu’une seule fois.</p>' +
    '<p>— EL Services</p>';

  MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody, name: 'EL Services' });
  return { ok: true };
}

function validateMagicLinkAndCreateSession(token) {
  var res = validateAndConsumeToken(token);
  if (!res.ok) return res;
  var sessionId = createSession(res.email);
  return { ok: true, sessionId: sessionId, email: res.email };
}
