import { rolesOf, type State, type Ticket, type TicketStatus } from '../core';

/** Workflow déclaratif : chaque transition porte ses prérequis (« gardes »), expliqués à l'apprenant. */
export interface Transition { from: TicketStatus; to: TicketStatus; label: string; guard?: (t: Ticket, s: Readonly<State>, now?: number) => string | null }

const needsQualification = (t: Ticket) => !t.category ? 'Choisissez une catégorie.' : !t.impact ? 'Renseignez l\'impact.' : !t.urgency ? 'Renseignez l\'urgence.' : null;
const needsAssignee = (t: Ticket, s: Readonly<State>, now?: number) => {
  if (!t.assignee) return 'Attribuez le ticket à un technicien.';
  if (s.management.users[t.assignee]?.disabled) return 'L\'assigné a un compte désactivé.';
  return rolesOf(s, t.assignee, now).has('technician') ? null : 'L\'assigné doit avoir le rôle technicien.';
};

export const TRANSITIONS: Transition[] = [
  { from: 'new', to: 'qualified', label: 'Qualifier', guard: needsQualification },
  { from: 'qualified', to: 'assigned', label: 'Attribuer', guard: needsAssignee },
  { from: 'assigned', to: 'in_progress', label: 'Prendre en charge' },
  { from: 'in_progress', to: 'pending', label: 'Mettre en attente' },
  { from: 'pending', to: 'in_progress', label: 'Reprendre' },
  { from: 'in_progress', to: 'resolved', label: 'Résoudre', guard: t => t.solution?.trim() ? null : 'Documentez la solution avant de résoudre.' },
  { from: 'resolved', to: 'closed', label: 'Clore' },
  { from: 'resolved', to: 'in_progress', label: 'Rouvrir' },
];

export function transitionsFrom(status: TicketStatus): Transition[] { return TRANSITIONS.filter(t => t.from === status); }
/** Prérequis manquant pour une transition, ou null si elle est possible. */
export function blocker(t: Ticket, tr: Transition, s: Readonly<State>, now?: number): string | null { return tr.guard ? tr.guard(t, s, now) : null; }
