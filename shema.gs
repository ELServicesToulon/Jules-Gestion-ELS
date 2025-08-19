/**
 * =================================================================
 *                      DÉFINITION DES SCHÉMAS
 * =================================================================
 * Description: Ce fichier est la source unique de vérité pour la
 *              structure (en-têtes de colonnes) de toutes les
 *              feuilles de calcul utilisées par l'application.
 *              Ce schéma a été consolidé pour supporter toutes les
 *              fonctionnalités existantes dans le code.
 * =================================================================
 */

const SCHEMAS = {
  // Schéma consolidé pour supporter toutes les fonctions existantes
  'Clients': [
    "Email", "Raison Sociale", "Adresse", "SIRET", "TVA",
    "Type de Remise", "Valeur Remise", "Nombre Tournées Offertes",
    "CodeParrainage", "CodeUtilise", "CreditParrainage"
  ],

  // Schéma basé sur l'ancienne configuration, car il est utilisé par l'admin panel
  'Destinataires': [
    "Nom Complet", "Adresse", "Email", "Telephone", "Client Associé (Email)"
  ],

  // Schéma complet pour supporter la facturation, l'admin panel et l'espace client
  'Facturation': [
    "Date", "Client (Raison S. Client)", "Client (Email)", "Type", "Détails", "Montant",
    "Statut", "Valider", "N° Facture", "Event ID", "ID Réservation", "ID PDF",
    "Note Interne", "Lien Note", "Type Remise Appliquée", "Tournée Offerte Appliquée",
    "Valeur Remise Appliquée", "Note Livreur", "Livreur Frigo", "Livreur Tampon",
    "Livreur Reprise", "Livreur Extras"
  ],

  // Schéma requis pour la génération de factures
  'Paramètres': [
    "Clé", "Valeur", "Description"
  ],

  // Les schémas suivants sont définis pour assurer l'existence des feuilles.
  // Leurs colonnes ne sont pas activement gérées par la logique de la même manière.
  'Admin_Logs': [],
  'Logs': [],
  'Plages_Bloquees': ["Date", "Heure_Debut", "Heure_Fin"],
};
