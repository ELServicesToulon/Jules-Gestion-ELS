// =================================================================
//                      LOGIQUE DU CALENDRIER
// =================================================================
// Description: Calcule les créneaux disponibles en croisant les
//              données de Google Calendar et les blocages manuels.
// =================================================================

// --- NOUVEAUX HELPERS POUR L'API TARIFAIRE ---

function normaliseTarifs_(CFG){
  const T = CFG.TARIFS;
  return {
    unitPriceFor: (arretIndex) => (arretIndex >= 5 ? T.A_PARTIR_DU_5EME : T.BASE_PAR_ARRET),
    saturdaySurcharge: (date) => (isSaturday_(date) && T.SAMEDI?.ACTIVE ? (T.SAMEDI.SURCHARGE_FIXE||0) : 0),
    urgentSurcharge: (date, slotStart) => {
      if (!T.URGENCE?.ACTIVE) return 0;
      const now = new Date();
      const sameDay = (now.toDateString() === date.toDateString());
      if (!sameDay) return 0;
      const diffMin = Math.round((slotStart - now)/60000);
      return (diffMin >= 0 && diffMin <= (T.URGENCE.CUT_OFF_MINUTES||0)) ? (T.URGENCE.SURCHARGE||0) : 0;
    },
    retourAsExtraStop: !!T.RETOUR_EQUIV_ARRET
  };
}

/**
 * Construit un objet Date à partir d'une date (YYYY-MM-DD) et d'une heure (HHhMM).
 * @private
 */
