// =================================================================
//                      AUTHENTIFICATION CLIENT
// =================================================================
// Description: Gère la logique de connexion de l'espace client via
//              des liens magiques (tokens).
// =================================================================

/**
 * Génère un lien de connexion unique (lien magique) et l'envoie par e-mail au client.
 * @param {string} email L'adresse e-mail du client.
 * @returns {Object} Un objet indiquant le succès ou l'échec de l'opération.
 */
function envoyerLienMagique(email) {
  try {
    if (!email || typeof email !== 'string') {
      return { success: false, message: "L'adresse e-mail fournie est invalide." };
    }
    const emailClient = email.trim().toLowerCase();

    // On ne vérifie PAS si le client existe ici pour des raisons de sécurité.
    // On renvoie toujours un message de succès générique pour ne pas révéler
    // si une adresse e-mail est présente ou non dans la base de données (prévention de l'énumération d'e-mails).
    const clientInfo = validerClientParEmail(emailClient);
    if (!clientInfo.success) {
      Logger.log(`Tentative de connexion pour un e-mail non trouvé : ${emailClient}`);
      // On continue quand même pour envoyer un e-mail "fictif" afin que le comportement soit identique.
      // Mais on n'enregistrera rien et l'e-mail ne sera pas réellement envoyé par MailApp si l'adresse est invalide.
      // Cette approche est plus simple que de simuler un envoi. On retourne simplement le message générique.
       return { success: true, message: "Si un compte est associé à cette adresse, un e-mail de connexion a été envoyé." };
    }

    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    let feuille = ss.getSheetByName("MagicLinks");
    if (!feuille) {
      feuille = ss.insertSheet("MagicLinks");
      feuille.appendRow(["Token", "Email", "DateExpiration", "Utilise"]);
      Logger.log("La feuille 'MagicLinks' a été créée car elle n'existait pas.");
    }

    const donnees = feuille.getDataRange().getValues();
    // Boucle inversée pour supprimer les lignes en toute sécurité
    for (let i = donnees.length - 1; i >= 1; i--) {
      if (donnees[i][1] && donnees[i][1].toString().trim().toLowerCase() === emailClient) {
        feuille.deleteRow(i + 1);
      }
    }

    const token = Utilities.getUuid();
    const dateExpiration = new Date(new Date().getTime() + 15 * 60 * 1000); // Expiration dans 15 minutes

    feuille.appendRow([token, emailClient, dateExpiration, false]);

    const urlScript = ScriptApp.getService().getUrl();
    const lienMagique = `${urlScript}?page=gestion&token=${token}`;

    const sujet = `Votre lien de connexion pour ${NOM_ENTREPRISE}`;
    const corps = `
      <p>Bonjour,</p>
      <p>Voici votre lien pour vous connecter à votre espace client. Ce lien est valide pendant 15 minutes.</p>
      <p><a href="${lienMagique}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Accéder à mon espace</a></p>
      <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>${lienMagique}</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
      <p>L'équipe ${NOM_ENTREPRISE}</p>
    `;

    MailApp.sendEmail({
      to: emailClient,
      subject: sujet,
      htmlBody: corps
    });

    Logger.log(`Lien magique envoyé à ${emailClient}`);
    return { success: true, message: "Si un compte est associé à cette adresse, un e-mail de connexion a été envoyé." };

  } catch (e) {
    Logger.log(`Erreur critique dans envoyerLienMagique pour ${email}: ${e.stack}`);
    return { success: false, message: "Une erreur serveur est survenue. L'administrateur a été notifié." };
  }
}

/**
 * Vérifie la validité d'un jeton magique fourni dans l'URL.
 * @param {string} token Le jeton à vérifier.
 * @returns {Object} Un objet contenant le succès de l'opération et, si valide, l'e-mail du client.
 */
function verifierJetonMagique(token) {
  try {
    if (!token || typeof token !== 'string') {
      return { success: false, error: "Jeton manquant ou invalide." };
    }

    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    const feuille = ss.getSheetByName("MagicLinks");
    if (!feuille) {
      Logger.log("ERREUR CRITIQUE : La feuille 'MagicLinks' est introuvable lors de la vérification.");
      return { success: false, error: "Erreur de configuration du système." };
    }

    const donnees = feuille.getDataRange().getValues();
    // Les colonnes sont supposées être : 0:Token, 1:Email, 2:DateExpiration, 3:Utilise
    let indexLigneTrouvee = -1;
    for (let i = 1; i < donnees.length; i++) {
      if (donnees[i][0] === token) {
        indexLigneTrouvee = i;
        break;
      }
    }

    if (indexLigneTrouvee === -1) {
      Logger.log(`Tentative de connexion avec un jeton introuvable : ${token}`);
      return { success: false, error: "Lien de connexion invalide ou expiré." };
    }

    const ligne = donnees[indexLigneTrouvee];
    const email = ligne[1];
    const dateExpiration = new Date(ligne[2]);
    const estUtilise = ligne[3] === true;

    if (estUtilise) {
      Logger.log(`Tentative de réutilisation d'un jeton pour ${email}. Jeton : ${token}`);
      return { success: false, error: "Ce lien de connexion a déjà été utilisé." };
    }

    if (dateExpiration < new Date()) {
      Logger.log(`Tentative d'utilisation d'un jeton expiré pour ${email}. Jeton : ${token}`);
      return { success: false, error: "Ce lien de connexion a expiré. Veuillez en demander un nouveau." };
    }

    // Marquer le jeton comme utilisé pour empêcher la réutilisation
    feuille.getRange(indexLigneTrouvee + 1, 4).setValue(true);

    Logger.log(`Jeton validé avec succès pour l'utilisateur ${email}.`);
    return { success: true, email: email };

  } catch (e) {
    Logger.log(`Erreur critique dans verifierJetonMagique pour le jeton ${token}: ${e.stack}`);
    return { success: false, error: "Une erreur serveur est survenue lors de la validation du lien." };
  }
}
