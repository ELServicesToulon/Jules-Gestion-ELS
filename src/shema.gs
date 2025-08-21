/**
 * Schemas.gs — MAJ Utilitaires + Validation + Verification
 * Version : 2025-08-20-UVV
 *
 * Intègre les besoins détectés dans :
 *  - Utilitaires (formateurs de dates, docs, ICS, lien Agenda)
 *  - Validation (contrôle dur de la Config + alertes mail)
 *  - Verification (audit d'en-têtes via un objet global SCHEMAS)
 *
 * Rôle de ce fichier :
 *  - Définir le schéma complet des onglets (entêtes 1ère ligne).
 *  - Synchroniser/seed Paramètres (incl. ADRESSE_ENTREPRISE requise par Utilitaires).
 *  - Exposer un objet global `SCHEMAS` attendu par Verification.html.
 *  - Offrir des vérifs rapides (params requis, endpoints) et des helpers de seed (Devis, Docs Admin, Tarifs_Miroir).
 */

// =================================================================
// 0) MÉTADONNÉES
// =================================================================
const SCHEMA_VERSION = '2025-08-20-UVV';

// =================================================================
// 1) DÉFINITION DU SCHÉMA (ONGLETS + ENTÊTES)
// =================================================================
function SCHEMA_getDefinition(){
  return {
    // 1) Journaux (format Maintenance)
    'Admin_Logs': ['Timestamp','Utilisateur','Action','Statut','Détails'],
    'Logs':       ['Timestamp','Reservation ID','Client Email','Résumé','Montant','Statut','Utilisateur'],
    'Client_Activity': ['AT','EMAIL','EVENT','DETAILS','IP','USER_AGENT'],

    // 2) Référentiels
    'Clients': [
      'ID_CLIENT','TYPE_CLIENT','NOM_CLIENT','Email','TELEPHONE',
      'Raison Sociale','Contact','Adresse','Adresse 2','VILLE','CODE_POSTAL',
      'SIRET','TVA','FACTURATION_EMAIL','FACTURATION_ADRESSE',
      'Type de Remise','Valeur Remise','Nombre Tournées Offertes',
      'CodeParrainage','CodeUtilise','CreditParrainage','CodeBulle',
      'Lien magique','Dernière connexion','ACTIF','Notes','DATE_CREATION'
    ],
    'Pharmacies': ['ID_PHARMACIE','Nom','Adresse','Ville','Code Postal','Telephone','Email','Contact','Horaires','Zone','Actif','DATE_CREATION'],
    'EHPAD':      ['ID_EHPAD','Nom','Adresse','Ville','Code Postal','Telephone','Email','Contact','Nb Residents','Notes','Actif','DATE_CREATION'],
    'Livreurs':   ['ID_LIVREUR','Nom','Prenom','Telephone','Email','Vehicule','Statut','Documents','Notes','Actif','DATE_CREATION'],

    // 3) Authentification (sheets optionnels)
    'Magic_Tokens':  ['TOKEN','EMAIL','CLIENT_ID','ROLE','EXPIRES_AT','USED_AT','IP','CONTEXTE','CREATED_AT'],
    'Auth_Sessions': ['SESSION_ID','EMAIL','CREATED_AT','EXPIRES_AT','IP','USER_AGENT','INVALIDATED_AT'],

    // 4) Réservations & planif
    'Reservations': [
      'ID_RESERVATION','STATUT','Created At','Updated At',
      'DATE_RESERVATION','Heure','JOUR','CRENEAU','Type Course','Urgence','Recurrent',
      'ID_CLIENT','Nom','Email','Telephone','Adresse','Ville','Code Postal','SIRET',
      'ID_EHPAD','ID_PHARMACIE','Type Livraison','Retour Pharmacie',
      'Nb Arrets','Duree (min)','KM Estimes','Montant HT','TVA','Montant TTC','Remise Code','Remise Montant',
      'PanierItemID','Commentaires'
    ],
    'Tournees': ['ID_TOURNEE','Date','Livreur_ID','Vehicule','Parcours','Nb Livraisons','Duree Estimee (min)','Kilometrage','Statut','Note Livreur','Created At','Updated At'],
    'Plages_Bloquees': ['Date','Heure_Debut','Heure_Fin','Motif','Cree_Par','Created_At'],

    // 5) Facturation & documents
    'Facturation': [
      'Date','Client (Raison S. Client)','Client (Email)','Type',
      'Détails','Note Interne','Lien Note',
      'ID Réservation','Event ID','Statut',
      'Montant','Type Remise Appliquée','Valeur Remise Appliquée','Tournée Offerte Appliquée',
      'Valider','N° Facture','ID PDF'
    ],
    'Factures': ['ID_FACTURE','NUMERO','ID_RESERVATION','ID_CLIENT','DATE_FACTURE','MONTANT_HT','TVA','MONTANT_TTC','REMISE','LIEN_PDF','STATUT','ENVOYEE_A','ARCHIVE_PATH','DATE_CREATION'],
    'Documents_Admin': ['Nom','Type','Drive_ID','URL','Visible','DATE_CREATION'],

    // 6) Devis (trace des envois)
    'Devis': ['Timestamp','Email','Nom','Nb Items','Total Estime','Statut','Message','Request JSON','Doc_ID','Lien'],

    // 7) Paramètres lisibles (source vérité = Configuration.gs)
    'Paramètres': ['Paramètre','Valeur'],

    // 8) Tarifs (miroir lecture seule)
    'Tarifs_Miroir': ['Type','Base','Arret_2','Arret_3','Arret_4','Arret_5','Arret_6_plus','Last Sync']
  };
}

