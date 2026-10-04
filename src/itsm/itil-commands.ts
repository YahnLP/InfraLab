import { CommandError, nextId, type Article, type Change, type ChangeType, type Level, type Problem, type State, type Store } from '../core';
import { TEV } from './events';
import { CHANGE_TRANSITIONS, PROBLEM_TRANSITIONS } from './itil';

const LEVELS: Level[] = ['low', 'medium', 'high'];
type Ctx = { state: State; now: number };
const ref = (ctx: Ctx, key: string, prefix: string) => `${prefix}-${String((ctx.state.counters[key] = (ctx.state.counters[key] ?? 0) + 1)).padStart(4, '0')}`;
const str = (v: unknown) => String(v ?? '');

export function registerItilCommands(store: Store): void {
  const problem = (ctx: Ctx, p: Record<string, unknown>, key = 'id'): Problem => { const x = ctx.state.management.problems[str(p[key])]; if (!x) throw new CommandError('problem_not_found', 'Problème inconnu'); return x; };
  const change = (ctx: Ctx, p: Record<string, unknown>): Change => { const x = ctx.state.management.changes[str(p['id'])]; if (!x) throw new CommandError('change_not_found', 'Changement inconnu'); return x; };
  const article = (ctx: Ctx, p: Record<string, unknown>, key = 'id'): Article => { const x = ctx.state.management.articles[str(p[key])]; if (!x) throw new CommandError('article_not_found', 'Article inconnu'); return x; };
  const ticket = (ctx: Ctx, id: unknown) => { const t = ctx.state.management.tickets[str(id)]; if (!t) throw new CommandError('ticket_not_found', 'Ticket inconnu'); return t; };
  const assets = (ctx: Ctx, ids: unknown): string[] => { const l = [...new Set((ids as string[] | undefined) ?? [])]; for (const a of l) if (!ctx.state.management.assets[a]) throw new CommandError('asset_not_found', 'Actif inconnu'); return l; };

  /* ---------------- Problèmes ---------------- */
  store.registerCommand('itsm.createProblem', (ctx, p) => {
    const title = str(p['title']).trim(); if (!title) throw new CommandError('bad_title', 'Le titre est obligatoire');
    const tickets = (p['tickets'] as string[] | undefined) ?? []; tickets.forEach(t => ticket(ctx, t));
    const id = nextId(ctx.state.counters, 'prb'); const r = ref(ctx, 'problem', 'PRB');
    ctx.state.management.problems[id] = { id, ref: r, title, description: str(p['description']).trim(), status: 'new', ticketIds: [...new Set(tickets)], assetIds: [], createdAt: ctx.now, updatedAt: ctx.now };
    for (const t of tickets) ticket(ctx, t).problemId = id;
    ctx.emit(TEV.ProblemCreated, { kind: 'problem', id }, { ref: r, title });
  });
  store.registerCommand('itsm.updateProblem', (ctx, p) => {
    const x = problem(ctx, p); const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    if (x.status === 'closed') throw new CommandError('problem_closed', 'Un problème clos n\'est plus modifiable');
    for (const k of ['title', 'description', 'rootCause', 'workaround', 'permanentFix'] as const) if (f[k] !== undefined && str(f[k]) !== (x[k] ?? '')) { x[k] = str(f[k]); changed.push(k); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    x.updatedAt = ctx.now; ctx.emit(TEV.ProblemUpdated, { kind: 'problem', id: x.id }, { fields: changed });
  });
  store.registerCommand('itsm.linkTicketToProblem', (ctx, p) => {
    const x = problem(ctx, p, 'problem'); const t = ticket(ctx, p['ticket']);
    if (x.status === 'closed') throw new CommandError('problem_closed', 'Un problème clos n\'est plus modifiable');
    if (t.problemId) throw new CommandError('already_linked', t.problemId === x.id ? 'Ticket déjà rattaché' : 'Ticket déjà rattaché à un autre problème');
    t.problemId = x.id; x.ticketIds.push(t.id); x.updatedAt = ctx.now; ctx.emit(TEV.TicketLinkedToProblem, { kind: 'problem', id: x.id }, { ticket: t.id });
  });
  store.registerCommand('itsm.unlinkTicketFromProblem', (ctx, p) => {
    const x = problem(ctx, p, 'problem'); const t = ticket(ctx, p['ticket']); if (t.problemId !== x.id) throw new CommandError('not_linked', 'Ticket non rattaché');
    delete t.problemId; x.ticketIds = x.ticketIds.filter(i => i !== t.id); x.updatedAt = ctx.now; ctx.emit(TEV.TicketUnlinkedFromProblem, { kind: 'problem', id: x.id }, { ticket: t.id });
  });
  store.registerCommand('itsm.transitionProblem', (ctx, p) => {
    const x = problem(ctx, p); const tr = PROBLEM_TRANSITIONS.find(t => t.from === x.status && t.to === str(p['to']));
    if (!tr) throw new CommandError('bad_transition', `Passage impossible : ${x.status} → ${str(p['to'])}`);
    const b = tr.guard?.(x); if (b) throw new CommandError('guard_failed', b);
    const from = x.status; x.status = tr.to; x.updatedAt = ctx.now; ctx.emit(TEV.ProblemStatusChanged, { kind: 'problem', id: x.id }, { from, to: tr.to });
  });

  /* ---------------- Changements ---------------- */
  store.registerCommand('itsm.createChange', (ctx, p) => {
    const title = str(p['title']).trim(); if (!title) throw new CommandError('bad_title', 'Le titre est obligatoire');
    const type = (['standard', 'normal', 'emergency'].includes(str(p['type'])) ? str(p['type']) : 'normal') as ChangeType;
    const aids = assets(ctx, p['assetIds']); const prb = p['problem'] ? problem(ctx, p, 'problem') : undefined;
    const id = nextId(ctx.state.counters, 'chg'); const r = ref(ctx, 'change', 'CHG');
    ctx.state.management.changes[id] = { id, ref: r, title, description: str(p['description']).trim(), type, status: 'draft', assetIds: aids, ...((ctx.actorId ?? (p['requestedBy'] ? str(p['requestedBy']) : undefined)) ? { requestedBy: (ctx.actorId ?? str(p['requestedBy'])) } : {}), ...(prb ? { problemId: prb.id } : {}), createdAt: ctx.now, updatedAt: ctx.now };
    ctx.emit(TEV.ChangeCreated, { kind: 'change', id }, { ref: r, title, type });
  });
  store.registerCommand('itsm.updateChange', (ctx, p) => {
    const c = change(ctx, p); const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    if (c.status === 'closed') throw new CommandError('change_closed', 'Un changement clos n\'est plus modifiable');
    for (const k of ['title', 'description', 'plan', 'rollback', 'result'] as const) if (f[k] !== undefined && str(f[k]) !== (c[k] ?? '')) { c[k] = str(f[k]); changed.push(k); }
    if (f['type'] !== undefined && f['type'] !== c.type) { if (!['standard', 'normal', 'emergency'].includes(str(f['type']))) throw new CommandError('bad_type', 'Type inconnu'); c.type = f['type'] as ChangeType; changed.push('type'); }
    if (f['risk'] !== undefined && f['risk'] !== (c.risk ?? '')) { const v = str(f['risk']); if (v && !LEVELS.includes(v as Level)) throw new CommandError('bad_level', 'Niveau inconnu'); if (v) c.risk = v as Level; else delete c.risk; changed.push('risk'); }
    if (f['approver'] !== undefined && f['approver'] !== (c.approver ?? '')) { const v = str(f['approver']); if (v && !ctx.state.management.users[v]) throw new CommandError('user_not_found', 'Utilisateur inconnu'); if (v) c.approver = v; else delete c.approver; changed.push('approver'); }
    if (f['scheduledAt'] !== undefined && f['scheduledAt'] !== (c.scheduledAt ?? null)) { if (f['scheduledAt'] === null) delete c.scheduledAt; else c.scheduledAt = Number(f['scheduledAt']); changed.push('scheduledAt'); }
    if (f['assetIds'] !== undefined) { c.assetIds = assets(ctx, f['assetIds']); changed.push('assetIds'); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    c.updatedAt = ctx.now; ctx.emit(TEV.ChangeUpdated, { kind: 'change', id: c.id }, { fields: changed });
  });
  store.registerCommand('itsm.transitionChange', (ctx, p) => {
    const c = change(ctx, p); const tr = CHANGE_TRANSITIONS.find(t => t.from === c.status && t.to === str(p['to']) && (!t.types || t.types.includes(c.type)));
    if (!tr) throw new CommandError('bad_transition', `Passage impossible : ${c.status} → ${str(p['to'])}`);
    const b = tr.guard?.(c, ctx.state); if (b) throw new CommandError('guard_failed', b);
    const from = c.status; c.status = tr.to; c.updatedAt = ctx.now; if (tr.to === 'implemented') c.implementedAt = ctx.now;
    ctx.emit(TEV.ChangeStatusChanged, { kind: 'change', id: c.id }, { from, to: tr.to });
  });

  /* ---------------- Base de connaissances ---------------- */
  store.registerCommand('itsm.createArticle', (ctx, p) => {
    const src = p['ticket'] ? ticket(ctx, p['ticket']) : undefined;
    const title = str(p['title'] ?? src?.title).trim(); if (!title) throw new CommandError('bad_title', 'Le titre est obligatoire');
    const id = nextId(ctx.state.counters, 'kb'); const r = ref(ctx, 'article', 'KB');
    ctx.state.management.articles[id] = {
      id, ref: r, title, ...(src?.category ? { category: src.category } : {}), symptoms: str(p['symptoms'] ?? src?.description), cause: str(p['cause']), solution: str(p['solution'] ?? src?.solution),
      status: 'draft', ...(src ? { sourceTicketId: src.id } : {}), createdAt: ctx.now, updatedAt: ctx.now,
    };
    ctx.emit(TEV.ArticleCreated, { kind: 'article', id }, { ref: r, title });
  });
  store.registerCommand('itsm.updateArticle', (ctx, p) => {
    const a = article(ctx, p); const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    for (const k of ['title', 'category', 'symptoms', 'cause', 'solution'] as const) if (f[k] !== undefined && str(f[k]) !== (a[k] ?? '')) { if (k === 'category' && !str(f[k])) delete a.category; else a[k] = str(f[k]); changed.push(k); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    a.updatedAt = ctx.now; ctx.emit(TEV.ArticleUpdated, { kind: 'article', id: a.id }, { fields: changed });
  });
  store.registerCommand('itsm.publishArticle', (ctx, p) => {
    const a = article(ctx, p); if (a.status === 'published') throw new CommandError('already', 'Article déjà publié');
    if (!a.symptoms.trim() || !a.solution.trim()) throw new CommandError('incomplete', 'Un article publié décrit au moins les symptômes et la solution.');
    a.status = 'published'; a.updatedAt = ctx.now; ctx.emit(TEV.ArticlePublished, { kind: 'article', id: a.id }, { ref: a.ref });
  });
  store.registerCommand('itsm.linkArticle', (ctx, p) => {
    const a = article(ctx, p, 'article'); const t = ticket(ctx, p['ticket']);
    if (a.status !== 'published') throw new CommandError('not_published', 'Seul un article publié peut être associé à un ticket');
    if (t.articleIds?.includes(a.id)) throw new CommandError('already_linked', 'Article déjà associé');
    (t.articleIds ??= []).push(a.id); t.updatedAt = ctx.now; ctx.emit(TEV.ArticleLinked, { kind: 'ticket', id: t.id }, { article: a.id });
  });
}
