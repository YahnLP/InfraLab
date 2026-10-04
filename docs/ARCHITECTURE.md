# InfraLab — Architecture et plan de développement

> Laboratoire pédagogique ITSM / ITAM : un même système d'information vu par l'infrastructure et par l'outil de gestion.
> Document de cadrage (v0.1) — aucun code n'a encore été écrit. Auteur du projet : Yahn LE PRETTRE — Formaxion Landes.

---

## 1. Vision du produit

**InfraLab n'est pas un faux GLPI.** C'est un simulateur du fonctionnement d'un système d'information *vu à travers un outil ITSM*.

Le produit repose sur une idée unique, qui structure tout le reste :

> **Ce qui existe** (la réalité du SI) et **ce que l'outil en sait** (la connaissance de gestion) sont deux choses différentes, qui se rejoignent par la collecte (agent, découverte) et divergent à chaque événement.

L'élève travaille dans deux vues d'un même état :

| | Vue **Infrastructure** | Vue **ITSM** |
|---|---|---|
| Question posée | « Qu'est-ce qui existe et comment est-ce relié ? » | « Qu'est-ce que l'outil sait, et que dois-je en faire ? » |
| Objets | équipements, câbles, alimentation, IP, agents | actifs, utilisateurs, tickets, problèmes, changements, CI, licences… |
| Actions | brancher, éteindre, remplacer, changer l'IP, installer un agent | qualifier, affecter, résoudre, planifier un changement, inventorier |
| Valeur pédagogique | la vérité terrain | la connaissance, son retard, ses erreurs |

La chaîne pédagogique centrale (critère essentiel du cahier des charges) :

```
Équipement simulé → Connexion réseau → Agent / découverte → Inventaire ITSM → Utilisateur
→ Incident → Diagnostic → Intervention → Résolution → Documentation → Historique
```

Principes directeurs :

1. **Comprendre plutôt que cliquer** : chaque écran explique *pourquoi* une information existe, *comment* elle est obtenue, *à quoi* elle sert (cf. §11, « Dans les outils réels »).
2. **Une fonction réseau n'existe que si elle aide à comprendre ce que l'ITSM voit.** Pas de CLI Cisco, pas de BGP/OSPF/STP.
3. **Le canvas n'est qu'un affichage.** Un PC existe dans le modèle métier ; les deux vues le projettent.
4. **Déterminisme** : même état initial + mêmes actions = même résultat (horloge simulée, aléa à graine fixe). Indispensable pour le reset, la correction automatique et les tests.
5. **Indépendance** : nouveau dépôt, nouvelle URL, nouveau cycle de vie. Le simulateur réseau n'est pas modifié ; on en réutilise des idées et du code *copié*.

---

## 2. Analyse du simulateur réseau existant

> Périmètre réellement lu : `README.md`, `index.html`, `js/sim.js`, `js/topology.js`, `js/util.js`, `js/catalog.js`, `js/app.js`, `js/ui-core.js`, `js/main.js`, `js/host_persist.js`, `js/scenarios.js` (structure + 3 TP), `tools/build.js`, `tests/load.js`, `tests/helpers.js`, et le document « Architecture et structure du dépôt ». Les fichiers de protocoles (`codec*`, `ioscli*`, `ospf`, `vpn`, `voip`, `analyzer`…) n'ont été que listés : ils sont hors périmètre d'InfraLab.

### 2.1 Ce que le simulateur fait (rappel)
Application 100 % navigateur, hors-ligne, sans serveur (~45 fichiers `js/*.js`, ~850 000 caractères). Octets réels, analyseur type Wireshark, CLI Cisco/AOS, 35 TP (`CCNA` 7, `Cybersécurité` 6, `Stormshield` 5, le reste « Réseau »). Déployé en fichier autonome `dist/simulateur-reseau.html` et sur GitHub Pages.

### 2.2 Constats architecturaux

| Domaine | Observation | Conséquence pour InfraLab |
|---|---|---|
| **Frontend** | JS « classique » sans modules : fichiers `<script>` chargés dans un ordre strict, tout accroché à un espace de noms global `NS`. Pas de typage. | Fonctionne, mais fragile et peu testable. InfraLab passe à des modules ES typés. |
| **Backend** | Aucun. Tout est client. | À conserver : zéro serveur, hors-ligne, déploiement statique. |
| **État** | Réparti dans les objets-équipements (`Host`, `Switch`…), qui portent à la fois le comportement, l'état et des références vers la simulation. `sim.devices` (Map) + `sim.links`. | Pas de « modèle de données » séparé. InfraLab inverse : un **store de données pures** + des moteurs qui le transforment. |
| **Temps** | `sim.js` : simulateur à événements discrets (tas binaire `Heap`, `at(delay, fn)`, `runFor`, `runUntil`, `tick` temps réel avec deux régimes actif/inactif). Très bien conçu. | **À reprendre quasi tel quel** : le temps simulé sert aux SLA, aux remontées d'agent, aux délais. |
| **Canvas** | SVG (`#canvas` → `#grid/#world/#links/#fx/#nodes/#rubber`), transformation de vue `{x,y,k}`, outils sélection/câble/suppression, câble en 2 clics avec choix de port, « élastique » (`gRubber`), snap 4 px. | Excellente base pour la vue Infrastructure. Le rendu animé des trames (`#fx`) disparaît. |
| **Drag-and-drop / palette** | `buildPalette()` : catégories repliables, recherche, glisser-déposer **ou** clic-puis-clic (`armPlace`), pastille ✔ « fiche constructeur ». | À reprendre et à simplifier (15 types au lieu de dizaines de modèles). |
| **Panneau de propriétés** | `renderInspector()` + onglets droite « Propriétés / Sujet de TP » ; fenêtres flottantes par équipement (`devwin*.js`, terminal `term.js`). | Garder l'inspecteur latéral. Remplacer les fenêtres-équipement par des panneaux contextuels (pas de terminal en MVP). |
| **Projet / sauvegarde** | `NS.saveTopology` / `loadTopology` (JSON `{app, v:1, devices, links}`), autosave `localStorage`, export/import `.json` via File System Access API, fichiers `host_persist.js` pour les services ajoutés après coup. | Le principe est bon, la mise en œuvre (sérialisation dispersée, `localStorage` ≈ 5 Mo) ne suffit pas. InfraLab : snapshot unique **versionné avec migrations**, stocké dans IndexedDB. |
| **Moteur de TP** | `SC.push({ id, diff, title, level, duration, desc, objectives[], steps[] (HTML), build(sim), solve(sim), checks:[{label, run(c)}] })`, catégories `cat`, difficulté en étoiles, menu à deux listes, bouton « ✔ Vérifier mon travail ». `NS.checker(sim)` fournit `ping`, `http`, `ipOf`, `wait`. | Philosophie à **conserver intégralement**. Forme à changer : scénarios **déclaratifs** (JSON/YAML) au lieu de code impératif. |
| **Validation** | `checks[].run(checker)` rejoue des actions sur la simulation (ping, GET). | InfraLab valide sur **l'état** et le **journal d'événements**, sans effet de bord. |
| **Auto-test des TP** | `tests/t_sc.js` : pour *chaque* TP, build → vérif « avant » (doit échouer) → `solve()` → vérif « après » (doit réussir). | **Pépite à conserver** : un TP sans solution exécutable n'entre pas dans le dépôt. |
| **Indices / corrections** | Correction via `solve`, étapes guidées (`steps`). Pas de système d'indices progressifs. | À créer (indice 1→3 → solution). |
| **Progression / score** | Pas de score, pas de progression persistée, matrice de couverture du programme dans l'aide. | À créer : progression, score, compétences, mode examen. |
| **Notifications / composants UI** | `ui-core.js` : `h()` (hyperscript maison), `toast`, `menu`, `modal`, `ask`, `confirmBox`, `openWindow`, `tabs`, `field`. | Réutilisables (portés en TypeScript). |
| **Build / tests** | `tools/build.js` concatène HTML+CSS+JS en un fichier autonome. Tests Node via `vm.runInThisContext` (`tests/load.js`) + scripts `t_*.js` et `tests/ui/*`. | Garder l'idée du fichier autonome ; remplacer le harnais maison par Vitest. |

