import { CIDR, CommandError, IP, nextId, type Asset, type CommandContext, type Device, type Store } from '../core';
import { CATALOG, computeReachability } from '../infra';
import { AGENT_DEFAULT_INTERVAL, AGENT_FIRST_RUN_DELAY, AGENT_RETRY_DELAY, AGENT_VERSION_CURRENT, agentHealth, expectedServerUrl } from './agent';
import { collect, diffReports } from './collector';
import { IEV } from './events';
import { matchAsset, vendorFromMac } from './reconcile';

const ref = (id: string) => ({ kind: 'device' as const, id });
const aref = (id: string) => ({ kind: 'asset' as const, id });
const dev = (ctx: CommandContext, id: unknown): Device => {
  const d = ctx.state.reality.devices[String(id)];
  if (!d) throw new CommandError('device_not_found', `Équipement inconnu : ${String(id)}`);
  return d;
};
function log(ctx: CommandContext, d: Device, level: 'info' | 'warn' | 'error', msg: string): void {
  d.agent.logs.push({ t: ctx.now, level, msg }); if (d.agent.logs.length > 40) d.agent.logs.shift();
}

/** Remontée d'inventaire d'un agent : lit la réalité, rapproche avec un actif, détecte les changements. */
function runInventory(ctx: CommandContext, d: Device, trigger: 'forced' | 'scheduled'): void {
  const prevActor = ctx.actor; ctx.actor = 'agent';
  const health = agentHealth(ctx.state, d);
  const fail = (reason: string, code: string) => {
    if (!d.agent.errors.includes(reason)) d.agent.errors.push(reason);
    d.agent.nextRun = ctx.now + AGENT_RETRY_DELAY;
    log(ctx, d, 'error', `Inventaire (${trigger === 'forced' ? 'manuel' : 'planifié'}) en échec : ${reason}`);
    ctx.emit(IEV.AgentInventoryFailed, ref(d.id), { reason: code, detail: reason });
  };
  if (health === 'unreachable') fail('serveur ITSM injoignable', 'unreachable');
  else if (health === 'misconfigured') fail(`URL du serveur incorrecte (${d.agent.serverUrl ?? 'aucune'}), attendu ${expectedServerUrl(ctx.state) ?? '?'}`, 'misconfigured');
  else {
    const report = collect(ctx.state, d);
    const m = matchAsset(ctx.state, { macs: report.macs, hostname: report.hostname, ips: report.ips });
    let asset: Asset; const changes = [] as ReturnType<typeof diffReports>;
    if (m) {
      asset = m.asset;
      if (asset.observed) changes.push(...diffReports(asset.observed.data, report));
      else if (asset.identity.macs.length && JSON.stringify([...asset.identity.macs].sort()) !== JSON.stringify([...report.macs].sort())) changes.push({ field: 'macs', before: asset.identity.macs, after: report.macs });
      ctx.emit(IEV.AssetMatched, aref(asset.id), { by: m.by, device: d.id });
    } else {
      const id = nextId(ctx.state.counters, 'ast');
      asset = { id, name: report.hostname, status: 'in_use', createdAt: ctx.now, identity: { macs: [], ips: [] } };
      ctx.state.management.assets[id] = asset;
      ctx.emit(IEV.AssetCreated, aref(id), { name: asset.name, source: 'agent' });
    }
    asset.deviceId = d.id; asset.name = report.hostname;
    asset.identity = { macs: [...report.macs], hostname: report.hostname, ips: [...report.ips] };
    if (asset.status === 'discovered') asset.status = 'in_use';
    asset.observed = { t: ctx.now, source: 'agent', data: report };
    d.agent.lastRun = ctx.now; d.agent.nextRun = ctx.now + (d.agent.intervalMs || AGENT_DEFAULT_INTERVAL); d.agent.errors = [];
    log(ctx, d, 'info', `Inventaire ${trigger === 'forced' ? 'manuel' : 'planifié'} envoyé (${report.software.length} logiciels).`);
    ctx.emit(IEV.AgentInventoryCompleted, aref(asset.id), { device: d.id, changes: changes.length, trigger });
    for (const c of changes) ctx.emit(IEV.ChangeDetected, aref(asset.id), { field: c.field, before: c.before, after: c.after });
  }
  ctx.actor = prevActor;
}

