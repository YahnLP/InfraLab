import type { Ticket } from '../core';
import { slaOf } from './sla';
import { ticketPriority } from './selectors';

import type { SlaCalendar } from './calendar';

export const SUPPORT_LEVEL_LABEL: Record<1 | 2 | 3, string> = { 1: 'N1 — Service desk', 2: 'N2 — Technicien confirmé', 3: 'N3 — Expert' };
export const ESCALATION_KIND_LABEL = { functional: 'Escalade fonctionnelle', hierarchical: 'Escalade hiérarchique' } as const;
export const supportLevel = (t: Ticket): 1 | 2 | 3 => t.level ?? 1;
/** Seuls les tickets en cours de traitement s'escaladent : un ticket « nouveau » doit d'abord être qualifié. */
export const canEscalateStatus = (t: Ticket) => t.status === 'qualified' || t.status === 'assigned' || t.status === 'in_progress' || t.status === 'pending';

/** Pourquoi une escalade hiérarchique est (ou non) justifiée : priorité 1 ou 2, ou délai du SLA menacé ou dépassé. */
export function hierarchicalJustification(t: Ticket, now: number, cal: SlaCalendar): string | null {
  const p = ticketPriority(t); if (p && p <= 2) return `priorité ${p}`;
  const sl = slaOf(t, now, cal); if (!sl) return null;
  if (sl.resolve.state === 'breached' || sl.respond.state === 'breached') return 'SLA dépassé';
  if (sl.resolve.state === 'at_risk' || sl.respond.state === 'at_risk') return 'SLA à risque';
  return null;
}

/** Conseil affiché à l'apprenant (jamais appliqué automatiquement : escalader est une décision humaine). */
export function escalationAdvice(t: Ticket, now: number, cal: SlaCalendar): string | null {
  if (!canEscalateStatus(t)) return null;
  const sl = slaOf(t, now, cal); if (!sl) return null;
  const late = sl.resolve.state === 'breached' || sl.respond.state === 'breached';
  const risk = late || sl.resolve.state === 'at_risk' || sl.respond.state === 'at_risk';
  if (late && !t.managerAlerted) return 'Le SLA est dépassé : prévenez le responsable (escalade hiérarchique) et, si le niveau actuel est bloqué, passez la main (escalade fonctionnelle).';
  if (risk && supportLevel(t) < 3) return 'Le SLA est à risque : si vous ne voyez pas comment avancer, escaladez au niveau supérieur plutôt que d\'attendre.';
  return null;
}
