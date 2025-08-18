// =================================================================
//        MAINTENANCE, SAUVEGARDE, JOURNALISATION & SUPERVISION
// =================================================================
// Description: Module pour la journalisation des actions, les
//              sauvegardes et la purge des anciennes données (RGPD).
// =================================================================

// --- Constantes de Rétention (RGPD) ---
const ANNEES_RETENTION_FACTURES = 5; // Durée de conservation légale des factures
const MOIS_RETENTION_LOGS = 12;      // Durée de conservation des logs d'activité

// =================================================================
//                      1. JOURNALISATION (LOGGING)
// =================================================================

/**
 * Journalise une action administrative dans l'onglet "Admin_Logs".
 * @param {string} action Le nom de l'action effectuée (ex: "Archivage Mensuel").
 * @param {string} statut Le résultat de l'action (ex: "Succès").
 */
function logAdminAction(action, statut) {
  try {
    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    let feuilleLog = ss.getSheetByName("Admin_Logs");
    if (!feuilleLog) {
      feuilleLog = ss.insertSheet("Admin_Logs");
      feuilleLog.appendRow(["Timestamp", "Utilisateur", "Action", "Statut"]);
    }
    const utilisateur = Session.getActiveUser().getEmail() || "Utilisateur inconnu";
    feuilleLog.appendRow([new Date(), utilisateur, action, statut]);
  } catch (e) {
    Logger.log(`Impossible de journaliser l'action admin : ${e.toString()}`);
  }
}

/**
 * Journalise une activité liée à une réservation dans l'onglet "Logs".
 * @param {string} idReservation L'ID de la réservation.
 * @param {string} emailClient L'e-mail du client.
 * @param {string} resume Un résumé de l'action.
 * @param {number} prix Le montant associé.
 * @param {string} statut Le statut de l'action ("Succès", "Échec", etc.).
 */
function logActivity(idReservation, emailClient, resume, prix, statut) {
  try {
    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    let feuilleLog = ss.getSheetByName("Logs");
    if (!feuilleLog) {
      feuilleLog = ss.insertSheet("Logs");
      feuilleLog.appendRow(["Timestamp", "Reservation ID", "Client Email", "Résumé", "Montant", "Statut"]);
    }
    feuilleLog.appendRow([new Date(), idReservation, emailClient, resume, prix, statut]);
  } catch (e) {
    Logger.log(`Impossible de journaliser l'activité : ${e.toString()}`);
  }
}

/**
 * Envoie une notification d'erreur à l'admin en limitant la fréquence pour éviter le spam.
 * @param {string} typeErreur Une clé unique pour le type d'erreur (ex: 'ERREUR_AUDIT_DRIVE').
 * @param {string} sujet Le sujet de l'e-mail.
 * @param {string} corps Le corps de l'e-mail.
 */
function notifyAdminWithThrottle(typeErreur, sujet, corps) {
  const cache = CacheService.getScriptCache();
  const cleCache = `erreur_notification_${typeErreur}`;

  if (cache.get(cleCache)) {
    Logger.log(`Notification pour l'erreur "${typeErreur}" déjà envoyée. Envoi ignoré.`);
    return;
  }

  try {
    MailApp.sendEmail(ADMIN_EMAIL, sujet, corps);
    cache.put(cleCache, 'envoye', 3600); // Bloque pour 1 heure
  } catch (e) {
    Logger.log(`Échec de l'envoi de l'e-mail de notification : ${e.toString()}`);
  }
}


// =================================================================
//                      2. SAUVEGARDE (CODE & DONNÉES)
// =================================================================

/**
 * Crée une sauvegarde manuelle de tous les fichiers de code du projet.
 */
