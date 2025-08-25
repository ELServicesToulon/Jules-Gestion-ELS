// # sourceURL=Reservation_JS.js
// =================================================================
// FICHIER JAVASCRIPT CONSOLIDÉ POUR L'INTERFACE DE RÉSERVATION
// =================================================================
// Dépendances côté serveur Apps Script (google.script.run) :
// - getTarifsPublic() -> { ok:boolean, tarifs:{...}, reservation:{...}, errors?:string[] }
// - getPlanningMois(isoAnchor:string) -> Array<{date:"YYYY-MM-DD", disponible:boolean}>
// - getAvailableSlots(dayISO:string, nbArrets:number)
//      -> Array<{ timeRange:string, basePrice:number, tags?:string[] }>
//
// Côté DOM, voir la section "Contrat DOM" en fin de fichier.
// =================================================================


// =================================================================
// UTILITAIRES DE DATE (locale, Europe/Paris-safe)
// =================================================================
function pad2(n){ return String(n).padStart(2, '0'); }
function isoLocalFromDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function dateFromISOLocal(iso){ // "YYYY-MM-DD"
  const [y,m,day] = iso.split('-').map(Number);
  const d = new Date(y, (m-1), day, 12, 0, 0, 0); // 12:00 pour éviter TZ edge-cases
  d.setHours(0,0,0,0);
  return d;
}
function stripTime_(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function isSameDay_(a,b){ return stripTime_(a).getTime() === stripTime_(b).getTime(); }

// =================================================================
// UI DE NOTIFICATION / SPINNER
// =================================================================
function afficherNotification(message, type){
  type = type || "info";
  const conteneur = document.getElementById('conteneur-notifications');
  if (!conteneur) { console.warn("[UI] conteneur-notifications manquant"); return; }
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = message;
  conteneur.appendChild(n);
  setTimeout(()=> n.remove(), 5000);
}

function basculerIndicateurChargement(afficher){
  const el = document.getElementById('indicateur-chargement');
  if (!el) { if (afficher) console.warn("[UI] indicateur-chargement manquant"); return; }
  el.classList.toggle('hidden', !afficher);
}

function afficherErreur(erreur){
  basculerIndicateurChargement(false);
  const msg = (erreur && erreur.message) ? erreur.message : String(erreur);
  afficherNotification(`Erreur : ${msg}`, "erreur");
  console.error(erreur);
}

// =================================================================
// ETAT GLOBAL & PANIER
// =================================================================
window.etat = window.etat || { panier: [], clientReconnu: null };

function sauvegarderPanierDansLocalStorage(){
  try { localStorage.setItem('panierReservationELS', JSON.stringify(window.etat.panier||[])); }
  catch(e){ console.warn("localStorage indisponible", e); }
}
function chargerPanierDepuisLocalStorage(){
  try {
    const raw = localStorage.getItem('panierReservationELS');
    window.etat.panier = raw ? JSON.parse(raw) : [];
  } catch(e){
    console.warn("localStorage indisponible", e);
    window.etat.panier = [];
  }
  afficherPanier();
}

function afficherPanier(){
  const panier = window.etat.panier || [];
  const liste = document.getElementById('liste-panier');
  const pied  = document.getElementById('panier-pied-de-page');
  const totEl = document.getElementById('panier-total-valeur');
  if (!liste || !pied || !totEl) return;

  if (!panier.length){
    liste.innerHTML = '<p class="panier-vide">Votre panier est vide.</p>';
    pied.classList.add('hidden');
    return;
  }
  const html = panier.map(item=>{
    const d = dateFromISOLocal(item.date);
    const df = d.toLocaleDateString('fr-FR', { day:'numeric', month:'long' });
    return `
      <li class="item-panier" data-id-item="${item.id}">
        <div class="item-panier-infos">
          <strong>Le ${df} à ${item.startTime}</strong>
          <small>${item.details||''}</small>
        </div>
        <div class="item-panier-actions">
          <span class="item-panier-prix">${(item.prix||0).toFixed(2)} €</span>
          <button class="item-panier-supprimer" aria-label="Supprimer cet article" type="button">&times;</button>
        </div>
      </li>`;
  }).join('');
  liste.innerHTML = html;

  const total = panier.reduce((acc,it)=> acc + (Number(it.prix)||0), 0);
  totEl.textContent = `${total.toFixed(2)} €`;
  pied.classList.remove('hidden');
}

function gererActionsPanier(e){
  const btn = e.target;
  if (!(btn && btn.classList && btn.classList.contains('item-panier-supprimer'))) return;
  const li = btn.closest('.item-panier'); if (!li) return;
  const id = li.dataset.idItem;
  window.etat.panier = (window.etat.panier||[]).filter(it=> it.id !== id);
  afficherPanier();
  sauvegarderPanierDansLocalStorage();
  afficherNotification("Tournée retirée du panier.", "info");
}

// =================================================================
// CALENDRIER MENSUEL
// =================================================================
let dateAffichee = new Date();

function initCalendrier(planning, cfg){
  // Cartes tarifs
  (function(){
    const tarifs = cfg && cfg.tarifs;
    const eBase    = document.getElementById('tarif-base');
    const eArrets  = document.getElementById('tarif-paliers');
    const eOptions = document.getElementById('tarif-options');
    if (!tarifs) return;

    const euros = n => (typeof n === 'number')
      ? new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n)
      : '—';

    if (eBase)   eBase.textContent   = `À partir de ${euros(tarifs.base)} la course.`;
    if (eArrets) eArrets.textContent = `+${euros(tarifs.arrets.prix_palier)} / arrêt jusqu'à ${tarifs.arrets.palier_max_inclus}, puis +${euros(tarifs.arrets.prix_apres)}.`;

    if (eOptions) {
      const parts = [];
      if (tarifs.options?.urgence?.actif) parts.push(`Urgence +${euros(tarifs.options.urgence.surcharge)}`);
      if (tarifs.options?.samedi?.actif)  parts.push(`Samedi +${euros(tarifs.options.samedi.surcharge)}`);
      eOptions.textContent = parts.length ? parts.join(', ') : "Aucune option spéciale.";
    }
  })();

  const btnReserver = document.getElementById('btn-reserver');
  if (btnReserver) btnReserver.addEventListener('click', ()=> openReservationModal(isoLocalFromDate(new Date())));

  renderCalendrier(planning);

  const prev = document.getElementById('btn-mois-precedent');
  const next = document.getElementById('btn-mois-suivant');
  if (prev) prev.onclick = ()=> changerMois(-1);
  if (next) next.onclick = ()=> changerMois(1);
}

