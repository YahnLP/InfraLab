import { readFileSync, writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/scenarios';

const kind = (k: string) => (k === 'worked' ? 'T' : 'P');

/** Tableau des TP (section 13 de l'architecture) et matrice de couverture, générés depuis le catalogue réel. */
const levels = [...new Set(SCENARIOS.map(s => s.level))].sort((a, b) => a - b);
let table = '';
for (const lv of levels) {
  const xs = SCENARIOS.filter(s => s.level === lv);
  table += `### Niveau ${lv} — ${xs[0]!.levelLabel}\n| # | TP | Étapes | Compétences |\n|---|---|---|---|\n`;
  for (const s of xs) table += `| ${s.number} | ${s.title} | ${s.stages.map(g => g.title).join(' → ')} | ${s.skills.map(k => `${k.ref} (${kind(k.kind)})`).join(' · ')} |\n`;
  table += '\n';
}
const START = '<!-- tp-table:start -->', END = '<!-- tp-table:end -->';
const arch = readFileSync('docs/ARCHITECTURE.md', 'utf8'); const a = arch.indexOf(START), b = arch.indexOf(END);
if (a < 0 || b < 0) throw new Error('Marqueurs tp-table absents de docs/ARCHITECTURE.md');
writeFileSync('docs/ARCHITECTURE.md', arch.slice(0, a + START.length) + '\n' + table.trimEnd() + '\n' + arch.slice(b));

const refs = new Map<string, string[]>();
for (const s of SCENARIOS) for (const k of s.skills) refs.set(k.ref, [...(refs.get(k.ref) ?? []), `${s.number}${kind(k.kind)}`]);
let md = '# Couverture des compétences\n\n> Généré à partir du catalogue (`npm run docs`). **T** : compétence travaillée par le TP. **P** : élément de preuve possible (capture du journal, fiche d\'actif, ticket documenté…) à verser au portfolio. Aucun TP ne *valide* une compétence : cela reste l\'affaire du formateur et du référentiel.\n\n| Compétence | TP |\n|---|---|\n';
for (const r of [...refs.keys()].sort()) md += `| ${r} | ${refs.get(r)!.join(' · ')} |\n`;
md += `\n${SCENARIOS.length} TP, ${SCENARIOS.reduce((n, s) => n + s.objectives.length, 0)} objectifs, ${SCENARIOS.reduce((n, s) => n + s.objectives.filter(o => o.question).length, 0)} questions de compréhension.\n`;
writeFileSync('docs/couverture-competences.md', md);
console.log('docs régénérés');
