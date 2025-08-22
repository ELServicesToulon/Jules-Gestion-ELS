# Jules-Gestion-ELS

**Gestion et automatisation des tournées de livraison pharmaceutique ELS Littoral – Google Workspace & Apps Script**

---

## Présentation

Jules-Gestion-ELS est une extension Google Apps Script sur-mesure pour la gestion ultra-automatisée des réservations et tournées de livraison de pharmacie vers les foyers, EHPAD et particuliers du littoral varois (Tamaris, Mar Vivo, Six-Fours-les-Plages, Sanary, Portissol, Bandol).  
L’outil est conçu pour garantir **zéro papier**, une traçabilité complète, une UX "finger in the nose" et une intégration 100% Google Workspace (Sheets, Drive, Agenda, Apps Script).

---

## Fonctionnalités principales

- **Réservation en ligne et gestion des tournées**  
  Interfaces client et admin totalement distinctes et automatisées via Apps Script et Google Sheets.
- **Automatisation Google Workspace**  
  Synchronisation native avec Agenda, Sheets, Drive, génération de factures PDF Google Docs, archivage Drive, notifications automatisées.
- **Interface utilisateur professionnelle**  
  UI inspirée du monde pharmaceutique (gélules, piluliers, flacons...), boutons en forme de gélule, design mobile-first, police Montserrat, couleurs logo exclusivement.
- **Facturation intelligente**  
  Génération et envoi automatique de factures PDF, archivage, gestion des forfaits, remises, et TVA conforme Art. 293B CGI.
- **Respect de la réglementation**  
  À terme : conformité PDP/OD/loi antifraude TVA, RGPD, accès administrateur, droits avancés et historique.
- **Gestion écologique**  
  Livraison 100% électrique, impact environnemental minimal.

---

## Système de Tarification Dynamique

> **TL;DR:** Toute la tarification (suppléments, arrêts, profils spéciaux) est gérée par un unique objet `TARIFS` dans `src/Configuration.gs`. L’API expose dynamiquement les créneaux et tarifs adaptés à chaque demande. Modifier les prix = modifier `TARIFS`, rien d’autre.

Le système de tarification est conçu pour être 100% centralisé et flexible, permettant des ajustements en temps réel sans toucher à la logique du code.

### 1. Gestion des tarifs pour l'administrateur

Toute la configuration se fait dans l'objet `TARIFS` du fichier `src/Configuration.gs`.

*   **Pour changer un supplément (urgence ou samedi) :**
    → Modifier la clé `base` dans `'Urgent'` ou `'Samedi'` de `TARIFS`.
*   **Pour changer le prix des arrêts supplémentaires :**
    → Modifier le tableau `arrets` dans la section concernée de `TARIFS`.
*   **Pour ajouter un type de course spécial (ex: nuit, Ehpad) :**
    → Ajouter une nouvelle clé dans `TARIFS` en suivant le même format.

**Exemple de l'objet `TARIFS` :**
```js
const TARIFS = {
  'Normal': { base: 15, arrets: [5, 4, 3, 4, 5] },   // Base = 15€, Arrêt 2=5€, 3=4€, ...
  'Samedi': { base: 25, arrets: [5, 4, 3, 4, 5] },   // Supplément samedi = 10€
  'Urgent': { base: 20, arrets: [5, 4, 3, 4, 5] },   // Supplément urgence = 5€
};
```

### 2. Documentation Technique

*   **API Principale : `getAvailableSlots(day, nbArrets)`**
    - C'est la fonction clé qui interroge la configuration en vigueur.
    - Elle applique dynamiquement les bons profils tarifaires (`Normal`, `Samedi`, `Urgent`) selon la date et l'heure du créneau demandé.
    - Elle ne retourne jamais de créneau qui entre en conflit avec le calendrier Google.

