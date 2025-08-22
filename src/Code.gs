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
function doGet(e) {
  // Health check rapide
  if (e && e.parameter && e.parameter.health === '1') {
    var payload = { ok: true, ts: new Date().toISOString(), page: (e.parameter.page || 'client') };
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Routeur pour les actions API
  if (e && e.parameter && e.parameter.action) {
    if (e.parameter.action === 'config') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, config: getConfigPublic() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.action === "slots") {
      try {
        const day = e.parameter.day;
        const nbArrets = parseInt(e.parameter.nbArrets, 10);

        // Validation simple des paramètres
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
    // Ajoutez d'autres actions API ici si nécessaire
  }

  try {
    // validerConfiguration(); // Assurez-vous que cette fonction existe ou commentez-la si non utilisée

    // Routeur de page
    if (e.parameter.page) {
        switch (e.parameter.page) {
            case 'admin':
                const adminEmail = Session.getActiveUser().getEmail();
                if (adminEmail && adminEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
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
                if (debugEmail && debugEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    return HtmlService.createHtmlOutputFromFile('Debug_Interface').setTitle("Panneau de Débogage").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
    const config = getConfiguration();
    const publicConfig = getPublicConfig();

    template.appUrl = ScriptApp.getService().getUrl();
    template.nomService = publicConfig.meta.nomService;
    // On utilise les tarifs normalisés de getPublicConfig pour être cohérent avec le reste de l'app
    template.TARIFS_JSON = JSON.stringify(publicConfig.tarifs);
    template.DUREE_BASE = config.DUREE_BASE_MIN || 30;
    template.DUREE_ARRET_SUP = config.DUREE_PAR_ARRET_SUP || 15;
    template.KM_BASE = config.KM_INCLUS || 9;
    template.KM_ARRET_SUP = config.KM_PAR_ARRET_SUP || 5;
    template.URGENT_THRESHOLD_MINUTES = config.URGENT_DELAI_MIN || 45;
    template.dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    // NOUVEAU : Ajout des variables pour la bannière d'information
    template.heureDebut = config.HEURE_DEBUT_SERVICE;
    template.heureFin = config.HEURE_FIN_SERVICE;
    template.prixBase = (publicConfig.tarifs.base && publicConfig.tarifs.base.prix) ? publicConfig.tarifs.base.prix : (config.TARIF_BASE || 15);

    return template.evaluate()
        .setTitle(publicConfig.meta.nomService + " | Réservation")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

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
