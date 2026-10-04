# InfraLab

Laboratoire pédagogique **ITSM / ITAM** : un même système d'information vu à travers deux vues — **Infrastructure** (ce qui existe) et **ITSM** (ce que l'outil de gestion en sait).

Créé par Yahn LE PRETTRE — Formaxion Landes. Application indépendante du simulateur réseau, dont elle réutilise certaines idées (planificateur à temps simulé, canvas SVG, moteur de TP auto-testés).

> **État : M1 — vue Infrastructure.** Noyau typé et testé, catalogue de 15 équipements, commandes physiques, joignabilité avec événements en cascade, canvas SVG, palette, inspecteur et journal « Pourquoi ? ». La vue ITSM arrive avec M3.

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
src/ui/      kit/ (DOM) · infra-view/ (canvas, inspecteur, journal) · shell/ (application, exemple)
tests/unit/  tests du noyau et de l'infrastructure (Vitest)
docs/        architecture, ADR
```

## Essayer
Ouvrir `dist/index.html` après `npm run build`, puis **SI d'exemple** : éteignez SW02 et observez les trois postes passer hors ligne ; cliquez sur un événement du journal pour voir sa chaîne de causes.

Règles du noyau : données pures (JSON), mutation uniquement par commandes, aucun `Math.random()` ni `Date.now()` (déterminisme), `core` ne dépend de rien.
