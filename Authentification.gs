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
  const key = 'send:'+email.toLowerCase();
  if (cache.get(key)) return true;
  cache.put(key, '1', 60);

  // Crée le token + enregistre dans Sheets (onglet Tokens + MagicLinks)
  const token = Utilities.getUuid();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL); // ou ton ID Sheet
  const shTokens = ss.getSheetByName('Tokens');
  shTokens.appendRow([email.toLowerCase(), token, expires]);

  const baseUrl = ScriptApp.getService().getUrl(); // URL du déploiement
  const link = baseUrl + '?page=gestion#t=' + encodeURIComponent(token);

  const shML = ss.getSheetByName('MagicLinks');
  if (shML) shML.appendRow([token, link, expires, false]);

  MailApp.sendEmail({
    to: email,
    subject: 'Votre lien de connexion sécurisé',
    htmlBody: 'Cliquez pour vous connecter : <a href="'+link+'">'+link+'</a>'
  });
  return true;
}

function verifierJetonMagique(token) {
  if (!token) return null;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    const shTokens = ss.getSheetByName('Tokens');
    const data = shTokens.getDataRange().getValues(); // A:Email B:Token C:Expiration

    let email = null, exp = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === token) { // colonne B
        email = String(data[i][0] || '').toLowerCase();
        exp = new Date(data[i][2]);
        break;
      }
    }
    if (!email) return null;
    if (new Date() > exp) return null;

    // Marque "Used" dans MagicLinks (col D)
    const shML = ss.getSheetByName('MagicLinks');
    if (shML) {
      const ml = shML.getDataRange().getValues(); // A:Token B:URL C:Expiration D:Used
      for (let j = 1; j < ml.length; j++) {
        if (ml[j][0] === token) {
          // Vérifie si le token a déjà été utilisé
          if (ml[j][3] === true) {
            return null; // Déjà utilisé
          }
          shML.getRange(j + 1, 4).setValue(true);
          break;
        }
      }
    }

    // (Optionnel) supprimer la ligne du token pour usage unique strict
    // -> shTokens.deleteRow(i+1);

    return email;
  } finally {
    lock.releaseLock();
  }
}
