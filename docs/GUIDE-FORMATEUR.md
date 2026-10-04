# InfraLab — guide du formateur

Application : https://yahnlp.github.io/InfraLab/ (aucune installation, aucun compte, aucun serveur : tout se passe dans le navigateur).
Les TP sont indépendants d'un outil réel (GLPI, ServiceNow, Jira Service Management…) : on y apprend des **notions**, chaque écran renvoyant aux outils réels par un encart « Dans les outils réels ».

## 1. L'idée à faire passer

> **Ce qui existe** (la réalité du SI) et **ce que l'outil en sait** sont deux choses différentes, qui se rejoignent par la collecte (agent, découverte) et divergent à chaque événement.

L'élève travaille dans deux vues d'un même SI fictif, celui de **NovaTech** (une PME de 45 personnes) :

- **Infrastructure** : ce qui existe — équipements, câbles, alimentation, adresse IP, agents.
- **ITSM** : ce que l'outil en sait — parc, tickets, problèmes, changements, licences, contrats, CMDB, journal d'audit.

La chaîne centrale : équipement → réseau → agent ou découverte → inventaire → utilisateur → incident → diagnostic → intervention → résolution → documentation → historique.

## 2. Organisation d'une séance

| Élément | Conseil |
|---|---|
| Durée d'un TP | de 25 min (niveaux 1 à 3) à 50 min (niveaux 4 à 8) ; le TP 40 (final) demande 2 h |
| Démarrage | onglet **TP** → *Démarrer* : le projet en cours est remplacé par l'état préparé du TP. *Recommencer* repart de l'état initial, identique à chaque fois |
| Déroulé d'un TP | chaque TP est découpé en **étapes** : un cours court, des tâches vérifiées automatiquement, un bilan. L'étape suivante s'ouvre quand tous les objectifs de l'étape sont atteints |
| Questions | des questions de compréhension (QCM) sont intercalées : on vérifie qu'on a *compris*, pas seulement cliqué. Une mauvaise réponse coûte 1 point d'autonomie |
| Aide | indices progressifs (2 points chacun) ; la solution est consultable (elle annule les points d'autonomie) |
| Mode examen | sans indices, sans solution, sans explication après réponse ; à privilégier pour une évaluation |
| Identité | le sélecteur **Agir en tant que** (en haut) fait endosser un utilisateur : ses droits s'appliquent, les refus sont expliqués. À utiliser pour les niveaux 8 |

## 3. Parcours conseillés

| Séance | Objectif | TP |
|---|---|---|
| 1 — Comprendre le SI | réalité et connaissance de gestion | 1, 2, 3, 4, 5 |
| 2 — L'inventaire | agent, découverte, rapprochement | 6, 7, 8, 9, 10 |
| 3 — Le service desk | cycle de vie d'un ticket | 11, 12, 13, 14, 15, 42 |
| 4 — Dépanner | du symptôme à la cause | 16, 17, 18, 19, 20, 43 |
| 5 — ITIL | SLA, problème, changement, connaissance | 21, 22, 23, 24, 25, 41, 44 |
| 6 — Gérer le parc | logiciels, licences, contrats, cycle de vie | 26, 27, 28, 29, 30 |
| 7 — La CMDB | CI, relations, impact | 31, 32, 38 |
| 8 — Administrer | rôles, droits, groupes, délégations, audit | 33, 34, 35, 36, 37, 39, 45, 46 |
| Bilan | tout assembler | 40 |

Les TP 41 à 46 prolongent les séances 3, 4, 5 et 8 ; trois d'entre eux (41, 42, 43) se jouent dans le temps simulé. Les TP d'un même niveau sont indépendants : l'ordre à l'intérieur d'une séance se choisit librement. Les niveaux se suivent en difficulté croissante.

## 4. Évaluer, sans surpromettre

- Le **score** (objectifs 70, qualité 20, autonomie 10) mesure la complétion et l'autonomie. **Il ne valide aucune compétence** : aucun écran ne le dit et aucun document ne doit le dire.
- La vue **Vue formateur : couverture des compétences** (onglet TP) liste, pour chaque compétence, les TP qui la **travaillent** (T) ou qui peuvent fournir un **élément de preuve** pour le portfolio (P). La matrice complète est dans `docs/couverture-competences.md`.
- À la fin d'un TP, l'élève peut **exporter un compte rendu** : version HTML imprimable (score, objectifs, journal de ses actions) ou JSON. Il porte une empreinte SHA-256 qui détecte une modification accidentelle ; **elle ne prouve pas l'authenticité** : pour une évaluation certificative, faites travailler sur place en mode examen.
- Les compétences se rattachent au référentiel BTS SIO SISR (patrimoine informatique, incidents et demandes, habilitations, traçabilité, mode projet, exploitation). C'est une *piste* : le rattachement officiel revient à l'équipe pédagogique.

## 5. Jeux de données

- **SI d'exemple** (bouton en haut) : le siège de NovaTech (une dizaine d'équipements), idéal pour la découverte libre.
- **NovaTech complet** : 4 sites, une quarantaine d'équipements, 45 utilisateurs, 5 fournisseurs, 3 contrats, des licences (Office est volontairement dépassé de 3 installations), des logiciels interdits et une CMDB de 3 services. Pour une exploration libre ou un exercice maison.
- Les TP préparent chacun leur propre état : ils ne dépendent pas de ces jeux de données.

