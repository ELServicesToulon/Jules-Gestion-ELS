/**
 * shema.gs — Définition et contrôle du schéma Google Sheets
 * Projet : Pharmacie Livraison EHPAD — EL Services
 *
 * Ce fichier :
 *  - Déclare le schéma attendu (onglets & colonnes)
 *  - Vérifie l'existant et génère un rapport d'écarts (SCHEMA_RAPPORT)
 *  - Crée les onglets manquants, pose les en-têtes si vides, ajoute les colonnes manquantes
 *  - Propose des migrations (renommages d’onglets/colonnes)
 *
 * IMPORTANT :
 *  - Aucune suppression automatique n'est faite. Les suppressions/renommages sont listés
 *    dans SCHEMA_RAPPORT et peuvent être appliqués via applyMigrations().
 *  - Les tarifs/règles restent 100% pilotés par Config.gs (conforme à ta consigne).
 *
 * @OnlyCurrentDoc
 */

/* ========================================================================== */
/* 1) PARAMÈTRES & UTILITAIRES                                                */
/* ========================================================================== */

const CURRENCY_FORMAT = '#,##0.00 [$€-fr-FR]';
const DATE_FORMAT = 'dd/mm/yyyy';
const DATETIME_FORMAT = 'dd/mm/yyyy hh:mm';
const BOOL_LIST = ['TRUE', 'FALSE'];

/**
 * Définition du schéma attendu.
 * 12 onglets (correspondance avec tes liens fournis).
 *
 * Remarque : Noms d’onglets sans accents pour éviter les soucis Apps Script.
 */
