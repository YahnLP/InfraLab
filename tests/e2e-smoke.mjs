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

// ---- M2 : découverte, agent, inventaire, écart ----
await page.getByRole('tab', { name: 'ITSM' }).click();
ok((await page.locator('.tile').filter({ hasText: 'inconnus de l\'outil' }).locator('b').textContent()) === '9', 'tableau de bord : 9 équipements inconnus de l\'outil');
await page.getByRole('button', { name: 'Découverte réseau' }).click();
await page.getByRole('button', { name: 'Scanner' }).click();
ok(await page.locator('.itsm-page tbody tr.row').count() === 6, 'découverte : 6 équipements répondent (les switches sans IP restent invisibles)');
ok(await page.locator('.itsm-page .pill.warn').count() === 6, 'tous « découverts seulement »');
await page.screenshot({ path: `${shots}/m2-1-decouverte.png` });
await page.getByRole('tab', { name: 'Infrastructure' }).click();
await page.locator('.node[aria-label^="PC-COMPTA-01"]').click();
await page.getByRole('button', { name: "Installer l'agent" }).click();
await page.getByRole('button', { name: "Forcer l'inventaire" }).click();
await page.getByRole('tab', { name: 'ITSM' }).click(); await page.getByRole('button', { name: 'Parc', exact: true }).click();
ok(await page.locator('.itsm-page .pill.on').count() === 1, 'parc : 1 actif inventorié par l\'agent');
await page.locator('tr.row', { hasText: 'PC-COMPTA-01' }).click();
ok((await page.locator('.itsm-page').textContent()).includes('Windows 11'), 'fiche d\'actif : système remonté par l\'agent');
await page.getByRole('tab', { name: 'Infrastructure' }).click();
await page.locator('.node[aria-label^="PC-COMPTA-01"]').click();
await page.getByRole('button', { name: 'Ajouter 8 Go de RAM' }).click();
await page.getByRole('tab', { name: 'ITSM' }).click(); await page.getByRole('button', { name: 'Parc', exact: true }).click(); await page.locator('tr.row', { hasText: 'PC-COMPTA-01' }).click();
ok(await page.locator('.diff').count() === 1, 'écart réalité / observé visible après ajout de RAM');
await page.screenshot({ path: `${shots}/m2-2-fiche.png` });
await page.getByRole('button', { name: "Voir dans l'infrastructure" }).click();
ok(await page.locator('.node.sel').count() === 1, '« Voir dans l\'infrastructure » sélectionne l\'équipement');
await page.getByRole('button', { name: '+1 jour' }).click();
await page.getByRole('tab', { name: 'ITSM' }).click(); await page.getByRole('button', { name: 'Parc', exact: true }).click(); await page.locator('tr.row', { hasText: 'PC-COMPTA-01' }).click();
ok(await page.locator('.diff').count() === 0, 'après +1 jour, la remontée planifiée a résorbé l\'écart');
await page.getByRole('tab', { name: 'Infrastructure' }).click();

