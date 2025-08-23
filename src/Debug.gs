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
  const config = getConfiguration();
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateTest = formaterDateEnYYYYMMDD(demain);

  const creneaux = obtenirCreneauxDisponiblesPourDate(dateTest, 30, config);
  if (Array.isArray(creneaux)) {
    // Le test vérifie juste si la fonction crashe. Le nombre de créneaux peut être 0.
    Logger.log(`SUCCESS: obtenirCreneauxDisponiblesPourDate() s'est exécutée sans erreur.`);
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
  Logger.log("\n--- TEST: Test de l'API getAvailableSlots() ---");
  const config = getConfiguration();

  // --- Scénario 1: Jour normal, 2 arrêts au total ---
  let testDate = new Date();
  let attempts = 0;
  do {
    testDate.setDate(testDate.getDate() + 1);
    attempts++;
  } while ((testDate.getDay() === 6 || testDate.getDay() === 0 || isSameDay_(new Date(), testDate)) && attempts < 8);
  const dateTestNormal = formatDateForCompare_(testDate);

  const slotsNormal = getAvailableSlots(dateTestNormal, 1); // 1 arrêt sup = 2 au total
  if (slotsNormal && slotsNormal.length > 0) {
    const premierSlot = slotsNormal[0];
    const prixAttendu = calculePrixBase_(config, 2, { date: dateTestNormal }).totalHT;

    if (premierSlot.basePrice.toFixed(2) === prixAttendu.toFixed(2)) {
      Logger.log(`SUCCESS: getAvailableSlots() - Jour Normal (2 arrêts). Prix: ${premierSlot.basePrice.toFixed(2)}€, attendu: ${prixAttendu.toFixed(2)}€.`);
    } else {
      Logger.log(`FAILURE: getAvailableSlots() - Jour Normal (2 arrêts). Prix: ${premierSlot.basePrice.toFixed(2)}€, attendu: ${prixAttendu.toFixed(2)}€.`);
    }
    if (premierSlot.tags.length === 0) {
       Logger.log(`SUCCESS: getAvailableSlots() - Jour Normal. Tags vides comme attendu.`);
    } else {
       Logger.log(`FAILURE: getAvailableSlots() - Jour Normal. Tags non vides: ${premierSlot.tags.join(', ')}.`);
    }
  } else {
    Logger.log(`INFO: getAvailableSlots() - Jour Normal. Aucun créneau trouvé pour ${dateTestNormal}, test de prix sauté.`);
  }

  // --- Scénario 2: Un samedi, 4 arrêts au total ---
  let testDateSamedi = new Date();
  attempts = 0;
  do {
    testDateSamedi.setDate(testDateSamedi.getDate() + 1);
    attempts++;
  } while (testDateSamedi.getDay() !== 6 && attempts < 8);

  if (testDateSamedi.getDay() === 6) {
    const dateTestSamediStr = formatDateForCompare_(testDateSamedi);
    const slotsSamedi = getAvailableSlots(dateTestSamediStr, 3); // 3 arrêts sup = 4 au total
     if (slotsSamedi && slotsSamedi.length > 0) {
      const premierSlot = slotsSamedi[0];
      const prixAttendu = calculePrixBase_(config, 4, { date: dateTestSamediStr }).totalHT;

       if (premierSlot.basePrice.toFixed(2) === prixAttendu.toFixed(2)) {
        Logger.log(`SUCCESS: getAvailableSlots() - Samedi (4 arrêts). Prix: ${premierSlot.basePrice.toFixed(2)}€, attendu: ${prixAttendu.toFixed(2)}€.`);
      } else {
        Logger.log(`FAILURE: getAvailableSlots() - Samedi (4 arrêts). Prix: ${premierSlot.basePrice.toFixed(2)}€, attendu: ${prixAttendu.toFixed(2)}€.`);
      }
      if (premierSlot.tags.includes("samedi")) {
         Logger.log(`SUCCESS: getAvailableSlots() - Samedi. Tag 'samedi' présent.`);
      } else {
         Logger.log(`FAILURE: getAvailableSlots() - Samedi. Tag 'samedi' manquant.`);
      }
    } else {
      Logger.log(`INFO: getAvailableSlots() - Samedi. Aucun créneau trouvé pour ${dateTestSamediStr}, test de prix sauté.`);
    }
  } else {
      Logger.log(`INFO: getAvailableSlots() - Samedi. Aucun samedi trouvé dans les 7 prochains jours, test sauté.`);
  }

  // --- Scénario 3: Urgence (aujourd'hui), 1 arrêt ---
  const dateAujourdhui = formatDateForCompare_(new Date());
  const slotsUrgence = getAvailableSlots(dateAujourdhui, 0); // 0 arrêt sup = 1 au total
  if (slotsUrgence && slotsUrgence.length > 0) {
    const premierSlot = slotsUrgence[0];
    const slotDate = buildDateFromDayAndTime_(dateAujourdhui, premierSlot.timeRange);
    const estUrgent = _isUrgentWindow_(new Date(), slotDate, _resolvePricingShape_(config).urgenceCutoff);

    if (estUrgent) {
      if (premierSlot.tags.includes("urgence")) {
        const prixAttendu = calculePrixBase_(config, 1, { date: dateAujourdhui, slotStart: slotDate }).totalHT;
        if (premierSlot.basePrice.toFixed(2) === prixAttendu.toFixed(2)) {
           Logger.log(`SUCCESS: getAvailableSlots() - Urgence. Prix et tag corrects. Prix: ${premierSlot.basePrice.toFixed(2)}€, attendu: ${prixAttendu.toFixed(2)}€.`);
        } else {
           Logger.log(`FAILURE: getAvailableSlots() - Urgence. Mauvais prix. Prix: ${premierSlot.basePrice.toFixed(2)}€, attendu: ${prixAttendu.toFixed(2)}€.`);
        }
      } else {
        Logger.log(`FAILURE: getAvailableSlots() - Urgence. Le créneau devrait être taggué 'urgence' mais ne l'est pas.`);
      }
    } else {
      Logger.log("INFO: getAvailableSlots() - Urgence. Aucun créneau DANS LA FENETRE d'urgence trouvé, test de prix sauté.");
    }
  } else {
    Logger.log("INFO: getAvailableSlots() - Urgence. Aucun créneau trouvé pour aujourd'hui.");
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
