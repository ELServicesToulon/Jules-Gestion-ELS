/** Renvoi public minimal pour le front */
function getTarifsPublic() {
  const cfg = getConfig_();
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
  if (t && typeof t.base !== "number") errors.push("TARIFS.base doit être un nombre.");
  if (t && (!t.arrets || typeof t.arrets.prix_par_arret_palier !== "number"))
    errors.push("TARIFS.arrets.* manquant ou invalide.");
  if (t && !t.options) errors.push("TARIFS.options manquant.");

  return { ok: errors.length === 0, errors };
}

/** Formate une payload compacte pour l’UI */
function buildTarifsPublic_(t) {
  return {
    devise: t.devise || "EUR",
    base: t.base,
    arrets: {
      palier_max_inclus: t.arrets.palier_max_inclus,
      prix_palier: t.arrets.prix_par_arret_palier,
      prix_apres:  t.arrets.prix_par_arret_apres_palier
    },
    options: {
      retour_compte_comme_arret: !!t.options.retour_compte_comme_arret,
      urgence: { actif: !!t.options.urgence?.actif, surcharge: t.options.urgence?.surcharge || 0, delai_minutes: t.options.urgence?.delai_minutes || 0 },
      samedi:  { actif: !!t.options.samedi?.actif,  surcharge: t.options.samedi?.surcharge  || 0 }
    }
  };
}
