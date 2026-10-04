import { CommandError, PERMISSIONS, permissionsOf, type State, type Store } from '../core';
import { TEV } from './events';

const str = (v: unknown) => String(v ?? '');
/** Garde-fou anti-verrouillage : s'il existait des administrateurs, il doit en rester au moins un. */
const hadAdmin = (st: Readonly<State>) => Object.keys(st.management.users).some(id => permissionsOf(st, id).has('admin.roles'));

export function registerRbacCommands(store: Store): void {
  const user = (ctx: { state: State }, id: unknown) => { const u = ctx.state.management.users[str(id)]; if (!u) throw new CommandError('user_not_found', 'Utilisateur inconnu'); return u; };
  const keepAdmin = (ctx: { state: State }, before: boolean) => { if (before && !hadAdmin(ctx.state)) throw new CommandError('last_admin', 'Au moins un administrateur actif doit rester : sinon plus personne ne pourrait gérer les droits.'); };

  store.registerCommand('itsm.actAs', (ctx, p) => {
    const id = p['user'] ? str(p['user']) : null;
    if (id) { const u = user(ctx, id); if (u.disabled) throw new CommandError('disabled', 'Ce compte est désactivé.'); }
    if (ctx.state.actingAs === id) throw new CommandError('nothing_changed', 'Déjà dans cette identité');
    ctx.state.actingAs = id; ctx.emit(TEV.ActorChanged, id ? { kind: 'user', id } : { kind: 'scenario', id: 'trainer' }, { user: id });
  });
  store.registerCommand('itsm.setUserRoles', (ctx, p) => {
    const u = user(ctx, p['id']); const roles = [...new Set(((p['roles'] as string[] | undefined) ?? []).map(str))];
    for (const r of roles) if (!ctx.state.management.roles[r]) throw new CommandError('role_not_found', `Rôle inconnu : ${r}`);
    if (roles.length === u.roles.length && roles.every(r => u.roles.includes(r))) throw new CommandError('nothing_changed', 'Aucune modification');
    const before = hadAdmin(ctx.state); const was = u.roles; u.roles = roles; keepAdmin(ctx, before);
    ctx.emit(TEV.UserRolesChanged, { kind: 'user', id: u.id }, { from: was, to: roles });
  });
  store.registerCommand('itsm.setUserActive', (ctx, p) => {
    const u = user(ctx, p['id']); const active = p['active'] !== false;
    if (!!u.disabled === !active) throw new CommandError('nothing_changed', active ? 'Le compte est déjà actif' : 'Le compte est déjà désactivé');
    const before = hadAdmin(ctx.state);
    if (active) delete u.disabled; else { u.disabled = true; if (ctx.state.actingAs === u.id) ctx.state.actingAs = null; }
    keepAdmin(ctx, before); ctx.emit(TEV.UserActiveChanged, { kind: 'user', id: u.id }, { active });
  });
  store.registerCommand('itsm.createRole', (ctx, p) => {
    const name = str(p['name']).trim(); if (!name) throw new CommandError('bad_name', 'Le nom est obligatoire');
    const id = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id || ctx.state.management.roles[id]) throw new CommandError('duplicate', 'Un rôle porte déjà ce nom');
    const perms = [...new Set(((p['permissions'] as string[] | undefined) ?? []).map(str))];
    for (const x of perms) if (!PERMISSIONS.some(q => q.id === x)) throw new CommandError('bad_permission', `Droit inconnu : ${x}`);
    ctx.state.management.roles[id] = { id, name, ...(p['description'] ? { description: str(p['description']) } : {}), permissions: perms };
    ctx.emit(TEV.RoleCreated, { kind: 'role', id }, { name });
  });
  store.registerCommand('itsm.setRolePermission', (ctx, p) => {
    const r = ctx.state.management.roles[str(p['role'])]; if (!r) throw new CommandError('role_not_found', 'Rôle inconnu');
    const perm = str(p['permission']); if (!PERMISSIONS.some(q => q.id === perm)) throw new CommandError('bad_permission', 'Droit inconnu');
    const grant = p['granted'] !== false; if (r.permissions.includes(perm) === grant) throw new CommandError('nothing_changed', 'Aucune modification');
    const before = hadAdmin(ctx.state);
    r.permissions = grant ? [...r.permissions, perm] : r.permissions.filter(x => x !== perm); keepAdmin(ctx, before);
    ctx.emit(TEV.RolePermissionChanged, { kind: 'role', id: r.id }, { permission: perm, granted: grant });
  });
}
