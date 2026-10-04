import { can, type Level, type State, type Ticket, type TicketKind } from '../../core';
import { SLA_LABEL, fmtDuration, slaOf, type SlaClock, KIND_LABEL, LEVEL_LABEL, PRIORITY_LABEL, STATUS_LABEL, TAXONOMY, blocker, byQueueOrder, isOpen, ticketPriority, transitionsFrom } from '../../itsm';
import { h } from '../kit/dom';
import { EVENT_LABEL, ago, fmtTime } from '../shell/labels';
import type { ItsmHost, Route } from './view';

export interface Ctx { st: Readonly<State>; host: ItsmHost; go(r: Route): void }

const prioClass = (p?: number) => p === 1 ? 'down' : p === 2 ? 'warn' : p ? 'off' : 'off';
export const prioPill = (t: Ticket) => { const p = ticketPriority(t); return h('span', { class: `pill ${prioClass(p)}` }, p ? PRIORITY_LABEL[p] : 'À qualifier'); };
const statusPill = (t: Ticket) => h('span', { class: `pill ${t.status === 'closed' || t.status === 'resolved' ? 'on' : t.status === 'new' ? 'warn' : 'off'}` }, STATUS_LABEL[t.status]);
const userName = (st: Readonly<State>, id?: string) => (id && st.management.users[id]?.name) || '—';
const assetName = (st: Readonly<State>, id: string) => st.management.assets[id]?.name ?? id;

const FIELD_LABEL: Record<string, string> = { title: 'titre', description: 'description', category: 'catégorie', subcategory: 'sous-catégorie', impact: 'impact', urgency: 'urgence', assignee: 'assigné', solution: 'solution' };

const slaPill = (k: SlaClock) => h('span', { class: `pill ${k.state === 'breached' ? 'down' : k.state === 'at_risk' ? 'warn' : k.state === 'met' ? 'on' : 'off'}`, title: `Cible ${fmtDuration(k.target)}` }, `${SLA_LABEL[k.state]}${k.state === 'running' || k.state === 'at_risk' ? ` · reste ${fmtDuration(k.remaining)}` : k.state === 'breached' ? ` · ${fmtDuration(k.remaining)}` : ''}`);

export type TicketFilter = { kind?: TicketKind; scope?: 'open' | 'all' };

export function ticketList(c: Ctx, f: TicketFilter): HTMLElement {
  const { st } = c; const scope = f.scope ?? 'open';
  let list = Object.values(st.management.tickets);
  if (f.kind) list = list.filter(t => t.kind === f.kind);
  const mineOnly = !!st.actingAs && !can(st, 'ticket.viewAll'); if (mineOnly) list = list.filter(t => t.requester === st.actingAs);
  if (scope === 'open') list = list.filter(isOpen);
  list.sort(byQueueOrder);
  const title = f.kind === 'incident' ? 'Incidents' : f.kind === 'request' ? 'Demandes' : 'Tickets';
  const chip = (s: 'open' | 'all', label: string) => h('button', { class: `chip${scope === s ? ' on' : ''}`, onclick: () => c.go({ page: 'tickets', ...(f.kind ? { kind: f.kind } : {}), scope: s }) }, label);
  return h('section', null, h('h1', null, title), mineOnly ? h('p', { class: 'muted' }, 'Vous ne voyez que vos propres tickets : le droit « Voir les tickets de tout le monde » manque à ce rôle.') : null,
    h('div', { class: 'chips' }, chip('open', 'À traiter'), chip('all', 'Tous (y compris résolus et clos)'), h('span', { class: 'grow' }),
      h('button', { class: 'primary', onclick: () => c.go({ page: 'newticket' }) }, 'Nouveau ticket')),
    list.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Titre', 'Demandeur', 'Statut', 'Priorité', 'Assigné à', 'SLA résolution', 'Actifs', 'Mis à jour'].map(x => h('th', null, x)))),
      h('tbody', null, ...list.map(t => h('tr', { class: 'row', tabindex: 0, onclick: () => c.go({ page: 'ticket', id: t.id }), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') c.go({ page: 'ticket', id: t.id }); } },
        h('td', null, h('code', null, t.ref)), h('td', null, h('b', null, t.title)), h('td', null, userName(st, t.requester)), h('td', null, statusPill(t)), h('td', null, prioPill(t)),
        h('td', null, userName(st, t.assignee)), h('td', null, (() => { const sl = slaOf(t, c.host.now()); return sl ? slaPill(sl.resolve) : h('span', { class: 'muted' }, '—'); })()), h('td', null, t.assetIds.map(a => assetName(st, a)).join(', ') || h('span', { class: 'muted' }, '—')), h('td', null, ago(c.host.now(), t.updatedAt)))))
    ) : h('p', { class: 'empty' }, scope === 'open' ? 'Aucun ticket à traiter. Les utilisateurs signalent un incident ou font une demande : créez un ticket pour jouer ce rôle.' : 'Aucun ticket.'),
    h('aside', { class: 'realworld' }, h('strong', null, 'Dans les outils réels'), ' incident = ticket de type Incident ; demande = Service Request. La file est triée par priorité : P1 d\'abord (ServiceNow, GLPI, Jira Service Management…).'));
}

