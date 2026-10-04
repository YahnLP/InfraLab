import { PERMISSION_LABEL, permissionsOf, rolesOf, type Command, type State } from '../core';

type Need = string | ((p: Record<string, unknown>, st: Readonly<State>) => string | null);
const fieldsOf = (p: Record<string, unknown>) => (p['fields'] ?? {}) as Record<string, unknown>;

const TICKET_TO: Record<string, string> = { qualified: 'ticket.qualify', assigned: 'ticket.assign', in_progress: 'ticket.work', pending: 'ticket.work', resolved: 'ticket.work', closed: 'ticket.close' };

/** Droit exigé par chaque commande. Une commande absente de la table est libre (TP, identité, système). */
const NEEDS: Record<string, Need> = {
  'itsm.createTicket': 'ticket.create', 'itsm.addComment': 'ticket.create',
  'itsm.updateTicket': p => { const f = fieldsOf(p); return f['assignee'] !== undefined || f['group'] !== undefined ? 'ticket.assign' : f['solution'] !== undefined ? 'ticket.work' : 'ticket.qualify'; },
  'itsm.escalate': 'ticket.escalate', 'itsm.linkAsset': 'ticket.qualify', 'itsm.unlinkAsset': 'ticket.qualify',
  'itsm.transitionTicket': p => TICKET_TO[String(p['to'])] ?? 'ticket.work',
  'itsm.createProblem': 'problem.manage', 'itsm.updateProblem': 'problem.manage', 'itsm.linkTicketToProblem': 'problem.manage', 'itsm.unlinkTicketFromProblem': 'problem.manage', 'itsm.transitionProblem': 'problem.manage',
  'itsm.createChange': 'change.create', 'itsm.updateChange': 'change.create',
  'itsm.transitionChange': p => p['to'] === 'approved' || p['to'] === 'rejected' ? 'change.approve' : 'change.create',
  'itsm.createArticle': 'kb.write', 'itsm.updateArticle': 'kb.write', 'itsm.publishArticle': 'kb.write', 'itsm.linkArticle': 'ticket.work',
  'itsm.updateAsset': 'asset.edit', 'itsm.assignAsset': 'asset.edit', 'itsm.createAsset': 'asset.edit', 'itsm.updateAssetFinance': 'asset.edit', 'itsm.setAssetStatus': 'asset.lifecycle',
  'itsm.addSupplier': 'itam.manage', 'itsm.addContract': 'itam.manage', 'itsm.updateContract': 'itam.manage', 'itsm.setSoftwarePolicy': 'itam.manage', 'itsm.addLicense': 'itam.manage', 'itsm.updateLicense': 'itam.manage',
  'itsm.createCi': 'cmdb.edit', 'itsm.removeCi': 'cmdb.edit', 'itsm.addRelation': 'cmdb.edit', 'itsm.removeRelation': 'cmdb.edit',
  'itsm.createGroup': 'admin.groups', 'itsm.setGroupMembers': 'admin.groups', 'itsm.setGroupRoles': 'admin.groups', 'itsm.delegate': 'admin.groups', 'itsm.revokeDelegation': 'admin.groups',
  'itsm.addUser': 'admin.users', 'itsm.setUserRoles': 'admin.users', 'itsm.setUserActive': 'admin.users',
  'itsm.createRole': 'admin.roles', 'itsm.setSlaCalendar': 'admin.settings', 'itsm.setRolePermission': 'admin.roles',
};
const PREFIX_NEEDS: [string, string][] = [['infra.', 'infra.edit'], ['agent.', 'infra.edit'], ['inventory.', 'infra.edit']];

/** Garde d'accès (RBAC) : refuse avec une explication (quel droit, quels rôles) plutôt qu'un simple « interdit ». */
export function accessGuard(cmd: Command, st: Readonly<State>, actorId: string, now: number = Number.NEGATIVE_INFINITY): string | null {
  const u = st.management.users[actorId]; if (!u) return null;
  if (u.disabled) return `Le compte de ${u.name} est désactivé : il ne peut plus agir.`;
  const p = cmd.payload ?? {};
  const rule = NEEDS[cmd.type] ?? PREFIX_NEEDS.find(([pre]) => cmd.type.startsWith(pre))?.[1]; if (!rule) return null;
  const perm = typeof rule === 'function' ? rule(p, st) : rule; if (!perm) return null;
  if (!permissionsOf(st, actorId, now).has(perm)) {
    const roles = [...rolesOf(st, actorId, now)].map(r => st.management.roles[r]?.name ?? r).join(', ') || 'aucun';
    return `Accès refusé : cette action demande le droit « ${PERMISSION_LABEL[perm] ?? perm} ». ${u.name} a le(s) rôle(s) : ${roles}.`;
  }
  if (cmd.type === 'itsm.transitionChange' && p['to'] === 'approved') {
    const c = st.management.changes[String(p['id'])];
    if (c?.requestedBy === actorId) return 'Séparation des tâches : on n\'approuve pas un changement que l\'on a soi-même demandé.';
  }
  return null;
}
