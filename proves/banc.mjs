// El banc de proves de la Màquina Màgica (ACT-533; per blocs des de la ACT-753). Una ordre:
//   node proves/banc.mjs                    → la porta per publicar: tots els blocs en sèrie, cadascun des d'una còpia neta
//                                             de l'arxiu sintètic, i al final la prova de velocitat, sola
//   node proves/banc.mjs --rapid            → mentre es construeix: 3 navegadors a la vegada i sense la prova de velocitat
//   node proves/banc.mjs --paral N          → N navegadors a la vegada (amb la prova de velocitat al final, sola)
//   node proves/banc.mjs --nomes safata     → només els blocs que porten aquesta paraula al nom o en alguna comprovació,
//                                             sencers i des de zero (més el bloc d'arrencar)
//   node proves/banc.mjs --captures         → desa una captura de cada comprovació a proves/sortida/
//   node proves/banc.mjs --nomes velocitat  → només la prova de velocitat amb l'arxiu gran (ACT-738)
//   node proves/banc.mjs --sense-velocitat  → sense la prova de velocitat (abans de publicar, sempre amb ella)
//   node proves/banc.mjs --arxiu X.sqlite   → amb una còpia d'un arxiu real (no es puja mai: és a .gitignore)
// Els blocs (ACT-749, ACT-753): comprovacions.mjs és una llista en ordre, tallada per marques { bloc: 'nom' }. Cada bloc
// arrenca d'una còpia neta de l'arxiu sintètic, amb el seu Drive, el seu ListenBrainz i el seu navegador, sense heretar res
// de cap altre bloc; dins el bloc, cada comprovació parteix de l'estat que deixa l'anterior. Un bloc que necessita alguna
// cosa abans la fa a `prepara(ctx)`, que no compta com a comprovació. El bloc «el que no ha de passar mai» (guarda: true) no
// és un món propi: les seves comprovacions es passen al final de cada bloc, i fallen si fallen en algun.
// Cada pasada diu quant ha trigat (ACT-751). Cap petició no surt a internet: si n'hi ha cap que ho intenta, la guarda falla.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ARREL, arxiu, escoltesLB, motor } from './fixture.mjs';
import { DriveFals, ListenBrainzFals, GSI_FALS, FontsFalses } from './falsos.mjs';
import { COMPROVACIONS, esperaALaPagina } from './comprovacions.mjs';
import { velocitat, taula } from './velocitat.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const RAPID = process.argv.includes('--rapid');
const NOMES = arg('--nomes'), ARXIU = arg('--arxiu'), CAPTURES = process.argv.includes('--captures');
const PARAL = Math.max(1, +(arg('--paral') || (RAPID ? 3 : 1)));
const NOMES_VELOCITAT = !!NOMES && 'velocitat'.includes(NOMES.toLowerCase());
const VELOCITAT = !ARXIU && !RAPID && !process.argv.includes('--sense-velocitat') && (!NOMES || NOMES_VELOCITAT);
const SORTIDA = path.join(ARREL, 'proves/sortida');
const t0 = Date.now(), seg = t => ((Date.now() - t) / 1000).toFixed(1) + ' s';

// ───────── els blocs ─────────
const blocs = [];
let numero = 0;
for (const c of COMPROVACIONS) {
  if (c.bloc) { blocs.push({ nom: c.bloc, prepara: c.prepara, senseArrencada: !!c.senseArrencada, guarda: !!c.guarda, comprovacions: [] }); continue; }
  if (!blocs.length) throw new Error('comprovacions.mjs ha de començar amb una marca { bloc }');
  blocs.at(-1).comprovacions.push({ ...c, n: ++numero });
}
const guardes = blocs.filter(b => b.guarda).flatMap(b => b.comprovacions);
const mons = blocs.filter(b => !b.guarda);
const porta = t => t.toLowerCase().includes(NOMES.toLowerCase());
const triats = NOMES_VELOCITAT ? [] : mons.filter((b, i) => !NOMES || i === 0 || porta(b.nom) || b.comprovacions.some(c => porta(c.nom)));

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
const S = await motor();
const navegador = await chromium.launch();
const bytesReal = ARXIU ? fs.readFileSync(ARXIU) : null;