export function newTicketPage(c: Ctx, assetId?: string): HTMLElement {
  const { st } = c; const users = Object.values(st.management.users); const assets = Object.values(st.management.assets);
  const title = h('input', { type: 'text', name: 'title', required: true, autocomplete: 'off', placeholder: 'Ex. : Mon PC n\'a plus Internet' });
  const desc = h('textarea', { name: 'description', rows: 4, placeholder: 'Ce que l\'utilisateur observe, depuis quand, ce qu\'il a déjà essayé.' });
  const kind = h('select', { name: 'kind', 'aria-label': 'Type' }, h('option', { value: 'incident' }, 'Incident (quelque chose ne marche plus)'), h('option', { value: 'request' }, 'Demande (l\'utilisateur veut quelque chose)'));
  const req = h('select', { name: 'requester', required: true, 'aria-label': 'Demandeur' }, h('option', { value: '' }, '— choisir —'), ...users.map(u => h('option', { value: u.id }, `${u.name}${u.service ? ` (${u.service})` : ''}`)));
  const asset = h('select', { name: 'asset', 'aria-label': 'Actif concerné' }, h('option', { value: '' }, '(aucun / je ne sais pas)'), ...assets.map(a => h('option', { value: a.id, ...(a.id === assetId ? { selected: true } : {}) }, a.name)));
  return h('section', null, h('p', null, h('button', { class: 'link', onclick: () => c.go({ page: 'tickets' }) }, '← Tickets')), h('h1', null, 'Nouveau ticket'),
    h('form', { class: 'tform', onsubmit: (e: Event) => {
      e.preventDefault(); const before = Object.keys(c.st.management.tickets).length;
      const ok = c.host.dispatch({ type: 'itsm.createTicket', payload: { title: title.value, description: desc.value, kind: kind.value, requester: req.value, assetIds: asset.value ? [asset.value] : [] } });
      if (ok) { const all = Object.values(c.host.store.getState().management.tickets); if (all.length > before) c.go({ page: 'ticket', id: all[all.length - 1]!.id }); }
    } },
      h('label', { class: 'fld' }, h('span', null, 'Type'), kind), h('label', { class: 'fld' }, h('span', null, 'Demandeur'), req),
      h('label', { class: 'fld wide' }, h('span', null, 'Titre'), title), h('label', { class: 'fld wide' }, h('span', null, 'Description'), desc),
      h('label', { class: 'fld' }, h('span', null, 'Actif concerné'), asset),
      h('button', { type: 'submit', class: 'primary' }, 'Créer le ticket')),
    h('aside', { class: 'realworld' }, h('strong', null, 'Dans les outils réels'), ' le lien entre le ticket et l\'actif est ce qui permet de retrouver l\'historique d\'un poste. Sans lui, le ticket reste une simple conversation. L\'impact et l\'urgence se renseignent à la qualification, pas à la création.'));
}

