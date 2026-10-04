/**
 * Modèle partagé du SI. Données pures (JSON), sans classes ni fonctions : snapshot, reset et diff triviaux.
 * Deux couches : `reality` (ce qui est vrai) et `management` (ce que l'outil en sait).
 * Les entités sont enrichies jalon par jalon (M1 Infra, M2 Inventaire, M3 Tickets…).
 */
export type EntityKind = 'device' | 'link' | 'user' | 'asset' | 'ticket' | 'problem' | 'change' | 'article' | 'contract' | 'license' | 'supplier' | 'relation' | 'ci' | 'role' | 'group' | 'site' | 'scenario';
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
  /** Machine virtuelle : équipement hyperviseur qui l'héberge. Elle partage alors son réseau et tombe avec lui. */
  hostId?: string;
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
  status: 'ordered' | 'discovered' | 'in_use' | 'stock' | 'repair' | 'retired';
  createdAt: number;
  /** Identité utilisée pour le rapprochement : MAC d'abord, puis nom d'hôte, puis IP. */
  identity: { macs: string[]; hostname?: string; ips: string[] };
  /** Dernière observation par la découverte réseau (informations partielles). */
  discovery?: { t: number; ip: string; mac: string; hostname: string; vendor: string };
  /** Dernier inventaire remonté par un agent (informations détaillées). */
  observed?: { t: number; source: Provenance; data: InventoryReport };
  /** Données déclarées (saisie manuelle). */
  inventoryNo?: string; serial?: string; vendor?: string; model?: string; assignedTo?: string; service?: string;
  /** Cycle de vie financier (ITAM). */
  purchasedAt?: number; warrantyEnd?: number; cost?: number;
}
export interface User { id: string; name: string; roles: string[]; service?: string; site?: string; /** Compte désactivé : ne peut plus agir ni recevoir de ticket. */ disabled?: boolean }
/** Groupe : des personnes qui reçoivent ensemble les rôles du groupe (ex. « Support N1 »). */
export interface Group { id: string; name: string; members: string[]; roles: string[] }
/** Délégation : `from` prête un de ses rôles à `to` pendant une durée (absence, congés) ; elle expire seule avec l'horloge. */
export interface Delegation { id: string; from: string; to: string; role: string; startAt: number; endAt: number; revoked?: boolean }
/** Rôle : un ensemble de droits (RBAC). */
export interface Role { id: string; name: string; description?: string; permissions: string[] }

/* ---- ITAM et CMDB (M6) ---- */
export interface Supplier { id: string; name: string; contact?: string }
export type ContractKind = 'maintenance' | 'licence' | 'warranty' | 'leasing';
export interface Contract { id: string; ref: string; title: string; supplierId: string; kind: ContractKind; startAt: number; endAt: number; assetIds: string[] }
export interface License { id: string; ref: string; softwareId: string; quantity: number; contractId?: string; expiresAt?: number }
export type SoftwarePolicy = 'authorized' | 'forbidden';
export type CiKind = 'service' | 'application' | 'infrastructure';
export interface Ci { id: string; ref: string; name: string; kind: CiKind; assetId?: string; description?: string }
export type RelationType = 'depends_on' | 'uses' | 'hosted_on';
export interface Relation { id: string; from: string; to: string; type: RelationType }

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
  status: TicketStatus; assignee?: string; /** File d'attente (groupe) vers laquelle le ticket est aiguillé. */ groupId?: string;
  /** Actifs concernés (CI plus tard) : lien entre le ticket et l'inventaire. */
  assetIds: string[];
  comments: TicketComment[]; solution?: string;
  createdAt: number; updatedAt: number; resolvedAt?: number; closedAt?: number;
  /** Première prise en charge (démarre la preuve de réactivité du SLA). */
  respondedAt?: number;
  /** Temps passé « en attente » : l'horloge du SLA est suspendue. */
  pausedMs?: number; pausedSince?: number; /** Part ouvrée des pauses (calendrier « heures ouvrées »). */ pausedBizMs?: number;
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
  requestedBy?: string; risk?: Level; plan?: string; rollback?: string; approver?: string; assetIds: string[]; problemId?: string;
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
  /** Événements de la chronologie du scénario déjà déclenchés (ils ne se rejouent pas). */
  fired?: string[];
}

/** Paramètres de l'outil de gestion. */
export interface Settings { slaCalendar: 'continuous' | 'business' }

/* ---------------- État global ---------------- */
export interface State {
  schemaVersion: 1;
  counters: Record<string, number>;
  reality: { devices: Record<string, Device>; links: Record<string, Link>; itsmServerId: string | null };
  management: { assets: Record<string, Asset>; users: Record<string, User>; tickets: Record<string, Ticket>; problems: Record<string, Problem>; changes: Record<string, Change>; articles: Record<string, Article>; suppliers: Record<string, Supplier>; contracts: Record<string, Contract>; licenses: Record<string, License>; softwarePolicy: Record<string, SoftwarePolicy>; cis: Record<string, Ci>; relations: Record<string, Relation>; roles: Record<string, Role>; groups: Record<string, Group>; delegations: Record<string, Delegation>; settings: Settings };
  /** Sélection partagée entre les deux vues (« Voir dans l'infrastructure »). */
  focus: EntityRef | null;
  /** Utilisateur « incarné » : ses droits s'appliquent aux actions. Nul = mode formateur (tous les droits). */
  actingAs: string | null;
  /** Scénario en cours, ou null en mode libre. */
  session: Session | null;
}

import { defaultRoles } from './rbac';
export function emptyState(): State {
  return {
    schemaVersion: 1, counters: {},
    reality: { devices: {}, links: {}, itsmServerId: null },
    management: { assets: {}, users: {}, tickets: {}, problems: {}, changes: {}, articles: {}, suppliers: {}, contracts: {}, licenses: {}, softwarePolicy: {}, cis: {}, relations: {}, roles: defaultRoles(), groups: {}, delegations: {}, settings: { slaCalendar: 'continuous' } },
    focus: null, actingAs: null, session: null,
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
