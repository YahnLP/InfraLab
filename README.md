# InfraLab

Laboratoire pédagogique **ITSM / ITAM** : un même système d'information vu à travers deux vues — **Infrastructure** (ce qui existe) et **ITSM** (ce que l'outil de gestion en sait).

Créé par Yahn LE PRETTRE — Formaxion Landes. Application indépendante du simulateur réseau, dont elle réutilise certaines idées (planificateur à temps simulé, canvas SVG, moteur de TP auto-testés).

> **État : M8 — finitions, version 1.0.** Après les tickets (M3), les TP guidés (M4), l'ITIL (M5), l'ITAM + CMDB (M6) et l'administration RBAC (M7) : **catalogue complet de 40 TP** (étapes cours → pratique → bilan, 61 questions de compréhension, auto-testés), mode examen, **compte rendu de TP exportable** (HTML imprimable ou JSON, avec empreinte), jeu de données **NovaTech complet** (4 sites, une quarantaine d'équipements, 45 utilisateurs), vue formateur (couverture des compétences), accessibilité auditée automatiquement (axe-core, 0 violation WCAG 2.1 AA, thèmes clair et sombre). Documents : `docs/ARCHITECTURE.md` (conception et état réel), `docs/GUIDE-FORMATEUR.md`, `docs/couverture-competences.md`. Reste à faire : essai en classe, audit manuel avec lecteur d'écran, export/import de projet.

Historique : **M2 — inventaire.** Vues Infrastructure et ITSM (parc, agents, découverte, fiche d'actif, utilisateurs, journaux), agent d'inventaire, découverte réseau, rapprochement, écart réalité/observé. Rappel M1 : Noyau typé et testé, catalogue de 15 équipements, commandes physiques, joignabilité avec événements en cascade, canvas SVG, palette, inspecteur et journal « Pourquoi ? ». Prochain jalon : ITAM et CMDB (logiciels, licences, contrats, CI et relations).

## Documentation
- [Architecture et plan de développement](docs/ARCHITECTURE.md)
- [Guide du formateur](docs/GUIDE-FORMATEUR.md)
- [Couverture des compétences](docs/couverture-competences.md) (générée : `npm run docs`)
- [Décisions d'architecture (ADR)](docs/adr/)

## Développement
```
npm install
npm run typecheck   # TypeScript strict
npm test            # Vitest
npm run dev         # serveur de développement
npm run build       # produit dist/index.html (fichier autonome, hors-ligne)
node tests/e2e-smoke.mjs   # test de fumée navigateur (après npm run build)
AXE=chemin/axe.min.js node tests/a11y-audit.mjs   # audit d'accessibilité axe-core (DARK=1 pour le thème sombre)
npm run docs        # régénère le tableau des TP et la matrice de compétences
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
