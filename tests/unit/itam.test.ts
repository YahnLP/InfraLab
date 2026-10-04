import { DAY, Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { advance, assetForDevice, registerInventoryCommands } from '../../src/inventory';
import { autoRelations, contractState, forbiddenInstalls, impactOf, licenseReport, registerItsmCommands, simulateOutage, warrantyState } from '../../src/itsm';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store);
  const d = (c: Parameters<Store['dispatch']>[0]) => { const r = store.dispatch(c); if (!r.ok) throw r.error; return r; };
  const find = (n: string) => Object.values(store.getState().reality.devices).find(x => x.name === n)!.id;
  const add = (kind: string, name: string) => { d({ type: 'infra.addDevice', payload: { kind, name } }); return find(name); };
  const sw = add('switch', 'SW01'), srv = add('server', 'SRV'), pc1 = add('workstation', 'PC1'), pc2 = add('workstation', 'PC2'), pc3 = add('workstation', 'PC3');
  const wire = (a: string, ap: string, b: string, bp: string) => d({ type: 'infra.connect', payload: { aDevice: a, aPort: ap, bDevice: b, bPort: bp } });
  wire(srv, 'eth0', sw, 'port1'); wire(pc1, 'eth0', sw, 'port2'); wire(pc2, 'eth0', sw, 'port3'); wire(pc3, 'eth0', sw, 'port4');
  [[srv, '10'], [pc1, '21'], [pc2, '22'], [pc3, '23'], [sw, '2']].forEach(([id, n]) => d({ type: 'infra.setIp', payload: { id, ip: `192.168.10.${n}`, mask: 24 } }));
  d({ type: 'infra.setItsmServer', payload: { id: srv } });
  for (const p of [pc1, pc2, pc3]) { d({ type: 'infra.installSoftware', payload: { id: p, softwareId: 'sw-office' } }); d({ type: 'agent.install', payload: { id: p } }); }
  advance(store, sch, 10 * 60_000);
  d({ type: 'itsm.addUser', payload: { name: 'Alice' } });
  return { sch, store, d, ids: { sw, srv, pc1, pc2, pc3 } };
}
const st = (s: Store) => s.getState();

describe('Logiciels et licences', () => {
  it('conformité : installations connues de l\'outil contre droits achetés', () => {
    const { store, d, sch } = lab(); d({ type: 'itsm.addLicense', payload: { softwareId: 'sw-office', quantity: 2 } });
    const lic = Object.values(st(store).management.licenses)[0]!; const r = licenseReport(st(store), lic, sch.now);
    expect(r).toMatchObject({ entitled: 2, known: 3, real: 3, gap: 1, state: 'over' }); expect(lic.ref).toBe('LIC-0001');
    d({ type: 'itsm.updateLicense', payload: { id: lic.id, fields: { quantity: 3 } } }); expect(licenseReport(st(store), st(store).management.licenses[lic.id]!, sch.now).state).toBe('compliant');
  });
  it('désinstaller n\'apparaît dans l\'outil qu\'à la remontée suivante : l\'écart outil / réalité est visible', () => {
    const { store, d, sch, ids } = lab(); d({ type: 'itsm.addLicense', payload: { softwareId: 'sw-office', quantity: 2 } });
    d({ type: 'infra.uninstallSoftware', payload: { id: ids.pc3, softwareId: 'sw-office' } });
    const lic = () => Object.values(st(store).management.licenses)[0]!;
    expect(licenseReport(st(store), lic(), sch.now)).toMatchObject({ known: 3, real: 2, state: 'over' });
    d({ type: 'agent.runInventory', payload: { id: ids.pc3 } }); expect(licenseReport(st(store), lic(), sch.now)).toMatchObject({ known: 2, state: 'compliant' });
  });
  it('licence expirée : plus aucun droit', () => {
    const { store, d, sch } = lab(); d({ type: 'itsm.addLicense', payload: { softwareId: 'sw-office', quantity: 5, expiresAt: DAY } });
    const lic = Object.values(st(store).management.licenses)[0]!; expect(licenseReport(st(store), lic, sch.now).state).toBe('compliant');
    expect(licenseReport(st(store), lic, 2 * DAY)).toMatchObject({ expired: true, state: 'over' });
  });
  it('validations : quantité entière positive, logiciel connu', () => {
    const { store } = lab();
    expect(store.dispatch({ type: 'itsm.addLicense', payload: { softwareId: 'sw-office', quantity: 0 } }).error?.code).toBe('bad_quantity');
    expect(store.dispatch({ type: 'itsm.addLicense', payload: { softwareId: 'nope', quantity: 1 } }).error?.code).toBe('software_not_found');
  });
  it('politique logiciels : installations interdites détectées', () => {
    const { store, d, ids } = lab(); d({ type: 'infra.installSoftware', payload: { id: ids.pc2, softwareId: 'sw-teamviewer' } }); d({ type: 'agent.runInventory', payload: { id: ids.pc2 } });
    expect(forbiddenInstalls(st(store))).toHaveLength(0); d({ type: 'itsm.setSoftwarePolicy', payload: { softwareId: 'sw-teamviewer', policy: 'forbidden' } });
    expect(forbiddenInstalls(st(store)).map(x => x.asset.name)).toEqual(['PC2']);
  });
});

