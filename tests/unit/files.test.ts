import { describe, expect, it } from 'vitest';
import { Scheduler, Store, emptyState } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { registerItsmCommands } from '../../src/itsm';
import { getScenario, registerScenarioCommands, startScenario } from '../../src/scenarios';
import { parseProject, serialize, suggestedName } from '../../src/ui/shell/files';

function mk() { const sch = new Scheduler(); const store = new Store({ clock: () => sch.now }); registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store); return { sch, store }; }

describe('fichier projet', () => {
  it('aller-retour : un TP en cours est restitué à l\'identique', () => {
    const a = mk(); const sc = getScenario('tp-01-decouvrir-le-si')!; startScenario(a.store, a.sch, sc, 'tp'); a.sch.now = 5000;
    const txt = serialize(a.store.snapshot(), a.sch.now, 'TP');
    const r = parseProject(txt); const b = mk(); b.store.restore(r.snapshot); b.sch.now = r.now;
    expect(b.store.getState()).toEqual(a.store.getState()); expect(b.sch.now).toBe(5000); expect(b.store.getState().session?.scenarioId).toBe(sc.id);
  });
  it('refuse les fichiers étrangers avec un message clair', () => {
    expect(() => parseProject('pas du json')).toThrow(/illisible/);
    expect(() => parseProject('{"a":1}')).toThrow(/pas un projet InfraLab/);
    expect(() => parseProject(JSON.stringify({ format: 'infralab-project', version: 2 }))).toThrow(/plus récente/);
    expect(() => parseProject(JSON.stringify({ format: 'infralab-project', version: 1, snapshot: { state: {}, log: [] } }))).toThrow(/incomplet/);
  });
  it('nom proposé', () => {
    const st = emptyState(); expect(suggestedName(st)).toBe('infralab-projet.infralab.json');
    const a = mk(); startScenario(a.store, a.sch, getScenario('tp-01-decouvrir-le-si')!, 'exam'); expect(suggestedName(a.store.getState(), 1)).toBe('infralab-tp1-examen.infralab.json');
  });
});
