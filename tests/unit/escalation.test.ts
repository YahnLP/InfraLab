import { HOUR, Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { escalationAdvice, registerItsmCommands } from '../../src/itsm';
import { registerScenarioCommands } from '../../src/scenarios';
import { seedNovatechFull } from '../../src/scenarios/novatech-full';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);
  seedNovatechFull(store, c => { expect(store.dispatch(c).ok).toBe(true); return true; });
  const u = (n: string) => Object.values(store.getState().management.users).find(x => x.name.startsWith(n))!.id;
  const d = (type: string, payload: Record<string, unknown> = {}, actorId?: string) => store.dispatch({ type, payload, ...(actorId ? { actorId } : {}) });
  const ticket = (impact: string, urgency: string, to = 'in_progress') => {
    expect(d('itsm.createTicket', { title: 'Panne', requester: u('Alice'), kind: 'incident' }).ok).toBe(true);
    const t = Object.values(store.getState().management.tickets).at(-1)!;
    expect(d('itsm.updateTicket', { id: t.id, fields: { category: 'Réseau', impact, urgency, assignee: u('David') } }).ok).toBe(true);
    for (const s of ['qualified', 'assigned', 'in_progress', ...(to === 'qualified' ? [] : [])].slice(0, to === 'qualified' ? 1 : 3)) expect(d('itsm.transitionTicket', { id: t.id, to: s }).ok).toBe(true);
    return t.id;
  };
  return { sch, store, u, d, ticket };
}
const REASON = 'Poste et compte vérifiés sans résultat, il faut un expert serveur.';

describe('Escalade fonctionnelle', () => {
  it('monte d\'un niveau, retire l\'assigné, aiguille vers le groupe et trace l\'événement', () => {
    const { store, d, ticket, u } = lab(); const id = ticket('medium', 'high');
    expect(d('itsm.createGroup', { name: 'Support N2', members: [u('David')], roles: ['technician'] }).ok).toBe(true);
    const g = Object.values(store.getState().management.groups).find(x => x.name === 'Support N2')!;
    expect(d('itsm.escalate', { id, kind: 'functional', reason: REASON, group: g.id }).ok).toBe(true);
    const t = store.getState().management.tickets[id]!;
    expect(t.level).toBe(2); expect(t.assignee).toBeUndefined(); expect(t.status).toBe('qualified'); expect(t.groupId).toBe(g.id); expect(t.escalations).toHaveLength(1);
    expect(store.getLog().some(e => e.type === 'TicketEscalated' && e.payload['toLevel'] === 2)).toBe(true);
  });
  it('exige un motif, un ticket qualifié, et s\'arrête au niveau 3', () => {
    const { store, d, ticket } = lab(); const id = ticket('medium', 'high');
    expect(d('itsm.escalate', { id, kind: 'functional', reason: 'trop bref' }).error?.code).toBe('reason_required');
    expect(d('itsm.escalate', { id, kind: 'functional', reason: REASON }).ok).toBe(true);
    for (const s of ['assigned']) { d('itsm.updateTicket', { id, fields: { assignee: Object.values(store.getState().management.users).find(x => x.name.startsWith('David'))!.id } }); expect(d('itsm.transitionTicket', { id, to: s }).ok).toBe(true); }
    expect(d('itsm.escalate', { id, kind: 'functional', reason: REASON }).ok).toBe(true);
    expect(store.getState().management.tickets[id]!.level).toBe(3);
    d('itsm.updateTicket', { id, fields: { assignee: Object.values(store.getState().management.users).find(x => x.name.startsWith('David'))!.id } }); d('itsm.transitionTicket', { id, to: 'assigned' });
    expect(d('itsm.escalate', { id, kind: 'functional', reason: REASON }).error?.code).toBe('max_level');
    expect(d('itsm.createTicket', { title: 'x', requester: Object.keys(store.getState().management.users)[0], kind: 'incident' }).ok).toBe(true);
    const nw = Object.values(store.getState().management.tickets).at(-1)!.id;
    expect(d('itsm.escalate', { id: nw, kind: 'functional', reason: REASON }).error?.code).toBe('not_escalable');
  });
  it('reprend l\'horloge du SLA si le ticket était en attente', () => {
    const { sch, store, d, ticket } = lab(); const id = ticket('medium', 'high');
    expect(d('itsm.transitionTicket', { id, to: 'pending' }).ok).toBe(true); sch.now += 2 * HOUR;
    expect(d('itsm.escalate', { id, kind: 'functional', reason: REASON }).ok).toBe(true);
    const t = store.getState().management.tickets[id]!; expect(t.pausedSince).toBeUndefined(); expect(t.pausedMs).toBe(2 * HOUR);
  });
});