## 6. Limites connues

Réseau d'entreprise simplifié (tous les sites sur le même réseau) ; SLA en continu ou en heures ouvrées (un seul calendrier, sans jours fériés) ; les groupes donnent des rôles, sans hiérarchie ; une VM suit son hyperviseur, sans haute disponibilité ; la copie automatique est locale au navigateur (vider les données du site l'efface) : faire enregistrer un fichier .infralab.json pour garder un travail.

## 7. Questions fréquentes

**Un objectif ne se valide pas, pourquoi ?** Le texte « À faire d'abord : … » sous l'objectif donne le prérequis. Beaucoup d'objectifs vérifient l'**état** (le bon actif lié, le bon statut) et pas la manière d'y arriver.

**L'élève s'est bloqué, il a perdu son travail.** *Recommencer* repart de l'état initial. Il peut consulter la solution (elle coûte les points d'autonomie).

**Comment montrer qu'un droit manque ?** Choisir un utilisateur dans « Agir en tant que » et tenter l'action : le refus nomme le droit manquant et les rôles de la personne.

**Le temps est-il réglé dans les TP ?** Oui, quand il compte. L'heure simulée n'avance que sur action de l'élève : boutons +15 min, +1 h, +1 jour (en haut, et dans l'encart « Dans ce TP, le temps compte » des TP concernés : 6, 7, 10, 22, 28, 41 à 44 et 46). Les TP 42 et 43 font arriver des tickets et une panne à des heures précises ; le TP 41 se joue un lundi à 7 h après un week-end ; le TP 46 se termine par l'échéance d'une délégation.

**Peut-on modifier un TP ?** Les TP sont des données TypeScript dans `src/scenarios/catalog.ts` ; chaque modification est contrôlée par des auto-tests (état initial sans objectif atteint, solution à 100 / 100, démarrage déterministe).

**Comment l'élève retrouve son travail la semaine suivante ?** Boutons *Enregistrer* (Ctrl+S) et *Ouvrir* (Ctrl+O) dans l'en-tête : le projet, y compris le TP en cours (score, indices, réponses), est écrit dans un fichier « .infralab.json » dans le dossier choisi par l'élève (clé USB, dossier réseau, OneDrive…). Chrome et Edge proposent le choix du dossier et réécrivent le même fichier aux enregistrements suivants ; Firefox et Safari téléchargent le fichier (réglage « Toujours demander où enregistrer » du navigateur). Une copie automatique reste dans le navigateur du poste, mais elle ne suit pas l'élève d'un poste à l'autre : sur les postes partagés, faites enregistrer un fichier en fin de séance.

**Où est l'aide ?** Bouton « ? Aide » (ou F1) : présentation, utilisation des vues, TP, enregistrement, raccourcis, accessibilité et à propos (auteur, indépendance de l'outil, formulation des compétences).
