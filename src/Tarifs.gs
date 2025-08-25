/** Renvoi public minimal pour le front */
function getTarifsPublic() {
  const cfg = getAppConfig();
  const v = validateTarifs_(cfg && cfg.TARIFS);
  if (!v.ok) return { ok:false, errors:v.errors };

  return {
    ok: true,
    tarifs: buildTarifsPublic_(cfg.TARIFS)
  };
}

/** Utilitaire pour le front : autorisé "jour même" ? */
function canBookSameDayPublic() {
  const cfg = getConfig_();
  const r = cfg.RESERVATION || {};
  const tz = r.timezone || Session.getScriptTimeZone();
  const now = new Date();
  const today = new Date(now);
  const [hDeb, mDeb] = String(r.horaires?.debut || "09:00").split(":").map(Number);
  const [hFin, mFin] = String(r.horaires?.fin   || "18:00").split(":").map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hDeb, mDeb);
  const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hFin, mFin);

  const lead = Number(r.same_day_min_lead_minutes || 0);
  const earliestAllowed = new Date(now.getTime() + lead*60000);

  const openToday = (r.jours_ouverts || [1,2,3,4,5]).includes(((now.getDay()+6)%7)+1); // 1..7
  const possible = openToday && earliestAllowed <= end;
  return { ok:true, allowed: possible, lead_minutes: lead };
}

/** ===== Validation minimale pour éviter "config invalide" ===== */
function validateTarifs_(t) {
  const errors = [];
  if (!t) errors.push("TARIFS manquant.");
  if (t && typeof t.baseCourse !== "number") errors.push("TARIFS.baseCourse doit être un nombre.");
  if (t && typeof t.surcUrgence !== "number") errors.push("TARIFS.surcUrgence doit être un nombre.");
  if (t && typeof t.surcSamedi !== "number") errors.push("TARIFS.surcSamedi doit être un nombre.");
  if (t && !t.PDL_PRIX) errors.push("TARIFS.PDL_PRIX manquant.");

  return { ok: errors.length === 0, errors };
}

/** Formate une payload compacte pour l’UI */
function buildTarifsPublic_(t) {
  // Adapte la structure de `TARIFS` (de Configuration.gs) à celle attendue par le front.
  const palier_max_inclus = 1 + (t.PDL_PRIX?.length || 0);
  const prix_palier = t.PDL_PRIX?.[0] || 0;
  const prix_apres = t.PDL_PRIX_FALLBACK || prix_palier;

  return {
    devise: "EUR",
    base: t.baseCourse,
    arrets: {
      palier_max_inclus: palier_max_inclus,
      prix_palier: prix_palier,
      prix_apres:  prix_apres
    },
    options: {
      retour_compte_comme_arret: false, // Non défini dans la config, on met une valeur par défaut.
      urgence: { actif: t.surcUrgence > 0, surcharge: t.surcUrgence, delai_minutes: t.URGENCE_FENETRE_MIN },
      samedi:  { actif: t.surcSamedi > 0,  surcharge: t.surcSamedi }
    }
  };
}
