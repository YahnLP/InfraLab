import { DAY, HOUR, Scheduler, Store, rolesOf, permissionsOf } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { businessMs, isBusinessTime, registerItsmCommands, slaOf } from '../../src/itsm';
import { SCENARIOS, advanceTime, registerScenarioCommands, runSteps, startScenario } from '../../src/scenarios';
import { seedNovatechFull } from '../../src/scenarios/novatech-full';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);
  return { sch, store };
}
const ok = (r: { ok: boolean; error?: { message: string } }) => { expect(r.error?.message).toBeUndefined(); expect(r.ok).toBe(true); };

describe('Calendrier ouvré', () => {
  it('compte les heures lun–ven 8 h–18 h et ignore nuits et week-ends', () => {
    expect(isBusinessTime(0)).toBe(true); expect(isBusinessTime(10 * HOUR)).toBe(false); expect(isBusinessTime(5 * DAY + HOUR)).toBe(false);
    expect(businessMs(4 * DAY + 9 * HOUR, 7 * DAY - HOUR)).toBe(HOUR); // vendredi 17 h → lundi 7 h
    expect(businessMs(0, 7 * DAY)).toBe(50 * HOUR);
  });
  it('un même ticket est dépassé en continu, mais pas en heures ouvrées', () => {
    const t = { createdAt: 4 * DAY + 9 * HOUR, impact: 'medium', urgency: 'medium' } as never;
    const now = 7 * DAY - HOUR;
    expect(slaOf(t, now, 'continuous')!.resolve.state).toBe('breached'); expect(slaOf(t, now, 'business')!.resolve.state).toBe('running');
  });
  it('le paramètre se règle par commande et se refuse sans le droit', () => {
    const { store } = lab(); seedNovatechFull(store, c => { ok(store.dispatch(c)); return true; });
    ok(store.dispatch({ type: 'itsm.setSlaCalendar', payload: { calendar: 'business' } }));
    expect(store.getState().management.settings.slaCalendar).toBe('business');
    expect(store.dispatch({ type: 'itsm.setSlaCalendar', payload: { calendar: 'business' } }).ok).toBe(false);
    const u = (n: string) => Object.values(store.getState().management.users).find(x => x.name.startsWith(n))!.id;
    ok(store.dispatch({ type: 'itsm.actAs', payload: { user: u('David') } }));
    expect(store.dispatch({ type: 'itsm.setSlaCalendar', payload: { calendar: 'continuous' } }).error?.code).toBe('forbidden');
  });
});

describe('Chronologie des TP', () => {
  it('les événements se déclenchent à leur heure, une seule fois, et seulement quand le temps passe', () => {
    const { sch, store } = lab(); const sc = SCENARIOS.find(s => s.number === 42)!; startScenario(store, sch, sc);
    const n = () => Object.keys(store.getState().management.tickets).length;
    expect(n()).toBe(1);
    expect(advanceTime(store, sch, 15 * 60_000)).toEqual([]); expect(n()).toBe(1);
    const msgs = advanceTime(store, sch, 20 * 60_000); expect(msgs.length).toBe(1); expect(n()).toBe(2);
    expect(advanceTime(store, sch, 5 * HOUR).length).toBe(1); expect(n()).toBe(3); expect(advanceTime(store, sch, DAY)).toEqual([]); expect(n()).toBe(3);
  });
  it('un ticket arrivé en cours de TP a bien l\'heure de son événement, pas celle du dernier clic', () => {
    const { sch, store } = lab(); const sc = SCENARIOS.find(s => s.number === 42)!; startScenario(store, sch, sc);
    advanceTime(store, sch, 2 * HOUR); const t2 = Object.values(store.getState().management.tickets).find(t => t.ref === 'INC-0002')!;
    expect(t2.createdAt).toBe(30 * 60_000);
  });
});

