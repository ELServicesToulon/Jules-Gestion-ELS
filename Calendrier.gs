// =================================================================
//                      LOGIQUE DU CALENDRIER
// =================================================================
// Description: Calcule les créneaux disponibles en croisant les
//              données de Google Calendar et les blocages manuels.
// =================================================================

/**
 * Récupère les événements du calendrier Google pour une période donnée via l'API avancée.
 * @param {Date} dateDebut La date de début de la période.
 * @param {Date} dateFin La date de fin de la période.
 * @returns {Array} Une liste d'événements du calendrier, ou un tableau vide en cas d'erreur.
 */
function obtenirEvenementsCalendrierPourPeriode(dateDebut, dateFin) {
  try {
    const evenements = Calendar.Events.list(ID_CALENDRIER, {
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
 * @param {string|null} idEvenementAIgnorer L'ID d'un événement à ignorer (pour la modification).
 * @param {Array|null} evenementsPrecharges Une liste d'événements déjà chargés pour optimiser.
 * @param {Array} autresCoursesPanier Les autres courses dans le panier de l'utilisateur.
 * @returns {Array<string>} Une liste de créneaux disponibles au format "HHhMM".
 */
function obtenirCreneauxDisponiblesPourDate(dateString, duree, idEvenementAIgnorer = null, evenementsPrecharges = null, autresCoursesPanier = []) {
  try {
    const [annee, mois, jour] = dateString.split('-').map(Number);

    const [heureDebut, minuteDebut] = HEURE_DEBUT_SERVICE.split(':').map(Number);
    const [heureFin, minuteFin] = HEURE_FIN_SERVICE.split(':').map(Number);
    const debutJournee = new Date(annee, mois - 1, jour, heureDebut, minuteDebut);
    const finJournee = new Date(annee, mois - 1, jour, heureFin, minuteFin);

    const maintenant = new Date();
    const estAdmin = (Session.getActiveUser().getEmail().toLowerCase() === ADMIN_EMAIL.toLowerCase());

    // CORRECTION : Pour les non-admins, on bloque les jours passés. Pour les admins, on ne bloque JAMAIS.
    if (!estAdmin && new Date(dateString + "T23:59:59") < maintenant) {
        return [];
    }

    const evenementsCalendrier = evenementsPrecharges
        ? evenementsPrecharges.filter(e => formaterDateEnYYYYMMDD(new Date(e.start.dateTime || e.start.date)) === dateString)
        : obtenirEvenementsCalendrierPourPeriode(debutJournee, finJournee);

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
      const remainder = minutes % INTERVALLE_CRENEAUX_MINUTES;
      if (remainder !== 0) {
        heureActuelle.setMinutes(minutes + (INTERVALLE_CRENEAUX_MINUTES - remainder));
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
        const finAvecTampon = new Date(indispo.end.getTime() + DUREE_TAMPON_MINUTES * 60000);
        if (debutCreneau < finAvecTampon && finCreneau > debutIndispo) {
          estLibre = false;
          break;
        }
      }

      if (estLibre) {
        creneauxPotentiels.push(debutCreneau);
      }

      heureActuelle.setMinutes(heureActuelle.getMinutes() + INTERVALLE_CRENEAUX_MINUTES);
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
    if (typeof mois === 'string') mois = Number(mois);
    if (typeof annee === 'string') annee = Number(annee);
    if (!mois || !annee || mois < 1 || mois > 12) {
      throw new Error("Mois ou année invalide.");
    }

    const disponibilite = {};
    const dateDebutMois = new Date(annee, mois - 1, 1);
    const dateFinMois = new Date(annee, mois, 0);
    const evenementsDuMois = obtenirEvenementsCalendrierPourPeriode(dateDebutMois, new Date(annee, mois, 1));

    const maintenant = new Date();
    const dateAujourdhuiString = formaterDateEnYYYYMMDD(maintenant);
    const [heureFin, minuteFin] = HEURE_FIN_SERVICE.split(':').map(Number);

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

      const creneaux = obtenirCreneauxDisponiblesPourDate(dateString, DUREE_BASE, null, evenementsDuMois);

      const debutServiceJour = new Date(d);
      debutServiceJour.setHours(...HEURE_DEBUT_SERVICE.split(':').map(Number));
      const totalCreneauxPossibles = Math.floor(((finServiceJour - debutServiceJour) / 60000) / INTERVALLE_CRENEAUX_MINUTES);

      disponibilite[dateString] = { disponibles: creneaux.length, total: totalCreneauxPossibles > 0 ? totalCreneauxPossibles : 1 };
    }

    const resultat = { disponibilite: disponibilite };
    cache.put(cleCache, JSON.stringify(resultat), 7200); // Cache de 2 heures

    return resultat;
  } catch (e) {
    Logger.log(`ERREUR dans obtenirDonneesCalendrierPublic: ${e.toString()}`);
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
    const evenementsCalendrier = obtenirEvenementsCalendrierPourPeriode(dateDebut, dateFin);
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
