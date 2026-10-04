import { DAY, type Asset, type Contract, type License, type State } from '../core';
import { SOFTWARE } from '../infra';

export const ASSET_STATUS_LABEL: Record<Asset['status'], string> = { ordered: 'Commandé', discovered: 'Découvert', stock: 'En stock', in_use: 'En service', repair: 'En réparation', retired: 'Retiré' };

export interface AssetTransition { from: Asset['status']; to: Asset['status']; label: string; guard?: (a: Asset, user?: string) => string | null }
export const ASSET_TRANSITIONS: AssetTransition[] = [
  { from: 'ordered', to: 'stock', label: 'Réceptionner' },
  { from: 'discovered', to: 'in_use', label: 'Mettre en service', guard: (a, u) => a.assignedTo || u ? null : 'Affectez un utilisateur : un actif en service a un utilisateur.' },
  { from: 'discovered', to: 'stock', label: 'Mettre en stock' },
  { from: 'stock', to: 'in_use', label: 'Affecter et mettre en service', guard: (a, u) => a.assignedTo || u ? null : 'Choisissez l\'utilisateur à qui affecter l\'actif.' },
  { from: 'in_use', to: 'repair', label: 'Envoyer en réparation' },
  { from: 'repair', to: 'in_use', label: 'Remettre en service' },
  { from: 'in_use', to: 'stock', label: 'Restituer au stock' },
  { from: 'repair', to: 'stock', label: 'Remettre en stock' },
  { from: 'stock', to: 'retired', label: 'Retirer (fin de vie)' },
  { from: 'repair', to: 'retired', label: 'Retirer (irréparable)' },
];
export const assetTransitionsFrom = (s: Asset['status']): AssetTransition[] => ASSET_TRANSITIONS.filter(t => t.from === s);

/* ---------------- Logiciels et licences ---------------- */
/** Installations connues de l'outil (remontées par les agents). */
export function installsKnown(st: Readonly<State>, softwareId: string): Asset[] {
  return Object.values(st.management.assets).filter(a => a.observed?.data.software.some(s => s.softwareId === softwareId));
}
/** Installations réelles (la vérité du terrain, que l'outil ne connaît pas forcément). */
export function installsReal(st: Readonly<State>, softwareId: string): number {
  return Object.values(st.reality.devices).filter(d => d.software.some(s => s.softwareId === softwareId)).length;
}
export type Compliance = 'compliant' | 'over' | 'unknown';
export interface LicenseReport { entitled: number; known: number; real: number; gap: number; state: Compliance; expired: boolean }
/** Conformité calculée sur ce que l'outil sait ; l'écart avec la réalité est signalé à part. */
export function licenseReport(st: Readonly<State>, lic: License, now: number): LicenseReport {
  const known = installsKnown(st, lic.softwareId).length; const real = installsReal(st, lic.softwareId);
  const expired = lic.expiresAt !== undefined && lic.expiresAt <= now; const entitled = expired ? 0 : lic.quantity;
  const gap = known - entitled;
  return { entitled: lic.quantity, known, real, gap, state: gap > 0 ? 'over' : 'compliant', expired };
}
export const licensesForSoftware = (st: Readonly<State>, softwareId: string): License[] => Object.values(st.management.licenses).filter(l => l.softwareId === softwareId);
/** Installations connues d'un logiciel interdit. */
export function forbiddenInstalls(st: Readonly<State>): { softwareId: string; asset: Asset }[] {
  return Object.entries(st.management.softwarePolicy).filter(([, p]) => p === 'forbidden').flatMap(([sid]) => installsKnown(st, sid).map(asset => ({ softwareId: sid, asset })));
}
export const softwareName = (id: string): string => SOFTWARE[id]?.name ?? id;

/* ---------------- Contrats ---------------- */
export type ContractState = 'active' | 'expiring' | 'expired';
export const EXPIRY_WINDOW = 30 * DAY;
export const contractState = (c: Contract, now: number): ContractState => c.endAt <= now ? 'expired' : c.endAt - now <= EXPIRY_WINDOW ? 'expiring' : 'active';
export const CONTRACT_STATE_LABEL: Record<ContractState, string> = { active: 'Actif', expiring: 'Échéance proche', expired: 'Expiré' };
export const CONTRACT_KIND_LABEL: Record<Contract['kind'], string> = { maintenance: 'Maintenance', licence: 'Licence', warranty: 'Garantie', leasing: 'Location' };
export type WarrantyState = 'none' | 'valid' | 'expiring' | 'expired';
export function warrantyState(a: Asset, now: number): WarrantyState { return a.warrantyEnd === undefined ? 'none' : a.warrantyEnd <= now ? 'expired' : a.warrantyEnd - now <= EXPIRY_WINDOW ? 'expiring' : 'valid'; }
/** Contrats qui couvrent un actif. */
export const contractsForAsset = (st: Readonly<State>, assetId: string): Contract[] => Object.values(st.management.contracts).filter(c => c.assetIds.includes(assetId));
