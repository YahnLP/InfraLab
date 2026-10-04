# Contribuer à InfraLab

Les contributions externes sont les bienvenues : signalement d'erreurs, corrections de textes, nouveaux TP, tests.

- Le code est distribué sous licence **EUPL 1.2** (voir `LICENSE`). Toute contribution est publiée sous cette même licence.
- Ouvrez d'abord une *issue* pour décrire le problème ou l'idée, puis une *pull request*.
- Avant de proposer une modification : `npm ci`, `npm run typecheck` (ou `npx tsc --noEmit`), `npx vitest run`. Chaque TP est contrôlé par des auto-tests (état initial sans objectif atteint, solution à 100 / 100).
- Le nom « InfraLab » et l'identité visuelle ne sont pas couverts par la licence du code (voir l'onglet « Licence et auteur » de l'aide).
- Un TP « travaille » une compétence ou peut fournir un élément de preuve possible : il ne « valide » jamais une compétence du référentiel.