// El ritme del banc (ACT-750): la calma dels tocs, el rellotge de les lectures automàtiques i l'espera de la còpia, curts,
// perquè cada desat no faci esperar 2 o 30 s ni cada obertura 10 s. Les comprovacions del ritme de veritat el treuen amb
// sessionStorage 'tria-ritme-real' i recarreguen.
export const RITME_DEL_BANC = () => { if (sessionStorage.getItem('tria-ritme-real')) return;
  localStorage.setItem('tria-banc-ritme', JSON.stringify({ calma: 150, rellotge: 500 })); sessionStorage.setItem('tria-banc-espera-copia', '300'); };

// ───────── un món fals per bloc: arxiu, Drive, ListenBrainz, fonts i navegador nets ─────────
async function mon() {
  const ara = Date.now();
  const drive = new DriveFals();
  const carpeta = drive.afegeix({ name: 'La Meva Discoteca', mimeType: 'application/vnd.google-apps.folder' });
  const bytes = bytesReal ? new Uint8Array(bytesReal) : await arxiu(ara);
  drive.afegeix({ name: 'la-meva-discoteca.sqlite', mimeType: 'application/x-sqlite3', parents: [carpeta.id], bytes });
  const lb = new ListenBrainzFals(ARXIU ? [] : escoltesLB(ara));
  const fonts = new FontsFalses();
  const fugides = [], errors = [];
  const context = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGEN) return route.continue();
    if (u.host === 'accounts.google.com' && u.pathname.startsWith('/gsi/client')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: GSI_FALS });
    if (u.host === 'www.googleapis.com') return drive.atén(route);
    if (u.host === 'api.listenbrainz.org') return lb.atén(route);
    if (await fonts.atén(route)) return;
    fugides.push(u.host + u.pathname);
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(RITME_DEL_BANC);
  const pagina = await context.newPage();
  pagina.on('pageerror', e => errors.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const versioInicial = (() => { const d = new S.Database(bytes); const v = d.exec('PRAGMA user_version')[0].values[0][0]; d.close(); return v; })();
  const ctx = {
    versioInicial, context,
    pagina, drive, lb, fonts, ara, ORIGEN, fugides, errors, real: !!ARXIU, S,
    $: s => pagina.locator(s),
    espera: ms => pagina.waitForTimeout(ms),
    // L'arxiu tal com és ara al Drive fals, obert amb sql.js. Qui el demana el tanca.
    arxiuDrive() { return new S.Database(drive.per('la-meva-discoteca.sqlite').bytes); },
    consulta(sql, p = []) { const db = ctx.arxiuDrive(); try { const st = db.prepare(sql); st.bind(p); const o = []; while (st.step()) o.push(st.getAsObject()); st.free(); return o; } finally { db.close(); } },
    // Espera que no quedi res pendent de desar.
    // Des de la ACT-750 (a), «sense desar» no surt per les lectures automàtiques: s'espera que l'arxiu no tingui res pendent.
    async esperaDesat(max = 8000) {
      await esperaALaPagina(pagina, async () => !document.getElementById('desat')?.classList.contains('visible')
        && !(await import('./js/arxiu.js?v=21')).estat.pendent, null, { timeout: max, msg: 'queda res pendent de desar' });
      await pagina.waitForTimeout(300);
    },
    async obreSafata() { await pagina.click('#btSafata'); await pagina.waitForSelector('#s-safata.activa'); await pagina.waitForTimeout(400); },
    async tornaFaristol(sub = 'rot') { await pagina.evaluate(() => document.querySelector('[data-anar="faristol"]')?.click()); await pagina.click(`[data-sub="${sub}"]`); await pagina.waitForTimeout(250); },
    // El que fan les dues primeres comprovacions: obrir la màquina i entrar amb un toc. Ho fa cada bloc abans de començar.
    async arrenca() {
      await pagina.goto(ORIGEN + '/index.html');
      await pagina.waitForSelector('#entra', { timeout: 10000 }); await pagina.click('#entra');
      await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 }); await ctx.esperaDesat(12000);
    }
  };
  return ctx;
}

