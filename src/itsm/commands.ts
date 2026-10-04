import { CommandError, nextId, rolesOf, type Level, type Store, type Ticket } from '../core';
import { IEV } from '../inventory/events';
import { TEV } from './events';
import { registerItilCommands } from './itil-commands';
import { registerItamCommands } from './itam-commands';
import { businessMs } from './calendar';
import { accessGuard } from './rbac';
import { registerRbacCommands } from './rbac-commands';
import { TAXONOMY } from './taxonomy';
import { TRANSITIONS, blocker } from './workflow';

const LEVELS: Level[] = ['low', 'medium', 'high'];

/** Commandes de gestion (couche `management`). M2 : utilisateurs et saisie des données déclarées. */
export function registerItsmCommands(store: Store): void {
  registerItilCommands(store); registerItamCommands(store); registerRbacCommands(store); store.setGuard(accessGuard);
  store.registerCommand('itsm.addUser', (ctx, p) => {
    const name = String(p['name'] ?? '').trim(); if (!name) throw new CommandError('bad_name', 'Le nom est obligatoire');
    const id = nextId(ctx.state.counters, 'usr');
    ctx.state.management.users[id] = { id, name, roles: (p['roles'] as string[] | undefined) ?? ['user'], ...(p['service'] ? { service: String(p['service']) } : {}), ...(p['site'] ? { site: String(p['site']) } : {}) };
    ctx.emit(IEV.UserAdded, { kind: 'user', id }, { name });
  });
  store.registerCommand('itsm.updateAsset', (ctx, p) => {
    const a = ctx.state.management.assets[String(p['id'])]; if (!a) throw new CommandError('asset_not_found', 'Actif inconnu');
    const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    for (const k of ['inventoryNo', 'serial', 'vendor', 'model', 'service', 'name'] as const) if (f[k] !== undefined && f[k] !== a[k]) { (a as unknown as Record<string, unknown>)[k] = String(f[k]); changed.push(k); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    ctx.emit(IEV.AssetUpdated, { kind: 'asset', id: a.id }, { fields: changed, source: 'manual' });
  });
  store.registerCommand('itsm.assignAsset', (ctx, p) => {
    const a = ctx.state.management.assets[String(p['id'])]; if (!a) throw new CommandError('asset_not_found', 'Actif inconnu');
    const uid = p['user'] ? String(p['user']) : undefined;
    if (uid && !ctx.state.management.users[uid]) throw new CommandError('user_not_found', 'Utilisateur inconnu');
    if (uid) { a.assignedTo = uid; const u = ctx.state.management.users[uid]!; if (u.service) a.service = u.service; } else { delete a.assignedTo; }
    ctx.emit(IEV.AssetAssigned, { kind: 'asset', id: a.id }, { user: uid ?? null });
  });

  const ticketOf = (ctx: { state: import('../core').State }, p: Record<string, unknown>): Ticket => {
    const t = ctx.state.management.tickets[String(p['id'])]; if (!t) throw new CommandError('ticket_not_found', 'Ticket inconnu'); return t;
  };
  const touch = (t: Ticket, now: number) => { t.updatedAt = now; };

  store.registerCommand('itsm.createTicket', (ctx, p) => {
    const title = String(p['title'] ?? '').trim(); if (!title) throw new CommandError('bad_title', 'Le titre est obligatoire');
    const requester = String(p['requester'] ?? ''); if (!ctx.state.management.users[requester]) throw new CommandError('user_not_found', 'Choisissez le demandeur');
    const kind = p['kind'] === 'request' ? 'request' : 'incident';
    const assetIds = ((p['assetIds'] as string[] | undefined) ?? []);
    for (const a of assetIds) if (!ctx.state.management.assets[a]) throw new CommandError('asset_not_found', 'Actif inconnu');
    const n = (ctx.state.counters[kind] = (ctx.state.counters[kind] ?? 0) + 1);
    const id = nextId(ctx.state.counters, 'tkt'); const ref = `${kind === 'incident' ? 'INC' : 'REQ'}-${String(n).padStart(4, '0')}`;
    ctx.state.management.tickets[id] = { id, ref, kind, title, description: String(p['description'] ?? '').trim(), requester, status: 'new', assetIds: [...new Set(assetIds)], comments: [], createdAt: ctx.now, updatedAt: ctx.now };
    ctx.emit(TEV.TicketCreated, { kind: 'ticket', id }, { ref, title, requester, assetIds });
  });

  store.registerCommand('itsm.updateTicket', (ctx, p) => {
    const t = ticketOf(ctx, p); const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    if (t.status === 'closed') throw new CommandError('ticket_closed', 'Un ticket clos n\'est plus modifiable');
    for (const k of ['title', 'description'] as const) if (f[k] !== undefined && String(f[k]) !== t[k]) { t[k] = String(f[k]); changed.push(k); }
    if (f['category'] !== undefined && f['category'] !== (t.category ?? '')) {
      const c = String(f['category']); if (c && !TAXONOMY[c]) throw new CommandError('bad_category', 'Catégorie inconnue');
      if (c) t.category = c; else delete t.category; delete t.subcategory; changed.push('category');
    }
    if (f['subcategory'] !== undefined && f['subcategory'] !== (t.subcategory ?? '')) {
      const sc = String(f['subcategory']); if (sc && !(t.category && TAXONOMY[t.category]?.includes(sc))) throw new CommandError('bad_subcategory', 'Sous-catégorie incompatible avec la catégorie');
      if (sc) t.subcategory = sc; else delete t.subcategory; changed.push('subcategory');
    }
    for (const k of ['impact', 'urgency'] as const) if (f[k] !== undefined && f[k] !== (t[k] ?? '')) {
      const v = String(f[k]); if (v && !LEVELS.includes(v as Level)) throw new CommandError('bad_level', 'Niveau inconnu');
      if (v) t[k] = v as Level; else delete t[k]; changed.push(k);
    }
    if (f['assignee'] !== undefined && f['assignee'] !== (t.assignee ?? '')) {
      const a = String(f['assignee']);
      if (a) { const u = ctx.state.management.users[a]; if (!u) throw new CommandError('user_not_found', 'Utilisateur inconnu'); if (u.disabled) throw new CommandError('disabled', 'Ce compte est désactivé : on ne lui attribue plus de ticket'); if (!rolesOf(ctx.state, u.id, ctx.now).has('technician')) throw new CommandError('not_technician', 'Seul un technicien peut être assigné'); t.assignee = a; } else delete t.assignee;
      changed.push('assignee');
    }
    if (f['group'] !== undefined && f['group'] !== (t.groupId ?? '')) {
      const g = String(f['group']);
      if (g) { if (!ctx.state.management.groups[g]) throw new CommandError('group_not_found', 'Groupe inconnu'); t.groupId = g; } else delete t.groupId;
      changed.push('group');
    }
    if (f['solution'] !== undefined && String(f['solution']) !== (t.solution ?? '')) { t.solution = String(f['solution']); changed.push('solution'); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    touch(t, ctx.now); ctx.emit(TEV.TicketUpdated, { kind: 'ticket', id: t.id }, { fields: changed });
  });

  store.registerCommand('itsm.linkAsset', (ctx, p) => {
    const t = ticketOf(ctx, p); const aid = String(p['asset']); if (!ctx.state.management.assets[aid]) throw new CommandError('asset_not_found', 'Actif inconnu');
    if (t.status === 'closed') throw new CommandError('ticket_closed', 'Un ticket clos n\'est plus modifiable');
    if (t.assetIds.includes(aid)) throw new CommandError('already_linked', 'Actif déjà lié');
    t.assetIds.push(aid); touch(t, ctx.now); ctx.emit(TEV.TicketAssetLinked, { kind: 'ticket', id: t.id }, { asset: aid });
  });
  store.registerCommand('itsm.unlinkAsset', (ctx, p) => {
    const t = ticketOf(ctx, p); const aid = String(p['asset']); if (!t.assetIds.includes(aid)) throw new CommandError('not_linked', 'Actif non lié');
    if (t.status === 'closed') throw new CommandError('ticket_closed', 'Un ticket clos n\'est plus modifiable');
    t.assetIds = t.assetIds.filter(x => x !== aid); touch(t, ctx.now); ctx.emit(TEV.TicketAssetUnlinked, { kind: 'ticket', id: t.id }, { asset: aid });
  });

  store.registerCommand('itsm.addComment', (ctx, p) => {
    const t = ticketOf(ctx, p); const text = String(p['text'] ?? '').trim(); if (!text) throw new CommandError('empty_comment', 'Le commentaire est vide');
    t.comments.push({ t: ctx.now, author: ctx.actorId ?? String(p['author'] ?? ''), text }); touch(t, ctx.now);
    ctx.emit(TEV.TicketCommented, { kind: 'ticket', id: t.id }, { text });
  });

  store.registerCommand('itsm.transitionTicket', (ctx, p) => {
    const t = ticketOf(ctx, p); const to = String(p['to']);
    const tr = TRANSITIONS.find(x => x.from === t.status && x.to === to);
    if (!tr) throw new CommandError('bad_transition', `Passage impossible : ${t.status} → ${to}`);
    const b = blocker(t, tr, ctx.state, ctx.now); if (b) throw new CommandError('guard_failed', b);
    const from = t.status; t.status = tr.to; touch(t, ctx.now);
    if (tr.to === 'in_progress' && t.respondedAt === undefined) t.respondedAt = ctx.now;
    if (tr.to === 'pending') t.pausedSince = ctx.now;
    if (from === 'pending' && t.pausedSince !== undefined) { t.pausedMs = (t.pausedMs ?? 0) + (ctx.now - t.pausedSince); t.pausedBizMs = (t.pausedBizMs ?? 0) + businessMs(t.pausedSince, ctx.now); delete t.pausedSince; }
    if (tr.to === 'resolved') t.resolvedAt = ctx.now; if (tr.to === 'closed') t.closedAt = ctx.now;
    if (from === 'resolved' && tr.to === 'in_progress') delete t.resolvedAt;
    ctx.emit(TEV.TicketStatusChanged, { kind: 'ticket', id: t.id }, { from, to: tr.to });
  });
}
