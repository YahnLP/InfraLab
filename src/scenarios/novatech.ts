import type { Store } from '../core';

type D = (c: { type: string; payload?: Record<string, unknown> }) => boolean;

/** Mini-SI du siège NovaTech : de quoi manipuler tout M1. (Le vrai jeu de données NovaTech arrive avec le moteur de TP.) */
export function seedNovatech(store: Store, dispatch: D): void {
  const id = (name: string) => Object.values(store.getState().reality.devices).find(d => d.name === name)!.id;
  const add = (kind: string, name: string, x: number, y: number) => dispatch({ type: 'infra.addDevice', payload: { kind, name, x, y } });
  const wire = (a: string, ap: string, b: string, bp: string) => dispatch({ type: 'infra.connect', payload: { aDevice: id(a), aPort: ap, bDevice: id(b), bPort: bp } });
  const ip = (n: string, addr: string) => dispatch({ type: 'infra.setIp', payload: { id: id(n), ip: addr, mask: 24 } });

  ['Alice Martin|Comptabilité', 'Bruno Leroy|Comptabilité', 'Chloé Dubois|Commercial', 'David Petit|Informatique', 'Éric Moreau|Direction'].forEach(u => { const [name, service] = u.split('|'); dispatch({ type: 'itsm.addUser', payload: { name, service, roles: name!.startsWith('David') ? ['user', 'technician'] : name!.startsWith('Éric') ? ['user', 'manager'] : ['user'] } }); });
  add('internet', 'INTERNET', 320, 48); add('firewall', 'FW-SIEGE', 320, 168);
  add('switch', 'SW-SIEGE-01', 320, 296); add('switch', 'SW02', 560, 296);
  add('server', 'SRV-ITSM', 96, 296); add('printer', 'IMP-COMPTA', 96, 440);
  add('workstation', 'PC-COMPTA-01', 320, 440);
  ['PC21', 'PC22', 'PC23'].forEach((n, i) => add('workstation', n, 464 + i * 96, 440));

  wire('INTERNET', 'wan1', 'FW-SIEGE', 'wan'); wire('FW-SIEGE', 'lan', 'SW-SIEGE-01', 'port8');
  wire('SRV-ITSM', 'eth0', 'SW-SIEGE-01', 'port1'); wire('SW-SIEGE-01', 'port2', 'SW02', 'port1');
  wire('PC-COMPTA-01', 'eth0', 'SW-SIEGE-01', 'port3'); wire('IMP-COMPTA', 'lan', 'SW-SIEGE-01', 'port4');
  ['PC21', 'PC22', 'PC23'].forEach((n, i) => wire(n, 'eth0', 'SW02', `port${i + 2}`));

  ip('SRV-ITSM', '192.168.10.10'); ip('PC-COMPTA-01', '192.168.10.21'); ip('IMP-COMPTA', '192.168.10.50');
  ['PC21', 'PC22', 'PC23'].forEach((n, i) => ip(n, `192.168.10.${22 + i}`));
  dispatch({ type: 'infra.setItsmServer', payload: { id: id('SRV-ITSM') } });
  const user = (n: string) => Object.values(store.getState().management.users).find(u => u.name.startsWith(n))!.id;
  const sw = (pc: string, ...ids: string[]) => ids.forEach(softwareId => dispatch({ type: 'infra.installSoftware', payload: { id: id(pc), softwareId } }));
  sw('PC-COMPTA-01', 'sw-office', 'sw-chrome', 'sw-acrobat'); sw('PC21', 'sw-office', 'sw-chrome'); sw('PC22', 'sw-office', 'sw-firefox', 'sw-vlc'); sw('PC23', 'sw-office', 'sw-chrome', 'sw-teamviewer');
  [['PC-COMPTA-01', 'Alice'], ['PC21', 'Bruno'], ['PC22', 'Chloé'], ['PC23', 'David']].forEach(([pc, u]) => dispatch({ type: 'infra.setLoggedUser', payload: { id: id(pc!), user: user(u!) } }));
}
