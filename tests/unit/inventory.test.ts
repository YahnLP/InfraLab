import { DAY, HOUR, Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { advance, agentHealth, assetForDevice, assetFreshness, driftReport, registerInventoryCommands } from '../../src/inventory';
import { registerItsmCommands } from '../../src/itsm';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store);
  const d = (c: Parameters<Store['dispatch']>[0]) => { const r = store.dispatch(c); if (!r.ok) throw r.error; return r; };
  const find = (name: string) => Object.values(store.getState().reality.devices).find(x => x.name === name)!.id;
  const add = (kind: string, name: string) => { d({ type: 'infra.addDevice', payload: { kind, name } }); return find(name); };
  const wire = (a: string, ap: string, b: string, bp: string) => d({ type: 'infra.connect', payload: { aDevice: a, aPort: ap, bDevice: b, bPort: bp } });
  const ip = (id: string, addr: string) => d({ type: 'infra.setIp', payload: { id, ip: addr, mask: 24 } });
  const sw = add('switch', 'SW01'), srv = add('server', 'SRV-ITSM'), pc = add('workstation', 'PC01'), prn = add('printer', 'IMP01'), pc2 = add('workstation', 'PC02');
  wire(srv, 'eth0', sw, 'port1'); wire(pc, 'eth0', sw, 'port2'); wire(prn, 'lan', sw, 'port3'); wire(pc2, 'eth0', sw, 'port4');
  ip(srv, '192.168.10.10'); ip(pc, '192.168.10.21'); ip(prn, '192.168.10.50'); ip(sw, '192.168.10.2'); ip(pc2, '192.168.10.22');
  d({ type: 'infra.setItsmServer', payload: { id: srv } });
  d({ type: 'itsm.addUser', payload: { name: 'Alice Martin', service: 'Comptabilité' } });
  return { sch, store, d, ids: { sw, srv, pc, prn, pc2 }, advance: (ms: number) => advance(store, sch, ms) };
}
const dv = (s: Store, id: string) => s.getState().reality.devices[id]!;
const assets = (s: Store) => Object.values(s.getState().management.assets);

describe('Agent — cycle de vie', () => {
  it('installer un agent : actif, URL attendue, première remontée planifiée', () => {
    const { store, d, ids } = lab();
    const r = d({ type: 'agent.install', payload: { id: ids.pc } });
    expect(r.events[0]!.type).toBe('AgentInstalled');
    expect(dv(store, ids.pc).agent).toMatchObject({ state: 'running', serverUrl: 'http://srv-itsm/inventory' });
    expect(agentHealth(store.getState(), dv(store, ids.pc))).toBe('ok');
  });
  it('refuse un agent sur un équipement qui n\'en supporte pas (imprimante, switch)', () => {
    const { store, ids } = lab();
    expect(store.dispatch({ type: 'agent.install', payload: { id: ids.prn } }).error?.code).toBe('agent_unsupported');
    expect(store.dispatch({ type: 'agent.install', payload: { id: ids.sw } }).error?.code).toBe('agent_unsupported');
  });
  it('refuse sur un poste éteint, ou un doublon', () => {
    const { store, d, ids } = lab();
    d({ type: 'infra.powerOff', payload: { id: ids.pc } });
    expect(store.dispatch({ type: 'agent.install', payload: { id: ids.pc } }).error?.code).toBe('device_off');
    d({ type: 'infra.powerOn', payload: { id: ids.pc } }); d({ type: 'agent.install', payload: { id: ids.pc } });
    expect(store.dispatch({ type: 'agent.install', payload: { id: ids.pc } }).error?.code).toBe('agent_exists');
  });
  it('arrêter / démarrer / désinstaller', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.stop', payload: { id: ids.pc } });
    expect(agentHealth(store.getState(), dv(store, ids.pc))).toBe('stopped');
    expect(store.dispatch({ type: 'agent.runInventory', payload: { id: ids.pc } }).error?.code).toBe('agent_not_running');
    d({ type: 'agent.start', payload: { id: ids.pc } }); d({ type: 'agent.uninstall', payload: { id: ids.pc } });
    expect(dv(store, ids.pc).agent.state).toBe('none');
  });
});

