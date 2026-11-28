// Les comprovacions de l'obra C (ACT-809, ACT-810, ACT-814 (4)): branques noves i Piles a la vista. Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#btInici:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const llegeix = (pagina, sql) => pagina.evaluate(async sql => { const A = await import('./js/arxiu.js?v=21');
  const r = A.estat.db.exec(sql)[0]; return r ? r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []; }, sql);
async function disc(pagina, art, tit, subgeneres = null) {
  return pagina.evaluate(async ([art, tit, subgeneres]) => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
    let r; await A.canvia(db => { r = D.posaEnRotacio({ art, tit, min: 40, canal: 'amazon' })(db);
      if (subgeneres) db.run("UPDATE album SET generes = '[\"Ambient\"]', subgeneres = ? WHERE id = (SELECT album_id FROM edicio WHERE id = ?)", [JSON.stringify(subgeneres), r.id]); });
    return r.id; }, [art, tit, subgeneres]);
}
async function obreGenere(pagina, id) {
  await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert [data-generefitxa]');
  await pagina.click('#full [data-generefitxa]'); await pagina.waitForSelector('#full [data-altrabranca]');
}
const branca = async (pagina, nom) => { await pagina.click('#full [data-altrabranca]'); await pagina.fill('#inBranca', nom); await pagina.click('#full [data-desabranca]'); };

