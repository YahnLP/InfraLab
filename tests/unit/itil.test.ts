import { HOUR, MINUTE, Scheduler, Store } from '../../src/core';
import { registerInfraCommands } from '../../src/infra';
import { registerInventoryCommands } from '../../src/inventory';
import { SLA_TARGETS, fmtDuration, registerItsmCommands, slaOf } from '../../src/itsm';

function lab() {
  const sch = new Scheduler(); const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store);
  const d = (c: Parameters<Store['dispatch']>[0]) => { const r = store.dispatch(c); if (!r.ok) throw r.error; return r; };
  d({ type: 'itsm.addUser', payload: { name: 'Alice' } }); d({ type: 'itsm.addUser', payload: { name: 'David', roles: ['user', 'technician'] } }); d({ type: 'itsm.addUser', payload: { name: 'Éric', roles: ['user', 'manager'] } });
  const u = (n: string) => Object.values(store.getState().management.users).find(x => x.name === n)!.id;
  const mk = (title = 'Panne') => { d({ type: 'itsm.createTicket', payload: { title, requester: u('Alice') } }); return Object.values(store.getState().management.tickets).at(-1)!.id; };
  const tk = (id: string) => store.getState().management.tickets[id]!;
  const go = (id: string, to: string) => d({ type: 'itsm.transitionTicket', payload: { id, to } });
  const take = (id: string, impact: string, urgency: string) => { d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau', impact, urgency, assignee: u('David') } } }); go(id, 'qualified'); go(id, 'assigned'); };
  return { sch, store, d, u, mk, tk, go, take };
}

describe('SLA', () => {
  it('pas de SLA sans priorité ; cibles selon la priorité', () => {
    const { store, mk, tk, d } = lab(); const id = mk();
    expect(slaOf(tk(id), 0)).toBeUndefined();
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau', impact: 'high', urgency: 'high' } } });
    expect(slaOf(tk(id), 0)!.resolve.target).toBe(SLA_TARGETS[1].resolve); void store;
  });
  it('l\'horloge court avec le temps simulé : à risque puis dépassé', () => {
    const { sch, mk, tk, d } = lab(); const id = mk();
    d({ type: 'itsm.updateTicket', payload: { id, fields: { category: 'Réseau', impact: 'high', urgency: 'high' } } });
    expect(slaOf(tk(id), 10 * MINUTE)!.respond.state).toBe('running');
    expect(slaOf(tk(id), 13 * MINUTE)!.respond.state).toBe('at_risk');
    expect(slaOf(tk(id), 20 * MINUTE)!.respond.state).toBe('breached'); expect(slaOf(tk(id), 3 * HOUR + 30 * MINUTE)!.resolve.state).toBe('at_risk'); void sch;
  });
  it('la prise en charge à temps respecte la réactivité ; la résolution fige l\'horloge', () => {
    const { sch, mk, tk, d, go, take } = lab(); const id = mk(); d({ type: 'itsm.updateTicket', payload: { id, fields: { solution: 'ok' } } });
    take(id, 'high', 'high'); sch.now = 10 * MINUTE; go(id, 'in_progress');
    expect(slaOf(tk(id), 5 * HOUR)!.respond.state).toBe('met');
    sch.now = 2 * HOUR; go(id, 'resolved'); const s = slaOf(tk(id), 9 * HOUR)!;
    expect(s.resolve.state).toBe('met'); expect(s.resolve.elapsed).toBe(2 * HOUR);
  });
  it('« en attente » suspend l\'horloge', () => {
    const { sch, mk, tk, d, go, take } = lab(); const id = mk(); d({ type: 'itsm.updateTicket', payload: { id, fields: { solution: 'ok' } } });
    take(id, 'medium', 'high'); sch.now = HOUR; go(id, 'in_progress'); go(id, 'pending');
    expect(slaOf(tk(id), 5 * HOUR)!.resolve.state).toBe('paused');
    sch.now = 5 * HOUR; go(id, 'in_progress');
    expect(slaOf(tk(id), 5 * HOUR)!.resolve.elapsed).toBe(HOUR); // 4 h d'attente non comptées
    expect(fmtDuration(-90 * MINUTE)).toBe('−1 h 30');
  });
});

describe('Problèmes', () => {
  it('regroupement, analyse, erreur connue, résolution : prérequis expliqués', () => {
    const { store, d, mk, tk } = lab(); const a = mk('A'), b = mk('B');
    d({ type: 'itsm.createProblem', payload: { title: 'Switch défaillant' } }); const pid = Object.keys(store.getState().management.problems)[0]!;
    const go = (to: string) => store.dispatch({ type: 'itsm.transitionProblem', payload: { id: pid, to } });
    expect(go('analysis').error?.code).toBe('guard_failed');
    d({ type: 'itsm.linkTicketToProblem', payload: { problem: pid, ticket: a } }); d({ type: 'itsm.linkTicketToProblem', payload: { problem: pid, ticket: b } });
    expect(tk(a).problemId).toBe(pid); expect(store.dispatch({ type: 'itsm.linkTicketToProblem', payload: { problem: pid, ticket: a } }).error?.code).toBe('already_linked');
    expect(go('analysis').ok).toBe(true);
    expect(go('known_error').error?.message).toContain('cause racine');
    d({ type: 'itsm.updateProblem', payload: { id: pid, fields: { rootCause: 'Alimentation du switch' } } }); expect(go('known_error').error?.message).toContain('contournement');
    d({ type: 'itsm.updateProblem', payload: { id: pid, fields: { workaround: 'Brancher sur le switch de secours' } } }); expect(go('known_error').ok).toBe(true);
    expect(go('resolved').error?.message).toContain('définitive');
    d({ type: 'itsm.updateProblem', payload: { id: pid, fields: { permanentFix: 'Remplacer le switch' } } }); expect(go('resolved').ok && go('closed').ok).toBe(true);
    expect(store.getState().management.problems[pid]!.ref).toBe('PRB-0001');
  });
});

