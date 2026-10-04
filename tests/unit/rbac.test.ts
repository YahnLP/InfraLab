import { Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { registerItsmCommands } from '../../src/itsm';
import { registerScenarioCommands, seedNovatech } from '../../src/scenarios';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);
  seedNovatech(store, c => { const r = store.dispatch(c); if (!r.ok) throw r.error; return true; });
  const u = (n: string) => Object.values(store.getState().management.users).find(x => x.name.startsWith(n))!.id;
  const as = (n: string | null) => store.dispatch({ type: 'itsm.actAs', payload: { user: n ? u(n) : null } });
  return { store, u, as };
}

describe('RBAC', () => {
  it('sans identité (mode formateur), tout est permis', () => {
    const { store, u } = lab();
    expect(store.dispatch({ type: 'itsm.createTicket', payload: { title: 'x', requester: u('Alice') } }).ok).toBe(true);
  });
  it('un utilisateur simple ouvre un ticket mais ne le qualifie pas, et le refus nomme le droit manquant', () => {
    const { store, u, as } = lab(); as('Alice');
    const c = store.dispatch({ type: 'itsm.createTicket', payload: { title: 'PC lent', requester: u('Alice') } }); expect(c.ok).toBe(true);
    expect(c.events[0]!.actorId).toBe(u('Alice'));
    const id = Object.keys(store.getState().management.tickets)[0]!;
    const r = store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau' } } });
    expect(r.ok).toBe(false); expect(r.error?.code).toBe('forbidden'); expect(r.error?.message).toContain('Qualifier'); expect(r.error?.message).toContain('Utilisateur');
  });
  it('un technicien qualifie, mais n\'approuve pas un changement', () => {
    const { store, u, as } = lab(); as('David');
    store.dispatch({ type: 'itsm.createTicket', payload: { title: 'x', requester: u('Alice') } });
    const id = Object.keys(store.getState().management.tickets)[0]!;
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau' } } }).ok).toBe(true);
    store.dispatch({ type: 'itsm.createChange', payload: { title: 'c', type: 'normal' } });
    const cid = Object.keys(store.getState().management.changes)[0]!;
    expect(store.getState().management.changes[cid]!.requestedBy).toBe(u('David'));
    expect(store.dispatch({ type: 'itsm.transitionChange', payload: { id: cid, to: 'approved' } }).error?.code).toBe('forbidden');
  });
  it('séparation des tâches : un responsable n\'approuve pas son propre changement', () => {
    const { store, u, as } = lab(); as('Éric');
    store.dispatch({ type: 'itsm.updateChange', payload: { id: 'x', fields: {} } }); // inconnu : ignoré
    const s = store.getState() as unknown as { management: { changes: Record<string, unknown> } };
    s.management.changes['chg-1'] = { id: 'chg-1', ref: 'CHG-0001', title: 't', description: '', type: 'normal', status: 'proposed', assetIds: [], requestedBy: u('Éric'), createdAt: 0, updatedAt: 0 };
    const r = store.dispatch({ type: 'itsm.transitionChange', payload: { id: 'chg-1', to: 'approved' } });
    expect(r.error?.message).toContain('Séparation des tâches');
  });
  it('un administrateur gère les comptes mais pas les tickets', () => {
    const { store, u, as } = lab(); as('Léa');
    expect(store.dispatch({ type: 'itsm.addUser', payload: { name: 'Karim Benali' } }).ok).toBe(true);
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id: 'x', fields: { category: 'Réseau' } } }).error?.code).toBe('forbidden');
    const k = Object.values(store.getState().management.users).find(x => x.name === 'Karim Benali')!;
    expect(store.dispatch({ type: 'itsm.setUserRoles', payload: { id: k.id, roles: ['user', 'technician'] } }).ok).toBe(true);
    expect(store.getState().management.users[k.id]!.roles).toEqual(['user', 'technician']);
    void u;
  });
  it('compte désactivé : ne peut plus être incarné ni recevoir un ticket ; le dernier admin est protégé', () => {
    const { store, u, as } = lab();
    expect(store.dispatch({ type: 'itsm.setUserActive', payload: { id: u('David'), active: false } }).ok).toBe(true);
    expect(as('David').error?.code).toBe('disabled');
    expect(store.dispatch({ type: 'itsm.setUserActive', payload: { id: u('Léa'), active: false } }).error?.code).toBe('last_admin');
    expect(store.dispatch({ type: 'itsm.setUserRoles', payload: { id: u('Léa'), roles: ['user'] } }).error?.code).toBe('last_admin');
    expect(store.dispatch({ type: 'itsm.setRolePermission', payload: { role: 'admin', permission: 'admin.roles', granted: false } }).error?.code).toBe('last_admin');
  });
  it('les droits d\'un rôle sont modifiables et appliqués aussitôt', () => {
    const { store, u, as } = lab(); as('Alice');
    expect(store.dispatch({ type: 'itsm.addSupplier', payload: { name: 'X' } }).ok).toBe(false);
    as(null); store.dispatch({ type: 'itsm.setRolePermission', payload: { role: 'user', permission: 'itam.manage', granted: true } }); as('Alice');
    expect(store.dispatch({ type: 'itsm.addSupplier', payload: { name: 'X' } }).ok).toBe(true);
    void u;
  });
  it('une ancienne sauvegarde sans rôles est normalisée', () => {
    const { store } = lab(); const snap = store.snapshot() as unknown as { state: { management: { roles?: unknown }; actingAs?: unknown } };
    delete snap.state.management.roles; delete snap.state.actingAs;
    store.restore(snap as never); expect(Object.keys(store.getState().management.roles)).toContain('technician'); expect(store.getState().actingAs).toBeNull();
  });
});
