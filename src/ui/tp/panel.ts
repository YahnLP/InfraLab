import type { Store } from '../../core';
import { evaluate, getScenario, type Scenario } from '../../scenarios';
import { clear, h } from '../kit/dom';

export interface PanelHost { dispatch(c: { type: string; payload?: Record<string, unknown> }): boolean; confirm(msg: string, run: () => void): void; restart(): void }

/** Mini-rendu : paragraphes, listes « - » et **gras**. */
export function rich(lines: string[]): HTMLElement[] {
  const inline = (t: string): (string | Node)[] => t.split(/\*\*(.+?)\*\*/g).map((part, i) => i % 2 ? h('strong', null, part) : part);
  const out: HTMLElement[] = []; let list: HTMLElement | null = null;
  for (const l of lines) {
    if (l.startsWith('- ')) { if (!list) { list = h('ul', null); out.push(list); } list.append(h('li', null, ...inline(l.slice(2)))); }
    else { list = null; out.push(h('p', null, ...inline(l))); }
  }
  return out;
}

/** Colonne de TP : étapes, cours, tâches, questions, bilan. Fixe (elle ne recouvre rien) et repliable en rail. */
export class TpPanel {
  private collapsed = false;
  private viewing: { id: string; stage: number } | null = null;
  private reader = h('dialog', { class: 'reader' });
  constructor(private root: HTMLElement, private store: Store, private host: PanelHost, private now: () => number) { store.subscribe(() => this.render()); this.render(); }

  private openReader(title: string, body: HTMLElement[]): void {
    clear(this.reader);
    this.reader.append(h('form', { method: 'dialog' }, h('header', null, h('h2', null, title), h('button', { value: 'close' }, 'Fermer')), h('div', { class: 'reader-body' }, ...body)));
    this.reader.showModal();
  }

