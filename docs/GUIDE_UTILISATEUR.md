# GestiPers — Guide d'utilisation

**Système de gestion du personnel**  
Présidence de la République Centrafricaine

Application web : [https://www.gestipers.org](https://www.gestipers.org)

---

## 1. Présentation

GestiPers centralise la gestion du personnel, des prestataires, des visiteurs, des missions, des congés, des cartes professionnelles, des demandes d'audience et des pièces d'identité. Les données sont partagées en temps réel entre tous les utilisateurs connectés.

L'interface est disponible en **français**, **anglais** et **russe** (sélecteur sur l'écran de connexion).

---

## 2. Connexion

1. Ouvrez l'application dans un navigateur récent (Chrome, Safari, Firefox, Edge).
2. Saisissez votre **identifiant** et votre **mot de passe**.
3. Cliquez sur **Se connecter**.

Votre session reste active après un rafraîchissement de la page. Pour vous déconnecter, utilisez **Se déconnecter** en bas de la barre latérale.

> **Scan de carte depuis mobile** : si vous ouvrez un lien issu d'un QR code de carte professionnelle sans être connecté, l'application vous demandera de vous identifier puis lancera automatiquement la vérification.

---

## 3. Niveaux d'accès

| Niveau | Rôle | Droits principaux |
|--------|------|-------------------|
| **1** | Administrateur | Tout : validation, suppression, comptes, journal, départements |
| **2** | Gestionnaire | Création, modification, export — sans validation ni suppression |
| **3** | Utilisateur | Consultation et soumission de demandes (congés, missions, enregistrements) |

Les actions sensibles (validation de missions, refus, suppression de dossiers) sont réservées aux **administrateurs**.

---

## 4. Navigation

La barre latérale gauche donne accès aux sections suivantes :

| Section | Description |
|---------|-------------|
| **Tableau de bord** | Vue d'ensemble : effectifs, missions, congés, audiences en attente |
| **Audiences** | Demandes d'audience auprès de la Présidence |
| **Vérification pièces** | Contrôle CNI / passeport dans les registres |
| **Personnels** | Agents permanents (sous-menus ci-dessous) |
| ↳ Prestataires | Personnel externe / sociétés |
| ↳ Visiteurs | Visites et événements |
| ↳ Congés | Demandes et décisions de congé |
| ↳ Présences | Feuille de présence quotidienne |
| ↳ Missions | Ordres de mission |
| **Dossiers** | Dossiers personnels et décrets |
| **Recherche** | Recherche avancée dans le personnel |
| **Cartes** | Émission et vérification des cartes professionnelles |
| **Statistiques** | Graphiques et indicateurs |
| **Validation** *(admin)* | Missions et congés en attente |
| **Journal** *(admin)* | Historique des actions |
| **Comptes** *(admin)* | Gestion des utilisateurs |

Une **cloche de notifications** en haut à droite signale les missions, congés et audiences en attente de traitement.

---

## 5. Tableau de bord

Le tableau de bord affiche des indicateurs cliquables :

- Agents actifs
- Personnels en mission ou en congé aujourd'hui
- Missions validées / en attente
- Demandes de congé en attente
- **Audiences en attente**

Deux graphiques complètent la vue : répartition par département et dernières demandes de congé.

Les administrateurs et gestionnaires peuvent **exporter l'ensemble des données** (bouton en haut à droite).

---

## 6. Audiences

Cette section gère les sollicitations d'audience auprès de la Présidence.

### Créer une demande

1. Cliquez sur **Nouvelle demande**.
2. Renseignez l'identité du demandeur (nom, prénom, type et numéro de pièce).
3. **Téléversez un scan** de la CNI ou du passeport si disponible :
   - **Photographier** (caméra du téléphone)
   - **Téléverser un fichier** (image ou PDF, 3 Mo maximum)
4. Indiquez l'objet, le service destinataire, la date et l'heure souhaitées.
5. Cliquez sur **Enregistrer**.

À l'enregistrement, la pièce d'identité est automatiquement recoupée avec les registres existants (visiteurs, prestataires, missions).

### Suivi et validation

| Statut | Signification |
|--------|---------------|
| **En attente** | Demande soumise, non traitée |
| **Validée** | Audience acceptée |
| **Refusée** | Demande rejetée |
| **Tenue** | Audience réalisée |

Les **administrateurs** peuvent valider, refuser, marquer comme tenue ou supprimer une demande. Les **gestionnaires** peuvent modifier les fiches.

La colonne **Scan** permet d'ouvrir le document joint (bouton **Voir**).

---

## 7. Vérification des pièces d'identité

Section dédiée au contrôle rapide d'une **CNI** ou d'un **passeport** :

1. Choisissez le type de pièce.
2. Saisissez le numéro (et optionnellement le nom et prénom).
3. Cliquez sur **Vérifier**.

Le système recherche dans :

- le registre des **visiteurs** ;
- le registre des **prestataires** ;
- les **passeports** liés aux ordres de mission ;
- les autres **demandes d'audience**.

Résultats possibles : **Conforme**, **Doute**, **Non conforme** ou aucune correspondance.

---

## 8. Personnels

### Agents

- Ajouter, modifier ou consulter les fiches du personnel permanent.
- Filtrer par département, rechercher par nom ou poste.
- Vue **liste** ou **par département**.
- Export de la liste au format Word.
- Les administrateurs gèrent les **départements** (noms et couleurs).

Chaque fiche comprend : identité, poste, grade, matricule, département, salaire, contacts, photo et validité de carte.

