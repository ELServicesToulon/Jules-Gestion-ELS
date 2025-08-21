// =================================================================
//                      LOGIQUE GOOGLE SHEETS
// =================================================================
// Description: Fonctions pour interagir avec la base de données
//              Google Sheets (lecture et écriture).
// =================================================================

/**
 * Enregistre un nouveau client ou met à jour un client existant.
 * @param {Object} donneesClient Les données du client.
 */
function enregistrerOuMajClient(donneesClient) {
  try {
    if (!donneesClient || !donneesClient.email) return;
    const feuilleClients = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Clients");
    if (!feuilleClients) throw new Error("La feuille 'Clients' est introuvable.");

    const enTetesRequis = ["Email", "Raison Sociale", "Adresse", "SIRET", COLONNE_TYPE_REMISE_CLIENT, COLONNE_VALEUR_REMISE_CLIENT, COLONNE_NB_TOURNEES_OFFERTES];
    const indices = obtenirIndicesEnTetes(feuilleClients, enTetesRequis);

    const donneesFeuille = feuilleClients.getDataRange().getValues();
    const indexLigneClient = donneesFeuille.findIndex(ligne => String(ligne[indices["Email"]]).toLowerCase() === donneesClient.email.toLowerCase());

    if (indexLigneClient !== -1) { // Le client existe : MISE À JOUR
      const ligneAjour = donneesFeuille[indexLigneClient];
      ligneAjour[indices["Raison Sociale"]] = donneesClient.nom;
      ligneAjour[indices["Adresse"]] = donneesClient.adresse || '';
      ligneAjour[indices["SIRET"]] = donneesClient.siret || '';
      ligneAjour[indices[COLONNE_TYPE_REMISE_CLIENT]] = donneesClient.typeRemise || '';
      ligneAjour[indices[COLONNE_VALEUR_REMISE_CLIENT]] = donneesClient.valeurRemise !== undefined ? donneesClient.valeurRemise : 0;
      ligneAjour[indices[COLONNE_NB_TOURNEES_OFFERTES]] = donneesClient.nbTourneesOffertes !== undefined ? donneesClient.nbTourneesOffertes : 0;
      feuilleClients.getRange(indexLigneClient + 1, 1, 1, ligneAjour.length).setValues([ligneAjour]);
    } else { // Le client n'existe pas : CRÉATION
      const nouvelleLigne = new Array(feuilleClients.getLastColumn()).fill('');
      nouvelleLigne[indices["Email"]] = donneesClient.email;
      nouvelleLigne[indices["Raison Sociale"]] = donneesClient.nom;
      nouvelleLigne[indices["Adresse"]] = donneesClient.adresse || '';
      nouvelleLigne[indices["SIRET"]] = donneesClient.siret || '';
      nouvelleLigne[indices[COLONNE_TYPE_REMISE_CLIENT]] = donneesClient.typeRemise || '';
      nouvelleLigne[indices[COLONNE_VALEUR_REMISE_CLIENT]] = donneesClient.valeurRemise !== undefined ? donneesClient.valeurRemise : 0;
      nouvelleLigne[indices[COLONNE_NB_TOURNEES_OFFERTES]] = donneesClient.nbTourneesOffertes !== undefined ? donneesClient.nbTourneesOffertes : 0;
      feuilleClients.appendRow(nouvelleLigne);
    }
  } catch (e) {
    Logger.log(`Erreur dans enregistrerOuMajClient : ${e.stack}`);
  }
}

/**
 * Recherche les informations d'un client par son e-mail.
 * @param {string} email L'e-mail du client.
 * @returns {Object|null} Les informations du client ou null.
 */
function obtenirInfosClientParEmail(email) {
  try {
    const feuilleClients = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Clients");
    if (!feuilleClients) return null;

    const enTetesRequis = ["Email", "Raison Sociale", "Adresse", "SIRET", COLONNE_TYPE_REMISE_CLIENT, COLONNE_VALEUR_REMISE_CLIENT, COLONNE_NB_TOURNEES_OFFERTES];
    const indices = obtenirIndicesEnTetes(feuilleClients, enTetesRequis);

    const donnees = feuilleClients.getDataRange().getValues();
    const ligneClient = donnees.find(ligne => String(ligne[indices["Email"]]).toLowerCase() === email.toLowerCase());

    if (ligneClient) {
      return {
        email: ligneClient[indices["Email"]],
        nom: ligneClient[indices["Raison Sociale"]] || '',
        adresse: ligneClient[indices["Adresse"]] || '',
        siret: ligneClient[indices["SIRET"]] || '',
        typeRemise: String(ligneClient[indices[COLONNE_TYPE_REMISE_CLIENT]]).trim() || '',
        valeurRemise: parseFloat(ligneClient[indices[COLONNE_VALEUR_REMISE_CLIENT]]) || 0,
        nbTourneesOffertes: parseInt(ligneClient[indices[COLONNE_NB_TOURNEES_OFFERTES]]) || 0
      };
    }
    return null;
  } catch (e) {
    Logger.log(`Erreur dans obtenirInfosClientParEmail : ${e.stack}`);
    return null;
  }
}

