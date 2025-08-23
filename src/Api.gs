/**
 * =================================================================
 *                        API DE RÉSERVATION
 * =================================================================
 * Description: Fournit les endpoints pour l'interface de réservation client.
 *              - getAvailableSlots: Retourne les créneaux disponibles.
 * =================================================================
 */

/**
 * API – Retourne les créneaux compatibles pour un jour et un nombre d'arrêts donnés.
 * Toutes les règles (tarifs, surcharges, exceptions) sont lues depuis Configuration.gs.
 * @param {string} day - Date au format 'YYYY-MM-DD'
 * @param {number} nbArrets - Nombre d’arrêts supplémentaires (0 = 1 arrêt au total)
 * @return {Object} Liste des créneaux possibles, avec surcharges et prix dynamiques.
 */
function getAvailableSlots(day, nbArrets) {
  const config = getConfiguration();
  const planning = getPlanningDuJour_(day);

  // Génère les créneaux théoriques pour ce jour
  let slots = genererCreneauxPourJour_(day, config, nbArrets);

  // Pour chaque créneau, on enrichit avec :
  // - Dispo réelle (pas de conflit planning)
  // - Surcharges samedi/urgence si besoin
  // - Prix dynamique calculé
  const now = new Date();
  const isToday = (formatDateForCompare_(now) === day);

  return slots
    .filter(slot => isSlotDispo_(slot, planning, nbArrets)) // Filtrage backend
    .map(slot => {
      const slotDate = buildDateFromDayAndTime_(day, slot.timeRange);

      // Utilise le moteur de pricing centralisé
      const prixInfos = calculePrixBase_(config, nbArrets + 1, { date: day, slotStart: slotDate });

      const tags = [];
      if (prixInfos.regime === 'Samedi') tags.push('samedi');
      if (prixInfos.regime === 'Urgent') tags.push('urgence');

      return {
        timeRange: slot.timeRange,
        dispo: true,
        basePrice: prixInfos.totalHT,
        tags: tags,
        details: {
          regime: prixInfos.regime,
          arrets: prixInfos.nbArrets,
          ...prixInfos.details
        }
      };
    });
}


// =================================================================
//                      FONCTIONS UTILITAIRES (HELPERS)
// =================================================================

/**
 * Retourne la liste des réservations existantes pour le jour donné.
 * NOTE: Adaptez 'Planning' et les indices de colonnes si votre feuille de calcul est différente.
 * @param {string} day - Date au format 'YYYY-MM-DD'
 * @returns {Array} Tableau d'objets { start: Date, end: Date, nbArrets: number }
 */
function getPlanningDuJour_(day) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Planning');
    if (!sheet) {
      Logger.log("La feuille 'Planning' est introuvable.");
      return [];
    }
    const data = sheet.getDataRange().getValues();
    const planning = [];
    const timeZone = Session.getScriptTimeZone();

    for (let i = 1; i < data.length; i++) { // Saute l'entête
      const row = data[i];
      const dateCell = row[0]; // Colonne A: Date
      if (dateCell && Utilities.formatDate(new Date(dateCell), timeZone, 'yyyy-MM-dd') === day) {
        planning.push({
          start: new Date(row[1]), // Colonne B: Heure de début
          end: new Date(row[2]),   // Colonne C: Heure de fin
          nbArrets: parseInt(row[3], 10) || 0, // Colonne D: Nombre d’arrêts
        });
      }
    }
    return planning;
  } catch(e) {
    Logger.log("Erreur dans getPlanningDuJour_ : " + e.message);
    return []; // Retourne un tableau vide en cas d'erreur
  }
}

/**
 * Génère la liste des créneaux potentiels pour un jour donné.
 * @param {string} day - Date au format 'YYYY-MM-DD'
 * @param {Object} config - Config globale (heures, durée, etc.)
 * @param {number} nbArrets - Nombre d'arrêts à prévoir pour la durée totale.
 * @returns {Array} Liste des créneaux { timeRange: "HH:mm-HH:mm", start: Date, end: Date }
 */
