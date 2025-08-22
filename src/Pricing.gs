/** ===== PRICING CORE =====
 * Grille: { base: number, arrets: number[] }
 * arrets[i] = surcoût du (i+2)ᵉ arrêt ; le dernier vaut pour 6+.
 **/

function prixCumulatif_(grille, n) {
  if (!grille) return 0;
  const inc = grille.arrets || [];
  const last = inc.length ? inc[inc.length - 1] : 0;
  if (n <= 0) return 0;
  let total = Number(grille.base || 0);
  for (let i = 2; i <= n; i++) total += Number(inc[i - 2] != null ? inc[i - 2] : last);
  return total;
}

function regimePour_(date, opts) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const samedi = d.getDay() === 6;
  if (opts && opts.urgence && TARIFS['Urgent']) return 'Urgent';
  if (samedi && TARIFS['Samedi']) return 'Samedi';
  return 'Normal';
}

/** Retour pharmacie = +1 arrêt si tu le souhaites (toggle ici) */
const RETOUR_EQUIV_ARRET = true;

/** Calcul “vérité serveur” (utilise-le aussi pour la facture PDF) */
function calculePrixBase_(config, nbArrets, opts) {
  opts = opts || {};
  let n = Number(nbArrets || 1);
  if (opts.retour && RETOUR_EQUIV_ARRET) n += 1;

  const regime = regimePour_(opts.date, { urgence: opts.urgence });
  const grille = TARIFS[regime] || TARIFS['Normal'];
  const totalHT = prixCumulatif_(grille, n);

  return {
    regime, nbArrets: n, totalHT,
    details: { base: grille.base, arrets: grille.arrets }
  };
}

/** Optionnel : tableau cumulatif 1→6+ pour affichage UI/admin */
function grilleCumulative_(grille) {
  const arr = [];
  for (let i = 1; i <= 6; i++) arr.push(prixCumulatif_(grille, i));
  return arr; // [1,2,3,4,5,6+]
}

/** API publique front (si tu préfères passer par google.script.run) */
function getTarifsPublic() {
  // We need to make sure TARIFS is loaded.
  // Since getConfiguration loads it, we can call it.
  // This assumes TARIFS is a global variable populated by getConfiguration.
  if (typeof TARIFS === 'undefined') {
    getConfiguration();
  }

  const normal = TARIFS['Normal'];
  const samedi = TARIFS['Samedi'];
  const urgent = TARIFS['Urgent'];

  return {
    retourEquivArret: RETOUR_EQUIV_ARRET,
    regimes: Object.keys(TARIFS),
    tables: {
      Normal: normal ? grilleCumulative_(normal) : null,
      Samedi: samedi ? grilleCumulative_(samedi) : null,
      Urgent: urgent ? grilleCumulative_(urgent) : null
    },
    brut: TARIFS // si le front veut faire ses propres calculs
  };
}
