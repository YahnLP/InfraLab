import { CIDR, IP, type Asset, type Store } from '../../core';
import { CATALOG, computeReachability } from '../../infra';
import { FRESHNESS_LABEL, HEALTH_LABEL, agentHealth, assetFreshness, driftReport } from '../../inventory';
import { clear, h } from '../kit/dom';
import { EVENT_LABEL, ago, fmtTime } from '../shell/labels';
import { isOpen, ticketPriority, ticketsForAsset } from '../../itsm';
import { newTicketPage, ticketList, ticketPage } from './tickets';

export type Route =
  | { page: 'dashboard' } | { page: 'parc'; filter?: 'all' | 'discovered' | 'inventoried' | 'never' }
  | { page: 'tickets'; kind?: 'incident' | 'request'; scope?: 'open' | 'all' } | { page: 'ticket'; id: string } | { page: 'newticket'; assetId?: string }
  | { page: 'asset'; id: string } | { page: 'agents' } | { page: 'discovery' } | { page: 'users' } | { page: 'logs' };

export interface ItsmHost {
  store: Store; now(): number;
  dispatch(cmd: { type: string; payload?: Record<string, unknown> }): boolean;
  goInfra(deviceId: string): void;
}

const NAV: { page: Route['page']; label: string; group?: string; route?: Route }[] = [
  { page: 'dashboard', label: 'Tableau de bord' },
  { page: 'tickets', label: 'Tickets', group: 'Support', route: { page: 'tickets' } }, { page: 'tickets', label: 'Incidents', group: 'Support', route: { page: 'tickets', kind: 'incident' } }, { page: 'tickets', label: 'Demandes', group: 'Support', route: { page: 'tickets', kind: 'request' } }, { page: 'parc', label: 'Parc', group: 'Parc' },
  { page: 'agents', label: 'Agents', group: 'Inventaire' }, { page: 'discovery', label: 'Découverte réseau', group: 'Inventaire' },
  { page: 'users', label: 'Utilisateurs', group: 'Organisation' }, { page: 'logs', label: 'Journaux', group: 'Administration' },
];

const pill = (cls: string, text: string) => h('span', { class: `pill ${cls}` }, text);
const note = (title: string, ...kids: (string | Node)[]) => h('aside', { class: 'realworld' }, h('strong', null, title), ' ', ...kids);

export class ItsmView {
  route: Route = { page: 'dashboard' };
  private nav = h('nav', { class: 'itsm-nav', 'aria-label': 'Navigation ITSM' });
  private page = h('div', { class: 'itsm-page' });
  private lastCidr = '';

  constructor(private root: HTMLElement, private host: ItsmHost) {
    root.append(this.nav, this.page);
    host.store.subscribe(() => { if (!root.hidden) this.render(); });
  }
  go(r: Route): void { this.route = r; this.render(); this.page.scrollTop = 0; }

  render(): void {
    clear(this.nav);
    let group = '';
    for (const n of NAV) {
      if (n.group !== group) { group = n.group ?? ''; if (group) this.nav.append(h('h3', null, group)); }
      const r = this.route; const nr = n.route ?? { page: n.page } as Route;
      const on = r.page === 'ticket' || r.page === 'newticket' ? nr.page === 'tickets' && !('kind' in nr) : r.page === 'tickets' ? nr.page === 'tickets' && (nr as { kind?: string }).kind === r.kind : r.page === n.page || (r.page === 'asset' && n.page === 'parc');
      this.nav.append(h('button', { class: on ? 'on' : '', 'aria-current': on ? 'page' : null, onclick: () => this.go(nr) }, n.label));
    }
    clear(this.page);
    const r = this.route;
    const c = { st: this.st, host: this.host, go: (x: Route) => this.go(x) };
    this.page.append(r.page === 'tickets' ? ticketList(c, r) : r.page === 'ticket' ? ticketPage(c, r.id) : r.page === 'newticket' ? newTicketPage(c, r.assetId) : r.page === 'dashboard' ? this.dashboard() : r.page === 'parc' ? this.parc(r.filter ?? 'all') : r.page === 'asset' ? this.asset(r.id)
      : r.page === 'agents' ? this.agents() : r.page === 'discovery' ? this.discovery() : r.page === 'users' ? this.users() : this.logs());
  }

