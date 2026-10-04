import { Scheduler, Store } from '../../src/core';
import { registerInfraCommands, computeReachability } from '../../src/infra';

/** Petit SI : FW — SW01 — {SRV-ITSM, SW02 — {PC21, PC22, PC23}} + PC01 sur SW01 */
function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store);
  const d = (c: Parameters<Store['dispatch']>[0]) => { const r = store.dispatch(c); if (!r.ok) throw r.error; return r; };
  const add = (kind: string, name: string) => { d({ type: 'infra.addDevice', payload: { kind, name } }); return Object.values(store.getState().reality.devices).find(x => x.name === name)!.id; };
  const wire = (a: string, ap: string, b: string, bp: string) => d({ type: 'infra.connect', payload: { aDevice: a, aPort: ap, bDevice: b, bPort: bp } });
  const ip = (id: string, ip: string, gw?: string) => d({ type: 'infra.setIp', payload: { id, ip, mask: 24, ...(gw ? { gw } : {}) } });
  const sw1 = add('switch', 'SW01'), sw2 = add('switch', 'SW02'), srv = add('server', 'SRV-ITSM');
  const pcs = ['PC21', 'PC22', 'PC23'].map(n => add('workstation', n)); const pc01 = add('workstation', 'PC01');
  wire(srv, 'eth0', sw1, 'port1'); wire(sw1, 'port2', sw2, 'port1'); wire(pc01, 'eth0', sw1, 'port3');
  pcs.forEach((p, i) => wire(p, 'eth0', sw2, `port${i + 2}`));
  ip(srv, '192.168.10.10'); ip(pc01, '192.168.10.21'); pcs.forEach((p, i) => ip(p, `192.168.10.${22 + i}`));
  d({ type: 'infra.setItsmServer', payload: { id: srv } });
  return { store, d, add, wire, ip, ids: { sw1, sw2, srv, pcs, pc01 } };
}
const online = (store: Store, id: string) => store.getState().reality.devices[id]!.online;
const types = (store: Store) => store.getLog().map(e => e.type);

describe('Infrastructure — création et câblage', () => {
  it('crée des équipements avec ports, MAC uniques et matériel du catalogue', () => {
    const { store, ids } = lab();
    const pc = store.getState().reality.devices[ids.pc01]!;
    expect(pc.ports.map(p => p.id)).toEqual(['eth0']);
    expect(pc.hardware?.ramGb).toBe(16);
    const macs = Object.values(store.getState().reality.devices).flatMap(x => x.nics.map(n => n.mac));
    expect(new Set(macs).size).toBe(macs.length);
  });
  it('refuse : même équipement, port inconnu, port occupé', () => {
    const { d, store, ids } = lab();
    const r = (aD: string, aP: string, bD: string, bP: string) => store.dispatch({ type: 'infra.connect', payload: { aDevice: aD, aPort: aP, bDevice: bD, bPort: bP } }).error?.code;
    expect(r(ids.sw1, 'port5', ids.sw1, 'port6')).toBe('same_device');
    expect(r(ids.sw1, 'port99', ids.sw2, 'port8')).toBe('port_not_found');
    expect(r(ids.sw1, 'port1', ids.sw2, 'port8')).toBe('port_busy');
    void d;
  });
  it('un type inconnu est refusé', () => {
    const { store } = lab();
    expect(store.dispatch({ type: 'infra.addDevice', payload: { kind: 'toaster' } }).error?.code).toBe('bad_kind');
  });
});

