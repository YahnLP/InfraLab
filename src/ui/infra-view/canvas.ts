import type { Device, DeviceKind, Store } from '../../core';
import { CATALOG, computeReachability, linkIsUp, portInUse } from '../../infra';
import { agentHealth } from '../../inventory';
import { clear, h, s, svgFromString } from '../kit/dom';
import { glyph } from './icons';

export type Selection = { kind: 'device' | 'link'; id: string } | null;
export type Tool = 'select' | 'cable';

export interface CanvasHost {
  store: Store;
  dispatch(cmd: { type: string; payload?: Record<string, unknown> }): boolean;
  onSelect(sel: Selection): void;
  hint(msg: string): void;
}

const NODE = 72; // taille d'un nœud (px monde)
const snap = (n: number): number => Math.round(n / 8) * 8;

/** Affichage SVG du modèle : le canvas ne possède AUCUNE donnée métier, il projette `reality`. */
export class InfraCanvas {
  readonly svg: SVGSVGElement;
  private world: SVGGElement; private gZones: SVGGElement; private gLinks: SVGGElement; private gNodes: SVGGElement; private gRubber: SVGGElement;
  private view = { x: 40, y: 40, k: 1 };
  private tool: Tool = 'select';
  private placing: DeviceKind | null = null;
  private sel: Selection = null;
  private cable: { device: string; port: string } | null = null;
  private mouse = { x: 0, y: 0 };
  private dragPos = new Map<string, { x: number; y: number }>();
  private popover: HTMLElement | null = null;
  private hasFitted = false;

  constructor(private host: CanvasHost, private stage: HTMLElement) {
    this.svg = s('svg', { class: 'canvas', role: 'application', 'aria-label': 'Schéma de l\'infrastructure' });
    this.world = s('g'); this.gZones = s('g'); this.gLinks = s('g'); this.gNodes = s('g'); this.gRubber = s('g');
    this.world.append(this.gZones, this.gLinks, this.gRubber, this.gNodes);
    const grid = s('pattern', { id: 'grid', width: 32, height: 32, patternUnits: 'userSpaceOnUse' }, s('path', { d: 'M32 0H0V32', fill: 'none', stroke: 'var(--grid)', 'stroke-width': 1 }));
    this.svg.append(s('defs', null, grid), s('rect', { width: '100%', height: '100%', fill: 'url(#grid)', 'data-bg': '1' }), this.world);
    stage.append(this.svg);
    this.bind();
    host.store.subscribe(() => this.render());
    new ResizeObserver(() => { if (!this.hasFitted && this.stage.clientWidth > 0) this.fit(); }).observe(stage);
    this.applyView(); this.render();
  }

  /* ------------------------------------------------ API */
  setTool(t: Tool): void { this.tool = t; this.cable = null; this.closePopover(); clear(this.gRubber); this.svg.dataset['tool'] = t; this.hintForTool(); }
  getTool(): Tool { return this.tool; }
  arm(kind: DeviceKind | null): void { this.placing = kind; this.svg.classList.toggle('placing', !!kind); if (kind) this.host.hint(`Cliquez sur le schéma pour poser : ${CATALOG[kind].label}`); else this.hintForTool(); }
  select(sel: Selection): void { this.sel = sel; this.render(); this.host.onSelect(sel); }
  getSelection(): Selection { return this.sel; }
  /** Centre la vue sur un équipement (passerelle future « Voir dans l'infrastructure »). */
  focusDevice(id: string): void {
    const d = this.host.store.getState().reality.devices[id]; if (!d) return;
    this.view.x = this.stage.clientWidth / 2 - d.pos.x * this.view.k; this.view.y = this.stage.clientHeight / 2 - d.pos.y * this.view.k;
    this.applyView(); this.select({ kind: 'device', id });
  }
  fit(): void {
    const devs = Object.values(this.host.store.getState().reality.devices);
    const W = this.stage.clientWidth, H = this.stage.clientHeight; if (!W || !H) return;
    this.hasFitted = true;
    if (!devs.length) { this.view = { x: 40, y: 40, k: 1 }; this.applyView(); return; }
    const xs = devs.map(d => d.pos.x), ys = devs.map(d => d.pos.y);
    const minX = Math.min(...xs) - 90, maxX = Math.max(...xs) + 90, minY = Math.min(...ys) - 90, maxY = Math.max(...ys) + 100;
    const k = Math.max(0.35, Math.min(1.4, Math.min(W / (maxX - minX), H / (maxY - minY))));
    this.view = { k, x: (W - (maxX + minX) * k) / 2, y: (H - (maxY + minY) * k) / 2 };
    this.applyView();
  }

