import type { Level } from '../core';
import type { Hint, Scenario, Step } from './types';

const MIN = 60_000;
const DISCOVER: Step = { do: 'inventory.discover', args: { cidr: '192.168.10.0/24' } };
const T = (n: number) => `@tkt:INC-${String(n).padStart(4, '0')}`;
const newIncident = (title: string, description: string, user: string): Step => ({ do: 'itsm.createTicket', args: { title, description, requester: `@usr:${user}`, kind: 'incident' } });
const newRequest = (title: string, description: string, user: string): Step => ({ do: 'itsm.createTicket', args: { title, description, requester: `@usr:${user}`, kind: 'request' } });
const answer = (objective: string, choice: number): Step => ({ do: 'scenario.answer', args: { objective, choice } });
const comment = (ref: string, text: string): Step => ({ do: 'itsm.addComment', args: { id: ref, text } });
const PCS = ['PC21', 'PC22', 'PC23'];
const allOnline = { k: 'all' as const, of: PCS.map(n => ({ k: 'deviceOnline' as const, device: `@dev:${n}` })) };
/** Du ticket « nouveau » au ticket clos, avec solution : sert aux solutions rejouables des TP. */
function resolveSteps(ref: string, fields: { category: string; subcategory?: string; impact: Level; urgency: Level }, solution: string): Step[] {
  const to = (s: string): Step => ({ do: 'itsm.transitionTicket', args: { id: ref, to: s } });
  return [
    { do: 'itsm.updateTicket', args: { id: ref, fields: { ...fields, assignee: '@usr:David' } } },
    to('qualified'), to('assigned'), to('in_progress'),
    { do: 'itsm.updateTicket', args: { id: ref, fields: { solution } } }, to('resolved'), to('closed'),
  ];
}
const level = (n: number) => ['', 'Découverte', 'Inventaire', 'Service Desk', 'Incidents techniques', 'ITIL'][n] ?? '';
const NOREPLACE = [{ event: 'DeviceReplaced', message: 'Un équipement a été remplacé alors que la cause était ailleurs.' }, { event: 'DeviceRemoved', message: 'Un équipement a été supprimé du schéma.' }];