export function ticketPage(c: Ctx, id: string): HTMLElement {
  const { st } = c; const t = st.management.tickets[id];
  if (!t) return h('section', null, h('p', { class: 'empty' }, 'Ce ticket n\'existe plus.'), h('button', { onclick: () => c.go({ page: 'tickets' }) }, 'Retour aux tickets'));
  const locked = t.status === 'closed'; const dis = locked ? { disabled: true } : {};
  const upd = (fields: Record<string, unknown>) => c.host.dispatch({ type: 'itsm.updateTicket', payload: { id: t.id, fields } });
  const sel = (label: string, key: string, opts: [string, string][], val: string | undefined, extra: Record<string, unknown> = {}) => {
    const s = h('select', { 'aria-label': label, ...dis, ...extra, onchange: () => upd({ [key]: s.value }) }, ...opts.map(([v, l]) => h('option', { value: v, ...((val ?? '') === v ? { selected: true } : {}) }, l)));
    return h('label', { class: 'fld' }, h('span', null, label), s);
  };
  const lv = (label: string, key: 'impact' | 'urgency') => sel(label, key, [['', '— à renseigner —'], ...(['low', 'medium', 'high'] as Level[]).map(l => [l, LEVEL_LABEL[l]] as [string, string])], t[key]);
  const techs = Object.values(st.management.users).filter(u => u.roles.includes('technician'));
  const sol = h('textarea', { rows: 4, ...dis, placeholder: 'Cause constatée, action réalisée, vérification.' }); sol.value = t.solution ?? '';
  const cmt = h('textarea', { rows: 2, placeholder: 'Ajouter un commentaire (échange avec l\'utilisateur, diagnostic en cours…)' });
  const linkSel = h('select', { 'aria-label': 'Lier un actif', ...dis }, h('option', { value: '' }, '+ Lier un actif…'), ...Object.values(st.management.assets).filter(a => !t.assetIds.includes(a.id)).map(a => h('option', { value: a.id }, a.name)));
  linkSel.onchange = () => { if (linkSel.value) c.host.dispatch({ type: 'itsm.linkAsset', payload: { id: t.id, asset: linkSel.value } }); };

  const trs = transitionsFrom(t.status).map(tr => { const b = blocker(t, tr, st);
    return h('div', { class: 'tr' }, h('button', { class: b ? 'blocked' : 'primary', 'aria-disabled': b ? 'true' : null, title: b ?? '', onclick: () => c.host.dispatch({ type: 'itsm.transitionTicket', payload: { id: t.id, to: tr.to } }) }, `${tr.label} → ${STATUS_LABEL[tr.to]}`), b ? h('span', { class: 'muted' }, b) : null); });
  const hist = c.host.store.getLog().filter(e => e.subject.kind === 'ticket' && e.subject.id === t.id);
  const timeline = [...hist.map(e => ({ t: e.t, text: EVENT_LABEL[e.type] ?? e.type, detail: e.type === 'TicketStatusChanged' ? `${STATUS_LABEL[e.payload['from'] as Ticket['status']]} → ${STATUS_LABEL[e.payload['to'] as Ticket['status']]}` : e.type === 'TicketUpdated' ? (e.payload['fields'] as string[]).map(f => FIELD_LABEL[f] ?? f).join(', ') : e.type === 'TicketAssetLinked' || e.type === 'TicketAssetUnlinked' ? assetName(st, String(e.payload['asset'])) : e.type === 'TicketCommented' ? String(e.payload['text']) : '' }))].reverse();

  return h('section', null,
    h('p', null, h('button', { class: 'link', onclick: () => c.go({ page: 'tickets' }) }, '← Tickets')),
    h('header', { class: 'asset-head' }, h('code', { class: 'ref' }, t.ref), h('h1', null, t.title), statusPill(t), prioPill(t)),
    h('p', { class: 'muted' }, `${KIND_LABEL[t.kind]} · demandé par ${userName(st, t.requester)} · créé ${fmtTime(t.createdAt)} (${ago(c.host.now(), t.createdAt)})`),
    t.description ? h('p', { class: 'desc' }, t.description) : null,
    h('div', { class: 'cols' },
      h('div', null,
        h('h2', null, 'Qualification'),
        h('div', { class: 'qual' },
          sel('Catégorie', 'category', [['', '— à choisir —'], ...Object.keys(TAXONOMY).map(k => [k, k] as [string, string])], t.category),
          sel('Sous-catégorie', 'subcategory', [['', '—'], ...(t.category ? TAXONOMY[t.category]! : []).map(k => [k, k] as [string, string])], t.subcategory, t.category ? {} : { disabled: true }),
          lv('Impact', 'impact'), lv('Urgence', 'urgency'),
          sel('Assigné à', 'assignee', [['', '— personne —'], ...techs.map(u => [u.id, u.name] as [string, string])], t.assignee)),
        h('p', { class: 'muted' }, 'Priorité = impact × urgence. L\'impact mesure combien de personnes ou de services sont touchés ; l\'urgence, le délai que le problème tolère.'),
        h('h2', null, 'Actifs concernés'),
        t.assetIds.length ? h('ul', { class: 'tkl' }, ...t.assetIds.map(a => { const as = st.management.assets[a]; const d = as?.deviceId ? st.reality.devices[as.deviceId] : undefined;
          return h('li', null, h('button', { class: 'link', onclick: () => c.go({ page: 'asset', id: a }) }, assetName(st, a)), ' ',
            d ? h('span', { class: `pill ${!d.powered ? 'off' : d.online ? 'on' : 'down'}` }, !d.powered ? 'éteint' : d.online ? 'en ligne' : 'hors ligne') : null, ' ',
            d ? h('button', { onclick: () => c.host.goInfra(d.id) }, 'Voir dans l\'infrastructure') : null, ' ',
            locked ? null : h('button', { class: 'link', onclick: () => c.host.dispatch({ type: 'itsm.unlinkAsset', payload: { id: t.id, asset: a } }) }, 'Délier')); }))
          : h('p', { class: 'muted' }, 'Aucun actif lié. Sans lien, impossible de savoir quel équipement est concerné ni de retrouver l\'historique du poste.'),
        locked ? null : linkSel,
        h('h2', null, 'SLA'),
        (() => { const sl = slaOf(t, c.host.now()); return sl ? h('div', null, h('p', null, h('b', null, 'Prise en charge : '), slaPill(sl.respond)), h('p', null, h('b', null, 'Résolution : '), slaPill(sl.resolve)), h('p', { class: 'muted' }, 'L\'horloge s\'arrête en « en attente » et à la résolution. Avancez l\'heure simulée pour la voir courir.')) : h('p', { class: 'muted' }, 'Le SLA dépend de la priorité : qualifiez le ticket.'); })(),
        h('h2', null, 'Solution'), sol,
        locked ? null : h('div', { class: 'actions' }, h('button', { onclick: () => upd({ solution: sol.value }) }, 'Enregistrer la solution'))),
      h('div', null,
        h('h2', null, 'Étape suivante'), trs.length ? h('div', { class: 'trs' }, ...trs) : h('p', { class: 'muted' }, 'Ticket clos : il reste consultable, mais plus modifiable (sauf commentaires).'),
        h('h2', null, 'Problème'),
        t.problemId ? h('p', null, 'Rattaché à ', h('button', { class: 'link', onclick: () => c.go({ page: 'problem', id: t.problemId! }) }, st.management.problems[t.problemId]?.ref ?? t.problemId))
          : h('div', { class: 'actions' }, h('button', { onclick: () => { if (c.host.dispatch({ type: 'itsm.createProblem', payload: { title: t.title, tickets: [t.id] } })) { const all = Object.values(c.host.store.getState().management.problems); c.go({ page: 'problem', id: all[all.length - 1]!.id }); } } }, 'Ouvrir un problème depuis ce ticket')),
        h('h2', null, 'Base de connaissances'),
        (() => {
          const pub = Object.values(st.management.articles).filter(a => a.status === 'published' && !t.articleIds?.includes(a.id));
          const sug = pub.filter(a => a.category && a.category === t.category); const rest = pub.filter(a => !sug.includes(a));
          const own = Object.values(st.management.articles).filter(a => a.sourceTicketId === t.id);
          const asel = h('select', { 'aria-label': 'Associer un article' }, h('option', { value: '' }, sug.length ? `+ Associer un article (${sug.length} suggéré(s) pour « ${t.category} »)` : '+ Associer un article publié…'), ...[...sug, ...rest].map(a => h('option', { value: a.id }, `${a.ref} — ${a.title}`)));
          asel.onchange = () => { if (asel.value) c.host.dispatch({ type: 'itsm.linkArticle', payload: { article: asel.value, ticket: t.id } }); };
          return h('div', null, (t.articleIds ?? []).length ? h('ul', { class: 'tkl' }, ...(t.articleIds ?? []).map(i => h('li', null, h('button', { class: 'link', onclick: () => c.go({ page: 'article', id: i }) }, st.management.articles[i]?.ref ?? i), ` ${st.management.articles[i]?.title ?? ''}`))) : null,
            pub.length ? asel : null,
            own.length ? h('p', null, 'Article rédigé : ', ...own.map(a => h('button', { class: 'link', onclick: () => c.go({ page: 'article', id: a.id }) }, a.ref))) : h('div', { class: 'actions' }, h('button', { onclick: () => { if (c.host.dispatch({ type: 'itsm.createArticle', payload: { ticket: t.id } })) { const all = Object.values(c.host.store.getState().management.articles); c.go({ page: 'article', id: all[all.length - 1]!.id }); } } }, 'Rédiger un article depuis ce ticket')));
        })(),
        h('h2', null, 'Commentaires'),
        t.comments.length ? h('ul', { class: 'cmts' }, ...[...t.comments].reverse().map(m => h('li', null, h('time', null, fmtTime(m.t)), ' ', m.text))) : null,
        cmt, h('div', { class: 'actions' }, h('button', { onclick: () => { if (c.host.dispatch({ type: 'itsm.addComment', payload: { id: t.id, text: cmt.value } })) cmt.value = ''; } }, 'Commenter')),
        h('h2', null, 'Historique'),
        h('ol', { class: 'hist' }, ...timeline.map(x => h('li', null, h('time', null, fmtTime(x.t)), ' ', h('b', null, x.text), x.detail ? h('span', { class: 'muted' }, ` — ${x.detail}`) : null))))),
    h('aside', { class: 'realworld' }, h('strong', null, 'Dans les outils réels'), ' le cycle de vie d\'un incident suit ITIL : enregistrement, classification, priorisation, diagnostic, résolution, clôture. La documentation de la solution alimente ensuite la base de connaissances.'));
}
