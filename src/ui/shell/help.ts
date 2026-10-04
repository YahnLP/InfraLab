import { clear, h } from '../kit/dom';
import { APP_AUTHOR, APP_NAME, APP_TAGLINE, APP_VERSION, AUTHOR_URL, LICENSE_NAME, LICENSE_URL, OTHER_TOOLS, REPO_URL } from '../../version';

const link = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
const sec = (title: string, ...kids: (HTMLElement | string)[]) => h('section', { class: 'help-sec' }, h('h3', null, title), ...kids.map(k => typeof k === 'string' ? h('p', null, k) : k));
const ul = (...items: (string | (HTMLElement | string)[])[]) => h('ul', null, ...items.map(i => h('li', null, ...(Array.isArray(i) ? i : [i]))));

/* ---- Prise en main ---- */
function started(): HTMLElement[] {
  return [
    sec('À quoi sert InfraLab ?', 'InfraLab simule le système d\'information d\'une PME fictive, NovaTech, pour comprendre l\'ITSM (gestion des services, ITIL) et l\'ITAM (gestion des actifs). Un même état est vu de deux façons : la vue Infrastructure montre ce qui existe, la vue ITSM montre ce que l\'outil de gestion en sait. Les deux ne se rejoignent que par la collecte (découverte, agent, saisie).'),
    sec('Les trois onglets', ul('Infrastructure : poser des équipements, les câbler, les allumer ou les éteindre (palette à gauche, propriétés à droite). Clic sur un équipement : ses détails et ses actions. Outil Câble (C) : cliquez un équipement, choisissez le port, cliquez le second.', 'ITSM : parc, tickets, problèmes, changements, connaissances, licences, contrats, CMDB, administration et journal d\'audit.', 'TP : le catalogue de 40 travaux pratiques, du plus simple à l\'administration complète.')),
    sec('Faire un TP', ul('Onglet TP, choisissez un TP puis « Démarrer ». Le panneau de droite affiche la leçon, les objectifs et les indices.', 'Chaque objectif est vérifié par le simulateur à partir de ce que vous avez réellement fait, ou par une question : plusieurs chemins mènent au résultat.', 'Les indices sont en trois niveaux et réduisent la part « autonomie » du score. La solution, une fois consultée, ramène l\'autonomie à zéro.', 'Quand le TP est terminé, saisissez votre nom pour exporter le compte rendu (HTML) ou vos données (JSON).')),
    sec('Enregistrer et rouvrir son travail', ul('Enregistrer (Ctrl+S) : écrit un fichier « .infralab.json » dans le dossier de votre choix. Avec Chrome ou Edge, les enregistrements suivants réécrivent le même fichier.', 'Enregistrer sous… : choisit un autre dossier ou un autre nom (Chrome et Edge).', 'Ouvrir (Ctrl+O) : relit un fichier « .infralab.json » et reprend exactement où vous en étiez, TP en cours compris (score, indices, réponses).', 'Avec Firefox ou Safari, le fichier est téléchargé : activez « Toujours demander où enregistrer les fichiers » dans les réglages du navigateur pour choisir le dossier.', 'Une copie automatique est aussi gardée dans ce navigateur, sur cet ordinateur uniquement : elle ne remplace pas un fichier enregistré (autre ordinateur, navigation privée, cache vidé).')),
    sec('Le temps', 'Le temps est simulé : « +1 h » et « +1 jour » font avancer l\'horloge (remontées d\'agent planifiées, échéances de contrats, SLA). Les délais de SLA se comptent en temps continu, 24 h / 24.'),
    sec('Agir en tant que', 'Le sélecteur « Agir en tant que » vous fait endosser l\'identité d\'un utilisateur : ses droits s\'appliquent. Un utilisateur ordinaire ne peut pas qualifier un ticket ; un technicien le peut. « Formateur » a tous les droits.'),
    sec('Raccourcis', ul('Ctrl+S : enregistrer · Ctrl+O : ouvrir · F1 : cette aide', 'V : outil Sélection · C : outil Câble · Suppr : supprimer la sélection', 'Molette : zoom du schéma · glisser sur le fond : déplacer la vue')),
    sec('Accessibilité', 'L\'interface se parcourt au clavier (Tab, Entrée, Échap) et suit le thème clair ou sombre du système. Un audit automatisé (axe-core, WCAG 2.1 A et AA) ne relève aucune violation sur les vues principales ; il n\'y a pas encore d\'audit manuel avec un lecteur d\'écran.'),
  ];
}