// M3 : ticket sur un poste débranché (TP 16)
await page.evaluate(() => { const { store } = window.infralab; const st = store.getState(); const pc = Object.values(st.reality.devices).find(d => d.name === 'PC-COMPTA-01'); const l = Object.values(st.reality.links).find(x => x.a.device === pc.id || x.b.device === pc.id); store.dispatch({ type: 'infra.disconnect', payload: { link: l.id } }); });
await page.locator('.node[aria-label^="PC-COMPTA-01"]').click();
await page.getByRole('button', { name: 'Créer un ticket' }).click();
await page.locator('select[name=requester]').selectOption({ label: 'Alice Martin (Comptabilité)' });
await page.locator('input[name=title]').fill('Mon PC n\'a plus Internet'); await page.getByRole('button', { name: 'Créer le ticket' }).click();
ok((await page.locator('.itsm-page h1').textContent()).includes('Internet'), 'ticket créé depuis l\'infrastructure, fiche ouverte');
ok((await page.locator('.itsm-page').textContent()).includes('PC-COMPTA-01'), 'ticket lié à l\'actif');
await page.getByRole('button', { name: /Qualifier/ }).click({ force: true });
ok((await page.locator('.toast.err').count()) === 1, 'qualifier sans catégorie est refusé avec une explication');
await page.getByLabel('Catégorie', { exact: true }).selectOption('Réseau'); await page.getByLabel('Impact').selectOption('low'); await page.getByLabel('Urgence').selectOption('medium');
await page.getByLabel('Assigné à').selectOption({ label: 'David Petit' });
for (const l of [/Qualifier/, /Attribuer/, /Prendre en charge/]) await page.getByRole('button', { name: l }).click();
ok((await page.locator('.itsm-page .asset-head').textContent()).includes('En cours'), 'ticket en cours');
await page.getByRole('button', { name: "Voir dans l'infrastructure" }).click();
ok(await page.locator('.node.sel').count() === 1 && await page.locator('.tkbadge').count() === 1, 'depuis le ticket : équipement sélectionné, pastille de ticket sur le schéma');
await page.screenshot({ path: `${shots}/m3-ticket-infra.png` });
await page.evaluate(() => { const { store } = window.infralab; const st = store.getState(); const pc = Object.values(st.reality.devices).find(d => d.name === 'PC-COMPTA-01'); const sw = Object.values(st.reality.devices).find(d => d.name === 'SW-SIEGE-01'); store.dispatch({ type: 'infra.connect', payload: { aDevice: pc.id, aPort: 'eth0', bDevice: sw.id, bPort: 'port3' } }); });
await page.getByRole('tab', { name: 'ITSM' }).click(); await page.getByRole('button', { name: 'Tickets', exact: true }).click(); await page.locator('tr.row').first().click();
await page.getByRole('button', { name: /Résoudre/ }).click({ force: true });
ok((await page.locator('.toast.err').count()) >= 1, 'résoudre sans solution est refusé');
await page.locator('textarea').first().fill('Câble rebranché sur le port 3.'); await page.getByRole('button', { name: 'Enregistrer la solution' }).click();
await page.getByRole('button', { name: /Résoudre/ }).click(); await page.getByRole('button', { name: /Clore/ }).click();
ok((await page.locator('.itsm-page .asset-head').textContent()).includes('Clos'), 'ticket clos après solution documentée');
await page.screenshot({ path: `${shots}/m3-ticket.png` });
await page.getByRole('tab', { name: 'Infrastructure' }).click();

// M4 : TP 16 jouable par l'interface
await page.getByRole('tab', { name: 'TP' }).click();
ok(await page.locator('.tp-card').count() >= 7, 'catalogue : au moins 7 TP');
await page.locator('.tp-card', { hasText: 'PC déconnecté' }).getByRole('button', { name: 'Démarrer' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
ok(await page.locator('.tp-panel:not([hidden])').count() === 1 && (await page.locator('.tp-head').textContent()).includes('0/6'), 'panneau de TP : 0/6 objectifs');
ok(await page.locator('.node.down').count() >= 1, 'décor appliqué : le poste d\'Alice est hors ligne');
await page.getByRole('button', { name: /Indice \(0\/3\)/ }).first().click();
ok(await page.locator('.tp-hints li').count() === 1, 'un indice révélé');
await page.evaluate(() => { const { store } = window.infralab; const st = store.getState(); const pc = Object.values(st.reality.devices).find(d => d.name === 'PC-COMPTA-01'); const sw = Object.values(st.reality.devices).find(d => d.name === 'SW-SIEGE-01'); store.dispatch({ type: 'infra.connect', payload: { aDevice: pc.id, aPort: 'eth0', bDevice: sw.id, bPort: 'port3' } }); });
ok((await page.locator('.tp-head').textContent()).includes('2/6'), 'reconnecter : objectifs « poste en ligne » et « agent » atteints');
await page.getByRole('button', { name: 'Voir la solution' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
ok(await page.locator('.tp-panel .callout').count() === 1, 'solution affichée sur demande');
await page.screenshot({ path: `${shots}/m4-tp.png` });
await page.getByRole('button', { name: 'Terminer' }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
ok((await page.locator('.tp-score').textContent()).includes('/ 100'), 'bilan avec score');
await page.getByRole('button', { name: 'Quitter', exact: true }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
ok(await page.locator('.tp-panel:not([hidden])').count() === 0, 'quitter le TP : retour au mode libre');

// pose par glisser-déposer + câblage
await page.getByRole('button', { name: 'Nouveau', exact: true }).click(); await page.getByRole('button', { name: 'Confirmer' }).click();
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
