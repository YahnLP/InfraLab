import type { Level, TicketStatus } from '../core';
import type { AgentHealth } from '../inventory';

/**
 * Référence symbolique, résolue à l'exécution : `@dev:PC21` (équipement), `@usr:Alice` (utilisateur, début du nom),
 * `@ast:PC21` (actif, par nom), `@tkt:INC-0001` (ticket, par référence), `@lnk:PC21` (câble relié à cet équipement). Tout autre texte reste tel quel.
 */
export type Ref = string;

/** Prédicats purs sur (état, journal). */
export type Check =
  | { k: 'deviceOnline'; device: Ref; value?: boolean }
  | { k: 'devicePowered'; device: Ref; value?: boolean }
  | { k: 'agentHealth'; device: Ref; is: AgentHealth }
  | { k: 'assetExists'; device: Ref }
  | { k: 'assetInventoried'; device: Ref }
  | { k: 'assetInSync'; device: Ref }
  | { k: 'ticket'; ref: Ref; status?: TicketStatus; category?: string; impact?: Level; urgency?: Level; priority?: 1 | 2 | 3 | 4; linkedDevice?: Ref; hasSolution?: boolean; qualified?: boolean; assignee?: Ref }
  | { k: 'event'; type: string; subject?: Ref }
  | { k: 'all'; of: Check[] };

export interface Step { do?: string; args?: Record<string, unknown>; advance?: number }
export interface Objective { id: string; label: string; check: Check; requires?: string[] }
export interface Hint { for: string; levels: string[] }

export interface Scenario {
  id: string; number: number; title: string; level: number; levelLabel: string; difficulty: 1 | 2 | 3; duration: string;
  /** « Compétence travaillée » ou « élément de preuve possible » : jamais « validée ». */
  skills: { ref: string; kind: 'worked' | 'evidence_possible' }[];
  context: string;
  /** Décor : suite de commandes rejouable, appliquée après le SI NovaTech de base. */
  setup: Step[];
  objectives: Objective[];
  hints: Hint[];
  /** Événements interdits pendant le TP (qualité). */
  forbid?: { event: string; message: string }[];
  /** Solution expliquée à l'apprenant (texte) et rejouable (auto-test en CI). */
  solutionText: string[];
  solution: Step[];
  realWorld: string;
}
