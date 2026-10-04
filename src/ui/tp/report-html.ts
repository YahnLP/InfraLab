import type { Report } from '../../scenarios';
import { EVENT_LABEL, fmtTime } from '../shell/labels';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const dur = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };

/** Compte rendu autonome, imprimable : à joindre au portfolio ou à remettre au formateur. */
export function reportHtml(r: Report, fp: string): string {
  const rows = r.journal.map(e => `<tr><td>${esc(fmtTime(e.t))}</td><td>${esc(EVENT_LABEL[e.type] ?? e.type)}</td><td>${esc(e.subject)}</td><td>${esc(e.actor)}</td></tr>`).join('');
  const obj = r.objectives.map(o => `<li class="${o.done ? 'ok' : 'ko'}"><span>${o.done ? '✓' : '✗'}</span> ${esc(o.label)}</li>`).join('');
  const sk = r.skills.map(k => `<li>${k.kind === 'worked' ? 'Compétence travaillée' : 'Élément de preuve possible'} : ${esc(k.ref)}</li>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InfraLab — compte rendu TP ${r.generatedFor.number}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1d2433}h1{font-size:1.5rem;margin:0}h2{font-size:1.05rem;margin:1.6rem 0 .5rem;border-bottom:1px solid #d5dae3;padding-bottom:.2rem}
.muted{color:#5b6475}.score{font-size:2.2rem;font-weight:700}ul{padding-left:0;list-style:none}li.ok span{color:#1a7f45;font-weight:700}li.ko span{color:#b3261e;font-weight:700}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #e4e8ef;padding:4px 6px;text-align:left}code{word-break:break-all;font-size:11px}@media print{body{margin:0}}</style></head><body>
<h1>TP ${r.generatedFor.number} — ${esc(r.generatedFor.title)}</h1>
<p class="muted">InfraLab · ${r.generatedFor.mode === 'exam' ? 'mode examen' : 'mode TP'} · ${r.finished ? 'terminé' : 'non terminé'} · durée simulée ${dur(r.durationSimMs)}${r.student ? ` · <strong>${esc(r.student)}</strong>` : ''}</p>
<p class="score">${r.score.total} / 100</p>
<p class="muted">Objectifs ${r.score.objectives}/70 · qualité ${r.score.quality}/20 · autonomie ${r.score.autonomy}/10 — indices consultés : ${r.hintsUsed} ; mauvaises réponses : ${r.wrongAnswers} ; solution affichée : ${r.solutionViewed ? 'oui' : 'non'}.</p>
${r.violations.length ? `<h2>Points de qualité</h2><ul>${r.violations.map(v => `<li class="ko"><span>!</span> ${esc(v)}</li>`).join('')}</ul>` : ''}
<h2>Objectifs</h2><ul>${obj}</ul>
<h2>Compétences travaillées</h2><ul>${sk}</ul>
<p class="muted">Ce score n'est pas une validation de compétence : celle-ci revient au formateur et au référentiel.</p>
<h2>Journal des actions</h2><table><thead><tr><th>Heure simulée</th><th>Événement</th><th>Objet</th><th>Auteur</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Empreinte</h2><p class="muted">SHA-256 des données du compte rendu (détecte une modification accidentelle, ne prouve pas l'authenticité) :</p><code>${fp}</code>
</body></html>`;
}