describe('Contrats et garanties', () => {
  it('statuts actif / échéance proche / expiré, selon le temps simulé', () => {
    const { store, d } = lab(); d({ type: 'itsm.addSupplier', payload: { name: 'Dell' } }); const sup = Object.keys(st(store).management.suppliers)[0]!;
    d({ type: 'itsm.addContract', payload: { title: 'Maintenance', supplierId: sup, endAt: 60 * DAY } }); const c = Object.values(st(store).management.contracts)[0]!;
    expect(c.ref).toBe('CTR-0001'); expect(contractState(c, 0)).toBe('active'); expect(contractState(c, 40 * DAY)).toBe('expiring'); expect(contractState(c, 61 * DAY)).toBe('expired');
    d({ type: 'itsm.updateContract', payload: { id: c.id, fields: { endAt: 400 * DAY } } }); expect(contractState(st(store).management.contracts[c.id]!, 61 * DAY)).toBe('active');
  });
  it('dates incohérentes et fournisseur inconnu refusés', () => {
    const { store, d } = lab(); d({ type: 'itsm.addSupplier', payload: { name: 'Dell' } }); const sup = Object.keys(st(store).management.suppliers)[0]!;
    expect(store.dispatch({ type: 'itsm.addContract', payload: { title: 'x', supplierId: sup, startAt: 10, endAt: 5 } }).error?.code).toBe('bad_dates');
    expect(store.dispatch({ type: 'itsm.addContract', payload: { title: 'x', supplierId: 'nope', endAt: 5 } }).error?.code).toBe('supplier_not_found');
  });
  it('garantie d\'un actif', () => {
    const { store, d } = lab(); d({ type: 'itsm.createAsset', payload: { name: 'LAPTOP-9', warrantyEnd: 100 * DAY } }); const a = Object.values(st(store).management.assets).find(x => x.name === 'LAPTOP-9')!;
    expect(warrantyState(a, 0)).toBe('valid'); expect(warrantyState(a, 80 * DAY)).toBe('expiring'); expect(warrantyState(a, 101 * DAY)).toBe('expired');
  });
});

describe('Cycle de vie des actifs', () => {
  const mk = () => { const l = lab(); l.d({ type: 'itsm.createAsset', payload: { name: 'LAPTOP-9' } }); const id = Object.values(st(l.store).management.assets).find(x => x.name === 'LAPTOP-9')!.id; const alice = Object.keys(st(l.store).management.users)[0]!;
    return { ...l, id, alice, go: (to: string, user?: string) => l.store.dispatch({ type: 'itsm.setAssetStatus', payload: { id, to, ...(user ? { user } : {}) } }) }; };
  it('commandé → stock → en service (avec utilisateur) → réparation → service → stock → retiré', () => {
    const { store, id, alice, go } = mk(); const a = () => st(store).management.assets[id]!;
    expect(a().status).toBe('ordered'); expect(go('in_use', alice).error?.code).toBe('bad_transition');
    expect(go('stock').ok).toBe(true); expect(go('in_use').error?.message).toContain('utilisateur');
    expect(go('in_use', alice).ok).toBe(true); expect(a().assignedTo).toBe(alice);
    expect(go('repair').ok && go('in_use').ok).toBe(true); expect(a().assignedTo).toBe(alice);
    expect(go('stock').ok).toBe(true); expect(a().assignedTo).toBeUndefined(); expect(go('retired').ok).toBe(true);
    expect(go('stock').error?.code).toBe('bad_transition');
  });
  it('l\'historique de l\'actif se lit dans le journal', () => {
    const { store, id, alice, go } = mk(); go('stock'); go('in_use', alice);
    expect(store.getLog().filter(e => e.subject.id === id).map(e => e.type)).toEqual(['AssetCreatedManual', 'AssetStatusChanged', 'AssetAssigned', 'AssetStatusChanged']);
  });
  it('un actif découvert peut être mis en service ; le nom d\'un actif est unique', () => {
    const { store, d, ids } = lab(); const alice = Object.keys(st(store).management.users)[0]!; d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } }); const a = assetForDevice(st(store), ids.sw)!; expect(a.status).toBe('discovered');
    expect(store.dispatch({ type: 'itsm.setAssetStatus', payload: { id: a.id, to: 'in_use', user: alice } }).ok).toBe(true);
    expect(store.dispatch({ type: 'itsm.createAsset', payload: { name: 'PC1' } }).error?.code).toBe('duplicate');
  });
});

