import { CommandError, nextId, type CiKind, type ContractKind, type RelationType, type State, type Store } from '../core';
import { SOFTWARE } from '../infra';
import { TEV } from './events';
import { ASSET_TRANSITIONS } from './itam';

type Ctx = { state: State; now: number };
const str = (v: unknown) => String(v ?? '');
const ref = (ctx: Ctx, key: string, prefix: string) => `${prefix}-${String((ctx.state.counters[key] = (ctx.state.counters[key] ?? 0) + 1)).padStart(4, '0')}`;

export function registerItamCommands(store: Store): void {
  const asset = (ctx: Ctx, id: unknown) => { const a = ctx.state.management.assets[str(id)]; if (!a) throw new CommandError('asset_not_found', 'Actif inconnu'); return a; };
  const supplier = (ctx: Ctx, id: unknown) => { const x = ctx.state.management.suppliers[str(id)]; if (!x) throw new CommandError('supplier_not_found', 'Fournisseur inconnu'); return x; };
  const assets = (ctx: Ctx, ids: unknown): string[] => { const l = [...new Set((ids as string[] | undefined) ?? [])]; l.forEach(i => asset(ctx, i)); return l; };

  /* ---- fournisseurs, contrats ---- */
  store.registerCommand('itsm.addSupplier', (ctx, p) => {
    const name = str(p['name']).trim(); if (!name) throw new CommandError('bad_name', 'Le nom est obligatoire');
    const id = nextId(ctx.state.counters, 'sup'); ctx.state.management.suppliers[id] = { id, name, ...(p['contact'] ? { contact: str(p['contact']) } : {}) };
    ctx.emit(TEV.SupplierAdded, { kind: 'supplier', id }, { name });
  });
  store.registerCommand('itsm.addContract', (ctx, p) => {
    const title = str(p['title']).trim(); if (!title) throw new CommandError('bad_title', 'Le titre est obligatoire');
    supplier(ctx, p['supplierId']); const startAt = Number(p['startAt'] ?? ctx.now), endAt = Number(p['endAt']);
    if (!Number.isFinite(endAt) || endAt <= startAt) throw new CommandError('bad_dates', 'La fin du contrat doit suivre son début');
    const kind = (['maintenance', 'licence', 'warranty', 'leasing'].includes(str(p['kind'])) ? str(p['kind']) : 'maintenance') as ContractKind;
    const id = nextId(ctx.state.counters, 'ctr'); const r = ref(ctx, 'contract', 'CTR');
    ctx.state.management.contracts[id] = { id, ref: r, title, supplierId: str(p['supplierId']), kind, startAt, endAt, assetIds: assets(ctx, p['assetIds']) };
    ctx.emit(TEV.ContractAdded, { kind: 'contract', id }, { ref: r, title });
  });
  store.registerCommand('itsm.updateContract', (ctx, p) => {
    const c = ctx.state.management.contracts[str(p['id'])]; if (!c) throw new CommandError('contract_not_found', 'Contrat inconnu');
    const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    if (f['title'] !== undefined && str(f['title']) !== c.title) { c.title = str(f['title']); changed.push('title'); }
    if (f['endAt'] !== undefined && Number(f['endAt']) !== c.endAt) { if (Number(f['endAt']) <= c.startAt) throw new CommandError('bad_dates', 'La fin du contrat doit suivre son début'); c.endAt = Number(f['endAt']); changed.push('endAt'); }
    if (f['assetIds'] !== undefined) { c.assetIds = assets(ctx, f['assetIds']); changed.push('assetIds'); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    ctx.emit(TEV.ContractUpdated, { kind: 'contract', id: c.id }, { fields: changed });
  });

  /* ---- logiciels, licences ---- */
  store.registerCommand('itsm.setSoftwarePolicy', (ctx, p) => {
    const sid = str(p['softwareId']); if (!SOFTWARE[sid]) throw new CommandError('software_not_found', 'Logiciel inconnu');
    const pol = str(p['policy']); const cur = ctx.state.management.softwarePolicy[sid];
    if (pol && pol !== 'authorized' && pol !== 'forbidden') throw new CommandError('bad_policy', 'Politique inconnue');
    if ((pol || undefined) === cur) throw new CommandError('nothing_changed', 'Aucune modification');
    if (pol) ctx.state.management.softwarePolicy[sid] = pol as 'authorized' | 'forbidden'; else delete ctx.state.management.softwarePolicy[sid];
    ctx.emit(TEV.SoftwarePolicyChanged, { kind: 'asset', id: sid }, { softwareId: sid, policy: pol || null });
  });
  store.registerCommand('itsm.addLicense', (ctx, p) => {
    const sid = str(p['softwareId']); if (!SOFTWARE[sid]) throw new CommandError('software_not_found', 'Logiciel inconnu');
    const quantity = Number(p['quantity']); if (!Number.isInteger(quantity) || quantity < 1) throw new CommandError('bad_quantity', 'La quantité doit être un entier positif');
    if (p['contractId'] && !ctx.state.management.contracts[str(p['contractId'])]) throw new CommandError('contract_not_found', 'Contrat inconnu');
    const id = nextId(ctx.state.counters, 'lic'); const r = ref(ctx, 'license', 'LIC');
    ctx.state.management.licenses[id] = { id, ref: r, softwareId: sid, quantity, ...(p['contractId'] ? { contractId: str(p['contractId']) } : {}), ...(p['expiresAt'] !== undefined && p['expiresAt'] !== null ? { expiresAt: Number(p['expiresAt']) } : {}) };
    ctx.emit(TEV.LicenseAdded, { kind: 'license', id }, { ref: r, softwareId: sid, quantity });
  });
  store.registerCommand('itsm.updateLicense', (ctx, p) => {
    const l = ctx.state.management.licenses[str(p['id'])]; if (!l) throw new CommandError('license_not_found', 'Licence inconnue');
    const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    if (f['quantity'] !== undefined && Number(f['quantity']) !== l.quantity) { const q = Number(f['quantity']); if (!Number.isInteger(q) || q < 1) throw new CommandError('bad_quantity', 'La quantité doit être un entier positif'); l.quantity = q; changed.push('quantity'); }
    if (f['expiresAt'] !== undefined && f['expiresAt'] !== (l.expiresAt ?? null)) { if (f['expiresAt'] === null) delete l.expiresAt; else l.expiresAt = Number(f['expiresAt']); changed.push('expiresAt'); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    ctx.emit(TEV.LicenseUpdated, { kind: 'license', id: l.id }, { fields: changed });
  });

  /* ---- cycle de vie des actifs ---- */
  store.registerCommand('itsm.createAsset', (ctx, p) => {
    const name = str(p['name']).trim(); if (!name) throw new CommandError('bad_name', 'Le nom est obligatoire');
    if (Object.values(ctx.state.management.assets).some(a => a.name === name)) throw new CommandError('duplicate', 'Un actif porte déjà ce nom');
    const status = str(p['status']) === 'stock' ? 'stock' : 'ordered'; const id = nextId(ctx.state.counters, 'ast');
    ctx.state.management.assets[id] = {
      id, name, status, createdAt: ctx.now, identity: { macs: [], ips: [] },
      ...(p['model'] ? { model: str(p['model']) } : {}), ...(p['vendor'] ? { vendor: str(p['vendor']) } : {}), ...(p['serial'] ? { serial: str(p['serial']) } : {}),
      ...(p['purchasedAt'] !== undefined ? { purchasedAt: Number(p['purchasedAt']) } : {}), ...(p['warrantyEnd'] !== undefined ? { warrantyEnd: Number(p['warrantyEnd']) } : {}), ...(p['cost'] !== undefined ? { cost: Number(p['cost']) } : {}),
    };
    ctx.emit(TEV.AssetCreatedManual, { kind: 'asset', id }, { name, status });
  });
  store.registerCommand('itsm.updateAssetFinance', (ctx, p) => {
    const a = asset(ctx, p['id']); const f = (p['fields'] ?? {}) as Record<string, unknown>; const changed: string[] = [];
    for (const k of ['purchasedAt', 'warrantyEnd', 'cost'] as const) if (f[k] !== undefined && Number(f[k]) !== a[k]) { a[k] = Number(f[k]); changed.push(k); }
    if (!changed.length) throw new CommandError('nothing_changed', 'Aucune modification');
    ctx.emit(TEV.AssetUpdatedFinance, { kind: 'asset', id: a.id }, { fields: changed });
  });
  store.registerCommand('itsm.setAssetStatus', (ctx, p) => {
    const a = asset(ctx, p['id']); const to = str(p['to']); const user = p['user'] ? str(p['user']) : undefined;
    const tr = ASSET_TRANSITIONS.find(t => t.from === a.status && t.to === to);
    if (!tr) throw new CommandError('bad_transition', `Passage impossible : ${a.status} → ${to}`);
    if (user && !ctx.state.management.users[user]) throw new CommandError('user_not_found', 'Utilisateur inconnu');
    const b = tr.guard?.(a, user); if (b) throw new CommandError('guard_failed', b);
    const from = a.status; a.status = tr.to;
    if (user && tr.to === 'in_use') { a.assignedTo = user; const u = ctx.state.management.users[user]!; if (u.service) a.service = u.service; ctx.emit('AssetAssigned', { kind: 'asset', id: a.id }, { user }); }
    if (tr.to === 'stock' || tr.to === 'retired') { if (a.assignedTo) { delete a.assignedTo; ctx.emit('AssetAssigned', { kind: 'asset', id: a.id }, { user: null }); } }
    ctx.emit(TEV.AssetStatusChanged, { kind: 'asset', id: a.id }, { from, to: tr.to });
  });

  /* ---- CMDB ---- */
  store.registerCommand('itsm.createCi', (ctx, p) => {
    const name = str(p['name']).trim(); if (!name) throw new CommandError('bad_name', 'Le nom est obligatoire');
    const kind = (['service', 'application', 'infrastructure'].includes(str(p['kind'])) ? str(p['kind']) : 'infrastructure') as CiKind;
    const aid = p['asset'] ? str(p['asset']) : undefined; if (aid) { asset(ctx, aid); if (Object.values(ctx.state.management.cis).some(c => c.assetId === aid)) throw new CommandError('duplicate', 'Cet actif a déjà un CI'); }
    if (kind === 'infrastructure' && !aid) throw new CommandError('asset_required', 'Un CI d\'infrastructure repose sur un actif');
    if (Object.values(ctx.state.management.cis).some(c => c.name === name)) throw new CommandError('duplicate', 'Un CI porte déjà ce nom');
    const id = nextId(ctx.state.counters, 'ci'); const r = ref(ctx, 'ci', 'CI');
    ctx.state.management.cis[id] = { id, ref: r, name, kind, ...(aid ? { assetId: aid } : {}), ...(p['description'] ? { description: str(p['description']) } : {}) };
    ctx.emit(TEV.CiCreated, { kind: 'ci', id }, { ref: r, name, ciKind: kind });
  });
  store.registerCommand('itsm.removeCi', (ctx, p) => {
    const c = ctx.state.management.cis[str(p['id'])]; if (!c) throw new CommandError('ci_not_found', 'CI inconnu');
    for (const r of Object.values(ctx.state.management.relations)) if (r.from === c.id || r.to === c.id) delete ctx.state.management.relations[r.id];
    delete ctx.state.management.cis[c.id]; ctx.emit(TEV.CiRemoved, { kind: 'ci', id: c.id }, { name: c.name });
  });
  store.registerCommand('itsm.addRelation', (ctx, p) => {
    const from = ctx.state.management.cis[str(p['from'])], to = ctx.state.management.cis[str(p['to'])];
    if (!from || !to) throw new CommandError('ci_not_found', 'CI inconnu'); if (from.id === to.id) throw new CommandError('self_relation', 'Un CI ne peut pas dépendre de lui-même');
    const type = (['depends_on', 'uses', 'hosted_on'].includes(str(p['type'])) ? str(p['type']) : 'depends_on') as RelationType;
    if (Object.values(ctx.state.management.relations).some(r => r.from === from.id && r.to === to.id && r.type === type)) throw new CommandError('duplicate', 'Relation déjà déclarée');
    const id = nextId(ctx.state.counters, 'rel'); ctx.state.management.relations[id] = { id, from: from.id, to: to.id, type };
    ctx.emit(TEV.RelationAdded, { kind: 'relation', id }, { from: from.name, to: to.name, type });
  });
  store.registerCommand('itsm.removeRelation', (ctx, p) => {
    const r = ctx.state.management.relations[str(p['id'])]; if (!r) throw new CommandError('relation_not_found', 'Relation inconnue');
    delete ctx.state.management.relations[r.id]; ctx.emit(TEV.RelationRemoved, { kind: 'relation', id: r.id }, {});
  });
}
