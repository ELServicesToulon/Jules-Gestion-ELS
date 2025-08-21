# Jules-Gestion-ELS

**Gestion et automatisation des tournées de livraison pharmaceutique ELS Littoral – Google Workspace & Apps Script**

---

## Présentation

Jules-Gestion-ELS est une extension Google Apps Script sur-mesure pour la gestion ultra-automatisée des réservations et tournées de livraison de pharmacie vers les foyers, EHPAD et particuliers du littoral varois (Tamaris, Mar Vivo, Six-Fours-les-Plages, Sanary, Portissol, Bandol).  
L’outil est conçu pour garantir **zéro papier**, une traçabilité complète, une UX "finger in the nose" et une intégration 100% Google Workspace (Sheets, Drive, Agenda, Apps Script).

---

## Fonctionnalités principales

- **Réservation en ligne et gestion des tournées**  
  Interface client, admin et livreur totalement distinctes et automatisées via Apps Script et Google Sheets.
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

## Prérequis techniques

- **Compte Google** (Drive, Sheets, Agenda, Apps Script activés)
- **Droits d’édition** sur le Google Sheet hôte du projet
- **Accès à l’exécutable WebApp Apps Script**  
  (voir : [Script Google](https://script.google.com/macros/s/AKfycbyHD5OLTbL39asKeXQJLoskkRnPCiifFk87vkSgHwMMmelhSKV1Dx_b8QptOleGFtBi/exec))
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

> L’ensemble du code suit une philosophie modulaire, à séparer si besoin en micro-services Apps Script.

---

## Sécurité & RGPD

- Accès strictement limité (authentification Google, tokens, droits admin/client/livreur)
- **Politique RGPD complète** (droit à l’oubli, consentement explicite, journalisation)
- Les données sensibles (clients, factures, docs) sont stockées sur Google Drive du compte administrateur central (`elservicestoulon@gmail.com`)

---

## Liens utiles

- [Exécutable WebApp](https://script.google.com/macros/s/AKfycbyHD5OLTbL39asKeXQJLoskkRnPCiifFk87vkSgHwMMmelhSKV1Dx_b8QptOleGFtBi/exec)
- [Site vitrine / interface client](https://sites.google.com/view/pharmacie-livraison-ehpad/accueil)
- [KBIS Officiel](./Kbis_EL_Service.pdf)
- [RIB BoursoBank](./iban-boursobank%20(1).pdf)
- [Charte couleur/logo](./els-icone.png)
- [Dépôt GitHub](https://github.com/ELServicesToulon/Jules-Gestion-ELS)

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