  /* ---------------- données ---------------- */
  private get st() { return this.host.store.getState(); }
  private assets(): Asset[] { return Object.values(this.st.management.assets); }
  /** Équipements qui existent dans l'infrastructure mais qu'aucun actif ne représente. */
  private unknownDevices() {
    const known = new Set(this.assets().map(a => a.deviceId)); return Object.values(this.st.reality.devices).filter(d => CATALOG[d.kind].role !== 'internet' && !known.has(d.id));
  }

  /* ---------------- pages ---------------- */
  private dashboard(): HTMLElement {
    const a = this.assets(); const now = this.host.now();
    const inv = a.filter(x => x.observed); const disc = a.filter(x => !x.observed);
    const stale = inv.filter(x => assetFreshness(x, now) !== 'fresh');
    const agentsDown = Object.values(this.st.reality.devices).filter(d => d.agent.state === 'running' && agentHealth(this.st, d) === 'unreachable');
    const unknown = this.unknownDevices();
    const open = Object.values(this.st.management.tickets).filter(isOpen);
    const urgent = open.filter(t => (ticketPriority(t) ?? 9) <= 2); const toQualify = open.filter(t => t.status === 'new');
    const tile = (n: number, label: string, to: Route, warn = false) => h('button', { class: `tile${warn && n > 0 ? ' warn' : ''}`, onclick: () => this.go(to) }, h('b', null, String(n)), h('span', null, label));
    return h('section', null, h('h1', null, 'Tableau de bord'),
      h('div', { class: 'tiles' },
        tile(open.length, 'tickets à traiter', { page: 'tickets' }), tile(toQualify.length, 'tickets à qualifier', { page: 'tickets' }, true), tile(urgent.length, 'tickets P1 / P2', { page: 'tickets' }, true),
        tile(a.length, 'actifs connus de l\'outil', { page: 'parc' }),
        tile(disc.length, 'découverts, pas inventoriés', { page: 'parc', filter: 'never' }, true),
        tile(inv.length, 'inventoriés par un agent', { page: 'parc', filter: 'inventoried' }),
        tile(agentsDown.length, 'agents injoignables', { page: 'agents' }, true),
        tile(stale.length, 'inventaires anciens ou périmés', { page: 'parc', filter: 'inventoried' }, true),
        tile(unknown.length, 'équipements inconnus de l\'outil', { page: 'discovery' }, true)),
      unknown.length ? h('div', { class: 'callout' }, h('strong', null, 'Présents dans l\'infrastructure, absents de l\'outil : '), unknown.map(d => d.name).join(', '), '. ',
        h('button', { class: 'link', onclick: () => this.go({ page: 'discovery' }) }, 'Lancer une découverte')) : null,
      note('Dans les outils réels', 'un tableau de bord ITSM agrège le parc (Assets / Computers), les agents (inventory agents) et les alertes. Ici, comparez toujours ce qu\'il affiche avec le schéma de l\'infrastructure.'));
  }

