import { HOUR, type Asset, type State } from '../core';

export type Freshness = 'never' | 'fresh' | 'aging' | 'stale';
/** Fraîcheur de l'inventaire d'un actif (l'outil sait-il encore ce qu'il en est ?). */
export function assetFreshness(a: Asset, now: number): Freshness {
  if (!a.observed) return 'never';
  const age = now - a.observed.t;
  return age <= 26 * HOUR ? 'fresh' : age <= 72 * HOUR ? 'aging' : 'stale';
}
export const FRESHNESS_LABEL: Record<Freshness, string> = { never: 'Jamais inventorié', fresh: 'À jour', aging: 'Ancien', stale: 'Périmé' };

export interface Drift { field: string; observed: string; reality: string }
/** Écart entre ce que l'outil a observé et ce qui existe réellement. */
export function driftReport(s: Readonly<State>, a: Asset): Drift[] {
  const d = a.deviceId ? s.reality.devices[a.deviceId] : undefined; const o = a.observed?.data;
  if (!d || !o) return [];
  const rows: Drift[] = []; const cmp = (field: string, ov: unknown, rv: unknown) => { const x = String(ov ?? '—'), y = String(rv ?? '—'); if (x !== y) rows.push({ field, observed: x, reality: y }); };
  cmp('Mémoire (Go)', o.ramGb, d.hardware?.ramGb); cmp('Adresses IP', o.ips.join(', '), d.nics.flatMap(n => (n.ip ? [n.ip] : [])).join(', '));
  cmp('Nombre de logiciels', o.software.length, d.software.length); cmp('Système', o.os?.version, d.os?.version); cmp('Nom d\'hôte', o.hostname, d.name);
  return rows;
}

export function assetForDevice(s: Readonly<State>, deviceId: string): Asset | undefined {
  return Object.values(s.management.assets).find(a => a.deviceId === deviceId);
}
