import { PERMISSIONS, can, permissionsOf, type State } from '../../core';
import { SLA_CALENDAR_LABEL, SLA_TARGETS, fmtDuration, isOpen, type SlaCalendar } from '../../itsm';
import { h } from '../kit/dom';
import { fmtTime } from '../shell/labels';
import type { Ctx } from './tickets';

const note = (title: string, ...kids: (string | Node)[]) => h('aside', { class: 'realworld' }, h('strong', null, title), ' ', ...kids);
export const actorName = (st: Readonly<State>, id?: string | null) => (id && st.management.users[id]?.name) || null;

/** Bandeau affiché quand l'identité courante n'a pas le droit de lire la page. */
export function denied(st: Readonly<State>, perm: string, what: string, now?: number): HTMLElement | null {
  if (can(st, perm, now)) return null;
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
  return denied(st, 'admin.users', 'Utilisateurs', c.host.now()) ?? h('section', null, h('h1', null, 'Utilisateurs'),
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
  return denied(st, 'admin.roles', 'Rôles et droits', c.host.now()) ?? h('section', null, h('h1', null, 'Rôles et droits'),
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

export function settingsPage(c: Ctx): HTMLElement {
  const { st } = c; const cur = st.management.settings.slaCalendar;
  const radios = (Object.keys(SLA_CALENDAR_LABEL) as SlaCalendar[]).map(k => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'cal', checked: cur === k, onchange: () => c.host.dispatch({ type: 'itsm.setSlaCalendar', payload: { calendar: k } }) }), ` ${SLA_CALENDAR_LABEL[k]}`));
  return denied(st, 'admin.settings', 'Paramètres', c.host.now()) ?? h('section', null, h('h1', null, 'Paramètres'),
    h('h2', null, 'Calendrier des SLA'),
    h('p', null, 'Les délais des SLA se comptent soit en continu (la nuit et le week-end comptent), soit en heures ouvrées (lundi–vendredi, 8 h–18 h : seules ces heures consomment le délai). Le jour 1 du simulateur est un lundi, à 08:00.'),
    h('div', { class: 'chks', role: 'radiogroup', 'aria-label': 'Calendrier des SLA' }, ...radios),
    h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Priorité', 'Prise en charge', 'Résolution'].map(t => h('th', null, t)))),
      h('tbody', null, ...([1, 2, 3, 4] as const).map(p => h('tr', null, h('td', null, `P${p}`), h('td', null, fmtDuration(SLA_TARGETS[p].respond)), h('td', null, fmtDuration(SLA_TARGETS[p].resolve)))))),
    note('Dans les outils réels', 'chaque SLA est rattaché à un calendrier de service (24/7 pour une astreinte, heures ouvrées pour un support standard) : un ticket ouvert le vendredi à 17 h 30 n\'a pas le même délai de fin selon le calendrier.'));
}