// Expose l'objet global attendu par Verification.html
var SCHEMAS = (function(){ try { return SCHEMA_getDefinition(); } catch(e){ return {}; } })();

// =================================================================
// 2) ACCÈS / AUDIT / SYNC
// =================================================================
function SCHEMA_getSpreadsheet_(){ return SpreadsheetApp.getActiveSpreadsheet(); }

function SCHEMA_ensureAllSheets(){
  const ss = SCHEMA_getSpreadsheet_();
  const def = SCHEMA_getDefinition();
  Object.keys(def).forEach(name => SCHEMA_syncSheet_(ss, name, def[name]));
  try { SCHEMA_seedParameters_(ss); } catch(e){ LOG_admin('SCHEMA_SEED_PARAMS','WARN', e.toString()); }
  try { SCHEMA_seedDevisSheet_(ss); } catch(e){ LOG_admin('SCHEMA_SEED_DEVIS','WARN', e.toString()); }
  try { SCHEMA_seedDocumentsAdmin_(ss); } catch(e){ LOG_admin('SCHEMA_SEED_DOCS_ADMIN','WARN', e.toString()); }
  return `OK — Schéma synchronisé (${SCHEMA_VERSION}).`;
}

function SCHEMA_validateAll(){
  const ss = SCHEMA_getSpreadsheet_(); const def = SCHEMA_getDefinition(); const report = {};
  Object.keys(def).forEach(name => {
    const sh = ss.getSheetByName(name);
    report[name] = sh ? SCHEMA_diffSheet_(sh, def[name]) : { missingSheet:true, missing:def[name], extra:[], orderMismatch:false };
  });
  return report;
}

function SCHEMA_syncSheet_(ss,name,expected){
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const lastCol = sh.getLastColumn(); const headers = lastCol>0 ? sh.getRange(1,1,1,lastCol).getValues()[0] : [];
  if(headers.length===0){ sh.getRange(1,1,1,expected.length).setValues([expected]); sh.getRange(1,1,1,expected.length).setFontWeight('bold'); return; }
  const missing = expected.filter(h=>!headers.includes(h));
  if(missing.length){ sh.insertColumnsAfter(lastCol||1, missing.length); sh.getRange(1,(lastCol||1)+1,1,missing.length).setValues([missing]).setFontWeight('bold'); }
  const extra = headers.filter(h=>h && !expected.includes(h)); if(extra.length){ LOG_admin('SCHEMA_SYNC_WARN','Extras conservés',{sheet:name,extra}); }
}

