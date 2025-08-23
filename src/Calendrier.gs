const CONFIG_PLANNING = {
  TIME_RANGES: ["09:00-09:30","09:30-10:00","10:00-10:30","11:00-11:30","14:00-14:30","15:00-15:30","16:00-16:30"],
  ALLOW_SAME_DAY: true,
  SAME_DAY_CUTOFF_MINUTES: 30, // on refuse si le créneau démarre dans < 30 min
};

function formatDateForCompare_(d){
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}
function buildDateFromDayAndTime_(day, timeRange){
  const [h,m]=timeRange.split("-")[0].split(":").map(Number);
  const d=new Date(day); d.setHours(h,m,0,0); return d;
}
function _sameDayOK_(start){
  if (!CONFIG_PLANNING.ALLOW_SAME_DAY) return start.toDateString() !== (new Date()).toDateString();
  const deltaMin = (start - new Date())/60000;
  return deltaMin >= CONFIG_PLANNING.SAME_DAY_CUTOFF_MINUTES;
}
function isSlotDispo_(start /*, planning, nbPDL */){
  // TODO: tes contrôles Agenda existants
  return _sameDayOK_(start);
}

function genererCreneauxPourJour_(day /*Date*/, nbPDL){
  const out=[];
  for (const tr of CONFIG_PLANNING.TIME_RANGES){
    const start = buildDateFromDayAndTime_(day, tr);
    if (!isSlotDispo_(start, null, nbPDL)) continue;
    const devis = computeDevisForSlot_(start, nbPDL);
    out.push({ startISO: formatDateForCompare_(start), label: tr,
               prix: devis.prix, km: devis.km, minutes: devis.minutes,
               tags: [ `PDL:${devis.flags.nbPDL}`, devis.flags.urgent?'Urgent':null, devis.flags.samedi?'Samedi':null ].filter(Boolean) });
  }
  return out;
}

function getAvailableSlots(dayISO, nbPDL){
  return genererCreneauxPourJour_(new Date(dayISO), Number(nbPDL||1));
}
