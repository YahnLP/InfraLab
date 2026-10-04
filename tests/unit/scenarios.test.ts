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
        // chaque objectif appartient à une seule étape ; chaque étape a cours, tâches et bilan
        const owned = sc.stages.flatMap(g => g.objectives); expect([...owned].sort()).toEqual([...ids].sort());
        for (const g of sc.stages) { expect(g.lesson.length).toBeGreaterThan(0); expect(g.debrief.length).toBeGreaterThan(0); expect(g.objectives.length).toBeGreaterThan(0); }
        for (const o of sc.objectives) { expect(!!o.check !== !!o.question).toBe(true); if (o.question) { expect(o.question.choices.length).toBeGreaterThanOrEqual(3); expect(o.question.correct).toBeLessThan(o.question.choices.length); } }
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

describe('Questions et étapes', () => {
  const sc = SCENARIOS.find(s => s.number === 19)!;
  it('une mauvaise réponse coûte un point d\'autonomie, une bonne est enregistrée', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc);
    expect(store.dispatch({ type: 'scenario.answer', payload: { objective: 'how', choice: 0 } }).ok).toBe(true);
    expect(evaluate(sc, store.getState(), store.getLog(), sch.now).objectives.find(o => o.id === 'how')!.done).toBe(false);
    store.dispatch({ type: 'scenario.answer', payload: { objective: 'how', choice: 1 } });
    const ev = evaluate(sc, store.getState(), store.getLog(), sch.now);
    expect(ev.objectives.find(o => o.id === 'how')!.done).toBe(true); expect(ev.score.autonomy).toBe(9);
    expect(store.dispatch({ type: 'scenario.answer', payload: { objective: 'how', choice: 1 } }).error?.code).toBe('already');
    expect(store.dispatch({ type: 'scenario.answer', payload: { objective: 'links', choice: 1 } }).error?.code).toBe('no_question');
  });
  it('la chaîne complète est exigée : fermer les tickets sans vérification ni solution ne suffit pas', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc);
    runSteps(store, sch, [{ do: 'infra.powerOn', args: { id: '@dev:SW02' } }]);
    const ev = evaluate(sc, store.getState(), store.getLog(), sch.now);
    expect(ev.objectives.find(o => o.id === 'online')!.done).toBe(true); expect(ev.objectives.find(o => o.id === 'closed')!.done).toBe(false);
    expect(ev.stages.map(g => g.done)).toEqual([false, false, false, false]);
  });
  it('on avance d\'étape en étape, pas au-delà de la dernière', () => {
    const { sch, store } = lab(); startScenario(store, sch, sc);
    for (let i = 0; i < sc.stages.length - 1; i++) expect(store.dispatch({ type: 'scenario.advance' }).ok).toBe(true);
    expect(store.getState().session!.stage).toBe(3); expect(store.dispatch({ type: 'scenario.advance' }).error?.code).toBe('last_stage');
  });
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

describe('Catalogue complet', () => {
  it('contient les 48 TP numérotés de 1 à 48, dans l\'ordre', () => {
    expect(SCENARIOS.map(s => s.number)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
  });
  it('TP 38 : l\'impact d\'un arrêt de SRV-ITSM remonte jusqu\'au service (propriété sur laquelle repose la question)', async () => {
    const { impactOf } = await import('../../src/itsm');
    const { sch, store } = lab(); const sc = SCENARIOS.find(s => s.number === 38)!; startScenario(store, sch, sc); runSteps(store, sch, sc.solution.filter(x => x.do !== 'scenario.answer'));
    const st = store.getState(); const srv = Object.values(st.management.cis).find(c => c.name === 'SRV-ITSM')!;
    const paie = Object.values(st.management.cis).find(c => c.name === 'Paie')!;
    expect(impactOf(st, srv.id).services).toContain(paie.id);
  });
});

describe('Compte rendu de TP', () => {
  it('reflète le score, les objectifs et un journal sans événements de TP, de façon déterministe', async () => {
    const { buildReport, fingerprint } = await import('../../src/scenarios');
    const sc = SCENARIOS.find(s => s.number === 37)!; const mk = () => {
      const { sch, store } = lab(); startScenario(store, sch, sc); runSteps(store, sch, sc.solution); store.dispatch({ type: 'scenario.finish' });
      return buildReport(sc, store.getState(), store.getLog(), sch.now, '  Alice  ')!;
    };
    const a = mk(); const b = mk();
    expect(a.score.total).toBe(100); expect(a.student).toBe('Alice'); expect(a.finished).toBe(true);
    expect(a.objectives.every(o => o.done)).toBe(true);
    expect(a.journal.some(j => j.type.startsWith('Scenario'))).toBe(false); expect(a.journal.some(j => j.type === 'AssetUpdatedFinance')).toBe(true);
    expect(await fingerprint(a)).toBe(await fingerprint(b));
  });
});
