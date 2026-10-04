import type { Change, ChangeStatus, ChangeType, Level, Problem, ProblemStatus, State } from '../core';

/** Workflows ITIL déclaratifs : chaque transition porte ses prérequis, expliqués à l'apprenant. */
export interface PTransition { from: ProblemStatus; to: ProblemStatus; label: string; guard?: (p: Problem) => string | null }
export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = { new: 'Nouveau', analysis: 'En analyse', known_error: 'Erreur connue', resolved: 'Résolu', closed: 'Clos' };
export const PROBLEM_TRANSITIONS: PTransition[] = [
  { from: 'new', to: 'analysis', label: 'Lancer l\'analyse', guard: p => p.ticketIds.length ? null : 'Rattachez au moins un incident : un problème naît de la répétition ou de la gravité d\'incidents.' },
  { from: 'analysis', to: 'known_error', label: 'Déclarer erreur connue', guard: p => !p.rootCause?.trim() ? 'Renseignez la cause racine.' : !p.workaround?.trim() ? 'Renseignez un contournement : c\'est ce qui permet de traiter les incidents en attendant la correction.' : null },
  { from: 'known_error', to: 'resolved', label: 'Résoudre', guard: p => p.permanentFix?.trim() ? null : 'Décrivez la correction définitive (souvent un changement).' },
  { from: 'resolved', to: 'closed', label: 'Clore' },
];

export interface CTransition { from: ChangeStatus; to: ChangeStatus; label: string; types?: ChangeType[]; guard?: (c: Change, s: Readonly<State>) => string | null }
export const CHANGE_STATUS_LABEL: Record<ChangeStatus, string> = { draft: 'Brouillon', proposed: 'Proposé', approved: 'Approuvé', rejected: 'Refusé', scheduled: 'Planifié', implemented: 'Réalisé', verified: 'Vérifié', closed: 'Clos' };
export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = { standard: 'Standard (pré-approuvé)', normal: 'Normal', emergency: 'Urgent' };
export const RISK_LABEL: Record<Level, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };
export const CHANGE_TRANSITIONS: CTransition[] = [
  { from: 'draft', to: 'proposed', label: 'Soumettre', guard: c => !c.risk ? 'Évaluez le risque.' : !c.plan?.trim() ? 'Décrivez le plan de mise en œuvre.' : !c.rollback?.trim() ? 'Décrivez le plan de retour arrière : que faire si ça tourne mal ?' : null },
  { from: 'proposed', to: 'approved', label: 'Approuver', types: ['normal', 'emergency'], guard: (c, s) => !c.approver ? 'Désignez un approbateur (rôle responsable).' : s.management.users[c.approver]?.roles.includes('manager') ? null : 'L\'approbateur doit avoir le rôle responsable.' },
  { from: 'proposed', to: 'rejected', label: 'Refuser', types: ['normal', 'emergency'] },
  { from: 'proposed', to: 'scheduled', label: 'Planifier (changement standard)', types: ['standard'], guard: c => c.scheduledAt !== undefined ? null : 'Fixez une date d\'intervention.' },
  { from: 'rejected', to: 'draft', label: 'Reprendre en brouillon' },
  { from: 'approved', to: 'scheduled', label: 'Planifier', guard: c => c.scheduledAt !== undefined ? null : 'Fixez une date d\'intervention.' },
  { from: 'approved', to: 'implemented', label: 'Réaliser sans planification (urgence)', types: ['emergency'] },
  { from: 'scheduled', to: 'implemented', label: 'Marquer comme réalisé' },
  { from: 'implemented', to: 'verified', label: 'Vérifier', guard: c => c.result?.trim() ? null : 'Consignez le résultat de la vérification (le changement a-t-il atteint son but ?).' },
  { from: 'verified', to: 'closed', label: 'Clore' },
];
export const changeTransitionsFrom = (c: Change): CTransition[] => CHANGE_TRANSITIONS.filter(t => t.from === c.status && (!t.types || t.types.includes(c.type)));
export const problemTransitionsFrom = (s: ProblemStatus): PTransition[] => PROBLEM_TRANSITIONS.filter(t => t.from === s);
