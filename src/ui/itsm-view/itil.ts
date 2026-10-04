import { HOUR, type Article, type Change, type Level, type Problem } from '../../core';
import { TAXONOMY, CHANGE_STATUS_LABEL, CHANGE_TYPE_LABEL, LEVEL_LABEL, PROBLEM_STATUS_LABEL, RISK_LABEL, changeTransitionsFrom, problemTransitionsFrom, STATUS_LABEL } from '../../itsm';
import { h } from '../kit/dom';
import { ago, fmtTime } from '../shell/labels';
import type { Ctx } from './tickets';

type Field = { key: string; label: string; kind: 'text' | 'area' | 'select'; options?: [string, string][]; wide?: boolean };
const userName = (c: Ctx, id?: string) => (id && c.st.management.users[id]?.name) || '—';

/** Formulaire d'édition générique : envoie tous les champs d'un coup à la commande de mise à jour. */
function editor(c: Ctx, id: string, cmd: string, fields: Field[], values: Record<string, string | undefined>, locked: boolean): HTMLElement {
  const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
  const form = h('form', { class: 'tform', onsubmit: (e: Event) => { e.preventDefault(); c.host.dispatch({ type: cmd, payload: { id, fields: Object.fromEntries([...inputs].map(([k, el]) => [k, el.value])) } }); } },
    ...fields.map(f => {
      const v = values[f.key] ?? '';
      const el = f.kind === 'area' ? Object.assign(h('textarea', { rows: 3, ...(locked ? { disabled: true } : {}) }), { value: v })
        : f.kind === 'select' ? h('select', { ...(locked ? { disabled: true } : {}) }, ...(f.options ?? []).map(([val, l]) => h('option', { value: val, ...(val === v ? { selected: true } : {}) }, l)))
        : h('input', { type: 'text', value: v, autocomplete: 'off', ...(locked ? { disabled: true } : {}) });
      inputs.set(f.key, el as HTMLInputElement);
      return h('label', { class: `fld${f.wide || f.kind === 'area' ? ' wide' : ''}` }, h('span', null, f.label), el);
    }),
    locked ? null : h('button', { type: 'submit' }, 'Enregistrer'));
  return form;
}

const back = (c: Ctx, page: 'problems' | 'changes' | 'kb', label: string) => h('p', null, h('button', { class: 'link', onclick: () => c.go({ page }) }, `← ${label}`));
const note = (text: string) => h('aside', { class: 'realworld' }, h('strong', null, 'Dans les outils réels'), ' ', text);
const trButtons = (c: Ctx, items: { label: string; blocked: string | null; run: () => void }[]) => h('div', { class: 'trs' }, ...items.map(i => h('div', { class: 'tr' },
  h('button', { class: i.blocked ? 'blocked' : 'primary', 'aria-disabled': i.blocked ? 'true' : null, title: i.blocked ?? '', onclick: i.run }, i.label), i.blocked ? h('span', { class: 'muted' }, i.blocked) : null)));
const blockerOf = (c: Ctx, f: () => string | null) => f();

/* ---------------- Problèmes ---------------- */
export function problemList(c: Ctx): HTMLElement {
  const list = Object.values(c.st.management.problems); const title = h('input', { type: 'text', placeholder: 'Ex. : Défaillance du switch SW02', 'aria-label': 'Titre du problème' });
  return h('section', null, h('h1', null, 'Problèmes'),
    list.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Titre', 'Statut', 'Incidents liés', 'Cause racine'].map(x => h('th', null, x)))),
      h('tbody', null, ...list.map(p => h('tr', { class: 'row', tabindex: 0, onclick: () => c.go({ page: 'problem', id: p.id }), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') c.go({ page: 'problem', id: p.id }); } },
        h('td', null, h('code', null, p.ref)), h('td', null, h('b', null, p.title)), h('td', null, h('span', { class: `pill ${p.status === 'closed' || p.status === 'resolved' ? 'on' : p.status === 'known_error' ? 'warn' : 'off'}` }, PROBLEM_STATUS_LABEL[p.status])),
        h('td', null, String(p.ticketIds.length)), h('td', null, p.rootCause ? 'identifiée' : h('span', { class: 'muted' }, 'inconnue'))))))
      : h('p', { class: 'empty' }, 'Aucun problème. Un problème regroupe des incidents qui ont une cause commune : on la traite une fois, au lieu de rétablir le service incident après incident.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); if (c.host.dispatch({ type: 'itsm.createProblem', payload: { title: title.value } })) { const all = Object.values(c.host.store.getState().management.problems); c.go({ page: 'problem', id: all[all.length - 1]!.id }); } } },
      h('label', { class: 'fld' }, h('span', null, 'Nouveau problème'), title), h('button', { type: 'submit' }, 'Créer')),
    note('un incident rétablit le service ; un problème en cherche la cause (ITIL Problem Management). Une « erreur connue » est un problème dont la cause est identifiée et le contournement documenté.'));
}

