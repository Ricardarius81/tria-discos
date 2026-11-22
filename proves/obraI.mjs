// Les comprovacions de l'obra I — els comentaris de Ricard de la ACT-836 i l'estructura 13 (ACT-840 2). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#peu:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const alsSegells = async pagina => { await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="seg"]'); await pagina.waitForSelector('#a-seg.activa'); };
const posa = (pagina, art, tit) => pagina.evaluate(async ([art, tit]) => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
  let r; await A.canvia(db => { r = D.posaEnRotacio({ art, tit, min: 40, canal: 'amazon' })(db); }); return r.id; }, [art, tit]);
const obreFitxa = async (pagina, id) => { await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert'); };
// Un PNG d'un píxel, per al logo pujat a mà.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export const OBRA_I = [
  { bloc: 'obra I: els comentaris de la ACT-836 i l\'estructura 13 (ACT-840 2)' },
  { nom: 'estructura 13 (ACT-840 2, ACT-836 e): segell_preferent.retrat i Escolta.origen; en migrar, les escoltes amb pistes són «listenbrainz» i les de sense pistes «a mà»', sintetic: true, async fes({ pagina, consulta }) {
    cal(consulta('PRAGMA user_version')[0].user_version >= 13, 'estructura de l\'arxiu del Drive, 13 o més (la 14, obra II)');
    cal(consulta('PRAGMA table_info(segell_preferent)').some(c => c.name === 'retrat'), 'segell_preferent no té la columna retrat');
    cal(consulta('PRAGMA table_info(escolta)').some(c => c.name === 'origen'), 'Escolta no té la columna origen');
    const r = await pagina.evaluate(async () => {
      const { MIGRACIONS } = await import('./js/esquema.js?v=10');
      const SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f });
      const d = new SQL.Database(); MIGRACIONS.slice(0, 12).forEach((m, i) => { d.exec(m); d.exec(`PRAGMA user_version = ${i + 1}`); });
      d.run("INSERT INTO artista (id, nom_canonic) VALUES (1, 'A')"); d.run("INSERT INTO album (id, titol, artista_id) VALUES (1, 'T', 1)");
      d.run('INSERT INTO edicio (id, album_id, durada_total, rotacio_actual) VALUES (1, 1, 40, 0)');
      d.run("INSERT INTO escolta (id, edicio_id, data_hora, canal) VALUES (1, 1, '2026-11-01T10:00:00Z', 'App'), (2, 1, '2026-11-02T10:00:00Z', 'CD')");
      d.run("INSERT INTO scrobble (compte, listened_at, recording_msid, escolta_id) VALUES ('crimsonnnn', '2026-11-01T10:00:00Z', 'msid-banc-i', 1)");
      d.exec(MIGRACIONS[12]);
      const o = d.exec('SELECT id, origen FROM escolta ORDER BY id')[0].values; d.close(); return o;
    });
    igual(JSON.stringify(r), JSON.stringify([[1, 'listenbrainz'], [2, 'a mà']]), 'Escolta.origen després de migrar');
  } },
  { nom: 'escolta (ACT-840 2): el recàlcul escriu Escolta.origen = «listenbrainz» a les escoltes que fa amb pistes; cap escolta sense origen', sintetic: true, async fes({ consulta }) {
    const n = consulta('SELECT COUNT(*) AS n FROM escolta WHERE id IN (SELECT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)')[0].n;
    cal(n > 0, 'l\'arxiu sintètic havia de tenir escoltes amb pistes');
    igual(consulta("SELECT COUNT(*) AS n FROM escolta WHERE id IN (SELECT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL) AND origen = 'listenbrainz'")[0].n, n, 'escoltes amb pistes i origen «listenbrainz»');
    igual(consulta('SELECT COUNT(*) AS n FROM escolta WHERE origen IS NULL')[0].n, 0, 'escoltes sense Escolta.origen');
  } },
  { nom: 'piles (ACT-836 a): a Discos en Rotació la icona de cada Pila és un cercle ple del color de la Pila, amb el dibuix negre als colors clars i blanc als foscos (per luminància)', sintetic: true, async fes({ pagina, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista I', 'Banc Disc I');
    const cols = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), P = await import('./js/piles.js?v=1');
      await A.canvia(db => { while (P.piles(db).length < 6) P.creaPila('Banc Pila ' + P.piles(db).length, [])(db);
        const ps = P.piles(db), al = db.exec('SELECT album_id FROM edicio WHERE id = ' + id)[0].values[0][0];
        P.afegeix(ps[0].id, 'Banc Artista I', 'Banc Disc I', al)(db); P.afegeix(ps[5].id, 'Banc Artista I', 'Banc Disc I', al)(db); });
      const c = P.colorsPiles(A.estat.db), ps = P.piles(A.estat.db); return [c.get(ps[0].id), c.get(ps[5].id)]; }, id);
    igual(JSON.stringify(cols), JSON.stringify(['#3f9d5a', '#5d6e84']), 'els colors de la primera i la sisena Pila (verd i pissarra)');
    await esperaDesat(); await reobre(pagina);
    const st = await pagina.evaluate(id => [...document.querySelectorAll(`#reixa [data-fitxa="${id}"] .ico-pila i`)].map(i => { const s = getComputedStyle(i); return [s.backgroundColor, s.color]; }), id);
    igual(JSON.stringify(st), JSON.stringify([['rgb(63, 157, 90)', 'rgb(0, 0, 0)'], ['rgb(93, 110, 132)', 'rgb(255, 255, 255)']]), 'fons i color del dibuix de les icones (Pila.id → paleta)');
  } },
  { nom: 'marc (ACT-836 c): el disc d\'un segell preferent porta el marc de coure amb el fil fosc per fora; amb artista preferent, el daurat discontinu damunt de l\'anella de coure', sintetic: true, async fes({ pagina, esperaDesat }) {
    const a = await posa(pagina, 'Banc Artista Coure', 'Banc Disc Coure'), b = await posa(pagina, 'Banc Artista Pref Coure', 'Banc Disc Pref Coure');
    await pagina.evaluate(async ([a, b]) => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
      await A.canvia(db => { db.run("UPDATE edicio SET segell = 'Home Normal' WHERE id IN (?, ?)", [a, b]); D.afegeixPreferent('Banc Artista Pref Coure')(db); }); }, [a, b]);
    await esperaDesat(); await reobre(pagina);
    const st = await pagina.evaluate(ids => ids.map(id => { const c = document.querySelector(`#reixa [data-fitxa="${id}"].coberta`), s = getComputedStyle(c);
      return { o: s.outlineColor, e: s.outlineStyle, sh: s.boxShadow }; }), [a, b]);
    igual(st[0].o, 'rgb(184, 115, 51)', 'el color del marc (coure, abans platejat #C9CED6)');
    cal(/rgb\(4[0-9], 2[0-9], 1[0-9]\) 0px 0px 0px 3\.5px/.test(st[0].sh), 'el fil fosc per fora del coure: ' + st[0].sh);
    igual(st[1].e, 'dashed', 'amb artista preferent, el marc és discontinu');
    igual(st[1].o, 'rgb(226, 180, 74)', 'amb artista preferent, el discontinu és daurat');
    cal(st[1].sh.includes('rgb(184, 115, 51) 0px 0px 0px 2.5px'), 'amb artista preferent, l\'anella de coure sota el daurat: ' + st[1].sh);
  } },
  { nom: 'info (ACT-836 b): a la fitxa, «Info» és un botó rodó «i» a dalt a la dreta, fora de la llista de baix', sintetic: true, async fes({ pagina }) {
    const id = await posa(pagina, 'Banc Artista Info I', 'Banc Disc Info I'); await reobre(pagina); await obreFitxa(pagina, id);
    igual(await pagina.locator('#full .fitxa-cap button.info-i[data-info]').count(), 1, 'el botó «i» a la capçalera de la fitxa');
    igual((await pagina.locator('#full .fitxa-cap button.info-i').innerText()).trim(), 'i', 'el text del botó');
    igual(await pagina.locator('#full .fitxa-obra5 [data-info]').count(), 0, '«Info» ja no és a la llista de baix');
    const r = await pagina.evaluate(() => { const b = document.querySelector('#full .fitxa-cap .info-i').getBoundingClientRect(), c = document.querySelector('#full .fitxa-cap').getBoundingClientRect();
      return { dreta: c.right - b.right < 8, dalt: b.top - c.top < 8, rodo: getComputedStyle(document.querySelector('#full .fitxa-cap .info-i')).borderRadius }; });
    cal(r.dreta && r.dalt && r.rodo === '50%', 'el botó «i» havia de ser rodó i a dalt a la dreta: ' + JSON.stringify(r));
  } },
  { nom: 'segell a la fitxa (ACT-836 d): el desplegable porta només els Segells Preferents; «Un altre» l\'escriu només en aquesta edició, i amb «i fes-lo preferent» també el crea a dalt de segell_preferent', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista Seg I', 'Banc Disc Seg I'); await esperaDesat();
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'); await A.canvia(db => db.run("UPDATE edicio SET segell = 'Segell Només Arxiu' WHERE id = (SELECT MIN(id) FROM edicio WHERE id != ?)", [id])); }, id);
    await esperaDesat(); await reobre(pagina);
    const obre = async () => { await obreFitxa(pagina, id); await pagina.click(`#full [data-segellfitxa="${id}"]`); await pagina.waitForSelector('#selSegFitxa'); };
    await obre();
    const ops = await pagina.locator('#selSegFitxa option').allInnerTexts(), prefs = consulta('SELECT nom FROM segell_preferent ORDER BY ordre, id').map(r => r.nom);
    igual(JSON.stringify(ops.slice(1, -1)), JSON.stringify(prefs), 'les opcions del desplegable (segell_preferent.nom), entre «cap» i «Un altre»');
    cal(!ops.includes('Segell Només Arxiu'), 'un segell que només és a l\'arxiu no surt al desplegable');
    await pagina.selectOption('#selSegFitxa', 'Sonic Pieces'); await pagina.click(`#full [data-desasegellfitxa="${id}"]`); await esperaDesat();
    igual(consulta(`SELECT segell FROM edicio WHERE id = ${id}`)[0].segell, 'Sonic Pieces', 'Edició.segell triat del desplegable');
    await reobre(pagina); await obre();
    await pagina.selectOption('#selSegFitxa', '__altre'); await pagina.fill('#inSegFitxa', 'Banc Segell Lliure'); await pagina.click(`#full [data-desasegellfitxa="${id}"]`); await esperaDesat();
    igual(consulta(`SELECT segell FROM edicio WHERE id = ${id}`)[0].segell, 'Banc Segell Lliure', 'Edició.segell escrit a «Un altre»');
    igual(consulta('SELECT COUNT(*) AS n FROM segell_preferent')[0].n, prefs.length, 'sense la casella, no es fa preferent');
    await reobre(pagina); await obre();
    igual(await pagina.inputValue('#selSegFitxa'), '__altre', 'un segell que no és preferent obre el desplegable a «Un altre»');
    igual(await pagina.inputValue('#inSegFitxa'), 'Banc Segell Lliure', 'i porta el seu nom escrit');
    await pagina.fill('#inSegFitxa', 'Banc Segell Fet Pref'); await pagina.check('#chkSegPref'); await pagina.click(`#full [data-desasegellfitxa="${id}"]`); await esperaDesat();
    igual(consulta(`SELECT segell FROM edicio WHERE id = ${id}`)[0].segell, 'Banc Segell Fet Pref', 'Edició.segell amb la casella');
    igual(consulta('SELECT nom FROM segell_preferent ORDER BY ordre, id LIMIT 1')[0].nom, 'Banc Segell Fet Pref', 'amb la casella, entra a dalt de segell_preferent');
  } },
  { nom: 'logo (ACT-836 e): «Puja el logo» desa segell_preferent.retrat al Drive; la fila porta el logo a l\'esquerra i la portada del disc del segell al costat; sense logo, com avui', sintetic: true, async fes({ pagina, consulta, esperaDesat, fonts }) {
    const id = await posa(pagina, 'Banc Artista Logo', 'Banc Disc Logo'); await esperaDesat();
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'); await A.canvia(db => db.run("UPDATE edicio SET segell = 'Past Inside The Present', portada = 'release/banc-logo' WHERE id = ?", [id])); }, id);
    fonts.actiu = true; fonts.caa['release/banc-logo'] = 'imatge';
    try {
      await esperaDesat(); await reobre(pagina); await alsSegells(pagina);
      await pagina.locator('#segells [data-filasegell]', { hasText: 'Past Inside The Present' }).locator('[data-segell]').click(); await pagina.waitForSelector('#full.obert [data-seglogo]');
      await pagina.setInputFiles('#inLogo', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
      await pagina.waitForFunction(() => !document.querySelector('#full.obert'), null, { timeout: 10000 }); await esperaDesat();
      const t0 = Date.now(); let ref = null;
      while (!ref && Date.now() - t0 < 8000) { ref = consulta("SELECT retrat FROM segell_preferent WHERE nom = 'Past Inside The Present'")[0].retrat; if (!ref) { await pagina.waitForTimeout(200); await esperaDesat().catch(() => {}); } }
      cal(/^drive:/.test(ref || ''), 'segell_preferent.retrat havia de ser «drive:…»: ' + ref + ' · avís: ' + await pagina.locator('#avisTxt').innerText().catch(() => ''));
      await reobre(pagina); await alsSegells(pagina);
      const f = await pagina.evaluate(() => Object.fromEntries([...document.querySelectorAll('#segells [data-filasegell]')].map(r => [r.querySelector('.nom')?.textContent, {
        foto: r.querySelector('.foto img')?.dataset.ref || null, cob: r.querySelector('.cob-fila img')?.dataset.ref || null }])));
      igual(f['Past Inside The Present']?.foto, ref, 'la fila de Past Inside The Present porta el logo a l\'esquerra');
      igual(f['Past Inside The Present']?.cob, 'release/banc-logo', 'i la portada del disc del segell al costat');
      igual(f['Quiet Details']?.cob, null, 'un segell sense logo, com avui: sense portada al costat');
    } finally { fonts.actiu = false; delete fonts.caa['release/banc-logo']; }
  } },
];
