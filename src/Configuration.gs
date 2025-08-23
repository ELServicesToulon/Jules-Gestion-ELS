/** =======================
 *  CONFIG CENTRALE (unique)
 *  ======================= */
const CFG = {
  ENTREPRISE: {
    nom: "EL Services",
    email: "elservicestoulon@gmail.com",
    // Ces champs servent aux factures (Docs/PDF) mais pas au front tarifs :
    siret: "48091306000020",
    iban: "FR7640618804760004035757187",
    bic:  "BOUSFRPPXXX",
    tva_applicable: false,    // Art. 293 B CGI
    delai_paiement_jours: 5
  },

  // ======= TARIFS (unique et obligatoire) =======
  TARIFS: {
    devise: "EUR",
    base: 18, // Course de base

    // Arrêts supplémentaires : palier 1→4 puis 5+
    arrets: {
      palier_max_inclus: 4,
      prix_par_arret_palier: 3,
      prix_par_arret_apres_palier: 2
    },

    // Options (seules règles tarifaires autorisées)
    options: {
      // Retour pharmacie compte comme 1 arrêt de plus (clarif front)
      retour_compte_comme_arret: true,

      urgence: {
        actif: true,
        surcharge: 7,              // € ajoutés si urgence
        delai_minutes: 180         // "urgence" si passage < 3h
      },
      samedi: {
        actif: true,
        surcharge: 6               // € ajoutés le samedi
      },
      remises: [
        // Exemple désactivé :
        // { code: "EHPAD", type: "pourcent", valeur: 10, actif: false }
      ],
      forfaits_speciaux: [
        // Exemple (off par défaut) :
        // { code: "FORF-EHPAD", label: "Forfait EHPAD", prix: 0, actif: false }
      ]
    }
  },

  // ======= RÉSERVATION / SLOTS =======
  RESERVATION: {
    timezone: "Europe/Paris",
    jours_ouverts: [1,2,3,4,5,6], // lun=1 ... sam=6 (dim fermé)
    same_day_min_lead_minutes: 120, // autorise le jour-même si délai ≥ 2h
    slot_minutes: 30,
    horaires: { debut: "09:00", fin: "18:00" } // plage quotidienne
  }
};

// === Accès interne (ne pas exposer tout l'objet côté client) ===
function getConfig_() { return CFG; }
