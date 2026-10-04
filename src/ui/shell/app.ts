import { Scheduler, Store, emptyState, HOUR, DAY, type DeviceKind } from '../../core';
import { CATALOG, CATEGORY_ORDER, registerInfraCommands } from '../../infra';
import { advance, registerInventoryCommands } from '../../inventory';
import { registerItsmCommands } from '../../itsm';
import { ItsmView } from '../itsm-view/view';
import { clear, h } from '../kit/dom';
import { InfraCanvas, type Selection } from '../infra-view/canvas';
import { Dock } from '../infra-view/dock';
import { renderInspector } from '../infra-view/inspector';
import { glyphSvg } from '../infra-view/icons';
import { advanceTime, getScenario as SCENARIOS_BY_ID, registerScenarioCommands, seedNovatech as seedExample, seedNovatechFull, startScenario, type Scenario } from '../../scenarios';
import { renderTpCatalog } from '../tp/catalog-page';
import { TpPanel } from '../tp/panel';
import { fmtTime } from './labels';
import { EXT, labelOf, parseProject, serialize, suggestedName } from './files';
import { openHelp } from './help';
import { APP_AUTHOR, APP_NAME, APP_TAGLINE, AUTHOR_URL } from '../../version';

const KEY = 'infralab.project.v0';

