// Les comprovacions de l'obra V — l'ordre de Discos en Rotació (ACT-856 a), «Tonal moderna» i «Banda» (ACT-858, ACT-859),
// «Piles» (ACT-860) i el scroll horitzontal de la fitxa (ACT-885). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#btInici:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
// L'ordre que veu la pantalla (D.rotacio), amb els títols.
const ordre = pagina => pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
  return D.rotacio(A.estat.db).map(e => e.titol); });
const fes = (pagina, codi, arg) => pagina.evaluate(async ([codi, arg]) => {
  const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25'), E = await import('./js/escoltes.js?v=15');
  let r; await A.canvia(db => { r = new Function('D', 'E', 'db', 'arg', codi)(D, E, db, arg); }); return r; }, [codi, arg]);

export const OBRA_V = [
  { bloc: 'obra V: l\'ordre de Rotació, Tonal moderna i Banda, Piles i el scroll (ACT-856 a, ACT-858 a ACT-860, ACT-885)' },
  { nom: 'estructura 15 (ACT-856 a): Edició.data_ordre_rotacio; en migrar, la dels discos en rotació és la seva data de referència', sintetic: true, async fes({ pagina, consulta }) {
    cal(consulta('PRAGMA user_version')[0].user_version >= 15, 'estructura de l\'arxiu del Drive, 15 o més');
    cal(consulta("SELECT COUNT(*) AS n FROM pragma_table_info('edicio') WHERE name = 'data_ordre_rotacio'")[0].n === 1, 'falta la columna edicio.data_ordre_rotacio');
    // La migració, sobre una base a l'estructura 14 amb un disc en rotació i un fora.
    const r = await pagina.evaluate(async () => { const { MIGRACIONS } = await import('./js/esquema.js?v=10');
      const SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f }); const d = new SQL.Database();
      MIGRACIONS.slice(0, 14).forEach((m, i) => { d.exec(m); d.exec(`PRAGMA user_version = ${i + 1}`); });
      d.run("INSERT INTO artista (id, nom_canonic) VALUES (1, 'X')"); d.run("INSERT INTO album (id, titol, artista_id) VALUES (1, 'A', 1), (2, 'B', 1)");
      d.run("INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, data_referencia_rotacio) VALUES (1, 1, 40, 1, '2026-11-01T10:00:00.000Z'), (2, 2, 40, 0, '2026-11-02T10:00:00.000Z')");
      d.exec(MIGRACIONS[14]); return d.exec('SELECT id, data_ordre_rotacio FROM edicio ORDER BY id')[0].values; });
    igual(JSON.stringify(r), JSON.stringify([[1, '2026-11-01T10:00:00.000Z'], [2, null]]), 'Edició.data_ordre_rotacio després de migrar (en rotació: la de referència; fora: buida)');
  } },
  { nom: 'l\'ordre de Rotació (ACT-856 a): treure i cancel·lar, i «Encara no», no el pugen; entrar sí; de la safata, a l\'hora de l\'escolta', sintetic: true, async fes({ pagina, esperaDesat, consulta }) {
    // Dos discos nous que entren a mà: el segon, a dalt (entrar mou l'ordre).
    const a = await fes(pagina, "return D.posaEnRotacio({ art: 'Banc V', tit: 'Ordre A', min: 40, canal: 'amazon' })(db).id;");
    await pagina.waitForTimeout(20);
    const b = await fes(pagina, "return D.posaEnRotacio({ art: 'Banc V', tit: 'Ordre B', min: 40, canal: 'amazon' })(db).id;");
    let o = await ordre(pagina);
    igual(o[0], 'Ordre B', 'el darrer que entra, a dalt'); igual(o[1], 'Ordre A', 'el d\'abans, segon');
    // Treure A i cancel·lar la sortida (D.treu + D.tornaARotacio): A no puja per sobre de B.
    await pagina.waitForTimeout(20);
    await fes(pagina, 'D.treu(arg)(db); D.tornaARotacio(arg)(db);', a);
    o = await ordre(pagina); igual(o.indexOf('Ordre A'), 1, 'A, després de treure i cancel·lar, al mateix lloc');
    // «Encara no» a les preguntes 8 i 9 (E.tocaReferencia): tampoc.
    await fes(pagina, 'E.tocaReferencia(arg)(db);', a);
    o = await ordre(pagina); igual(o.indexOf('Ordre A'), 1, 'A, després de «Encara no», al mateix lloc');
    // La data de referència sí que es mou (és de l'oferta d'entrar, ACT-763): les dues feines, separades.
    const [ra] = consulta('SELECT data_referencia_rotacio AS r, data_ordre_rotacio AS o FROM edicio WHERE id = ' + a);
    await esperaDesat();
    const [x] = consulta('SELECT data_referencia_rotacio AS r, data_ordre_rotacio AS o FROM edicio WHERE id = ' + a);
    cal(x.r > x.o, `la data de referència d'A (${x.r}) ha de ser posterior a la d'ordre (${x.o})`);
    // Un toc de ▶ (D.obre) sí que el puja.
    await pagina.waitForTimeout(20);
    await fes(pagina, 'D.obre(arg)(db);', a);
    o = await ordre(pagina); igual(o[0], 'Ordre A', 'A, després d\'un toc de ▶, a dalt');
    // De la safata (E.respon7 «sí»): un disc fora de rotació amb una escolta d'ahir entra a l'hora de l'escolta, no a dalt.
    const c = await fes(pagina, `const id = D.posaEnRotacio({ art: 'Banc V', tit: 'Ordre C', min: 40, canal: 'amazon' })(db).id; D.treu(id)(db);
      db.run("INSERT INTO escolta (edicio_id, data_hora, context, completitud, origen) VALUES (?, ?, 'A casa', 1, 'a mà')", [id, new Date(Date.now() - 86400e3).toISOString()]);
      E.respon7(id, true)(db); return id;`);
    o = await ordre(pagina);
    cal(o.indexOf('Ordre C') > o.indexOf('Ordre A') && o.indexOf('Ordre C') > o.indexOf('Ordre B'), `C, entrat des de la safata amb una escolta d'ahir, sota A i B: ${o.slice(0, 6).join(' · ')}`);
    const [y] = consulta('SELECT data_ordre_rotacio AS o FROM edicio WHERE id = ' + c);
    await esperaDesat();
    const [z] = consulta('SELECT data_ordre_rotacio AS o, (SELECT MAX(data_hora) FROM escolta WHERE edicio_id = ' + c + ') AS h FROM edicio WHERE id = ' + c);
    igual(z.o, z.h, 'Edició.data_ordre_rotacio de C, l\'hora de la seva escolta');
    await fes(pagina, 'D.treu(arg[0])(db); D.treu(arg[1])(db); D.treu(arg[2])(db);', [a, b, c]); await esperaDesat();
  } },
  { nom: 'gènere (ACT-858, ACT-859): «Tonal moderna» és el quart llenguatge i «banda» una formació; la fulla «El gènere» les ensenya', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const F = await import('./js/afinacio.js?v=4'); return { ll: F.LLENGUATGES, fo: F.FORMACIONS }; });
    igual(JSON.stringify(r.ll), JSON.stringify(['Antiga', 'Canon', 'Tonal moderna', 'Atonal / Dodecafònica']), 'Àlbum.Llenguatge, els valors');
    cal(r.fo.includes('banda') && r.fo.length === 9, 'Àlbum.Formació: nou valors amb «banda»: ' + r.fo.join(', '));
  } },
  { nom: 'Piles (ACT-860): la subpantalla de L\'Aparador es diu «Piles»', sintetic: true, async fes({ pagina }) {
    igual((await pagina.locator('[data-asub="esc"]').innerText()).trim(), 'Piles', 'el nom de la pastilla');
  } },
  { nom: 'el scroll horitzontal (ACT-885): una fitxa amb un títol llarg sense espais no és més ampla que la pantalla', sintetic: true, async fes({ pagina, esperaDesat }) {
    const id = await fes(pagina, `const id = D.posaEnRotacio({ art: 'BancVScrollUnArtistaAmbUnNomMoltLlargSenseCapEspai', tit: 'Unatitolmoltllargsenseespaisperveuresitrencalapantallahoritzontalment', min: 40, canal: 'amazon' })(db).id;
      db.run("UPDATE edicio SET nom_edicio = 'Edicio25thAnniversaryDeluxeRemasteredExpandedSenseEspais', tags = ? WHERE id = ?", [JSON.stringify(['UnTagMoltLlargSenseCapEspaiQueNoEsTrenca']), id]);
      db.run("UPDATE album SET generes = ? WHERE id = (SELECT album_id FROM edicio WHERE id = ?)", [JSON.stringify(['Electrònica > UnaBrancaMoltLlargaSenseEspaisPerProvar']), id]);
      return id;`);
    await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    await pagina.waitForTimeout(300);
    const m = await pagina.evaluate(() => { const f = document.querySelector('#full'), fr = f.getBoundingClientRect().right;
      const ample = [...f.querySelectorAll('*')].filter(x => x.getBoundingClientRect().right > fr + 1 && x.getBoundingClientRect().width > 0)
        .slice(0, 4).map(x => x.tagName.toLowerCase() + (x.className ? '.' + String(x.className).split(' ').join('.') : '') + ' ' + Math.round(x.getBoundingClientRect().width) + ' a ' + Math.round(x.getBoundingClientRect().left) + ' dins ' + (x.parentElement.className || x.parentElement.tagName) + ' «' + x.textContent.slice(0, 30) + '»');
      return { sw: f.scrollWidth, cw: f.clientWidth, dw: document.documentElement.scrollWidth, vw: innerWidth, ample }; });
    cal(m.sw <= m.cw + 1, `la fulla desborda: ${m.sw} > ${m.cw} (${m.ample.join(' · ')})`);
    cal(m.dw <= m.vw + 1, `la pàgina desborda: ${m.dw} > ${m.vw}`);
    await pagina.evaluate(() => document.querySelector('#fons')?.click());
    await fes(pagina, 'D.treu(arg)(db);', id);
  } },
];
