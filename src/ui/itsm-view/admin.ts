import { PERMISSIONS, can, permissionsOf, type State } from '../../core';
import { isOpen } from '../../itsm';
import { h } from '../kit/dom';
import type { Ctx } from './tickets';

const note = (title: string, ...kids: (string | Node)[]) => h('aside', { class: 'realworld' }, h('strong', null, title), ' ', ...kids);
export const actorName = (st: Readonly<State>, id?: string | null) => (id && st.management.users[id]?.name) || null;

/** Bandeau affiché quand l'identité courante n'a pas le droit de lire la page. */
export function denied(st: Readonly<State>, perm: string, what: string): HTMLElement | null {
  if (can(st, perm)) return null;
  const me = actorName(st, st.actingAs) ?? '';
  return h('section', null, h('h1', null, what), h('div', { class: 'callout warn' }, h('strong', null, 'Accès refusé. '), `${me} n'a pas le droit « ${PERMISSIONS.find(p => p.id === perm)?.label ?? perm} ». Changez d'identité (« Agir en tant que », en haut) pour consulter cette page.`));
}

export function usersPage(c: Ctx): HTMLElement {
  const { st } = c; const roles = Object.values(st.management.roles); const users = Object.values(st.management.users);
  const name = h('input', { type: 'text', placeholder: 'Prénom Nom', 'aria-label': 'Nom' }); const svc = h('input', { type: 'text', placeholder: 'Service', 'aria-label': 'Service' });
  const newRoles = new Set<string>(['user']);
  const roleBoxes = (sel: Set<string>) => roles.map(r => h('label', { class: 'chk', title: r.description ?? '' }, h('input', { type: 'checkbox', checked: sel.has(r.id), 'aria-label': r.name, onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? sel.add(r.id) : sel.delete(r.id); } }), ' ', r.name));
  const row = (u: State['management']['users'][string]) => {
    const sel = new Set(u.roles); const open = Object.values(st.management.tickets).filter(t => t.assignee === u.id && isOpen(t)).length;
    return h('tr', { class: u.disabled ? 'off' : '' },
      h('td', null, h('b', null, u.name), u.disabled ? h('span', { class: 'pill off' }, 'Désactivé') : null, st.actingAs === u.id ? h('span', { class: 'pill on' }, 'Vous') : null),
      h('td', null, u.service ?? '—'),
      h('td', null, h('div', { class: 'chks' }, ...roleBoxes(sel)), h('button', { onclick: () => c.host.dispatch({ type: 'itsm.setUserRoles', payload: { id: u.id, roles: [...sel] } }) }, 'Enregistrer les rôles')),
      h('td', null, open ? h('span', { class: 'pill warn', title: 'Tickets ouverts attribués à ce compte' }, `${open} ticket(s) ouvert(s)`) : '—'),
      h('td', null, h('button', { onclick: () => c.host.dispatch({ type: 'itsm.setUserActive', payload: { id: u.id, active: !!u.disabled } }) }, u.disabled ? 'Réactiver' : 'Désactiver')));
  };
  return denied(st, 'admin.users', 'Utilisateurs') ?? h('section', null, h('h1', null, 'Utilisateurs'),
    users.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Nom', 'Service', 'Rôles', 'Charge', 'Compte'].map(t => h('th', null, t)))), h('tbody', null, ...users.map(row))) : h('p', { class: 'empty' }, 'Aucun utilisateur.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.addUser', payload: { name: name.value, service: svc.value, roles: [...newRoles] } }); } },
      h('label', { class: 'fld' }, h('span', null, 'Nouvel utilisateur'), name), h('label', { class: 'fld' }, h('span', null, 'Service'), svc), h('div', { class: 'chks' }, ...roleBoxes(newRoles)), h('button', { type: 'submit' }, 'Créer le compte')),
    note('Dans les outils réels', 'on désactive un compte plutôt que de le supprimer : l\'historique garde l\'auteur de chaque action. Les rôles se donnent selon le poste, avec le moins de droits possible (moindre privilège).'));
}

export function rolesPage(c: Ctx): HTMLElement {
  const { st } = c; const roles = Object.values(st.management.roles); const name = h('input', { type: 'text', placeholder: 'Nom du rôle', 'aria-label': 'Nom du rôle' });
  const groups = [...new Set(PERMISSIONS.map(p => p.group))];
  const holders = (rid: string) => Object.values(st.management.users).filter(u => u.roles.includes(rid) && !u.disabled).length;
  const cell = (r: State['management']['roles'][string], p: { id: string; label: string }) => h('td', { class: 'ctr' }, h('input', { type: 'checkbox', checked: r.permissions.includes(p.id), 'aria-label': `${r.name} : ${p.label}`,
    onchange: (e: Event) => { const el = e.target as HTMLInputElement; if (!c.host.dispatch({ type: 'itsm.setRolePermission', payload: { role: r.id, permission: p.id, granted: el.checked } })) el.checked = !el.checked; } }));
  return denied(st, 'admin.roles', 'Rôles et droits') ?? h('section', null, h('h1', null, 'Rôles et droits'),
    h('p', { class: 'muted' }, 'Un droit se donne à un rôle, un rôle à une personne. Cochez pour accorder, décochez pour retirer : l\'effet est immédiat.'),
    h('table', { class: 'grid matrix' }, h('thead', null, h('tr', null, h('th', null, 'Droit'), ...roles.map(r => h('th', { title: r.description ?? '' }, r.name, h('small', { class: 'muted' }, ` (${holders(r.id)})`))))),
      h('tbody', null, ...groups.flatMap(g => [
        h('tr', { class: 'grp' }, h('th', { colspan: String(roles.length + 1) }, g)),
        ...PERMISSIONS.filter(p => p.group === g).map(p => h('tr', null, h('td', null, p.label), ...roles.map(r => cell(r, p)))),
      ]))),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.createRole', payload: { name: name.value, permissions: ['ticket.create'] } }); } }, h('label', { class: 'fld' }, h('span', null, 'Nouveau rôle'), name), h('button', { type: 'submit' }, 'Créer le rôle')),
    note('Dans les outils réels', 'rôles ITIL de ServiceNow, profils de GLPI, groupes de Jira Service Management. Une revue périodique des droits (qui a quoi, est-ce encore justifié ?) est un contrôle d\'audit courant.'));
}

/** Utile aux autres pages : droits de l'identité courante. */
export const myPerms = (st: Readonly<State>) => st.actingAs ? permissionsOf(st, st.actingAs) : null;
