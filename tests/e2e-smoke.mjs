// Test de fumée navigateur (non exécuté par Vitest) : node tests/e2e-smoke.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const dir = readdirSync(base).find(d => d.startsWith('chromium-') ) ;
const exe = process.env.CHROMIUM || (dir ? `${base}/${dir}/chrome-linux/chrome` : undefined);
const shots = process.env.SHOTS || '/tmp';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok   :', m); };

await page.getByRole('button', { name: "SI d'exemple" }).click();
ok(await page.locator('.node').count() === 10, '10 équipements affichés');
ok(await page.locator('.node.on').count() === 10 || await page.locator('.node.on').count() >= 9, 'équipements en ligne après câblage');
await page.screenshot({ path: `${shots}/m1-1-exemple.png` });

await page.locator('.node[aria-label^="SW02"]').click();
ok((await page.locator('.inspector h2').first().textContent()) === 'SW02', 'inspecteur affiche SW02');
await page.getByRole('button', { name: 'Éteindre' }).click();
ok(await page.locator('.node.down').count() === 3, 'PC21-23 hors ligne en cascade');
ok(await page.locator('.ev.bad').count() === 4, 'quatre événements « Passe hors ligne » (SW02 + 3 postes)');
await page.locator('.ev.bad button').first().click();
ok(await page.locator('.why-chain li').count() >= 2, 'chaîne causale affichée');
await page.screenshot({ path: `${shots}/m1-2-sw02-down.png` });

await page.locator('.node[aria-label^="SW02"]').click();
await page.getByRole('button', { name: 'Allumer' }).click();
ok(await page.locator('.node.down').count() === 0, 'tout revient en ligne');

// pose par glisser-déposer + câblage
await page.getByRole('button', { name: 'Nouveau' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
const box = await page.locator('.canvas').boundingBox();
const dnd = async (label, x, y) => {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await page.locator('.pal', { hasText: label }).dispatchEvent('dragstart', { dataTransfer: dt });
  await page.locator('.canvas').dispatchEvent('drop', { dataTransfer: dt, clientX: box.x + x, clientY: box.y + y });
};
await dnd('Switch', 200, 150); await dnd('PC fixe', 200, 320);
ok(await page.locator('.node').count() === 2, 'deux équipements posés par glisser-déposer');
await page.getByRole('button', { name: 'Câble', exact: true }).click();
await page.locator('.node[aria-label^="SW-01"]').click({ position: { x: 36, y: 36 } });
await page.locator('.popover button').first().click();
await page.locator('.node[aria-label^="PC-01"]').click({ position: { x: 36, y: 36 } });
ok(await page.locator('.canvas .link').count() === 1, 'câble créé en deux clics');
await page.screenshot({ path: `${shots}/m1-3-cable.png` });

// persistance
await page.reload(); await page.waitForSelector('.node');
ok(await page.locator('.node').count() === 2, 'projet restauré après rechargement');
ok(errors.length === 0, 'aucune erreur console : ' + errors.join(' | '));
await browser.close();
