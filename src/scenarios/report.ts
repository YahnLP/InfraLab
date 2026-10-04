import type { DomainEvent, State } from '../core';
import { evaluate } from './engine';
import type { Scenario } from './types';

export interface Report {
  app: 'InfraLab'; version: 1; generatedFor: { number: number; title: string; mode: 'tp' | 'exam' };
  student: string; durationSimMs: number; finished: boolean;
  score: { objectives: number; quality: number; autonomy: number; total: number };
  objectives: { id: string; label: string; done: boolean }[];
  hintsUsed: number; solutionViewed: boolean; wrongAnswers: number; violations: string[];
  skills: { ref: string; kind: 'worked' | 'evidence_possible' }[];
  journal: { t: number; type: string; actor: string; subject: string }[];
}

/** Nom lisible d'un objet du SI, pour un journal exportable hors de l'application. */
export function entityName(st: Readonly<State>, id: string): string {
  const m = st.management; const r = st.reality;
  return r.devices[id]?.name ?? m.assets[id]?.name ?? m.users[id]?.name ?? m.tickets[id]?.ref ?? m.problems[id]?.ref ?? m.changes[id]?.ref ?? m.articles[id]?.ref
    ?? m.contracts[id]?.ref ?? m.licenses[id]?.ref ?? m.cis[id]?.name ?? m.suppliers[id]?.name ?? m.roles[id]?.name ?? (id === 'trainer' ? 'Formateur' : id);
}

/** Compte rendu d'un TP : données pures, sans date réelle (le même déroulé donne le même compte rendu). */
export function buildReport(sc: Scenario, st: Readonly<State>, log: readonly DomainEvent[], now: number, student = ''): Report | null {
  const s = st.session; if (!s || s.scenarioId !== sc.id) return null;
  const ev = evaluate(sc, st, log, now); const mine = log.slice(s.logStart);
  const actorOf = (e: DomainEvent) => e.actorId ? entityName(st, e.actorId) : e.actor === 'agent' ? 'agent d\'inventaire' : e.actor === 'scenario' ? 'décor du TP' : e.actor === 'user' ? 'formateur (mode libre)' : 'système';
  return {
    app: 'InfraLab', version: 1, generatedFor: { number: sc.number, title: sc.title, mode: s.mode }, student: student.trim(),
    durationSimMs: (s.finishedAt ?? now) - s.startedAt, finished: s.finishedAt !== undefined,
    score: ev.score, objectives: ev.objectives.map(o => ({ id: o.id, label: o.label, done: o.done })),
    hintsUsed: Object.values(s.hints).reduce((a, b) => a + b, 0), solutionViewed: s.solutionViewed, wrongAnswers: s.wrong, violations: ev.violations,
    skills: sc.skills,
    journal: mine.filter(e => !e.type.startsWith('Scenario') && e.type !== 'StageStarted').map(e => ({ t: e.t, type: e.type, actor: actorOf(e), subject: entityName(st, e.subject.id) })),
  };
}

/** Empreinte SHA-256 du contenu : détecte une modification accidentelle, ne prouve pas l'authenticité. */
export async function fingerprint(r: Report): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(r)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
