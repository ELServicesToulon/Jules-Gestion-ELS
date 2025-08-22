// =================================================================
//                      LOGIQUE DU CALENDRIER
// =================================================================
// Description: Calcule les créneaux disponibles en croisant les
//              données de Google Calendar et les blocages manuels.
// =================================================================

// --- NOUVEAUX HELPERS POUR L'API TARIFAIRE ---

/**
 * Construit un objet Date à partir d'une date (YYYY-MM-DD) et d'une heure (HHhMM).
 * @private
 * @param {string} dayString La date au format 'YYYY-MM-DD'.
 * @param {string} timeString L'heure au format 'HHhMM'.
 * @returns {Date} L'objet Date construit.
 */
function buildDateFromDayAndTime_(dayString, timeString) {
  const [year, month, day] = dayString.split('-').map(Number);
  const [hour, minute] = timeString.replace('h', ':').split(':').map(Number);
  // Le mois est 0-indexé en JS, donc on fait month - 1
  return new Date(year, month - 1, day, hour, minute);
}

/**
 * Vérifie si une date donnée est un samedi.
 * @private
 * @param {Date} date L'objet Date à vérifier.
 * @returns {boolean} Vrai si la date est un samedi, sinon faux.
 */
function isSaturday_(date) {
  return date.getDay() === 6;
}

/**
 * Vérifie si un créneau est considéré comme "urgent".
 * @private
 * @param {Date} slotDate La date et l'heure du créneau.
 * @param {object} config L'objet de configuration de l'application.
 * @returns {boolean} Vrai si le créneau est urgent, sinon faux.
 */
function isUrgence_(slotDate, config) {
  const now = new Date();
  // Ne peut pas être urgent si le créneau est déjà passé
  if (slotDate < now) return false;

  // Le créneau est urgent si la différence en minutes est inférieure au seuil défini
  const diffMinutes = (slotDate.getTime() - now.getTime()) / 60000;
  return diffMinutes < (config.URGENT_DELAI_MIN || 30);
}

/**
 * API – Retourne les créneaux compatibles pour un jour et un nombre d'arrêts donnés,
 * avec la tarification dynamique calculée côté serveur.
 * Cette fonction est exposée au client via google.script.run.
 *
 * @param {string} day La date de la recherche au format "YYYY-MM-DD".
 * @param {number} nbArrets Le nombre total d'arrêts pour la tournée (1 = prise en charge seule).
 * @returns {Array<Object>} Une liste d'objets créneau, chacun avec son tarif et ses détails.
 */
function getAvailableSlots(day, nbArrets, autresCoursesPanier = []) {
  try {
    const config = getConfiguration();
    // nbArrets est le nombre total d'arrêts, incluant le premier.
    const arretsSupplementaires = Math.max(0, parseInt(nbArrets, 10) - 1);

    // Calcul de la durée totale de la prestation en se basant sur la configuration
    const duree = config.DUREE_BASE + (arretsSupplementaires * (config.DUREE_ARRET_SUP || 15));

    // 1. Obtenir les créneaux de base disponibles, en tenant compte du panier actuel
    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(day, duree, config, null, null, autresCoursesPanier);

    if (!creneauxDisponibles || creneauxDisponibles.length === 0) {
      return []; // Aucun créneau trouvé, on retourne un tableau vide
    }

    const now = new Date();
    // Utilise la fonction utilitaire pour la comparaison pour garantir la cohérence
    const isToday = (formaterDateEnYYYYMMDD(now) === day);

    // 2. Enrichir chaque créneau avec les informations de tarification dynamique
    return creneauxDisponibles.map(timeRange => {
      const slotDate = buildDateFromDayAndTime_(day, timeRange);
      const samedi = isSaturday_(slotDate);
      // L'urgence n'est possible que pour des créneaux dans le futur proche le jour même
      const urgence = isToday && isUrgence_(slotDate, config);

      // Déterminer le profil tarifaire à appliquer (Urgence prime sur Samedi)
      let profilTarif = 'Normal';
      if (samedi) profilTarif = 'Samedi';
      if (urgence) profilTarif = 'Urgent';

      const tarifProfile = config.TARIFS[profilTarif] || config.TARIFS['Normal'];

      // Calcul du prix final en suivant la logique de l'objet TARIFS
      let prix = tarifProfile.base;
      const arretsArray = tarifProfile.arrets || [];
      for (let i = 0; i < arretsSupplementaires; i++) {
        // Utilise le dernier tarif si plus d'arrêts sont demandés que définis dans le tableau
        const prixArret = arretsArray[Math.min(i, arretsArray.length - 1)];
        prix += prixArret;
      }

      // Création des tags pour affichage simple sur l'interface
      let tags = [];
      if (samedi) tags.push("samedi");
      if (urgence) tags.push("urgence");

      // Construction de l'objet de retour complet pour ce créneau
      return {
        timeRange: timeRange,
        dispo: true,
        basePrice: prix,
        tags: tags,
        details: {
          samedi: samedi ? tarifProfile.base - config.TARIFS['Normal'].base : 0,
          urgence: urgence ? tarifProfile.base - config.TARIFS['Normal'].base : 0,
          arretSup: arretsSupplementaires
        }
      };
    });

  } catch (e) {
    Logger.log(`Erreur critique dans getAvailableSlots pour le jour ${day} avec ${nbArrets} arrêts: ${e.stack}`);
    // En cas d'erreur, retourner un tableau vide pour ne pas casser le front-end
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

    // CORRECTION : Pour les non-admins, si on est aujourd'hui, on ne propose pas de créneaux déjà passés.
    // Pour les admins, on commence toujours au début du service.
    if (!estAdmin && formaterDateEnYYYYMMDD(debutJournee) === formaterDateEnYYYYMMDD(maintenant) && heureActuelle < maintenant) {
      heureActuelle = maintenant;
      const minutes = heureActuelle.getMinutes();
      const remainder = minutes % config.INTERVALLE_CRENEAUX_MINUTES;
      if (remainder !== 0) {
        heureActuelle.setMinutes(minutes + (config.INTERVALLE_CRENEAUX_MINUTES - remainder));
        heureActuelle.setSeconds(0, 0);
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
