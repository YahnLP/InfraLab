// Audit d'accessibilité automatisé (axe-core) des vues principales : node tests/a11y-audit.mjs  (axe-core : npm i --no-save axe-core, ou AXE=/chemin/axe.min.js)
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const dir = readdirSync(base).find(d => d.startsWith('chromium-'));
const exe = process.env.CHROMIUM || (dir ? `${base}/${dir}/chrome-linux/chrome` : undefined);
const axeSrc = readFileSync(process.env.AXE || 'node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
if (process.env.DARK) await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
let total = 0;
const audit = async name => {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0].target.join(' ') })));
  console.log(`\n== ${name} : ${r.length} règle(s) en défaut`); for (const v of r) { console.log(`  [${v.impact}] ${v.id} ×${v.n} — ${v.help} (${v.sample})`); total += v.n; }
};
await page.getByRole('button', { name: 'NovaTech complet' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
await audit('Infrastructure');
await page.getByRole('tab', { name: 'ITSM' }).click(); await audit('ITSM — tableau de bord');
for (const p of ['Parc', 'Tickets', 'Licences', 'CMDB', 'Utilisateurs', 'Rôles et droits']) { await page.getByRole('button', { name: p, exact: true }).click(); await audit(`ITSM — ${p}`); }
await page.getByRole('tab', { name: 'TP' }).click(); await audit('Catalogue des TP');
// TP avec tickets, SLA et incident en cours : états colorés variés
await page.getByRole('article').filter({ hasText: 'Plusieurs utilisateurs impactés' }).getByRole('button', { name: 'Démarrer' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
await page.getByRole('tab', { name: 'ITSM' }).click(); await page.getByRole('button', { name: 'Tickets', exact: true }).click(); await audit('ITSM — Tickets (TP 19)');
await page.locator('tr.row').first().click(); await audit('ITSM — fiche de ticket');
await page.getByRole('button', { name: 'Parc', exact: true }).click(); await audit('ITSM — Parc (hors ligne)');
await page.getByRole('button', { name: 'Journal d\'audit' }).click(); await audit('ITSM — Journal d\'audit');
await page.getByRole('tab', { name: 'TP' }).click();
await page.getByRole('button', { name: 'Démarrer' }).first().click(); await page.getByRole('button', { name: 'Confirmer' }).click(); await audit('TP en cours');
await browser.close(); console.log(`\nTotal : ${total} élément(s) en défaut`);
