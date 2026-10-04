# ADR 0001 — TypeScript strict, Vite (fichier autonome), Vitest

**Statut** : accepté (2026-10-04)

**Contexte** : le simulateur réseau est en JavaScript sans modules ni types, avec un espace de noms global. InfraLab doit être typé, modulaire, testable, tout en restant ouvrable hors-ligne.

**Décision** : TypeScript strict ; Vite avec `vite-plugin-singlefile` pour produire `dist/index.html` autonome ; Vitest pour les tests.

**Conséquences** : le Core (données pures, validateurs) bénéficie le plus du typage ; le déploiement reste statique (GitHub Pages) ; le fichier autonome est conservé.