function sauvegarderCodeProjet() {
  logAdminAction("Sauvegarde manuelle du code", "Démarré");
  const ui = SpreadsheetApp.getUi();
  try {
    const fichiers = recupererTousLesFichiersProjet();
    if (!fichiers) {
      throw new Error("Impossible de récupérer les fichiers du projet. L'API Google Apps Script est peut-être désactivée.");
    }
    
    const horodatage = formaterDatePersonnalise(new Date(), "yyyy-MM-dd'_'HH'h'mm");
    const nomDossierSauvegarde = `Sauvegarde Code ${horodatage}`;
    
    const dossierProjet = DriveApp.getFileById(ID_FEUILLE_CALCUL).getParents().next();
    const dossierParentSauvegardes = obtenirOuCreerDossier(dossierProjet, "Sauvegardes Code");
    const dossierSauvegarde = dossierParentSauvegardes.createFolder(nomDossierSauvegarde);
    
    fichiers.forEach(fichier => {
      const nomFichier = fichier.type === 'SERVER_JS' ? `${fichier.name}.gs` : `${fichier.name}.html`;
      dossierSauvegarde.createFile(nomFichier, fichier.source, MimeType.PLAIN_TEXT);
    });

    ui.alert('Sauvegarde Réussie', `Le projet a été sauvegardé dans le dossier :\n"${nomDossierSauvegarde}"`, ui.ButtonSet.OK);
    logAdminAction("Sauvegarde manuelle du code", "Succès");
  } catch (e) {
    Logger.log(`Erreur de sauvegarde manuelle : ${e.stack}`);
    ui.alert('Erreur de sauvegarde', `Une erreur est survenue : ${e.message}`, ui.ButtonSet.OK);
    logAdminAction("Sauvegarde manuelle du code", `Échec : ${e.message}`);
  }
}

/**
 * Crée une sauvegarde horodatée des feuilles de données critiques.
 */
function sauvegarderDonnees() {
  logAdminAction("Sauvegarde des données", "Démarré");
  try {
    const feuillesASauvegarder = ["Clients", "Facturation", "Plages_Bloquees", "Logs", "Admin_Logs"];
    const ssOriginale = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    
    const dossierProjet = DriveApp.getFileById(ID_FEUILLE_CALCUL).getParents().next();
    const dossierParentSauvegardes = obtenirOuCreerDossier(dossierProjet, "Sauvegardes Données");

    const horodatage = formaterDatePersonnalise(new Date(), "yyyy-MM-dd");
    const ssSauvegarde = SpreadsheetApp.create(`Sauvegarde Données - ${horodatage}`);
    DriveApp.getFileById(ssSauvegarde.getId()).moveTo(dossierParentSauvegardes);

    feuillesASauvegarder.forEach(nomFeuille => {
      const feuille = ssOriginale.getSheetByName(nomFeuille);
      if (feuille) {
        feuille.copyTo(ssSauvegarde).setName(nomFeuille);
      }
    });
    
    ssSauvegarde.deleteSheet(ssSauvegarde.getSheetByName('Sheet1'));
    
    Logger.log(`Sauvegarde des données réussie. Fichier : ${ssSauvegarde.getUrl()}`);
    logAdminAction("Sauvegarde des données", `Succès : ${ssSauvegarde.getName()}`);

  } catch (e) {
    Logger.log(`Erreur lors de la sauvegarde des données : ${e.toString()}`);
    logAdminAction("Sauvegarde des données", `Échec : ${e.message}`);
    notifyAdminWithThrottle('ERREUR_SAUVEGARDE_DONNEES', `[${NOM_ENTREPRISE}] Erreur Sauvegarde Données`, `Erreur: ${e.message}`);
  }
}

/**
 * Helper: Récupère tous les fichiers du projet via l'API Apps Script.
 */
function recupererTousLesFichiersProjet() {
  const idScript = ScriptApp.getScriptId();
  const url = `https://script.google.com/feeds/download/export?id=${idScript}&format=json`;
  const options = {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true
  };
  
  const reponse = UrlFetchApp.fetch(url, options);
  if (reponse.getResponseCode() === 200) {
    return JSON.parse(reponse.getContentText()).files;
  } else {
    Logger.log(`Échec de l'appel à l'API Apps Script (Code: ${reponse.getResponseCode()}).`);
    return null;
  }
}


