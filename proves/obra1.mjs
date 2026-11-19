// Les comprovacions de l'obra 1 (ACT-763 a ACT-768): un bloc nou al final de la llista, en fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function espera(cond, msg, max = 10000) { const t = Date.now(); while (!(await cond())) { if (Date.now() - t > max) throw new Error(msg); await new Promise(r => setTimeout(r, 150)); } }
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#peu:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const tancaFull = pagina => pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); });
// Un disc de Bandcamp sense codi, en rotació, fet a mà.
async function discBandcamp(pagina, titol) {
  return pagina.evaluate(async titol => {
    const A = await import('./js/arxiu.js?v=21'); let id;
    const r = await A.canvia(db => {
      db.run("INSERT INTO artista (nom_canonic) VALUES ('Banc Obra U')"); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [titol, ar]); const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run("INSERT INTO edicio (album_id, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio) VALUES (?, 40, 1, 'bandcamp', '[]', ?)", [al, new Date().toISOString()]);
      id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    });
    return { ...r, id };
  }, titol);
}

export const OBRA1 = [
  { bloc: 'obra 1: arreglos i Bandcamp (ACT-763 a ACT-768)' },
  { nom: 'rotació (ACT-763, ACT-764): l\'oferta d\'entrar demana cinc escoltes; entrar per l\'oferta i treure a mà reescriuen Edició.data_referencia_rotacio', sintetic: true, async fes({ pagina }) {
    const o = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15'), D = await import('./js/dades.js?v=25');
      const dia = n => new Date(Date.now() - n * 864e5).toISOString(), out = {}; let id;
      const q = db => E.preguntesRotacio(db).filter(x => x.id === id).map(x => x.q);
      const ref = db => db.exec('SELECT data_referencia_rotacio FROM edicio WHERE id = ?', [id])[0].values[0][0];
      const esc = (db, n) => db.run("INSERT INTO escolta (edicio_id, data_hora, canal, context, atencio, completitud) VALUES (?, ?, 'CD', 'Escolta activa', 'Efectes plens', 1)", [id, dia(n)]);
      const r = await A.canvia(db => {
        db.run("INSERT INTO artista (nom_canonic) VALUES ('Banc Cinc Escoltes')"); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO album (titol, artista_id) VALUES ('Cinc Escoltes', ?)", [ar]); const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO edicio (album_id, durada_total, rotacio_actual, formats, data_referencia_rotacio) VALUES (?, 40, 0, '[\"CD\"]', ?)", [al, dia(40)]);
        id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        for (const n of [20, 19, 18, 17]) esc(db, n);
        out.quatre = q(db);
        esc(db, 16); out.cinc = q(db);
        E.respon7(id, true)(db); out.refEntrar = ref(db); out.despresEntrar = q(db);
        db.run('UPDATE edicio SET data_referencia_rotacio = ? WHERE id = ?', [dia(40), id]); out.ambRefVella = q(db);
        D.treu(id)(db); out.refTreure = ref(db); out.despresTreure = q(db);
      });
      return { ...out, desat: r.desat, motiu: r.motiu, ara: Date.now() };
    });
    cal(o.desat, 'no s\'ha desat: ' + o.motiu);
    igual(JSON.stringify(o.quatre), '[]', 'amb quatre escoltes, l\'oferta d\'entrar (pregunta 7)');
    igual(JSON.stringify(o.cinc), '[7]', 'amb cinc escoltes, l\'oferta d\'entrar');
    cal(o.ara - Date.parse(o.refEntrar) < 60e3, 'entrar per l\'oferta no reescriu la Data de referència de rotació: ' + o.refEntrar);
    igual(JSON.stringify(o.despresEntrar), '[]', 'just després d\'entrar, «ja el dones per estudiat?» no surt amb les mateixes cinc escoltes');
    igual(JSON.stringify(o.ambRefVella), '[8]', 'en rotació, cinc escoltes (una d\'Escolta activa) des de la data: «ja el dones per estudiat?» (ACT-765, construïda)');
    cal(o.ara - Date.parse(o.refTreure) < 60e3, 'treure a mà no reescriu la Data de referència de rotació (Cobham): ' + o.refTreure);
    igual(JSON.stringify(o.despresTreure), '[]', 'just després de treure\'l, l\'oferta d\'entrar per les escoltes velles');
    const codi = (await import('node:fs')).readFileSync(new URL('../js/faristol.js', import.meta.url), 'utf8');
    cal(codi.includes('Cinc escoltes en sis mesos') && !codi.includes('Tres escoltes en sis mesos'), 'la targeta de l\'oferta encara diu «Tres escoltes»');
  } },
  { nom: 'preferents (ACT-768 b): l\'estrella del preferent va davant de l\'artista, no del títol', async fes({ pagina }) {
    const r = await pagina.evaluate(() => {
      const d = document.createElement('div'); d.className = 'reixa';
      d.innerHTML = '<div class="disc pref"><button class="nom-sota"><span><b>Títol</b><i>Artista</i></span></button></div>';
      document.getElementById('s-faristol').appendChild(d);
      const b = getComputedStyle(d.querySelector('b'), '::before').content, i = getComputedStyle(d.querySelector('i'), '::before').content;
      d.remove(); return { b, i };
    });
    cal(r.i.includes('★'), 'l\'artista no porta l\'estrella: ' + r.i);
    cal(!r.b.includes('★'), 'el títol encara porta l\'estrella: ' + r.b);
  } },
  { nom: 'preferents (ACT-768 d): a «Ordena la llista» les fotos es carreguen igual (cap img queda per omplir)', async fes({ pagina, esperaDesat }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21');
      return A.canvia(db => db.run("UPDATE artista SET retrat = 'release/fals-retrat-banc' WHERE id IN (SELECT artista_id FROM preferent)")); });
    cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat();
    await reobre(pagina);
    await pagina.click('[data-sub="pref"]'); await pagina.waitForTimeout(300);
    await pagina.click('#btOrdena'); await pagina.waitForTimeout(200);
    const n = () => pagina.evaluate(() => document.querySelectorAll('#files img[data-ref]:not([src])').length);
    await espera(async () => (await n()) === 0, 'a «Ordena la llista» hi ha fotos que no es carreguen mai', 5000);
    await pagina.click('#btOrdena'); await esperaDesat();
    await pagina.click('[data-sub="rot"]');
  } },
  { nom: 'fitxa (ACT-768 c): cap fitxa és més ampla que la pantalla, tampoc amb un títol llarg sense espais ni amb «Enganxa l\'enllaç»', sintetic: true, async fes({ pagina, esperaDesat }) {
    const r = await discBandcamp(pagina, 'Untitled_Composition_Number_Seventeen_For_Prepared_Piano_And_Electronics_Remastered');
    cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat(); await reobre(pagina);
    const ids = await pagina.evaluate(() => [...new Set([...document.querySelectorAll('#reixa [data-fitxa]')].map(b => b.dataset.fitxa))]);
    const mals = [];
    for (const id of ids) {
      await pagina.evaluate(id => document.querySelector(`#reixa [data-fitxa="${id}"]`)?.click(), id);
      await pagina.waitForSelector('#full.obert', { timeout: 5000 }); await pagina.waitForTimeout(150);
      const m = await pagina.evaluate(() => { const f = document.getElementById('full'), dr = f.getBoundingClientRect().right;
        const fora = [...f.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width && e.getBoundingClientRect().right > dr + 1)
          .slice(0, 3).map(e => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + ' ' + Math.round(e.getBoundingClientRect().right - dr) + 'px');
        return { sobra: f.scrollWidth - f.clientWidth, vw: innerWidth, fr: Math.round(dr), fora }; });
      if (m.sobra > 1 || m.fr > m.vw + 1 || m.fora.length) mals.push(`disc ${id}: ${JSON.stringify(m)}`);
      await tancaFull(pagina); await pagina.waitForTimeout(100);
    }
    cal(!mals.length, 'fitxes més amples que la pantalla: ' + mals.slice(0, 3).join(' | '));
  } },
  { nom: 'Bandcamp (ACT-767): «Enganxa l\'enllaç» desa Edició.enllac_bandcamp, el ▶ l\'obre al moment i el fitxer de pendents el porta; un enllaç que no és de Bandcamp no es desa', sintetic: true, async fes({ pagina, drive, consulta, esperaDesat }) {
    const troba = nom => [...drive.fitxers.values()].find(f => f.name === nom && !f.trashed);
    const r = await discBandcamp(pagina, 'Anon Obra U');
    cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat(); await reobre(pagina);
    const id = r.id;
    await pagina.evaluate(id => document.querySelector(`#reixa [data-fitxa="${id}"]`)?.click(), id);
    await pagina.waitForSelector('#inEnllacBc', { timeout: 5000 });
    await pagina.fill('#inEnllacBc', 'https://open.spotify.com/album/xyz');
    await pagina.click(`[data-desaenllac="${id}"]`); await pagina.waitForTimeout(300);
    igual(consulta('SELECT enllac_bandcamp AS e FROM edicio WHERE id = ?', [id])[0].e, null, 'un enllaç de Spotify a Edició.enllac_bandcamp');
    await pagina.fill('#inEnllacBc', 'Escolta Anon 1 de 36 a Bandcamp: https://pitp.bandcamp.com/album/anon-1?from=share');
    await pagina.click(`[data-desaenllac="${id}"]`); await esperaDesat();
    igual(consulta('SELECT enllac_bandcamp AS e FROM edicio WHERE id = ?', [id])[0].e, 'https://pitp.bandcamp.com/album/anon-1', 'Edició.enllac_bandcamp');
    await tancaFull(pagina);
    const href = await pagina.evaluate(id => document.querySelector(`#reixa a.escoltar[data-obre="${id}"]`)?.getAttribute('href'), id);
    igual(href, 'https://pitp.bandcamp.com/album/anon-1', 'el ▶ del disc a Discos en Rotació');
    await reobre(pagina);
    const linia = `E${id} | Banc Obra U | Anon Obra U | https://pitp.bandcamp.com/album/anon-1`;
    await espera(() => troba('tria-discos-bustia-pendents.txt')?.bytes.toString('utf8').includes(linia), 'el fitxer de pendents no porta l\'enllaç: ' + JSON.stringify(troba('tria-discos-bustia-pendents.txt')?.bytes.toString('utf8')), 12000);
  } },
  { nom: 'Bandcamp (ACT-766): un disc sense codi en 7 nits surt del fitxer de pendents, s\'avisa una vegada i la fitxa ho diu; enganxar l\'enllaç el torna a posar', sintetic: true, async fes({ pagina, drive, consulta, esperaDesat }) {
    const troba = nom => [...drive.fitxers.values()].find(f => f.name === nom && !f.trashed);
    const text = () => troba('tria-discos-bustia-pendents.txt')?.bytes.toString('utf8') || '';
    const r = await discBandcamp(pagina, 'Mare Obra U');
    cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat();
    const id = r.id;
    await reobre(pagina);
    await espera(() => text().includes(`E${id} |`), 'el disc nou no surt als pendents', 12000);
    await esperaDesat();
    const des = JSON.parse(consulta('SELECT valor FROM meta WHERE clau = ?', ['bc-nits:E' + id])[0]?.valor || '{}').des;
    cal(des && Date.now() - Date.parse(des) < 120e3, 'la data del primer cop als pendents no s\'apunta: ' + des);
    // sis nits: encara hi va; set: apartat
    const n6 = await pagina.evaluate(async id => { const B = await import('./js/bandcamp.js?v=1'), A = await import('./js/arxiu.js?v=21');
      return B.pendentsAmbNits(A.estat.db, Date.now() + 6.5 * 864e5).envia.some(x => x.clau === 'E' + id); }, id);
    igual(n6, true, 'a les sis nits, el disc encara va al fitxer');
    const w = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21');
      return A.canvia(db => db.run('UPDATE meta SET valor = ? WHERE clau = ?', [JSON.stringify({ des: new Date(Date.now() - 7.2 * 864e5).toISOString() }), 'bc-nits:E' + id])); }, id);
    cal(w.desat, 'no s\'ha desat: ' + w.motiu); await esperaDesat();
    await reobre(pagina);
    await espera(() => !text().includes(`E${id} |`), 'el disc de set nits encara surt als pendents: ' + JSON.stringify(text()), 12000);
    await esperaDesat();
    const m = JSON.parse(consulta('SELECT valor FROM meta WHERE clau = ?', ['bc-nits:E' + id])[0]?.valor || 'null');
    igual(m?.avisat, true, 'l\'avís dels apartats queda apuntat (una sola vegada)');
    await pagina.evaluate(id => document.querySelector(`#reixa [data-fitxa="${id}"]`)?.click(), id);
    await pagina.waitForSelector('#inEnllacBc', { timeout: 5000 });
    cal((await pagina.locator('#full').innerText()).includes('Bandcamp no l\'ha trobat'), 'la fitxa no diu que Bandcamp no l\'ha trobat');
    await pagina.fill('#inEnllacBc', 'https://banc.bandcamp.com/album/mare-obra-u');
    await pagina.click(`[data-desaenllac="${id}"]`); await esperaDesat(); await tancaFull(pagina);
    await reobre(pagina);
    await espera(() => text().includes(`E${id} | Banc Obra U | Mare Obra U | https://banc.bandcamp.com/album/mare-obra-u`), 'amb l\'enllaç, el disc no torna als pendents: ' + JSON.stringify(text()), 12000);
    await esperaDesat();
  } },
  { nom: 'safata (ACT-768 a): la durada escrita d\'un disc nou es queda en triar-ne el canal', sintetic: true, async fes({ pagina, obreSafata }) {
    // quatre pistes d'un disc que no és a l'arxiu, de fa 26 hores (lluny de les altres), escrita directament a l'arxiu
    const w = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21');
      const t0 = Date.now() - 26 * 3600e3;
      return A.canvia(db => { for (let i = 0; i < 4; i++) db.run(`INSERT INTO scrobble (compte, listened_at, artista, pista, album, duration_ms, recording_msid, estat)
        VALUES ('crimsonnnnfeina', ?, 'Banc Obra Nou', ?, 'Disc Nou Obra U', ?, ?, 'pendent')`, [new Date(t0 + i * 10 * 60e3).toISOString(), 'Pista ' + i, 10 * 60e3, 'msid-obra1-nou-' + i]); }); });
    cal(w.desat, 'no s\'ha desat: ' + w.motiu);
    await reobre(pagina);
    await obreSafata();
    const clau = async () => pagina.evaluate(() => [...document.querySelectorAll('[data-sfdur]')].map(i => i.dataset.sfdur).find(k => /obra/i.test(k)) || null);
    await espera(async () => !!(await clau()), 'el disc nou no surt a la safata', 12000).catch(async e => {
      throw new Error(e.message + ': ' + (await pagina.evaluate(() => document.getElementById('safataCos')?.innerText.replace(/\s+/g, ' ').slice(-700)))); });
    const k = await clau();
    await pagina.fill(`[data-sfdur="${k}"]`, '33');
    const chip = await pagina.evaluate(k => [...document.querySelectorAll('[data-sfcanal]')].find(b => b.dataset.sfcanal.startsWith(k + '|') && !b.classList.contains('triat'))?.dataset.sfcanal, k);
    cal(chip, 'no hi ha cap altre canal per triar');
    await pagina.click(`[data-sfcanal="${chip}"]`); await pagina.waitForTimeout(200);
    igual(await pagina.inputValue(`[data-sfdur="${k}"]`), '33', 'la durada escrita, després de triar el canal');
    igual(await pagina.evaluate(c => document.querySelector(`[data-sfcanal="${c}"]`)?.classList.contains('triat'), chip), true, 'el canal triat');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
];
