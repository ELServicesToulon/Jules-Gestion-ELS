/**
 * shema.gs — ALIGNEMENT NON DESTRUCTIF DES FEUILLES & EN-TETES
 * - Respecte 100% des intitulés déjà présents (aucun renommage).
 * - Pour chaque colonne logique, on définit une liste d'ALIASES (FR, EN, snake…).
 * - Si la feuille existe: on détecte les en-têtes présents et on n’ajoute que le manquant.
 * - Si la feuille n’existe pas: on la crée avec les intitulés FR (1er alias de chaque groupe).
 * - Ligne 1 figée + filtre auto.
 *
 * Lance: ensureSchemaAligned();  — puis consulte le diff dans View > Logs.
 */

const SCHEMA_VERSION = '2025-08-19-align-fr';

/**
 * ALIASES PAR FEUILLE
 * Chaque entrée = un groupe d’aliases pour *la même* colonne logique.
 * Le 1er alias est celui qu’on crée si la colonne est absente.
 * ⚠️ Rien n’est renommé si un alias est déjà présent: on respecte l’existant.
 */
const SCHEMA_ALIASES = {
  Clients: [
    ['CLIENT_ID','Id Client','ID Client','Client ID'],
    ['Type','TYPE'],
    ['Nom','NOM','Raison sociale'],
    ['Contact','CONTACT','Nom du contact'],
    ['Email','EMAIL','Courriel'],
    ['Téléphone','TELEPHONE','Phone','Tél'],
    ['Adresse 1','ADRESSE_1','Adresse'],
    ['Adresse 2','ADRESSE_2','Complément'],
    ['Code postal','CODE_POSTAL','CP'],
    ['Ville','VILLE'],
    ['Notes','NOTES'],
    ['Actif','ACTIF'],
    ['Date de création','DATE_CREATION','Créé le'],
    ['Lien magique','MAGIC_LINK','Magic Link'],
    ['Dernière connexion','DERNIERE_CONNEXION','Last Login']
  ],

  Destinataires: [
    ['DEST_ID','Id Destinataire','ID Destinataire'],
    ['CLIENT_ID','Id Client','ID Client'],
    ['Type destinataire','TYPE_DEST','Type'],
    ['Nom','NOM'],
    ['Étage','ETAGE'],
    ['Bâtiment','BATIMENT'],
    ['Infos accès','INFOS_ACCES','Accès/Code'],
    ['Contact sur site','CONTACT_SITE'],
    ['Téléphone site','TEL_SITE','Téléphone'],
    ['Fragile','FRAGILE'],
    ['Frigo','FRIGO'],
    ['Tampon','TAMPON'],
    ['Boîte scellée','BOITE_SCELLEE','Boite scellée'],
    ['Nb résidents sup','NB_RESIDENTS_SUP','Résidents +'],
    ['Commentaires','COMMENTAIRES','Notes']
  ],

  Reservations: [
    ['ID réservation','ID_RESERVATION','Id Reservation','ID Reservation'],
    ['Date','DATE'],
    ['Heure','HEURE'],
    ['Semaine','SEMAINE'],
    ['CLIENT_ID','Id Client'],
    ['DESTINATAIRE_ID','Id Destinataire'],
    ['Adresse retrait','ADRESSE_RETRAIT','Retrait - Adresse'],
    ['Adresse livraison','ADRESSE_LIVRAISON','Livraison - Adresse'],
    ['Ville','VILLE'],
    ['Zone','ZONE'],
    ['Distance (km)','DISTANCE_KM','Distance km'],
    ['Durée estimée (min)','DUREE_ESTIMEE_MIN','Durée min'],
    ['Nb arrêts','NB_ARRETS','Arrets'],
    ['Urgence','URGENCE'],
    ['Samedi','SAMEDI'],
    ['Forfait spécial','FORFAIT_SPECIAL'],
    ['Prix base HT','PRIX_BASE_HT','Base HT'],
    ['Remise HT','REMISE_HT'],
    ['Total HT','TOTAL_HT'],
    ['TVA','TVA'],
    ['Total TTC','TOTAL_TTC'],
    ['Statut','STATUT'],
    ['Mode paiement','MODE_PAIEMENT','Paiement'],
    ['FACTURE_ID','Id Facture','ID Facture'],
    ['Source','SOURCE'],
    ['Créé par','CREE_PAR','Créé par (email)'],
    ['Created at','CREATED_AT','Créé le'],
    ['Updated at','UPDATED_AT','MAJ le'],
    ['Commentaire','COMMENTAIRE','Notes']
  ],

  Tournees: [
    ['TOURNEE_ID','Id Tournée','ID Tournee'],
    ['Date','DATE'],
    ['Plage','PLAGE','Créneau'],
    ['Livreur','LIVREUR'],
    ['Véhicule','VEHICULE'],
    ['Statut','STATUT'],
    ['Nb courses','NB_COURSES'],
    ['Durée totale (min)','DUREE_TOTALE_MIN'],
    ['Km estimés','KM_ESTIMES','KM estimés'],
    ['Notes','NOTES']
  ],

  Tournee_Lignes: [
    ['TOURNEE_ID','Id Tournée'],
    ['Rang','RANG','Ordre'],
    ['RESERVATION_ID','Id Réservation'],
    ['Retrait ok','RETRAIT_OK'],
    ['Livrée ok','LIVREE_OK'],
    ['Anomalie','ANOMALIE'],
    ['Frigo','FRIGO'],
    ['Tampon','TAMPON'],
    ['Boîte scellée','BOITE_SCELLEE'],
    ['Extractions','EXTRACTIONS'],
    ['Nb résidents sup','NB_RESIDENTS_SUP'],
    ['Heure passage','HEURE_PASSAGE'],
    ['Signature','SIGNATURE'],
    ['Note','NOTE','Commentaires']
  ],

  Factures: [
    ['FACTURE_ID','Id Facture'],
    ['Numéro','NUMERO'],
    ['CLIENT_ID','Id Client'],
    ['Date facture','DATE_FACTURE'],
    ['Période du','PERIODE_DU'],
    ['Période au','PERIODE_AU'],
    ['Total HT','TOTAL_HT'],
    ['TVA','TVA'],
    ['Total TTC','TOTAL_TTC'],
    ['Statut','STATUT'],
    ['Lien PDF','LIEN_PDF'],
    ['Drive folder id','DRIVE_FOLDER_ID'],
    ['Émis par','EMIS_PAR'],
    ['Émis le','EMIS_AT']
  ],

  Facture_Lignes: [
    ['FACTURE_ID','Id Facture'],
    ['Ligne','LIGNE'],
    ['RESERVATION_ID','Id Réservation'],
    ['Description','DESCRIPTION'],
    ['Quantité','QUANTITE'],
    ['PU HT','PU_HT'],
    ['Remise HT','REMISE_HT'],
    ['Total ligne HT','TOTAL_LIGNE_HT'],
    ['Code tarif','CODE_TARIF'],
    ['Note','NOTE']
  ],

  Tokens: [
    ['TOKEN','Jeton'],
    ['Scope','SCOPE'],
    ['CLIENT_ID','Id Client'],
    ['Email','EMAIL'],
    ['Expire le','EXPIRES_AT'],
    ['Utilisé le','USED_AT'],
    ['Status','STATUS','Statut'],
    ['Créé le','CREATED_AT'],
    ['Créé par','CREATED_BY'],
    ['IP','IP adress'],
    ['User-Agent','USER_AGENT','UA']
  ],

  Consents_RGPD: [
    ['CLIENT_ID','Id Client'],
    ['Type','TYPE'],
    ['Version','VERSION'],
    ['Consent le','CONSENT_AT'],
    ['IP','IP'],
    ['User-Agent','USER_AGENT'],
    ['Note','NOTE']
  ],

  Calendrier: [
    ['Date','DATE'],
    ['Jour','JOUR'],
    ['Ouvert','OUVERT'],
    ['Plages (JSON)','PLAGES_JSON','Plages'],
    ['Capacité jour','CAPACITE_JOUR'],
    ['Remplissage %','REMPLISSAGE_PCT','Taux remplissage'],
    ['Commentaires','COMMENTAIRES','Notes']
  ],

  Maintenance: [
    ['Clé','CLE'],
    ['Valeur','VALEUR'],
    ['Commentaire','COMMENTAIRE'],
    ['MAJ le','MAJ_AT'],
    ['MAJ par','MAJ_PAR']
  ],

  Parrainage: [
    ['ID','Id'],
    ['PARRAIN_ID','Id Parrain'],
    ['Code','CODE'],
    ['Email filleul','FILLEUL_EMAIL'],
    ['FILLEUL_ID','Id Filleul'],
    ['Bonus HT','BONUS_HT'],
    ['Statut','STATUT'],
    ['Créé le','CREATED_AT'],
    ['Vérifié le','VERIFIED_AT'],
    ['Note','NOTE']
  ],

  Logs: [
    ['Horodatage','TIMESTAMP'],
    ['Niveau','LEVEL'],
    ['Message','MESSAGE'],
    ['Fonction','FUNCTION'],
    ['Utilisateur','USER'],
    ['Contexte (JSON)','CONTEXT_JSON']
  ],

  Verifications: [
    ['Type','TYPE'],
    ['Sujet id','SUJET_ID'],
    ['Cause','CAUSE'],
    ['Détails','DETAILS'],
    ['Créé le','CREE_AT'],
    ['Résolu','RESOLU'],
    ['Résolu le','RESOLU_AT'],
    ['Par','PAR']
  ],

  Tests: [
    ['Nom test','TEST_NAME'],
    ['OK','OK'],
    ['Durée (ms)','DUREE_MS'],
    ['Message','MESSAGE'],
    ['Date','DATE'],
    ['Env','ENV']
  ],

  // Optionnels, purement affichage (ne pas utiliser comme source de vérité tarifaire)
  Tarifs_UI: [
    ['Code','CODE'],
    ['Libellé','LIBELLE'],
    ['Base HT','BASE_HT'],
    ['Unité','UNITE'],
    ['Actif','ACTIF'],
    ['Note','NOTE']
  ],
  Docs_Admin: [
    ['Titre','TITRE'],
    ['Type doc','TYPE_DOC'],
    ['Lien Drive','DRIVE_LINK'],
    ['Dernière MAJ','DERNIERE_MAJ']
  ]
};

