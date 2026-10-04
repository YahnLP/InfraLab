import { computeReachability } from '../infra';
import type { Ci, Relation, State } from '../core';

export const CI_KIND_LABEL: Record<Ci['kind'], string> = { service: 'Service', application: 'Application', infrastructure: 'Infrastructure' };
export const RELATION_LABEL: Record<Relation['type'], string> = { depends_on: 'dépend de', uses: 'utilise', hosted_on: 'est hébergé sur' };

export interface AutoRelation { a: string; b: string }
/** Relations « connecté à » : déduites du câblage réel entre actifs qui ont un CI. Jamais saisies à la main. */
export function autoRelations(st: Readonly<State>): AutoRelation[] {
  const ciOfDevice = new Map<string, string>();
  for (const ci of Object.values(st.management.cis)) { const a = ci.assetId && st.management.assets[ci.assetId]; if (a && a.deviceId) ciOfDevice.set(a.deviceId, ci.id); }
  const out: AutoRelation[] = [];
  for (const l of Object.values(st.reality.links)) { const a = ciOfDevice.get(l.a.device), b = ciOfDevice.get(l.b.device); if (a && b) out.push({ a, b }); }
  return out;
}

/** Équipements qui perdraient la joignabilité si celui-ci s'éteignait (simulation sur une copie : la réalité n'est pas touchée). */
export function simulateOutage(st: Readonly<State>, deviceId: string): string[] {
  const before = computeReachability(st); const copy = structuredClone(st) as State; const d = copy.reality.devices[deviceId]; if (!d) return [];
  d.powered = false; const after = computeReachability(copy);
  return Object.keys(before).filter(id => id !== deviceId && before[id]!.online && !after[id]!.online);
}

export interface Impact { direct: string[]; services: string[]; devices: string[] }
/** Qui est touché si ce CI tombe ? Remontée par relations manuelles (dépend de / utilise / hébergé sur), après propagation physique. */
export function impactOf(st: Readonly<State>, ciId: string): Impact {
  const ci = st.management.cis[ciId]; if (!ci) return { direct: [], services: [], devices: [] };
  const dev = ci.assetId ? st.management.assets[ci.assetId]?.deviceId : undefined;
  const lost = new Set<string>(dev ? [dev, ...simulateOutage(st, dev)] : []);
  const failed = new Set<string>([ciId]);
  for (const c of Object.values(st.management.cis)) { const d = c.assetId && st.management.assets[c.assetId]?.deviceId; if (d && lost.has(d)) failed.add(c.id); }
  const direct = [...failed]; const impacted = new Set(failed);
  for (let grew = true; grew;) { grew = false; for (const r of Object.values(st.management.relations)) if (impacted.has(r.to) && !impacted.has(r.from)) { impacted.add(r.from); grew = true; } }
  return { direct, services: [...impacted].filter(i => st.management.cis[i]?.kind === 'service'), devices: [...lost] };
}
