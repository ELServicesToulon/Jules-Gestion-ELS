/*******************************************************
 * PublicConfig.gs — expose une config *publique* pour le front
 * 100 % dérivée de Configuration.gs
 *******************************************************/

/**
 * Fournit une configuration minimale et sûre pour l'interface utilisateur.
 * Ne contient aucune information sensible ni de logique métier.
 * @returns {Object} Un objet de configuration simple pour le client.
 */
function getPublicConfig_() {
  return {
    endpoints: {
      exec: EXEC_URL,
      admin: EXEC_URL + '?page=admin',
      client: EXEC_URL + '?page=gestion',
    },
    ui: {
      brand: "EL Services",
      couleurs: {
        primary: "#8e44ad",
        action: "#3498db",
        option: "#5dade2"
      }
    },
    // Autres valeurs purement d'affichage si nécessaire
  };
}
