// La prova de velocitat (ACT-738, 13-11, Ricard: «Tenemos que asegurarnos que el crecimiento de la app, tanto de funciones
// como de paso del tiempo y de discos no la vuelvan lenta, lo odio», i «no pongas ninguna regla estricta que algun dia
// salte de forma silenciosa cuando ya no me acuerde»). Un arxiu fals gran (10.000 discos, 5 anys d'escoltes) passa per
// la màquina i es mesura cada pantalla. Les xifres es diuen en cada publicació i no frenen res: qui decideix si una
// xifra és lenta és Ricard en llegir-la. El que sí que frena són les comprovacions de sota, que miren que fer-ho ràpid
// no ha canviat cap resultat (el campo de cada regla: Escolta, Scrobble.escolta_id, les targetes).
//
// Es passa sola al final del banc (node proves/banc.mjs), o sola: node proves/banc.mjs --nomes velocitat.
// Les xifres del navegador són del portàtil on corre el banc; al mòbil, unes quantes vegades més.
import { arxiuGran, motor, ARREL } from './fixture.mjs';
import { DriveFals, ListenBrainzFals, GSI_FALS } from './falsos.mjs';
import { esperaALaPagina } from './comprovacions.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const MIN = 60e3, D = 864e5;
const iso = t => new Date(t).toISOString();
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// L'empremta de les escoltes: el que cada pista diu de la seva escolta i de la seva unió, i el que en surt a l'edició i a la
// part. Dues empremtes iguals són dos càlculs iguals, encara que els id de les escoltes no ho siguin.
export const empremta = db => JSON.stringify([
  db.exec(`SELECT p.id, x.edicio_id, x.part_id, x.data_hora, x.context, x.atencio, x.completitud, x.compte,
           (SELECT MIN(y.id) FROM scrobble y WHERE y.escolta_id = x.unio) FROM scrobble p LEFT JOIN escolta x ON x.id = p.escolta_id ORDER BY p.id`)[0]?.values,
  db.exec('SELECT COUNT(*) FROM escolta')[0].values, db.exec('SELECT id, portada, portada_origen FROM edicio ORDER BY id')[0]?.values,
  db.exec('SELECT id, data_darrera_escolta FROM part ORDER BY id')[0]?.values]);
const unaTargeta = c => JSON.stringify([c.clau, c.estat, c.scr.map(s => s.id), c.discos.map(d => d.clau)]);

// Una mesura: el que tarda f, en mil·lisegons.
const temps = async f => { const t = performance.now(); await f(); return Math.round(performance.now() - t); };

