/** ===================== TARIFICATION CENTRALE ===================== **
 * Toute modif de prix/règle se fait ici, et nulle part ailleurs.
 */
const TARIFS = {
  // Bases monétaires (EUR)
  baseCourse: 15,           // 1 retrait + 1 PDL
  surcUrgence: 5,           // +5€ si créneau démarre dans la fenêtre d'urgence
  surcSamedi: 10,           // +10€ si créneau un samedi

  // Fenêtre d'urgence
  URGENCE_FENETRE_MIN: 45,  // modifiable à chaud

  // Capacités de base
  BASE_KM: 9,
  BASE_MIN: 30,

  // Incréments par PDL supplémentaire (au-delà du 1er inclus dans la base)
  // Prix par PDL: [2e, 3e, 4e, 5e], puis 6e+ = lastFallback
  PDL_PRIX: [5, 4, 3, 4],
  PDL_PRIX_FALLBACK: 5,

  // Minutes & km ajoutés par PDL (mêmes règles de fallback)
  PDL_MIN:  [15, 15, 15, 15],
  PDL_KM:   [ 3,  2,  3,  3],
  PDL_MIN_FALLBACK: 15,
  PDL_KM_FALLBACK:  3,
};

/** Outils date **/
function _isSamedi_(d) { return d.getDay() === 6; } // 0=Dim ... 6=Sam
function _estUrgent_(dateDebut, now) {
  if (!now) now = new Date();
  const deltaMin = (dateDebut - now) / 60000;
  return deltaMin >= 0 && deltaMin <= TARIFS.URGENCE_FENETRE_MIN;
}

/** Additionne une série avec fallback pour l’index 6e+ */
function _sumWithFallback_(arr, fallback, count) {
  if (count <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += (i < arr.length) ? arr[i] : fallback;
  }
  return sum;
}

/** Calcule prix/km/min à partir d'un créneau et nombre total de PDL (>=1) */
function computeDevisForSlot_(dateDebut, nbPDL, now) {
  if (now === undefined) {
    now = new Date();
  }
  if (!nbPDL || nbPDL < 1) nbPDL = 1;

  // PDL supplémentaires au-delà du 1er inclus
  const extra = Math.max(0, nbPDL - 1);

  const extraPrix = _sumWithFallback_(TARIFS.PDL_PRIX, TARIFS.PDL_PRIX_FALLBACK, extra);
  const extraMin  = _sumWithFallback_(TARIFS.PDL_MIN,  TARIFS.PDL_MIN_FALLBACK,  extra);
  const extraKm   = _sumWithFallback_(TARIFS.PDL_KM,   TARIFS.PDL_KM_FALLBACK,   extra);

  let prix = TARIFS.baseCourse + extraPrix;

  const estUrgent = _estUrgent_(dateDebut, now);
  const estSamedi = _isSamedi_(dateDebut);

  // Surcouches combinables (Urgence et/ou Samedi)
  if (estUrgent) prix += TARIFS.surcUrgence;
  if (estSamedi)  prix += TARIFS.surcSamedi;

  return {
    prix,
    km: TARIFS.BASE_KM + extraKm,
    minutes: TARIFS.BASE_MIN + extraMin,
    flags: {
      urgent: estUrgent,
      samedi: estSamedi,
      nbPDL
    }
  };
}

/** Expose une vue "publique" (lecture seule) pour le front/admin */
function getTarifsPublic() {
  return {
    baseCourse: TARIFS.baseCourse,
    surcUrgence: TARIFS.surcUrgence,
    surcSamedi: TARIFS.surcSamedi,
    URGENCE_FENETRE_MIN: TARIFS.URGENCE_FENETRE_MIN,
    BASE_KM: TARIFS.BASE_KM,
    BASE_MIN: TARIFS.BASE_MIN,
    PDL_PRIX: TARIFS.PDL_PRIX.slice(),
    PDL_PRIX_FALLBACK: TARIFS.PDL_PRIX_FALLBACK,
    PDL_MIN: TARIFS.PDL_MIN.slice(),
    PDL_MIN_FALLBACK: TARIFS.PDL_MIN_FALLBACK,
    PDL_KM: TARIFS.PDL_KM.slice(),
    PDL_KM_FALLBACK: TARIFS.PDL_KM_FALLBACK,
  };
}

/** =======================
 *  CONFIG CENTRALE (legacy)
 *  ======================= */
const CFG = {
  ENTREPRISE: {
    nom: "EL Services",
    email: "elservicestoulon@gmail.com",
    siret: "48091306000020",
    iban: "FR7640618804760004035757187",
    bic:  "BOUSFRPPXXX",
    tva_applicable: false,
    delai_paiement_jours: 5
  },
  RESERVATION: {
    timezone: "Europe/Paris",
    jours_ouverts: [1,2,3,4,5,6],
    same_day_min_lead_minutes: 120,
    slot_minutes: 30,
    horaires: { debut: "09:00", fin: "18:00" }
  }
};
function getConfig_() { return CFG; }