  private parc(filter: 'all' | 'discovered' | 'inventoried' | 'never'): HTMLElement {
    const now = this.host.now(); let list = this.assets();
    if (filter === 'inventoried') list = list.filter(x => x.observed); if (filter === 'never' || filter === 'discovered') list = list.filter(x => !x.observed);
    const chip = (f: typeof filter, label: string) => h('button', { class: `chip${filter === f ? ' on' : ''}`, onclick: () => this.go({ page: 'parc', filter: f }) }, label);
    const unknown = this.unknownDevices();
    return h('section', null, h('h1', null, 'Parc'),
      h('div', { class: 'chips' }, chip('all', 'Tous'), chip('never', 'Découverts seulement'), chip('inventoried', 'Inventoriés')),
      list.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Nom', 'Statut', 'Adresse IP', 'Système', 'Agent', 'Dernier inventaire'].map(t => h('th', null, t)))),
        h('tbody', null, ...list.map(a => {
          const d = a.deviceId ? this.st.reality.devices[a.deviceId] : undefined; const fr = assetFreshness(a, now);
          return h('tr', { class: 'row', tabindex: 0, onclick: () => this.go({ page: 'asset', id: a.id }), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') this.go({ page: 'asset', id: a.id }); } },
            h('td', null, h('b', null, a.name)), h('td', null, a.observed ? pill('on', 'Inventorié') : pill('warn', 'Découvert')),
            h('td', null, h('code', null, a.observed?.data.ips[0] ?? a.discovery?.ip ?? '—')),
            h('td', null, a.observed?.data.os ? `${a.observed.data.os.name} ${a.observed.data.os.version}` : h('span', { class: 'muted' }, 'inconnu')),
            h('td', null, d && d.agent.state !== 'none' ? HEALTH_LABEL[agentHealth(this.st, d)] : h('span', { class: 'muted' }, 'aucun')),
            h('td', null, a.observed ? h('span', { class: fr === 'fresh' ? '' : 'stale' }, `${ago(now, a.observed.t)} · ${FRESHNESS_LABEL[fr]}`) : h('span', { class: 'muted' }, 'jamais')));
        }))) : h('p', { class: 'empty' }, 'L\'outil ne connaît encore aucun actif. Il apprend l\'existence d\'un équipement par la découverte réseau, ou par la remontée d\'un agent.'),
      unknown.length ? h('div', { class: 'callout' }, h('strong', null, `${unknown.length} équipement(s) du schéma inconnu(s) de l'outil : `), unknown.map(d => d.name).join(', ')) : null,
      note('Dans les outils réels', 'actif = Asset / IT Asset / Computer / Equipment ; « Découvert » = Discovered / Unmanaged ; « Inventorié » = Managed / Inventoried.'));
  }

