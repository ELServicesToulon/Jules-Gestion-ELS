/**
 * Serveur — Endpoints Réservation + Auth (stubs alignés au front)
 * Version : 2025-08-20
 *
 * Couvre les appels attendus par l'UI :
 *  - verifierDisponibiliteRecurrence(itemDeBase)
 *  - rechercherClientParEmail(email)
 *  - envoyerDevisParEmail(donnees)
 *  - reserverPanier(panier, client)
 *
 * Hypothèses :
 *  - Variables globales (depuis Configuration.gs / PublicConfig.gs) :
 *    ID_CALENDRIER, NOM_ENTREPRISE, DUREE_BASE, HEURE_DEBUT_SERVICE,
 *    HEURE_FIN_SERVICE, INTERVALLE_CRENEAUX_MINUTES, DUREE_TAMPON_MINUTES,
 *    ADMIN_EMAIL, TARIFS, etc.
 *  - Helpers existants : formaterDateEnYYYYMMDD(date), formaterDateEnHHMM(date),
 *    obtenirCreneauxDisponiblesPourDate(dateString, duree, idAignorer?, events?),
 *    LOG_admin(), LOG_reservation(), getConfiguration().
 *
 * NB : ce fichier reste volontairement "safe" (aucune écriture tarifaire
 * côté serveur sans passer par TARIFS / Config). Vous pourrez durcir la
 * logique de calcul en branchant calculerPrixEtDureeServeur() si présent.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Utilitaires locaux
// ──────────────────────────────────────────────────────────────────────────────
function _parseHHhMM_(hhmm){ // "10h30" → {h:10,m:30}
  if(!hhmm) return {h:0,m:0};
  var p = String(hhmm).split('h');
  return { h: parseInt(p[0],10)||0, m: parseInt(p[1],10)||0 };
}
function _fmtFR_(date){ return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Europe/Paris', 'EEEE d MMMM yyyy'); }

function _ensureSheet_(name, headers){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if(sh.getLastRow()===0){ sh.appendRow(headers); sh.getRange(1,1,1,headers.length).setFontWeight('bold'); }
  return sh;
}

// Fallback si la lecture des plages bloquées n'est pas définie ailleurs
if (typeof obtenirPlagesBloqueesPourDate !== 'function') {
  function obtenirPlagesBloqueesPourDate(date){
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Plages_Bloquees');
    if(!sh) return [];
    var vals = sh.getDataRange().getValues(); if(vals.length<2) return [];
    var headers = vals[0];
    var iDate = headers.indexOf('Date');
    var iHD = headers.indexOf('Heure_Debut');
    var iHF = headers.indexOf('Heure_Fin');
    var out = [];
    for(var r=1;r<vals.length;r++){
      var d = vals[r][iDate]; var hd = vals[r][iHD]; var hf = vals[r][iHF];
      if(!(d instanceof Date) || !(hd instanceof Date) || !(hf instanceof Date)) continue;
      if (formaterDateEnYYYYMMDD(d) !== formaterDateEnYYYYMMDD(date)) continue;
      var s = new Date(d); s.setHours(hd.getHours(), hd.getMinutes(), 0, 0);
      var e = new Date(d); e.setHours(hf.getHours(), hf.getMinutes(), 0, 0);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) out.push({start:s,end:e});
    }
    return out;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 1) RÉCURRENCE — propose des créneaux pour les 4 prochaines occurrences hebdo
//    Entrée front : { date:"YYYY-MM-DD", startTime:"HHhMM", duree:Number }
//    Sortie : [ {dateISO, dateFormatee, original, creneau, status} ]
// ──────────────────────────────────────────────────────────────────────────────
function verifierDisponibiliteRecurrence(itemDeBase){
  try{
    if(!itemDeBase || !itemDeBase.date || !itemDeBase.startTime){ return []; }
    var baseDate = itemDeBase.date; // YYYY-MM-DD
    var duree = parseFloat(itemDeBase.duree||DUREE_BASE)||DUREE_BASE;
    var {h:hh, m:mm} = _parseHHhMM_(itemDeBase.startTime);

    // Construire 4 prochaines occurrences (hebdomadaires)
    var parts = baseDate.split('-').map(Number);
    var first = new Date(parts[0], parts[1]-1, parts[2], hh, mm, 0, 0);
    var out = [];
    for(var k=1;k<=4;k++){
      var d = new Date(first); d.setDate(d.getDate() + 7*k); // +1, +2, +3, +4 semaines
      var dateISO = formaterDateEnYYYYMMDD(d);
      var choix = obtenirCreneauxDisponiblesPourDate(dateISO, duree);
      var strPrefered = itemDeBase.startTime;
      var hasPrefered = Array.isArray(choix) && choix.indexOf(strPrefered) !== -1;
      var creneau = hasPrefered ? strPrefered : (choix && choix[0]) || null;
      out.push({
        dateISO: dateISO,
        dateFormatee: _fmtFR_(d),
        original: strPrefered,
        creneau: creneau,
        status: creneau ? (hasPrefered ? 'OK' : 'ALT') : 'CONFLIT'
      });
    }
    LOG_admin('RECURRENCE_CHECK','OK',{base:itemDeBase, results:out});
    return out;
  }catch(e){ LOG_admin('RECURRENCE_CHECK','ERR', e.toString()); return []; }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2) CLIENT — recherche par email (wrapping de la fonction existante si dispo)
// ──────────────────────────────────────────────────────────────────────────────
function rechercherClientParEmail(email){
  try{
    email = (email||'').trim().toLowerCase(); if(!email) return null;
    if (typeof obtenirInfosClientParEmail === 'function') {
      return obtenirInfosClientParEmail(email);
    }
    // Fallback lecture brute sur l'onglet Clients
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Clients'); if(!sh) return null;
    var vals = sh.getDataRange().getValues(); if(vals.length<2) return null;
    var h = vals[0];
    var idxEmail = h.indexOf('Email'); var idxNom = h.indexOf('NOM_CLIENT');
    var idxAdr = h.indexOf('Adresse'); var idxVille = h.indexOf('VILLE');
    var idxCP  = h.indexOf('CODE_POSTAL'); var idxSiret = h.indexOf('SIRET');
    for(var i=1;i<vals.length;i++){
      var row = vals[i]; if(String(row[idxEmail]).trim().toLowerCase()===email){
        return { email: row[idxEmail]||'', nom: row[idxNom]||'', adresse: row[idxAdr]||'', ville: row[idxVille]||'', codePostal: row[idxCP]||'', siret: row[idxSiret]||'' };
      }
    }
    return null;
  }catch(e){ LOG_admin('CLIENT_LOOKUP','ERR', e.toString()); return null; }
}

// ──────────────────────────────────────────────────────────────────────────────
// 3) DEVIS — trace + email simple (Doc/PDF à brancher ensuite)
//    Entrée attendue: { email, nom, items:[{date, startTime, duree, stops, retour, prix}], totalEstime }
// ──────────────────────────────────────────────────────────────────────────────
function envoyerDevisParEmail(donnees){
  try{
    var email = (donnees && donnees.email)||''; if(!email) return {ok:false, error:'EMAIL_REQUIRED'};
    var nom = (donnees && donnees.nom)||''; var items = (donnees && donnees.items)||[];
    var total = (donnees && donnees.totalEstime)||0;

    // 1) Enregistrer dans la feuille Devis
    var sh = _ensureSheet_('Devis', ['Timestamp','Email','Nom','Nb Items','Total Estime','Statut','Message','Request JSON','Doc_ID','Lien']);
    sh.appendRow([new Date(), email, nom, items.length, total, 'ENVOYÉ', '', JSON.stringify(donnees), '', '']);

    // 2) Envoyer e-mail résumé
    var lignes = items.map(function(it,i){ return (i+1)+') '+it.date+' '+(it.startTime||'--:--')+' · '+(it.duree||DUREE_BASE)+'min · arrêts:'+Math.max(0,(it.stops||1)-1)+' · retour:'+(it.retour?'oui':'non')+' · '+(Number(it.prix||0).toFixed(2))+'€'; });
    var html = '<p>Bonjour'+(nom?(' '+nom):'')+',</p>'+
               '<p>Voici votre devis estimatif :</p>'+
               '<pre>'+lignes.join('\n')+'</pre>'+
               '<p><strong>Total estimé : '+Number(total||0).toFixed(2)+' €</strong></p>'+
               '<p>TVA non applicable (Art. 293 B CGI). Paiement par virement ou chèque selon facture.</p>'+
               '<p>— '+(typeof NOM_ENTREPRISE!=='undefined'?NOM_ENTREPRISE:'EL Services Littoral')+'</p>';
    MailApp.sendEmail({to:email, subject:'Votre devis — EL Services', htmlBody:html, name:'EL Services'});

    LOG_admin('DEVIS_SEND','OK',{email:email, total:total});
    return {ok:true};
  }catch(e){ LOG_admin('DEVIS_SEND','ERR', e.toString()); return {ok:false, error:e.toString()}; }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4) RÉSERVATION — crée les événements Calendar + traces en feuille
//    Entrée: panier:[{date, startTime, duree, totalStops, returnToPharmacy, prix, details}], client:{email, nom}
// ──────────────────────────────────────────────────────────────────────────────
function reserverPanier(panier, client){
  try{
    panier = Array.isArray(panier)?panier:[]; if(!panier.length) return {ok:false, error:'EMPTY_CART'};
    var conf = (typeof getConfiguration==='function')?getConfiguration():{};
    var calId = conf.ID_CALENDRIER || (typeof ID_CALENDRIER!=='undefined'?ID_CALENDRIER:null);
    if(!calId) return {ok:false, error:'MISSING_CALENDAR_ID'};

    var shFact = _ensureSheet_('Facturation', ['Date','Client (Raison S. Client)','Client (Email)','Type','Détails','Note Interne','Lien Note','ID Réservation','Event ID','Statut','Montant','Type Remise Appliquée','Valeur Remise Appliquée','Tournée Offerte Appliquée','Valider','N° Facture','ID PDF']);

    var results = [];
    for(var i=0;i<panier.length;i++){
      var it = panier[i];
      var dateParts = String(it.date).split('-').map(Number);
      var hm = _parseHHhMM_(it.startTime);
      var start = new Date(dateParts[0], dateParts[1]-1, dateParts[2], hm.h, hm.m, 0, 0);
      var duree = parseFloat(it.duree||DUREE_BASE)||DUREE_BASE;
      var end = new Date(start.getTime() + duree*60000);

      // Recalcule serveur si possible
      var prix = Number(it.prix||0);
      if (typeof calculerPrixEtDureeServeur === 'function') {
        try{
          var calc = calculerPrixEtDureeServeur(it.totalStops||1, !!it.returnToPharmacy, formaterDateEnYYYYMMDD(start), it.startTime, client||{});
          if (calc && typeof calc.prix==='number') prix = calc.prix;
        }catch(_){ }
      }

      // Disponibilité serveur (une dernière fois)
      var libres = obtenirCreneauxDisponiblesPourDate(formaterDateEnYYYYMMDD(start), duree, null, null, panier.filter((p,idx)=>idx!==i));
      if (libres.indexOf(it.startTime)===-1){
        results.push({ok:false, error:'SLOT_NOT_AVAILABLE', item:it});
        continue;
      }

      // Création Calendar (API avancée)
      var event = {
        summary: (typeof NOM_ENTREPRISE!=='undefined'?NOM_ENTREPRISE:'EL Services')+' — Livraison pharmacie',
        description: (it.details||'') + '\nClient: '+(client&&client.nom?client.nom:'')+' <'+(client&&client.email?client.email:'')+'>',
        start: { dateTime: start.toISOString(), timeZone: 'Europe/Paris' },
        end:   { dateTime: end.toISOString(),   timeZone: 'Europe/Paris' }
      };
      var created = Calendar.Events.insert(event, calId);

      // ID réservation (UUID court)
      var idResa = Utilities.getUuid().split('-')[0] + '-' + (created && created.id ? created.id.split('@')[0] : Date.now());

      // Ecrire une ligne Facturation (trace opérationnelle)
      var detailsTxt = (it.details||('Tournée de '+duree+'min ('+Math.max(0,(it.totalStops||1)-1)+' arrêt(s) sup. retour: '+(it.returnToPharmacy?'oui':'non')+')'));
      shFact.appendRow([
        start, (client&&client.nom)||'', (client&&client.email)||'', 'Livraison',
        detailsTxt, '', '', idResa, created.id, 'Enregistrée',
        Number(prix)||0, '', '', '', true, '', ''
      ]);

      LOG_reservation(idResa, (client&&client.email)||'', 'Réservation créée', prix, 'OK');
      results.push({ok:true, idReservation:idResa, eventId:created.id, start: start, end: end, prix: prix});
    }

    var ok = results.every(function(r){ return r.ok; });
    return { ok: ok, results: results };
  }catch(e){ LOG_admin('RESERVER_PANIER','ERR', e.toString()); return {ok:false, error:e.toString()}; }
}

// ──────────────────────────────────────────────────────────────────────────────
// 5) AUTH — petit helper pour le front si besoin de ping session
// ──────────────────────────────────────────────────────────────────────────────
function pingSession(sessionId){
  try{
    if (typeof validateSession === 'function') return validateSession(sessionId);
    return { ok:false, error:'NO_VALIDATE_SESSION' };
  }catch(e){ return { ok:false, error:e.toString() }; }
}
