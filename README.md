# InfraLab

Laboratoire pédagogique **ITSM / ITAM** : un même système d'information vu à travers deux vues — **Infrastructure** (ce qui existe) et **ITSM** (ce que l'outil de gestion en sait).

Créé par Yahn LE PRETTRE — Formaxion Landes. Application indépendante du simulateur réseau, dont elle réutilise certaines idées (planificateur à temps simulé, canvas SVG, moteur de TP auto-testés).

> **État : M0 — fondations.** Noyau typé et testé (store, commandes, événements, scheduler, réseau). Pas encore d'interface.

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
```

## Structure (M0)
```
src/core/   model/ (types) · store/ (état, commandes, événements, réacteurs) · scheduler/ · net/ (IP, MAC, CIDR) · rng · ids
tests/unit/ tests du noyau
docs/       architecture, ADR
```

Règles du noyau : données pures (JSON), mutation uniquement par commandes, aucun `Math.random()` ni `Date.now()` (déterminisme), `core` ne dépend de rien.
