// =================================================================
//                      LOGIQUE D'ADMINISTRATION
// =================================================================
// Description: Fonctions pour le panneau d'administration et les
//              menus (facturation, gestion des clients et courses).
// =================================================================

/**
 * Récupère TOUTES les réservations (passées, actuelles, futures) sans aucun filtre par date/email.
 * @returns {Object} Un objet avec le statut et la liste complète des réservations.
 */
function obtenirToutesReservationsAdmin() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["Date", "Client (Email)", "Event ID", "Détails", "Client (Raison S. Client)", "ID Réservation", "Montant", "Type Remise Appliquée", "Valeur Remise Appliquée", "Tournée Offerte Appliquée", "Statut"];
    const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);

    const donnees = feuille.getDataRange().getValues();

    const reservations = donnees.slice(1).map(ligne => {
      try {
        // CORRECTION PRINCIPALE : On crée un objet Date complet dès le début
        const dateHeureSheet = new Date(ligne[indices["Date"]]);
        if (isNaN(dateHeureSheet.getTime())) return null; // Ignore les lignes avec une date invalide

        let dateDebutEvenement = dateHeureSheet; // On utilise la date complète du Sheet par défaut
        let dateFinEvenement;
        
        const eventId = String(ligne[indices["Event ID"]]).trim();
        if (eventId) {
          try {
            const evenementRessource = Calendar.Events.get(ID_CALENDRIER, eventId);
            // On met à jour avec les infos du calendrier si elles existent, car elles sont plus précises
            dateDebutEvenement = new Date(evenementRessource.start.dateTime || evenementRessource.start.date);
            dateFinEvenement = new Date(evenementRessource.end.dateTime || evenementRessource.end.date);
          } catch (err) {
            Logger.log(`Avertissement: Événement Calendar ${eventId} introuvable pour la résa ${ligne[indices["ID Réservation"]]}. Utilisation de l'heure du Sheet.`);
          }
        }

        const details = String(ligne[indices["Détails"]]);
        const matchArrets = details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
        const arrets = matchArrets ? parseInt(matchArrets[1], 10) : 0;
        const retour = details.includes('retour: oui');

        if (!dateFinEvenement) {
          const dureeEstimee = DUREE_BASE + ((arrets + (retour ? 1 : 0)) * DUREE_ARRET_SUP);
          dateFinEvenement = new Date(dateDebutEvenement.getTime() + dureeEstimee * 60000);
        }

        const km = KM_BASE + ((arrets + (retour ? 1 : 0)) * KM_ARRET_SUP);
        
        let infoRemise = '';
        const typeRemiseAppliquee = String(ligne[indices["Type Remise Appliquée"]]).trim();
        const valeurRemiseAppliquee = parseFloat(ligne[indices["Valeur Remise Appliquée"]]) || 0;
        const tourneeOfferteAppliquee = ligne[indices["Tournée Offerte Appliquée"]] === true;

        if (tourneeOfferteAppliquee) {
          infoRemise = '(Offerte)';
        } else if (typeRemiseAppliquee === 'Pourcentage' && valeurRemiseAppliquee > 0) {
          infoRemise = `(-${valeurRemiseAppliquee}%)`;
        } else if (typeRemiseAppliquee === 'Montant Fixe' && valeurRemiseAppliquee > 0) {
          infoRemise = `(-${valeurRemiseAppliquee}€)`;
        }

        return {
          id: ligne[indices["ID Réservation"]],
          eventId: eventId,
          start: dateDebutEvenement.toISOString(),
          end: dateFinEvenement.toISOString(),
          details: details,
          clientName: ligne[indices["Client (Raison S. Client)"]],
          clientEmail: ligne[indices["Client (Email)"]],
          amount: parseFloat(ligne[indices["Montant"]]) || 0,
          km: km,
          statut: ligne[indices["Statut"]],
          infoRemise: infoRemise
        };
      } catch(e) { 
        Logger.log(`Erreur de traitement d'une ligne de réservation admin : ${e.toString()} sur la ligne avec ID ${ligne[indices["ID Réservation"]]}`);
        return null; 
      }
    }).filter(Boolean);

    reservations.sort((a, b) => new Date(b.start) - new Date(a.start));
    
    return { success: true, reservations: reservations };
  } catch (e) {
    Logger.log(`Erreur critique dans obtenirToutesReservationsAdmin: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * Récupère TOUTES les réservations pour une date donnée (pour l'Admin).
 * @param {string} dateFiltreString La date à rechercher au format "YYYY-MM-DD".
 * @returns {Object} Un objet avec le statut et la liste des réservations.
 */
function obtenirToutesReservationsPourDate(dateFiltreString) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuille = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["Date", "Client (Email)", "Event ID", "Détails", "Client (Raison S. Client)", "ID Réservation", "Montant", "Type Remise Appliquée", "Valeur Remise Appliquée", "Tournée Offerte Appliquée", "Statut"];
    const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);

    const donnees = feuille.getDataRange().getValues();
    
    const reservations = donnees.slice(1).map(ligne => {
      // CORRECTION PRINCIPALE : On crée un objet Date complet dès le début
      const dateCell = ligne[indices["Date"]];
      if (!dateCell) return null;
      const dateHeureSheet = new Date(dateCell);
      if (isNaN(dateHeureSheet.getTime())) return null;

      // On compare uniquement la partie "jour"
      const dateLigneFormattee = Utilities.formatDate(dateHeureSheet, Session.getScriptTimeZone(), "yyyy-MM-dd");
      
      if (dateLigneFormattee !== dateFiltreString) {
        return null;
      }

      try {
        let dateDebutEvenement = dateHeureSheet; // On utilise la date complète du Sheet par défaut
        let dateFinEvenement;
        
        const eventId = String(ligne[indices["Event ID"]]).trim();
        if (eventId) {
          try {
            const evenementRessource = Calendar.Events.get(ID_CALENDRIER, eventId);
            dateDebutEvenement = new Date(evenementRessource.start.dateTime || evenementRessource.start.date);
            dateFinEvenement = new Date(evenementRessource.end.dateTime || evenementRessource.end.date);
          } catch (err) {
            Logger.log(`Avertissement: Événement Calendar ${eventId} introuvable pour la résa ${ligne[indices["ID Réservation"]]}.`);
          }
        }
        
        const details = String(ligne[indices["Détails"]]);
        const matchArrets = details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
        const arrets = matchArrets ? parseInt(matchArrets[1], 10) : 0;
        const retour = details.includes('retour: oui');
        
        if (!dateFinEvenement) {
            const dureeEstimee = DUREE_BASE + ((arrets + (retour ? 1 : 0)) * DUREE_ARRET_SUP);
            dateFinEvenement = new Date(dateDebutEvenement.getTime() + dureeEstimee * 60000);
        }

        const km = KM_BASE + ((arrets + (retour ? 1 : 0)) * KM_ARRET_SUP);
        
        let infoRemise = '';
        const typeRemiseAppliquee = String(ligne[indices["Type Remise Appliquée"]]).trim();
        const valeurRemiseAppliquee = parseFloat(ligne[indices["Valeur Remise Appliquée"]]) || 0;
        const tourneeOfferteAppliquee = ligne[indices["Tournée Offerte Appliquée"]] === true;

        if (tourneeOfferteAppliquee) {
            infoRemise = '(Offerte)';
        } else if (typeRemiseAppliquee === 'Pourcentage' && valeurRemiseAppliquee > 0) {
            infoRemise = `(-${valeurRemiseAppliquee}%)`;
        } else if (typeRemiseAppliquee === 'Montant Fixe' && valeurRemiseAppliquee > 0) {
            infoRemise = `(-${valeurRemiseAppliquee}€)`;
        }

        return {
          id: ligne[indices["ID Réservation"]],
          eventId: eventId,
          start: dateDebutEvenement.toISOString(),
          end: dateFinEvenement.toISOString(),
          details: details,
          clientName: ligne[indices["Client (Raison S. Client)"]],
          clientEmail: ligne[indices["Client (Email)"]],
          amount: parseFloat(ligne[indices["Montant"]]) || 0,
          km: km,
          statut: ligne[indices["Statut"]],
          infoRemise: infoRemise
        };
      } catch(e) { 
        Logger.log(`Erreur de traitement d'une ligne de réservation admin : ${e.toString()}`);
        return null; 
      }
    }).filter(Boolean);

    reservations.sort((a, b) => new Date(a.start) - new Date(b.start));
    return { success: true, reservations: reservations };

  } catch (e) {
    Logger.log(`Erreur critique dans obtenirToutesReservationsPourDate: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

// --- Le reste de vos fonctions (obtenirTousLesClients, creerReservationAdmin, etc.) reste ici ---
// --- Il est essentiel de conserver le reste du fichier tel quel. ---

/**
 * Récupère la liste complète des clients pour le formulaire d'ajout.
 * @returns {Array<Object>} La liste des clients.
 */
function obtenirTousLesClients() {
    try {
        const feuilleClients = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Clients");
        if (!feuilleClients) return [];
        const indices = obtenirIndicesEnTetes(feuilleClients, ["Email", "Raison Sociale", "Adresse", "SIRET", COLONNE_TYPE_REMISE_CLIENT, COLONNE_VALEUR_REMISE_CLIENT, COLONNE_NB_TOURNEES_OFFERTES]);
        const donnees = feuilleClients.getDataRange().getValues();
        return donnees.slice(1).map(ligne => ({
            email: ligne[indices["Email"]],
            nom: ligne[indices["Raison Sociale"]],
            adresse: ligne[indices["Adresse"]],
            siret: ligne[indices["SIRET"]],
            typeRemise: ligne[indices[COLONNE_TYPE_REMISE_CLIENT]],
            valeurRemise: ligne[indices[COLONNE_VALEUR_REMISE_CLIENT]],
            nbTourneesOffertes: ligne[indices[COLONNE_NB_TOURNEES_OFFERTES]]
        }));
    } catch (e) {
        Logger.log("Erreur dans obtenirTousLesClients: " + e.toString());
        return [];
    }
}

/**
 * Crée une réservation depuis le panneau d'administration.
 * @param {Object} data Les données de la réservation à créer.
 * @returns {Object} Un résumé de l'opération.
 */
function creerReservationAdmin(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé." };

  try {
    if (Session.getActiveUser().getEmail().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }
    
    if (!data.client.email || !data.client.nom || !data.date || !data.startTime) {
        throw new Error("Données de réservation incomplètes.");
    }

    enregistrerOuMajClient(data.client);

    const clientPourCalcul = obtenirInfosClientParEmail(data.client.email);

    const { prix, duree, tourneeOfferteAppliquee } = calculerPrixEtDureeServeur(data.additionalStops + 1, data.returnToPharmacy, data.date, data.startTime, clientPourCalcul);
    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(data.date, duree);
    if (!creneauxDisponibles.includes(data.startTime)) {
      return { success: false, error: `Le créneau ${data.startTime} n'est plus disponible.` };
    }

    const idReservation = 'RESA-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
    const [heure, minute] = data.startTime.split('h').map(Number);
    const [annee, mois, jour] = data.date.split('-').map(Number);
    const dateDebut = new Date(annee, mois - 1, jour, heure, minute);
    const dateFin = new Date(dateDebut.getTime() + duree * 60000);
    const typeCourse = new Date(data.date + 'T00:00:00').getDay() === 6 ? 'Samedi' : 'Normal';

    const titreEvenement = `Réservation ${NOM_ENTREPRISE} - ${data.client.nom}`;
    const descriptionEvenement = `Client: ${data.client.nom} (${data.client.email})\nType: ${typeCourse}\nID Réservation: ${idReservation}\nArrêts suppl: ${data.additionalStops}, Retour: ${data.returnToPharmacy ? 'Oui' : 'Non'}\nTotal: ${prix.toFixed(2)} €\nNote: Ajouté par admin.`;

    const evenement = CalendarApp.getCalendarById(ID_CALENDRIER).createEvent(titreEvenement, dateDebut, dateFin, { description: descriptionEvenement });

    if (evenement) {
      const detailsFacturation = `Tournée de ${duree}min (${data.additionalStops} arrêt(s) sup., retour: ${data.returnToPharmacy ? 'oui' : 'non'})`;
      enregistrerReservationPourFacturation(dateDebut, data.client.nom, data.client.email, typeCourse, detailsFacturation, prix, evenement.getId(), idReservation, "Ajouté par admin", tourneeOfferteAppliquee, clientPourCalcul.typeRemise, clientPourCalcul.valeurRemise);
      logActivity(idReservation, data.client.email, `Réservation manuelle par admin`, prix, "Succès");

      if (tourneeOfferteAppliquee) {
        decrementerTourneesOffertesClient(data.client.email);
      }

      if (data.notifyClient) {
        notifierClientConfirmation(data.client.email, data.client.nom, [{
          date: formaterDatePersonnalise(dateDebut, 'EEEE d MMMM yyyy'),
          time: data.startTime,
          price: prix
        }]);
      }
    } else {
      throw new Error("La création de l'événement dans le calendrier a échoué.");
    }
    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans creerReservationAdmin: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Supprime une réservation.
 * @param {string} idReservation L'ID de la réservation à supprimer.
 * @returns {Object} Un résumé de l'opération.
 */
function supprimerReservation(idReservation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé." };

  try {
    if (Session.getActiveUser().getEmail().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuilleFacturation = SpreadsheetApp.openById(ID_FEUILLE_CALCUL).getSheetByName("Facturation");
    if (!feuilleFacturation) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTete = feuilleFacturation.getRange(1, 1, 1, feuilleFacturation.getLastColumn()).getValues()[0];
    const indices = {
      idResa: enTete.indexOf("ID Réservation"),
      idEvent: enTete.indexOf("Event ID"),
      email: enTete.indexOf("Client (Email)"),
      montant: enTete.indexOf("Montant")
    };
    if (Object.values(indices).some(i => i === -1)) throw new Error("Colonnes requises introuvables.");

    const donneesFacturation = feuilleFacturation.getDataRange().getValues();
    const indexLigneASupprimer = donneesFacturation.findIndex(row => String(row[indices.idResa]).trim() === String(idReservation).trim());

    if (indexLigneASupprimer === -1) {
      return { success: false, error: "Réservation introuvable." };
    }

    const ligneASupprimer = donneesFacturation[indexLigneASupprimer];
    const eventId = String(ligneASupprimer[indices.idEvent]).trim();
    const emailClient = ligneASupprimer[indices.email];
    const montant = ligneASupprimer[indices.montant];

    try {
      CalendarApp.getCalendarById(ID_CALENDRIER).getEventById(eventId).deleteEvent();
    } catch (e) {
      Logger.log(`Impossible de supprimer l'événement Calendar ${eventId}: ${e.message}. Il a peut-être déjà été supprimé.`);
    }

    feuilleFacturation.deleteRow(indexLigneASupprimer + 1);
    logActivity(idReservation, emailClient, `Suppression de course`, montant, "Supprimée");

    return { success: true, message: "Course supprimée avec succès." };

  } catch (e) {
    Logger.log(`Erreur dans supprimerReservation: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fonction principale pour générer les factures SANS les envoyer.
 */
function genererFactures() {
  const ui = SpreadsheetApp.getUi();
  try {
    validerConfiguration();
    logAdminAction("Génération Factures", "Démarrée");

    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    const feuilleFacturation = ss.getSheetByName("Facturation");
    const feuilleClients = ss.getSheetByName("Clients");
    const feuilleParams = ss.getSheetByName("Paramètres");

    if (!feuilleFacturation || !feuilleClients || !feuilleParams) {
      throw new Error("Une des feuilles requises ('Facturation', 'Clients', 'Paramètres') est introuvable.");
    }

    const indicesFacturation = obtenirIndicesEnTetes(feuilleFacturation, ['Date', 'Client (Email)', 'Valider', 'N° Facture', 'Montant', 'ID PDF', 'Détails', 'Note Interne', 'Lien Note']);
    const indicesClients = obtenirIndicesEnTetes(feuilleClients, ["Email", "Raison Sociale", "Adresse"]);

    const clientsData = feuilleClients.getDataRange().getValues();
    const mapClients = new Map(clientsData.slice(1).map(row => [
      String(row[indicesClients["Email"]]).trim(),
      { nom: String(row[indicesClients["Raison Sociale"]]).trim() || 'N/A', adresse: String(row[indicesClients["Adresse"]]).trim() || 'N/A' }
    ]));

    const facturationData = feuilleFacturation.getDataRange().getValues();
    const facturesAGenerer = facturationData
      .map((row, index) => ({ data: row, indexLigne: index + 1 }))
      .slice(1)
      .filter(item => item.data[indicesFacturation['Valider']] === true && !item.data[indicesFacturation['N° Facture']]);

    if (facturesAGenerer.length === 0) {
      ui.alert("Aucune nouvelle ligne à facturer n'a été sélectionnée.");
      return;
    }

    const facturesParClient = facturesAGenerer.reduce((acc, item) => {
      const email = String(item.data[indicesFacturation['Client (Email)']]).trim();
      if (email) {
        if (!acc[email]) acc[email] = [];
        acc[email].push(item);
      }
      return acc;
    }, {});

    let prochainNumFacture = parseInt(feuilleParams.getRange("B1").getValue(), 10);
    const messagesErreurs = [];
    let compteurSucces = 0;

    for (const emailClient in facturesParClient) {
      try {
        const clientInfos = mapClients.get(emailClient);
        if (!clientInfos) throw new Error(`Client ${emailClient} non trouvé.`);
        
        const lignesFactureClient = facturesParClient[emailClient];
        const numFacture = `FACT-${new Date().getFullYear()}-${String(prochainNumFacture).padStart(4, '0')}`;
        const dateFacture = new Date();

        let totalHT = 0;
        const lignesBordereau = [];
        let dateMin = new Date(lignesFactureClient[0].data[indicesFacturation['Date']]);
        let dateMax = new Date(lignesFactureClient[0].data[indicesFacturation['Date']]);

        lignesFactureClient.forEach(item => {
          const ligneData = item.data;
          const montantLigne = parseFloat(ligneData[indicesFacturation['Montant']]) || 0;
          totalHT += montantLigne;
          const dateCourse = new Date(ligneData[indicesFacturation['Date']]);
          if (dateCourse < dateMin) dateMin = dateCourse;
          if (dateCourse > dateMax) dateMax = dateCourse;
          
          lignesBordereau.push({
            date: formaterDatePersonnalise(dateCourse, 'dd/MM/yy'),
            heure: formaterDatePersonnalise(dateCourse, 'HH\'h\'mm'),
            details: ligneData[indicesFacturation['Détails']] || '',
            note: ligneData[indicesFacturation['Note Interne']] || '',
            lienNote: ligneData[indicesFacturation['Lien Note']] || null,
            montant: montantLigne.toFixed(2)
          });
        });

        const tva = TVA_APPLICABLE ? totalHT * TAUX_TVA : 0;
        const totalTTC = totalHT + tva;
        const dateEcheance = new Date(dateFacture.getTime() + (DELAI_PAIEMENT_JOURS * 24 * 60 * 60 * 1000));

        const dossierArchives = DriveApp.getFolderById(ID_DOSSIER_ARCHIVES);
        const dossierAnnee = obtenirOuCreerDossier(dossierArchives, dateFacture.getFullYear().toString());
        const dossierMois = obtenirOuCreerDossier(dossierAnnee, formaterDatePersonnalise(dateFacture, "MMMM yyyy"));

        const modeleFacture = DriveApp.getFileById(ID_MODELE_FACTURE);
        const copieFactureDoc = modeleFacture.makeCopy(`${numFacture} - ${clientInfos.nom}`, dossierMois);
        const doc = DocumentApp.openById(copieFactureDoc.getId());
        const corps = doc.getBody();

        corps.replaceText('{{nom_entreprise}}', NOM_ENTREPRISE);
        corps.replaceText('{{adresse_entreprise}}', ADRESSE_ENTREPRISE);
        corps.replaceText('{{siret}}', SIRET);
        corps.replaceText('{{email_entreprise}}', EMAIL_ENTREPRISE);
        corps.replaceText('{{client_nom}}', clientInfos.nom);
        corps.replaceText('{{client_adresse}}', clientInfos.adresse);
        corps.replaceText('{{numero_facture}}', numFacture);
        corps.replaceText('{{date_facture}}', formaterDatePersonnalise(dateFacture, 'dd/MM/yyyy'));
        corps.replaceText('{{periode_facturee}}', formaterDatePersonnalise(dateMin, 'MMMM yyyy'));
        corps.replaceText('{{date_debut_periode}}', formaterDatePersonnalise(dateMin, 'dd/MM/yyyy'));
        corps.replaceText('{{date_fin_periode}}', formaterDatePersonnalise(dateMax, 'dd/MM/yyyy'));
        corps.replaceText('{{total_ht}}', totalHT.toFixed(2));
        corps.replaceText('{{montant_tva}}', tva.toFixed(2));
        corps.replaceText('{{total_ttc}}', totalTTC.toFixed(2));
        corps.replaceText('{{date_echeance}}', formaterDatePersonnalise(dateEcheance, 'dd/MM/yyyy'));
        corps.replaceText('{{rib_entreprise}}', RIB_ENTREPRISE);
        corps.replaceText('{{bic_entreprise}}', BIC_ENTREPRISE);
        
        const tableBordereau = trouverTableBordereau(corps);
        if (tableBordereau) {
          while(tableBordereau.getNumRows() > 1) { tableBordereau.removeRow(1); }
          
          lignesBordereau.forEach(ligne => {
            const nouvelleLigne = tableBordereau.appendTableRow();
            nouvelleLigne.appendTableCell(ligne.date);
            nouvelleLigne.appendTableCell(ligne.heure);
            nouvelleLigne.appendTableCell(ligne.details);
            
            const celluleNote = nouvelleLigne.appendTableCell('');
            if (ligne.lienNote && ligne.lienNote.startsWith('http')) {
                celluleNote.setText('Voir Note').editAsText().setLinkUrl(ligne.lienNote);
            } else {
                celluleNote.setText(ligne.note);
            }

            nouvelleLigne.appendTableCell(ligne.montant + ' €');
          });
        } else {
            throw new Error("Aucun tableau de bordereau valide trouvé. Vérifiez les en-têtes.");
        }

        doc.saveAndClose();

        const blobPDF = copieFactureDoc.getAs(MimeType.PDF);
        const fichierPDF = dossierMois.createFile(blobPDF).setName(`${numFacture} - ${clientInfos.nom}.pdf`);

        lignesFactureClient.forEach(item => {
          feuilleFacturation.getRange(item.indexLigne, indicesFacturation['N° Facture'] + 1).setValue(numFacture);
          feuilleFacturation.getRange(item.indexLigne, indicesFacturation['Valider'] + 1).setValue(false);
          feuilleFacturation.getRange(item.indexLigne, indicesFacturation['ID PDF'] + 1).setValue(fichierPDF.getId());
        });

        DriveApp.getFileById(copieFactureDoc.getId()).setTrashed(true);
        prochainNumFacture++;
        compteurSucces++;

      } catch (err) {
        messagesErreurs.push(`Erreur pour ${emailClient}: ${err.message}`);
        Logger.log(`Erreur de facturation pour ${emailClient}: ${err.stack}`);
      }
    }

    feuilleParams.getRange("B1").setValue(prochainNumFacture);
    logAdminAction("Génération Factures", `Succès pour ${compteurSucces} client(s). Erreurs: ${messagesErreurs.length}`);
    
    const messageFinal = `${compteurSucces} facture(s) ont été générée(s) avec succès.\n\n` +
      `Prochaine étape :\n` +
      `1. Contrôlez les PDF dans le dossier Drive.\n` +
      `2. Cochez les cases dans la colonne "Email à envoyer".\n` +
      `3. Utilisez le menu "EL Services > Envoyer les factures contrôlées".\n\n` +
      `Erreurs: ${messagesErreurs.join('\n') || 'Aucune'}`;
    ui.alert("Génération terminée", messageFinal, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(`ERREUR FATALE dans genererFactures: ${e.stack}`);
    logAdminAction("Génération Factures", `Échec critique: ${e.message}`);
    ui.showModalDialog(HtmlService.createHtmlOutput(`<p>Une erreur critique est survenue:</p><pre>${e.message}</pre>`), "Erreur Critique");
  }
}