### 2.3 Forces à préserver
Zéro installation · hors-ligne · temps simulé déterministe · TP auto-testés · fichier autonome distribuable · sauvegarde/chargement JSON · crédits et identité Formaxion.

### 2.4 Faiblesses à ne pas reproduire
État mêlé au comportement et à l'UI · globales + ordre de chargement · absence de types · sérialisation éclatée · pas de séparation modèle/vue · validation par effets de bord.

---

## 3. Modèle partagé du SI (le « Core »)

### 3.1 Principe : un état, deux couches de connaissance

Il n'y a **qu'un seul état**, mais il distingue explicitement :

* la **couche Réalité** (`reality`) : ce qui est vrai dans le SI simulé — équipement, câblage, alimentation, configuration IP, matériel réel, logiciels réellement installés, état réel de l'agent ;
* la **couche Gestion** (`management`) : ce que l'outil en sait — fiches d'actifs, dernier inventaire, tickets, CI, contrats, licences…

Ce n'est **pas une duplication** : l'actif ITSM *référence* l'équipement (`deviceId`) et ne stocke que ce que l'outil a **observé** (rapport d'inventaire horodaté, provenance de chaque valeur) et ce qui est **déclaré** (numéro d'inventaire, contrat, coût). L'écart entre les deux est la matière pédagogique : *RAM passée de 8 à 16 Go → l'actif affiche encore 8 Go jusqu'au prochain inventaire.*

```
                         STATE (store unique, données pures, sérialisable)
                                        │
          ┌─────────────────────────────┴─────────────────────────────┐
     reality.*                                                  management.*
  devices, links, sites,                         assets, observations, users, tickets,
  subnets, hardware, software,                   problems, changes, CIs, relations,
  agentRuntime                                   licences, contrats, KB, SLA, audit
          │                                                           │
   Moteur Infrastructure                                        Moteur ITSM
          └───────────── bus d'événements de domaine ─────────────────┘
                                        │
                  Vue Infrastructure (SVG)    Vue ITSM (SPA)    Panneau TP
```

### 3.2 Règles du Core

1. **Données pures** : le store ne contient que des objets JSON (pas de classes, pas de fonctions, pas de références circulaires) → snapshot, reset, diff et tests triviaux.
2. **Mutation uniquement par commandes** (`dispatch(command)`), jamais depuis l'UI directement. Chaque commande valide ses préconditions (et vérifie les droits RBAC), modifie l'état, et publie un ou plusieurs événements.
3. **Dérivé ≠ stocké** : la joignabilité, la conformité de licences, la dépendance de services, les SLA restants sont **calculés** par des sélecteurs purs à partir de l'état.
4. **Identifiants stables** (`dev-001`, `ast-001`, `usr-001`) distincts des **références métier** affichées (`INC-0042`, `PRB-001`, `CHG-001`).
5. **Provenance** : toute donnée d'actif porte `source: 'manual' | 'agent' | 'discovery' | 'import' | 'scenario'` et `observedAt`. L'élève *voit* d'où vient une information.

### 3.3 Exemple : `device-001` dans les deux vues

```jsonc
// reality.devices["dev-001"]  — la vérité
{ "id":"dev-001", "name":"PC-COMPTA-01", "kind":"workstation", "powered":true,
  "site":"siege", "room":"B12", "pos":{"x":320,"y":240},
  "nics":[{"id":"eth0","mac":"AA:BB:CC:11:22:33","ip":"192.168.10.21","mask":24,"gw":"192.168.10.1","vlan":10}],
  "hardware":{"cpu":"Intel Core i5-1235U","ramGb":16,"disks":[{"type":"ssd","gb":512}]},
  "os":{"name":"Windows","version":"11 23H2"},
  "software":[{"softwareId":"sw-office","version":"2021"}],
  "loggedUser":"usr-alice",
  "agent":{"state":"running","version":"2.4","lastRun":43200000,"nextRun":129600000,"errors":[]} }

// management.assets["ast-001"]  — ce que l'outil en sait
{ "id":"ast-001", "deviceId":"dev-001", "status":"in_use", "lifecycle":"deployed",
  "inventoryNo":"INV-2024-0042", "serial":"5CG3...", "vendor":"HP", "model":"EliteBook 840",
  "assignedTo":"usr-alice", "service":"compta", "supplierId":"sup-hp", "contractId":"ctr-003",
  "purchase":{"date":"2024-02-01","cost":1290}, "warrantyEnd":"2027-02-01",
  "observed":{ "t":43200000, "source":"agent", "hostname":"PC-COMPTA-01", "ramGb":16, "ip":"192.168.10.21", "softwareCount":42 } }
```

Dans la vue Infrastructure : une icône, un nom, un état, des câbles. Dans la vue ITSM : une fiche avec onglets (Général, Matériel observé, Logiciels, Réseau, Tickets, Contrats, Historique). **Même `dev-001`.**

---

## 4. Fonctionnement des deux vues