  render(): void {
    const st = this.store.getState(); const s = st.session; const sc = s && getScenario(s.scenarioId);
    clear(this.root); this.root.hidden = !s || !sc; this.root.classList.toggle('collapsed', this.collapsed); if (!s || !sc) { this.viewing = null; return; }
    const ev = evaluate(sc, st, this.store.getLog(), this.now()); const done = s.finishedAt !== undefined; const exam = s.mode === 'exam';
    if (!this.viewing || this.viewing.id !== s.scenarioId) this.viewing = { id: s.scenarioId, stage: s.stage };
    if (this.viewing.stage > s.stage) this.viewing.stage = s.stage;
    const idx = this.viewing.stage; const stage = sc.stages[idx]!; const sts = ev.stages[idx]!;

    if (this.collapsed) {
      this.root.append(h('button', { class: 'tp-rail', title: 'Rouvrir le panneau du TP', 'aria-label': `Rouvrir le TP ${sc.number}`, onclick: () => { this.collapsed = false; this.render(); } },
        h('span', { 'aria-hidden': 'true' }, '‹'), h('b', null, `TP ${sc.number}`), h('span', { class: 'muted' }, `${ev.doneCount}/${sc.objectives.length}`)), this.reader);
      return;
    }
    const head = h('header', { class: 'tp-top' }, h('div', null, h('b', null, `TP ${sc.number} — ${sc.title}`), exam ? h('span', { class: 'pill warn' }, 'Examen') : null),
      h('button', { title: 'Replier le panneau', 'aria-label': 'Replier le panneau', onclick: () => { this.collapsed = true; this.render(); } }, '›'));
    const stepper = h('ol', { class: 'tp-steps', 'aria-label': 'Étapes' }, ...sc.stages.map((g, i) => {
      const state = ev.stages[i]!.done && i < s.stage ? 'done' : i === s.stage ? 'now' : i < s.stage ? 'done' : 'todo'; const can = i <= s.stage;
      return h('li', { class: `${state}${i === idx ? ' view' : ''}` }, h('button', { disabled: !can, 'aria-current': i === idx ? 'step' : null, title: g.title, onclick: () => { this.viewing = { id: s.scenarioId, stage: i }; this.render(); } }, h('span', { class: 'n' }, state === 'done' ? '✓' : String(i + 1)), h('span', { class: 'l' }, g.title)));
    }));
    const body = h('div', { class: 'tp-body' });
    if (idx === 0) body.append(h('section', { class: 'tp-ctx' }, h('h3', null, 'Mise en situation'), h('p', null, sc.context)));
    body.append(h('section', { class: 'tp-lesson' }, h('div', { class: 'tp-sec' }, h('h3', null, `Étape ${idx + 1}/${sc.stages.length} — ${stage.title}`), h('button', { class: 'link', onclick: () => this.openReader(`TP ${sc.number} · ${stage.title}`, [h('h3', null, 'Mise en situation'), h('p', null, sc.context), h('h3', null, 'Cours'), ...rich(stage.lesson)]) }, 'Lire en grand')),
      ...rich(stage.lesson)));
    const status = new Map(ev.objectives.map(o => [o.id, o])); const byId = new Map(sc.objectives.map(o => [o.id, o]));
    body.append(h('section', { class: 'tp-todo' }, h('h3', null, 'À faire'), h('ol', { class: 'tp-obj' }, ...stage.objectives.map(id => {
      const o = byId.get(id)!; const stt = status.get(id)!; const used = s.hints[id] ?? 0; const hint = sc.hints.find(x => x.for === id);
      const pre = (o.requires ?? []).map(r => byId.get(r)).filter(x => x && !status.get(x.id)!.done);
      const q = o.question; const ans = s.answers[id];
      return h('li', { class: stt.done ? 'done' : stt.locked ? 'locked' : '' },
        h('span', { class: 'tick', role: 'img', 'aria-label': stt.done ? 'atteint' : 'à faire' }, stt.done ? '✓' : '○'), h('span', { class: 'lbl' }, o.label),
        !stt.done && pre.length ? h('small', { class: 'muted' }, `À faire d'abord : ${pre.map(x => x!.label).join(' ; ')}`) : null,
        q && !stt.locked ? h('div', { class: 'tp-q' }, h('p', null, h('b', null, q.prompt)),
          h('div', { class: 'choices', role: 'radiogroup', 'aria-label': q.prompt }, ...q.choices.map((c, i) => h('button', { role: 'radio', 'aria-checked': String(ans?.choice === i), class: `choice${ans?.choice === i ? (ans.correct ? ' ok' : ' ko') : ''}`, disabled: stt.done || done, onclick: () => this.host.dispatch({ type: 'scenario.answer', payload: { objective: id, choice: i } }) }, c))),
          ans && !ans.correct ? h('p', { class: 'fb ko' }, 'Pas tout à fait. Relisez le cours et observez l\'infrastructure, puis réessayez (−1 point).') : null,
          stt.done && !exam ? h('p', { class: 'fb ok' }, q.explain) : null) : null,
        hint && used ? h('ul', { class: 'tp-hints' }, ...hint.levels.slice(0, used).map((t, i) => h('li', null, h('b', null, `Indice ${i + 1} : `), t))) : null,
        hint && !stt.done && !stt.locked && !exam && !done && used < hint.levels.length ? h('button', { class: 'link', onclick: () => this.host.dispatch({ type: 'scenario.hint', payload: { objective: id } }) }, `Indice (${used}/${hint.levels.length}) — coûte 2 points`) : null);
    }))));
    if (sts.done) {
      const last = idx >= sc.stages.length - 1;
      body.append(h('section', { class: 'tp-debrief' }, h('h3', null, 'Bilan de l\'étape'), ...rich(stage.debrief),
        idx === s.stage && !last ? h('button', { class: 'primary', onclick: () => { this.viewing = null; this.host.dispatch({ type: 'scenario.advance' }); } }, 'Étape suivante') : null));
    }
    if (ev.violations.length) body.append(h('ul', { class: 'tp-viol' }, ...ev.violations.map(v => h('li', null, v))));
    if (s.solutionViewed) body.append(h('div', { class: 'callout' }, h('strong', null, 'Solution'), h('ol', null, ...sc.solutionText.map(t => h('li', null, t)))));
    if (done || ev.complete) {
      const sc2 = ev.score;
      body.append(h('div', { class: 'tp-score' }, h('b', null, `${sc2.total} / 100`), h('span', { class: 'muted' }, `objectifs ${sc2.objectives}/70 · qualité ${sc2.quality}/20 · autonomie ${sc2.autonomy}/10`)));
      if (done) body.append(h('div', { class: 'callout' }, h('strong', null, 'Éléments de preuve possibles : '), 'journal des événements, fiche d\'actif, tickets documentés (captures à joindre à votre portfolio). ',
        h('em', null, 'Ce score n\'est pas une validation de compétence : celle-ci revient à votre formateur.'), h('p', { class: 'realw' }, sc.realWorld)));
    }
    const acts = h('footer', { class: 'tp-acts' });
    if (!done) acts.append(h('button', { class: ev.complete ? 'primary' : '', onclick: () => this.host.confirm(ev.complete ? 'Terminer le TP et afficher le bilan ?' : `Il reste ${sc.objectives.length - ev.doneCount} objectif(s). Terminer quand même ?`, () => this.host.dispatch({ type: 'scenario.finish' })) }, 'Terminer'));
    if (!exam && !s.solutionViewed && !done) acts.append(h('button', { onclick: () => this.host.confirm('Afficher la solution ? Vous perdrez les points d\'autonomie.', () => this.host.dispatch({ type: 'scenario.revealSolution' })) }, 'Solution'));
    acts.append(h('button', { onclick: () => this.host.confirm('Recommencer le TP depuis le début ?', () => this.host.restart()) }, 'Recommencer'),
      h('button', { class: 'link', onclick: () => this.host.confirm('Quitter le TP et garder le SI tel qu\'il est (mode libre) ?', () => this.host.dispatch({ type: 'scenario.quit' })) }, 'Quitter'));
    this.root.append(head, stepper, body, acts, this.reader);
    const prev = (this as unknown as { _scroll?: string })._scroll; const key = `${s.scenarioId}:${idx}`;
    if (prev !== key) { body.scrollTop = 0; (this as unknown as { _scroll?: string })._scroll = key; }
  }
}
export type { Scenario };