describe('Remontée d\'inventaire', () => {
  it('sans agent, rien ne remonte : le poste reste inconnu de l\'outil', () => {
    const { store, ids } = lab();
    expect(store.dispatch({ type: 'agent.runInventory', payload: { id: ids.pc } }).error?.code).toBe('agent_not_running');
    expect(assets(store)).toHaveLength(0);
  });

  it('une remontée crée l\'actif avec les données RÉELLES de l\'équipement (provenance agent)', () => {
    const { store, d, ids } = lab();
    d({ type: 'infra.installSoftware', payload: { id: ids.pc, softwareId: 'sw-office' } });
    d({ type: 'infra.installSoftware', payload: { id: ids.pc, softwareId: 'sw-chrome' } });
    const uid = Object.keys(store.getState().management.users)[0]!;
    d({ type: 'infra.setLoggedUser', payload: { id: ids.pc, user: uid } });
    d({ type: 'agent.install', payload: { id: ids.pc } });
    const r = d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    expect(r.events.map(e => e.type)).toEqual(['AssetCreated', 'AgentInventoryCompleted']);
    const a = assetForDevice(store.getState(), ids.pc)!;
    expect(a.status).toBe('in_use');
    expect(a.observed?.source).toBe('agent');
    expect(a.observed?.data).toMatchObject({ hostname: 'PC01', ramGb: 16, ips: ['192.168.10.21'], loggedUser: 'Alice Martin' });
    expect(a.observed?.data.software).toHaveLength(2);
  });

  it('la remontée planifiée se déclenche 5 min après l\'installation puis toutes les 24 h', () => {
    const { store, d, ids, advance } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } });
    advance(4 * 60_000);
    expect(assets(store)).toHaveLength(0);
    advance(2 * 60_000);
    expect(assets(store)).toHaveLength(1);
    const t1 = assets(store)[0]!.observed!.t;
    advance(DAY + HOUR);
    expect(assets(store)[0]!.observed!.t).toBeGreaterThan(t1);
    expect(assets(store)[0]!.observed!.t).toBe(t1 + DAY); // 2ᵉ remontée exactement 24 h après la 1ʳᵉ
  });

  it('un changement matériel n\'apparaît dans l\'outil qu\'à la remontée suivante (écart réalité / observé)', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    d({ type: 'infra.addRam', payload: { id: ids.pc, gb: 16 } });
    const a = () => assetForDevice(store.getState(), ids.pc)!;
    expect(a().observed!.data.ramGb).toBe(16);                                   // l'outil ne sait encore rien
    expect(driftReport(store.getState(), a())).toEqual([{ field: 'Mémoire (Go)', observed: '16', reality: '32' }]);
    const r = d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    expect(r.events.find(e => e.type === 'ChangeDetected')?.payload).toMatchObject({ field: 'ramGb', before: 16, after: 32 });
    expect(a().observed!.data.ramGb).toBe(32);
    expect(driftReport(store.getState(), a())).toEqual([]);
  });

  it('logiciels installés puis désinstallés : détectés comme changements', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    d({ type: 'infra.installSoftware', payload: { id: ids.pc, softwareId: 'sw-teamviewer' } });
    expect(d({ type: 'agent.runInventory', payload: { id: ids.pc } }).events.some(e => e.type === 'ChangeDetected' && e.payload['field'] === 'software')).toBe(true);
    expect(store.dispatch({ type: 'infra.installSoftware', payload: { id: ids.pc, softwareId: 'sw-teamviewer' } }).error?.code).toBe('already_installed');
  });
});

