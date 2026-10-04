import type { OfflineReason } from '../../infra';

export const EVENT_LABEL: Record<string, string> = {
  DeviceAdded: 'Équipement ajouté', DeviceRemoved: 'Équipement supprimé', DeviceReplaced: 'Équipement remplacé',
  CableConnected: 'Câble branché', CableDisconnected: 'Câble débranché',
  DevicePoweredOn: 'Équipement allumé', DevicePoweredOff: 'Équipement éteint',
  DeviceOnline: 'Passe en ligne', DeviceOffline: 'Passe hors ligne',
  IPAddressChanged: 'Adresse IP modifiée', HardwareChanged: 'Matériel modifié', ItsmServerSet: 'Serveur ITSM désigné',
};

export const REASON_TEXT: Record<OfflineReason, string> = {
  powered_off: 'L\'équipement est éteint.',
  no_link: 'Aucun lien actif : câble débranché, ou équipement voisin éteint.',
  no_ip: 'Aucune adresse IP configurée : l\'outil ne peut pas le joindre.',
  wrong_subnet: 'Son adresse IP n\'est pas dans le sous-réseau du serveur ITSM, et aucune passerelle ne permet de le joindre.',
  no_path: 'Aucun chemin jusqu\'au serveur ITSM : un équipement intermédiaire est éteint ou débranché.',
};

const T0 = 8 * 3600_000; // le jour 1 commence à 08:00
export function fmtTime(t: number): string {
  const total = Math.floor((t + T0) / 1000);
  const day = Math.floor(total / 86400) + 1, rest = total % 86400;
  const p = (n: number) => String(n).padStart(2, '0');
  return `J${day} ${p(Math.floor(rest / 3600))}:${p(Math.floor((rest % 3600) / 60))}:${p(rest % 60)}`;
}

export const REASON_SHORT: Record<OfflineReason, string> = {
  powered_off: 'éteint', no_link: 'aucun lien actif', no_ip: 'pas d\'adresse IP',
  wrong_subnet: 'sous-réseau injoignable', no_path: 'plus de chemin vers le serveur',
};
