/* Génère les fichiers de TP de cours : vite-node tools/gen-tp-files.ts <dossier de sortie> */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE_TPS, TP_EXT, serializeTp } from '../src/scenarios';

const out = process.argv[2] ?? 'dist-tp';
mkdirSync(out, { recursive: true });
for (const sc of COURSE_TPS) {
  const f = join(out, `tp-${sc.number}-${sc.id.replace(/^tp-\d+-/, '')}${TP_EXT}`);
  writeFileSync(f, serializeTp(sc), 'utf8'); console.log(f);
}