export function mountApp(root: HTMLElement): void {
  const sch = new Scheduler();
  const store = new Store({ clock: () => sch.now });
  registerInfraCommands(store); registerInventoryCommands(store); registerItsmCommands(store); registerScenarioCommands(store);

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
  const clock = h('output', { class: 'clock', 'aria-label': 'Heure simulée', title: 'Le temps ne passe que si vous le faites avancer (+1 h, +1 jour). Il sert aux SLA, aux échéances de contrats, aux remontées d\'agent et aux événements des TP.' });
  const stage = h('div', { class: 'stage' });
  const inspector = h('aside', { class: 'inspector', 'aria-label': 'Propriétés' });
  const dockEl = h('section', { class: 'dock', 'aria-label': 'Journal des événements' });
  const palette = h('nav', { class: 'palette', 'aria-label': 'Équipements' });
  const dialog = h('dialog', { class: 'confirm' });
  const helpDlg = h('dialog', { class: 'help', 'aria-label': 'Aide et à propos' });
  const itsmEl = h('div', { class: 'itsm', hidden: true });
  const workEl = h('main', { class: 'work' });
  const tpEl = h('div', { class: 'tpview', hidden: true });
  const tpPanelEl = h('aside', { class: 'tp-dock', 'aria-label': 'Travail pratique en cours', hidden: true });

  const toast = (msg: string, kind: 'info' | 'err' = 'info', ms?: number) => {
    const t = h('div', { class: `toast ${kind}`, role: kind === 'err' ? 'alert' : 'status' }, msg); toastBox.append(t);
    window.setTimeout(() => t.remove(), ms ?? (kind === 'err' ? 6000 : 3000));
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

  const ihost = { dispatch, confirm, now: () => sch.now, goAsset: (id: string) => showItsm({ page: 'asset', id }), goTicket: (id: string) => showItsm({ page: 'ticket', id }), newTicket: (assetId: string) => showItsm({ page: 'newticket', assetId }) };
  const canvas = new InfraCanvas({
    store, dispatch, hint: m => { hint.textContent = m; },
    onSelect: (sel: Selection) => renderInspector(inspector, store.getState(), sel, ihost),
  }, stage);
  new Dock(dockEl, store, id => canvas.focusDevice(id));

  /* ---- identité : « Agir en tant que » ---- */
  const whoSel = h('select', { 'aria-label': 'Agir en tant que', title: 'Les droits de la personne choisie s\'appliquent à vos actions', onchange: () => { dispatch({ type: 'itsm.actAs', payload: { user: whoSel.value || null } }); } }) as HTMLSelectElement;
  const whoBox = h('label', { class: 'who' }, h('span', { class: 'muted' }, 'Agir en tant que'), whoSel);
  const renderWho = () => {
    const st = store.getState(); const users = Object.values(st.management.users).filter(u => !u.disabled);
    clear(whoSel); whoSel.append(h('option', { value: '' }, 'Formateur (tous les droits)'), ...users.map(u => h('option', { value: u.id }, `${u.name} — ${u.roles.map(r => st.management.roles[r]?.name ?? r).join(', ')}`)));
    whoSel.value = st.actingAs ?? ''; whoBox.classList.toggle('acting', !!st.actingAs);
  };
  /* ---- fichiers : Ouvrir / Enregistrer (dossier choisi par l'élève) ---- */
  type FsHandle = { name: string; createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> };
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FsHandle>; showOpenFilePicker?: (o: unknown) => Promise<FsHandle[]> };
  const hasFsApi = typeof w.showSaveFilePicker === 'function' && typeof w.showOpenFilePicker === 'function';
  let handle: FsHandle | null = null; let fileName = ''; let dirty = false; let loading = false;
  const fnameEl = h('span', { class: 'fname', 'aria-live': 'polite' });
  const renderFname = () => { fnameEl.textContent = fileName || 'Non enregistré'; fnameEl.classList.toggle('dirty', dirty && !!fileName); fnameEl.title = dirty && fileName ? 'Modifications non enregistrées' : ''; };
  const resetFile = () => { handle = null; fileName = ''; dirty = false; renderFname(); };
  const curScenario = () => { const id = store.getState().session?.scenarioId; return id ? SCENARIOS_BY_ID(id) : undefined; };
  const filePayload = () => { const sc = curScenario(); const st = store.getState(); return { text: serialize(store.snapshot(), sch.now, labelOf(st, sc?.title)), name: suggestedName(st, sc?.number) }; };
  const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError';
  const saveFile = async (as: boolean): Promise<void> => {
    const { text, name } = filePayload();
    try {
      if (hasFsApi) {
        if (!handle || as) handle = await w.showSaveFilePicker!({ suggestedName: fileName || name, types: [{ description: 'Projet InfraLab', accept: { 'application/json': [EXT, '.json'] } }] });
        const wr = await handle.createWritable(); await wr.write(text); await wr.close(); fileName = handle.name;
        toast(`Enregistré : ${fileName}`);
      } else {
        const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: fileName || name }); document.body.append(a); a.click(); a.remove();
        fileName = fileName || name; toast(`« ${fileName} » téléchargé : retrouvez-le dans votre dossier de téléchargements.`);
      }
      dirty = false; renderFname();
    } catch (e) { if (!isAbort(e)) toast('Enregistrement impossible : ' + ((e as Error).message || 'erreur inconnue'), 'err'); }
  };
  const loadText = (text: string, name: string, h2: FsHandle | null) => {
    let r; try { r = parseProject(text); } catch (e) { toast((e as Error).message, 'err'); return; }
    const go = () => {
      loading = true; store.restore(r.snapshot); sch.now = r.now; canvas.select(null); showInfra(); canvas.fit(); loading = false; refresh();
      handle = h2; fileName = name; dirty = false; renderFname(); toast(`Projet ouvert : ${name}`);
    };
    if (dirty) confirm('Le projet actuel contient des modifications non enregistrées. Ouvrir ce fichier quand même ?', go); else go();
  };
  const openFile = async (): Promise<void> => {
    try {
      if (hasFsApi) {
        const [fh] = await w.showOpenFilePicker!({ multiple: false, types: [{ description: 'Projet InfraLab', accept: { 'application/json': [EXT, '.json'] } }] });
        if (!fh) return; const f = await (fh as unknown as { getFile(): Promise<File> }).getFile(); loadText(await f.text(), f.name, fh);
      } else picker.click();
    } catch (e) { if (!isAbort(e)) toast('Ouverture impossible : ' + ((e as Error).message || 'erreur inconnue'), 'err'); }
  };
  const picker = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choisir un fichier projet InfraLab', onchange: async () => { const f = picker.files?.[0]; picker.value = ''; if (f) loadText(await f.text(), f.name, null); } }) as HTMLInputElement;
  /** Fait avancer l'horloge simulée ; les événements du TP (ticket qui arrive, panne…) se déclenchent au bon instant. */
  const tick = (ms: number) => { const notices = advanceTime(store, sch, ms); notices.forEach(n => toast(n, 'info', 9000)); refresh(); };
  const refresh = () => { if (!loading) { dirty = true; } renderFname(); renderWho(); renderInspector(inspector, store.getState(), canvas.getSelection(), ihost); clock.textContent = fmtTime(sch.now); autosave(); };
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

  /* ---- vues ---- */
  const tabInfra = h('button', { role: 'tab', 'aria-selected': 'true', class: 'on', onclick: () => showInfra() }, 'Infrastructure');
  const tabItsm = h('button', { role: 'tab', 'aria-selected': 'false', onclick: () => showItsm() }, 'ITSM');
  const tabTp = h('button', { role: 'tab', 'aria-selected': 'false', onclick: () => showTp() }, 'TP');
  const tabs = () => [[tabInfra, workEl], [tabItsm, itsmEl], [tabTp, tpEl]] as const;
  const itsm = new ItsmView(itsmEl, { store, now: () => sch.now, dispatch, goInfra: id => { showInfra(); canvas.focusDevice(id); } });
  function show(which: 0 | 1 | 2): void { tabs().forEach(([t, el], i) => { el.hidden = i !== which; t.classList.toggle('on', i === which); t.setAttribute('aria-selected', String(i === which)); }); }
  function showInfra(): void { show(0); }
  function showItsm(r?: Parameters<ItsmView['go']>[0]): void { show(1); itsm.go(r ?? itsm.route); }
  const tpHost = {
    current: () => store.getState().session?.scenarioId ?? null,
    start: (sc: Scenario, mode: 'tp' | 'exam') => {
      const go = () => { startScenario(store, sch, sc, mode); resetFile(); canvas.select(null); showInfra(); canvas.fit(); refresh(); };
      confirm(`Démarrer « TP ${sc.number} — ${sc.title} »${mode === 'exam' ? ' en mode examen' : ''} ? Le projet actuel sera remplacé.`, go);
    },
  };
  function showTp(): void { show(2); renderTpCatalog(tpEl, tpHost); }
  new TpPanel(tpPanelEl, store, { dispatch, confirm, advance: tick, restart: () => { const id = store.getState().session; const sc = id && SCENARIOS_BY_ID(id.scenarioId); if (sc && id) { startScenario(store, sch, sc, id.mode); resetFile(); canvas.select(null); canvas.fit(); refresh(); } } }, () => sch.now);

  /* ---- en-tête ---- */
  const header = h('header', { class: 'top' },
    h('div', { class: 'brand', title: `${APP_NAME} — ${APP_TAGLINE}` }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', { class: 'brand-box' }, h('span', null, APP_NAME), h('a', { class: 'credit', href: AUTHOR_URL, target: '_blank', rel: 'noopener noreferrer', title: 'Formaxion Landes (nouvel onglet)' }, `Créé par ${APP_AUTHOR}`))),
    h('div', { class: 'views', role: 'tablist', 'aria-label': 'Vues' }, tabInfra, tabItsm, tabTp),
    h('div', { class: 'filebox', role: 'group', 'aria-label': 'Fichier' },
      h('button', { title: 'Ouvrir un projet ou un TP enregistré (Ctrl+O)', onclick: () => void openFile() }, 'Ouvrir'),
      h('button', { class: 'primary', title: 'Enregistrer dans un fichier, dans le dossier de votre choix (Ctrl+S)', onclick: () => void saveFile(false) }, 'Enregistrer'),
      hasFsApi ? h('button', { title: 'Enregistrer sous un autre nom ou dans un autre dossier', onclick: () => void saveFile(true) }, 'Enregistrer sous…') : null,
      fnameEl, picker),
    h('div', { class: 'grow' }), whoBox,
    h('div', { class: 'simtime' }, h('span', { class: 'muted' }, 'Heure simulée'), clock,
      h('button', { title: 'Avancer le temps simulé d\'une heure (SLA, échéances, remontées d\'agent, événements du TP)', onclick: () => tick(HOUR) }, '+1 h'),
      h('button', { title: 'Avancer le temps simulé d\'un jour', onclick: () => tick(DAY) }, '+1 jour')),
    h('button', { onclick: () => { showInfra(); canvas.fit(); } }, 'Recentrer'),
    h('button', { onclick: () => { const go = () => { resetFile(); seedExample(store, dispatch); sch.now = 0; canvas.fit(); refresh(); }; if (Object.keys(store.getState().reality.devices).length) confirm('Remplacer le schéma actuel par le SI d\'exemple ?', () => { store.restore({ state: emptyState(), log: [] }); go(); }); else go(); } }, 'SI d\'exemple'),
    h('button', { title: '4 sites, ≈ 45 équipements, 45 utilisateurs, contrats, licences, CMDB', onclick: () => confirm('Remplacer le projet actuel par NovaTech complet (4 sites, ≈ 45 équipements, 45 utilisateurs) ?', () => { store.restore({ state: emptyState(), log: [] }); resetFile(); sch.now = 0; seedNovatechFull(store, dispatch); advance(store, sch, 10 * 60000); canvas.select(null); canvas.fit(); showInfra(); refresh(); }) }, 'NovaTech complet'),
    h('button', { onclick: () => confirm('Effacer tout le schéma ?', () => { store.restore({ state: emptyState(), log: [] }); resetFile(); sch.now = 0; canvas.select(null); refresh(); }) }, 'Nouveau'),
    h('button', { class: 'help-btn', title: 'Aide et à propos (F1)', 'aria-label': 'Aide', onclick: () => openHelp(helpDlg) }, '? Aide'));

  workEl.append(palette, h('div', { class: 'center' }, stage, hint, dockEl), inspector);
  root.append(header, h('div', { class: 'appbody' }, h('div', { class: 'viewport' }, workEl, itsmEl, tpEl), tpPanelEl), toastBox, dialog, helpDlg);

  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); void saveFile(e.shiftKey); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); void openFile(); return; }
    if (e.key === 'F1') { e.preventDefault(); openHelp(helpDlg); return; }
    const t = e.target as HTMLElement; if (t.closest('input, textarea, select, dialog')) return;
    if (e.key === 'c' || e.key === 'C') toolBtns[1]!.click();
    else if (e.key === 'v' || e.key === 'V') toolBtns[0]!.click();
    else if (e.key === 'Delete') { const s = canvas.getSelection(); if (s?.kind === 'device') { const d = store.getState().reality.devices[s.id]; if (d) confirm(`Supprimer ${d.name} et ses câbles ?`, () => dispatch({ type: 'infra.removeDevice', payload: { id: d.id } })); } else if (s?.kind === 'link') dispatch({ type: 'infra.disconnect', payload: { link: s.id } }); }
  });

  canvas.setTool('select');
  refresh(); dirty = false; renderFname();
  (window as unknown as { infralab: unknown }).infralab = { store, sch, canvas }; // accès console pour les enseignants et les tests
}