function renderCalendrier(planning){
  const grille = document.getElementById('grille-calendrier');
  const titre  = document.getElementById('titre-calendrier');
  if (!grille || !titre) return;

  grille.innerHTML = '';
  const annee = dateAffichee.getFullYear();
  const mois  = dateAffichee.getMonth();

  titre.textContent = new Date(annee, mois, 1).toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  const premierJourDuMois = new Date(annee, mois, 1).getDay(); // 0=dim
  const offset = (premierJourDuMois === 0) ? 6 : premierJourDuMois - 1; // lundi=0

  const nbJours = new Date(annee, mois+1, 0).getDate();

  for (let i=0;i<offset;i++){
    grille.insertAdjacentHTML('beforeend', '<div class="jour-calendrier vide"></div>');
  }

  const map = new Map((planning||[]).map(p => [p.date, !!p.disponible]));
  const today = stripTime_(new Date());

  for (let i=1;i<=nbJours;i++){
    const d = new Date(annee, mois, i, 12, 0, 0);
    d.setHours(0,0,0,0);
    const dateISO = isoLocalFromDate(d);
    const disponible = map.get(dateISO) || false;

    const div = document.createElement('div');
    div.className = 'jour-calendrier';
    div.textContent = i;
    div.dataset.date = dateISO;

    if (disponible){
      div.classList.add('disponible');
      div.onclick = ()=> openReservationModal(dateISO);
    } else {
      div.classList.add('indisponible');
    }

    if (isSameDay_(d, today)) div.classList.add('aujourdhui');
    grille.appendChild(div);
  }
}