export async function velocitat({ navegador, ORIGEN, ara = Date.now() }) {
  const files = [], comprovacions = [];
  const comprova = (nom, f) => { try { f(); comprovacions.push({ nom, ok: true }); } catch (e) { comprovacions.push({ nom, ok: false, msg: e.message }); } };
  const cal = (c, m) => { if (!c) throw new Error(m); };

  // ───────── en node: el càlcul ─────────
  let gran;
  const tGen = await temps(async () => { gran = await arxiuGran(ara); });
  const { bytes, n } = gran;
  files.push(['L\'arxiu gran', null, `${n.discos} discos, ${n.scrobbles} pistes, ${n.escoltes} escoltes · ${(bytes.length / 1e6).toFixed(1)} MB · fet en ${(tGen / 1000).toFixed(0)} s`]);
  const S = await motor();
  const E = await import(pathToFileURL(path.join(ARREL, 'js/escoltes.js')).href + '?v=14');
  const obre = () => new S.Database(new Uint8Array(bytes));   // una còpia: sql.js escriu sobre els bytes que rep
  const enTransaccio = (db, f) => { db.run('SAVEPOINT v'); try { return f(); } finally { db.run('RELEASE v'); } };
  const pistaDe = (db, sql) => { const r = db.exec(sql)[0]?.values?.[0]; return r ? { album: r[0], recording_msid: r[1], pista: r[2], duration_ms: r[3], listened_at: r[4], id: r[5] } : null; };
  const nova = (p, t, compte = 'crimsonnnn') => ({ compte, listened_at: iso(t), artista: 'Artista', pista: p.pista, album: p.album, duration_ms: p.duration_ms,
                                                    recording_msid: p.recording_msid, release_mbid: null, caa_release_mbid: null });
  // Cada cas: el canvi i des de quan (desDe), fet sobre dues còpies. Una es calcula per trossos i l'altra sencera, i
  // s'ha de donar el mateix. El temps de cada una, dins d'una transacció, com a la màquina (arxiu.canvia).
  const casos = [
    ['una pista nova, ara', db => { const p = pistaDe(db, `SELECT s.album, s.recording_msid, s.pista, s.duration_ms, s.listened_at, s.id FROM scrobble s JOIN escolta x ON x.id = s.escolta_id
        JOIN edicio e ON e.id = x.edicio_id WHERE e.rotacio_actual = 1 ORDER BY s.listened_at DESC LIMIT 1`);
      const t = ara - 2 * MIN; E.desaScrobbles([nova(p, t)])(db); return iso(t); }],
    ['contestar la sessió d\'avui', db => { const ids = db.exec(`SELECT id FROM scrobble WHERE estat = 'pendent' ORDER BY listened_at DESC LIMIT 12`)[0]?.values.map(r => r[0]) || [];
      E.contesta(ids, 'Dormir')(db); return null; }, true],
    ['ignorar una pista de fa un any', db => { const p = pistaDe(db, `SELECT album, recording_msid, pista, duration_ms, listened_at, id FROM scrobble WHERE escolta_id IS NOT NULL
        AND listened_at > '${iso(ara - 365 * D)}' ORDER BY listened_at LIMIT 1 OFFSET 3`);
      db.run(`UPDATE scrobble SET estat = 'ignorat' WHERE id = ${p.id}`); return p.listened_at; }],
    ['una pista que torna 6 dies després', db => { const p = pistaDe(db, `SELECT album, recording_msid, pista, duration_ms, listened_at, id FROM scrobble WHERE escolta_id IS NOT NULL
        ORDER BY listened_at DESC LIMIT 1 OFFSET 400`);
      const t = Date.parse(p.listened_at) + 6 * D + 3600e3; E.desaScrobbles([nova(p, t, 'crimsonnnnfeina')])(db); return iso(t); }]
  ];
  let sencer = null;
  const iguals = [];
  for (const [nom, canvi, jaCalcula] of casos) {
    const a = obre();
    let ta;
    if (jaCalcula) ta = await temps(() => enTransaccio(a, () => canvi(a)));   // contesta() ja torna a calcular, per trossos
    else { const desDe = canvi(a); ta = await temps(() => enTransaccio(a, () => E.recalcula(a, { desDe }))); }
    const ea = empremta(a); a.close();
    const b = obre(); canvi(b); const tb = await temps(() => enTransaccio(b, () => E.recalcula(b)));
    const eb = empremta(b); b.close();
    sencer ??= tb;
    files.push(['Càlcul · ' + nom, ta, 'node, per trossos']);
    iguals.push([nom, ea === eb]);
  }
  files.push(['Càlcul sencer (un cop, en canviar CALCUL o l\'estructura)', sencer, 'node']);
  comprova('velocitat: el càlcul per trossos dona el mateix que el càlcul sencer (Escolta, Scrobble.escolta_id, la portada, la part)', () => {
    const mal = iguals.filter(([, ok]) => !ok).map(([n]) => n);
    cal(!mal.length, 'diferent en: ' + mal.join(', '));
  });
  comprova('velocitat: les targetes a partir d\'una hora són les mateixes que tallant-ho tot', () => {
    const db = obre();
    try {
      const totes = E.targetes(db, { estat: 'totes', ara });
      const perClau = new Map(totes.map(c => [c.clau, unaTargeta(c)]));
      // dins d'una sessió, en un silenci, fa una setmana, fa un any, la primera pendent
      const hores = [iso(ara - 50 * MIN), iso(ara - 7 * D), iso(ara - 365 * D + 5 * 3600e3), E.primeraPendent(db)].filter(Boolean);
      for (const h of hores) {
        const des = E.targetes(db, { estat: 'totes', ara, desDe: h });
        for (const c of des) cal(perClau.get(c.clau) === unaTargeta(c), `des de ${h}: la targeta ${c.clau} no és igual que tallant-ho tot`);
        const falten = totes.filter(c => c.fi >= h && !des.some(x => x.clau === c.clau));
        cal(!falten.length, `des de ${h}: falten ${falten.length} targetes que acaben després`);
      }
      // les targetes de les hores d'un disc per identificar (fa 300 dies), a més de les d'ara
      const nous = E.discosNous(db).nous, horesNous = nous.flatMap(x => x.hores);
      cal(horesNous.some(h => h < iso(ara - 200 * D)), 'l\'arxiu gran no té cap disc per identificar de fa mesos');
      const amb = E.targetes(db, { estat: 'totes', ara, desDe: iso(ara - D), hores: horesNous });
      for (const h of horesNous) {
        const c = totes.find(x => x.inici <= h && h <= x.scr[x.scr.length - 1].listened_at);
        cal(c && amb.some(x => unaTargeta(x) === unaTargeta(c)), `la targeta de l'hora ${h} (un disc per identificar) no hi és, o no és igual`);
      }
    } finally { db.close(); }
  });
  comprova('velocitat: les pistes sense escolta són exactament les que no casen amb cap edició (Scrobble.escolta_id)', () => {
    const db = obre();
    try {
      const casa = E.casaAmbEdicio(db);
      const mal = [];
      const st = db.prepare("SELECT id, album, recording_msid, escolta_id FROM scrobble WHERE estat != 'ignorat'");
      while (st.step()) { const [id, album, recording_msid, esc] = st.get(); if ((esc === null) === !!casa({ album, recording_msid })) mal.push(id); }
      st.free();
      cal(!mal.length, `${mal.length} pistes no compleixen la regla (la primera: ${mal[0]})`);
      cal(db.exec('SELECT COUNT(*) FROM scrobble WHERE escolta_id IS NOT NULL AND escolta_id NOT IN (SELECT id FROM escolta)')[0].values[0][0] === 0, 'hi ha pistes que apunten a una escolta esborrada');
    } finally { db.close(); }
  });

  // ───────── al navegador: les pantalles ─────────
  const drive = new DriveFals();
  const carpeta = drive.afegeix({ name: 'La Meva Discoteca', mimeType: 'application/vnd.google-apps.folder' });
  drive.afegeix({ name: 'la-meva-discoteca.sqlite', mimeType: 'application/x-sqlite3', parents: [carpeta.id], bytes });
  const lb = new ListenBrainzFals([]);
  let portades = 0;
  const context = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGEN) return route.continue();
    if (u.host === 'accounts.google.com' && u.pathname.startsWith('/gsi/client')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: GSI_FALS });
    if (u.host === 'www.googleapis.com') return drive.atén(route);
    if (u.host === 'api.listenbrainz.org') return lb.atén(route);
    // Les portades, com si ja fossin al mòbil: una imatge d'un píxel. Es compten, perquè cada una és una petició.
    if (u.host === 'coverartarchive.org') { portades++; return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PIXEL }); }
    return route.abort('blockedbyclient');
  });
  // La còpia setmanal no es fa mentre es mesuren les pantalles: es mesura a part, al final (ACT-750 e).
  // El rellotge de les lectures automàtiques, el de veritat (30 s): un de curt pujaria l'arxiu gran cada mig segon enmig
  // de les mesures. Els tocs, amb la calma curta, perquè cada mesura comenci amb l'arxiu desat.
  await context.addInitScript(() => { localStorage.setItem('tria-banc-ritme', JSON.stringify({ calma: 150, rellotge: 30000 })); sessionStorage.setItem('tria-banc-espera-copia', '600000'); });
  const p = await context.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const pintat = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  // Desat: cap toc de Ricard per pujar (el que han llegit les lectures automàtiques puja amb el rellotge, com al mòbil).
  const desat = () => esperaALaPagina(p, async () => { const A = await import('/js/arxiu.js?v=21');
    return !document.getElementById('desat')?.classList.contains('visible') && !(A.estat.pendent && A.estat.manual); }, null, { timeout: 120000, msg: 'l\'arxiu gran no acaba de desar-se' });
  // PERFIL=1: un perfil de CPU de cada pantalla a proves/sortida/ (per buscar què és lent; no es puja).
  const cdp = process.env.PERFIL ? await context.newCDPSession(p) : null;
  if (cdp) await cdp.send('Profiler.enable');
  // Abans de cada mesura, la màquina en repòs: res per desar i un moment perquè acabin les feines de fons (la còpia, la
  // sonda, les portades). Si no, el temps d'una pantalla porta el de la feina de l'anterior.
  const repos = async () => { await desat().catch(() => {}); await p.waitForTimeout(1500); };
  const pantalla = async (nom, f, nota = '') => {
    await repos();
    const abans = portades;
    if (cdp) await cdp.send('Profiler.start');
    const t = await temps(async () => { await f(); await pintat(); });
    if (cdp) { const { profile } = await cdp.send('Profiler.stop'); const fs = await import('node:fs'); fs.mkdirSync(path.join(ARREL, 'proves/sortida'), { recursive: true });
      fs.writeFileSync(path.join(ARREL, 'proves/sortida', 'perfil-' + files.length + '.cpuprofile'), JSON.stringify(profile)); }
    files.push([nom, t, [nota, portades > abans ? `${portades - abans} portades demanades` : ''].filter(Boolean).join(' · ')]);
  };
  try {
    await p.goto(ORIGEN + '/index.html');
    await p.waitForSelector('#entra', { timeout: 20000 });
    await pantalla('Obrir l\'arxiu (toc a Entra, fins al Faristol)', async () => { await p.click('#entra'); await p.waitForSelector('#s-faristol.activa', { timeout: 120000 }); });
    await desat(); await p.waitForTimeout(500);
    await pantalla('Historial', () => p.click('[data-sub="hist"]'));
    await pantalla('Discos en Rotació', () => p.click('[data-sub="rot"]'));
    await pantalla('Obrir la safata', async () => { await p.click('#btSafata'); await p.waitForSelector('#s-safata.activa'); });
    await p.waitForTimeout(800); await desat();
    const xip = p.locator('[data-sfctx]').first();
    if (await xip.count()) await pantalla('Contestar una targeta (toc, fins que es repinta)', () => xip.click());
    else files.push(['Contestar una targeta', null, 'no hi havia cap targeta per contestar']);
    await desat();
    // una pista nova que arriba en tocar la safata
    const ult = await p.evaluate(async () => { const A = await import('/js/arxiu.js?v=21'); return A.estat.db.exec("SELECT album, recording_msid, pista, duration_ms FROM scrobble WHERE escolta_id IS NOT NULL ORDER BY listened_at DESC LIMIT 1")[0].values[0]; });
    lb.escoltes.push({ listened_at: Math.floor((ara - MIN) / 1000), recording_msid: ult[1], compte: 'crimsonnnn',
                       track_metadata: { artist_name: 'Artista', track_name: ult[2], release_name: ult[0], additional_info: { duration_ms: ult[3] } } });
    const nPistes = () => p.evaluate(async () => { const A = await import('/js/arxiu.js?v=21'); return A.estat.db.exec('SELECT COUNT(*) FROM scrobble')[0].values[0][0]; });
    const n0 = await nPistes();
    await p.click('[data-tornasafata]').catch(() => {}); await p.waitForTimeout(300);
    await pantalla('Una pista nova (lectura de ListenBrainz, fins que es repinta)', async () => {
      await p.click('#btSafata');
      for (let i = 0; i < 600 && await nPistes() === n0; i++) await p.waitForTimeout(50);
    });
    await desat();
    await p.click('[data-tornasafata]').catch(() => {}); await p.waitForTimeout(300);
    await pantalla('Prestatgeria · les rajoles (obra 6)', async () => { await p.click('[data-anar="prestatgeria"]'); await p.waitForSelector('#s-prestatgeria.activa'); await p.waitForSelector('#rajoles [data-rajola]'); });
    await pantalla('Prestatgeria · Tots els discos', async () => { await p.click('[data-rajola="tots"]'); await p.waitForSelector('#arxiu [data-fitxa]'); });
    await pantalla('Prestatgeria · Agrupacions', () => p.click('[data-psub="agr"]'));
    await pantalla('L\'Afinació', () => p.click('[data-psub="afi"]'));
    await p.click('[data-psub="tots"]'); await p.click('[data-rajola="tots"]'); await p.waitForTimeout(300);
    await pantalla('Obrir la fitxa d\'un disc', async () => { await p.evaluate(() => document.querySelectorAll('#arxiu [data-fitxa]')[5].click()); await p.waitForSelector('#full.obert'); });
    await p.click('#fons').catch(() => {}); await p.waitForTimeout(300);
    const exp = await p.evaluate(async () => { const A = await import('/js/arxiu.js?v=21'); const t = performance.now(); const b = A.estat.db.export(); return [Math.round(performance.now() - t), b.length]; });
    files.push(['Exportar l\'arxiu (cada desat ho fa tres vegades i el puja sencer)', exp[0], (exp[1] / 1e6).toFixed(1) + ' MB a pujar al Drive a cada canvi']);
    // La còpia setmanal (ACT-750 e): el que costa fer l'Excel i la foto de l'arxiu (sense pujar-los).
    await repos();
    const cp = await p.evaluate(async () => { const A = await import('/js/arxiu.js?v=21'), X = await import('/js/excel.js?v=6');
      const t = performance.now(); const xl = await X.xlsx(A.estat.db); const b = A.estat.db.export(); return [Math.round(performance.now() - t), xl.length, b.length]; });
    files.push(['La còpia setmanal (l\'Excel i l\'arxiu, sense pujar)', cp[0], `Excel de ${(cp[1] / 1e6).toFixed(1)} MB i arxiu de ${(cp[2] / 1e6).toFixed(1)} MB`]);
    const final = new S.Database(new Uint8Array(drive.per('la-meva-discoteca.sqlite').bytes));
    comprova('velocitat: l\'arxiu gran acaba al Drive íntegre i sense pistes que apuntin a una escolta esborrada', () => {
      cal(final.exec('PRAGMA integrity_check')[0].values[0][0] === 'ok', 'integritat');
      cal(final.exec('SELECT COUNT(*) FROM scrobble WHERE escolta_id IS NOT NULL AND escolta_id NOT IN (SELECT id FROM escolta)')[0].values[0][0] === 0, 'pistes amb escolta perduda');
    });
    final.close();
  } catch (e) {
    comprovacions.push({ nom: 'velocitat: les pantalles amb l\'arxiu gran', ok: false, msg: e.message.split('\n')[0] });
  } finally { await context.close(); }
  // ───────── d'aquí a 10 i 20 anys (ACT-750 c2): només obrir i desar ─────────
  // Ricard: «ahora y dentro de 10 y 20 años» (ACT-747). Els mateixos 10.000 discos, amb 10 i 20 anys d'escoltes.
  for (const anys of [10, 20]) {
    try {
      const { bytes: b, n: nn } = await arxiuGran(ara, { anys });
      const dv = new DriveFals();
      const cv = dv.afegeix({ name: 'La Meva Discoteca', mimeType: 'application/vnd.google-apps.folder' });
      dv.afegeix({ name: 'la-meva-discoteca.sqlite', mimeType: 'application/x-sqlite3', parents: [cv.id], bytes: b });
      const lbv = new ListenBrainzFals([]);
      const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
      await ctx.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.origin === ORIGEN) return route.continue();
        if (u.host === 'accounts.google.com' && u.pathname.startsWith('/gsi/client')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: GSI_FALS });
        if (u.host === 'www.googleapis.com') return dv.atén(route);
        if (u.host === 'api.listenbrainz.org') return lbv.atén(route);
        if (u.host === 'coverartarchive.org') return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PIXEL });
        return route.abort('blockedbyclient');
      });
      await ctx.addInitScript(() => { localStorage.setItem('tria-banc-ritme', JSON.stringify({ calma: 150, rellotge: 30000 })); sessionStorage.setItem('tria-banc-espera-copia', '600000'); });
      const q = await ctx.newPage();
      let caiguda = null; q.on('crash', () => { caiguda = 'la pàgina s\'ha penjat (memòria)'; });
      try {
        await q.goto(ORIGEN + '/index.html'); await q.waitForSelector('#entra', { timeout: 20000 });
        const to = await temps(async () => { await q.click('#entra'); await q.waitForSelector('#s-faristol.activa', { timeout: 180000 }); });
        await esperaALaPagina(q, async () => { const A = await import('/js/arxiu.js?v=21'); return !(A.estat.pendent && A.estat.manual); }, null, { timeout: 180000 });
        await q.waitForTimeout(1500);
        const td = await q.evaluate(async () => { const A = await import('/js/arxiu.js?v=21'); const t = performance.now();
          const r = await A.canvia(db => db.run("INSERT OR REPLACE INTO meta (clau, valor) VALUES ('velocitat', ?)", [String(Date.now())]));
          return [Math.round(performance.now() - t - A.RITME.calma), r.desat]; });
        files.push([`Obrir l'arxiu de ${anys} anys`, to, `${nn.scrobbles} pistes · ${(b.length / 1e6).toFixed(0)} MB`]);
        files.push([`Desar l'arxiu de ${anys} anys (un toc, fins al Drive)`, td[0], td[1] ? 'sense la calma de 2 s' : 'no s\'ha desat']);
      } catch (e) { throw new Error(caiguda || e.message); } finally { await ctx.close().catch(() => {}); }
    } catch (e) { files.push([`L'arxiu de ${anys} anys`, null, 'no s\'ha pogut mesurar: ' + (globalThis.__caiguda || e.message.split('\n')[0])]); }
  }
  comprova('velocitat: cap error a la consola amb l\'arxiu gran', () => cal(!errors.length, errors.slice(0, 3).join(' | ')));
  return { files, comprovacions };
}

// La taula que es diu en cada publicació.
export function taula(files) {
  const w = Math.max(...files.map(f => f[0].length));
  return ['Velocitat amb l\'arxiu gran (ms; al mòbil, unes quantes vegades més):',
    ...files.map(([nom, ms, nota]) => `  ${nom.padEnd(w)}  ${ms === null ? '     ' : String(ms).padStart(5)}${nota ? '  · ' + nota : ''}`)].join('\n');
}