export function registerInventoryCommands(store: Store): void {
  /* ---------- cycle de vie de l'agent ---------- */
  store.registerCommand('agent.install', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (!CATALOG[d.kind].agentCapable) throw new CommandError('agent_unsupported', `Aucun agent n'existe pour ${CATALOG[d.kind].label.toLowerCase()} : ${d.name} ne peut être inventorié que par découverte réseau.`);
    if (!d.powered) throw new CommandError('device_off', `${d.name} est éteint : impossible d'installer l'agent`);
    if (d.agent.state !== 'none') throw new CommandError('agent_exists', `Un agent est déjà installé sur ${d.name}`);
    d.agent = { state: 'running', version: String(p['version'] ?? AGENT_VERSION_CURRENT), serverUrl: String(p['serverUrl'] ?? expectedServerUrl(ctx.state) ?? 'http://itsm.local/inventory'),
      intervalMs: AGENT_DEFAULT_INTERVAL, nextRun: ctx.now + AGENT_FIRST_RUN_DELAY, errors: [], logs: [] };
    log(ctx, d, 'info', `Agent ${d.agent.version} installé, cible ${d.agent.serverUrl}.`);
    ctx.emit(IEV.AgentInstalled, ref(d.id), { version: d.agent.version });
  });
  store.registerCommand('agent.uninstall', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.agent.state === 'none') throw new CommandError('no_agent', `${d.name} n'a pas d'agent`);
    d.agent = { state: 'none', intervalMs: 0, errors: [], logs: [] };
    ctx.emit(IEV.AgentUninstalled, ref(d.id));
  });
  store.registerCommand('agent.start', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.agent.state === 'none') throw new CommandError('no_agent', `${d.name} n'a pas d'agent`);
    if (d.agent.state === 'running') throw new CommandError('already_running', 'L\'agent est déjà démarré');
    if (!d.powered) throw new CommandError('device_off', `${d.name} est éteint`);
    d.agent.state = 'running'; d.agent.nextRun = ctx.now + AGENT_FIRST_RUN_DELAY; log(ctx, d, 'info', 'Agent démarré.');
    ctx.emit(IEV.AgentStarted, ref(d.id));
  });
  store.registerCommand('agent.stop', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.agent.state !== 'running') throw new CommandError('not_running', 'L\'agent n\'est pas démarré');
    d.agent.state = 'stopped'; delete d.agent.nextRun; log(ctx, d, 'warn', 'Agent arrêté.');
    ctx.emit(IEV.AgentStopped, ref(d.id));
  });
  store.registerCommand('agent.configure', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.agent.state === 'none') throw new CommandError('no_agent', `${d.name} n'a pas d'agent`);
    if (p['serverUrl'] !== undefined) d.agent.serverUrl = String(p['serverUrl']);
    if (p['version'] !== undefined) d.agent.version = String(p['version']); // utilisé par les scénarios (agent obsolète)
    if (p['intervalMs'] !== undefined) d.agent.intervalMs = Number(p['intervalMs']);
    d.agent.errors = []; log(ctx, d, 'info', `Configuration modifiée (cible ${d.agent.serverUrl}).`);
    ctx.emit(IEV.AgentConfigured, ref(d.id), { serverUrl: d.agent.serverUrl, version: d.agent.version });
  });
  store.registerCommand('agent.update', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.agent.state === 'none') throw new CommandError('no_agent', `${d.name} n'a pas d'agent`);
    d.agent.version = AGENT_VERSION_CURRENT; log(ctx, d, 'info', `Agent mis à jour en ${AGENT_VERSION_CURRENT}.`);
    ctx.emit(IEV.AgentConfigured, ref(d.id), { version: d.agent.version });
  });

  /* ---------- remontées ---------- */
  store.registerCommand('agent.runInventory', (ctx, p) => {
    const d = dev(ctx, p['id']);
    if (d.agent.state !== 'running') throw new CommandError('agent_not_running', d.agent.state === 'none' ? `${d.name} n'a pas d'agent : rien ne peut être remonté` : 'L\'agent est arrêté');
    if (!d.powered) throw new CommandError('device_off', `${d.name} est éteint`);
    runInventory(ctx, d, 'forced');
  });
  /** Appelé par le temps simulé : lance les remontées échues. */
  store.registerCommand('agent.tick', ctx => {
    for (const d of Object.values(ctx.state.reality.devices)) {
      if (d.agent.state === 'running' && d.powered && d.agent.nextRun !== undefined && d.agent.nextRun <= ctx.now) runInventory(ctx, d, 'scheduled');
    }
  });
  store.registerCommand('agent.markUnreachable', (ctx, p) => {
    const d = dev(ctx, p['id']); if (d.agent.state !== 'running') return;
    const prev = ctx.actor; ctx.actor = 'agent';
    log(ctx, d, 'error', 'Serveur ITSM injoignable.');
    ctx.emit(IEV.AgentOffline, ref(d.id), { reason: p['reason'] ?? 'unreachable' }); ctx.actor = prev;
  });
  store.registerCommand('agent.markReachable', (ctx, p) => {
    const d = dev(ctx, p['id']); if (d.agent.state !== 'running') return;
    const prev = ctx.actor; ctx.actor = 'agent';
    log(ctx, d, 'info', 'Connexion au serveur ITSM rétablie.');
    ctx.emit(IEV.AgentOnline, ref(d.id)); ctx.actor = prev;
    if (d.agent.errors.length > 0 || (d.agent.nextRun !== undefined && d.agent.nextRun <= ctx.now)) runInventory(ctx, d, 'scheduled'); // remontée de rattrapage dès que la connexion revient
  });

  /* ---------- découverte réseau ---------- */
  store.registerCommand('inventory.discover', (ctx, p) => {
    const cidr = CIDR.parse(String(p['cidr']));
    if (!cidr) throw new CommandError('bad_cidr', `Plage invalide : ${String(p['cidr'])} (attendu : 192.168.10.0/24)`);
    if (cidr.prefix < 16) throw new CommandError('cidr_too_large', 'Plage trop large pour ce laboratoire (minimum /16)');
    const probe = ctx.state.reality.itsmServerId ? ctx.state.reality.devices[ctx.state.reality.itsmServerId] : undefined;
    if (!probe) throw new CommandError('no_probe', 'Aucun serveur ITSM désigné : la découverte part de lui');
    if (!probe.online) throw new CommandError('probe_offline', `${probe.name} est hors ligne : il ne peut pas scanner`);
    const reach = computeReachability(ctx.state);
    const prev = ctx.actor; ctx.actor = 'system';
    const wanted = new Set(CIDR.hosts(cidr)); let created = 0, matched = 0, found = 0;
    for (const d of Object.values(ctx.state.reality.devices)) {
      if (!reach[d.id]?.online) continue; // équipement éteint ou injoignable : ne répond pas au scan
      const nic = d.nics.find(n => n.ip && wanted.has(IP.parse(n.ip) ?? -1)); if (!nic?.ip) continue;
      found++;
      const sighting = { t: ctx.now, ip: nic.ip, mac: nic.mac, hostname: d.name, vendor: vendorFromMac(nic.mac) };
      const m = matchAsset(ctx.state, { macs: [nic.mac], hostname: d.name, ips: [nic.ip] });
      if (m) {
        matched++; m.asset.discovery = sighting; m.asset.deviceId = d.id;
        if (!m.asset.identity.macs.includes(nic.mac) && !m.asset.observed) m.asset.identity.macs.push(nic.mac);
        if (!m.asset.identity.ips.includes(nic.ip)) m.asset.identity.ips.push(nic.ip);
        ctx.emit(IEV.AssetMatched, aref(m.asset.id), { by: m.by, device: d.id });
      } else {
        const id = nextId(ctx.state.counters, 'ast'); created++;
        ctx.state.management.assets[id] = { id, name: d.name, deviceId: d.id, status: 'discovered', createdAt: ctx.now, identity: { macs: [nic.mac], hostname: d.name, ips: [nic.ip] }, discovery: sighting };
        ctx.emit(IEV.AssetCreated, aref(id), { name: d.name, source: 'discovery' });
      }
    }
    ctx.emit(IEV.NetworkDiscoveryCompleted, { kind: 'device', id: probe.id }, { cidr: String(p['cidr']), found, created, matched });
    ctx.actor = prev;
  });

  /* ---------- réactions : l'infrastructure informe l'agent ---------- */
  store.registerReactor('DeviceOffline', (e, s) => s.reality.devices[e.subject.id]?.agent.state === 'running' ? [{ type: 'agent.markUnreachable', payload: { id: e.subject.id, reason: e.payload['reason'] } }] : []);
  store.registerReactor('DeviceOnline', (e, s) => s.reality.devices[e.subject.id]?.agent.state === 'running' ? [{ type: 'agent.markReachable', payload: { id: e.subject.id } }] : []);
}