describe('CMDB', () => {
  const setup = () => { const l = lab(); l.d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });
    const ast = (id: string) => assetForDevice(st(l.store), id)!.id;
    const ci = (name: string, kind: string, asset?: string) => { l.d({ type: 'itsm.createCi', payload: { name, kind, ...(asset ? { asset } : {}) } }); return Object.values(st(l.store).management.cis).find(c => c.name === name)!.id; };
    return { ...l, ast, ci }; };
  it('CI d\'infrastructure : repose sur un actif unique ; nom unique', () => {
    const { store, ids, ast, ci } = setup(); ci('PC1', 'infrastructure', ast(ids.pc1));
    expect(store.dispatch({ type: 'itsm.createCi', payload: { name: 'Autre', kind: 'infrastructure', asset: ast(ids.pc1) } }).error?.code).toBe('duplicate');
    expect(store.dispatch({ type: 'itsm.createCi', payload: { name: 'X', kind: 'infrastructure' } }).error?.code).toBe('asset_required');
    expect(store.dispatch({ type: 'itsm.createCi', payload: { name: 'PC1', kind: 'service' } }).error?.code).toBe('duplicate');
  });
  it('relations manuelles : pas d\'auto-dépendance, pas de doublon ; auto-relations issues du câblage', () => {
    const { store, d, ids, ast, ci } = setup(); const a = ci('PC1', 'infrastructure', ast(ids.pc1)), srv = ci('SRV', 'infrastructure', ast(ids.srv)), svc = ci('Facturation', 'service');
    expect(store.dispatch({ type: 'itsm.addRelation', payload: { from: svc, to: svc } }).error?.code).toBe('self_relation');
    d({ type: 'itsm.addRelation', payload: { from: svc, to: a, type: 'depends_on' } }); expect(store.dispatch({ type: 'itsm.addRelation', payload: { from: svc, to: a, type: 'depends_on' } }).error?.code).toBe('duplicate');
    expect(autoRelations(st(store))).toEqual([]); // PC1 et SRV sont reliés à un switch sans CI : aucune relation déduite
    ci('SW01', 'infrastructure', ast(ids.sw)); expect(autoRelations(st(store)).length).toBe(2); void srv;
  });
  it('simulation de panne : un switch éteint coupe ce qui en dépend, la réalité reste intacte', () => {
    const { store, ids } = setup();
    expect(simulateOutage(st(store), ids.sw).sort()).toEqual([ids.pc1, ids.pc2, ids.pc3].sort());
    expect(st(store).reality.devices[ids.sw]!.powered).toBe(true);
  });
  it('impact : un service qui dépend d\'un poste est touché quand le switch tombe', () => {
    const { d, store, ids, ast, ci } = setup(); const pc = ci('PC1', 'infrastructure', ast(ids.pc1)), sw = ci('SW01', 'infrastructure', ast(ids.sw)), svc = ci('Facturation', 'service'), other = ci('Paie', 'service'); void other;
    d({ type: 'itsm.addRelation', payload: { from: svc, to: pc, type: 'depends_on' } });
    const imp = impactOf(st(store), sw); expect(imp.services.map(i => st(store).management.cis[i]!.name)).toEqual(['Facturation']);
    expect(impactOf(st(store), svc).services).toEqual([svc]);
    d({ type: 'itsm.removeCi', payload: { id: pc } }); expect(Object.keys(st(store).management.relations)).toHaveLength(0);
  });
  it('un ancien état est normalisé', () => {
    const { store } = lab(); const snap = store.snapshot(); for (const k of ['suppliers', 'contracts', 'licenses', 'softwarePolicy', 'cis', 'relations']) delete (snap.state.management as unknown as Record<string, unknown>)[k];
    store.restore(snap); expect(st(store).management.cis).toEqual({});
  });
});
