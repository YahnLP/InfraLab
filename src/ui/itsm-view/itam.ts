import { DAY, type Asset } from '../../core';
import { SOFTWARE } from '../../infra';
import { ASSET_STATUS_LABEL, CI_KIND_LABEL, CONTRACT_KIND_LABEL, CONTRACT_STATE_LABEL, RELATION_LABEL, assetTransitionsFrom, autoRelations, contractState, contractsForAsset, forbiddenInstalls, impactOf, installsKnown, installsReal, licenseReport, licensesForSoftware, softwareName, warrantyState } from '../../itsm';
import { h } from '../kit/dom';
import { fmtTime } from '../shell/labels';
import type { Ctx } from './tickets';

const note = (t: string) => h('aside', { class: 'realworld' }, h('strong', null, 'Dans les outils réels'), ' ', t);
const days = (c: Ctx, ms: number) => `${Math.round((ms - c.host.now()) / DAY)} j`;

/* ---------------- Logiciels ---------------- */
export function softwarePage(c: Ctx): HTMLElement {
  const st = c.st; const bad = forbiddenInstalls(st);
  return h('section', null, h('h1', null, 'Logiciels'),
    bad.length ? h('div', { class: 'callout warn' }, h('strong', null, 'Installations interdites connues de l\'outil : '), ...bad.map((b, i) => h('span', null, i ? ', ' : '', `${softwareName(b.softwareId)} sur `, h('button', { class: 'link', onclick: () => c.go({ page: 'asset', id: b.asset.id }) }, b.asset.name)))) : null,
    h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Logiciel', 'Éditeur', 'Installations connues', 'Installations réelles', 'Politique', 'Licence'].map(x => h('th', null, x)))),
      h('tbody', null, ...Object.values(SOFTWARE).map(sw => {
        const known = installsKnown(st, sw.id); const real = installsReal(st, sw.id); const lic = licensesForSoftware(st, sw.id); const pol = st.management.softwarePolicy[sw.id] ?? '';
        const sel = h('select', { 'aria-label': `Politique pour ${sw.name}`, onchange: () => c.host.dispatch({ type: 'itsm.setSoftwarePolicy', payload: { softwareId: sw.id, policy: sel.value } }) },
          ...([['', 'Non classé'], ['authorized', 'Autorisé'], ['forbidden', 'Interdit']] as const).map(([v, l]) => h('option', { value: v, ...(pol === v ? { selected: true } : {}) }, l)));
        const r = lic.map(l => licenseReport(st, l, c.host.now()));
        return h('tr', null, h('td', null, h('b', null, sw.name), h('div', { class: 'muted' }, `version ${sw.version}`)), h('td', null, sw.vendor),
          h('td', null, ...(known.length ? known.flatMap((a, i) => [i ? ', ' : '', h('button', { class: 'link', onclick: () => c.go({ page: 'asset', id: a.id }) }, a.name)]) : [h('span', { class: 'muted' }, '0')])),
          h('td', { class: real !== known.length ? 'diff' : '' }, String(real)), h('td', null, sel),
          h('td', null, lic.length ? h('span', { class: `pill ${r.some(x => x.state === 'over') ? 'down' : 'on'}` }, r.some(x => x.state === 'over') ? 'Non conforme' : 'Conforme') : h('span', { class: 'muted' }, '—')));
      }))),
    h('p', { class: 'muted' }, 'La colonne « réelles » est la vérité du terrain ; « connues » ce que les agents ont remonté. Un écart signifie qu\'un inventaire est périmé ou qu\'un poste n\'a pas d\'agent.'),
    note('l\'inventaire logiciel (Software / Installed software) est alimenté par les agents ; les politiques de « liste noire » ou « liste blanche » déclenchent des alertes sur les installations non autorisées.'));
}

