import { SCENARIOS, type Scenario } from '../../scenarios';
import { h } from '../kit/dom';

export interface TpHost { start(sc: Scenario, mode: 'tp' | 'exam'): void; current(): string | null }

/** Matrice compétences × TP, pour le formateur : ce que chaque TP permet de travailler (jamais « valider »). */
function coverage(): HTMLElement {
  const refs = [...new Set(SCENARIOS.flatMap(s => s.skills.map(k => k.ref)))].sort();
  return h('details', { class: 'coverage' }, h('summary', null, 'Vue formateur : couverture des compétences'),
    h('p', { class: 'muted' }, 'Pour chaque compétence, les TP qui la travaillent (T) ou qui peuvent fournir un élément de preuve pour le portfolio (P).'),
    h('div', { class: 'scroll' }, h('table', { class: 'grid small' }, h('thead', null, h('tr', null, h('th', null, 'Compétence'), h('th', null, 'TP'))),
      h('tbody', null, ...refs.map(ref => h('tr', null, h('td', null, ref), h('td', null, SCENARIOS.filter(s => s.skills.some(k => k.ref === ref)).map(s => `${s.number}${s.skills.find(k => k.ref === ref)!.kind === 'worked' ? 'T' : 'P'}`).join(' · '))))))));
}
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function renderTpCatalog(root: HTMLElement, host: TpHost): void {
  root.replaceChildren();
  const levels = [...new Set(SCENARIOS.map(s => s.level))].sort();
  root.append(h('div', { class: 'tp-page' },
    h('h1', null, 'Travaux pratiques'),
    h('p', { class: 'muted lead' }, 'Chaque TP prépare un état précis du SI NovaTech, fixe des objectifs vérifiés automatiquement et garde la trace de ce que vous faites. Démarrer un TP remplace le projet en cours.'),
    ...levels.map(l => h('section', null, h('h2', null, `Niveau ${l} — ${SCENARIOS.find(s => s.level === l)!.levelLabel}`),
      h('div', { class: 'tp-grid' }, ...SCENARIOS.filter(s => s.level === l).map(sc => h('article', { class: `tp-card${host.current() === sc.id ? ' current' : ''}` },
        h('header', null, h('span', { class: 'tp-num' }, `TP ${sc.number}`), h('span', { class: 'muted', title: 'Difficulté' }, stars(sc.difficulty)), h('span', { class: 'muted' }, sc.duration)),
        h('h3', null, sc.title), h('p', null, sc.context),
        h('p', { class: 'muted skills' }, sc.skills.map(k => `${k.kind === 'worked' ? 'Compétence travaillée' : 'Élément de preuve possible'} : ${k.ref}`).join(' — ')),
        h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => host.start(sc, 'tp') }, host.current() === sc.id ? 'Recommencer' : 'Démarrer'),
          h('button', { title: 'Sans indices ni solution', onclick: () => host.start(sc, 'exam') }, 'Mode examen'))))))),
    coverage(),
    h('p', { class: 'muted' }, 'Les compétences indiquées sont celles que le TP permet de travailler ; elles ne valent pas validation, qui reste l\'affaire du formateur et du référentiel.')));
}
