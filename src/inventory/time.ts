import type { Scheduler, Store } from '../core';

/** Avance le temps simulé en déclenchant les remontées d'agent échues au bon instant. */
export function advance(store: Store, sch: Scheduler, ms: number): void {
  const end = sch.now + ms;
  for (let guard = 0; guard < 5000; guard++) {
    store.dispatch({ type: 'agent.tick', actor: 'system' });
    if (sch.now >= end) return;
    let next = end;
    for (const d of Object.values(store.getState().reality.devices)) {
      const n = d.agent.nextRun; if (d.agent.state === 'running' && d.powered && n !== undefined && n > sch.now && n < next) next = n;
    }
    sch.runFor(next - sch.now);
  }
}
