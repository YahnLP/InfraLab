import type { Level } from '../core';
import type { Hint, Scenario, Step } from './types';

const MIN = 60_000;
const DISCOVER: Step = { do: 'inventory.discover', args: { cidr: '192.168.10.0/24' } };
const T = (n: number) => `@tkt:INC-${String(n).padStart(4, '0')}`;
const newIncident = (title: string, description: string, user: string): Step => ({ do: 'itsm.createTicket', args: { title, description, requester: `@usr:${user}`, kind: 'incident' } });
/** Du ticket « nouveau » au ticket clos, avec solution : sert aux solutions rejouables des TP. */
function resolveSteps(ref: string, fields: { category: string; impact: Level; urgency: Level }, solution: string): Step[] {
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
  {
    id: 'tp-06-installer-agent', number: 6, title: 'Installer un agent', level: 2, levelLabel: level(2), difficulty: 1, duration: '20 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Exploiter et dépanner', kind: 'worked' }],
    context: 'NovaTech vient de découvrir son réseau : l\'outil connaît les postes, mais seulement par leur adresse et leur nom. Le poste PC21 (Bruno Leroy) doit être inventorié de façon détaillée : installez-y un agent et obtenez une première remontée.',
    setup: [DISCOVER],
    objectives: [
      { id: 'agent', label: 'Un agent fonctionne sur PC21 et joint le serveur', check: { k: 'agentHealth', device: '@dev:PC21', is: 'ok' } },
      { id: 'inventory', label: 'L\'outil dispose d\'un inventaire détaillé de PC21', check: { k: 'assetInventoried', device: '@dev:PC21' }, requires: ['agent'] },
    ],
    hints: [
      { for: 'agent', levels: ['Les agents se gèrent depuis la vue Infrastructure, sur l\'équipement lui-même.', 'Sélectionnez PC21 et cherchez la section « Agent ».', 'Cliquez sur « Installer l\'agent ».'] },
      { for: 'inventory', levels: ['L\'agent n\'a pas encore parlé au serveur : la première remontée est planifiée.', 'Forcez la remontée depuis l\'inspecteur, ou avancez l\'heure simulée.'] },
    ],
    solutionText: ['Vue Infrastructure → PC21 → section Agent → « Installer l\'agent ».', 'Cliquer sur « Forcer l\'inventaire » (ou avancer d\'une heure simulée).', 'Ouvrir la fiche de l\'actif dans la vue ITSM : les données détaillées viennent de l\'agent.'],
    solution: [{ do: 'agent.install', args: { id: '@dev:PC21' } }, { do: 'agent.runInventory', args: { id: '@dev:PC21' } }],
    realWorld: 'Dans GLPI, l\'agent est le « GLPI Agent » ; dans Microsoft Configuration Manager, le « client » ; Intune s\'appuie sur l\'inscription (enrollment) de l\'appareil.',
  },
  {
    id: 'tp-08-decouverte-reseau', number: 8, title: 'Découverte réseau', level: 2, levelLabel: level(2), difficulty: 1, duration: '20 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }],
    context: 'La base de gestion de NovaTech est vide, alors que le réseau, lui, existe. Lancez une découverte sur le sous-réseau 192.168.10.0/24. Puis demandez-vous : pourquoi les switches n\'apparaissent-ils pas ?',
    setup: [],
    objectives: [
      { id: 'scan', label: 'Lancer une découverte réseau', check: { k: 'event', type: 'NetworkDiscoveryCompleted' } },
      { id: 'printer', label: 'L\'imprimante IMP-COMPTA est connue de l\'outil', check: { k: 'assetExists', device: '@dev:IMP-COMPTA' } },
      { id: 'switch', label: 'Le switch SW02 est connu de l\'outil', check: { k: 'assetExists', device: '@dev:SW02' }, requires: ['scan'] },
    ],
    hints: [
      { for: 'scan', levels: ['La découverte se lance depuis le serveur ITSM, dans la vue ITSM.', 'Menu Inventaire → Découverte réseau, plage 192.168.10.0/24.'] },
      { for: 'switch', levels: ['Une découverte ne voit que ce qui répond sur le réseau.', 'SW02 n\'a pas d\'adresse IP : donnez-lui-en une (inspecteur), puis relancez le scan.', 'Exemple : 192.168.10.2 avec un masque /24.'] },
    ],
    solutionText: ['Vue ITSM → Découverte réseau → scanner 192.168.10.0/24.', 'Constater que les switches n\'apparaissent pas : sans adresse IP, ils ne répondent pas.', 'Vue Infrastructure → SW02 → lui donner 192.168.10.2/24, puis relancer le scan.'],
    solution: [DISCOVER, { do: 'infra.setIp', args: { id: '@dev:SW02', ip: '192.168.10.2', mask: 24 } }, DISCOVER],
    realWorld: 'Les outils de découverte (ICMP, ARP, SNMP) ne voient que les équipements qui répondent. Un switch administrable est découvert par SNMP s\'il a une adresse de management.',
  },
  {
    id: 'tp-10-agent-en-erreur', number: 10, title: 'Agent en erreur', level: 2, levelLabel: level(2), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Le tableau de bord signale des agents qui ne remontent plus correctement sur trois postes. Chacun a une cause différente. Diagnostiquez puis corrigez, poste par poste.',
    setup: [
      { do: 'agent.install', args: { id: '@dev:PC21' } }, { do: 'agent.install', args: { id: '@dev:PC22' } }, { do: 'agent.install', args: { id: '@dev:PC23' } },
      { advance: 10 * MIN },
      { do: 'agent.configure', args: { id: '@dev:PC21', serverUrl: 'http://srv-inventaire/inventory' } },
      { do: 'agent.stop', args: { id: '@dev:PC22' } },
      { do: 'agent.configure', args: { id: '@dev:PC23', version: '2.1' } },
    ],
    objectives: [
      { id: 'pc21', label: 'L\'agent de PC21 est en bonne santé', check: { k: 'agentHealth', device: '@dev:PC21', is: 'ok' } },
      { id: 'pc22', label: 'L\'agent de PC22 est en bonne santé', check: { k: 'agentHealth', device: '@dev:PC22', is: 'ok' } },
      { id: 'pc23', label: 'L\'agent de PC23 est en bonne santé', check: { k: 'agentHealth', device: '@dev:PC23', is: 'ok' } },
    ],
    hints: [
      { for: 'pc21', levels: ['Ouvrez PC21 : le journal de l\'agent dit à quelle adresse il essaie de parler.', 'Le serveur s\'appelle SRV-ITSM : l\'adresse attendue est http://srv-itsm/inventory.', 'Corrigez l\'URL du serveur dans la section Agent.'] },
      { for: 'pc22', levels: ['Regardez l\'état affiché dans la section Agent.', 'Un agent arrêté ne remonte plus rien.'] },
      { for: 'pc23', levels: ['Comparez la version de l\'agent à la version courante.', 'Utilisez « Mettre à jour l\'agent ».'] },
    ],
    solutionText: ['PC21 : l\'URL du serveur est fausse → la remplacer par http://srv-itsm/inventory.', 'PC22 : l\'agent est arrêté → le démarrer.', 'PC23 : l\'agent est obsolète → le mettre à jour.'],
    solution: [{ do: 'agent.configure', args: { id: '@dev:PC21', serverUrl: 'http://srv-itsm/inventory' } }, { do: 'agent.start', args: { id: '@dev:PC22' } }, { do: 'agent.update', args: { id: '@dev:PC23' } }],
    realWorld: 'Un agent mal configuré, arrêté ou obsolète laisse l\'inventaire se périmer sans alerte : les outils proposent des rapports « dernier contact » pour les repérer.',
  },
  {
    id: 'tp-14-priorite', number: 14, title: 'Priorité : impact et urgence', level: 3, levelLabel: level(3), difficulty: 2, duration: '25 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'Deux tickets arrivent pour la même cause apparente : une imprimante en panne. Pourtant ils ne se traitent pas dans le même ordre. Qualifiez-les, laissez la matrice calculer la priorité, puis attribuez le plus urgent à David.',
    setup: [
      DISCOVER,
      newIncident('Imprimante de la comptabilité en panne', 'IMP-COMPTA est en panne. Clôture mensuelle aujourd\'hui : les 8 personnes du service ne peuvent pas éditer les factures avant 17 h.', 'Alice'),
      newIncident('Mon imprimante ne marche plus', 'L\'imprimante de mon bureau ne répond plus. Rien de pressé, j\'utilise celle du couloir en attendant.', 'Chloé'),
    ],
    objectives: [
      { id: 'p1', label: 'INC-0001 est qualifié en P1 (Matériel)', check: { k: 'ticket', ref: T(1), category: 'Matériel', priority: 1 } },
      { id: 'p4', label: 'INC-0002 est qualifié en P4 (Matériel)', check: { k: 'ticket', ref: T(2), category: 'Matériel', priority: 4 } },
      { id: 'link', label: 'INC-0001 est lié à l\'imprimante IMP-COMPTA', check: { k: 'ticket', ref: T(1), linkedDevice: '@dev:IMP-COMPTA' } },
      { id: 'assign', label: 'INC-0001 est attribué à David', check: { k: 'ticket', ref: T(1), assignee: '@usr:David', status: 'assigned' }, requires: ['p1'] },
    ],
    hints: [
      { for: 'p1', levels: ['L\'impact : combien de personnes ou de services sont touchés ? L\'urgence : quel délai est toléré ?', 'Ici : tout un service, avec une échéance aujourd\'hui.', 'Impact élevé, urgence élevée → P1.'] },
      { for: 'p4', levels: ['Une seule personne, avec un contournement et aucune échéance.', 'Impact faible, urgence faible.'] },
    ],
    solutionText: ['INC-0001 : catégorie Matériel, impact élevé (8 personnes), urgence élevée (échéance aujourd\'hui) → P1.', 'INC-0002 : catégorie Matériel, impact faible, urgence faible → P4.', 'Lier INC-0001 à IMP-COMPTA, le qualifier puis l\'attribuer à David.'],
    solution: [
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:IMP-COMPTA' } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } },
      { do: 'itsm.updateTicket', args: { id: T(2), fields: { category: 'Matériel', impact: 'low', urgency: 'low' } } },
    ],
    realWorld: 'La priorité n\'est jamais saisie à la main dans un outil ITIL : elle se déduit de l\'impact et de l\'urgence, pour que deux techniciens arrivent à la même conclusion.',
  },
  {
    id: 'tp-16-pc-deconnecte', number: 16, title: 'PC déconnecté', level: 4, levelLabel: level(4), difficulty: 2, duration: '45 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Alice Martin (Comptabilité) a ouvert un ticket : « Je n\'ai plus accès au réseau ». Son poste PC-COMPTA-01 est inventorié par un agent. Qualifiez le ticket, trouvez la cause dans l\'infrastructure, corrigez, vérifiez que l\'outil revoit le poste, documentez et clôturez.',
    setup: [
      { do: 'agent.install', args: { id: '@dev:PC-COMPTA-01' } }, { advance: 10 * MIN }, DISCOVER,
      { do: 'infra.disconnect', args: { link: '@lnk:PC-COMPTA-01' } },
      newIncident('Je n\'ai plus accès au réseau', 'Depuis ce matin je n\'ai plus Internet ni mes dossiers partagés. Mon écran est allumé, tout le reste a l\'air normal.', 'Alice'),
    ],
    objectives: [
      { id: 'classify', label: 'Qualifier le ticket : catégorie Réseau, impact et urgence renseignés', check: { k: 'ticket', ref: T(1), category: 'Réseau', qualified: true } },
      { id: 'link', label: 'Lier le ticket au poste PC-COMPTA-01', check: { k: 'ticket', ref: T(1), linkedDevice: '@dev:PC-COMPTA-01' } },
      { id: 'fix', label: 'Remettre PC-COMPTA-01 en ligne', check: { k: 'deviceOnline', device: '@dev:PC-COMPTA-01' } },
      { id: 'agent', label: 'Vérifier que l\'agent du poste est de nouveau joignable', check: { k: 'agentHealth', device: '@dev:PC-COMPTA-01', is: 'ok' }, requires: ['fix'] },
      { id: 'doc', label: 'Documenter la solution dans le ticket', check: { k: 'ticket', ref: T(1), hasSolution: true } },
      { id: 'close', label: 'Clôturer le ticket', check: { k: 'ticket', ref: T(1), status: 'closed' }, requires: ['fix', 'doc'] },
    ],
    hints: [
      { for: 'fix', levels: ['Que dit l\'infrastructure sur l\'état du poste ?', 'Cliquez sur le poste : l\'inspecteur explique pourquoi il est hors ligne.', 'Un câble a été débranché : rebranchez eth0 sur le switch.'] },
      { for: 'link', levels: ['Un ticket sans actif ne dit pas de quel équipement on parle.', 'Dans la fiche du ticket : « Lier un actif… ».'] },
      { for: 'agent', levels: ['L\'agent n\'est pas tombé en panne : il ne pouvait plus joindre le serveur.', 'Consultez son état dans l\'inspecteur ou dans Inventaire → Agents.'] },
      { for: 'doc', levels: ['Écrivez ce qui a été constaté, fait et vérifié : un collègue doit pouvoir le réutiliser.'] },
    ],
    forbid: NOREPLACE,
    solutionText: ['Qualifier : Réseau / Poste sans réseau, impact faible, urgence moyenne.', 'Lier le ticket à PC-COMPTA-01, puis « Voir dans l\'infrastructure ».', 'Le poste est hors ligne : lien absent. Rebrancher eth0 sur SW-SIEGE-01 (port 3).', 'Constater que l\'agent redevient joignable, rédiger la solution, résoudre puis clore.'],
    solution: [
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:PC-COMPTA-01' } },
      { do: 'infra.connect', args: { aDevice: '@dev:PC-COMPTA-01', aPort: 'eth0', bDevice: '@dev:SW-SIEGE-01', bPort: 'port3' } },
      ...resolveSteps(T(1), { category: 'Réseau', impact: 'low', urgency: 'medium' }, 'Câble réseau débranché : rebranché sur le port 3 du switch SW-SIEGE-01. Agent de nouveau joignable.'),
    ],
    realWorld: 'GLPI : Assistance → Tickets, avec « éléments associés » ; ServiceNow : Incident avec « Configuration item ». Le lien ticket ↔ actif donne l\'historique d\'un poste.',
  },
  {
    id: 'tp-18-switch-en-panne', number: 18, title: 'Switch en panne', level: 4, levelLabel: level(4), difficulty: 1, duration: '20 min',
    skills: [{ ref: 'Exploiter et dépanner', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }],
    context: 'Trois postes du bâtiment passent hors ligne au même moment. Avant d\'intervenir sur chacun, ouvrez le journal et utilisez « Pourquoi ? » pour remonter à la cause commune.',
    setup: [{ do: 'infra.powerOff', args: { id: '@dev:SW02' } }],
    objectives: [
      { id: 'cause', label: 'Remettre le switch SW02 sous tension', check: { k: 'devicePowered', device: '@dev:SW02' } },
      { id: 'effect', label: 'Constater que PC21, PC22 et PC23 sont de nouveau en ligne', check: { k: 'all', of: ['PC21', 'PC22', 'PC23'].map(n => ({ k: 'deviceOnline' as const, device: `@dev:${n}` })) }, requires: ['cause'] },
    ],
    hints: [{ for: 'cause', levels: ['Les trois postes ont-ils un point commun ?', 'Ils sont tous reliés à SW02. Cliquez sur un événement du journal puis sur « Pourquoi ? ».'] }],
    forbid: NOREPLACE,
    solutionText: ['Les trois événements « hors ligne » ont le même événement racine : SW02 éteint.', 'Rallumer SW02 : les trois postes repassent en ligne.'],
    solution: [{ do: 'infra.powerOn', args: { id: '@dev:SW02' } }],
    realWorld: 'Une alerte « injoignable » sur plusieurs équipements d\'un même segment pointe presque toujours vers un équipement amont : c\'est la corrélation d\'événements.',
  },
  {
    id: 'tp-19-plusieurs-utilisateurs', number: 19, title: 'Plusieurs utilisateurs impactés', level: 4, levelLabel: level(4), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Trois utilisateurs ont ouvert chacun un ticket : plus de réseau. Ne traitez pas trois pannes : cherchez la cause commune, corrigez-la une seule fois, puis documentez et clôturez chaque ticket en le reliant au bon poste.',
    setup: [
      { do: 'agent.install', args: { id: '@dev:PC21' } }, { do: 'agent.install', args: { id: '@dev:PC22' } }, { do: 'agent.install', args: { id: '@dev:PC23' } }, { advance: 10 * MIN },
      { do: 'infra.powerOff', args: { id: '@dev:SW02' } },
      newIncident('Plus de réseau sur mon poste', 'Je n\'ai plus accès à rien depuis 9 h.', 'Bruno'),
      newIncident('Internet ne marche plus', 'Impossible d\'ouvrir mes applications en ligne.', 'Chloé'),
      newIncident('Mon PC est coupé du réseau', 'Je ne vois plus les dossiers partagés.', 'David'),
    ],
    objectives: [
      { id: 'cause', label: 'Corriger la cause commune : SW02 sous tension', check: { k: 'devicePowered', device: '@dev:SW02' } },
      { id: 'online', label: 'Les trois postes sont de nouveau en ligne', check: { k: 'all', of: ['PC21', 'PC22', 'PC23'].map(n => ({ k: 'deviceOnline' as const, device: `@dev:${n}` })) }, requires: ['cause'] },
      { id: 'links', label: 'Chaque ticket est lié au poste de son demandeur', check: { k: 'all', of: [[1, 'PC21'], [2, 'PC22'], [3, 'PC23']].map(([n, d]) => ({ k: 'ticket' as const, ref: T(n as number), linkedDevice: `@dev:${d}` })) } },
      { id: 'docs', label: 'La solution est documentée dans les trois tickets', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), hasSolution: true })) } },
      { id: 'closed', label: 'Les trois tickets sont clos', check: { k: 'all', of: [1, 2, 3].map(n => ({ k: 'ticket' as const, ref: T(n), status: 'closed' as const })) }, requires: ['online', 'docs'] },
    ],
    hints: [
      { for: 'cause', levels: ['Trois tickets, mais combien de pannes ?', 'Regardez ce que PC21, PC22 et PC23 ont en commun dans le schéma.', 'SW02 est éteint.'] },
      { for: 'links', levels: ['Chaque ticket doit être relié à l\'actif concerné : c\'est l\'historique de chaque poste.'] },
    ],
    forbid: NOREPLACE,
    solutionText: ['Les trois postes sont reliés à SW02, éteint : une seule cause.', 'Rallumer SW02, puis lier chaque ticket à son poste.', 'Qualifier, attribuer, documenter la même cause dans chaque ticket, résoudre et clore.'],
    solution: [
      { do: 'infra.powerOn', args: { id: '@dev:SW02' } },
      ...[[1, 'PC21'], [2, 'PC22'], [3, 'PC23']].flatMap(([n, d]): Step[] => [
        { do: 'itsm.linkAsset', args: { id: T(n as number), asset: `@ast:${d}` } },
        ...resolveSteps(T(n as number), { category: 'Réseau', impact: 'medium', urgency: 'medium' }, 'Cause commune : switch SW02 éteint. Remis sous tension, poste de nouveau en ligne.'),
      ]),
    ],
    realWorld: 'Corréler plusieurs tickets vers une même cause est le point de départ de la gestion des problèmes (ITIL) : on traite la cause une fois, on documente chaque incident.',
  },

  {
    id: 'tp-22-sla', number: 22, title: 'SLA : tenir les délais', level: 5, levelLabel: level(5), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Deux tickets attendent depuis 10 minutes (temps simulé). Le premier bloque toute la comptabilité : un SLA P1 laisse 15 minutes pour prendre en charge, 4 heures pour résoudre. Le second est mineur. Qualifiez, prenez en charge à temps, résolvez le P1, et mettez le ticket mineur en attente de l\'utilisateur : l\'horloge doit alors s\'arrêter.',
    setup: [
      DISCOVER,
      newIncident('Plus aucun accès aux applications métier', 'Toute la comptabilité est bloquée, la clôture de paie est ce soir.', 'Alice'),
      newIncident('Souris à remplacer', 'Ma souris double-clique parfois. Pas urgent.', 'Chloé'),
      { advance: 10 * MIN },
    ],
    objectives: [
      { id: 'p1', label: 'Qualifier INC-0001 en P1', check: { k: 'ticket', ref: T(1), priority: 1, qualified: true } },
      { id: 'respond', label: 'Prendre en charge INC-0001 avant la fin du délai de réactivité', check: { k: 'sla', ticket: T(1), respond: 'met' }, requires: ['p1'] },
      { id: 'p4', label: 'Qualifier INC-0002 en P4', check: { k: 'ticket', ref: T(2), priority: 4, qualified: true } },
      { id: 'hold', label: 'Mettre INC-0002 en attente : son horloge SLA est suspendue', check: { k: 'sla', ticket: T(2), resolve: 'paused' }, requires: ['p4'] },
      { id: 'resolve', label: 'Résoudre INC-0001 dans le délai, solution documentée', check: { k: 'all', of: [{ k: 'sla', ticket: T(1), resolve: 'met' }, { k: 'ticket', ref: T(1), hasSolution: true }] }, requires: ['respond'] },
    ],
    hints: [
      { for: 'respond', levels: ['Le SLA court depuis la création du ticket, pas depuis votre lecture.', 'Qualifiez, attribuez, puis « Prendre en charge » : c\'est la prise en charge qui arrête l\'horloge de réactivité.'] },
      { for: 'hold', levels: ['Un ticket qui attend l\'utilisateur ne doit pas pénaliser l\'équipe.', 'Il faut d\'abord le prendre en charge, puis « Mettre en attente ».'] },
    ],
    solutionText: ['INC-0001 : Réseau, impact élevé, urgence élevée → P1 ; attribuer à David puis prendre en charge tout de suite.', 'INC-0002 : Matériel, impact faible, urgence faible → P4 ; prendre en charge puis mettre en attente.', 'Rédiger la solution de INC-0001 et le résoudre avant la fin du délai.'],
    solution: [
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Réseau', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } },
      { do: 'itsm.updateTicket', args: { id: T(2), fields: { category: 'Matériel', impact: 'low', urgency: 'low', assignee: '@usr:David' } } },
      { do: 'itsm.transitionTicket', args: { id: T(2), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(2), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(2), to: 'in_progress' } }, { do: 'itsm.transitionTicket', args: { id: T(2), to: 'pending' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Cause identifiée et corrigée, accès rétablis.' } } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' } },
    ],
    realWorld: 'Un SLA est un engagement mesuré : délai de prise en charge et délai de résolution selon la priorité. Les statuts « en attente » suspendent l\'horloge ; les outils (ServiceNow, GLPI) affichent le temps restant et alertent avant le dépassement.',
  },
  {
    id: 'tp-23-probleme', number: 23, title: 'Problem Management', level: 5, levelLabel: level(5), difficulty: 3, duration: '40 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Trois incidents « plus de réseau » ont été clos cette semaine, chacun résolu en rallumant le switch SW02. Le service est rétabli à chaque fois, mais la panne revient. Ouvrez un problème, regroupez les incidents, identifiez la cause racine, documentez un contournement puis la correction définitive.',
    setup: [
      { do: 'infra.powerOff', args: { id: '@dev:SW02' } },
      newIncident('Plus de réseau sur mon poste', 'Plus rien ne fonctionne.', 'Bruno'), newIncident('Internet coupé', 'Je n\'ai plus Internet.', 'Chloé'), newIncident('Dossiers partagés inaccessibles', 'Je ne vois plus les dossiers partagés.', 'David'),
      { do: 'infra.powerOn', args: { id: '@dev:SW02' } },
      ...[1, 2, 3].flatMap(n => resolveSteps(T(n), { category: 'Réseau', impact: 'medium', urgency: 'medium' }, 'Switch SW02 rallumé : service rétabli.')),
    ],
    objectives: [
      { id: 'group', label: 'Créer le problème PRB-0001 et y rattacher les trois incidents', check: { k: 'problem', ref: '@prb:PRB-0001', minTickets: 3 } },
      { id: 'known', label: 'Passer en « erreur connue » : cause racine et contournement renseignés', check: { k: 'problem', ref: '@prb:PRB-0001', reached: 'known_error', hasRootCause: true, hasWorkaround: true }, requires: ['group'] },
      { id: 'fix', label: 'Décrire la correction définitive et résoudre le problème', check: { k: 'problem', ref: '@prb:PRB-0001', status: 'resolved', hasFix: true }, requires: ['known'] },
    ],
    hints: [
      { for: 'group', levels: ['Trois tickets, une cause : c\'est un problème, pas trois incidents.', 'Menu ITIL → Problèmes, ou « Ouvrir un problème depuis ce ticket » dans un incident, puis rattachez les deux autres.'] },
      { for: 'known', levels: ['Un contournement permet de traiter les prochains incidents en attendant la correction.', 'Exemple : prévoir un second switch de secours à rebrancher en cas de panne.'] },
    ],
    solutionText: ['Créer PRB-0001 « Défaillance du switch SW02 » et y rattacher INC-0001, INC-0002 et INC-0003.', 'Lancer l\'analyse, renseigner la cause racine (alimentation défaillante), un contournement (switch de secours) : erreur connue.', 'Décrire la correction définitive (remplacer le switch, via un changement) et résoudre.'],
    solution: [
      { do: 'itsm.createProblem', args: { title: 'Défaillance du switch SW02', tickets: [T(1), T(2), T(3)] } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'analysis' } },
      { do: 'itsm.updateProblem', args: { id: '@prb:PRB-0001', fields: { rootCause: 'Alimentation défaillante du switch SW02.', workaround: 'Rallumer SW02 ou brancher le switch de secours.' } } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'known_error' } },
      { do: 'itsm.updateProblem', args: { id: '@prb:PRB-0001', fields: { permanentFix: 'Remplacer SW02 (changement CHG-0001).' } } },
      { do: 'itsm.transitionProblem', args: { id: '@prb:PRB-0001', to: 'resolved' } },
    ],
    realWorld: 'ITIL distingue l\'incident (rétablir le service) du problème (supprimer la cause). Une erreur connue est un problème dont la cause et le contournement sont documentés, souvent publiés en base de connaissances.',
  },
  {
    id: 'tp-24-changement', number: 24, title: 'Change Management', level: 5, levelLabel: level(5), difficulty: 3, duration: '45 min',
    skills: [{ ref: 'Travailler en mode projet', kind: 'worked' }, { ref: 'Administrer une infrastructure', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Le switch SW02 est défaillant. Le remplacer touche la production : il faut un changement. Montez le dossier (risque, plan, retour arrière), faites-le approuver par la direction, réalisez l\'intervention dans l\'infrastructure, puis vérifiez avant de clore.',
    setup: [{ do: 'infra.setIp', args: { id: '@dev:SW02', ip: '192.168.10.2', mask: 24 } }, DISCOVER],
    objectives: [
      { id: 'create', label: 'Créer CHG-0001 « Remplacement de SW02 », lié à l\'actif SW02', check: { k: 'change', ref: '@chg:CHG-0001', linkedAsset: '@ast:SW02' } },
      { id: 'proposed', label: 'Soumettre le changement (risque, plan et retour arrière renseignés)', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'proposed' }, requires: ['create'] },
      { id: 'approved', label: 'Obtenir l\'approbation d\'Éric Moreau (direction)', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'approved', approver: '@usr:Éric' }, requires: ['proposed'] },
      { id: 'do', label: 'Réaliser le remplacement de SW02 dans l\'infrastructure', check: { k: 'event', type: 'DeviceReplaced' }, requires: ['approved'] },
      { id: 'verified', label: 'Marquer le changement réalisé, puis le vérifier (résultat consigné)', check: { k: 'change', ref: '@chg:CHG-0001', reached: 'verified' }, requires: ['do'] },
      { id: 'closed', label: 'Clore le changement', check: { k: 'change', ref: '@chg:CHG-0001', status: 'closed' }, requires: ['verified'] },
    ],
    hints: [
      { for: 'proposed', levels: ['Un changement non préparé ne se soumet pas : le bouton vous dit ce qui manque.', 'Le retour arrière répond à : que fait-on si le nouveau switch ne fonctionne pas ?'] },
      { for: 'approved', levels: ['Seul un responsable approuve un changement normal.', 'Désignez Éric Moreau comme approbateur, puis approuvez.'] },
      { for: 'do', levels: ['L\'intervention se fait dans la vue Infrastructure, pas dans le changement.', 'Sélectionnez SW02 → « Remplacer l\'équipement ».'] },
    ],
    solutionText: ['Créer CHG-0001, le lier à SW02, évaluer le risque, écrire plan et retour arrière, soumettre.', 'Désigner Éric Moreau comme approbateur et approuver, puis planifier.', 'Remplacer SW02 dans l\'infrastructure, marquer le changement réalisé, consigner le résultat, vérifier puis clore.'],
    solution: [
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
  {
    id: 'tp-25-connaissances', number: 25, title: 'Knowledge Management', level: 5, levelLabel: level(5), difficulty: 2, duration: '30 min',
    skills: [{ ref: 'Assurer la traçabilité', kind: 'worked' }, { ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }],
    context: 'INC-0001 (poste d\'Alice, câble débranché) est clos avec une solution. Aujourd\'hui, Chloé signale le même symptôme. Capitalisez : rédigez et publiez un article depuis INC-0001, utilisez-le pour traiter INC-0002, puis clôturez.',
    setup: [
      DISCOVER, { do: 'infra.disconnect', args: { link: '@lnk:PC-COMPTA-01' } },
      newIncident('Plus de réseau sur mon poste', 'Mon poste n\'a plus de connexion réseau depuis ce matin.', 'Alice'),
      { do: 'infra.connect', args: { aDevice: '@dev:PC-COMPTA-01', aPort: 'eth0', bDevice: '@dev:SW-SIEGE-01', bPort: 'port3' } },
      ...resolveSteps(T(1), { category: 'Réseau', impact: 'low', urgency: 'medium' }, 'Câble réseau débranché : le rebrancher sur le switch et vérifier que le poste repasse en ligne.'),
      { do: 'infra.disconnect', args: { link: '@lnk:PC22' } },
      newIncident('Mon PC ne se connecte plus', 'Plus de réseau sur mon poste, tout était normal hier.', 'Chloé'),
    ],
    objectives: [
      { id: 'draft', label: 'Créer un article depuis INC-0001, classé en Réseau', check: { k: 'article', ref: '@kb:KB-0001', sourceTicket: T(1), category: 'Réseau' } },
      { id: 'publish', label: 'Publier l\'article', check: { k: 'article', ref: '@kb:KB-0001', status: 'published' }, requires: ['draft'] },
      { id: 'reuse', label: 'Associer l\'article à INC-0002', check: { k: 'article', ref: '@kb:KB-0001', minTickets: 1 }, requires: ['publish'] },
      { id: 'fix', label: 'Remettre PC22 en ligne', check: { k: 'deviceOnline', device: '@dev:PC22' } },
      { id: 'close', label: 'Résoudre et clore INC-0002 avec sa solution', check: { k: 'ticket', ref: T(2), status: 'closed', hasSolution: true }, requires: ['fix', 'reuse'] },
    ],
    hints: [
      { for: 'draft', levels: ['Le bon moment pour capitaliser : juste après la résolution.', 'Ouvrez INC-0001 : « Rédiger un article depuis ce ticket ».'] },
      { for: 'reuse', levels: ['Un brouillon n\'est pas visible : il faut publier avant de l\'associer.', 'Dans INC-0002, section Base de connaissances.'] },
    ],
    solutionText: ['Depuis INC-0001 : créer l\'article (les champs sont préremplis), ajouter la cause, publier.', 'Dans INC-0002 : associer l\'article, appliquer la solution (rebrancher PC22).', 'Qualifier, documenter et clore INC-0002.'],
    solution: [
      { do: 'itsm.createArticle', args: { ticket: T(1) } },
      { do: 'itsm.updateArticle', args: { id: '@kb:KB-0001', fields: { cause: 'Câble réseau débranché ou mal enfiché.' } } },
      { do: 'itsm.publishArticle', args: { id: '@kb:KB-0001' } },
      { do: 'itsm.linkArticle', args: { article: '@kb:KB-0001', ticket: T(2) } },
      { do: 'infra.connect', args: { aDevice: '@dev:PC22', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port3' } },
      ...resolveSteps(T(2), { category: 'Réseau', impact: 'low', urgency: 'medium' }, 'Appliqué KB-0001 : câble rebranché, poste de nouveau en ligne.'),
    ],
    realWorld: 'Une base de connaissances (Knowledge) transforme une résolution en actif réutilisable : le service desk gagne du temps et le libre-service de l\'utilisateur devient possible.',
  },
];

export const getScenario = (id: string): Scenario | undefined => SCENARIOS.find(s => s.id === id);
export type { Hint };
