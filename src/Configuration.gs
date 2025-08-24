const COLONNE_TYPE_REMISE_CLIENT = 'Type de Remise';
const COLONNE_VALEUR_REMISE_CLIENT = 'Valeur Remise';
const COLONNE_NB_TOURNEES_OFFERTES = 'Nombre Tournées Offertes';

/** ===================== TARIFICATION ===================== **/
const TARIFS = {
  baseCourse: 15,           // 1 retrait + 1 PDL
  surcUrgence: 5,           // +5 €
  surcSamedi: 10,           // +10 €
  URGENCE_FENETRE_MIN: 45,  // fenêtre d'urgence (min)
  BASE_KM: 9,
  BASE_MIN: 30,
  PDL_PRIX: [5, 4, 3, 4],   // 2e..5e
  PDL_PRIX_FALLBACK: 5,     // 6e+
  PDL_MIN:  [15,15,15,15],
  PDL_MIN_FALLBACK: 15,
  PDL_KM:   [3, 2, 3, 3],
  PDL_KM_FALLBACK: 3,
};

function _isSamedi_(d){ return d.getDay()===6; }
function _estUrgent_(dateDebut, now){
  if (!now) now = new Date();
  const deltaMin = (dateDebut - now)/60000;
  return deltaMin >= 0 && deltaMin <= TARIFS.URGENCE_FENETRE_MIN;
}

function _sumWithFallback_(arr, fb, n){
  let s=0; for (let i=0;i<n;i++) s += (i<arr.length?arr[i]:fb); return s;
}

function computeDevisForSlot_(dateDebut, nbPDL, now){
  nbPDL = Math.max(1, Number(nbPDL||1));
  const extra = nbPDL-1;

  const estUrgent = _estUrgent_(dateDebut, now);
  const estSamedi = _isSamedi_(dateDebut);

  const prix   = TARIFS.baseCourse + _sumWithFallback_(TARIFS.PDL_PRIX, TARIFS.PDL_PRIX_FALLBACK, extra)
                + (estUrgent ? TARIFS.surcUrgence : 0)
                + (estSamedi ? TARIFS.surcSamedi : 0);
  const minutes= TARIFS.BASE_MIN + _sumWithFallback_(TARIFS.PDL_MIN, TARIFS.PDL_MIN_FALLBACK, extra);
  const km     = TARIFS.BASE_KM  + _sumWithFallback_(TARIFS.PDL_KM,  TARIFS.PDL_KM_FALLBACK,  extra);
  return { prix, minutes, km, flags:{ urgent: estUrgent, samedi: estSamedi, nbPDL } };
}

function getTarifsPublic(){
  // lecture seule pour le front/admin
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
