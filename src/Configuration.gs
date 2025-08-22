// =================================================================
//                      CONFIGURATION DE L'APPLICATION
// =================================================================
// Description: Centralise toutes les variables et paramètres
//              personnalisables de l'application.
// =================================================================

// --- Informations sur l'entreprise ---
const NOM_ENTREPRISE = "EL Services";
const ADRESSE_ENTREPRISE = "255 Avenue Marcel Castie B, 83000 Toulon";
const EMAIL_ENTREPRISE = "elservicestoulon@gmail.com";
const SIRET = "48091306000020";
const RIB_ENTREPRISE = "FR7640618804760004035757187";
const BIC_ENTREPRISE = "BOUSFRPPXXX";
const ADMIN_EMAIL = "elservicestoulon@gmail.com";

// --- Paramètres de facturation ---
const TVA_APPLICABLE = false;
const TAUX_TVA = 0.20; // 20%
const DELAI_PAIEMENT_JOURS = 5;

// --- Identifiants des services Google ---
const ID_CALENDRIER = "Elservicestoulon@gmail.com";
const ID_DOCUMENT_CGV = "1ze9U3k_tcS-RlhIcI8zSs2OYom2miVy8WxyxT8ktFp0";
const ID_FEUILLE_CALCUL = "1-i8xBlCrl_Rrjo2FgiL33pIRjD1EFqyvU7ILPud3-r4";
const ID_MODELE_FACTURE = "1KWDS0gmyK3qrYWJd01vGID5fBVK10xlmErjgr7lrwmU";
const ID_DOSSIER_ARCHIVES = "1UavaEsq6TkDw1QzJZ91geKyF7hrQY4S8";
const ID_DOSSIER_TEMPORAIRE = "1yDBSzTqwaUt-abT0s7Z033C2WlN1NSs6";

// --- Horaires & Tampons ---
const HEURE_DEBUT_SERVICE = "08:30";
const HEURE_FIN_SERVICE = "18:30";
const DUREE_TAMPON_MINUTES = 15;
const INTERVALLE_CRENEAUX_MINUTES = 15;
const URGENT_THRESHOLD_MINUTES = 30;

// --- Durées des prestations (minutes) ---
const DUREE_BASE = 30;
const DUREE_ARRET_SUP = 15;

// --- Kilométrage estimé ---
const KM_BASE = 9;
const KM_ARRET_SUP = 3;

// =================================================================
//                      TARIFS & REGLES
// =================================================================
/** ===== CONFIG.gs — Source de vérité ===== **/
/** Tout pricing/règles DOIVENT venir d'ici. Aucune autre source. **/

/** Tarifs HT — exemples, à adapter **/
const TARIFS = {
  BASE_PAR_ARRET: 10,          // € par arrêt (1→4)
  A_PARTIR_DU_5EME: 8,        // € par arrêt (5+)
  RETOUR_EQUIV_ARRET: true,   // "retour pharmacie" = +1 arrêt
  SAMEDI: { ACTIVE: true, SURCHARGE_FIXE: 10 },  // € par tournée le samedi
  URGENCE: { ACTIVE: true, SURCHARGE: 5, CUT_OFF_MINUTES: 90 } // délai mini
};

/** Règles de planning **/
const REGLES = {
  ALLOW_SAME_DAY: true,       // autoriser la résa pour aujourd'hui
  SAME_DAY_CUTOFF_HOUR: 12,   // butoir heure locale (0–23)
  MAX_ARRETS_VISIBLE: 12      // l’UI affiche “6+” au-delà de 6
};

/** Divers **/
const META = {
  DEVISE: 'EUR',
  ZONES: ['Tamaris','Mar Vivo','Six-Fours-les-Plages','Sanary','Portissol','Bandol']
};
// =================================================================

// --- Noms des colonnes spécifiques ---
const COLONNE_TYPE_REMISE_CLIENT = "Type de Remise";
const COLONNE_VALEUR_REMISE_CLIENT = "Valeur Remise";
const COLONNE_NB_TOURNEES_OFFERTES = "Nombre Tournées Offertes";

// =================================================================
//                      AUTHENTIFICATION & SESSIONS
// =================================================================
const TOKEN_TTL_MINUTES = 15;
const SESSION_TTL_HOURS = 24;

/**
 * Retourne un objet contenant TOUTES les configurations de l'application
 * pour les rendre accessibles aux autres modules côté serveur.
 * @returns {object}
 */
function getConfiguration() {
  return {
    // --- Informations sur l'entreprise ---
    NOM_ENTREPRISE: NOM_ENTREPRISE,
    EMAIL_ENTREPRISE: EMAIL_ENTREPRISE,
    ADMIN_EMAIL: ADMIN_EMAIL,

    // --- Identifiants ---
    ID_CALENDRIER: ID_CALENDRIER,

    // --- Paramètres de facturation ---
    TVA_APPLICABLE: TVA_APPLICABLE,

    // --- Horaires & Durées ---
    HEURE_DEBUT_SERVICE: HEURE_DEBUT_SERVICE,
    HEURE_FIN_SERVICE: HEURE_FIN_SERVICE,
    DUREE_TAMPON_MINUTES: DUREE_TAMPON_MINUTES,
    INTERVALLE_CRENEAUX_MINUTES: INTERVALLE_CRENEAUX_MINUTES,
    DUREE_BASE: DUREE_BASE,

    // --- Système de tarification & options ---
    TARIFS: TARIFS,
    REGLES: REGLES,
    META: META,
    APP_URL: ScriptApp.getService().getUrl(),

    // --- Clés pour PublicConfig.gs (compatibilité ascendante) ---
    // Ces clés permettent à normaliseTarifs_ de fonctionner même avec l'ancienne structure de constantes.
    TARIF_BASE: TARIFS.BASE_PAR_ARRET,
    KM_INCLUS: KM_BASE,
    DUREE_BASE_MIN: DUREE_BASE,
    PREMIER_ARRET_INCLUS: true,
    PRIX_ARRET_2: TARIFS.BASE_PAR_ARRET,
    PRIX_ARRET_3: TARIFS.BASE_PAR_ARRET,
    PRIX_ARRET_4: TARIFS.BASE_PAR_ARRET,
    PRIX_ARRET_5P: TARIFS.A_PARTIR_DU_5EME,
    SAMEDI_MIN: TARIFS.SAMEDI.SURCHARGE_FIXE,
    URGENT_PRIX_MIN: TARIFS.URGENCE.SURCHARGE,
    URGENT_DELAI_MIN: TARIFS.URGENCE.CUT_OFF_MINUTES,
    URGENT_SELON_DISPO: true,

    // --- Authentification & Sessions (inchangé) ---
    WEBAPP_URL: ScriptApp.getService().getUrl(),
    TOKEN_TTL_MINUTES: TOKEN_TTL_MINUTES,
    SESSION_TTL_HOURS: SESSION_TTL_HOURS
  };
}