/* ---- Couverture du programme ---- */
type Row = [theme: string, state: string, tps: string, remark: string];
const COVERAGE: Row[] = [
  ['Parc : découverte réseau, agent, saisie manuelle, rapprochement', '✔ simulé', '1 à 10', 'Plage CIDR ; l\'agent lit le poste, la découverte ne voit que nom, IP, MAC et constructeur'],
  ['Tickets : saisie, qualification, impact × urgence, résolution, clôture', '✔ simulé', '11 à 15', 'Workflow à prérequis expliqués ; matrice de priorité P1 à P4'],
  ['Incidents techniques : câble, serveur, switch, panne commune, incident majeur', '✔ simulé', '16 à 20', 'La joignabilité est calculée jusqu\'au serveur ITSM, avec la raison de l\'état hors ligne'],
  ['Incident ou demande de service', '✔ simulé', '19, 21', ''],
  ['SLA : prise en charge, résolution, suspension', '✔ simulé', '22', 'Temps continu (24 h / 24), pas de calendrier ouvré'],
  ['Gestion des problèmes : cause racine, contournement', '✔ simulé', '23, 40', ''],
  ['Gestion des changements : standard, normal, urgent, approbation', '✔ simulé', '24, 35, 40', 'Le demandeur ne peut pas approuver son propre changement'],
  ['Gestion des connaissances', '✔ simulé', '25', ''],
  ['ITAM : logiciels, politique, licences, conformité', '✔ simulé', '26, 27', 'La conformité dépend des installations connues, donc de la couverture de l\'inventaire'],
  ['ITAM : contrats, fournisseurs, échéances', '✔ simulé', '28', ''],
  ['ITAM : cycle de vie, réaffectation d\'un poste', '✔ simulé', '29, 30', 'Un actif retiré ne se réaffecte pas'],
  ['CMDB : CI, relations, analyse d\'impact', '✔ simulé', '31, 32, 38', 'Relations « connecté à » déduites du câblage ; « dépend de » saisies'],
  ['Administration : rôles et droits (RBAC), comptes, séparation des tâches, audit', '✔ simulé', '33 à 37, 39, 40', '4 rôles, 18 droits modifiables, rôles créables'],
  ['Calendrier ouvré pour les SLA', '○ prévu', '—', ''],
  ['Groupes de techniciens, délégation de droits', '○ prévu', '—', 'Les droits se donnent à un rôle, un rôle à une personne'],
  ['Événements scénarisés dans le temps (un ticket qui arrive en cours de TP)', '○ prévu', '—', ''],
  ['Lien machine virtuelle ↔ hyperviseur', '○ prévu', '—', ''],
  ['Supervision (alertes, SNMP), Active Directory, GPO, déploiement de logiciels', '○ non couvert', '—', 'Hors périmètre actuel'],
];
function coverage(): HTMLElement[] {
  return [
    h('p', null, 'Ce tableau décrit ce que InfraLab simule et les TP qui s\'y rapportent. Il n\'établit pas de correspondance officielle avec un référentiel : c\'est au formateur de situer chaque notion dans sa progression. Un TP « travaille » une compétence ou peut fournir un élément de preuve possible ; il ne la valide jamais. La table détaillée « compétence → TP » se trouve dans l\'onglet TP (vue formateur : couverture des compétences).'),
    h('div', { class: 'tablewrap' }, h('table', { class: 'covtable' }, h('thead', null, h('tr', null, ...['Thème', 'État', 'TP', 'Remarque'].map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', null, ...COVERAGE.map(r => h('tr', null, h('th', { scope: 'row' }, r[0]), h('td', null, r[1]), h('td', null, r[2]), h('td', null, r[3])))))),
  ];
}

/* ---- Limites connues ---- */
function limits(): HTMLElement[] {
  return [
    h('p', null, 'InfraLab est un simulateur pédagogique : il ne se connecte à aucun vrai réseau ni à aucun vrai outil de gestion. Ce qui est volontairement simplifié :'),
    ul('Les logiciels ITSM réels (GLPI, ServiceNow, OCS Inventory…) ont leurs propres écrans et vocabulaire : InfraLab en reprend les notions, pas l\'interface.', 'Le réseau d\'entreprise est simplifié : tous les sites partagent le même réseau (liaisons inter-sites en couche 2) pour garder lisible la notion de « joignable par l\'outil ».', 'Les SLA se comptent en temps continu (24 h / 24, 7 j / 7), sans calendrier ouvré ; l\'état « en attente » suspend l\'horloge.', 'Pas de groupes d\'utilisateurs : l\'administration repose sur les rôles seulement.', 'Les machines virtuelles sont câblées comme des équipements ordinaires : leur lien avec l\'hyperviseur n\'est pas modélisé.', 'Un TP prépare un état initial mais ne déclenche pas d\'événements en cours de route.', 'Certains objectifs se lisent dans l\'historique des événements plutôt que dans l\'état final (un actif passé en réparation puis revenu en service a bien « atteint » la réparation).', 'La copie automatique est locale au navigateur : vider les données du site l\'efface. Pour garder un travail, utilisez « Enregistrer » (fichier .infralab.json).', 'Aucun audit d\'accessibilité manuel avec un lecteur d\'écran n\'a encore été réalisé.', 'NovaTech est fictive : les noms, adresses et chiffres sont inventés.'),
  ];
}

/* ---- Licence et auteur ---- */
function about(): HTMLElement[] {
  return [
    h('p', null, `${APP_NAME} est développé par `, link(AUTHOR_URL, APP_AUTHOR), '.'),
    h('p', null, `© 2026 ${APP_AUTHOR}`),
    h('p', null, `Le logiciel est distribué sous licence libre ${LICENSE_NAME} (European Union Public Licence). Vous pouvez l'utiliser, l'étudier, le modifier et le redistribuer dans le respect des conditions de cette licence, notamment le maintien de l'accès au code source des versions redistribuées.`),
    ul([link(AUTHOR_URL, 'Formaxion Landes'), ' : formations et ressources'], [link(REPO_URL, 'Consulter le code source'), ' (GitHub)'], [link(LICENSE_URL, `Consulter la licence ${LICENSE_NAME}`)]),
    h('details', { class: 'legal' }, h('summary', null, 'Nom, identité visuelle et évolutions futures'),
      h('h3', null, 'Nom et identité du projet'), h('p', null, `Le nom « ${APP_NAME} », les logos et éléments d'identité visuelle associés restent la propriété de ${APP_AUTHOR}. Leur utilisation n'est pas automatiquement accordée par la licence ${LICENSE_NAME} applicable au code source.`),
      h('h3', null, 'Évolution du projet'), h('p', null, `La version actuelle de ${APP_NAME} est distribuée sous licence ${LICENSE_NAME}. Les versions diffusées sous cette licence continueront à bénéficier des droits accordés par l'EUPL. Le titulaire des droits se réserve cependant la possibilité de développer et proposer ultérieurement d'autres éditions ou services, notamment des versions professionnelles ou commerciales, sous des conditions de licence distinctes.`),
      h('h3', null, 'Contributions'), h('p', null, 'Les contributions externes sont les bienvenues et doivent respecter la licence du projet : voir CONTRIBUTING.md sur le dépôt GitHub.')),
    sec('Indépendance', `${APP_NAME} est un outil pédagogique indépendant, non affilié à ITIL®, GLPI ou à tout éditeur. Les marques citées appartiennent à leurs propriétaires. NovaTech et ses personnes sont fictives.`),
    sec('Compétences', 'Un TP « travaille » une compétence ou peut fournir un élément de preuve possible : il ne valide jamais une compétence du référentiel, seule l\'équipe pédagogique évalue.'),
    sec('Vos données', 'Aucune donnée ne quitte votre navigateur : tout reste sur votre ordinateur, sauf les fichiers que vous enregistrez ou exportez vous-même.'),
    sec('Autres outils gratuits', h('ul', { class: 'tools-list' }, ...OTHER_TOOLS.map(t => h('li', null, link(t.url, t.name), ` — ${t.text}`)))),
  ];
}

const TABS: [string, () => HTMLElement[]][] = [['Prise en main', started], ['Couverture du programme', coverage], ['Limites connues', limits], ['Licence et auteur', about]];

/** Fenêtre d'aide et de présentation (bouton « Aide »), avec les mêmes onglets que les autres outils de Formaxion Landes. */
export function openHelp(dlg: HTMLDialogElement, initial = 0): void {
  clear(dlg);
  const panel = h('div', { class: 'help-panel', role: 'tabpanel', tabindex: '0' });
  const tabs = TABS.map(([name], i) => h('button', { role: 'tab', id: `help-tab-${i}`, 'aria-controls': 'help-panel', onclick: () => select(i), onkeydown: (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length; select(n); tabs[n]!.focus(); }
  } }, name));
  panel.id = 'help-panel';
  function select(i: number): void {
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.setAttribute('tabindex', k === i ? '0' : '-1'); t.classList.toggle('on', k === i); });
    panel.setAttribute('aria-labelledby', `help-tab-${i}`); clear(panel); panel.append(...TABS[i]![1]()); panel.scrollTop = 0;
  }
  dlg.append(h('div', { class: 'help' },
    h('header', null, h('h2', null, `Aide — ${APP_NAME}`), h('p', { class: 'muted' }, `${APP_TAGLINE} · Version ${APP_VERSION} · `, link(AUTHOR_URL, `Créé par ${APP_AUTHOR}`))),
    h('div', { role: 'tablist', class: 'help-tabs', 'aria-label': 'Rubriques de l\'aide' }, ...tabs), panel,
    h('form', { method: 'dialog', class: 'actions' }, h('button', { class: 'primary' }, 'Fermer'))));
  select(initial); dlg.showModal();
}