  /* ------------------------------------------------ rendu */
  private pos(d: Device): { x: number; y: number } { return this.dragPos.get(d.id) ?? d.pos; }
  private applyView(): void { this.world.setAttribute('transform', `translate(${this.view.x} ${this.view.y}) scale(${this.view.k})`); }

  render(): void {
    const st = this.host.store.getState();
    const reach = computeReachability(st);
    clear(this.gNodes);
    for (const d of Object.values(st.reality.devices)) {
      const r = reach[d.id]; const p = this.pos(d);
      const status = !d.powered ? 'off' : d.online ? 'on' : 'down';
      const isServer = st.reality.itsmServerId === d.id;
      const sel = this.sel?.kind === 'device' && this.sel.id === d.id;
      const g = s('g', { class: `node ${status}${sel ? ' sel' : ''}`, transform: `translate(${p.x} ${p.y})`, 'data-id': d.id, tabindex: 0, role: 'button',
        'aria-label': `${d.name}, ${CATALOG[d.kind].label}, ${status === 'on' ? 'en ligne' : status === 'off' ? 'éteint' : 'hors ligne'}` },
        s('title', null, `${d.name} — ${CATALOG[d.kind].label}${r && !r.online ? '' : ''}`),
        s('rect', { class: 'card', x: -NODE / 2, y: -NODE / 2, width: NODE, height: NODE, rx: 12 }),
        s('g', { class: 'glyph', fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        s('text', { class: 'label', y: NODE / 2 + 16, 'text-anchor': 'middle' }, d.name),
        s('circle', { class: 'dot', cx: NODE / 2 - 4, cy: -NODE / 2 + 4, r: 7 }),
        status === 'down' ? s('path', { class: 'dotmark', d: `M${NODE / 2 - 7} ${-NODE / 2 + 1}l6 6M${NODE / 2 - 1} ${-NODE / 2 + 1}l-6 6` }) : null,
        status === 'on' ? s('path', { class: 'dotmark', d: `M${NODE / 2 - 7} ${-NODE / 2 + 4}l2 3 4-5` }) : null,
        d.agent.state !== 'none' ? s('g', { class: `agent ${agentHealth(st, d)}` }, s('title', null, `Agent : ${agentHealth(st, d)}`), s('circle', { cx: -NODE / 2 + 11, cy: NODE / 2 - 11, r: 9 }), s('text', { x: -NODE / 2 + 11, y: NODE / 2 - 7.5, 'text-anchor': 'middle' }, 'A')) : null,
        isServer ? s('g', null, s('rect', { class: 'badge', x: -NODE / 2, y: -NODE / 2 - 8, width: 34, height: 16, rx: 8 }), s('text', { class: 'badgetxt', x: -NODE / 2 + 17, y: -NODE / 2 + 3, 'text-anchor': 'middle' }, 'ITSM')) : null,
      );
      g.querySelector('.glyph')!.append(svgFromString(glyph(d.kind)));
      this.gNodes.append(g);
    }
    this.renderLinks();
    if (this.sel?.kind === 'device' && !st.reality.devices[this.sel.id]) { this.sel = null; this.host.onSelect(null); }
    if (this.sel?.kind === 'link' && !st.reality.links[this.sel.id]) { this.sel = null; this.host.onSelect(null); }
    this.svg.classList.toggle('empty', Object.keys(st.reality.devices).length === 0);
  }

  private renderLinks(): void {
    const st = this.host.store.getState();
    clear(this.gLinks);
    for (const l of Object.values(st.reality.links)) {
      const a = st.reality.devices[l.a.device], b = st.reality.devices[l.b.device]; if (!a || !b) continue;
      const pa = this.pos(a), pb = this.pos(b); const up = linkIsUp(st, l.id);
      const sel = this.sel?.kind === 'link' && this.sel.id === l.id;
      const focusDev = this.sel?.kind === 'device' && (this.sel.id === a.id || this.sel.id === b.id);
      const g = s('g', { class: `link ${up ? 'up' : 'down'} ${l.medium}${sel ? ' sel' : ''}`, 'data-link': l.id },
        s('line', { class: 'hit', x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }),
        s('line', { class: 'wire', x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }));
      if (sel || focusDev) {
        const lab = (p: { x: number; y: number }, q: { x: number; y: number }, text: string) => {
          const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1; const t = Math.min(56, len / 2.4);
          return s('text', { class: 'portlabel', x: p.x + (dx / len) * (t + 18), y: p.y + (dy / len) * (t + 18) - 4, 'text-anchor': 'middle' }, text);
        };
        g.append(lab(pa, pb, l.a.port), lab(pb, pa, l.b.port));
      }
      this.gLinks.append(g);
    }
  }

  /* ------------------------------------------------ interactions */
  private toWorld(cx: number, cy: number): { x: number; y: number } {
    const r = this.svg.getBoundingClientRect(); return { x: (cx - r.left - this.view.x) / this.view.k, y: (cy - r.top - this.view.y) / this.view.k };
  }
  private nodeIdAt(t: EventTarget | null): string | null { return (t as Element | null)?.closest?.('.node')?.getAttribute('data-id') ?? null; }
  private linkIdAt(t: EventTarget | null): string | null { return (t as Element | null)?.closest?.('.link')?.getAttribute('data-link') ?? null; }

  private bind(): void {
    const svg = this.svg;
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      const k = Math.max(0.25, Math.min(2.5, this.view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      this.view.x = mx - (mx - this.view.x) * (k / this.view.k); this.view.y = my - (my - this.view.y) * (k / this.view.k); this.view.k = k; this.applyView();
    }, { passive: false });

    svg.addEventListener('pointermove', e => { this.mouse = this.toWorld(e.clientX, e.clientY); if (this.cable) this.drawRubber(); });

    svg.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      this.closePopover();
      const nid = this.nodeIdAt(e.target);
      if (nid && this.tool === 'select') return this.startNodeDrag(e, nid);
      if (nid && this.tool === 'cable') { e.preventDefault(); return this.cableClick(nid, e); }
      const lid = this.linkIdAt(e.target);
      if (lid && !this.cable) { this.select({ kind: 'link', id: lid }); return; }
      // fond : pose d'un équipement armé, annulation du câble, ou panoramique
      if (this.placing) { const p = this.toWorld(e.clientX, e.clientY); this.place(this.placing, p.x, p.y); if (!e.shiftKey) this.arm(null); return; }
      if (this.cable) { this.cable = null; clear(this.gRubber); this.hintForTool(); return; }
      this.select(null);
      const sx = e.clientX, sy = e.clientY, vx = this.view.x, vy = this.view.y;
      svg.setPointerCapture(e.pointerId); svg.classList.add('panning');
      const move = (ev: PointerEvent) => { this.view.x = vx + ev.clientX - sx; this.view.y = vy + ev.clientY - sy; this.applyView(); };
      const up = () => { svg.classList.remove('panning'); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); };
      svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up);
    });

    svg.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.cable = null; clear(this.gRubber); this.arm(null); this.closePopover(); this.setTool('select'); }
      if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element).classList?.contains('node')) { const id = (e.target as Element).getAttribute('data-id'); if (id) this.select({ kind: 'device', id }); }
    });

    // glisser-déposer depuis la palette
    svg.addEventListener('dragover', e => { e.preventDefault(); });
    svg.addEventListener('drop', e => {
      e.preventDefault(); const kind = e.dataTransfer?.getData('text/infralab-kind') as DeviceKind | undefined;
      if (kind && CATALOG[kind]) { const p = this.toWorld(e.clientX, e.clientY); this.place(kind, p.x, p.y); }
    });
  }

  private place(kind: DeviceKind, x: number, y: number): void {
    const before = new Set(Object.keys(this.host.store.getState().reality.devices));
    if (!this.host.dispatch({ type: 'infra.addDevice', payload: { kind, x: snap(x), y: snap(y) } })) return;
    const fresh = Object.keys(this.host.store.getState().reality.devices).find(id => !before.has(id));
    if (fresh) this.select({ kind: 'device', id: fresh });
  }

  private startNodeDrag(e: PointerEvent, id: string): void {
    const d = this.host.store.getState().reality.devices[id]; if (!d) return;
    const start = this.toWorld(e.clientX, e.clientY); const orig = { ...d.pos }; let moved = false;
    const g = (e.target as Element).closest('.node') as SVGGElement;
    this.svg.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = this.toWorld(ev.clientX, ev.clientY); const dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.hypot(dx, dy) * this.view.k < 4) return; moved = true;
      const np = { x: snap(orig.x + dx), y: snap(orig.y + dy) }; this.dragPos.set(id, np);
      g.setAttribute('transform', `translate(${np.x} ${np.y})`); this.renderLinks();
    };
    const up = () => {
      this.svg.removeEventListener('pointermove', move); this.svg.removeEventListener('pointerup', up);
      const np = this.dragPos.get(id); this.dragPos.delete(id);
      if (moved && np) this.host.dispatch({ type: 'infra.moveDevice', payload: { id, x: np.x, y: np.y } });
      this.select({ kind: 'device', id });
    };
    this.svg.addEventListener('pointermove', move); this.svg.addEventListener('pointerup', up);
  }

  /* ---- câblage en deux clics, avec choix du port ---- */
  private cableClick(id: string, e: PointerEvent): void {
    const st = this.host.store.getState(); const d = st.reality.devices[id]; if (!d) return;
    const free = d.ports.filter(p => !portInUse(st, d.id, p.id));
    const choose = (portId: string) => {
      this.closePopover();
      if (!this.cable) { this.cable = { device: d.id, port: portId }; this.host.hint(`${d.name}/${portId} choisi. Cliquez sur le second équipement (Échap pour annuler).`); this.drawRubber(); return; }
      const a = this.cable; this.cable = null; clear(this.gRubber);
      this.host.dispatch({ type: 'infra.connect', payload: { aDevice: a.device, aPort: a.port, bDevice: d.id, bPort: portId } });
      this.hintForTool();
    };
    if (this.cable && this.cable.device === d.id) { this.host.hint('Choisissez un autre équipement.'); return; }
    if (!free.length) { this.host.hint(`${d.name} n'a plus de port libre.`); return; }
    if (free.length === 1) return choose(free[0]!.id);
    this.openPopover(e.clientX, e.clientY, `Port de ${d.name}`, free.map(p => ({ label: p.label, run: () => choose(p.id) })));
  }
  private openPopover(cx: number, cy: number, title: string, items: { label: string; run: () => void }[]): void {
    this.closePopover();
    const r = this.stage.getBoundingClientRect();
    const pop = h('div', { class: 'popover', style: { left: `${Math.min(cx - r.left + 8, r.width - 170)}px`, top: `${Math.min(cy - r.top + 8, r.height - 40 - items.length * 30)}px` }, role: 'menu' },
      h('div', { class: 'poptitle' }, title), ...items.map(i => h('button', { role: 'menuitem', onclick: i.run }, i.label)));
    this.stage.append(pop); this.popover = pop;
    (pop.querySelector('button') as HTMLButtonElement | null)?.focus();
  }
  private closePopover(): void { this.popover?.remove(); this.popover = null; }
  private drawRubber(): void {
    clear(this.gRubber); if (!this.cable) return;
    const d = this.host.store.getState().reality.devices[this.cable.device]; if (!d) return;
    const p = this.pos(d);
    this.gRubber.append(s('line', { class: 'rubber', x1: p.x, y1: p.y, x2: this.mouse.x, y2: this.mouse.y }));
  }
  private hintForTool(): void {
    this.host.hint(this.tool === 'cable' ? 'Câble : cliquez sur un équipement, choisissez un port, puis cliquez sur le second équipement.' : 'Glissez un équipement depuis la palette, ou sélectionnez-en un sur le schéma.');
  }
}
