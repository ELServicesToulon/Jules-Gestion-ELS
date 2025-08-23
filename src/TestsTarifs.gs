/**
 * =================================================================
 *                        SUITE DE TESTS - TARIFICATION
 * =================================================================
 * Description: Ce fichier valide la logique de `computeDevisForSlot_`
 *              en fonction des cas de tests fournis.
 * Pour exécuter: sélectionner la fonction `runAllPricingTests`
 * et cliquer sur "Exécuter" dans l'éditeur Apps Script.
 * Les résultats s'affichent dans les journaux (Logs).
 * =================================================================
 */

function _runTest(testName, result, expected) {
  const isOk = JSON.stringify(result) === JSON.stringify(expected);
  if (isOk) {
    Logger.log(`✅ [OK] ${testName}`);
  } else {
    Logger.log(`❌ [FAIL] ${testName}`);
    Logger.log(`   -> Attendu: ${JSON.stringify(expected)}`);
    Logger.log(`   -> Obtenu:  ${JSON.stringify(result)}`);
  }
  return isOk;
}

// --- DATES DE TEST FIXES ---
// On utilise une date fixe (un mercredi) pour garantir la stabilité des tests.
// Note: Le mois est 0-indexé en JS (7 = Août).
const DATE_TEST_NORMAL = new Date(2025, 7, 20, 14, 0, 0); // Mercredi 20 Août 2025
// On utilise une date fixe (un samedi) pour les tests spécifiques.
const DATE_TEST_SAMEDI = new Date(2025, 7, 23, 14, 0, 0); // Samedi 23 Août 2025

function test_base() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 1);
  const { prix, km, minutes } = devis;
  return _runTest("Course de base (1 PDL)", { prix, km, minutes }, { prix: 15, km: 9, minutes: 30 });
}

function test_2pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 2);
  const { prix, km, minutes } = devis;
  return _runTest("2e PDL", { prix, km, minutes }, { prix: 20, km: 12, minutes: 45 });
}

function test_3pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 3);
  const { prix, km, minutes } = devis;
  return _runTest("3e PDL", { prix, km, minutes }, { prix: 24, km: 14, minutes: 60 });
}

function test_4pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 4);
  const { prix, km, minutes } = devis;
  return _runTest("4e PDL", { prix, km, minutes }, { prix: 27, km: 17, minutes: 75 });
}

function test_5pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 5);
  const { prix, km, minutes } = devis;
  return _runTest("5e PDL", { prix, km, minutes }, { prix: 31, km: 20, minutes: 90 });
}

function test_7pdl_fallback() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 7);
  const { prix, km, minutes } = devis;
  return _runTest("7e PDL (fallback)", { prix, km, minutes }, { prix: 41, km: 26, minutes: 120 });
}

function test_urgence() {
  const dateDebut = new Date(2025, 7, 20, 14, 0, 0); // Mercredi
  // "now" est 30 minutes avant le début du créneau, donc il est urgent.
  const now_mock = new Date(2025, 7, 20, 13, 30, 0);
  const devis = computeDevisForSlot_(dateDebut, 1, now_mock);
  return _runTest("Urgence", { prix: devis.prix }, { prix: 15 + 5 });
}

function test_samedi() {
  const devis = computeDevisForSlot_(DATE_TEST_SAMEDI, 1);
  return _runTest("Samedi", { prix: devis.prix }, { prix: 15 + 10 });
}

function test_samedi_urgent() {
  const dateDebut = new Date(2025, 7, 23, 14, 0, 0); // Samedi
  // "now" est 30 minutes avant, donc urgent.
  const now_mock = new Date(2025, 7, 23, 13, 30, 0);
  const devis = computeDevisForSlot_(dateDebut, 1, now_mock);
  return _runTest("Samedi + Urgence (cumul)", { prix: devis.prix }, { prix: 15 + 10 + 5 });
}

function runAllPricingTests() {
  Logger.log("===== DÉBUT DES TESTS DE TARIFICATION (v3) =====");
  const results = [
    test_base(),
    test_2pdl(),
    test_3pdl(),
    test_4pdl(),
    test_5pdl(),
    test_7pdl_fallback(),
    test_urgence(),
    test_samedi(),
    test_samedi_urgent()
  ];
  const allOk = results.every(r => r);
  Logger.log("==============================================");
  if (allOk) {
    Logger.log("✅ Tous les tests de tarification ont réussi !");
  } else {
    Logger.log("❌ Certains tests de tarification ont échoué.");
  }
  Logger.log("==============================================");
}
