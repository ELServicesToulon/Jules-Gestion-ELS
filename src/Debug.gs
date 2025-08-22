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

const ADMIN_TEST_EMAIL = ADMIN_EMAIL; // Utilise l'email admin de la configuration

/**
 * Fonction principale pour exécuter tous les tests séquentiellement.
 */
function lancerTousLesTests() {
  Logger.log("===== DÉBUT DE LA SUITE DE TESTS COMPLÈTE =====");
  
  testerValidationConfiguration();
  testerUtilitaires();
  testerFeuilleCalcul();
  testerCalendrier();
  testerReservation();
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
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateTest = formaterDateEnYYYYMMDD(demain);

  const creneaux = obtenirCreneauxDisponiblesPourDate(dateTest, 30);
  if (Array.isArray(creneaux)) {
    Logger.log(`SUCCESS: obtenirCreneauxDisponiblesPourDate() a retourné ${creneaux.length} créneaux pour demain.`);
  } else {
    Logger.log("FAILURE: obtenirCreneauxDisponiblesPourDate() n'a pas retourné un tableau.");
  }

  const calPublic = obtenirDonneesCalendrierPublic(demain.getMonth() + 1, demain.getFullYear());
  if (calPublic && typeof calPublic.disponibilite === 'object') {
     Logger.log("SUCCESS: obtenirDonneesCalendrierPublic()");
  } else {
     Logger.log("FAILURE: obtenirDonneesCalendrierPublic()");
  }

  // Lancement du nouveau test pour l'API de tarification
  testerGetAvailableSlots();
}

function testerGetAvailableSlots() {
  Logger.log("\n--- NOUVEAU TEST: Test de getAvailableSlots() ---");
  const config = getConfiguration();

  // Scénario 1: Jour normal, 1 arrêt
  let testDate = new Date();
  let attempts = 0;
  do {
    testDate.setDate(testDate.getDate() + 1);
    attempts++;
  } while ((testDate.getDay() === 6 || testDate.getDay() === 0) && attempts < 8); // Ni samedi, ni dimanche
  const dateTestNormal = formaterDateEnYYYYMMDD(testDate);

  const slotsNormal = getAvailableSlots(dateTestNormal, 1, []);
  if (slotsNormal && slotsNormal.length > 0) {
    const premierSlot = slotsNormal[0];
    const prixAttendu = config.TARIFS.Normal.base;
    if (premierSlot.basePrice === prixAttendu) {
      Logger.log(`SUCCESS: getAvailableSlots() - Jour Normal. Prix: ${premierSlot.basePrice}€, attendu: ${prixAttendu}€.`);
    } else {
      Logger.log(`FAILURE: getAvailableSlots() - Jour Normal. Prix: ${premierSlot.basePrice}€, attendu: ${prixAttendu}€.`);
    }
  } else {
    Logger.log(`INFO: getAvailableSlots() - Jour Normal. Aucun créneau trouvé pour ${dateTestNormal}, test de prix sauté.`);
  }

  // Scénario 2: Un samedi, 3 arrêts
  let testDateSamedi = new Date();
  attempts = 0;
  do {
    testDateSamedi.setDate(testDateSamedi.getDate() + 1);
    attempts++;
  } while (testDateSamedi.getDay() !== 6 && attempts < 8); // Trouver le prochain samedi

  if (testDateSamedi.getDay() === 6) {
    const dateTestSamediStr = formaterDateEnYYYYMMDD(testDateSamedi);
    const slotsSamedi = getAvailableSlots(dateTestSamediStr, 3, []);
     if (slotsSamedi && slotsSamedi.length > 0) {
      const premierSlot = slotsSamedi[0];
      const tarifSamedi = config.TARIFS.Samedi;
      const prixAttendu = tarifSamedi.base + tarifSamedi.arrets[0] + tarifSamedi.arrets[1];
       if (premierSlot.basePrice === prixAttendu) {
        Logger.log(`SUCCESS: getAvailableSlots() - Samedi 3 arrêts. Prix: ${premierSlot.basePrice}€, attendu: ${prixAttendu}€.`);
      } else {
        Logger.log(`FAILURE: getAvailableSlots() - Samedi 3 arrêts. Prix: ${premierSlot.basePrice}€, attendu: ${prixAttendu}€.`);
      }
    } else {
      Logger.log(`INFO: getAvailableSlots() - Samedi. Aucun créneau trouvé pour ${dateTestSamediStr}, test de prix sauté.`);
    }
  } else {
      Logger.log(`INFO: getAvailableSlots() - Samedi. Aucun samedi trouvé dans les 7 prochains jours, test sauté.`);
  }
}

function testerReservation() {
  Logger.log("\n--- Test de Reservation.gs ---");
  // const demain = new Date();
  // demain.setDate(demain.getDate() + 1);
  // const dateTest = formaterDateEnYYYYMMDD(demain);

  // NOTE JULES: Le test pour calculerPrixEtDureeServeur() est déprécié car cette fonction
  // est maintenant remplacée par l'API getAvailableSlots() qui est testée dans testerCalendrier().
  // const calcul = calculerPrixEtDureeServeur(2, true, dateTest, "10h00", TEST_CLIENT);
  // if (calcul && typeof calcul.prix === 'number' && typeof calcul.duree === 'number') {
  //   Logger.log(`SUCCESS: calculerPrixEtDureeServeur(). Prix calculé: ${calcul.prix.toFixed(2)}€, Durée: ${calcul.duree}min.`);
  // } else {
  //   Logger.log("FAILURE: calculerPrixEtDureeServeur()");
  // }
  Logger.log("INFO: Le test de Reservation.gs est actuellement sans objet car la logique a été déplacée vers getAvailableSlots().");
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
