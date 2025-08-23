/*******************************************************
 * PublicConfig.gs — expose une config *publique* pour le front
 * 100 % dérivée de Configuration.gs
 *******************************************************/


/** === API publique (front) — ne rien mettre de sensible ici === **/
function getConfigPublic() {
  const config = getAppConfig();
  return {
    tarifs: config.TARIFS,
    regles: config.REGLES,
    meta: config.META
  };
}
