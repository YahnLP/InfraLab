/**
 * Modèle partagé du SI. Données pures (JSON), sans classes ni fonctions : snapshot, reset et diff triviaux.
 * Deux couches : `reality` (ce qui est vrai) et `management` (ce que l'outil en sait).
 * Les entités sont enrichies jalon par jalon (M1 Infra, M2 Inventaire, M3 Tickets…).
 */
export type EntityKind = 'device' | 'link' | 'user' | 'asset' | 'ticket' | 'problem' | 'change' | 'article' | 'ci' | 'site' | 'scenario';
export interface EntityRef { kind: EntityKind; id: string }

/* ---------------- Réalité ---------------- */
export type DeviceKind =
  | 'internet' | 'router' | 'firewall' | 'switch' | 'wifi_ap' | 'workstation' | 'laptop'
  | 'server' | 'nas' | 'printer' | 'phone' | 'tablet' | 'vm' | 'hypervisor' | 'generic';

export interface Nic { id: string; mac: string; ip?: string; mask?: number; gw?: string; vlan?: number }

export type AgentState = 'none' | 'stopped' | 'running';
export interface AgentRuntime {
  state: AgentState; version?: string; serverUrl?: string; intervalMs: number;
  lastRun?: number; nextRun?: number; errors: string[];
  logs: { t: number; level: 'info' | 'warn' | 'error'; msg: string }[];
}

export interface Port { id: string; label: string }

export interface Device {
  id: string; name: string; kind: DeviceKind; powered: boolean;
  /** Joignable par l'outil (dérivé, maintenu uniquement par la synchronisation de joignabilité). */
  online: boolean;
  ports: Port[];
  site?: string; room?: string; pos: { x: number; y: number };
  nics: Nic[];
  hardware?: { cpu?: string; ramGb?: number; disks?: { type: 'ssd' | 'hdd'; gb: number }[] };
  os?: { name: string; version: string };
  software: { softwareId: string; version: string }[];
  loggedUser?: string;
  agent: AgentRuntime;
}

export interface PortRef { device: string; port: string }
export interface Link { id: string; a: PortRef; b: PortRef; medium: 'copper' | 'fiber' | 'wifi' }

/* ---------------- Gestion ---------------- */
export type Provenance = 'manual' | 'agent' | 'discovery' | 'import' | 'scenario';

/** Ce que l'agent remonte : lu sur l'équipement réel, jamais saisi à la main. */
export interface InventoryReport {
  hostname: string; agentVersion: string;
  os?: { name: string; version: string }; cpu?: string; ramGb?: number; disks?: { type: 'ssd' | 'hdd'; gb: number }[];
  ips: string[]; macs: string[];
  software: { softwareId: string; version: string }[];
  loggedUser?: string;
}

export interface Asset {
  id: string; name: string;
  /** Jointure interne du simulateur avec l'équipement réel (l'outil, lui, ne connaît que l'identité ci-dessous). */
  deviceId?: string;
  status: 'discovered' | 'in_use' | 'stock' | 'repair' | 'retired';
  createdAt: number;
  /** Identité utilisée pour le rapprochement : MAC d'abord, puis nom d'hôte, puis IP. */
  identity: { macs: string[]; hostname?: string; ips: string[] };
  /** Dernière observation par la découverte réseau (informations partielles). */
  discovery?: { t: number; ip: string; mac: string; hostname: string; vendor: string };
  /** Dernier inventaire remonté par un agent (informations détaillées). */
  observed?: { t: number; source: Provenance; data: InventoryReport };
  /** Données déclarées (saisie manuelle). */
  inventoryNo?: string; serial?: string; vendor?: string; model?: string; assignedTo?: string; service?: string;
}
export interface User { id: string; name: string; roles: string[]; service?: string; site?: string }

