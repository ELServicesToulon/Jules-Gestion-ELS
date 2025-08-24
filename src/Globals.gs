const EXEC_URL = ScriptApp.getService().getUrl();

/**
 * =================================================================
 *                      GLOBAL VARIABLES
 * =================================================================
 * Description: Ce fichier charge la configuration depuis la feuille
 *              'Paramètres' et l'expose en tant que variables globales
 *              pour assurer la compatibilité avec le code existant.
 * =================================================================
 */

(function() {
  const config = getConfiguration();
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      // @ts-ignore
      this[key] = config[key];
    }
  }
})();
