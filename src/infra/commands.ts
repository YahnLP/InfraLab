import { CommandError, IP, MAC, nextId, type CommandContext, type Device, type DeviceKind, type Store } from '../core';
import { CATALOG, portsOf } from './catalog';
import { SOFTWARE } from './software';
import { computeReachability, linksOf, portInUse } from './connectivity';
import { EV } from './events';

const dev = (ctx: CommandContext, id: unknown): Device => {
  const d = ctx.state.reality.devices[String(id)];
  if (!d) throw new CommandError('device_not_found', `Équipement inconnu : ${String(id)}`);
  return d;
};
const ref = (id: string) => ({ kind: 'device' as const, id });

/** Compare la joignabilité avant/après et émet DeviceOnline/DeviceOffline pour chaque équipement dont l'état change. */
function syncReachability(ctx: CommandContext): void {
  const reach = computeReachability(ctx.state);
  for (const d of Object.values(ctx.state.reality.devices)) {
    const r = reach[d.id]; if (!r) continue;
    if (r.online !== d.online) {
      d.online = r.online;
      ctx.emit(r.online ? EV.DeviceOnline : EV.DeviceOffline, ref(d.id), r.online ? {} : { reason: r.reason ?? 'no_path' });
    }
  }
}

function makeDevice(ctx: CommandContext, kind: DeviceKind, name: string | undefined, x: number, y: number): Device {
  const spec = CATALOG[kind];
  const id = nextId(ctx.state.counters, 'dev');
  const nameCounter = nextId(ctx.state.counters, `name:${spec.prefix}`, 2).split('-')[1];
  const ports = portsOf(kind);
  return {
    id, name: name ?? `${spec.prefix}-${nameCounter}`, kind, powered: true, online: false, ports,
    pos: { x, y },
    nics: (spec.role === 'endpoint' ? ports.map(p => p.id) : spec.role === 'internet' ? [] : ['mgmt'])
      .map(nid => ({ id: nid, mac: MAC.make(spec.oui, ctx.state.counters['mac'] = (ctx.state.counters['mac'] ?? 0) + 1) })),
    ...(spec.hardware ? { hardware: structuredClone(spec.hardware) } : {}),
    ...(spec.os ? { os: { ...spec.os } } : {}),
    software: [], agent: { state: 'none', intervalMs: 0, errors: [], logs: [] },
  };
}