### Prestataires

Personnel externe rattaché à une société. Chaque fiche inclut la pièce d'identité, le contrat et la validité de carte.

### Visiteurs

Enregistrement des visiteurs pour une date, un motif et éventuellement une **activité** (cérémonie, audience, conférence…). Les activités se créent depuis le même onglet.

### Congés

- **Utilisateurs** : soumettre une demande (type, dates, motif).
- **Administrateurs** : approuver ou refuser depuis **Validation** ou depuis la fiche.

### Présences

Feuille de présence par jour : marquer chaque agent comme présent, absent, en congé ou en mission.

### Missions

- Créer un **ordre de mission** (agent, objet, destination, dates, passeport, photo).
- Les demandes des non-administrateurs restent **en attente de validation**.
- Une fois validée, la mission peut être exportée en Word.
- Le tableau de bord des missions indique qui est **au poste**, **en mission** ou **en congé**.

---

## 9. Dossiers personnels et décrets

### Dossiers personnels

Archivage de documents par agent (PDF ou image scannée, 3 Mo max). Recherche par agent, consultation et téléchargement des pièces jointes.

### Décrets

Enregistrement des décrets de nomination ou affectation : numéro, date, objet, texte pour export Word, scan joint optionnel. Liaison possible avec un agent.

---

## 10. Cartes professionnelles

GestiPers émet des cartes pour trois catégories :

| Code | Porteurs |
|------|----------|
| **PR** | Agents (personnel permanent) |
| **PS** | Prestataires |
| **VI** | Visiteurs |

### Émission

1. Choisissez le type de carte et les porteurs.
2. Définissez la **date de validité**.
3. Imprimez ou exportez en **PDF**.

Chaque carte comporte un **QR code** renvoyant vers l'application.

### Vérification (mobile recommandé)

1. Connectez-vous sur un téléphone.
2. Allez dans **Cartes** — le panneau de vérification est en haut.
3. **Scannez le QR code** de la carte : l'application ouvre la vérification automatiquement.

Vous pouvez aussi saisir manuellement le matricule et le code d'authentification.

La vérification confirme l'authenticité de la carte, son statut (expirée ou valide) et affiche les informations du porteur.

---

## 11. Recherche avancée

Recherche multi-critères dans le personnel : nom, département, statut, fourchette salariale, dates d'embauche. Résultats exportables.

---

## 12. Statistiques

Tableaux et graphiques sur l'effectif, les missions, les congés et la répartition par département. Export des statistiques au format Word.

---

## 13. Validation *(administrateurs)*

Centre de traitement des demandes en attente :

- **Ordres de mission** — Valider ou refuser
- **Demandes de congé** — Approuver ou refuser

Les documents officiels (missions, congés) ne peuvent être exportés qu'après validation.

---

## 14. Journal *(administrateurs)*

Historique horodaté de toutes les actions : connexions, créations, modifications, suppressions, validations et exports. Les 1 500 dernières entrées sont conservées. Recherche par utilisateur ou par mot-clé.

---

## 15. Comptes utilisateurs *(administrateurs)*

Création et gestion des comptes : nom, identifiant, mot de passe, niveau d'accès (1, 2 ou 3). Modification et suppression des comptes existants.

---

## 16. Notifications

La cloche en haut à droite alerte sur :

- missions en attente de validation ;
- congés en attente ;
- audiences en attente ;
- cartes expirées ou expirant dans les 30 jours.

Cliquez sur une notification pour accéder directement à la section concernée. **Tout marquer comme lu** efface les pastilles non lues.

---

## 17. Synchronisation et travail à plusieurs

Les données se mettent à jour automatiquement :

- toutes les **60 secondes** en arrière-plan ;
- au retour sur l'onglet du navigateur ;
- entre onglets ouverts sur le même poste.

Il n'est en principe **pas nécessaire de rafraîchir la page** manuellement. Après une modification, les autres utilisateurs voient les changements dans la minute qui suit.

Les scans de pièces d'identité (CNI, passeport) sont stockés séparément des données principales pour limiter la charge serveur lorsque plusieurs personnes travaillent en simultané.

---

## 18. Bonnes pratiques

- **Photos et scans** : privilégiez des images nettes, bien cadrées, inférieures à 3 Mo.
- **Mots de passe** : utilisez un mot de passe personnel fort ; changez le mot de passe par défaut après la première connexion.
- **Vérification de cartes** : utilisez un smartphone connecté pour scanner les QR codes sur le terrain.
- **Validation** : traitez régulièrement les notifications pour éviter l'accumulation de demandes en attente.
- **Export** : les exports Word et PDF sont générés localement dans votre navigateur ; aucune donnée n'est envoyée à un service tiers.

---

## 19. Accès mobile et raccourci

L'application fonctionne sur **navigateur mobile** (iOS et Android). Vous pouvez l'ajouter à l'écran d'accueil :

- **iOS (Safari)** : bouton Partager → « Sur l'écran d'accueil »
- **Android (Chrome)** : menu → « Ajouter à l'écran d'accueil »

L'icône GestiPers apparaîtra comme une application autonome.

---

## 20. Support et incidents

En cas de problème :

1. Vérifiez votre connexion Internet.
2. Déconnectez-vous puis reconnectez-vous.
3. Videz le cache du navigateur si les données semblent obsolètes.
4. Contactez votre **administrateur GestiPers** pour les problèmes de compte ou de droits d'accès.

---

*Document généré pour GestiPers — Présidence de la République Centrafricaine.*