*   **Logique Automatisée**
    - Il n'y a **aucune option à cocher côté client** pour "urgence" ou "samedi". Le système détermine automatiquement le bon tarif en fonction de la date du créneau sélectionné.
    - Toute la tarification, y compris les arrêts supplémentaires, est dynamique et gérée par l'objet `TARIFS`. Tout changement est appliqué immédiatement.

*   **Flux de données**
    1.  Le client sélectionne un jour et configure sa tournée (nombre d'arrêts).
    2.  Le front-end appelle `google.script.run.getAvailableSlots(...)`.
    3.  Le back-end (`Calendrier.gs`) calcule les créneaux disponibles et leur applique le prix juste en se basant sur `Configuration.gs`.
    4.  Le front-end reçoit une liste de créneaux avec leur prix final et les affiche à l'utilisateur.

---

## API de Réservation

*   **`getAvailableSlots(day, nbArrets)`** = C'est la fonction clé de l'API qui retourne au front-end *uniquement* les créneaux adaptés à la demande du client (jour, nombre d’arrêts).
*   **Tarification 100% Dynamique** : Tous les tarifs, surcharges et exceptions sont issus de `Configuration.gs`:
    *   **Samedi** : La surcharge est calculée à partir du tarif de base `Samedi`.
    *   **Urgence** : La surcharge est calculée à partir du tarif de base `Urgent` et est déclenchée si la réservation est dans la "fenêtre d'urgence" définie dans la configuration.
    *   **Arrêt supplémentaire** : Le prix total évolue en fonction du nombre d’arrêts.
*   **Zéro Logique Côté Client** : Il n'y a **aucune case à cocher “samedi” ou “urgence”** dans l’interface utilisateur. Tout est déterminé côté serveur et renvoyé comme information au client (via les "tags").
*   **Anti-Conflit** : L’API refuse toute création de réservation qui entrerait en conflit avec le planning existant. Seuls les créneaux réellement disponibles sont proposés.

---

## Prérequis techniques

- **Compte Google** (Drive, Sheets, Agenda, Apps Script activés)
- **Droits d’édition** sur le Google Sheet hôte du projet
- **Accès à l’exécutable WebApp Apps Script**
- **Accès administrateur** pour la configuration initiale

---

## Installation

1. **Cloner ce dépôt** ou importer le code dans votre environnement Apps Script lié au Sheet principal.
2. **Configurer les paramètres dans `Config.gs`**  
   - Tarifs, remises, urgences, samedis, forfaits, etc.
   - Aucune autre source de prix n’est utilisée.
3. **Déployer la WebApp Apps Script** en mode "anonyme" ou "utilisateur actuel" selon les besoins.
4. **Renseigner les ID des documents officiels** (KBIS, RIB, attestations) pour intégration en lecture seule (Drive).
5. **Tester l’intégration avec l’interface front-end** (Google Site ou site custom).

---

## Structure du projet

- `/src/` — Tous les scripts Apps Script (.gs/.html/.json)
- `Config.gs` — Fichier maître de configuration (tarifs, remises, règles, IDs)
- `Calendrier.gs` — Gestion du calendrier, synchronisation Agenda/Sheets
- `Facturation.gs` — Génération PDF, gestion factures, archivage, RIB/coordonnées sur facture
- `Clients.gs` — Gestion des clients, historique, droits, modifications
- `Admin.gs` — Interface et droits administrateur
- `Livreur.gs` — Interface livreur (suivi, retrait, annotations)
- `FAQ.html` — Section aide et FAQ sur le paiement, RGPD, procédure
- `shema.gs` — Vérification et synchronisation des colonnes/onglets essentiels

---

## Sécurité & RGPD

- Accès strictement limité (authentification Google, tokens, droits admin/client/livreur)
- **Politique RGPD complète** (droit à l’oubli, consentement explicite, journalisation)
- Les données sensibles (clients, factures, docs) sont stockées sur Google Drive du compte administrateur central (`elservicestoulon@gmail.com`)

---

## Liens utiles

- **Espace client (WebApp)**  
  [https://script.google.com/macros/s/AKfycbzRzts0VCkAMdjmBYVdWXsAU6QzfThIgoy4Uu4vzb218sFriBlbEHdnGDAfIn7vYI-N/exec?page=gestion](https://script.google.com/macros/s/AKfycbzRzts0VCkAMdjmBYVdWXsAU6QzfThIgoy4Uu4vzb218sFriBlbEHdnGDAfIn7vYI-N/exec?page=gestion)

- **Espace admin (WebApp)**  
  [https://script.google.com/macros/s/AKfycbzRzts0VCkAMdjmBYVdWXsAU6QzfThIgoy4Uu4vzb218sFriBlbEHdnGDAfIn7vYI-N/exec?page=admin](https://script.google.com/macros/s/AKfycbzRzts0VCkAMdjmBYVdWXsAU6QzfThIgoy4Uu4vzb218sFriBlbEHdnGDAfIn7vYI-N/exec?page=admin)

- **Site vitrine / interface client**  
  [https://sites.google.com/view/pharmacie-livraison-ehpad/accueil](https://sites.google.com/view/pharmacie-livraison-ehpad/accueil)

- **Google Sheet hôte du projet**  
  [https://docs.google.com/spreadsheets/d/1-i8xBlCrl_Rrjo2FgiL33pIRjD1EFqyvU7ILPud3-r4/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1-i8xBlCrl_Rrjo2FgiL33pIRjD1EFqyvU7ILPud3-r4/edit?usp=sharing)

- **Script Apps Script (extension du Sheet)**  
  [https://script.google.com/home/projects/1QccdTFLil488QDBf1ooMsUuQldFiJXaWg1kKeX4_L5YfNfmcBbsByp8Z](https://script.google.com/home/projects/1QccdTFLil488QDBf1ooMsUuQldFiJXaWg1kKeX4_L5YfNfmcBbsByp8Z)

- **KBIS Officiel**  
  [Kbis_EL_Service.pdf](./Kbis_EL_Service.pdf)

- **RIB BoursoBank**  
  [iban-boursobank (1).pdf](./iban-boursobank%20(1).pdf)

- **Charte couleur/logo**  
  [els-icone.png](./els-icone.png)

- **Dépôt GitHub**  
  [https://github.com/ELServicesToulon/Jules-Gestion-ELS](https://github.com/ELServicesToulon/Jules-Gestion-ELS)

---

## Mentions légales

- **EI LECOURT EMMANUEL**  
  255 Bis AVENUE MARCEL CASTIE  
  83000 TOULON  
  SIREN : [voir KBIS](./Kbis_EL_Service.pdf)  
  IBAN : FR76 4061 8804 7600 0403 5757 187  
  BIC : BOUS FRPP XXX  
  TVA non applicable, art. 293 B du CGI

> Toute facturation et tarification sont régies **uniquement** via le fichier `Config.gs`.  
> Les conditions générales de vente (CGV) incluent une clause de non-responsabilité sur le contenu des sacs : toute préparation médicamenteuse doit être conditionnée dans une boîte scellée par la pharmacie.  

---

## Contribution

- PR bienvenues, mais alignement strict avec la charte ELS.
- Toute contribution doit respecter la logique Apps Script et la structure modulaire du projet.

---

## Contact

**EL Services Littoral**  
Mail : elservicestoulon@gmail.com  
[Site officiel](https://sites.google.com/view/pharmacie-livraison-ehpad/accueil)

---

## Écologie

Chaque livraison est réalisée exclusivement en véhicule 100% électrique.  
ELS Littoral s’engage pour la préservation du littoral varois.

---

## Licence

(C) 2024 - EI Lecourt Emmanuel.  
Projet sous licence propriétaire. Toute utilisation ou reproduction non autorisée est interdite.