export function problemPage(c: Ctx, id: string): HTMLElement {
  const p: Problem | undefined = c.st.management.problems[id];
  if (!p) return h('section', null, h('p', { class: 'empty' }, 'Ce problème n\'existe plus.'), back(c, 'problems', 'Problèmes'));
  const locked = p.status === 'closed';
  const cand = Object.values(c.st.management.tickets).filter(t => !t.problemId && t.kind === 'incident');
  const sel = h('select', { 'aria-label': 'Rattacher un incident', ...(locked ? { disabled: true } : {}) }, h('option', { value: '' }, '+ Rattacher un incident…'), ...cand.map(t => h('option', { value: t.id }, `${t.ref} — ${t.title}`)));
  sel.onchange = () => { if (sel.value) c.host.dispatch({ type: 'itsm.linkTicketToProblem', payload: { problem: p.id, ticket: sel.value } }); };
  const trs = problemTransitionsFrom(p.status).map(t => ({ label: `${t.label} → ${PROBLEM_STATUS_LABEL[t.to]}`, blocker: t.guard?.(p) ?? null, to: t.to }));
  return h('section', null, back(c, 'problems', 'Problèmes'),
    h('header', { class: 'asset-head' }, h('code', { class: 'ref' }, p.ref), h('h1', null, p.title), h('span', { class: 'pill off' }, PROBLEM_STATUS_LABEL[p.status])),
    h('div', { class: 'cols' },
      h('div', null, h('h2', null, 'Analyse'),
        editor(c, p.id, 'itsm.updateProblem', [{ key: 'description', label: 'Description', kind: 'area' }, { key: 'rootCause', label: 'Cause racine', kind: 'area' }, { key: 'workaround', label: 'Contournement', kind: 'area' }, { key: 'permanentFix', label: 'Correction définitive', kind: 'area' }], p as unknown as Record<string, string | undefined>, locked)),
      h('div', null, h('h2', null, 'Étape suivante'), trs.length ? trButtons(c, trs.map(t => ({ label: t.label, blocked: t.blocker, run: () => c.host.dispatch({ type: 'itsm.transitionProblem', payload: { id: p.id, to: t.to } }) }))) : h('p', { class: 'muted' }, 'Problème clos.'),
        h('h2', null, 'Incidents rattachés'),
        p.ticketIds.length ? h('ul', { class: 'tkl' }, ...p.ticketIds.map(t => { const tk = c.st.management.tickets[t]; return h('li', null, h('button', { class: 'link', onclick: () => c.go({ page: 'ticket', id: t }) }, tk?.ref ?? t), ` ${tk?.title ?? ''} `, h('span', { class: 'muted' }, tk ? `· ${STATUS_LABEL[tk.status]}` : ''), ' ',
          locked ? null : h('button', { class: 'link', onclick: () => c.host.dispatch({ type: 'itsm.unlinkTicketFromProblem', payload: { problem: p.id, ticket: t } }) }, 'Détacher')); })) : h('p', { class: 'muted' }, 'Aucun incident rattaché.'),
        locked ? null : sel,
        h('h2', null, 'Changements liés'), (() => { const ch = Object.values(c.st.management.changes).filter(x => x.problemId === p.id); return ch.length ? h('ul', { class: 'tkl' }, ...ch.map(x => h('li', null, h('button', { class: 'link', onclick: () => c.go({ page: 'change', id: x.id }) }, x.ref), ` ${x.title} · ${CHANGE_STATUS_LABEL[x.status]}`))) : h('p', { class: 'muted' }, 'Aucun. La correction définitive passe en général par un changement.'); })(),
        locked ? null : h('div', { class: 'actions' }, h('button', { onclick: () => c.go({ page: 'changes', forProblem: p.id }) }, 'Préparer un changement')))),
    note('GLPI : Assistance → Problèmes ; ServiceNow : Problem, avec « Known Error » et « Workaround ». La base de connaissances reprend souvent le contournement.'));
}

