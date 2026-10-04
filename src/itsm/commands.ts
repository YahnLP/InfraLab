import { CommandError, nextId, type Store } from '../core';
import { IEV } from '../inventory/events';

/** Commandes de gestion (couche `management`). M2 : utilisateurs et saisie des données déclarées. */
export function registerItsmCommands(store: Store): void {
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
    if (f['status'] !== undefined && f['status'] !== a.status) { a.status = f['status'] as typeof a.status; changed.push('status'); }
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
}
