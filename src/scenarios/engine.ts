import { emptyState, type Scheduler, type State, type Store } from '../core';
import { advance } from '../inventory';
import { runCheck } from './checks';
import { seedNovatech } from './novatech';
import { resolveRefs } from './resolve';
import type { Scenario, Step } from './types';

const HINT_COST = 2; // points perdus par niveau d'indice (sur les 10 points « sans aide »)

export interface ObjectiveStatus { id: string; label: string; done: boolean; locked: boolean }
export interface Evaluation {
  objectives: ObjectiveStatus[]; doneCount: number; complete: boolean; violations: string[];
  score: { objectives: number; quality: number; autonomy: number; total: number };
}

/** Exécute une suite de commandes symboliques ; lève une erreur si l'une échoue (décor et solutions sont des données sûres). */
export function runSteps(store: Store, sch: Scheduler, steps: Step[]): void {
  for (const s of steps) {
    if (s.advance) advance(store, sch, s.advance);
    if (s.do) {
      const r = store.dispatch({ type: s.do, payload: resolveRefs(store.getState(), s.args ?? {}), actor: 'scenario' });
      if (!r.ok) throw new Error(`Étape « ${s.do} » refusée : ${r.error?.message}`);
    }
  }
}

/** Repart d'un SI vierge : NovaTech + décor du scénario, puis ouvre la session. Déterministe : deux démarrages donnent le même état. */
export function startScenario(store: Store, sch: Scheduler, sc: Scenario, mode: 'tp' | 'exam' = 'tp'): void {
  store.restore({ state: emptyState(), log: [] }); sch.now = 0;
  seedNovatech(store, c => { const r = store.dispatch(c); if (!r.ok) throw r.error; return true; });
  sch.now = 0;
  runSteps(store, sch, sc.setup);
  const r = store.dispatch({ type: 'scenario.begin', payload: { id: sc.id, mode, logStart: store.getLog().length }, actor: 'scenario' });
  if (!r.ok) throw r.error;
}

export function evaluate(sc: Scenario, st: Readonly<State>, log: readonly import('../core').DomainEvent[], now = 0): Evaluation {
  const mine = st.session ? log.slice(st.session.logStart) : log;
  const done = new Map<string, boolean>();
  for (const o of sc.objectives) done.set(o.id, runCheck(st, mine, o.check, now) && (o.requires ?? []).every(r => done.get(r)));
  const objectives = sc.objectives.map(o => ({ id: o.id, label: o.label, done: !!done.get(o.id), locked: (o.requires ?? []).some(r => !done.get(r)) }));
  const doneCount = objectives.filter(o => o.done).length;
  const violations = (sc.forbid ?? []).filter(f => mine.some(e => e.type === f.event)).map(f => f.message);
  const hintLevels = Object.values(st.session?.hints ?? {}).reduce((a, b) => a + b, 0);
  const o = Math.round(70 * doneCount / sc.objectives.length);
  const q = Math.max(0, 20 - 10 * violations.length);
  const a = st.session?.solutionViewed ? 0 : Math.max(0, 10 - HINT_COST * hintLevels);
  return { objectives, doneCount, complete: doneCount === sc.objectives.length, violations, score: { objectives: o, quality: q, autonomy: a, total: o + q + a } };
}