describe('Machine virtuelle et hyperviseur', () => {
  it('la VM suit son hôte : arrêt, reprise, détachement', () => {
    const { store } = lab(); seedNovatechFull(store, c => { ok(store.dispatch(c)); return true; });
    const d = (n: string) => Object.values(store.getState().reality.devices).find(x => x.name === n)!;
    const hv = d('HV-DC-01'), vm = d('VM-RH01'); expect(vm.hostId).toBe(hv.id); expect(vm.online).toBe(true);
    ok(store.dispatch({ type: 'infra.powerOff', payload: { id: hv.id } }));
    expect(d('VM-RH01').online).toBe(false); expect(d('VM-WEB01').online).toBe(false);
    ok(store.dispatch({ type: 'infra.powerOn', payload: { id: hv.id } })); expect(d('VM-RH01').online).toBe(true);
    ok(store.dispatch({ type: 'infra.powerOff', payload: { id: hv.id } })); ok(store.dispatch({ type: 'infra.setHost', payload: { id: vm.id, host: null } })); expect(d('VM-RH01').online).toBe(true);
  });
  it('refuse un hôte qui n\'est pas un hyperviseur, ou une machine qui n\'est pas une VM', () => {
    const { store } = lab(); seedNovatechFull(store, c => { ok(store.dispatch(c)); return true; });
    const d = (n: string) => Object.values(store.getState().reality.devices).find(x => x.name === n)!;
    expect(store.dispatch({ type: 'infra.setHost', payload: { id: d('VM-RH01').id, host: d('SRV-FACT').id } }).error?.code).toBe('not_hypervisor');
    expect(store.dispatch({ type: 'infra.setHost', payload: { id: d('SRV-FACT').id, host: d('HV-DC-01').id } }).error?.code).toBe('not_vm');
  });
});