// ───────── passar un bloc ─────────
const resultats = new Map();     // n → { ok, msg }
const fallaGuarda = new Map();   // n de la guarda → [blocs on ha fallat]
async function passaBloc(b) {
  const t = Date.now(), linies = [];
  const ctx = await mon();
  const apunta = (c, ok, msg) => { resultats.set(c.n, { ok, msg }); linies.push(`${ok ? '✓' : '✗'}  ${String(c.n).padStart(3)} ${c.nom}${ok ? '' : '\n        ' + msg}`); };
  try {
    if (b.senseArrencada) await ctx.pagina.goto(ORIGEN + '/index.html'); else await ctx.arrenca();
    if (b.prepara) await b.prepara(ctx);
  } catch (e) {
    for (const c of b.comprovacions) apunta(c, false, 'el bloc no ha pogut arrencar o preparar-se: ' + String(e.message || e).split('\n')[0]);
    await ctx.context.close(); return { b, linies, s: seg(t) };
  }
  for (const c of b.comprovacions) {
    if (ARXIU && c.sintetic) { resultats.set(c.n, { ok: true, salt: true }); linies.push(`–  ${String(c.n).padStart(3)} ${c.nom} (només amb l'arxiu sintètic)`); continue; }
    try { await c.fes(ctx); apunta(c, true); }
    catch (e) { apunta(c, false, String(e.message || e).split('\n')[0]); }
    if (CAPTURES) await ctx.pagina.screenshot({ path: path.join(SORTIDA, String(c.n).padStart(3, '0') + '.png') }).catch(() => {});
  }
  for (const g of guardes) {
    try { await g.fes(ctx); }
    catch (e) { (fallaGuarda.get(g.n) || fallaGuarda.set(g.n, []).get(g.n)).push(`${b.nom}: ${String(e.message || e).split('\n')[0]}`); }
  }
  await ctx.context.close();
  return { b, linies, s: seg(t) };
}

// ───────── passar-los ─────────
if (CAPTURES) fs.mkdirSync(SORTIDA, { recursive: true });
const fases = [];
if (triats.length) {
  const tb = Date.now(), cua = [...triats], fets = [];
  console.log(`${triats.length} blocs, ${PARAL === 1 ? 'en sèrie' : PARAL + ' navegadors a la vegada'}, cadascun des d'una còpia neta\n`);
  await Promise.all(Array.from({ length: Math.min(PARAL, cua.length) }, async () => {
    while (cua.length) {
      const r = await passaBloc(cua.shift()); fets.push(r);
      console.log(`── ${r.b.nom} · ${r.s}\n${r.linies.join('\n')}`);
    }
  }));
  for (const g of guardes) {
    const f = fallaGuarda.get(g.n);
    resultats.set(g.n, f ? { ok: false, msg: f.slice(0, 3).join(' | ') } : { ok: true });
    console.log(`${f ? '✗' : '✓'}  ${String(g.n).padStart(3)} ${g.nom} (a tots els blocs)${f ? '\n        ' + f.slice(0, 3).join(' | ') : ''}`);
  }
  fases.push([`Blocs (${triats.length}, ${PARAL === 1 ? 'en sèrie' : PARAL + ' navegadors'})`, seg(tb)]);
  const lents = [...fets].sort((a, b) => parseFloat(b.s) - parseFloat(a.s)).slice(0, 3);
  fases.push(['  els més lents', lents.map(r => `${r.b.nom.slice(0, 40)} ${r.s}`).join(' · ')]);
}
let ok = [...resultats.values()].filter(r => r.ok).length, ko = [...resultats.values()].filter(r => !r.ok).length;
if (VELOCITAT) {
  const tv = Date.now();
  console.log('\n…la prova de velocitat amb l\'arxiu gran, sola (uns minuts)');
  const v = await velocitat({ navegador, ORIGEN, ara: Date.now() });
  let n = numero;
  for (const c of v.comprovacions) {
    n++;
    if (c.ok) { ok++; console.log(`✓  ${String(n).padStart(3)} ${c.nom}`); }
    else { ko++; console.log(`✗  ${String(n).padStart(3)} ${c.nom}\n        ${c.msg}`); }
  }
  console.log('\n' + taula(v.files));
  fases.push(['Prova de velocitat', seg(tv)]);
}
fases.push(['Total del banc', seg(t0)]);
console.log('\nTemps de cada fase (ACT-751):\n' + fases.map(([a, b]) => `  ${a.padEnd(34)} ${b}`).join('\n'));
console.log(`\n${ok} de ${ok + ko} comprovacions bé${ko ? `, ${ko} malament` : ''}.`);
await navegador.close(); servidor.close();
process.exit(ko ? 1 : 0);
