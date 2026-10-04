# InfraLab

Laboratoire pédagogique **ITSM / ITAM** : un même système d'information vu à travers deux vues — **Infrastructure** (ce qui existe) et **ITSM** (ce que l'outil de gestion en sait).

Créé par Yahn LE PRETTRE — Formaxion Landes. Application indépendante du simulateur réseau, dont elle réutilise certaines idées (planificateur à temps simulé, canvas SVG, moteur de TP auto-testés).

> **État : M7 — administration, rôles et droits.** Après les tickets (M3), les TP guidés par étapes (M4), l'ITIL (M5) et l'ITAM + CMDB (M6) : contrôle d'accès par les rôles (RBAC) appliqué à toutes les actions (refus expliqués : droit manquant, rôles de la personne), « Agir en tant que » pour endosser un utilisateur, matrice des droits modifiable, création de rôles, comptes activables/désactivables, garde-fou « dernier administrateur », séparation des tâches (on n'approuve pas son propre changement), journal d'audit avec l'auteur de chaque action. 36 TP au catalogue (TP 33–36 : qui peut faire quoi, accueillir un technicien, séparation des tâches, départ d'un technicien). Prochain jalon : M8 (finitions : jeu de données NovaTech complet, export d'examen, TP restants, documentation d'architecture).

**M2 — inventaire.** Vues Infrastructure et ITSM (parc, agents, découverte, fiche d'actif, utilisateurs, journaux), agent d'inventaire, découverte réseau, rapprochement, écart réalité/observé. Rappel M1 : Noyau typé et testé, catalogue de 15 équipements, commandes physiques, joignabilité avec événements en cascade, canvas SVG, palette, inspecteur et journal « Pourquoi ? ». Prochain jalon : ITAM et CMDB (logiciels, licences, contrats, CI et relations).

## Documentation
- [Architecture et plan de développement](docs/ARCHITECTURE.md)
- [Décisions d'architecture (ADR)](docs/adr/)

## Développement
```
npm install
npm run typecheck   # TypeScript strict
npm test            # Vitest
npm run dev         # serveur de développement
npm run build       # produit dist/index.html (fichier autonome, hors-ligne)
node tests/e2e-smoke.mjs   # test de fumée navigateur (après npm run build)
```

## Structure
```
src/core/    model/ · store/ (commandes, événements, réacteurs) · scheduler/ · net/ · rng · ids
src/infra/   catalogue, joignabilité (computeReachability), commandes physiques, événements
src/inventory/ agent, collecteur, découverte, rapprochement, temps simulé
src/itsm/    commandes de gestion (utilisateurs, actifs)
src/ui/      kit/ (DOM) · infra-view/ · itsm-view/ · shell/ (application, exemple)
tests/unit/  tests du noyau et de l'infrastructure (Vitest)
docs/        architecture, ADR
```

## Essayer
Ouvrir `dist/index.html` après `npm run build`, puis **SI d'exemple**.
- Éteignez SW02 : trois postes passent hors ligne ; cliquez sur un événement du journal pour voir sa chaîne de causes.
- Onglet ITSM → Découverte réseau → Scanner : l'outil apprend l'existence de 6 équipements, sans rien savoir d'eux. Installez un agent sur un poste et forcez l'inventaire : l'actif devient « inventorié ». Ajoutez de la RAM : l'outil affiche un écart jusqu'à la prochaine remontée (+1 jour).

Règles du noyau : données pures (JSON), mutation uniquement par commandes, aucun `Math.random()` ni `Date.now()` (déterminisme), `core` ne dépend de rien.