/* ---------------- Changements ---------------- */
export function changeList(c: Ctx, forProblem?: string): HTMLElement {
  const list = Object.values(c.st.management.changes); const title = h('input', { type: 'text', placeholder: 'Ex. : Remplacement du switch SW02', 'aria-label': 'Titre du changement' });
  const type = h('select', { 'aria-label': 'Type' }, ...(Object.entries(CHANGE_TYPE_LABEL) as [string, string][]).map(([v, l]) => h('option', { value: v, ...(v === 'normal' ? { selected: true } : {}) }, l)));
  return h('section', null, h('h1', null, 'Changements'),
    list.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Titre', 'Type', 'Statut', 'Risque', 'Planifié'].map(x => h('th', null, x)))),
      h('tbody', null, ...list.map(x => h('tr', { class: 'row', tabindex: 0, onclick: () => c.go({ page: 'change', id: x.id }), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') c.go({ page: 'change', id: x.id }); } },
        h('td', null, h('code', null, x.ref)), h('td', null, h('b', null, x.title)), h('td', null, CHANGE_TYPE_LABEL[x.type]), h('td', null, h('span', { class: `pill ${x.status === 'closed' || x.status === 'verified' ? 'on' : x.status === 'rejected' ? 'down' : 'off'}` }, CHANGE_STATUS_LABEL[x.status])),
        h('td', null, x.risk ? RISK_LABEL[x.risk] : '—'), h('td', null, x.scheduledAt !== undefined ? fmtTime(x.scheduledAt) : '—')))))
      : h('p', { class: 'empty' }, 'Aucun changement. Toute modification de l\'infrastructure en production devrait être demandée, évaluée, approuvée, puis vérifiée.'),
    h('form', { class: 'scan', onsubmit: (e: Event) => { e.preventDefault(); if (c.host.dispatch({ type: 'itsm.createChange', payload: { title: title.value, type: type.value, ...(forProblem ? { problem: forProblem } : {}) } })) { const all = Object.values(c.host.store.getState().management.changes); c.go({ page: 'change', id: all[all.length - 1]!.id }); } } },
      h('label', { class: 'fld' }, h('span', null, forProblem ? 'Nouveau changement (lié au problème)' : 'Nouveau changement'), title), h('label', { class: 'fld' }, h('span', null, 'Type'), type), h('button', { type: 'submit' }, 'Créer')),
    note('un changement normal est évalué puis approuvé par un responsable (CAB) ; un changement standard est pré-approuvé car répétitif et maîtrisé ; un changement urgent se traite avec une approbation accélérée.'));
}

