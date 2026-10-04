/** Générateur pseudo-aléatoire à graine (mulberry32). Aucun Math.random() dans le Core : déterminisme. */
export class Rng {
  private s: number;
  constructor(seed = 20261004) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  pick<T>(a: readonly T[]): T { return a[this.int(0, a.length - 1)] as T; }
  get state(): number { return this.s; }
}
