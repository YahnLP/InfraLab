import type { Ticket } from '../core';
import { HOUR, MINUTE } from '../core';
import { priorityOf, type Priority } from './taxonomy';
import { businessMs, type SlaCalendar } from './calendar';
const ticketPriority = (t: Ticket) => priorityOf(t.impact, t.urgency);

/** Cibles de SLA par priorité (temps écoulé, calendrier 24/7 : le calendrier ouvré viendra plus tard). */
export const SLA_TARGETS: Record<Priority, { respond: number; resolve: number }> = {
  1: { respond: 15 * MINUTE, resolve: 4 * HOUR }, 2: { respond: HOUR, resolve: 8 * HOUR },
  3: { respond: 4 * HOUR, resolve: 24 * HOUR }, 4: { respond: 8 * HOUR, resolve: 72 * HOUR },
};
export type SlaState = 'met' | 'running' | 'at_risk' | 'breached' | 'paused';
export interface SlaClock { target: number; elapsed: number; state: SlaState; remaining: number }
export interface SlaStatus { respond: SlaClock; resolve: SlaClock }

/** Temps écoulé utile : hors périodes « en attente », en continu ou en heures ouvrées selon le calendrier retenu. */
function elapsedUntil(t: Ticket, end: number, cal: SlaCalendar): number {
  if (cal === 'business') {
    const paused = (t.pausedBizMs ?? 0) + (t.pausedSince !== undefined ? businessMs(t.pausedSince, end) : 0);
    return Math.max(0, businessMs(t.createdAt, end) - paused);
  }
  const paused = (t.pausedMs ?? 0) + (t.pausedSince !== undefined ? Math.max(0, end - t.pausedSince) : 0);
  return Math.max(0, end - t.createdAt - paused);
}
function clock(t: Ticket, target: number, doneAt: number | undefined, now: number, cal: SlaCalendar): SlaClock {
  const end = doneAt ?? now; const elapsed = elapsedUntil(t, end, cal);
  const state: SlaState = elapsed > target ? 'breached' : doneAt !== undefined ? 'met' : t.pausedSince !== undefined ? 'paused' : elapsed > 0.75 * target ? 'at_risk' : 'running';
  return { target, elapsed, state, remaining: target - elapsed };
}
/** SLA dérivé du ticket et de l'heure simulée ; indéfini tant que la priorité n'est pas connue. */
export function slaOf(t: Ticket, now: number, cal: SlaCalendar = 'continuous'): SlaStatus | undefined {
  const p = ticketPriority(t); if (!p) return undefined; const tg = SLA_TARGETS[p];
  return { respond: clock(t, tg.respond, t.respondedAt, now, cal), resolve: clock(t, tg.resolve, t.resolvedAt ?? t.closedAt, now, cal) };
}
export const SLA_LABEL: Record<SlaState, string> = { met: 'Respecté', running: 'En cours', at_risk: 'À risque', breached: 'Dépassé', paused: 'Suspendu' };
export function fmtDuration(ms: number): string {
  const a = Math.abs(ms), m = Math.round(a / MINUTE); const s = m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${Math.floor(m / 1440)} j`;
  return ms < 0 ? `−${s}` : s;
}
