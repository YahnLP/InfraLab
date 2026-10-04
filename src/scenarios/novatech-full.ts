import { DAY, HOUR, type Store } from '../core';
import { seedNovatech } from './novatech';

type D = (c: { type: string; payload?: Record<string, unknown> }) => boolean;

const SERVICES = ['Direction', 'RH', 'Comptabilité', 'Commercial', 'Production', 'Informatique'];
const FIRST = ['Camille', 'Hugo', 'Inès', 'Julien', 'Karine', 'Louis', 'Manon', 'Nicolas', 'Océane', 'Paul', 'Quentin', 'Rose', 'Samuel', 'Thérèse', 'Ugo', 'Valérie', 'William', 'Yasmine', 'Zoé', 'Antoine', 'Béatrice', 'Cédric', 'Dalila', 'Émile', 'Fanny', 'Gaël', 'Hélène', 'Ibrahim', 'Jade', 'Kévin', 'Laure', 'Mehdi', 'Nora', 'Olivier', 'Pauline', 'Rémi', 'Sonia', 'Thomas', 'Violette'];
const LAST = ['Arnaud', 'Blanc', 'Carpentier', 'Dupuis', 'Esteban', 'Fabre', 'Gauthier', 'Henry', 'Imbert', 'Joly', 'Klein', 'Lambert', 'Mercier', 'Noël', 'Olivier', 'Perrin', 'Quéré', 'Roche', 'Simon', 'Tessier', 'Urbain', 'Vidal', 'Weber', 'Yvon', 'Zimmer', 'Aubert', 'Brun', 'Charrier', 'Delmas', 'Evrard', 'Fournier', 'Giraud', 'Hamon', 'Isnard', 'Jacquet', 'Kerbrat', 'Lemaire', 'Maillard', 'Navarro'];

/**
 * NovaTech complet : 4 sites (siège, agences Nord et Sud, datacenter), ≈ 45 équipements, 45 utilisateurs, fournisseurs, contrats,
 * licences (Office volontairement non conforme), politique logicielle et CMDB. Déterministe : aucune donnée aléatoire.
 * Simplification assumée : les sites partagent un même réseau (liaisons inter-sites en couche 2) pour que « joignable par l'outil » reste lisible.
 */
