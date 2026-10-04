import type { OfflineReason } from '../../infra';

export const EVENT_LABEL: Record<string, string> = {
  DeviceAdded: 'Équipement ajouté', DeviceRemoved: 'Équipement supprimé', DeviceReplaced: 'Équipement remplacé',
  CableConnected: 'Câble branché', CableDisconnected: 'Câble débranché',
  DevicePoweredOn: 'Équipement allumé', DevicePoweredOff: 'Équipement éteint',
  DeviceOnline: 'Passe en ligne', DeviceOffline: 'Passe hors ligne',
  IPAddressChanged: 'Adresse IP modifiée', HardwareChanged: 'Matériel modifié', ItsmServerSet: 'Serveur ITSM désigné',
  SoftwareInstalled: 'Logiciel installé', SoftwareRemoved: 'Logiciel désinstallé', UserSessionChanged: 'Session utilisateur modifiée',
  AgentInstalled: 'Agent installé', AgentStarted: 'Agent démarré', AgentStopped: 'Agent arrêté', AgentUninstalled: 'Agent désinstallé', AgentConfigured: 'Agent configuré',
  AgentOffline: 'Agent injoignable', AgentOnline: 'Agent de nouveau joignable', AgentInventoryCompleted: 'Inventaire remonté', AgentInventoryFailed: 'Inventaire en échec',
  ChangeDetected: 'Changement détecté', NetworkDiscoveryCompleted: 'Découverte réseau terminée', AssetCreated: 'Actif créé', AssetMatched: 'Actif rapproché',
  AssetUpdated: 'Actif modifié', UserAdded: 'Utilisateur ajouté', AssetAssigned: 'Actif affecté',
  ProblemCreated: 'Problème créé', ProblemUpdated: 'Problème modifié', ProblemStatusChanged: 'Statut du problème modifié', TicketLinkedToProblem: 'Incident rattaché au problème', TicketUnlinkedFromProblem: 'Incident détaché du problème',
  ChangeCreated: 'Changement créé', ChangeUpdated: 'Changement modifié', ChangeStatusChanged: 'Statut du changement modifié',
  ArticleCreated: 'Article créé', ArticleUpdated: 'Article modifié', ArticlePublished: 'Article publié', ArticleLinked: 'Article associé au ticket',
  SupplierAdded: 'Fournisseur ajouté', ContractAdded: 'Contrat ajouté', ContractUpdated: 'Contrat modifié', LicenseAdded: 'Licence ajoutée', LicenseUpdated: 'Licence modifiée', SoftwarePolicyChanged: 'Politique logiciel modifiée',
  AssetCreatedManual: 'Actif créé à la main', AssetStatusChanged: 'Cycle de vie de l\'actif', AssetUpdatedFinance: 'Données financières modifiées', CiCreated: 'CI créé', CiRemoved: 'CI supprimé', RelationAdded: 'Relation ajoutée', RelationRemoved: 'Relation retirée',
  ActorChanged: 'Changement d\'identité', UserRolesChanged: 'Rôles d\'un utilisateur modifiés', UserActiveChanged: 'Compte activé ou désactivé', RoleCreated: 'Rôle créé', RolePermissionChanged: 'Droit d\'un rôle modifié',
  ScenarioStarted: 'TP démarré', QuestionAnswered: 'Question de compréhension', StageStarted: 'Étape suivante du TP', HintUsed: 'Indice consulté', SolutionRevealed: 'Solution affichée', ScenarioFinished: 'TP terminé', ScenarioQuit: 'TP quitté',
  TicketCreated: 'Ticket créé', TicketUpdated: 'Ticket modifié', TicketStatusChanged: 'Statut du ticket modifié', TicketCommented: 'Ticket commenté',
  TicketAssetLinked: 'Actif lié au ticket', TicketAssetUnlinked: 'Actif délié du ticket',
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

/** Temps relatif en heure simulée. */
export function ago(now: number, t: number): string {
  const m = Math.max(0, Math.floor((now - t) / 60000));
  if (m < 1) return 'à l\'instant'; if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); return h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}
