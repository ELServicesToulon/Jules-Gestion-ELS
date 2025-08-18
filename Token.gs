// =================================================================
//                      GESTION DES TOKENS D'ACCÈS
// =================================================================
// Description: Fonctions pour créer et valider les tokens d'accès
//              temporaires pour l'espace client.
// =================================================================

const TOKENS_SHEET_NAME = 'Tokens';
const TOKEN_EXPIRATION_HOURS = 24; // Le token expirera après 24 heures

/**
 * Génère un token unique pour un email, le stocke et le retourne.
 * Crée la feuille 'Tokens' si elle n'existe pas.
 * @param {string} email L'email du client pour lequel générer un token.
 * @returns {string} Le token généré.
 */
function genererEtStockerToken(email) {
  const spreadsheet = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
  let sheet = spreadsheet.getSheetByName(TOKENS_SHEET_NAME);

  // Crée la feuille et les en-têtes si elle n'existe pas
  if (!sheet) {
    sheet = spreadsheet.insertSheet(TOKENS_SHEET_NAME);
    sheet.appendRow(['Email', 'Token', 'DateExpiration']);
    sheet.protect().setWarningOnly(true); // Protège les en-têtes
  }

  const token = Utilities.getUuid();
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + TOKEN_EXPIRATION_HOURS);

  const data = sheet.getDataRange().getValues();
  const emailColumn = 0;
  let emailRow = -1;

  // Cherche si un token existe déjà pour cet email
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailColumn].toString().toLowerCase() === email.toLowerCase()) {
      emailRow = i + 1;
      break;
    }
  }

  if (emailRow !== -1) {
    // Met à jour le token et la date d'expiration
    sheet.getRange(emailRow, 2).setValue(token);
    sheet.getRange(emailRow, 3).setValue(expirationDate);
  } else {
    // Ajoute une nouvelle ligne pour le nouvel email
    sheet.appendRow([email, token, expirationDate]);
  }

  Logger.log(`Token généré pour ${email}`);
  return token;
}

/**
 * Valide un token d'accès.
 * @param {string} token Le token à valider.
 * @returns {Object} Un objet avec {success: true, email: string} ou {success: false, error: string}.
 */
function validerToken(token) {
  if (!token) {
    return { success: false, error: "Token non fourni." };
  }

  try {
    const sheet = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName(TOKENS_SHEET_NAME);
    if (!sheet) {
      // Si la feuille n'existe pas, aucun token ne peut être valide.
      Logger.log("Tentative de validation de token mais la feuille 'Tokens' n'existe pas.");
      return { success: false, error: "Service de token non initialisé." };
    }

    const data = sheet.getDataRange().getValues();
    const tokenColumn = 1;
    const now = new Date();

    // On parcourt à partir de la fin pour trouver le token le plus récent en cas de doublons
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][tokenColumn] === token) {
        const expirationDate = new Date(data[i][2]);
        if (expirationDate > now) {
          const email = data[i][0];
          Logger.log(`Token validé avec succès pour ${email}`);

          // Supprimer le token après utilisation pour le rendre à usage unique
          try {
            sheet.deleteRow(i + 1);
            Logger.log(`Token pour ${email} supprimé après validation.`);
          } catch (e) {
            Logger.log(`Avertissement: n'a pas pu supprimer le token pour ${email} après validation. Erreur: ${e.message}`);
          }

          return { success: true, email: email };
        } else {
          Logger.log(`Tentative d'utilisation d'un token expiré pour ${data[i][0]}`);
          return { success: false, error: "Le lien de connexion a expiré." };
        }
      }
    }

    Logger.log(`Token non trouvé : ${token}`);
    return { success: false, error: "Le lien de connexion est invalide." };

  } catch (e) {
    Logger.log(`Erreur critique dans validerToken: ${e.stack}`);
    return { success: false, error: "Une erreur serveur est survenue lors de la validation du token." };
  }
}
