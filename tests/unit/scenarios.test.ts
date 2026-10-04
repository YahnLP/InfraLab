import { Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { registerItsmCommands } from '../../src/itsm';
import { SCENARIOS, evaluate, registerScenarioCommands, runSteps, startScenario } from '../../src/scenarios';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);
  return { sch, store };
}

describe('Qualité des TP (auto-test de chaque scénario)', () => {
  it('numéros et identifiants uniques', () => {
    expect(new Set(SCENARIOS.map(s => s.id)).size).toBe(SCENARIOS.length); expect(new Set(SCENARIOS.map(s => s.number)).size).toBe(SCENARIOS.length);
  });
  for (const sc of SCENARIOS) {
    describe(`TP ${sc.number} — ${sc.title}`, () => {
      it('structure cohérente : indices et dépendances pointent vers des objectifs existants', () => {
        const ids = new Set(sc.objectives.map(o => o.id));
        for (const h of sc.hints) expect(ids.has(h.for)).toBe(true);
        for (const o of sc.objectives) for (const r of o.requires ?? []) expect(ids.has(r)).toBe(true);
        expect(sc.skills.length).toBeGreaterThan(0); expect(sc.solutionText.length).toBeGreaterThan(0);
      });
      it('aucun objectif n\'est atteint à l\'état initial', () => {
        const { sch, store } = lab(); startScenario(store, sch, sc);
        const ev = evaluate(sc, store.getState(), store.getLog(), sch.now);
        expect(ev.objectives.filter(o => o.done).map(o => o.id)).toEqual([]);
      });
      it('la solution rejouable atteint tous les objectifs, sans violation', () => {
        const { sch, store } = lab(); startScenario(store, sch, sc);
        runSteps(store, sch, sc.solution);
        const ev = evaluate(sc, store.getState(), store.getLog(), sch.now);
        expect(ev.objectives.filter(o => !o.done).map(o => o.id)).toEqual([]);
        expect(ev.violations).toEqual([]); expect(ev.complete).toBe(true); expect(ev.score.total).toBe(100);
      });
      it('le démarrage est déterministe : deux démarrages donnent le même état', () => {
        const a = lab(), b = lab(); startScenario(a.store, a.sch, sc); startScenario(b.store, b.sch, sc);
        expect(a.store.getState()).toEqual(b.store.getState());
        startScenario(a.store, a.sch, sc); // « Recommencer »
        expect(a.store.getState()).toEqual(b.store.getState()); expect(a.sch.now).toBe(b.sch.now);
      });
    });
  }
});

describe('Session de TP', () => {
  const sc = SCENARIOS.find(s => s.number === 16)!;
  it('les indices coûtent des points, la solution les annule, ils sont bornés', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc);
    expect(store.dispatch({ type: 'scenario.hint', payload: { objective: 'fix' } }).ok).toBe(true);
    expect(store.dispatch({ type: 'scenario.hint', payload: { objective: 'doc' } }).ok).toBe(true);
    runSteps(store, sch, sc.solution);
    expect(evaluate(sc, store.getState(), store.getLog(), sch.now).score).toMatchObject({ autonomy: 6, total: 96 });
    store.dispatch({ type: 'scenario.revealSolution' });
    expect(evaluate(sc, store.getState(), store.getLog(), sch.now).score.autonomy).toBe(0);
    expect(store.dispatch({ type: 'scenario.hint', payload: { objective: 'doc' } }).error?.code).toBe('no_more_hints');
  });
  it('mode examen : ni indice, ni solution', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc, 'exam');
    expect(store.dispatch({ type: 'scenario.hint', payload: { objective: 'fix' } }).error?.code).toBe('exam_mode');
    expect(store.dispatch({ type: 'scenario.revealSolution' }).error?.code).toBe('exam_mode');
  });
  it('une violation (remplacer un équipement) coûte des points de qualité', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc);
    runSteps(store, sch, [{ do: 'infra.replaceDevice', args: { id: '@dev:PC21' } }, ...sc.solution]);
    const ev = evaluate(sc, store.getState(), store.getLog(), sch.now);
    expect(ev.violations).toHaveLength(1); expect(ev.score.quality).toBe(10);
  });
  it('terminer puis quitter', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc);
    expect(store.dispatch({ type: 'scenario.finish' }).ok).toBe(true); expect(store.getState().session?.finishedAt).toBeDefined();
    store.dispatch({ type: 'scenario.quit' }); expect(store.getState().session).toBeNull();
  });
});
