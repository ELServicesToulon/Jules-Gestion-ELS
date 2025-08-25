// =================================================================
//                        POINT D'ENTRÉE & MENUS
// =================================================================
// Description: Contrôleur principal qui gère les menus dans le Google
//              Sheet et les requêtes web pour afficher les interfaces.
// =================================================================

/**
 * S'exécute à l'ouverture du Google Sheet pour créer les menus.
 */
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();

  // Menu principal
  const menuPrincipal = ui.createMenu('EL Services')
      .addItem('Générer les factures sélectionnées', 'genererFactures')
      .addItem('Envoyer les factures contrôlées', 'envoyerFacturesControlees')
      .addItem("Archiver les factures du mois dernier", "archiverFacturesDuMois")
      .addSeparator()
      .addItem("Vérifier la cohérence du calendrier", "verifierCoherenceCalendrier")
      .addItem("Lancer un audit des partages Drive", "lancerAuditDrive");

  // Sous-menu Maintenance
  const sousMenuMaintenance = ui.createMenu('Maintenance')
      .addItem("Sauvegarder le code du projet", "sauvegarderCodeProjet")
      .addItem("Sauvegarder les données", "sauvegarderDonnees")
      .addItem("Purger les anciennes données (RGPD)", "purgerAnciennesDonnees")
      .addSeparator()
      .addItem("Installer le déclencheur quotidien", "INSTALL_triggers")
      .addSeparator() // Added separator for clarity
      .addItem('Vérifier les en-têtes de colonnes', 'lancerVerificationManuelle'); // Added from Verification.gs
      
  // Sous-menu Debug
  const sousMenuDebug = ui.createMenu('Debug')
      .addItem("Lancer tous les tests", "lancerTousLesTests");
      
  // Ajout des sous-menus et affichage du menu principal
  menuPrincipal.addSubMenu(sousMenuMaintenance);
  menuPrincipal.addSubMenu(sousMenuDebug);
  menuPrincipal.addToUi();

  // Ajout du menu de gestion du schéma
  try {
    SCHEMA_attachMenu();
  } catch (err) {
    Logger.log('SCHEMA_attachMenu indisponible (Schemas.gs non chargé ?) : ' + err);
  }
}

/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput} Le contenu HTML à afficher.
 */
/**
 * Gère les requêtes GET non-UI (API, probes, etc.).
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {ContentService.TextOutput|null} Une réponse de données ou null.
 */