// =================================================================
//                      3. PURGE (RGPD & NETTOYAGE)
// =================================================================

/**
 * Purge les anciennes données et les fichiers PDF associés.
 */
function purgerAnciennesDonnees() {
  logAdminAction("Purge RGPD (Données + Fichiers)", "Démarré");
  try {
    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    
    // --- Purge de la feuille de facturation et des PDF ---
    const feuilleFacturation = ss.getSheetByName("Facturation");
    if (feuilleFacturation) {
        const enTeteFact = feuilleFacturation.getRange(1, 1, 1, feuilleFacturation.getLastColumn()).getValues()[0];
        const dateColFact = enTeteFact.indexOf("Date");
        const idPdfCol = enTeteFact.indexOf("ID PDF");
        
        if (idPdfCol === -1 || dateColFact === -1) {
          throw new Error("Colonnes 'Date' et/ou 'ID PDF' requises dans 'Facturation' pour la purge.");
        }

        const dateLimiteFactures = new Date();
        dateLimiteFactures.setFullYear(dateLimiteFactures.getFullYear() - ANNEES_RETENTION_FACTURES);
        const { lignesSupprimees, idsFichiersSupprimes } = purgerDonneesFeuille(feuilleFacturation, dateColFact, idPdfCol, dateLimiteFactures);
        
        let fichiersSupprimes = 0;
        idsFichiersSupprimes.forEach(idFichier => {
          try {
            if (idFichier) {
              DriveApp.getFileById(idFichier).setTrashed(true);
              fichiersSupprimes++;
            }
          } catch (e) {
            Logger.log(`Impossible de supprimer le fichier PDF avec l'ID ${idFichier}. Erreur: ${e.message}`);
          }
        });
        Logger.log(`${lignesSupprimees} ligne(s) de facturation purgée(s) et ${fichiersSupprimes} PDF supprimé(s).`);
    }

    // --- Purge de la feuille de logs ---
    const feuilleLog = ss.getSheetByName("Logs");
    if (feuilleLog) {
        const enTeteLog = feuilleLog.getRange(1, 1, 1, feuilleLog.getLastColumn()).getValues()[0];
        const dateColLog = enTeteLog.indexOf("Timestamp");
        const dateLimiteLogs = new Date();
        dateLimiteLogs.setMonth(dateLimiteLogs.getMonth() - MOIS_RETENTION_LOGS);
        const { lignesSupprimees: logsSupprimes } = purgerDonneesFeuille(feuilleLog, dateColLog, -1, dateLimiteLogs);
        Logger.log(`${logsSupprimes} ligne(s) de log purgée(s).`);
    }
    
    logAdminAction("Purge RGPD", "Succès");

  } catch (e) {
    Logger.log(`Erreur durant la purge RGPD : ${e.toString()}`);
    logAdminAction("Purge RGPD", `Échec : ${e.message}`);
    notifyAdminWithThrottle('ERREUR_PURGE_RGPD', `[${NOM_ENTREPRISE}] Erreur Purge RGPD`, `Erreur: ${e.message}`);
  }
}

/**
 * Helper qui supprime les lignes d'une feuille selon une date limite et retourne les IDs des fichiers associés.
 */
