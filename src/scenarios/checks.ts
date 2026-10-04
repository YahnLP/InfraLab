import { rolesOf, type DomainEvent, type State } from '../core';
import { agentHealth, assetForDevice, driftReport } from '../inventory';
import { isBusinessTime, isOpen, contractState, forbiddenInstalls, licenseReport, licensesForSoftware, slaOf, ticketPriority } from '../itsm';
import { resolveRefs } from './resolve';
import type { Check } from './types';

export function runCheck(st: Readonly<State>, events: readonly DomainEvent[], raw: Check, now = 0): boolean {
  const c = resolveRefs(st, raw);
  const dev = (id: string) => st.reality.devices[id];
  switch (c.k) {
    case 'deviceOnline': { const d = dev(c.device); return !!d && d.online === (c.value ?? true); }
    case 'devicePowered': { const d = dev(c.device); return !!d && d.powered === (c.value ?? true); }
    case 'agentHealth': { const d = dev(c.device); return !!d && agentHealth(st, d) === c.is; }
    case 'assetExists': return !!assetForDevice(st, c.device);
    case 'assetInventoried': return !!assetForDevice(st, c.device)?.observed;
    case 'assetInSync': { const a = assetForDevice(st, c.device); return !!a?.observed && driftReport(st, a).length === 0; }
    case 'ticket': {
      const t = st.management.tickets[c.ref]; if (!t) return false;
      if (c.status && t.status !== c.status) return false;
      if (c.qualified !== undefined && !!(t.category && t.impact && t.urgency) !== c.qualified) return false;
      if (c.category && t.category !== c.category) return false;
      if (c.impact && t.impact !== c.impact) return false;
      if (c.urgency && t.urgency !== c.urgency) return false;
      if (c.priority && ticketPriority(t) !== c.priority) return false;
      if (c.assignee && t.assignee !== c.assignee) return false;
      if (c.solutionMin !== undefined && (t.solution?.trim().length ?? 0) < c.solutionMin) return false;
      if (c.minComments !== undefined && t.comments.length < c.minComments) return false;
      if (c.subcategory && t.subcategory !== c.subcategory) return false;
      if (c.reached && !events.some(e => e.type === 'TicketStatusChanged' && e.subject.id === t.id && e.payload['to'] === c.reached)) return false;
      if (c.requester && t.requester !== c.requester) return false;
      if (c.descMin !== undefined && t.description.trim().length < c.descMin) return false;
      if (c.linkedAsset && !t.assetIds.includes(c.linkedAsset)) return false;
      if (c.noOtherAsset && c.linkedAsset && t.assetIds.some(a => a !== c.linkedAsset)) return false;
      if (c.kind && t.kind !== c.kind) return false;
      if (c.hasSolution !== undefined && !!t.solution?.trim() !== c.hasSolution) return false;
      if (c.linkedDevice) { const a = assetForDevice(st, c.linkedDevice); if (!a || !t.assetIds.includes(a.id)) return false; }
      return true;
    }
    case 'license': { const l = licensesForSoftware(st, c.software); if (!l.length) return false; return !c.state || l.every(x => licenseReport(st, x, now).state === c.state); }
    case 'policy': return st.management.softwarePolicy[c.software] === c.is;
    case 'softwareInstalled': { const d = dev(c.device); return !!d && d.software.some(x => x.softwareId === c.software) === (c.value ?? true); }
    case 'forbiddenCount': return forbiddenInstalls(st).length <= c.max;
    case 'contract': { const x = st.management.contracts[c.ref]; if (!x) return false; return (!c.state || contractState(x, now) === c.state) && (!c.coversAsset || x.assetIds.includes(c.coversAsset)); }
    case 'asset': {
      const a = st.management.assets[c.asset]; if (!a) return false;
      const ev = (type: string, f: (e: DomainEvent) => boolean) => events.some(e => e.type === type && e.subject.id === a.id && f(e));
      if (c.reached) {
        // Vérification « a atteint » : l'historique fait foi, l'état courant a pu évoluer depuis.
        if (!ev('AssetStatusChanged', e => e.payload['to'] === c.reached)) return false;
        if (c.assignedTo && !ev('AssetAssigned', e => e.payload['user'] === c.assignedTo)) return false;
        if (c.unassigned && !ev('AssetAssigned', e => e.payload['user'] === null)) return false;
        return !c.status || a.status === c.status;
      }
      if (c.status && a.status !== c.status) return false; if (c.assignedTo && a.assignedTo !== c.assignedTo) return false; if (c.unassigned && a.assignedTo) return false;
      return true;
    }
    case 'deviceUser': return dev(c.device)?.loggedUser === c.user;
    case 'ci': { const x = st.management.cis[c.name]; return !!x && (!c.ciKind || x.kind === c.ciKind) && (c.withAsset === undefined || !!x.assetId === c.withAsset); }
    case 'relation': return Object.values(st.management.relations).some(r => r.from === c.from && r.to === c.to && (!c.type || r.type === c.type));
    case 'answer': return !!st.session?.answers[c.question]?.correct;
    case 'sla': { const t = st.management.tickets[c.ticket]; const sl = t && slaOf(t, now, st.management.settings.slaCalendar); return !!sl && (!c.respond || sl.respond.state === c.respond) && (!c.resolve || sl.resolve.state === c.resolve) && (!c.resolveNot || sl.resolve.state !== c.resolveNot); }
    case 'problem': {
      const x = st.management.problems[c.ref]; if (!x) return false;
      if (c.reached && !events.some(e => e.type === 'ProblemStatusChanged' && e.subject.id === x.id && e.payload['to'] === c.reached)) return false;
      return (!c.status || x.status === c.status) && (c.minTickets === undefined || x.ticketIds.length >= c.minTickets) && (c.hasRootCause === undefined || !!x.rootCause?.trim() === c.hasRootCause)
        && (c.hasWorkaround === undefined || !!x.workaround?.trim() === c.hasWorkaround) && (c.hasFix === undefined || !!x.permanentFix?.trim() === c.hasFix);
    }
    case 'change': {
      const x = st.management.changes[c.ref]; if (!x) return false;
      if (c.status && x.status !== c.status) return false; if (c.type && x.type !== c.type) return false; if (c.approver && x.approver !== c.approver) return false;
      if (c.reached && !events.some(e => e.type === 'ChangeStatusChanged' && e.subject.id === x.id && e.payload['to'] === c.reached)) return false;
      if (c.linkedDevice) { const a = assetForDevice(st, c.linkedDevice); if (!a || !x.assetIds.includes(a.id)) return false; }
      if (c.linkedAsset && !x.assetIds.includes(c.linkedAsset)) return false;
      return true;
    }
    case 'article': {
      const x = st.management.articles[c.ref]; if (!x) return false;
      if (c.status && x.status !== c.status) return false; if (c.category && x.category !== c.category) return false; if (c.sourceTicket && x.sourceTicketId !== c.sourceTicket) return false;
      return c.minTickets === undefined || Object.values(st.management.tickets).filter(t => t.articleIds?.includes(x.id)).length >= c.minTickets;
    }
    case 'newDevices': {
      const ids = events.filter(e => e.type === 'DeviceAdded' && (!c.kind || e.payload['kind'] === c.kind)).map(e => e.subject.id).filter(id => st.reality.devices[id]);
      return ids.filter(id => !c.unmanaged || !Object.values(st.management.assets).some(a => a.deviceId === id)).length >= c.min;
    }
    case 'cabled': return events.filter(e => e.type === 'CableConnected').length >= c.min;
    case 'assetData': {
      const a = st.management.assets[c.asset]; if (!a) return false;
      if ((c.has ?? []).some(k => { const v = (a as unknown as Record<string, unknown>)[k]; return v === undefined || v === '' || v === null; })) return false;
      if (c.observed !== undefined && !!a.observed !== c.observed) return false;
      return c.cost === undefined || a.cost === c.cost;
    }
    case 'acting': return st.actingAs === c.user;
    case 'actedAs': return events.some(e => e.type === 'ActorChanged' && e.payload['user'] === c.user);
    case 'didAs': return events.some(e => e.type === c.type && e.actorId === c.user && Object.entries(c.payload ?? {}).every(([k, v]) => e.payload[k] === v));
    case 'userActive': return !!st.management.users[c.user] && !st.management.users[c.user]!.disabled === c.value;
    case 'userRoles': { const u = st.management.users[c.user]; return !!u && (c.has ?? []).every(r => u.roles.includes(r)) && (c.lacks ?? []).every(r => !u.roles.includes(r)); }
    case 'rolePerm': return !!st.management.roles[c.role] && st.management.roles[c.role]!.permissions.includes(c.permission) === c.value;
    case 'roleExists': { const r = st.management.roles[c.role]; return !!r && (c.has ?? []).every(x => r.permissions.includes(x)) && (c.lacks ?? []).every(x => !r.permissions.includes(x)); }
    case 'noOpenAssigned': return !Object.values(st.management.tickets).some(t => t.assignee === c.user && isOpen(t));
    case 'changeWindow': { const x = st.management.changes[c.ref]; if (!x || x.scheduledAt === undefined) return false; return (!c.outsideBusinessHours || !isBusinessTime(x.scheduledAt)) && (!c.reachedByNow || now >= x.scheduledAt); }
    case 'slaCalendar': return st.management.settings.slaCalendar === c.is;
    case 'vmHost': { const v = dev(c.vm); return !!v && (c.host === null ? !v.hostId : v.hostId === c.host); }
    case 'group': { const g = Object.values(st.management.groups).find(x => x.name === c.name); return !!g && (c.members ?? []).every(m => g.members.includes(m)) && (c.roles ?? []).every(r => g.roles.includes(r)); }
    case 'ticketGroup': { const t = st.management.tickets[c.ref]; return !!t?.groupId && st.management.groups[t.groupId]?.name === c.group; }
    case 'effectiveRole': return rolesOf(st, c.user, now).has(c.role) === c.value;
    case 'delegation': return Object.values(st.management.delegations).some(d => d.from === c.from && d.to === c.to && d.role === c.role && (!c.state || (c.state === 'active' ? !d.revoked && d.startAt <= now && now < d.endAt : d.revoked || now >= d.endAt)));
    case 'event': return events.some(e => e.type === c.type && (!c.subject || e.subject.id === c.subject));
    case 'all': return c.of.every(x => runCheck(st, events, x, now));
  }
}