describe('Infrastructure — joignabilité et événements en cascade', () => {
  it('tout le SI est en ligne une fois câblé et adressé', () => {
    const { store, ids } = lab();
    [ids.sw1, ids.sw2, ids.srv, ids.pc01, ...ids.pcs].forEach(id => expect(online(store, id)).toBe(true));
  });

  it('débrancher un câble met le poste hors ligne et chaîne les événements', () => {
    const { store, d, ids } = lab();
    const link = Object.values(store.getState().reality.links).find(l => l.a.device === ids.pc01)!;
    const r = d({ type: 'infra.disconnect', payload: { link: link.id } });
    expect(r.events.map(e => e.type)).toEqual(['CableDisconnected', 'DeviceOffline']);
    expect(r.events[1]!.payload['reason']).toBe('no_link');
    expect(r.events[1]!.causedBy).toBe(r.events[0]!.id);
    expect(online(store, ids.pc01)).toBe(false);
    expect(online(store, ids.pcs[0]!)).toBe(true);
  });

  it('SW02 DOWN : PC21, PC22, PC23 passent hors ligne en cascade (incident collectif)', () => {
    const { store, d, ids } = lab();
    const r = d({ type: 'infra.powerOff', payload: { id: ids.sw2 } });
    const offline = r.events.filter(e => e.type === 'DeviceOffline').map(e => e.subject.id).sort();
    expect(offline).toEqual([ids.sw2, ...ids.pcs].sort());
    expect(r.events.filter(e => e.type === 'DeviceOffline' && e.subject.id !== ids.sw2).every(e => e.payload['reason'] === 'no_link')).toBe(true); // lien physique éteint côté poste
    expect(online(store, ids.pc01)).toBe(true); // SW01 et le reste ne sont pas touchés
    // et tout revient en ligne au redémarrage
    const back = d({ type: 'infra.powerOn', payload: { id: ids.sw2 } });
    expect(back.events.filter(e => e.type === 'DeviceOnline')).toHaveLength(4);
  });

  it('un serveur ITSM éteint rend tout le parc injoignable', () => {
    const { store, d, ids } = lab();
    d({ type: 'infra.powerOff', payload: { id: ids.srv } });
    [ids.pc01, ...ids.pcs, ids.sw1, ids.sw2].forEach(id => expect(online(store, id)).toBe(false));
  });

  it('un poste ne sert pas de pont : ce qui n\'est relié que par lui reste hors ligne', () => {
    const { store, add, wire, ip, ids } = lab();
    const laptop = add('laptop', 'PORT01'), ap = add('wifi_ap', 'AP01'), pc = add('workstation', 'PC50');
    wire(laptop, 'eth0', ids.sw1, 'port4'); wire(laptop, 'wifi', ap, 'wifi'); wire(pc, 'eth0', ap, 'lan');
    ip(laptop, '192.168.10.60'); ip(pc, '192.168.10.61');
    expect(online(store, laptop)).toBe(true);
    expect(online(store, ap)).toBe(false);
    expect(online(store, pc)).toBe(false);
  });

  it('IP hors du sous-réseau sur le même switch → hors ligne (wrong_subnet)', () => {
    const { store, d, ids } = lab();
    const r = d({ type: 'infra.setIp', payload: { id: ids.pc01, ip: '10.9.9.9', mask: 24 } });
    expect(r.events.map(e => e.type)).toEqual(['IPAddressChanged', 'DeviceOffline']);
    expect(r.events[1]!.payload['reason']).toBe('wrong_subnet');
    expect(online(store, ids.pc01)).toBe(false);
  });

  it('derrière un pare-feu : en ligne avec une passerelle, hors ligne sans', () => {
    const { store, d, add, wire, ip, ids } = lab();
    const fw = add('firewall', 'FW01'), sw3 = add('switch', 'SW03'), pc = add('workstation', 'PC40');
    wire(ids.sw1, 'port7', fw, 'lan'); wire(fw, 'wan', sw3, 'port1'); wire(pc, 'eth0', sw3, 'port2');
    d({ type: 'infra.setIp', payload: { id: pc, ip: '10.9.9.9', mask: 24 } });
    expect(online(store, pc)).toBe(false); // pas de passerelle
    ip(pc, '10.9.9.9', '10.9.9.1');
    expect(online(store, pc)).toBe(true);  // chemin routé via FW01
    d({ type: 'infra.powerOff', payload: { id: fw } });
    expect(online(store, pc)).toBe(false); // le pare-feu éteint coupe l'accès
    expect(online(store, ids.pc01)).toBe(true);
  });

  it('un poste sans IP est hors ligne (raison no_ip)', () => {
    const { store, d, ids } = lab();
    const r = d({ type: 'infra.setIp', payload: { id: ids.pc01, ip: '' } });
    expect(r.events.find(e => e.type === 'DeviceOffline')?.payload['reason']).toBe('no_ip');
    expect(online(store, ids.pc01)).toBe(false);
  });

  it('refuse une IP ou un masque invalides sans rien changer', () => {
    const { store, ids } = lab();
    const before = JSON.stringify(store.getState());
    expect(store.dispatch({ type: 'infra.setIp', payload: { id: ids.pc01, ip: '999.1.1.1' } }).error?.code).toBe('bad_ip');
    expect(store.dispatch({ type: 'infra.setIp', payload: { id: ids.pc01, ip: '10.0.0.1', mask: 40 } }).error?.code).toBe('bad_mask');
    expect(JSON.stringify(store.getState())).toBe(before);
  });
});