  private asset(id: string): HTMLElement {
    const a = this.st.management.assets[id]; if (!a) return h('section', null, h('p', { class: 'empty' }, 'Cet actif n\'existe plus.'), h('button', { onclick: () => this.go({ page: 'parc' }) }, 'Retour au parc'));
    const now = this.host.now(); const d = a.deviceId ? this.st.reality.devices[a.deviceId] : undefined; const o = a.observed?.data; const fr = assetFreshness(a, now);
    const kv = (k: string, v: string | Node) => h('div', { class: 'kv' }, h('dt', null, k), h('dd', null, v));
    const drift = driftReport(this.st, a);
    const field = (key: 'inventoryNo' | 'serial' | 'vendor' | 'model' | 'service', label: string) => h('label', { class: 'fld' }, h('span', null, label), h('input', { type: 'text', name: key, value: a[key] ?? '', autocomplete: 'off' }));
    const form = h('form', { class: 'declared', onsubmit: (e: Event) => {
      e.preventDefault(); const fd = new FormData(e.target as HTMLFormElement); const fields: Record<string, unknown> = {};
      for (const k of ['inventoryNo', 'serial', 'vendor', 'model', 'service']) fields[k] = String(fd.get(k) ?? '');
      this.host.dispatch({ type: 'itsm.updateAsset', payload: { id: a.id, fields } });
    } }, field('inventoryNo', 'N° d\'inventaire'), field('serial', 'N° de série'), field('vendor', 'Constructeur'), field('model', 'Modèle'), field('service', 'Service'), h('button', { type: 'submit' }, 'Enregistrer'));
    const users = Object.values(this.st.management.users);
    const assign = h('select', { 'aria-label': 'Utilisateur affecté', onchange: () => this.host.dispatch({ type: 'itsm.assignAsset', payload: { id: a.id, user: assign.value || null } }) },
      h('option', { value: '' }, '(personne)'), ...users.map(u => h('option', { value: u.id, ...(a.assignedTo === u.id ? { selected: true } : {}) }, u.name)));
    return h('section', null,
      h('p', null, h('button', { class: 'link', onclick: () => this.go({ page: 'parc' }) }, '← Parc')),
      h('header', { class: 'asset-head' }, h('h1', null, a.name), a.observed ? pill('on', 'Inventorié') : pill('warn', 'Découvert'),
        d ? h('button', { onclick: () => this.host.goInfra(d.id) }, 'Voir dans l\'infrastructure') : pill('down', 'Équipement introuvable dans l\'infrastructure')),
      h('div', { class: 'cols' },
        h('div', null,
          h('h2', null, 'Identité (utilisée pour le rapprochement)'),
          h('dl', null, kv('Adresses MAC', a.identity.macs.join(', ') || '—'), kv('Nom d\'hôte', a.identity.hostname ?? '—'), kv('Adresses IP', a.identity.ips.join(', ') || '—')),
          h('h2', null, 'Découverte réseau'),
          a.discovery ? h('dl', null, kv('Vu', `${fmtTime(a.discovery.t)} (${ago(now, a.discovery.t)})`), kv('Constructeur (d\'après la MAC)', a.discovery.vendor), kv('Adresse', `${a.discovery.ip} · ${a.discovery.mac}`)) : h('p', { class: 'muted' }, 'Jamais vu par une découverte.'),
          h('h2', null, 'Inventaire remonté par l\'agent'),
          o ? h('div', null, h('p', { class: 'muted' }, `Source : agent ${o.agentVersion} · ${fmtTime(a.observed!.t)} (${ago(now, a.observed!.t)}) · ${FRESHNESS_LABEL[fr]}`),
            h('dl', null, kv('Système', o.os ? `${o.os.name} ${o.os.version}` : '—'), kv('Processeur', o.cpu ?? '—'), kv('Mémoire', o.ramGb !== undefined ? `${o.ramGb} Go` : '—'),
              kv('Disques', o.disks?.map(x => `${x.gb} Go ${x.type.toUpperCase()}`).join(' + ') ?? '—'), kv('Logiciels', `${o.software.length}`), kv('Utilisateur connecté', o.loggedUser ?? '—')))
            : h('p', { class: 'empty' }, 'Aucune donnée détaillée : cet équipement n\'a jamais remonté d\'inventaire. Installez un agent (vue Infrastructure) puis forcez une remontée.')),
        h('div', null,
          h('h2', null, 'Écart avec la réalité'),
          !o ? h('p', { class: 'muted' }, 'Comparaison impossible sans inventaire.') : drift.length
            ? h('div', null, h('table', { class: 'grid small' }, h('thead', null, h('tr', null, h('th', null, 'Donnée'), h('th', null, 'Ce que l\'outil sait'), h('th', null, 'Réalité'))),
                h('tbody', null, ...drift.map(r => h('tr', null, h('td', null, r.field), h('td', null, r.observed), h('td', { class: 'diff' }, r.reality))))),
              h('p', { class: 'muted' }, 'L\'outil se met à jour à la prochaine remontée de l\'agent.')) : h('p', { class: 'muted' }, 'L\'outil est à jour : ce qu\'il sait correspond à la réalité.'),
          h('h2', null, 'Tickets liés'), this.assetTickets(a),
          h('h2', null, 'Données déclarées (saisies à la main)'), form,
          h('label', { class: 'fld' }, h('span', null, 'Utilisateur affecté'), assign))),
      note('Dans les outils réels', 'les valeurs « observées » viennent de l\'agent (GLPI Agent, SCCM, Intune…) et ne se saisissent pas ; les valeurs « déclarées » (n° d\'inventaire, contrat, service) sont renseignées par le gestionnaire de parc.'));
  }

