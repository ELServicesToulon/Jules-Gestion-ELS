/**
 * shema.gs — Déclaration et provisionning des onglets + entêtes
 * - N'ajoute que le manquant (aucune suppression de colonnes existantes).
 * - Entêtes en UPPER_SNAKE_CASE pour éviter les soucis d'accents.
 * - Ligne 1 figée + filtre auto.
 * - Idempotent: réexécutable sans risque.
 */

/** Version de schéma (pour suivi éventuel) */
const SCHEMA_VERSION = '2025-08-19_ELS';

/** Définition centrale du schéma */
const SCHEMA = {
  Clients: [
    'CLIENT_ID','TYPE','NOM','CONTACT','EMAIL','TELEPHONE',
    'ADRESSE_1','ADRESSE_2','CODE_POSTAL','VILLE',
    'NOTES','ACTIF','DATE_CREATION','MAGIC_LINK','DERNIERE_CONNEXION'
  ],
  Destinataires: [
    'DEST_ID','CLIENT_ID','TYPE_DEST','NOM','ETAGE','BATIMENT','INFOS_ACCES',
    'CONTACT_SITE','TEL_SITE','FRAGILE','FRIGO','TAMPON','BOITE_SCELLEE',
    'NB_RESIDENTS_SUP','COMMENTAIRES'
  ],
  Reservations: [
    'ID_RESERVATION','DATE','HEURE','SEMAINE','CLIENT_ID','DESTINATAIRE_ID',
    'ADRESSE_RETRAIT','ADRESSE_LIVRAISON','VILLE','ZONE','DISTANCE_KM',
    'DUREE_ESTIMEE_MIN','NB_ARRETS','URGENCE','SAMEDI','FORFAIT_SPECIAL',
    'PRIX_BASE_HT','REMISE_HT','TOTAL_HT','TVA','TOTAL_TTC',
    'STATUT','MODE_PAIEMENT','FACTURE_ID','SOURCE','CREE_PAR',
    'CREATED_AT','UPDATED_AT','COMMENTAIRE'
  ],
  Tournees: [
    'TOURNEE_ID','DATE','PLAGE','LIVREUR','VEHICULE','STATUT',
    'NB_COURSES','DUREE_TOTALE_MIN','KM_ESTIMES','NOTES'
  ],
  Tournee_Lignes: [
    'TOURNEE_ID','RANG','RESERVATION_ID','RETRAIT_OK','LIVREE_OK','ANOMALIE',
    'FRIGO','TAMPON','BOITE_SCELLEE','EXTRACTIONS','NB_RESIDENTS_SUP',
    'HEURE_PASSAGE','SIGNATURE','NOTE'
  ],
  Factures: [
    'FACTURE_ID','NUMERO','CLIENT_ID','DATE_FACTURE','PERIODE_DU','PERIODE_AU',
    'TOTAL_HT','TVA','TOTAL_TTC','STATUT','LIEN_PDF','DRIVE_FOLDER_ID',
    'EMIS_PAR','EMIS_AT'
  ],
  Facture_Lignes: [
    'FACTURE_ID','LIGNE','RESERVATION_ID','DESCRIPTION','QUANTITE','PU_HT',
    'REMISE_HT','TOTAL_LIGNE_HT','CODE_TARIF','NOTE'
  ],
  Tokens: [
    'TOKEN','SCOPE','CLIENT_ID','EMAIL','EXPIRES_AT','USED_AT','STATUS',
    'CREATED_AT','CREATED_BY','IP','USER_AGENT'
  ],
  Consents_RGPD: [
    'CLIENT_ID','TYPE','VERSION','CONSENT_AT','IP','USER_AGENT','NOTE'
  ],
  Calendrier: [
    'DATE','JOUR','OUVERT','PLAGES_JSON','CAPACITE_JOUR','REMPLISSAGE_PCT','COMMENTAIRES'
  ],
  Maintenance: [
    'CLE','VALEUR','COMMENTAIRE','MAJ_AT','MAJ_PAR'
  ],
  Parrainage: [
    'ID','PARRAIN_ID','CODE','FILLEUL_EMAIL','FILLEUL_ID','BONUS_HT','STATUT','CREATED_AT','VERIFIED_AT','NOTE'
  ],
  Logs: [
    'TIMESTAMP','LEVEL','MESSAGE','FUNCTION','USER','CONTEXT_JSON'
  ],
  Verifications: [
    'TYPE','SUJET_ID','CAUSE','DETAILS','CREE_AT','RESOLU','RESOLU_AT','PAR'
  ],
  Tests: [
    'TEST_NAME','OK','DUREE_MS','MESSAGE','DATE','ENV'
  ],
  // Miroir UI des tarifs (optionnel, lecture seule — ne jamais utiliser comme source de vérité)
  Tarifs_UI: [
    'CODE','LIBELLE','BASE_HT','UNITE','ACTIF','NOTE'
  ],
  // Liste Drive des docs admin (optionnel)
  Docs_Admin: [
    'TITRE','TYPE_DOC','DRIVE_LINK','DERNIERE_MAJ'
  ]
};