describe('Infrastructure — actions matérielles', () => {
  it('ajouter de la RAM émet HardwareChanged avec avant/après', () => {
    const { store, d, ids } = lab();
    const r = d({ type: 'infra.addRam', payload: { id: ids.pc01, gb: 16 } });
    expect(r.events[0]!.type).toBe('HardwareChanged');
    expect(r.events[0]!.payload).toMatchObject({ component: 'ram', before: 16, after: 32 });
    expect(store.getState().reality.devices[ids.pc01]!.hardware?.ramGb).toBe(32);
  });

  it('remplacer un switch conserve câblage, nom et position, avec un nouvel identifiant', () => {
    const { store, d, ids } = lab();
    d({ type: 'infra.powerOff', payload: { id: ids.sw2 } });
    const r = d({ type: 'infra.replaceDevice', payload: { id: ids.sw2 } });
    const rep = r.events.find(e => e.type === 'DeviceReplaced')!;
    const fresh = store.getState().reality.devices[rep.payload['newId'] as string]!;
    expect(fresh.name).toBe('SW02'); expect(fresh.powered).toBe(true);
    expect(store.getState().reality.devices[ids.sw2]).toBeUndefined();
    ids.pcs.forEach(id => expect(online(store, id)).toBe(true)); // les postes ont retrouvé le réseau
    expect(Object.values(store.getState().reality.links)).toHaveLength(6);
  });

  it('remplacer un poste donne de nouvelles adresses MAC mais conserve l\'IP', () => {
    const { store, d, ids } = lab();
    const oldMac = store.getState().reality.devices[ids.pc01]!.nics[0]!.mac;
    const r = d({ type: 'infra.replaceDevice', payload: { id: ids.pc01 } });
    const fresh = store.getState().reality.devices[r.events.find(e => e.type === 'DeviceReplaced')!.payload['newId'] as string]!;
    expect(fresh.nics[0]!.mac).not.toBe(oldMac);
    expect(fresh.nics[0]!.ip).toBe('192.168.10.21');
  });

  it('supprimer un équipement coupe ses câbles et émet les événements', () => {
    const { store, d, ids } = lab();
    const r = d({ type: 'infra.removeDevice', payload: { id: ids.sw2 } });
    expect(r.events.map(e => e.type)).toContain('DeviceRemoved');
    expect(r.events.filter(e => e.type === 'CableDisconnected')).toHaveLength(4);
    ids.pcs.forEach(id => expect(online(store, id)).toBe(false));
  });
});

describe('Infrastructure — déterminisme et reset', () => {
  it('restore() ramène exactement à l\'état initial puis rejoue à l\'identique', () => {
    const { store, d, ids } = lab();
    const snap = store.snapshot();
    d({ type: 'infra.powerOff', payload: { id: ids.sw2 } });
    d({ type: 'infra.addRam', payload: { id: ids.pc01, gb: 8 } });
    store.restore(snap);
    expect(store.snapshot()).toEqual(snap);
    d({ type: 'infra.powerOff', payload: { id: ids.sw2 } });
    expect(types(store).filter(t => t === 'DeviceOffline').length).toBeGreaterThan(0);
  });

  it('computeReachability est pure : même état, même résultat', () => {
    const { store } = lab();
    expect(computeReachability(store.getState())).toEqual(computeReachability(store.getState()));
  });
});
