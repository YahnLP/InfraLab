import { HOUR, type Device, type State } from '../core';

export const AGENT_VERSION_CURRENT = '2.4';
export const AGENT_DEFAULT_INTERVAL = 24 * HOUR;
export const AGENT_FIRST_RUN_DELAY = 5 * 60_000;
export const AGENT_RETRY_DELAY = HOUR;

/** URL que l'agent doit viser pour atteindre le serveur ITSM désigné. */
export function expectedServerUrl(s: Readonly<State>): string | undefined {
  const id = s.reality.itsmServerId; const d = id ? s.reality.devices[id] : undefined;
  return d ? `http://${d.name.toLowerCase()}/inventory` : undefined;
}

export type AgentHealth = 'none' | 'stopped' | 'ok' | 'outdated' | 'misconfigured' | 'unreachable';

/** Santé de l'agent : fonction pure de l'état. Priorité : injoignable > mal configuré > obsolète > ok. */
export function agentHealth(s: Readonly<State>, d: Readonly<Device>): AgentHealth {
  const a = d.agent;
  if (a.state === 'none') return 'none';
  if (a.state === 'stopped') return 'stopped';
  if (!d.powered || !d.online) return 'unreachable';
  const exp = expectedServerUrl(s);
  if (exp && a.serverUrl !== exp) return 'misconfigured';
  if (a.version !== AGENT_VERSION_CURRENT) return 'outdated';
  return 'ok';
}

export const HEALTH_LABEL: Record<AgentHealth, string> = {
  none: 'Pas d\'agent', stopped: 'Agent arrêté', ok: 'Agent actif', outdated: 'Agent obsolète',
  misconfigured: 'Agent mal configuré', unreachable: 'Serveur injoignable',
};
