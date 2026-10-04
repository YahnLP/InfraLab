import { DAY, type Level } from '../core';
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
const level = (n: number) => ['', 'Découverte', 'Inventaire', 'Service Desk', 'Incidents techniques', 'ITIL', 'ITAM', 'CMDB', 'Administration'][n] ?? '';
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
];

export const getScenario = (id: string): Scenario | undefined => SCENARIOS.find(s => s.id === id);
export type { Hint };
