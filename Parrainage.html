/**
 * @file Parrainage.gs
 * @description Gère toute la logique du système de parrainage : génération, validation, attribution.
 * @version 1.0
 */

/**
 * Génère un code de parrainage unique en s'assurant qu'il n'existe pas déjà.
 * Utilise les constantes définies dans Configuration.gs.
 * @returns {string} Le code de parrainage unique généré (ex: PHARMA-A1B2C3).
 */
function genererCodeParrainageUnique() {
  const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
  const sheetClients = ss.getSheetByName("Clients"); // Adaptez le nom "Clients" si besoin
  
  // Vérification de l'existence de la feuille
  if (!sheetClients) {
    Logger.log("Erreur critique : La feuille 'Clients' est introuvable.");
    return null;
  }
  
  const colonneCodeFinder = sheetClients.createTextFinder(COLONNE_CODE_PARRAINAGE);
  const premiereCellule = colonneCodeFinder.findNext();
  
  // Si la colonne n'existe pas, on ne peut pas continuer
  if (!premiereCellule) {
      Logger.log(`Erreur: La colonne '${COLONNE_CODE_PARRAINAGE}' n'a pas été trouvée dans la feuille 'Clients'.`);
      return null;
  }

  const colonneIndex = premiereCellule.getColumn();
  const codesExistants = sheetClients.getRange(2, colonneIndex, sheetClients.getLastRow()).getValues().flat();
  
  let nouveauCode;
  let estUnique = false;

  // Boucle de sécurité pour garantir l'unicité
  while (!estUnique) {
    let codePartiel = Math.random().toString(36).substring(2, 2 + PARRAINAGE_CONFIG.LONGUEUR_CODE).toUpperCase();
    nouveauCode = PARRAINAGE_CONFIG.PREFIXE_CODE + codePartiel;
    if (!codesExistants.includes(nouveauCode)) {
      estUnique = true;
    }
  }
  
  Logger.log(`Code de parrainage unique généré : ${nouveauCode}`);
  return nouveauCode;
}


/**
 * Vérifie un code de parrainage saisi par un client depuis l'interface web.
 * C'est la fonction qui sera appelée par google.script.run.
 * @param {string} codeSaisi Le code entré par l'utilisateur.
 * @param {string} emailClientActuel L'email de l'utilisateur qui tente d'utiliser le code.
 * @returns {object} Un objet avec le statut de la validation {isValid, message, remise}.
 */
function verifierCodeParrainage(codeSaisi, emailClientActuel) {
  try {
    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    const sheetClients = ss.getSheetByName("Clients");
    if (!sheetClients) return { isValid: false, message: "Erreur de configuration." };

    const dataClients = sheetClients.getDataRange().getValues();
    const headers = dataClients[0];
    
    // Utilisation des constantes pour trouver les index des colonnes
    const indexCodeParrainage = headers.indexOf(COLONNE_CODE_PARRAINAGE);
    const indexEmail = headers.indexOf("Email"); // En supposant que la colonne s'appelle "Email"
    const indexCodeUtilise = headers.indexOf(COLONNE_CODE_UTILISE);

    if (indexCodeParrainage === -1 || indexEmail === -1 || indexCodeUtilise === -1) {
      Logger.log("Erreur de configuration des colonnes de parrainage.");
      return { isValid: false, message: "Erreur de configuration (colonnes introuvables)." };
    }
    
    // 1. Vérifier si le client actuel a déjà utilisé un code
    const clientActuelRow = dataClients.find(row => row[indexEmail] && row[indexEmail].toLowerCase() === emailClientActuel.toLowerCase());
    if (clientActuelRow && clientActuelRow[indexCodeUtilise]) {
      return { isValid: false, message: "Ce code est réservé aux nouveaux clients n'ayant jamais utilisé de parrainage." };
    }

    // 2. Trouver le parrain associé au code saisi
    const parrainRow = dataClients.find(row => row[indexCodeParrainage] === codeSaisi);
    if (!parrainRow) {
      return { isValid: false, message: "Ce code de parrainage est invalide." };
    }

    // 3. Vérifier que le client n'essaie pas d'utiliser son propre code
    const emailParrain = parrainRow[indexEmail];
    if (emailParrain && emailParrain.toLowerCase() === emailClientActuel.toLowerCase()) {
      return { isValid: false, message: "Vous ne pouvez pas utiliser votre propre code." };
    }

    // Si toutes les vérifications passent, le code est valide
    return {
      isValid: true,
      message: `🎉 Remise de ${PARRAINAGE_CONFIG.MONTANT_REMISE_FILLEUL.toFixed(2)} € appliquée !`,
      remise: PARRAINAGE_CONFIG.MONTANT_REMISE_FILLEUL
    };

  } catch (e) {
    Logger.log(`Erreur lors de la vérification du code de parrainage : ${e.toString()}`);
    return { isValid: false, message: "Une erreur technique est survenue. Veuillez réessayer." };
  }
}