/**
 * Point d’entrée : crée ou met à jour tous les onglets et entêtes.
 */
function ensureSchema() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(name => {
    const sheet = getOrCreateSheet_(ss, name);
    ensureHeaders_(sheet, SCHEMA[name]);
    beautifySheet_(sheet, SCHEMA[name]);
  });
  PropertiesService.getScriptProperties().setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
  return { ok: true, version: SCHEMA_VERSION, sheets: Object.keys(SCHEMA) };
}

/** Retourne un onglet existant ou le crée. */
function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  return sh;
}

/**
 * Assure la présence des entêtes :
 * - si ligne 1 vide → écrit l’intégralité des entêtes
 * - sinon → ajoute les entêtes manquantes à la suite, sans supprimer l’existant
 */
function ensureHeaders_(sheet, headers) {
  const lastCol = sheet.getLastColumn();
  const headerRange = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol) : null;
  const current = (headerRange && headerRange.getValues()[0]) || [];
  const normalized = current.map(v => String(v || '').trim());

  if (normalized.filter(v => v).length === 0) {
    // ligne d’en-tête vide → on écrit tout
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // on ajoute ce qui manque
    const have = new Set(normalized.filter(v => v));
    const missing = headers.filter(h => !have.has(h));
    if (missing.length) {
      sheet.getRange(1, normalized.length + 1, 1, missing.length).setValues([missing]);
    }
  }
}

/** Mise en forme légère des onglets (ligne 1 figée + filtre + formats simples) */
function beautifySheet_(sheet, headers) {
  // Figer la ligne d’en-tête
  if (sheet.getFrozenRows() !== 1) sheet.setFrozenRows(1);

  // Appliquer un filtre si absent
  if (!sheet.getFilter()) {
    const range = sheet.getDataRange();
    if (range.getNumColumns() >= 1 && range.getNumRows() >= 1) {
      range.createFilter();
    }
  }

  // Formats simples Date/Heure si colonnes détectées
  const dateCols = detectColumns_(headers, ['DATE','CREATED_AT','UPDATED_AT','EMIS_AT','CONSENT_AT','VERIFIED_AT','MAJ_AT','CREE_AT','EXPIRES_AT','USED_AT','DERNIERE_MAJ']);
  dateCols.forEach(col => sheet.getRange(2, col, sheet.getMaxRows()-1, 1).setNumberFormat('yyyy-mm-dd hh:mm'));

  // Auto dimension mini sur la ligne d’en-tête
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setWrap(true);
}

/** Retourne les index (1-based) des colonnes dont l’en-tête contient un des tokens */
function detectColumns_(headers, tokens) {
  const idx = [];
  headers.forEach((h, i) => {
    const H = String(h).toUpperCase();
    if (tokens.some(t => H.indexOf(t) >= 0)) idx.push(i + 1);
  });
  return idx;
}

/** Utilitaire: construit une map en-tête → index (1-based) */
function getHeaderIndexMap(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const row = range.getValues()[0] || [];
  const map = {};
  row.forEach((v, i) => {
    const key = String(v || '').trim();
    if (key) map[key] = i + 1;
  });
  return map;
}