export const SCENARIOS: Scenario[] = [
  /* ============================ TP 6 ============================ */
  {
    id: 'tp-06-installer-agent', number: 6, title: 'Installer un agent', level: 2, levelLabel: level(2), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Exploiter et dépanner', kind: 'worked' }],
    context: 'NovaTech vient de scanner son réseau. L\'outil connaît désormais les postes, mais seulement par ce que le réseau lui a répondu. Le poste PC21 (Bruno Leroy) doit être inventorié de façon détaillée.',
    stages: [
      { id: 's1', title: 'Ce que l\'outil sait déjà', objectives: ['know'],
        lesson: ['Une **découverte réseau** interroge le réseau (ping, ARP, SNMP) : elle constate qu\'un équipement existe et récupère peu de chose.', '- Ce qu\'elle obtient : adresse IP, adresse MAC, nom, constructeur (déduit de la MAC).', '- Ce qu\'elle ne voit pas : système exact, mémoire, disques, logiciels installés, utilisateur connecté.', 'Pour ces informations détaillées il faut un **agent** installé sur le poste, ou un accès administratif. Observez la fiche de l\'actif PC21 dans la vue ITSM avant de répondre.'],
        debrief: ['Découvrir et inventorier sont deux niveaux de connaissance : l\'outil sait que PC21 existe, il ne sait pas encore ce qu\'il contient.'] },
      { id: 's2', title: 'Installer l\'agent et obtenir l\'inventaire', objectives: ['agent', 'inventory', 'source'],
        lesson: ['L\'agent est un petit programme qui s\'exécute sur le poste, lit la configuration réelle et la remonte au serveur à intervalle régulier. Il se pose sur l\'équipement lui-même (vue Infrastructure).', 'La première remontée est planifiée peu après l\'installation ; vous pouvez la forcer ou faire avancer le temps simulé.'],
        debrief: ['Les données « observées » viennent de l\'agent et ne se saisissent pas à la main : c\'est ce qui les rend fiables, tant que l\'agent tourne.'] },
    ],
    setup: [DISCOVER],
    objectives: [
      { id: 'know', label: 'Identifier ce que l\'outil sait de PC21 après la découverte seule', question: { prompt: 'Après la seule découverte réseau, que sait l\'outil de PC21 ?', choices: ['Sa configuration complète : logiciels, mémoire, disques', 'Son adresse IP, son adresse MAC et son nom, rien de plus détaillé', 'Rien : le poste n\'existe pas encore dans l\'outil', 'Son utilisateur et ses droits'], correct: 1, explain: 'La découverte constate l\'existence d\'un équipement. Le détail (matériel, système, logiciels) demande un agent.' } },
      { id: 'agent', label: 'PC21 est suivi par un agent opérationnel', check: { k: 'agentHealth', device: '@dev:PC21', is: 'ok' } },
      { id: 'inventory', label: 'L\'outil dispose d\'un inventaire détaillé de PC21', check: { k: 'assetInventoried', device: '@dev:PC21' }, requires: ['agent'] },
      { id: 'source', label: 'Identifier d\'où viennent ces nouvelles informations', requires: ['inventory'], question: { prompt: 'D\'où viennent les informations détaillées de la fiche PC21 ?', choices: ['Elles ont été saisies par un technicien', 'L\'agent les a lues sur le poste et remontées au serveur', 'Elles sont déduites de l\'adresse IP', 'Elles viennent de la découverte réseau'], correct: 1, explain: 'Une valeur « observée » est lue sur l\'équipement par l\'agent. Une valeur « déclarée » est saisie par un humain.' } },
    ],
    hints: [
      { for: 'agent', levels: ['Les agents se gèrent depuis la vue Infrastructure, sur l\'équipement lui-même.', 'Sélectionnez PC21 et cherchez la section « Agent ».'] },
      { for: 'inventory', levels: ['L\'agent n\'a pas encore parlé au serveur.', 'Forcez la remontée depuis l\'inspecteur, ou avancez l\'heure simulée.'] },
    ],
    solutionText: ['Répondre aux questions de compréhension.', 'Vue Infrastructure → PC21 → section Agent → « Installer l\'agent ».', 'Forcer l\'inventaire, puis ouvrir la fiche de l\'actif.'],
    solution: [answer('know', 1), { do: 'agent.install', args: { id: '@dev:PC21' } }, { do: 'agent.runInventory', args: { id: '@dev:PC21' } }, answer('source', 1)],
    realWorld: 'Dans GLPI, l\'agent est le « GLPI Agent » ; dans Microsoft Configuration Manager, le « client » ; Intune s\'appuie sur l\'inscription (enrollment) de l\'appareil.',
  },

  /* ============================ TP 8 ============================ */
  {
    id: 'tp-08-decouverte-reseau', number: 8, title: 'Découverte réseau', level: 2, levelLabel: level(2), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }],
    context: 'La base de gestion de NovaTech est vide alors que le réseau existe. Vous devez la peupler grâce à une découverte du sous-réseau 192.168.10.0/24, puis juger de sa complétude.',
    stages: [
      { id: 's1', title: 'Lancer une découverte', objectives: ['scan', 'printer'],
        lesson: ['La découverte se lance **depuis le serveur ITSM** : c\'est lui qui interroge une plage d\'adresses (notation CIDR : 192.168.10.0/24 = 254 adresses utilisables).', 'Seuls répondent les équipements **allumés**, **reliés** au serveur et dotés d\'une **adresse IP** dans la plage.'],
        debrief: ['Chaque équipement trouvé devient un actif « découvert » : l\'outil connaît son existence, pas son contenu.'] },
      { id: 's2', title: 'Ce que la découverte ne voit pas', objectives: ['why', 'switch'],
        lesson: ['Comparez la liste de l\'outil avec le schéma de l\'infrastructure : il manque des équipements.', 'Un équipement sans adresse IP ne répond à aucune requête réseau : il est invisible, même s\'il est allumé et câblé.'],
        debrief: ['Une base de gestion n\'est complète que si l\'on compare régulièrement ce qu\'elle contient avec la réalité : découverte et schéma se complètent.'] },
    ],
    setup: [],
    objectives: [
      { id: 'scan', label: 'L\'outil a lancé une découverte du sous-réseau', check: { k: 'event', type: 'NetworkDiscoveryCompleted' } },
      { id: 'printer', label: 'L\'imprimante IMP-COMPTA est connue de l\'outil', check: { k: 'assetExists', device: '@dev:IMP-COMPTA' }, requires: ['scan'] },
      { id: 'why', label: 'Expliquer pourquoi un équipement du schéma est absent de la liste', requires: ['scan'], question: { prompt: 'Les switches du schéma n\'apparaissent pas dans les résultats. Pourquoi ?', choices: ['Les switches ne peuvent jamais être découverts', 'Ils n\'ont pas d\'adresse IP : ils ne répondent pas à la découverte', 'Ils sont éteints', 'La plage scannée est trop petite'], correct: 1, explain: 'Un switch non administré, sans adresse IP, reste invisible. Avec une adresse de management, il peut être découvert.' } },
      { id: 'switch', label: 'Le switch SW02 est connu de l\'outil', check: { k: 'assetExists', device: '@dev:SW02' }, requires: ['why'] },
    ],
    hints: [
      { for: 'scan', levels: ['La découverte se lance depuis la vue ITSM.', 'Menu Inventaire → Découverte réseau, plage 192.168.10.0/24.'] },
      { for: 'switch', levels: ['Que faut-il à un équipement pour répondre à un scan ?', 'Donnez-lui une adresse IP (inspecteur), puis relancez le scan.'] },
    ],
    solutionText: ['Vue ITSM → Découverte réseau → scanner 192.168.10.0/24.', 'Constater que les switches manquent : sans IP, ils ne répondent pas.', 'Vue Infrastructure → SW02 → lui donner une IP du sous-réseau, puis relancer le scan.'],
    solution: [DISCOVER, answer('why', 1), { do: 'infra.setIp', args: { id: '@dev:SW02', ip: '192.168.10.2', mask: 24 } }, DISCOVER],
    realWorld: 'Les outils de découverte (ICMP, ARP, SNMP) ne voient que les équipements qui répondent. Un switch administrable est découvert par SNMP s\'il a une adresse de management.',
  },

  /* ============================ TP 10 ============================ */
  {
    id: 'tp-10-agent-en-erreur', number: 10, title: 'Agent en erreur', level: 2, levelLabel: level(2), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Le tableau de bord de NovaTech signale des agents qui ne remontent plus correctement sur trois postes. Chaque panne a une cause différente : à vous de les distinguer.',
    stages: [
      { id: 's1', title: 'Lire l\'état d\'un agent', objectives: ['diag'],
        lesson: ['L\'état d\'un agent se lit dans l\'inspecteur du poste (section Agent) et dans Inventaire → Agents. Il dépend de plusieurs choses :', '- l\'agent tourne-t-il (démarré / arrêté) ?', '- joint-il le serveur à l\'adresse attendue ?', '- sa version est-elle la version courante ?', 'Le journal de l\'agent indique ce qu\'il a tenté et pourquoi il a échoué.'],
        debrief: ['Un même symptôme (« l\'inventaire n\'est plus à jour ») recouvre des causes très différentes : il faut lire l\'état avant d\'agir.'] },
      { id: 's2', title: 'Remettre les trois agents en service', objectives: ['pc21', 'pc22', 'pc23'],
        lesson: ['Corrigez chaque poste selon sa cause réelle. Agir à l\'aveugle (par exemple réinstaller partout) masque le problème sans le comprendre et supprime l\'historique.'],
        debrief: ['Chaque cause a sa remédiation : configuration, démarrage, mise à jour. C\'est le journal de l\'agent qui permet de choisir.'] },
    ],
    setup: [
      { do: 'agent.install', args: { id: '@dev:PC21' } }, { do: 'agent.install', args: { id: '@dev:PC22' } }, { do: 'agent.install', args: { id: '@dev:PC23' } },
      { advance: 10 * MIN },
      { do: 'agent.configure', args: { id: '@dev:PC21', serverUrl: 'http://srv-inventaire/inventory' } },
      { do: 'agent.stop', args: { id: '@dev:PC22' } },
      { do: 'agent.configure', args: { id: '@dev:PC23', version: '2.1' } },
    ],
    objectives: [
      { id: 'diag', label: 'Distinguer les causes possibles d\'un agent défaillant', question: { prompt: 'Quelle situation laisse l\'inventaire se périmer SANS qu\'aucune erreur ne soit levée côté serveur ?', choices: ['L\'agent est mal configuré et contacte une mauvaise adresse', 'L\'agent est arrêté : il ne tente plus aucune remontée', 'La version de l\'agent est trop ancienne', 'Le serveur est éteint'], correct: 1, explain: 'Un agent arrêté ne contacte plus personne : aucune erreur, aucune alerte, l\'inventaire vieillit en silence. D\'où l\'intérêt des rapports « dernier contact ».' } },
      { id: 'pc21', label: 'L\'agent de PC21 remonte de nouveau son inventaire', check: { k: 'agentHealth', device: '@dev:PC21', is: 'ok' } },
      { id: 'pc22', label: 'L\'agent de PC22 remonte de nouveau son inventaire', check: { k: 'agentHealth', device: '@dev:PC22', is: 'ok' } },
      { id: 'pc23', label: 'L\'agent de PC23 remonte de nouveau son inventaire', check: { k: 'agentHealth', device: '@dev:PC23', is: 'ok' } },
    ],
    hints: [
      { for: 'pc21', levels: ['Ouvrez PC21 : le journal de l\'agent dit à quelle adresse il essaie de parler.', 'Comparez avec l\'adresse du serveur : http://<nom du serveur>/inventory.'] },
      { for: 'pc22', levels: ['Regardez l\'état affiché dans la section Agent.'] },
      { for: 'pc23', levels: ['Comparez la version de l\'agent à la version courante.'] },
    ],
    solutionText: ['PC21 : l\'URL du serveur est fausse → la corriger (http://srv-itsm/inventory).', 'PC22 : l\'agent est arrêté → le démarrer.', 'PC23 : l\'agent est obsolète → le mettre à jour.'],
    solution: [answer('diag', 1), { do: 'agent.configure', args: { id: '@dev:PC21', serverUrl: 'http://srv-itsm/inventory' } }, { do: 'agent.start', args: { id: '@dev:PC22' } }, { do: 'agent.update', args: { id: '@dev:PC23' } }],
    realWorld: 'Un agent mal configuré, arrêté ou obsolète laisse l\'inventaire se périmer sans alerte : les outils proposent des rapports « dernier contact » pour les repérer.',
  },

  /* ============================ TP 14 ============================ */
  {
    id: 'tp-14-priorite', number: 14, title: 'Priorité : impact et urgence', level: 3, levelLabel: level(3), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'Deux utilisateurs ont signalé au service desk, par téléphone, une imprimante en panne. Les tickets ont été saisis tels que dictés, sans qualification. Ils se ressemblent, pourtant ils ne se traitent pas dans le même ordre.',
    stages: [
      { id: 's1', title: 'Impact, urgence, priorité', objectives: ['p1', 'p4'],
        lesson: ['La priorité n\'est jamais choisie « au feeling » : elle se **calcule** à partir de deux notions.', '- **Impact** : combien de personnes ou de services sont touchés ?', '- **Urgence** : quel délai le problème tolère-t-il ?', 'Une matrice donne P1 (critique) à P4 (basse). Lisez la description de chaque ticket : tout est dedans.'],
        debrief: ['Deux incidents de même nature (imprimante en panne) n\'ont pas la même priorité si l\'impact et l\'urgence diffèrent.'] },
      { id: 's2', title: 'Traiter dans le bon ordre', objectives: ['why', 'link', 'assign'],
        lesson: ['Le technicien prend le ticket le plus prioritaire en premier, pas le plus ancien. Avant de l\'attribuer, rattachez-le à l\'équipement concerné : sans lien, on ne sait pas de quoi on parle.'],
        debrief: ['Qualifier, lier, attribuer : trois gestes qui rendent un ticket exploitable par quelqu\'un d\'autre que celui qui l\'a saisi.'] },
    ],
    setup: [
      DISCOVER,
      newIncident('Imprimante de la comptabilité en panne', 'Appel d\'Alice à 8 h 55. IMP-COMPTA est en panne. Clôture mensuelle aujourd\'hui : les 8 personnes du service ne peuvent pas éditer les factures avant 17 h.', 'Alice'),
      newIncident('Mon imprimante ne marche plus', 'Appel de Chloé à 9 h 10. L\'imprimante de mon bureau ne répond plus. Rien de pressé, j\'utilise celle du couloir en attendant.', 'Chloé'),
    ],
    objectives: [
      { id: 'p1', label: 'INC-0001 est qualifié (catégorie Matériel) avec la priorité que justifie sa description', check: { k: 'ticket', ref: T(1), category: 'Matériel', priority: 1 } },
      { id: 'p4', label: 'INC-0002 est qualifié (catégorie Matériel) avec la priorité que justifie sa description', check: { k: 'ticket', ref: T(2), category: 'Matériel', priority: 4 } },
      { id: 'why', label: 'Justifier l\'ordre de traitement', requires: ['p1', 'p4'], question: { prompt: 'Pourquoi INC-0001 passe-t-il avant INC-0002, alors qu\'il est arrivé en premier ET qu\'il porte sur le même type de panne ?', choices: ['Parce qu\'Alice est plus importante que Chloé', 'Parce que son impact (tout un service) et son urgence (échéance aujourd\'hui) sont plus élevés', 'Parce qu\'il a été créé avant', 'Parce que l\'imprimante de la compta coûte plus cher'], correct: 1, explain: 'La priorité se déduit de l\'impact et de l\'urgence, pas de la personne ni de l\'ordre d\'arrivée.' } },
      { id: 'link', label: 'INC-0001 désigne l\'équipement concerné', check: { k: 'ticket', ref: T(1), linkedDevice: '@dev:IMP-COMPTA' } },
      { id: 'assign', label: 'INC-0001 est attribué à un technicien', check: { k: 'ticket', ref: T(1), assignee: '@usr:David', status: 'assigned' }, requires: ['why'] },
    ],
    hints: [
      { for: 'p1', levels: ['Combien de personnes sont bloquées, et pour quand ?', 'Impact élevé et urgence élevée donnent la priorité la plus haute.'] },
      { for: 'p4', levels: ['Une seule personne, avec un contournement et aucune échéance.'] },
    ],
    solutionText: ['INC-0001 : Matériel, impact élevé (8 personnes), urgence élevée (échéance) → P1.', 'INC-0002 : Matériel, impact faible, urgence faible → P4.', 'Lier INC-0001 à IMP-COMPTA, le qualifier, l\'attribuer à David.'],
    solution: [
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.updateTicket', args: { id: T(2), fields: { category: 'Matériel', impact: 'low', urgency: 'low' } } },
      answer('why', 1),
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:IMP-COMPTA' } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } },
    ],
    realWorld: 'La priorité n\'est jamais saisie à la main dans un outil ITIL : elle se déduit de l\'impact et de l\'urgence, pour que deux techniciens arrivent à la même conclusion.',
  },

  /* ============================ TP 16 ============================ */
  {
    id: 'tp-16-pc-deconnecte', number: 16, title: 'PC déconnecté', level: 4, levelLabel: level(4), difficulty: 2, duration: '50 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Alice Martin (Comptabilité) n\'a plus accès au réseau. Son poste n\'étant plus en ligne, elle n\'a pas pu ouvrir de ticket sur le portail : elle a appelé le service desk, qui a saisi le ticket INC-0001 à partir de l\'appel, sans le qualifier. Son poste PC-COMPTA-01 était inventorié par un agent.',
    stages: [
      { id: 's1', title: 'Prendre le ticket en charge', objectives: ['how', 'classify', 'link'],
        lesson: ['Un ticket peut arriver par plusieurs **canaux** : portail, courriel, téléphone, passage au bureau. Quand le poste est coupé du réseau, le portail est inaccessible : le téléphone reste le recours, et c\'est l\'agent d\'accueil qui saisit.', 'Un ticket exploitable contient : qui demande, ce qu\'il observe, depuis quand, **quel équipement est concerné**, et une **qualification** (catégorie, impact, urgence).', 'Ici, la saisie à partir d\'un appel est brute : à vous de la compléter.'],
        debrief: ['Un ticket bien renseigné permet à quelqu\'un d\'autre de reprendre le dossier sans rappeler l\'utilisateur.'] },
      { id: 's2', title: 'Diagnostiquer dans l\'infrastructure', objectives: ['diag'],
        lesson: ['L\'outil de gestion ne voit pas la réalité : il en connaît seulement ce que l\'agent ou le réseau lui rapportent. « Hors ligne » veut dire **non joignable par le serveur ITSM**, pas forcément éteint.', 'La vue Infrastructure montre la réalité : sélectionnez le poste, l\'inspecteur explique pourquoi il n\'est pas joignable.'],
        debrief: ['Comparer ce que dit l\'outil et ce que montre la réalité est le geste central du dépannage.'] },
      { id: 's3', title: 'Corriger et vérifier', objectives: ['fix', 'agent'],
        lesson: ['Corriger ne suffit pas : on vérifie que l\'**outil** revoit le poste. L\'agent reprend contact de lui-même une fois le chemin réseau rétabli.'],
        debrief: ['Un incident n\'est résolu que lorsque le service est constaté rétabli, côté réalité et côté outil.'] },
      { id: 's4', title: 'Documenter, vérifier avec l\'utilisateur, clore', objectives: ['doc', 'verify', 'close'],
        lesson: ['Une bonne solution se rédige en quatre éléments : **symptôme constaté**, **cause**, **action réalisée**, **vérification**.', 'Avant de clore, on recontacte l\'utilisateur : la trace de cet échange figure en commentaire du ticket.'],
        debrief: ['Cette solution documentée est la matière première d\'un article de base de connaissances (TP 25).'] },
    ],
    setup: [
      { do: 'agent.install', args: { id: '@dev:PC-COMPTA-01' } }, { advance: 10 * MIN }, DISCOVER,
      { do: 'infra.disconnect', args: { link: '@lnk:PC-COMPTA-01' } },
      newIncident('Plus d\'accès au réseau', 'Appel d\'Alice à 9 h 02 : elle n\'a plus accès à Internet ni à ses dossiers partagés. Écran allumé, tout le reste a l\'air normal.', 'Alice'),
    ],
    objectives: [
      { id: 'how', label: 'Comprendre comment le ticket est arrivé', question: { prompt: 'Le poste d\'Alice est coupé du réseau. Comment son ticket a-t-il pu être ouvert ?', choices: ['Le poste a ouvert le ticket automatiquement', 'Alice a appelé le service desk, qui a saisi le ticket pour elle', 'Un agent d\'inventaire l\'a créé', 'Le serveur ITSM l\'a généré'], correct: 1, explain: 'Sans réseau, le portail est inaccessible : les utilisateurs recourent au téléphone ou à un collègue, et le service desk saisit.' } },
      { id: 'classify', label: 'Le ticket est qualifié : catégorie, sous-catégorie, impact et urgence', check: { k: 'ticket', ref: T(1), category: 'Réseau', subcategory: 'Poste sans réseau', qualified: true } },
      { id: 'link', label: 'Le ticket désigne l\'équipement concerné', check: { k: 'ticket', ref: T(1), linkedDevice: '@dev:PC-COMPTA-01' } },
      { id: 'diag', label: 'Établir pourquoi l\'outil ne joint plus le poste', requires: ['link'], question: { prompt: 'L\'outil affiche PC-COMPTA-01 injoignable alors que le poste est allumé. Quelle est l\'explication la plus précise ?', choices: ['L\'agent a été désinstallé', 'Le poste n\'a plus de lien réseau actif : le serveur ne peut plus le joindre', 'Le serveur ITSM est éteint', 'Le poste a été supprimé de la base'], correct: 1, explain: 'L\'inspecteur du poste donne la raison : aucun lien actif. Un poste allumé mais non relié reste invisible pour l\'outil.' } },
      { id: 'fix', label: 'PC-COMPTA-01 est de nouveau joignable', check: { k: 'deviceOnline', device: '@dev:PC-COMPTA-01' }, requires: ['diag'] },
      { id: 'agent', label: 'L\'outil voit de nouveau le poste via son agent', check: { k: 'agentHealth', device: '@dev:PC-COMPTA-01', is: 'ok' }, requires: ['fix'] },
      { id: 'doc', label: 'La solution est documentée (symptôme, cause, action, vérification)', check: { k: 'ticket', ref: T(1), solutionMin: 60 } },
      { id: 'verify', label: 'Une trace de la vérification auprès d\'Alice figure dans le ticket', check: { k: 'ticket', ref: T(1), minComments: 1 }, requires: ['fix'] },
      { id: 'close', label: 'Le ticket est clos', check: { k: 'ticket', ref: T(1), status: 'closed' }, requires: ['fix', 'doc', 'verify'] },
    ],
    hints: [
      { for: 'fix', levels: ['Que dit l\'inspecteur du poste sur son réseau ?', 'Le lien physique est absent : examinez la liste des ports du poste.'] },
      { for: 'link', levels: ['Dans la fiche du ticket : « Lier un actif… ».'] },
      { for: 'agent', levels: ['L\'agent n\'est pas en panne : il ne pouvait plus joindre le serveur. Consultez son état.'] },
      { for: 'doc', levels: ['Quatre éléments : symptôme, cause, action, vérification. Une ou deux phrases chacun.'] },
    ],
    forbid: NOREPLACE,
    solutionText: ['Qualifier : Réseau / Poste sans réseau, impact faible, urgence moyenne. Lier à PC-COMPTA-01.', 'Le poste n\'a plus de lien actif : rebrancher eth0 sur SW-SIEGE-01 (port 3).', 'Constater que l\'agent redevient joignable, rédiger la solution, commenter la vérification, résoudre puis clore.'],
    solution: [
      answer('how', 1), answer('diag', 1),
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:PC-COMPTA-01' } },
      { do: 'infra.connect', args: { aDevice: '@dev:PC-COMPTA-01', aPort: 'eth0', bDevice: '@dev:SW-SIEGE-01', bPort: 'port3' } },
      comment(T(1), 'Alice rappelée : accès au réseau et aux dossiers partagés de nouveau OK.'),
      ...resolveSteps(T(1), { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'low', urgency: 'medium' }, 'Symptôme : plus de réseau. Cause : câble débranché. Action : rebranché sur le port 3 de SW-SIEGE-01. Vérification : agent joignable, accès OK.'),
    ],
    realWorld: 'GLPI : Assistance → Tickets, avec « éléments associés » ; ServiceNow : Incident avec « Configuration item ». Le lien ticket ↔ actif donne l\'historique d\'un poste.',
  },

  /* ============================ TP 18 ============================ */
  {
    id: 'tp-18-switch-en-panne', number: 18, title: 'Switch en panne', level: 4, levelLabel: level(4), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }],
    context: 'Trois postes du bâtiment passent hors ligne au même moment. Avant d\'intervenir sur chacun, cherchez ce qui les relie.',
    stages: [
      { id: 's1', title: 'Chercher la cause commune', objectives: ['common'],
        lesson: ['Quand plusieurs équipements tombent **en même temps**, la cause est rarement chez chacun : elle est le plus souvent **en amont**, sur un élément qu\'ils partagent.', 'Le journal des événements et sa fonction « Pourquoi ? » remontent la chaîne de causes : cliquez un événement « hors ligne » et lisez la chaîne.'],
        debrief: ['On remonte du symptôme à la cause avant d\'agir : c\'est la corrélation d\'événements.'] },
      { id: 's2', title: 'Rétablir et constater l\'effet', objectives: ['cause', 'effect'],
        lesson: ['Agir sur la cause rétablit tout ce qui en dépendait. Constatez-le dans la vue Infrastructure et dans le journal.'],
        debrief: ['Une seule action sur la bonne cause remplace trois interventions : c\'est l\'intérêt de comprendre avant d\'agir.'] },
    ],
    setup: [{ do: 'infra.powerOff', args: { id: '@dev:SW02' } }],
    objectives: [
      { id: 'common', label: 'Identifier l\'équipement qui relie les trois postes touchés', question: { prompt: 'Quel équipement est à l\'origine des trois pannes ?', choices: ['SRV-ITSM', 'FW-SIEGE', 'SW02', 'SW-SIEGE-01'], correct: 2, explain: 'Les trois postes sont reliés à SW02 ; SW02 éteint les coupe tous du serveur. Le journal « Pourquoi ? » le montre.' } },
      { id: 'cause', label: 'La cause est traitée', check: { k: 'devicePowered', device: '@dev:SW02' }, requires: ['common'] },
      { id: 'effect', label: 'Les trois postes sont de nouveau joignables', check: { k: 'all', of: ['PC21', 'PC22', 'PC23'].map(n => ({ k: 'deviceOnline' as const, device: `@dev:${n}` })) }, requires: ['cause'] },
    ],
    hints: [{ for: 'common', levels: ['Cliquez sur un événement « hors ligne » du journal, puis lisez « Pourquoi ? ».', 'Regardez à quoi les trois postes sont branchés.'] }],
    forbid: NOREPLACE,
    solutionText: ['Les trois événements « hors ligne » remontent au même événement racine : SW02 éteint.', 'Rallumer SW02 : les trois postes repassent en ligne.'],
    solution: [answer('common', 2), { do: 'infra.powerOn', args: { id: '@dev:SW02' } }],
    realWorld: 'Une alerte « injoignable » sur plusieurs équipements d\'un même segment pointe presque toujours vers un équipement amont : c\'est la corrélation d\'événements.',
  },

  /* ============================ TP 19 ============================ */
  {
    id: 'tp-19-plusieurs-utilisateurs', number: 19, title: 'Plusieurs utilisateurs impactés', level: 4, levelLabel: level(4), difficulty: 3, duration: '60 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Ce matin, trois utilisateurs n\'ont plus accès au réseau. Leurs postes étant coupés, aucun n\'a pu ouvrir de ticket lui-même : ils ont appelé le service desk, qui a saisi trois tickets à partir des appels, sans les qualifier. Dans la même file attend aussi une demande sans rapport (REQ-0001).',
    stages: [
      { id: 's1', title: 'Prendre les appels en compte', objectives: ['how', 'links'],
        lesson: ['Un ticket se crée par plusieurs **canaux** : portail, courriel, téléphone, passage au bureau. Quand le poste est coupé, le portail est inaccessible : le téléphone prend le relais, et le service desk saisit pour l\'utilisateur.', 'La saisie brute est incomplète. Pour qu\'un ticket soit exploitable, il désigne **l\'équipement concerné** : c\'est ce qui relie le ticket à l\'inventaire et à l\'infrastructure.'],
        debrief: ['Un ticket relié à son actif donne accès à l\'historique de l\'équipement et à sa situation réelle dans l\'infrastructure.'] },
      { id: 's2', title: 'Qualifier et trier', objectives: ['qual', 'triage', 'tri_q'],
        lesson: ['Qualifier, c\'est classer : **catégorie**, **sous-catégorie**, **impact**, **urgence**. De là découlent la priorité, le circuit de traitement et le SLA.', 'Tous les tickets ne sont pas des **incidents** (quelque chose qui fonctionnait ne fonctionne plus). Une **demande de service** (obtenir un équipement, un accès) suit un circuit différent, sans urgence de rétablissement.'],
        debrief: ['Trier incidents et demandes évite de traiter en urgence ce qui n\'est pas une panne, et inversement.'] },
      { id: 's3', title: 'Diagnostiquer et rétablir', objectives: ['online', 'agents', 'cause'],
        lesson: ['Trois tickets ne signifient pas trois pannes. Avant d\'intervenir poste par poste, **corrélez** : qu\'ont en commun les équipements concernés ? Le schéma de l\'infrastructure et le journal « Pourquoi ? » vous répondent.', 'Une fois la cause traitée, **vérifiez des deux côtés** : les postes sont-ils joignables, et l\'outil les revoit-il (agents) ?'],
        debrief: ['Traiter la cause commune une fois, plutôt que trois symptômes : c\'est le début de la gestion des problèmes (TP 23).'] },
      { id: 's4', title: 'Résoudre, vérifier avec l\'utilisateur, clore', objectives: ['docs', 'verify', 'closed'],
        lesson: ['Chaque ticket garde sa propre résolution, même si la cause est commune : documentez symptôme, cause, action, vérification.', 'Avant la clôture, on **recontacte chaque utilisateur** pour confirmer que son service est rétabli : la trace figure en commentaire.'],
        debrief: ['Trois tickets clos, une cause traitée, toutes les traces conservées : c\'est ce qui rend l\'incident rejouable et auditable.'] },
    ],
    setup: [
      { do: 'agent.install', args: { id: '@dev:PC21' } }, { do: 'agent.install', args: { id: '@dev:PC22' } }, { do: 'agent.install', args: { id: '@dev:PC23' } }, { advance: 10 * MIN },
      DISCOVER,
      { do: 'infra.powerOff', args: { id: '@dev:SW02' } },
      newIncident('Plus de réseau sur mon poste', 'Appel de Bruno à 9 h 05 : plus aucun accès réseau depuis son arrivée.', 'Bruno'),
      newIncident('Internet ne marche plus', 'Appel de Chloé à 9 h 07 : impossible d\'ouvrir ses applications en ligne.', 'Chloé'),
      newIncident('Mon PC est coupé du réseau', 'Appel de David à 9 h 12 : il ne voit plus les dossiers partagés.', 'David'),
      newRequest('Demande d\'un second écran', 'Courriel d\'Alice à 9 h 15 : elle souhaiterait un second écran pour son poste de comptabilité.', 'Alice'),
    ],
    objectives: [
      { id: 'how', label: 'Comprendre comment les tickets sont arrivés', question: { prompt: 'Les postes sont coupés du réseau. Comment ces tickets ont-ils pu être ouverts ?', choices: ['Chaque poste a ouvert son ticket automatiquement', 'Les utilisateurs ont appelé le service desk, qui a saisi les tickets à leur place', 'L\'agent d\'inventaire les a générés', 'Les tickets existaient déjà'], correct: 1, explain: 'Sans réseau, le portail est inaccessible. Le téléphone (ou un collègue) reste le canal de secours, et le service desk saisit.' } },
      { id: 'links', label: 'Chaque ticket désigne le poste de son demandeur', check: { k: 'all', of: [[1, 'PC21'], [2, 'PC22'], [3, 'PC23']].map(([n, d]) => ({ k: 'ticket' as const, ref: T(n as number), linkedDevice: `@dev:${d}` })) } },
      { id: 'qual', label: 'Les trois incidents sont qualifiés (catégorie, sous-catégorie, impact, urgence)', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), category: 'Réseau', subcategory: 'Poste sans réseau', qualified: true })) } },
      { id: 'triage', label: 'La demande REQ-0001 est classée comme une demande de service', check: { k: 'ticket', ref: '@tkt:REQ-0001', kind: 'request', category: 'Demande de service', qualified: true } },
      { id: 'tri_q', label: 'Justifier ce tri', requires: ['triage'], question: { prompt: 'Pourquoi la demande de second écran ne se traite-t-elle pas comme les trois incidents ?', choices: ['Parce qu\'elle vient d\'une autre personne', 'Parce qu\'il n\'y a pas de dysfonctionnement : c\'est une demande de service, avec son propre circuit', 'Parce qu\'elle est moins importante', 'Parce qu\'elle est arrivée par courriel'], correct: 1, explain: 'Un incident est une interruption ou dégradation d\'un service ; une demande est un besoin de service. Les circuits, délais et validations diffèrent.' } },
      { id: 'online', label: 'Les trois postes sont de nouveau joignables', check: allOnline },
      { id: 'agents', label: 'L\'outil voit de nouveau les trois postes via leurs agents', check: { k: 'all', of: PCS.map(n => ({ k: 'agentHealth' as const, device: `@dev:${n}`, is: 'ok' as const })) }, requires: ['online'] },
      { id: 'cause', label: 'Identifier la cause des trois tickets', requires: ['online'], question: { prompt: 'Quelle est la cause de ces trois tickets ?', choices: ['Trois postes sont tombés en panne en même temps', 'Un équipement commun en amont a cessé de fonctionner et a coupé les trois postes', 'Le serveur ITSM est arrêté', 'Les agents sont mal configurés'], correct: 1, explain: 'Les trois postes dépendent du même équipement réseau. Un seul élément défaillant a produit trois symptômes.' } },
      { id: 'docs', label: 'Chaque incident a sa solution documentée', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), solutionMin: 60 })) } },
      { id: 'verify', label: 'Une trace de la vérification auprès de chaque utilisateur figure dans son ticket', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), minComments: 1 })) }, requires: ['online'] },
      { id: 'closed', label: 'Les trois incidents sont clos', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), status: 'closed' as const })) }, requires: ['online', 'docs', 'verify'] },
    ],
    hints: [
      { for: 'links', levels: ['Chaque ticket doit désigner l\'équipement concerné : fiche du ticket, « Lier un actif… ».'] },
      { for: 'qual', levels: ['Catégorie Réseau, sous-catégorie « Poste sans réseau » ; impact et urgence selon le nombre de personnes et l\'échéance.'] },
      { for: 'online', levels: ['Trois tickets, mais combien de pannes ?', 'Ouvrez le journal, cliquez un événement « hors ligne » de l\'un des postes, puis « Pourquoi ? ».', 'Regardez ce que les trois postes ont en commun sur le schéma.'] },
      { for: 'docs', levels: ['Symptôme, cause, action, vérification : une ou deux phrases chacun, pour chacun des tickets.'] },
    ],
    forbid: NOREPLACE,
    solutionText: ['Lier chaque ticket au poste, qualifier (Réseau / Poste sans réseau), classer REQ-0001 en demande de service.', 'Les trois postes dépendent de SW02, éteint : une seule cause. Le rallumer.', 'Commenter la vérification auprès de chaque utilisateur, documenter, résoudre, clore.'],
    solution: [
      answer('how', 1), answer('tri_q', 1), answer('cause', 1),
      ...[[1, 'PC21'], [2, 'PC22'], [3, 'PC23']].map(([n, d]): Step => ({ do: 'itsm.linkAsset', args: { id: T(n as number), asset: `@ast:${d}` } })),
      { do: 'itsm.updateTicket', args: { id: '@tkt:REQ-0001', fields: { category: 'Demande de service', impact: 'low', urgency: 'low' } } },
      { do: 'infra.powerOn', args: { id: '@dev:SW02' } },
      ...[1, 2, 3].flatMap((n): Step[] => [
        comment(T(n), 'Utilisateur rappelé : accès réseau de nouveau OK.'),
        ...resolveSteps(T(n), { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'medium', urgency: 'medium' }, 'Symptôme : plus de réseau. Cause commune : switch SW02 éteint. Action : SW02 remis sous tension. Vérification : poste en ligne, agent joignable.'),
      ]),
    ],
    realWorld: 'Corréler plusieurs tickets vers une même cause est le point de départ de la gestion des problèmes (ITIL) : on traite la cause une fois, on documente chaque incident. Le tri incident / demande se fait à l\'enregistrement.',
  },

  /* ============================ TP 22 ============================ */
  {
    id: 'tp-22-sla', number: 22, title: 'SLA : tenir les délais', level: 5, levelLabel: level(5), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Deux tickets, saisis par le service desk à partir d\'appels, attendent depuis 10 minutes (temps simulé). Le premier bloque toute la comptabilité ; le second est mineur.',
    stages: [
      { id: 's1', title: 'Qualifier pour déclencher le bon SLA', objectives: ['p1', 'p4', 'clock'],
        lesson: ['Un **SLA** (accord de niveau de service) fixe deux délais selon la priorité : prendre en charge, puis résoudre. Pour un P1 : 15 minutes de réactivité, 4 heures de résolution.', 'Le SLA **court depuis la création du ticket**, pas depuis que vous le lisez. Tant que le ticket n\'est pas qualifié, aucune cible n\'est connue : qualifier vite, c\'est aussi protéger le délai.'],
        debrief: ['La qualification fixe la cible ; le temps écoulé depuis la création décide s\'il reste de la marge.'] },
      { id: 's2', title: 'Tenir les délais, suspendre l\'horloge', objectives: ['respond', 'hold', 'resolve'],
        lesson: ['La **prise en charge** arrête l\'horloge de réactivité. La **résolution** arrête celle de résolution.', 'Un ticket « **en attente** » de l\'utilisateur (réponse, validation) **suspend** l\'horloge : l\'équipe n\'est pas pénalisée par un délai dont elle n\'est pas responsable.'],
        debrief: ['Un SLA se pilote : qualifier vite, prendre en charge à temps, suspendre à bon escient, résoudre avant l\'échéance.'] },
    ],
    setup: [
      DISCOVER,
      newIncident('Plus aucun accès aux applications métier', 'Appel d\'Alice : toute la comptabilité est bloquée, la clôture de paie est ce soir.', 'Alice'),
      newIncident('Souris à remplacer', 'Appel de Chloé : sa souris double-clique parfois. Pas urgent.', 'Chloé'),
      { advance: 10 * MIN },
    ],
    objectives: [
      { id: 'p1', label: 'INC-0001 est qualifié avec la priorité que justifie sa description', check: { k: 'ticket', ref: T(1), priority: 1, qualified: true } },
      { id: 'p4', label: 'INC-0002 est qualifié avec la priorité que justifie sa description', check: { k: 'ticket', ref: T(2), priority: 4, qualified: true } },
      { id: 'clock', label: 'Comprendre ce qui démarre le décompte du SLA', requires: ['p1'], question: { prompt: 'À partir de quand court le délai de prise en charge d\'INC-0001 ?', choices: ['À la qualification du ticket', 'À la création du ticket, donc 10 minutes déjà écoulées', 'À l\'attribution au technicien', 'À la première réponse de l\'utilisateur'], correct: 1, explain: 'Le SLA court depuis la création. Les 10 minutes d\'attente comptent déjà : il reste 5 minutes sur les 15 d\'un P1.' } },
      { id: 'respond', label: 'INC-0001 est pris en charge dans le délai de réactivité', check: { k: 'sla', ticket: T(1), respond: 'met' }, requires: ['clock'] },
      { id: 'hold', label: 'L\'horloge de INC-0002 est suspendue (attente de l\'utilisateur)', check: { k: 'sla', ticket: T(2), resolve: 'paused' }, requires: ['p4'] },
      { id: 'resolve', label: 'INC-0001 est résolu dans le délai, solution documentée', check: { k: 'all', of: [{ k: 'sla', ticket: T(1), resolve: 'met' }, { k: 'ticket', ref: T(1), solutionMin: 30 }] }, requires: ['respond'] },
    ],
    hints: [
      { for: 'respond', levels: ['Qualifiez, attribuez, puis prenez en charge : c\'est la prise en charge qui valide la réactivité.'] },
      { for: 'hold', levels: ['Il faut d\'abord prendre en charge le ticket, puis le mettre en attente.'] },
    ],
    solutionText: ['INC-0001 : impact élevé, urgence élevée → P1 ; attribuer à David, prendre en charge tout de suite.', 'INC-0002 : P4 ; prendre en charge puis mettre en attente.', 'Documenter INC-0001 et le résoudre avant l\'échéance.'],
    solution: [
      answer('clock', 1),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Réseau', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } },
      { do: 'itsm.updateTicket', args: { id: T(2), fields: { category: 'Matériel', impact: 'low', urgency: 'low', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(2), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(2), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(2), to: 'in_progress' } }, { do: 'itsm.transitionTicket', args: { id: T(2), to: 'pending' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Cause identifiée et corrigée, accès rétablis.' } } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' } },
    ],
    realWorld: 'Un SLA est un engagement mesuré : délai de prise en charge et délai de résolution selon la priorité. Les statuts « en attente » suspendent l\'horloge ; les outils (ServiceNow, GLPI) affichent le temps restant et alertent avant le dépassement.',
  },

  /* ============================ TP 23 ============================ */
  {
    id: 'tp-23-probleme', number: 23, title: 'Problem Management', level: 5, levelLabel: level(5), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Trois incidents « plus de réseau » ont été clos cette semaine. À chaque fois, le service a été rétabli, mais la panne revient.',
    stages: [
      { id: 's1', title: 'Constater la récurrence, ouvrir un problème', objectives: ['which', 'group'],
        lesson: ['**Incident** : rétablir le service au plus vite. **Problème** : trouver et supprimer la cause. Rétablir sans chercher la cause, c\'est s\'exposer à recommencer.', 'Un problème naît de la **récurrence** ou de la **gravité** d\'incidents. On y **rattache** les incidents concernés pour en mesurer l\'étendue.'],
        debrief: ['Le problème regroupe les symptômes : il porte l\'enquête, alors que chaque incident garde son historique.'] },
      { id: 's2', title: 'Analyser : cause racine et contournement', objectives: ['known'],
        lesson: ['L\'**analyse** vise la **cause racine**. En attendant la correction, on documente un **contournement** : une façon de rétablir vite le service sans supprimer la cause.', 'Un problème dont la cause racine et le contournement sont connus devient une **erreur connue** : les techniciens peuvent la traiter immédiatement.'],
        debrief: ['L\'erreur connue transforme une enquête en procédure : le contournement sert aux prochains incidents.'] },
      { id: 's3', title: 'Corriger définitivement', objectives: ['fix'],
        lesson: ['La **correction définitive** supprime la cause. Elle passe presque toujours par un **changement** (TP 24), car elle modifie l\'infrastructure.'],
        debrief: ['Le cycle se boucle : incident → problème → erreur connue → changement → problème résolu.'] },
    ],
    setup: [
      { do: 'infra.powerOff', args: { id: '@dev:SW02' } },
      newIncident('Plus de réseau sur mon poste', 'Appel de Bruno : plus rien ne fonctionne.', 'Bruno'), newIncident('Internet coupé', 'Appel de Chloé : plus d\'accès Internet.', 'Chloé'), newIncident('Dossiers partagés inaccessibles', 'Appel de David : plus de dossiers partagés.', 'David'),
      { do: 'infra.powerOn', args: { id: '@dev:SW02' } },
      ...[1, 2, 3].flatMap(n => resolveSteps(T(n), { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'medium', urgency: 'medium' }, 'Switch SW02 rallumé : service rétabli.')),
    ],
    objectives: [
      { id: 'which', label: 'Choisir le bon objet de gestion pour traiter cette récurrence', question: { prompt: 'Trois incidents ont la même cause apparente et reviennent chaque semaine. Que faut-il ouvrir ?', choices: ['Un quatrième incident', 'Un problème, auquel rattacher les trois incidents', 'Un changement immédiat', 'Un article de base de connaissances seul'], correct: 1, explain: 'Un problème cherche la cause ; on y rattache les incidents. Le changement viendra ensuite, pour la correction.' } },
      { id: 'group', label: 'Le problème PRB-0001 regroupe les trois incidents', check: { k: 'problem', ref: '@prb:PRB-0001', minTickets: 3 }, requires: ['which'] },
      { id: 'known', label: 'Le problème est analysé : cause racine et contournement documentés', check: { k: 'problem', ref: '@prb:PRB-0001', reached: 'known_error', hasRootCause: true, hasWorkaround: true }, requires: ['group'] },
      { id: 'fix', label: 'La correction définitive est décrite et le problème résolu', check: { k: 'problem', ref: '@prb:PRB-0001', status: 'resolved', hasFix: true }, requires: ['known'] },
    ],
    hints: [
      { for: 'group', levels: ['Menu ITIL → Problèmes, ou « Ouvrir un problème depuis ce ticket » dans un incident, puis rattachez les autres.'] },
      { for: 'known', levels: ['Cause racine : qu\'est-ce qui a vraiment défailli ? Contournement : comment rétablir vite en attendant ?'] },
    ],
    solutionText: ['Ouvrir PRB-0001 et y rattacher les trois incidents.', 'Lancer l\'analyse, renseigner cause racine et contournement : erreur connue.', 'Décrire la correction définitive (remplacer le switch, via un changement) et résoudre.'],
    solution: [
      answer('which', 1),
      { do: 'itsm.createProblem', args: { title: 'Défaillance du switch SW02', tickets: [T(1), T(2), T(3)] } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'analysis' } },
      { do: 'itsm.updateProblem', args: { id: '@prb:PRB-0001', fields: { rootCause: 'Alimentation défaillante du switch SW02.', workaround: 'Rallumer SW02 ou brancher le switch de secours.' } } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'known_error' } },
      { do: 'itsm.updateProblem', args: { id: '@prb:PRB-0001', fields: { permanentFix: 'Remplacer SW02 (changement CHG-0001).' } } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'resolved' } },
    ],
    realWorld: 'ITIL distingue l\'incident (rétablir le service) du problème (supprimer la cause). Une erreur connue est un problème dont la cause et le contournement sont documentés, souvent publiés en base de connaissances.',
  },

  /* ============================ TP 24 ============================ */
  {
    id: 'tp-24-changement', number: 24, title: 'Change Management', level: 5, levelLabel: level(5), difficulty: 3, duration: '50 min',
    skills: [{ ref: 'Travailler en mode projet', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Le switch SW02 est défaillant et doit être remplacé. Cette intervention touche la production : elle doit suivre le processus de changement.',
    stages: [
      { id: 's1', title: 'Préparer le dossier de changement', objectives: ['why', 'create', 'proposed'],
        lesson: ['Un **changement** est toute modification de l\'infrastructure en production. On ne l\'improvise pas : on l\'**évalue**, on l\'**autorise**, on le **planifie**, on le **réalise**, puis on le **vérifie**.', 'Le dossier comporte : le **risque** évalué, le **plan de mise en œuvre**, et surtout le **plan de retour arrière** (que fait-on si ça tourne mal ?).'],
        debrief: ['Un changement bien préparé rend l\'intervention prévisible, et son échec réversible.'] },
      { id: 's2', title: 'Obtenir l\'autorisation', objectives: ['approved'],
        lesson: ['Un changement **normal** est approuvé par une autorité (responsable, comité CAB). Un changement **standard** est répétitif et maîtrisé : il est pré-approuvé. Un changement **urgent** suit une approbation accélérée.', 'L\'approbateur doit avoir le **rôle** responsable : un technicien ne s\'autorise pas lui-même.'],
        debrief: ['La séparation entre celui qui propose, celui qui approuve et celui qui réalise est une garantie de contrôle.'] },
      { id: 's3', title: 'Réaliser et vérifier', objectives: ['do', 'verified', 'closed'],
        lesson: ['L\'intervention se fait **dans l\'infrastructure** (vue Infrastructure), pas dans la fiche de changement. La fiche, elle, enregistre que c\'est fait.', 'La **vérification** compare le résultat à l\'objectif : le changement a-t-il atteint son but sans effet de bord ? Seule la vérification autorise la clôture.'],
        debrief: ['Réaliser n\'est pas réussir : c\'est la vérification qui clôt le changement.'] },
    ],
    setup: [{ do: 'infra.setIp', args: { id: '@dev:SW02', ip: '192.168.10.2', mask: 24 } }, DISCOVER],
    objectives: [
      { id: 'why', label: 'Justifier l\'ouverture d\'un changement', question: { prompt: 'Pourquoi ne remplace-t-on pas simplement SW02 immédiatement ?', choices: ['Pour que l\'intervention soit évaluée, autorisée, planifiée et réversible', 'Parce qu\'un changement est obligatoire pour toucher à n\'importe quel équipement', 'Parce que le switch est sous garantie', 'Pour attendre la fin de la journée'], correct: 0, explain: 'Un switch en production dessert des utilisateurs. Le processus limite le risque : évaluation, autorisation, retour arrière.' } },
      { id: 'create', label: 'Le changement CHG-0001 existe et désigne l\'actif concerné', check: { k: 'change', ref: '@chg:CHG-0001', linkedAsset: '@ast:SW02' }, requires: ['why'] },
      { id: 'proposed', label: 'Le dossier est soumis (risque, plan et retour arrière renseignés)', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'proposed' }, requires: ['create'] },
      { id: 'approved', label: 'Le changement est approuvé par le responsable de la direction', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'approved', approver: '@usr:Éric' }, requires: ['proposed'] },
      { id: 'do', label: 'L\'intervention est réalisée sur l\'infrastructure', check: { k: 'event', type: 'DeviceReplaced' }, requires: ['approved'] },
      { id: 'verified', label: 'Le changement est réalisé puis vérifié, résultat consigné', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'verified' }, requires: ['do'] },
      { id: 'closed', label: 'Le changement est clos', check: { k: 'change', ref: '@chg:CHG-0001', status: 'closed' }, requires: ['verified'] },
    ],
    hints: [
      { for: 'proposed', levels: ['Le bouton de soumission vous dit ce qui manque.', 'Le retour arrière répond à : que fait-on si le nouveau switch ne fonctionne pas ?'] },
      { for: 'approved', levels: ['Qui, dans l\'organisation, a le rôle responsable ?'] },
      { for: 'do', levels: ['L\'intervention se fait dans la vue Infrastructure.'] },
    ],
    solutionText: ['Créer CHG-0001, le lier à SW02, évaluer le risque, écrire plan et retour arrière, soumettre.', 'Désigner Éric Moreau comme approbateur, approuver, planifier.', 'Remplacer SW02 dans l\'infrastructure, marquer le changement réalisé, consigner le résultat, vérifier puis clore.'],
    solution: [
      answer('why', 0),
      { do: 'itsm.createChange', args: { title: 'Remplacement de SW02', type: 'normal', assetIds: ['@ast:SW02'] } },
      { do: 'itsm.updateChange', args: { id: '@chg:CHG-0001', fields: { risk: 'medium', plan: 'Éteindre SW02, le remplacer, rallumer, vérifier les postes.', rollback: 'Remettre l\'ancien switch en place.', approver: '@usr:Éric', scheduledAt: 3600000 } } },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'proposed' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'approved' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'scheduled' } },
      { do: 'infra.replaceDevice', args: { id: '@dev:SW02' } },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'implemented' } },
      { do: 'itsm.updateChange', args: { id: '@chg:CHG-0001', fields: { result: 'Nouveau switch en service, les trois postes sont en ligne.' } } },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'verified' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'closed' } },
    ],
    realWorld: 'ITIL : un changement est évalué (risque, plan, retour arrière), autorisé par une autorité de changement (CAB), planifié, réalisé puis vérifié. Les changements standard, répétitifs et maîtrisés, sont pré-approuvés.',
  },

  /* ============================ TP 25 ============================ */
  {
    id: 'tp-25-connaissances', number: 25, title: 'Knowledge Management', level: 5, levelLabel: level(5), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Assurer la traçabilité', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'INC-0001 (poste d\'Alice, câble débranché) est clos avec une solution. Aujourd\'hui, Chloé appelle pour un symptôme qui ressemble au précédent : INC-0002 vient d\'être saisi.',
    stages: [
      { id: 's1', title: 'Capitaliser une résolution', objectives: ['why', 'draft', 'publish'],
        lesson: ['Une **base de connaissances** transforme une résolution en actif réutilisable. Le bon moment pour écrire un article : juste après la résolution, quand tout est frais.', 'Un bon article se lit par quelqu\'un qui ne connaît pas l\'incident : **symptômes** observables, **cause**, **solution** pas à pas. Il est **classé** (catégorie) pour être retrouvé, et **publié** pour être visible.'],
        debrief: ['Un brouillon n\'aide personne : seul un article publié et bien classé sert aux collègues et aux utilisateurs.'] },
      { id: 's2', title: 'Réutiliser pour résoudre plus vite', objectives: ['reuse', 'fix', 'close'],
        lesson: ['Face à un nouvel incident, on cherche d\'abord dans la base. L\'**association** de l\'article au ticket mesure son utilité et trace comment la solution a été trouvée.'],
        debrief: ['Un article utilisé deux fois a déjà rentabilisé son écriture : c\'est le principe du gain de temps du service desk.'] },
    ],
    setup: [
      DISCOVER, { do: 'infra.disconnect', args: { link: '@lnk:PC-COMPTA-01' } },
      newIncident('Plus de réseau sur mon poste', 'Appel d\'Alice : son poste n\'a plus de connexion réseau depuis ce matin.', 'Alice'),
      { do: 'infra.connect', args: { aDevice: '@dev:PC-COMPTA-01', aPort: 'eth0', bDevice: '@dev:SW-SIEGE-01', bPort: 'port3' } },
      comment(T(1), 'Alice rappelée : tout est rentré dans l\'ordre.'),
      ...resolveSteps(T(1), { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'low', urgency: 'medium' }, 'Symptôme : plus de réseau. Cause : câble débranché. Action : rebranché sur le switch. Vérification : poste de nouveau en ligne.'),
      { do: 'infra.disconnect', args: { link: '@lnk:PC22' } },
      newIncident('Mon PC ne se connecte plus', 'Appel de Chloé : plus de réseau sur son poste, tout était normal hier.', 'Chloé'),
    ],
    objectives: [
      { id: 'why', label: 'Comprendre l\'intérêt de capitaliser', question: { prompt: 'Pourquoi rédiger un article à partir d\'INC-0001, déjà clos ?', choices: ['Parce que le ticket doit être rouvert', 'Pour que la solution serve la prochaine fois, à n\'importe quel technicien', 'Parce que l\'outil l\'exige pour clore', 'Pour archiver le ticket'], correct: 1, explain: 'La résolution est connue et documentée : c\'est le moment de la transformer en connaissance réutilisable.' } },
      { id: 'draft', label: 'Un article est rédigé depuis INC-0001 et classé dans la bonne catégorie', check: { k: 'article', ref: '@kb:KB-0001', sourceTicket: T(1), category: 'Réseau' }, requires: ['why'] },
      { id: 'publish', label: 'L\'article est publié', check: { k: 'article', ref: '@kb:KB-0001', status: 'published' }, requires: ['draft'] },
      { id: 'reuse', label: 'L\'article est associé au ticket qu\'il a aidé à traiter', check: { k: 'article', ref: '@kb:KB-0001', minTickets: 1 }, requires: ['publish'] },
      { id: 'fix', label: 'Le poste de Chloé est de nouveau joignable', check: { k: 'deviceOnline', device: '@dev:PC22' } },
      { id: 'close', label: 'INC-0002 est clos avec sa solution documentée', check: { k: 'ticket', ref: T(2), status: 'closed', solutionMin: 40 }, requires: ['fix', 'reuse'] },
    ],
    hints: [
      { for: 'draft', levels: ['Ouvrez INC-0001 : un bouton vous propose de rédiger un article depuis ce ticket.'] },
      { for: 'reuse', levels: ['Un brouillon n\'est pas visible : publiez avant d\'associer. Dans INC-0002, section Base de connaissances.'] },
    ],
    solutionText: ['Depuis INC-0001 : créer l\'article (champs préremplis), ajouter la cause, publier.', 'Dans INC-0002 : associer l\'article, appliquer la solution (rebrancher PC22).', 'Qualifier, documenter, clore INC-0002.'],
    solution: [
      answer('why', 1),
      { do: 'itsm.createArticle', args: { ticket: T(1) } },
      { do: 'itsm.updateArticle', args: { id: '@kb:KB-0001', fields: { cause: 'Câble réseau débranché ou mal enfiché.' } } },
      { do: 'itsm.publishArticle', args: { id: '@kb:KB-0001' } },
      { do: 'itsm.linkArticle', args: { article: '@kb:KB-0001', ticket: T(2) } },
      { do: 'infra.connect', args: { aDevice: '@dev:PC22', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port3' } },
      ...resolveSteps(T(2), { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'low', urgency: 'medium' }, 'Appliqué KB-0001 : câble rebranché, poste de nouveau en ligne.'),
    ],
    realWorld: 'Une base de connaissances (Knowledge) transforme une résolution en actif réutilisable : le service desk gagne du temps et le libre-service de l\'utilisateur devient possible.',
  },
];

export const getScenario = (id: string): Scenario | undefined => SCENARIOS.find(s => s.id === id);
export type { Hint };