/** Entrée principale */
function ensureSchemaAligned() {
  const ss = SpreadsheetApp.getActive();
  const report = [];

  Object.keys(SCHEMA_ALIASES).forEach(sheetName => {
    const sh = getOrCreateSheet_(ss, sheetName);
    const before = readHeaderRow_(sh);
    const added = ensureHeadersByAliases_(sh, SCHEMA_ALIASES[sheetName], before);
    beautifySheet_(sh);

    report.push({
      sheet: sheetName,
      already_present: before.filter(Boolean),
      added_columns: added,
      final_headers: readHeaderRow_(sh)
    });
  });

  Logger.log(JSON.stringify({ ok:true, version: SCHEMA_VERSION, report }, null, 2));
  return { ok:true, version: SCHEMA_VERSION, report };
}

/** Crée ou récupère la feuille */
function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/** Lit la ligne 1 (en-têtes) */
function readHeaderRow_(sheet) {
  const lastCol = sheet.getLastColumn() || 0;
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || '').trim());
}

/**
 * Ajoute le manquant selon les alias, sans jamais renommer l’existant.
 * @returns {string[]} liste des colonnes ajoutées (libellé utilisé).
 */
function ensureHeadersByAliases_(sheet, aliasGroups, existingHeaders) {
  const present = new Set((existingHeaders || []).filter(Boolean).map(n => normalize_(n)));
  const toAppend = [];

  aliasGroups.forEach(group => {
    // group = ['Nom FR préféré', 'ALTERNATIVE_1', 'ALTERNATIVE_2', ...]
    const found = group.find(alias => present.has(normalize_(alias)));
    if (!found) {
      toAppend.push(group[0]); // on crée avec le 1er alias (FR)
      present.add(normalize_(group[0]));
    }
  });

  if (toAppend.length) {
    const startCol = (existingHeaders && existingHeaders.length) ? existingHeaders.length + 1 : 1;
    sheet.getRange(1, startCol, 1, toAppend.length).setValues([toAppend]);
  }
  return toAppend;
}

