import type { DomainEvent, State } from '../../core';
import { APP_VERSION } from '../../version';

/** Format du fichier de projet InfraLab (.infralab.json) : un instantané complet, relisible par n'importe quelle version compatible. */
export const FORMAT = 'infralab-project';
export const EXT = '.infralab.json';
export interface Snapshot { state: State; log: DomainEvent[] }
export interface ProjectFile { format: typeof FORMAT; version: 1; app: string; appVersion: string; savedAt: string; label: string; now: number; snapshot: Snapshot }

/** Nom proposé à l'enregistrement : « infralab-tp12 », « infralab-tp12-examen » ou « infralab-projet ». */
export function suggestedName(st: Readonly<State>, scenarioNumber?: number): string {
  const s = st.session; const base = s && scenarioNumber ? `infralab-tp${scenarioNumber}${s.mode === 'exam' ? '-examen' : ''}` : 'infralab-projet';
  return base + EXT;
}
export function labelOf(st: Readonly<State>, scenarioTitle?: string): string {
  return st.session && scenarioTitle ? `TP — ${scenarioTitle}` : 'Projet libre';
}
export function serialize(snapshot: Snapshot, now: number, label: string, date = new Date()): string {
  const f: ProjectFile = { format: FORMAT, version: 1, app: 'InfraLab', appVersion: APP_VERSION, savedAt: date.toISOString(), label, now, snapshot };
  return JSON.stringify(f);
}
/** Lit un fichier de projet ; lève une erreur en français, lisible par un élève, si le fichier n'en est pas un. */
export function parseProject(text: string): { snapshot: Snapshot; now: number; label: string; savedAt: string } {
  let p: Partial<ProjectFile>;
  try { p = JSON.parse(text); } catch { throw new Error('Ce fichier n\'est pas un projet InfraLab (contenu illisible).'); }
  if (!p || p.format !== FORMAT) throw new Error('Ce fichier n\'est pas un projet InfraLab. Choisissez un fichier « .infralab.json » enregistré depuis le simulateur.');
  if (p.version !== 1) throw new Error('Ce projet a été enregistré avec une version plus récente d\'InfraLab : mettez la page à jour.');
  const sn = p.snapshot; if (!sn?.state || sn.state.schemaVersion !== 1 || !Array.isArray(sn.log)) throw new Error('Le fichier est incomplet ou abîmé : impossible de le rouvrir.');
  return { snapshot: sn, now: Number(p.now) || 0, label: String(p.label ?? 'Projet'), savedAt: String(p.savedAt ?? '') };
}