describe('Groupes et délégations', () => {
  const setup = () => {
    const { sch, store } = lab(); seedNovatechFull(store, c => { ok(store.dispatch(c)); return true; });
    const u = (n: string) => Object.values(store.getState().management.users).find(x => x.name.startsWith(n))!.id;
    ok(store.dispatch({ type: 'itsm.addUser', payload: { name: 'Karim Benali', service: 'Informatique', roles: ['user'] } }));
    return { sch, store, u };
  };
  it('un groupe donne ses rôles à ses membres, sans toucher à leur compte', () => {
    const { store, u } = setup(); const k = u('Karim');
    ok(store.dispatch({ type: 'itsm.createGroup', payload: { name: 'Support N1', roles: ['technician'], members: [k] } }));
    const st = store.getState(); expect(rolesOf(st, k).has('technician')).toBe(true); expect(st.management.users[k]!.roles).toEqual(['user']);
    expect(permissionsOf(st, k).has('ticket.work')).toBe(true);
    ok(store.dispatch({ type: 'itsm.setGroupMembers', payload: { id: Object.keys(st.management.groups)[0], members: [] } })); expect(rolesOf(store.getState(), k).has('technician')).toBe(false);
  });
  it('refuse un nom en double, un rôle inconnu et un membre inconnu', () => {
    const { store, u } = setup();
    ok(store.dispatch({ type: 'itsm.createGroup', payload: { name: 'N1', roles: ['technician'], members: [u('Karim')] } }));
    expect(store.dispatch({ type: 'itsm.createGroup', payload: { name: 'n1' } }).error?.code).toBe('duplicate');
    expect(store.dispatch({ type: 'itsm.createGroup', payload: { name: 'X', roles: ['nope'] } }).error?.code).toBe('role_not_found');
    expect(store.dispatch({ type: 'itsm.createGroup', payload: { name: 'Y', members: ['usr-999'] } }).error?.code).toBe('user_not_found');
  });
  it('on n\'assigne un ticket qu\'à un technicien, y compris par groupe', () => {
    const { store, u } = setup(); const k = u('Karim');
    ok(store.dispatch({ type: 'itsm.createTicket', payload: { title: 't', requester: u('Alice'), kind: 'incident' } }));
    const id = Object.keys(store.getState().management.tickets)[0]!;
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { assignee: k } } }).error?.code).toBe('not_technician');
    ok(store.dispatch({ type: 'itsm.createGroup', payload: { name: 'N1', roles: ['technician'], members: [k] } }));
    ok(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { assignee: k } } }));
  });
  it('une délégation prête un rôle pour une durée, puis expire seule', () => {
    const { sch, store, u } = setup(); const k = u('Karim'), dv = u('David');
    ok(store.dispatch({ type: 'itsm.delegate', payload: { from: dv, to: k, role: 'technician', hours: 24 } }));
    expect(rolesOf(store.getState(), k, sch.now).has('technician')).toBe(true); expect(rolesOf(store.getState(), k).has('technician')).toBe(false);
    sch.now = 23 * HOUR; expect(rolesOf(store.getState(), k, sch.now).has('technician')).toBe(true);
    sch.now = 24 * HOUR; expect(rolesOf(store.getState(), k, sch.now).has('technician')).toBe(false);
  });
  it('contrôles de la délégation : détenir le rôle, pas d\'administrateur, durée bornée, retrait', () => {
    const { sch, store, u } = setup(); const k = u('Karim'), dv = u('David'), lea = u('Léa');
    expect(store.dispatch({ type: 'itsm.delegate', payload: { from: k, to: dv, role: 'technician', hours: 8 } }).error?.code).toBe('not_holder');
    expect(store.dispatch({ type: 'itsm.delegate', payload: { from: lea, to: k, role: 'admin', hours: 8 } }).error?.code).toBe('no_admin_delegation');
    expect(store.dispatch({ type: 'itsm.delegate', payload: { from: dv, to: k, role: 'technician', hours: 0 } }).error?.code).toBe('bad_duration');
    expect(store.dispatch({ type: 'itsm.delegate', payload: { from: dv, to: dv, role: 'technician', hours: 8 } }).error?.code).toBe('same_user');
    ok(store.dispatch({ type: 'itsm.delegate', payload: { from: dv, to: k, role: 'technician', hours: 8 } }));
    const id = Object.keys(store.getState().management.delegations)[0]!;
    ok(store.dispatch({ type: 'itsm.revokeDelegation', payload: { id } })); expect(rolesOf(store.getState(), k, sch.now).has('technician')).toBe(false);
    expect(store.dispatch({ type: 'itsm.revokeDelegation', payload: { id } }).ok).toBe(false);
  });
  it('le garde-fou RBAC tient compte de la délégation à l\'heure courante', () => {
    const { sch, store, u } = setup(); const k = u('Karim'), dv = u('David');
    ok(store.dispatch({ type: 'itsm.createTicket', payload: { title: 't', requester: u('Alice'), kind: 'incident' } }));
    const id = Object.keys(store.getState().management.tickets)[0]!;
    ok(store.dispatch({ type: 'itsm.actAs', payload: { user: k } }));
    expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau' } } }).error?.code).toBe('forbidden');
    ok(store.dispatch({ type: 'itsm.actAs', payload: { user: null } }));
    ok(store.dispatch({ type: 'itsm.delegate', payload: { from: dv, to: k, role: 'technician', hours: 2 } }));
    ok(store.dispatch({ type: 'itsm.actAs', payload: { user: k } }));
    ok(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau' } } }));
    sch.now = 3 * HOUR; expect(store.dispatch({ type: 'itsm.updateTicket', payload: { id, fields: { impact: 'high' } } }).error?.code).toBe('forbidden');
  });
  it('une ancienne sauvegarde est normalisée : groupes vides, droits d\'administration ajoutés', () => {
    const { store } = setup(); const snap = store.snapshot() as unknown as { state: { management: Record<string, unknown> & { roles: Record<string, { permissions: string[] }> } } };
    delete snap.state.management['groups']; delete snap.state.management['delegations']; snap.state.management.roles['admin']!.permissions = snap.state.management.roles['admin']!.permissions.filter(p => !p.startsWith('admin.settings') && p !== 'admin.groups');
    const { store: s2 } = lab(); s2.restore(snap as never);
    const m = s2.getState().management; expect(m.groups).toEqual({}); expect(m.delegations).toEqual({}); expect(m.roles['admin']!.permissions).toEqual(expect.arrayContaining(['admin.groups', 'admin.settings']));
  });
});

describe('TP 43 : la panne arrive avec le temps', () => {
  it('rien ne se passe sans avancer l\'horloge, puis HV-01 s\'arrête et les VM le suivent', () => {
    const { sch, store } = lab(); const sc = SCENARIOS.find(s => s.number === 43)!; startScenario(store, sch, sc);
    const on = (n: string) => Object.values(store.getState().reality.devices).find(d => d.name === n)!.online;
    expect(on('HV-01')).toBe(true); expect(on('VM-APP01')).toBe(true);
    advanceTime(store, sch, 25 * 60_000); expect(on('HV-01')).toBe(false); expect(on('VM-APP01')).toBe(false); expect(on('VM-APP02')).toBe(false);
  });
});
