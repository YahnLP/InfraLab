import { CIDR, IP, MAC } from '../../src/core';

describe('IP / CIDR / MAC', () => {
  it('parse et formate une IPv4', () => {
    expect(IP.parse('192.168.10.21')).toBe(0xc0a80a15);
    expect(IP.str(0xc0a80a15)).toBe('192.168.10.21');
    expect(IP.parse('300.1.1.1')).toBeNull();
  });
  it('masque <-> préfixe', () => {
    expect(IP.maskFromPrefix(24)).toBe(0xffffff00);
    expect(IP.prefixFromMask(0xffffff00)).toBe(24);
  });
  it('liste les hôtes d\'un /24 (254 adresses, hors réseau et diffusion)', () => {
    const hosts = CIDR.hosts(CIDR.parse('192.168.10.0/24')!);
    expect(hosts).toHaveLength(254);
    expect(IP.str(hosts[0]!)).toBe('192.168.10.1');
    expect(IP.str(hosts.at(-1)!)).toBe('192.168.10.254');
  });
  it('contains()', () => {
    const c = CIDR.parse('192.168.10.0/24')!;
    expect(CIDR.contains(c, IP.parse('192.168.10.50')!)).toBe(true);
    expect(CIDR.contains(c, IP.parse('192.168.11.50')!)).toBe(false);
  });
  it('normalise les MAC', () => {
    expect(MAC.normalize('AA-BB-CC-11-22-33')).toBe('aa:bb:cc:11:22:33');
    expect(MAC.normalize('aabb.cc11.2233')).toBe('aa:bb:cc:11:22:33');
    expect(MAC.normalize('zz')).toBeNull();
    expect(MAC.valid(MAC.make('00:50:56', 258))).toBe(true);
  });
});
