/*******************************************************
 * PublicConfig.gs — expose une config *publique* pour le front
 * 100 % dérivée de Configuration.gs
 *******************************************************/

function getPublicConfig() {
  // Récupère la config maître (ton fichier Configuration.gs)
  const cfg = (typeof getConfiguration === 'function') ? (getConfiguration() || {}) : {};

  // Normalisation des tarifs (tolère plusieurs schémas)
  const tarifs = normaliseTarifs_(cfg);

  // Meta
  const meta = {
    nomService:           cfg.NOM_ENTREPRISE || "EL Services",
    zones:                cfg.ZONES || ["Tamaris","Mar Vivo","Six-Fours-les-Plages","Sanary","Portissol","Bandol"],
    tvaApplicable:        !!cfg.TVA_APPLICABLE,
    articleTVA:           "Art. 293 B CGI",
    contact:              cfg.EMAIL_ENTREPRISE || cfg.ADMIN_EMAIL || "elservicetoulon@gmail.com",
    appUrl:               cfg.APP_URL || "" // optionnel : URL de ta page réservation
  };

  return { meta, tarifs };
}

function normaliseTarifs_(cfg){
  const T = cfg.TARIFS || {};
  const BASE = T.BASE || {};
  const ARRETS = T.ARRETS || {};
  const OPT = T.OPTIONS || {};

  return {
    devise: (cfg.DEVISE || "€"),
    base: {
      prix:                 toNum(BASE.PRIX ?? cfg.TARIF_BASE ?? 15),
      kmInclus:             toNum(BASE.KM_INCLUS ?? cfg.KM_INCLUS ?? 9),
      dureeMin:             toNum(BASE.DUREE_MIN ?? cfg.DUREE_BASE_MIN ?? 30),
      premierArretInclus:   toBool(BASE.PREMIER_ARRET_INCLUS ?? cfg.PREMIER_ARRET_INCLUS ?? true),
    },
    arrets: {
      second:               toNum(ARRETS.SECOND ?? cfg.PRIX_ARRET_2 ?? 5),
      troisieme:            toNum(ARRETS.TROISIEME ?? cfg.PRIX_ARRET_3 ?? 3),
      quatrieme:            toNum(ARRETS.QUATRIEME ?? cfg.PRIX_ARRET_4 ?? 4),
      aPartirDuCinquieme:   toNum(ARRETS.A_PARTIR_DU_5 ?? cfg.PRIX_ARRET_5P ?? 5),
    },
    options: {
      samediMin:            toNum(OPT.SAMEDI_MIN ?? cfg.SAMEDI_MIN ?? 25),
      urgent: {
        delaiMin:           toNum(OPT.URGENT_DELAI_MIN ?? cfg.URGENT_DELAI_MIN ?? 30),
        prixMin:            toNum(OPT.URGENT_PRIX_MIN ?? cfg.URGENT_PRIX_MIN ?? 20),
        selonDispo:         toBool(OPT.URGENT_SELON_DISPO ?? cfg.URGENT_SELON_DISPO ?? true),
      }
    }
  };
}

// Helpers
function toNum(x){ return Number(x); }
function toBool(x){ return (String(x) === "false") ? false : !!x; }

/** Utilitaire de diagnostic (menu ▶ Exécuter). */
function logPublicConfig(){
  const data = getPublicConfig();
  Logger.log(JSON.stringify(data, null, 2));
  return data;
}