function getSchema() {
  /** @type {Record<string, {headers:string[], validations?:Record<string,string[]>, formats?:Record<string,string>, primaryKey?:string}>} */
  const SCHEMA = {
    // 1
    'Config': {
      headers: ['CLE', 'VALEUR', 'DESCRIPTION'],
      primaryKey: 'CLE'
    },

    // 2
    'Clients': {
      headers: [
        'ID_CLIENT','TYPE_CLIENT','NOM_CLIENT','EMAIL','TELEPHONE',
        'ADRESSE','VILLE','CODE_POSTAL','SIRET','FACTURATION_EMAIL',
        'FACTURATION_ADRESSE','ACTIF','DATE_CREATION'
      ],
      validations: {
        'TYPE_CLIENT': ['EHPAD','Particulier','Pharmacie'],
        'ACTIF': BOOL_LIST
      },
      formats: {
        'DATE_CREATION': DATETIME_FORMAT
      },
      primaryKey: 'ID_CLIENT'
    },

    // 3
    'Destinataires': {
      headers: [
        'ID_DEST','ID_CLIENT','NOM_DEST','PRENOM_DEST','ETABLISSEMENT',
        'CHAMBRE','CONTACT_SUR_PLACE','COMMENTAIRE','ACTIF','DATE_CREATION'
      ],
      validations: { 'ACTIF': BOOL_LIST },
      formats: { 'DATE_CREATION': DATETIME_FORMAT },
      primaryKey: 'ID_DEST'
    },

    // 4
    'Reservations': {
      headers: [
        'ID_RES','DATE_RESERVATION','CRENEAU_DEBUT','CRENEAU_FIN',
        'ID_CLIENT','ID_DEST','TYPE_COURSE','PHARMACIE_NOM','ADRESSE_RETRAIT',
        'NB_ARRETS_SUP','OPTIONS','STATUT',
        'PRIX_HT','REMISE_HT','TOTAL_HT','TVA','TOTAL_TTC',
        'FACTURE_ID','COMMENTAIRE','DATE_CREATION','DERNIERE_MAJ'
      ],
      validations: {
        'TYPE_COURSE': ['Standard','Urgence','Samedi','Special'],
        'STATUT': ['Brouillon','Confirmee','En_tournee','Livree','Annulee']
      },
      formats: {
        'DATE_RESERVATION': DATE_FORMAT,
        'CRENEAU_DEBUT': DATETIME_FORMAT,
        'CRENEAU_FIN': DATETIME_FORMAT,
        'PRIX_HT': CURRENCY_FORMAT,
        'REMISE_HT': CURRENCY_FORMAT,
        'TOTAL_HT': CURRENCY_FORMAT,
        'TVA': CURRENCY_FORMAT,
        'TOTAL_TTC': CURRENCY_FORMAT,
        'DATE_CREATION': DATETIME_FORMAT,
        'DERNIERE_MAJ': DATETIME_FORMAT
      },
      primaryKey: 'ID_RES'
    },

    // 5
    'Tournees': {
      headers: [
        'ID_TOURNEE','DATE','LIVREUR','VEHICULE','ETAT',
        'NB_COURSES','DUREE_TOTALE_MIN','KM','COURSES_IDS','NOTE'
      ],
      validations: {
        'ETAT': ['Planifiee','En_cours','Terminee','Annulee']
      },
      formats: {
        'DATE': DATE_FORMAT
      },
      primaryKey: 'ID_TOURNEE'
    },

    // 6
    'Factures': {
      headers: [
        'ID_FACTURE','NUM_FACTURE','DATE_FACTURE',
        'ID_CLIENT','PERIODE_DEBUT','PERIODE_FIN','STATUT',
        'TOTAL_HT','TVA','TOTAL_TTC','MODE_PAIEMENT','RIB_IBAN',
        'LIEN_DRIVE','DATE_CREATION'
      ],
      validations: {
        'STATUT': ['Brouillon','Envoyee','Payee','Avoir','Annulee'],
        'MODE_PAIEMENT': ['Virement','Cheque']
      },
      formats: {
        'DATE_FACTURE': DATE_FORMAT,
        'PERIODE_DEBUT': DATE_FORMAT,
        'PERIODE_FIN': DATE_FORMAT,
        'TOTAL_HT': CURRENCY_FORMAT,
        'TVA': CURRENCY_FORMAT,
        'TOTAL_TTC': CURRENCY_FORMAT,
        'DATE_CREATION': DATETIME_FORMAT
      },
      primaryKey: 'ID_FACTURE'
    },

    // 7
    'LignesFacture': {
      headers: [
        'ID_LIGNE','ID_FACTURE','TYPE_LIGNE','DESCRIPTION',
        'QTE','PRIX_UNITAIRE_HT','TOTAL_LIGNE_HT'
      ],
      validations: {
        'TYPE_LIGNE': ['Course','Forfait','Remise','Avoir']
      },
      formats: {
        'PRIX_UNITAIRE_HT': CURRENCY_FORMAT,
        'TOTAL_LIGNE_HT': CURRENCY_FORMAT
      },
      primaryKey: 'ID_LIGNE'
    },

    // 8
    'Paiements': {
      headers: [
        'ID_PAIEMENT','ID_FACTURE','MONTANT_TTC','MODE_PAIEMENT',
        'DATE_PAIEMENT','REF_BANQUE','COMMENTAIRE'
      ],
      validations: {
        'MODE_PAIEMENT': ['Virement','Cheque']
      },
      formats: {
        'MONTANT_TTC': CURRENCY_FORMAT,
        'DATE_PAIEMENT': DATE_FORMAT
      },
      primaryKey: 'ID_PAIEMENT'
    },

    // 9
    'Tokens': {
      headers: [
        'ID_TOKEN','EMAIL','HASH','PAGE_DEST','EXPIRE_AT',
        'REDEEMED_AT','USED_IP','META_JSON','DATE_CREATION'
      ],
      validations: {
        'PAGE_DEST': ['client','admin']
      },
      formats: {
        'EXPIRE_AT': DATETIME_FORMAT,
        'REDEEMED_AT': DATETIME_FORMAT,
        'DATE_CREATION': DATETIME_FORMAT
      },
      primaryKey: 'ID_TOKEN'
    },

    // 10
    'Utilisateurs': {
      headers: ['EMAIL','ROLE','NOM','TELEPHONE','ACTIF','DATE_CREATION'],
      validations: {
        'ROLE': ['Admin','Livreur','Client'],
        'ACTIF': BOOL_LIST
      },
      formats: {
        'DATE_CREATION': DATETIME_FORMAT
      },
      primaryKey: 'EMAIL'
    },

    // 11
    'Logs': {
      headers: [
        'TIMESTAMP','NIVEAU','CONTEXTE','FUNCTION','USER_EMAIL',
        'MESSAGE','PAYLOAD_JSON'
      ],
      formats: { 'TIMESTAMP': DATETIME_FORMAT }
    },

    // 12 (le rapport est compté dans les 12 onglets)
    'SCHEMA_RAPPORT': {
      headers: ['FEUILLE','TYPE','DETAIL','ACTION','INFO'],
    }
  };

  return SCHEMA;
}