describe('Agent — pannes et diagnostic', () => {
  it('câble débranché : DeviceOffline → AgentOffline (chaîne causale) ; remontée en échec', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    const link = Object.values(store.getState().reality.links).find(l => l.a.device === ids.pc || l.b.device === ids.pc)!;
    const r = d({ type: 'infra.disconnect', payload: { link: link.id } });
    expect(r.events.map(e => e.type)).toEqual(['CableDisconnected', 'DeviceOffline', 'AgentOffline']);
    const off = r.events[2]!; expect(store.trace(off.id).map(e => e.type)).toEqual(['CableDisconnected', 'DeviceOffline', 'AgentOffline']);
    expect(agentHealth(store.getState(), dv(store, ids.pc))).toBe('unreachable');
    expect(d({ type: 'agent.runInventory', payload: { id: ids.pc } }).events[0]!.type).toBe('AgentInventoryFailed');
    expect(dv(store, ids.pc).agent.errors).toContain('serveur ITSM injoignable');
  });

  it('retour en ligne : AgentOnline puis remontée de rattrapage si elle était due', () => {
    const { store, d, ids, advance } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    const t0 = assetForDevice(store.getState(), ids.pc)!.observed!.t;
    d({ type: 'infra.powerOff', payload: { id: ids.sw } });
    advance(2 * DAY);
    expect(assetForDevice(store.getState(), ids.pc)!.observed!.t).toBe(t0);               // aucune remontée possible
    expect(assetFreshness(assetForDevice(store.getState(), ids.pc)!, 2 * DAY)).toBe('aging');
    const back = d({ type: 'infra.powerOn', payload: { id: ids.sw } });
    expect(back.events.map(e => e.type)).toContain('AgentOnline');
    expect(back.events.map(e => e.type)).toContain('AgentInventoryCompleted');
    expect(assetForDevice(store.getState(), ids.pc)!.observed!.t).toBeGreaterThan(t0);
  });

  it('agent mal configuré (mauvaise URL) : santé « misconfigured », remontée refusée, corrigée par configure', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc, serverUrl: 'http://glpi-test/inventory' } });
    expect(agentHealth(store.getState(), dv(store, ids.pc))).toBe('misconfigured');
    expect(d({ type: 'agent.runInventory', payload: { id: ids.pc } }).events[0]!.payload['reason']).toBe('misconfigured');
    d({ type: 'agent.configure', payload: { id: ids.pc, serverUrl: 'http://srv-itsm/inventory' } });
    expect(d({ type: 'agent.runInventory', payload: { id: ids.pc } }).events.some(e => e.type === 'AgentInventoryCompleted')).toBe(true);
  });

  it('agent obsolète : signalé mais fonctionnel ; mise à jour disponible', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc, version: '1.9' } });
    expect(agentHealth(store.getState(), dv(store, ids.pc))).toBe('outdated');
    expect(d({ type: 'agent.runInventory', payload: { id: ids.pc } }).events.some(e => e.type === 'AgentInventoryCompleted')).toBe(true);
    d({ type: 'agent.update', payload: { id: ids.pc } });
    expect(agentHealth(store.getState(), dv(store, ids.pc))).toBe('ok');
  });
});

