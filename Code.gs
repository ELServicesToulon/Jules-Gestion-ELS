// =================================================================
//                        POINT D'ENTRÉE & MENUS
// =================================================================
// Description: Contrôleur principal qui gère les menus dans le Google
//              Sheet et les requêtes web pour afficher les interfaces.
// =================================================================

/**
 * S'exécute à l'ouverture du Google Sheet pour créer les menus.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menuPrincipal = ui.createMenu('EL Services')
      .addItem('Générer les factures sélectionnées', 'genererFactures')
      .addItem('Envoyer les factures contrôlées', 'envoyerFacturesControlees')
      .addItem("Archiver les factures du mois dernier", "archiverFacturesDuMois")
      .addSeparator()
      .addItem("Vérifier la cohérence du calendrier", "verifierCoherenceCalendrier")
      .addItem("Lancer un audit des partages Drive", "lancerAuditDrive");

  const sousMenuMaintenance = ui.createMenu('Maintenance')
      .addItem("Sauvegarder le code du projet", "sauvegarderCodeProjet")
      .addItem("Sauvegarder les données", "sauvegarderDonnees")
      .addItem("Purger les anciennes données (RGPD)", "purgerAnciennesDonnees");

  const sousMenuDebug = ui.createMenu('Debug')
      .addItem("Lancer tous les tests", "lancerTousLesTests");

  menuPrincipal.addSubMenu(sousMenuMaintenance).addToUi();
  menuPrincipal.addSubMenu(sousMenuDebug).addToUi();
}

/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput} Le contenu HTML à afficher.
 */
function doGet(e) {
  try {
    // validerConfiguration(); // Assurez-vous que cette fonction existe ou commentez-la si non utilisée

    // Routeur de page
    if (e.parameter.page) {
        switch (e.parameter.page) {
            case 'admin':
                const adminEmail = Session.getActiveUser().getEmail();
                if (adminEmail && adminEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    const template = HtmlService.createTemplateFromFile('Admin_Interface');
                    return template.evaluate().setTitle("Tableau de Bord Administrateur").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
                } else {
                    return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\'avez pas les permissions nécessaires.</p>');
                }
            case 'client':
            case 'gestion':
                return renderClientPage(e);
            case 'debug':
                 const debugEmail = Session.getActiveUser().getEmail();
                if (debugEmail && debugEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage");
                } else {
                    return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\'avez pas les permissions nécessaires.</p>');
                }
            case 'ics':
                if (e.parameter.ids) {
                    const ids = e.parameter.ids.split(',');
                    const evenements = obtenirDetailsReservationsParIds(ids);
                    if (evenements && evenements.length > 0) {
                        const contenuIcs = genererContenuICS(evenements);
                        return ContentService.createTextOutput(contenuIcs)
                            .setMimeType(ContentService.MimeType.ICAL)
                            .downloadAsFile('reservations.ics');
                    }
                }
                return ContentService.createTextOutput("Aucune réservation trouvée.");
        }
    }

    // Page par défaut : Interface de réservation
    const template = HtmlService.createTemplateFromFile('Reservation_Interface');
    template.appUrl = ScriptApp.getService().getUrl();
    template.nomService = NOM_ENTREPRISE;
    template.TARIFS_JSON = JSON.stringify(TARIFS);
    template.DUREE_BASE = DUREE_BASE;
    template.DUREE_ARRET_SUP = DUREE_ARRET_SUP;
    template.KM_BASE = KM_BASE;
    template.KM_ARRET_SUP = KM_ARRET_SUP;
    template.URGENT_THRESHOLD_MINUTES = URGENT_THRESHOLD_MINUTES;
    template.dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    // NOUVEAU : Ajout des variables pour la bannière d'information
    template.heureDebut = HEURE_DEBUT_SERVICE;
    template.heureFin = HEURE_FIN_SERVICE;
    template.prixBase = TARIFS['Normal'].base;


    return template.evaluate()
        .setTitle(NOM_ENTREPRISE + " | Réservation")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);

  } catch (error) {
    Logger.log(`Erreur critique dans doGet: ${error.stack}`);
    return HtmlService.createHtmlOutput(
      `<h1>Erreur de configuration</h1><p>L'application ne peut pas démarrer. L'administrateur a été notifié.</p><pre>${error.message}</pre>`
    );
  }
}

/**
 * Permet d'inclure des fichiers (CSS, JS) dans les templates HTML.
 * @param {string} nomFichier Le nom du fichier à inclure.
 * @returns {string} Le contenu du fichier.
 */
function include(nomFichier) {
  return HtmlService.createHtmlOutputFromFile(nomFichier).getContent();
}

function renderClientPage(e) {
  var tpl = HtmlService.createTemplateFromFile('Client_Espace');

  var session = '';
  var email = '';

  if (e && e.parameter && e.parameter.auth) {
    var r = validateAndConsumeToken(e.parameter.auth);
    if (r.ok) {
      session = createSession(r.email);
      email = r.email;
    }
  }

  if (!email && e && e.parameter && e.parameter.session) {
    var s = validateSession(e.parameter.session);
    if (s.ok) {
      session = e.parameter.session;
      email = s.email;
    }
  }

  tpl.SESSION_ID = session;
  tpl.SESSION_EMAIL = email;
  tpl.WEBAPP_URL = getConfiguration().WEBAPP_URL || ScriptApp.getService().getUrl();
  tpl.ADMIN_EMAIL = ADMIN_EMAIL;

  return tpl.evaluate()
            .setTitle('Espace Client')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // si iFrame/Google Sites
}

// Exposer au client
function validateSessionServer(sessionId){ return validateSession(sessionId); } // alias clair
