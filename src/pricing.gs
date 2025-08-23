/** ===== PRICING CORE (Unifié V1↔V2) =====
 * V2 (préférée) : TARIFS = { Normal:{base, arrets[]}, Samedi:{…}, Urgent:{…} }
 * V1 (legacy)   : TARIFS = {
 *   BASE_PAR_ARRET, A_PARTIR_DU_5EME,
 *   RETOUR_EQUIV_ARRET, SAMEDI{ACTIVE,SURCHARGE_FIXE},
 *   URGENCE{ACTIVE,SURCHARGE,CUT_OFF_MINUTES}
 * }
 * Ce fichier s'adapte à l'une ou l'autre forme.
 */

/** --- Utilitaires communs --- */
function _isSaturday_(d){ return (d instanceof Date ? d : new Date(d)).getDay() === 6; }
function _stripDate_(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function _isSameDay_(a,b){ return _stripDate_(a).getTime() === _stripDate_(b).getTime(); }

/** ===== Grille cumulée =====
 * grille: { base:number, arrets:number[] } | null
 * arrets[i] = surcoût du (i+2)ᵉ arrêt ; le dernier vaut pour 6+.
 */
function prixCumulatif_(grille, n) {
  if (!grille || n <= 0) return 0;
  const inc = Array.isArray(grille.arrets) ? grille.arrets : [];
  const last = inc.length ? inc[inc.length - 1] : 0;
  let total = Number(grille.base || 0);
  for (let i = 2; i <= n; i++) total += Number(inc[i - 2] != null ? inc[i - 2] : last);
  return total;
}

/** ===== Adaptation V1 → V2 =====
 * Construit des grilles Normal/Samedi/Urgent à partir de la V1.
 * - BASE_PAR_ARRET pour 1→4, A_PARTIR_DU_5EME pour 5+
 * - Samedi/ Urgent : surcharge FIXE appliquée sur "base"
 */
function _buildGrillesFromV1_(T1){
  const base = Number(T1.BASE_PAR_ARRET || 0);
  const five = Number(T1.A_PARTIR_DU_5EME != null ? T1.A_PARTIR_DU_5EME : base);
  // arrets[0]=2e, [1]=3e, [2]=4e, [3]=5e, dernier vaut pour 6+
  const normal = { base, arrets: [base, base, base, five] };

  const samediActive = !!(T1.SAMEDI && T1.SAMEDI.ACTIVE);
  const samediBaseBump = Number((T1.SAMEDI && T1.SAMEDI.SURCHARGE_FIXE) || 0);
  const samedi = samediActive ? { base: base + samediBaseBump, arrets: normal.arrets.slice() } : null;

  const urgActive = !!(T1.URGENCE && T1.URGENCE.ACTIVE);
  const urgBump = Number((T1.URGENCE && T1.URGENCE.SURCHARGE) || 0);
  const urgent = urgActive ? { base: base + urgBump, arrets: normal.arrets.slice() } : null;

  return {
    Normal: normal,
    Samedi: samedi,
    Urgent: urgent,
    meta: {
      retourAsStop: (typeof T1.RETOUR_EQUIV_ARRET === 'boolean') ? T1.RETOUR_EQUIV_ARRET : true,
      urgenceCutoff: (T1.URGENCE && Number(T1.URGENCE.CUT_OFF_MINUTES)) || 0
    }
  };
}

/** Retourne un objet { grilles, retourAsStop, urgenceCutoff }
 * - Si TARIFS est déjà en V2 → on l'emploie tel quel.
 * - Sinon → on convertit depuis la V1.
 */
function _resolvePricingShape_(CFG){
  const T = CFG && CFG.TARIFS ? CFG.TARIFS : (typeof TARIFS !== 'undefined' ? TARIFS : null);
  if (!T) return null;

  // Détection V2
  const looksV2 = (T.Normal && typeof T.Normal.base !== 'undefined');

  if (looksV2){
    return {
      grilles: { Normal: T.Normal, Samedi: T.Samedi || null, Urgent: T.Urgent || null },
      retourAsStop: !!(T.RETOUR_EQUIV_ARRET ?? T.retourEquivArret ?? true),
      urgenceCutoff: Number(T.URGENCE && T.URGENCE.CUT_OFF_MINUTES) || 0
    };
  }
  // Adaptation V1→V2
  const g = _buildGrillesFromV1_(T);
  return { grilles: { Normal: g.Normal, Samedi: g.Samedi, Urgent: g.Urgent },
           retourAsStop: g.meta.retourAsStop,
           urgenceCutoff: g.meta.urgenceCutoff };
}

/** Urgence AUTO (pas de case UI) */
function _isUrgentWindow_(dayDate, slotStart, cutoffMin){
  if (!cutoffMin) return false;
  const now = new Date();
  if (!_isSameDay_(dayDate, now)) return false;
  const diffMin = Math.round((slotStart - now) / 60000);
  return diffMin >= 0 && diffMin <= cutoffMin;
}

/** Choix du régime (Normal / Samedi / Urgent) */
function regimePour_(CFG, dayDate, slotStart) {
  const R = _resolvePricingShape_(CFG);
  if (!R) return 'Normal';
  const samedi = _isSaturday_(dayDate);
  const urgent = _isUrgentWindow_(dayDate, slotStart, R.urgenceCutoff);
  if (urgent && R.grilles.Urgent) return 'Urgent';
  if (samedi && R.grilles.Samedi) return 'Samedi';
  return 'Normal';
}

/** Calcul “vérité serveur” (utiliser aussi pour facture) */
function calculePrixBase_(CFG, nbArrets, opts) {
  const R = _resolvePricingShape_(CFG);
  if (!R) return { regime:'Normal', nbArrets: Number(nbArrets||1), totalHT: 0, details:{} };

  const day = opts && opts.date ? new Date(opts.date) : new Date();
  const slotStart = opts && opts.slotStart ? new Date(opts.slotStart) : day;

  let n = Number(nbArrets || 1);
  if (opts && opts.retour && R.retourAsStop) n += 1;

  const regime = regimePour_(CFG, day, slotStart);
  const grille = R.grilles[regime] || R.grilles.Normal;

  const totalHT = prixCumulatif_(grille, n);
  return { regime, nbArrets: n, totalHT, details: { base: grille.base, arrets: grille.arrets } };
}

/** Tableau cumulatif 1→6+ (pour affichage admin/UI) */
function grilleCumulative_(grille) {
  const arr = [];
  for (let i = 1; i <= 6; i++) arr.push(prixCumulatif_(grille, i));
  return arr; // [1,2,3,4,5,6+]
}

/**
 * Retourne une vue "stable" des tarifs pour le front.
 * Signature garantie:
 * {
 *   ok: true|false,
 *   reason?: string,
 *   retourEquivArret: boolean,
 *   regimes: string[],                      // ex: ["Normal","Samedi","Urgent"]
 *   tables: { Normal:number[]|null, Samedi:number[]|null, Urgent:number[]|null }, // cumul 1→6+
 *   meta: { urgenceCutoff: number }
 * }
 */
function getTarifsPublic() {
  try {
    const CFG = (typeof getConfiguration === 'function') ? getConfiguration() : null;
    if (!CFG || !CFG.TARIFS) {
      return { ok:false, reason:'CFG.TARIFS introuvable', retourEquivArret:true,
               regimes:[], tables:{Normal:null,Samedi:null,Urgent:null}, meta:{urgenceCutoff:0} };
    }

    // utilise le résolveur V1↔V2 défini dans pricing.gs unifié
    const R = (typeof _resolvePricingShape_ === 'function') ? _resolvePricingShape_(CFG) : null;
    if (!R || !R.grilles || !R.grilles.Normal) {
      return { ok:false, reason:'Grilles non résolues', retourEquivArret:true,
               regimes:[], tables:{Normal:null,Samedi:null,Urgent:null}, meta:{urgenceCutoff:0} };
    }

    const G = R.grilles;
    const tables = {
      Normal: G.Normal ? grilleCumulative_(G.Normal) : null,
      Samedi: G.Samedi ? grilleCumulative_(G.Samedi) : null,
      Urgent: G.Urgent ? grilleCumulative_(G.Urgent) : null
    };
    const regimes = Object.keys(tables).filter(k => !!tables[k]);

    return {
      ok: true,
      retourEquivArret: !!R.retourAsStop,
      regimes,
      tables,
      meta: { urgenceCutoff: Number(R.urgenceCutoff||0) }
    };
  } catch (e) {
    return { ok:false, reason:String(e && e.message || e), retourEquivArret:true,
             regimes:[], tables:{Normal:null,Samedi:null,Urgent:null}, meta:{urgenceCutoff:0} };
  }
}