describe('Changements', () => {
  const mkc = (type = 'normal') => { const l = lab(); l.d({ type: 'itsm.createChange', payload: { title: 'Remplacement SW02', type } }); const id = Object.keys(l.store.getState().management.changes)[0]!; return { ...l, id, go: (to: string) => l.store.dispatch({ type: 'itsm.transitionChange', payload: { id, to } }), upd: (fields: Record<string, unknown>) => l.d({ type: 'itsm.updateChange', payload: { id, fields } }) }; };
  it('un changement normal exige risque, plan, retour arrière, approbateur responsable et vérification', () => {
    const { store, go, upd, id, u } = mkc();
    expect(go('proposed').error?.message).toContain('risque'); upd({ risk: 'medium' }); expect(go('proposed').error?.message).toContain('plan');
    upd({ plan: 'Éteindre, remplacer, rallumer' }); expect(go('proposed').error?.message).toContain('retour arrière');
    upd({ rollback: 'Remettre l\'ancien switch' }); expect(go('proposed').ok).toBe(true);
    expect(go('approved').error?.message).toContain('approbateur'); upd({ approver: u('David') }); expect(go('approved').error?.message).toContain('responsable');
    upd({ approver: u('Éric') }); expect(go('approved').ok).toBe(true);
    expect(go('scheduled').error?.message).toContain('date'); upd({ scheduledAt: 3600000 }); expect(go('scheduled').ok).toBe(true);
    expect(go('closed').error?.code).toBe('bad_transition'); expect(go('implemented').ok).toBe(true);
    expect(go('verified').error?.message).toContain('résultat'); upd({ result: 'Postes en ligne' }); expect(go('verified').ok && go('closed').ok).toBe(true);
    expect(store.getState().management.changes[id]!.ref).toBe('CHG-0001');
  });
  it('un changement standard est pré-approuvé ; un changement urgent peut se réaliser sans planification', () => {
    const s = mkc('standard'); s.upd({ risk: 'low', plan: 'p', rollback: 'r' }); s.go('proposed');
    expect(s.go('approved').error?.code).toBe('bad_transition'); s.upd({ scheduledAt: 1 }); expect(s.go('scheduled').ok).toBe(true);
    const e = mkc('emergency'); e.upd({ risk: 'high', plan: 'p', rollback: 'r', approver: e.u('Éric') }); e.go('proposed'); e.go('approved'); expect(e.go('implemented').ok).toBe(true);
    const n = mkc(); n.upd({ risk: 'low', plan: 'p', rollback: 'r', approver: n.u('Éric') }); n.go('proposed'); n.go('approved'); expect(n.go('implemented').error?.code).toBe('bad_transition');
  });
  it('refus puis reprise en brouillon', () => {
    const { go, upd } = mkc(); upd({ risk: 'low', plan: 'p', rollback: 'r' }); go('proposed'); expect(go('rejected').ok && go('draft').ok).toBe(true);
  });
});

describe('Base de connaissances', () => {
  it('article rédigé depuis un ticket résolu, publié, puis réutilisé sur un autre ticket', () => {
    const { store, d, mk, tk, take, go } = lab(); const a = mk('Plus de réseau'), b = mk('Plus de réseau bis');
    d({ type: 'itsm.updateTicket', payload: { id: a, fields: { solution: 'Rebrancher le câble' } } }); take(a, 'low', 'low'); go(a, 'in_progress'); go(a, 'resolved');
    d({ type: 'itsm.createArticle', payload: { ticket: a } }); const kid = Object.keys(store.getState().management.articles)[0]!;
    const art = () => store.getState().management.articles[kid]!;
    expect(art()).toMatchObject({ ref: 'KB-0001', status: 'draft', category: 'Réseau', solution: 'Rebrancher le câble', sourceTicketId: a });
    expect(store.dispatch({ type: 'itsm.linkArticle', payload: { article: kid, ticket: b } }).error?.code).toBe('not_published');
    expect(store.dispatch({ type: 'itsm.publishArticle', payload: { id: kid } }).error?.code).toBe('incomplete');
    d({ type: 'itsm.updateArticle', payload: { id: kid, fields: { symptoms: 'Plus d\'accès réseau', cause: 'Câble débranché' } } });
    d({ type: 'itsm.publishArticle', payload: { id: kid } }); d({ type: 'itsm.linkArticle', payload: { article: kid, ticket: b } });
    expect(tk(b).articleIds).toEqual([kid]);
  });
  it('un état ancien sans ITIL est normalisé', () => {
    const { store } = lab(); const snap = store.snapshot(); for (const k of ['problems', 'changes', 'articles']) delete (snap.state.management as unknown as Record<string, unknown>)[k];
    store.restore(snap); expect(store.getState().management.changes).toEqual({});
  });
});
