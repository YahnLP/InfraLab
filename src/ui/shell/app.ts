import { Scheduler, Store, emptyState, HOUR, type DeviceKind } from '../../core';
import { CATALOG, CATEGORY_ORDER, registerInfraCommands } from '../../infra';
import { clear, h } from '../kit/dom';
import { InfraCanvas, type Selection } from '../infra-view/canvas';
import { Dock } from '../infra-view/dock';
import { renderInspector } from '../infra-view/inspector';
import { glyphSvg } from '../infra-view/icons';
import { seedExample } from './example';
import { fmtTime } from './labels';

const KEY = 'infralab.project.v0';

export function mountApp(root: HTMLElement): void {
  const sch = new Scheduler();
  const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store);

  /* ---- persistance locale (provisoire : IndexedDB et projets nommés arrivent avec le moteur de TP) ---- */
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.snapshot?.state?.schemaVersion === 1) { store.restore(p.snapshot); sch.now = Number(p.now) || 0; } }
  } catch { /* stockage indisponible ou corrompu : on repart d'un projet vide */ }
  let saveTimer: number | undefined;
  const saveNow = () => { try { localStorage.setItem(KEY, JSON.stringify({ snapshot: store.snapshot(), now: sch.now })); } catch { /* ignoré */ } };
  const autosave = () => { window.clearTimeout(saveTimer); saveTimer = window.setTimeout(saveNow, 250); };
  window.addEventListener('pagehide', saveNow);

  /* ---- éléments ---- */
  const toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
  const hint = h('div', { class: 'hint' });
  const clock = h('output', { class: 'clock', 'aria-label': 'Heure simulée' });
  const stage = h('div', { class: 'stage' });
  const inspector = h('aside', { class: 'inspector', 'aria-label': 'Propriétés' });
  const dockEl = h('section', { class: 'dock', 'aria-label': 'Journal des événements' });
  const palette = h('nav', { class: 'palette', 'aria-label': 'Équipements' });
  const dialog = h('dialog', { class: 'confirm' });

  const toast = (msg: string, kind: 'info' | 'err' = 'info') => {
    const t = h('div', { class: `toast ${kind}`, role: kind === 'err' ? 'alert' : 'status' }, msg); toastBox.append(t);
    window.setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3000);
  };
  const dispatch = (cmd: { type: string; payload?: Record<string, unknown> }): boolean => {
    const r = store.dispatch(cmd); if (!r.ok) toast(r.error?.message ?? 'Action impossible', 'err'); return r.ok;
  };
  const confirm = (msg: string, run: () => void) => {
    clear(dialog);
    dialog.append(h('form', { method: 'dialog' }, h('p', null, msg), h('div', { class: 'actions' },
      h('button', { value: 'no' }, 'Annuler'), h('button', { value: 'yes', class: 'primary', onclick: () => { run(); } }, 'Confirmer'))));
    dialog.showModal();
  };

  const canvas = new InfraCanvas({
    store, dispatch, hint: m => { hint.textContent = m; },
    onSelect: (sel: Selection) => renderInspector(inspector, store.getState(), sel, { dispatch, confirm }),
  }, stage);
  new Dock(dockEl, store, id => canvas.focusDevice(id));

  const refresh = () => { renderInspector(inspector, store.getState(), canvas.getSelection(), { dispatch, confirm }); clock.textContent = fmtTime(sch.now); autosave(); };
  store.subscribe(refresh);

  /* ---- palette ---- */
  let armed: HTMLButtonElement | null = null;
  const sections = CATEGORY_ORDER.map(cat => {
    const kinds = (Object.keys(CATALOG) as DeviceKind[]).filter(k => CATALOG[k].category === cat);
    return h('section', null, h('h3', null, cat), h('ul', null, ...kinds.map(k => {
      const b = h('button', { class: 'pal', draggable: 'true', 'data-kind': k, title: `${CATALOG[k].label} — glisser sur le schéma, ou cliquer puis cliquer sur le schéma`,
        ondragstart: (e: DragEvent) => { e.dataTransfer?.setData('text/infralab-kind', k); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'; },
        onclick: () => { const on = armed === b; armed?.classList.remove('armed'); armed = on ? null : b; b.classList.toggle('armed', !on); canvas.setTool('select'); toolBtns.forEach(t => t.classList.toggle('on', t.dataset['tool'] === 'select')); canvas.arm(on ? null : k); },
      }, h('span', { class: 'pi', innerHTML: '' }), h('span', null, CATALOG[k].label));
      (b.querySelector('.pi') as HTMLElement).innerHTML = glyphSvg(k, 26);
      return h('li', null, b);
    })));
  });
  const toolBtns = (['select', 'cable'] as const).map(t => h('button', { class: `tool${t === 'select' ? ' on' : ''}`, 'data-tool': t, 'aria-pressed': String(t === 'select'),
    onclick: () => { canvas.arm(null); armed?.classList.remove('armed'); armed = null; canvas.setTool(t); toolBtns.forEach(b => { const on = b.dataset['tool'] === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); },
  }, t === 'select' ? 'Sélection' : 'Câble'));
  palette.append(h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Outils' }, ...toolBtns), ...sections);

  /* ---- en-tête ---- */
  const header = h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', null, 'InfraLab')),
    h('div', { class: 'views', role: 'tablist', 'aria-label': 'Vues' },
      h('button', { role: 'tab', 'aria-selected': 'true', class: 'on' }, 'Infrastructure'),
      h('button', { role: 'tab', 'aria-selected': 'false', disabled: true, title: 'La vue ITSM arrive avec le jalon M3' }, 'ITSM')),
    h('div', { class: 'grow' }),
    h('div', { class: 'simtime' }, h('span', { class: 'muted' }, 'Heure simulée'), clock,
      h('button', { title: 'Avancer le temps simulé d\'une heure (remontées d\'agent et SLA, bientôt)', onclick: () => { sch.runFor(HOUR); refresh(); } }, '+1 h')),
    h('button', { onclick: () => canvas.fit() }, 'Recentrer'),
    h('button', { onclick: () => { const go = () => { seedExample(store, dispatch); sch.now = 0; canvas.fit(); refresh(); }; if (Object.keys(store.getState().reality.devices).length) confirm('Remplacer le schéma actuel par le SI d\'exemple ?', () => { store.restore({ state: emptyState(), log: [] }); go(); }); else go(); } }, 'SI d\'exemple'),
    h('button', { onclick: () => confirm('Effacer tout le schéma ?', () => { store.restore({ state: emptyState(), log: [] }); sch.now = 0; canvas.select(null); refresh(); }) }, 'Nouveau'));

  root.append(header,
    h('main', { class: 'work' }, palette,
      h('div', { class: 'center' }, stage, hint, dockEl),
      inspector),
    toastBox, dialog);

  window.addEventListener('keydown', e => {
    const t = e.target as HTMLElement; if (t.closest('input, textarea, select, dialog')) return;
    if (e.key === 'c' || e.key === 'C') toolBtns[1]!.click();
    else if (e.key === 'v' || e.key === 'V') toolBtns[0]!.click();
    else if (e.key === 'Delete') { const s = canvas.getSelection(); if (s?.kind === 'device') { const d = store.getState().reality.devices[s.id]; if (d) confirm(`Supprimer ${d.name} et ses câbles ?`, () => dispatch({ type: 'infra.removeDevice', payload: { id: d.id } })); } else if (s?.kind === 'link') dispatch({ type: 'infra.disconnect', payload: { link: s.id } }); }
  });

  canvas.setTool('select');
  refresh();
  (window as unknown as { infralab: unknown }).infralab = { store, sch, canvas }; // accès console pour les enseignants et les tests
}