### 4.1 Vue Infrastructure (schématiseur)
* **Palette drag-and-drop** (reprise de `buildPalette`) : Internet, routeur, firewall, switch, borne Wi-Fi, PC fixe, portable, serveur, NAS, imprimante, téléphone, tablette, VM, hyperviseur, équipement générique.
* **Canvas SVG** (reprise de `App` : vue `{x,y,k}`, grille, câble en 2 clics, sélection, suppression) ; **sites/salles** représentés par des zones (rectangles étiquetés) ; **sous-réseaux** par code couleur de liseré.
* **Indicateurs** posés sur chaque nœud : alimenté / éteint, lien up/down, **état de l'agent** (pastille), **fraîcheur d'inventaire** (vert → orange → rouge), **ticket ouvert** (badge).
* **Inspecteur** : propriétés *réalité* (IP, MAC, VLAN, matériel, OS, logiciels, agent) modifiables par des actions nommées (« Éteindre », « Changer l'IP », « Ajouter de la RAM »…), jamais par édition libre du JSON.
* **Actions physiques** = commandes `infra.*` (§5). Chacune produit des événements.
* **Lien vers l'ITSM** : bouton « Voir la fiche d'actif » ; badges de tickets cliquables.

### 4.2 Vue ITSM
Navigation (reprise de la liste du cahier des charges) : Tableau de bord · Parc (Ordinateurs, Serveurs, Réseau, Imprimantes, Téléphones, Logiciels) · Utilisateurs · Support (Tickets, Incidents, Demandes, Problèmes, Changements) · Inventaire (Agents, Découverte réseau) · CMDB · Licences · Contrats · Fournisseurs · Base de connaissances · Rapports · Administration · Journaux.
* SPA à routes (`#/parc/ordinateurs/ast-001`), listes triables/filtrables, fiches à onglets.
* **Le vocabulaire est volontairement générique** (« Actif », « Ticket », « CI ») et une aide contextuelle affiche les équivalents réels (§11).
* **Sélecteur « Agir en tant que »** (utilisateur / technicien / superviseur / gestionnaire de parc / administrateur) pour enseigner RBAC et séparation des rôles.

### 4.3 Passerelles entre les deux vues
* **Sélection partagée** : un seul `focus: EntityRef` dans le store. `Voir dans l'infrastructure` sur INC-0042 → bascule d'onglet, centre le canvas, sélectionne `dev-001`, anime un halo. L'inverse (« Voir dans l'ITSM ») ouvre la fiche d'actif.
* **Création automatique** : tout `device` créé dans la vue Infra existe immédiatement dans le Core ; l'ITSM ne le connaît qu'une fois **découvert** ou **inventorié** (§6, §7). Avant cela : *« inconnu de l'outil »* — c'est l'objet du TP 8.
* **Bandeau « Pourquoi ? »** : sur tout état dérivé (agent injoignable, inventaire périmé, actif « hors ligne »), un clic affiche la **chaîne causale** d'événements (§5.3).

---

## 5. Modèle d'événements

### 5.1 Commandes, événements, réacteurs

* **Commande** = intention (`infra.disconnectCable`, `itsm.assignTicket`). Peut être refusée.
* **Événement de domaine** = fait accompli, immuable, horodaté en temps simulé.
* **Réacteur** = fonction pure `(event, state) → commandes[]`, enregistrée par un moteur. Ne touche jamais l'UI.

```ts
interface DomainEvent {
  id: string;            // evt-000123
  t: number;             // temps simulé (ms depuis T0 du scénario)
  type: EventType;
  actor: 'user' | 'system' | 'agent' | 'scenario';
  actorId?: string;      // utilisateur ITSM ou « ELEVE »
  subject: EntityRef;    // { kind:'device', id:'dev-001' }
  payload: Record<string, unknown>;
  causedBy?: string;     // id de l'événement parent → chaîne causale
}
```

### 5.2 Catalogue initial

| Événement | Émis par | Conséquences (réacteurs) |
|---|---|---|
| `CableConnected` / `CableDisconnected` | action physique | recalcul de joignabilité → `DeviceOnline/Offline` en cascade |
| `DevicePoweredOn` / `DevicePoweredOff` → `DeviceOnline` / `DeviceOffline` | action physique ou **diff de joignabilité** | agent injoignable ; actif « non vu depuis… » ; alerte de supervision si activée |
| `AgentInstalled` / `AgentStarted` / `AgentStopped` / `AgentUninstalled` | action élève | planifie / annule la prochaine remontée |
| `AgentOffline` / `AgentOnline` | diff de joignabilité × état agent | erreur dans les logs de l'agent ; badge sur l'actif |
| `AgentInventoryCompleted` | planificateur / « Forcer l'inventaire » | fusion dans `observed` ; **détection de changement** (RAM, IP, logiciels) ; rapprochement d'actif |
| `NetworkDiscoveryCompleted` | action élève | création d'actifs `découverts` (informations partielles) |
| `SoftwareInstalled` / `SoftwareRemoved` | action physique | visible à l'inventaire suivant ; recalcul de conformité de licence |
| `IPAddressChanged` | action physique | joignabilité (sous-réseau/passerelle) ; écart avec l'inventaire jusqu'à la prochaine remontée |
| `HardwareChanged` (RAM, disque) | action physique | écart réalité/observé ; événement `ChangeDetected` à l'inventaire |
| `DeviceReplaced` | action physique (remplacement) | **nouvel équipement, même emplacement/IP** ; ancien actif → `retired` ; CI recopiés ; clôture éventuelle de CHG |
| `DeviceRemoved` | action physique | actif non rapproché → « disparu » |
| `TicketCreated/Qualified/Assigned/Resolved/Closed`, `ProblemCreated`, `ChangeApproved`… | ITSM | SLA, journaux, notifications, validation de TP |
| `SlaWarning` / `SlaBreached` | horloge | alerte visible au tableau de bord |
| `ScenarioScriptStep` | moteur de TP | injecte un événement ou un ticket à un instant donné |

**Les événements physiques ne créent pas de tickets automatiquement** (sauf option « supervision » activée par un TP). C'est l'utilisateur qui signale la panne : c'est ce qui permet de montrer l'incident *collectif* (trois tickets, une cause).

### 5.3 Événements dérivés par diff + chaîne causale
La joignabilité est une **fonction pure** `computeReachability(state)` (graphe : équipement alimenté, lien actif, IP/masque/passerelle cohérents, chemin jusqu'au serveur ITSM). Après chaque commande d'infrastructure, le moteur compare l'ancienne et la nouvelle joignabilité et **émet les `DeviceOffline/Online` correspondants** avec `causedBy` = la commande d'origine. On n'émet donc jamais à la main « PC21, PC22, PC23 injoignables » : on éteint SW02 et le moteur le déduit — c'est le scénario d'incident collectif.

Exemple de trace affichée à l'élève :
```
t=09:02  CableDisconnected  PC-COMPTA-01 ← SW-SIEGE-01 (par ELEVE)
  └ 09:02 DeviceOffline        PC-COMPTA-01 (aucun lien actif)
      └ 09:02 AgentOffline     agent v2.4 injoignable
          └ 09:02 AssetStale   ast-001 : dernier inventaire 08:00, non actualisé
```

---

## 6. Modèle de données

### 6.1 Entités (résumé)

| Domaine | Entité | Champs clés |
|---|---|---|
| **Organisation** | `Site`, `Room`, `Department`, `Group` | nom, parent, responsable |
| | `User` | nom, rôle(s), service, site, groupes, équipements affectés |
| **Réalité** | `Device` | kind, powered, pos, site/salle, `nics[]`, hardware, os, software[], loggedUser, agent (runtime) |
| | `Link` | a:{device,port}, b:{device,port}, medium, up (dérivé) |
| | `Subnet` | cidr, vlan?, gateway, site |
| | `SoftwareCatalog` | éditeur, nom, versions |
| **Inventaire** | `Observation` | deviceId, t, source, payload (snapshot) |
| | `DiscoveredHost` | ip, mac, t, ports?, deviceId? (rapprochement) |
| **ITAM** | `Asset` | deviceId?, status, lifecycle, inventoryNo, serial, vendor, model, assignedTo, service, supplier, contract, purchase, warrantyEnd, `observed` |
| | `Software`, `SoftwareInstall`, `License` | éditeur, version, droits, installations (dérivées), conformité (dérivée) |
| | `Contract`, `Supplier` | type, dates, coût, actifs couverts, alertes |
| **ITSM** | `Ticket` | ref, type (incident / demande), catégorie/sous-catégorie, urgence, impact, **priorité (dérivée)**, statut, demandeur, assigné, groupe, actifs liés, SLA, commentaires[], solution, problème/changement liés |
| | `Problem` | ref, tickets liés, cause racine, contournement, statut |
| | `Change` | ref, type (standard / normal / urgent), statut, CI concernés, plan, plan de retour, approbations, vérification |
| | `SlaPolicy` | priorité → délais prise en charge / résolution, calendrier |
| | `KnowledgeArticle` | titre, catégorie, corps, visibilité, liens (tickets/catégories) |
| **CMDB** | `ConfigItem` | type (poste, serveur, switch, routeur, application, service, base, VM, hyperviseur), `ref` (device/asset/-) |
| | `Relation` | from, to, type (`connected_to`, `depends_on`, `hosts`, `uses`, `belongs_to`, `protects`), `origin` (`infra` auto / `manual`) |
| **Sécurité** | `Role`, `Permission`, `AuditEntry` | matrice rôle×permission ; journal (qui, quoi, quand, avant/après) |
| **Pédagogie** | `Project`, `ScenarioRun`, `Progress` | cf. §10 |

### 6.2 Quelques types TypeScript clés

```ts
type AgentState = 'none' | 'stopped' | 'running';
type AgentHealth = 'ok' | 'outdated' | 'misconfigured' | 'unreachable';
interface AgentRuntime { state: AgentState; version?: string; serverUrl?: string;
  intervalMs: number; lastRun?: number; nextRun?: number; errors: string[]; logs: AgentLog[] }
// Santé = fonction pure (état de l'agent, version attendue, serverUrl, joignabilité)

type TicketKind = 'incident' | 'request';
type TicketStatus = 'new'|'qualified'|'assigned'|'in_progress'|'pending'|'resolved'|'closed';
// Priorité = matrice(impact × urgence) → P1..P4 ; SLA = f(priorité, calendrier)

type ChangeStatus = 'proposed'|'analysed'|'approved'|'scheduled'|'implemented'|'verified'|'closed';
```

Les **workflows** (tickets, problèmes, changements) sont des **tables de transitions déclaratives** : `{ from, to, requires: [permission, champ obligatoire], emits }`. Ajouter un état ou une règle (ex. « pas de clôture sans solution ») = éditer une table, pas du code.

### 6.3 Calculs dérivés (sélecteurs purs)
`reachability`, `agentHealth`, `assetFreshness`, `licenseCompliance` (installations observées vs droits), `ticketPriority`, `slaRemaining`, `cmdbImpact(ciId)` (parcours de graphe), `driftReport(assetId)` (écart réalité/observé).

### 6.4 Entreprise fictive : **NovaTech**
Sites : Siège, Agence Nord, Agence Sud, Datacenter. Services : Direction, RH, Comptabilité, Commercial, Production, Informatique. Jeu de données cohérent livré en `data/novatech/seed.json` (≈ 60 équipements, 45 utilisateurs, 3 contrats, 5 fournisseurs, parc logiciel avec **une non-conformité Office 50 droits / 57 installations** volontairement présente). Chaque TP dérive de ce socle (`base: novatech` + surcharges), ce qui donne un fil rouge réaliste.

---

## 7. Moteurs métier (ce qu'ils font, ce qu'ils ne font pas)

**Infrastructure** — `computeReachability`, commandes physiques, changement d'IP/VLAN simple, VM↔hyperviseur. *Ne fait pas* : trames, ARP, routage dynamique, protocoles.

**Inventaire** — `AgentEngine` (machine à états + planification par le scheduler), `Collector` (lit la **réalité** → `Observation`, jamais saisie à la main), `Reconciler` (rapproche par MAC, puis hostname, puis IP), `DiscoveryEngine` (`scan(cidr)` : équipements du canvas dont l'IP est dans le CIDR et joignables depuis la sonde → hôtes découverts avec IP/MAC/hostname seulement).
> *Découverte = « l'équipement existe ». Inventaire = « j'ai des informations détaillées et exploitables ».*

**ITSM** — tickets/workflows, SLA (horloge simulée + calendrier ouvré), problèmes (regroupement de tickets, cause racine, contournement), changements (standard/normal/urgent, approbation), base de connaissances (recherche plein texte simple), contrats/alertes d'échéance, licences, RBAC, audit.

**CMDB** — relations **auto-dérivées** de l'infrastructure (`connected_to` depuis les câbles, `hosts` depuis VM→hyperviseur) + relations **manuelles** (`depends_on`, `uses`, `protects`) créées par l'élève ; visualisation en graphe de dépendances (couches horizontales, sens de dépendance vers le bas) et **analyse d'impact** (« si SW-DC01 tombe, quels services ? »).

---

## 8. Architecture technique

### 8.1 Choix proposés (à valider, cf. §15)

| Sujet | Proposition | Raison |
|---|---|---|
| Langage | **TypeScript** strict | Cahier des charges : typé, modulaire, maintenable. Le Core et les validateurs en profitent le plus. |
| Build | **Vite** + plugin « single-file » | Dev rapide, modules ES, et **sortie `dist/infralab.html` autonome** comme le simulateur réseau. |
| UI | **DOM natif + petit helper `h()`** (repris d'`ui-core.js`) pour le canvas et les panneaux ; **Preact** (3 Ko) envisageable pour la vue ITSM (listes/formulaires nombreux) | Garder la légèreté et la lisibilité du simulateur ; éviter un framework lourd. |
| Rendu schéma | **SVG** (comme `app.js`) | Suffisant (< 200 nœuds), accessible, stylable. |
| État | Store maison minimal (≈ 150 lignes) : `getState`, `dispatch`, `subscribe(selector)` | Pas de dépendance, totalement testable. |
| Persistance | **IndexedDB** (projets, progression) + **export/import JSON** | Dépasse la limite `localStorage` ; fichiers partageables avec le formateur. |
| Tests | **Vitest** (unitaires + scénarios) + **Playwright** (quelques tests UI de bout en bout) | Playwright est déjà utilisé de fait par les tests `tests/ui/*` du simulateur. |
| Scénarios | **YAML** (auteur) compilé/validé en JSON (runtime) via un schéma (Zod) | Lisible par un enseignant ; erreurs détectées à la CI, pas en classe. |
| Hébergement | **GitHub Pages** du dépôt InfraLab | Même mécanique que le simulateur réseau ; URL propre. |

### 8.2 Couches et règle de dépendance

```
ui/*  ─────►  engines (infra, inventory, itsm, cmdb, teaching)  ─────►  core
 │                                                                       ▲
 └───────────────────────── lecture seule via sélecteurs ────────────────┘
```
* `core` ne dépend de rien.
* Les moteurs dépendent de `core` ; **`infra` et `itsm` ne s'importent pas l'un l'autre** : ils dialoguent par événements.
* `ui` n'importe jamais un moteur pour muter : il appelle `dispatch`.
* Règle vérifiée automatiquement en CI (`dependency-cruiser`).

### 8.3 Horloge, aléa, déterminisme
* `Scheduler` (repris de `sim.js` : `Heap`, `at`, `cancel`, `runFor`, `runUntil`) ; **temps simulé** en ms depuis un `T0` fixe par scénario.
* Contrôles : pause, vitesse, **+1 h / +1 jour** (reprise du bouton « +1 min » du simulateur) pour faire passer des remontées d'agent et des SLA.
* `Rng` à graine (reprise de `NS.Rng`) : aucun `Math.random()` dans le Core.

### 8.4 Sauvegarde et reset
* `Project = { id, name, mode, scenarioId?, schemaVersion, snapshot, eventLog, progress }`.
* **Reset de TP** : reconstruction depuis `initial_state` du scénario (+ graine) → restaure topologie, équipements, connexions, agents, utilisateurs, tickets, logiciels et états *exactement*. Testé par comparaison de snapshots.
* **Migrations** : `schemaVersion` + fonctions `vN → vN+1` (le `v:1` du simulateur montre que c'était prévu mais jamais exercé).

---

## 9. Arborescence proposée du dépôt `InfraLab`

```
InfraLab/
├─ README.md                      # présentation, crédits (Yahn LE PRETTRE — Formaxion Landes), liens
├─ package.json  tsconfig.json  vite.config.ts  vitest.config.ts
├─ .github/workflows/             # CI (lint, tests, validation scénarios) + déploiement Pages
├─ docs/
│  ├─ ARCHITECTURE.md             # ce document
│  ├─ adr/                        # décisions d'architecture (0001-typescript.md …)
│  ├─ glossaire-outils-reels.md   # Actif/Asset/CI… équivalences GLPI, ServiceNow, JSM…
│  ├─ couverture-competences.md   # matrice TP × compétences « travaillées »
│  └─ guide-formateur.md  guide-auteur-scenario.md
├─ src/
│  ├─ core/
│  │  ├─ model/                   # types + schémas de toutes les entités
│  │  ├─ store/                   # store, commandes, bus d'événements, journal
│  │  ├─ scheduler/               # Heap, horloge simulée (depuis sim.js)
│  │  ├─ net/                     # IPv4, MAC, CIDR (depuis util.js)
│  │  ├─ rng.ts  ids.ts  selectors/
│  ├─ infra/                      # connectivité, commandes physiques, catalogue matériel
│  ├─ inventory/                  # agent, collecteur, rapprochement, découverte
│  ├─ itsm/
│  │  ├─ tickets/  problems/  changes/  sla/  assets/  software/
│  │  ├─ contracts/  knowledge/  rbac/  audit/  workflows/ (tables déclaratives)
│  ├─ cmdb/                       # relations, dérivation depuis l'infra, impact
│  ├─ teaching/                   # schéma de scénario, chargeur, validateurs, indices, score, reset, examen
│  ├─ persistence/                # IndexedDB, import/export, migrations
│  ├─ ui/
│  │  ├─ kit/                     # h(), toast, modal, menu, tabs, field (depuis ui-core.js)
│  │  ├─ shell/                   # barre [Infrastructure][ITSM], horloge, rôle courant
│  │  ├─ infra-view/              # canvas SVG, palette, inspecteur (depuis app.js)
│  │  ├─ itsm-view/               # routes : dashboard, parc, support, inventaire, licences…
│  │  ├─ cmdb-view/               # graphe de dépendances
│  │  ├─ trace-view/              # « Pourquoi ? » chaîne causale
│  │  └─ tp-panel/                # énoncé, objectifs, indices, vérification, « Dans les outils réels »
│  └─ main.ts
├─ data/
│  ├─ novatech/                   # seed.json (entreprise fictive)
│  ├─ catalog/                    # types d'équipements, gabarits matériel, logiciels
│  ├─ scenarios/                  # tp-01-decouvrir-le-si.yaml … tp-final.yaml
│  ├─ kb/                         # articles de base de connaissances (markdown)
│  └─ real-world/                 # glossaire par module (« Dans les outils réels »)
├─ tests/
│  ├─ unit/  scenarios/ (build→avant→solution→après, pour chaque TP)  e2e/
└─ tools/
   ├─ build-single-file.ts  validate-scenarios.ts  run-solutions.ts
```

---

## 10. Moteur de TP

### 10.1 Structure d'un scénario

```yaml
id: tp-16-pc-deconnecte
title: PC déconnecté — diagnostiquer un incident réseau utilisateur
level: 4            # niveau du parcours
difficulty: 2       # étoiles
duration: 45 min
mode: tp
skills:             # « compétence travaillée » ou « élément de preuve possible » — jamais « validée »
  - { ref: "Répondre aux incidents", kind: worked }
  - { ref: "Assurer la traçabilité", kind: evidence_possible }

context: >
  Alice (Comptabilité) n'a plus de réseau. Elle ouvre un ticket à 9 h 02.

initial_state:
  base: novatech
  overrides: { }          # ajouts/retraits d'équipements, états, tickets…

script:                   # événements injectés par le scénario (temps simulé)
  - at: 0
    do: infra.disconnectCable
    args: { device: pc-compta-01, port: eth0 }
  - at: 2m
    do: itsm.createTicket
    args: { ref: INC-001, requester: usr-alice, text: "Je n'ai plus accès au réseau" }

objectives:
  - id: classify    label: Catégoriser le ticket « Incident / Réseau / Poste »
    check: { ticket: INC-001, categoryIs: "Réseau/Poste" }
  - id: link        label: Associer le bon équipement
    check: { ticket: INC-001, linkedAsset: ast-pc-compta-01 }
  - id: fix         label: Reconnecter le poste
    check: { device: pc-compta-01, reachable: true }
  - id: agent       label: Vérifier que l'agent est de nouveau joignable
    check: { device: pc-compta-01, agentHealth: ok }
  - id: doc         label: Documenter la solution
    check: { ticket: INC-001, hasSolution: true }
  - id: close       label: Clôturer le ticket
    check: { ticket: INC-001, status: closed }
    after: [fix, doc]

hints:  # indices progressifs ; chaque indice consommé coûte des points (hors examen)
  - { for: fix, levels: ["Que dit l'état du lien dans l'infrastructure ?", "Observe le badge rouge sur le poste.", "Un câble a été débranché côté switch."], solution: "…" }

scoring: { objectives: 70, quality: 20, no_hints: 10 }
real_world: { terms: [asset, ticket, cmdb], note: "Dans GLPI : « Tickets » ; ServiceNow : « Incident »…" }
solution:               # suite de commandes rejouable = auto-test du TP en CI
  - infra.connectCable: { device: pc-compta-01, port: eth0, to: sw-siege-01 }
  - itsm.linkAsset: { ticket: INC-001, asset: ast-pc-compta-01 }
  - itsm.resolveTicket: { ticket: INC-001, solution: "Câble RJ45 rebranché" }
  - itsm.closeTicket: { ticket: INC-001 }
```

### 10.2 Validateurs
Prédicats **purs** sur `(state, eventLog)` : `asset.exists`, `device.reachable`, `link.connected`, `agentHealth`, `ticket.categoryIs/linkedAsset/status/hasSolution/priorityIs`, `problem.linkedTickets >= n`, `change.status`, `sla.met`, `license.compliant`, `relation.exists`, `audit.contains`, `rbac.denied`… + une **échappatoire TypeScript** pour les cas rares. Un objectif peut aussi exiger un **ordre** (`after`) ou une **action interdite** (`forbid: closeBeforeSolution`) — utile pour la traçabilité.

### 10.3 Modes
* **Libre** : aucun scénario, l'élève bâtit son SI (partir de zéro, de NovaTech, ou d'un fichier).
* **TP** : environnement préparé, actions parfois imposées/bloquées (`lock:`), indices, correction, reset.
* **Examen** *(après MVP)* : pas d'indices, score, journal d'actions complet, temps facultatif, bilan final exportable.

### 10.4 Qualité des TP (CI)
Pour chaque scénario : (1) validation de schéma, (2) construction, (3) tous les objectifs **échouent** à l'état initial, (4) la `solution` s'exécute sans erreur, (5) tous les objectifs **réussissent** ensuite, (6) le **reset** redonne un snapshot identique. C'est l'héritage direct de `t_sc.js`.

### 10.5 Compétences (BTS SIO SISR)
Chaque TP liste des compétences **travaillées** ou des **éléments de preuve possibles** (portfolio : capture du journal, de la fiche d'actif, du ticket documenté). **Aucun écran ne dit qu'une compétence est « validée »** ; la validation reste l'affaire du formateur et du référentiel.

---

## 11. « Dans les outils réels » (transférabilité)

Chaque module se termine par un encart alimenté par `data/real-world/*.yaml`, par exemple :

| Concept InfraLab | Autres appellations |
|---|---|
| Actif | Asset, IT Asset, Equipment, Computer/Device (GLPI), Configuration Item selon le niveau de gestion |
| CI | Configuration Item, CI, élément de configuration |
| Service Desk | Help Desk, Support, ITSM portal |
| Ticket | Ticket (GLPI), Incident/Request/Task (ServiceNow), Issue (Jira SM), Request (Freshservice) |
| Agent d'inventaire | FusionInventory/GLPI Agent, SCCM client, Intune/MDM agent, Lansweeper agent |
| Découverte | Network discovery, Discovery (ServiceNow), probe, scan SNMP/ICMP |
| Changement | Change, RFC, Change Request |
| Problème | Problem record, Known error (erreur connue) |

La page d'aide ajoute à chaque fois : *« pourquoi cette information existe, comment elle est obtenue, à quoi elle sert »*.

---

## 12. Réutilisation du simulateur réseau

| Élément | Décision | Détail |
|---|---|---|
| `sim.js` — `Heap`, `at/cancel/runFor/runUntil/tick` | **Réutiliser** (porter en TS) | Supprimer `Port`, `Link`, `transmit`, captures, détecteur de tempête. Le scheduler devient un module `core/scheduler`. |
| `util.js` — `IP`, `MAC`, `Emitter`, `Rng` | **Réutiliser** | Ajouter itération de CIDR (pour la découverte). |
| `ui-core.js` — `h()`, `toast`, `menu`, `modal`, `ask`, `confirmBox`, `tabs`, `field`, `openWindow` | **Réutiliser** | Porter en TS ; `openWindow` utile pour fiches flottantes éventuelles. |
| `app.js` — palette (recherche, catégories, drag/clic), vue `{x,y,k}`, grille, câble en 2 clics, rubber band, sélection, suppression, `fit()` | **Adapter** | Lire le **Core** au lieu de `sim.devices` ; retirer `onFrame/drawFx` (animation de trames) ; ajouter zones sites/salles, badges d'état. |
| `catalog.js` — catalogue data-driven, `specs`, pastille ✔ « fiche constructeur », tags | **Adapter / simplifier** | ~15 types ; gabarits matériel (CPU/RAM/disque/OS/logiciels de base) au lieu de fiches produit détaillées. Conserver l'idée « valeurs relevées vs typiques » si des fiches réelles sont citées. |
| `topology.js` + `main.js` (snapshot, autosave, import/export, File System Access API) | **Adapter** | Garder les mécanismes (autosave, `showSaveFilePicker`) ; remplacer le format par `Project` versionné + IndexedDB. |
| `host_persist.js` (sérialisation par ajout) | **Remplacer** | Le store de données pures supprime ce besoin. |
| `scenarios.js` — modèle `{id, diff, title, level, duration, desc, objectives, steps, build, solve, checks}` | **Adapter** | Conserver *tous les champs* ; remplacer `build/solve/checks` impératifs par YAML déclaratif ; garder `solve` sous forme de commandes rejouables. |
| `main.js` — menu TP (catégorie → sujet, étoiles), « ✔ Vérifier mon travail », panneau « Sujet de TP » | **Adapter** | Ajouter indices, score, compétences, progression. |
| `tools/build.js` (fichier autonome) | **Remplacer par équivalent** | Plugin Vite single-file, même résultat. |
| `tests/load.js`/`helpers.js`, `t_sc.js` | **Reprendre le principe** | Vitest ; `t_sc.js` devient `tests/scenarios/run-all.test.ts`. |
| `index.html` / `css/style.css` — structure 3 colonnes (palette · centre + dock · propriétés/TP) | **Adapter** | Même ergonomie ; dock du bas = journal d'événements / trace causale (au lieu de l'analyseur). |
| `codec*`, `stack`, `services`, `ioscli*`, `aos`, `ospf`, `stp`, `lag`, `qos`, `vpn`, `radius`, `voip`, `dot1x`, `ip6`, `mgmt`, `cyber`, `analyzer`, `wireshark`, `hostshell*`, `term`, `devwin*` | **Ne pas reprendre** | Hors périmètre ITSM. À terme, un **mini-terminal** (`ping`, `ipconfig`) pourrait être extrait de `hostshell` pour les diagnostics. |

---

## 13. Les 40 TP

> Chaque TP indique : ce qu'on **comprend**, le scénario, et la compétence **travaillée** (pistes de BTS SIO SISR ; « preuve possible » = ce que l'élève peut conserver dans son portfolio). Chaque module se ferme par « Dans les outils réels ».

### Niveau 1 — Découverte
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 1 | Découvrir le SI | Parcourir NovaTech : sites, équipements, utilisateurs ; distinguer *schéma* et *base de gestion*. | Gérer le patrimoine informatique |
| 2 | Ajouter du matériel | Poser un PC et un switch, les câbler ; constater qu'ils existent dans le Core mais **pas encore** dans l'ITSM. | Gérer le patrimoine informatique |
| 3 | Comprendre les vues | Même équipement, deux représentations ; sélection partagée, « Voir dans l'infrastructure ». | Gérer le patrimoine informatique |
| 4 | Identifier un actif | Lire une fiche : n° d'inventaire, série, garantie, localisation ; retrouver un actif à partir d'un symptôme. | Gérer le patrimoine informatique |
| 5 | Affecter un utilisateur | Lier PC ↔ utilisateur ↔ service ↔ site ; effet dans les deux vues. | Gérer le patrimoine · Gérer les habilitations |

### Niveau 2 — Inventaire
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 6 | Installer un agent | Installer/démarrer l'agent sur un poste ; lire ses logs. | Gérer le patrimoine · Exploiter et dépanner |
| 7 | Première remontée | Forcer l'inventaire ; les données **viennent de l'agent**, pas d'une saisie ; provenance par champ. | Gérer le patrimoine informatique |
| 8 | Découverte réseau | Scanner `192.168.10.0/24` ; équipements « découverts » à informations partielles ; découverte ≠ inventaire. | Gérer le patrimoine · Administrer une infrastructure |
| 9 | Équipement sans agent | Imprimante/NAS/switch : ce qu'on ne sait pas ; compléter manuellement vs autres protocoles. | Gérer le patrimoine informatique |
| 10 | Agent en erreur | Agent obsolète, mal configuré (mauvaise URL), arrêté, injoignable : diagnostiquer chaque cas. | Exploiter et dépanner · Assurer la traçabilité |

### Niveau 3 — Service Desk
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 11 | Créer un ticket | Saisie demandeur/description/catégorie ; ce qu'est un ticket *bien rédigé*. | Répondre aux incidents et aux demandes |
| 12 | Qualifier un incident | Catégorie, sous-catégorie, type ; pourquoi qualifier. | Répondre aux incidents |
| 13 | Associer un équipement | Lier ticket ↔ actif ; naviguer vers l'infrastructure ; historique de l'actif. | Répondre aux incidents · Gérer le patrimoine |
| 14 | Priorité impact/urgence | Matrice impact×urgence ; deux tickets « identiques » de priorités différentes. | Répondre aux incidents |
| 15 | Résoudre un incident | Workflow Nouveau→Clos ; solution documentée ; pourquoi ne pas clore sans solution. | Répondre aux incidents · Assurer la traçabilité |

### Niveau 4 — Incidents techniques
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 16 | PC déconnecté | Câble débranché → agent injoignable → ticket d'Alice → reconnecter → vérifier. | Exploiter et dépanner · Répondre aux incidents |
| 17 | Serveur arrêté | Serveur applicatif éteint ; services impactés (aperçu CMDB) ; remise en ligne. | Exploiter et dépanner |
| 18 | Switch en panne | SW02 DOWN ; observer la **cascade** de `DeviceOffline`. | Exploiter et dépanner · Administrer une infrastructure |
| 19 | Plusieurs utilisateurs impactés | Trois tickets distincts, **une** cause ; corréler avant d'agir. | Répondre aux incidents |
| 20 | Incident majeur | Panne du datacenter ; priorisation, communication, ordre d'intervention. | Répondre aux incidents · Travailler en mode projet |

### Niveau 5 — ITIL
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 21 | Incident vs demande | Trier des tickets : « plus d'accès » vs « installer un logiciel » ; circuits différents. | Répondre aux incidents / aux demandes |
| 22 | SLA | Délais P1/P2/P3, compte à rebours en temps simulé, dépassement ; calendrier ouvré. | Répondre aux incidents · Assurer la traçabilité |
| 23 | Problem Management | PRB-001 « Défaillance du switch SW02 » ; regroupement, cause racine, contournement, correction. | Répondre aux incidents (au-delà du curatif) |
| 24 | Change Management | CHG-001 « Remplacement SW02 » : proposer→analyser→approuver→planifier→**réaliser dans l'infra**→vérifier→clore. | Travailler en mode projet · Administrer une infrastructure |
| 25 | Knowledge Management | Rédiger un article depuis une résolution ; le lier à la catégorie ; réutilisation sur un 2ᵉ ticket. | Assurer la traçabilité · Répondre aux demandes |

### Niveau 6 — ITAM
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 26 | Logiciels | Logiciels détectés par l'agent ; versions ; installations non autorisées. | Gérer le patrimoine · Sécuriser les équipements |
| 27 | Licences | Office : 50 droits / 57 installations → non-conformité ; comment la résorber. | Gérer le patrimoine informatique |
| 28 | Contrats | Contrats, fournisseurs, garanties, alertes d'échéance simulées. | Gérer le patrimoine informatique |
| 29 | Cycle de vie matériel | Commandé → stock → déployé → en réparation → retiré ; effets dans les deux vues. | Gérer le patrimoine informatique |
| 30 | Réaffectation | Rendre un poste, l'effacer, le réaffecter ; traçabilité des changements de propriétaire. | Gérer le patrimoine · Gérer les habilitations |

### Niveau 7 — CMDB
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 31 | Créer des CI | Du poste/serveur au **service** ; qu'est-ce qui mérite d'être un CI. | Gérer le patrimoine informatique |
| 32 | Relations | `connected_to` (auto, issu du schéma) vs `depends_on`/`uses` (manuelles). | Gérer le patrimoine · Administrer une infrastructure |
| 33 | Dépendances | Chaîne Service RH → Application RH → SRV-RH01 → VM01 → HV01 → SW-DC01 ; lecture du graphe. | Administrer une infrastructure |
| 34 | Analyse d'impact | « Si SW-DC01 tombe ? » ; préparer un changement avec l'impact attendu. | Travailler en mode projet · Exploiter et dépanner |

### Niveau 8 — Administration
| # | TP | Ce qu'on comprend / scénario | Compétence travaillée |
|---|---|---|---|
| 35 | Utilisateurs | Créer/désactiver ; cycle arrivée-départ ; services et sites. | Gérer les habilitations |
| 36 | Groupes | Groupes de techniciens, droits par groupe, affectation des tickets. | Gérer les habilitations |
| 37 | Profils | Utilisateur, technicien, superviseur, gestionnaire de parc, administrateur ; RBAC. | Gérer les habilitations · Sécuriser les équipements |
| 38 | Permissions | Moindre privilège ; essayer d'agir hors droits et lire le refus ; séparation des rôles (qui approuve ≠ qui réalise). | Gérer les habilitations · Participer à la cybersécurité |
| 39 | Audit | Retrouver *qui a fait quoi, quand* dans les journaux ; détecter une modification suspecte d'actif. | Assurer la traçabilité · Participer à la cybersécurité |

### TP final
| # | TP | Scénario | Compétences travaillées |
|---|---|---|---|
| 40 | **Administrateur ITSM de NovaTech** | Comprendre l'infrastructure → inventorier le parc → déployer les agents → affecter les utilisateurs → traiter des incidents → identifier un problème → gérer un changement → vérifier les SLA → corriger l'inventaire → maintenir la CMDB → gérer logiciels et licences → sécuriser les droits → produire un **bilan**. | Ensemble ; bilan exportable = **élément de preuve possible** |

---

## 14. MVP, roadmap, risques

### 14.1 MVP — « tranche verticale de la chaîne centrale »
Objectif : un élève réalise **TP 3, 6, 7, 8, 11-13 et 16** de bout en bout, dans une seule application.

* **Core** : store + commandes + événements + journal, scheduler, reset/snapshot, sauvegarde projet (IndexedDB + JSON).
* **Infrastructure** : canvas, palette de **6 types** (Internet, routeur/firewall, switch, PC, serveur, imprimante), câbles, actions *éteindre/rallumer, débrancher/rebrancher, changer l'IP*, joignabilité, indicateurs.
* **Inventaire** : agent (installer/démarrer/arrêter/forcer/logs), collecteur, rapprochement, découverte d'un CIDR.
* **ITSM** : tableau de bord minimal, Parc (ordinateurs, serveurs, réseau), fiche d'actif (observé vs déclaré), Utilisateurs, Tickets (workflow complet, lien actif, « Voir dans l'infrastructure »), journaux.
* **TP** : moteur déclaratif, validateurs de base, indices, correction, reset, score simple, **5 TP** + auto-tests CI.
* **Hors MVP** : problèmes, changements, SLA complets, CMDB visuelle, logiciels/licences, contrats, base de connaissances, RBAC fin, mode examen.

### 14.2 Roadmap

| Jalon | Contenu | Critère de sortie |
|---|---|---|
| **M0 — Fondations** | Dépôt, TS/Vite/Vitest/CI, `core` (store, commandes, événements, scheduler, IP/MAC/CIDR), ADR | Tests unitaires du Core verts ; build autonome produit |
| **M1 — Infra** | Canvas, palette, câbles, actions physiques, `computeReachability`, événements dérivés | Débrancher un câble produit la cascade d'événements attendue |
| **M2 — Inventaire** | Agent, collecteur, rapprochement, découverte, vue Parc minimale | « Découvert » → « inventorié » observable ; provenance affichée |
| **M3 — Service Desk** | Tickets + workflow + priorité + liens actif ↔ infra | **TP 16 jouable de bout en bout** |
| **M4 — Moteur de TP** | Schéma YAML, validateurs, indices, score, reset, progression, CI « solution » | 5 TP auto-testés ; reset = snapshot identique |
| **M5 — ITIL** | SLA, problèmes, changements, KB, incident collectif | TP 18-25 |
| **M6 — ITAM + CMDB** | Logiciels, licences, contrats, cycle de vie, relations, graphe, impact | TP 26-34 |
| **M7 — Administration** | RBAC, groupes, profils, audit | TP 35-39 |
| **M8 — Finition pédagogique** | NovaTech complet, TP final, mode examen, « Dans les outils réels », accessibilité, guide formateur | TP 40 + essai en classe |

### 14.3 Risques

**Techniques**
| Risque | Parade |
|---|---|
| Dérive de modèle : réalité et gestion se désynchronisent *sans le vouloir* | Séparer explicitement `reality`/`management` ; un seul sens de flux (collecte) ; tests de « drift » |
| Sur-ingénierie réseau (reproduire le simulateur réseau) | Règle §1.2 + revue : toute fonction réseau doit nommer **ce que l'ITSM voit** grâce à elle |
| Cascades d'événements difficiles à déboguer | Champ `causedBy`, vue « Pourquoi ? » dès M1, tests de scénarios |
| Perte de déterminisme (aléa, horloge murale) | Interdire `Math.random`/`Date.now` dans `core` et moteurs (lint) |
| Migration de sauvegardes cassant les projets d'élèves | `schemaVersion`, migrations testées, export JSON de secours |
| Performance du canvas SVG | Budget 200 nœuds ; rendu différentiel (comme `dirtyTopo`/`dirtyStates` d'`app.js`) |
| Fichier autonome trop lourd / contraintes de cache navigateur | Surveiller la taille du build ; pas de dépendance lourde |

**Pédagogiques**
| Risque | Parade |
|---|---|
| L'élève apprend « le menu de InfraLab » | Vocabulaire générique, encarts « Dans les outils réels », objectifs formulés en *compréhension* |
| Tout est trop guidé / « cliquer dans l'ordre » | Indices progressifs, objectifs non ordonnés quand c'est possible, scénarios à diagnostic |
| Confusion entre *découverte* et *inventaire* | TP 8-9 dédiés, statut d'actif visible (`découvert` ≠ `inventorié`), colonnes de provenance |
| Le simulateur fait croire à des automatismes irréalistes | Pas de ticket automatique par défaut ; délais de remontée visibles |
| Sur-promesse sur les compétences | Formulation imposée « travaillée / preuve possible » ; relue en CI (mot interdit : « validée ») |
| Charge de rédaction de 40 TP | Format YAML court, base NovaTech partagée, auto-tests, ordre de production par jalons |

---

## 15. Décisions à valider avant M0

1. **TypeScript + Vite** (recommandé) ou rester en JavaScript pur comme le simulateur réseau (typage via JSDoc) ?
2. **Serveur ITSM sur le schéma** : représenté comme un équipement (`SRV-ITSM`, recommandé : la joignabilité agent→serveur devient visible et pannable) ou implicite ?
3. **Granularité du temps** : remontée d'agent « toutes les 24 h simulées » avec boutons +1 h / +1 jour (recommandé), ou intervalles courts réels ?
4. **Langue** : interface et TP en français uniquement (recommandé pour le MVP), vocabulaire anglais en regard dans « Dans les outils réels ».
5. **Hébergement** : GitHub Pages du dépôt `YahnLP/InfraLab` (recommandé).
6. **Premier livrable de code** : M0 + M1 (Core + Infrastructure) ?

*Prochaine étape proposée : valider ces six points, puis initialiser le dépôt InfraLab (actuellement vide) avec M0.*
