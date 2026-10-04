/**
 * Modèle partagé du SI. Données pures (JSON), sans classes ni fonctions : snapshot, reset et diff triviaux.
 * Deux couches : `reality` (ce qui est vrai) et `management` (ce que l'outil en sait).
 * Les entités sont enrichies jalon par jalon (M1 Infra, M2 Inventaire, M3 Tickets…).
 */
export type EntityKind = 'device' | 'link' | 'user' | 'asset' | 'ticket' | 'problem' | 'change' | 'ci' | 'site' | 'scenario';
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
}

export interface Device {
  id: string; name: string; kind: DeviceKind; powered: boolean;
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
export interface Asset {
  id: string; deviceId?: string;
  status: 'discovered' | 'in_use' | 'stock' | 'repair' | 'retired';
  inventoryNo?: string; serial?: string; vendor?: string; model?: string;
  assignedTo?: string; service?: string;
  observed?: { t: number; source: Provenance; data: Record<string, unknown> };
}
export interface User { id: string; name: string; roles: string[]; service?: string; site?: string }

/* ---------------- État global ---------------- */
export interface State {
  schemaVersion: 1;
  counters: Record<string, number>;
  reality: { devices: Record<string, Device>; links: Record<string, Link> };
  management: { assets: Record<string, Asset>; users: Record<string, User> };
  /** Sélection partagée entre les deux vues (« Voir dans l'infrastructure »). */
  focus: EntityRef | null;
}

export function emptyState(): State {
  return {
    schemaVersion: 1, counters: {},
    reality: { devices: {}, links: {} },
    management: { assets: {}, users: {} },
    focus: null,
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
