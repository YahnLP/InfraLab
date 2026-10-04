import type { Role, State } from './types';

/** Catalogue des droits : un droit = une capacité métier, pas un bouton. */
export const PERMISSIONS: { id: string; label: string; group: string }[] = [
  { id: 'ticket.create', label: 'Ouvrir un ticket', group: 'Support' },
  { id: 'ticket.viewAll', label: 'Voir les tickets de tout le monde', group: 'Support' },
  { id: 'ticket.qualify', label: 'Qualifier un ticket (catégorie, impact, urgence, actifs)', group: 'Support' },
  { id: 'ticket.assign', label: 'Attribuer un ticket à un technicien', group: 'Support' },
  { id: 'ticket.work', label: 'Traiter un ticket (prise en charge, solution, résolution)', group: 'Support' },
  { id: 'ticket.close', label: 'Clore un ticket', group: 'Support' },
  { id: 'problem.manage', label: 'Gérer les problèmes', group: 'ITIL' },
  { id: 'change.create', label: 'Préparer un changement', group: 'ITIL' },
  { id: 'change.approve', label: 'Approuver ou refuser un changement', group: 'ITIL' },
  { id: 'kb.write', label: 'Rédiger la base de connaissances', group: 'ITIL' },
  { id: 'asset.edit', label: 'Modifier le parc (actifs, affectations)', group: 'Parc' },
  { id: 'asset.lifecycle', label: 'Changer l\'état d\'un actif (cycle de vie)', group: 'Parc' },
  { id: 'itam.manage', label: 'Gérer licences, contrats et fournisseurs', group: 'Parc' },
  { id: 'cmdb.edit', label: 'Modifier la CMDB', group: 'Parc' },
  { id: 'infra.edit', label: 'Intervenir sur l\'infrastructure et les agents', group: 'Infrastructure' },
  { id: 'audit.view', label: 'Consulter le journal d\'audit', group: 'Administration' },
  { id: 'admin.users', label: 'Gérer les comptes utilisateurs', group: 'Administration' },
  { id: 'admin.roles', label: 'Gérer les rôles et leurs droits', group: 'Administration' },
];
export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(PERMISSIONS.map(p => [p.id, p.label]));

export const DEFAULT_ROLES: Role[] = [
  { id: 'user', name: 'Utilisateur', description: 'Signale un incident ou fait une demande.', permissions: ['ticket.create'] },
  { id: 'technician', name: 'Technicien', description: 'Traite les tickets et intervient sur le parc et l\'infrastructure.', permissions: ['ticket.create', 'ticket.viewAll', 'ticket.qualify', 'ticket.assign', 'ticket.work', 'ticket.close', 'problem.manage', 'change.create', 'kb.write', 'asset.edit', 'asset.lifecycle', 'cmdb.edit', 'infra.edit'] },
  { id: 'manager', name: 'Responsable', description: 'Pilote le service : approuve les changements, gère contrats et licences.', permissions: ['ticket.create', 'ticket.viewAll', 'ticket.assign', 'ticket.close', 'change.approve', 'itam.manage', 'audit.view'] },
  { id: 'admin', name: 'Administrateur', description: 'Gère les comptes et les droits. N\'intervient pas sur les tickets : séparation des fonctions.', permissions: ['ticket.create', 'ticket.viewAll', 'audit.view', 'admin.users', 'admin.roles'] },
];
export const defaultRoles = (): Record<string, Role> => Object.fromEntries(structuredClone(DEFAULT_ROLES).map(r => [r.id, r]));

/** Droits d'un utilisateur : union des droits de ses rôles. */
export function permissionsOf(st: Readonly<State>, userId: string): Set<string> {
  const u = st.management.users[userId]; const out = new Set<string>(); if (!u || u.disabled) return out;
  for (const r of u.roles) for (const p of st.management.roles[r]?.permissions ?? []) out.add(p);
  return out;
}
/** Sans « agir en tant que » (acteur nul), le simulateur est en mode formateur : tous les droits. */
export function can(st: Readonly<State>, perm: string): boolean { return !st.actingAs || permissionsOf(st, st.actingAs).has(perm); }
