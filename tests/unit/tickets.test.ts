import { DAY, Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { advance, assetForDevice, registerInventoryCommands } from '../../src/inventory';
import { PRIORITY_LABEL, TRANSITIONS, priorityOf, registerItsmCommands, transitionsFrom } from '../../src/itsm';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store);
  const d = (c: Parameters<Store['dispatch']>[0]) => { const r = store.dispatch(c); if (!r.ok) throw r.error; return r; };
  const find = (name: string) => Object.values(store.getState().reality.devices).find(x => x.name === name)!.id;
  const add = (kind: string, name: string) => { d({ type: 'infra.addDevice', payload: { kind, name } }); return find(name); };
  const sw = add('switch', 'SW01'), srv = add('server', 'SRV-ITSM'), pc = add('workstation', 'PC01');
  d({ type: 'infra.connect', payload: { aDevice: srv, aPort: 'eth0', bDevice: sw, bPort: 'port1' } });
  d({ type: 'infra.connect', payload: { aDevice: pc, aPort: 'eth0', bDevice: sw, bPort: 'port2' } });
  d({ type: 'infra.setIp', payload: { id: srv, ip: '192.168.10.10', mask: 24 } }); d({ type: 'infra.setIp', payload: { id: pc, ip: '192.168.10.21', mask: 24 } });
  d({ type: 'infra.setItsmServer', payload: { id: srv } });
  d({ type: 'itsm.addUser', payload: { name: 'Alice Martin' } }); d({ type: 'itsm.addUser', payload: { name: 'David Petit', roles: ['user', 'technician'] } });
  const user = (n: string) => Object.values(store.getState().management.users).find(u => u.name.startsWith(n))!.id;
  return { sch, store, d, ids: { sw, srv, pc }, alice: user('Alice'), david: user('David'), advance: (ms: number) => advance(store, sch, ms) };
}
const tk = (s: Store) => Object.values(s.getState().management.tickets);

describe('Priorité', () => {
  it('matrice impact × urgence', () => {
    expect(priorityOf('high', 'high')).toBe(1); expect(priorityOf('high', 'medium')).toBe(2); expect(priorityOf('medium', 'high')).toBe(2);
    expect(priorityOf('medium', 'medium')).toBe(3); expect(priorityOf('low', 'low')).toBe(4); expect(priorityOf('low', 'high')).toBe(3);
    expect(priorityOf('high')).toBeUndefined(); expect(PRIORITY_LABEL[1]).toContain('P1');
  });
});

describe('Tickets — création', () => {
  it('crée un incident avec une référence lisible, statut « nouveau »', () => {
    const { store, d, alice } = lab();
    d({ type: 'itsm.createTicket', payload: { title: 'Plus de réseau', requester: alice } });
    d({ type: 'itsm.createTicket', payload: { kind: 'request', title: 'Nouveau clavier', requester: alice } });
    expect(tk(store).map(t => [t.ref, t.status])).toEqual([['INC-0001', 'new'], ['REQ-0001', 'new']]);
  });
  it('refuse sans titre, sans demandeur ou avec un actif inconnu', () => {
    const { store, alice } = lab();
    expect(store.dispatch({ type: 'itsm.createTicket', payload: { title: ' ', requester: alice } }).error?.code).toBe('bad_title');
    expect(store.dispatch({ type: 'itsm.createTicket', payload: { title: 'x', requester: 'nope' } }).error?.code).toBe('user_not_found');
    expect(store.dispatch({ type: 'itsm.createTicket', payload: { title: 'x', requester: alice, assetIds: ['ast-999'] } }).error?.code).toBe('asset_not_found');
    expect(tk(store)).toHaveLength(0);
  });
});

