import type { Asset, State, Ticket } from '../core';
import { priorityOf, type Priority } from './taxonomy';

export const isOpen = (t: Ticket): boolean => t.status !== 'closed' && t.status !== 'resolved';
export const ticketPriority = (t: Ticket): Priority | undefined => priorityOf(t.impact, t.urgency);

/** Tickets liés à un actif (par défaut : seulement ceux encore ouverts). */
export function ticketsForAsset(st: Readonly<State>, assetId: string, openOnly = true): Ticket[] {
  return Object.values(st.management.tickets).filter(t => t.assetIds.includes(assetId) && (!openOnly || isOpen(t)));
}
/** Tickets liés à un équipement, via l'actif qui le représente dans l'outil. */
export function ticketsForDevice(st: Readonly<State>, deviceId: string, openOnly = true): Ticket[] {
  const a: Asset | undefined = Object.values(st.management.assets).find(x => x.deviceId === deviceId);
  return a ? ticketsForAsset(st, a.id, openOnly) : [];
}
/** Tri de la file d'attente : priorité (P1 d'abord, non qualifiés en dernier), puis ancienneté. */
export function byQueueOrder(a: Ticket, b: Ticket): number {
  return (ticketPriority(a) ?? 5) - (ticketPriority(b) ?? 5) || a.createdAt - b.createdAt;
}
