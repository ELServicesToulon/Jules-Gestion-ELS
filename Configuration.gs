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
    arrets: [5, 3, 4, 5, 5] // Prix pour Arrêt 2, 3, 4, 5, et 6+
  },
  'Samedi': {
    base: 25,
    arrets: [5, 3, 4, 5, 5]
  },
  'Urgent': {
    base: 20,
    arrets: [5, 3, 4, 5, 5]
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