export function seedNovatechFull(store: Store, dispatch: D): void {
  seedNovatech(store, dispatch);
  const st = () => store.getState();
  const dev = (n: string) => Object.values(st().reality.devices).find(d => d.name === n)!.id;
  const usr = (n: string) => Object.values(st().management.users).find(u => u.name.startsWith(n))!.id;
  const add = (kind: string, name: string, x: number, y: number, site: string) => dispatch({ type: 'infra.addDevice', payload: { kind, name, x, y, site } });
  const wire = (a: string, ap: string, b: string, bp: string) => dispatch({ type: 'infra.connect', payload: { aDevice: dev(a), aPort: ap, bDevice: dev(b), bPort: bp } });
  let host = 60; const ip = (n: string, last?: number) => dispatch({ type: 'infra.setIp', payload: { id: dev(n), ip: `192.168.10.${last ?? host++}`, mask: 24 } });

  /* ---- utilisateurs (45 au total, services répartis) ---- */
  for (let i = 0; i < 39; i++) {
    const service = SERVICES[i % SERVICES.length]!; const name = `${FIRST[i]} ${LAST[i]}`;
    const roles = i === 5 || i === 11 || i === 17 ? ['user', 'technician'] : i === 3 ? ['user', 'manager'] : ['user'];
    dispatch({ type: 'itsm.addUser', payload: { name, service: i % 5 === 0 ? 'Informatique' : service, roles } });
  }

  /* ---- siège : second switch, RH, direction, Wi-Fi ---- */
  add('switch', 'SW-SIEGE-02', 320, 560, 'Siège'); wire('SW-SIEGE-01', 'port5', 'SW-SIEGE-02', 'port1');
  ['PC-RH-01', 'PC-RH-02', 'PC-DIR-01', 'PC-DIR-02'].forEach((n, i) => { add('workstation', n, 120 + i * 96, 700, 'Siège'); wire(n, 'eth0', 'SW-SIEGE-02', `port${i + 3}`); });
  add('printer', 'IMP-RH', 520, 700, 'Siège'); wire('IMP-RH', 'lan', 'SW-SIEGE-02', 'port7');
  add('wifi_ap', 'AP-SIEGE', 616, 700, 'Siège'); wire('AP-SIEGE', 'lan', 'SW-SIEGE-02', 'port8');
  ['PC24', 'PC25', 'PC26', 'PC27'].forEach((n, i) => { add('workstation', n, 464 + i * 96, 580, 'Siège'); wire(n, 'eth0', 'SW02', `port${i + 5}`); });

  /* ---- datacenter ---- */
  add('switch', 'SW-DC-01', 960, 120, 'Datacenter'); wire('SW-SIEGE-02', 'port2', 'SW-DC-01', 'port1');
  add('hypervisor', 'HV-DC-01', 880, 240, 'Datacenter'); wire('HV-DC-01', 'eth0', 'SW-DC-01', 'port2');
  add('server', 'SRV-FICHIERS', 976, 240, 'Datacenter'); wire('SRV-FICHIERS', 'eth0', 'SW-DC-01', 'port3');
  add('server', 'SRV-FACT', 1072, 240, 'Datacenter'); wire('SRV-FACT', 'eth0', 'SW-DC-01', 'port4');
  add('nas', 'NAS-DC-01', 1168, 240, 'Datacenter'); wire('NAS-DC-01', 'lan1', 'SW-DC-01', 'port5');
  add('switch', 'SW-DC-02', 1072, 120, 'Datacenter'); wire('SW-DC-01', 'port8', 'SW-DC-02', 'port1');
  ['VM-RH01', 'VM-WEB01'].forEach((n, i) => { add('vm', n, 1072 + i * 96, 20, 'Datacenter'); wire(n, 'eth0', 'SW-DC-02', `port${i + 2}`); dispatch({ type: 'infra.setHost', payload: { id: dev(n), host: dev('HV-DC-01') } }); });

  /* ---- agences Nord et Sud ---- */
  const agence = (code: string, site: string, x: number, y: number, uplinkPort: string) => {
    const sw = `SW-${code}-01`; add('switch', sw, x, y, site); wire('SW-SIEGE-01', uplinkPort, sw, 'port1');
    for (let i = 0; i < 6; i++) { const n = `PC-${code}-0${i + 1}`; add('workstation', n, x - 120 + i * 80, y + 130, site); wire(n, 'eth0', sw, `port${i + 2}`); }
    add('printer', `IMP-${code}`, x + 400, y + 130, site); wire(`IMP-${code}`, 'lan', sw, 'port8');
  };
  agence('NORD', 'Agence Nord', 1000, 420, 'port6'); agence('SUD', 'Agence Sud', 1000, 680, 'port7');

  /* ---- adressage : serveurs et commutateurs gérés d'abord, postes ensuite ---- */
  ['SW-SIEGE-01', 'SW02', 'SW-SIEGE-02', 'SW-DC-01', 'SW-DC-02', 'SW-NORD-01', 'SW-SUD-01'].forEach((n, i) => ip(n, i + 1));
  ['HV-DC-01', 'SRV-FICHIERS', 'SRV-FACT', 'NAS-DC-01', 'VM-RH01', 'VM-WEB01', 'AP-SIEGE', 'IMP-RH', 'IMP-NORD', 'IMP-SUD'].forEach(n => ip(n));
  Object.values(st().reality.devices).filter(d => d.kind === 'workstation' && !d.nics.some(n => n.ip)).forEach(d => ip(d.name));

  /* ---- agents sur les postes, puis découverte ---- */
  const pcs = Object.values(st().reality.devices).filter(d => d.kind === 'workstation').map(d => d.name).sort();
  const withAgent = pcs.filter((_, i) => i % 3 !== 2); // un poste sur trois reste sans agent : situation réaliste
  [...withAgent, 'SRV-FICHIERS', 'SRV-FACT', 'HV-DC-01'].forEach(n => dispatch({ type: 'agent.install', payload: { id: dev(n) } }));
  dispatch({ type: 'inventory.discover', payload: { cidr: '192.168.10.0/24' } });

  /* ---- logiciels : Office partout ou presque, quelques écarts voulus ---- */
  const install = (n: string, softwareId: string) => { if (!st().reality.devices[dev(n)]!.software.some(s => s.softwareId === softwareId)) dispatch({ type: 'infra.installSoftware', payload: { id: dev(n), softwareId } }); };
  pcs.forEach((n, i) => { install(n, 'sw-chrome'); install(n, 'sw-office'); if (i % 2 === 0) install(n, 'sw-acrobat'); });
  ['PC-NORD-02', 'PC-SUD-04', 'PC-RH-02'].forEach(n => install(n, 'sw-teamviewer'));
  ['PC-DIR-01', 'PC-RH-01'].forEach(n => install(n, 'sw-vlc'));
  install('PC-NORD-03', 'sw-firefox');
  [...withAgent, 'SRV-FICHIERS', 'SRV-FACT', 'HV-DC-01'].forEach(n => dispatch({ type: 'agent.runInventory', payload: { id: dev(n) } })); // l'outil connaît les installations des postes équipés d'un agent

  /* ---- affectations : un poste par utilisateur du même service quand c'est possible ---- */
  const users = Object.values(st().management.users).filter(u => u.roles.length === 1 && u.roles[0] === 'user').map(u => u.name);
  pcs.forEach((n, i) => { const a = Object.values(st().management.assets).find(x => x.deviceId === dev(n)); const u = users[(i + 6) % users.length]; if (a && u && !a.assignedTo) dispatch({ type: 'itsm.assignAsset', payload: { id: a.id, user: usr(u) } }); });

  /* ---- fournisseurs, contrats, licences, politique ---- */
  ['Dell France', 'Cisco Partner Sud-Ouest', 'Microsoft Licensing', 'Hébergeur DataSud', 'Canon Services'].forEach(name => dispatch({ type: 'itsm.addSupplier', payload: { name } }));
  const sup = (n: string) => Object.values(st().management.suppliers).find(s => s.name.startsWith(n))!.id;
  const asset = (n: string) => Object.values(st().management.assets).find(a => a.deviceId === dev(n))?.id;
  dispatch({ type: 'itsm.addContract', payload: { title: 'Maintenance des postes (Dell ProSupport)', supplierId: sup('Dell'), kind: 'maintenance', startAt: -200 * DAY, endAt: 160 * DAY, assetIds: pcs.map(asset).filter(Boolean) } });
  dispatch({ type: 'itsm.addContract', payload: { title: 'Maintenance réseau (switchs et pare-feu)', supplierId: sup('Cisco'), kind: 'maintenance', startAt: -300 * DAY, endAt: 20 * DAY, assetIds: ['SW-SIEGE-01', 'SW02', 'SW-DC-01'].map(asset).filter(Boolean) } });
  dispatch({ type: 'itsm.addContract', payload: { title: 'Abonnement Microsoft 365', supplierId: sup('Microsoft'), kind: 'licence', startAt: -100 * DAY, endAt: 265 * DAY, assetIds: [] } });
  const msContract = Object.values(st().management.contracts).find(c => c.title.includes('Microsoft'))!.id;
  const officeInstalls = withAgent.length; // seules les installations des postes équipés d'un agent sont connues de l'outil
  dispatch({ type: 'itsm.addLicense', payload: { softwareId: 'sw-office', quantity: Math.max(1, officeInstalls - 3), contractId: msContract } }); // 3 installations de trop : non-conformité voulue
  dispatch({ type: 'itsm.setSoftwarePolicy', payload: { softwareId: 'sw-teamviewer', policy: 'forbidden' } });
  dispatch({ type: 'itsm.setSoftwarePolicy', payload: { softwareId: 'sw-vlc', policy: 'forbidden' } });
  ['sw-chrome', 'sw-firefox', 'sw-acrobat', 'sw-office'].forEach(softwareId => dispatch({ type: 'itsm.setSoftwarePolicy', payload: { softwareId, policy: 'authorized' } }));

  /* ---- CMDB : trois services, leurs applications et les équipements qui les portent ---- */
  const ci = (name: string, kind: string, dn?: string) => dispatch({ type: 'itsm.createCi', payload: { name, kind, ...(dn && asset(dn) ? { asset: asset(dn) } : {}) } });
  ['SRV-FACT', 'SRV-FICHIERS', 'HV-DC-01', 'SW-DC-01', 'SW-SIEGE-01', 'SRV-ITSM'].forEach(n => ci(n, 'infrastructure', n));
  ci('Facturation comptable', 'service'); ci('Logiciel de facturation', 'application'); ci('Partage de fichiers', 'service'); ci('Messagerie', 'service'); ci('Intranet RH', 'service'); ci('Application RH', 'application');
  const rel = (from: string, to: string, type: string) => { const f = Object.values(st().management.cis).find(c => c.name === from), t = Object.values(st().management.cis).find(c => c.name === to); if (f && t) dispatch({ type: 'itsm.addRelation', payload: { from: f.id, to: t.id, type } }); };
  rel('Facturation comptable', 'Logiciel de facturation', 'uses'); rel('Logiciel de facturation', 'SRV-FACT', 'hosted_on'); rel('Partage de fichiers', 'SRV-FICHIERS', 'depends_on');
  rel('Intranet RH', 'Application RH', 'uses'); rel('Application RH', 'HV-DC-01', 'hosted_on'); rel('Messagerie', 'SRV-ITSM', 'depends_on');
  void HOUR;
}