/** Mise en forme douce (ligne figée + filtre + gras) */
function beautifySheet_(sheet) {
  if (sheet.getFrozenRows() !== 1) sheet.setFrozenRows(1);
  if (!sheet.getFilter()) {
    const rng = sheet.getDataRange();
    if (rng.getNumRows() >= 1 && rng.getNumColumns() >= 1) rng.createFilter();
  }
  const lastCol = sheet.getLastColumn() || 0;
  if (lastCol > 0) sheet.getRange(1, 1, 1, lastCol).setFontWeight('bold').setWrap(true);
}

/** Normalisation tolérante (supprime accents/espace/underscores, majuscules) */
function normalize_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/\s|_/g, '')                             // espaces + underscores
    .toUpperCase();
}

/** Utilitaire: renvoie un map header->index (1-based), robuste aux accents/espaces */
function getHeaderIndexMap(sheet) {
  const headers = readHeaderRow_(sheet);
  const map = {};
  headers.forEach((h, i) => map[h] = i + 1);
  return map;
}

/** Rapport rapide sans modification */
function previewSchemaDiff() {
  const ss = SpreadsheetApp.getActive();
  const diff = Object.keys(SCHEMA_ALIASES).map(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    const existing = sh ? readHeaderRow_(sh).filter(Boolean) : [];
    const normalized = new Set(existing.map(normalize_));
    const missing = SCHEMA_ALIASES[sheetName]
      .filter(group => !group.some(alias => normalized.has(normalize_(alias))))
      .map(group => group[0]);
    return { sheet: sheetName, existing, missing, willCreateIfRun: missing };
  });
  Logger.log(JSON.stringify({ version: SCHEMA_VERSION, diff }, null, 2));
  return diff;
}
