import type { Device, State } from '../../core';
import { CATALOG, computeReachability, linksOf } from '../../infra';
import { STATUS_LABEL, ticketsForAsset } from '../../itsm';
import { clear, h } from '../kit/dom';
import { REASON_TEXT } from '../shell/labels';
import { glyphSvg } from './icons';
import type { Selection } from './canvas';
import { agentSection, softwareSection, toolSection, userSection } from './inspector-extra';

export interface InspectorHost {
  dispatch(cmd: { type: string; payload?: Record<string, unknown> }): boolean;
  confirm(msg: string, run: () => void): void;
  now(): number;
  goAsset(assetId: string): void;
  goTicket(ticketId: string): void;
  newTicket(assetId: string): void;
}

const field = (label: string, input: HTMLElement) => h('label', { class: 'fld' }, h('span', null, label), input);
const kv = (k: string, v: string | HTMLElement) => h('div', { class: 'kv' }, h('dt', null, k), h('dd', null, v));

export function renderInspector(root: HTMLElement, st: Readonly<State>, sel: Selection, host: InspectorHost): void {
  clear(root);
  if (!sel) {
    root.append(h('div', { class: 'empty-note' },
      h('h2', null, 'Rien de sélectionné'),
      h('p', null, 'Choisissez un équipement ou un câble sur le schéma pour voir ce qui existe réellement : alimentation, adresse IP, matériel, liens.'),
      h('p', { class: 'muted' }, 'Ici, « en ligne » signifie : joignable par l\'outil de gestion (le serveur ITSM). Désignez-en un pour que cette notion ait un sens.')));
    return;
  }
  if (sel.kind === 'link') return renderLink(root, st, sel.id, host);
  const d = st.reality.devices[sel.id]; if (!d) return;
  renderDevice(root, st, d, host);
}

function renderLink(root: HTMLElement, st: Readonly<State>, id: string, host: InspectorHost): void {
  const l = st.reality.links[id]; if (!l) return;
  const a = st.reality.devices[l.a.device], b = st.reality.devices[l.b.device];
  const up = !!a && !!b && a.powered && b.powered;
  root.append(
    h('h2', null, 'Câble'),
    h('p', { class: `pill ${up ? 'on' : 'off'}` }, up ? 'Lien actif' : 'Lien inactif (une extrémité est éteinte)'),
    h('dl', null, kv('Extrémité A', `${a?.name ?? '?'} / ${l.a.port}`), kv('Extrémité B', `${b?.name ?? '?'} / ${l.b.port}`), kv('Support', l.medium === 'wifi' ? 'Wi-Fi' : 'Cuivre')),
    h('div', { class: 'actions' }, h('button', { class: 'danger', onclick: () => host.dispatch({ type: 'infra.disconnect', payload: { link: id } }) }, 'Débrancher le câble')));
}

