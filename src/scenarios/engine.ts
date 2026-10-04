import { emptyState, type Scheduler, type State, type Store } from '../core';
import { advance } from '../inventory';
import { getScenario } from './catalog';
import { runCheck } from './checks';
import { seedNovatech } from './novatech';
import { resolveRefs } from './resolve';
import type { Scenario, Step } from './types';

const HINT_COST = 2; // points perdus par niveau d'indice (sur les 10 points « sans aide »)

export interface ObjectiveStatus { id: string; label: string; done: boolean; locked: boolean }
export interface StageStatus { id: string; title: string; done: boolean; objectiveIds: string[] }
export interface Evaluation {
  objectives: ObjectiveStatus[]; stages: StageStatus[]; doneCount: number; complete: boolean; violations: string[];
  score: { objectives: number; quality: number; autonomy: number; total: number };
}

/** Exécute une suite de commandes symboliques ; lève une erreur si l'une échoue (décor et solutions sont des données sûres). */
export function runSteps(store: Store, sch: Scheduler, steps: Step[], timed = true): void {
  for (const s of steps) {
    if (s.advance) { if (timed) advanceTime(store, sch, s.advance); else advance(store, sch, s.advance); }
    if (s.do) {
      const r = store.dispatch({ type: s.do, payload: resolveRefs(store.getState(), s.args ?? {}), actor: 'scenario', ...(s.as ? { actorId: resolveRefs(store.getState(), s.as) } : {}) });
      if (!r.ok) throw new Error(`Étape « ${s.do} » refusée : ${r.error?.message}`);
    }
  }
}

/**
 * Fait avancer le temps simulé en déclenchant, au bon instant, les événements de la chronologie du TP en cours
 * (un ticket qui arrive, une panne). Retourne les messages à montrer à l'élève.
 */
export function advanceTime(store: Store, sch: Scheduler, ms: number): string[] {
  const notices: string[] = []; const end = sch.now + ms;
  for (let guard = 0; guard < 500; guard++) {
    const s = store.getState().session; const sc = s && getScenario(s.scenarioId);
    const due = sc && s && s.finishedAt === undefined ? (sc.timeline ?? []).filter(e => !(s.fired ?? []).includes(e.id) && s.startedAt + e.at <= end).sort((a, b) => a.at - b.at)[0] : undefined;
    if (!due || !s) { if (end > sch.now) advance(store, sch, end - sch.now); return notices; }
    const t = Math.max(sch.now, s.startedAt + due.at); if (t > sch.now) advance(store, sch, t - sch.now);
    runSteps(store, sch, due.steps, false);
    const r = store.dispatch({ type: 'scenario.fire', payload: { id: due.id, notice: due.notice }, actor: 'scenario' }); if (!r.ok) throw r.error;
    notices.push(due.notice);
  }
  return notices;
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
  for (const o of sc.objectives) done.set(o.id, (o.question ? !!st.session?.answers[o.id]?.correct : !!o.check && runCheck(st, mine, o.check, now)) && (o.requires ?? []).every(r => done.get(r)));
  const objectives = sc.objectives.map(o => ({ id: o.id, label: o.label, done: !!done.get(o.id), locked: (o.requires ?? []).some(r => !done.get(r)) }));
  const stages = sc.stages.map(g => ({ id: g.id, title: g.title, objectiveIds: g.objectives, done: g.objectives.every(i => done.get(i)) }));
  const doneCount = objectives.filter(o => o.done).length;
  const violations = (sc.forbid ?? []).filter(f => mine.some(e => e.type === f.event)).map(f => f.message);
  const hintLevels = Object.values(st.session?.hints ?? {}).reduce((a, b) => a + b, 0);
  const o = Math.round(70 * doneCount / sc.objectives.length);
  const q = Math.max(0, 20 - 10 * violations.length);
  const a = st.session?.solutionViewed ? 0 : Math.max(0, 10 - HINT_COST * hintLevels - (st.session?.wrong ?? 0));
  return { objectives, stages, doneCount, complete: doneCount === sc.objectives.length, violations, score: { objectives: o, quality: q, autonomy: a, total: o + q + a } };
}