/* ---------------- Licences ---------------- */
export function licensesPage(c: Ctx): HTMLElement {
  const st = c.st; const now = c.host.now(); const list = Object.values(st.management.licenses);
  const sw = h('select', { 'aria-label': 'Logiciel' }, ...Object.values(SOFTWARE).map(s => h('option', { value: s.id }, s.name)));
  const qty = h('input', { type: 'number', min: 1, value: '1', 'aria-label': 'Nombre de droits' });
  return h('section', null, h('h1', null, 'Licences'),
    list.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Logiciel', 'Droits achetés', 'Installations connues', 'Réelles', 'Conformité', ''].map(x => h('th', null, x)))),
      h('tbody', null, ...list.map(l => {
        const r = licenseReport(st, l, now); const q = h('input', { type: 'number', min: 1, value: String(l.quantity), 'aria-label': `Droits pour ${l.ref}`, style: 'width:70px' });
        return h('tr', null, h('td', null, h('code', null, l.ref)), h('td', null, h('b', null, softwareName(l.softwareId))), h('td', null, q, l.expiresAt !== undefined ? h('div', { class: 'muted' }, r.expired ? 'expirée' : `expire dans ${days(c, l.expiresAt)}`) : null),
          h('td', null, String(r.known)), h('td', { class: r.real !== r.known ? 'diff' : '' }, String(r.real)),
          h('td', null, h('span', { class: `pill ${r.state === 'over' ? 'down' : 'on'}` }, r.state === 'over' ? `Non conforme (+${r.gap})` : r.entitled - r.known > 0 ? `Conforme (${r.entitled - r.known} libre${r.entitled - r.known > 1 ? 's' : ''})` : 'Conforme')),
          h('td', null, h('button', { onclick: () => c.host.dispatch({ type: 'itsm.updateLicense', payload: { id: l.id, fields: { quantity: Number(q.value) } } }) }, 'Enregistrer')));
      }))) : h('p', { class: 'empty' }, 'Aucune licence enregistrée. Sans droits déclarés, l\'outil ne peut pas dire si le parc est conforme.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.addLicense', payload: { softwareId: sw.value, quantity: Number(qty.value) } }); } },
      h('label', { class: 'fld' }, h('span', null, 'Logiciel'), sw), h('label', { class: 'fld' }, h('span', null, 'Droits achetés'), qty), h('button', { type: 'submit' }, 'Ajouter la licence')),
    h('p', { class: 'muted' }, 'La conformité compare les droits achetés aux installations que l\'outil connaît. Si une colonne « réelles » diffère, la conclusion peut être fausse : vérifiez les agents.'),
    note('rapprochement licences / installations (Software Asset Management, GLPI Licences, ServiceNow SAM Pro). Régulariser = acheter des droits, ou désinstaller.'));
}

