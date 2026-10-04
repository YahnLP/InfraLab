import { DAY, HOUR, type Level } from '../core';
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
const stage = (id: string, title: string, objectives: string[], lesson: string[], debrief: string[]) => ({ id, title, objectives, lesson, debrief });
const Q = (prompt: string, choices: string[], correct: number, explain: string) => ({ prompt, choices, correct, explain });
const level = (n: number) => ['', 'Découverte', 'Inventaire', 'Service Desk', 'Incidents techniques', 'ITIL', 'ITAM', 'CMDB', 'Administration'][n] ?? '';
const NOREPLACE = [{ event: 'DeviceReplaced', message: 'Un équipement a été remplacé alors que la cause était ailleurs.' }, { event: 'DeviceRemoved', message: 'Un équipement a été supprimé du schéma.' }];

export const SCENARIOS: Scenario[] = [
  /* ============================ TP 6 ============================ */
  {
    id: 'tp-06-installer-agent', number: 6, title: 'Installer un agent', level: 2, levelLabel: level(2), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Exploiter et dépanner', kind: 'worked' }],
    timeNote: 'L\'agent remonte son inventaire à intervalle régulier : la première remontée est planifiée peu après l\'installation. Avancez l\'horloge (+15 min ou +1 h) pour la voir arriver, ou forcez-la depuis la fiche de l\'agent.',
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
    timeNote: 'Un agent en erreur ne remonte plus : avancez l\'horloge pour vérifier si la remontée reprend après votre correction, et pour voir un inventaire devenir obsolète (plusieurs jours sans remontée).',
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
    timeNote: 'Le SLA se mesure en temps simulé : 10 minutes se sont déjà écoulées. Avancez l\'horloge pour voir un ticket passer de « en cours » à « à risque » puis « dépassé », et constater qu\'un ticket « en attente » ne consomme plus de délai.',
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
  /* ============================ TP 26 ============================ */
  {
    id: 'tp-26-logiciels', number: 26, title: 'Logiciels et installations non autorisées', level: 6, levelLabel: level(6), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Sécuriser les équipements et les données', kind: 'worked' }],
    context: 'Les quatre postes de NovaTech sont inventoriés par des agents. La direction demande un point sur les logiciels installés : seuls certains outils sont autorisés, et les logiciels de prise de contrôle à distance ne le sont pas.',
    stages: [
      { id: 's1', title: 'Lire l\'inventaire logiciel', objectives: ['find'],
        lesson: ['L\'inventaire logiciel vient des **agents** : chaque poste remonte la liste de ce qui est installé, avec les versions. La page Logiciels agrège ces données et les compare à la réalité.', 'Deux colonnes à ne pas confondre : les installations **connues de l\'outil** (dernière remontée) et les installations **réelles** (ce qui est vraiment sur le poste).'],
        debrief: ['L\'outil ne voit que ce que ses agents lui ont dit : un écart entre « connu » et « réel » est un signal à traiter.'] },
      { id: 's2', title: 'Définir la politique et la faire respecter', objectives: ['policy', 'remove', 'why', 'clean'],
        lesson: ['Une **politique logicielle** classe les logiciels : autorisés, interdits, ou non classés. Un logiciel interdit déclenche une alerte lorsqu\'il est détecté.', 'La **remédiation** se fait sur le poste (désinstaller). Mais l\'outil n\'est mis à jour qu\'à la **remontée suivante** de l\'agent : tant qu\'elle n\'a pas eu lieu, il continue d\'afficher l\'ancienne situation.'],
        debrief: ['Détecter, décider, corriger, **vérifier que l\'outil le sait** : la boucle n\'est fermée que lorsque l\'inventaire reflète la réalité.'] },
    ],
    setup: [...['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'].map((n): Step => ({ do: 'agent.install', args: { id: `@dev:${n}` } })), { advance: 10 * MIN }],
    objectives: [
      { id: 'find', label: 'Repérer le poste qui héberge un logiciel de prise de contrôle à distance', question: { prompt: 'Sur quel poste est installé un outil de prise de contrôle à distance ?', choices: ['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'], correct: 3, explain: 'La page Logiciels liste les installations de TeamViewer : un seul poste est concerné, PC23.' } },
      { id: 'policy', label: 'Le logiciel de prise de contrôle est classé interdit dans la politique', check: { k: 'policy', software: 'sw-teamviewer', is: 'forbidden' }, requires: ['find'] },
      { id: 'remove', label: 'Le logiciel n\'est plus installé sur le poste concerné', check: { k: 'softwareInstalled', device: '@dev:PC23', software: 'sw-teamviewer', value: false }, requires: ['policy'] },
      { id: 'why', label: 'Expliquer pourquoi l\'outil l\'affiche encore', requires: ['remove'], question: { prompt: 'Juste après la désinstallation, la page Logiciels montre toujours l\'installation interdite. Pourquoi ?', choices: ['La désinstallation a échoué', 'L\'outil ne connaît que la dernière remontée de l\'agent : il faut une nouvelle remontée', 'Le logiciel est aussi installé ailleurs', 'La politique n\'est pas enregistrée'], correct: 1, explain: 'La réalité a changé, pas encore l\'inventaire : l\'agent doit remonter à nouveau (forcer l\'inventaire ou avancer le temps).' } },
      { id: 'clean', label: 'L\'outil ne connaît plus aucune installation interdite', check: { k: 'forbiddenCount', max: 0 }, requires: ['why'] },
    ],
    hints: [
      { for: 'find', levels: ['Ouvrez la page Logiciels (menu Parc) et regardez qui a quoi.'] },
      { for: 'remove', levels: ['La désinstallation se fait sur l\'équipement, dans la vue Infrastructure (section Logiciels).'] },
      { for: 'clean', levels: ['L\'agent doit remonter son inventaire : forcez la remontée depuis l\'inspecteur du poste.'] },
    ],
    solutionText: ['Page Logiciels : TeamViewer est sur PC23. Le classer « Interdit ».', 'Vue Infrastructure : le désinstaller de PC23, puis forcer l\'inventaire.', 'Vérifier que la page Logiciels ne signale plus rien.'],
    solution: [answer('find', 3), { do: 'itsm.setSoftwarePolicy', args: { softwareId: 'sw-teamviewer', policy: 'forbidden' } }, { do: 'infra.uninstallSoftware', args: { id: '@dev:PC23', softwareId: 'sw-teamviewer' } }, answer('why', 1), { do: 'agent.runInventory', args: { id: '@dev:PC23' } }],
    realWorld: 'Les politiques de liste noire / liste blanche (GLPI, Intune, Lansweeper) alertent sur les installations non autorisées. L\'alerte vaut ce que vaut la fraîcheur de l\'inventaire.',
  },

  /* ============================ TP 27 ============================ */
  {
    id: 'tp-27-licences', number: 27, title: 'Licences et conformité', level: 6, levelLabel: level(6), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'NovaTech a acheté **3 licences Microsoft Office**. Quatre postes en sont équipés et inventoriés. Le service achats peut commander une licence supplémentaire. Déclarez les droits, mesurez la conformité, puis régularisez.',
    stages: [
      { id: 's1', title: 'Déclarer les droits', objectives: ['count', 'declare'],
        lesson: ['Une **licence** est un droit d\'usage, pas un logiciel. L\'outil ne peut dire si le parc est conforme que si les **droits achetés** sont déclarés.', 'La conformité compare deux nombres : les **droits** (ce qu\'on a acheté) et les **installations** (ce que l\'inventaire a trouvé).'],
        debrief: ['Sans droits déclarés, il n\'y a pas de conformité mesurable : on ne sait pas ce qu\'on a le droit d\'installer.'] },
      { id: 's2', title: 'Constater et régulariser', objectives: ['verdict', 'compliant'],
        lesson: ['Un dépassement se régularise de deux façons : **acheter** les droits manquants, ou **désinstaller** là où le logiciel n\'est pas nécessaire. Le choix est économique et organisationnel.', 'Après une désinstallation, la conformité n\'est constatée par l\'outil qu\'à la remontée suivante de l\'agent.'],
        debrief: ['Régulariser, c\'est agir (acheter ou désinstaller), puis vérifier que l\'outil le confirme.'] },
    ],
    setup: [...['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'].map((n): Step => ({ do: 'agent.install', args: { id: `@dev:${n}` } })), { advance: 10 * MIN }],
    objectives: [
      { id: 'count', label: 'Dénombrer les installations d\'Office connues de l\'outil', question: { prompt: 'Combien d\'installations de Microsoft Office l\'outil connaît-il ?', choices: ['2', '3', '4', 'Aucune : il faut d\'abord déclarer les droits'], correct: 2, explain: 'Les quatre postes ont remonté Office. C\'est le chiffre à comparer aux droits achetés.' } },
      { id: 'declare', label: 'Les droits Office achetés sont déclarés dans l\'outil', check: { k: 'license', software: 'sw-office', exists: true }, requires: ['count'] },
      { id: 'verdict', label: 'Conclure sur la conformité', requires: ['declare'], question: { prompt: 'Avec 3 droits achetés et 4 installations, le parc est…', choices: ['Conforme : il reste une marge', 'Non conforme : une installation est sans droit', 'Impossible à dire', 'Conforme tant que personne ne contrôle'], correct: 1, explain: 'Un dépassement de droits expose l\'entreprise à un redressement en cas d\'audit éditeur.' } },
      { id: 'compliant', label: 'La licence Office est conforme dans l\'outil', check: { k: 'license', software: 'sw-office', state: 'compliant' }, requires: ['verdict'] },
    ],
    hints: [
      { for: 'declare', levels: ['Menu Parc → Licences : ajoutez une licence pour Microsoft Office, avec le nombre de droits achetés (3).'] },
      { for: 'compliant', levels: ['Deux voies : augmenter les droits (achat) ou désinstaller sur un poste. Dans les deux cas, vérifiez le tableau.', 'Après une désinstallation, forcez l\'inventaire du poste.'] },
    ],
    solutionText: ['Déclarer une licence Office de 3 droits : 4 installations connues → non conforme (+1).', 'Régulariser : acheter un droit (passer à 4) ou désinstaller Office d\'un poste puis forcer l\'inventaire.'],
    solution: [answer('count', 2), { do: 'itsm.addLicense', args: { softwareId: 'sw-office', quantity: 3 } }, answer('verdict', 1), { do: 'itsm.updateLicense', args: { id: '@lic:LIC-0001', fields: { quantity: 4 } } }],
    realWorld: 'Le Software Asset Management rapproche droits et installations (GLPI Licences, ServiceNow SAM Pro). Le coût d\'un écart découvert en audit dépasse en général celui de la licence manquante.',
  },

  /* ============================ TP 28 ============================ */
  {
    id: 'tp-28-contrats', number: 28, title: 'Contrats, fournisseurs et échéances', level: 6, levelLabel: level(6), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    timeNote: 'Les échéances dépendent de la date simulée : avancez l\'horloge de plusieurs jours (+1 jour) pour voir un contrat passer d\'« actif » à « proche de l\'échéance », puis « expiré ».',
    context: 'NovaTech suit trois contrats chez deux fournisseurs. Aucune alerte n\'a été envoyée : à vous de lire les échéances, de renouveler ce qui doit l\'être et de rattacher les contrats aux équipements qu\'ils couvrent.',
    stages: [
      { id: 's1', title: 'Repérer les échéances', objectives: ['which'],
        lesson: ['Un **contrat** a un fournisseur, un type (maintenance, licence, garantie, location) et des dates. Son état dépend du temps : **actif**, **échéance proche** (moins de 30 jours) ou **expiré**.', 'Un contrat expiré sans alerte, c\'est une maintenance qui s\'arrête, une garantie perdue ou une licence qui n\'est plus valable.'],
        debrief: ['Surveiller les échéances, c\'est éviter de découvrir à la panne que la maintenance était terminée.'] },
      { id: 's2', title: 'Renouveler et rattacher', objectives: ['renew1', 'renew2', 'cover', 'why'],
        lesson: ['**Renouveler** prolonge la date de fin. **Rattacher** un contrat aux actifs qu\'il couvre permet, au moment d\'une panne, de savoir si l\'équipement est sous contrat.'],
        debrief: ['Un contrat relié aux actifs devient utile le jour de la panne : on voit tout de suite si l\'équipement est couvert.'] },
    ],
    setup: [
      DISCOVER,
      { do: 'itsm.addSupplier', args: { name: 'Dell France' } }, { do: 'itsm.addSupplier', args: { name: 'Microsoft' } },
      { do: 'itsm.addContract', args: { title: 'Maintenance des postes', supplierId: '@sup:Dell France', kind: 'maintenance', startAt: -300 * DAY, endAt: 20 * DAY } },
      { do: 'itsm.addContract', args: { title: 'Abonnement Office', supplierId: '@sup:Microsoft', kind: 'licence', startAt: -400 * DAY, endAt: -5 * DAY } },
      { do: 'itsm.addContract', args: { title: 'Garantie imprimante', supplierId: '@sup:Dell France', kind: 'warranty', startAt: -100 * DAY, endAt: 600 * DAY } },
    ],
    objectives: [
      { id: 'which', label: 'Identifier les contrats qui demandent une action', question: { prompt: 'Quels contrats demandent une action aujourd\'hui ?', choices: ['CTR-0003 seulement', 'CTR-0001 (échéance proche) et CTR-0002 (expiré)', 'Les trois', 'Aucun'], correct: 1, explain: 'CTR-0001 expire dans 20 jours, CTR-0002 est déjà expiré. CTR-0003 est actif pour près de deux ans.' } },
      { id: 'renew1', label: 'Le contrat de maintenance est de nouveau confortablement actif', check: { k: 'contract', ref: '@ctr:CTR-0001', state: 'active' }, requires: ['which'] },
      { id: 'renew2', label: 'L\'abonnement expiré est de nouveau actif', check: { k: 'contract', ref: '@ctr:CTR-0002', state: 'active' }, requires: ['which'] },
      { id: 'cover', label: 'Le contrat de maintenance est rattaché au poste PC-COMPTA-01', check: { k: 'contract', ref: '@ctr:CTR-0001', coversAsset: '@ast:PC-COMPTA-01' }, requires: ['renew1'] },
      { id: 'why', label: 'Justifier le rattachement aux actifs', requires: ['cover'], question: { prompt: 'Pourquoi relier un contrat aux actifs qu\'il couvre ?', choices: ['Pour que l\'outil facture le fournisseur', 'Pour savoir, le jour d\'une panne, si l\'équipement est sous contrat', 'Parce que l\'outil l\'exige pour renouveler', 'Pour supprimer les actifs expirés'], correct: 1, explain: 'La fiche d\'actif affiche ses contrats : sous maintenance ou non, on sait qui appeler et si c\'est facturé.' } },
    ],
    hints: [{ for: 'renew1', levels: ['Menu Gestion → Contrats et fournisseurs : chaque ligne a un bouton « Renouveler +1 an ».'] }, { for: 'cover', levels: ['Dans la ligne du contrat, la liste « + actif… » permet de choisir les actifs couverts.'] }],
    solutionText: ['Contrats : CTR-0001 expire dans 20 jours, CTR-0002 est expiré.', 'Renouveler les deux, puis rattacher la maintenance à PC-COMPTA-01.'],
    solution: [answer('which', 1), { do: 'itsm.updateContract', args: { id: '@ctr:CTR-0001', fields: { endAt: 385 * DAY } } }, { do: 'itsm.updateContract', args: { id: '@ctr:CTR-0002', fields: { endAt: 360 * DAY } } }, { do: 'itsm.updateContract', args: { id: '@ctr:CTR-0001', fields: { assetIds: ['@ast:PC-COMPTA-01'] } } }, answer('why', 1)],
    realWorld: 'GLPI : Gestion → Contrats, avec alertes d\'échéance ; ServiceNow : Contract Management. Un bon inventaire lie contrat, fournisseur et actif.',
  },

  /* ============================ TP 29 ============================ */
  {
    id: 'tp-29-cycle-de-vie', number: 29, title: 'Cycle de vie d\'un équipement', level: 6, levelLabel: level(6), difficulty: 2, duration: '45 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'NovaTech a commandé un ordinateur portable, PORTABLE-07, pour Chloé Dubois (Commercial). Accompagnez-le de la commande jusqu\'à sa fin de vie : réception, affectation, panne, retour, mise au rebut.',
    stages: [
      { id: 's1', title: 'Réceptionner', objectives: ['why', 'receive'],
        lesson: ['Un actif a un **cycle de vie** : commandé, en stock, en service, en réparation, retiré. Chaque changement d\'état est enregistré : c\'est l\'historique de l\'équipement.', 'À la **réception**, l\'équipement passe de « commandé » à « en stock » : il existe physiquement, il n\'est pas encore à un utilisateur.'],
        debrief: ['Le stock est l\'état de référence : un équipement qui n\'est ni en service ni retiré doit pouvoir être retrouvé.'] },
      { id: 's2', title: 'Affecter à un utilisateur', objectives: ['assign'],
        lesson: ['La mise en service **suppose un utilisateur** : on ne peut pas mettre un actif « en service » sans savoir à qui il est confié. Cette affectation est tracée.'],
        debrief: ['Qui a quoi, depuis quand : c\'est la question à laquelle l\'historique d\'affectation répond.'] },
      { id: 's3', title: 'Panne et réparation', objectives: ['repair', 'back'],
        lesson: ['Un équipement en panne passe **en réparation**. S\'il est sous **garantie** ou sous contrat de maintenance, la réparation est prise en charge : vérifier la couverture avant d\'agir évite des frais inutiles.', 'Après réparation, il retourne en service chez le même utilisateur.'],
        debrief: ['La réparation est un détour : l\'actif revient chez son utilisateur, l\'historique garde trace de l\'incident.'] },
      { id: 's4', title: 'Fin de vie', objectives: ['unassign', 'retire', 'why2'],
        lesson: ['En fin de vie, l\'actif est **restitué** (affectation retirée, retour au stock), puis **retiré**. Un actif retiré ne se réaffecte plus : on ne remet pas en circulation un matériel mis au rebut.'],
        debrief: ['Le parcours complet reste lisible dans l\'historique : de la commande au rebut, chaque étape est datée.'] },
    ],
    setup: [{ do: 'itsm.createAsset', args: { name: 'PORTABLE-07', model: 'Latitude 5540', vendor: 'Dell', purchasedAt: 0, warrantyEnd: 1095 * DAY, cost: 1150 } }],
    objectives: [
      { id: 'why', label: 'Comprendre l\'état d\'un actif commandé', question: { prompt: 'PORTABLE-07 vient d\'être commandé. Où se trouve-t-il dans le cycle de vie ?', choices: ['En service chez Chloé', 'En stock', 'Commandé : il n\'est pas encore arrivé', 'Découvert par un agent'], correct: 2, explain: 'Un actif commandé existe dans l\'outil mais pas encore physiquement : ni stock, ni inventaire.' } },
      { id: 'receive', label: 'PORTABLE-07 est réceptionné', check: { k: 'asset', asset: '@ast:PORTABLE-07', reached: 'stock' }, requires: ['why'] },
      { id: 'assign', label: 'PORTABLE-07 est en service chez Chloé Dubois', check: { k: 'asset', asset: '@ast:PORTABLE-07', reached: 'in_use', assignedTo: '@usr:Chloé' }, requires: ['receive'] },
      { id: 'repair', label: 'PORTABLE-07 est passé en réparation', check: { k: 'asset', asset: '@ast:PORTABLE-07', reached: 'repair' }, requires: ['assign'] },
      { id: 'back', label: 'Après réparation, PORTABLE-07 est de nouveau en service chez Chloé', check: { k: 'all', of: [{ k: 'asset', asset: '@ast:PORTABLE-07', reached: 'repair' }, { k: 'asset', asset: '@ast:PORTABLE-07', reached: 'in_use', assignedTo: '@usr:Chloé' }] }, requires: ['repair'] },
      { id: 'unassign', label: 'PORTABLE-07 est restitué au stock, sans utilisateur affecté', check: { k: 'asset', asset: '@ast:PORTABLE-07', reached: 'stock', unassigned: true }, requires: ['back'] },
      { id: 'retire', label: 'PORTABLE-07 est retiré', check: { k: 'asset', asset: '@ast:PORTABLE-07', status: 'retired', unassigned: true }, requires: ['unassign'] },
      { id: 'why2', label: 'Justifier qu\'un actif retiré ne se réaffecte pas', requires: ['retire'], question: { prompt: 'Pourquoi un actif retiré ne peut-il plus être remis en service ?', choices: ['Pour éviter de remettre en circulation un matériel mis au rebut (sécurité, traçabilité)', 'Parce que l\'outil le supprime', 'Parce que la garantie est finie', 'Parce que son utilisateur est parti'], correct: 0, explain: 'Un matériel retiré a été effacé, sorti du parc et souvent détruit : il ne doit plus réapparaître.' } },
    ],
    hints: [
      { for: 'receive', levels: ['Menu Parc → PORTABLE-07 : la section Cycle de vie propose les étapes possibles.'] },
      { for: 'assign', levels: ['Choisissez d\'abord l\'utilisateur dans la liste, puis l\'étape de mise en service.'] },
      { for: 'retire', levels: ['L\'actif doit d\'abord être restitué au stock.'] },
    ],
    solutionText: ['Réceptionner (commandé → stock), affecter à Chloé (stock → en service).', 'Envoyer en réparation puis remettre en service.', 'Restituer au stock (affectation retirée), puis retirer.'],
    solution: [
      answer('why', 2),
      { do: 'itsm.setAssetStatus', args: { id: '@ast:PORTABLE-07', to: 'stock' } }, { do: 'itsm.setAssetStatus', args: { id: '@ast:PORTABLE-07', to: 'in_use', user: '@usr:Chloé' } },
      { do: 'itsm.setAssetStatus', args: { id: '@ast:PORTABLE-07', to: 'repair' } }, { do: 'itsm.setAssetStatus', args: { id: '@ast:PORTABLE-07', to: 'in_use' } },
      { do: 'itsm.setAssetStatus', args: { id: '@ast:PORTABLE-07', to: 'stock' } }, { do: 'itsm.setAssetStatus', args: { id: '@ast:PORTABLE-07', to: 'retired' } }, answer('why2', 0),
    ],
    realWorld: 'Le cycle de vie d\'un actif (ITAM) : Ordered → In stock → In use → In repair → Retired (ServiceNow Hardware Asset Management, GLPI états). L\'historique sert aux audits et à la gestion des garanties.',
  },

  /* ============================ TP 30 ============================ */
  {
    id: 'tp-30-reaffectation', number: 30, title: 'Réaffectation d\'un poste', level: 6, levelLabel: level(6), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Bruno Leroy quitte NovaTech. Son poste PC21 doit être restitué, puis confié à Nadia Roux (Commercial) qui arrive. Dans l\'outil comme dans la réalité, il ne doit rester aucune trace d\'affectation à Bruno.',
    stages: [
      { id: 's1', title: 'Restituer le poste', objectives: ['why', 'return'],
        lesson: ['Un départ déclenche une **restitution** : le poste revient au stock et l\'affectation est retirée. On ne réaffecte pas directement d\'une personne à l\'autre : la restitution marque la fin de la responsabilité de Bruno et conserve l\'historique.'],
        debrief: ['Restituer avant de réaffecter garde une chaîne claire : à chaque instant, on sait qui est responsable du poste.'] },
      { id: 's2', title: 'Préparer et réaffecter', objectives: ['session', 'assign', 'sync'],
        lesson: ['Dans la **réalité**, le poste doit être préparé : session de l\'ancien utilisateur remplacée par celle du nouveau. Dans l\'**outil**, l\'affectation doit suivre, et l\'inventaire de l\'agent confirme l\'utilisateur connecté.', 'Si l\'un des deux est oublié, l\'outil et la réalité divergent : c\'est exactement ce que les audits repèrent.'],
        debrief: ['Réalité, affectation, inventaire : trois sources qui doivent dire la même chose.'] },
    ],
    setup: [
      { do: 'itsm.addUser', args: { name: 'Nadia Roux', service: 'Commercial' } },
      { do: 'agent.install', args: { id: '@dev:PC21' } }, { advance: 10 * MIN }, DISCOVER,
      { do: 'itsm.assignAsset', args: { id: '@ast:PC21', user: '@usr:Bruno' } },
    ],
    objectives: [
      { id: 'why', label: 'Justifier la restitution avant réaffectation', question: { prompt: 'Pourquoi restituer d\'abord PC21 au stock plutôt que de l\'affecter directement à Nadia ?', choices: ['Parce que l\'outil l\'interdit', 'Pour marquer la fin de la responsabilité de Bruno et garder un historique clair', 'Pour libérer une licence', 'Pour que Nadia soit notifiée'], correct: 1, explain: 'La restitution est une étape tracée : elle documente le départ de Bruno et prépare la remise propre du poste.' } },
      { id: 'return', label: 'PC21 est restitué au stock, sans utilisateur affecté', check: { k: 'asset', asset: '@ast:PC21', reached: 'stock', unassigned: true }, requires: ['why'] },
      { id: 'session', label: 'Le poste est préparé pour Nadia (plus de session de Bruno)', check: { k: 'deviceUser', device: '@dev:PC21', user: '@usr:Nadia' }, requires: ['return'] },
      { id: 'assign', label: 'PC21 est en service chez Nadia Roux', check: { k: 'asset', asset: '@ast:PC21', status: 'in_use', assignedTo: '@usr:Nadia' }, requires: ['return'] },
      { id: 'sync', label: 'L\'inventaire confirme la réalité : l\'outil est à jour', check: { k: 'assetInSync', device: '@dev:PC21' }, requires: ['session', 'assign'] },
    ],
    hints: [
      { for: 'return', levels: ['Fiche de l\'actif PC21 → Cycle de vie : « Restituer au stock ».'] },
      { for: 'session', levels: ['La session ouverte se règle dans la vue Infrastructure, sur le poste.'] },
      { for: 'sync', levels: ['L\'outil ne connaît que la dernière remontée de l\'agent : forcez l\'inventaire après avoir préparé le poste.'] },
    ],
    solutionText: ['Restituer PC21 au stock : l\'affectation de Bruno disparaît.', 'Préparer le poste pour Nadia (session), l\'affecter dans l\'outil.', 'Forcer l\'inventaire pour que l\'outil reflète la réalité.'],
    solution: [answer('why', 1), { do: 'itsm.setAssetStatus', args: { id: '@ast:PC21', to: 'stock' } }, { do: 'infra.setLoggedUser', args: { id: '@dev:PC21', user: '@usr:Nadia' } }, { do: 'itsm.setAssetStatus', args: { id: '@ast:PC21', to: 'in_use', user: '@usr:Nadia' } }, { do: 'agent.runInventory', args: { id: '@dev:PC21' } }],
    realWorld: 'Une procédure départ / arrivée (offboarding / onboarding) couvre : récupération du matériel, effacement, désaffectation des comptes et licences, nouvelle affectation. L\'historique de propriété sert aux audits.',
  },

  /* ============================ TP 31 ============================ */
  {
    id: 'tp-31-creer-des-ci', number: 31, title: 'Créer des éléments de configuration', level: 7, levelLabel: level(7), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'La CMDB de NovaTech est vide. La comptabilité s\'appuie sur un poste, une imprimante, et sur un service : la facturation. Constituez les CI qui permettront, plus tard, de mesurer l\'impact d\'une panne.',
    stages: [
      { id: 's1', title: 'Actif ou élément de configuration ?', objectives: ['what'],
        lesson: ['Un **actif** est ce qu\'on possède et gère (inventaire, finances). Un **CI**, élément de configuration, est ce dont on veut connaître les **liens** et les **conséquences d\'une panne**.', 'On n\'inscrit pas tout en CMDB : seulement ce qui a des dépendances ou un impact. Une base trop large devient impossible à tenir à jour.'],
        debrief: ['Un CI est un choix de modélisation : on y met ce qui aide à répondre à « qui est touché si ça tombe ? ».'] },
      { id: 's2', title: 'Créer les CI', objectives: ['pc', 'printer', 'service', 'why'],
        lesson: ['Un CI d\'**infrastructure** repose sur un actif. Un CI de **service** (la facturation, la messagerie) n\'a pas d\'équipement propre : il décrit ce que les utilisateurs reçoivent, et dépendra d\'équipements.'],
        debrief: ['Infrastructure en bas, services en haut : c\'est la structure d\'une CMDB. Les relations (TP 32) les relient.'] },
    ],
    setup: [DISCOVER],
    objectives: [
      { id: 'what', label: 'Distinguer actif et CI', question: { prompt: 'Qu\'est-ce qui justifie d\'inscrire un élément en CMDB ?', choices: ['Il a une valeur d\'achat élevée', 'Il a des dépendances ou son arrêt a des conséquences à mesurer', 'Il a été découvert par un agent', 'Il est installé depuis plus d\'un an'], correct: 1, explain: 'La CMDB sert à mesurer l\'impact : on y met ce qui a des liens et des conséquences, pas tout ce qu\'on possède.' } },
      { id: 'pc', label: 'Le poste PC-COMPTA-01 est un CI d\'infrastructure', check: { k: 'ci', name: '@ci:PC-COMPTA-01', ciKind: 'infrastructure', withAsset: true }, requires: ['what'] },
      { id: 'printer', label: 'L\'imprimante IMP-COMPTA est un CI d\'infrastructure', check: { k: 'ci', name: '@ci:IMP-COMPTA', ciKind: 'infrastructure', withAsset: true }, requires: ['what'] },
      { id: 'service', label: 'Le service « Facturation comptable » existe comme CI de service', check: { k: 'ci', name: '@ci:Facturation comptable', ciKind: 'service' }, requires: ['what'] },
      { id: 'why', label: 'Comprendre pourquoi un service est un CI sans actif', requires: ['service'], question: { prompt: 'Pourquoi le CI « Facturation comptable » n\'est-il lié à aucun actif ?', choices: ['Parce qu\'il a été oublié', 'Parce qu\'un service n\'est pas un équipement : il repose sur plusieurs équipements', 'Parce que l\'outil ne le permet pas', 'Parce qu\'il est gratuit'], correct: 1, explain: 'Un service est un résultat pour l\'utilisateur ; il dépend d\'équipements, via des relations.' } },
    ],
    hints: [{ for: 'pc', levels: ['Menu Gestion → CMDB : « Promouvoir un actif en CI ».'] }, { for: 'service', levels: ['Même page : « Nouveau service ou application ».'] }],
    solutionText: ['Promouvoir PC-COMPTA-01 et IMP-COMPTA en CI d\'infrastructure.', 'Créer le CI de service « Facturation comptable ».'],
    solution: [answer('what', 1), { do: 'itsm.createCi', args: { name: 'PC-COMPTA-01', kind: 'infrastructure', asset: '@ast:PC-COMPTA-01' } }, { do: 'itsm.createCi', args: { name: 'IMP-COMPTA', kind: 'infrastructure', asset: '@ast:IMP-COMPTA' } }, { do: 'itsm.createCi', args: { name: 'Facturation comptable', kind: 'service' } }, answer('why', 1)],
    realWorld: 'Dans ServiceNow, la CMDB contient des « CI » classés par classes ; GLPI parle d\'éléments et de liens entre éléments. Le modèle de services (Service Mapping) relie les services aux équipements.',
  },

  /* ============================ TP 32 ============================ */
  {
    id: 'tp-32-relations', number: 32, title: 'Relations et analyse d\'impact', level: 7, levelLabel: level(7), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }],
    context: 'La CMDB de NovaTech contient le poste de la comptabilité, l\'imprimante, le switch du siège et le service « Facturation comptable ». Aucune relation n\'est déclarée pour ce service. Déclarez-les, puis servez-vous de la CMDB pour mesurer l\'effet d\'une panne du switch.',
    stages: [
      { id: 's1', title: 'Déclarer les dépendances', objectives: ['auto', 'rel1', 'rel2'],
        lesson: ['Deux sortes de relations : celles qui se **découvrent**, comme « connecté à », déduites du câblage réel ; et celles qui se **déclarent**, comme « dépend de » ou « utilise », qui expriment un usage.', 'Un service **dépend de** ce sans quoi il ne fonctionne pas : ici, le poste qui édite les factures et l\'imprimante qui les sort.'],
        debrief: ['Les relations déduites sont fiables mais physiques ; les relations déclarées portent le sens métier, et c\'est à vous de les maintenir.'] },
      { id: 's2', title: 'Mesurer l\'impact d\'une panne', objectives: ['impact'],
        lesson: ['L\'**analyse d\'impact** répond à : « si cet élément tombe, qui est touché ? ». Elle combine la propagation **physique** (ce qui perd la connexion) et les dépendances **déclarées** (les services qui reposent sur ce qui est coupé).', 'Dans la fiche d\'un CI, l\'encadré « Si ce CI tombe » fait cette simulation sans toucher à l\'infrastructure.'],
        debrief: ['Savoir à l\'avance quels services une panne atteint permet de prioriser, et d\'informer les bonnes personnes.'] },
    ],
    setup: [
      { do: 'infra.setIp', args: { id: '@dev:SW-SIEGE-01', ip: '192.168.10.1', mask: 24 } }, DISCOVER,
      { do: 'itsm.createCi', args: { name: 'PC-COMPTA-01', kind: 'infrastructure', asset: '@ast:PC-COMPTA-01' } }, { do: 'itsm.createCi', args: { name: 'IMP-COMPTA', kind: 'infrastructure', asset: '@ast:IMP-COMPTA' } },
      { do: 'itsm.createCi', args: { name: 'SW-SIEGE-01', kind: 'infrastructure', asset: '@ast:SW-SIEGE-01' } }, { do: 'itsm.createCi', args: { name: 'Facturation comptable', kind: 'service' } },
    ],
    objectives: [
      { id: 'auto', label: 'Comprendre d\'où viennent les relations « connecté à »', question: { prompt: 'Dans la fiche du CI SW-SIEGE-01, des relations « connecté à » apparaissent sans que personne ne les ait saisies. D\'où viennent-elles ?', choices: ['Elles ont été importées d\'un fichier', 'Elles sont déduites du câblage réel entre équipements qui ont un CI', 'Elles sont devinées par l\'outil à partir du nom', 'Elles ont été créées par le TP'], correct: 1, explain: 'Le câblage de l\'infrastructure est la source : si deux équipements câblés ont un CI, l\'outil en déduit le lien.' } },
      { id: 'rel1', label: 'Le service dépend du poste de comptabilité', check: { k: 'relation', from: '@ci:Facturation comptable', to: '@ci:PC-COMPTA-01', type: 'depends_on' }, requires: ['auto'] },
      { id: 'rel2', label: 'Le service dépend de l\'imprimante de la comptabilité', check: { k: 'relation', from: '@ci:Facturation comptable', to: '@ci:IMP-COMPTA', type: 'depends_on' }, requires: ['auto'] },
      { id: 'impact', label: 'Prévoir l\'effet d\'une panne du switch du siège', requires: ['rel1', 'rel2'], question: { prompt: 'Si SW-SIEGE-01 tombe, quels services sont touchés ?', choices: ['Aucun : le switch n\'est pas un service', 'Facturation comptable, car son poste et son imprimante perdent leur connexion', 'Seulement l\'imprimante', 'Tous les services de l\'entreprise sans exception'], correct: 1, explain: 'Le switch coupe PC-COMPTA-01 et IMP-COMPTA ; le service qui en dépend est atteint. L\'encadré « Si ce CI tombe » le montre.' } },
    ],
    hints: [{ for: 'rel1', levels: ['Menu Gestion → CMDB, ouvrez la fiche « Facturation comptable » : on y ajoute les relations.'] }, { for: 'impact', levels: ['Ouvrez la fiche de SW-SIEGE-01 : l\'encadré « Si SW-SIEGE-01 tombe » fait la simulation.'] }],
    solutionText: ['Fiche « Facturation comptable » : ajouter « dépend de » PC-COMPTA-01 et IMP-COMPTA.', 'Fiche SW-SIEGE-01 : l\'encadré d\'impact liste Facturation comptable.'],
    solution: [answer('auto', 1), { do: 'itsm.addRelation', args: { from: '@ci:Facturation comptable', to: '@ci:PC-COMPTA-01', type: 'depends_on' } }, { do: 'itsm.addRelation', args: { from: '@ci:Facturation comptable', to: '@ci:IMP-COMPTA', type: 'depends_on' } }, answer('impact', 1)],
    realWorld: 'La CMDB sert surtout à l\'analyse d\'impact : avant un changement (qui est touché ?) et pendant un incident (quels services sont atteints ?).',
  },
  /* ============================ TP 33 ============================ */
  {
    id: 'tp-33-qui-peut-quoi', number: 33, title: 'Qui peut faire quoi ?', level: 8, levelLabel: level(8), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Alice Martin (Comptabilité) a ouvert un ticket : son poste est lent. Pour comprendre les droits, vous allez endosser tour à tour son identité, puis celle d\'un technicien. Le sélecteur « Agir en tant que » est dans la barre du haut.',
    stages: [
      { id: 's1', title: 'Se mettre à la place d\'un utilisateur', objectives: ['alice', 'denied'],
        lesson: ['Un outil ITSM ne laisse pas tout le monde tout faire. Les **droits** (créer un ticket, le qualifier, approuver un changement…) sont regroupés en **rôles** : Utilisateur, Technicien, Responsable, Administrateur. Chaque personne reçoit un ou plusieurs rôles : c\'est le **RBAC** (contrôle d\'accès par les rôles).', 'Pour le voir, choisissez **Alice** dans « Agir en tant que ». Puis essayez, dans ITSM → Tickets, de qualifier son ticket (catégorie, impact, urgence) : l\'outil refuse et explique pourquoi.'],
        debrief: ['Le refus n\'est pas un bug : il protège. Un utilisateur qui qualifie lui-même ses tickets pourrait les faire passer en P1 pour être servi en premier.'] },
      { id: 's2', title: 'Le bon rôle pour le bon travail', objectives: ['david', 'qual', 'assign'],
        lesson: ['Le **technicien** a les droits d\'exploitation : qualifier, attribuer, traiter. C\'est le **principe du moindre privilège** : chacun reçoit uniquement ce dont il a besoin pour son travail, rien de plus.', 'Passez maintenant en **David Petit** (technicien) : qualifiez le ticket d\'Alice et attribuez-le-vous.'],
        debrief: ['Chaque action est journalisée **avec son auteur** : le journal d\'audit montre que c\'est David, et non Alice, qui a qualifié et attribué le ticket.'] },
      { id: 's3', title: 'Lire la matrice des droits', objectives: ['who'],
        lesson: ['La page **Administration → Rôles et droits** liste, rôle par rôle, ce qui est autorisé. C\'est le document de référence d\'un audit d\'habilitations : « qui peut faire quoi, et pourquoi ? ».'],
        debrief: ['Savoir lire cette matrice permet de détecter un rôle trop généreux avant qu\'il ne cause un incident.'] },
    ],
    setup: [{ do: 'itsm.createTicket', args: { title: 'Mon poste est très lent', description: 'Depuis ce matin, le poste de comptabilité met plusieurs minutes à ouvrir un fichier.', requester: '@usr:Alice', kind: 'incident' }, as: '@usr:Alice' }],
    objectives: [
      { id: 'alice', label: 'Vous agissez en tant qu\'Alice Martin', check: { k: 'actedAs', user: '@usr:Alice' } },
      { id: 'denied', label: 'Comprendre pourquoi Alice ne peut pas qualifier son ticket', requires: ['alice'], question: { prompt: 'Alice essaie de qualifier son propre ticket et l\'outil refuse. Pourquoi ?', choices: ['Le ticket est verrouillé par un technicien', 'Son rôle « Utilisateur » n\'a pas le droit de qualifier : seuls les rôles d\'exploitation l\'ont', 'Alice n\'a pas de compte actif', 'La qualification est automatique'], correct: 1, explain: 'Le rôle Utilisateur ne porte que le droit d\'ouvrir des tickets. Qualifier, c\'est décider de la priorité : cela revient à l\'exploitation.' } },
      { id: 'david', label: 'Vous agissez en tant que David Petit (technicien)', check: { k: 'actedAs', user: '@usr:David' }, requires: ['denied'] },
      { id: 'qual', label: 'Le ticket est qualifié, et c\'est David qui l\'a fait', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), qualified: true }, { k: 'didAs', user: '@usr:David', type: 'TicketStatusChanged', payload: { to: 'qualified' } }] }, requires: ['david'] },
      { id: 'assign', label: 'Le ticket est attribué à David Petit', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), assignee: '@usr:David' }, { k: 'didAs', user: '@usr:David', type: 'TicketStatusChanged', payload: { to: 'assigned' } }] }, requires: ['qual'] },
      { id: 'who', label: 'Savoir qui approuve les changements', requires: ['assign'], question: { prompt: 'Dans la matrice des droits de départ, quel rôle peut approuver un changement ?', choices: ['Technicien', 'Utilisateur', 'Responsable', 'Administrateur'], correct: 2, explain: 'Le Responsable approuve les changements. Le technicien les prépare : celui qui fait ne valide pas ce qu\'il a demandé.' } },
    ],
    hints: [
      { for: 'alice', levels: ['Barre du haut : sélecteur « Agir en tant que ».'] },
      { for: 'qual', levels: ['Fiche du ticket : catégorie, sous-catégorie, impact et urgence, puis « Qualifier ».'] },
      { for: 'who', levels: ['ITSM → Administration → Rôles et droits.'] },
    ],
    solutionText: ['Agir en tant qu\'Alice : la qualification est refusée (rôle Utilisateur).', 'Agir en tant que David : qualifier le ticket (catégorie, impact, urgence) puis l\'attribuer.', 'Dans Rôles et droits, le droit « Approuver un changement » appartient au Responsable.'],
    solution: [
      { do: 'itsm.actAs', args: { user: '@usr:Alice' } }, answer('denied', 1), { do: 'itsm.actAs', args: { user: '@usr:David' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', subcategory: 'Poste de travail', impact: 'low', urgency: 'medium', assignee: '@usr:David' } }, as: '@usr:David' },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' }, as: '@usr:David' }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' }, as: '@usr:David' },
      answer('who', 2),
    ],
    realWorld: 'Le RBAC (Role-Based Access Control) est présent dans tous les outils : rôles ITIL de ServiceNow (itil, itil_admin…), profils GLPI, groupes et permissions de Jira Service Management. La revue périodique des habilitations est un contrôle classique d\'audit.',
  },

  /* ============================ TP 34 ============================ */
  {
    id: 'tp-34-nouveau-technicien', number: 34, title: 'Accueillir un nouveau technicien', level: 8, levelLabel: level(8), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Karim Benali rejoint le service informatique comme technicien. Un ticket urgent l\'attend. Vous êtes administrateur : créez son compte et donnez-lui exactement les droits nécessaires.',
    stages: [
      { id: 's1', title: 'Créer le compte et attribuer le rôle', objectives: ['why', 'account', 'role'],
        lesson: ['Arrivée d\'un collaborateur = **provisionnement** : création du compte, attribution des rôles. On part du **moindre privilège** : le rôle **Technicien** suffit pour traiter des tickets ; il n\'a besoin ni de gérer les comptes ni d\'approuver des changements.', 'Un compte porte une **identité** (nom, service) et des **rôles**. Le rôle « Utilisateur » reste utile : Karim ouvre aussi ses propres tickets.'],
        debrief: ['Un compte, des rôles : à l\'arrivée d\'une personne on ne copie pas les droits d\'un collègue, on donne un rôle adapté au poste.'] },
      { id: 's2', title: 'Vérifier en conditions réelles', objectives: ['assign', 'lea'],
        lesson: ['La preuve qu\'un droit est bien donné : la personne peut faire le travail. Attribuez le ticket à Karim. Et inversement, vérifiez qu\'on n\'a pas donné trop : un administrateur technique n\'a pas à traiter les tickets.'],
        debrief: ['Donner les droits, c\'est aussi vérifier qu\'on n\'en a pas donné trop.'] },
    ],
    setup: [{ do: 'itsm.createTicket', args: { title: 'Le Wi-Fi du 2e étage est coupé', description: 'Appel de Chloé : plus de Wi-Fi depuis 9 h.', requester: '@usr:Chloé', kind: 'incident' }, as: '@usr:Chloé' }, { do: 'itsm.actAs', args: { user: '@usr:Léa' } }],
    objectives: [
      { id: 'why', label: 'Justifier le rôle à attribuer', question: { prompt: 'Quel rôle donner à Karim pour qu\'il traite les tickets, sans excès de droits ?', choices: ['Administrateur : il pourra tout faire', 'Technicien (en plus d\'Utilisateur)', 'Responsable, pour qu\'il approuve ses propres changements', 'Aucun rôle : on lui prêtera le compte de David'], correct: 1, explain: 'Technicien couvre l\'exploitation. Administrateur et Responsable donneraient des pouvoirs inutiles. Et on ne partage jamais un compte : la traçabilité disparaîtrait.' } },
      { id: 'account', label: 'Le compte de Karim Benali existe (service Informatique)', check: { k: 'didAs', user: '@usr:Léa', type: 'UserAdded' }, requires: ['why'] },
      { id: 'role', label: 'Karim est Utilisateur et Technicien, sans rôle d\'administration', check: { k: 'userRoles', user: '@usr:Karim', has: ['user', 'technician'], lacks: ['admin', 'manager'] }, requires: ['account'] },
      { id: 'assign', label: 'Le ticket du Wi-Fi est attribué à Karim', check: { k: 'ticket', ref: T(1), assignee: '@usr:Karim' }, requires: ['role'] },
      { id: 'lea', label: 'Comprendre pourquoi Léa (administratrice) n\'a pas attribué le ticket elle-même', requires: ['assign'], question: { prompt: 'Léa est administratrice. Pourquoi ne peut-elle pas qualifier ni attribuer les tickets ?', choices: ['C\'est un oubli de l\'outil', 'Séparation des fonctions : celle qui gère les droits n\'exploite pas les tickets', 'Elle n\'est pas dans le service informatique', 'Ce droit est réservé aux nouveaux arrivants'], correct: 1, explain: 'Séparer administration et exploitation limite les abus : un administrateur ne peut pas à la fois se donner des droits et agir avec.' } },
    ],
    hints: [
      { for: 'account', levels: ['ITSM → Administration → Utilisateurs : « Nouvel utilisateur ».'] },
      { for: 'role', levels: ['Dans la fiche de Karim, cochez les rôles. Attention : le moins de droits possible.'] },
      { for: 'assign', levels: ['Pour attribuer, il faut le droit « Attribuer un ticket » : passez en David (technicien) ou en mode formateur.'] },
    ],
    solutionText: ['Créer Karim Benali (Informatique) avec les rôles Utilisateur et Technicien.', 'Passer en David (technicien) et attribuer le ticket à Karim.', 'Léa gère les comptes mais n\'exploite pas : c\'est la séparation des fonctions.'],
    solution: [
      answer('why', 1), { do: 'itsm.addUser', args: { name: 'Karim Benali', service: 'Informatique', roles: ['user', 'technician'] }, as: '@usr:Léa' },
      { do: 'itsm.actAs', args: { user: '@usr:David' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Réseau', subcategory: 'Wi-Fi', impact: 'medium', urgency: 'high', assignee: '@usr:Karim' } }, as: '@usr:David' },
      answer('lea', 1),
    ],
    realWorld: 'Le provisionnement (onboarding) crée le compte et ses rôles selon le poste, souvent par un annuaire (Active Directory, Entra ID) synchronisé avec l\'outil ITSM. Les rôles sont donnés par modèle de poste, pas par copie d\'un collègue.',
  },

  /* ============================ TP 35 ============================ */
  {
    id: 'tp-35-separation-des-taches', number: 35, title: 'Séparation des tâches', level: 8, levelLabel: level(8), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'David Petit (technicien) a préparé le changement CHG-0001 : le remplacement de SW02. Il aimerait l\'approuver lui-même pour gagner du temps. Faites respecter la règle : qui demande ne valide pas.',
    stages: [
      { id: 's1', title: 'Constater le blocage', objectives: ['david', 'why'],
        lesson: ['Dans ITIL, un changement est **évalué puis autorisé** par quelqu\'un d\'autre que celui qui le demande (le responsable, ou un comité, le **CAB**). C\'est la **séparation des tâches** : on évite qu\'une seule personne décide, exécute et valide.', 'Agissez en tant que **David**, et essayez d\'approuver CHG-0001 : l\'outil refuse.'],
        debrief: ['Deux raisons au refus : le rôle Technicien n\'a pas le droit d\'approuver, et même un responsable n\'approuverait pas son propre changement.'] },
      { id: 's2', title: 'Faire approuver par le bon rôle', objectives: ['eric', 'approved'],
        lesson: ['Passez en **Éric Moreau** (Responsable) : il peut approuver, car il n\'est pas le demandeur. La décision est journalisée à son nom.'],
        debrief: ['Le journal d\'audit conserve : demandé par David, approuvé par Éric. Deux personnes, deux responsabilités.'] },
    ],
    setup: [
      { do: 'infra.setIp', args: { id: '@dev:SW02', ip: '192.168.10.2', mask: 24 } }, DISCOVER,
      { do: 'itsm.createChange', args: { title: 'Remplacement de SW02', type: 'normal', assetIds: ['@ast:SW02'] }, as: '@usr:David' },
      { do: 'itsm.updateChange', args: { id: '@chg:CHG-0001', fields: { risk: 'medium', plan: 'Remplacer le switch, rebrancher, vérifier.', rollback: 'Remettre l\'ancien switch.', approver: '@usr:Éric' } }, as: '@usr:David' },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'proposed' }, as: '@usr:David' },
    ],
    objectives: [
      { id: 'david', label: 'Vous agissez en tant que David Petit', check: { k: 'actedAs', user: '@usr:David' } },
      { id: 'why', label: 'Justifier l\'interdiction d\'approuver son propre changement', requires: ['david'], question: { prompt: 'Pourquoi David ne peut-il pas approuver CHG-0001 lui-même ?', choices: ['Il n\'est pas assez ancien', 'Parce que celui qui demande un changement ne doit pas être celui qui l\'autorise', 'Parce que le changement est trop risqué', 'Parce que l\'outil est en maintenance'], correct: 1, explain: 'La séparation des tâches évite qu\'une seule personne contrôle toute la chaîne : erreur ou malveillance seraient plus difficiles à détecter.' } },
      { id: 'eric', label: 'Vous agissez en tant qu\'Éric Moreau (responsable)', check: { k: 'actedAs', user: '@usr:Éric' }, requires: ['why'] },
      { id: 'approved', label: 'CHG-0001 est approuvé, par Éric', check: { k: 'all', of: [{ k: 'change', ref: '@chg:CHG-0001', reached: 'approved' }, { k: 'didAs', user: '@usr:Éric', type: 'ChangeStatusChanged', payload: { to: 'approved' } }] }, requires: ['eric'] },
    ],
    hints: [
      { for: 'approved', levels: ['Fiche du changement : le bouton « Approuver » n\'apparaît que s\'il est possible, sinon un message explique pourquoi.'] },
    ],
    solutionText: ['En tant que David, l\'approbation est refusée (droit manquant).', 'En tant qu\'Éric, approuver CHG-0001.'],
    solution: [{ do: 'itsm.actAs', args: { user: '@usr:David' } }, answer('why', 1), { do: 'itsm.actAs', args: { user: '@usr:Éric' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'approved' }, as: '@usr:Éric' }],
    realWorld: 'La séparation des tâches (Segregation of Duties) est un principe de contrôle interne : elle figure dans ITIL, ISO 27001 (A.5.3) et les audits financiers. Les outils l\'appliquent par des règles « le demandeur ne peut pas approuver ».',
  },

  /* ============================ TP 36 ============================ */
  {
    id: 'tp-36-depart-technicien', number: 36, title: 'Le départ d\'un technicien', level: 8, levelLabel: level(8), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'David Petit quitte NovaTech aujourd\'hui. Il traite encore un ticket. Désactivez son accès sans casser le service : le ticket doit repasser à un autre technicien, et son compte ne doit plus pouvoir agir.',
    stages: [
      { id: 's1', title: 'Sécuriser le service', objectives: ['why', 'tech', 'reassign'],
        lesson: ['Un départ est un risque : un compte actif sans titulaire peut être détourné. Mais désactiver trop vite laisse des **tickets orphelins**. Ordre sûr : d\'abord **préserver le travail en cours**, puis couper l\'accès.', 'Karim Benali, autre technicien, est disponible. Attribuez-lui le ticket de David **avant** de désactiver le compte.'],
        debrief: ['Un ticket attribué à un compte désactivé ne sera jamais traité : l\'outil refuse d\'ailleurs d\'attribuer un ticket à un compte désactivé.'] },
      { id: 's2', title: 'Couper l\'accès', objectives: ['disable', 'trace'],
        lesson: ['On **désactive** le compte plutôt que de le supprimer : l\'historique (qui a fait quoi) reste intact. Le compte désactivé ne peut plus se connecter ni recevoir de ticket. Retirer ses rôles est une mesure de plus (défense en profondeur).'],
        debrief: ['Désactiver, c\'est conserver la traçabilité tout en supprimant le risque.'] },
    ],
    setup: [
      { do: 'itsm.addUser', args: { name: 'Karim Benali', service: 'Informatique', roles: ['user', 'technician'] } },
      { do: 'itsm.createTicket', args: { title: 'Sauvegarde nocturne en échec', description: 'Le rapport de sauvegarde indique une erreur depuis deux nuits.', requester: '@usr:Éric', kind: 'incident' }, as: '@usr:Éric' },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Logiciel', subcategory: 'Dysfonctionnement', impact: 'medium', urgency: 'medium', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } },
    ],
    objectives: [
      { id: 'why', label: 'Justifier l\'ordre des opérations', question: { prompt: 'Que faire en premier lorsque David part ?', choices: ['Supprimer son compte tout de suite', 'Réattribuer son ticket en cours, puis désactiver son compte', 'Désactiver son compte et prévenir les clients plus tard', 'Ne rien changer : il part ce soir'], correct: 1, explain: 'On sécurise d\'abord la continuité de service (ticket réattribué), puis on coupe l\'accès. On désactive, on ne supprime pas : l\'historique doit rester.' } },
      { id: 'tech', label: 'Karim Benali (technicien) existe et est actif', check: { k: 'all', of: [{ k: 'userRoles', user: '@usr:Karim', has: ['technician'] }, { k: 'userActive', user: '@usr:Karim', value: true }] }, requires: ['why'] },
      { id: 'reassign', label: 'Le ticket de David est repris par Karim', check: { k: 'ticket', ref: T(1), assignee: '@usr:Karim' }, requires: ['tech'] },
      { id: 'disable', label: 'Le compte de David est désactivé, sans ticket ouvert à son nom', check: { k: 'all', of: [{ k: 'userActive', user: '@usr:David', value: false }, { k: 'noOpenAssigned', user: '@usr:David' }] }, requires: ['reassign'] },
      { id: 'trace', label: 'L\'historique de David reste consultable', requires: ['disable'], question: { prompt: 'Pourquoi désactiver le compte de David plutôt que le supprimer ?', choices: ['Pour garder une licence active', 'Pour conserver la trace de ce qu\'il a fait (audit)', 'Parce que la suppression est impossible dans tous les outils', 'Pour qu\'il puisse revenir sans prévenir'], correct: 1, explain: 'Les événements du journal portent le nom de leur auteur : supprimer le compte rendrait l\'historique anonyme.' } },
    ],
    forbid: [{ event: 'UserRolesChanged', message: 'Retirer les rôles n\'est pas demandé ici : la désactivation suffit à couper l\'accès sans perdre le contexte.' }],
    hints: [
      { for: 'reassign', levels: ['Fiche du ticket : champ « Assigné à ». Karim a le rôle technicien.'] },
      { for: 'disable', levels: ['ITSM → Administration → Utilisateurs : bouton « Désactiver » sur la ligne de David.'] },
    ],
    solutionText: ['Attribuer le ticket à Karim Benali.', 'Désactiver le compte de David (sans supprimer ni retirer ses rôles).'],
    solution: [answer('why', 1), { do: 'itsm.updateTicket', args: { id: T(1), fields: { assignee: '@usr:Karim' } } }, { do: 'itsm.setUserActive', args: { id: '@usr:David', active: false } }, answer('trace', 1)],
    realWorld: 'L\'offboarding (départ) désactive le compte dans l\'annuaire, révoque les accès, récupère le matériel (voir TP 30) et transfère le travail en cours. Les outils conservent les comptes désactivés pour l\'historique.',
  },
  /* ============================ TP 1 ============================ */
  {
    id: 'tp-01-decouvrir-le-si', number: 1, title: 'Découvrir le SI de NovaTech', level: 1, levelLabel: level(1), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'Premier jour chez NovaTech, une PME de 45 personnes. Le schéma montre les équipements du siège, mais le Parc de l\'outil ITSM est vide. Comprenez pourquoi, et faites en sorte que l\'outil connaisse le réseau.',
    stages: [
      stage('s1', 'Deux représentations d\'un même SI', ['q1'], ['Le **schéma** (vue Infrastructure) montre ce qui **existe** : équipements, câbles, adresses IP. Le **Parc** (vue ITSM) montre ce que **l\'outil en sait**. Ce sont deux choses différentes, qui ne se rejoignent que par la collecte.', 'Au départ, rien n\'a été collecté : les équipements existent mais l\'outil les ignore.'], ['Retenez cette idée : *ce qui existe* et *ce que l\'outil en sait* ne sont pas synchronisés par magie.']),
      stage('s2', 'Faire connaître le réseau à l\'outil', ['discover', 'q2'], ['La **découverte réseau** scanne une plage d\'adresses (ici `192.168.10.0/24`) et crée un actif pour chaque équipement qui répond. Elle ne voit que ce qui est visible depuis le réseau : un nom, une adresse IP, une adresse MAC, un constructeur.', 'Menu ITSM → Inventaire → Découverte réseau.'], ['Un actif « découvert » est un début, pas un inventaire complet : l\'utilisateur, le numéro de série ou les logiciels restent inconnus.']),
    ],
    setup: [],
    objectives: [
      { id: 'q1', label: 'Expliquer pourquoi le Parc est vide', question: Q('Le schéma montre PC21, PC22 et PC23, mais le Parc ITSM est vide. Pourquoi ?', ['Les PC sont éteints', 'Personne n\'a encore collecté ces équipements : l\'outil ne connaît que ce qu\'on lui remonte', 'Le Parc ne montre que les serveurs', 'Les PC n\'appartiennent pas à NovaTech'], 1, 'Un équipement qui existe n\'apparaît dans l\'outil qu\'après une découverte, un agent ou une saisie.') },
      { id: 'discover', label: 'PC21, PC22 et PC23 apparaissent dans le Parc', check: { k: 'all', of: ['PC21', 'PC22', 'PC23'].map(n => ({ k: 'assetExists' as const, device: `@dev:${n}` })) }, requires: ['q1'] },
      { id: 'q2', label: 'Dire ce que la découverte ne sait pas', requires: ['discover'], question: Q('Après la découverte, que ne connaît toujours pas l\'outil à propos de PC21 ?', ['Son adresse IP', 'Son adresse MAC', 'Les logiciels installés et l\'utilisateur', 'Son nom d\'hôte'], 2, 'La découverte voit le réseau (IP, MAC, nom). Logiciels et utilisateur demandent un agent installé sur le poste.') },
    ],
    hints: [{ for: 'discover', levels: ['Menu ITSM → Inventaire → Découverte réseau : saisissez la plage et lancez le scan.'] }],
    solutionText: ['Lancer la découverte réseau sur 192.168.10.0/24.', 'Constater les informations partielles : nom, IP, MAC, constructeur.'],
    solution: [answer('q1', 1), DISCOVER, answer('q2', 2)],
    realWorld: 'La découverte (network discovery) est le premier mode d\'alimentation d\'une base de gestion de parc : OCS Inventory, GLPI Network Discovery, ServiceNow Discovery. Elle est complétée par des agents pour obtenir le détail.',
  },

  /* ============================ TP 2 ============================ */
  {
    id: 'tp-02-ajouter-du-materiel', number: 2, title: 'Ajouter du matériel', level: 1, levelLabel: level(1), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'NovaTech reçoit un nouveau poste et un nouveau switch pour l\'agence. Posez-les sur le schéma et câblez-les. Observez ensuite ce que l\'outil ITSM en sait.',
    stages: [
      stage('s1', 'Poser et câbler', ['pc', 'sw', 'cable'], ['Dans la vue Infrastructure, glissez un **PC fixe** et un **switch** depuis la palette, puis utilisez l\'outil **Câble** : un clic sur chaque équipement, avec le choix du port.', 'Un équipement qu\'on pose existe immédiatement dans la réalité simulée.'], ['Poser un équipement, c\'est créer de la réalité. L\'outil de gestion n\'en est pas informé pour autant.']),
      stage('s2', 'Ce que l\'outil en sait', ['q'], ['Ouvrez ITSM → Parc : vos deux équipements n\'y figurent pas. Le Dashboard les signale comme « inconnus de l\'outil ». C\'est exactement la situation d\'un matériel branché sans être enregistré.'], ['Un équipement non enregistré échappe à la maintenance, aux licences, à la sécurité : c\'est le premier risque d\'un parc mal tenu.']),
    ],
    setup: [],
    objectives: [
      { id: 'pc', label: 'Un nouveau PC fixe est posé sur le schéma', check: { k: 'newDevices', kind: 'workstation', min: 1 } },
      { id: 'sw', label: 'Un nouveau switch est posé sur le schéma', check: { k: 'newDevices', kind: 'switch', min: 1 } },
      { id: 'cable', label: 'Un câble relie les nouveaux équipements', check: { k: 'cabled', min: 1 }, requires: ['pc', 'sw'] },
      { id: 'q', label: 'Expliquer pourquoi l\'outil ignore ces équipements', requires: ['cable'], question: Q('Le PC et le switch sont câblés mais absents du Parc. Pourquoi ?', ['L\'outil est en panne', 'Un équipement posé existe dans la réalité, mais l\'outil ne le connaît qu\'après découverte, agent ou saisie', 'Les équipements neufs sont masqués 24 heures', 'Il faut redémarrer l\'application'], 1, 'Réalité et connaissance de gestion sont deux couches distinctes : seule la collecte les rapproche.') },
    ],
    hints: [{ for: 'pc', levels: ['Glissez « PC fixe » depuis la palette de gauche sur le schéma.'] }, { for: 'cable', levels: ['Outil « Câble » (touche C) : cliquez sur le PC, choisissez le port, puis cliquez sur le switch.'] }],
    solutionText: ['Poser un PC fixe et un switch, les relier par un câble.', 'Constater qu\'ils sont absents du Parc : ils existent, l\'outil ne le sait pas.'],
    solution: [{ do: 'infra.addDevice', args: { kind: 'workstation', name: 'PC-NEW', x: 200, y: 600 } }, { do: 'infra.addDevice', args: { kind: 'switch', name: 'SW-NEW', x: 400, y: 600 } }, { do: 'infra.connect', args: { aDevice: '@dev:PC-NEW', aPort: 'eth0', bDevice: '@dev:SW-NEW', bPort: 'port1' } }, answer('q', 1)],
    realWorld: 'Les « shadow IT » et équipements non déclarés sont un risque classique : la découverte réseau et le rapprochement avec le parc déclaré servent à les détecter.',
  },

  /* ============================ TP 3 ============================ */
  {
    id: 'tp-03-comprendre-les-vues', number: 3, title: 'Comprendre les deux vues', level: 1, levelLabel: level(1), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'Chloé signale que son poste PC22 ne répond plus. Pour comprendre ce qui se passe, il faut passer de la vue Infrastructure (la réalité) à la vue ITSM (la gestion) et inversement.',
    stages: [
      stage('s1', 'Qui montre quoi ?', ['q1'], ['**Infrastructure** : câbles, alimentation, adresse IP, état réel. **ITSM** : numéro d\'inventaire, utilisateur, tickets, historique. Le même PC22 existe dans les deux vues, sous deux angles.', 'Dans la fiche d\'un actif, le lien **Voir dans l\'infrastructure** ouvre l\'équipement correspondant sur le schéma, et inversement.'], ['Une panne se comprend sur le schéma ; ses conséquences pour l\'utilisateur se suivent dans l\'outil.']),
      stage('s2', 'Relier un incident à un équipement', ['ticket', 'q2'], ['Créez un ticket pour Chloé depuis la fiche de PC22 (ITSM → Parc → PC22 → « Créer un ticket »). Le ticket garde un **lien** avec l\'actif : on peut alors passer du ticket à l\'équipement.'], ['Le lien ticket ↔ actif est la clé de tout le diagnostic : sans lui, un ticket est une simple phrase.']),
    ],
    setup: [DISCOVER, { do: 'itsm.assignAsset', args: { id: '@ast:PC22', user: '@usr:Chloé' } }],
    objectives: [
      { id: 'q1', label: 'Repérer dans quelle vue se trouve chaque information', question: Q('Où voit-on si le câble du PC22 est branché ?', ['Dans la fiche d\'actif ITSM', 'Dans la vue Infrastructure, sur le schéma', 'Dans la base de connaissances', 'Dans le journal des tickets'], 1, 'Le câblage appartient à la réalité : il se voit sur le schéma. L\'outil le déduit à travers la joignabilité.') },
      { id: 'ticket', label: 'Un ticket de Chloé désigne le poste PC22', check: { k: 'ticket', ref: T(1), requester: '@usr:Chloé', linkedDevice: '@dev:PC22' }, requires: ['q1'] },
      { id: 'q2', label: 'Dire à quoi sert le lien ticket ↔ actif', requires: ['ticket'], question: Q('À quoi sert le lien entre un ticket et un actif ?', ['À décorer la fiche', 'À retrouver l\'équipement concerné, son état réel et l\'historique de ses incidents', 'À calculer la garantie', 'À envoyer un courriel'], 1, 'Le lien permet d\'aller du ticket à l\'équipement réel et de regrouper les incidents d\'un même actif.') },
    ],
    hints: [{ for: 'ticket', levels: ['ITSM → Parc → PC22 → « Créer un ticket » : l\'actif est déjà lié.'] }],
    solutionText: ['Créer un ticket au nom de Chloé en liant PC22.', 'Le lien relie le ticket à l\'équipement réel et à son historique.'],
    solution: [answer('q1', 1), { do: 'itsm.createTicket', args: { title: 'PC22 ne répond plus', description: 'Chloé signale que son poste ne répond plus depuis ce matin.', requester: '@usr:Chloé', kind: 'incident', assetIds: ['@ast:PC22'] } }, answer('q2', 1)],
    realWorld: 'Dans tous les outils ITSM, un ticket peut référencer un ou plusieurs CI/actifs (champ « Configuration item » dans ServiceNow, « Éléments associés » dans GLPI).',
  },

  /* ============================ TP 4 ============================ */
  {
    id: 'tp-04-identifier-un-actif', number: 4, title: 'Identifier un actif', level: 1, levelLabel: level(1), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'Le poste PC-COMPTA-01 est dans le Parc, mais sa fiche est quasi vide : ni numéro d\'inventaire, ni numéro de série, ni garantie. Si le disque tombe en panne demain, personne ne saura s\'il est couvert.',
    stages: [
      stage('s1', 'Comment l\'outil reconnaît un équipement', ['q'], ['Pour ne pas créer de doublons, l\'outil rapproche chaque remontée d\'un actif par une **identité** : d\'abord l\'**adresse MAC**, puis le nom d\'hôte, puis l\'adresse IP. La MAC est unique par carte réseau : c\'est la clé la plus fiable.'], ['Un nom peut changer, une adresse IP aussi : l\'adresse MAC reste.']),
      stage('s2', 'Compléter la fiche', ['data'], ['Les informations qu\'aucun agent ne peut lire se **saisissent** : numéro d\'inventaire (étiquette collée sur le poste), numéro de série, date de fin de garantie. Elles sont **déclaratives** : leur justesse dépend de celui qui les saisit.', 'Renseignez dans la fiche de PC-COMPTA-01 : n° d\'inventaire `NT-0042`, série `SN-48213`, et une fin de garantie (section Cycle de vie).'], ['Une fiche complète répond à « de quoi s\'agit-il, où est-il, est-il couvert ? » sans se déplacer.']),
    ],
    setup: [DISCOVER],
    objectives: [
      { id: 'q', label: 'Dire quelle clé identifie un équipement', question: Q('Quelle information l\'outil utilise-t-il en priorité pour reconnaître un équipement déjà connu ?', ['Son nom', 'Son adresse MAC', 'Son utilisateur', 'Sa couleur sur le schéma'], 1, 'La MAC identifie la carte réseau : elle évite les doublons quand un nom ou une IP change.') },
      { id: 'data', label: 'PC-COMPTA-01 a un numéro d\'inventaire, un numéro de série et une fin de garantie', check: { k: 'assetData', asset: '@ast:PC-COMPTA-01', has: ['inventoryNo', 'serial', 'warrantyEnd'] }, requires: ['q'] },
    ],
    hints: [{ for: 'data', levels: ['Fiche de l\'actif : section « Données déclarées » et « Cycle de vie » (garantie).'] }],
    solutionText: ['Saisir numéro d\'inventaire et numéro de série dans la fiche.', 'Renseigner la fin de garantie dans les données financières.'],
    solution: [answer('q', 1), { do: 'itsm.updateAsset', args: { id: '@ast:PC-COMPTA-01', fields: { inventoryNo: 'NT-0042', serial: 'SN-48213' } } }, { do: 'itsm.updateAssetFinance', args: { id: '@ast:PC-COMPTA-01', fields: { warrantyEnd: 1095 * DAY } } }],
    realWorld: 'Le numéro d\'inventaire (étiquette) et le numéro de série constructeur sont la base de la gestion de garantie et des déclarations de sinistre.',
  },

  /* ============================ TP 5 ============================ */
  {
    id: 'tp-05-affecter-un-utilisateur', number: 5, title: 'Affecter un utilisateur', level: 1, levelLabel: level(1), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Gérer les habilitations', kind: 'worked' }],
    context: 'Le poste PC-COMPTA-01 est utilisé par Alice Martin. Dans l\'outil, il n\'a pas de propriétaire. Affectez-le, et comprenez la différence entre la personne à qui le poste est affecté et celle qui y est connectée.',
    stages: [
      stage('s1', 'Affecter', ['assign'], ['Une **affectation** relie un actif à un utilisateur (et, par lui, à un service). C\'est une donnée de gestion : elle dit *qui est responsable* du matériel. Dans la fiche de l\'actif : champ « Affecté à ».'], ['L\'affectation sert à joindre la bonne personne, à calculer le coût par service et à faire une restitution au départ.']),
      stage('s2', 'Affecté n\'est pas connecté', ['q'], ['L\'**utilisateur connecté** vient de l\'agent (réalité) ; l\'**utilisateur affecté** vient de la saisie (gestion). Ils peuvent différer : un poste partagé, un prêt, un oubli de mise à jour.'], ['Quand les deux divergent, c\'est un signal à vérifier : le poste a peut-être changé de mains sans être enregistré.']),
    ],
    setup: [{ do: 'agent.install', args: { id: '@dev:PC-COMPTA-01' } }, { advance: 10 * MIN }, DISCOVER],
    objectives: [
      { id: 'assign', label: 'PC-COMPTA-01 est affecté à Alice Martin (Comptabilité)', check: { k: 'asset', asset: '@ast:PC-COMPTA-01', assignedTo: '@usr:Alice' } },
      { id: 'q', label: 'Distinguer utilisateur affecté et utilisateur connecté', requires: ['assign'], question: Q('Quelle est la différence entre « affecté à » et « utilisateur connecté » ?', ['Aucune, ce sont deux noms du même champ', 'L\'affectation est saisie dans l\'outil ; l\'utilisateur connecté est remonté par l\'agent depuis le poste', 'L\'affectation vient de l\'agent', 'L\'utilisateur connecté vient du contrat'], 1, 'Affectation = déclaré (gestion). Utilisateur connecté = observé (réalité). Leur écart est un indice.') },
    ],
    hints: [{ for: 'assign', levels: ['ITSM → Parc → PC-COMPTA-01 : champ « Affecté à ».'] }],
    solutionText: ['Affecter PC-COMPTA-01 à Alice Martin dans sa fiche.', 'Comparer avec l\'utilisateur connecté remonté par l\'agent.'],
    solution: [{ do: 'itsm.assignAsset', args: { id: '@ast:PC-COMPTA-01', user: '@usr:Alice' } }, answer('q', 1)],
    realWorld: 'L\'affectation (assignment) alimente les rapports par service et les procédures d\'arrivée/départ ; la dernière session ouverte, remontée par l\'agent, sert de contrôle de cohérence.',
  },

  /* ============================ TP 7 ============================ */
  {
    id: 'tp-07-premiere-remontee', number: 7, title: 'Première remontée d\'inventaire', level: 2, levelLabel: level(2), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    timeNote: 'Sans action de votre part, l\'agent remonte tout seul à l\'heure prévue. Avancez l\'horloge pour constater qu\'un inventaire se met à jour avec le temps, au lieu de seulement forcer la remontée.',
    context: 'L\'agent est installé sur PC21 mais n\'a pas encore remonté d\'informations. Forcez une remontée et observez ce qui change dans la fiche de l\'actif.',
    stages: [
      stage('s1', 'Avant la remontée', ['before'], ['Tant que l\'agent n\'a rien remonté, la fiche ne contient que ce que la découverte a vu : nom, IP, MAC. Pas de système d\'exploitation, pas de logiciels, pas d\'utilisateur.'], ['Une fiche partielle n\'est pas fausse, elle est incomplète : savoir ce qu\'on ne sait pas est déjà de l\'inventaire.']),
      stage('s2', 'Forcer l\'inventaire', ['run', 'source'], ['L\'agent lit la machine (système, matériel, logiciels, session) et l\'envoie à l\'outil. Dans la fiche de l\'actif, chaque information porte sa **provenance** : « agent » ou « manuel ». Une donnée remontée par l\'agent n\'est jamais saisie à la main.', 'Fiche de PC21 → « Forcer l\'inventaire », ou vue Infrastructure → PC21 → Agent.'], ['L\'agent remplace la saisie manuelle par une lecture directe : c\'est plus rapide et surtout plus fiable.']),
    ],
    setup: [{ do: 'agent.install', args: { id: '@dev:PC21' } }, DISCOVER],
    objectives: [
      { id: 'before', label: 'Dire ce que contient la fiche avant la première remontée', question: Q('Avant l\'inventaire, que sait l\'outil de PC21 ?', ['Tout : logiciels, utilisateur, matériel', 'Seulement ce que la découverte réseau a vu (nom, IP, MAC)', 'Rien du tout', 'Uniquement son numéro de série'], 1, 'La découverte ne voit que le réseau. L\'agent apporte le reste.') },
      { id: 'run', label: 'L\'inventaire de PC21 est remonté', check: { k: 'assetInventoried', device: '@dev:PC21' }, requires: ['before'] },
      { id: 'source', label: 'Identifier d\'où viennent les nouvelles informations', requires: ['run'], question: Q('D\'où viennent le système d\'exploitation et la liste des logiciels de PC21 ?', ['D\'une saisie manuelle', 'De l\'agent, qui les lit sur le poste', 'Du contrat de maintenance', 'De la découverte réseau'], 1, 'L\'agent lit directement la machine : la provenance « agent » est affichée dans la fiche.') },
    ],
    hints: [{ for: 'run', levels: ['Fiche de PC21 : bouton « Forcer l\'inventaire ».'] }],
    solutionText: ['Forcer l\'inventaire de PC21.', 'Constater la provenance « agent » des nouvelles informations.'],
    solution: [answer('before', 1), { do: 'agent.runInventory', args: { id: '@dev:PC21' } }, answer('source', 1)],
    realWorld: 'Les agents d\'inventaire (GLPI Agent, OCS, Intune, SCCM) remontent périodiquement le matériel, le système, les logiciels et la session ; chaque champ a une source et une date.',
  },

  /* ============================ TP 9 ============================ */
  {
    id: 'tp-09-equipement-sans-agent', number: 9, title: 'Équipement sans agent', level: 2, levelLabel: level(2), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'L\'imprimante IMP-COMPTA est dans le Parc grâce à la découverte, mais aucun agent ne peut y tourner. Sa fiche doit pourtant être exploitable : numéro d\'inventaire, série, modèle.',
    stages: [
      stage('s1', 'Pourquoi pas d\'agent ?', ['q1'], ['Un agent est un programme : il faut un système d\'exploitation capable de l\'exécuter. Un **switch**, une **imprimante**, un **NAS** ou un téléphone IP n\'en accueillent pas. L\'outil ne les connaît que par la **découverte réseau** (ou d\'autres protocoles, comme SNMP, hors du périmètre de ce simulateur).'], ['Pour ces équipements, tout ce qui dépasse l\'identité réseau est **saisi à la main**.']),
      stage('s2', 'Compléter à la main, en connaissance de cause', ['manual', 'q2'], ['Renseignez dans la fiche d\'IMP-COMPTA : numéro d\'inventaire `NT-0077`, série `SN-70512`. Remarquez l\'absence d\'indication « remonté par l\'agent » : ces données sont déclaratives.'], ['Une donnée saisie vieillit : si l\'imprimante est remplacée, personne ne mettra la fiche à jour automatiquement.']),
    ],
    setup: [DISCOVER],
    objectives: [
      { id: 'q1', label: 'Expliquer l\'absence d\'agent sur une imprimante', question: Q('Pourquoi ne peut-on pas installer d\'agent sur IMP-COMPTA ?', ['L\'agent est payant', 'L\'équipement n\'a pas de système capable d\'exécuter un agent', 'L\'imprimante est éteinte', 'Les imprimantes sont interdites sur le réseau'], 1, 'L\'agent est un logiciel : sans système hôte adapté, il n\'y a rien à installer.') },
      { id: 'manual', label: 'IMP-COMPTA a un numéro d\'inventaire et un numéro de série, sans données d\'agent', check: { k: 'assetData', asset: '@ast:IMP-COMPTA', has: ['inventoryNo', 'serial'], observed: false }, requires: ['q1'] },
      { id: 'q2', label: 'Mesurer le risque d\'une donnée saisie', requires: ['manual'], question: Q('Quel est le principal risque des données saisies à la main ?', ['Elles sont illisibles', 'Elles deviennent fausses sans que personne ne s\'en aperçoive', 'Elles sont supprimées chaque nuit', 'Elles coûtent une licence'], 1, 'Sans mise à jour automatique, une fiche manuelle se périme : il faut une procédure de vérification.') },
    ],
    hints: [{ for: 'manual', levels: ['Fiche de l\'actif IMP-COMPTA : « Données déclarées ».'] }],
    solutionText: ['Constater qu\'aucun agent n\'est possible sur une imprimante.', 'Saisir numéro d\'inventaire et série dans la fiche.'],
    solution: [answer('q1', 1), { do: 'itsm.updateAsset', args: { id: '@ast:IMP-COMPTA', fields: { inventoryNo: 'NT-0077', serial: 'SN-70512' } } }, answer('q2', 1)],
    realWorld: 'Pour les équipements réseau et les imprimantes, les outils réels interrogent par SNMP ; à défaut, la saisie manuelle est complétée par des campagnes de récolement (vérification physique).',
  },
  /* ============================ TP 11 ============================ */
  {
    id: 'tp-11-creer-un-ticket', number: 11, title: 'Créer un ticket', level: 3, levelLabel: level(3), difficulty: 1, duration: '25 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'Chloé Dubois appelle : « Excel se ferme tout seul quand j\'ouvre le fichier des ventes, depuis ce matin. » Vous êtes au service desk et devez saisir le ticket à sa place.',
    stages: [
      stage('s1', 'Ce qu\'est un bon ticket', ['good'], ['Un ticket est un **dossier** : celui qui le reprendra n\'était pas au téléphone. Il doit dire **qui** demande, **quoi** (symptôme observé, pas supposition), **depuis quand**, **sur quel équipement**. « Ça marche pas » est inexploitable ; « Excel se ferme à l\'ouverture du fichier ventes.xlsx depuis ce matin sur PC22 » l\'est.'], ['Un ticket bien rédigé évite un rappel au demandeur : c\'est du temps gagné pour tout le monde.']),
      stage('s2', 'Saisir', ['create'], ['ITSM → Tickets → « Nouveau ticket » : demandeur Chloé Dubois, un titre court, une description d\'au moins quelques phrases, et l\'équipement concerné (PC22).'], ['Le ticket est créé « Nouveau » : il reste à le qualifier (TP 12).']),
    ],
    setup: [DISCOVER, { do: 'itsm.assignAsset', args: { id: '@ast:PC22', user: '@usr:Chloé' } }],
    objectives: [
      { id: 'good', label: 'Reconnaître une description exploitable', question: Q('Quelle description est la plus utile au technicien ?', ['« Ça marche pas, urgent »', '« Excel se ferme à l\'ouverture de ventes.xlsx depuis ce matin, sur PC22 »', '« Chloé est de mauvaise humeur »', '« À voir »'], 1, 'Un bon ticket nomme le symptôme, le moment et l\'équipement, sans interprétation.') },
      { id: 'create', label: 'Un incident de Chloé est saisi, décrit et lié à PC22', check: { k: 'ticket', ref: T(1), kind: 'incident', requester: '@usr:Chloé', descMin: 40, linkedAsset: '@ast:PC22' }, requires: ['good'] },
    ],
    hints: [{ for: 'create', levels: ['Choisissez Chloé comme demandeur et liez l\'actif PC22. Décrivez le symptôme en une ou deux phrases complètes.'] }],
    solutionText: ['Nouveau ticket au nom de Chloé : titre court, description du symptôme avec le contexte, actif PC22 lié.'],
    solution: [answer('good', 1), { do: 'itsm.createTicket', args: { title: 'Excel se ferme à l\'ouverture du fichier ventes', description: 'Excel se ferme tout seul à l\'ouverture de ventes.xlsx, depuis ce matin, sur le poste PC22 de Chloé.', requester: '@usr:Chloé', kind: 'incident', assetIds: ['@ast:PC22'] } }],
    realWorld: 'La qualité de la saisie initiale (« capture ») est le premier facteur de rapidité de résolution : les outils proposent des modèles de ticket et des champs obligatoires.',
  },

  /* ============================ TP 12 ============================ */
  {
    id: 'tp-12-qualifier-un-incident', number: 12, title: 'Qualifier un incident', level: 3, levelLabel: level(3), difficulty: 2, duration: '25 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'Le ticket INC-0001 de Chloé est arrivé : « Excel se ferme tout seul ». Il est « Nouveau », sans catégorie. Le service desk doit le qualifier avant que quiconque le traite.',
    stages: [
      stage('s1', 'Pourquoi qualifier', ['why'], ['Qualifier, c\'est **classer** (catégorie, sous-catégorie) et **mesurer** (impact, urgence). La catégorie oriente vers la bonne équipe et permet des statistiques (« combien d\'incidents logiciels ce mois-ci ? ») ; impact et urgence donnent la priorité.'], ['Un ticket non qualifié reste invisible dans les files de travail : personne ne sait à qui il revient ni s\'il est urgent.']),
      stage('s2', 'Qualifier INC-0001', ['qual'], ['Ouvrez INC-0001. Catégorie « Logiciel », sous-catégorie « Dysfonctionnement » : il s\'agit d\'un programme qui se comporte mal. Choisissez l\'impact (une seule personne : faible) et l\'urgence (elle peut travailler autrement : moyenne), puis « Qualifier ».'], ['Le ticket est maintenant prêt à être attribué à un technicien.']),
    ],
    setup: [DISCOVER, newIncident('Excel se ferme tout seul', 'Appel de Chloé à 9 h 10 : Excel se ferme à l\'ouverture du fichier des ventes, depuis ce matin.', 'Chloé')],
    objectives: [
      { id: 'why', label: 'Justifier la qualification', question: Q('Pourquoi qualifie-t-on un ticket avant de le traiter ?', ['Pour que le ticket paraisse plus long', 'Pour l\'orienter vers la bonne équipe et fixer sa priorité', 'Parce que le demandeur l\'exige', 'Pour le clore plus vite'], 1, 'Catégorie, impact et urgence orientent le ticket et déterminent sa priorité.') },
      { id: 'qual', label: 'INC-0001 est qualifié : Logiciel / Dysfonctionnement, impact et urgence renseignés', check: { k: 'ticket', ref: T(1), category: 'Logiciel', subcategory: 'Dysfonctionnement', qualified: true, status: 'qualified' }, requires: ['why'] },
    ],
    hints: [{ for: 'qual', levels: ['Fiche du ticket : catégorie, sous-catégorie, impact, urgence, puis « Qualifier ».'] }],
    solutionText: ['Catégorie Logiciel, sous-catégorie Dysfonctionnement, impact faible, urgence moyenne, puis passer le ticket à « Qualifié ».'],
    solution: [answer('why', 1), { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Logiciel', subcategory: 'Dysfonctionnement', impact: 'low', urgency: 'medium' } } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }],
    realWorld: 'La catégorisation (taxonomie) est un chantier à part entière : trop fine, elle n\'est pas utilisée ; trop grossière, elle ne sert à rien. Les outils la rendent configurable.',
  },

  /* ============================ TP 13 ============================ */
  {
    id: 'tp-13-associer-un-equipement', number: 13, title: 'Associer le bon équipement', level: 3, levelLabel: level(3), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    context: 'Alice appelle : « Je n\'arrive plus à imprimer les factures. » Le ticket est ouvert, mais aucun équipement n\'est lié. Quel équipement faut-il lier : le poste d\'Alice ou l\'imprimante ?',
    stages: [
      stage('s1', 'Choisir l\'actif concerné', ['which', 'link'], ['L\'actif à lier est celui qui **est en cause**, pas celui de la personne qui appelle. Alice utilise son PC pour imprimer, mais la panne vient (ou semble venir) de l\'**imprimante**. Lier le mauvais équipement fausse l\'historique et envoie le technicien au mauvais endroit.', 'Fiche du ticket → « Lier un actif ».'], ['Le ticket est maintenant rattaché au bon équipement : le technicien peut passer au schéma en un clic.']),
      stage('s2', 'Retrouver l\'historique', ['hist'], ['Chaque actif garde la liste des tickets qui le concernent. Si l\'imprimante tombe en panne souvent, cela se voit : c\'est la base d\'un **problème** (TP 23) ou d\'un remplacement.'], ['Le lien ticket ↔ actif fabrique l\'historique de chaque équipement.']),
    ],
    setup: [DISCOVER, newIncident('Impossible d\'imprimer les factures', 'Appel d\'Alice à 9 h 20 : plus rien ne sort de l\'imprimante de la comptabilité depuis ce matin.', 'Alice')],
    objectives: [
      { id: 'which', label: 'Choisir l\'équipement en cause', question: Q('Alice ne peut plus imprimer. Quel actif lie-t-on au ticket ?', ['Le PC d\'Alice, parce que c\'est elle qui appelle', 'L\'imprimante IMP-COMPTA, qui est en cause', 'Le serveur ITSM', 'Aucun : on ne lie jamais d\'actif'], 1, 'On lie l\'équipement concerné par la panne. Le PC d\'Alice peut être ajouté si l\'on a un doute, mais l\'imprimante est le sujet.') },
      { id: 'link', label: 'INC-0001 désigne l\'imprimante IMP-COMPTA', check: { k: 'ticket', ref: T(1), linkedAsset: '@ast:IMP-COMPTA' }, requires: ['which'] },
      { id: 'hist', label: 'Savoir où lire l\'historique d\'un actif', requires: ['link'], question: Q('Où retrouve-t-on tous les tickets passés d\'IMP-COMPTA ?', ['Dans le journal des agents', 'Dans la fiche de l\'actif, section tickets', 'Dans la base de connaissances', 'Nulle part'], 1, 'La fiche d\'actif liste ses tickets : historique de pannes et de réparations.') },
    ],
    hints: [{ for: 'link', levels: ['Ouvrez INC-0001, section « Actifs concernés » : « Lier un actif ».'] }],
    solutionText: ['Lier IMP-COMPTA (et non le PC d\'Alice) au ticket.', 'Consulter la fiche d\'IMP-COMPTA pour voir ses tickets.'],
    solution: [answer('which', 1), { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:IMP-COMPTA' } }, answer('hist', 1)],
    realWorld: 'Le lien ticket ↔ CI est ce qui permet les statistiques par équipement (« les 5 imprimantes qui causent 40 % des incidents ») et l\'analyse d\'impact.',
  },

  /* ============================ TP 15 ============================ */
  {
    id: 'tp-15-resoudre-un-incident', number: 15, title: 'Résoudre et clore un incident', level: 3, levelLabel: level(3), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'David a pris en charge le ticket d\'Alice : un mot de passe expiré, qu\'il vient de réinitialiser. Le ticket est « En cours ». À vous de le mener jusqu\'à la clôture, proprement.',
    stages: [
      stage('s1', 'Documenter la solution', ['why', 'solution'], ['On ne **résout** pas un ticket sans en dire la **solution** : l\'outil le refuse. Le texte sert de trace (que s\'est-il passé ?), de preuve (c\'est bien réglé) et de base de connaissances (la prochaine fois, on ira plus vite).'], ['Une solution écrite, c\'est la mémoire du service.']),
      stage('s2', 'Résoudre puis clore', ['resolved', 'closed'], ['**Résolu** : le technicien estime que c\'est réglé ; le demandeur peut encore le contester (le ticket peut être rouvert). **Clos** : plus aucune modification, le ticket est archivé.'], ['Résolu ≠ clos : la clôture est l\'accord final, et souvent automatique après quelques jours.']),
    ],
    setup: [DISCOVER, newIncident('Impossible de me connecter à ma session', 'Appel d\'Alice à 8 h 45 : son mot de passe est refusé ce matin.', 'Alice'),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Compte et accès', subcategory: 'Mot de passe', impact: 'low', urgency: 'medium', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } }],
    objectives: [
      { id: 'why', label: 'Justifier l\'obligation de documenter la solution', question: Q('Pourquoi l\'outil refuse-t-il de résoudre un ticket sans solution ?', ['Pour compliquer le travail', 'Pour garder la trace de ce qui a été fait et pouvoir le réutiliser', 'Parce que la solution est obligatoire pour l\'utilisateur', 'Pour augmenter le nombre de tickets'], 1, 'La solution est la mémoire du service : sans elle, le même incident se retraitera à l\'aveugle.') },
      { id: 'solution', label: 'La solution est documentée (au moins une phrase complète)', check: { k: 'ticket', ref: T(1), solutionMin: 30 }, requires: ['why'] },
      { id: 'resolved', label: 'INC-0001 est résolu', check: { k: 'ticket', ref: T(1), reached: 'resolved', solutionMin: 30 }, requires: ['solution'] },
      { id: 'closed', label: 'INC-0001 est clos', check: { k: 'ticket', ref: T(1), status: 'closed' }, requires: ['resolved'] },
    ],
    hints: [{ for: 'resolved', levels: ['Le bouton « Résoudre » se débloque quand la solution est renseignée.'] }],
    solutionText: ['Rédiger la solution (mot de passe réinitialisé, changement demandé à la prochaine connexion).', 'Passer le ticket à Résolu puis Clos.'],
    solution: [answer('why', 1), { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Mot de passe expiré : réinitialisé, changement demandé à la prochaine connexion.' } } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'closed' } }],
    realWorld: 'Dans les outils réels, on distingue « Resolved » et « Closed » : la clôture se fait après confirmation du demandeur ou automatiquement après un délai.',
  },

  /* ============================ TP 17 ============================ */
  {
    id: 'tp-17-serveur-arrete', number: 17, title: 'Serveur arrêté', level: 4, levelLabel: level(4), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Exploiter, dépanner et superviser une infrastructure', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'Alice appelle : « Le logiciel de facturation ne répond plus. » Il tourne sur le serveur SRV-FACT. La CMDB sait que le service « Facturation comptable » en dépend. Retrouvez la cause, remettez le serveur en service et documentez.',
    stages: [
      stage('s1', 'Du symptôme à la cause', ['diag', 'link'], ['Un symptôme (« la facturation ne répond plus ») renvoie à un **service**, qui dépend d\'un **équipement**. La CMDB fait ce lien. Observez SRV-FACT sur le schéma : est-il en ligne ? allumé ?', 'Liez le ticket à SRV-FACT, l\'équipement en cause.'], ['Remonter de la plainte à l\'équipement est le cœur du diagnostic.']),
      stage('s2', 'Rétablir et conclure', ['on', 'resolve'], ['Rallumez le serveur dans la vue Infrastructure, attendez qu\'il repasse en ligne, puis documentez et résolvez le ticket.'], ['Rétablir le service n\'est pas finir : la solution doit être écrite.']),
    ],
    setup: [
      { do: 'infra.addDevice', args: { kind: 'server', name: 'SRV-FACT', x: 96, y: 160 } }, { do: 'infra.connect', args: { aDevice: '@dev:SRV-FACT', aPort: 'eth0', bDevice: '@dev:SW-SIEGE-01', bPort: 'port5' } },
      { do: 'infra.setIp', args: { id: '@dev:SRV-FACT', ip: '192.168.10.30', mask: 24 } }, { do: 'agent.install', args: { id: '@dev:SRV-FACT' } }, { advance: 10 * MIN }, DISCOVER,
      { do: 'itsm.createCi', args: { name: 'SRV-FACT', kind: 'infrastructure', asset: '@ast:SRV-FACT' } }, { do: 'itsm.createCi', args: { name: 'Facturation comptable', kind: 'service' } },
      { do: 'itsm.addRelation', args: { from: '@ci:Facturation comptable', to: '@ci:SRV-FACT', type: 'depends_on' } },
      { do: 'infra.powerOff', args: { id: '@dev:SRV-FACT' } },
      newIncident('Le logiciel de facturation ne répond plus', 'Appel d\'Alice à 9 h 30 : impossible d\'ouvrir le logiciel de facturation, message « serveur introuvable ».', 'Alice'),
    ],
    objectives: [
      { id: 'diag', label: 'Identifier la cause probable', question: Q('Le logiciel de facturation ne répond plus et SRV-FACT est hors ligne. Quelle est la cause la plus probable ?', ['Le poste d\'Alice est cassé', 'Le serveur SRV-FACT est éteint ou injoignable', 'Le logiciel est périmé', 'La CMDB est vide'], 1, 'Le service dépend du serveur : un serveur hors ligne explique à lui seul la panne du service.') },
      { id: 'link', label: 'INC-0001 désigne SRV-FACT', check: { k: 'ticket', ref: T(1), linkedAsset: '@ast:SRV-FACT' }, requires: ['diag'] },
      { id: 'on', label: 'SRV-FACT est de nouveau en ligne', check: { k: 'deviceOnline', device: '@dev:SRV-FACT' }, requires: ['link'] },
      { id: 'resolve', label: 'INC-0001 est résolu avec une solution documentée', check: { k: 'ticket', ref: T(1), status: 'resolved', solutionMin: 30 }, requires: ['on'] },
    ],
    hints: [{ for: 'on', levels: ['Vue Infrastructure : sélectionnez SRV-FACT, l\'inspecteur vous donne la raison de l\'état hors ligne et l\'action.'] }, { for: 'resolve', levels: ['Qualifiez (catégorie, impact, urgence), attribuez, prenez en charge, écrivez la solution, résolvez.'] }],
    solutionText: ['Lier le ticket à SRV-FACT.', 'Rallumer le serveur ; attendre qu\'il repasse en ligne.', 'Qualifier, attribuer, documenter la solution et résoudre.'],
    solution: [answer('diag', 1), { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:SRV-FACT' } }, { do: 'infra.powerOn', args: { id: '@dev:SRV-FACT' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', subcategory: 'Poste de travail', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Serveur SRV-FACT éteint : rallumé, service de facturation de nouveau accessible.' } } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' } }],
    realWorld: 'La supervision (Nagios, Zabbix, PRTG) détecte l\'arrêt d\'un serveur avant l\'appel utilisateur ; la CMDB indique alors quels services sont touchés.',
  },

  /* ============================ TP 20 ============================ */
  {
    id: 'tp-20-incident-majeur', number: 20, title: 'Incident majeur', level: 4, levelLabel: level(4), difficulty: 3, duration: '50 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Travailler en mode projet', kind: 'worked' }],
    context: 'Le switch cœur du siège, SW-SIEGE-01, est éteint : tout le siège est coupé. Trois tickets arrivent : la comptabilité bloquée en pleine clôture, un partage de fichiers inaccessible, et une imprimante de couloir qui bloque. Priorisez, rétablissez, communiquez.',
    stages: [
      stage('s1', 'Prioriser', ['order', 'prio'], ['Un **incident majeur** est une panne à fort impact : on coordonne au lieu de traiter les tickets un par un. Principe : traiter d\'abord **la cause commune**, et classer les tickets par priorité (impact × urgence), pas par ordre d\'arrivée.', 'Ici : comptabilité bloquée un jour de clôture = impact fort, urgence forte (P1). L\'imprimante du couloir = impact et urgence faibles (P4).'], ['Une bonne priorité guide l\'ordre d\'intervention et le niveau de communication.']),
      stage('s2', 'Rétablir et informer', ['fix', 'comm', 'resolved'], ['Rallumez le switch dans la vue Infrastructure. Pendant la panne, **informez** : un commentaire clair sur le ticket principal (ce qui se passe, ce qu\'on fait, quand on revient). Puis résolvez le ticket principal avec une solution documentée.'], ['Un incident majeur se clôt par une cause, une solution et un message aux utilisateurs.']),
    ],
    setup: [
      { do: 'infra.setIp', args: { id: '@dev:SW-SIEGE-01', ip: '192.168.10.1', mask: 24 } }, DISCOVER, { do: 'infra.powerOff', args: { id: '@dev:SW-SIEGE-01' } },
      newIncident('Plus rien ne fonctionne à la comptabilité', 'Appel d\'Alice à 9 h 00 : toute la comptabilité est coupée, la clôture mensuelle est ce soir. Huit personnes bloquées.', 'Alice'),
      newIncident('Imprimante du couloir bloquée', 'Appel de Chloé à 9 h 05 : l\'imprimante du couloir ne répond plus. Rien de pressé.', 'Chloé'),
      newIncident('Dossiers partagés inaccessibles', 'Appel de Bruno à 9 h 08 : plus d\'accès aux dossiers partagés.', 'Bruno'),
    ],
    objectives: [
      { id: 'order', label: 'Choisir par quoi commencer', question: Q('Trois tickets arrivent, dont deux liés à la même panne. Par quoi commencer ?', ['Par le premier arrivé', 'Par la cause commune : rétablir le switch résout la plupart des tickets', 'Par l\'imprimante, c\'est le plus simple', 'Par aucun : attendre'], 1, 'Un incident majeur se traite à la source : une seule intervention efficace vaut mieux que trois dépannages locaux.') },
      { id: 'prio', label: 'La comptabilité est en P1 et l\'imprimante en P4', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), priority: 1 }, { k: 'ticket', ref: T(2), priority: 4 }] }, requires: ['order'] },
      { id: 'fix', label: 'SW-SIEGE-01 est rallumé et le siège est de nouveau en ligne', check: { k: 'all', of: [{ k: 'devicePowered', device: '@dev:SW-SIEGE-01' }, { k: 'deviceOnline', device: '@dev:PC-COMPTA-01' }] }, requires: ['prio'] },
      { id: 'comm', label: 'Les utilisateurs sont informés sur le ticket principal', check: { k: 'ticket', ref: T(1), minComments: 1 }, requires: ['prio'] },
      { id: 'resolved', label: 'Le ticket de la comptabilité est résolu et documenté', check: { k: 'ticket', ref: T(1), status: 'resolved', solutionMin: 30 }, requires: ['fix', 'comm'] },
    ],
    hints: [{ for: 'prio', levels: ['Impact : combien de personnes, quelle activité. Urgence : y a-t-il un délai ?'] }, { for: 'comm', levels: ['Un commentaire sur INC-0001 : cause connue, action en cours, retour estimé.'] }],
    solutionText: ['Qualifier INC-0001 en P1 (impact fort, urgence forte) et INC-0002 en P4.', 'Rallumer SW-SIEGE-01 ; commenter pour informer.', 'Résoudre INC-0001 avec la solution documentée.'],
    solution: [answer('order', 1),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Réseau', subcategory: 'Switch / routeur', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.updateTicket', args: { id: T(2), fields: { category: 'Matériel', subcategory: 'Imprimante', impact: 'low', urgency: 'low' } } },
      { do: 'infra.powerOn', args: { id: '@dev:SW-SIEGE-01' } }, comment(T(1), 'Cause identifiée : le switch cœur du siège était éteint. Rallumé, retour à la normale en cours de vérification.'),
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Switch cœur SW-SIEGE-01 éteint : rallumé, tout le siège est de nouveau en ligne.' } } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' } }],
    realWorld: 'ITIL 4 prévoit une procédure d\'incident majeur : coordinateur désigné, communication régulière, revue post-incident. Les outils proposent un ticket « parent » auquel les tickets liés se rattachent.',
  },

  /* ============================ TP 21 ============================ */
  {
    id: 'tp-21-incident-ou-demande', number: 21, title: 'Incident ou demande ?', level: 5, levelLabel: level(5), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'Deux tickets attendent dans la file : « Je n\'ai plus accès à ma messagerie » (Bruno) et « Pouvez-vous installer Visio sur mon poste ? » (Chloé). Ils n\'ont pas le même circuit de traitement.',
    stages: [
      stage('s1', 'Deux circuits', ['why'], ['Un **incident** est une interruption ou une dégradation d\'un service qui marchait : on vise le **rétablissement** le plus vite possible. Une **demande de service** est une demande de quelque chose de prévu au catalogue (un logiciel, un accès, du matériel) : on vise la **fourniture**, avec éventuellement une validation.'], ['Mélanger les deux fausse les statistiques et les délais : un incident se mesure en heures, une demande suit un processus.']),
      stage('s2', 'Classer les deux tickets', ['inc', 'req'], ['INC-0001 : incident, catégorie « Compte et accès ». REQ-0001 : demande de service, catégorie « Demande de service », sous-catégorie « Nouveau matériel » (c\'est la plus proche de la liste de départ). Qualifiez les deux.'], ['Chaque ticket est maintenant dans le bon circuit.']),
    ],
    setup: [newIncident('Plus d\'accès à ma messagerie', 'Appel de Bruno à 9 h 10 : sa messagerie affiche « connexion impossible » depuis 8 h 30.', 'Bruno'), newRequest('Installer Visio sur mon poste', 'Courriel de Chloé : elle a besoin de Visio pour un schéma, à installer cette semaine.', 'Chloé')],
    objectives: [
      { id: 'why', label: 'Distinguer incident et demande', question: Q('« Installer Visio sur mon poste » est…', ['Un incident : quelque chose est cassé', 'Une demande de service : on fournit quelque chose de prévu', 'Un problème', 'Un changement d\'urgence'], 1, 'Rien n\'est cassé : on fournit un logiciel. C\'est une demande de service.') },
      { id: 'inc', label: 'INC-0001 est qualifié comme incident « Compte et accès »', check: { k: 'ticket', ref: T(1), kind: 'incident', category: 'Compte et accès', qualified: true }, requires: ['why'] },
      { id: 'req', label: 'REQ-0001 est qualifié comme demande de service', check: { k: 'ticket', ref: '@tkt:REQ-0001', kind: 'request', category: 'Demande de service', qualified: true }, requires: ['why'] },
    ],
    hints: [{ for: 'req', levels: ['Catégorie « Demande de service » pour une demande ; l\'impact et l\'urgence se renseignent comme pour un incident.'] }],
    solutionText: ['INC-0001 : catégorie Compte et accès. REQ-0001 : catégorie Demande de service.'],
    solution: [answer('why', 1), { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Compte et accès', subcategory: 'Mot de passe', impact: 'low', urgency: 'medium' } } }, { do: 'itsm.updateTicket', args: { id: '@tkt:REQ-0001', fields: { category: 'Demande de service', subcategory: 'Nouveau matériel', impact: 'low', urgency: 'low' } } }],
    realWorld: 'ITIL sépare Incident Management et Service Request Fulfilment ; les outils proposent un catalogue de demandes avec formulaires et circuits de validation dédiés.',
  },
  /* ============================ TP 37 ============================ */
  {
    id: 'tp-37-audit', number: 37, title: 'Audit : qui a fait quoi ?', level: 8, levelLabel: level(8), difficulty: 3, duration: '40 min',
    skills: [{ ref: 'Assurer la traçabilité', kind: 'evidence_possible' }, { ref: 'Participer à la vie de la cybersécurité', kind: 'worked' }],
    context: 'Le coût d\'achat de PC21 est passé de 1 200 € à 1 €. Le comptable s\'en inquiète : l\'amortissement du poste est faussé. Remontez la piste dans le journal d\'audit, identifiez l\'auteur, et rétablissez la valeur.',
    stages: [
      stage('s1', 'Enquêter dans le journal', ['who', 'why'], ['Chaque action est enregistrée avec **l\'heure**, **l\'objet** et **l\'auteur**. Le journal d\'audit (ITSM → Administration → Journal d\'audit) est la mémoire du système : c\'est lui qui permet de répondre à « qui a modifié quoi, et quand ? ». Cherchez les événements « Données financières modifiées » sur PC21.', 'Pour consulter le journal, il faut le droit d\'audit : restez en mode formateur, ou agissez en tant qu\'administrateur ou responsable.'], ['Sans journal, la question « qui a fait ça ? » n\'a pas de réponse : tout le monde nie, personne ne peut prouver.']),
      stage('s2', 'Corriger et conclure', ['fix', 'lesson'], ['Une fois l\'auteur identifié, on **corrige** la donnée (la valeur d\'origine figure dans la facture d\'achat) et on **tire la leçon** : pourquoi cette personne a-t-elle pu modifier cette valeur ?'], ['Corriger sans comprendre, c\'est attendre la prochaine fois : l\'audit mène à un renforcement des droits.']),
    ],
    setup: [
      DISCOVER,
      { do: 'itsm.updateAssetFinance', args: { id: '@ast:PC21', fields: { cost: 1200, purchasedAt: 0 } }, as: '@usr:David' },
      { do: 'itsm.updateAsset', args: { id: '@ast:PC21', fields: { inventoryNo: 'NT-0021' } }, as: '@usr:David' },
      { advance: 3 * HOUR },
      { do: 'itsm.updateAssetFinance', args: { id: '@ast:PC21', fields: { cost: 1 } }, as: '@usr:Bruno' },
    ],
    objectives: [
      { id: 'who', label: 'Identifier l\'auteur de la modification du coût', question: Q('Dans le journal d\'audit, qui a ramené le coût de PC21 à 1 € ?', ['David Petit', 'Bruno Leroy', 'Alice Martin', 'Léa Garnier'], 1, 'L\'événement « Données financières modifiées » sur PC21, le plus récent, est signé Bruno Leroy.') },
      { id: 'why', label: 'Relever ce qui rend la modification suspecte', requires: ['who'], question: Q('Pourquoi cette modification est-elle anormale ?', ['Parce qu\'elle a été faite le matin', 'Parce que Bruno a le rôle Utilisateur : il n\'a normalement pas le droit de modifier les données d\'un actif', 'Parce que le coût a augmenté', 'Parce que PC21 est un portable'], 1, 'Un utilisateur simple n\'a pas le droit « Modifier le parc ». Une telle écriture montre un contournement des contrôles à investiguer.') },
      { id: 'fix', label: 'Le coût de PC21 est rétabli à 1 200 €', check: { k: 'assetData', asset: '@ast:PC21', cost: 1200 }, requires: ['why'] },
      { id: 'lesson', label: 'Choisir la mesure qui évite la récidive', requires: ['fix'], question: Q('Quelle mesure empêche le renouvellement ?', ['Effacer le journal', 'Vérifier les droits des rôles et tenir le journal d\'audit à jour', 'Interdire à Bruno de venir au bureau', 'Ne plus saisir de coût'], 1, 'On agit sur la cause : revue des habilitations (TP 39) et supervision du journal.') },
    ],
    hints: [{ for: 'who', levels: ['Journal d\'audit : colonne « Auteur ». Repérez l\'événement le plus récent sur PC21.'] }, { for: 'fix', levels: ['Fiche de PC21 → Cycle de vie : coût d\'achat.'] }],
    solutionText: ['Journal d\'audit : le dernier événement financier sur PC21 est signé Bruno Leroy.', 'Rétablir le coût d\'origine (1 200 €), puis revoir les droits.'],
    solution: [answer('who', 1), answer('why', 1), { do: 'itsm.updateAssetFinance', args: { id: '@ast:PC21', fields: { cost: 1200 } } }, answer('lesson', 1)],
    realWorld: 'Un journal d\'audit se conserve, se protège (on ne le modifie pas) et se relit : c\'est une exigence de l\'ISO 27001, du RGPD (traçabilité des accès) et des commissaires aux comptes.',
  },

  /* ============================ TP 38 ============================ */
  {
    id: 'tp-38-dependances', number: 38, title: 'Dépendances et lecture du graphe', level: 7, levelLabel: level(7), difficulty: 3, duration: '40 min',
    skills: [{ ref: 'Exploiter, dépanner et superviser une infrastructure', kind: 'worked' }, { ref: 'Travailler en mode projet', kind: 'worked' }],
    context: 'La paie de NovaTech repose sur un logiciel hébergé sur SRV-ITSM. La CMDB connaît le logiciel et son serveur, mais personne n\'a relié le service « Paie » au logiciel. Complétez la chaîne, puis lisez-la pour mesurer l\'impact d\'une panne.',
    stages: [
      stage('s1', 'Compléter la chaîne', ['chain'], ['Une CMDB se lit en **couches** : un **service** (ce que les gens utilisent) **utilise** une **application**, qui est **hébergée sur** un équipement. Une relation manquante coupe la chaîne : une panne en bas ne remonte plus jusqu\'au service.', 'Ouvrez la fiche du CI « Paie » (ITSM → Gestion → CMDB) et ajoutez la relation « utilise » vers « Logiciel de paie ».'], ['La chaîne Service → Application → Équipement est maintenant continue.']),
      stage('s2', 'Lire l\'impact', ['impact'], ['L\'**analyse d\'impact** parcourt la chaîne à l\'envers : d\'un équipement vers ce qui en dépend, de proche en proche. Ouvrez la fiche du CI SRV-ITSM : l\'encadré d\'impact liste tout ce qui serait touché, y compris les éléments indirects.'], ['Un impact indirect est le plus dangereux : personne n\'y pense quand la panne arrive.']),
    ],
    setup: [DISCOVER,
      { do: 'itsm.createCi', args: { name: 'SRV-ITSM', kind: 'infrastructure', asset: '@ast:SRV-ITSM' } }, { do: 'itsm.createCi', args: { name: 'Logiciel de paie', kind: 'application' } }, { do: 'itsm.createCi', args: { name: 'Paie', kind: 'service' } },
      { do: 'itsm.addRelation', args: { from: '@ci:Logiciel de paie', to: '@ci:SRV-ITSM', type: 'hosted_on' } }],
    objectives: [
      { id: 'chain', label: 'Le service Paie utilise le Logiciel de paie', check: { k: 'relation', from: '@ci:Paie', to: '@ci:Logiciel de paie', type: 'uses' } },
      { id: 'impact', label: 'Prévoir l\'effet d\'un arrêt de SRV-ITSM', requires: ['chain'], question: Q('Si SRV-ITSM s\'arrête, quels éléments de la CMDB sont touchés ?', ['Seulement SRV-ITSM', 'Seulement le Logiciel de paie', 'Le Logiciel de paie et, par rebond, le service Paie', 'Aucun : la CMDB ne sert qu\'à lister'], 2, 'L\'application est hébergée sur le serveur ; le service utilise l\'application : la panne remonte de proche en proche.') },
    ],
    hints: [{ for: 'chain', levels: ['Fiche du CI « Paie » → ajouter une relation : type « utilise », cible « Logiciel de paie ».'] }],
    solutionText: ['Ajouter la relation Paie « utilise » Logiciel de paie.', 'Lire l\'impact de SRV-ITSM : application puis service.'],
    solution: [{ do: 'itsm.addRelation', args: { from: '@ci:Paie', to: '@ci:Logiciel de paie', type: 'uses' } }, answer('impact', 2)],
    realWorld: 'La carte des dépendances (service mapping) est la fonction la plus valorisée d\'une CMDB : elle sert aux analyses d\'impact des changements et au diagnostic des incidents.',
  },

  /* ============================ TP 39 ============================ */
  {
    id: 'tp-39-revue-des-habilitations', number: 39, title: 'Revue des habilitations', level: 8, levelLabel: level(8), difficulty: 3, duration: '40 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Participer à la vie de la cybersécurité', kind: 'worked' }],
    context: 'Un audit interne a relevé que des utilisateurs ordinaires peuvent modifier le cycle de vie des actifs, gérer les contrats et approuver des changements. Retrouvez ces droits excessifs dans la matrice et retirez-les, sans empêcher les utilisateurs d\'ouvrir des tickets.',
    stages: [
      stage('s1', 'Repérer l\'excès', ['why'], ['Une **revue des habilitations** compare, rôle par rôle, les droits accordés et les droits nécessaires. Le rôle « Utilisateur » doit pouvoir **ouvrir un ticket**, c\'est tout. Tout droit supplémentaire est un excès : c\'est une surface d\'attaque et un risque d\'erreur.', 'ITSM → Administration → Rôles et droits.'], ['Le principe du **moindre privilège** : chacun a les droits nécessaires à sa fonction, et pas un de plus.']),
      stage('s2', 'Corriger la matrice', ['fix', 'keep'], ['Décochez les droits excessifs du rôle Utilisateur. Vérifiez que « Ouvrir un ticket » reste coché : un retrait trop large aurait empêché les utilisateurs de signaler leurs pannes.'], ['La correction est efficace sans bloquer le travail : c\'est tout l\'art de la revue.']),
    ],
    setup: [{ do: 'itsm.setRolePermission', args: { role: 'user', permission: 'itam.manage', granted: true } }, { do: 'itsm.setRolePermission', args: { role: 'user', permission: 'change.approve', granted: true } }, { do: 'itsm.setRolePermission', args: { role: 'user', permission: 'asset.lifecycle', granted: true } }],
    objectives: [
      { id: 'why', label: 'Justifier le retrait de droits à un rôle', question: Q('Pourquoi retirer ces droits au rôle Utilisateur ?', ['Pour que les utilisateurs travaillent moins', 'Pour appliquer le moindre privilège : aucun droit au-delà de la fonction', 'Parce que l\'outil le demande', 'Pour réduire le nombre de tickets'], 1, 'Chaque droit inutile est un risque (erreur, malveillance, compte compromis) sans aucun bénéfice.') },
      { id: 'fix', label: 'Le rôle Utilisateur ne gère plus contrats, cycle de vie ni approbations', check: { k: 'all', of: [{ k: 'rolePerm', role: 'user', permission: 'itam.manage', value: false }, { k: 'rolePerm', role: 'user', permission: 'change.approve', value: false }, { k: 'rolePerm', role: 'user', permission: 'asset.lifecycle', value: false }] }, requires: ['why'] },
      { id: 'keep', label: 'Les utilisateurs peuvent toujours ouvrir un ticket', check: { k: 'rolePerm', role: 'user', permission: 'ticket.create', value: true }, requires: ['fix'] },
    ],
    hints: [{ for: 'fix', levels: ['Colonne « Utilisateur » de la matrice : trois droits en trop (Parc et Itil).'] }],
    solutionText: ['Décocher, pour le rôle Utilisateur : gérer licences et contrats, état d\'un actif, approuver un changement.', 'Garder « Ouvrir un ticket ».'],
    solution: [answer('why', 1), { do: 'itsm.setRolePermission', args: { role: 'user', permission: 'itam.manage', granted: false } }, { do: 'itsm.setRolePermission', args: { role: 'user', permission: 'change.approve', granted: false } }, { do: 'itsm.setRolePermission', args: { role: 'user', permission: 'asset.lifecycle', granted: false } }],
    realWorld: 'La recertification périodique des accès (access review) est un contrôle exigé par les référentiels de sécurité : chaque responsable confirme que les droits de son équipe sont toujours justifiés.',
  },

  /* ============================ TP 40 ============================ */
  {
    id: 'tp-40-administrateur-novatech', number: 40, title: 'Administrateur ITSM de NovaTech', level: 8, levelLabel: level(8), difficulty: 3, duration: '2 h',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Travailler en mode projet', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Vous prenez la main sur l\'outil ITSM de NovaTech un lundi matin. Trois collègues n\'ont plus de réseau, l\'inventaire est incomplet, la licence Office n\'est pas déclarée et un nouveau technicien arrive. Menez l\'ensemble, dans l\'ordre qui a du sens : d\'abord le service, ensuite la propreté de l\'outil.',
    stages: [
      stage('s1', 'Rétablir le service', ['order', 'link', 'power'], ['Trois utilisateurs (Bruno, Chloé, David) signalent un poste sans réseau, chacun par un ticket distinct. Avant d\'agir, **corrélez** : trois symptômes, une cause probable. Liez chaque ticket à son poste, puis cherchez ce qui est en commun sur le schéma.'], ['Rétablir le service passe avant tout : on nettoie l\'outil ensuite.']),
      stage('s2', 'Compléter l\'inventaire', ['agents'], ['Maintenant que les postes sont de nouveau joignables, installez l\'agent sur PC-COMPTA-01, PC21, PC22 et PC23 et forcez l\'inventaire : l\'outil connaîtra enfin leurs logiciels et leurs utilisateurs.'], ['Un inventaire complet est la condition de la conformité des licences et de la fiabilité des analyses.']),
      stage('s3', 'Parc, licences et habilitations', ['assign', 'office', 'karim'], ['Affectez PC22 à Chloé Dubois. Office est installé sur quatre postes : déclarez les droits correspondants pour être conforme. Enfin, créez le compte de **Karim Benali** (service Informatique), technicien : rôles « Utilisateur » et « Technicien » seulement.'], ['Parc, licences, comptes : les trois piliers de la gestion du patrimoine.']),
      stage('s4', 'Traiter, comprendre, prévenir', ['resolved', 'problem', 'change', 'final'], ['Documentez et résolvez les trois tickets en respectant le SLA. Ouvrez un **problème** qui les regroupe, avec la cause racine. Puis préparez un **changement** (remplacement du switch SW02) : risque, plan, retour arrière, approbation par le responsable.'], ['Incident, problème, changement : trois temps d\'une même histoire. Chacun laisse sa trace, et c\'est ce qui fait la qualité d\'un service.']),
    ],
    setup: [
      { do: 'infra.setIp', args: { id: '@dev:SW02', ip: '192.168.10.2', mask: 24 } }, DISCOVER, { do: 'infra.powerOff', args: { id: '@dev:SW02' } },
      newIncident('Plus de réseau sur mon poste', 'Appel de Bruno à 9 h 05 : plus aucun accès réseau.', 'Bruno'), newIncident('Internet ne marche plus', 'Appel de Chloé à 9 h 07 : impossible d\'ouvrir ses applications.', 'Chloé'), newIncident('Mon PC est coupé du réseau', 'Appel de David à 9 h 12 : il ne voit plus les dossiers partagés.', 'David'),
    ],
    objectives: [
      { id: 'order', label: 'Identifier la cause commune probable', question: Q('Trois tickets « plus de réseau » arrivent en dix minutes. Que suspecte-t-on ?', ['Trois pannes de poste indépendantes', 'Un équipement commun à ces trois postes (un switch)', 'Une erreur de saisie du service desk', 'Un virus'], 1, 'Trois symptômes simultanés qui partagent un point commun : cherchez l\'équipement qu\'ils partagent.') },
      { id: 'link', label: 'Chaque ticket désigne le poste de son demandeur', check: { k: 'all', of: [[1, 'PC21'], [2, 'PC22'], [3, 'PC23']].map(([n, d]) => ({ k: 'ticket' as const, ref: T(n as number), linkedDevice: `@dev:${d}` })) }, requires: ['order'] },
      { id: 'power', label: 'Le réseau est rétabli : les trois postes sont en ligne', check: allOnline, requires: ['link'] },
      { id: 'agents', label: 'Les quatre postes sont inventoriés par un agent', check: { k: 'all', of: ['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'].map(n => ({ k: 'assetInventoried' as const, device: `@dev:${n}` })) }, requires: ['power'] },
      { id: 'assign', label: 'PC22 est affecté à Chloé Dubois', check: { k: 'asset', asset: '@ast:PC22', assignedTo: '@usr:Chloé' }, requires: ['agents'] },
      { id: 'office', label: 'Les licences Office couvrent les installations (conformité)', check: { k: 'license', software: 'sw-office', state: 'compliant' }, requires: ['agents'] },
      { id: 'karim', label: 'Karim Benali est technicien, sans droit d\'administration', check: { k: 'userRoles', user: '@usr:Karim', has: ['user', 'technician'], lacks: ['admin', 'manager'] }, requires: ['agents'] },
      { id: 'resolved', label: 'Les trois tickets sont résolus, documentés, dans les délais', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), reached: 'resolved' as const, solutionMin: 30 })).concat([]) }, requires: ['power'] },
      { id: 'problem', label: 'Un problème regroupe les trois tickets avec sa cause racine', check: { k: 'problem', ref: '@prb:PRB-0001', minTickets: 3, hasRootCause: true }, requires: ['resolved'] },
      { id: 'change', label: 'Le remplacement de SW02 est approuvé par Éric Moreau', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'approved', approver: '@usr:Éric', linkedAsset: '@ast:SW02' }, requires: ['problem'] },
      { id: 'final', label: 'Résumer la logique incident / problème / changement', requires: ['change'], question: Q('Quel enchaînement résume ce que vous venez de faire ?', ['Changement → incident → problème', 'Incident (rétablir) → problème (comprendre la cause) → changement (corriger durablement)', 'Problème → changement → incident', 'Un seul ticket suffisait pour tout'], 1, 'On rétablit d\'abord (incident), on cherche la cause (problème), puis on corrige durablement par un changement maîtrisé.') },
    ],
    hints: [
      { for: 'power', levels: ['Vue Infrastructure : quel équipement relie PC21, PC22 et PC23 ? Est-il allumé ?'] },
      { for: 'office', levels: ['ITSM → Parc → Licences : combien de postes ont Office d\'après l\'inventaire ?'] },
      { for: 'change', levels: ['Changement normal : risque, plan, retour arrière et approbateur sont obligatoires avant la soumission.'] },
    ],
    solutionText: ['Lier les trois tickets à leurs postes ; rallumer SW02.', 'Installer l\'agent sur les quatre postes et forcer l\'inventaire.', 'Affecter PC22, déclarer 4 licences Office, créer Karim (technicien).', 'Résoudre les tickets, créer le problème avec sa cause racine, préparer et faire approuver le changement.'],
    solution: [
      answer('order', 1),
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:PC21' } }, { do: 'itsm.linkAsset', args: { id: T(2), asset: '@ast:PC22' } }, { do: 'itsm.linkAsset', args: { id: T(3), asset: '@ast:PC23' } },
      { do: 'infra.powerOn', args: { id: '@dev:SW02' } },
      ...['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'].flatMap((n): Step[] => [{ do: 'agent.install', args: { id: `@dev:${n}` } }, { do: 'agent.runInventory', args: { id: `@dev:${n}` } }]),
      { do: 'itsm.assignAsset', args: { id: '@ast:PC22', user: '@usr:Chloé' } },
      { do: 'itsm.addLicense', args: { softwareId: 'sw-office', quantity: 4 } },
      { do: 'itsm.addUser', args: { name: 'Karim Benali', service: 'Informatique', roles: ['user', 'technician'] } },
      ...[1, 2, 3].flatMap(n => resolveSteps(T(n), { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'medium', urgency: 'high' }, 'Switch SW02 éteint : rallumé, poste de nouveau en ligne.').slice(0, -1)),
      { do: 'itsm.createProblem', args: { title: 'Défaillance du switch SW02', tickets: [T(1), T(2), T(3)] } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'analysis' } },
      { do: 'itsm.updateProblem', args: { id: '@prb:PRB-0001', fields: { rootCause: 'Alimentation défaillante du switch SW02.', workaround: 'Rallumer SW02.' } } },
      { do: 'itsm.createChange', args: { title: 'Remplacement de SW02', type: 'normal', assetIds: ['@ast:SW02'] } },
      { do: 'itsm.updateChange', args: { id: '@chg:CHG-0001', fields: { risk: 'medium', plan: 'Remplacer SW02, rebrancher, vérifier les postes.', rollback: 'Remettre l\'ancien switch.', approver: '@usr:Éric' } } },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'proposed' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'approved' } },
      answer('final', 1),
    ],
    realWorld: 'Un administrateur ITSM fait précisément cela au quotidien : arbitrer entre l\'urgence (rétablir), l\'hygiène (inventaire, licences, comptes) et le long terme (problèmes, changements), en laissant une trace à chaque étape.',
  },
  /* ============================ TP 41 ============================ */
  {
    id: 'tp-41-calendrier-ouvre', number: 41, title: 'SLA : le week-end compte-t-il ?', level: 5, levelLabel: level(5), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    timeNote: 'Il est lundi 07:00. Le ticket a été ouvert vendredi à 17:00 : tout un week-end s\'est écoulé. Observez, dans la liste des tickets, comment le même ticket est jugé « dépassé » ou « en cours » selon le calendrier retenu (page Paramètres de la vue ITSM). Vous pouvez avancer l\'horloge, par exemple +1 h, pour voir arriver l\'ouverture du service à 08:00.',
    context: 'Vendredi à 17:00, Alice a signalé que l\'imprimante du service comptabilité ne marche plus. Le ticket est qualifié (priorité P3 : 24 h pour résoudre). Nous sommes lundi à 07:00, le service desk n\'ouvre qu\'à 08:00, et l\'outil affiche déjà ce ticket en rouge.',
    stages: [
      stage('s1', 'Comprendre ce que mesure le SLA', ['why'], ['Un SLA est un **engagement de durée**, mais une durée mesurée sur un **calendrier**. Le calendrier dit quelles heures comptent : tout le temps (24 h / 24, 7 j / 7) ou seulement les heures ouvrées (ici du lundi au vendredi, de 8 h à 18 h).', 'Regardez le ticket INC-0001 dans la liste : il est ouvert depuis 62 heures de temps réel. Mais le service desk, lui, n\'a travaillé qu\'**une heure** depuis (vendredi de 17 h à 18 h).'], ['Le même ticket est « dépassé » ou « dans les temps » selon le calendrier : ce n\'est pas un détail, c\'est ce qui rend le SLA honnête.']),
      stage('s2', 'Régler le calendrier', ['cal', 'running'], ['Dans la vue ITSM, page **Paramètres** (Administration), choisissez le calendrier correspondant au contrat de service de NovaTech : un support aux heures de bureau. Revenez ensuite à la liste des tickets : le SLA est recalculé à partir du **temps ouvré** écoulé.'], ['Changer le calendrier ne répare pas un retard : il corrige la **mesure**, pour qu\'elle corresponde à ce qui a été promis.']),
      stage('s3', 'Tenir l\'engagement', ['resolve', 'contract'], ['Traitez maintenant le ticket : qualifiez-le jusqu\'à la prise en charge, attribuez-le à David, documentez la solution et résolvez-le. Le SLA doit être **respecté**.'], ['Un calendrier ouvré s\'applique à un contrat ouvré. Pour un service critique promis 24 h / 24, le calendrier continu reste le bon choix.']),
    ],
    setup: [
      { advance: 4 * DAY + 9 * HOUR }, // vendredi 17:00
      newIncident('Imprimante de la comptabilité en panne', 'Appel d\'Alice à 17 h : l\'imprimante du service ne sort plus rien.', 'Alice'),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', subcategory: 'Imprimante', impact: 'medium', urgency: 'medium' } } },
      { advance: 3 * DAY - 10 * HOUR }, // lundi 07:00
    ],
    objectives: [
      { id: 'why', label: 'Expliquer pourquoi le ticket est affiché « dépassé »', question: Q('Le ticket (P3, 24 h pour résoudre) est ouvert depuis vendredi 17 h et l\'outil affiche « dépassé » lundi à 7 h. Pourquoi ?', ['Le service desk a ignoré le ticket pendant 62 heures de travail', 'Le calendrier continu compte aussi les nuits et le week-end, pendant lesquels le service desk ne travaille pas', 'La priorité du ticket est trop haute', 'L\'horloge simulée est en avance'], 1, 'Le calendrier continu compte toutes les heures. Or le service desk n\'ouvre que du lundi au vendredi de 8 h à 18 h : seule une heure ouvrée s\'est écoulée.') },
      { id: 'cal', label: 'Le calendrier des SLA correspond à un support aux heures ouvrées', check: { k: 'slaCalendar', is: 'business' }, requires: ['why'] },
      { id: 'running', label: 'Le ticket INC-0001 n\'est plus « dépassé » : le délai de résolution est de nouveau tenable', check: { k: 'sla', ticket: T(1), resolveNot: 'breached' }, requires: ['cal'] },
      { id: 'resolve', label: 'INC-0001 est résolu avec une solution documentée, SLA respecté', check: { k: 'all', of: [{ k: 'sla', ticket: T(1), resolve: 'met' }, { k: 'ticket', ref: T(1), solutionMin: 30 }] }, requires: ['running'] },
      { id: 'contract', label: 'Choisir le calendrier d\'un service promis 24 h / 24', requires: ['resolve'], question: Q('NovaTech vend à un client un support de supervision promis 24 h / 24, 7 j / 7. Quel calendrier de SLA convient ?', ['Heures ouvrées : c\'est moins strict', 'Continu : la mesure doit suivre l\'engagement pris', 'Peu importe, le résultat sera le même', 'Aucun calendrier : un SLA n\'a pas besoin de mesure'], 1, 'Le calendrier suit le contrat. Mesurer en heures ouvrées un engagement 24 h / 24 masquerait des dépassements réels.') },
    ],
    hints: [
      { for: 'cal', levels: ['Le réglage n\'est pas sur le ticket : il concerne tout l\'outil.', 'Vue ITSM, menu Administration, page « Paramètres ».'] },
      { for: 'resolve', levels: ['Qualifiez, attribuez à David, prenez en charge, puis renseignez la solution avant de résoudre.'] },
    ],
    solutionText: ['Répondre à la question : le calendrier continu compte les heures où personne ne travaille.', 'Vue ITSM → Paramètres : choisir le calendrier « heures ouvrées ».', 'Qualifier, attribuer à David, prendre en charge, documenter et résoudre INC-0001.', 'Répondre à la dernière question : un engagement 24 h / 24 se mesure en continu.'],
    solution: [
      answer('why', 1), { do: 'itsm.setSlaCalendar', args: { calendar: 'business' } },
      ...resolveSteps(T(1), { category: 'Matériel', subcategory: 'Imprimante', impact: 'medium', urgency: 'medium' }, 'Bourrage et pilote d\'impression réinstallé : l\'imprimante de la comptabilité imprime de nouveau.').slice(0, 6),
      answer('contract', 1),
    ],
    realWorld: 'Dans les outils réels, le calendrier est un objet à part (« planning de service », « business hours » dans ServiceNow, « calendrier » dans GLPI ou Jira Service Management) rattaché au contrat ou au SLA. Congés, jours fériés et fuseaux horaires s\'y ajoutent : ici, un seul calendrier hebdomadaire suffit à comprendre le principe.',
  },

  /* ============================ TP 42 ============================ */
  {
    id: 'tp-42-matinee-service-desk', number: 42, title: 'Une matinée au service desk', level: 3, levelLabel: level(3), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    timeNote: 'Dans ce TP, les appels arrivent au fil du temps simulé. Utilisez +15 min ou +1 h pour faire passer le temps, comme on attend le prochain appel : les nouveaux tickets apparaissent seuls dans la liste, avec un message dans cette section.',
    context: 'Il est 8 h 00. Vous tenez seul le service desk de NovaTech. Un premier appel est déjà noté. D\'autres arriveront pendant la matinée : un service desk ne reçoit jamais ses tickets tous en même temps, et la priorité de l\'un peut bouleverser le traitement de l\'autre.',
    stages: [
      stage('s1', 'Premier appel, premier tri', ['triage'], ['Qualifiez INC-0001 : estimez l\'**impact** (combien de personnes ?) et l\'**urgence** (quel délai le problème tolère-t-il ?). La priorité en découle.'], ['Une priorité se décide quand on connaît le ticket, mais elle doit pouvoir être comparée à celle du ticket suivant.']),
      stage('s2', 'Un appel urgent arrive', ['arrive', 'order', 'p1'], ['Faites avancer l\'horloge jusqu\'au deuxième appel (une demi-heure environ). Quand un ticket critique arrive pendant le traitement d\'un autre, on **arbitre** : le P1 passe devant, l\'autre attend.', 'Le délai de prise en charge d\'un P1 est de 15 minutes seulement : l\'indicateur SLA du ticket vous le montre.'], ['Traiter dans l\'ordre d\'arrivée est simple, mais ce n\'est pas toujours juste : c\'est la priorité qui ordonne la file.']),
      stage('s3', 'Finir la matinée', ['third', 'all'], ['Un troisième appel arrive en milieu de matinée. Terminez la file : chaque ticket doit être qualifié, traité et résolu avec une solution écrite.'], ['Une file de tickets se gère dans le temps : arrivée, tri, arbitrage, résolution, documentation.']),
    ],
    setup: [
      DISCOVER,
      newIncident('Souris à remplacer', 'Appel de Bruno à 8 h : sa souris double-clique parfois. Pas urgent.', 'Bruno'),
    ],
    timeline: [
      { id: 'appel2', at: 30 * MIN, notice: 'Nouvel appel à 8 h 30 : Alice, toute la comptabilité est bloquée (INC-0002).', steps: [newIncident('Plus aucun accès aux applications métier', 'Appel d\'Alice : toute la comptabilité est bloquée, la clôture de paie est ce soir.', 'Alice')] },
      { id: 'appel3', at: 90 * MIN, notice: 'Nouvel appel à 9 h 30 : Chloé ne peut plus imprimer (INC-0003).', steps: [newIncident('Impossible d\'imprimer', 'Appel de Chloé : l\'imprimante du service commercial n\'imprime plus.', 'Chloé')] },
    ],
    objectives: [
      { id: 'triage', label: 'INC-0001 est qualifié avec la priorité que justifie sa description', check: { k: 'ticket', ref: T(1), priority: 4, qualified: true } },
      { id: 'arrive', label: 'Le deuxième appel est arrivé (faites avancer l\'horloge)', check: { k: 'ticket', ref: T(2) }, requires: ['triage'] },
      { id: 'order', label: 'Choisir quel ticket traiter en premier', requires: ['arrive'], question: Q('Vous aviez commencé INC-0001 (souris, P4). INC-0002 arrive : toute la comptabilité est bloquée. Que faites-vous ?', ['Je termine INC-0001 d\'abord : il est arrivé le premier', 'Je qualifie INC-0002 tout de suite et le prends en charge : sa priorité passe devant', 'Je laisse INC-0002 attendre que la souris soit réglée', 'Je rappelle Alice pour lui dire d\'attendre'], 1, 'La priorité (impact × urgence) ordonne la file, pas l\'ordre d\'arrivée. Un P1 doit être pris en charge en 15 minutes.') },
      { id: 'p1', label: 'INC-0002 est qualifié P1 et pris en charge', check: { k: 'all', of: [{ k: 'ticket', ref: T(2), priority: 1, qualified: true }, { k: 'ticket', ref: T(2), reached: 'in_progress' }] }, requires: ['order'] },
      { id: 'third', label: 'Le troisième appel est arrivé (faites encore avancer l\'horloge)', check: { k: 'ticket', ref: T(3) }, requires: ['p1'] },
      { id: 'all', label: 'Les trois tickets sont résolus, chacun avec une solution écrite', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), reached: 'resolved' as const, solutionMin: 30 })) }, requires: ['third'] },
    ],
    hints: [
      { for: 'arrive', levels: ['Aucun appel n\'arrive tant que le temps ne passe pas.', 'Utilisez « +15 min » deux fois, ou « +1 h », dans la section « Dans ce TP, le temps compte ».'] },
      { for: 'p1', levels: ['Un blocage de toute la comptabilité touche beaucoup de monde et ne tolère aucun délai.'] },
    ],
    solutionText: ['Qualifier INC-0001 en P4 (impact faible, urgence faible).', 'Avancer de 30 minutes : INC-0002 arrive. Le qualifier P1, l\'attribuer à David, le prendre en charge, le résoudre.', 'Avancer d\'une heure : INC-0003 arrive. Le traiter, puis résoudre INC-0001.'],
    solution: [
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', subcategory: 'Périphérique', impact: 'low', urgency: 'low' } } },
      { advance: 30 * MIN }, answer('order', 1),
      ...resolveSteps(T(2), { category: 'Réseau', impact: 'high', urgency: 'high' }, 'Contrôleur de domaine redémarré, accès aux applications métier rétablis.').slice(0, 6),
      { advance: 60 * MIN },
      ...resolveSteps(T(3), { category: 'Matériel', subcategory: 'Imprimante', impact: 'low', urgency: 'medium' }, 'Imprimante relancée et file d\'impression purgée.').slice(0, 6),
      ...resolveSteps(T(1), { category: 'Matériel', subcategory: 'Périphérique', impact: 'low', urgency: 'low' }, 'Souris remplacée par une neuve, ancien modèle retiré du parc.').slice(0, 6),
    ],
    realWorld: 'Un service desk réel gère une file qui se remplit en continu. Les outils trient automatiquement par priorité et par échéance SLA, et alertent quand un ticket approche de son délai : c\'est le même principe, appliqué à des centaines de tickets.',
  },

  /* ============================ TP 43 ============================ */
  {
    id: 'tp-43-hyperviseur-en-panne', number: 43, title: 'Quand l\'hyperviseur s\'arrête', level: 4, levelLabel: level(4), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Gérer le patrimoine informatique', kind: 'worked' }],
    timeNote: 'Tout fonctionne au début de ce TP : la panne survient dans le temps simulé, puis les appels arrivent. Avancez l\'horloge (+15 min) jusqu\'à ce que les tickets apparaissent.',
    context: 'NovaTech héberge deux serveurs virtuels, VM-APP01 (application RH) et VM-APP02 (intranet), sur un seul hyperviseur, HV-01. Ce matin tout va bien. Plus tard, des utilisateurs vont signaler que « deux applications ne marchent plus ». À vous de trouver ce qu\'elles ont en commun.',
    stages: [
      stage('s1', 'Laisser venir la panne', ['arrive1', 'arrive2'], ['Faites avancer l\'horloge jusqu\'à l\'arrivée des deux tickets (environ 35 minutes). Dans la vue Infrastructure, observez alors les deux machines virtuelles : leur état et la raison indiquée.'], ['Une panne ne s\'annonce pas : c\'est le temps qui passe qui la révèle, et ce sont les utilisateurs qui la signalent en premier.']),
      stage('s2', 'Chercher le point commun', ['diag', 'link'], ['Deux applications différentes en panne **en même temps** : on cherche ce qu\'elles partagent. Une machine virtuelle ne fonctionne pas seule : elle s\'exécute sur un **hyperviseur**. Sélectionnez une VM dans la vue Infrastructure : la section « Hébergement » indique où elle tourne, et la CMDB affiche la relation « hébergé sur ».', 'Rattachez ensuite les deux tickets à l\'actif réellement en cause.'], ['Corréler les tickets évite de réparer deux fois le même problème, ou de réparer le mauvais équipement.']),
      stage('s3', 'Rétablir et documenter', ['fix', 'close', 'learn'], ['Rétablissez le service à la source. Inutile de toucher aux VM : si la cause est l\'hôte, c\'est l\'hôte qu\'on répare. Puis résolvez les deux tickets en documentant la cause.'], ['Réparer la cause plutôt que les symptômes : un seul geste rétablit deux services.']),
    ],
    setup: [
      { do: 'infra.addDevice', args: { kind: 'hypervisor', name: 'HV-01', x: 560, y: 440 } }, { do: 'infra.addDevice', args: { kind: 'vm', name: 'VM-APP01', x: 656, y: 440 } }, { do: 'infra.addDevice', args: { kind: 'vm', name: 'VM-APP02', x: 752, y: 440 } },
      { do: 'infra.connect', args: { aDevice: '@dev:HV-01', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port5' } },
      { do: 'infra.connect', args: { aDevice: '@dev:VM-APP01', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port6' } },
      { do: 'infra.connect', args: { aDevice: '@dev:VM-APP02', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port7' } },
      { do: 'infra.setIp', args: { id: '@dev:HV-01', ip: '192.168.10.30', mask: 24 } }, { do: 'infra.setIp', args: { id: '@dev:VM-APP01', ip: '192.168.10.31', mask: 24 } }, { do: 'infra.setIp', args: { id: '@dev:VM-APP02', ip: '192.168.10.32', mask: 24 } },
      { do: 'infra.setHost', args: { id: '@dev:VM-APP01', host: '@dev:HV-01' } }, { do: 'infra.setHost', args: { id: '@dev:VM-APP02', host: '@dev:HV-01' } },
      DISCOVER,
    ],
    timeline: [
      { id: 'panne', at: 20 * MIN, notice: 'Appel d\'Alice : l\'application RH ne répond plus (INC-0001).', steps: [{ do: 'infra.powerOff', args: { id: '@dev:HV-01' } }, newIncident('Application RH inaccessible', 'Appel d\'Alice : l\'application RH (VM-APP01) ne répond plus depuis quelques minutes.', 'Alice')] },
      { id: 'appel2', at: 35 * MIN, notice: 'Appel de Chloé : l\'intranet est inaccessible (INC-0002).', steps: [newIncident('Intranet inaccessible', 'Appel de Chloé : l\'intranet (VM-APP02) ne s\'ouvre plus.', 'Chloé')] },
    ],
    forbid: NOREPLACE,
    objectives: [
      { id: 'arrive1', label: 'Le premier appel est arrivé (faites avancer l\'horloge)', check: { k: 'ticket', ref: T(1) } },
      { id: 'arrive2', label: 'Le second appel est arrivé', check: { k: 'ticket', ref: T(2) }, requires: ['arrive1'] },
      { id: 'diag', label: 'Formuler l\'hypothèse du point commun', requires: ['arrive2'], question: Q('Deux applications, hébergées sur deux machines virtuelles différentes, tombent en même temps. Quelle hypothèse vérifier en premier ?', ['Deux pannes indépendantes survenues par hasard', 'L\'élément qu\'elles ont en commun : l\'hyperviseur qui héberge les deux machines virtuelles', 'Un virus sur le poste d\'Alice', 'Une erreur de saisie dans l\'outil de ticketing'], 1, 'Une machine virtuelle dépend de son hôte. Deux VM en panne simultanée sur le même hyperviseur désignent l\'hôte.') },
      { id: 'link', label: 'Les deux tickets sont rattachés à l\'actif HV-01', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), linkedDevice: '@dev:HV-01' }, { k: 'ticket', ref: T(2), linkedDevice: '@dev:HV-01' }] }, requires: ['diag'] },
      { id: 'fix', label: 'HV-01 et ses deux machines virtuelles sont de nouveau en ligne', check: { k: 'all', of: [{ k: 'deviceOnline', device: '@dev:HV-01' }, { k: 'deviceOnline', device: '@dev:VM-APP01' }, { k: 'deviceOnline', device: '@dev:VM-APP02' }] }, requires: ['link'] },
      { id: 'close', label: 'Les deux tickets sont résolus avec une solution documentée', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), reached: 'resolved', solutionMin: 30 }, { k: 'ticket', ref: T(2), reached: 'resolved', solutionMin: 30 }] }, requires: ['fix'] },
      { id: 'learn', label: 'Tirer la leçon sur la dépendance', requires: ['close'], question: Q('Pourquoi supprimer ou recâbler les machines virtuelles n\'aurait-il servi à rien ?', ['Parce qu\'une VM ne peut pas être supprimée', 'Parce que la panne venait de l\'hôte : tant que l\'hyperviseur est arrêté, toutes ses VM le sont', 'Parce que les VM n\'ont pas de câble', 'Parce que l\'outil refuse de modifier les VM'], 1, 'On traite la cause (l\'hôte), pas les symptômes (les VM). Cette relation est précisément ce que la CMDB doit enregistrer : « hébergé sur ».') },
    ],
    hints: [
      { for: 'link', levels: ['Les tickets désignent les VM, mais la cause est plus bas dans la chaîne.', 'Sur la fiche d\'un ticket, liez l\'actif HV-01.'] },
      { for: 'fix', levels: ['Regardez l\'état de HV-01 dans la vue Infrastructure : est-il alimenté ?'] },
    ],
    solutionText: ['Avancer l\'horloge de 40 minutes : les deux tickets arrivent.', 'Observer que VM-APP01 et VM-APP02 sont hébergées sur HV-01, arrêté.', 'Lier HV-01 aux deux tickets, rallumer HV-01 : les VM repartent.', 'Résoudre les deux tickets avec une solution écrite.'],
    solution: [
      { advance: 40 * MIN }, answer('diag', 1),
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:HV-01' } }, { do: 'itsm.linkAsset', args: { id: T(2), asset: '@ast:HV-01' } },
      { do: 'infra.powerOn', args: { id: '@dev:HV-01' } },
      ...resolveSteps(T(1), { category: 'Réseau', impact: 'medium', urgency: 'high' }, 'L\'hyperviseur HV-01 était arrêté : rallumé, les deux machines virtuelles sont revenues.').slice(0, 6),
      ...resolveSteps(T(2), { category: 'Réseau', impact: 'medium', urgency: 'high' }, 'Même cause que INC-0001 : hyperviseur HV-01 arrêté, redémarré.').slice(0, 6),
      answer('learn', 1),
    ],
    realWorld: 'Dans VMware, Hyper-V ou Proxmox, une VM s\'arrête avec son hôte, sauf si un cluster la redémarre ailleurs (haute disponibilité). La CMDB doit porter la relation « hébergé sur » : c\'est elle qui permet de passer d\'un symptôme (une application) à sa cause (un hôte) et de mesurer l\'impact d\'une panne ou d\'une maintenance.',
  },

  /* ============================ TP 44 ============================ */
  {
    id: 'tp-44-maintenance-hyperviseur', number: 44, title: 'Maintenance planifiée d\'un hyperviseur', level: 5, levelLabel: level(5), difficulty: 3, duration: '50 min',
    skills: [{ ref: 'Travailler en mode projet', kind: 'worked' }, { ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    timeNote: 'La maintenance doit avoir lieu hors des heures ouvrées : il faut donc planifier une heure du soir, puis faire avancer l\'horloge jusqu\'à ce moment (+1 h, plusieurs fois, ou +1 jour) avant d\'intervenir. Une intervention se prévoit dans le temps ; on ne la fait pas « tout de suite ».',
    context: 'HV-01 doit recevoir une mise à jour du micrologiciel : il faudra l\'éteindre. Il héberge VM-APP01 (application RH) et VM-APP02 (intranet), utilisées toute la journée. Un second hyperviseur, HV-02, a la capacité de les accueillir. Il est lundi 8 h : l\'intervention doit se faire le soir, sans coupure pour les utilisateurs.',
    stages: [
      stage('s1', 'Mesurer l\'impact avant d\'agir', ['q'], ['Avant de planifier, regardez de quoi dépend le service : sélectionnez une VM dans la vue Infrastructure, section « Hébergement ». Éteindre un hôte, c\'est éteindre tout ce qu\'il héberge.'], ['Un changement s\'évalue par son **impact**, c\'est-à-dire par les dépendances, pas seulement par l\'équipement qu\'on touche.']),
      stage('s2', 'Planifier le changement', ['plan'], ['Créez un **changement normal** pour HV-01 (lié à l\'actif), avec risque, plan, plan de retour arrière et approbation par un responsable. Planifiez l\'intervention **après 18 h** (hors heures ouvrées).', 'Dans la fiche du changement, « Planifier dans » se compte en heures à partir de maintenant : 8 h après 8 h du matin tombent à 16 h (heures ouvrées), 12 h donnent 20 h.'], ['Un changement approuvé et planifié est une promesse : qui, quoi, quand, comment revenir en arrière.']),
      stage('s3', 'Intervenir sans coupure', ['migrate', 'stop', 'done'], ['Quand l\'horloge atteint l\'heure prévue, **déplacez** d\'abord les deux machines virtuelles vers HV-02 (vue Infrastructure, section « Hébergement » de chaque VM), **puis** éteignez HV-01. Les VM doivent rester en ligne.', 'Marquez le changement comme réalisé puis vérifié, en consignant le résultat.'], ['L\'ordre est tout : migrer d\'abord, éteindre ensuite. Éteindre d\'abord aurait coupé les services, même brièvement.']),
    ],
    setup: [
      { do: 'infra.addDevice', args: { kind: 'hypervisor', name: 'HV-01', x: 560, y: 440 } }, { do: 'infra.addDevice', args: { kind: 'vm', name: 'VM-APP01', x: 656, y: 440 } }, { do: 'infra.addDevice', args: { kind: 'vm', name: 'VM-APP02', x: 752, y: 440 } }, { do: 'infra.addDevice', args: { kind: 'hypervisor', name: 'HV-02', x: 848, y: 440 } },
      { do: 'infra.connect', args: { aDevice: '@dev:HV-01', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port5' } },
      { do: 'infra.connect', args: { aDevice: '@dev:VM-APP01', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port6' } },
      { do: 'infra.connect', args: { aDevice: '@dev:VM-APP02', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port7' } },
      { do: 'infra.connect', args: { aDevice: '@dev:HV-02', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port8' } },
      { do: 'infra.setIp', args: { id: '@dev:HV-01', ip: '192.168.10.30', mask: 24 } }, { do: 'infra.setIp', args: { id: '@dev:VM-APP01', ip: '192.168.10.31', mask: 24 } }, { do: 'infra.setIp', args: { id: '@dev:VM-APP02', ip: '192.168.10.32', mask: 24 } }, { do: 'infra.setIp', args: { id: '@dev:HV-02', ip: '192.168.10.33', mask: 24 } },
      { do: 'infra.setHost', args: { id: '@dev:VM-APP01', host: '@dev:HV-01' } }, { do: 'infra.setHost', args: { id: '@dev:VM-APP02', host: '@dev:HV-01' } },
      DISCOVER,
    ],
    objectives: [
      { id: 'q', label: 'Prévoir l\'effet d\'un arrêt de HV-01 sur ses machines virtuelles', question: Q('Que se passe-t-il pour VM-APP01 et VM-APP02 si l\'on éteint HV-01 sans rien faire d\'autre ?', ['Rien : une machine virtuelle est indépendante de son hôte', 'Elles deviennent injoignables, car elles s\'exécutent sur HV-01', 'Elles migrent automatiquement vers HV-02', 'Elles s\'éteignent mais redémarrent seules'], 1, 'Une VM s\'exécute sur son hôte : sans hôte, plus de VM. Ici aucune haute disponibilité n\'est configurée, donc rien ne les déplace seul.') },
      { id: 'plan', label: 'Un changement normal lié à HV-01 est approuvé et planifié hors heures ouvrées', check: { k: 'all', of: [{ k: 'change', ref: '@chg:CHG-0001', reached: 'scheduled', type: 'normal', linkedAsset: '@ast:HV-01' }, { k: 'changeWindow', ref: '@chg:CHG-0001', outsideBusinessHours: true }] }, requires: ['q'] },
      { id: 'migrate', label: 'VM-APP01 et VM-APP02 sont hébergées sur HV-02', check: { k: 'all', of: [{ k: 'vmHost', vm: '@dev:VM-APP01', host: '@dev:HV-02' }, { k: 'vmHost', vm: '@dev:VM-APP02', host: '@dev:HV-02' }] }, requires: ['plan'] },
      { id: 'stop', label: 'À l\'heure prévue, HV-01 est éteint et les machines virtuelles sont restées en ligne', check: { k: 'all', of: [{ k: 'changeWindow', ref: '@chg:CHG-0001', reachedByNow: true }, { k: 'devicePowered', device: '@dev:HV-01', value: false }, { k: 'deviceOnline', device: '@dev:VM-APP01' }, { k: 'deviceOnline', device: '@dev:VM-APP02' }] }, requires: ['migrate'] },
      { id: 'done', label: 'Le changement est vérifié, avec son résultat consigné', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'verified' }, requires: ['stop'] },
    ],
    hints: [
      { for: 'plan', levels: ['Le changement doit être « normal », lié à l\'actif HV-01, avec risque, plan, retour arrière et approbateur (Éric, responsable).', 'Planifiez dans 12 heures : il sera 20 h, hors heures ouvrées.'] },
      { for: 'migrate', levels: ['Sélectionnez la VM dans la vue Infrastructure : l\'inspecteur permet de choisir son hyperviseur hôte.'] },
      { for: 'stop', levels: ['L\'heure prévue doit être atteinte : avancez l\'horloge. Migrez avant d\'éteindre.'] },
    ],
    solutionText: ['Répondre à la question d\'impact.', 'Créer le changement normal lié à HV-01 : risque, plan, retour arrière, approbateur Éric ; le soumettre, l\'approuver, le planifier dans 12 h.', 'Déplacer les deux VM vers HV-02.', 'Avancer jusqu\'à 20 h, éteindre HV-01 : les VM restent en ligne.', 'Marquer le changement réalisé, consigner le résultat, le vérifier.'],
    solution: [
      answer('q', 1),
      { do: 'itsm.createChange', args: { title: 'Mise à jour du micrologiciel de HV-01', type: 'normal', assetIds: ['@ast:HV-01'] } },
      { do: 'itsm.updateChange', args: { id: '@chg:CHG-0001', fields: { risk: 'medium', plan: 'Migrer les VM vers HV-02, éteindre HV-01, appliquer le micrologiciel, rallumer.', rollback: 'Remettre l\'ancien micrologiciel et ramener les VM sur HV-01.', approver: '@usr:Éric', scheduledAt: 12 * HOUR } } },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'proposed' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'approved' } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'scheduled' } },
      { do: 'infra.setHost', args: { id: '@dev:VM-APP01', host: '@dev:HV-02' } }, { do: 'infra.setHost', args: { id: '@dev:VM-APP02', host: '@dev:HV-02' } },
      { advance: 12 * HOUR },
      { do: 'infra.powerOff', args: { id: '@dev:HV-01' } },
      { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'implemented' } },
      { do: 'itsm.updateChange', args: { id: '@chg:CHG-0001', fields: { result: 'Micrologiciel à jour, aucune coupure constatée sur les VM.' } } }, { do: 'itsm.transitionChange', args: { id: '@chg:CHG-0001', to: 'verified' } },
    ],
    realWorld: 'Les hyperviseurs en cluster migrent les VM à chaud (vMotion, migration à chaud Hyper-V, Proxmox) : c\'est ce que fait ici votre déplacement, en version simplifiée. Les fenêtres de maintenance hors heures ouvrées, l\'approbation par un comité (CAB) et le plan de retour arrière sont des pratiques ITIL standard.',
  },

  /* ============================ TP 45 ============================ */
  {
    id: 'tp-45-groupes-techniciens', number: 45, title: 'Équipes et groupes de techniciens', level: 8, levelLabel: level(8), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Participer à la vie de la cybersécurité', kind: 'worked' }],
    context: 'Le service desk de niveau 1 s\'agrandit : Karim Benali et Nadia Roux le rejoignent. Ils ont déjà un compte, avec le seul rôle « Utilisateur ». Plutôt que d\'ajouter des rôles compte par compte, NovaTech veut un groupe « Support N1 » qui porte le rôle Technicien. Deux tickets attendent déjà d\'être affectés à l\'équipe.',
    stages: [
      stage('s1', 'Pourquoi un groupe ?', ['why'], ['Un **groupe** rassemble des personnes qui ont le même métier. On donne les **rôles au groupe**, et chaque membre les **hérite**. L\'arrivée, le départ ou le changement de droits d\'une équipe se font alors **à un seul endroit**.'], ['Gérer des équipes plutôt que des individus réduit les oublis : le jour où quelqu\'un change de poste, il suffit de le sortir du groupe.']),
      stage('s2', 'Créer le groupe et aiguiller les tickets', ['create', 'inherit', 'route', 'assign'], ['Dans la vue ITSM, page **Groupes et délégations** (Administration), créez le groupe « Support N1 », donnez-lui le rôle **Technicien** et ajoutez Karim et Nadia. Vérifiez sur la page Utilisateurs que leurs rôles personnels n\'ont pas changé.', 'Ouvrez INC-0001 : renseignez la **file d\'attente** (le groupe), puis attribuez-le à Karim. Sans le groupe, l\'outil aurait refusé : seul un technicien peut être assigné.'], ['Un ticket est d\'abord aiguillé vers une équipe (la file), puis pris par une personne de cette équipe.']),
      stage('s3', 'Quand quelqu\'un part', ['leave'], ['Nadia est réaffectée à la comptabilité. Retirez-la du groupe : elle perd immédiatement le rôle Technicien, sans qu\'on ait touché à son compte.'], ['Les droits qui suivent l\'appartenance à un groupe disparaissent avec elle : c\'est la bonne pratique contre l\'accumulation de droits.']),
    ],
    setup: [
      { do: 'itsm.addUser', args: { name: 'Karim Benali', service: 'Informatique', roles: ['user'] } },
      { do: 'itsm.addUser', args: { name: 'Nadia Roux', service: 'Informatique', roles: ['user'] } },
      newIncident('Poste très lent', 'Appel d\'Alice : son PC met dix minutes à démarrer.', 'Alice'),
      newIncident('Écran qui clignote', 'Appel de Bruno : l\'écran de son poste clignote par intermittence.', 'Bruno'),
    ],
    objectives: [
      { id: 'why', label: 'Justifier l\'usage d\'un groupe', question: Q('Pourquoi donner le rôle Technicien à un groupe plutôt qu\'à chaque personne ?', ['C\'est plus rapide à écrire, mais ça n\'a aucun autre intérêt', 'On gère l\'équipe en un seul endroit : arrivée, départ et droits se mettent à jour pour tous les membres', 'Parce qu\'un rôle ne peut pas être donné à une personne', 'Pour cacher qui a quels droits'], 1, 'L\'appartenance au groupe porte les droits. On entre ou on sort du groupe : les droits suivent, sans retoucher chaque compte.') },
      { id: 'create', label: 'Le groupe « Support N1 » existe, avec le rôle Technicien et Karim parmi ses membres', check: { k: 'group', name: 'Support N1', members: ['@usr:Karim'], roles: ['technician'] }, requires: ['why'] },
      { id: 'inherit', label: 'Karim est technicien par son groupe, sans que son compte personnel ait changé', check: { k: 'all', of: [{ k: 'effectiveRole', user: '@usr:Karim', role: 'technician', value: true }, { k: 'userRoles', user: '@usr:Karim', lacks: ['technician'] }] }, requires: ['create'] },
      { id: 'route', label: 'INC-0001 est aiguillé vers la file « Support N1 »', check: { k: 'ticketGroup', ref: T(1), group: 'Support N1' }, requires: ['inherit'] },
      { id: 'assign', label: 'INC-0001 est attribué à Karim', check: { k: 'ticket', ref: T(1), assignee: '@usr:Karim' }, requires: ['route'] },
      { id: 'leave', label: 'Nadia n\'est plus technicien (elle a quitté le groupe)', check: { k: 'effectiveRole', user: '@usr:Nadia', role: 'technician', value: false }, requires: ['assign'] },
    ],
    hints: [
      { for: 'create', levels: ['Page « Groupes et délégations » du menu Administration : nom, rôles, membres.'] },
      { for: 'assign', levels: ['La liste des assignables ne contient que des techniciens : le groupe doit déjà être créé.'] },
      { for: 'leave', levels: ['Retirez la case de Nadia dans la liste des membres du groupe, puis enregistrez les membres.'] },
    ],
    solutionText: ['Répondre à la question.', 'Créer le groupe « Support N1 » (rôle Technicien, membres Karim et Nadia).', 'Aiguiller INC-0001 vers la file du groupe, puis l\'attribuer à Karim.', 'Retirer Nadia des membres du groupe.'],
    solution: [
      answer('why', 1),
      { do: 'itsm.createGroup', args: { name: 'Support N1', roles: ['technician'], members: ['@usr:Karim', '@usr:Nadia'] } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { group: '@grp:Support N1' } } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { assignee: '@usr:Karim' } } },
      { do: 'itsm.setGroupMembers', args: { id: '@grp:Support N1', members: ['@usr:Karim'] } },
    ],
    realWorld: 'Active Directory, Entra ID, GLPI, ServiceNow et Jira gèrent tous des groupes (ou équipes) : les droits se donnent au groupe, jamais à chacun. Les revues d\'accès périodiques vérifient justement qui est dans quel groupe.',
  },

  /* ============================ TP 46 ============================ */
  {
    id: 'tp-46-delegation-conges', number: 46, title: 'Délégation de droits pendant un congé', level: 8, levelLabel: level(8), difficulty: 3, duration: '40 min',
    skills: [{ ref: 'Gérer les habilitations', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }, { ref: 'Participer à la vie de la cybersécurité', kind: 'worked' }],
    timeNote: 'Une délégation a une date de fin. Pour la voir expirer, faites avancer l\'horloge (+1 jour) après avoir testé les droits de Karim : le droit disparaît sans que personne ne le retire.',
    context: 'David Petit, seul technicien de l\'entreprise, part en congé. Karim Benali, qui n\'a que le rôle « Utilisateur », doit le remplacer pendant 24 heures. Donner définitivement le rôle Technicien à Karim serait excessif : on utilise une **délégation**, qui prête le rôle pour une durée limitée.',
    stages: [
      stage('s1', 'Prêter un rôle, pas le donner', ['why', 'deleg'], ['Une **délégation** prête à une personne un rôle que le délégant possède, pour une durée définie. Elle prend fin **toute seule** à l\'échéance. On ne peut déléguer que ce que l\'on détient, et le rôle d\'administrateur ne se délègue pas.', 'Dans la vue ITSM, page **Groupes et délégations**, déléguez le rôle Technicien de David à Karim pour 24 heures.'], ['Un droit temporaire qui expire seul vaut mieux qu\'un droit permanent qu\'on oublie de retirer.']),
      stage('s2', 'Karim remplace David', ['karim', 'work'], ['Agissez en tant que Karim (« Agir en tant que », en haut). Il peut maintenant traiter les tickets : qualifier, attribuer, prendre en charge INC-0001. Avant la délégation, ces actions lui auraient été refusées.'], ['Les actions faites pendant la délégation sont journalisées au nom de **Karim** : la traçabilité reste individuelle.']),
      stage('s3', 'L\'échéance', ['expire', 'after'], ['Faites avancer l\'horloge au-delà de l\'échéance (+1 jour). Dans la page des délégations, l\'état passe à « expirée » ; Karim redevient un simple utilisateur.'], ['Le droit a disparu sans intervention de personne : c\'est tout l\'intérêt de la date de fin.']),
    ],
    setup: [
      { do: 'itsm.addUser', args: { name: 'Karim Benali', service: 'Informatique', roles: ['user'] } },
      newIncident('Imprimante du service comptabilité en panne', 'Appel d\'Alice : l\'imprimante ne sort plus rien.', 'Alice'),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', subcategory: 'Imprimante', impact: 'medium', urgency: 'medium' } } },
    ],
    objectives: [
      { id: 'why', label: 'Justifier une délégation plutôt qu\'un rôle permanent', question: Q('Pourquoi déléguer le rôle Technicien à Karim pour 24 heures plutôt que le lui attribuer ?', ['Parce qu\'un rôle ne peut jamais être attribué', 'Parce que le droit disparaît seul à l\'échéance : pas de droit permanent oublié', 'Parce que Karim n\'a pas de compte', 'Parce que ça évite de tracer ses actions'], 1, 'Le besoin est temporaire (un congé) : le droit doit l\'être aussi. L\'échéance retire le droit sans qu\'on ait à y penser.') },
      { id: 'deleg', label: 'David a délégué le rôle Technicien à Karim', check: { k: 'delegation', from: '@usr:David', to: '@usr:Karim', role: 'technician' }, requires: ['why'] },
      { id: 'karim', label: 'Vous agissez en tant que Karim Benali', check: { k: 'actedAs', user: '@usr:Karim' }, requires: ['deleg'] },
      { id: 'work', label: 'Karim a pris en charge INC-0001, et c\'est lui qui l\'a fait', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), reached: 'in_progress' }, { k: 'didAs', user: '@usr:Karim', type: 'TicketStatusChanged', payload: { to: 'in_progress' } }] }, requires: ['karim'] },
      { id: 'expire', label: 'La délégation est arrivée à échéance (faites avancer l\'horloge)', check: { k: 'delegation', from: '@usr:David', to: '@usr:Karim', role: 'technician', state: 'ended' }, requires: ['work'] },
      { id: 'after', label: 'Prévoir ce qui arrive à Karim après l\'échéance', requires: ['expire'], question: Q('Après l\'échéance, Karim tente de traiter un autre ticket. Que se passe-t-il ?', ['Il le traite : il garde le rôle par habitude', 'L\'action est refusée : le droit a expiré sans que personne n\'ait eu à le retirer', 'Le ticket est traité au nom de David', 'L\'outil le supprime du système'], 1, 'À l\'échéance, Karim retrouve ses seuls droits d\'utilisateur. Chaque refus nomme le droit manquant.') },
    ],
    hints: [
      { for: 'deleg', levels: ['Page « Groupes et délégations » : choisissez De, Vers, Rôle et la durée.'] },
      { for: 'work', levels: ['« Agir en tant que » Karim, puis qualifiez, attribuez (à lui-même) et prenez en charge le ticket.'] },
      { for: 'expire', levels: ['L\'échéance est dans 24 heures simulées : utilisez « +1 jour » en haut de la fenêtre.'] },
    ],
    solutionText: ['Répondre à la question.', 'Déléguer le rôle Technicien de David à Karim, 24 heures.', 'Agir en tant que Karim : qualifier, attribuer à Karim, prendre en charge INC-0001.', 'Avancer d\'un jour : la délégation expire.'],
    solution: [
      answer('why', 1),
      { do: 'itsm.delegate', args: { from: '@usr:David', to: '@usr:Karim', role: 'technician', hours: 24 } },
      { do: 'itsm.actAs', args: { user: '@usr:Karim' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { assignee: '@usr:Karim' } }, as: '@usr:Karim' },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' }, as: '@usr:Karim' }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' }, as: '@usr:Karim' }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' }, as: '@usr:Karim' },
      { advance: DAY + MIN }, answer('after', 1),
    ],
    realWorld: 'Les outils réels appellent cela « remplaçant » (ServiceNow : délégation), « absence » ou « substitution » (GLPI), ou un accès temporaire (PIM dans Entra ID). Le principe est constant : durée bornée, traçabilité au nom de la personne qui agit, interdiction de déléguer les droits d\'administration.',
  },

  /* ============================ TP 47 ============================ */
  {
    id: 'tp-47-escalade-fonctionnelle', number: 47, title: 'Passer la main : l\'escalade fonctionnelle', level: 3, levelLabel: level(3), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Exploiter et dépanner', kind: 'worked' }],
    timeNote: 'Ce TP se joue sur la durée : un incident dure quand on n\'arrive pas à le résoudre. Cliquez sur « +1 h » sept fois (soit 7 h de temps simulé) pour que le SLA devienne « À risque », puis escaladez.',
    context: 'Alice (Comptabilité) ne peut plus ouvrir le partage de fichiers de la compta : « Accès refusé, je suis bloquée pour la clôture ». Le service desk de niveau 1 (David) reprend l\'appel. Le niveau 2 (Samir Haddad, groupe « Support N2 ») est joignable. À vous de décider quand passer la main, et comment.',
    stages: [
      stage('s1', 'Escalader : de quoi parle-t-on ?', ['why'], ['Un support se structure en **niveaux** : **N1** (le service desk : premier contact, cas courants), **N2** (techniciens confirmés : diagnostic approfondi) et **N3** (experts, éditeur, fournisseur).', 'L\'**escalade fonctionnelle** consiste à transférer le ticket **au niveau supérieur** quand on n\'a pas les compétences, les droits ou le temps. L\'**escalade hiérarchique**, elle, **prévient un responsable** (voir le TP suivant) : on ne change pas de niveau, on alerte.'], ['Escalader n\'est pas un échec : c\'est faire intervenir la bonne compétence au bon moment. Ce qui est un échec, c\'est de garder un ticket qu\'on ne sait pas résoudre jusqu\'à ce que le délai soit dépassé.']),
      stage('s2', 'Traiter au niveau 1', ['n1'], ['Qualifiez INC-0001 (catégorie « Réseau », sous-catégorie « Serveur injoignable », impact moyen, urgence élevée), attribuez-le à David et prenez-le en charge. Ajoutez un commentaire qui décrit ce que le niveau 1 a vérifié : c\'est ce que le niveau 2 lira en premier.'], ['Un ticket bien qualifié et commenté se transmet sans perte : le niveau suivant ne repose pas les mêmes questions à l\'utilisateur.']),
      stage('s3', 'Le temps passe', ['time', 'when'], ['Le niveau 1 n\'arrive pas à avancer. Faites passer le temps (7 h) puis regardez le SLA de résolution du ticket : il est **à risque**. Cible P2 : 8 h pour résoudre.'], ['Le SLA donne un repère objectif : on escalade avant la violation, pas après.']),
      stage('s4', 'Escalader et conclure', ['escalate', 'level', 'n2', 'solve'], ['Dans la fiche du ticket, section **Escalade**, saisissez un **motif** précis (ce qui a été essayé, ce qui bloque), choisissez le groupe « Support N2 » et escaladez au niveau 2. Le ticket repasse à « Qualifié », sans assigné : le niveau 2 doit se l\'attribuer. Samir le prend alors, trouve la cause et résout.'], ['Observez l\'historique : l\'escalade est tracée, avec son motif, son auteur et son heure. C\'est aussi une preuve à présenter lors d\'un audit de service.']),
    ],
    setup: [
      { do: 'itsm.addUser', args: { name: 'Samir Haddad', service: 'Informatique', roles: ['user'] } },
      { do: 'itsm.createGroup', args: { name: 'Support N1', members: ['@usr:David'], roles: ['technician'] } },
      { do: 'itsm.createGroup', args: { name: 'Support N2', members: ['@usr:Samir'], roles: ['technician'] } },
      newIncident('Partage compta inaccessible', 'Appel d\'Alice : « Accès refusé » sur le dossier partagé de la comptabilité depuis ce matin. Elle est bloquée pour la clôture.', 'Alice'),
    ],
    objectives: [
      { id: 'why', label: 'Distinguer les deux types d\'escalade', question: Q('Quelle est la différence entre une escalade fonctionnelle et une escalade hiérarchique ?', ['Aucune : ce sont deux mots pour la même chose', 'La fonctionnelle transfère le ticket à un niveau de compétence supérieur ; l\'hiérarchique prévient un responsable', 'La fonctionnelle concerne les incidents, l\'hiérarchique les demandes', 'La hiérarchique résout le ticket à la place du technicien'], 1, 'Fonctionnelle : « qui peut le résoudre ? » (N1 → N2 → N3). Hiérarchique : « qui doit être au courant ? » (le responsable, pour décider ou arbitrer).') },
      { id: 'n1', label: 'INC-0001 est qualifié P2, attribué à David et pris en charge, avec un commentaire', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), reached: 'in_progress', priority: 2, minComments: 1 }, { k: 'didAs', user: '@usr:David', type: 'TicketStatusChanged', payload: { to: 'in_progress' } }] }, requires: ['why'] },
      { id: 'time', label: 'Le temps a passé : 7 h se sont écoulées (utilisez « +1 h »)', check: { k: 'clock', atLeast: 7 * HOUR }, requires: ['n1'] },
      { id: 'when', label: 'Choisir le bon moment pour escalader', requires: ['time'], question: Q('Le SLA du ticket est « À risque » et le niveau 1 est bloqué. Que faites-vous ?', ['J\'attends : il reste du temps', 'J\'escalade maintenant, avec un motif précis, avant que le délai soit dépassé', 'Je clos le ticket pour faire disparaître l\'alerte', 'Je recrée un nouveau ticket pour repartir de zéro'], 1, 'Escalader tôt laisse au niveau suivant le temps d\'agir. Clore ou recréer le ticket fausse les indicateurs et fait perdre l\'historique.') },
      { id: 'escalate', label: 'INC-0001 est escaladé au niveau 2, vers « Support N2 »', check: { k: 'escalated', ref: T(1), kind: 'functional', toLevel: 2, group: 'Support N2' }, requires: ['when'] },
      { id: 'level', label: 'Le ticket est au niveau de support 2', check: { k: 'ticketLevel', ref: T(1), level: 2 }, requires: ['escalate'] },
      { id: 'n2', label: 'Samir (niveau 2) a repris le ticket', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), assignee: '@usr:Samir' }, { k: 'didAs', user: '@usr:Samir', type: 'TicketStatusChanged', payload: { to: 'in_progress' } }] }, requires: ['level'] },
      { id: 'solve', label: 'INC-0001 est résolu avec une solution documentée', check: { k: 'ticket', ref: T(1), reached: 'resolved', solutionMin: 30 }, requires: ['n2'] },
    ],
    hints: [
      { for: 'n1', levels: ['Fiche du ticket : catégorie, sous-catégorie, impact, urgence, assigné, puis les boutons « Étape suivante ».', 'Impact moyen et urgence élevée donnent la priorité P2.'] },
      { for: 'time', levels: ['La commande « +1 h » est en haut de la fenêtre, près de l\'horloge.'] },
      { for: 'escalate', levels: ['Fiche du ticket, section « Escalade ».', 'Le motif doit faire au moins une phrase ; choisissez le groupe « Support N2 ».'] },
      { for: 'n2', levels: ['Après l\'escalade, le ticket n\'a plus d\'assigné : « Agir en tant que » Samir, attribuez-le-lui, puis prenez-le en charge.'] },
    ],
    solutionText: ['Qualifier (Réseau / Serveur injoignable, impact moyen, urgence élevée), attribuer à David, prendre en charge, commenter.', 'Avancer de 7 h : le SLA est à risque.', 'Escalader au niveau 2 vers « Support N2 » avec un motif.', 'Samir s\'attribue le ticket, le prend en charge, documente la solution et résout.'],
    solution: [
      answer('why', 1),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Réseau', subcategory: 'Serveur injoignable', impact: 'medium', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' }, as: '@usr:David' }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' }, as: '@usr:David' },
      { do: 'itsm.addComment', args: { id: T(1), text: 'Niveau 1 : droits vérifiés sur le compte d\'Alice, redémarrage du poste, partage testé depuis PC21 : même refus. Le problème ne vient pas du poste.' }, as: '@usr:David' },
      { advance: 7 * HOUR }, answer('when', 1),
      { do: 'itsm.escalate', args: { id: T(1), kind: 'functional', group: '@grp:Support N2', reason: 'Niveau 1 : poste, compte et réseau vérifiés sans résultat. Il faut regarder les permissions du serveur de fichiers.' }, as: '@usr:David' },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { assignee: '@usr:Samir' } }, as: '@usr:Samir' },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' }, as: '@usr:Samir' }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' }, as: '@usr:Samir' },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Le groupe « Compta » avait été retiré des permissions du dossier partagé lors d\'un nettoyage. Droits rétablis, accès d\'Alice vérifié.' } }, as: '@usr:Samir' },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' }, as: '@usr:Samir' },
    ],
    realWorld: 'Les outils réels parlent de « niveaux de support » (Tier 1, 2, 3) ou de « groupes de résolution » : le ticket est réassigné à un autre groupe, avec une note de transfert. ServiceNow, GLPI ou Jira Service Management gardent l\'historique complet des réaffectations ; des règles peuvent escalader automatiquement quand un SLA approche de l\'échéance.',
  },

  /* ============================ TP 48 ============================ */
  {
    id: 'tp-48-escalade-hierarchique', number: 48, title: 'Prévenir le responsable : l\'escalade hiérarchique', level: 3, levelLabel: level(3), difficulty: 3, duration: '40 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Gérer les habilitations', kind: 'evidence_possible' }],
    timeNote: 'Le SLA d\'un ticket P1 est de 4 h pour résoudre. Cliquez sur « +1 h » trois fois (3 h simulées) : le SLA devient « À risque » et l\'escalade hiérarchique se justifie.',
    context: 'Deux tickets sont arrivés ce matin. Éric Moreau (Direction) ne peut plus émettre les factures clients : l\'activité est à l\'arrêt. Bruno (Comptabilité) signale une souris qui se déconnecte. Il y a un responsable, Éric lui-même, à informer quand l\'enjeu le justifie.',
    stages: [
      stage('s1', 'Informer, ce n\'est pas transférer', ['diff'], ['L\'**escalade hiérarchique** prévient un **responsable** (chef de service, responsable de production, direction) pour qu\'il **décide, arbitre ou communique** : ajouter des moyens, informer les clients, valider une solution de contournement. Elle ne change pas le niveau de support du ticket.', 'Elle se justifie par un **enjeu** : priorité 1 ou 2, ou SLA à risque ou dépassé. Alerter pour tout et n\'importe quoi, c\'est noyer le responsable et perdre sa confiance.'], ['Le responsable ne répare pas : il décide. Plus votre alerte est précise, plus sa décision est rapide.']),
      stage('s2', 'Qualifier pour mesurer l\'enjeu', ['qual'], ['Qualifiez les deux tickets. INC-0001 (facturation à l\'arrêt) : impact élevé, urgence élevée, donc P1. INC-0002 (souris) : impact faible, urgence faible, donc P4. Attribuez-les à David et prenez-les en charge.'], ['C\'est la priorité calculée qui dit si l\'on peut alerter : la qualification n\'est pas une formalité.']),
      stage('s3', 'Alerter à bon escient', ['time', 'why2', 'alert', 'level'], ['Avancez de 3 h. Essayez d\'abord d\'alerter le responsable pour INC-0002 : l\'outil refuse et explique pourquoi. Puis alertez-le pour INC-0001 avec un motif qui dit **l\'impact** et **ce que vous attendez de lui**.'], ['Un bon message d\'escalade hiérarchique tient en trois idées : l\'impact, l\'état d\'avancement, la décision attendue.']),
      stage('s4', 'La réponse du responsable', ['mgr', 'solve'], ['« Agir en tant que » Éric Moreau : en tant que responsable, il laisse une instruction en commentaire. Revenez ensuite à David pour résoudre INC-0001.'], ['Le responsable agit avec ses propres droits : il commente et arbitre, il ne traite pas le ticket (séparation des fonctions).']),
    ],
    setup: [
      newIncident('Facturation clients impossible', 'Appel d\'Éric : plus aucune facture ne peut être émise depuis ce matin, les clients attendent leurs documents.', 'Éric'),
      newIncident('Souris qui se déconnecte', 'Appel de Bruno : la souris sans fil se déconnecte de temps en temps.', 'Bruno'),
    ],
    objectives: [
      { id: 'diff', label: 'Comprendre à quoi sert l\'escalade hiérarchique', question: Q('Quand une escalade hiérarchique est-elle justifiée ?', ['Dès que le technicien est pressé', 'Quand l\'enjeu le justifie : priorité élevée, ou SLA à risque ou dépassé', 'Pour tous les tickets, afin que le responsable soit toujours informé', 'Uniquement après la clôture du ticket'], 1, 'Elle sert à obtenir une décision ou à informer d\'un enjeu. Systématique, elle devient du bruit.') },
      { id: 'qual', label: 'INC-0001 est P1 et INC-0002 est P4, tous deux pris en charge', check: { k: 'all', of: [{ k: 'ticket', ref: T(1), reached: 'in_progress', priority: 1 }, { k: 'ticket', ref: T(2), reached: 'in_progress', priority: 4 }] }, requires: ['diff'] },
      { id: 'time', label: 'Trois heures se sont écoulées (utilisez « +1 h »)', check: { k: 'clock', atLeast: 3 * HOUR }, requires: ['qual'] },
      { id: 'why2', label: 'Expliquer pourquoi INC-0002 n\'est pas alerté', requires: ['time'], question: Q('Pourquoi l\'outil refuse-t-il d\'alerter le responsable pour la souris (INC-0002) ?', ['Parce que Bruno n\'est pas important', 'Parce qu\'il n\'y a pas d\'enjeu : priorité 4 et SLA tenu', 'Parce qu\'on ne peut alerter qu\'un seul ticket par jour', 'Parce que le responsable est absent'], 1, 'Pas de priorité 1 ou 2, pas de SLA menacé : il n\'y a rien à arbitrer. Le responsable n\'a pas à être dérangé.') },
      { id: 'alert', label: 'Le responsable est alerté pour INC-0001', check: { k: 'escalated', ref: T(1), kind: 'hierarchical' }, requires: ['why2'] },
      { id: 'level', label: 'INC-0001 reste au niveau 1 (on a alerté, pas transféré)', check: { k: 'all', of: [{ k: 'ticketLevel', ref: T(1), level: 1 }, { k: 'ticket', ref: T(1), assignee: '@usr:David' }] }, requires: ['alert'] },
      { id: 'mgr', label: 'Éric Moreau, responsable, a laissé une instruction (commentaire)', check: { k: 'didAs', user: '@usr:Éric', type: 'TicketCommented' }, requires: ['level'] },
      { id: 'solve', label: 'INC-0001 est résolu avec une solution documentée', check: { k: 'ticket', ref: T(1), reached: 'resolved', solutionMin: 30 }, requires: ['mgr'] },
    ],
    hints: [
      { for: 'qual', levels: ['INC-0001 : impact élevé, urgence élevée. INC-0002 : impact faible, urgence faible.'] },
      { for: 'alert', levels: ['Fiche du ticket, section « Escalade », bouton « Alerter le responsable ».', 'Le motif dit l\'impact (qui, quoi) et ce que vous attendez du responsable.'] },
      { for: 'mgr', levels: ['« Agir en tant que » Éric Moreau, puis ajoutez un commentaire sur INC-0001.'] },
    ],
    solutionText: ['Qualifier INC-0001 en P1 et INC-0002 en P4, les prendre en charge.', 'Avancer de 3 h.', 'Alerter le responsable pour INC-0001 avec un motif (impact, avancement, décision attendue).', 'Éric commente ; David résout.'],
    solution: [
      answer('diff', 1),
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Logiciel', subcategory: 'Dysfonctionnement', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.updateTicket', args: { id: T(2), fields: { category: 'Matériel', subcategory: 'Périphérique', impact: 'low', urgency: 'low', assignee: '@usr:David' } } },
      ...[1, 2].flatMap(n => ['qualified', 'assigned', 'in_progress'].map((to): Step => ({ do: 'itsm.transitionTicket', args: { id: T(n), to }, as: '@usr:David' }))),
      { advance: 3 * HOUR }, answer('why2', 1),
      { do: 'itsm.escalate', args: { id: T(1), kind: 'hierarchical', reason: 'Toute la facturation clients est à l\'arrêt depuis 3 h, le SLA P1 est menacé. Cause non identifiée : décision attendue sur la communication aux clients et sur le renfort.' }, as: '@usr:David' },
      { do: 'itsm.actAs', args: { user: '@usr:Éric' } },
      { do: 'itsm.addComment', args: { id: T(1), text: 'Reçu. Je préviens les clients concernés. Priorité absolue, tenez-moi informé toutes les heures.' }, as: '@usr:Éric' },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Service de facturation redémarré après libération d\'un verrou bloquant le module d\'émission. Test d\'émission réussi, clients informés.' } }, as: '@usr:David' },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' }, as: '@usr:David' },
    ],
    realWorld: 'ITIL parle d\'« escalade hiérarchique » pour informer ou obtenir une décision, par opposition à l\'« escalade fonctionnelle » qui cherche une compétence. Dans les outils réels, elle déclenche une notification ou un « incident majeur » (ServiceNow, Jira Service Management) et s\'accompagne souvent d\'un point de situation à intervalles réguliers.',
  },
];

SCENARIOS.sort((a, b) => a.number - b.number);

export const getScenario = (id: string): Scenario | undefined => SCENARIOS.find(s => s.id === id);
export type { Hint };
