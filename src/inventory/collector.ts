import type { Device, InventoryReport, State } from '../core';
import { AGENT_VERSION_CURRENT } from './agent';

/** Lit la RÉALITÉ de l'équipement : c'est la seule source du rapport d'inventaire. */
export function collect(s: Readonly<State>, d: Readonly<Device>): InventoryReport {
  const user = d.loggedUser ? s.management.users[d.loggedUser] : undefined;
  return {
    hostname: d.name, agentVersion: d.agent.version ?? AGENT_VERSION_CURRENT,
    ...(d.os ? { os: { ...d.os } } : {}), ...(d.hardware?.cpu ? { cpu: d.hardware.cpu } : {}),
    ...(d.hardware?.ramGb !== undefined ? { ramGb: d.hardware.ramGb } : {}),
    ...(d.hardware?.disks ? { disks: d.hardware.disks.map(x => ({ ...x })) } : {}),
    ips: d.nics.flatMap(n => (n.ip ? [n.ip] : [])), macs: d.nics.map(n => n.mac),
    software: d.software.map(x => ({ ...x })),
    ...(user ? { loggedUser: user.name } : {}),
  };
}

export interface FieldChange { field: string; before: unknown; after: unknown }

/** Écarts entre deux rapports (détection de changement matériel/logiciel). */
export function diffReports(a: InventoryReport, b: InventoryReport): FieldChange[] {
  const out: FieldChange[] = [];
  const push = (field: string, before: unknown, after: unknown) => { if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ field, before, after }); };
  push('hostname', a.hostname, b.hostname); push('os', a.os?.version, b.os?.version); push('cpu', a.cpu, b.cpu); push('ramGb', a.ramGb, b.ramGb);
  push('disks', a.disks?.reduce((t, x) => t + x.gb, 0), b.disks?.reduce((t, x) => t + x.gb, 0));
  push('ips', [...a.ips].sort(), [...b.ips].sort()); push('macs', [...a.macs].sort(), [...b.macs].sort());
  const ids = (r: InventoryReport) => r.software.map(x => x.softwareId).sort();
  push('software', ids(a), ids(b));
  return out;
}
