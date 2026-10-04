import type { Asset, State } from '../core';

export interface Identity { macs: string[]; hostname?: string; ips: string[] }

/**
 * Rapprochement d'une observation avec un actif existant : MAC d'abord (identité la plus fiable),
 * puis nom d'hôte, puis adresse IP (la moins fiable : une IP se réattribue).
 * Renvoie aussi le critère retenu, que l'élève peut consulter.
 */
export function matchAsset(s: Readonly<State>, id: Identity): { asset: Asset; by: 'mac' | 'hostname' | 'ip' } | null {
  const assets = Object.values(s.management.assets);
  const byMac = assets.find(a => a.identity.macs.some(m => id.macs.includes(m)));
  if (byMac) return { asset: byMac, by: 'mac' };
  if (id.hostname) { const h = id.hostname.toLowerCase(); const byHost = assets.find(a => a.identity.hostname?.toLowerCase() === h); if (byHost) return { asset: byHost, by: 'hostname' }; }
  const byIp = assets.find(a => a.identity.ips.some(i => id.ips.includes(i)));
  return byIp ? { asset: byIp, by: 'ip' } : null;
}

const OUI_VENDOR: Record<string, string> = {
  '3c:d9:2b': 'HP', '98:fa:9b': 'Intel', 'f0:18:98': 'Apple', '00:15:65': 'Yealink', '00:14:22': 'Dell', '00:11:32': 'Synology',
  '00:1e:8f': 'Canon', '00:25:b3': 'HPE', '52:54:00': 'QEMU/KVM', '00:1b:54': 'Cisco', '00:0d:b4': 'Stormshield', '00:1e:bd': 'Cisco', '00:27:22': 'Ubiquiti',
};
export function vendorFromMac(mac: string): string { return OUI_VENDOR[mac.slice(0, 8).toLowerCase()] ?? 'Inconnu'; }
