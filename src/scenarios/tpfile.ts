import type { Scenario } from './types';
import { SCENARIOS } from './catalog';

/** Format d'un TP distribué sous forme de fichier (.infralab-tp.json), à ouvrir depuis le simulateur. */
export const TP_FORMAT = 'infralab-tp';
export const TP_EXT = '.infralab-tp.json';
export interface TpFile { format: typeof TP_FORMAT; version: 1; app: string; scenario: Scenario }

export function serializeTp(scenario: Scenario): string {
  const f: TpFile = { format: TP_FORMAT, version: 1, app: 'InfraLab', scenario };
  return JSON.stringify(f, null, 1) + '\n';
}

/** Contrôle minimal de structure d'un scénario venant d'un fichier ; lève une erreur lisible par un élève. */
export function checkScenario(sc: unknown): Scenario {
  const bad = (m: string): never => { throw new Error(`Fichier de TP invalide : ${m}.`); };
  const s = sc as Partial<Scenario> | null;
  if (!s || typeof s !== 'object') return bad('contenu absent');
  if (typeof s.id !== 'string' || !s.id) bad('identifiant manquant');
  if (typeof s.title !== 'string' || typeof s.number !== 'number') bad('titre ou numéro manquant');
  for (const k of ['stages', 'setup', 'objectives', 'hints', 'solutionText', 'solution', 'skills'] as const) if (!Array.isArray(s[k])) bad(`« ${k} » manquant`);
  const ids = new Set(s.objectives!.map(o => o.id));
  if (!ids.size) bad('aucun objectif');
  for (const o of s.objectives!) if (!!o.check === !!o.question) bad(`l'objectif « ${o.id} » doit avoir soit un état à atteindre, soit une question`);
  for (const g of s.stages!) for (const o of g.objectives) if (!ids.has(o)) bad(`l'étape « ${g.id} » cite un objectif inconnu`);
  if (SCENARIOS.some(c => c.id === s.id)) bad('cet identifiant appartient déjà au catalogue');
  return s as Scenario;
}

export function parseTp(text: string): Scenario {
  let p: Partial<TpFile>;
  try { p = JSON.parse(text); } catch { throw new Error('Ce fichier n\'est pas un TP InfraLab (contenu illisible).'); }
  if (!p || p.format !== TP_FORMAT) throw new Error('Ce fichier n\'est pas un TP InfraLab.');
  if (p.version !== 1) throw new Error('Ce TP a été publié pour une version plus récente d\'InfraLab : mettez la page à jour.');
  return checkScenario(p.scenario);
}

/** Vrai si le texte est un fichier de TP (et non un projet). */
export const isTpFile = (text: string): boolean => { try { return JSON.parse(text)?.format === TP_FORMAT; } catch { return false; } };
