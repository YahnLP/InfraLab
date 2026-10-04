# ADR 0002 — Un état unique, deux couches (`reality` / `management`)

**Statut** : accepté (2026-10-04)

**Décision** : un seul store de données pures. La couche `reality` contient ce qui est vrai (équipements, câbles, matériel, agent) ; la couche `management` ce que l'outil en sait (actifs, observations, tickets…). L'actif référence l'équipement par `deviceId` et ne stocke que l'observé (horodaté, avec provenance) et le déclaré. Les deux vues sont des projections du même état.

**Conséquence** : l'écart entre réalité et connaissance est un objet d'étude, pas un bug. Aucune duplication de matériel entre vues.
