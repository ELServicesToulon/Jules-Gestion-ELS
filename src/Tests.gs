// =================================================================
//                      INFRASTRUCTURE DE TESTS
// =================================================================
// Description: Fournit des fonctions d'assertion de base et un
//              lanceur de tests pour exécuter toutes les suites de
//              tests du projet.
// =================================================================

/**
 * Compare deux valeurs et lance une erreur si elles ne sont pas égales.
 * @param {*} expected La valeur attendue.
 * @param {*} actual La valeur réelle obtenue.
 * @param {string} message Le message à afficher en cas d'échec.
 */
function _assertEquals(expected, actual, message) {
  // Utilise une comparaison simple, à améliorer si nécessaire pour les objets.
  if (expected !== actual) {
    throw new Error(`Assertion échouée: ${message}. Attendu: "${expected}", Obtenu: "${actual}".`);
  }
}

/**
 * Lance toutes les suites de tests définies dans le projet.
 * @returns {{passed: number, failed: number, total: number, errors: string[]}} Un objet avec les résultats.
 */
function lancerTousLesTests() {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    errors: []
  };

  // --- Liste de toutes les suites de tests à exécuter ---
  const testSuites = [
    runTarifsTests,
    // Ajoutez d'autres fonctions de suite de tests ici (ex: runAuthTests)
  ];
  // ---------------------------------------------------------

  testSuites.forEach(suiteFn => {
    const suiteName = suiteFn.name;
    try {
      Logger.log(`Lancement de la suite de tests : ${suiteName}...`);
      const suiteResults = suiteFn();
      results.passed += suiteResults.passed;
      results.failed += suiteResults.failed;
      results.total += suiteResults.total;
      results.errors = results.errors.concat(suiteResults.errors.map(e => `[${suiteName}] ${e}`));
    } catch (e) {
      results.failed++;
      results.total++;
      results.errors.push(`[${suiteName}] ERREUR CRITIQUE: ${e.message}\n${e.stack}`);
    }
  });

  Logger.log(`Fin des tests. Réussis: ${results.passed}, Échoués: ${results.failed}, Total: ${results.total}`);
  if (results.failed > 0) {
    Logger.log('Détails des erreurs:\n' + results.errors.join('\n\n'));
  }
  return results;
}

/**
 * Fonction wrapper pour lancer les tests et retourner un rapport textuel simple.
 * Utile pour les points de terminaison API ou les exécutions manuelles.
 * @returns {string} Un rapport de test formaté.
 */
function lancerTousLesTestsEtRetournerLogs() {
    const results = lancerTousLesTests();
    let logOutput = `======= RAPPORT DE TESTS =======\n\n`;
    logOutput += `  Réussis : ${results.passed}\n`;
    logOutput += `  Échoués : ${results.failed}\n`;
    logOutput += `  Total   : ${results.total}\n`;

    if (results.failed > 0) {
        logOutput += `\n\n======= DÉTAILS DES ERREURS =======\n\n`;
        logOutput += results.errors.join('\n\n---------------------------------\n\n');
    } else {
        logOutput += `\n\n✅ Tous les tests sont passés avec succès !\n`;
    }
    return logOutput;
}
