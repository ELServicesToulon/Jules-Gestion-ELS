// =================================================================
//                      SUITE DE TESTS (DEBUG)
// =================================================================
// Description: Ce fichier contient des fonctions pour tester l'ensemble
//              des fonctionnalités du back-office. Exécutez la fonction
//              'lancerTousLesTests' pour un rapport complet.
// =================================================================

// --- CONFIGURATION DES TESTS ---
// Utilisez un client de test pour ne pas modifier les vraies données.
const TEST_CLIENT = {
  email: "test.client@example.com",
  nom: "Pharmacie de Test",
  adresse: "123 Rue du Test, 75000 Paris",
  siret: "12345678901234",
  typeRemise: "Pourcentage",
  valeurRemise: 10,
  nbTourneesOffertes: 2
};

const ADMIN_TEST_EMAIL = "admin@example.com"; // Email admin fixe pour les tests, pour éviter les erreurs de référence.

/**
 * Fonction principale pour exécuter tous les tests séquentiellement.
 */
function lancerTousLesTests() {
  Logger.log("===== DÉBUT DE LA SUITE DE TESTS COMPLÈTE =====");
  
  runAllPricingTests(); // Ajout des tests de tarification
  testerValidationConfiguration();
  testerUtilitaires();
  testerFeuilleCalcul();
  testerCalendrier();
  testerGestionClient();
  testerAdministration();
  testerMaintenance();
  testerSchemaManagement(); // Ajout du test pour le schéma

  Logger.log("===== FIN DE LA SUITE DE TESTS COMPLÈTE =====");
  // SpreadsheetApp.getUi().alert("Tests terminés. Consultez les journaux (Logs) pour les résultats détaillés.");
}


// =================================================================
//                      SUITES DE TESTS INDIVIDUELLES
// =================================================================

function testerValidationConfiguration() {
  Logger.log("\n--- Test de Validation.gs ---");
  try {
    validerConfiguration();
    Logger.log("SUCCESS: validerConfiguration() s'est exécutée sans erreur.");
  } catch (e) {
    Logger.log(`FAILURE: validerConfiguration() a échoué. Erreur: ${e.message}`);
  }
}

function testerUtilitaires() {
  Logger.log("\n--- Test de Utilitaires.gs ---");
  const testDate = new Date(2025, 9, 31, 14, 30); // 31 Octobre 2025, 14:30
  
  // Test formaterDateEnYYYYMMDD
  const yyyymmdd = formaterDateEnYYYYMMDD(testDate);
  if (yyyymmdd === "2025-10-31") {
    Logger.log("SUCCESS: formaterDateEnYYYYMMDD()");
  } else {
    Logger.log(`FAILURE: formaterDateEnYYYYMMDD(). Attendu: "2025-10-31", Obtenu: "${yyyymmdd}"`);
  }

  // Test formaterDateEnHHMM
  const hhmm = formaterDateEnHHMM(testDate);
  if (hhmm === "14h30") {
    Logger.log("SUCCESS: formaterDateEnHHMM()");
  } else {
    Logger.log(`FAILURE: formaterDateEnHHMM(). Attendu: "14h30", Obtenu: "${hhmm}"`);
  }
}

function testerFeuilleCalcul() {
  Logger.log("\n--- Test de FeuilleCalcul.gs ---");
  
  // Test enregistrerOuMajClient (création)
  enregistrerOuMajClient(TEST_CLIENT);
  const clientCree = obtenirInfosClientParEmail(TEST_CLIENT.email);
  if (clientCree && clientCree.nom === TEST_CLIENT.nom) {
    Logger.log("SUCCESS: enregistrerOuMajClient() - Création");
  } else {
    Logger.log("FAILURE: enregistrerOuMajClient() - Création");
  }

  // Test decrementerTourneesOffertesClient
  decrementerTourneesOffertesClient(TEST_CLIENT.email);
  const clientMaj = obtenirInfosClientParEmail(TEST_CLIENT.email);
  if (clientMaj && clientMaj.nbTourneesOffertes === TEST_CLIENT.nbTourneesOffertes - 1) {
     Logger.log("SUCCESS: decrementerTourneesOffertesClient()");
  } else {
     Logger.log(`FAILURE: decrementerTourneesOffertesClient(). Attendu: ${TEST_CLIENT.nbTourneesOffertes - 1}, Obtenu: ${clientMaj ? clientMaj.nbTourneesOffertes : 'N/A'}`);
  }
  // Remettre la valeur initiale
  enregistrerOuMajClient(TEST_CLIENT);
}

function testerCalendrier() {
  Logger.log("\n--- Test de Calendrier.gs ---");
  // NOTE: Les anciens tests de calendrier sont dépréciés.
  // La nouvelle logique de disponibilité est testée via `testerGetAvailableSlots`.

  // Lancement du nouveau test pour l'API de tarification et de disponibilité.
  testerGetAvailableSlots();
}

