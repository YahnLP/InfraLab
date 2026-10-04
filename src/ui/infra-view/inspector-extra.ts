import type { Device, State } from '../../core';
import { CATALOG, SOFTWARE } from '../../infra';
import { AGENT_VERSION_CURRENT, HEALTH_LABEL, agentHealth, assetForDevice, assetFreshness, FRESHNESS_LABEL, expectedServerUrl } from '../../inventory';
import { h } from '../kit/dom';
import { ago, fmtTime } from '../shell/labels';
import type { InspectorHost } from './inspector';

const btn = (label: string, run: () => void, cls = '') => h('button', { class: cls, onclick: run }, label);

/** Ce que l'OUTIL sait de cet équipement (et ce qu'il ignore). */
export function toolSection(st: Readonly<State>, d: Device, host: InspectorHost): HTMLElement {
  const a = assetForDevice(st, d.id);
  if (!a) return h('section', null, h('h3', null, 'Dans l\'outil ITSM'),
    h('p', { class: 'pill off' }, 'Inconnu de l\'outil'),
    h('p', { class: 'muted' }, 'Cet équipement existe, mais aucun actif ne le représente : il n\'a été ni découvert, ni inventorié.'));
  const fr = assetFreshness(a, host.now());
  return h('section', null, h('h3', null, 'Dans l\'outil ITSM'),
    h('p', { class: `pill ${a.observed ? 'on' : 'warn'}` }, a.observed ? `Inventorié ${ago(host.now(), a.observed.t)}` : 'Découvert, pas inventorié'),
    a.observed ? h('p', { class: 'muted' }, `Fraîcheur : ${FRESHNESS_LABEL[fr]}`) : h('p', { class: 'muted' }, 'L\'outil ne connaît que l\'IP, la MAC et le nom : pas de matériel, pas de logiciels.'),
    h('div', { class: 'actions' }, btn('Voir la fiche d\'actif', () => host.goAsset(a.id))));
}

export function agentSection(st: Readonly<State>, d: Device, host: InspectorHost): HTMLElement {
  const spec = CATALOG[d.kind];
  if (!spec.agentCapable) return h('section', null, h('h3', null, 'Agent d\'inventaire'),
    h('p', { class: 'muted' }, `Pas d'agent possible sur ${spec.label.toLowerCase()} : l'outil ne peut le connaître que par la découverte réseau (IP, MAC, nom).`));
  const hl = agentHealth(st, d); const a = d.agent; const now = host.now();
  const pillCls = hl === 'ok' ? 'on' : hl === 'none' ? 'off' : hl === 'stopped' || hl === 'outdated' ? 'warn' : 'down';
  const run = (type: string, payload: Record<string, unknown> = {}) => () => { host.dispatch({ type, payload: { id: d.id, ...payload } }); };
  const out: (HTMLElement | null)[] = [h('h3', null, 'Agent d\'inventaire'), h('p', { class: `pill ${pillCls}` }, HEALTH_LABEL[hl])];
  if (a.state === 'none') {
    out.push(h('p', { class: 'muted' }, 'Sans agent, l\'outil ne reçoit aucune information détaillée sur ce poste.'), h('div', { class: 'actions' }, btn('Installer l\'agent', run('agent.install'), 'primary')));
  } else {
    const url = h('input', { type: 'text', value: a.serverUrl ?? '', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'URL du serveur' });
    out.push(
      h('dl', null,
        h('div', { class: 'kv' }, h('dt', null, 'Version'), h('dd', null, `${a.version}${a.version !== AGENT_VERSION_CURRENT ? ` (dernière : ${AGENT_VERSION_CURRENT})` : ''}`)),
        h('div', { class: 'kv' }, h('dt', null, 'Dernière remontée'), h('dd', null, a.lastRun !== undefined ? `${fmtTime(a.lastRun)} (${ago(now, a.lastRun)})` : 'jamais')),
        h('div', { class: 'kv' }, h('dt', null, 'Prochaine'), h('dd', null, a.nextRun !== undefined ? fmtTime(a.nextRun) : '—'))),
      a.errors.length ? h('ul', { class: 'errs' }, ...a.errors.map(e => h('li', null, e))) : null,
      h('form', { class: 'urlform', onsubmit: (e: Event) => { e.preventDefault(); host.dispatch({ type: 'agent.configure', payload: { id: d.id, serverUrl: url.value.trim() } }); } },
        h('label', { class: 'fld' }, h('span', null, `Serveur cible (attendu : ${expectedServerUrl(st) ?? 'aucun serveur ITSM désigné'})`), url), h('button', { type: 'submit' }, 'Enregistrer')),
      h('div', { class: 'actions' },
        a.state === 'running' ? btn('Arrêter', run('agent.stop')) : btn('Démarrer', run('agent.start')),
        btn('Forcer l\'inventaire', run('agent.runInventory'), a.state === 'running' ? 'primary' : ''),
        a.version !== AGENT_VERSION_CURRENT ? btn('Mettre à jour', run('agent.update')) : null,
        btn('Désinstaller', () => host.confirm(`Désinstaller l'agent de ${d.name} ?`, () => host.dispatch({ type: 'agent.uninstall', payload: { id: d.id } })), 'danger')),
      a.logs.length ? h('details', null, h('summary', null, `Journal de l'agent (${a.logs.length})`),
        h('ol', { class: 'agentlog' }, ...[...a.logs].reverse().slice(0, 12).map(l => h('li', { class: l.level }, h('time', null, fmtTime(l.t)), ' ', l.msg)))) : null);
  }
  return h('section', null, ...out);
}

export function softwareSection(st: Readonly<State>, d: Device, host: InspectorHost): HTMLElement | null {
  if (!CATALOG[d.kind].agentCapable) return null;
  const free = Object.values(SOFTWARE).filter(s => !d.software.some(x => x.softwareId === s.id));
  const sel = h('select', { 'aria-label': 'Logiciel à installer' }, ...free.map(s => h('option', { value: s.id }, `${s.name} ${s.version}`)));
  return h('section', null, h('h3', null, `Logiciels installés (${d.software.length})`),
    d.software.length ? h('ul', { class: 'ports' }, ...d.software.map(x => h('li', { class: 'sw' }, h('span', null, SOFTWARE[x.softwareId]?.name ?? x.softwareId), h('span', { class: 'muted' }, x.version),
      h('button', { class: 'link', onclick: () => host.dispatch({ type: 'infra.uninstallSoftware', payload: { id: d.id, softwareId: x.softwareId } }) }, 'Désinstaller')))) : h('p', { class: 'muted' }, 'Aucun logiciel installé.'),
    free.length ? h('div', { class: 'inline' }, sel, btn('Installer', () => host.dispatch({ type: 'infra.installSoftware', payload: { id: d.id, softwareId: sel.value } }))) : null,
    h('p', { class: 'muted' }, 'L\'outil ne le saura qu\'à la prochaine remontée de l\'agent.'));
}

export function userSection(st: Readonly<State>, d: Device, host: InspectorHost): HTMLElement | null {
  if (!CATALOG[d.kind].agentCapable || CATALOG[d.kind].category === 'Serveurs') return null;
  const users = Object.values(st.management.users);
  const sel = h('select', { 'aria-label': 'Utilisateur connecté', onchange: () => host.dispatch({ type: 'infra.setLoggedUser', payload: { id: d.id, user: sel.value || null } }) },
    h('option', { value: '' }, '(personne)'), ...users.map(u => h('option', { value: u.id, ...(d.loggedUser === u.id ? { selected: true } : {}) }, u.name)));
  return h('section', null, h('h3', null, 'Utilisateur connecté'), sel);
}
