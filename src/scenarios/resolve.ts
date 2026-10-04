import type { State } from '../core';

/** Résout `@dev:`, `@usr:`, `@ast:`, `@tkt:`, `@prb:`, `@chg:`, `@kb:` dans une valeur (récursif sur objets et tableaux). */
export function resolveRefs<T>(st: Readonly<State>, v: T): T {
  if (typeof v === 'string' && v.startsWith('@')) return resolveOne(st, v) as unknown as T;
  if (Array.isArray(v)) return v.map(x => resolveRefs(st, x)) as unknown as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveRefs(st, x)])) as T;
  return v;
}
function resolveOne(st: Readonly<State>, ref: string): string {
  const i = ref.indexOf(':'); if (i < 0) return ref;
  const kind = ref.slice(1, i), key = ref.slice(i + 1);
  if (kind === 'lnk') { const d = Object.values(st.reality.devices).find(x => x.name === key); const l = d && Object.values(st.reality.links).find(x => x.a.device === d.id || x.b.device === d.id); return l ? l.id : `?${ref}`; }
  const found = kind === 'dev' ? Object.values(st.reality.devices).find(d => d.name === key)
    : kind === 'usr' ? Object.values(st.management.users).find(u => u.name.startsWith(key))
    : kind === 'ast' ? Object.values(st.management.assets).find(a => a.name === key)
    : kind === 'tkt' ? Object.values(st.management.tickets).find(t => t.ref === key)
    : kind === 'prb' ? Object.values(st.management.problems).find(t => t.ref === key)
    : kind === 'chg' ? Object.values(st.management.changes).find(t => t.ref === key)
    : kind === 'kb' ? Object.values(st.management.articles).find(t => t.ref === key) : undefined;
  return found ? found.id : `?${ref}`; // référence introuvable : la commande échouera clairement
}