/* ---------------- Contrats et fournisseurs ---------------- */
export function contractsPage(c: Ctx): HTMLElement {
  const st = c.st; const now = c.host.now(); const contracts = Object.values(st.management.contracts); const sups = Object.values(st.management.suppliers);
  const sname = h('input', { type: 'text', placeholder: 'Ex. : Dell France', 'aria-label': 'Nom du fournisseur' });
  const title = h('input', { type: 'text', placeholder: 'Ex. : Maintenance des postes', 'aria-label': 'Titre du contrat' });
  const sup = h('select', { 'aria-label': 'Fournisseur' }, ...sups.map(s => h('option', { value: s.id }, s.name)));
  const kind = h('select', { 'aria-label': 'Type' }, ...(Object.entries(CONTRACT_KIND_LABEL) as [string, string][]).map(([v, l]) => h('option', { value: v }, l)));
  const dur = h('input', { type: 'number', min: 1, value: '365', 'aria-label': 'Durée en jours simulés' });
  return h('section', null, h('h1', null, 'Contrats et fournisseurs'),
    contracts.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Contrat', 'Fournisseur', 'Type', 'Échéance', 'État', 'Actifs couverts', ''].map(x => h('th', null, x)))),
      h('tbody', null, ...contracts.map(k => { const s = contractState(k, now); const sel = h('select', { 'aria-label': `Couvrir un actif avec ${k.ref}` }, h('option', { value: '' }, '+ actif…'), ...Object.values(st.management.assets).filter(a => !k.assetIds.includes(a.id)).map(a => h('option', { value: a.id }, a.name)));
        sel.onchange = () => { if (sel.value) c.host.dispatch({ type: 'itsm.updateContract', payload: { id: k.id, fields: { assetIds: [...k.assetIds, sel.value] } } }); };
        return h('tr', null, h('td', null, h('code', null, k.ref)), h('td', null, h('b', null, k.title)), h('td', null, st.management.suppliers[k.supplierId]?.name ?? '—'), h('td', null, CONTRACT_KIND_LABEL[k.kind]),
          h('td', null, `${fmtTime(k.endAt)}`, h('div', { class: 'muted' }, s === 'expired' ? 'dépassée' : `dans ${days(c, k.endAt)}`)), h('td', null, h('span', { class: `pill ${s === 'active' ? 'on' : s === 'expiring' ? 'warn' : 'down'}` }, CONTRACT_STATE_LABEL[s])),
          h('td', null, k.assetIds.map(i => st.management.assets[i]?.name ?? i).join(', ') || h('span', { class: 'muted' }, 'aucun'), sel),
          h('td', null, h('button', { onclick: () => c.host.dispatch({ type: 'itsm.updateContract', payload: { id: k.id, fields: { endAt: Math.max(k.endAt, now) + 365 * DAY } } }) }, 'Renouveler +1 an'))); })))
      : h('p', { class: 'empty' }, 'Aucun contrat. Contrats de maintenance, de licence, de garantie ou de location : leurs échéances sont à surveiller.'),
    h('h2', null, 'Fournisseurs'), sups.length ? h('p', null, sups.map(s => s.name).join(' · ')) : h('p', { class: 'muted' }, 'Aucun fournisseur.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); if (c.host.dispatch({ type: 'itsm.addSupplier', payload: { name: sname.value } })) sname.value = ''; } }, h('label', { class: 'fld' }, h('span', null, 'Nouveau fournisseur'), sname), h('button', { type: 'submit' }, 'Ajouter')),
    sups.length ? h('form', { class: 'tform', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.addContract', payload: { title: title.value, supplierId: sup.value, kind: kind.value, startAt: now, endAt: now + (Number(dur.value) || 1) * DAY } }); } },
      h('label', { class: 'fld wide' }, h('span', null, 'Nouveau contrat'), title), h('label', { class: 'fld' }, h('span', null, 'Fournisseur'), sup), h('label', { class: 'fld' }, h('span', null, 'Type'), kind), h('label', { class: 'fld' }, h('span', null, 'Durée (jours simulés)'), dur), h('button', { type: 'submit' }, 'Créer le contrat')) : null,
    note('un contrat échu sans alerte est un classique : maintenance qui s\'arrête, licence qui expire, garantie dépassée. Les outils (GLPI Contrats, ServiceNow Contract Management) envoient des alertes avant l\'échéance.'));
}

/* ---------------- CMDB ---------------- */
export function cmdbPage(c: Ctx, sel?: string): HTMLElement {
  const st = c.st; const cis = Object.values(st.management.cis); const rels = Object.values(st.management.relations); const auto = autoRelations(st);
  const name = (id: string) => st.management.cis[id]?.name ?? id; const cur = sel ? st.management.cis[sel] : undefined;
  const free = Object.values(st.management.assets).filter(a => !cis.some(x => x.assetId === a.id));
  const aSel = h('select', { 'aria-label': 'Actif à promouvoir en CI' }, ...free.map(a => h('option', { value: a.id }, a.name)));
  const sname = h('input', { type: 'text', placeholder: 'Ex. : Facturation comptable', 'aria-label': 'Nom du CI' }); const skind = h('select', { 'aria-label': 'Type de CI' }, h('option', { value: 'service' }, 'Service'), h('option', { value: 'application' }, 'Application'));
  const list = h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Nom', 'Type', 'Actif', 'Relations'].map(x => h('th', null, x)))),
    h('tbody', null, ...cis.map(x => h('tr', { class: `row${sel === x.id ? ' sel' : ''}`, tabindex: 0, onclick: () => c.go({ page: 'cmdb', ci: x.id }), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') c.go({ page: 'cmdb', ci: x.id }); } },
      h('td', null, h('code', null, x.ref)), h('td', null, h('b', null, x.name)), h('td', null, CI_KIND_LABEL[x.kind]), h('td', null, x.assetId ? st.management.assets[x.assetId]?.name ?? '?' : h('span', { class: 'muted' }, '—')),
      h('td', null, String(rels.filter(r => r.from === x.id || r.to === x.id).length + auto.filter(r => r.a === x.id || r.b === x.id).length))))));
  let detail: HTMLElement | null = null;
  if (cur) {
    const out = rels.filter(r => r.from === cur.id), inc = rels.filter(r => r.to === cur.id); const au = auto.filter(r => r.a === cur.id || r.b === cur.id);
    const type = h('select', { 'aria-label': 'Type de relation' }, ...(Object.entries(RELATION_LABEL) as [string, string][]).map(([v, l]) => h('option', { value: v }, l)));
    const tgt = h('select', { 'aria-label': 'CI cible' }, ...cis.filter(x => x.id !== cur.id).map(x => h('option', { value: x.id }, x.name)));
    const imp = impactOf(st, cur.id);
    detail = h('div', { class: 'ci-detail' }, h('h2', null, `${cur.name} — ${CI_KIND_LABEL[cur.kind]}`),
      h('h3', null, 'Relations déclarées'),
      out.length || inc.length ? h('ul', { class: 'tkl' }, ...out.map(r => h('li', null, `${cur.name} ${RELATION_LABEL[r.type]} `, h('b', null, name(r.to)), ' ', h('button', { class: 'link', onclick: () => c.host.dispatch({ type: 'itsm.removeRelation', payload: { id: r.id } }) }, 'Retirer'))),
        ...inc.map(r => h('li', null, h('b', null, name(r.from)), ` ${RELATION_LABEL[r.type]} ${cur.name} `, h('button', { class: 'link', onclick: () => c.host.dispatch({ type: 'itsm.removeRelation', payload: { id: r.id } }) }, 'Retirer')))) : h('p', { class: 'muted' }, 'Aucune relation déclarée.'),
      cis.length > 1 ? h('form', { class: 'inline', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: 'itsm.addRelation', payload: { from: cur.id, to: tgt.value, type: type.value } }); } }, h('span', null, cur.name), type, tgt, h('button', { type: 'submit' }, 'Ajouter')) : null,
      h('h3', null, 'Relations déduites (câblage, hébergement : non saisies)'), au.length ? h('ul', { class: 'tkl' }, ...au.map(r => h('li', null, r.hosted ? (r.a === cur.id ? 'hébergé sur ' : 'héberge ') : 'connecté à ', h('b', null, name(r.a === cur.id ? r.b : r.a))))) : h('p', { class: 'muted' }, 'Aucune : pour qu\'une connexion ou un hébergement apparaisse, les deux équipements doivent avoir un CI.'),
      h('div', { class: 'callout' }, h('strong', null, 'Si ' + cur.name + ' tombe : '), imp.devices.length ? `${imp.devices.length} équipement(s) perdent la joignabilité (${imp.devices.map(d => st.reality.devices[d]?.name ?? d).join(', ')}). ` : 'aucun autre équipement n\'est coupé. ',
        imp.services.length ? h('span', null, 'Services touchés : ', h('b', null, imp.services.map(name).join(', ')), '.') : 'Aucun service déclaré n\'est touché.'),
      h('div', { class: 'actions' }, cur.assetId ? h('button', { onclick: () => c.go({ page: 'asset', id: cur.assetId! }) }, 'Voir l\'actif') : null, h('button', { class: 'danger', onclick: () => c.host.dispatch({ type: 'itsm.removeCi', payload: { id: cur.id } }) }, 'Supprimer le CI')));
  }
  return h('section', null, h('h1', null, 'CMDB'),
    h('p', { class: 'muted lead' }, 'Un actif est ce qu\'on possède et gère. Un CI (élément de configuration) est ce dont on veut connaître les liens : on y met ce qui a des dépendances ou des conséquences, y compris des services qui n\'ont pas d\'équipement propre.'),
    cis.length ? list : h('p', { class: 'empty' }, 'La CMDB est vide. Créez des CI à partir de vos actifs, puis des services qui en dépendent.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); if (aSel.value) c.host.dispatch({ type: 'itsm.createCi', payload: { name: st.management.assets[aSel.value]!.name, kind: 'infrastructure', asset: aSel.value } }); } },
      h('label', { class: 'fld' }, h('span', null, 'Promouvoir un actif en CI'), aSel), h('button', { type: 'submit', ...(free.length ? {} : { disabled: true }) }, 'Créer le CI')),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); if (c.host.dispatch({ type: 'itsm.createCi', payload: { name: sname.value, kind: skind.value } })) sname.value = ''; } },
      h('label', { class: 'fld' }, h('span', null, 'Nouveau service ou application'), sname), h('label', { class: 'fld' }, h('span', null, 'Type'), skind), h('button', { type: 'submit' }, 'Créer')),
    detail,
    note('CMDB (Configuration Management Database) : CI + relations. Les relations « connecté à » se découvrent ; « dépend de » / « utilise » / « hébergé sur » se déclarent et servent à l\'analyse d\'impact.'));
}

