/*******************************************************
 * PublicConfig.gs — expose une config *publique* pour le front
 * 100 % dérivée de Configuration.gs
 *******************************************************/


/** === API publique (front) — ne rien mettre de sensible ici === **/
function getConfigPublic() {
  return {
    tarifs: TARIFS,
    regles: REGLES,
    meta: META
  };
}
