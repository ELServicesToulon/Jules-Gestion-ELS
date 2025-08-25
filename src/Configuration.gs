// ===== Identité / Système =====
const ADMIN_EMAIL = "elservicestoulon@gmail.com";
// Optionnel: verrouillage de l'URL déployée
const WEBAPP_URL = "https://script.google.com/macros/s/AKfyc.../exec"; // mets l’URL courante

// ===== Règles métiers =====
const REGLES = {
  minLeadMinutes: 60,                   // délai mini de prise de RDV "non-urgent"
  opening: { start: "08:00", end: "19:00" },
  slot: { stepMinutes: 15, serviceMinutes: 30 },
  saturday: { open: true, surcharge: true },
  zones: ["Tamaris","Mar Vivo","Six-Fours-les-Plages","Sanary","Portissol","Bandol"]
};

// ===== Tarifs (source unique) =====
const TARIFS = {
  baseCourse: 15,               // 1 retrait + 1 PDL, 9km, 30min
  surcUrgence: 5,               // +5€
  surcSamedi: 10,               // +10€
  URGENCE_FENETRE_MIN: 45,      // urgent si < 45min
  baseKm: 9,
  baseMin: 30,
  pdl: [
    { inc: 2, euro: 5, km: 3, min: 15 },
    { inc: 3, euro: 4, km: 2, min: 15 },
    { inc: 4, euro: 3, km: 3, min: 15 },
    { inc: 5, euro: 4, km: 3, min: 15 },
    { inc: 6, euro: 5, km: 3, min: 15, onward: true } // 6 et +
  ]
};

function _isSamedi_(d){ return d.getDay()===6; }
function _estUrgent_(dateDebut, now){
  if (!now) now = new Date();
  const deltaMin = (dateDebut - now)/60000;
  return deltaMin >= 0 && deltaMin <= TARIFS.URGENCE_FENETRE_MIN;
}

function computeDevisForSlot_(dateDebut, nbPDL, now) {
  nbPDL = Math.max(1, Number(nbPDL || 1));
  const extraPDL = nbPDL - 1;

  const estUrgent = _estUrgent_(dateDebut, now);
  const estSamedi = _isSamedi_(dateDebut);

  let extraEuro = 0;
  let extraKm = 0;
  let extraMin = 0;

  if (extraPDL > 0) {
    const lastRule = TARIFS.pdl[TARIFS.pdl.length - 1];
    for (let i = 0; i < extraPDL; i++) {
      const rule = TARIFS.pdl[i] || (lastRule.onward ? lastRule : { euro: 0, km: 0, min: 0 });
      extraEuro += rule.euro;
      extraKm += rule.km;
      extraMin += rule.min;
    }
  }

  const prix = TARIFS.baseCourse + extraEuro
             + (estUrgent ? TARIFS.surcUrgence : 0)
             + (estSamedi ? TARIFS.surcSamedi : 0);
  const minutes = TARIFS.baseMin + extraMin;
  const km = TARIFS.baseKm + extraKm;

  return { prix, minutes, km, flags: { urgent: estUrgent, samedi: estSamedi, nbPDL } };
}

function getTarifsPublic() {
  // lecture seule pour le front/admin, renvoie une copie
  return JSON.parse(JSON.stringify(TARIFS));
}

/**
 * Returns the unified application configuration, combining static
 * constants (like TARIFS) and dynamic settings from the spreadsheet.
 * @returns {Object} The complete application configuration object.
 */
function getAppConfig() {
  const dynamicConfig = getConfiguration();
  return {
    ...dynamicConfig,
    TARIFS: TARIFS
  };
}

/** --- Self-test JSON via ?probe=tarifs --- */
function _probeTarifs_(){
  return { ok:true, now:new Date(), tarifs:getTarifsPublic() };
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

/**
 * Lit la configuration depuis l'onglet 'Paramètres' de la feuille de calcul.
 * Fournit un objet de configuration centralisé pour l'application.
 * @returns {Object.<string, any>} Un objet contenant les paires clé-valeur de la configuration.
 */
function getConfiguration() {
  // Utilise un cache pour éviter de lire la feuille de calcul à chaque appel.
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'app_config';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Paramètres');
    if (!sh) {
      throw new Error("L'onglet de configuration 'Paramètres' est introuvable.");
    }

    const lastRow = sh.getLastRow();
    // Si moins de 2 lignes, il n'y a pas de données (juste l'en-tête ou vide).
    if (lastRow < 2) {
      return {};
    }

    const range = sh.getRange(2, 1, lastRow - 1, 2);
    const values = range.getValues();

    const config = values.reduce((acc, row) => {
      const key = String(row[0]).trim();
      if (key) {
        acc[key] = row[1];
      }
      return acc;
    }, {});

    // Met en cache la configuration pour 5 minutes pour améliorer les performances.
    cache.put(CACHE_KEY, JSON.stringify(config), 300);

    return config;
  } catch (e) {
    Logger.log(`Erreur critique lors de la lecture de la configuration: ${e.stack}`);
    // En cas d'échec, retourne un objet vide pour permettre à l'application de continuer
    // avec des valeurs par défaut si possible.
    return {};
  }
}
