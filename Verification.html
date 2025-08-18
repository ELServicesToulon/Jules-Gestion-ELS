// =================================================================
//                      VÉRIFICATION DES EN-TÊTES
// =================================================================
// Description: Ce script vérifie que les en-têtes de colonnes des
//              onglets critiques correspondent exactement à une
//              structure de référence pour garantir l'intégrité
//              des données.
// =================================================================

/**
 * Point d'entrée pour ajouter un menu dédié à la vérification.
 * S'exécute à l'ouverture du Google Sheet.
 */
function onOpen() {
  // On s'assure de ne pas écraser le menu existant
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('EL Services Admin');
  
  // Ajout du sous-menu de vérification
  menu.addItem('Vérifier les en-têtes de colonnes', 'lancerVerificationManuelle');
  menu.addToUi();
}

/**
 * Fonction appelée depuis le menu pour afficher le résultat à l'utilisateur.
 */
function lancerVerificationManuelle() {
    const rapport = verifierToutesLesColonnes(true); // true pour un rapport détaillé
    SpreadsheetApp.getUi().alert('Rapport de Vérification', rapport, SpreadsheetApp.getUi().ButtonSet.OK);
}


/**
 * Objet de configuration contenant les en-têtes de référence pour chaque onglet.
 * Les noms doivent correspondre EXACTEMENT (casse, espaces, etc.) à ceux attendus.
 */
const CONFIG_VERIFICATION_EN_TETES = {
  'Clients': [
    "Email", "Raison Sociale", "Adresse", "SIRET", "TVA", "Type de Remise", "Valeur Remise", "Nombre Tournées Offertes", "CodeParrainage", "CodeUtilise", "CreditParrainage"
  ],
  'Destinataires': [
    "Nom Complet", "Adresse", "Email", "Telephone", "Client Associé (Email)"
  ],
  'Facturation': [
    "Date", "Client (Raison S. Client)", "Client (Email)", "Type", "Détails", "Montant", "Statut", "Valider", "N° Facture", "Event ID", "ID Réservation", "ID PDF", "Note Interne", "Lien Note", "Type Remise Appliquée", "Tournée Offerte Appliquée", "Valeur Remise Appliquée", "Note Livreur", "Livreur Frigo", "Livreur Tampon", "Livreur Reprise", "Livreur Extras"
  ]
};

/**
 * Fonction principale qui orchestre la vérification sur tous les onglets définis.
 * @param {boolean} [pourUi=false] - Si true, retourne un rapport textuel pour l'UI.
 * @returns {string|null} Un rapport textuel si pourUi est true, sinon null.
 */
function verifierToutesLesColonnes(pourUi = false) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let rapportFinal = "Rapport de vérification des en-têtes :\n\n";
  let toutEstOk = true;

  for (const nomOnglet in CONFIG_VERIFICATION_EN_TETES) {
    Logger.log(`--- Vérification de l'onglet : [${nomOnglet}] ---`);
    const rapportOnglet = {
      manquantes: [],
      enTrop: [],
      ok: true
    };

    const feuille = spreadsheet.getSheetByName(nomOnglet);
    if (!feuille) {
      Logger.log(`ERREUR : L'onglet "${nomOnglet}" est introuvable.`);
      rapportFinal += `[${nomOnglet}] ERREUR : Onglet introuvable.\n`;
      toutEstOk = false;
      continue;
    }

    const enTetesAttendus = CONFIG_VERIFICATION_EN_TETES[nomOnglet];
    
    // On convertit chaque en-tête en chaîne de caractères avec String(h) avant d'appeler .trim()
    // pour éviter les erreurs si une cellule contient un nombre, une date ou est vide.
    const enTetesActuels = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0]
      .map(h => String(h).trim())
      .filter(Boolean);

    // Vérification des colonnes manquantes
    enTetesAttendus.forEach(enTete => {
      if (!enTetesActuels.includes(enTete)) {
        rapportOnglet.manquantes.push(enTete);
        rapportOnglet.ok = false;
        toutEstOk = false;
      }
    });

    // Vérification des colonnes en trop
    enTetesActuels.forEach(enTete => {
      if (!enTetesActuels.includes(enTete)) {
        rapportOnglet.enTrop.push(enTete);
        rapportOnglet.ok = false;
        toutEstOk = false;
      }
    });

    // Construction du rapport pour cet onglet
    if (rapportOnglet.ok) {
      Logger.log(`[${nomOnglet}] OK – Toutes les colonnes sont présentes et correctes.`);
      rapportFinal += `[${nomOnglet}] ✅ OK – Structure conforme.\n`;
    } else {
      if (rapportOnglet.manquantes.length > 0) {
        const msg = `[${nomOnglet}] Colonnes MANQUANTES : [${rapportOnglet.manquantes.join(', ')}]`;
        Logger.log(msg);
        rapportFinal += `${msg}\n`;
      }
      if (rapportOnglet.enTrop.length > 0) {
        const msg = `[${nomOnglet}] Colonnes EN TROP ou MAL ORTHOGRAPHIÉES : [${rapportOnglet.enTrop.join(', ')}]`;
        Logger.log(msg);
        rapportFinal += `${msg}\n`;
      }
    }
    rapportFinal += "\n";
  }
  
  if (toutEstOk) {
      rapportFinal = "✅ Toutes les colonnes de tous les onglets critiques sont correctement configurées !";
  }

  Logger.log("--- Fin de la vérification ---");
  
  if (pourUi) {
    return rapportFinal;
  }
  return null;
}
