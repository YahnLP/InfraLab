import { clear, h } from '../kit/dom';
import { APP_AUTHOR, APP_NAME, APP_TAGLINE, APP_VERSION, AUTHOR_URL, OTHER_TOOLS } from '../../version';

const link = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

const sec = (title: string, ...kids: (HTMLElement | string)[]) => h('section', { class: 'help-sec' }, h('h3', null, title), ...kids.map(k => typeof k === 'string' ? h('p', null, k) : k));
const ul = (...items: string[]) => h('ul', null, ...items.map(i => h('li', null, i)));

/** Fenêtre d'aide et de présentation (bouton « Aide »). */
export function openHelp(dlg: HTMLDialogElement): void {
  clear(dlg);
  const body = h('div', { class: 'help', tabindex: '0', role: 'region', 'aria-label': 'Aide' },
    h('header', null, h('h2', null, `${APP_NAME} — ${APP_TAGLINE}`), h('p', { class: 'muted' }, `Version ${APP_VERSION} · `, link(AUTHOR_URL, `Créé par ${APP_AUTHOR}`))),
    sec('À quoi sert InfraLab ?', 'InfraLab simule le système d\'information d\'une PME fictive, NovaTech, pour comprendre l\'ITSM (gestion des services, ITIL) et l\'ITAM (gestion des actifs). Un même état est vu de deux façons : la vue Infrastructure montre ce qui existe, la vue ITSM montre ce que l\'outil de gestion en sait. Les deux ne se rejoignent que par la collecte (découverte, agent, saisie).'),
    sec('Les trois onglets', ul('Infrastructure : poser des équipements, les câbler, les allumer ou les éteindre (palette à gauche, propriétés à droite).', 'ITSM : parc, tickets, problèmes, changements, connaissances, licences, contrats, CMDB, administration et journal d\'audit.', 'TP : le catalogue de 40 travaux pratiques, du plus simple à l\'administration complète.')),
    sec('Faire un TP', ul('Onglet TP, choisissez un TP puis « Démarrer ». Le panneau de droite affiche la leçon, les objectifs et les indices.', 'Chaque objectif est vérifié par le simulateur à partir de ce que vous avez réellement fait, ou par une question.', 'Les indices sont en trois niveaux et réduisent la part « autonomie » du score. La solution, une fois consultée, ramène l\'autonomie à zéro.', 'Quand le TP est terminé, saisissez votre nom pour exporter le compte rendu (HTML) ou vos données (JSON).')),
    sec('Enregistrer et rouvrir son travail', ul('Enregistrer (Ctrl+S) : écrit un fichier « .infralab.json » dans le dossier de votre choix. Avec Chrome ou Edge, les enregistrements suivants réécrivent le même fichier.', 'Enregistrer sous… : choisit un autre dossier ou un autre nom (Chrome et Edge).', 'Ouvrir (Ctrl+O) : relit un fichier « .infralab.json » et reprend exactement où vous en étiez, TP en cours compris (score, indices, réponses).', 'Avec Firefox ou Safari, le fichier est téléchargé : activez « Toujours demander où enregistrer les fichiers » dans les réglages du navigateur pour choisir le dossier.', 'Une copie automatique est aussi gardée dans ce navigateur, sur cet ordinateur uniquement : elle ne remplace pas un fichier enregistré (autre ordinateur, navigation privée, cache vidé).')),
    sec('Agir en tant que', 'Le sélecteur « Agir en tant que » vous fait endosser l\'identité d\'un utilisateur : ses droits s\'appliquent. Un utilisateur ordinaire ne peut pas qualifier un ticket ; un technicien le peut. « Formateur » a tous les droits.'),
    sec('Raccourcis', ul('Ctrl+S : enregistrer · Ctrl+O : ouvrir · F1 : cette aide', 'V : outil Sélection · C : outil Câble · Suppr : supprimer la sélection', 'Molette : zoom du schéma · glisser sur le fond : déplacer la vue')),
    sec('Accessibilité', 'L\'interface se parcourt au clavier (Tab, Entrée, Échap) et suit le thème clair ou sombre du système. Le temps est simulé : +1 h et +1 jour font avancer l\'horloge, par exemple pour les remontées d\'agent planifiées.'),
    sec('À propos', ul(`${APP_NAME} est un outil pédagogique indépendant, non affilié à ITIL®, GLPI ou à tout éditeur. NovaTech et ses personnes sont fictives.`, 'Un TP « travaille » une compétence ou peut fournir un élément de preuve possible : il ne valide jamais une compétence du référentiel, seule l\'équipe pédagogique évalue.', 'Aucune donnée ne quitte votre navigateur : tout reste sur votre ordinateur, sauf les fichiers que vous enregistrez vous-même.')),
    sec('Autres outils gratuits', h('ul', { class: 'tools-list' }, ...OTHER_TOOLS.map(t => h('li', null, link(t.url, t.name), ` — ${t.text}`))), h('p', null, 'Formations et ressources : ', link(AUTHOR_URL, 'formaxionlandes.fr'), '.')),
    h('form', { method: 'dialog', class: 'actions' }, h('button', { class: 'primary' }, 'Fermer')));
  dlg.append(body); dlg.showModal();
}
