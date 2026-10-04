import { Rng, Scheduler, MINUTE } from '../../src/core';

describe('Scheduler', () => {
  it('exécute dans l\'ordre du temps puis de l\'insertion', () => {
    const s = new Scheduler(); const out: string[] = [];
    s.at(200, () => out.push('c')); s.at(100, () => out.push('a')); s.at(100, () => out.push('b'));
    s.runFor(1000);
    expect(out).toEqual(['a', 'b', 'c']);
    expect(s.now).toBe(1000);
  });
  it('annule un timer', () => {
    const s = new Scheduler(); let hit = false;
    const h = s.at(10, () => { hit = true; }); s.cancel(h); s.runFor(100);
    expect(hit).toBe(false);
  });
  it('runUntil et événements enchaînés', () => {
    const s = new Scheduler(); let n = 0;
    const tick = () => { n++; if (n < 5) s.at(MINUTE, tick); };
    s.at(0, tick);
    expect(s.runUntil(() => n === 5, 10 * MINUTE)).toBe(true);
  });
});

describe('Rng', () => {
  it('est déterministe pour une graine donnée', () => {
    const a = new Rng(42), b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('int() reste dans les bornes', () => {
    const r = new Rng(1);
    for (let i = 0; i < 500; i++) { const v = r.int(3, 7); expect(v >= 3 && v <= 7).toBe(true); }
  });
});
