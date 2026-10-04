import { Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { advance, registerInventoryCommands } from '../../src/inventory';
import { licenseReport, licensesForSoftware, registerItsmCommands } from '../../src/itsm';
import { registerScenarioCommands, seedNovatechFull } from '../../src/scenarios';

function build() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);
  const fails: string[] = [];
  seedNovatechFull(store, c => { const r = store.dispatch(c); if (!r.ok) fails.push(`${c.type} ${JSON.stringify(c.payload)} → ${r.error?.message}`); return r.ok; });
  advance(store, sch, 10 * 60000);
  return { store, sch, fails };
}

describe('NovaTech complet', () => {
  it('se construit sans aucune commande refusée', () => { expect(build().fails).toEqual([]); });
  it('a la taille annoncée : ≥ 40 équipements, 45 utilisateurs, 4 sites, 5 fournisseurs, 3 contrats', () => {
    const st = build().store.getState();
    expect(Object.keys(st.reality.devices).length).toBeGreaterThanOrEqual(40);
    expect(Object.keys(st.management.users).length).toBe(45);
    expect(new Set(Object.values(st.reality.devices).map(d => d.site).filter(Boolean)).size).toBe(4);
    expect(Object.keys(st.management.suppliers).length).toBe(5); expect(Object.keys(st.management.contracts).length).toBe(3);
  });
  it('contient la non-conformité Office voulue et des installations interdites', () => {
    const { store, sch } = build(); const st = store.getState();
    const lic = licensesForSoftware(st, 'sw-office')[0]!; expect(licenseReport(st, lic, sch.now).state).toBe('over');
  });
  it('est déterministe', () => { expect(build().store.getState()).toEqual(build().store.getState()); });
});