function handleApiRequest(e) {
  const parameter = (e && e.parameter) || {};

  if (parameter.probe) {
    switch (parameter.probe) {
      case 'run-tests':
        const log = lancerTousLesTestsEtRetournerLogs();
        return ContentService.createTextOutput(log)
          .setMimeType(ContentService.MimeType.TEXT);
      case 'tarifs':
        return ContentService.createTextOutput(JSON.stringify(_probeTarifs_()))
          .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (parameter.health === '1') {
    const payload = { ok: true, ts: new Date().toISOString(), page: (parameter.page || 'client') };
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (parameter.action) {
    switch (parameter.action) {
      case 'config':
        return ContentService
          .createTextOutput(JSON.stringify({ ok: true, config: getPublicConfig_() }))
          .setMimeType(ContentService.MimeType.JSON);
      case 'slots':
        try {
          const day = parameter.day;
          const nbArrets = parseInt(parameter.nbArrets, 10);
          if (!day || isNaN(nbArrets)) {
            throw new Error("Les paramètres 'day' et 'nbArrets' sont requis.");
          }
          const result = getAvailableSlots(day, nbArrets);
          return ContentService.createTextOutput(JSON.stringify(result))
                               .setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
          const errorPayload = { error: true, message: err.message };
          return ContentService.createTextOutput(JSON.stringify(errorPayload))
                               .setMimeType(ContentService.MimeType.JSON);
        }
    }
  }

  if (parameter.page === 'ics' && parameter.ids) {
    const ids = parameter.ids.split(',');
    const evenements = obtenirDetailsReservationsParIds(ids);
    if (evenements && evenements.length > 0) {
        const contenuIcs = genererContenuICS(evenements);
        return ContentService.createTextOutput(contenuIcs)
            .setMimeType(ContentService.MimeType.ICAL)
            .downloadAsFile('reservations.ics');
    }
    return ContentService.createTextOutput("Aucune réservation trouvée.");
  }

  return null; // Indique que ce n'était pas une requête API.
}


/**
 * S'exécute lorsqu'un utilisateur accède à l'URL de l'application web.
 * Fait office de routeur pour afficher la bonne page.
 * @param {Object} e L'objet d'événement de la requête.
 * @returns {HtmlOutput|ContentService.TextOutput} Le contenu à afficher.
 */
function doGet(e) {
  // Délègue d'abord les requêtes de type API.
  const apiResponse = handleApiRequest(e);
  if (apiResponse) {
    return apiResponse;
  }

  // Gère ensuite le rendu des pages HTML.
  try {
    const page = e.parameter.page;

    if (page) {
        switch (page) {
            case 'admin':
                const adminEmail = Session.getActiveUser().getEmail();
                // Remplacez ADMIN_EMAIL par une méthode de configuration plus robuste si possible.
                if (adminEmail && getConfiguration().ADMIN_EMAIL && adminEmail.toLowerCase() === getConfiguration().ADMIN_EMAIL.toLowerCase()) {
                    const template = HtmlService.createTemplateFromFile('Admin_Interface');
                    return template.evaluate().setTitle("Tableau de Bord Administrateur").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
                } else {
                    return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\'avez pas les permissions nécessaires.</p>');
                }
            case 'client':
            case 'gestion':
                return renderClientPage(e);
            case 'debug':
                 const debugEmail = Session.getActiveUser().getEmail();
                if (debugEmail && getConfiguration().ADMIN_EMAIL && debugEmail.toLowerCase() === getConfiguration().ADMIN_EMAIL.toLowerCase()) {
                    return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
                } else {
                    return HtmlService.createHtmlOutput('<h1>Accès Refusé</h1><p>Vous n\'avez pas les permissions nécessaires.</p>');
                }
        }
    }

    // Page par défaut : Interface de réservation
    const template = HtmlService.createTemplateFromFile('Reservation_Interface');
    const config = getConfiguration();

    template.public = {
      tarifs: getTarifsPublic().tarifs,
      reservation: getConfig_().RESERVATION, // règles de réservation
      ui: {
        colors: { primary:'#8e44ad', day:'#3498db', option:'#5dade2' },
        today: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        appUrl: ScriptApp.getService().getUrl()
      }
    };
    // Note: 'page' is declared at the top of the 'try' block.
    // We provide a fallback here for when the URL parameter is absent.
    template.page = page || 'reservation';

    return template.evaluate()
        .setTitle((config.NOM_ENTREPRISE || "EL Services") + " | Réservation")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport','width=device-width, initial-scale=1');

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
  try {
    var tpl = HtmlService.createTemplateFromFile('Client_Espace');

    var session = '';
    var email = '';

    // Consommer un token auth → créer session
    if (e && e.parameter && e.parameter.auth) {
      var r = validateAndConsumeToken(e.parameter.auth);
      if (r.ok) {
        session = createSession(r.email);
        email = r.email;
      }
    }

    // Valider une session existante
    if (!email && e && e.parameter && e.parameter.session) {
      var s = validateSession(e.parameter.session);
      if (s.ok) {
        session = e.parameter.session;
        email = s.email;
      }
    }

    // Si on n'a toujours pas d'email, on vérifie l'utilisateur connecté à Google.
    // C'est le cas pour la page 'gestion' accédée directement par un admin/utilisateur loggué.
    if (!email && Session.getActiveUser()) {
        email = Session.getActiveUser().getEmail();
    }

    var base = (getConfiguration().WEBAPP_URL || ScriptApp.getService().getUrl() || '').trim();
    base = base.split('#')[0].split('?')[0];

    tpl.SESSION_ID = session;
    tpl.SESSION_EMAIL = email;
    tpl.WEBAPP_URL = base;
    tpl.ADMIN_EMAIL = ADMIN_EMAIL; // Maintenu pour le lien "Contacter le support"

    return tpl.evaluate()
      .setTitle('Espace Client')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    // Mode debug lisible dans le navigateur: ?page=client&debug=1
    if (e && e.parameter && e.parameter.debug === '1') {
      var pre = HtmlService.createHtmlOutput('<pre style="white-space:pre-wrap">'
        + String(err && err.stack || err) + '</pre>');
      return pre.setTitle('Debug');
    }
    throw err;
  }
}

// Exposer au client
function validateSessionServer(sessionId){ return validateSession(sessionId); } // alias clair

// Deuxième test pour déclencher le workflow

// test pour déclencher le workflow

// Quatrième test

// Cinquième test
