import { CommandError, PERMISSIONS, nextId, permissionsOf, rolesOf, type State, type Store } from '../core';
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
  store.registerCommand('itsm.setSlaCalendar', (ctx, p) => {
    const cal = str(p['calendar']); if (cal !== 'continuous' && cal !== 'business') throw new CommandError('bad_calendar', 'Calendrier inconnu');
    if (ctx.state.management.settings.slaCalendar === cal) throw new CommandError('nothing_changed', 'Ce calendrier est déjà celui des SLA');
    const from = ctx.state.management.settings.slaCalendar; ctx.state.management.settings.slaCalendar = cal;
    ctx.emit(TEV.SettingChanged, { kind: 'scenario', id: 'settings' }, { setting: 'slaCalendar', from, to: cal });
  });
  const group = (ctx: { state: State }, id: unknown) => { const g = ctx.state.management.groups[str(id)]; if (!g) throw new CommandError('group_not_found', 'Groupe inconnu'); return g; };
  const checkRoles = (ctx: { state: State }, v: unknown) => { const roles = [...new Set(((v as string[] | undefined) ?? []).map(str))]; for (const r of roles) if (!ctx.state.management.roles[r]) throw new CommandError('role_not_found', `Rôle inconnu : ${r}`); return roles; };
  store.registerCommand('itsm.createGroup', (ctx, p) => {
    const name = str(p['name']).trim(); if (!name) throw new CommandError('bad_name', 'Le nom est obligatoire');
    if (Object.values(ctx.state.management.groups).some(g => g.name.toLowerCase() === name.toLowerCase())) throw new CommandError('duplicate', 'Un groupe porte déjà ce nom');
    const members = [...new Set(((p['members'] as string[] | undefined) ?? []).map(str))]; members.forEach(m => user(ctx, m));
    const roles = checkRoles(ctx, p['roles']); const id = nextId(ctx.state.counters, 'grp');
    ctx.state.management.groups[id] = { id, name, members, roles }; ctx.emit(TEV.GroupCreated, { kind: 'group', id }, { name });
  });
  store.registerCommand('itsm.setGroupMembers', (ctx, p) => {
    const g = group(ctx, p['id']); const members = [...new Set(((p['members'] as string[] | undefined) ?? []).map(str))]; members.forEach(m => user(ctx, m));
    if (members.length === g.members.length && members.every(m => g.members.includes(m))) throw new CommandError('nothing_changed', 'Aucune modification');
    const before = hadAdmin(ctx.state); const was = g.members; g.members = members; keepAdmin(ctx, before);
    ctx.emit(TEV.GroupChanged, { kind: 'group', id: g.id }, { members: { from: was, to: members } });
  });
  store.registerCommand('itsm.setGroupRoles', (ctx, p) => {
    const g = group(ctx, p['id']); const roles = checkRoles(ctx, p['roles']);
    if (roles.length === g.roles.length && roles.every(r => g.roles.includes(r))) throw new CommandError('nothing_changed', 'Aucune modification');
    const before = hadAdmin(ctx.state); const was = g.roles; g.roles = roles; keepAdmin(ctx, before);
    ctx.emit(TEV.GroupChanged, { kind: 'group', id: g.id }, { roles: { from: was, to: roles } });
  });
  store.registerCommand('itsm.delegate', (ctx, p) => {
    const from = user(ctx, p['from']), to = user(ctx, p['to']); const role = str(p['role']);
    if (from.id === to.id) throw new CommandError('same_user', 'On ne se délègue pas un rôle à soi-même');
    if (to.disabled) throw new CommandError('disabled', 'Ce compte est désactivé');
    if (!ctx.state.management.roles[role]) throw new CommandError('role_not_found', 'Rôle inconnu');
    if (!rolesOf(ctx.state, from.id).has(role)) throw new CommandError('not_holder', `${from.name} ne détient pas ce rôle : on ne peut déléguer que ce que l'on possède.`);
    if (role === 'admin') throw new CommandError('no_admin_delegation', 'Le rôle d\'administrateur ne se délègue pas : il se donne, de façon tracée, dans la gestion des comptes.');
    const hours = Number(p['hours']); if (!Number.isFinite(hours) || hours <= 0) throw new CommandError('bad_duration', 'Durée invalide : une délégation a toujours une fin');
    const id = nextId(ctx.state.counters, 'dlg'); const endAt = ctx.now + hours * 3600000;
    ctx.state.management.delegations[id] = { id, from: from.id, to: to.id, role, startAt: ctx.now, endAt };
    ctx.emit(TEV.DelegationGranted, { kind: 'user', id: to.id }, { from: from.id, role, until: endAt });
  });
  store.registerCommand('itsm.revokeDelegation', (ctx, p) => {
    const d = ctx.state.management.delegations[str(p['id'])]; if (!d) throw new CommandError('delegation_not_found', 'Délégation inconnue');
    if (d.revoked) throw new CommandError('nothing_changed', 'Déjà retirée'); if (d.endAt <= ctx.now) throw new CommandError('nothing_changed', 'Déjà expirée');
    d.revoked = true; ctx.emit(TEV.DelegationRevoked, { kind: 'user', id: d.to }, { role: d.role });
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