export function groupsPage(c: Ctx): HTMLElement {
  const { st } = c; const now = c.host.now();
  const groups = Object.values(st.management.groups); const roles = Object.values(st.management.roles);
  const users = Object.values(st.management.users).filter(u => !u.disabled);
  const uname = (id: string) => st.management.users[id]?.name ?? id;
  const rname = (id: string) => st.management.roles[id]?.name ?? id;
  const boxes = <T extends { id: string; name: string }>(list: T[], sel: Set<string>) => list.map(x => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: sel.has(x.id), 'aria-label': x.name, onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? sel.add(x.id) : sel.delete(x.id); } }), ' ', x.name));
  const card = (g: State['management']['groups'][string]) => {
    const mem = new Set(g.members), rl = new Set(g.roles); const queue = Object.values(st.management.tickets).filter(t => t.groupId === g.id && isOpen(t)).length;
    return h('article', { class: 'card' }, h('h3', null, g.name, h('small', { class: 'muted' }, ` · ${g.members.length} membre(s) · ${queue} ticket(s) ouvert(s) dans la file`)),
      h('p', { class: 'muted' }, 'Rôles donnés à tous les membres :'), h('div', { class: 'chks' }, ...boxes(roles, rl)),
      h('button', { onclick: () => c.host.dispatch({ type: 'itsm.setGroupRoles', payload: { id: g.id, roles: [...rl] } }) }, 'Enregistrer les rôles du groupe'),
      h('p', { class: 'muted' }, 'Membres :'), h('div', { class: 'chks' }, ...boxes(users, mem)),
      h('button', { onclick: () => c.host.dispatch({ type: 'itsm.setGroupMembers', payload: { id: g.id, members: [...mem] } }) }, 'Enregistrer les membres'));
  };
  const gname = h('input', { type: 'text', placeholder: 'Nom du groupe', 'aria-label': 'Nom du groupe' });
  const opt = (v: string, l: string) => h('option', { value: v }, l);
  const from = h('select', { 'aria-label': 'Qui prête son rôle' }, ...users.map(u => opt(u.id, u.name)));
  const to = h('select', { 'aria-label': 'Qui reçoit le rôle' }, ...users.map(u => opt(u.id, u.name)));
  const role = h('select', { 'aria-label': 'Rôle prêté' }, ...roles.filter(r => r.id !== 'admin').map(r => opt(r.id, r.name)));
  const hours = h('select', { 'aria-label': 'Durée de la délégation' }, opt('8', '8 heures'), opt('24', '1 jour'), opt('72', '3 jours'), opt('168', '1 semaine'));
  const dels = Object.values(st.management.delegations);
  const state = (d: State['management']['delegations'][string]) => d.revoked ? 'retirée' : now >= d.endAt ? 'expirée' : now < d.startAt ? 'à venir' : 'en cours';
  return denied(st, 'admin.groups', 'Groupes et délégations', now) ?? h('section', null, h('h1', null, 'Groupes et délégations'),
    h('p', { class: 'muted' }, 'Un groupe rassemble des personnes qui reçoivent ensemble les mêmes rôles : on gère l\'équipe, pas chaque compte. Un ticket peut être aiguillé vers la file d\'un groupe avant d\'être confié à une personne.'),
    groups.length ? h('div', { class: 'cards' }, ...groups.map(card)) : h('p', { class: 'empty' }, 'Aucun groupe.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.createGroup', payload: { name: gname.value, roles: [] } }); } }, h('label', { class: 'fld' }, h('span', null, 'Nouveau groupe'), gname), h('button', { type: 'submit' }, 'Créer le groupe')),
    h('h2', null, 'Délégations (absences, congés)'),
    h('p', { class: 'muted' }, `Heure simulée : ${fmtTime(now)}. Une délégation prête un rôle pour une durée limitée : elle prend fin toute seule quand l'horloge dépasse son échéance, sans que personne ait à penser à retirer le droit.`),
    dels.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['De', 'Vers', 'Rôle', 'Jusqu\'à', 'État', ''].map(t => h('th', null, t)))),
      h('tbody', null, ...dels.map(d => h('tr', null, h('td', null, uname(d.from)), h('td', null, uname(d.to)), h('td', null, rname(d.role)), h('td', null, fmtTime(d.endAt)), h('td', null, h('span', { class: `pill ${state(d) === 'en cours' ? 'warn' : 'off'}` }, state(d))),
        h('td', null, state(d) === 'en cours' || state(d) === 'à venir' ? h('button', { onclick: () => c.host.dispatch({ type: 'itsm.revokeDelegation', payload: { id: d.id } }) }, 'Retirer') : null))))) : h('p', { class: 'empty' }, 'Aucune délégation.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.delegate', payload: { from: from.value, to: to.value, role: role.value, hours: Number(hours.value) } }); } },
      h('label', { class: 'fld' }, h('span', null, 'De'), from), h('label', { class: 'fld' }, h('span', null, 'Vers'), to), h('label', { class: 'fld' }, h('span', null, 'Rôle'), role), h('label', { class: 'fld' }, h('span', null, 'Pendant'), hours), h('button', { type: 'submit' }, 'Déléguer')),
    note('Dans les outils réels', 'groupes d\'assignation de ServiceNow, équipes de Jira Service Management, groupes de GLPI ; la délégation correspond au « remplaçant » ou à la substitution temporaire. Elle a toujours une date de fin et reste tracée.'));
}
