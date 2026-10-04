import type { Store } from '../../core';
import { evaluate, getScenario } from '../../scenarios';
import { clear, h } from '../kit/dom';

export interface PanelHost { dispatch(c: { type: string; payload?: Record<string, unknown> }): boolean; confirm(msg: string, run: () => void): void; restart(): void }

/** Panneau de TP : objectifs, indices, solution, bilan. Toujours visible pendant un TP, quelle que soit la vue. */
export class TpPanel {
  private collapsed = false;
  constructor(private root: HTMLElement, private store: Store, private host: PanelHost) { store.subscribe(() => this.render()); this.render(); }

  render(): void {
    const st = this.store.getState(); const s = st.session; const sc = s && getScenario(s.scenarioId);
    clear(this.root); this.root.hidden = !s || !sc; if (!s || !sc) return;
    const ev = evaluate(sc, st, this.store.getLog()); const done = s.finishedAt !== undefined; const exam = s.mode === 'exam';
    const head = h('button', { class: 'tp-head', 'aria-expanded': String(!this.collapsed), onclick: () => { this.collapsed = !this.collapsed; this.render(); } },
      h('b', null, `TP ${sc.number} — ${sc.title}`), exam ? h('span', { class: 'pill warn' }, 'Examen') : null,
      h('span', { class: 'muted' }, `${ev.doneCount}/${sc.objectives.length}`), h('span', { 'aria-hidden': 'true' }, this.collapsed ? '▴' : '▾'));
    this.root.append(head); if (this.collapsed) return;
    const body = h('div', { class: 'tp-body' });
    body.append(h('progress', { max: sc.objectives.length, value: ev.doneCount, 'aria-label': 'Objectifs atteints' }),
      h('details', { ...(ev.doneCount === 0 && !done ? { open: true } : {}) }, h('summary', null, 'Contexte'), h('p', null, sc.context)),
      h('ol', { class: 'tp-obj' }, ...ev.objectives.map(o => {
        const used = s.hints[o.id] ?? 0; const hint = sc.hints.find(x => x.for === o.id);
        return h('li', { class: o.done ? 'done' : o.locked ? 'locked' : '' },
          h('span', { class: 'tick', 'aria-label': o.done ? 'atteint' : 'à faire' }, o.done ? '✓' : '○'), h('span', null, o.label),
          o.locked && !o.done ? h('small', { class: 'muted' }, 'Dépend d\'un autre objectif') : null,
          hint && used ? h('ul', { class: 'tp-hints' }, ...hint.levels.slice(0, used).map((t, i) => h('li', null, h('b', null, `Indice ${i + 1} : `), t))) : null,
          hint && !o.done && !exam && !done && used < hint.levels.length ? h('button', { class: 'link', onclick: () => this.host.dispatch({ type: 'scenario.hint', payload: { objective: o.id } }) }, `Indice (${used}/${hint.levels.length}) — coûte 2 points`) : null);
      })));
    if (ev.violations.length) body.append(h('ul', { class: 'tp-viol' }, ...ev.violations.map(v => h('li', null, v))));
    if (s.solutionViewed) body.append(h('div', { class: 'callout' }, h('strong', null, 'Solution'), h('ol', null, ...sc.solutionText.map(t => h('li', null, t)))));
    if (done || ev.complete) {
      const sc2 = ev.score;
      body.append(h('div', { class: 'tp-score' }, h('b', null, `${sc2.total} / 100`), h('span', { class: 'muted' }, `objectifs ${sc2.objectives}/70 · qualité ${sc2.quality}/20 · autonomie ${sc2.autonomy}/10`)));
      if (done) body.append(h('div', { class: 'callout' }, h('strong', null, 'Éléments de preuve possibles : '), 'journal des événements, fiche d\'actif, ticket documenté (captures à joindre à votre portfolio). ',
        h('em', null, 'Ce score n\'est pas une validation de compétence : celle-ci revient à votre formateur.'), h('p', { class: 'realw' }, sc.realWorld)));
    }
    const acts = h('div', { class: 'actions' });
    if (!done) acts.append(h('button', { class: ev.complete ? 'primary' : '', onclick: () => this.host.confirm(ev.complete ? 'Terminer le TP et afficher le bilan ?' : `Il reste ${sc.objectives.length - ev.doneCount} objectif(s). Terminer quand même ?`, () => this.host.dispatch({ type: 'scenario.finish' })) }, 'Terminer'));
    if (!exam && !s.solutionViewed && !done) acts.append(h('button', { onclick: () => this.host.confirm('Afficher la solution ? Vous perdrez les points d\'autonomie.', () => this.host.dispatch({ type: 'scenario.revealSolution' })) }, 'Voir la solution'));
    acts.append(h('button', { onclick: () => this.host.confirm('Recommencer le TP depuis le début ?', () => this.host.restart()) }, 'Recommencer'),
      h('button', { class: 'link', onclick: () => this.host.confirm('Quitter le TP et garder le SI tel qu\'il est (mode libre) ?', () => this.host.dispatch({ type: 'scenario.quit' })) }, 'Quitter'));
    body.append(acts); this.root.append(body);
  }
}
