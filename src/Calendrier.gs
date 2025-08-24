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

/**
 * Récupère les événements du calendrier et les plages bloquées pour un jour donné.
 * @param {Date} date Le jour pour lequel récupérer les indisponibilités.
 * @returns {Array<{start: Date, end: Date}>} Un tableau d'objets avec les heures de début et de fin des occupations.
 */
function getCalendarAndBlockedEvents_(date) {
  let busySlots = [];
  try {
    // @ts-ignore
    const calendarId = ID_CALENDRIER; // Assure-toi que cette variable globale est définie
    if (calendarId) {
      const events = CalendarApp.getCalendarById(calendarId).getEventsForDay(date);
      busySlots = events.map(e => ({ start: e.getStartTime(), end: e.getEndTime() }));
    }
  } catch (e) {
    Logger.log(`Avertissement : Impossible de récupérer les événements du calendrier pour le ${date}. Erreur : ${e.message}`);
  }

  try {
    // @ts-ignore
    if (typeof obtenirPlagesBloqueesPourDate === 'function') {
      // @ts-ignore
      const blocked = obtenirPlagesBloqueesPourDate(date);
      busySlots = busySlots.concat(blocked);
    }
  } catch(e) {
    Logger.log(`Avertissement : Impossible de récupérer les plages bloquées pour le ${date}. Erreur : ${e.message}`);
  }

  return busySlots;
}


/**
 * Vérifie si un créneau est disponible en tenant compte des contraintes (jour même, événements existants).
 * @param {Date} start L'heure de début du créneau proposé.
 * @param {number} durationMinutes La durée du créneau en minutes.
 * @param {Array<{start: Date, end: Date}>} busySlots Les créneaux déjà occupés.
 * @returns {boolean} Vrai si le créneau est disponible.
 */
function isSlotDispo_(start, durationMinutes, busySlots){
  if (!_sameDayOK_(start)) return false;

  const end = new Date(start.getTime() + durationMinutes * 60000);

  for (const busy of busySlots) {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    // Vérifie s'il y a un chevauchement
    if (start < busyEnd && end > busyStart) {
      return false; // Le créneau chevauche un événement existant
    }
  }

  return true;
}

function genererCreneauxPourJour_(day /*Date*/, nbPDL){
  const out=[];
  // On récupère une seule fois les événements pour la journée
  const busySlots = getCalendarAndBlockedEvents_(day);

  for (const tr of CONFIG_PLANNING.TIME_RANGES){
    const start = buildDateFromDayAndTime_(day, tr);

    // On calcule d'abord le devis pour connaître la durée
    const devis = computeDevisForSlot_(start, nbPDL);

    // On vérifie la disponibilité avec la durée exacte
    if (!isSlotDispo_(start, devis.minutes, busySlots)) continue;

    out.push({ startISO: formatDateForCompare_(start), label: tr,
               prix: devis.prix, km: devis.km, minutes: devis.minutes,
               tags: [ `PDL:${devis.flags.nbPDL}`, devis.flags.urgent?'Urgent':null, devis.flags.samedi?'Samedi':null ].filter(Boolean) });
  }
  return out;
}

function getAvailableSlots(dayISO, nbPDL){
  return genererCreneauxPourJour_(new Date(dayISO), Number(nbPDL||1));
}
