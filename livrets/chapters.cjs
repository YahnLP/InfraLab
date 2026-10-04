// Chapitres de cours (livret élève). Syntaxe inline : **gras**, *italique*, `code`.
module.exports = [
{ n: 1, title: "ITSM et ITIL : de quoi parle-t-on ?", tps: "TP 1 à 3, 21",
  intro: "Une entreprise de 45 personnes comme NovaTech ne « fait » pas de l'informatique pour elle-même : elle fournit un service à ses collègues. Ce chapitre pose le vocabulaire commun.",
  sections: [
  { h: "1.1 Le service plutôt que la machine", p: [
    "L'**ITSM** (*IT Service Management*) est la manière d'organiser l'informatique comme un **service rendu** à des utilisateurs. Ce qui compte pour Alice, ce n'est pas que le switch fonctionne : c'est qu'elle puisse émettre ses factures.",
    "**ITIL** est un recueil de bonnes pratiques (un référentiel, pas une loi ni un logiciel) qui décrit des **pratiques** : gestion des incidents, des problèmes, des changements, des actifs, de la connaissance… Un outil ITSM (GLPI, ServiceNow, Zammad…) aide à les appliquer ; il ne les remplace pas."] },
  { h: "1.2 Deux vues sur un même système d'information", p: [
    "Le simulateur InfraLab vous impose de toujours distinguer deux choses :"],
    table: { head: ["Vue", "Elle montre", "Exemple dans le simulateur"], rows: [
      ["Infrastructure", "Ce qui **existe** réellement", "Un PC branché, un câble débranché, un serveur éteint"],
      ["ITSM", "Ce que l'**outil de gestion sait**", "Une fiche d'actif, un ticket, un contrat, un CI"]],
      widths: [1800, 3200, 4026] },
    p2: ["Ces deux vues ne se synchronisent **pas** toutes seules. Un équipement posé sur le schéma reste inconnu de l'outil tant qu'il n'a pas été découvert, collecté par un agent ou saisi à la main. À l'inverse, une fiche saisie à la main peut devenir fausse sans que personne ne s'en aperçoive."] },
  { h: "1.3 Incident, demande, problème, changement", p: [
    "Quatre mots à ne jamais confondre :"],
    table: { head: ["Objet", "Question à se poser", "Exemple"], rows: [
      ["**Incident**", "Quelque chose qui marchait ne marche plus ?", "« Je n'arrive plus à imprimer »"],
      ["**Demande de service**", "Je demande quelque chose de prévu au catalogue ?", "« Installez Visio sur mon poste »"],
      ["**Problème**", "Pourquoi cela se reproduit-il ? (cause racine)", "Trois pannes réseau en une semaine"],
      ["**Changement**", "Je modifie la production, comment le faire sans casse ?", "Remplacer le switch SW02"]],
      widths: [2000, 3700, 3326] },
    p2: ["Un incident se **rétablit**, un problème se **comprend**, un changement se **maîtrise**. Une demande se **fournit**."] },
  ],
  keypoints: ["Existant ≠ connu de l'outil : les deux vues se rejoignent par la collecte.", "ITIL décrit des pratiques, pas des produits.", "Incident = dysfonctionnement ; demande = fourniture prévue.", "Incident → rétablir ; problème → comprendre ; changement → modifier en sécurité."] },

{ n: 2, title: "L'inventaire : savoir ce que l'on possède", tps: "TP 4 à 10",
  intro: "On ne gère bien que ce que l'on connaît. Le parc (*asset inventory*) est la liste des équipements, avec les informations utiles pour les gérer.",
  sections: [
  { h: "2.1 Trois façons d'alimenter le parc", p: [] ,
    table: { head: ["Mode", "Principe", "Avantage", "Limite"], rows: [
      ["Découverte réseau", "Scan d'une plage d'adresses (ex. 192.168.10.0/24)", "Rapide, sans installation", "Ne voit que nom, IP, MAC, constructeur"],
      ["Agent", "Logiciel installé sur le poste, qui remonte son inventaire", "Détail : matériel, logiciels, utilisateur connecté", "Doit être installé et fonctionner"],
      ["Saisie manuelle", "Un humain remplit la fiche", "Seule option pour une imprimante ou un switch", "Devient fausse sans alerte"]],
      widths: [1700, 2900, 2200, 2226] } },
  { h: "2.2 Identifier un actif", p: [
    "Le **nom** peut changer, l'**adresse IP** est attribuée dynamiquement, l'**utilisateur** change. Ce qui identifie réellement un équipement réseau, c'est son **adresse MAC** ; son **numéro de série** et son **numéro d'inventaire** (étiquette) l'identifient pour la gestion.",
    "Une fiche utile contient au minimum : numéro d'inventaire, numéro de série, fin de garantie, utilisateur affecté, statut."] },
  { h: "2.3 Utilisateur affecté ou utilisateur connecté ?", p: [
    "L'**affectation** est une décision de gestion saisie dans l'outil (« ce poste est à Alice »). L'**utilisateur connecté** est une constatation remontée par l'agent (« la session ouverte est celle de Bruno »). Quand les deux diffèrent, c'est un signal : prêt non déclaré, départ non traité, usurpation."] },
  { h: "2.4 Quand l'agent ne remonte plus", p: [
    "Un agent peut être défaillant pour des raisons différentes : **arrêté** (il ne tente plus rien), **bloqué** (il tente et échoue, par exemple parce que le poste est coupé du réseau), ou **inventaire obsolète** (il fonctionne mais n'a pas remonté depuis longtemps). Le symptôme est le même — « pas de données fraîches » — mais la **cause** et l'**action** changent. Diagnostiquer avant d'agir."] },
  ],
  keypoints: ["Découverte = peu d'informations mais vite ; agent = détail ; saisie = dernier recours.", "Clé réseau : MAC ; clé de gestion : numéro de série / d'inventaire.", "Affecté (décision) ≠ connecté (constat).", "Un agent en erreur se diagnostique avant de se réparer."] },

{ n: 3, title: "Le Service Desk : prendre un appel, qualifier, résoudre", tps: "TP 11 à 15",
  intro: "Le service desk est le point d'entrée unique des utilisateurs. Sa qualité se mesure à ce que le ticket permet de faire ensuite.",
  sections: [
  { h: "3.1 Un bon ticket", p: [
    "Un ticket exploitable répond à : **qui** ? (demandeur) **quoi** ? (symptôme précis) **où** ? (équipement) **quand** ? (depuis quand, à quelle fréquence). « Ça marche pas » est inutilisable ; « Excel se ferme à l'ouverture de ventes.xlsx depuis ce matin, sur PC22 » ne l'est pas."] },
  { h: "3.2 Le cycle de vie du ticket", p: [
    "Dans InfraLab, un ticket passe par les statuts suivants : **Nouveau → Qualifié → Attribué → En cours → (En attente) → Résolu → Clos**. On ne saute pas d'étape : la qualification précède l'attribution, la solution documentée précède la résolution, la vérification auprès de l'utilisateur précède la clôture."] },
  { h: "3.3 Qualifier : catégorie, impact, urgence, priorité", p: [
    "**Catégorie** : orienter vers la bonne équipe. **Impact** : combien de personnes ou d'activités sont touchées ? **Urgence** : dans quel délai la situation devient-elle critique ? La **priorité** se déduit de l'impact et de l'urgence, elle n'est pas choisie à l'intuition."],
    table: { head: ["Impact \\ Urgence", "Élevée", "Moyenne", "Faible"], rows: [
      ["**Élevé**", "P1", "P2", "P3"], ["**Moyen**", "P2", "P3", "P4"], ["**Faible**", "P3", "P4", "P4"]],
      widths: [2600, 2142, 2142, 2142] },
    p2: ["Une imprimante en panne pour tout un service avec une échéance aujourd'hui : impact élevé, urgence élevée, **P1**. La même imprimante pour une personne qui peut imprimer ailleurs : impact faible, urgence faible, **P4**."] },
  { h: "3.4 Résoudre, vérifier, clore", p: [
    "La **solution** se documente en quatre éléments : symptôme, cause, action, vérification. Sans cela, personne ne pourra la réutiliser. **Résolu** signifie « nous pensons avoir corrigé » ; **Clos** signifie « l'utilisateur a confirmé » ou le délai de confirmation est passé."] },
  ],
  keypoints: ["Qui, quoi, où, quand.", "Priorité = f(impact, urgence).", "Documenter : symptôme, cause, action, vérification.", "Résolu ≠ Clos."] },

{ n: 4, title: "Diagnostiquer un incident technique", tps: "TP 16 à 20",
  intro: "Face à une panne, le réflexe n'est pas de cliquer partout : c'est de raisonner du plus simple au plus complexe, et de chercher ce qui est commun.",
  sections: [
  { h: "4.1 La méthode en cinq temps", p: [], bullets: [
    "**Comprendre** : que voit exactement l'utilisateur ? depuis quand ? qu'est-ce qui a changé ?",
    "**Délimiter** : un seul poste ou plusieurs ? tous les services ou un seul ?",
    "**Émettre une hypothèse** : de la couche la plus basse (alimentation, câble) vers la plus haute (application).",
    "**Tester** l'hypothèse en ne changeant qu'une chose à la fois.",
    "**Vérifier et documenter** : le service est-il réellement rétabli ? auprès de qui l'a-t-on constaté ?"] },
  { h: "4.2 Chercher le point commun", p: [
    "Trois postes hors ligne au même moment : trois pannes de poste simultanées sont improbables. Il est plus probable qu'un **équipement commun en amont** (switch, routeur, alimentation) soit en cause. Corriger la cause commune rétablit tout le monde ; traiter les tickets un par un fait perdre du temps et masque l'origine."] },
  { h: "4.3 Incident majeur : ordre de traitement", p: [
    "Quand une panne coupe tout un site, on **rétablit d'abord la cause commune**, puis on traite les tickets restants par priorité. On **communique** : les utilisateurs doivent savoir qu'on traite la panne (ticket principal, tickets rattachés). La priorité se juge sur l'activité touchée (la comptabilité en pleine clôture avant le partage de fichiers)."] },
  { h: "4.4 S'appuyer sur la CMDB", p: [
    "Quand un service dépend d'un serveur, la CMDB permet de répondre en quelques secondes à « qu'est-ce qui est touché si ce serveur tombe ? » (chapitre 7)."] },
  ],
  keypoints: ["Du plus simple au plus complexe, une modification à la fois.", "Plusieurs pannes simultanées → chercher le point commun.", "Incident majeur : cause commune, priorités, communication.", "Vérifier le rétablissement réel avant de clore."] },

{ n: 5, title: "Aller plus loin qu'un ticket : SLA, problèmes, changements, connaissances", tps: "TP 22 à 25",
  intro: "Le service desk traite les symptômes. ITIL propose d'autres pratiques pour traiter les causes, maîtriser les modifications et ne pas réapprendre les mêmes choses.",
  sections: [
  { h: "5.1 Le SLA (accord de niveau de service)", p: [
    "Un **SLA** est un engagement chiffré : temps de **prise en charge** et temps de **résolution** selon la priorité. Dans InfraLab :"],
    table: { head: ["Priorité", "Prise en charge", "Résolution"], rows: [["P1", "15 minutes", "4 heures"], ["P2", "1 heure", "8 heures"], ["P3", "4 heures", "24 heures"], ["P4", "8 heures", "72 heures"]], widths: [2000, 3500, 3526] },
    p2: ["Le décompte **démarre à la création du ticket**, pas à la prise en charge. Quand on attend une réponse de l'utilisateur, l'horloge peut être **suspendue** (statut « En attente ») : ce n'est pas la faute du service si l'utilisateur ne répond pas. Un ticket mal qualifié reçoit un mauvais SLA."] },
  { h: "5.2 Gestion des problèmes", p: [
    "Un **problème** est la cause inconnue d'un ou plusieurs incidents. On y rattache les incidents similaires, on cherche la **cause racine**, on documente un **contournement** (*workaround* : comment rétablir en attendant) et on décrit la **correction définitive**. Un contournement connu et publié s'appelle une **erreur connue**."] },
  { h: "5.3 Gestion des changements", p: [
    "Un **changement** est toute modification de la production. Il suit un parcours : demande → dossier (**risque**, **plan**, **retour arrière**) → **approbation** par une personne habilitée et différente du demandeur → réalisation → **vérification** → clôture. Le but n'est pas de ralentir, mais d'éviter qu'une modification bien intentionnée provoque un incident."] },
  { h: "5.4 Gestion des connaissances", p: [
    "Une solution trouvée une fois doit servir la fois suivante. On rédige un **article** depuis le ticket résolu (symptôme, cause, résolution), on le **classe** et on le **publie**. Au ticket suivant, on l'**associe**, ce qui mesure son utilité."] },
  ],
  keypoints: ["SLA : décompte dès la création ; suspension possible en attente de l'utilisateur.", "Problème : cause racine + contournement + correction.", "Changement : risque, plan, retour arrière, approbation par un tiers.", "Une solution non capitalisée sera à refaire."] },

{ n: 6, title: "ITAM : gérer les actifs, les licences et les contrats", tps: "TP 26 à 30",
  intro: "L'ITAM (*IT Asset Management*) répond à des questions de gestion : combien ça coûte, est-ce légal, est-ce couvert, qui en est responsable ?",
  sections: [
  { h: "6.1 Logiciels autorisés et interdits", p: [
    "L'agent remonte les logiciels réellement installés. Une **politique logicielle** classe chaque logiciel (autorisé, interdit). Un logiciel de prise de contrôle à distance non validé est un risque de sécurité. Après suppression sur le poste, l'outil l'affiche **tant qu'une nouvelle remontée n'a pas eu lieu** : il ne connaît que la dernière photo."] },
  { h: "6.2 Licences et conformité", p: [
    "Une **licence** est un droit d'usage. La **conformité** compare les **droits achetés** aux **installations constatées**. Trois licences pour quatre installations : **non conforme** (une installation sans droit). Deux issues légitimes : acheter un droit, ou désinstaller. Ne pas tricher sur le compte."] },
  { h: "6.3 Contrats et fournisseurs", p: [
    "Un contrat (maintenance, abonnement) a une **échéance**. Un contrat **proche de l'échéance** demande une décision (renouveler ou non) ; un contrat **expiré** n'apporte plus de garantie. On **rattache** le contrat aux actifs couverts pour savoir, le jour d'une panne, si l'équipement est sous contrat."] },
  { h: "6.4 Cycle de vie d'un équipement", p: [
    "Un actif suit un parcours : **Commandé → En stock → En service → (En réparation) → Retiré**. Chaque transition est une décision tracée. Un équipement **retiré** ne se réaffecte pas (risque de remettre en circulation du matériel mis au rebut). Avant de **réaffecter** un poste : le restituer au stock, **préparer** le poste (plus de session de l'ancien utilisateur), l'affecter, puis **vérifier** par un inventaire que la réalité confirme l'outil."] },
  ],
  keypoints: ["Politique logicielle : autorisé / interdit, preuve par l'inventaire.", "Conformité = droits − installations.", "Contrat proche ou expiré → action ; rattaché → utile.", "Cycle de vie : chaque étape tracée ; retiré = définitif."] },

{ n: 7, title: "La CMDB : éléments de configuration, relations, impact", tps: "TP 31, 32, 38",
  intro: "La CMDB (*Configuration Management Database*) est la carte des dépendances du système d'information.",
  sections: [
  { h: "7.1 Actif ou CI ?", p: [
    "Un **actif** est quelque chose qui a une valeur et qu'on gère (poste, licence, contrat). Un **élément de configuration** (*CI*) est quelque chose dont on veut suivre les **dépendances** et mesurer les conséquences d'une panne. Un poste ou un serveur peut être les deux ; un **service** (« Facturation comptable ») est un CI **sans actif** : il n'est pas un équipement, il **repose** sur plusieurs."] },
  { h: "7.2 Relations", p: [
    "Les relations « **connecté à** » se déduisent automatiquement du câblage entre équipements qui ont un CI. Les relations « **dépend de** » (un service dépend d'un poste, d'une imprimante, d'un logiciel) sont **saisies** : personne d'autre que vous ne sait que la comptabilité a besoin de cette imprimante."] },
  { h: "7.3 Analyse d'impact", p: [
    "Pour savoir ce qu'une panne touche, on suit les dépendances **en sens inverse** (qui dépend de ce qui tombe ?) et **par rebond** : le serveur héberge un logiciel ; le logiciel est utilisé par un service. Arrêter le serveur touche donc le service, même s'il n'est lié à lui par aucun lien direct. L'analyse d'impact sert à préparer un changement et à prioriser un incident."] },
  ],
  keypoints: ["Un CI = ce dont on suit les dépendances.", "Un service est un CI sans actif.", "Connecté à : automatique ; dépend de : saisi.", "L'impact se propage par rebond."] },

{ n: 8, title: "Administration, droits et traçabilité", tps: "TP 33 à 37, 39, 40",
  intro: "Un outil ITSM contient des données sensibles et permet d'agir. Qui a le droit de faire quoi doit être un choix, pas un accident.",
  sections: [
  { h: "8.1 Rôles et permissions (RBAC)", p: [
    "Dans un contrôle d'accès **fondé sur les rôles** (*RBAC*), on n'attribue pas des droits à une personne, mais des **permissions à un rôle**, puis des **rôles à des personnes**. InfraLab propose quatre rôles de départ : **Utilisateur** (ouvre et suit ses tickets), **Technicien** (qualifie, attribue, résout), **Responsable** (approuve les changements, gère le parc) et **Administrateur** (gère comptes, rôles et paramètres). Une personne peut cumuler des rôles."] },
  { h: "8.2 Moindre privilège", p: [
    "Chacun reçoit **le minimum nécessaire** à sa fonction. Un utilisateur ordinaire n'a aucune raison de modifier le cycle de vie d'un actif, de gérer un contrat ou d'approuver un changement. Une **revue des habilitations** vérifie périodiquement que les rôles n'ont pas dérivé."] },
  { h: "8.3 Séparation des tâches", p: [
    "Celui qui **demande** un changement ne doit pas être celui qui l'**approuve** ; celle qui **gère les droits** n'exploite pas elle-même les tickets. Cette séparation limite l'erreur et la fraude : deux personnes doivent être d'accord."] },
  { h: "8.4 Comptes : arrivée, départ", p: [
    "À l'**arrivée** : créer le compte, attribuer **exactement** les rôles utiles. Au **départ** : d'abord **réattribuer** ce qui est en cours (tickets), puis **désactiver** le compte. On ne **supprime pas** : l'historique reste consultable pour l'audit. Le dernier administrateur ne peut pas être désactivé (sinon plus personne ne gère)."] },
  { h: "8.5 Le journal d'audit", p: [
    "Chaque action est consignée avec **qui**, **quoi**, **quand**. Face à une anomalie (un coût d'achat passé de 1 200 € à 1 €), le journal permet de remonter à l'auteur, de juger si l'action était **légitime** au regard de son rôle, de corriger, et de décider de la mesure pour éviter la récidive."] },
  ],
  keypoints: ["Permissions → rôles → personnes.", "Moindre privilège, revue périodique.", "Séparation des tâches : demandeur ≠ approbateur.", "Départ : réattribuer, puis désactiver ; ne jamais supprimer l'historique.", "Journal d'audit : qui, quoi, quand."] },
];