export const OBRA_C = [
  { bloc: 'obra C: branques noves i Piles a la vista (ACT-809, ACT-810, ACT-814)' },
  { nom: 'branques (ACT-809, ACT-810 a): «＋ Altra branca» crea una branca nova a Àlbum.Gènere; «Electrónica» és Electrònica', async fes({ pagina, esperaDesat }) {
    const id = await disc(pagina, 'Banc Branca', 'Banc Branca U');
    await esperaDesat(); await reobre(pagina); await obreGenere(pagina, id);
    await branca(pagina, 'Electrónica'); await esperaDesat();
    await branca(pagina, 'Dungeon Synth'); await esperaDesat();
    const g = JSON.parse((await llegeix(pagina, `SELECT a.generes FROM edicio e JOIN album a ON a.id = e.album_id WHERE e.id = ${id}`))[0].generes);
    igual(JSON.stringify(g), JSON.stringify(['Electrònica', 'Dungeon Synth']), 'Àlbum.Gènere amb una de les 26 escrita diferent i una de nova');
    cal(await pagina.locator('#full [data-renombranca="Dungeon Synth"]').count() === 1, 'la branca nova no porta el ✎');
    cal(await pagina.locator('#full [data-renombranca="Electrònica"]').count() === 0, 'una de les 26 no porta ✎');
  } },
  { nom: 'branques (ACT-809 b): si el nom ja és un subgènere, s\'avisa i «Crea-la igualment» la crea', async fes({ pagina, esperaDesat }) {
    await disc(pagina, 'Banc Sub', 'Amb Drone', ['Drone']);
    const id = await disc(pagina, 'Banc Sub', 'Sense Res');
    await esperaDesat(); await reobre(pagina); await obreGenere(pagina, id);
    await branca(pagina, 'drone');
    await pagina.waitForSelector('#full [data-brancaigualment]', { timeout: 5000 });
    cal((await pagina.locator('#full').innerText()).includes('ja és un subgènere'), 'falta l\'avís del subgènere');
    await pagina.click('#full [data-brancaigualment]'); await esperaDesat();
    const g = JSON.parse((await llegeix(pagina, `SELECT a.generes FROM edicio e JOIN album a ON a.id = e.album_id WHERE e.id = ${id}`))[0].generes);
    igual(g.length, 1, 'Àlbum.Gènere després de «Crea-la igualment»');
  } },
  { nom: 'branques (ACT-809 a, ACT-810 c): el ✎ canvia el nom a tots els àlbums i fon; la branca nova surt a Per Gènere i, sense discos, desapareix', async fes({ pagina, esperaDesat }) {
    const o = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25'), BR = await import('./js/branques.js?v=1'), F = await import('./js/afinacio.js?v=4');
      const out = {};
      await A.canvia(db => {
        const a = D.posaEnRotacio({ art: 'Banc Ren', tit: 'R1', min: 40, canal: 'amazon' })(db), b = D.posaEnRotacio({ art: 'Banc Ren', tit: 'R2', min: 40, canal: 'amazon' })(db);
        const al = id => db.exec('SELECT album_id FROM edicio WHERE id = ' + id)[0].values[0][0];
        F.desaGenere(al(a.id), { generes: ['Synthwave'], llenguatge: [], formacio: [], instrument: '' })(db);
        F.desaGenere(al(b.id), { generes: ['Retrowave', 'Ambient'], llenguatge: [], formacio: [], instrument: '' })(db);
        out.abans = BR.branquesNoves(db);
        out.r = BR.reanomenaBranca('Retrowave', 'synth-wave')(db);
        out.despres = BR.branquesNoves(db);
        out.b = JSON.parse(db.exec('SELECT generes FROM album WHERE id = ' + al(b.id))[0].values[0][0]);
        F.desaGenere(al(a.id), { generes: ['Ambient'], llenguatge: [], formacio: [], instrument: '' })(db);
        F.desaGenere(al(b.id), { generes: ['Ambient'], llenguatge: [], formacio: [], instrument: '' })(db);
        out.buides = BR.branquesNoves(db);
      });
      return out; });
    cal(o.abans.includes('Retrowave') && o.abans.includes('Synthwave'), 'branques noves abans: ' + JSON.stringify(o.abans));
    cal(o.r.fos && o.r.nom === 'Synthwave' && o.r.albums === 1, 'el ✎ no ha fos «synth-wave» amb Synthwave: ' + JSON.stringify(o.r));
    cal(!o.despres.includes('Retrowave') && o.despres.includes('Synthwave'), 'branques noves després del ✎: ' + JSON.stringify(o.despres));
    igual(JSON.stringify(o.b), JSON.stringify(['Synthwave', 'Ambient']), 'Àlbum.Gènere de l\'àlbum fos');
    cal(!o.buides.includes('Synthwave') && !o.buides.includes('Retrowave'), 'una branca sense cap disc desapareix: ' + JSON.stringify(o.buides));
    const codi = (await import('node:fs')).readFileSync(new URL('../js/rajoles.js', import.meta.url), 'utf8');
    cal(!codi.includes('BRANQUES'), 'Per Gènere fa servir una llista fixa de branques');
    await esperaDesat();
  } },
  { nom: 'Piles (ACT-814, 4.1 i 4.2): un color per Pila per ordre (Gimnàs verd, Avió/Tren/Bus blau, Cotxe lila), trac 2.1, portada de les casades i inicials de les de text', async fes({ pagina, esperaDesat, fonts }) {
    const o = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), P = await import('./js/piles.js?v=1');
      const db = A.estat.db, ps = P.piles(db), c = P.colorsPiles(db);
      return { noms: ps.map(p => p.nom), colors: ps.map(p => c.get(p.id)), fig: P.figura('Gimnàs', '#3f9d5a') }; });
    igual(JSON.stringify(o.noms.slice(0, 3)), JSON.stringify(['Gimnàs', 'Avió/Tren/Bus', 'Cotxe']), 'les tres Piles de sortida');
    igual(JSON.stringify(o.colors.slice(0, 3)), JSON.stringify(['#3f9d5a', '#3d7fd6', '#8f6cc8']), 'verd, blau i lila');
    cal(o.fig.includes('stroke-width="2.1"') && o.fig.includes('color:#3f9d5a'), 'la figura no porta el trac ni el color: ' + o.fig.slice(0, 160));
    const id = await disc(pagina, 'Banc Pila', 'Casada Amb Pila');
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), P = await import('./js/piles.js?v=1');
      await A.canvia(db => { const pila = P.piles(db)[0].id, al = db.exec('SELECT album_id FROM edicio WHERE id = ' + id)[0].values[0][0];
        db.run("UPDATE edicio SET portada = 'release/banc-pila' WHERE id = ?", [id]);
        P.afegeix(pila, 'Banc Pila', 'Casada Amb Pila', al)(db); P.afegeix(pila, 'Ningú', 'Text Sol Pila', null)(db); }); }, id);
    fonts.actiu = true; fonts.caa['release/banc-pila'] = 'imatge';
    try {
    await esperaDesat(); await reobre(pagina);
    await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="esc"]').catch(() => {}); await pagina.waitForTimeout(250);
    const f = await pagina.evaluate(() => [...document.querySelectorAll('#piles .pila-fila')].map(r => ({ t: r.querySelector('.txt b')?.textContent, text: !!r.querySelector('.cob-pila.text'), ini: r.querySelector('.cob-pila.text')?.textContent || null, img: r.querySelector('.cob-pila img')?.dataset.ref || null })));
    const cas = f.find(x => x.t === 'Casada Amb Pila'), txt = f.find(x => x.t === 'Text Sol Pila');
    cal(cas && cas.img === 'release/banc-pila', 'l\'entrada casada no porta la portada del disc: ' + JSON.stringify(cas));
    cal(txt && txt.text && txt.ini === 'TS', 'l\'entrada de text no porta les inicials de l\'àlbum: ' + JSON.stringify(txt));
    } finally { fonts.actiu = false; delete fonts.caa['release/banc-pila']; }
  } },
];
