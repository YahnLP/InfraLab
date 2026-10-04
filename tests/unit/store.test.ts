import { CommandError, Scheduler, Store, nextId, type DomainEvent } from '../../src/core';

function makeStore() {
  const sch = new Scheduler();
  const store = new Store({ clock: () => sch.now });
  store.registerCommand('infra.addDevice', (ctx, p) => {
    const id = nextId(ctx.state.counters, 'dev');
    ctx.state.reality.devices[id] = {
      id, name: String(p.name), kind: 'workstation', powered: true, online: false, ports: [], pos: { x: 0, y: 0 },
      nics: [], software: [], agent: { state: 'none', intervalMs: 0, errors: [], logs: [] },
    };
    ctx.emit('DeviceAdded', { kind: 'device', id }, { name: p.name });
  });
  store.registerCommand('infra.powerOff', (ctx, p) => {
    const d = ctx.state.reality.devices[String(p.id)];
    if (!d) throw new CommandError('not_found', 'équipement inconnu');
    d.powered = false;
    ctx.emit('DevicePoweredOff', { kind: 'device', id: d.id });
    ctx.emit('DeviceOffline', { kind: 'device', id: d.id });
  });
  store.registerCommand('itsm.markStale', (ctx, p) => {
    ctx.emit('AssetStale', { kind: 'device', id: String(p.id) });
  });
  return { sch, store };
}

describe('Store', () => {
  it('une commande modifie l\'état et publie des événements', () => {
    const { store } = makeStore();
    const r = store.dispatch({ type: 'infra.addDevice', payload: { name: 'PC01' } });
    expect(r.ok).toBe(true);
    expect(store.getState().reality.devices['dev-001']?.name).toBe('PC01');
    expect(r.events.map(e => e.type)).toEqual(['DeviceAdded']);
  });

  it('une précondition échouée laisse l\'état intact (rollback)', () => {
    const { store } = makeStore();
    const before = JSON.stringify(store.getState());
    const r = store.dispatch({ type: 'infra.powerOff', payload: { id: 'dev-999' } });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('not_found');
    expect(JSON.stringify(store.getState())).toBe(before);
    expect(store.getLog()).toHaveLength(0);
  });

  it('commande inconnue → refus propre', () => {
    const { store } = makeStore();
    expect(store.dispatch({ type: 'nope' }).error?.code).toBe('unknown_command');
  });

  it('les réacteurs enchaînent des commandes et la chaîne causale est reconstituable', () => {
    const { store } = makeStore();
    store.registerReactor('DeviceOffline', e => [{ type: 'itsm.markStale', payload: { id: e.subject.id } }]);
    store.dispatch({ type: 'infra.addDevice', payload: { name: 'PC01' } });
    store.dispatch({ type: 'infra.powerOff', payload: { id: 'dev-001' } });
    const stale = store.getLog().find(e => e.type === 'AssetStale')!;
    const chain = store.trace(stale.id).map(e => e.type);
    expect(chain).toEqual(['DevicePoweredOff', 'DeviceOffline', 'AssetStale']);
  });

  it('un réacteur bouclant est borné (pas de boucle infinie)', () => {
    const { store } = makeStore();
    store.registerReactor('AssetStale', e => [{ type: 'itsm.markStale', payload: { id: e.subject.id } }]);
    const r = store.dispatch({ type: 'itsm.markStale', payload: { id: 'dev-001' } });
    expect(r.ok).toBe(true);
    expect(r.events.length).toBeLessThanOrEqual(20);
  });

  it('notifie les abonnés une seule fois par dispatch', () => {
    const { store } = makeStore();
    const seen: DomainEvent[][] = [];
    store.subscribe(ev => seen.push(ev));
    store.registerReactor('DeviceOffline', e => [{ type: 'itsm.markStale', payload: { id: e.subject.id } }]);
    store.dispatch({ type: 'infra.addDevice', payload: { name: 'PC01' } });
    store.dispatch({ type: 'infra.powerOff', payload: { id: 'dev-001' } });
    expect(seen).toHaveLength(2);
    expect(seen[1]!.map(e => e.type)).toEqual(['DevicePoweredOff', 'DeviceOffline', 'AssetStale']);
  });

  it('snapshot / restore redonne exactement l\'état initial (base du reset de TP)', () => {
    const { store } = makeStore();
    store.dispatch({ type: 'infra.addDevice', payload: { name: 'PC01' } });
    const snap = store.snapshot();
    store.dispatch({ type: 'infra.powerOff', payload: { id: 'dev-001' } });
    store.dispatch({ type: 'infra.addDevice', payload: { name: 'PC02' } });
    store.restore(snap);
    expect(store.snapshot()).toEqual(snap);
    expect(store.getState().reality.devices['dev-001']?.powered).toBe(true);
    expect(store.getState().reality.devices['dev-002']).toBeUndefined();
  });

  it('est déterministe : mêmes commandes, même état et mêmes événements', () => {
    const run = () => {
      const { store } = makeStore();
      store.dispatch({ type: 'infra.addDevice', payload: { name: 'A' } });
      store.dispatch({ type: 'infra.powerOff', payload: { id: 'dev-001' } });
      return JSON.stringify(store.snapshot());
    };
    expect(run()).toBe(run());
  });
});
