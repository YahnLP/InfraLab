/** Planificateur à événements discrets, temps simulé en ms — porté de sim.js (Heap, at, cancel, runFor, runUntil). */
interface Entry { t: number; n: number; fn: () => void; dead: boolean; tag: string }

class Heap {
  private a: Entry[] = [];
  get size(): number { return this.a.length; }
  private less(x: Entry, y: Entry): boolean { return x.t < y.t || (x.t === y.t && x.n < y.n); }
  push(e: Entry): void {
    const a = this.a; a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(a[i]!, a[p]!)) { [a[i], a[p]] = [a[p]!, a[i]!]; i = p; } else break;
    }
  }
  peek(): Entry | undefined { return this.a[0]; }
  pop(): Entry | undefined {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length && last) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && this.less(a[l]!, a[m]!)) m = l;
        if (r < a.length && this.less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!]; i = m;
      }
    }
    return top;
  }
  clear(): void { this.a.length = 0; }
}

export type TimerHandle = Entry;

export class Scheduler {
  now: number;
  private heap = new Heap();
  private seq = 0;
  constructor(t0 = 0) { this.now = t0; }

  at(delayMs: number, fn: () => void, tag = 't'): TimerHandle {
    const e: Entry = { t: this.now + Math.max(0, delayMs), n: ++this.seq, fn, dead: false, tag };
    this.heap.push(e);
    return e;
  }
  cancel(h: TimerHandle | undefined): void { if (h) h.dead = true; }
  get pending(): number { return this.heap.size; }

  private next(): Entry | undefined {
    let e: Entry | undefined;
    while ((e = this.heap.peek()) && e.dead) this.heap.pop();
    return e;
  }
  /** Exécute le prochain événement ; faux s'il n'y en a plus. */
  runNext(): boolean {
    const e = this.next(); if (!e) return false;
    this.heap.pop();
    if (e.t > this.now) this.now = e.t;
    e.fn();
    return true;
  }
  /** Avance le temps simulé de `ms`, en exécutant les événements échus. */
  runFor(ms: number): void {
    const end = this.now + ms; let e: Entry | undefined;
    while ((e = this.next()) && e.t <= end) this.runNext();
    if (this.now < end) this.now = end;
  }
  runUntil(pred: () => boolean, maxMs = 10_000): boolean {
    const end = this.now + maxMs; let e: Entry | undefined;
    while (!pred() && (e = this.next()) && e.t <= end) this.runNext();
    return pred();
  }
  /** Vide la file (reset de TP). */
  clear(): void { this.heap.clear(); }
}

export const SECOND = 1000, MINUTE = 60 * SECOND, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
