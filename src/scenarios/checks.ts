import type { DomainEvent, State } from '../core';
import { agentHealth, assetForDevice, driftReport } from '../inventory';
import { ticketPriority } from '../itsm';
import { resolveRefs } from './resolve';
import type { Check } from './types';

export function runCheck(st: Readonly<State>, events: readonly DomainEvent[], raw: Check): boolean {
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
      if (c.hasSolution !== undefined && !!t.solution?.trim() !== c.hasSolution) return false;
      if (c.linkedDevice) { const a = assetForDevice(st, c.linkedDevice); if (!a || !t.assetIds.includes(a.id)) return false; }
      return true;
    }
    case 'event': return events.some(e => e.type === c.type && (!c.subject || e.subject.id === c.subject));
    case 'all': return c.of.every(x => runCheck(st, events, x));
  }
}