function renderDevice(root: HTMLElement, st: Readonly<State>, d: Device, host: InspectorHost): void {
  const spec = CATALOG[d.kind]; const r = computeReachability(st)[d.id];
  const isServer = st.reality.itsmServerId === d.id;
  const status = !d.powered ? ['off', 'Éteint'] : d.online ? ['on', 'En ligne'] : ['down', 'Hors ligne'];

  root.append(
    h('header', { class: 'dev-head' },
      h('span', { class: 'dev-ico', innerHTML: '' }),
      h('div', null, h('h2', null, d.name), h('p', { class: 'muted' }, spec.label + (isServer ? ' · serveur ITSM' : '')))));
  (root.querySelector('.dev-ico') as HTMLElement).innerHTML = glyphSvg(d.kind, 34);

  root.append(h('p', { class: `pill ${status[0]}` }, status[1]));
  if (!d.online && r?.reason && d.powered) root.append(h('p', { class: 'why' }, h('strong', null, 'Pourquoi ? '), REASON_TEXT[r.reason]));
  if (!d.powered) root.append(h('p', { class: 'why' }, h('strong', null, 'Pourquoi ? '), REASON_TEXT.powered_off));
  if (!st.reality.itsmServerId) root.append(h('p', { class: 'muted' }, 'Aucun serveur ITSM désigné : « en ligne » signifie seulement alimenté et relié.'));

  // alimentation
  root.append(h('div', { class: 'actions' },
    h('button', { onclick: () => host.dispatch({ type: d.powered ? 'infra.powerOff' : 'infra.powerOn', payload: { id: d.id } }) }, d.powered ? 'Éteindre' : 'Allumer')));

  // réseau (équipements terminaux)
  if (d.nics.length) {
    const nic = d.nics.find(n => n.ip) ?? d.nics[0]!;
    const ip = h('input', { type: 'text', value: nic.ip ?? '', placeholder: '192.168.10.21', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false' });
    const mask = h('input', { type: 'number', min: 0, max: 32, value: nic.mask ?? 24, 'aria-label': 'Préfixe' });
    const gw = h('input', { type: 'text', value: nic.gw ?? '', placeholder: '(aucune)', autocomplete: 'off', spellcheck: 'false' });
    root.append(h('section', null, h('h3', null, 'Réseau'),
      h('form', { class: 'netform', onsubmit: (e: Event) => { e.preventDefault(); host.dispatch({ type: 'infra.setIp', payload: { id: d.id, nic: nic.id, ip: ip.value.trim(), mask: Number(mask.value), gw: gw.value.trim() } }); } },
        field('Adresse IP', ip), field('Masque (/n)', mask), field('Passerelle', gw), h('button', { type: 'submit' }, 'Appliquer')),
      h('dl', null, ...d.nics.map(n => kv(`MAC ${n.id}`, h('code', null, n.mac))))));
  }

  if (d.kind === 'vm') {
    const hvs = Object.values(st.reality.devices).filter(x => x.kind === 'hypervisor');
    const sel = h('select', { 'aria-label': 'Hyperviseur hôte', onchange: () => host.dispatch({ type: 'infra.setHost', payload: { id: d.id, host: sel.value || null } }) }, h('option', { value: '' }, 'Aucun (câblée comme un équipement ordinaire)'), ...hvs.map(x => h('option', { value: x.id, selected: d.hostId === x.id }, x.name))) as HTMLSelectElement;
    root.append(h('section', null, h('h3', null, 'Hébergement'), h('label', { class: 'fld' }, h('span', null, 'Hébergée sur'), sel), h('p', { class: 'muted' }, d.hostId ? 'Elle partage le réseau de son hyperviseur et tombe avec lui.' : hvs.length ? 'Choisissez un hyperviseur : la machine virtuelle suivra son hôte.' : 'Aucun hyperviseur sur le schéma.')));
  } else if (d.kind === 'hypervisor') {
    const vms = Object.values(st.reality.devices).filter(x => x.hostId === d.id);
    root.append(h('section', null, h('h3', null, 'Machines virtuelles hébergées'), vms.length ? h('ul', { class: 'tkl' }, ...vms.map(v => h('li', null, v.name, ' ', h('span', { class: `pill ${v.online ? 'on' : 'down'}` }, v.online ? 'en ligne' : 'hors ligne')))) : h('p', { class: 'muted' }, 'Aucune machine virtuelle rattachée (depuis la fiche d\'une machine virtuelle).')));
  }
  root.append(toolSection(st, d, host), agentSection(st, d, host), ticketSection(st, d, host));
  const us = userSection(st, d, host); if (us) root.append(us);
  const sws = softwareSection(st, d, host); if (sws) root.append(sws);

  // matériel / logiciel
  const hwRows: HTMLElement[] = [];
  if (d.hardware?.cpu) hwRows.push(kv('Processeur', d.hardware.cpu));
  if (d.hardware?.ramGb !== undefined) hwRows.push(kv('Mémoire', `${d.hardware.ramGb} Go`));
  if (d.hardware?.disks?.length) hwRows.push(kv('Disques', d.hardware.disks.map(x => `${x.gb >= 1000 ? x.gb / 1000 + ' To' : x.gb + ' Go'} ${x.type.toUpperCase()}`).join(' + ')));
  if (d.os) hwRows.push(kv('Système', `${d.os.name} ${d.os.version}`));
  if (hwRows.length) {
    root.append(h('section', null, h('h3', null, 'Matériel réel'), h('dl', null, ...hwRows),
      d.hardware?.ramGb !== undefined ? h('div', { class: 'actions' }, h('button', { onclick: () => host.dispatch({ type: 'infra.addRam', payload: { id: d.id, gb: 8 } }) }, 'Ajouter 8 Go de RAM')) : null,
      h('p', { class: 'muted' }, 'Ce sont les valeurs réelles. L\'outil ITSM ne les connaîtra qu\'après une remontée d\'inventaire.')));
  }

  // ports
  const links = linksOf(st, d.id).map(id => st.reality.links[id]!);
  root.append(h('section', null, h('h3', null, 'Ports'),
    h('ul', { class: 'ports' }, ...d.ports.map(p => {
      const l = links.find(x => (x.a.device === d.id && x.a.port === p.id) || (x.b.device === d.id && x.b.port === p.id));
      const other = l ? (l.a.device === d.id ? l.b : l.a) : null; const od = other ? st.reality.devices[other.device] : null;
      return h('li', null, h('span', { class: 'pname' }, p.label), l && od ? h('span', null, `→ ${od.name} / ${other!.port}`) : h('span', { class: 'muted' }, 'libre'),
        l ? h('button', { class: 'link', onclick: () => host.dispatch({ type: 'infra.disconnect', payload: { link: l.id } }) }, 'Débrancher') : null);
    }))));

  // actions structurantes
  root.append(h('div', { class: 'actions stack' },
    spec.agentCapable && !isServer ? h('button', { onclick: () => host.dispatch({ type: 'infra.setItsmServer', payload: { id: d.id } }) }, 'Désigner comme serveur ITSM') : null,
    h('button', { onclick: () => host.confirm(`Remplacer ${d.name} par un équipement neuf du même type ? Le nom, l'IP et le câblage sont conservés ; l'adresse MAC change.`, () => host.dispatch({ type: 'infra.replaceDevice', payload: { id: d.id } })) }, 'Remplacer l\'équipement'),
    h('button', { class: 'danger', onclick: () => host.confirm(`Supprimer ${d.name} et ses câbles ?`, () => host.dispatch({ type: 'infra.removeDevice', payload: { id: d.id } })) }, 'Supprimer')));
}

function ticketSection(st: Readonly<State>, d: Device, host: InspectorHost): HTMLElement {
  const a = Object.values(st.management.assets).find(x => x.deviceId === d.id);
  if (!a) return h('section', null, h('h3', null, 'Tickets'), h('p', { class: 'muted' }, 'Cet équipement est inconnu de l\'outil : on ne peut pas lui rattacher de ticket. Lancez une découverte réseau (vue ITSM).'));
  const open = ticketsForAsset(st, a.id);
  return h('section', null, h('h3', null, 'Tickets'),
    open.length ? h('ul', { class: 'tkl' }, ...open.map(t => h('li', null, h('button', { class: 'link', onclick: () => host.goTicket(t.id) }, t.ref), ' ', t.title, ' ', h('span', { class: 'muted' }, `· ${STATUS_LABEL[t.status]}`))))
      : h('p', { class: 'muted' }, 'Aucun ticket ouvert sur cet actif.'),
    h('div', { class: 'actions' }, h('button', { onclick: () => host.newTicket(a.id) }, 'Créer un ticket'), h('button', { onclick: () => host.goAsset(a.id) }, 'Voir l\'actif')));
}