describe('Découverte réseau', () => {
  it('découvre les équipements réellement présents : informations partielles, statut « découvert », pas d\'inventaire', () => {
    const { store, d } = lab();
    const r = d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });
    const done = r.events.find(e => e.type === 'NetworkDiscoveryCompleted')!;
    expect(done.payload).toMatchObject({ found: 5, created: 5 });
    const list = assets(store);
    expect(list.map(a => a.name).sort()).toEqual(['IMP01', 'PC01', 'PC02', 'SRV-ITSM', 'SW01']);
    expect(list.every(a => a.status === 'discovered' && a.observed === undefined && a.discovery)).toBe(true);
    expect(list.find(a => a.name === 'IMP01')!.discovery).toMatchObject({ ip: '192.168.10.50', vendor: 'Canon' });
  });
  it('ne voit pas ce qui est éteint, débranché, sans IP ou hors plage', () => {
    const { store, d, ids } = lab();
    d({ type: 'infra.powerOff', payload: { id: ids.pc2 } });
    d({ type: 'infra.setIp', payload: { id: ids.prn, ip: '' } });
    const r = d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/25' } });
    expect(r.events.find(e => e.type === 'NetworkDiscoveryCompleted')!.payload['found']).toBe(3); // SRV, PC01, SW01
    expect(assets(store).map(a => a.name).sort()).toEqual(['PC01', 'SRV-ITSM', 'SW01']);
  });
  it('relancer la découverte rapproche (par MAC) au lieu de dupliquer', () => {
    const { store, d } = lab();
    d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });
    const r = d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });
    expect(assets(store)).toHaveLength(5);
    expect(r.events.find(e => e.type === 'NetworkDiscoveryCompleted')!.payload).toMatchObject({ created: 0, matched: 5 });
  });
  it('découverte puis agent : l\'actif découvert devient inventorié (même actif, pas de doublon)', () => {
    const { store, d, ids } = lab();
    d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });
    const before = assetForDevice(store.getState(), ids.pc)!;
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    const after = assetForDevice(store.getState(), ids.pc)!;
    expect(after.id).toBe(before.id); expect(after.status).toBe('in_use'); expect(after.observed).toBeDefined(); expect(assets(store)).toHaveLength(5);
  });
  it('refus : plage invalide, serveur hors ligne, pas de serveur', () => {
    const { store, d, ids } = lab();
    expect(store.dispatch({ type: 'inventory.discover', payload: { cidr: 'n\'importe quoi' } }).error?.code).toBe('bad_cidr');
    d({ type: 'infra.powerOff', payload: { id: ids.srv } });
    expect(store.dispatch({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } }).error?.code).toBe('probe_offline');
  });
  it('remplacement matériel : l\'actif est retrouvé par nom d\'hôte, avec une alerte de changement de MAC', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    const old = assetForDevice(store.getState(), ids.pc)!.id;
    d({ type: 'infra.replaceDevice', payload: { id: ids.pc } });
    const fresh = Object.values(store.getState().reality.devices).find(x => x.name === 'PC01')!;
    d({ type: 'agent.install', payload: { id: fresh.id } });
    const r = d({ type: 'agent.runInventory', payload: { id: fresh.id } });
    expect(assets(store)).toHaveLength(1);
    expect(r.events.find(e => e.type === 'AssetMatched')!.payload['by']).toBe('hostname');
    expect(r.events.some(e => e.type === 'ChangeDetected' && e.payload['field'] === 'macs')).toBe(true);
    expect(assetForDevice(store.getState(), fresh.id)!.id).toBe(old);
  });
});

describe('Gestion — données déclarées', () => {
  it('saisie manuelle et affectation, distinctes de ce qui est observé', () => {
    const { store, d, ids } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    const a = assetForDevice(store.getState(), ids.pc)!; const uid = Object.keys(store.getState().management.users)[0]!;
    d({ type: 'itsm.updateAsset', payload: { id: a.id, fields: { inventoryNo: 'INV-2024-0042', serial: '5CG3', vendor: 'HP' } } });
    d({ type: 'itsm.assignAsset', payload: { id: a.id, user: uid } });
    const b = assetForDevice(store.getState(), ids.pc)!;
    expect(b).toMatchObject({ inventoryNo: 'INV-2024-0042', assignedTo: uid, service: 'Comptabilité' });
    expect(store.dispatch({ type: 'itsm.updateAsset', payload: { id: a.id, fields: { vendor: 'HP' } } }).error?.code).toBe('nothing_changed');
  });
});

describe('Inventaire — reset', () => {
  it('snapshot / restore ramène agents, actifs et journaux à l\'identique', () => {
    const { store, d, ids } = lab();
    d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });
    const snap = store.snapshot();
    d({ type: 'agent.install', payload: { id: ids.pc } }); d({ type: 'agent.runInventory', payload: { id: ids.pc } });
    store.restore(snap);
    expect(store.snapshot()).toEqual(snap);
    expect(assets(store).every(a => a.status === 'discovered')).toBe(true);
  });
});
