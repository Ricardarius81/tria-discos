// El banc de proves de la Màquina Màgica (ACT-533). Una ordre:
//   node proves/banc.mjs                    → totes les comprovacions, amb l'arxiu sintètic
//   node proves/banc.mjs --arxiu X.sqlite   → amb una còpia d'un arxiu real (no es puja mai: és a .gitignore)
//   node proves/banc.mjs --nomes safata     → només les comprovacions que porten aquesta paraula
//   node proves/banc.mjs --captures         → desa una captura de cada comprovació a proves/sortida/
// Serveix el repositori en local, obre Chromium amb un mòbil de 390 px i fa passar la màquina per un Drive i un
// ListenBrainz falsos. Cap petició no surt a internet: si n'hi ha cap que ho intenta, la comprovació final falla.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ARREL, arxiu, escoltesLB, motor } from './fixture.mjs';
import { DriveFals, ListenBrainzFals, GSI_FALS } from './falsos.mjs';
import { COMPROVACIONS } from './comprovacions.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const NOMES = arg('--nomes'), ARXIU = arg('--arxiu'), CAPTURES = process.argv.includes('--captures');
const SORTIDA = path.join(ARREL, 'proves/sortida');

// ───────── el servidor local ─────────
const TIPUS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
                '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer((rq, rs) => {
  const p = path.join(ARREL, decodeURIComponent(new URL(rq.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ARREL) || !fs.existsSync(p)) { rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { 'Content-Type': TIPUS[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rs);
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const ORIGEN = `http://127.0.0.1:${servidor.address().port}`;

// ───────── el món fals ─────────
const ara = Date.now();
const drive = new DriveFals();
const carpeta = drive.afegeix({ name: 'La Meva Discoteca', mimeType: 'application/vnd.google-apps.folder' });
const bytes = ARXIU ? fs.readFileSync(ARXIU) : await arxiu(ara);
drive.afegeix({ name: 'la-meva-discoteca.sqlite', mimeType: 'application/x-sqlite3', parents: [carpeta.id], bytes });
const lb = new ListenBrainzFals(ARXIU ? [] : escoltesLB(ara));
const fugides = [], errors = [];

const navegador = await chromium.launch();
const context = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
await context.route('**/*', async route => {
  const u = new URL(route.request().url());
  if (u.origin === ORIGEN) return route.continue();
  if (u.host === 'accounts.google.com' && u.pathname.startsWith('/gsi/client')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: GSI_FALS });
  if (u.host === 'www.googleapis.com') return drive.atén(route);
  if (u.host === 'api.listenbrainz.org') return lb.atén(route);
  fugides.push(u.host + u.pathname);
  return route.abort('blockedbyclient');
});
const pagina = await context.newPage();
pagina.on('pageerror', e => errors.push(e.message));
pagina.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(m.text())) errors.push(m.text()); });

// ───────── el que fan servir les comprovacions ─────────
const S = await motor();
const versioInicial = (() => { const d = new S.Database(bytes); const v = d.exec('PRAGMA user_version')[0].values[0][0]; d.close(); return v; })();
const ctx = {
  versioInicial,
  pagina, drive, lb, ara, ORIGEN, fugides, errors, real: !!ARXIU,
  $: s => pagina.locator(s),
  espera: ms => pagina.waitForTimeout(ms),
  // L'arxiu tal com és ara al Drive fals, obert amb sql.js. Qui el demana el tanca.
  arxiuDrive() { return new S.Database(drive.per('la-meva-discoteca.sqlite').bytes); },
  consulta(sql, p = []) { const db = ctx.arxiuDrive(); try { const st = db.prepare(sql); st.bind(p); const o = []; while (st.step()) o.push(st.getAsObject()); st.free(); return o; } finally { db.close(); } },
  // Espera que no quedi res pendent de desar.
  async esperaDesat(max = 8000) {
    await pagina.waitForFunction(() => !document.getElementById('desat')?.classList.contains('visible'), null, { timeout: max });
    await pagina.waitForTimeout(300);
  },
  async obreSafata() { await pagina.click('#btSafata'); await pagina.waitForSelector('#s-safata.activa'); await pagina.waitForTimeout(400); },
  async tornaFaristol(sub = 'rot') { await pagina.evaluate(() => document.querySelector('[data-anar="faristol"]')?.click()); await pagina.click(`[data-sub="${sub}"]`); await pagina.waitForTimeout(250); }
};

// ───────── passar-les ─────────
if (CAPTURES) fs.mkdirSync(SORTIDA, { recursive: true });
await pagina.goto(ORIGEN + '/index.html');
let ok = 0, ko = 0, n = 0;
const triades = COMPROVACIONS.filter(c => !NOMES || c.nom.toLowerCase().includes(NOMES.toLowerCase()) || c.sempre);
for (const c of triades) {
  n++;
  if (ARXIU && c.sintetic) { console.log(`–  ${String(n).padStart(2)} ${c.nom} (només amb l'arxiu sintètic)`); continue; }
  try {
    await c.fes(ctx);
    ok++; console.log(`✓  ${String(n).padStart(2)} ${c.nom}`);
  } catch (e) {
    ko++; console.log(`✗  ${String(n).padStart(2)} ${c.nom}\n      ${String(e.message || e).split('\n')[0]}`);
  }
  if (CAPTURES) await pagina.screenshot({ path: path.join(SORTIDA, String(n).padStart(2, '0') + '.png') }).catch(() => {});
}
console.log(`\n${ok} de ${ok + ko} comprovacions bé${ko ? `, ${ko} malament` : ''}.`);
await navegador.close(); servidor.close();
process.exit(ko ? 1 : 0);
