import type { Level, TicketKind, TicketStatus } from '../core';

/** Catégories de ticket (liste volontairement courte : un outil réel les rend configurables). */
export const TAXONOMY: Record<string, string[]> = {
  'Réseau': ['Poste sans réseau', 'Serveur injoignable', 'Wi-Fi', 'Switch / routeur'],
  'Matériel': ['Poste de travail', 'Imprimante', 'Périphérique'],
  'Logiciel': ['Installation', 'Licence', 'Dysfonctionnement'],
  'Compte et accès': ['Mot de passe', 'Droits d\'accès'],
  'Demande de service': ['Nouveau matériel', 'Nouvel utilisateur'],
};

export const KIND_LABEL: Record<TicketKind, string> = { incident: 'Incident', request: 'Demande' };
export const LEVEL_LABEL: Record<Level, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };
export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'Nouveau', qualified: 'Qualifié', assigned: 'Attribué', in_progress: 'En cours', pending: 'En attente', resolved: 'Résolu', closed: 'Clos',
};
export const STATUS_ORDER: TicketStatus[] = ['new', 'qualified', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'];

export type Priority = 1 | 2 | 3 | 4;
/** Matrice impact × urgence → priorité (P1 = la plus haute). */
const MATRIX: Record<Level, Record<Level, Priority>> = {
  high: { high: 1, medium: 2, low: 3 },
  medium: { high: 2, medium: 3, low: 4 },
  low: { high: 3, medium: 4, low: 4 },
};
export function priorityOf(impact?: Level, urgency?: Level): Priority | undefined {
  return impact && urgency ? MATRIX[impact][urgency] : undefined;
}
export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'P1 · Critique', 2: 'P2 · Haute', 3: 'P3 · Moyenne', 4: 'P4 · Basse' };