function changerMois(delta){
  dateAffichee.setMonth(dateAffichee.getMonth()+delta);
  basculerIndicateurChargement(true);
  if (!(window.google && google.script && google.script.run)){
    basculerIndicateurChargement(false);
    console.warn("google.script.run indisponible (prévisualisation locale ?)");
    return;
  }
  google.script.run
    .withSuccessHandler(planning=>{
      renderCalendrier(planning);
      basculerIndicateurChargement(false);
    })
    .withFailureHandler(err=>{
      afficherErreur("Impossible de charger le planning: " + (err.message||err));
      basculerIndicateurChargement(false);
    })
    .getPlanningMois(dateAffichee.toISOString()); // côté serveur: ancre -> mois entier
}

// =================================================================
// MODALE DE RÉSERVATION
// =================================================================
const DEF_RULES = { ALLOW_SAME_DAY:true, SAME_DAY_CUTOFF_HOUR:12, MAX_ARRETS_VISIBLE:12 };
const rules = ()=> (window.__TARIFS__ && window.__TARIFS__.reservation) ? window.__TARIFS__.reservation : DEF_RULES;

function showModalSkeleton(){ basculerIndicateurChargement(true); }
function hideModalSkeleton(){ basculerIndicateurChargement(false); }

function computeWeekFromAnchor_(iso){
  const anchor = iso ? dateFromISOLocal(iso) : new Date();
  const day = (anchor.getDay()+6)%7; // 0=lundi
  const monday = new Date(anchor); monday.setDate(anchor.getDate()-day);
  monday.setHours(0,0,0,0);
  return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d; });
}

function selectChip_(btn, root){
  root.querySelectorAll('.chip').forEach(c=>c.classList.remove('is-active'));
  btn.classList.add('is-active');
}

function openReservationModal(anchorISO){
  const modal = document.getElementById('reservation-modal');
  if (!modal){ console.warn("[UI] reservation-modal manquant"); return; }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  window.closeReservationModal = function(){
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  showModalSkeleton();

  const t = window.__TARIFS__ && window.__TARIFS__.tarifs;
  if (!t){
    afficherErreur('La configuration ou les tarifs ne sont pas disponibles.');
    hydrateTarifCards(null);
    hideModalSkeleton();
    return;
  }

  hydrateTarifCards(t);
  buildDayChips(anchorISO);
  buildArretsSelect();
  wireModalEvents();
  hideModalSkeleton();
  refreshSlotsPreview_();
}

function hydrateTarifCards(tp){
  const base   = document.getElementById('card-base');
  const stops  = document.getElementById('card-stops');
  const opts   = document.getElementById('card-opts');
  const setCard = (el,txt)=>{ if (el){ const b=el.querySelector('.card-body')||el; b.textContent = txt; } };

  if (!tp){
    setCard(base,  'Config vide ou invalide');
    setCard(stops, 'Config vide ou invalide');
    setCard(opts,  'Config vide ou invalide');
    return;
  }
  const prix1 = Number(tp.base)||0;
  const inc2  = Number(tp.arrets?.prix_palier)||0;
  const inc5  = Number(tp.arrets?.prix_apres)||0;

  setCard(base,  `${prix1.toFixed(2)} € HT la course de base`);
  setCard(stops, `+${inc2.toFixed(2)} € / arrêt (2→${tp.arrets?.palier_max_inclus}), puis +${inc5.toFixed(2)} € au-delà`);
  setCard(opts,   (tp.options?.retour_compte_comme_arret) ? `Retour pharmacie = +1 arrêt` : `Retour pharmacie inclus`);
}

function buildDayChips(weekAnchorISO){
  const root = document.getElementById('js-day-chips'); if(!root) return;
  root.innerHTML = '';
  const R = rules();
  const week = computeWeekFromAnchor_(weekAnchorISO);
  const now = new Date();

  const cutoff = (d)=>{
    if (!R.ALLOW_SAME_DAY) return d > stripTime_(now);
    if (isSameDay_(d, now)) return now.getHours() < (R.SAME_DAY_CUTOFF_HOUR ?? 12);
    return d >= stripTime_(now);
  };

  week.forEach(d=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = pad2(d.getDate());
    btn.dataset.iso = isoLocalFromDate(d);
    if (!cutoff(d)) btn.classList.add('is-disabled');
    btn.onclick = ()=>{
      if (btn.classList.contains('is-disabled')) return;
      selectChip_(btn, root);
      refreshSlotsPreview_();
    };
    root.appendChild(btn);
  });

  const first = root.querySelector('.chip:not(.is-disabled)');
  if (first) selectChip_(first, root);
}

