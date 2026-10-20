import { DAY } from '../core';
import type { Scenario, Step } from './types';
import { DISCOVER, T, newIncident, answer, stage, Q, level } from './catalog';

/**
 * TP « de cours » : ils ne figurent pas au catalogue de l'application. Ils sont publiés sous forme de fichiers
 * (.infralab-tp.json) à télécharger depuis les fiches de TP du cours, puis à ouvrir avec « Ouvrir ».
 */
export const COURSE_TPS: Scenario[] = [
  /* ============================ TP 49 ============================ */
  {
    id: 'tp-49-audit-inventaire', number: 49, title: 'Audit d\'inventaire : peut-on se fier aux chiffres ?', level: 2, levelLabel: level(2), difficulty: 2, duration: '40 min',
    skills: [{ ref: 'Gérer le patrimoine informatique', kind: 'worked' }, { ref: 'Exploiter et dépanner', kind: 'worked' }],
    timeNote: 'Trois jours simulés se sont écoulés depuis la mise en place des agents. Après une réparation, avancez l\'horloge (+1 h ou +1 jour) ou forcez la remontée pour voir la fiche se mettre à jour.',
    context: 'NovaTech compte cinq postes de travail. Quatre ont un agent, un seul n\'en a pas. La direction demande un état des lieux avant d\'acheter des licences : « Combien de postes sont réellement inventoriés, et peut-on se fier aux chiffres de l\'outil ? »',
    stages: [
      stage('s1', 'Mesurer la couverture réelle', ['cover'],
        ['Un agent **installé** n\'est pas un agent **qui remonte**. Pour mesurer la couverture d\'un inventaire, on compte les postes dont l\'agent est **actif** (état « Agent actif » dans Inventaire → Agents), pas ceux où il a été posé un jour.', 'Comptez les cinq postes : combien remontent réellement leur inventaire ?'],
        ['Le taux de couverture honnête se calcule sur les agents actifs, rapportés au nombre total de postes.']),
      stage('s2', 'Réparer les agents défaillants', ['pc22', 'pc23', 'sync'],
        ['Deux agents sont en défaut, pour deux causes différentes. Lisez l\'état de chacun et le journal de l\'agent (propriétés du poste, section Agent) avant d\'agir.', 'Une fois réparé, un agent doit avoir remonté un inventaire **à jour** : la fiche ne doit plus montrer d\'écart avec la réalité.'],
        ['Chaque cause a son remède : démarrer un agent arrêté, corriger l\'adresse du serveur. C\'est la remontée suivante qui rétablit la fiche.']),
      stage('s3', 'Ce que l\'outil ne voit pas', ['blind', 'pc24'],
        ['TeamViewer est un logiciel de prise de contrôle à distance interdit par la politique de NovaTech. Comparez, dans Parc → Logiciels, ce que l\'outil connaît avec ce qui est réellement installé (vue Infrastructure).', 'Un poste sans agent est invisible pour l\'outil : ses installations, interdites ou non, lui échappent. Le remède est un agent, pas une saisie manuelle.'],
        ['Les chiffres d\'un outil d\'inventaire valent ce que valent ses agents : on les complète en couvrant le parc.']),
    ],
    setup: [
      { do: 'infra.addDevice', args: { kind: 'workstation', name: 'PC24', x: 656, y: 440 } },
      { do: 'infra.connect', args: { aDevice: '@dev:PC24', aPort: 'eth0', bDevice: '@dev:SW02', bPort: 'port5' } },
      { do: 'infra.setIp', args: { id: '@dev:PC24', ip: '192.168.10.25', mask: 24 } },
      { do: 'infra.installSoftware', args: { id: '@dev:PC24', softwareId: 'sw-office' } },
      { do: 'infra.installSoftware', args: { id: '@dev:PC24', softwareId: 'sw-teamviewer' } },
      { do: 'itsm.setSoftwarePolicy', args: { softwareId: 'sw-teamviewer', policy: 'forbidden' } },
      DISCOVER,
      ...['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'].map((n): Step => ({ do: 'agent.install', args: { id: `@dev:${n}` } })),
      ...['PC-COMPTA-01', 'PC21', 'PC22', 'PC23'].map((n): Step => ({ do: 'agent.runInventory', args: { id: `@dev:${n}` } })),
      { do: 'agent.stop', args: { id: '@dev:PC22' } },
      { do: 'agent.configure', args: { id: '@dev:PC23', serverUrl: 'http://srv-inventaire/inventory' } },
      { do: 'infra.installSoftware', args: { id: '@dev:PC22', softwareId: 'sw-teamviewer' } },
      { advance: 3 * DAY },
    ],
    objectives: [
      { id: 'cover', label: 'Compter les postes dont l\'agent remonte réellement', question: Q('Sur les cinq postes de travail, combien remontent réellement leur inventaire ?', ['Cinq : tous sont dans l\'outil', 'Quatre : ceux où un agent est installé', 'Deux : PC-COMPTA-01 et PC21', 'Un seul'], 2, 'PC22 a un agent arrêté, PC23 un agent mal configuré, PC24 n\'a pas d\'agent : seuls PC-COMPTA-01 et PC21 remontent.') },
      { id: 'pc22', label: 'L\'agent de PC22 est de nouveau actif', check: { k: 'agentHealth', device: '@dev:PC22', is: 'ok' }, requires: ['cover'] },
      { id: 'pc23', label: 'L\'agent de PC23 est de nouveau actif', check: { k: 'agentHealth', device: '@dev:PC23', is: 'ok' }, requires: ['cover'] },
      { id: 'sync', label: 'Les fiches de PC22 et PC23 sont à jour, sans écart avec la réalité', check: { k: 'all', of: [{ k: 'assetInSync', device: '@dev:PC22' }, { k: 'assetInSync', device: '@dev:PC23' }] }, requires: ['pc22', 'pc23'] },
      { id: 'blind', label: 'Comparer installations connues et installations réelles de TeamViewer', requires: ['sync'], question: Q('Les agents de PC22 et PC23 sont réparés ; PC24 n\'a toujours pas d\'agent. Combien d\'installations de TeamViewer l\'outil connaît-il, et combien existent réellement ?', ['3 connues, 3 réelles', '2 connues, 3 réelles', '1 connue, 3 réelles', '2 connues, 2 réelles'], 1, 'PC22 et PC23 sont connus ; PC24, sans agent, échappe à l\'outil : l\'installation interdite y est invisible.') },
      { id: 'pc24', label: 'PC24 est suivi par un agent actif', check: { k: 'agentHealth', device: '@dev:PC24', is: 'ok' }, requires: ['blind'] },
    ],
    hints: [
      { for: 'pc22', levels: ['Regardez l\'état affiché dans la section Agent de PC22.', 'L\'agent est arrêté : démarrez-le.'] },
      { for: 'pc23', levels: ['Le journal de l\'agent dit à quelle adresse il essaie de parler.', 'Comparez avec http://<nom du serveur>/inventory : l\'adresse est fausse, corrigez-la.'] },
      { for: 'sync', levels: ['Un agent réparé n\'a pas encore forcément remonté.', 'Forcez l\'inventaire de PC22 et de PC23, ou avancez l\'horloge.'] },
      { for: 'pc24', levels: ['Un poste sans agent est invisible pour l\'outil.', 'Installez l\'agent depuis les propriétés de PC24.'] },
    ],
    solutionText: ['Compter : seuls PC-COMPTA-01 et PC21 remontent (deux sur cinq).', 'PC22 : agent arrêté, le démarrer. PC23 : adresse du serveur fausse, la corriger (http://srv-itsm/inventory). Forcer l\'inventaire des deux.', 'TeamViewer : 2 installations connues, 3 réelles. Installer l\'agent sur PC24.'],
    solution: [answer('cover', 2), { do: 'agent.start', args: { id: '@dev:PC22' } }, { do: 'agent.configure', args: { id: '@dev:PC23', serverUrl: 'http://srv-itsm/inventory' } }, { do: 'agent.runInventory', args: { id: '@dev:PC22' } }, { do: 'agent.runInventory', args: { id: '@dev:PC23' } }, answer('blind', 1), { do: 'agent.install', args: { id: '@dev:PC24' } }, { do: 'agent.runInventory', args: { id: '@dev:PC24' } }],
    realWorld: 'Les outils réels (GLPI Agent, OCS, Intune, Configuration Manager) fournissent des rapports « dernier contact » ; un taux de couverture se calcule sur les agents qui remontent, pas sur les agents déployés.',
  },

  /* ============================ TP 50 ============================ */
  {
    id: 'tp-50-incident-bout-en-bout', number: 50, title: 'Un incident de bout en bout', level: 3, levelLabel: level(3), difficulty: 2, duration: '35 min',
    skills: [{ ref: 'Répondre aux incidents et aux demandes', kind: 'worked' }, { ref: 'Assurer la traçabilité', kind: 'evidence_possible' }],
    context: 'Alice (Comptabilité) a appelé à 8 h 55 : plus rien ne sort de l\'imprimante, et c\'est la clôture mensuelle. Le service desk a saisi le ticket INC-0001 à partir de l\'appel, sans le qualifier. Menez-le jusqu\'à la clôture.',
    stages: [
      stage('s1', 'Qualifier, lier, attribuer', ['qual'],
        ['Catégorie « Matériel », sous-catégorie « Imprimante ». Huit personnes sont bloquées (impact élevé) avant l\'échéance du jour (urgence élevée) : la matrice donne la priorité. Liez l\'équipement **en cause** et attribuez le ticket à David.'],
        ['Qualifier, lier, attribuer : trois gestes qui rendent le ticket exploitable par un autre technicien.']),
      stage('s2', 'Diagnostiquer et remédier', ['cause', 'fix'],
        ['Avant de conclure, regardez l\'équipement sur le schéma : est-il allumé ? joignable par l\'outil ?', 'Une imprimante « en panne » n\'est pas forcément cassée : on commence par le plus simple (voir S04).'],
        ['Le diagnostic commence par la couche physique : alimentation, câble, voyants.']),
      stage('s3', 'Documenter, résoudre, clore', ['solution', 'closed'],
        ['L\'outil refuse de résoudre sans solution écrite. Rédigez-la pour un collègue qui reprendrait le ticket, passez-le à « Résolu », puis « Clos ».'],
        ['La solution écrite est la mémoire du service ; résolu n\'est pas clos.']),
    ],
    setup: [DISCOVER, { do: 'infra.powerOff', args: { id: '@dev:IMP-COMPTA' } }, newIncident('Imprimante de la comptabilité en panne', 'Appel d\'Alice à 8 h 55. L\'imprimante de la comptabilité ne sort plus rien. Clôture mensuelle aujourd\'hui : les 8 personnes du service ne peuvent pas éditer les factures avant 17 h.', 'Alice')],
    objectives: [
      { id: 'qual', label: 'INC-0001 est qualifié (Matériel, Imprimante, priorité P1), lié à IMP-COMPTA et attribué à David', check: { k: 'ticket', ref: T(1), category: 'Matériel', subcategory: 'Imprimante', priority: 1, linkedDevice: '@dev:IMP-COMPTA', assignee: '@usr:David' } },
      { id: 'cause', label: 'Identifier la cause de la panne', requires: ['qual'], question: Q('Que montre le schéma pour IMP-COMPTA ?', ['L\'imprimante est éteinte', 'Le câble réseau est coupé', 'Le serveur ITSM est arrêté', 'L\'imprimante est allumée et joignable'], 0, 'Un équipement éteint n\'est pas joignable : le plus simple est souvent la cause.') },
      { id: 'fix', label: 'IMP-COMPTA est de nouveau allumée et joignable', check: { k: 'all', of: [{ k: 'devicePowered', device: '@dev:IMP-COMPTA' }, { k: 'deviceOnline', device: '@dev:IMP-COMPTA' }] }, requires: ['cause'] },
      { id: 'solution', label: 'La solution est documentée et INC-0001 est résolu', check: { k: 'ticket', ref: T(1), reached: 'resolved', solutionMin: 30 }, requires: ['fix'] },
      { id: 'closed', label: 'INC-0001 est clos', check: { k: 'ticket', ref: T(1), status: 'closed' }, requires: ['solution'] },
    ],
    hints: [
      { for: 'qual', levels: ['Huit personnes bloquées, une échéance aujourd\'hui : impact et urgence élevés.', 'Fiche du ticket : catégorie, impact, urgence, lien vers IMP-COMPTA, assigné, puis qualifier et attribuer.'] },
      { for: 'fix', levels: ['Regardez l\'état de l\'équipement dans la vue Infrastructure.'] },
      { for: 'solution', levels: ['Le bouton « Résoudre » se débloque quand la solution est renseignée.'] },
    ],
    solutionText: ['Qualifier : Matériel / Imprimante, impact élevé, urgence élevée (P1), lier IMP-COMPTA, attribuer à David.', 'Constater que l\'imprimante est éteinte, la rallumer.', 'Rédiger la solution, résoudre, clore.'],
    solution: [
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { category: 'Matériel', subcategory: 'Imprimante', impact: 'high', urgency: 'high', assignee: '@usr:David' } } },
      { do: 'itsm.linkAsset', args: { id: T(1), asset: '@ast:IMP-COMPTA' } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'qualified' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'assigned' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'in_progress' } },
      answer('cause', 0), { do: 'infra.powerOn', args: { id: '@dev:IMP-COMPTA' } },
      { do: 'itsm.updateTicket', args: { id: T(1), fields: { solution: 'Imprimante éteinte : rallumée, joignable de nouveau, impression de test réussie.' } } },
      { do: 'itsm.transitionTicket', args: { id: T(1), to: 'resolved' } }, { do: 'itsm.transitionTicket', args: { id: T(1), to: 'closed' } },
    ],
    realWorld: 'Les outils réels imposent le même enchaînement : qualification, lien avec le CI, solution obligatoire avant résolution, clôture après confirmation ou délai.',
  },
];
