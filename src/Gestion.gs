// =================================================================
//                      LOGIQUE DE L'ESPACE CLIENT
// =================================================================
// Description: Fonctions qui alimentent l'Espace Client, permettant
//              de visualiser, modifier et déplacer ses réservations.
// =================================================================

/**
 * Valide si un client existe par son email et retourne ses infos de base.
 * @param {string} emailClient L'e-mail à vérifier.
 * @returns {Object} Un objet indiquant le succès et les informations du client si trouvé.
 */
function validerClientParEmail(emailClient) {
  try {
    if (!emailClient || typeof emailClient !== 'string') {
      return { success: false, error: "Email non fourni ou invalide." };
    }
    const infosClient = obtenirInfosClientParEmail(emailClient.trim());

    if (infosClient) {
      return { success: true, client: { nom: infosClient.nom } };
    } else {
      return { success: false, error: "Aucun client trouvé avec cette adresse e-mail." };
    }
  } catch (e) {
    Logger.log(`Erreur dans validerClientParEmail pour ${emailClient}: ${e.stack}`);
    return { success: false, error: "Une erreur serveur est survenue." };
  }
}

/**
 * Récupère toutes les réservations futures pour un client donné.
 * @param {string} emailClient L'e-mail du client.
 * @returns {Object} Un objet contenant les réservations futures du client.
 */
function obtenirReservationsClient(emailClient) {
  try {
    const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    const indices = obtenirIndicesEnTetes(feuille, ["Date", "Client (Email)", "Event ID", "Détails", "Client (Raison S. Client)", "ID Réservation", "Montant"]);

    const donnees = feuille.getDataRange().getValues();
    const maintenant = new Date();

    const reservations = donnees.slice(1).map(ligne => {
      try {
        if (String(ligne[indices["Client (Email)"]]).trim().toLowerCase() !== emailClient.trim().toLowerCase()) {
          return null;
        }

        const dateSheet = new Date(ligne[indices["Date"]]);
        if (isNaN(dateSheet.getTime()) || dateSheet < maintenant) {
          return null;
        }

        const eventId = String(ligne[indices["Event ID"]]).trim();
        let dateDebut = dateSheet;
        let dateFin;

        if (eventId) {
          try {
            const evenementRessource = Calendar.Events.get(ID_CALENDRIER, eventId);
            dateDebut = new Date(evenementRessource.start.dateTime || evenementRessource.start.date);
            dateFin = new Date(evenementRessource.end.dateTime || evenementRessource.end.date);
          } catch (err) {
            Logger.log(`Avertissement: L'événement Calendar (ID: ${eventId}) pour la réservation ${ligne[indices["ID Réservation"]]} est introuvable. La durée sera estimée.`);
          }
        }

        const details = String(ligne[indices["Détails"]]);
        const matchArrets = details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
        const arrets = matchArrets ? parseInt(matchArrets[1], 10) : 0;
        const retour = details.includes('retour: oui');

        if (!dateFin) {
            const totalArretsCalcules = arrets + (retour ? 1 : 0);
            const dureeEstimee = DUREE_BASE + (totalArretsCalcules * DUREE_ARRET_SUP);
            dateFin = new Date(dateDebut.getTime() + dureeEstimee * 60000);
        }

        const totalArretsCalculesPourKm = arrets + (retour ? 1 : 0);
        const km = KM_BASE + (totalArretsCalculesPourKm * KM_ARRET_SUP);

        return {
          id: ligne[indices["ID Réservation"]],
          eventId: eventId,
          start: dateDebut.toISOString(),
          end: dateFin.toISOString(),
          details: details,
          clientName: ligne[indices["Client (Raison S. Client)"]],
          amount: parseFloat(ligne[indices["Montant"]]) || 0,
          km: km
        };

      } catch (e) {
        Logger.log(`Erreur de traitement d'une ligne de réservation pour ${emailClient}: ${e.toString()}`);
        return null;
      }
    }).filter(Boolean);

    return { success: true, reservations: reservations };
  } catch (e) {
    Logger.log(`Erreur critique dans obtenirReservationsClient pour ${emailClient}: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * Récupère toutes les réservations passées pour un client donné.
 * @param {string} emailClient L'e-mail du client.
 * @returns {Object} Un objet contenant les réservations passées et les informations de facturation.
 */
function obtenirReservationsPasseesClient(emailClient) {
  try {
    const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    const indices = obtenirIndicesEnTetes(feuille, ["Date", "Client (Email)", "Détails", "Montant", "N° Facture", "ID PDF"]);
    if (!indices) {
        throw new Error("Impossible de trouver les en-têtes requis dans la feuille Facturation.");
    }

    const donnees = feuille.getDataRange().getValues();
    const maintenant = new Date();

    const reservationsPassees = donnees.slice(1).map(ligne => {
      try {
        if (String(ligne[indices["Client (Email)"]]).trim().toLowerCase() !== emailClient.trim().toLowerCase()) {
          return null;
        }

        const dateSheet = new Date(ligne[indices["Date"]]);
        if (isNaN(dateSheet.getTime()) || dateSheet >= maintenant) {
          return null;
        }

        return {
          date: dateSheet.toISOString(),
          details: ligne[indices["Détails"]],
          montant: parseFloat(ligne[indices["Montant"]]) || 0,
          numeroFacture: ligne[indices["N° Facture"]] || null,
          idPdf: ligne[indices["ID PDF"]] || null
        };

      } catch (e) {
        Logger.log(`Erreur de traitement d'une ligne de réservation passée pour ${emailClient}: ${e.toString()}`);
        return null;
      }
    }).filter(Boolean);

    // Trier par date, du plus récent au plus ancien
    reservationsPassees.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { success: true, reservations: reservationsPassees };
  } catch (e) {
    Logger.log(`Erreur critique dans obtenirReservationsPasseesClient pour ${emailClient}: ${e.stack}`);
    return { success: false, error: e.message };
  }
}