/**
 * Attribue un code de parrainage et gère les crédits après une réservation réussie.
 * Cette fonction doit être appelée à la fin de votre processus d'enregistrement de réservation.
 * @param {string} emailFilleul L'email du nouveau client qui a fait la réservation.
 * @param {string} codeUtilise Le code de parrainage qu'il a utilisé (peut être null ou vide).
 */
function enregistrerInfosParrainageApresReservation(emailFilleul, codeUtilise) {
  const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
  const sheetClients = ss.getSheetByName("Clients");
  if (!sheetClients) return;

  const dataClients = sheetClients.getDataRange().getValues();
  const headers = dataClients[0];

  const indexEmail = headers.indexOf("Email");
  const indexCodeParrainage = headers.indexOf(COLONNE_CODE_PARRAINAGE);
  const indexCodeUtilise = headers.indexOf(COLONNE_CODE_UTILISE);
  const indexCreditParrainage = headers.indexOf(COLONNE_CREDIT_PARRAINAGE);

  // Trouver la ligne du nouveau client (le filleul)
  const ligneFilleulIndex = dataClients.findIndex(row => row[indexEmail] && row[indexEmail].toLowerCase() === emailFilleul.toLowerCase());

  if (ligneFilleulIndex !== -1) {
    const rowNumFilleul = ligneFilleulIndex + 1;
    
    // 1. Assigner un NOUVEAU code de parrainage au filleul pour qu'il devienne parrain à son tour
    if (!sheetClients.getRange(rowNumFilleul, indexCodeParrainage + 1).getValue()) {
      const nouveauCode = genererCodeParrainageUnique();
      if(nouveauCode) {
        sheetClients.getRange(rowNumFilleul, indexCodeParrainage + 1).setValue(nouveauCode);
      }
    }

    // 2. Si un code a été utilisé, l'enregistrer et récompenser le parrain
    if (codeUtilise) {
      sheetClients.getRange(rowNumFilleul, indexCodeUtilise + 1).setValue(codeUtilise);
      
      // Trouver le parrain pour lui attribuer son crédit
      const ligneParrainIndex = dataClients.findIndex(row => row[indexCodeParrainage] === codeUtilise);
      if (ligneParrainIndex !== -1) {
        const rowNumParrain = ligneParrainIndex + 1;
        const creditActuelCell = sheetClients.getRange(rowNumParrain, indexCreditParrainage + 1);
        const creditActuel = parseFloat(creditActuelCell.getValue()) || 0;
        const nouveauCredit = creditActuel + PARRAINAGE_CONFIG.MONTANT_RECOMPENSE_PARRAIN;
        creditActuelCell.setValue(nouveauCredit);
        Logger.log(`Crédit de ${PARRAINAGE_CONFIG.MONTANT_RECOMPENSE_PARRAIN}€ ajouté au parrain (ligne ${rowNumParrain}). Nouveau solde: ${nouveauCredit}€.`);
      }
    }
  } else {
      Logger.log(`Impossible de trouver le client avec l'email ${emailFilleul} pour enregistrer les informations de parrainage.`);
  }
}
