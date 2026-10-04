# ADR 0003 — Mutation par commandes, événements de domaine, réacteurs

**Statut** : accepté (2026-10-04)

**Décision** : l'état ne change que par `dispatch(commande)`. Une commande opère sur un brouillon (commit si aucune erreur, sinon rollback), publie des événements immuables chaînés par `causedBy`, puis les réacteurs (fonctions pures événement → commandes) enchaînent les conséquences, avec une profondeur bornée.

**Conséquence** : cascades déterministes, traçables (vue « Pourquoi ? »), testables sans interface ; snapshot/restore = reset exact des TP.