/**
 * Met à jour les détails (nombre d'arrêts, prix, durée) d'une réservation existante.
 * @param {string} idReservation L'ID unique de la réservation à modifier.
 * @param {number} nouveauxArrets Le nouveau nombre d'arrêts supplémentaires.
 * @returns {Object} Un résumé de l'opération.
 */
function mettreAJourDetailsReservation(idReservation, newTotalStops) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé, veuillez réessayer." };

  try {
    const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
    const indices = {
      idResa: enTete.indexOf("ID Réservation"), idEvent: enTete.indexOf("Event ID"),
      details: enTete.indexOf("Détails"), email: enTete.indexOf("Client (Email)"),
      montant: enTete.indexOf("Montant"), date: enTete.indexOf("Date")
    };
    if (Object.values(indices).some(i => i === -1)) throw new Error("Colonnes requises introuvables.");

    const donnees = feuille.getDataRange().getValues();
    const indexLigne = donnees.findIndex(row => String(row[indices.idResa]).trim() === String(idReservation).trim());
    if (indexLigne === -1) return { success: false, error: "Réservation introuvable." };

    const ligneDonnees = donnees[indexLigne];
    const idEvenement = String(ligneDonnees[indices.idEvent]).trim();
    const emailClient = ligneDonnees[indices.email];

    let ressourceEvenement = null;
    let dateDebutOriginale = new Date(ligneDonnees[indices.date]); // Fallback sur la date du Sheet

    try {
      if (idEvenement) {
        ressourceEvenement = Calendar.Events.get(ID_CALENDRIER, idEvenement);
        dateDebutOriginale = new Date(ressourceEvenement.start.dateTime);
      }
    } catch (e) {
      Logger.log(`Événement ${idEvenement} introuvable pour modification. Seule la feuille de calcul sera mise à jour.`);
      ressourceEvenement = null;
    }

    const dateEvenement = formaterDateEnYYYYMMDD(dateDebutOriginale);
    const heureEvenement = formaterDateEnHHMM(dateDebutOriginale);

    const retourPharmacie = newTotalStops > 1;
    const additionalStops = Math.max(0, newTotalStops - 2);
    const nbDeliveries = 1 + additionalStops;

    const clientPourCalcul = obtenirInfosClientParEmail(emailClient);
    const { prix: nouveauPrix, duree: nouvelleDuree } = calculerPrixEtDureeServeur(nbDeliveries, retourPharmacie, dateEvenement, heureEvenement, clientPourCalcul);
    const nouveauxDetails = `Tournée de ${nouvelleDuree}min (${additionalStops} arrêt(s) sup., retour: ${retourPharmacie ? 'oui' : 'non'})`;

    const nouvelleDateFin = new Date(dateDebutOriginale.getTime() + nouvelleDuree * 60000);

    // Ajout de la vérification de conflit
    if (idEvenement) {
        if (verifierConflitModification(dateDebutOriginale, nouvelleDateFin, idEvenement)) {
            return { success: false, error: "La durée modifiée entre en conflit avec une autre réservation." };
        }
    }

    // Si l'événement existe, on le met à jour
    if (ressourceEvenement) {
      const ressourceMaj = {
        end: { dateTime: nouvelleDateFin.toISOString() },
        description: ressourceEvenement.description.replace(/Total:.*€/, `Total: ${nouveauPrix.toFixed(2)} €`).replace(/Arrêts suppl:.*\n/, `Arrêts suppl: ${additionalStops}, Retour: ${retourPharmacie ? 'Oui' : 'Non'}\n`)
      };
      Calendar.Events.patch(ressourceMaj, ID_CALENDRIER, idEvenement);
    }

    // On met TOUJOURS à jour la feuille de calcul
    feuille.getRange(indexLigne + 1, indices.details + 1).setValue(nouveauxDetails);
    feuille.getRange(indexLigne + 1, indices.montant + 1).setValue(nouveauPrix);

    logActivity(idReservation, emailClient, `Modification: ${newTotalStops} arrêts totaux.`, nouveauPrix, "Modification");
    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans mettreAJourDetailsReservation: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Déplace une réservation à une nouvelle date/heure.
 * @param {string} idReservation L'ID de la réservation à déplacer.
 * @param {string} nouvelleDate La nouvelle date.
 * @param {string} nouvelleHeure La nouvelle heure.
 * @returns {Object} Un résumé de l'opération.
 */
function replanifierReservation(idReservation, nouvelleDate, nouvelleHeure) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé." };

  try {
    // --- Validation de la date ---
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0); // On ne compare que la date, pas l'heure
    const dateVoulue = new Date(nouvelleDate);

    if (dateVoulue < aujourdhui) {
      return { success: false, error: "Vous ne pouvez pas déplacer une réservation à une date passée." };
    }
    // --- Fin de la validation ---

    const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
    const indices = {
      idResa: enTete.indexOf("ID Réservation"), idEvent: enTete.indexOf("Event ID"),
      email: enTete.indexOf("Client (Email)"), date: enTete.indexOf("Date"),
      montant: enTete.indexOf("Montant"), details: enTete.indexOf("Détails")
    };
    if (Object.values(indices).some(i => i === -1)) throw new Error("Colonnes requises introuvables.");

    const donnees = feuille.getDataRange().getValues();
    const indexLigne = donnees.findIndex(row => String(row[indices.idResa]).trim() === String(idReservation).trim());
    if (indexLigne === -1) return { success: false, error: "Réservation introuvable." };

    const ligneDonnees = donnees[indexLigne];
    const idEvenementAncien = String(ligneDonnees[indices.idEvent]).trim();
    const emailClient = ligneDonnees[indices.email];
    const details = String(ligneDonnees[indices.details]);

    // Calcul de la durée depuis les détails du Sheet (source de vérité)
    const matchArrets = details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
    const arrets = matchArrets ? parseInt(matchArrets[1], 10) : 0;
    const retour = details.includes('retour: oui');
    const dureeCalculee = DUREE_BASE + ((arrets + (retour ? 1 : 0)) * DUREE_ARRET_SUP);

    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(nouvelleDate, dureeCalculee, idEvenementAncien);
    if (!creneauxDisponibles.includes(nouvelleHeure)) {
      return { success: false, error: "Ce créneau n'est plus disponible." };
    }

    const [annee, mois, jour] = nouvelleDate.split('-').map(Number);
    const [heure, minute] = nouvelleHeure.split('h').map(Number);
    const nouvelleDateDebut = new Date(annee, mois - 1, jour, heure, minute);
    const nouvelleDateFin = new Date(nouvelleDateDebut.getTime() + dureeCalculee * 60000);

    // Essayer de supprimer l'ancien événement s'il existe
    try {
      if (idEvenementAncien) Calendar.Events.remove(ID_CALENDRIER, idEvenementAncien);
    } catch (e) {
      Logger.log(`L'ancien événement ${idEvenementAncien} n'a pas pu être supprimé (il n'existait probablement plus).`);
    }

    // Créer un nouvel événement
    const clientInfos = obtenirInfosClientParEmail(emailClient);
    const titreEvenement = `Réservation ${NOM_ENTREPRISE} - ${clientInfos.nom}`;
    const descriptionEvenement = `Client: ${clientInfos.nom} (${emailClient})\nID Réservation: ${idReservation}\nDétails: ${details}\nTotal: ${ligneDonnees[indices.montant].toFixed(2)} €\nNote: Déplacé par admin.`;
    const nouvelEvenement = CalendarApp.getCalendarById(ID_CALENDRIER).createEvent(titreEvenement, nouvelleDateDebut, nouvelleDateFin, { description: descriptionEvenement });

    if (!nouvelEvenement) {
      throw new Error("La création du nouvel événement dans le calendrier a échoué.");
    }

    // Mettre à jour la feuille avec la nouvelle date et le nouvel ID d'événement
    feuille.getRange(indexLigne + 1, indices.date + 1).setValue(nouvelleDateDebut);
    feuille.getRange(indexLigne + 1, indices.idEvent + 1).setValue(nouvelEvenement.getId());

    logActivity(idReservation, emailClient, `Déplacement au ${nouvelleDate} à ${nouvelleHeure}.`, ligneDonnees[indices.montant], "Modification");
    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans replanifierReservation: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}
