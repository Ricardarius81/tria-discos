// Les comprovacions de l'obra G — Segells Preferents (ACT-816, ACT-817, ACT-827, ACT-829). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#btInici:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const alsSegells = async pagina => { await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="seg"]'); await pagina.waitForSelector('#a-seg.activa'); };
const posa = (pagina, art, tit) => pagina.evaluate(async ([art, tit]) => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
  let r; await A.canvia(db => { r = D.posaEnRotacio({ art, tit, min: 40, canal: 'amazon' })(db); }); return r.id; }, [art, tit]);

export const OBRA_G = [
  { bloc: 'obra G: Segells Preferents (ACT-816, ACT-817, ACT-827)' },
  { nom: 'segells (estructura 12, 7.4): neixen els sis d\'entrada amb el seu id de Discogs, i la tercera pastilla de L\'Aparador els ensenya', sintetic: true, async fes({ pagina, consulta }) {
    const s = consulta('SELECT nom, discogs_id FROM segell_preferent ORDER BY ordre');
    igual(JSON.stringify(s.map(x => x.nom)), JSON.stringify(['Quiet Details', 'Home Normal', 'Sonic Pieces', 'Past Inside The Present', 'Dragon\'s Eye Recordings', 'A Strangely Isolated Place']), 'segell_preferent.nom');
    igual(s[1].discogs_id, 143072, 'segell_preferent.discogs_id de Home Normal');
    await alsSegells(pagina);
    igual(await pagina.locator('#segells [data-segell]').count(), 6, 'files a Segells Preferents');
  } },
  { nom: 'segells (7.2, 7.8): «Segell» a la fitxa desa Edició.segell; un disc en rotació d\'un segell preferent porta el marc platejat, i la fila del segell diu «Ara estudies»', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista G', 'Banc Disc G'); await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    await pagina.click(`#full [data-segellfitxa="${id}"]`); await pagina.selectOption('#selSegFitxa', 'Home Normal');   // obra I (ACT-836 d): el desplegable dels preferents
    await pagina.click(`#full [data-desasegellfitxa="${id}"]`); await esperaDesat();
    igual(consulta(`SELECT segell FROM edicio WHERE id = ${id}`)[0]?.segell, 'Home Normal', 'Edició.segell');
    await reobre(pagina);
    igual(await pagina.locator(`#reixa .disc.seg [data-fitxa="${id}"]`).count() > 0, true, 'el disc porta la classe seg (marc platejat)');
    await alsSegells(pagina);
    const t = await pagina.locator('#segells [data-filasegell]').nth(1).innerText();
    cal(t.includes('Ara estudies') && t.includes('Banc Disc G'), 'la fila de Home Normal havia de dir «Ara estudies Banc Disc G»: ' + JSON.stringify(t));
  } },
  { nom: 'segells (7.3, ACT-829): l\'anterior i el següent pel número de darrere de qualsevol prefix, segons MusicBrainz; «Posa\'l de proper» desa segell_preferent.proper_*, i en entrar en rotació la nota s\'esborra', sintetic: true, async fes({ pagina, consulta, esperaDesat, fonts }) {
    fonts.actiu = true;
    const r = (title, artist, cat) => ({ title, 'artist-credit': [{ name: artist }], 'label-info': [{ label: { id: 'mb-banc-hn' }, 'catalog-number': cat }] });
    fonts.mb.segells['Home Normal'] = { id: 'mb-banc-hn', releases: [r('Banc Lluny', 'X', 'homen300'), r('Banc Disc G', 'Banc Artista G', 'homen226'),
      r('Banc Anterior', 'Banc Abans', 'H|N043'), r('Banc Següent', 'Banc Altre', 'no.230'), r('Banc Sense', 'Y', null)] };
    await alsSegells(pagina);
    await pagina.locator('#segells [data-segell]').nth(1).click(); await pagina.waitForSelector('#full.obert');
    await pagina.click('#full [data-segvei]');
    await pagina.waitForSelector('#full [data-segposaproper]', { timeout: 15000 }).catch(() => {});
    const t = await pagina.locator('#full').innerText();
    cal(/Anterior: Banc Anterior/.test(t) && /Següent ▶: Banc Següent/.test(t) && /226/.test(t), 'anterior (43) i següent (230) des del 226: ' + JSON.stringify(t.slice(0, 400)));
    await pagina.locator('#full [data-segposaproper]').nth(1).click(); await esperaDesat();
    const p = consulta(`SELECT proper_artista, proper_titol FROM segell_preferent WHERE nom = 'Home Normal'`)[0];
    igual(JSON.stringify(p), JSON.stringify({ proper_artista: 'Banc Altre', proper_titol: 'Banc Següent' }), 'segell_preferent.proper_artista i proper_titol');
    await posa(pagina, 'Banc Altre', 'Banc Següent'); await esperaDesat();
    igual(consulta(`SELECT proper_titol FROM segell_preferent WHERE nom = 'Home Normal'`)[0]?.proper_titol, null, 'el proper s\'esborra en entrar en rotació');
  } },
  { nom: 'segells (7.1): «＋ Afegeix un segell» n\'afegeix un a dalt; un nom repetit no entra', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await alsSegells(pagina);
    await pagina.click('#btAfegeixSegell'); await pagina.fill('#inSegell', 'Banc Segell Nou'); await pagina.click('#full [data-desasegell]'); await esperaDesat();
    const s = consulta('SELECT nom FROM segell_preferent ORDER BY ordre, id');
    igual(s[0]?.nom, 'Banc Segell Nou', 'el segell nou va a dalt (segell_preferent.ordre)');
    await pagina.click('#btAfegeixSegell'); await pagina.fill('#inSegell', 'home normal'); await pagina.click('#full [data-desasegell]'); await pagina.waitForTimeout(600);
    igual(consulta('SELECT COUNT(*) AS n FROM segell_preferent')[0].n, 7, 'un nom repetit no entra');
  } },
  { nom: 'segells (7.7, 7.2): la cinquena columna del full de codis porta el segell, i el de MusicBrainz entra només de l\'edició exacta; cap dels dos no trepitja Edició.segell', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const a = await posa(pagina, 'Banc Artista G2', 'Banc Disc G2'), b = await posa(pagina, 'Banc Artista G3', 'Banc Disc G3'); await esperaDesat();
    const r = await pagina.evaluate(async ([a, b]) => {
      const A = await import('./js/arxiu.js?v=21'), CB = await import('./js/codibc.js?v=1'), SG = await import('./js/segells.js?v=1');
      const f = A.filesDeCodis(`clau,codi,data,url,segell\nE${a},111,2026-11-21T01:30:00Z,https://x.bandcamp.com/album/y,Sonic Pieces\nE${b},222,2026-11-21T01:30:00Z,https://z.bandcamp.com/album/w,`);
      await A.canvia(db => { db.run('UPDATE edicio SET segell = ? WHERE id = ?', ['Ja en té', b]); CB.aplicaCodisV(f)(db); });
      let mb1, mb2;
      await A.canvia(db => { db.run('UPDATE edicio SET segell = NULL WHERE id = ?', [b]);
        mb1 = SG.segellDeMB(b, 'rel-a', { release: 'rel-b', segell: 'De la cerca' })(db);
        mb2 = SG.segellDeMB(b, 'rel-b', { release: 'rel-b', segell: 'Quiet Details' })(db); });
      return { seg: f.map(x => x.segell), mb1, mb2 };
    }, [a, b]);
    igual(JSON.stringify(r.seg), JSON.stringify(['Sonic Pieces', '']), 'filesDeCodis: la columna segell');
    await esperaDesat();
    igual(consulta(`SELECT segell FROM edicio WHERE id = ${a}`)[0]?.segell, 'Sonic Pieces', 'Edició.segell des del full de codis');
    igual(r.mb1, false, 'una edició de MusicBrainz que no és l\'exacta no posa segell');
    igual(consulta(`SELECT segell FROM edicio WHERE id = ${b}`)[0]?.segell, 'Quiet Details', 'Edició.segell des de l\'edició exacta de MusicBrainz');
  } },
];
