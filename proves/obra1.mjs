// Les comprovacions de l'obra 1 (ACT-763 a ACT-768): un bloc nou al final de la llista, en fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function espera(cond, msg, max = 10000) { const t = Date.now(); while (!(await cond())) { if (Date.now() - t > max) throw new Error(msg); await new Promise(r => setTimeout(r, 150)); } }
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#btInici:not([hidden])', { timeout: 10000 });
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
  // ───────── la ratificació de l'obra 1 (ACT-790 a ACT-796) i la ACT-804 ─────────
  { nom: 'Bandcamp (ACT-790): les nits es compten de calendari (canvis de dia), no de 24 hores; a la tercera, apartat', async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const B = await import('./js/bandcamp.js?v=1');
      const t = (d, h) => new Date(2026, 10, d, h, 0).getTime();
      return { n: B.NITS, mateixDia: B.nitsEntre(new Date(t(10, 20)).toISOString(), t(10, 23)), duesNits: B.nitsEntre(new Date(t(10, 20)).toISOString(), t(12, 23)),
               abansDeLaTasca: B.nitsEntre(new Date(t(10, 23)).toISOString(), t(13, 1)), tresNits: B.nitsEntre(new Date(t(10, 23)).toISOString(), t(13, 7)) }; });
    igual(r.n, 3, 'NITS');
    igual(r.mateixDia, 0, 'el mateix dia');
    igual(r.duesNits, 2, 'del dia 10 a les 20 h al dia 12 a les 23 h');
    igual(r.abansDeLaTasca, 2, 'del dia 10 a les 23 h al dia 13 a la 1 h: la passada de la 1:30 encara compta');
    igual(r.tresNits, 3, 'del dia 10 a les 23 h al dia 13 a les 7 h');
  } },
  { nom: 'Bandcamp (ACT-791, ACT-793 c): un enllaç de segell amb domini propi s\'accepta; a Android el ▶ prova l\'app de Bandcamp (intent amb el paquet) i, si no, el navegador', async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const B = await import('./js/bandcamp.js?v=1');
      const u = 'https://musica.unsello.com/album/x';
      return { segell: B.llegeixEnllac('Mira: ' + u + '?from=share'), and: B.hrefEnllac(u, 'Mozilla/5.0 (Linux; Android 14; SM-S918B)'), pc: B.hrefEnllac(u, 'Mozilla/5.0 (X11; Linux x86_64)') }; });
    igual(r.segell, 'https://musica.unsello.com/album/x', 'l\'enllaç d\'un segell amb domini propi');
    cal(r.and.startsWith('intent://musica.unsello.com/album/x#Intent;') && r.and.includes('scheme=https') && r.and.includes('package=com.bandcamp.android')
      && r.and.includes('S.browser_fallback_url=' + encodeURIComponent('https://musica.unsello.com/album/x')), 'a Android: ' + r.and);
    igual(r.pc, 'https://musica.unsello.com/album/x', 'fora d\'Android, l\'enllaç tal qual');
  } },
  { nom: 'rotació (ACT-793 a): ajust únic, els discos que han estat en rotació i ja no hi són prenen la data d\'ara a Edició.data_referencia_rotacio; els que mai hi han estat, no; i no es repeteix', async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'); const J = await import('./js/arreglos.js?v=1');
      const viu = J.ajust793Fet(A.estat.db);   // l'app ja l'ha fet en connectar
      const db = new A.estat.db.constructor(A.estat.db.export()); db.run('DELETE FROM meta WHERE clau = ?', [J.AJUST_793]);
      db.run("INSERT INTO artista (nom_canonic) VALUES ('Banc Ajust')"); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      const ed = (tit, rot, ref) => { db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [tit, ar]); const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO edicio (album_id, durada_total, rotacio_actual, emparellaments, data_referencia_rotacio) VALUES (?, 40, ?, '[]', ?)", [al, rot, ref]); return db.exec('SELECT last_insert_rowid()')[0].values[0][0]; };
      const vell = '2026-01-01T00:00:00.000Z', fora = ed('Fora', 0, vell), dins = ed('Dins', 1, vell), mai = ed('Mai', 0, null);
      const ref = id => db.exec('SELECT data_referencia_rotacio FROM edicio WHERE id = ' + id)[0].values[0][0];
      const abans = J.ajust793Fet(db), n = J.ajusta793(db), despres = J.ajust793Fet(db), refFora = ref(fora);
      db.run('UPDATE edicio SET data_referencia_rotacio = ? WHERE id = ?', [vell, fora]); const n2 = J.ajust793Fet(db) ? 'no torna' : J.ajusta793(db);
      const out = { viu, abans, despres, n: n >= 1, fora: refFora > '2026-11-01', dins: ref(dins), mai: ref(mai), n2 }; db.close(); return out; });
    igual(r.viu, true, 'l\'app ha fet l\'ajust en connectar (marca a meta)');
    igual(r.abans, false, 'abans de l\'ajust, la marca a meta'); igual(r.despres, true, 'després, la marca a meta');
    cal(r.n, 'l\'ajust no ha tocat cap disc'); cal(r.fora, 'el disc que va sortir de la rotació no pren la data d\'ara');
    igual(r.dins, '2026-01-01T00:00:00.000Z', 'el disc en rotació'); igual(r.mai, null, 'el disc que mai ha estat en rotació');
    igual(r.n2, 'no torna', 'l\'ajust es torna a fer');
  } },
  { nom: 'Agrupacions (ACT-792): s\'ordenen per l\'última escolta de qualsevol dels seus discos (Escolta.data_hora), no per Edició.data_referencia_rotacio', async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'); const D = await import('./js/dades.js?v=25');
      const db = new A.estat.db.constructor(A.estat.db.export());
      db.run("INSERT INTO artista (nom_canonic) VALUES ('Banc Grups')"); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      const h = d => new Date(Date.now() - d * 864e5).toISOString();
      const disc = (tit, grup, ref, esc) => { db.run('INSERT INTO album (titol, artista_id, conjunt) VALUES (?, ?, ?)', [tit, ar, grup]); const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO edicio (album_id, durada_total, rotacio_actual, emparellaments, data_referencia_rotacio) VALUES (?, 40, 0, '[]', ?)", [al, ref]);
        const e = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        if (esc) db.run("INSERT INTO escolta (edicio_id, data_hora, completitud, atencio) VALUES (?, ?, 1, 'Efectes plens')", [e, esc]); };
      disc('Ga1', 'Grup escoltat', h(30), h(0.1)); disc('Ga2', 'Grup escoltat', h(30), null);
      disc('Gb1', 'Grup tret', h(0), h(5)); disc('Gb2', 'Grup tret', h(30), null);
      const noms = D.grupsArxiu(db).map(g => g.nom).filter(n => n.startsWith('Grup ')); db.close(); return noms; });
    igual(JSON.stringify(r), JSON.stringify(['Grup escoltat', 'Grup tret']), 'l\'ordre dels grups');
  } },
  { nom: 'L\'Afinació (ACT-796): el punt es calcula en obrir l\'arxiu i després d\'un canvi seu, no a cada repintat (una lectura automàtica, navegar)', async fes({ pagina, obreSafata }) {
    const n = () => pagina.evaluate(() => +(document.getElementById('afiPunt')?.dataset.calculs || 0));
    await reobre(pagina); await pagina.waitForTimeout(400);
    const c0 = await n(); cal(c0 >= 1, 'en obrir, el punt no s\'ha calculat');
    await obreSafata(); await pagina.waitForTimeout(600); await pagina.click('[data-tornasafata]');
    await pagina.evaluate(() => document.querySelector('[data-anar=\"prestatgeria\"]').click()); await pagina.evaluate(() => document.querySelector('[data-anar=\"faristol\"]').click()); await pagina.click('[data-sub="hist"]'); await pagina.click('[data-sub="rot"]');
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'); document.dispatchEvent(new Event('visibilitychange')); });
    await pagina.waitForTimeout(500);
    igual(await n(), c0, 'càlculs del punt després de llegir ListenBrainz i navegar');
  } },
  { nom: 'preferents (ACT-804 b): canviar l\'ordre amb el desplegable (A-Z, Darrera escolta) carrega les fotos de les files', async fes({ pagina, esperaDesat }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21');
      return A.canvia(db => db.run("UPDATE artista SET retrat = 'release/fals-retrat-banc' WHERE id IN (SELECT artista_id FROM preferent)")); });
    cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat();
    await reobre(pagina);
    await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="pref"]'); await pagina.waitForTimeout(300);
    const n = () => pagina.evaluate(() => document.querySelectorAll('#files img[data-ref]:not([src])').length);
    for (const o of ['az', 'escolta']) {
      await pagina.selectOption('#ordrePref', o);
      cal(await pagina.locator('#files img[data-ref]').count() > 0, 'les files no porten cap foto per carregar (' + o + ')');
      await espera(async () => (await n()) === 0, `amb l'ordre «${o}» hi ha fotos que no es carreguen mai`, 5000);
    }
  } },
  { nom: 'preferents (ACT-804 b): amb un ordre que no és Manual, després de tancar i obrir l\'app les fotos hi són', async fes({ pagina }) {
    await pagina.evaluate(() => localStorage.setItem('tria-ordre-preferents', 'za'));
    await reobre(pagina);
    await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="pref"]'); await pagina.waitForTimeout(300);
    igual(await pagina.locator('#ordrePref').inputValue(), 'za', 'l\'ordre recordat');
    await espera(async () => (await pagina.evaluate(() => document.querySelectorAll('#files img[data-ref]:not([src])').length)) === 0, 'després de recarregar amb «Z-A», hi ha fotos que no es carreguen', 5000);
    await pagina.selectOption('#ordrePref', 'manual'); await pagina.click('[data-sub="rot"]');
  } },
  { nom: 'fitxa (ACT-804 a): entre «▶ Escoltar ara» i «Afegeix a una Pila» hi ha aire (10 px o més), també amb «Enganxa l\'enllaç» al mig', sintetic: true, async fes({ pagina, esperaDesat }) {
    const mesura = () => pagina.evaluate(() => {
      const bot = [...document.querySelectorAll('#full .fitxa-accions .bt')].reduce((m, b) => Math.max(m, b.getBoundingClientRect().bottom), 0);
      const pila = document.querySelector('#full [data-afegeixapila]')?.getBoundingClientRect().top, bc = document.querySelector('#full .enllac-bc');
      return { pila: pila - bot, bc: bc ? { dalt: bc.getBoundingClientRect().top - bot, baix: pila - bc.getBoundingClientRect().bottom } : null }; });
    await pagina.locator('#reixa [data-fitxa]').first().click(); await pagina.waitForSelector('#full [data-afegeixapila]', { timeout: 5000 });
    const a = await mesura(); await tancaFull(pagina);
    cal(!a.bc && a.pila >= 10, 'sense «Enganxa l\'enllaç»: ' + JSON.stringify(a));
    const r = await discBandcamp(pagina, 'Aire Obra U'); cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat(); await reobre(pagina);
    await pagina.evaluate(id => document.querySelector(`#reixa [data-fitxa="${id}"]`)?.click(), r.id); await pagina.waitForSelector('#inEnllacBc', { timeout: 5000 });
    const b = await mesura(); await tancaFull(pagina);
    cal(b.bc && b.bc.dalt >= 10 && b.bc.baix >= 10, 'amb «Enganxa l\'enllaç»: ' + JSON.stringify(b));
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
  { nom: 'Bandcamp (ACT-767): «Enganxa l\'enllaç» desa Edició.enllac_bandcamp, el ▶ l\'obre al moment i el fitxer de pendents el porta; un enllaç sense /album/ ni /track/ no es desa', sintetic: true, async fes({ pagina, drive, consulta, esperaDesat }) {
    const troba = nom => [...drive.fitxers.values()].find(f => f.name === nom && !f.trashed);
    const r = await discBandcamp(pagina, 'Anon Obra U');
    cal(r.desat, 'no s\'ha desat: ' + r.motiu); await esperaDesat(); await reobre(pagina);
    const id = r.id;
    await pagina.evaluate(id => document.querySelector(`#reixa [data-fitxa="${id}"]`)?.click(), id);
    await pagina.waitForSelector('#inEnllacBc', { timeout: 5000 });
    await pagina.fill('#inEnllacBc', 'https://example.com/res/xyz');
    await pagina.click(`[data-desaenllac="${id}"]`); await pagina.waitForTimeout(300);
    igual(consulta('SELECT enllac_bandcamp AS e FROM edicio WHERE id = ?', [id])[0].e, null, 'un enllaç sense /album/ ni /track/ a Edició.enllac_bandcamp');
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
  { nom: 'Bandcamp (ACT-766): un disc sense codi en 3 nits de calendari (ACT-790) surt del fitxer de pendents, s\'avisa una vegada i la fitxa ho diu; enganxar l\'enllaç el torna a posar', sintetic: true, async fes({ pagina, drive, consulta, esperaDesat }) {
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
    // una nit de calendari: encara hi va; tres: apartat (ACT-790)
    const n1 = await pagina.evaluate(async id => { const B = await import('./js/bandcamp.js?v=1'), A = await import('./js/arxiu.js?v=21');
      return B.pendentsAmbNits(A.estat.db, Date.now() + 864e5).envia.some(x => x.clau === 'E' + id); }, id);
    igual(n1, true, 'a la primera nit, el disc encara va al fitxer');
    const w = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21');
      return A.canvia(db => db.run('UPDATE meta SET valor = ? WHERE clau = ?', [JSON.stringify({ des: new Date(Date.now() - 3.05 * 864e5).toISOString() }), 'bc-nits:E' + id])); }, id);
    cal(w.desat, 'no s\'ha desat: ' + w.motiu); await esperaDesat();
    await reobre(pagina);
    await espera(() => !text().includes(`E${id} |`), 'el disc de tres nits encara surt als pendents: ' + JSON.stringify(text()), 12000);
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