/**
 * Gère la demande d'un nouveau lien de connexion par un utilisateur.
 * Vérifie si le client existe et, si oui, lui envoie un nouveau lien par e-mail.
 * @param {string} emailClient L'e-mail du client demandant le lien.
 * @returns {Object} Toujours un objet de succès pour des raisons de sécurité.
 */
function envoyerLienDeConnexion(emailClient) {
  try {
    if (!emailClient) {
      // Ne renvoie pas d'erreur pour ne pas indiquer si un email est valide
      return { success: true };
    }

    const infosClient = obtenirInfosClientParEmail(emailClient.trim());

    // On ne procède à l'envoi que si le client existe
    if (infosClient) {
      const token = genererEtStockerToken(emailClient);
      const appUrl = ScriptApp.getService().getUrl();
      const lienEspaceClient = `${appUrl}?page=gestion&token=${token}`;

      const sujet = `Votre lien d'accès à l'espace client - ${NOM_ENTREPRISE}`;
      const corpsHtml = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Votre lien de connexion personnel</h2>
          <p>Bonjour ${infosClient.nom},</p>
          <p>Suite à votre demande, voici votre nouveau lien pour accéder à votre espace client. Ce lien est personnel et expirera dans 24 heures.</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${lienEspaceClient}" style="background-color: #007bff; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">Accéder à mon espace client</a>
          </p>
          <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.</p>
          <p>Merci,<br>L'équipe ${NOM_ENTREPRISE}</p>
        </div>
      `;

      MailApp.sendEmail({
        to: emailClient,
        subject: sujet,
        htmlBody: corpsHtml,
        replyTo: EMAIL_ENTREPRISE
      });
    }
    
    // On retourne toujours un succès pour ne pas permettre de deviner les emails enregistrés.
    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans envoyerLienDeConnexion pour ${emailClient}: ${e.stack}`);
    // On retourne quand même un succès au client pour la sécurité.
    return { success: true };
  }
}