function SCHEMA_diffSheet_(sheet,expected){
  const lastCol = sheet.getLastColumn(); const headers = lastCol>0 ? sheet.getRange(1,1,1,lastCol).getValues()[0] : [];
  const missing = expected.filter(h=>!headers.includes(h));
  const extra = headers.filter(h=>h && !expected.includes(h));
  const orderMismatch = expected.some((h,i)=>headers[i]!==h);
  return { missing, extra, orderMismatch };
}

// =================================================================
// 3) LOGS (compatibles Maintenance)
// =================================================================
function LOG_admin(action, statut, details){
  try{
    const ss = SCHEMA_getSpreadsheet_(); const sh = ss.getSheetByName('Admin_Logs')||ss.insertSheet('Admin_Logs');
    if(sh.getLastRow()===0){ sh.appendRow(['Timestamp','Utilisateur','Action','Statut','Détails']); sh.getRange(1,1,1,5).setFontWeight('bold'); }
    const user = (typeof Session!=='undefined' && Session.getActiveUser)?(Session.getActiveUser().getEmail()||''):'';
    sh.appendRow([new Date(), user, action, statut, JSON.stringify(details||{})]);
  }catch(e){ Logger.log(`Impossible de journaliser l'action admin : ${e}`); }
}

function LOG_reservation(idReservation, emailClient, resume, montant, statut){
  try{
    const ss = SCHEMA_getSpreadsheet_(); const sh = ss.getSheetByName('Logs')||ss.insertSheet('Logs');
    if(sh.getLastRow()===0){ sh.appendRow(['Timestamp','Reservation ID','Client Email','Résumé','Montant','Statut','Utilisateur']); sh.getRange(1,1,1,7).setFontWeight('bold'); }
    const user = (typeof Session!=='undefined' && Session.getActiveUser)?(Session.getActiveUser().getEmail()||''):'';
    sh.appendRow([new Date(), idReservation||'', emailClient||'', resume||'', montant||'', statut||'', user]);
  }catch(e){ Logger.log(`Impossible de journaliser l'activité réservation : ${e}`); }
}

// =================================================================
// 4) PARAMÈTRES — SEED & CHECKS (incl. Utilitaires/Validation)
// =================================================================
function SCHEMA_seedParameters_(ss){
  const sh = ss.getSheetByName('Paramètres')||ss.insertSheet('Paramètres');
  if(sh.getLastRow()===0) sh.appendRow(['Paramètre','Valeur']);
  const defaults = [
    // Général / Entreprise
    ['Prochain numéro de facture',1],
    ['NOM_ENTREPRISE',''], ['EMAIL_ENTREPRISE',''], ['ADMIN_EMAIL',''], ['SIRET',''],
    ['ADRESSE_ENTREPRISE',''], ['RIB_ENTREPRISE',''], ['BIC_ENTREPRISE',''],
    // Webapp/Auth
    ['WEBAPP_URL',''], ['TOKEN_TTL_MINUTES',15], ['SESSION_TTL_HOURS',12],
    // Calendrier & règles
    ['ID_CALENDRIER',''], ['HEURE_DEBUT_SERVICE','08:00'], ['HEURE_FIN_SERVICE','19:00'], ['INTERVALLE_CRENEAUX_MINUTES',30], ['DUREE_TAMPON_MINUTES',10],
    // Estimations durée/km
    ['DUREE_BASE',45], ['DUREE_ARRET_SUP',15], ['KM_BASE',10], ['KM_ARRET_SUP',3],
    // Urgences / TVA / Paiement
    ['URGENT_THRESHOLD_MINUTES',45], ['TVA_APPLICABLE',false], ['TAUX_TVA',0.2], ['DELAI_PAIEMENT_JOURS',5],
    // Documents (Validation + Section Docs Admin)
    ['ID_DOSSIER_ARCHIVES',''], ['ID_DOSSIER_TEMPORAIRE',''], ['ID_MODELE_FACTURE',''], ['ID_FEUILLE_CALCUL',''], ['ID_DOCUMENT_CGV',''],
    ['DOC_KBIS_ID',''], ['DOC_RIB_ID',''], ['DOCS_PUBLIC_FOLDER_ID','']
  ];
  defaults.forEach(([k,v])=>PARAM_upsert_(sh,k,v,true));
}