describe('Tickets — workflow', () => {
  const make = () => { const l = lab(); l.d({ type: 'itsm.createTicket', payload: { title: 'Panne', requester: l.alice } }); const id = tk(l.store)[0]!.id; return { ...l, id, go: (to: string) => l.store.dispatch({ type: 'itsm.transitionTicket', payload: { id, to } }) }; };
  it('qualification : exige catégorie, impact et urgence', () => {
    const { go, d, id } = make();
    expect(go('qualified').error?.code).toBe('guard_failed');
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau', impact: 'high' } } });
    expect(go('qualified').error?.message).toContain('urgence');
    d({ type: 'itsm.updateTicket', payload: { id, fields: { urgency: 'medium' } } });
    expect(go('qualified').ok).toBe(true);
  });
  it('on ne saute pas d\'étape', () => {
    const { go } = make();
    expect(go('resolved').error?.code).toBe('bad_transition'); expect(go('closed').error?.code).toBe('bad_transition');
  });
  it('l\'assigné doit être technicien', () => {
    const { store, d, id, alice, david, go } = make();
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau', impact: 'low', urgency: 'low' } } }); go('qualified');
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { assignee: alice } } }).error?.code).toBe('not_technician');
    expect(go('assigned').error?.message).toContain('technicien');
    d({ type: 'itsm.updateTicket', payload: { id, fields: { assignee: david } } });
    expect(go('assigned').ok).toBe(true);
  });
  it('résoudre exige une solution ; rouvrir est possible ; clos = figé', () => {
    const { store, d, id, david, go } = make();
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Matériel', impact: 'medium', urgency: 'medium', assignee: david } } });
    expect(go('qualified').ok && go('assigned').ok && go('in_progress').ok).toBe(true);
    expect(go('resolved').error?.message).toContain('solution');
    d({ type: 'itsm.updateTicket', payload: { id, fields: { solution: 'Remplacement du câble' } } });
    expect(go('resolved').ok).toBe(true); expect(store.getState().management.tickets[id]!.resolvedAt).toBeDefined();
    expect(go('in_progress').ok).toBe(true); expect(store.getState().management.tickets[id]!.resolvedAt).toBeUndefined();
    go('resolved'); expect(go('closed').ok).toBe(true);
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { title: 'x' } } }).error?.code).toBe('ticket_closed');
    expect(store.dispatch({ type: 'itsm.addComment', payload: { id, text: 'merci' } }).ok).toBe(true);
  });
  it('catégorie / sous-catégorie cohérentes', () => {
    const { store, d, id } = make();
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Inconnue' } } }).error?.code).toBe('bad_category');
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau' } } });
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { subcategory: 'Imprimante' } } }).error?.code).toBe('bad_subcategory');
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { subcategory: 'Wi-Fi' } } }).ok).toBe(true);
  });
  it('chaque statut a au moins une sortie sauf « clos »', () => {
    for (const s of ['new', 'qualified', 'assigned', 'in_progress', 'pending', 'resolved'] as const) expect(transitionsFrom(s).length).toBeGreaterThan(0);
    expect(transitionsFrom('closed')).toHaveLength(0); expect(TRANSITIONS.length).toBe(8);
  });
});

describe('Tickets — liens et état', () => {
  it('lier / délier un actif ; doublon refusé', () => {
    const { store, d, ids, alice, advance } = lab();
    d({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } }); void advance;
    const a = assetForDevice(store.getState(), ids.pc)!;
    d({ type: 'itsm.createTicket', payload: { title: 'x', requester: alice } }); const id = tk(store)[0]!.id;
    d({ type: 'itsm.linkAsset', payload: { id, asset: a.id } });
    expect(store.dispatch({ type: 'itsm.linkAsset', payload: { id, asset: a.id } }).error?.code).toBe('already_linked');
    d({ type: 'itsm.unlinkAsset', payload: { id, asset: a.id } }); expect(tk(store)[0]!.assetIds).toEqual([]);
  });
  it('un état ancien sans tickets est normalisé à la restauration', () => {
    const { store } = lab(); const snap = store.snapshot(); delete (snap.state.management as { tickets?: unknown }).tickets;
    store.restore(snap); expect(store.getState().management.tickets).toEqual({});
  });
  it('snapshot / restore : reset exact des tickets', () => {
    const { store, d, alice } = lab(); const snap = store.snapshot();
    d({ type: 'itsm.createTicket', payload: { title: 'x', requester: alice } }); expect(tk(store)).toHaveLength(1);
    store.restore(snap); expect(tk(store)).toHaveLength(0);
  });
});

describe('Scénario « PC déconnecté » (TP 16)', () => {
  it('de la panne réseau à la clôture documentée', () => {
    const { store, d, ids, alice, david, advance } = lab();
    d({ type: 'agent.install', payload: { id: ids.pc } }); advance(10 * 60_000);
    const a = assetForDevice(store.getState(), ids.pc)!; expect(a.observed).toBeDefined();

    const link = Object.values(store.getState().reality.links).find(l => l.a.device === ids.pc || l.b.device === ids.pc)!;
    d({ type: 'infra.disconnect', payload: { link: link.id } });
    expect(store.getState().reality.devices[ids.pc]!.online).toBe(false);
    d({ type: 'itsm.createTicket', payload: { title: 'Mon PC n\'a plus Internet', requester: alice, assetIds: [a.id] } });
    const id = tk(store)[0]!.id; const go = (to: string) => d({ type: 'itsm.transitionTicket', payload: { id, to } });
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau', subcategory: 'Poste sans réseau', impact: 'low', urgency: 'medium', assignee: david } } });
    go('qualified'); go('assigned'); go('in_progress');

    d({ type: 'infra.connect', payload: { aDevice: ids.pc, aPort: 'eth0', bDevice: ids.sw, bPort: 'port2' } });
    expect(store.getState().reality.devices[ids.pc]!.online).toBe(true);
    d({ type: 'itsm.updateTicket', payload: { id, fields: { solution: 'Câble réseau rebranché sur le port 2 du switch.' } } });
    go('resolved'); advance(DAY); go('closed');

    const t = store.getState().management.tickets[id]!;
    expect(t.status).toBe('closed'); expect(t.assetIds).toEqual([a.id]); expect(priorityOf(t.impact, t.urgency)).toBe(4);
    const kinds = store.getLog().filter(e => e.subject.id === id).map(e => e.type);
    expect(kinds.filter(k => k === 'TicketStatusChanged')).toHaveLength(5);
  });
});