function buildArretsSelect(){
  const sel = document.getElementById('select-arrets'); if(!sel) return;
  const R = rules();
  const maxUI = R.MAX_ARRETS_VISIBLE ?? 12;
  sel.innerHTML = '';
  for (let n=1; n<=maxUI; n++){
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = (n<6) ? `${n} arrêt${n>1?'s':''}` : `${n}+ arrêts`;
    sel.appendChild(opt);
  }
}

async function refreshSlotsPreview_(){
  const active = document.querySelector('#js-day-chips .chip.is-active');
  const container = document.getElementById('slots-container');
  if (!container) return;
  if (!active){ container.innerHTML = ''; return; }

  const dayISO = active.dataset.iso;
  const sel = document.getElementById('select-arrets');
  const nbPDL = sel ? parseInt(sel.value,10) : 1;

  chargerCreneaux(dayISO, nbPDL);
}

function renderSlots_(slots){
  const container = document.getElementById('slots-container');
  if (!container) return;
  container.innerHTML = '';

  if (!slots || !slots.length){
    container.innerHTML = '<p style="text-align:center; margin: 1em 0;">Aucun créneau disponible pour cette configuration.</p>';
    return;
  }

  slots.forEach(slot=>{
    const tags = Array.isArray(slot.tags) ? slot.tags : [];
    const urgentTag = tags.includes('urgent') ? '<span style="font-weight:600;">⚡ Urgent</span>' : '';
    const samediTag = tags.includes('samedi') ? '<span style="font-weight:600;">🟪 Samedi</span>' : '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-capsule'; // à styler en “gélule”
    btn.innerHTML = `
      <div style="display:flex; justify-content: space-between; align-items:center;">
        <span class="slot-time" style="font-weight:600; font-size:1.05em;">${slot.timeRange}</span>
        <span class="slot-price" style="font-weight:700; font-size:1.05em;">${Number(slot.basePrice||0).toFixed(2)} €</span>
      </div>
      <div class="slot-tags" style="font-size:0.9em; margin-top:0.25em;">${urgentTag} ${samediTag}</div>
    `;
    btn.onclick = ()=>{
      ajouterTourneeAuPanierSimple_(slot);
      if (typeof window.closeReservationModal === 'function') window.closeReservationModal();
    };
    container.appendChild(btn);
  });
}

// Estimation minimale si la fonction projet est absente
function estimerInfosTournee(nbArrets){
  const t = window.__TARIFS__ && window.__TARIFS__.tarifs;
  const baseMin = 30; // base 30min
  const perStop = 15; // +15min / arrêt
  const duree = baseMin + Math.max(0, (nbArrets-1))*perStop;
  let prix = Number(t?.base)||0;
  const palierMax = Number(t?.arrets?.palier_max_inclus)||1;
  const prixPalier = Number(t?.arrets?.prix_palier)||0;
  const prixApres  = Number(t?.arrets?.prix_apres)||0;

  for (let i=2; i<=nbArrets; i++){
    prix += (i<=palierMax) ? prixPalier : prixApres;
  }
  return { duree, prix };
}