function PARAM_upsert_(sh,key,value,onlyIfEmpty){
  const rng = sh.getRange(1,1,Math.max(1,sh.getLastRow()),2); const vals = rng.getValues();
  const idx = vals.findIndex(r=>String(r[0]).trim()===key);
  if(idx===-1){ sh.appendRow([key,value]); return; }
  if(onlyIfEmpty){ const cur = sh.getRange(idx+1,2).getValue(); if(cur===''||cur===null) sh.getRange(idx+1,2).setValue(value); }
  else { sh.getRange(idx+1,2).setValue(value); }
}

function SCHEMA_seedDevisSheet_(ss){
  const sh = ss.getSheetByName('Devis') || ss.insertSheet('Devis');
  if (sh.getLastRow()===0){ sh.appendRow(['Timestamp','Email','Nom','Nb Items','Total Estime','Statut','Message','Request JSON','Doc_ID','Lien']); sh.getRange(1,1,1,10).setFontWeight('bold'); }
}

function SCHEMA_seedDocumentsAdmin_(ss){
  const sh = ss.getSheetByName('Documents_Admin') || ss.insertSheet('Documents_Admin');
  if (sh.getLastRow()===0){ sh.appendRow(['Nom','Type','Drive_ID','URL','Visible','DATE_CREATION']); sh.getRange(1,1,1,6).setFontWeight('bold'); }
  const params = _readParamsAsMap_(ss);
  if(params.DOC_KBIS_ID){ _upsertDocumentAdmin_(sh, { Nom:'Extrait KBIS', Type:'KBIS', Drive_ID:params.DOC_KBIS_ID, URL:_gview_(params.DOC_KBIS_ID), Visible:true }); }
  if(params.DOC_RIB_ID){ _upsertDocumentAdmin_(sh, { Nom:'RIB', Type:'RIB', Drive_ID:params.DOC_RIB_ID, URL:_gview_(params.DOC_RIB_ID), Visible:true }); }
}

function _gview_(id){ return `https://drive.google.com/file/d/${id}/view?usp=sharing`; }
function _readParamsAsMap_(ss){
  const sh = ss.getSheetByName('Paramètres'); if(!sh) return {};
  const vals = sh.getRange(1,1,sh.getLastRow(),2).getValues();
  return Object.fromEntries(vals.map(r=>[String(r[0]).trim(), r[1]]));
}
function _upsertDocumentAdmin_(sh, obj){
  const lastRow = Math.max(1, sh.getLastRow());
  const vals = sh.getRange(1,1,lastRow,6).getValues();
  const headers = vals[0];
  const idxType = headers.indexOf('Type');
  let rowIndex = -1;
  for(let i=1;i<vals.length;i++){ if(String(vals[i][idxType]).trim() === String(obj.Type).trim()){ rowIndex = i+1; break; } }
  const row = [obj.Nom||'', obj.Type||'', obj.Drive_ID||'', obj.URL||'', obj.Visible===false?false:true, new Date()];
  if(rowIndex === -1){ sh.appendRow(row); }
  else { sh.getRange(rowIndex,1,1,6).setValues([row]); }
}

function SCHEMA_checkRequiredParams(){
  const required = ['ADMIN_EMAIL','SIRET','ADRESSE_ENTREPRISE','ID_CALENDRIER','HEURE_DEBUT_SERVICE','HEURE_FIN_SERVICE','INTERVALLE_CRENEAUX_MINUTES','DUREE_TAMPON_MINUTES','DUREE_BASE','TOKEN_TTL_MINUTES','SESSION_TTL_HOURS','URGENT_THRESHOLD_MINUTES'];
  const ss = SCHEMA_getSpreadsheet_(); const sh = ss.getSheetByName('Paramètres'); const missing=[];
  if(!sh) return { ok:false, missing: required };
  const map = Object.fromEntries(sh.getRange(1,1,sh.getLastRow(),2).getValues().map(r=>[String(r[0]).trim(), r[1]]));
  required.forEach(k=>{ if(map[k]===undefined||map[k]==='') missing.push(k); });
  const ok = missing.length===0; LOG_admin('PARAMS_CHECK', ok?'OK':'MISSING',{missing}); return { ok, missing };
}

