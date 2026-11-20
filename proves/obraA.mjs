// Les comprovacions de l'obra A (ACT-812, ACT-813): el proper i la fitxa. Bloc nou al final, en fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#peu:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const llegeix = (pagina, sql) => pagina.evaluate(async sql => { const A = await import('./js/arxiu.js?v=21');
  const r = A.estat.db.exec(sql)[0]; return r ? r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []; }, sql);
// Un artista preferent sense discos, amb un proper.
async function preferentAmbProper(pagina, nom, proper) {
  const r = await pagina.evaluate(async ([nom, proper]) => { const A = await import('./js/arxiu.js?v=21');
    return A.canvia(db => { db.run('INSERT INTO artista (nom_canonic) VALUES (?)', [nom]); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run('INSERT INTO preferent (artista_id, ordre, proper_titol) VALUES (?, 0, ?)', [ar, proper]); }); }, [nom, proper]);
  cal(r.desat, 'la preparació no s\'ha desat: ' + r.motiu);
}
async function posaAMa(pagina, art, tit, min) {
  await pagina.evaluate(() => document.querySelector('#btAfegeixDisc')?.click()); await pagina.waitForSelector('#full.obert #inArt');
  await pagina.fill('#inArt', art); await pagina.fill('#inTit', tit); await pagina.fill('#inMin', String(min));
  await pagina.click('#full [data-desaama]');
}