describe('Escalade hiérarchique', () => {
  it('se justifie par une priorité 1-2 ou un SLA menacé, pas pour un P4 tranquille', () => {
    const { sch, store, d, ticket } = lab(); const low = ticket('low', 'low'); const high = ticket('high', 'high');
    expect(d('itsm.escalate', { id: low, kind: 'hierarchical', reason: REASON }).error?.code).toBe('not_justified');
    expect(d('itsm.escalate', { id: high, kind: 'hierarchical', reason: REASON }).ok).toBe(true);
    const t = store.getState().management.tickets[high]!; expect(t.managerAlerted).toBe(true); expect(t.level ?? 1).toBe(1); expect(t.assignee).toBeDefined();
    expect(d('itsm.escalate', { id: high, kind: 'hierarchical', reason: REASON }).error?.code).toBe('already_alerted');
    sch.now += 70 * HOUR; // P4 : cible 72 h, à risque après 54 h
    expect(d('itsm.escalate', { id: low, kind: 'hierarchical', reason: REASON }).ok).toBe(true);
  });
  it('le conseil suit l\'état du SLA', () => {
    const { sch, store, ticket } = lab(); const id = ticket('medium', 'high'); const cal = 'continuous' as const;
    expect(escalationAdvice(store.getState().management.tickets[id]!, sch.now, cal)).toBeNull();
    expect(escalationAdvice(store.getState().management.tickets[id]!, sch.now + 7 * HOUR, cal)).toMatch(/à risque/);
    expect(escalationAdvice(store.getState().management.tickets[id]!, sch.now + 9 * HOUR, cal)).toMatch(/dépassé/);
  });
});

describe('Droits', () => {
  it('seul un technicien escalade ; l\'utilisateur est refusé, avec le droit nommé', () => {
    const { d, ticket, u } = lab(); const id = ticket('medium', 'high');
    expect(d('itsm.actAs', { user: u('Bruno') }).ok).toBe(true);
    const r = d('itsm.escalate', { id, kind: 'functional', reason: REASON }); expect(r.ok).toBe(false); expect(r.error?.message).toMatch(/Escalader un ticket/);
  });
  it('une ancienne sauvegarde redonne le droit aux techniciens, une nouvelle respecte le retrait', () => {
    const { store } = lab(); const snap = store.snapshot();
    const old = structuredClone(snap) as typeof snap; delete (old.state.management.settings as { escalation?: true }).escalation; old.state.management.roles['technician']!.permissions = old.state.management.roles['technician']!.permissions.filter(p => p !== 'ticket.escalate');
    const s2 = new Store(); s2.restore(old); expect(s2.getState().management.roles['technician']!.permissions).toContain('ticket.escalate');
    const cur = structuredClone(snap) as typeof snap; cur.state.management.roles['technician']!.permissions = cur.state.management.roles['technician']!.permissions.filter(p => p !== 'ticket.escalate');
    const s3 = new Store(); s3.restore(cur); expect(s3.getState().management.roles['technician']!.permissions).not.toContain('ticket.escalate');
  });
});
