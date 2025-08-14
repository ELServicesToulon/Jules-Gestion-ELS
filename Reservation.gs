// =================================================================
//                      LOGIQUE DE RÉSERVATION
// =================================================================
// Description: Fonctions centrales pour la gestion des réservations.
// =================================================================

/**
 * Traite un panier de réservations soumis par le client.
 * @param {Object} donneesReservation L'objet contenant les infos client et les articles du panier.
 * @returns {Object} Un résumé de l'opération.
 */
function reserverPanier(donneesReservation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, summary: "Le système est occupé. Veuillez réessayer." };
  }

  try {
    const client = donneesReservation.client;
    const items = donneesReservation.items;
    let failedItemIds = [];
    let successfulReservations = [];

    enregistrerOuMajClient(client);
    const clientPourCalcul = obtenirInfosClientParEmail(client.email);

    for (const item of items) {
      const success = creerReservationUnique(item, client, clientPourCalcul);
      if (success) {
        successfulReservations.push(success);
      } else {
        failedItemIds.push(item.id);
      }
    }

    if (successfulReservations.length > 0) {
      notifierClientConfirmation(client.email, client.nom, successfulReservations);
    }

    if (failedItemIds.length > 0) {
        const summary = successfulReservations.length > 0
            ? "Certains créneaux n'étaient plus disponibles mais le reste a été réservé."
            : "Tous les créneaux sélectionnés sont devenus indisponibles.";
        return { success: false, summary: summary, failedItemIds: failedItemIds };
    }

    return { success: true };

  } catch (e) {
    Logger.log(`Erreur critique dans reserverPanier: ${e.stack}`);
    return { success: false, summary: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Crée une réservation unique.
 * @returns {Object|null} L'objet de la réservation réussie ou null si échec.
 */
function creerReservationUnique(item, client, clientPourCalcul) {
    const { date, startTime, totalStops, returnToPharmacy } = item;
    const infosTournee = calculerInfosTourneeBase(totalStops, returnToPharmacy, date, startTime);
    const duree = infosTournee.duree;
    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(date, duree);

    if (!creneauxDisponibles.includes(startTime)) {
        return null; // Échec
    }

    const [heure, minute] = startTime.split('h').map(Number);
    const [annee, mois, jour] = date.split('-').map(Number);
    const dateDebut = new Date(annee, mois - 1, jour, heure, minute);
    const dateFin = new Date(dateDebut.getTime() + duree * 60000);
    const idReservation = 'RESA-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 9);

    const titreEvenement = `Réservation ${NOM_ENTREPRISE} - ${client.nom}`;
    const descriptionEvenement = `Client: ${client.nom} (${client.email})\nID Réservation: ${idReservation}\nDétails: ${infosTournee.details}\nNote: ${client.note || ''}`;
    const evenement = CalendarApp.getCalendarById(ID_CALENDRIER).createEvent(titreEvenement, dateDebut, dateFin, { description: descriptionEvenement });

    if (evenement) {
        const infosPrixFinal = calculerPrixEtDureeServeur(totalStops, returnToPharmacy, date, startTime, clientPourCalcul);
        enregistrerReservationPourFacturation(dateDebut, client.nom, client.email, infosTournee.typeCourse, infosTournee.details, infosPrixFinal.prix, evenement.getId(), idReservation, client.note, infosPrixFinal.tourneeOfferteAppliquee, clientPourCalcul.typeRemise, clientPourCalcul.valeurRemise);
        if (infosPrixFinal.tourneeOfferteAppliquee) {
          decrementerTourneesOffertesClient(client.email);
        }
        return { date: formaterDateEnFrancais(dateDebut), time: startTime, price: infosPrixFinal.prix };
    }
    return null;
}

/**
 * Génère un devis détaillé à partir du panier et l'envoie par email.
 * @param {Object} donneesDevis - Contient les informations client et les articles du panier.
 * @returns {Object} Un objet indiquant le succès de l'opération.
 */
function envoyerDevisParEmail(donneesDevis) {
  try {
    const client = donneesDevis.client;
    const items = donneesDevis.items;
    const emailClient = client.email;

    if (!emailClient || items.length === 0) {
      throw new Error("Email ou panier manquant pour l'envoi du devis.");
    }

    let totalDevis = 0;
    const lignesHtml = items.map(item => {
      const date = new Date(item.date + 'T00:00:00');
      const dateFormatee = formaterDateEnFrancais(date);
      totalDevis += item.prix;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${dateFormatee} à ${item.startTime}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.details}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.prix.toFixed(2)} €</td>
        </tr>
      `;
    }).join('');

    const sujet = `Votre devis de réservation - ${NOM_ENTREPRISE}`;
    const corpsHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Devis pour vos réservations de tournées</h2>
        <p>Bonjour ${client.nom || ''},</p>
        <p>Voici le détail du devis pour les tournées actuellement dans votre panier. Ce devis est valable 24 heures, sous réserve de disponibilité des créneaux.</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 8px; border-bottom: 2px solid #333; text-align: left;">Date et Heure</th>
              <th style="padding: 8px; border-bottom: 2px solid #333; text-align: left;">Détail de la prestation</th>
              <th style="padding: 8px; border-bottom: 2px solid #333; text-align: right;">Prix TTC</th>
            </tr>
          </thead>
          <tbody>
            ${lignesHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 10px 8px; text-align: right; font-weight: bold;">Total Estimé</td>
              <td style="padding: 10px 8px; text-align: right; font-weight: bold;">${totalDevis.toFixed(2)} €</td>
            </tr>
          </tfoot>
        </table>
        <p>Pour confirmer cette réservation, veuillez retourner sur notre application et valider votre panier.</p>
        <p>Merci de votre confiance,<br>L'équipe ${NOM_ENTREPRISE}</p>
      </div>
    `;

    MailApp.sendEmail({
      to: emailClient,
      subject: sujet,
      htmlBody: corpsHtml,
      replyTo: EMAIL_ENTREPRISE
    });

    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans envoyerDevisParEmail: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * Envoie un email de confirmation de réservation au client.
 */
function notifierClientConfirmation(email, nom, reservations) {
    try {
        if (!email || !reservations || reservations.length === 0) return;
        let corpsHtml = `
            <h1>Confirmation de votre réservation</h1>
            <p>Bonjour ${nom},</p>
            <p>Nous avons le plaisir de vous confirmer la réservation des tournées suivantes :</p>
            <ul>
                ${reservations.map(r => `<li>Le <strong>${r.date} à ${r.time}</strong> pour un montant de ${r.price.toFixed(2)} €</li>`).join('')}
            </ul>
            <p>Merci de votre confiance.</p>
            <p>L'équipe ${NOM_ENTREPRISE}</p>
        `;
        MailApp.sendEmail({
            to: email,
            subject: `Confirmation de votre réservation - ${NOM_ENTREPRISE}`,
            htmlBody: corpsHtml,
            replyTo: EMAIL_ENTREPRISE
        });
    } catch (e) {
        Logger.log(`Erreur lors de l'envoi de l'email de confirmation à ${email}: ${e.toString()}`);
    }
}

/**
 * Formate une date en français (ex: "Mercredi 6 août 2025").
 */
function formaterDateEnFrancais(date) {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Calcule les informations de base d'une tournée.
 */
function calculerInfosTourneeBase(totalStops, returnToPharmacy, dateString, startTime) {
  const arretsSupplementaires = Math.max(0, totalStops - 1);
  const duree = DUREE_BASE + (arretsSupplementaires * DUREE_ARRET_SUP);
  const km = KM_BASE + (arretsSupplementaires * KM_ARRET_SUP);
  const heureNormalisee = startTime.replace('h', ':');
  const dateCourse = new Date(`${dateString}T${heureNormalisee}`);
  const maintenant = new Date();
  let typeCourse = 'Normal';

  if ((dateCourse.getTime() - maintenant.getTime()) / 60000 < URGENT_THRESHOLD_MINUTES) {
    typeCourse = 'Urgent';
  } else if (dateCourse.getDay() === 6) {
    typeCourse = 'Samedi';
  }

  const reglesTarifaires = TARIFS[typeCourse] || TARIFS['Normal'];
  let prixFinal = reglesTarifaires.base;

  for (let i = 0; i < arretsSupplementaires; i++) {
    const prixArret = reglesTarifaires.arrets[i] || reglesTarifaires.arrets[reglesTarifaires.arrets.length - 1];
    prixFinal += prixArret;
  }

  if (returnToPharmacy) {
      const dernierIndexArretSup = arretsSupplementaires;
      const prixRetour = reglesTarifaires.arrets[dernierIndexArretSup] || reglesTarifaires.arrets[reglesTarifaires.arrets.length - 1];
      prixFinal += prixRetour;
  }

  const details = `Tournée de ${duree}min (${arretsSupplementaires} arrêt(s) sup., retour: ${returnToPharmacy ? 'oui' : 'non'})`;
  return { prix: prixFinal, duree: duree, km: km, details: details, typeCourse: typeCourse };
}

/**
 * Calcule le prix final en appliquant les remises client.
 */
function calculerPrixEtDureeServeur(totalStops, returnToPharmacy, dateString, startTime, clientInfo) {
  const infosBase = calculerInfosTourneeBase(totalStops, returnToPharmacy, dateString, startTime);
  let prixFinal = infosBase.prix;
  let tourneeOfferteAppliquee = false;

  if (clientInfo) {
    if (clientInfo.nbTourneesOffertes > 0) {
      prixFinal = 0;
      tourneeOfferteAppliquee = true;
    } else if (clientInfo.typeRemise === 'Pourcentage' && clientInfo.valeurRemise > 0) {
      prixFinal *= (1 - clientInfo.valeurRemise / 100);
    } else if (clientInfo.typeRemise === 'Montant Fixe' && clientInfo.valeurRemise > 0) {
      prixFinal = Math.max(0, prixFinal - clientInfo.valeurRemise);
    }
  }

  return {
    prix: prixFinal,
    duree: infosBase.duree,
    details: infosBase.details,
    typeCourse: infosBase.typeCourse,
    tourneeOfferteAppliquee: tourneeOfferteAppliquee
  };
}

/**
 * Vérifie la disponibilité pour une récurrence et propose des alternatives.
 */
function verifierDisponibiliteRecurrence(itemDeBase) {
  const { date, startTime, duree } = itemDeBase;
  const resultats = [];
  const dateInitiale = new Date(date + 'T00:00:00');
  const jourDeLaSemaineCible = dateInitiale.getDay();
  const annee = dateInitiale.getFullYear();
  const mois = dateInitiale.getMonth();
  const joursDuMois = new Date(annee, mois + 1, 0).getDate();

  for (let jour = 1; jour <= joursDuMois; jour++) {
    const dateCourante = new Date(annee, mois, jour);
    if (dateCourante.getDay() === jourDeLaSemaineCible && dateCourante >= new Date(new Date().setHours(0, 0, 0, 0))) {
      const dateString = Utilities.formatDate(dateCourante, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(dateString, duree);
      const dateFormatee = formaterDateEnFrancais(dateCourante);
      let statutPourCeJour = { dateFormatee: dateFormatee, dateISO: dateString, original: startTime };

      if (creneauxDisponibles.includes(startTime)) {
        statutPourCeJour.status = 'OK';
        statutPourCeJour.creneau = startTime;
      } else {
        statutPourCeJour.status = 'Conflict';
        statutPourCeJour.creneau = trouverAlternativeProche(startTime, creneauxDisponibles);
      }
      resultats.push(statutPourCeJour);
    }
  }
  return resultats;
}

/**
 * Trouve le créneau disponible le plus proche d'un créneau cible.
 */
function trouverAlternativeProche(creneauCible, creneauxDisponibles) {
  if (!creneauxDisponibles || creneauxDisponibles.length === 0) {
    return null;
  }
  const cibleEnMinutes = parseInt(creneauCible.split('h')[0]) * 60 + parseInt(creneauCible.split('h')[1]);
  let meilleureAlternative = null;
  let differenceMinimale = Infinity;

  for (const creneau of creneauxDisponibles) {
    const creneauEnMinutes = parseInt(creneau.split('h')[0]) * 60 + parseInt(creneau.split('h')[1]);
    const difference = Math.abs(creneauEnMinutes - cibleEnMinutes);
    if (difference < differenceMinimale) {
      differenceMinimale = difference;
      meilleureAlternative = creneau;
    }
  }
  return meilleureAlternative;
}

/**
 * Récupère toutes les réservations pour un email client (et optionnellement une date).
 */
function obtenirReservationsPourClient(email, date) {
  var sheet = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName('Facturation');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIndex = headers.indexOf("Client (Email)");
  var dateIndex = headers.indexOf("Date");
  var statutIndex = headers.indexOf("Statut");
  var reservations = [];
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var resDate = new Date(row[dateIndex]);
    var clientEmail = (row[emailIndex] || '').toString().trim().toLowerCase();
    var statut = row[statutIndex];
    var matchEmail = email ? clientEmail === email.trim().toLowerCase() : true;
    var matchStatut = statut === "Confirmée";
    var matchDate = true;
    if (date) {
      var resDay = Utilities.formatDate(resDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      var paramDay = Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "dd/MM/yyyy");
      matchDate = resDay === paramDay;
    } else {
      matchDate = resDate >= now;
    }
    if (matchEmail && matchStatut && matchDate) {
      reservations.push(row);
    }
  }
  return reservations;
}
