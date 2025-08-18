// =================================================================
//                      AUTHENTIFICATION CLIENT
// =================================================================
// Description: Gère la logique de connexion de l'espace client via
//              des liens magiques (tokens).
// =================================================================

function envoyerLienMagique(email) {
  if (!email) return false;

  // Anti double-envoi 60s
  const cache = CacheService.getScriptCache();
  const key = 'sendlink:'+email;
  if (cache.get(key)) return true;
  cache.put(key, '1', 60);

  const token = Utilities.getUuid();
  const expires = Date.now() + 15 * 60 * 1000; // 15 min
  PropertiesService.getScriptProperties().setProperty(
    'token:'+token, JSON.stringify({ email: email, expires: expires })
  );

  const baseUrl = ScriptApp.getService().getUrl(); // URL du déploiement
  const link = baseUrl + '?page=gestion&token=' + encodeURIComponent(token);

  MailApp.sendEmail({
    to: email,
    subject: 'Votre lien de connexion sécurisé',
    htmlBody: 'Cliquez pour vous connecter : <a href="'+link+'">'+link+'</a>'
  });
  return true;
}

function verifierJetonMagique(token) {
  if (!token) return null;
  const propKey = 'token:'+token;
  const raw = PropertiesService.getScriptProperties().getProperty(propKey);
  if (!raw) return null;

  const data = JSON.parse(raw);
  if (Date.now() > Number(data.expires)) return null;

  // Invalidation usage unique
  PropertiesService.getScriptProperties().deleteProperty(propKey);

  // Ici tu peux encore valider que l'email existe bien dans ta base Clients
  return data.email || null;
}
