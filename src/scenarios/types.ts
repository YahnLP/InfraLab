import type { Asset, ChangeStatus, ChangeType, Level, ProblemStatus, TicketStatus } from '../core';
import type { ContractState, Compliance, SlaState } from '../itsm';
import type { AgentHealth } from '../inventory';

/**
 * Référence symbolique, résolue à l'exécution : `@dev:PC21` (équipement), `@usr:Alice` (utilisateur, début du nom),
 * `@ast:PC21` (actif, par nom), `@tkt:INC-0001` (ticket, par référence), `@prb:PRB-0001`, `@chg:CHG-0001`, `@kb:KB-0001` (par référence), `@lnk:PC21` (câble relié à cet équipement). Tout autre texte reste tel quel.
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
  | { k: 'ticket'; ref: Ref; status?: TicketStatus; category?: string; impact?: Level; urgency?: Level; priority?: 1 | 2 | 3 | 4; linkedDevice?: Ref; hasSolution?: boolean; solutionMin?: number; minComments?: number; subcategory?: string; kind?: 'incident' | 'request'; qualified?: boolean; assignee?: Ref; reached?: TicketStatus; requester?: Ref; descMin?: number; linkedAsset?: Ref; noOtherAsset?: boolean }
  | { k: 'escalated'; ref: Ref; kind?: 'functional' | 'hierarchical'; toLevel?: 2 | 3; group?: string; by?: Ref }
  | { k: 'ticketLevel'; ref: Ref; level: 1 | 2 | 3 }
  | { k: 'clock'; atLeast: number }
  | { k: 'sla'; ticket: Ref; respond?: SlaState; resolve?: SlaState; resolveNot?: SlaState }
  | { k: 'problem'; ref: Ref; status?: ProblemStatus; reached?: ProblemStatus; minTickets?: number; hasRootCause?: boolean; hasWorkaround?: boolean; hasFix?: boolean }
  | { k: 'change'; ref: Ref; status?: ChangeStatus; reached?: ChangeStatus; type?: ChangeType; linkedDevice?: Ref; linkedAsset?: Ref; approver?: Ref }
  | { k: 'article'; ref: Ref; status?: 'draft' | 'published'; category?: string; sourceTicket?: Ref; minTickets?: number }
  | { k: 'answer'; question: string }
  | { k: 'license'; software: string; state?: Compliance; exists?: boolean }
  | { k: 'policy'; software: string; is: 'authorized' | 'forbidden' }
  | { k: 'softwareInstalled'; device: Ref; software: string; value?: boolean }
  | { k: 'forbiddenCount'; max: number }
  | { k: 'contract'; ref: Ref; state?: ContractState; coversAsset?: Ref }
  | { k: 'asset'; asset: Ref; status?: Asset['status']; reached?: Asset['status']; assignedTo?: Ref; unassigned?: boolean }
  | { k: 'deviceUser'; device: Ref; user: Ref }
  | { k: 'ci'; name: Ref; ciKind?: 'service' | 'application' | 'infrastructure'; withAsset?: boolean }
  | { k: 'relation'; from: Ref; to: Ref; type?: 'depends_on' | 'uses' | 'hosted_on' }
  | { k: 'newDevices'; kind?: string; min: number; unmanaged?: boolean }
  | { k: 'cabled'; min: number }
  | { k: 'assetData'; asset: Ref; has?: string[]; observed?: boolean; cost?: number }
  | { k: 'acting'; user: Ref | null }
  | { k: 'actedAs'; user: Ref }
  | { k: 'didAs'; user: Ref; type: string; payload?: Record<string, unknown> }
  | { k: 'userActive'; user: Ref; value: boolean }
  | { k: 'userRoles'; user: Ref; has?: string[]; lacks?: string[] }
  | { k: 'rolePerm'; role: string; permission: string; value: boolean }
  | { k: 'noOpenAssigned'; user: Ref }
  | { k: 'roleExists'; role: string; has?: string[]; lacks?: string[] }
  | { k: 'changeWindow'; ref: Ref; outsideBusinessHours?: boolean; reachedByNow?: boolean }
  | { k: 'slaCalendar'; is: 'continuous' | 'business' }
  | { k: 'vmHost'; vm: Ref; host: Ref | null }
  | { k: 'group'; name: string; members?: Ref[]; roles?: string[] }
  | { k: 'ticketGroup'; ref: Ref; group: string }
  | { k: 'effectiveRole'; user: Ref; role: string; value: boolean }
  | { k: 'delegation'; from: Ref; to: Ref; role: string; state?: 'active' | 'ended' }
  | { k: 'event'; type: string; subject?: Ref }
  | { k: 'all'; of: Check[] };

/** `as` : utilisateur au nom duquel la commande est journalisée (traçabilité), sans appliquer les droits. */
export interface Step { do?: string; args?: Record<string, unknown>; advance?: number; as?: Ref }
/** Question de compréhension : vérifie qu'on a compris, pas seulement cliqué. */
export interface Question { prompt: string; choices: string[]; correct: number; explain: string }
/** Un objectif est soit un état à atteindre (`check`), soit une question (`question`). Son libellé décrit un résultat, jamais la méthode. */
export interface Objective { id: string; label: string; check?: Check; question?: Question; requires?: string[] }
/** Étape pédagogique : un cours court, des tâches, puis un bilan. Alterne l'apport de connaissances et la pratique. */
export interface Stage { id: string; title: string; lesson: string[]; objectives: string[]; debrief: string[] }
/** Événement scénarisé : se déclenche quand le temps simulé atteint `at` (ms après le début du TP), jamais avant. */
export interface TimelineEvent { id: string; at: number; /** Message montré à l'élève quand l'événement survient. */ notice: string; steps: Step[] }
export interface Hint { for: string; levels: string[] }

export interface Scenario {
  id: string; number: number; title: string; level: number; levelLabel: string; difficulty: 1 | 2 | 3; duration: string;
  /** « Compétence travaillée » ou « élément de preuve possible » : jamais « validée ». */
  skills: { ref: string; kind: 'worked' | 'evidence_possible' }[];
  /** Mise en situation : le contexte, y compris la façon dont les tickets sont arrivés. */
  context: string;
  stages: Stage[];
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
  /** Le temps compte dans ce TP : explication affichée avec les boutons d'avance de l'horloge. */
  timeNote?: string;
  /** Chronologie scénarisée : tickets qui arrivent, pannes, échéances. Déclenchée par l'avance du temps simulé. */
  timeline?: TimelineEvent[];
}
