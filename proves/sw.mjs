// La versió del service worker (ACT-581). VERSIO surt del contingut de tots els fitxers que guarda: si en canvia un i
// VERSIO no, el mòbil es quedaria amb el codi vell per sempre. Dues ordres:
//   node proves/sw.mjs            → posa VERSIO al dia a sw.js (abans de publicar)
//   node proves/sw.mjs --comprova → només diu si està al dia (el banc ho fa servir)
// També comprova que tots els mòduls de js/ i els fulls de css/ siguin a FITXERS: un mòdul nou que no hi fos no
// arrencaria sense connexió.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ARREL } from './fixture.mjs';

export function estatSW() {
  const sw = fs.readFileSync(path.join(ARREL, 'sw.js'), 'utf8');
  const fitxers = JSON.parse('[' + /const FITXERS = \[([\s\S]*?)\];/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*$/, '') + ']');
  const versio = /const VERSIO = '([0-9a-f]+)';/.exec(sw)[1];
  const h = crypto.createHash('sha256');
  for (const f of fitxers) { h.update(f + '\n'); h.update(fs.readFileSync(path.join(ARREL, f))); }
  const deuria = h.digest('hex').slice(0, 12);
  const falten = [...fs.readdirSync(path.join(ARREL, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
                  ...fs.readdirSync(path.join(ARREL, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f)]
    .filter(f => !fitxers.includes(f));
  return { sw, versio, deuria, falten };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const e = estatSW();
  if (e.falten.length) { console.log('Falten a FITXERS: ' + e.falten.join(', ')); process.exit(1); }
  if (process.argv.includes('--comprova')) { console.log(e.versio === e.deuria ? 'sw.js al dia' : `sw.js no està al dia: ${e.versio} → ${e.deuria}`); process.exit(e.versio === e.deuria ? 0 : 1); }
  if (e.versio !== e.deuria) fs.writeFileSync(path.join(ARREL, 'sw.js'), e.sw.replace(`const VERSIO = '${e.versio}';`, `const VERSIO = '${e.deuria}';`));
  console.log('VERSIO = ' + e.deuria);
}
