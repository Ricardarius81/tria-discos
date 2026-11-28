// Les comprovacions de l'obra B (ACT-814 (3), ACT-817, ACT-818): el codi de Bandcamp a la fitxa i el marcador.
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function espera(pagina) {
  await pagina.waitForSelector('#btInici:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
}
async function reobre(pagina) {
  await pagina.reload(); await espera(pagina);
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const llegeix = (pagina, sql) => pagina.evaluate(async sql => { const A = await import('./js/arxiu.js?v=21');
  const r = A.estat.db.exec(sql)[0]; return r ? r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []; }, sql);
async function discBc(pagina, titol, codi = null, enllac = null) {
  return pagina.evaluate(async ([titol, codi, enllac]) => {
    const A = await import('./js/arxiu.js?v=21'); let id;
    await A.canvia(db => {
      db.run("INSERT INTO artista (nom_canonic) VALUES ('Banc Obra B')"); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [titol, ar]); const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run("INSERT INTO edicio (album_id, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio, codi_bandcamp, enllac_bandcamp) VALUES (?, 40, 1, 'bandcamp', '[]', ?, ?, ?)", [al, new Date().toISOString(), codi, enllac]);
      id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    });
    return id;
  }, [titol, codi, enllac]);
}

export const OBRA_B = [
  { bloc: 'obra B: el codi de Bandcamp a la fitxa i el marcador (ACT-814, ACT-817, ACT-818)' },
  { nom: 'codi (ACT-814, 3.1): la fitxa d\'un disc de Bandcamp amb codi porta «Codi de Bandcamp · canvia\'l», i un número hi entra al moment (Edició.codi_bandcamp)', async fes({ pagina, esperaDesat }) {
    const id = await discBc(pagina, 'Banc Amb Codi', '1111111111', 'https://banc.bandcamp.com/album/amb-codi');
    await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    cal((await pagina.locator('#full .linia-bc').innerText().catch(() => '')).includes('1111111111'), 'falta la línia «Codi de Bandcamp» amb el codi');
    await pagina.click('#full [data-codibc]'); await pagina.waitForSelector('#full #inEnllacBc');
    cal((await pagina.locator('#full #txtMarcador').inputValue()).startsWith('javascript:'), 'falta el marcador a la fulla del codi');
    await pagina.fill('#inEnllacBc', '2222222222'); await pagina.click('#full [data-desaenllac]'); await esperaDesat();
    igual((await llegeix(pagina, `SELECT codi_bandcamp AS c FROM edicio WHERE id = ${id}`))[0].c, '2222222222', 'Edició.codi_bandcamp després d\'enganxar el número');
  } },
  { nom: 'codi (ACT-814, 3.2): un enllaç nou en una edició amb codi treu el codi al moment; la línia de pendents porta la versió i una fila de la versió vella no torna a posar el codi vell', async fes({ pagina, esperaDesat }) {
    const id = await discBc(pagina, 'Banc Canvi', '3333333333', 'https://banc.bandcamp.com/album/vella');
    await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    await pagina.click('#full [data-codibc]'); await pagina.waitForSelector('#full #inEnllacBc');
    await pagina.fill('#inEnllacBc', 'Mira https://altre.bandcamp.com/album/bona?from=share'); await pagina.click('#full [data-desaenllac]'); await esperaDesat();
    const f = (await llegeix(pagina, `SELECT codi_bandcamp AS c, enllac_bandcamp AS u FROM edicio WHERE id = ${id}`))[0];
    igual(f.c, null, 'Edició.codi_bandcamp després de l\'enllaç nou');
    igual(f.u, 'https://altre.bandcamp.com/album/bona', 'Edició.enllac_bandcamp');
    const o = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), CB = await import('./js/codibc.js?v=1');
      const out = { clau: CB.clauAmbVersio(A.estat.db, 'E' + id) };
      await A.canvia(db => { CB.aplicaCodisV([{ clau: 'E' + id, codi: '3333333333', data: '2026-11-01T00:00:00Z' }])(db);
        out.vella = db.exec('SELECT codi_bandcamp FROM edicio WHERE id = ' + id)[0].values[0][0];
        CB.aplicaCodisV([{ clau: 'E' + id + '.2', codi: '4444444444', data: '2026-11-21T00:00:00Z' }])(db);
        out.nova = db.exec('SELECT codi_bandcamp FROM edicio WHERE id = ' + id)[0].values[0][0]; });
      return out; }, id);
    igual(o.clau, 'E' + id + '.2', 'la clau de la línia de pendents porta la versió');
    igual(o.vella, null, 'una fila de la versió vella no torna a posar el codi vell');
    igual(o.nova, '4444444444', 'la fila de la versió nova posa el codi nou');
    await esperaDesat();
  } },
  { nom: 'codi (ACT-814, 3.3): si la tasca deixa «repte», la fitxa ho diu', async fes({ pagina, esperaDesat }) {
    const id = await discBc(pagina, 'Banc Repte');
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), CB = await import('./js/codibc.js?v=1');
      await A.canvia(db => CB.aplicaCodisV([{ clau: 'E' + id, codi: 'repte', data: '2026-11-21T01:30:00Z' }])(db)); }, id);
    await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    cal((await pagina.locator('#full').innerText()).includes('té un repte'), 'la fitxa no diu que la pàgina té un repte');
    igual((await llegeix(pagina, `SELECT codi_bandcamp AS c FROM edicio WHERE id = ${id}`))[0].c, null, '«repte» no és un codi');
  } },
  { nom: 'marcador (ACT-817): l\'app oberta amb ?bc=…&enllac=… posa el codi al disc d\'aquest enllaç, i si no n\'hi ha cap, pregunta de quin disc és', async fes({ pagina, esperaDesat }) {
    const a = await discBc(pagina, 'Banc Marcador U', null, 'https://banc.bandcamp.com/album/marcador-u');
    const b = await discBc(pagina, 'Banc Marcador Dos');
    await esperaDesat();
    const base = pagina.url().split('?')[0].split('#')[0];
    await pagina.goto(base + '?bc=5555555555&enllac=' + encodeURIComponent('https://banc.bandcamp.com/album/marcador-u')); await espera(pagina); await esperaDesat();
    igual((await llegeix(pagina, `SELECT codi_bandcamp AS c FROM edicio WHERE id = ${a}`))[0].c, '5555555555', 'el codi del marcador al disc del mateix enllaç');
    cal(!(await pagina.evaluate(() => location.search)).includes('bc='), 'l\'adreça es queda amb el codi');
    await pagina.goto(base + '?bc=6666666666&enllac=' + encodeURIComponent('https://altre.bandcamp.com/album/res')); await espera(pagina);
    await pagina.waitForSelector(`#full.obert [data-marcadorde="${b}"]`, { timeout: 5000 });
    await pagina.click(`#full [data-marcadorde="${b}"]`); await esperaDesat();
    const f = (await llegeix(pagina, `SELECT codi_bandcamp AS c, enllac_bandcamp AS u FROM edicio WHERE id = ${b}`))[0];
    igual(f.c, '6666666666', 'el codi del marcador al disc triat');
    igual(f.u, 'https://altre.bandcamp.com/album/res', 'l\'enllaç del marcador al disc triat');
  } },
  { nom: 'marcador (ACT-818): el text del marcador és JavaScript vàlid, llegeix bc-page-properties i obre la Discoteca', async fes({ pagina }) {
    const t = await pagina.evaluate(async () => (await import('./js/codibc.js?v=1')).textMarcador('https://ricardarius81.github.io/tria-discos/'));
    cal(t.startsWith('javascript:'), 'no comença per javascript:');
    try { new Function(t.slice('javascript:'.length)); } catch (e) { throw new Error('el marcador no és JavaScript vàlid: ' + e.message); }
    cal(t.includes('bc-page-properties') && t.includes("tria-discos/?bc='+id"), 'el marcador no llegeix la pàgina o no obre la Discoteca');
  } },
];