/* ---- Tickets (M3) ---- */
export type TicketKind = 'incident' | 'request';
export type Level = 'low' | 'medium' | 'high';
export type TicketStatus = 'new' | 'qualified' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export interface TicketComment { t: number; author: string; text: string }
export interface Ticket {
  id: string; ref: string; kind: TicketKind; title: string; description: string;
  /** Identifiant de l'utilisateur qui demande. */
  requester: string;
  category?: string; subcategory?: string; impact?: Level; urgency?: Level;
  status: TicketStatus; assignee?: string;
  /** Actifs concernés (CI plus tard) : lien entre le ticket et l'inventaire. */
  assetIds: string[];
  comments: TicketComment[]; solution?: string;
  createdAt: number; updatedAt: number; resolvedAt?: number; closedAt?: number;
  /** Première prise en charge (démarre la preuve de réactivité du SLA). */
  respondedAt?: number;
  /** Temps passé « en attente » : l'horloge du SLA est suspendue. */
  pausedMs?: number; pausedSince?: number;
  problemId?: string; articleIds?: string[];
}

/* ---- ITIL (M5) ---- */
export type ProblemStatus = 'new' | 'analysis' | 'known_error' | 'resolved' | 'closed';
export interface Problem {
  id: string; ref: string; title: string; description: string; status: ProblemStatus;
  rootCause?: string; workaround?: string; permanentFix?: string;
  ticketIds: string[]; assetIds: string[]; createdAt: number; updatedAt: number;
}
export type ChangeType = 'standard' | 'normal' | 'emergency';
export type ChangeStatus = 'draft' | 'proposed' | 'approved' | 'rejected' | 'scheduled' | 'implemented' | 'verified' | 'closed';
export interface Change {
  id: string; ref: string; title: string; description: string; type: ChangeType; status: ChangeStatus;
  risk?: Level; plan?: string; rollback?: string; approver?: string; assetIds: string[]; problemId?: string;
  scheduledAt?: number; implementedAt?: number; result?: string; createdAt: number; updatedAt: number;
}
export interface Article {
  id: string; ref: string; title: string; category?: string; symptoms: string; cause: string; solution: string;
  status: 'draft' | 'published'; sourceTicketId?: string; createdAt: number; updatedAt: number;
}


/* ---- Session de TP (M4) ---- */
export interface Session {
  scenarioId: string; mode: 'tp' | 'exam'; startedAt: number;
  /** Les événements du journal à partir de cet index sont ceux du joueur (le décor précède). */
  logStart: number;
  hints: Record<string, number>; solutionViewed: boolean; finishedAt?: number;
  /** Étape pédagogique en cours (les étapes suivantes restent fermées tant qu'on n'a pas validé celle-ci). */
  stage: number;
  /** Réponses aux questions de compréhension (dernière tentative) et nombre de mauvaises réponses. */
  answers: Record<string, { choice: number; correct: boolean }>; wrong: number;
}

/* ---------------- État global ---------------- */
export interface State {
  schemaVersion: 1;
  counters: Record<string, number>;
  reality: { devices: Record<string, Device>; links: Record<string, Link>; itsmServerId: string | null };
  management: { assets: Record<string, Asset>; users: Record<string, User>; tickets: Record<string, Ticket>; problems: Record<string, Problem>; changes: Record<string, Change>; articles: Record<string, Article> };
  /** Sélection partagée entre les deux vues (« Voir dans l'infrastructure »). */
  focus: EntityRef | null;
  /** Scénario en cours, ou null en mode libre. */
  session: Session | null;
}

export function emptyState(): State {
  return {
    schemaVersion: 1, counters: {},
    reality: { devices: {}, links: {}, itsmServerId: null },
    management: { assets: {}, users: {}, tickets: {}, problems: {}, changes: {}, articles: {} },
    focus: null, session: null,
  };
}

/* ---------------- Événements de domaine ---------------- */
export interface DomainEvent {
  id: string;            // evt-000123
  t: number;             // temps simulé (ms)
  type: string;          // ex. 'CableDisconnected' — catalogue dans events/catalog (M1)
  actor: 'user' | 'system' | 'agent' | 'scenario';
  actorId?: string;
  subject: EntityRef;
  payload: Record<string, unknown>;
  causedBy?: string;     // chaîne causale (« Pourquoi ? »)
}
