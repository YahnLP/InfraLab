import { Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { registerItsmCommands } from '../../src/itsm';
import { COURSE_TPS, SCENARIOS, evaluate, getScenario, parseTp, registerExternalScenario, registerScenarioCommands, runSteps, serializeTp, startScenario } from '../../src/scenarios';
import { parseProject, serialize } from '../../src/ui/shell/files';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);
  return { sch, store };
}

describe('TP distribués sous forme de fichier', () => {
  it('les TP de cours ne figurent pas au catalogue', () => {
    for (const c of COURSE_TPS) { expect(SCENARIOS.some(s => s.id === c.id || s.number === c.number)).toBe(false); expect(getScenario(c.id)).toBeUndefined(); }
  });
  for (const c of COURSE_TPS) {
    it(`TP ${c.number} : le fichier relu se résout comme l'original, solution comprise`, () => {
      const sc = parseTp(serializeTp(c));
      expect(sc).toEqual(JSON.parse(JSON.stringify(c)));
      registerExternalScenario(sc); expect(getScenario(sc.id)).toBeDefined();
      const { sch, store } = lab(); startScenario(store, sch, sc); runSteps(store, sch, sc.solution);
      const ev = evaluate(sc, store.getState(), store.getLog(), sch.now);
      expect(ev.complete).toBe(true); expect(ev.score.total).toBe(100);
    });
    it(`TP ${c.number} : un projet enregistré embarque le TP et se rouvre`, () => {
      const { sch, store } = lab(); startScenario(store, sch, c);
      const r = parseProject(serialize(store.snapshot(), sch.now, 'TP', new Date(0), c));
      expect(r.scenario?.id).toBe(c.id);
    });
  }
  it('refuse un fichier qui n\'est pas un TP, ou dont l\'identifiant est celui du catalogue', () => {
    expect(() => parseTp('pas du json')).toThrow(/illisible/);
    expect(() => parseTp('{"format":"infralab-project"}')).toThrow(/pas un TP/);
    expect(() => parseTp(serializeTp(SCENARIOS[0]!))).toThrow(/catalogue/);
    expect(() => parseTp(JSON.stringify({ format: 'infralab-tp', version: 1, scenario: { id: 'x' } }))).toThrow(/invalide/);
  });
});
