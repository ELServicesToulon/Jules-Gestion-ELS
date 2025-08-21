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
// SYSTÈME DE TARIFICATION FLEXIBLE - SOURCE UNIQUE DE VÉRITÉ
// =================================================================
// Pilotez tous les tarifs depuis cet objet.
// 'base': Prix pour le premier arrêt (la prise en charge).
// 'arrets': Un tableau des prix pour les arrêts suivants.
//           Le dernier prix s'applique à tous les arrêts au-delà.
// Grille tarifaire (Normal): 1=15€, 2=20€, 3=23€, 4=27€, 5=32€, 6 et + = 37€
const TARIFS = {
  'Normal': {
    base: 15,
    arrets: [5, 4, 3, 4, 5] // Prix pour Arrêt 2, 3, 4, 5, et 6+
  },
  'Samedi': {
    base: 25,
    arrets: [5, 4, 3, 4, 5]
  },
  'Urgent': {
    base: 20,
    arrets: [5, 4, 3, 4, 5]
  },
  'Special': { // Vous pouvez ajouter autant de types que vous voulez
    base: 10,
    arrets: [2, 1, 2, 3, 3]
  }
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
  // On s'assure que les objets existent pour éviter les erreurs
  const normalRates = TARIFS['Normal'] || {};
  const normalStops = normalRates.arrets || [];
  const saturdayRates = TARIFS['Samedi'] || {};
  const urgentRates = TARIFS['Urgent'] || {};

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
    APP_URL: ScriptApp.getService().getUrl(),

    // --- Clés pour PublicConfig.gs (compatibilité ascendante) ---
    // Ces clés permettent à normaliseTarifs_ de fonctionner même avec l'ancienne structure de constantes.
    TARIF_BASE: normalRates.base,
    KM_INCLUS: KM_BASE,
    DUREE_BASE_MIN: DUREE_BASE,
    PREMIER_ARRET_INCLUS: true,
    PRIX_ARRET_2: normalStops[0],
    PRIX_ARRET_3: normalStops[1],
    PRIX_ARRET_4: normalStops[2],
    PRIX_ARRET_5P: normalStops[3],
    SAMEDI_MIN: saturdayRates.base,
    URGENT_PRIX_MIN: urgentRates.base,
    URGENT_DELAI_MIN: URGENT_THRESHOLD_MINUTES,
    URGENT_SELON_DISPO: true,

    // --- Authentification & Sessions (inchangé) ---
    WEBAPP_URL: ScriptApp.getService().getUrl(),
    TOKEN_TTL_MINUTES: TOKEN_TTL_MINUTES,
    SESSION_TTL_HOURS: SESSION_TTL_HOURS
  };
}
