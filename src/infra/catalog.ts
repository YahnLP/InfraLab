import type { Device, DeviceKind, Port } from '../core';

/** Rôle réseau simplifié : ce dont l'ITSM a besoin pour comprendre « qui est joignable via qui ». */
export type NetRole = 'endpoint' | 'switching' | 'routing' | 'internet';

export interface DeviceSpec {
  kind: DeviceKind; label: string; category: 'Réseau' | 'Postes' | 'Serveurs' | 'Périphériques' | 'Virtualisation' | 'Autre';
  prefix: string; role: NetRole; oui: string;
  ports: string[];
  hardware?: Device['hardware']; os?: Device['os'];
  /** Un agent d'inventaire peut-il être installé ? (un switch ou une imprimante : non, en M2) */
  agentCapable: boolean;
}

const eth = (n: number, pfx = 'port'): string[] => Array.from({ length: n }, (_, i) => `${pfx}${i + 1}`);

export const CATALOG: Record<DeviceKind, DeviceSpec> = {
  internet:   { kind: 'internet', label: 'Internet', category: 'Réseau', prefix: 'INTERNET', role: 'internet', oui: '02:00:00', ports: ['wan1', 'wan2'], agentCapable: false },
  router:     { kind: 'router', label: 'Routeur', category: 'Réseau', prefix: 'RTR', role: 'routing', oui: '00:1b:54', ports: ['wan', 'lan1', 'lan2'], agentCapable: false },
  firewall:   { kind: 'firewall', label: 'Pare-feu', category: 'Réseau', prefix: 'FW', role: 'routing', oui: '00:0d:b4', ports: ['wan', 'lan', 'dmz'], agentCapable: false },
  switch:     { kind: 'switch', label: 'Switch', category: 'Réseau', prefix: 'SW', role: 'switching', oui: '00:1e:bd', ports: eth(8), agentCapable: false },
  wifi_ap:    { kind: 'wifi_ap', label: 'Borne Wi-Fi', category: 'Réseau', prefix: 'AP', role: 'switching', oui: '00:27:22', ports: ['lan', 'wifi'], agentCapable: false },
  workstation:{ kind: 'workstation', label: 'PC fixe', category: 'Postes', prefix: 'PC', role: 'endpoint', oui: '3c:d9:2b', ports: ['eth0'],
                hardware: { cpu: 'Intel Core i5-12400', ramGb: 16, disks: [{ type: 'ssd', gb: 512 }] }, os: { name: 'Windows', version: '11 23H2' }, agentCapable: true },
  laptop:     { kind: 'laptop', label: 'Ordinateur portable', category: 'Postes', prefix: 'PORT', role: 'endpoint', oui: '98:fa:9b', ports: ['eth0', 'wifi'],
                hardware: { cpu: 'Intel Core i5-1235U', ramGb: 16, disks: [{ type: 'ssd', gb: 512 }] }, os: { name: 'Windows', version: '11 23H2' }, agentCapable: true },
  tablet:     { kind: 'tablet', label: 'Tablette', category: 'Postes', prefix: 'TAB', role: 'endpoint', oui: 'f0:18:98', ports: ['wifi'],
                hardware: { cpu: 'ARM A15', ramGb: 6, disks: [{ type: 'ssd', gb: 128 }] }, os: { name: 'iPadOS', version: '17' }, agentCapable: false },
  phone:      { kind: 'phone', label: 'Téléphone IP', category: 'Périphériques', prefix: 'TEL', role: 'endpoint', oui: '00:15:65', ports: ['eth0'], agentCapable: false },
  server:     { kind: 'server', label: 'Serveur', category: 'Serveurs', prefix: 'SRV', role: 'endpoint', oui: '00:14:22', ports: ['eth0'],
                hardware: { cpu: 'Xeon Silver 4310', ramGb: 64, disks: [{ type: 'ssd', gb: 960 }, { type: 'ssd', gb: 960 }] }, os: { name: 'Debian', version: '12' }, agentCapable: true },
  nas:        { kind: 'nas', label: 'NAS', category: 'Serveurs', prefix: 'NAS', role: 'endpoint', oui: '00:11:32', ports: ['lan1'],
                hardware: { cpu: 'Realtek RTD1619B', ramGb: 2, disks: [{ type: 'hdd', gb: 4000 }, { type: 'hdd', gb: 4000 }] }, os: { name: 'DSM', version: '7.2' }, agentCapable: false },
  printer:    { kind: 'printer', label: 'Imprimante', category: 'Périphériques', prefix: 'IMP', role: 'endpoint', oui: '00:1e:8f', ports: ['lan'], agentCapable: false },
  hypervisor: { kind: 'hypervisor', label: 'Hyperviseur', category: 'Virtualisation', prefix: 'HV', role: 'endpoint', oui: '00:25:b3', ports: ['eth0', 'eth1'],
                hardware: { cpu: 'Xeon Gold 6338', ramGb: 256, disks: [{ type: 'ssd', gb: 1920 }] }, os: { name: 'Proxmox VE', version: '8' }, agentCapable: true },
  vm:         { kind: 'vm', label: 'Machine virtuelle', category: 'Virtualisation', prefix: 'VM', role: 'endpoint', oui: '52:54:00', ports: ['eth0'],
                hardware: { cpu: '4 vCPU', ramGb: 8, disks: [{ type: 'ssd', gb: 100 }] }, os: { name: 'Debian', version: '12' }, agentCapable: true },
  generic:    { kind: 'generic', label: 'Équipement générique', category: 'Autre', prefix: 'EQ', role: 'endpoint', oui: '02:00:5e', ports: ['eth0'], agentCapable: false },
};

export const CATEGORY_ORDER = ['Réseau', 'Postes', 'Serveurs', 'Virtualisation', 'Périphériques', 'Autre'] as const;

export function portsOf(kind: DeviceKind): Port[] {
  return CATALOG[kind].ports.map(id => ({ id, label: id }));
}