/**
 * Décrémente le nombre de tournées offertes pour un client.
 * @param {string} emailClient L'e-mail du client.
 */
function decrementerTourneesOffertesClient(emailClient) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const feuilleClients = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Clients");
    if (!feuilleClients) throw new Error("La feuille 'Clients' est introuvable.");

    const enTetesRequis = ["Email", COLONNE_NB_TOURNEES_OFFERTES];
    const indices = obtenirIndicesEnTetes(feuilleClients, enTetesRequis);

    const donneesFeuille = feuilleClients.getDataRange().getValues();
    const indexLigneClient = donneesFeuille.findIndex(ligne => String(ligne[indices["Email"]]).toLowerCase() === emailClient.toLowerCase());

    if (indexLigneClient !== -1) {
      let nbTournees = parseInt(donneesFeuille[indexLigneClient][indices[COLONNE_NB_TOURNEES_OFFERTES]]) || 0;
      if (nbTournees > 0) {
        feuilleClients.getRange(indexLigneClient + 1, indices[COLONNE_NB_TOURNEES_OFFERTES] + 1).setValue(nbTournees - 1);
      }
    }
  } catch (e) {
    Logger.log(`Erreur dans decrementerTourneesOffertesClient : ${e.stack}`);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Enregistre une réservation dans l'onglet "Facturation".
 * @param {Date} dateHeureDebut L'objet Date de début.
 * @param {string} nomClient Le nom du client.
 * @param {string} emailClient L'e-mail du client.
 * @param {string} type Le type de course.
 * @param {string} details Les détails de la course.
 * @param {number} montant Le montant.
 * @param {string} idEvenement L'ID de l'événement Calendar.
 * @param {string} idReservation L'ID unique de la réservation.
 * @param {string} note La note interne.
 * @param {boolean} tourneeOfferteAppliquee Si une tournée a été offerte.
 * @param {string} typeRemiseAppliquee Le type de remise appliqué.
 * @param {number} valeurRemiseAppliquee La valeur de la remise.
 */
function enregistrerReservationPourFacturation(dateHeureDebut, nomClient, emailClient, type, details, montant, idEvenement, idReservation, note, tourneeOfferteAppliquee = false, typeRemiseAppliquee = '', valeurRemiseAppliquee = 0) {
  try {
    const feuilleFacturation = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    if (!feuilleFacturation) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["Date", "Client (Raison S. Client)", "Client (Email)", "Type", "Détails", "Montant", "Statut", "Valider", "N° Facture", "Event ID", "ID Réservation", "Note Interne", "Tournée Offerte Appliquée", "Type Remise Appliquée", "Valeur Remise Appliquée", "Lien Note"];
    const indices = obtenirIndicesEnTetes(feuilleFacturation, enTetesRequis);

    const nouvelleLigne = new Array(feuilleFacturation.getLastColumn()).fill('');

    nouvelleLigne[indices["Date"]] = dateHeureDebut;
    nouvelleLigne[indices["Client (Raison S. Client)"]] = nomClient;
    nouvelleLigne[indices["Client (Email)"]] = emailClient;
    nouvelleLigne[indices["Type"]] = type;
    nouvelleLigne[indices["Détails"]] = details;
    nouvelleLigne[indices["Montant"]] = parseFloat(montant);
    nouvelleLigne[indices["Statut"]] = "Confirmée";
    nouvelleLigne[indices["Valider"]] = false;
    nouvelleLigne[indices["Event ID"]] = idEvenement;
    nouvelleLigne[indices["ID Réservation"]] = idReservation;
    nouvelleLigne[indices["Note Interne"]] = note || "";
    nouvelleLigne[indices["Tournée Offerte Appliquée"]] = tourneeOfferteAppliquee;
    nouvelleLigne[indices["Type Remise Appliquée"]] = typeRemiseAppliquee;
    nouvelleLigne[indices["Valeur Remise Appliquée"]] = valeurRemiseAppliquee;
    nouvelleLigne[indices["Lien Note"]] = "";

    feuilleFacturation.appendRow(nouvelleLigne);
  } catch (e) {
    Logger.log(`ERREUR CRITIQUE dans enregistrerReservationPourFacturation: ${e.stack}`);
    notifyAdminWithThrottle('ERREUR_LOG_FACTURE', `[${NOM_ENTREPRISE}] Erreur Critique d'Enregistrement Facturation`, `Erreur: ${e.message}`);
  }
}

/**
 * Récupère les plages horaires bloquées pour une date.
 * @param {Date} date La date à vérifier.
 * @returns {Array<Object>} Une liste d'intervalles bloqués.
 */
function obtenirPlagesBloqueesPourDate(date) {
    try {
        const feuillePlagesBloquees = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Plages_Bloquees");
        if (!feuillePlagesBloquees) return [];

        const indices = obtenirIndicesEnTetes(feuillePlagesBloquees, ["Date", "Heure_Debut", "Heure_Fin"]);
        const valeurs = feuillePlagesBloquees.getDataRange().getValues();
        const dateString = formaterDateEnYYYYMMDD(date);
        const intervallesBloques = [];

        for (let i = 1; i < valeurs.length; i++) {
            const ligne = valeurs[i];
            const numeroLigne = i + 1;
            const dateLigne = ligne[indices["Date"]];

            if (dateLigne instanceof Date && formaterDateEnYYYYMMDD(dateLigne) === dateString) {
                const heureDebut = ligne[indices["Heure_Debut"]];
                const heureFin = ligne[indices["Heure_Fin"]];

                if (heureDebut instanceof Date && heureFin instanceof Date) {
                    const dateHeureDebut = new Date(date);
                    dateHeureDebut.setHours(heureDebut.getHours(), heureDebut.getMinutes(), 0, 0);

                    const dateHeureFin = new Date(date);
                    dateHeureFin.setHours(heureFin.getHours(), heureFin.getMinutes(), 0, 0);

                    if (!isNaN(dateHeureDebut.getTime()) && !isNaN(dateHeureFin.getTime())) {
                        intervallesBloques.push({ start: dateHeureDebut, end: dateHeureFin });
                    } else {
                        Logger.log(`AVERTISSEMENT: Donnée de temps invalide dans la feuille "Plages_Bloquees" à la ligne ${numeroLigne}. Heure début: "${heureDebut}", Heure fin: "${heureFin}". Cette plage est ignorée.`);
                    }
                }
            }
        }
        return intervallesBloques;
    } catch (e) {
        Logger.log(`Erreur lors de la lecture des plages bloquées : ${e.stack}`);
        return [];
    }
}

/**
 * Recherche un client par son e-mail et retourne ses informations.
 * @param {string} email L'e-mail du client à rechercher.
 * @returns {Object|null} L'objet client s'il est trouvé, sinon null.
 */
function rechercherClientParEmail(email) {
  return obtenirInfosClientParEmail(email);
}

/**
 * Récupère les détails de plusieurs réservations à partir de leurs IDs.
 * @param {Array<string>} ids La liste des ID de réservation.
 * @returns {Array<Object>} Une liste d'objets contenant les détails de chaque événement.
 */
function obtenirDetailsReservationsParIds(ids) {
  if (!ids || ids.length === 0) return [];

  const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
  const enTetesRequis = ["ID Réservation", "Date", "Détails", "Client (Raison S. Client)"];
  const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);
  const donnees = feuille.getDataRange().getValues();

  const reservationsTrouvees = donnees.slice(1)
    .filter(ligne => ids.includes(String(ligne[indices["ID Réservation"]])))
    .map(ligne => {
      try {
        const dateDebut = new Date(ligne[indices["Date"]]);
        const details = String(ligne[indices["Détails"]]);
        const nomClient = String(ligne[indices["Client (Raison S. Client)"]]);

        const matchDuree = details.match(/(\d+)\s*min/);
        const duree = matchDuree ? parseInt(matchDuree[1], 10) : DUREE_BASE;
        
        const dateFin = new Date(dateDebut.getTime() + duree * 60000);
        const titre = `Réservation ${NOM_ENTREPRISE} - ${nomClient}`;
        const description = `Détails: ${details}`;

        return {
          uid: String(ligne[indices["ID Réservation"]]) + '@' + NOM_ENTREPRISE.replace(/\s/g, ''),
          titre: titre,
          description: description,
          dateDebut: dateDebut,
          dateFin: dateFin
        };
      } catch (e) {
        Logger.log(`Erreur de parsing pour la ligne de réservation ID ${ligne[indices["ID Réservation"]]}: ${e}`);
        return null;
      }
    })
    .filter(Boolean); // Filtrer les résultats nuls en cas d'erreur

  return reservationsTrouvees;
}

/**
 * Récupère toutes les réservations d'un client par son e-mail.
 * @param {string} email L'e-mail du client.
 * @returns {Array<Array>} Un tableau de lignes de réservation.
 */
function obtenirReservationsPourClient(email) {
  try {
    if (!email) return [];
    const feuilleFacturation = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    if (!feuilleFacturation) {
      throw new Error("La feuille 'Facturation' est introuvable.");
    }

    const enTetes = feuilleFacturation.getRange(1, 1, 1, feuilleFacturation.getLastColumn()).getValues()[0];
    const emailColumnIndex = enTetes.indexOf("Client (Email)");

    if (emailColumnIndex === -1) {
      throw new Error("La colonne 'Client (Email)' est introuvable dans l'onglet 'Facturation'.");
    }

    const donnees = feuilleFacturation.getDataRange().getValues();
    const reservationsClient = donnees.slice(1).filter(ligne => {
      return String(ligne[emailColumnIndex]).toLowerCase() === email.toLowerCase();
    });

    return reservationsClient;
  } catch (e) {
    Logger.log(`Erreur dans obtenirReservationsPourClient : ${e.stack}`);
    // En cas d'erreur, retourner un tableau vide pour éviter de bloquer le client.
    return [];
  }
}
