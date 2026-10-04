/** Identifiants techniques stables (dev-001) et références métier affichées (INC-0042). */
export type Counters = Record<string, number>;

export function nextId(counters: Counters, prefix: string, width = 3): string {
  const n = (counters[prefix] ?? 0) + 1;
  counters[prefix] = n;
  return `${prefix}-${String(n).padStart(width, '0')}`;
}

export function nextRef(counters: Counters, prefix: string, width = 4): string {
  return nextId(counters, prefix, width);
}
