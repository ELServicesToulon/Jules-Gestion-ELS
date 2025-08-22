// =================================================================
//                      FONCTIONS UTILITAIRES
// =================================================================
// Description: Fonctions d'aide génériques, partagées et
//              réutilisables dans toute l'application.
// =================================================================

// --- FONCTIONS DE FORMATAGE DE DATE (EXISTANTES) ---

/**
 * Convertit un objet Date en chaîne de caractères au format YYYY-MM-DD.
 * @param {Date} date L'objet Date à convertir.
 * @returns {string} La date formatée ou une chaîne vide si l'entrée est invalide.
 */
function formaterDateEnYYYYMMDD(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    Logger.log(`Erreur dans formaterDateEnYYYYMMDD: l'argument n'est pas une Date valide.`);
    return '';
  }
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Convertit un objet Date en chaîne de caractères au format HHhMM.
 * @param {Date} date L'objet Date à convertir.
 * @returns {string} L'heure formatée ou une chaîne vide si l'entrée est invalide.
 */
function formaterDateEnHHMM(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    Logger.log(`Erreur dans formaterDateEnHHMM: l'argument n'est pas une Date valide.`);
    return '';
  }
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "HH'h'mm");
}

/**
 * Formate une date selon un format et un fuseau horaire personnalisés.
 * @param {Date} date L'objet Date à formater.
 * @param {string} format Le format de sortie (ex: "dd/MM/yyyy HH:mm").
 * @param {string} [fuseauHoraire="Europe/Paris"] Le fuseau horaire à utiliser.
 * @returns {string} La date formatée ou une chaîne vide en cas d'erreur.
 */
function formaterDatePersonnalise(date, format, fuseauHoraire = "Europe/Paris") {
  if (!(date instanceof Date) || isNaN(date)) {
    Logger.log(`Erreur dans formaterDatePersonnalise: l'argument n'est pas une Date valide.`);
    return '';
  }
  try {
    return Utilities.formatDate(date, fuseauHoraire, format);
  } catch (e) {
    Logger.log(`Erreur de formatage dans formaterDatePersonnalise: ${e.message}`);
    return '';
  }
}


// --- NOUVELLES FONCTIONS UTILITAIRES AJOUTÉES ---

/**
 * Valide les en-têtes d'une feuille et retourne leurs indices de colonne.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} feuille La feuille à vérifier.
 * @param {Array<string>} enTetesRequis La liste des en-têtes requis.
 * @returns {Object} Un objet mappant les noms d'en-tête à leurs indices.
 */
function obtenirIndicesEnTetes(feuille, enTetesRequis) {
  if (!feuille) throw new Error("La feuille fournie à obtenirIndicesEnTetes est nulle.");
  if (feuille.getLastRow() < 1) throw new Error(`La feuille "${feuille.getName()}" est vide.`);
  const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
  const indices = {};
  const enTetesManquants = enTetesRequis.filter(reqHeader => {
    const index = enTete.findIndex(h => String(h).trim().toLowerCase() === reqHeader.toLowerCase());
    if (index !== -1) {
      indices[reqHeader] = index;
      return false;
    }
    return true;
  });
  if (enTetesManquants.length > 0) {
    throw new Error(`Colonne(s) manquante(s) dans "${feuille.getName()}": ${enTetesManquants.join(', ')}`);
  }
  return indices;
}

/**
 * Obtient un dossier par son nom dans un dossier parent, ou le crée s'il n'existe pas.
 * @param {GoogleAppsScript.Drive.Folder} dossierParent Le dossier parent.
 * @param {string} nomDossier Le nom du dossier à trouver ou créer.
 * @returns {GoogleAppsScript.Drive.Folder} Le dossier trouvé ou créé.
 */
function obtenirOuCreerDossier(dossierParent, nomDossier) {
  const dossiers = dossierParent.getFoldersByName(nomDossier);
  if (dossiers.hasNext()) {
    return dossiers.next();
  }
  return dossierParent.createFolder(nomDossier);
}

/**
 * Trouve le tableau du bordereau dans un document Google Docs.
 * @param {GoogleAppsScript.Document.Body} corps Le corps du document Google Docs.
 * @returns {GoogleAppsScript.Document.Table|null} Le tableau trouvé ou null.
 */
function trouverTableBordereau(corps) {
    const enTetesAttendus = ["Date", "Heure", "Détails de la course", "Notes", "Montant HT"];
    const tables = corps.getTables();
    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        if (table.getNumRows() > 0) {
            const premiereLigne = table.getRow(0);
            if (premiereLigne.getNumCells() >= enTetesAttendus.length) {
                let enTetesTrouves = enTetesAttendus.every((enTete, j) => premiereLigne.getCell(j).getText().trim() === enTete);
                if (enTetesTrouves) {
                    return table;
                }
            }
        }
    }
    return null;
}

/**
 * Crée un lien "Ajouter à Google Agenda".
 * @param {string} titre Le titre de l'événement.
 * @param {Date} dateDebut L'objet Date de début (heure locale du script).
 * @param {Date} dateFin L'objet Date de fin (heure locale du script).
 * @returns {string} L'URL complète pour ajouter l'événement à Google Agenda.
 */
function creerLienGoogleAgenda(titre, dateDebut, dateFin) {
  const formatDateForGoogle = (date) => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const dates = formatDateForGoogle(dateDebut) + '/' + formatDateForGoogle(dateFin);
  
  const details = `Événement de ${NOM_ENTREPRISE}.`;

  const url = "https://www.google.com/calendar/render?action=TEMPLATE" +
              "&text=" + encodeURIComponent(titre) +
              "&dates=" + encodeURIComponent(dates) +
              "&details=" + encodeURIComponent(details) +
              "&location=" + encodeURIComponent(ADRESSE_ENTREPRISE);

  return url;
}

/**
 * Génère le contenu d'un fichier iCalendar (.ics) à partir d'une liste d'événements.
 * @param {Array<Object>} evenements Une liste d'objets événement.
 * @returns {string} Le contenu complet du fichier .ics.
 */
function genererContenuICS(evenements) {
  const formatDateForICS = (date) => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  let icsString = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${NOM_ENTREPRISE}//NONSGML v1.0//EN`,
  ];

  const dtStamp = formatDateForICS(new Date());

  evenements.forEach(event => {
    icsString.push('BEGIN:VEVENT');
    icsString.push(`UID:${event.uid}`);
    icsString.push(`DTSTAMP:${dtStamp}`);
    icsString.push(`DTSTART:${formatDateForICS(event.dateDebut)}`);
    icsString.push(`DTEND:${formatDateForICS(event.dateFin)}`);
    icsString.push(`SUMMARY:${event.titre}`);
    icsString.push(`DESCRIPTION:${event.description}`);
    icsString.push(`LOCATION:${ADRESSE_ENTREPRISE}`);
    icsString.push('END:VEVENT');
  });

  icsString.push('END:VCALENDAR');

  return icsString.join('\r\n');
}

/**
 * Compare deux dates pour voir si elles tombent le même jour (année, mois, jour).
 * @param {Date} a La première date.
 * @param {Date} b La seconde date.
 * @returns {boolean} True si les dates sont le même jour.
 */
function isSameDay_(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}
