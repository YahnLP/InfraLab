import type { DomainEvent, Store } from '../../core';
import { clear, h } from '../kit/dom';
import type { OfflineReason } from '../../infra';
import { EVENT_LABEL, REASON_SHORT, fmtTime } from '../shell/labels';

/** Journal des événements + chaîne causale (« Pourquoi ? »). */
export class Dock {
  private picked: string | null = null;
  private names = new Map<string, string>();
  constructor(private root: HTMLElement, private store: Store, private onFocus: (deviceId: string) => void) {
    store.subscribe(() => this.render()); this.render();
  }
  private name(id: string): string { const st = this.store.getState(); return st.reality.devices[id]?.name ?? st.management.assets[id]?.name ?? st.management.users[id]?.name ?? this.names.get(id) ?? id; }
  private describe(e: DomainEvent): string {
    const p = e.payload as Record<string, any>;
    switch (e.type) {
      case 'CableConnected': case 'CableDisconnected': return `${this.name(p['a']?.device)}/${p['a']?.port} ↔ ${this.name(p['b']?.device)}/${p['b']?.port}`;
      case 'IPAddressChanged': return `${p['before']?.ip ?? '—'} → ${p['after']?.ip ?? '—'}`;
      case 'HardwareChanged': return `${p['component']} : ${p['before']} → ${p['after']}`;
      case 'DeviceOffline': return REASON_SHORT[p['reason'] as OfflineReason] ?? '';
      case 'DeviceReplaced': return `${this.name(String(p['oldId']))} → nouvel équipement`;
      case 'ChangeDetected': return `${p['field']} : ${JSON.stringify(p['before'])} → ${JSON.stringify(p['after'])}`;
      case 'AgentInventoryFailed': return String(p['detail'] ?? '');
      case 'NetworkDiscoveryCompleted': return `${p['cidr']} : ${p['found']} trouvé(s), ${p['created']} nouveau(x)`;
      case 'AssetMatched': return `par ${p['by']}`;
      case 'SoftwareInstalled': case 'SoftwareRemoved': return String(p['softwareId']);
      default: return '';
    }
  }
  render(): void {
    const log = this.store.getLog();
    for (const e of log) { const n = e.payload['name']; if (typeof n === 'string') this.names.set(e.subject.id, n); }
    clear(this.root);
    const rows = [...log].reverse().slice(0, 200);
    const list = h('ol', { class: 'events', 'aria-label': 'Événements, du plus récent au plus ancien' },
      ...rows.map(e => h('li', { class: `ev ${['DeviceOffline', 'AgentOffline', 'AgentInventoryFailed'].includes(e.type) ? 'bad' : ['DeviceOnline', 'AgentOnline', 'AgentInventoryCompleted'].includes(e.type) ? 'good' : ''}${this.picked === e.id ? ' picked' : ''}` },
        h('button', { onclick: () => { this.picked = e.id; this.render(); if (e.subject.kind === 'device' && this.store.getState().reality.devices[e.subject.id]) this.onFocus(e.subject.id); } },
          h('time', null, fmtTime(e.t)), h('b', null, EVENT_LABEL[e.type] ?? e.type), h('span', { class: 'who' }, this.name(e.subject.id)), h('span', { class: 'muted' }, this.describe(e))))));
    const chain = this.picked ? this.store.trace(this.picked) : [];
    const why = h('aside', { class: 'why-chain' }, h('h3', null, 'Pourquoi ?'),
      chain.length ? h('ol', null, ...chain.map((e, i) => h('li', { class: e.id === this.picked ? 'cur' : '' }, h('span', { class: 'step' }, i === 0 ? 'Cause' : 'Conséquence'), ` ${EVENT_LABEL[e.type] ?? e.type} — ${this.name(e.subject.id)}`)))
        : h('p', { class: 'muted' }, 'Cliquez sur un événement pour voir ce qui l\'a provoqué et ce qu\'il a entraîné.'));
    this.root.append(rows.length ? list : h('p', { class: 'muted pad' }, 'Aucun événement pour l\'instant. Posez un équipement, branchez un câble, éteignez un switch : tout ce qui change est consigné ici.'), why);
  }
}