/**
 * Migrations proposées (renommages connus).
 * - Onglets : clés = ancien nom, valeurs = nouveau nom
 * - Colonnes : par onglet, clés = ancien, valeur = nouveau
 */
function getMigrations() {
  return {
    sheetRenames: {
      'Réservations': 'Reservations',
      'Tournées': 'Tournees',
      'Lignes_Facture': 'LignesFacture',
      'Paiement': 'Paiements'
    },
    columnRenames: {
      'Reservations': {
        'CLIENT_ID': 'ID_CLIENT',
        'DEST_ID': 'ID_DEST',
        'CRENEAU': 'CRENEAU_DEBUT',
        'PRIX': 'PRIX_HT',
        'TOTAL': 'TOTAL_TTC'
      },
      'Clients': {
        'CLIENT_TYPE': 'TYPE_CLIENT',
        'PHONE': 'TELEPHONE',
        'ZIP': 'CODE_POSTAL'
      },
      'Factures': {
        'TOTAL': 'TOTAL_TTC'
      }
    }
  };
}

/* ========================================================================== */
/* 2) FONCTIONS PUBLIQUES                                                     */
/* ========================================================================== */

/**
 * Génére un rapport complet des écarts schéma ↔ fichier actuel.
 * Le rapport est écrit dans l’onglet SCHEMA_RAPPORT.
 */
function schemaReport() {
  const ss = SpreadsheetApp.getActive();
  const schema = getSchema();
  const migrations = getMigrations();

  // Appliquer uniquement visuellement les migrations pour le diff (sans modifier la donnée)
  const visibleSheetNames = getAllSheetNamesWithVirtualRenames_(ss, migrations.sheetRenames);

  const expectedNames = Object.keys(schema);
  const reportRows = [];

  // Feuilles en trop / manquantes
  const extras = visibleSheetNames.filter(n => expectedNames.indexOf(n) === -1);
  const missing = expectedNames.filter(n => visibleSheetNames.indexOf(n) === -1);

  extras.forEach(n => reportRows.push([n, 'ONGLET_EN_TROP', 'Non présent dans le schéma', 'Supprimer ou Archiver', '']));
  missing.forEach(n => reportRows.push([n, 'ONGLET_MANQUANT', 'Devrait exister', 'Creer via ensureSchema()', '']));

  // Détails par onglet existant
  expectedNames.forEach(name => {
    if (name === 'SCHEMA_RAPPORT') return; // on ignore le rapport lui-même
    const sh = ss.getSheetByName(name) || ss.getSheetByName(getOriginalNameFromVirtual_(name, migrations.sheetRenames));
    if (!sh) return;

    const expectedHeaders = schema[name].headers;
    const currentHeaders = readHeaders_(sh);

    if (currentHeaders.length === 0) {
      reportRows.push([name, 'ENTETES_ABSENTES', '1ère ligne vide', 'Poser en-tetes', 'ensureSchema() les posera']);
      return;
    }

    const missingCols = expectedHeaders.filter(h => currentHeaders.indexOf(h) === -1);
    const extraCols = currentHeaders.filter(h => expectedHeaders.indexOf(h) === -1);

    if (missingCols.length) {
      reportRows.push([name, 'COLONNES_MANQUANTES', missingCols.join(', '), 'Ajouter', 'ensureSchema() les ajoute en fin']);
    }
    if (extraCols.length) {
      reportRows.push([name, 'COLONNES_EN_TROP', extraCols.join(', '), 'Supprimer', 'A faire manuellement après sauvegarde']);
    }

    const orderIssues = checkOrder_(expectedHeaders, currentHeaders);
    if (orderIssues) {
      reportRows.push([name, 'ORDRE_COLONNES', orderIssues, 'Reordonner', 'Optionnel mais conseillé']);
    }

    // Colonnes pouvant être renommées (décelées via migration)
    const colMigs = getMigrations().columnRenames[name] || {};
    const renamables = Object.keys(colMigs).filter(oldC => currentHeaders.indexOf(oldC) !== -1 && currentHeaders.indexOf(colMigs[oldC]) === -1);
    if (renamables.length) {
      const detail = renamables.map(oldC => `${oldC} → ${colMigs[oldC]}`).join(' | ');
      reportRows.push([name, 'RENOMMAGE_COLONNES_POSSIBLE', detail, 'applyMigrations()', 'Sécurisé (renomme l’entête)']);
    }
  });

  writeReport_(reportRows);
  return 'SCHEMA_RAPPORT mis à jour.';
}

