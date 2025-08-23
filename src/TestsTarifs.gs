/**
 * =================================================================
 *                        SUITE DE TESTS - TARIFICATION
 * =================================================================
 * Description: Ce fichier valide la logique de `computeDevisForSlot_`.
 *              Il est conçu pour être appelé par le lanceur de
 *              tests principal dans `Tests.gs`.
 * =================================================================
 */

/**
 * Exécute tous les tests de tarification et retourne les résultats.
 * @returns {{passed: number, failed: number, total: number, errors: string[]}}
 */
function runTarifsTests() {
  const results = { passed: 0, failed: 0, total: 0, errors: [] };

  const tests = [
    test_base,
    test_2pdl,
    test_3pdl,
    test_4pdl,
    test_5pdl,
    test_7pdl_fallback,
    test_urgence,
    test_samedi,
    test_samedi_urgent,
  ];

  tests.forEach(testFn => {
    results.total++;
    try {
      testFn();
      results.passed++;
    } catch (e) {
      results.failed++;
      results.errors.push(`[${testFn.name}] -> ${e.message}`);
    }
  });

  return results;
}


// --- DATES DE TEST FIXES ---
// On utilise des dates fixes pour garantir la stabilité des tests.
const DATE_TEST_NORMAL = new Date(2025, 7, 20, 14, 0, 0); // Un mercredi
const DATE_TEST_SAMEDI = new Date(2025, 7, 23, 14, 0, 0); // Un samedi


// --- DÉFINITIONS DES CAS DE TEST INDIVIDUELS ---

function test_base() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 1);
  _assertEquals(15, devis.prix, "Le prix de base pour 1 PDL doit être de 15.");
  _assertEquals(9, devis.km, "Le kilométrage de base pour 1 PDL doit être de 9.");
  _assertEquals(30, devis.minutes, "La durée de base pour 1 PDL doit être de 30.");
}

function test_2pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 2);
  _assertEquals(20, devis.prix, "Le prix pour 2 PDL doit être de 20 (15 + 5).");
}

function test_3pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 3);
  _assertEquals(24, devis.prix, "Le prix pour 3 PDL doit être de 24 (20 + 4).");
}

function test_4pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 4);
  _assertEquals(27, devis.prix, "Le prix pour 4 PDL doit être de 27 (24 + 3).");
}

function test_5pdl() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 5);
  _assertEquals(31, devis.prix, "Le prix pour 5 PDL doit être de 31 (27 + 4).");
}

function test_7pdl_fallback() {
  const devis = computeDevisForSlot_(DATE_TEST_NORMAL, 7);
  // 31 (5 PDL) + 5 (6e) + 5 (7e) = 41
  _assertEquals(41, devis.prix, "Le prix pour 7 PDL doit utiliser le fallback (31 + 5 + 5 = 41).");
}

function test_urgence() {
  const dateDebut = new Date(2025, 7, 20, 14, 0, 0);
  // "now" est 30 minutes avant le début du créneau, donc il est urgent.
  const now_mock = new Date(2025, 7, 20, 13, 30, 0);
  const devis = computeDevisForSlot_(dateDebut, 1, now_mock);
  _assertEquals(20, devis.prix, "Le prix doit inclure le surcoût d'urgence (15 + 5).");
}

function test_samedi() {
  const devis = computeDevisForSlot_(DATE_TEST_SAMEDI, 1);
  _assertEquals(25, devis.prix, "Le prix doit inclure le surcoût du samedi (15 + 10).");
}

function test_samedi_urgent() {
  const dateDebut = new Date(2025, 7, 23, 14, 0, 0); // Samedi
  // "now" est 30 minutes avant, donc urgent.
  const now_mock = new Date(2025, 7, 23, 13, 30, 0);
  const devis = computeDevisForSlot_(dateDebut, 1, now_mock);
  _assertEquals(30, devis.prix, "Le prix doit cumuler les surcoûts samedi et urgence (15 + 10 + 5).");
}