function buildDateFromDayAndTime_(dayString, timeString) {
  const [year, month, day] = dayString.split('-').map(Number);
  const [hour, minute] = timeString.replace('h', ':').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

/**
 * Vérifie si une date donnée est un samedi.
 * @private
 */
function isSaturday_(date) {
  return date.getDay() === 6;
}

/**
 * API – Retourne les créneaux compatibles pour un jour et un nombre d'arrêts donnés,
 * avec la tarification dynamique calculée côté serveur.
 * @param {string} dayISO La date de la recherche au format "YYYY-MM-DD".
 * @param {number} nbArretsFront Le nombre d'arrêts sélectionné dans l'UI.
 * @param {boolean} retour Indique si le retour pharmacie est coché.
 * @returns {Array<Object>} Une liste d'objets créneau, chacun avec son tarif et ses détails.
 */
function getAvailableSlots(dayISO, nbArretsFront, retour, autresCoursesPanier = []){
  try {
    const CFG = getConfiguration();
    const P = normaliseTarifs_(CFG);
    const day = new Date(dayISO+'T00:00:00');

    const nbArrets = parseInt(nbArretsFront, 10) + (retour && P.retourAsExtraStop ? 1 : 0);
    const arretsSupplementaires = Math.max(0, nbArrets - 1);
    const duree = (CFG.DUREE_BASE || 30) + (arretsSupplementaires * (CFG.DUREE_ARRET_SUP || 15));

    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(dayISO, duree, CFG, null, null, autresCoursesPanier);

    if (!creneauxDisponibles || creneauxDisponibles.length === 0) {
      return [];
    }

    return creneauxDisponibles.map(timeRange => {
      const tags = [];
      let total = 0;

      for (let i=1;i<=nbArrets;i++) {
        total += P.unitPriceFor(i);
      }

      const start = buildDateFromDayAndTime_(dayISO, timeRange);

      total += P.saturdaySurcharge(day);
      const urg = P.urgentSurcharge(day, start);

      if (urg > 0) tags.push('urgent');
      if (isSaturday_(day)) tags.push('samedi');

      return {
        timeRange: timeRange,
        basePrice: total + urg,
        tags: tags,
        details: {
          samedi: P.saturdaySurcharge(day),
          urgence: urg,
          arretSup: arretsSupplementaires
        }
      };
    });
  } catch (e) {
    Logger.log(`Erreur critique dans getAvailableSlots pour le jour ${dayISO} avec ${nbArretsFront} arrêts: ${e.stack}`);
    return [];
  }
}


/**
 * Récupère les événements du calendrier Google pour une période donnée via l'API avancée.
 * @param {Date} dateDebut La date de début de la période.
 * @param {Date} dateFin La date de fin de la période.
 * @param {string} calendarId L'ID du calendrier à consulter.
 * @returns {Array} Une liste d'événements du calendrier, ou un tableau vide en cas d'erreur.
 */
function obtenirEvenementsCalendrierPourPeriode(dateDebut, dateFin, calendarId) {
  try {
    const evenements = Calendar.Events.list(calendarId, {
      timeMin: dateDebut.toISOString(),
      timeMax: dateFin.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    return evenements.items || [];
  } catch (e) {
    Logger.log(`ERREUR API Calendar: ${e.stack}`);
    return [];
  }
}

/**
 * Calcule les créneaux horaires disponibles pour une date et une durée spécifiques.
 * @param {string} dateString La date au format "YYYY-MM-DD".
 * @param {number} duree La durée de la course en minutes.
 * @param {object} config L'objet de configuration global de l'application.
 * @param {string|null} idEvenementAIgnorer L'ID d'un événement à ignorer (pour la modification).
 * @param {Array|null} evenementsPrecharges Une liste d'événements déjà chargés pour optimiser.
 * @param {Array} autresCoursesPanier Les autres courses dans le panier de l'utilisateur.
 * @returns {Array<string>} Une liste de créneaux disponibles au format "HHhMM".
 */
function obtenirCreneauxDisponiblesPourDate(dateString, duree, config, idEvenementAIgnorer = null, evenementsPrecharges = null, autresCoursesPanier = []) {
  try {
    const [annee, mois, jour] = dateString.split('-').map(Number);

    const [heureDebut, minuteDebut] = config.HEURE_DEBUT_SERVICE.split(':').map(Number);
    const [heureFin, minuteFin] = config.HEURE_FIN_SERVICE.split(':').map(Number);
    const debutJournee = new Date(annee, mois - 1, jour, heureDebut, minuteDebut);
    const finJournee = new Date(annee, mois - 1, jour, heureFin, minuteFin);

    const maintenant = new Date();
    const estAdmin = (Session.getActiveUser().getEmail().toLowerCase() === config.ADMIN_EMAIL.toLowerCase());

    // CORRECTION : Pour les non-admins, on bloque les jours passés. Pour les admins, on ne bloque JAMAIS.
    if (!estAdmin && new Date(dateString + "T23:59:59") < maintenant) {
        return [];
    }

    const evenementsCalendrier = evenementsPrecharges
        ? evenementsPrecharges.filter(e => formaterDateEnYYYYMMDD(new Date(e.start.dateTime || e.start.date)) === dateString)
        : obtenirEvenementsCalendrierPourPeriode(debutJournee, finJournee, config.ID_CALENDRIER);

    const plagesManuellementBloquees = obtenirPlagesBloqueesPourDate(debutJournee);

    const reservationsPanier = autresCoursesPanier.map(item => {
        const [itemHeureDebut, itemMinuteDebut] = item.startTime.split('h').map(Number);
        const dureeNumerique = parseFloat(item.duree);
        const debut = new Date(annee, mois - 1, jour, itemHeureDebut, itemMinuteDebut);
        if (isNaN(debut.getTime()) || isNaN(dureeNumerique)) { return null; }
        const fin = new Date(debut.getTime() + dureeNumerique * 60000);
        return { start: { dateTime: debut.toISOString() }, end: { dateTime: fin.toISOString() }, id: `panier-${item.id}` };
    }).filter(Boolean);

    const indisponibilitesNormalisees = [
      ...evenementsCalendrier.map(e => ({ id: e.id, start: new Date(e.start.dateTime || e.start.date), end: new Date(e.end.dateTime || e.end.date) })),
      ...reservationsPanier.map(e => ({ id: e.id, start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) })),
      ...plagesManuellementBloquees.map((e, i) => ({ id: `manuel-${i}`, start: e.start, end: e.end }))
    ].filter(indispo => !isNaN(indispo.start.getTime()) && !isNaN(indispo.end.getTime()));

    const creneauxPotentiels = [];
    let heureActuelle = new Date(debutJournee);
    const idPropreAIgnorer = idEvenementAIgnorer ? idEvenementAIgnorer.split('@')[0] : null;

    // PATCH: Pour les non-admins, si on est aujourd'hui, on ne propose que les créneaux à venir en respectant le tampon.
    const todayString = formaterDateEnYYYYMMDD(maintenant);
    if (!estAdmin && dateString === todayString) {
      const heureNowEnMinutes = maintenant.getHours() * 60 + maintenant.getMinutes();
      const debutMin = heureNowEnMinutes + (config.DUREE_TAMPON_MINUTES || 0);

      // Avance l'heure de début jusqu'au premier créneau réellement disponible
      while (heureActuelle.getHours() * 60 + heureActuelle.getMinutes() < debutMin) {
        heureActuelle.setMinutes(heureActuelle.getMinutes() + config.INTERVALLE_CRENEAUX_MINUTES);
        // Sécurité pour ne pas boucler indéfiniment si la journée est terminée
        if (heureActuelle > finJournee) break;
      }
    }

    while (heureActuelle < finJournee) {
      const debutCreneau = new Date(heureActuelle);
      const finCreneau = new Date(debutCreneau.getTime() + duree * 60000);

      if (finCreneau > finJournee) break;

      let estLibre = true;
      for (const indispo of indisponibilitesNormalisees) {
        if (indispo.id === idPropreAIgnorer) continue;
        const debutIndispo = indispo.start;
        const finAvecTampon = new Date(indispo.end.getTime() + config.DUREE_TAMPON_MINUTES * 60000);
        if (debutCreneau < finAvecTampon && finCreneau > debutIndispo) {
          estLibre = false;
          break;
        }
      }

      if (estLibre) {
        creneauxPotentiels.push(debutCreneau);
      }

      heureActuelle.setMinutes(heureActuelle.getMinutes() + config.INTERVALLE_CRENEAUX_MINUTES);
    }

    return creneauxPotentiels.map(creneau => formaterDateEnHHMM(creneau));

  } catch (e) {
    Logger.log(`Erreur dans obtenirCreneauxDisponiblesPourDate pour ${dateString}: ${e.stack}`);
    return [];
  }
}

/**
 * Renvoie la disponibilité de chaque jour du mois pour l'affichage du calendrier public.
 * @param {number|string} mois Le mois (1-12).
 * @param {number|string} annee L'année.
 * @returns {Object} Un objet avec le niveau de disponibilité pour chaque jour.
 */
function obtenirDonneesCalendrierPublic(mois, annee) {
  const cache = CacheService.getScriptCache();
  const cleCache = `dispo_${annee}_${mois}`;
  const donneesEnCache = cache.get(cleCache);

  if (donneesEnCache) {
    return JSON.parse(donneesEnCache);
  }

  try {
    const config = getConfiguration();
    if (typeof mois === 'string') mois = Number(mois);
    if (typeof annee === 'string') annee = Number(annee);
    if (!mois || !annee || mois < 1 || mois > 12) {
      throw new Error("Mois ou année invalide.");
    }

    const disponibilite = {};
    const dateDebutMois = new Date(annee, mois - 1, 1);
    const dateFinMois = new Date(annee, mois, 0);
    const evenementsDuMois = obtenirEvenementsCalendrierPourPeriode(dateDebutMois, new Date(annee, mois, 1), config.ID_CALENDRIER);

    const maintenant = new Date();
    const dateAujourdhuiString = formaterDateEnYYYYMMDD(maintenant);
    const [heureFin, minuteFin] = config.HEURE_FIN_SERVICE.split(':').map(Number);

    for (let d = new Date(dateDebutMois); d <= dateFinMois; d.setDate(d.getDate() + 1)) {
      const dateString = formaterDateEnYYYYMMDD(d);

      if (d.getDay() === 0) { // Dimanche
        disponibilite[dateString] = { disponibles: 0, total: 0 };
        continue;
      }

      const finServiceJour = new Date(d);
      finServiceJour.setHours(heureFin, minuteFin, 0, 0);

      if (dateString < dateAujourdhuiString || (dateString === dateAujourdhuiString && maintenant > finServiceJour)) {
          disponibilite[dateString] = { disponibles: 0, total: 0 };
          continue;
      }

      const creneaux = obtenirCreneauxDisponiblesPourDate(dateString, config.DUREE_BASE, config, null, evenementsDuMois);

      const debutServiceJour = new Date(d);
      debutServiceJour.setHours(...config.HEURE_DEBUT_SERVICE.split(':').map(Number));
      const totalCreneauxPossibles = Math.floor(((finServiceJour - debutServiceJour) / 60000) / config.INTERVALLE_CRENEAUX_MINUTES);

      disponibilite[dateString] = { disponibles: creneaux.length, total: totalCreneauxPossibles > 0 ? totalCreneauxPossibles : 1 };
    }

    const resultat = { disponibilite: disponibilite };
    cache.put(cleCache, JSON.stringify(resultat), 7200); // Cache de 2 heures

    return resultat;
  } catch (e) {
    Logger.log(`ERREUR dans obtenirDonneesCalendrierPublic: ${e.stack}`);
    return { disponibilite: {} };
  }
}

/**
 * Vérifie si une période donnée entre en conflit avec des événements existants.
 * @param {Date} dateDebut La date de début de la période à vérifier.
 * @param {Date} dateFin La date de fin de la période à vérifier.
 * @param {string} idEvenementAIgnorer L'ID de l'événement à ignorer lors de la vérification.
 * @returns {boolean} Vrai s'il y a un conflit, sinon faux.
 */
function verifierConflitModification(dateDebut, dateFin, idEvenementAIgnorer) {
    const config = getConfiguration();
    const evenementsCalendrier = obtenirEvenementsCalendrierPourPeriode(dateDebut, dateFin, config.ID_CALENDRIER);
    const plagesManuellementBloquees = obtenirPlagesBloqueesPourDate(dateDebut);

    const indisponibilites = [
      ...evenementsCalendrier.map(e => ({ id: e.id, start: new Date(e.start.dateTime || e.start.date), end: new Date(e.end.dateTime || e.end.date) })),
      ...plagesManuellementBloquees.map((e, i) => ({ id: `manuel-${i}`, start: e.start, end: e.end }))
    ];

    for (const indispo of indisponibilites) {
        // Ignore l'événement que nous sommes en train de modifier
        if (indispo.id === idEvenementAIgnorer) {
            continue;
        }

        // Logique de vérification de chevauchement
        const debutIndispo = indispo.start;
        const finIndispo = indispo.end;
        if (dateDebut < finIndispo && dateFin > debutIndispo) {
            Logger.log(`Conflit détecté: La modification de ${idEvenementAIgnorer} (${dateDebut} - ${dateFin}) entre en conflit avec ${indispo.id} (${debutIndispo} - ${finIndispo})`);
            return true; // Conflit trouvé
        }
    }

    return false; // Aucun conflit
}