/**
 * Crée les onglets manquants, pose les entêtes si absentes, ajoute les colonnes manquantes,
 * et applique formats + validations.
 * Ne supprime ni onglet ni colonne (sécurité).
 */
function ensureSchema() {
  const ss = SpreadsheetApp.getActive();
  const schema = getSchema();

  Object.keys(schema).forEach(name => {
    if (name === 'SCHEMA_RAPPORT') return;

    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.getSheetByName(name) || ss.insertSheet(name);
      sh.clear();
    }

    // En-têtes
    const expected = schema[name].headers;
    const current = readHeaders_(sh);

    if (current.length === 0) {
      // pose des en-têtes propres
      sh.getRange(1, 1, 1, expected.length).setValues([expected]);
      sh.setFrozenRows(1);
    } else {
      // ajoute manquantes en fin
      const missing = expected.filter(h => current.indexOf(h) === -1);
      if (missing.length) {
        sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      }
    }

    // Formats & validations
    applyFormatsAndValidations_(sh, schema[name]);
  });

  return 'Schema assuré (création/complétion effectuée).';
}

/**
 * Applique les migrations définies (renommage d’onglets et d’entêtes de colonnes).
 * Idempotent. Ne supprime pas de colonnes.
 */
function applyMigrations() {
  const ss = SpreadsheetApp.getActive();
  const { sheetRenames, columnRenames } = getMigrations();

  // Renommage d’onglets
  Object.keys(sheetRenames).forEach(oldName => {
    const sh = ss.getSheetByName(oldName);
    if (sh) {
      const newName = sheetRenames[oldName];
      if (!ss.getSheetByName(newName)) sh.setName(newName);
    }
  });

  // Renommage d’entêtes de colonnes
  Object.keys(columnRenames).forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    const map = columnRenames[sheetName];
    const headers = readHeaders_(sh);
    if (headers.length === 0) return;

    let changed = false;
    const renamed = headers.map(h => (map[h] ? map[h] : h));
    if (JSON.stringify(headers) !== JSON.stringify(renamed)) {
      sh.getRange(1, 1, 1, renamed.length).setValues([renamed]);
      changed = true;
    }
    if (changed) {
      // Optionnel: réappliquer validations/formats si renommage touche des clés
      const def = getSchema()[sheetName];
      if (def) applyFormatsAndValidations_(sh, def);
    }
  });

  return 'Migrations appliquées.';
}

/* ========================================================================== */
/* 3) AIDES INTERNES                                                          */
/* ========================================================================== */

function readHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  const values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  // trim
  return values.map(v => (typeof v === 'string' ? v.trim() : String(v).trim())).filter(v => v !== '');
}

function writeReport_(rows) {
  const ss = SpreadsheetApp.getActive();
  const name = 'SCHEMA_RAPPORT';
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();

  const headers = ['FEUILLE','TYPE','DETAIL','ACTION','INFO'];
  const all = [headers].concat(rows.length ? rows : [['(OK)','AUCUN_ECART','Le schéma correspond','—','—']]);
  sh.getRange(1,1,all.length,headers.length).setValues(all);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function checkOrder_(expected, current) {
  // Retourne une description si l’ordre diverge (uniquement pour info)
  const filtered = current.filter(c => expected.indexOf(c) !== -1);
  const same = JSON.stringify(filtered) === JSON.stringify(expected.slice(0, filtered.length));
  if (!same) {
    return `Ordre actuel: [${filtered.join(' | ')}]  ≠  Attendu: [${expected.join(' | ')}]`;
  }
  return '';
}

function applyFormatsAndValidations_(sh, def) {
  const headers = readHeaders_(sh);
  if (!headers.length) return;

  // Formats
  if (def.formats) {
    Object.keys(def.formats).forEach(h => {
      const idx = headers.indexOf(h);
      if (idx !== -1) {
        sh.getRange(2, idx + 1, Math.max(1, sh.getMaxRows() - 1)).setNumberFormat(def.formats[h]);
      }
    });
  }

  // Validations
  if (def.validations) {
    Object.keys(def.validations).forEach(h => {
      const idx = headers.indexOf(h);
      if (idx !== -1) {
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(def.validations[h], true)
          .setAllowInvalid(false)
          .build();
        sh.getRange(2, idx + 1, Math.max(1, sh.getMaxRows() - 1)).setDataValidation(rule);
      }
    });
  }

  // Gèle la 1re ligne si nécessaire
  if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);
}

function getAllSheetNamesWithVirtualRenames_(ss, sheetRenames) {
  const raw = ss.getSheets().map(s => s.getSheetName());
  // Appliquer un "masque" de renommage pour le diff
  return raw.map(n => sheetRenames[n] ? sheetRenames[n] : n);
}

function getOriginalNameFromVirtual_(virtual, sheetRenames) {
  // Retrouve un ancien nom à partir du "virtuel"
  const entries = Object.entries(sheetRenames);
  for (var i = 0; i < entries.length; i++) {
    const [oldN, newN] = entries[i];
    if (newN === virtual) return oldN;
  }
  return virtual;
}

/* ========================================================================== */
/* 4) RACCOURCIS DE CONFORT                                                   */
/* ========================================================================== */

/**
 * Exporte un JSON lisible du schéma attendu (check rapide côté Logs).
 */
function printSchema() {
  Logger.log(JSON.stringify(getSchema(), null, 2));
}

/**
 * Cherche les doublons possibles sur les colonnes "primaryKey" de chaque onglet.
 * Résultat en Logs.
 */
function reportPrimaryKeyDuplicates() {
  const ss = SpreadsheetApp.getActive();
  const schema = getSchema();

  Object.keys(schema).forEach(name => {
    if (name === 'SCHEMA_RAPPORT') return;
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const pk = schema[name].primaryKey;
    if (!pk) return;

    const headers = readHeaders_(sh);
    const pkIdx = headers.indexOf(pk);
    if (pkIdx === -1) {
      Logger.log(`[${name}] PrimaryKey "${pk}" introuvable`);
      return;
    }

    const values = sh.getRange(2, pkIdx + 1, Math.max(0, sh.getLastRow() - 1), 1).getValues().map(r => r[0]).filter(Boolean);
    const seen = new Set();
    const dups = new Set();
    values.forEach(v => { if (seen.has(v)) dups.add(v); else seen.add(v); });
    if (dups.size) Logger.log(`[${name}] Doublons PK: ${Array.from(dups).join(', ')}`);
  });

  return 'Vérification PK terminée (voir Logs).';
}