export function registerInfraCommands(store: Store): void {
  store.registerCommand('infra.addDevice', (ctx, p) => {
    const kind = String(p['kind']) as DeviceKind;
    if (!CATALOG[kind]) throw new CommandError('bad_kind', `Type d'équipement inconnu : ${kind}`);
    const d = makeDevice(ctx, kind, p['name'] ? String(p['name']) : undefined, Number(p['x'] ?? 0), Number(p['y'] ?? 0));
    if (p['site']) d.site = String(p['site']);
    ctx.state.reality.devices[d.id] = d;
    ctx.emit(EV.DeviceAdded, ref(d.id), { name: d.name, kind });
    syncReachability(ctx);
  });

  store.registerCommand('infra.moveDevice', (ctx, p) => {
    const d = dev(ctx, p['id']); d.pos = { x: Number(p['x']), y: Number(p['y']) };
    // pas d'événement : un déplacement sur le schéma n'a pas de conséquence de gestion
  });

  store.registerCommand('infra.removeDevice', (ctx, p) => {
    const d = dev(ctx, p['id']);
    for (const lid of linksOf(ctx.state, d.id)) {
      const l = ctx.state.reality.links[lid]!; delete ctx.state.reality.links[lid];
      ctx.emit(EV.CableDisconnected, ref(l.a.device === d.id ? l.b.device : l.a.device), { link: lid, a: l.a, b: l.b, reason: 'device_removed' });
    }
    delete ctx.state.reality.devices[d.id];
    if (ctx.state.reality.itsmServerId === d.id) ctx.state.reality.itsmServerId = null;
    ctx.emit(EV.DeviceRemoved, ref(d.id), { name: d.name });
    syncReachability(ctx);
  });

  store.registerCommand('infra.connect', (ctx, p) => {
    const a = dev(ctx, p['aDevice']), b = dev(ctx, p['bDevice']);
    const ap = String(p['aPort']), bp = String(p['bPort']);
    if (a.id === b.id) throw new CommandError('same_device', 'Impossible de relier un équipement à lui-même');
    if (!a.ports.some(x => x.id === ap)) throw new CommandError('port_not_found', `Port inconnu : ${a.name}/${ap}`);
    if (!b.ports.some(x => x.id === bp)) throw new CommandError('port_not_found', `Port inconnu : ${b.name}/${bp}`);
    if (portInUse(ctx.state, a.id, ap)) throw new CommandError('port_busy', `Port déjà utilisé : ${a.name}/${ap}`);
    if (portInUse(ctx.state, b.id, bp)) throw new CommandError('port_busy', `Port déjà utilisé : ${b.name}/${bp}`);
    const wifi = ap === 'wifi' || bp === 'wifi';
    if (wifi && !(ap === 'wifi' && bp === 'wifi')) throw new CommandError('medium_mismatch', 'Un port Wi-Fi ne se relie qu\'à un autre port Wi-Fi');
    const id = nextId(ctx.state.counters, 'lnk');
    ctx.state.reality.links[id] = { id, a: { device: a.id, port: ap }, b: { device: b.id, port: bp }, medium: wifi ? 'wifi' : 'copper' };
    ctx.emit(EV.CableConnected, ref(a.id), { link: id, a: { device: a.id, port: ap }, b: { device: b.id, port: bp } });
    syncReachability(ctx);
  });

  store.registerCommand('infra.disconnect', (ctx, p) => {
    const l = ctx.state.reality.links[String(p['link'])];
    if (!l) throw new CommandError('link_not_found', `Lien inconnu : ${String(p['link'])}`);
    delete ctx.state.reality.links[l.id];
    ctx.emit(EV.CableDisconnected, ref(l.a.device), { link: l.id, a: l.a, b: l.b });
    syncReachability(ctx);
  });

  store.registerCommand('infra.powerOff', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (!d.powered) throw new CommandError('already_off', `${d.name} est déjà éteint`);
    d.powered = false; ctx.emit(EV.DevicePoweredOff, ref(d.id), { name: d.name });
    syncReachability(ctx);
  });
  store.registerCommand('infra.powerOn', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.powered) throw new CommandError('already_on', `${d.name} est déjà allumé`);
    d.powered = true; ctx.emit(EV.DevicePoweredOn, ref(d.id), { name: d.name });
    syncReachability(ctx);
  });

  store.registerCommand('infra.setIp', (ctx, p) => {
    const d = dev(ctx, p['id']);
    const nic = d.nics.find(n => n.id === String(p['nic'] ?? d.nics[0]?.id));
    if (!nic) throw new CommandError('nic_not_found', `${d.name} n'a pas d'interface IP`);
    const ip = p['ip'] === null || p['ip'] === '' ? undefined : String(p['ip']);
    if (ip !== undefined && IP.parse(ip) === null) throw new CommandError('bad_ip', `Adresse IP invalide : ${ip}`);
    const mask = p['mask'] === undefined ? nic.mask : Number(p['mask']);
    if (mask !== undefined && (!Number.isInteger(mask) || mask < 0 || mask > 32)) throw new CommandError('bad_mask', 'Préfixe de masque invalide (0 à 32)');
    const gw = p['gw'] === undefined ? nic.gw : (p['gw'] === null || p['gw'] === '' ? undefined : String(p['gw']));
    if (gw !== undefined && IP.parse(gw) === null) throw new CommandError('bad_ip', `Passerelle invalide : ${gw}`);
    const before = { ip: nic.ip, mask: nic.mask, gw: nic.gw };
    delete nic.ip; delete nic.mask; delete nic.gw;
    if (ip !== undefined) nic.ip = ip;
    if (mask !== undefined) nic.mask = mask;
    if (gw !== undefined) nic.gw = gw;
    ctx.emit(EV.IPAddressChanged, ref(d.id), { nic: nic.id, before, after: { ip: nic.ip, mask: nic.mask, gw: nic.gw } });
    syncReachability(ctx);
  });

  store.registerCommand('infra.addRam', (ctx, p) => {
    const d = dev(ctx, p['id']); const gb = Number(p['gb']);
    if (!d.hardware || d.hardware.ramGb === undefined) throw new CommandError('no_ram', `${d.name} n'a pas de RAM modifiable`);
    if (!Number.isFinite(gb) || gb === 0) throw new CommandError('bad_value', 'Quantité de RAM invalide');
    const before = d.hardware.ramGb; d.hardware.ramGb = Math.max(1, before + gb);
    ctx.emit(EV.HardwareChanged, ref(d.id), { component: 'ram', before, after: d.hardware.ramGb });
  });

  store.registerCommand('infra.installSoftware', (ctx, p) => {
    const d = dev(ctx, p['id']); const softwareId = String(p['softwareId']);
    if (!SOFTWARE[softwareId]) throw new CommandError('software_unknown', `Logiciel inconnu : ${softwareId}`);
    if (!CATALOG[d.kind].agentCapable) throw new CommandError('no_software', `${d.name} n'accepte pas l'installation de logiciels`);
    if (d.software.some(x => x.softwareId === softwareId)) throw new CommandError('already_installed', `${SOFTWARE[softwareId]!.name} est déjà installé sur ${d.name}`);
    const version = String(p['version'] ?? SOFTWARE[softwareId]!.version);
    d.software.push({ softwareId, version });
    ctx.emit(EV.SoftwareInstalled, ref(d.id), { softwareId, version });
  });
  store.registerCommand('infra.uninstallSoftware', (ctx, p) => {
    const d = dev(ctx, p['id']); const i = d.software.findIndex(x => x.softwareId === String(p['softwareId']));
    if (i < 0) throw new CommandError('not_installed', 'Logiciel non installé');
    const [gone] = d.software.splice(i, 1);
    ctx.emit(EV.SoftwareRemoved, ref(d.id), { softwareId: gone!.softwareId });
  });
  store.registerCommand('infra.setLoggedUser', (ctx, p) => {
    const d = dev(ctx, p['id']); const u = p['user'] ? String(p['user']) : undefined;
    if (u !== undefined && !ctx.state.management.users[u]) throw new CommandError('user_not_found', `Utilisateur inconnu : ${u}`);
    if (u === undefined) delete d.loggedUser; else d.loggedUser = u;
    ctx.emit(EV.UserSessionChanged, ref(d.id), { user: u ?? null });
  });

  store.registerCommand('infra.setItsmServer', (ctx, p) => {
    const d = dev(ctx, p['id']);
    ctx.state.reality.itsmServerId = d.id;
    ctx.emit(EV.ItsmServerSet, ref(d.id), { name: d.name });
    syncReachability(ctx);
  });

  /** Remplacement : nouvel équipement du même type, même nom/position/IP/ports câblés ; nouvelle adresse MAC. */
  store.registerCommand('infra.replaceDevice', (ctx, p) => {
    const old = dev(ctx, p['id']);
    const fresh = makeDevice(ctx, old.kind, old.name, old.pos.x, old.pos.y);
    if (old.site) fresh.site = old.site; if (old.room) fresh.room = old.room;
    fresh.nics.forEach(n => { const o = old.nics.find(x => x.id === n.id); if (o) { if (o.ip) n.ip = o.ip; if (o.mask !== undefined) n.mask = o.mask; if (o.gw) n.gw = o.gw; if (o.vlan !== undefined) n.vlan = o.vlan; } });
    fresh.software = structuredClone(old.software); // simplification : le disque est cloné, les logiciels suivent
    ctx.state.reality.devices[fresh.id] = fresh;
    for (const l of Object.values(ctx.state.reality.links)) {
      for (const end of [l.a, l.b]) if (end.device === old.id) {
        if (fresh.ports.some(x => x.id === end.port)) end.device = fresh.id; else delete ctx.state.reality.links[l.id];
      }
    }
    delete ctx.state.reality.devices[old.id];
    if (ctx.state.reality.itsmServerId === old.id) ctx.state.reality.itsmServerId = fresh.id;
    ctx.emit(EV.DeviceReplaced, ref(fresh.id), { oldId: old.id, newId: fresh.id, name: fresh.name });
    syncReachability(ctx);
  });
}
