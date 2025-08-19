/*******************************************************
 * PublicConfig.gs — expose une config *publique* pour le front
 * — 100 % dérivée de Configuration.gs (aucune autre source)
 * — Ne révèle rien de sensible
 *******************************************************/

/**
 * Retourne la configuration "publique" pour le front.
 * Toutes les valeurs proviennent EXCLUSIVEMENT de getConfiguration()
 * (ou, à défaut, de fallbacks neutres).
 */
function getPublicConfig() {
  const cfg = (typeof getConfiguration === 'function') ? (getConfiguration() || {}) : {};

  const tarifs = normaliseTarifs_(cfg);
  const meta = {
    nomService: cfg.NOM_ENTREPRISE || "EL Services",
    zones: cfg.ZONES || ["Tamaris","Mar Vivo","Six-Fours-les-Plages","Sanary","Portissol","Bandol"],
    tvaApplicable: !!cfg.TVA_APPLICABLE,
    articleTVA: "Art. 293 B CGI",
    contact: cfg.EMAIL_ENTREPRISE || cfg.ADMIN_EMAIL || "elservicestoulon@gmail.com",
    // Si tu as déjà une variable appUrl côté serveur, elle sera reprise :
    appUrl: cfg.APP_URL || "", 
  };

  return { meta, tarifs };
}

/**
 * Uniformise/normalise les tarifs pour l'UI, en tolérant plusieurs
 * schémas possibles de Configuration.gs (TARIFS.BASE.PRIX, ou TARIF_BASE, etc.).
 */
function normaliseTarifs_(cfg){
  const T = cfg.TARIFS || {};
  const BASE = T.BASE || {};
  const ARRETS = T.ARRETS || {};
  const OPT = T.OPTIONS || {};

  return {
    devise: (cfg.DEVISE || "€"),
    base: {
      prix: n(BASE.PRIX ?? cfg.TARIF_BASE ?? 15),
      kmInclus: n(BASE.KM_INCLUS ?? cfg.KM_INCLUS ?? 9),
      dureeMin: n(BASE.DUREE_MIN ?? cfg.DUREE_BASE_MIN ?? 30),
      premierArretInclus: b(BASE.PREMIER_ARRET_INCLUS ?? cfg.PREMIER_ARRET_INCLUS ?? true)
    },
    arrets: {
      second: n(ARRETS.SECOND ?? cfg.PRIX_ARRET_2 ?? 5),
      troisieme: n(ARRETS.TROISIEME ?? cfg.PRIX_ARRET_3 ?? 3),
      quatrieme: n(ARRETS.QUATRIEME ?? cfg.PRIX_ARRET_4 ?? 4),
      aPartirDuCinquieme: n(ARRETS.A_PARTIR_DU_5 ?? cfg.PRIX_ARRET_5P ?? 5)
    },
    options: {
      samediMin: n(OPT.SAMEDI_MIN ?? cfg.SAMEDI_MIN ?? 25),
      urgent: {
        delaiMin: n(OPT.URGENT_DELAI_MIN ?? cfg.URGENT_DELAI_MIN ?? 30),
        prixMin: n(OPT.URGENT_PRIX_MIN ?? cfg.URGENT_PRIX_MIN ?? 20),
        selonDispo: b(OPT.URGENT_SELON_DISPO ?? cfg.URGENT_SELON_DISPO ?? true)
      }
    }
  };
}

// Helpers
function n(x){ return Number(x); }
function b(x){ return (String(x) === "false") ? false : !!x; }