/* ---------------- Cycle de vie (fiche d'actif) ---------------- */
export function lifecycleSection(c: Ctx, a: Asset): HTMLElement {
  const st = c.st; const now = c.host.now(); const users = Object.values(st.management.users);
  const user = h('select', { 'aria-label': 'Utilisateur à affecter' }, h('option', { value: '' }, '— utilisateur —'), ...users.map(u => h('option', { value: u.id, ...(a.assignedTo === u.id ? { selected: true } : {}) }, u.name)));
  const trs = assetTransitionsFrom(a.status).map(t => { const b = t.guard?.(a, user.value || undefined); return h('button', { class: b ? 'blocked' : '', title: b ?? '', onclick: () => c.host.dispatch({ type: 'itsm.setAssetStatus', payload: { id: a.id, to: t.to, ...(user.value ? { user: user.value } : {}) } }) }, t.label); });
  const w = warrantyState(a, now); const hist = c.host.store.getLog().filter(e => e.subject.kind === 'asset' && e.subject.id === a.id && ['AssetStatusChanged', 'AssetAssigned', 'AssetCreatedManual'].includes(e.type)).reverse();
  const ctr = contractsForAsset(st, a.id);
  return h('div', null, h('h2', null, 'Cycle de vie'),
    h('p', null, h('span', { class: 'pill off' }, ASSET_STATUS_LABEL[a.status]), a.assignedTo ? ` affecté à ${st.management.users[a.assignedTo]?.name ?? '?'}` : ''),
    trs.length ? h('div', null, h('label', { class: 'fld' }, h('span', null, 'Pour une mise en service'), user), h('div', { class: 'actions' }, ...trs)) : h('p', { class: 'muted' }, 'Actif retiré : fin de parcours.'),
    h('p', null, 'Garantie : ', w === 'none' ? h('span', { class: 'muted' }, 'non renseignée') : h('span', { class: `pill ${w === 'valid' ? 'on' : w === 'expiring' ? 'warn' : 'down'}` }, w === 'valid' ? 'Valide' : w === 'expiring' ? 'Échéance proche' : 'Expirée'), a.warrantyEnd !== undefined ? ` (jusqu'au ${fmtTime(a.warrantyEnd)})` : ''),
    ctr.length ? h('p', null, 'Contrats : ', ctr.map(k => `${k.ref} ${k.title}`).join(' ; ')) : h('p', { class: 'muted' }, 'Aucun contrat ne couvre cet actif.'),
    hist.length ? h('ol', { class: 'hist' }, ...hist.map(e => h('li', null, h('time', null, fmtTime(e.t)), ' ', h('b', null, e.type === 'AssetStatusChanged' ? `${ASSET_STATUS_LABEL[e.payload['from'] as Asset['status']]} → ${ASSET_STATUS_LABEL[e.payload['to'] as Asset['status']]}` : e.type === 'AssetAssigned' ? (e.payload['user'] ? `Affecté à ${st.management.users[String(e.payload['user'])]?.name ?? '?'}` : 'Affectation retirée') : 'Créé')))) : null);
}