// Pré-vérif dédiée à Validation.html (mêmes clés que validerConfiguration())
function SCHEMA_checkValidationPrereqs(){
  const mustExist = ['ADMIN_EMAIL','SIRET','ID_DOSSIER_ARCHIVES','ID_DOSSIER_TEMPORAIRE','ID_MODELE_FACTURE','ID_FEUILLE_CALCUL','ID_DOCUMENT_CGV','ID_CALENDRIER'];
  const ss = SCHEMA_getSpreadsheet_(); const sh = ss.getSheetByName('Paramètres'); const missing=[];
  if(!sh) return { ok:false, missing: mustExist };
  const map = Object.fromEntries(sh.getRange(1,1,sh.getLastRow(),2).getValues().map(r=>[String(r[0]).trim(), r[1]]));
  mustExist.forEach(k=>{ if(map[k]===undefined||map[k]==='') missing.push(k); });
  const ok = missing.length===0; LOG_admin('VALIDATION_PREREQ', ok?'OK':'MISSING',{missing}); return { ok, missing };
}

// =================================================================
// 5) TARIFS — MIROIR (lecture seule de TARIFS{})
// =================================================================
function SCHEMA_refreshTarifsMirror_(){
  const ss = SCHEMA_getSpreadsheet_(); const sh = ss.getSheetByName('Tarifs_Miroir')||ss.insertSheet('Tarifs_Miroir');
  const headers = ['Type','Base','Arret_2','Arret_3','Arret_4','Arret_5','Arret_6_plus','Last Sync'];
  sh.clear(); sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
  try{
    // @ts-ignore
    const T = (typeof TARIFS !== 'undefined') ? TARIFS : null;
    if(!T){ sh.appendRow(['—','—','—','—','—','—','—', new Date()]); return 'WARN — TARIFS{} introuvable.'; }
    const rows = Object.keys(T).map(type=>{
      const base = T[type]?.base ?? '';
      const arr = Array.isArray(T[type]?.arrets) ? T[type].arrets : [];
      return [type, base, arr[0]??'', arr[1]??'', arr[2]??'', arr[3]??'', arr[4]??'', new Date()];
    });
    if(rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
    return `OK — ${rows.length} lignes sync.`;
  }catch(e){ LOG_admin('TARIFS_MIRROR_ERR','ERR', e.toString()); return `ERR — ${e}`; }
}

// =================================================================
// 6) VÉRIFS ENDPOINTS (Réservation & Token/Session & PublicConfig)
// =================================================================
function SCHEMA_checkReservationEndpoints(){
  const needed = [
    // Calendrier
    'obtenirDonneesCalendrierPublic',
    'obtenirCreneauxDisponiblesPourDate',
    'verifierDisponibiliteRecurrence',
    // Client
    'rechercherClientParEmail',
    // Devis / Réservation
    'envoyerDevisParEmail',
    'reserverPanier'
  ];
  const report = Object.fromEntries(needed.map(k=>[k, (function(){ try{ /* @ts-ignore */ return typeof this[k] === 'function'; }catch(_){ return false; } })()]));
  LOG_admin('ENDPOINTS_CHECK','OK', report); return report;
}

function SCHEMA_checkAuthTokenEndpoints(){
  const needed = ['createMagicToken','validateAndConsumeToken','createSession','validateSession','destroySession'];
  const report = Object.fromEntries(needed.map(k=>[k, (function(){ try{ /* @ts-ignore */ return typeof this[k] === 'function'; }catch(_){ return false; } })()]));
  LOG_admin('TOKEN_ENDPOINTS_CHECK','OK', report); return report;
}

function SCHEMA_checkPublicConfig(){
  const key = 'getPublicConfig';
  let ok=false; try{ /* @ts-ignore */ ok = (typeof this[key] === 'function'); }catch(_){ ok=false; }
  const rep = { getPublicConfig: ok };
  LOG_admin('PUBLICCONFIG_CHECK','OK', rep); return rep;
}

// =================================================================
// 7) MIGRATIONS (renommages doux)
// =================================================================
function SCHEMA_migrate(){
  const ss = SCHEMA_getSpreadsheet_(); const out = [];
  out.push(_renameHeaderIfExists_(ss,'Admin_Logs','Horodatage','Timestamp'));
  out.push(_renameHeaderIfExists_(ss,'Logs','Horodatage','Timestamp'));
  out.push(_renameHeaderIfExists_(ss,'Logs','Reservation_ID','Reservation ID'));
  out.push(_renameHeaderIfExists_(ss,'Logs','Email','Client Email'));
  out.push(_renameHeaderIfExists_(ss,'Facturation','Type Course','Type'));
  out.push(_renameHeaderIfExists_(ss,'Clients','type Remise','Type de Remise'));
  out.push(_renameHeaderIfExists_(ss,'Plages_Bloquees','HEURE_DEBUT','Heure_Debut'));
  out.push(_renameHeaderIfExists_(ss,'Plages_Bloquees','HEURE_FIN','Heure_Fin'));
  out.push(_renameHeaderIfExists_(ss,'Plages_Bloquees','CREE_PAR','Cree_Par'));
  out.push(_renameHeaderIfExists_(ss,'Plages_Bloquees','CREATED_AT','Created_At'));
  LOG_admin('SCHEMA_MIGRATE','OK',{changes: out.filter(Boolean)});
  return out.filter(Boolean);
}

function _renameHeaderIfExists_(ss, sheetName, oldName, newName){
  const sh = ss.getSheetByName(sheetName); if(!sh) return null;
  const lastCol = sh.getLastColumn(); if(!lastCol) return null;
  const headers = sh.getRange(1,1,1,lastCol).getValues()[0];
  const idx = headers.indexOf(oldName); if(idx===-1) return null;
  sh.getRange(1, idx+1).setValue(newName); return { sheet: sheetName, from: oldName, to: newName };
}

// =================================================================
// 8) MENUS (à appeler depuis votre onOpen() principal)
// =================================================================
function SCHEMA_attachMenu(){
  try{
    SpreadsheetApp.getUi()
      .createMenu('⚙️ Schéma')
      .addItem('✅ Synchroniser tous les onglets','SCHEMA_ensureAllSheets')
      .addItem('🔎 Auditer le schéma','SCHEMA__DEBUG_AUDIT')
      .addItem('🧷 Vérifier Paramètres requis','SCHEMA_checkRequiredParams')
      .addItem('🛡️ Valider configuration (Validation)','validerConfiguration')
      .addItem('📋 Vérifier en-têtes (Verification)','lancerVerificationManuelle')
      .addItem('🧩 Appliquer migrations (renommages)','SCHEMA_migrate')
      .addItem('💶 Rafraîchir miroir TARIFS','SCHEMA_refreshTarifsMirror_')
      .addItem('📌 Vérifier endpoints Réservation','SCHEMA_checkReservationEndpoints')
      .addItem('🔑 Vérifier Token/Session','SCHEMA_checkAuthTokenEndpoints')
      .addItem('📄 Seed docs admin (KBIS/RIB)','SCHEMA_seedDocumentsAdmin_')
      .addItem('🧪 Vérifier getPublicConfig()','SCHEMA_checkPublicConfig')
      .addToUi();
  }catch(e){}
}

// =================================================================
// 9) DEBUG / EXPORT
// =================================================================
function SCHEMA__DEBUG_AUDIT(){ const r=SCHEMA_validateAll(); LOG_admin('SCHEMA_AUDIT','OK',r); return r; }
function SCHEMA_dumpJSON(){ return JSON.stringify({version:SCHEMA_VERSION, schema:SCHEMA_getDefinition()}, null, 2); }

// Aliases utiles (UI Admin)
function schemaReport(){ return SCHEMA_validateAll(); }
function ensureSchema(){ return SCHEMA_ensureAllSheets(); }
function applyMigrations(){ return SCHEMA_migrate(); }