export function changePage(c: Ctx, id: string): HTMLElement {
  const x: Change | undefined = c.st.management.changes[id];
  if (!x) return h('section', null, h('p', { class: 'empty' }, 'Ce changement n\'existe plus.'), back(c, 'changes', 'Changements'));
  const locked = x.status === 'closed'; const now = c.host.now();
  const mgrs = Object.values(c.st.management.users).filter(u => u.roles.includes('manager'));
  const dis = locked ? { disabled: true } : {};
  const assetSel = h('select', { 'aria-label': 'Lier un actif', ...dis }, h('option', { value: '' }, '+ Actif concerné…'), ...Object.values(c.st.management.assets).filter(a => !x.assetIds.includes(a.id)).map(a => h('option', { value: a.id }, a.name)));
  assetSel.onchange = () => { if (assetSel.value) c.host.dispatch({ type: 'itsm.updateChange', payload: { id: x.id, fields: { assetIds: [...x.assetIds, assetSel.value] } } }); };
  const hours = h('input', { type: 'number', min: 0, value: '24', 'aria-label': 'Dans combien d\'heures simulées', ...dis });
  const trs = changeTransitionsFrom(x).map(t => ({ label: `${t.label} → ${CHANGE_STATUS_LABEL[t.to]}`, blocked: t.guard?.(x, c.st) ?? null, to: t.to }));
  return h('section', null, back(c, 'changes', 'Changements'),
    h('header', { class: 'asset-head' }, h('code', { class: 'ref' }, x.ref), h('h1', null, x.title), h('span', { class: 'pill off' }, CHANGE_STATUS_LABEL[x.status]), h('span', { class: 'muted' }, CHANGE_TYPE_LABEL[x.type])),
    h('div', { class: 'cols' },
      h('div', null, h('h2', null, 'Évaluation et plan'),
        editor(c, x.id, 'itsm.updateChange', [
          { key: 'type', label: 'Type', kind: 'select', options: Object.entries(CHANGE_TYPE_LABEL) as [string, string][] },
          { key: 'risk', label: 'Risque', kind: 'select', options: [['', '— à évaluer —'], ...(['low', 'medium', 'high'] as Level[]).map(l => [l, LEVEL_LABEL[l]] as [string, string])] },
          { key: 'approver', label: 'Approbateur', kind: 'select', options: [['', '— à désigner —'], ...mgrs.map(u => [u.id, u.name] as [string, string])] },
          { key: 'description', label: 'Description', kind: 'area' }, { key: 'plan', label: 'Plan de mise en œuvre', kind: 'area' }, { key: 'rollback', label: 'Plan de retour arrière', kind: 'area' }, { key: 'result', label: 'Résultat de la vérification', kind: 'area' },
        ], { ...(x as unknown as Record<string, string | undefined>), risk: x.risk ?? '', approver: x.approver ?? '' }, locked),
        h('p', { class: 'muted' }, `Approbateur : ${userName(c, x.approver)}${x.scheduledAt !== undefined ? ` · intervention prévue ${fmtTime(x.scheduledAt)}` : ''}${x.implementedAt !== undefined ? ` · réalisé ${fmtTime(x.implementedAt)} (${ago(now, x.implementedAt)})` : ''}`)),
      h('div', null, h('h2', null, 'Étape suivante'), trs.length ? trButtons(c, trs.map(t => ({ label: t.label, blocked: t.blocked, run: () => c.host.dispatch({ type: 'itsm.transitionChange', payload: { id: x.id, to: t.to } }) }))) : h('p', { class: 'muted' }, 'Changement clos.'),
        locked ? null : h('div', { class: 'qual' }, h('label', { class: 'fld' }, h('span', null, 'Planifier dans (heures simulées)'), hours), h('button', { onclick: () => c.host.dispatch({ type: 'itsm.updateChange', payload: { id: x.id, fields: { scheduledAt: now + Math.max(0, Number(hours.value) || 0) * HOUR } } }) }, 'Fixer la date')),
        h('h2', null, 'Actifs concernés'),
        x.assetIds.length ? h('ul', { class: 'tkl' }, ...x.assetIds.map(a => { const as = c.st.management.assets[a]; const d = as?.deviceId; return h('li', null, h('button', { class: 'link', onclick: () => c.go({ page: 'asset', id: a }) }, as?.name ?? a), ' ', d ? h('button', { onclick: () => c.host.goInfra(d) }, 'Intervenir dans l\'infrastructure') : null); })) : h('p', { class: 'muted' }, 'Aucun actif lié : on ne sait pas ce que le changement touche.'),
        locked ? null : assetSel,
        x.problemId ? h('p', null, 'Lié au problème ', h('button', { class: 'link', onclick: () => c.go({ page: 'problem', id: x.problemId! }) }, c.st.management.problems[x.problemId]?.ref ?? x.problemId)) : null)),
    note('le changement est le seul chemin légitime pour modifier la production : l\'intervention elle-même (ici, dans la vue Infrastructure) n\'est jamais l\'étape qui « clôt » le changement ; c\'est la vérification qui le fait.'));
}

