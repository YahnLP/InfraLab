import { CIDR, IP, type Device, type Nic, type State } from '../core';
import { CATALOG } from './catalog';

export type OfflineReason = 'powered_off' | 'no_link' | 'no_ip' | 'no_path' | 'wrong_subnet';

export interface ReachInfo {
  powered: boolean;
  /** Au moins un lien physique actif (câble branché, deux extrémités alimentées). */
  linkUp: boolean;
  /** Joignable par l'outil ITSM (dérivé). */
  online: boolean;
  reason?: OfflineReason;
}

export function linkIsUp(s: Readonly<State>, linkId: string): boolean {
  const l = s.reality.links[linkId]; if (!l) return false;
  const a = s.reality.devices[l.a.device], b = s.reality.devices[l.b.device];
  return !!a && !!b && a.powered && b.powered;
}

export function linksOf(s: Readonly<State>, deviceId: string): string[] {
  return Object.values(s.reality.links).filter(l => l.a.device === deviceId || l.b.device === deviceId).map(l => l.id);
}

export function portInUse(s: Readonly<State>, deviceId: string, portId: string): boolean {
  return Object.values(s.reality.links).some(l => (l.a.device === deviceId && l.a.port === portId) || (l.b.device === deviceId && l.b.port === portId));
}

const role = (d: Device) => CATALOG[d.kind].role;
const primaryIp = (d: Device) => d.nics.find(n => n.ip);

function inSameSubnet(a: Nic, b: Nic | undefined): boolean {
  if (!b || !a.ip || !b.ip || a.mask === undefined || b.mask === undefined) return false;
  const ia = IP.parse(a.ip), ib = IP.parse(b.ip);
  if (ia === null || ib === null) return false;
  return CIDR.contains({ ip: ia, mask: IP.maskFromPrefix(a.mask), prefix: a.mask }, ib)
      && CIDR.contains({ ip: ib, mask: IP.maskFromPrefix(b.mask), prefix: b.mask }, ia);
}

/**
 * Joignabilité, fonction pure de l'état.
 *  - Sans serveur ITSM désigné : « en ligne » = alimenté et au moins un lien actif.
 *  - Avec serveur : parcours en largeur depuis le serveur ; seuls les équipements de commutation, de routage
 *    et Internet relaient le trafic (un poste ne sert pas de pont). Un poste doit avoir une IP, et soit être
 *    dans le même sous-réseau que le serveur, soit avoir une passerelle ET un routeur/pare-feu sur le chemin.
 * Simplification pédagogique assumée : pas de VLAN ni de table de routage ; on ne modélise que ce qui
 * explique « pourquoi l'outil voit (ou ne voit plus) cet équipement ».
 */
export function computeReachability(s: Readonly<State>): Record<string, ReachInfo> {
  const devs = s.reality.devices;
  const adj = new Map<string, string[]>();
  for (const l of Object.values(s.reality.links)) {
    if (!linkIsUp(s, l.id)) continue;
    (adj.get(l.a.device) ?? adj.set(l.a.device, []).get(l.a.device)!).push(l.b.device);
    (adj.get(l.b.device) ?? adj.set(l.b.device, []).get(l.b.device)!).push(l.a.device);
  }
  const out: Record<string, ReachInfo> = {};
  const serverId = s.reality.itsmServerId;
  const server = serverId ? devs[serverId] : undefined;

  // best[d] = true si atteint par au moins un chemin traversant un routeur ; 'flat' = chemin sans routeur
  const flat = new Set<string>(), routed = new Set<string>();
  if (server && server.powered) {
    const seen = new Set<string>(); const q: Array<[string, boolean, string]> = [[server.id, false, '']];
    seen.add(server.id + '|0'); flat.add(server.id);
    while (q.length) {
      const [id, viaRouter, prev] = q.shift()!;
      const d = devs[id]!;
      // seul un équipement de relais (ou le serveur lui-même au départ) transmet plus loin
      if (id !== server.id && role(d) === 'endpoint') continue;
      for (const n of adj.get(id) ?? []) {
        const nd = devs[n]; if (!nd) continue;
        if (n === prev) continue; // pas de demi-tour : un routeur n'est pas un « pont » vers le côté d'où l'on vient
        const flag = viaRouter || (id !== server.id && role(d) === 'routing');
        const key = n + (flag ? '|1' : '|0');
        if (seen.has(key)) continue; seen.add(key);
        (flag ? routed : flat).add(n);
        q.push([n, flag, id]);
      }
    }
  }

  const srvNic = server ? primaryIp(server) : undefined;
  for (const d of Object.values(devs)) {
    const linkUp = (adj.get(d.id)?.length ?? 0) > 0;
    const info: ReachInfo = { powered: d.powered, linkUp, online: false };
    if (!d.powered) { info.reason = 'powered_off'; out[d.id] = info; continue; }
    if (!server) { info.online = linkUp || role(d) === 'internet'; if (!info.online) info.reason = 'no_link'; out[d.id] = info; continue; }
    if (d.id === server.id) { info.online = true; out[d.id] = info; continue; }
    if (!flat.has(d.id) && !routed.has(d.id)) { info.reason = linkUp ? 'no_path' : 'no_link'; out[d.id] = info; continue; }
    if (role(d) === 'endpoint') {
      const nic = primaryIp(d);
      if (!nic) { info.reason = 'no_ip'; out[d.id] = info; continue; }
      const sameSubnet = inSameSubnet(nic, srvNic);
      const ok = (sameSubnet && (flat.has(d.id) || routed.has(d.id))) || (!!nic.gw && routed.has(d.id));
      if (!ok) { info.reason = 'wrong_subnet'; out[d.id] = info; continue; }
    }
    info.online = true; out[d.id] = info;
  }
  return out;
}