  private assetTickets(a: Asset): HTMLElement {
    const all = ticketsForAsset(this.st, a.id, false);
    return h('div', null, all.length ? h('ul', { class: 'tkl' }, ...all.map(t => h('li', null, h('button', { class: 'link', onclick: () => this.go({ page: 'ticket', id: t.id }) }, t.ref), ` ${t.title} `, h('span', { class: 'muted' }, `· ${isOpen(t) ? 'ouvert' : 'terminé'}`)))) : h('p', { class: 'muted' }, 'Aucun ticket sur cet actif : c\'est l\'historique du poste.'),
      h('button', { onclick: () => this.go({ page: 'newticket', assetId: a.id }) }, 'Créer un ticket'));
  }

  private agents(): HTMLElement {
    const now = this.host.now(); const devs = Object.values(this.st.reality.devices).filter(d => d.agent.state !== 'none');
    return h('section', null, h('h1', null, 'Agents'),
      devs.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Hôte', 'État', 'Version', 'Dernière remontée', 'Prochaine', 'Erreurs'].map(t => h('th', null, t)))),
        h('tbody', null, ...devs.map(d => { const hl = agentHealth(this.st, d);
          return h('tr', { class: 'row', tabindex: 0, onclick: () => this.host.goInfra(d.id) }, h('td', null, h('b', null, d.name)),
            h('td', null, pill(hl === 'ok' ? 'on' : hl === 'stopped' || hl === 'outdated' ? 'warn' : 'down', HEALTH_LABEL[hl])), h('td', null, d.agent.version ?? '—'),
            h('td', null, d.agent.lastRun !== undefined ? ago(now, d.agent.lastRun) : 'jamais'), h('td', null, d.agent.nextRun !== undefined ? fmtTime(d.agent.nextRun) : '—'),
            h('td', null, d.agent.errors.join(' ; ') || '—')); }))) : h('p', { class: 'empty' }, 'Aucun agent installé. Les agents s\'installent sur les équipements, dans la vue Infrastructure.'),
      h('p', { class: 'muted' }, 'Cliquer sur une ligne ouvre l\'équipement dans l\'infrastructure.'),
      note('Dans les outils réels', 'l\'agent s\'exécute sur le poste et contacte périodiquement le serveur (GLPI Agent, FusionInventory, client SCCM). Un agent injoignable laisse l\'inventaire se périmer sans prévenir personne.'));
  }

  private discovery(): HTMLElement {
    const srv = this.st.reality.itsmServerId ? this.st.reality.devices[this.st.reality.itsmServerId] : undefined;
    const srvIp = srv?.nics.find(n => n.ip)?.ip; if (!this.lastCidr) this.lastCidr = srvIp ? `${srvIp.split('.').slice(0, 3).join('.')}.0/24` : '192.168.10.0/24';
    const input = h('input', { type: 'text', value: this.lastCidr, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Plage à scanner' });
    const found = this.assets().filter(a => a.discovery); const log = [...this.host.store.getLog()].reverse().find(e => e.type === 'NetworkDiscoveryCompleted');
    const rows = found.sort((x, y) => (IP.parse(x.discovery!.ip) ?? 0) - (IP.parse(y.discovery!.ip) ?? 0));
    const reach = computeReachability(this.st); void CIDR;
    return h('section', null, h('h1', null, 'Découverte réseau'),
      h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); this.lastCidr = input.value.trim(); this.host.dispatch({ type: 'inventory.discover', payload: { cidr: this.lastCidr } }); } },
        h('label', { class: 'fld' }, h('span', null, 'Plage (CIDR)'), input), h('button', { type: 'submit', class: 'primary' }, 'Scanner')),
      log ? h('p', { class: 'muted' }, `Dernier scan : ${fmtTime(log.t)} — ${String(log.payload['cidr'])} : ${String(log.payload['found'])} équipement(s) répondent, ${String(log.payload['created'])} nouveau(x).`) : null,
      rows.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Adresse IP', 'Nom', 'Adresse MAC', 'Constructeur', 'Dans l\'outil'].map(t => h('th', null, t)))),
        h('tbody', null, ...rows.map(a => h('tr', { class: 'row', tabindex: 0, onclick: () => this.go({ page: 'asset', id: a.id }) }, h('td', null, h('code', null, a.discovery!.ip)), h('td', null, h('b', null, a.discovery!.hostname)),
          h('td', null, h('code', null, a.discovery!.mac)), h('td', null, a.discovery!.vendor), h('td', null, a.observed ? pill('on', 'Inventorié') : pill('warn', 'Découvert seulement')))))) : h('p', { class: 'empty' }, 'Aucun résultat. Lancez un scan : seuls les équipements allumés, reliés au serveur et dotés d\'une adresse IP dans la plage répondent.'),
      h('div', { class: 'callout' }, h('strong', null, 'Découverte ≠ inventaire. '), 'Découvrir, c\'est constater que l\'équipement existe (IP, MAC, nom). Inventorier, c\'est disposer d\'informations détaillées et exploitables (matériel, système, logiciels) : cela demande un agent ou un accès à l\'équipement.',
        reach && srv ? '' : ''),
      note('Dans les outils réels', 'discovery, network scan, probe (ServiceNow Discovery, GLPI Network Discovery, Lansweeper scan…) : ICMP, ARP, SNMP. Un switch non géré, sans IP, reste invisible.'));
  }

  private users(): HTMLElement {
    const users = Object.values(this.st.management.users); const name = h('input', { type: 'text', placeholder: 'Prénom Nom', 'aria-label': 'Nom' }); const svc = h('input', { type: 'text', placeholder: 'Service', 'aria-label': 'Service' });
    return h('section', null, h('h1', null, 'Utilisateurs'),
      users.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Nom', 'Service', 'Actifs affectés'].map(t => h('th', null, t)))),
        h('tbody', null, ...users.map(u => h('tr', null, h('td', null, h('b', null, u.name)), h('td', null, u.service ?? '—'), h('td', null, this.assets().filter(a => a.assignedTo === u.id).map(a => a.name).join(', ') || '—'))))) : h('p', { class: 'empty' }, 'Aucun utilisateur.'),
      h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); if (this.host.dispatch({ type: 'itsm.addUser', payload: { name: name.value, service: svc.value } })) { /* re-rendu par l'abonnement */ } } },
        h('label', { class: 'fld' }, h('span', null, 'Nouvel utilisateur'), name), h('label', { class: 'fld' }, h('span', null, 'Service'), svc), h('button', { type: 'submit' }, 'Ajouter')));
  }

  private logs(): HTMLElement {
    const log = [...this.host.store.getLog()].reverse().slice(0, 300); const st = this.st;
    const nm = (id: string) => st.management.tickets[id]?.ref ?? st.reality.devices[id]?.name ?? st.management.assets[id]?.name ?? st.management.users[id]?.name ?? id;
    return h('section', null, h('h1', null, 'Journaux'),
      log.length ? h('table', { class: 'grid small' }, h('thead', null, h('tr', null, ...['Heure simulée', 'Événement', 'Objet', 'Origine'].map(t => h('th', null, t)))),
        h('tbody', null, ...log.map(e => h('tr', null, h('td', null, h('code', null, fmtTime(e.t))), h('td', null, EVENT_LABEL[e.type] ?? e.type), h('td', null, nm(e.subject.id)), h('td', null, e.actor === 'user' ? 'utilisateur' : e.actor === 'agent' ? 'agent' : 'système'))))) : h('p', { class: 'empty' }, 'Aucun événement.'),
      note('Dans les outils réels', 'journaux d\'audit (Logs / History / Audit trail) : qui a fait quoi, quand. Ils servent à la traçabilité et aux TP d\'audit.'));
  }
}