/* ---------------- Base de connaissances ---------------- */
export function kbList(c: Ctx): HTMLElement {
  const list = Object.values(c.st.management.articles);
  return h('section', null, h('h1', null, 'Base de connaissances'),
    list.length ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, ...['Réf.', 'Titre', 'Catégorie', 'Statut', 'Utilisé par'].map(x => h('th', null, x)))),
      h('tbody', null, ...list.map(a => h('tr', { class: 'row', tabindex: 0, onclick: () => c.go({ page: 'article', id: a.id }), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') c.go({ page: 'article', id: a.id }); } },
        h('td', null, h('code', null, a.ref)), h('td', null, h('b', null, a.title)), h('td', null, a.category ?? '—'), h('td', null, h('span', { class: `pill ${a.status === 'published' ? 'on' : 'off'}` }, a.status === 'published' ? 'Publié' : 'Brouillon')),
        h('td', null, `${Object.values(c.st.management.tickets).filter(t => t.articleIds?.includes(a.id)).length} ticket(s)`)))))
      : h('p', { class: 'empty' }, 'Aucun article. Le bon moment pour en écrire un : juste après avoir résolu un incident, depuis la fiche du ticket.'),
    note('Une base de connaissances (Knowledge) évite de résoudre deux fois le même incident. Un article n\'est utile que s\'il est publié, classé et retrouvable par catégorie.'));
}

export function articlePage(c: Ctx, id: string): HTMLElement {
  const a: Article | undefined = c.st.management.articles[id];
  if (!a) return h('section', null, h('p', { class: 'empty' }, 'Cet article n\'existe plus.'), back(c, 'kb', 'Base de connaissances'));
  const users = Object.values(c.st.management.tickets).filter(t => t.articleIds?.includes(a.id));
  const cats: [string, string][] = [['', '—'], ...Object.keys(TAXONOMY).map(k => [k, k] as [string, string])];
  return h('section', null, back(c, 'kb', 'Base de connaissances'),
    h('header', { class: 'asset-head' }, h('code', { class: 'ref' }, a.ref), h('h1', null, a.title), h('span', { class: `pill ${a.status === 'published' ? 'on' : 'off'}` }, a.status === 'published' ? 'Publié' : 'Brouillon')),
    a.sourceTicketId ? h('p', { class: 'muted' }, 'Rédigé depuis ', h('button', { class: 'link', onclick: () => c.go({ page: 'ticket', id: a.sourceTicketId! }) }, c.st.management.tickets[a.sourceTicketId]?.ref ?? a.sourceTicketId)) : null,
    editor(c, a.id, 'itsm.updateArticle', [{ key: 'title', label: 'Titre', kind: 'text', wide: true }, { key: 'category', label: 'Catégorie', kind: 'select', options: cats }, { key: 'symptoms', label: 'Symptômes (ce que voit l\'utilisateur)', kind: 'area' }, { key: 'cause', label: 'Cause', kind: 'area' }, { key: 'solution', label: 'Solution', kind: 'area' }], a as unknown as Record<string, string | undefined>, false),
    h('div', { class: 'actions' }, a.status === 'draft' ? h('button', { class: 'primary', onclick: () => c.host.dispatch({ type: 'itsm.publishArticle', payload: { id: a.id } }) }, 'Publier') : null),
    h('h2', null, 'Tickets où l\'article a servi'), users.length ? h('ul', { class: 'tkl' }, ...users.map(t => h('li', null, h('button', { class: 'link', onclick: () => c.go({ page: 'ticket', id: t.id }) }, t.ref), ` ${t.title}`))) : h('p', { class: 'muted' }, 'Aucun pour l\'instant.'),
    note('rédigez pour quelqu\'un qui ne connaît pas l\'incident : symptômes observables d\'abord, puis cause, puis solution pas à pas.'));
}