function ajouterTourneeAuPanierSimple_(slot){
  const chip = document.querySelector('#js-day-chips .chip.is-active');
  const sel  = document.getElementById('select-arrets');
  if (!chip || !sel) return;

  const dayISO = chip.dataset.iso;
  const totalStops = parseInt(sel.value, 10);
  const returnToPharmacy = !!(document.getElementById('cb-retour') && document.getElementById('cb-retour').checked);

  const estimation = (typeof window.estimerInfosTournee === 'function')
    ? window.estimerInfosTournee(totalStops)
    : estimerInfosTournee(totalStops);

  // Si le serveur a déjà calculé slot.basePrice, on le garde comme source de vérité
  const prix = Number(slot.basePrice ?? estimation.prix) || 0;

  const tournee = {
    id: 'tournee-' + Date.now(),
    date: dayISO,
    startTime: slot.timeRange,
    totalStops,
    returnToPharmacy,
    prix,
    duree: estimation.duree,
    details: `Tournée de ${estimation.duree}min (${totalStops} arrêt(s), retour: ${returnToPharmacy ? 'oui' : 'non'})`,
    isRecurrent: false
  };

  window.etat.panier.push(tournee);
  afficherPanier();
  sauvegarderPanierDansLocalStorage();
  afficherNotification("Tournée ajoutée au panier !", "succes");
}

function wireModalEvents(){
  const sel = document.getElementById('select-arrets');
  const cb  = document.getElementById('cb-retour');
  if (sel) sel.addEventListener('change', refreshSlotsPreview_);
  if (cb)  cb.addEventListener('change',  refreshSlotsPreview_);
  const form = document.getElementById('formReservation');
  if (form) form.onsubmit = (e)=> e.preventDefault();
}

function chargerCreneaux(dayISO, nbPDL){
  if (!(window.google && google.script && google.script.run)){
    console.warn("google.script.run indisponible – mock vide");
    renderSlots_([]);
    return;
  }
  basculerIndicateurChargement(true);
  google.script.run
    .withSuccessHandler(slots=>{
      renderSlots_(Array.isArray(slots)? slots : []);
      basculerIndicateurChargement(false);
    })
    .withFailureHandler(err=>{
      console.error('getAvailableSlots failed', err);
      renderSlots_([]);
      basculerIndicateurChargement(false);
    })
    .getAvailableSlots(dayISO, nbPDL);
}

// =================================================================
// POINT D’ENTRÉE
// =================================================================
document.addEventListener('DOMContentLoaded', ()=>{
  basculerIndicateurChargement(true);

  // Panier
  chargerPanierDepuisLocalStorage();
  const listePanier = document.getElementById('liste-panier');
  if (listePanier) listePanier.addEventListener('click', gererActionsPanier);

  // Chargement config + planning
  if (!(window.google && google.script && google.script.run)){
    basculerIndicateurChargement(false);
    console.warn("google.script.run indisponible (prévisualisation locale ?)");
    return;
  }

  google.script.run
    .withSuccessHandler(result=>{
      if (result && result.ok){
        window.__TARIFS__ = result; // { tarifs, reservation, ok }
        const ancre = new Date();
        google.script.run
          .withSuccessHandler(planning=>{
            initCalendrier(planning, result);
            basculerIndicateurChargement(false);
          })
          .withFailureHandler(err=>{
            afficherErreur("Impossible de charger le planning: " + (err.message||err));
            basculerIndicateurChargement(false);
          })
          .getPlanningMois(ancre.toISOString());
      } else {
        const message = (result && result.errors) ? result.errors.join(', ') : "Réponse invalide";
        afficherErreur("Erreur de configuration des tarifs: " + message);
        basculerIndicateurChargement(false);
      }
    })
    .withFailureHandler(err=>{
      afficherErreur("Impossible de charger la configuration: " + (err.message||err));
      basculerIndicateurChargement(false);
    })
    .getTarifsPublic();
});
