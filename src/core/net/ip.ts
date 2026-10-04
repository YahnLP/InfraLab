/** IPv4 (entiers non signés), MAC et CIDR — portés de util.js du simulateur réseau. */
export const IP = {
  parse(s: string | number): number | null {
    if (typeof s === 'number') return s >>> 0;
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
    if (!m) return null;
    let n = 0;
    for (let i = 1; i <= 4; i++) { const b = Number(m[i]); if (b > 255) return null; n = n * 256 + b; }
    return n >>> 0;
  },
  str(n: number): string {
    n >>>= 0;
    return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
  },
  maskFromPrefix(p: number): number { return p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0; },
  prefixFromMask(m: number): number { m >>>= 0; let p = 0; while (p < 32 && (m & (0x80000000 >>> p))) p++; return p; },
  net(ip: number, mask: number): number { return (ip & mask) >>> 0; },
  bcast(ip: number, mask: number): number { return ((ip & mask) | ~mask) >>> 0; },
  inNet(ip: number, net: number, mask: number): boolean { return ((ip & mask) >>> 0) === ((net & mask) >>> 0); },
};

export interface Cidr { ip: number; mask: number; prefix: number }

export const CIDR = {
  parse(s: string): Cidr | null {
    const m = /^([\d.]+)\/(\d{1,2})$/.exec(String(s).trim());
    if (!m) return null;
    const ip = IP.parse(m[1] as string);
    const prefix = Number(m[2]);
    if (ip === null || prefix > 32) return null;
    return { ip, mask: IP.maskFromPrefix(prefix), prefix };
  },
  /** Adresse appartient-elle au CIDR ? */
  contains(c: Cidr, ip: number): boolean { return IP.inNet(ip, c.ip, c.mask); },
  /** Adresses d'hôtes utilisables (hors réseau et diffusion, sauf /31 et /32). Utile à la découverte réseau. */
  hosts(c: Cidr): number[] {
    const first = IP.net(c.ip, c.mask), last = IP.bcast(c.ip, c.mask);
    if (c.prefix >= 31) { const r: number[] = []; for (let a = first; a <= last; a++) r.push(a >>> 0); return r; }
    const out: number[] = [];
    for (let a = first + 1; a < last; a++) out.push(a >>> 0);
    return out;
  },
};

const hx2 = (n: number): string => (n < 16 ? '0' : '') + n.toString(16);

export const MAC = {
  valid(s: string): boolean { return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(s); },
  /** Normalise AA-BB-CC-11-22-33 / aabb.cc11.2233 / AABBCC112233 vers aa:bb:cc:11:22:33. */
  normalize(s: string): string | null {
    const h = s.replace(/[^0-9a-f]/gi, '').toLowerCase();
    if (h.length !== 12) return null;
    return h.match(/../g)!.join(':');
  },
  /** MAC déterministe à partir d'un OUI et d'un compteur. */
  make(oui: string, n: number): string {
    return `${oui}:${hx2((n >> 16) & 255)}:${hx2((n >> 8) & 255)}:${hx2(n & 255)}`.toLowerCase();
  },
};