function genererCreneauxPourJour_(day, config, nbArrets) {
  const [year, month, dayNum] = day.split('-').map(Number);
  const aDate = new Date(year, month - 1, dayNum);
  if (config.REGLES && !isSameDayAllowed_(aDate, config.REGLES)) return [];

  const duree = parseInt(config.DUREE_BASE, 10) + (nbArrets - 1) * parseInt(config.DUREE_ARRET_SUP, 10);
  const tampon = parseInt(config.DUREE_TAMPON_MINUTES, 10);
  const debut = config.HEURE_DEBUT_SERVICE || "08:30";
  const fin = config.HEURE_FIN_SERVICE || "18:30";
  const intervalle = parseInt(config.INTERVALLE_CRENEAUX_MINUTES, 10) || 15;

  const timeZone = Session.getScriptTimeZone();

  let dStart = new Date(year, month - 1, dayNum, ...debut.split(':').map(Number));
  let dEnd = new Date(year, month - 1, dayNum, ...fin.split(':').map(Number));

  const slots = [];
  let slotStart = new Date(dStart);

  while (slotStart.getTime() + (duree + tampon) * 60 * 1000 <= dEnd.getTime()) {
    let slotEnd = new Date(slotStart.getTime() + duree * 60 * 1000);
    slots.push({
      timeRange: Utilities.formatDate(slotStart, timeZone, 'HH:mm') +
                 "-" +
                 Utilities.formatDate(slotEnd, timeZone, 'HH:mm'),
      start: new Date(slotStart),
      end: new Date(slotEnd)
    });
    slotStart = new Date(slotStart.getTime() + intervalle * 60 * 1000);
  }
  return slots;
}

/**
 * Teste si un créneau est libre selon le planning du jour.
 * @param {Object} slot - { start: Date, end: Date }
 * @param {Array} planning - Liste des réservations existantes.
 * @returns {boolean}
 */
function isSlotDispo_(slot, planning) {
  for (let i = 0; i < planning.length; i++) {
    const ev = planning[i];
    if (slot.start < ev.end && slot.end > ev.start) {
      return false; // Le créneau chevauche un événement existant
    }
  }
  return true;
}

/**
 * Formate une date JS en 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
function formatDateForCompare_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Construit une Date à partir d'un jour ('YYYY-MM-DD') et d'une heure ('HH:mm' ou 'HH:mm-HH:mm').
 * @param {string} day - Ex: "2025-12-31"
 * @param {string} timeRange - Ex : "14:30-15:00"
 * @returns {Date}
 */
function buildDateFromDayAndTime_(day, timeRange) {
  const heure = timeRange.split('-')[0];
  const [year, month, dayNum] = day.split('-').map(Number);
  const [h, m] = heure.split(':').map(Number);
  return new Date(year, month - 1, dayNum, h, m);
}

/**
 * Renvoie true si la date est un samedi.
 * @param {Date} date
 * @returns {boolean}
 */
function isSaturday_(date) {
  return date.getDay() === 6;
}

/**
 * Retourne true si le créneau est dans la zone d'urgence.
 * @param {Date} date - Heure de début du créneau.
 * @param {Object} config - Doit contenir URGENT_THRESHOLD_MINUTES.
 * @returns {boolean}
 */
function isUrgence_(date, config) {
  const threshold = parseInt(config.URGENT_THRESHOLD_MINUTES, 10) || 30;
  const now = new Date();
  return (date.getTime() - now.getTime()) / (60 * 1000) < threshold;
}

/**
 * Vérifie si une réservation est autorisée pour le jour même en fonction des règles.
 * @param {Date} date La date de la réservation.
 * @param {Object} regles L'objet REGLES de la configuration.
 * @returns {boolean} True si la réservation est autorisée.
 */
function isSameDayAllowed_(date, regles) {
  if (!regles.ALLOW_SAME_DAY) return false;
  const now = new Date();
  if (!isSameDay_(date, now)) return true; // autre jour → OK
  return now.getHours() < Number(regles.SAME_DAY_CUTOFF_HOUR || 0);
}