function purgerDonneesFeuille(feuille, indexColonneDate, indexColonneIdFichier, dateLimite) {
  if (!feuille) return { lignesSupprimees: 0, idsFichiersSupprimes: [] };
  
  const donnees = feuille.getDataRange().getValues();
  let lignesSupprimees = 0;
  const idsFichiersSupprimes = [];
  
  for (let i = donnees.length - 1; i >= 1; i--) { // Itère de bas en haut
    const dateLigne = new Date(donnees[i][indexColonneDate]);
    if (dateLigne < dateLimite) {
      if (indexColonneIdFichier !== -1 && donnees[i][indexColonneIdFichier]) {
        idsFichiersSupprimes.push(donnees[i][indexColonneIdFichier]);
      }
      feuille.deleteRow(i + 1);
      lignesSupprimees++;
    }
  }
  return { lignesSupprimees, idsFichiersSupprimes };
}

// =================================================================
//                      4. AUDIT & VÉRIFICATION
// =================================================================

/**
 * Vérifie la cohérence entre les réservations dans le Google Sheet et les événements dans le Google Calendar.
 * Affiche un rapport des incohérences trouvées.
 */
function verifierCoherenceCalendrier() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("Démarrage de l'audit", "La vérification de la cohérence avec le calendrier va commencer. Cela peut prendre quelques instants...", ui.ButtonSet.OK);
  logAdminAction("Vérification Cohérence Calendrier", "Démarré");

  try {
    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    const feuille = ss.getSheetByName("Facturation");
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["ID Réservation", "Event ID", "Date"];
    const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);
    const donnees = feuille.getDataRange().getValues();
    
    let incoherences = [];
    let reservationsVerifiees = 0;

    for (let i = 1; i < donnees.length; i++) {
      const ligne = donnees[i];
      const idReservation = ligne[indices["ID Réservation"]];
      const eventId = ligne[indices["Event ID"]];
      const dateSheet = new Date(ligne[indices["Date"]]);
      reservationsVerifiees++;

      if (!eventId) {
        incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): Aucun 'Event ID' n'est enregistré.`);
        continue;
      }

      try {
        const evenement = Calendar.Events.get(ID_CALENDRIER, eventId);
        const dateCalendrier = new Date(evenement.start.dateTime || evenement.start.date);
        
        if (dateSheet.getFullYear() !== dateCalendrier.getFullYear() ||
            dateSheet.getMonth() !== dateCalendrier.getMonth() ||
            dateSheet.getDate() !== dateCalendrier.getDate()) {
          incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): Incohérence de date. Sheet: ${formaterDateEnYYYYMMDD(dateSheet)}, Calendrier: ${formaterDateEnYYYYMMDD(dateCalendrier)}.`);
        }
      } catch (e) {
        if (e.message.includes("Not Found")) {
          incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): L'événement (ID: ${eventId}) est INTROUVABLE dans le calendrier.`);
        } else {
          incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): Erreur API pour l'événement ${eventId}: ${e.message}`);
        }
      }
    }
    
    // Génération et affichage du rapport final
    let rapportHtml = `<h1>Rapport de cohérence Calendrier</h1>`;
    rapportHtml += `<p><strong>${reservationsVerifiees}</strong> réservations ont été analysées.</p>`;

    if (incoherences.length === 0) {
      rapportHtml += `<p style="color: green;"><strong>Aucune incohérence trouvée.</strong> Tout est synchronisé !</p>`;
    } else {
      rapportHtml += `<p style="color: red;"><strong>${incoherences.length} incohérence(s) détectée(s) :</strong></p>`;
      rapportHtml += `<pre>${incoherences.join('<br>')}</pre>`;
    }
    
    const output = HtmlService.createHtmlOutput(rapportHtml).setWidth(600).setHeight(400);
    ui.showModalDialog(output, "Rapport de cohérence");
    logAdminAction("Vérification Cohérence Calendrier", `Terminée. ${incoherences.length} incohérence(s).`);

  } catch (e) {
    Logger.log(`Erreur fatale durant la vérification de cohérence : ${e.stack}`);
    logAdminAction("Vérification Cohérence Calendrier", `Échec critique : ${e.message}`);
    ui.alert("Erreur Critique", `L'audit a échoué : ${e.message}`, ui.ButtonSet.OK);
  }
}