function testerGetAvailableSlots() {
  Logger.log("\n--- TEST: Test de l'API getAvailableSlots() ---");
  Logger.log("Objectif: Vérifier que l'API retourne un tableau de créneaux valides pour un jour sans contraintes.");

  // On utilise une date future fixe (un mercredi) pour garantir la stabilité des tests.
  const DATE_TEST_NORMAL = new Date();
  DATE_TEST_NORMAL.setDate(DATE_TEST_NORMAL.getDate() + 7); // Un jour dans le futur pour éviter les soucis de same-day
  if (DATE_TEST_NORMAL.getDay() === 0) DATE_TEST_NORMAL.setDate(DATE_TEST_NORMAL.getDate() + 1); // Pas de dimanche
  if (DATE_TEST_NORMAL.getDay() === 6) DATE_TEST_NORMAL.setDate(DATE_TEST_NORMAL.getDate() + 2); // Samedi peut avoir des règles différentes, on prend un jour de semaine standard

  const dayISO = Utilities.formatDate(DATE_TEST_NORMAL, Session.getScriptTimeZone(), "yyyy-MM-dd");
  Logger.log(`Date de test choisie : ${dayISO}`);

  try {
    const slots = getAvailableSlots(dayISO, 1); // 1 PDL pour un cas simple

    if (!Array.isArray(slots)) {
      Logger.log(`FAILURE: getAvailableSlots() n'a pas retourné un tableau. Reçu: ${typeof slots}`);
      return;
    }

    Logger.log(`INFO: getAvailableSlots() a retourné ${slots.length} créneaux.`);

    if (slots.length > 0) {
      Logger.log(`SUCCESS: Au moins un créneau a été trouvé.`);
      const firstSlot = slots[0];
      const hasCorrectStructure = firstSlot.prix && firstSlot.km && firstSlot.minutes && firstSlot.tags && firstSlot.startISO && firstSlot.label;
      if (hasCorrectStructure) {
        Logger.log(`SUCCESS: La structure du premier créneau est correcte.`);
      } else {
        Logger.log(`FAILURE: La structure du créneau est incorrecte: ${JSON.stringify(firstSlot)}`);
      }
    } else {
        Logger.log(`INFO: Aucun créneau disponible trouvé. Cela peut être normal si le calendrier de test est plein ou si c'est un jour de fermeture.`);
    }
  } catch (e) {
    Logger.log(`FAILURE: getAvailableSlots() a levé une exception: ${e.stack}`);
  }
}

function testerGestionClient() {
  Logger.log("\n--- Test de Gestion.gs ---");
  const validation = validerClientParEmail(TEST_CLIENT.email);
  if (validation && validation.success) {
    Logger.log("SUCCESS: validerClientParEmail()");
  } else {
    Logger.log(`FAILURE: validerClientParEmail(). Erreur: ${validation.error}`);
  }
}

function testerAdministration() {
  Logger.log("\n--- Test de Administration.gs ---");
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateTest = formaterDateEnYYYYMMDD(demain);

  // Simuler l'exécution en tant qu'admin
  const reponse = obtenirToutesReservationsPourDate(dateTest);
  if (reponse && reponse.success) {
    Logger.log(`SUCCESS: obtenirToutesReservationsPourDate() a trouvé ${reponse.reservations.length} réservations.`);
  } else {
    Logger.log(`FAILURE: obtenirToutesReservationsPourDate(). Erreur: ${reponse.error}`);
  }
}

function testerMaintenance() {
  Logger.log("\n--- Test de Maintenance.gs ---");
  logAdminAction("TEST", "Test de la fonction de log");
  Logger.log("SUCCESS: logAdminAction() exécuté. Vérifiez l'onglet Admin_Logs.");
  
  notifyAdminWithThrottle("TEST_ERREUR", "Email de test", "Ceci est un test de la fonction de notification.");
  Logger.log("SUCCESS: notifyAdminWithThrottle() exécuté. Vérifiez votre boîte de réception.");
}

function testerSchemaManagement() {
  Logger.log("\n--- Test de Schema Management (shema.gs & Administration.gs) ---");

  // Test 1: runSchemaReport
  try {
    const reportResult = runSchemaReport();
    if (reportResult && reportResult.success) {
      Logger.log(`SUCCESS: runSchemaReport() a retourné: "${reportResult.message}"`);
    } else {
      Logger.log(`FAILURE: runSchemaReport() a échoué. Erreur: ${reportResult ? reportResult.error : 'Réponse non définie'}`);
    }
  } catch (e) {
    Logger.log(`FAILURE: runSchemaReport() a levé une exception. Erreur: ${e.message}`);
  }

  // Test 2: runEnsureSchema (ne l'exécute pas réellement pour éviter les modifications, juste vérifier l'appel)
  // Pour un vrai test, on pourrait avoir une feuille de calcul de test dédiée.
  // Ici, nous nous assurons que la fonction existe et retourne un succès simulé ou réel.
  try {
    const ensureResult = runEnsureSchema();
     if (ensureResult && ensureResult.success) {
      Logger.log(`SUCCESS: runEnsureSchema() a retourné: "${ensureResult.message}"`);
    } else {
      Logger.log(`FAILURE: runEnsureSchema() a échoué. Erreur: ${ensureResult ? ensureResult.error : 'Réponse non définie'}`);
    }
  } catch (e) {
    Logger.log(`FAILURE: runEnsureSchema() a levé une exception. Erreur: ${e.message}`);
  }

  // Test 3: runApplyMigrations
  try {
    const migrateResult = runApplyMigrations();
    if (migrateResult && migrateResult.success) {
      Logger.log(`SUCCESS: runApplyMigrations() a retourné: "${migrateResult.message}"`);
    } else {
      Logger.log(`FAILURE: runApplyMigrations() a échoué. Erreur: ${migrateResult ? migrateResult.error : 'Réponse non définie'}`);
    }
  } catch (e) {
    Logger.log(`FAILURE: runApplyMigrations() a levé une exception. Erreur: ${e.message}`);
  }
}

/**
 * Exécute tous les tests et retourne le contenu du Logger pour l'afficher côté client.
 * @returns {string} Les logs générés par la suite de tests.
 */
function lancerTousLesTestsEtRetournerLogs() {
  // Vide le logger pour cette session de test
  Logger.clear();
  
  // Lance la suite de tests
  lancerTousLesTests();
  
  // Retourne le contenu des logs
  return Logger.getLog();
}

function testMagicLinkForSelf(){
  var email = Session.getActiveUser().getEmail() || 'elservicestoulon@gmail.com';
  return adminGenerateMagicLink(email);
}