export const OBRA_A = [
  { bloc: 'obra A: el proper i la fitxa (ACT-812, ACT-813)' },
  { nom: 'proper (ACT-812, 1.1): normalitzat s\'esborra sol; un altre disc seu pregunta «Era aquest el proper?» i el Sí buida Preferent.proper_titol', async fes({ pagina, esperaDesat }) {
    await preferentAmbProper(pagina, 'Banc Proper U', 'this warm, this late');
    await preferentAmbProper(pagina, 'Banc Proper Dos', 'Silent Shores');
    await esperaDesat(); await reobre(pagina);
    await posaAMa(pagina, 'Banc Proper U', 'This Warm, This Late!', 41); await esperaDesat(); await pagina.waitForTimeout(700);
    igual(await pagina.locator('#full.obert [data-eraproper]').count(), 0, 'el títol que només canvia de majúscules i signes no pregunta');
    igual((await llegeix(pagina, "SELECT pr.proper_titol AS t FROM preferent pr JOIN artista ar ON ar.id = pr.artista_id WHERE ar.nom_canonic = 'Banc Proper U'"))[0]?.t, null, 'Preferent.proper_titol de Banc Proper U, normalitzat');
    await posaAMa(pagina, 'Banc Proper Dos', 'Silent Shores (Deluxe)', 52);
    await pagina.waitForSelector('#full.obert [data-eraproper]', { timeout: 5000 }).catch(() => {});
    cal((await pagina.locator('#full.obert').innerText().catch(() => '')).includes('Era aquest el proper?'), 'falta la pregunta «Era aquest el proper?»');
    await pagina.click('#full [data-eraproper]'); await esperaDesat();
    igual((await llegeix(pagina, "SELECT pr.proper_titol AS t FROM preferent pr JOIN artista ar ON ar.id = pr.artista_id WHERE ar.nom_canonic = 'Banc Proper Dos'"))[0]?.t, null, 'Preferent.proper_titol de Banc Proper Dos després del Sí');
  } },
  { nom: 'proper (ACT-812, 1.2 i 1.3): amb disc en rotació es pot triar el proper a mà; en sortir, «I ara, de X?» porta el proper primer i «Posa\'l en rotació» obre el disc nou amb el títol', async fes({ pagina, esperaDesat }) {
    await preferentAmbProper(pagina, 'Banc Proper Tres', null);
    await esperaDesat(); await reobre(pagina);
    await posaAMa(pagina, 'Banc Proper Tres', 'Primer Disc', 38); await esperaDesat();
    const pid = (await llegeix(pagina, "SELECT pr.id FROM preferent pr JOIN artista ar ON ar.id = pr.artista_id WHERE ar.nom_canonic = 'Banc Proper Tres'"))[0].id;
    const ed = (await llegeix(pagina, "SELECT e.id FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.titol = 'Primer Disc'"))[0].id;
    await reobre(pagina);
    await pagina.evaluate(() => document.querySelector('[data-sub="pref"]')?.click());
    await pagina.locator(`[data-artista="${pid}"]`).first().click(); await pagina.waitForSelector('#s-artista [data-triaproper]', { timeout: 5000 }).catch(() => {});
    igual(await pagina.locator('#s-artista [data-triaproper]').count(), 1, 'amb disc en rotació, «Tria el proper disc» a la pantalla de l\'artista');
    await pagina.click('#s-artista [data-triaproper]'); await pagina.waitForSelector('#inProper');
    await pagina.fill('#inProper', 'Segon Disc'); await pagina.click('#full [data-desaproper]'); await esperaDesat();
    await reobre(pagina);
    await pagina.locator(`[data-fitxa="${ed}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    await pagina.click('#full [data-treure]'); await pagina.waitForSelector('#full [data-punt]');
    await pagina.locator('#full [data-punt]').first().click();
    await pagina.waitForSelector('#full.obert [data-posaproper]', { timeout: 5000 }).catch(() => {});
    cal((await pagina.locator('#full.obert').innerText().catch(() => '')).includes('El proper: Segon Disc'), '«I ara, de X?» no porta el proper primer');
    igual(await pagina.locator('#full.obert [data-veisortida]').count(), 2, 'l\'anterior i el següent continuen');
    await pagina.click('#full [data-posaproper]'); await pagina.waitForSelector('#full.obert #inTit');
    igual(await pagina.inputValue('#inTit'), 'Segon Disc', '«Posa\'l en rotació» porta el títol del proper');
    igual(await pagina.inputValue('#inArt'), 'Banc Proper Tres', '«Posa\'l en rotació» porta l\'artista');
    igual(await pagina.locator('#full [data-buscaa]').count(), 1, 'falta «Busca-ho a [canal]»');
    await pagina.fill('#inMin', '44'); await pagina.click('#full [data-desaama]'); await esperaDesat(); await pagina.waitForTimeout(500);
    igual(await pagina.locator('#full.obert [data-eraproper]').count(), 0, 'el mateix títol no pregunta');
    igual((await llegeix(pagina, `SELECT proper_titol AS t FROM preferent WHERE id = ${pid}`))[0].t, null, 'Preferent.proper_titol després d\'entrar el proper');
  } },
  { nom: 'proper (ACT-812, 1.2 B): a la safata, un disc nou que és el proper d\'un preferent ho diu', async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), PR = await import('./js/proper.js?v=1');
      let o; await A.canvia(db => { db.run("INSERT INTO artista (nom_canonic, variants) VALUES ('Banc Proper Quatre', '[\"BPQ\"]')");
        const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO preferent (artista_id, ordre, proper_titol) VALUES (?, 0, 'Nit Clara')", [ar]);
        o = { si: PR.properDelDisc(db, 'bpq', 'NIT CLARA'), no: PR.properDelDisc(db, 'Banc Proper Quatre', 'Nit Fosca') }; });
      return o; });
    cal(r.si && r.si.proper === 'Nit Clara', 'el proper no es reconeix per variant i títol normalitzat');
    igual(r.no, null, 'un altre títol no és el proper');
    const codi = (await import('node:fs')).readFileSync(new URL('../js/faristol.js', import.meta.url), 'utf8');
    cal(codi.includes('És el proper de ${esc(pr.nom)}'), 'la targeta de disc nou no ho diu');
  } },
  { nom: 'fitxa (ACT-813): «Canvia els noms» canvia Àlbum.Títol, Edició.nom_edicio i Artista.nom_canonic, i el nom vell va a Artista.variants', async fes({ pagina, esperaDesat }) {
    const id = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
      let r; await A.canvia(db => { r = D.posaEnRotacio({ art: 'banc renom', tit: 'this warm, this late', min: 40, canal: 'amazon' })(db); }); return r.id; });
    await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert [data-canvianoms]');
    await pagina.click('#full [data-canvianoms]'); await pagina.waitForSelector('#inNomTit');
    await pagina.fill('#inNomTit', 'This Warm, This Late'); await pagina.fill('#inNomEd', 'Edició del banc'); await pagina.fill('#inNomArt', 'Banc Renom');
    await pagina.click('#full [data-desanoms]'); await esperaDesat();
    const f = (await llegeix(pagina, `SELECT a.titol, e.nom_edicio, ar.nom_canonic, ar.variants FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id WHERE e.id = ${id}`))[0];
    igual(f.titol, 'This Warm, This Late', 'Àlbum.Títol');
    igual(f.nom_edicio, 'Edició del banc', 'Edició.nom_edicio');
    igual(f.nom_canonic, 'Banc Renom', 'Artista.nom_canonic');
    cal(JSON.parse(f.variants || '[]').includes('banc renom'), 'el nom vell no és a Artista.variants: ' + f.variants);
    cal((await pagina.locator('#full.obert h3').first().innerText()).includes('This Warm, This Late'), 'després de desar no torna a la fitxa amb el títol nou');
    const e = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), PR = await import('./js/proper.js?v=1');
      let r; await A.canvia(db => { r = PR.canviaNoms(id, { artista: 'James Murray' })(db); }); return r; }, id).catch(() => null);
    cal(!e || e.error, 'el nom d\'un altre artista no es fon en silenci');
  } },
  { nom: 'franja (ACT-813, 2.1): afegir a una Pila des de la fitxa torna a la fitxa al moment, no quan acaba de desar; «Rajoles» es diu «← Tornar»', async fes() {
    const codi = (await import('node:fs')).readFileSync(new URL('../js/faristol.js', import.meta.url), 'utf8');
    cal(!/fes\([^;]*\)\.then\(\(\) => \{[^}]*fullFitxa/.test(codi), 'encara hi ha un fes(...).then(() => fullFitxa(...)): torna a la fitxa quan acaba de desar');
    cal(!codi.includes('‹ Rajoles') && codi.includes('data-rajoles="1">← Tornar'), 'el botó encara diu «Rajoles»');
  } },
];
