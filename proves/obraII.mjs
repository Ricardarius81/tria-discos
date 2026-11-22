// Les comprovacions de l'obra II — l'escolta a mà (ACT-839, ACT-840), el físic per Escolta.canal (ACT-837) i els resums
// desats a la seva fitxa (ACT-841 4). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#peu:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const posa = (pagina, art, tit, min = 40) => pagina.evaluate(async ([art, tit, min]) => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
  let r; await A.canvia(db => { r = D.posaEnRotacio({ art, tit, min, canal: 'amazon' })(db); }); return r.id; }, [art, tit, min]);
const obreFullMa = async (pagina, id) => {
  await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
  await pagina.click(`#full [data-escoltesfitxa="${id}"]`); await pagina.click(`#full [data-escoltama="${id}"]`); await pagina.waitForSelector('#selCanalMa');
};
const ms = iso => new Date(iso).getTime();

export const OBRA_II = [
  { bloc: 'obra II: l\'escolta a mà, el físic per canal i els resums (ACT-839, ACT-840, ACT-841 4)' },
  { nom: 'escolta a mà (ACT-839, ACT-840 2): «Apunta una escolta» des de les escoltes de la fitxa crea l\'escolta sense ListenBrainz: CD, inici «ara menys la durada», disc sencer, origen «a mà», context i atenció', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista Ma', 'Banc Disc Ma', 50); await esperaDesat(); await reobre(pagina);
    await obreFullMa(pagina, id);
    const ops = await pagina.locator('#selCanalMa option').evaluateAll(o => o.map(x => x.value));
    igual(JSON.stringify(ops), JSON.stringify(['CD', 'vinil', 'streaming']), 'els canals de l\'escolta a mà (sense «tele»)');
    const ini = await pagina.inputValue('#inIniciMa');
    const esperat = Date.now() - 50 * 60000, llegit = new Date(ini).getTime();
    cal(Math.abs(llegit - esperat) < 3 * 60000, `l'inici per defecte havia de ser ara menys 50′: ${ini}`);
    await pagina.selectOption('#selCanalMa', 'CD'); await pagina.selectOption('#selCtxMa', 'Escolta activa');
    await pagina.click(`#full [data-desaescoltama="${id}"]`); await esperaDesat();
    const e = consulta(`SELECT canal, origen, completitud, context, atencio, unio, compte, data_hora FROM escolta WHERE edicio_id = ${id}`);
    igual(e.length, 1, 'escoltes del disc');
    igual(JSON.stringify([e[0].canal, e[0].origen, e[0].completitud, e[0].context, e[0].atencio, e[0].unio, e[0].compte]),
      JSON.stringify(['CD', 'a mà', 1, 'Escolta activa', 'Efectes plens', null, null]), 'Escolta.canal, origen, completitud, context, atencio, unio i compte');
    cal(Math.abs(ms(e[0].data_hora) - llegit) < 60000, 'Escolta.data_hora és l\'inici de la fulla: ' + e[0].data_hora);
    await reobre(pagina);
    igual(await pagina.locator('#reixa .disc').first().locator(`[data-fitxa="${id}"]`).count() > 0, true, 'el disc puja a dalt de Discos en Rotació');
    const r = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15'); const x = E.escoltesDeLEdicio(A.estat.db, id); return { c: x.compten, f: x.escoltes[0]?.fisica }; }, id);
    igual(JSON.stringify(r), JSON.stringify({ c: 1, f: true }), 'compta com una escolta, i és física (CD)');
  } },
  { nom: 'escolta a mà (ACT-839): amb streaming es tria el canal d\'escolta (Escolta.canal), l\'inici es pot canviar, i no és física', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista Ma2', 'Banc Disc Ma2', 30); await esperaDesat(); await reobre(pagina);
    await obreFullMa(pagina, id);
    await pagina.selectOption('#selCanalMa', 'streaming'); await pagina.waitForSelector('#selAppMa', { state: 'visible' });
    const apps = await pagina.locator('#selAppMa option').evaluateAll(o => o.map(x => x.value));
    cal(['amazon', 'youtube', 'bandcamp', 'aimp'].every(a => apps.includes(a)), 'els quatre canals coneguts: ' + apps.join(','));
    igual(await pagina.inputValue('#selAppMa'), 'amazon', 'per defecte, el canal del disc (Edició.App d\'escolta)');
    await pagina.selectOption('#selAppMa', 'youtube'); await pagina.fill('#inIniciMa', '2026-11-15T21:30');
    await pagina.selectOption('#selCtxMa', 'A casa'); await pagina.click('#full [data-atencioma="Dormint"]');
    await pagina.click(`#full [data-desaescoltama="${id}"]`); await esperaDesat();
    const e = consulta(`SELECT canal, origen, atencio, data_hora FROM escolta WHERE edicio_id = ${id}`)[0];
    igual(JSON.stringify([e.canal, e.origen, e.atencio]), JSON.stringify(['youtube', 'a mà', 'Dormir']), 'Escolta.canal, origen i atencio');
    igual(ms(e.data_hora), new Date('2026-11-15T21:30').getTime(), 'Escolta.data_hora canviada a mà');
    igual(consulta(`SELECT app_escolta FROM edicio WHERE id = ${id}`)[0].app_escolta, 'amazon', 'triar el canal de l\'escolta no canvia el del disc');
    const f = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15'); return E.escoltesDeLEdicio(A.estat.db, id).escoltes[0]?.fisica; }, id);
    igual(f, false, 'una escolta d\'streaming a mà no és física');
  } },
  { nom: 'escolta a mà (ACT-840 2): si ja hi ha una escolta de ListenBrainz del disc a prop d\'aquesta hora, avisa i no l\'apunta fins que es confirma', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista Dup', 'Banc Disc Dup', 40); await esperaDesat();
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21');
      await A.canvia(db => db.run("INSERT INTO escolta (edicio_id, data_hora, canal, completitud, origen) VALUES (?, ?, 'App', 1, 'listenbrainz')", [id, new Date(Date.now() - 45 * 60000).toISOString()])); }, id);
    await esperaDesat(); await reobre(pagina); await obreFullMa(pagina, id);
    await pagina.selectOption('#selCtxMa', 'Treballant'); await pagina.click(`#full [data-desaescoltama="${id}"]`);
    await pagina.waitForSelector('#avisDupMa', { state: 'visible' });
    igual(consulta(`SELECT COUNT(*) AS n FROM escolta WHERE edicio_id = ${id} AND origen = 'a mà'`)[0].n, 0, 'sense confirmar, no s\'apunta');
    await pagina.click(`#full [data-desaescoltama="${id}"][data-forca]`); await esperaDesat();
    igual(consulta(`SELECT COUNT(*) AS n FROM escolta WHERE edicio_id = ${id} AND origen = 'a mà'`)[0].n, 1, 'confirmada, s\'apunta');
  } },
  { nom: 'físic per canal (ACT-837, ACT-840 2): el recompte escolta_fisica de les còpies compta Escolta.canal CD o vinil, no les escoltes sense pistes', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), C = await import('./js/copies.js?v=6'); const db = A.estat.db;
      const q = s => db.exec(s)[0].values[0][0];
      return { n: C.recomptes(db).escolta_fisica, canal: q("SELECT COUNT(*) FROM escolta WHERE canal IN ('CD', 'vinil')"), senseP: q('SELECT COUNT(*) FROM escolta WHERE id NOT IN (SELECT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)') }; });
    cal(r.senseP > r.canal, 'el banc havia de tenir escoltes sense pistes que no són físiques: ' + JSON.stringify(r));
    igual(r.n, r.canal, 'escolta_fisica (Escolta.canal)');
  } },
  { nom: 'canviar l\'edició (ACT-837): les escoltes apuntades a mà (Escolta.origen) es mouen a l\'altra edició, també les d\'streaming; les de ListenBrainz es tornen a calcular', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const de = consulta("SELECT e.id FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.titol = 'Banc Disc Ma2'")[0].id;
    const a = await pagina.evaluate(async de => { const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15');
      let nova; await A.canvia(db => { const al = db.exec('SELECT album_id FROM edicio WHERE id = ' + de)[0].values[0][0];
        db.run("INSERT INTO edicio (album_id, durada_total, rotacio_actual, nom_edicio) VALUES (?, 30, 0, 'Banc Altra Edició')", [al]);
        nova = db.exec('SELECT last_insert_rowid()')[0].values[0][0]; E.canviaEdicio({ de, a: nova, correccio: true })(db); }); return nova; }, de);
    await esperaDesat();
    igual(consulta(`SELECT COUNT(*) AS n FROM escolta WHERE edicio_id = ${a} AND origen = 'a mà' AND canal = 'youtube'`)[0].n, 1, 'l\'escolta d\'streaming a mà, a l\'edició nova');
  } },
  { nom: 'resums (ACT-841 4): «desaResums» guarda a la fitxa el release de MusicBrainz i l\'última pista de cada edició, i l\'última escolta i les portades de cada Llista; sense les pistes, la pantalla els continua tenint', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const ed = consulta('SELECT x.edicio_id AS id, MAX(p.listened_at) AS t FROM scrobble p JOIN escolta x ON x.id = p.escolta_id GROUP BY x.edicio_id ORDER BY t DESC LIMIT 1')[0];
    cal(!!ed, 'cal una edició amb pistes');
    const r = await pagina.evaluate(async ([id, t]) => {
      const A = await import('./js/arxiu.js?v=21'), R = await import('./js/resums.js?v=1'), D = await import('./js/dades.js?v=25'), L = await import('./js/llistes.js?v=1'), SG = await import('./js/segells.js?v=1');
      const db = A.estat.db;
      let llista;
      await A.canvia(db => {
        db.run("UPDATE scrobble SET caa_release_mbid = 'rel-banc-ii' WHERE escolta_id IN (SELECT id FROM escolta WHERE edicio_id = ?)", [id]);
        db.run("INSERT INTO llista (nom, data_alta) VALUES ('Banc Llista II', ?)", [new Date().toISOString()]);
        llista = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        const s = db.exec('SELECT recording_msid FROM scrobble WHERE escolta_id IN (SELECT id FROM escolta WHERE edicio_id = ' + id + ') LIMIT 1')[0].values[0][0];
        db.run("INSERT INTO llista_canco (llista_id, posicio, recording_msid, artista, pista) VALUES (?, 1, ?, 'x', 'y')", [llista, s]);
        db.run('UPDATE scrobble SET llista_id = ? WHERE recording_msid = ?', [llista, s]);
        R.desaResums(db);
      });
      const abans = { e: db.exec(`SELECT release_mbid, darrer_scrobble FROM edicio WHERE id = ${id}`)[0].values[0], l: db.exec(`SELECT darrera_escolta, portades FROM llista WHERE id = ${llista}`)[0].values[0] };
      // Les pistes se'n van (com al fitxer d'any de l'obra III): la pantalla ha de continuar sabent-ho.
      await A.canvia(db => { db.run('UPDATE scrobble SET escolta_id = NULL, llista_id = NULL WHERE escolta_id IN (SELECT id FROM escolta WHERE edicio_id = ?) OR llista_id = ?', [id, llista]); });
      const fx = D.fitxa(db, id), ll = L.llistes(db).find(x => x.id === llista);
      return { abans, clau: fx.clau, rel: SG.releaseDeLEdicio(db, id), darrera: ll.darrera, portades: ll.portades };
    }, [ed.id, ed.t]);
    igual(r.abans.e[0], 'rel-banc-ii', 'Edició.release_mbid');
    igual(r.abans.e[1], ed.t, 'Edició.darrer_scrobble');
    igual(r.abans.l[0] !== null, true, 'Llista.darrera_escolta');
    igual(r.abans.l[1], JSON.stringify(['release/rel-banc-ii']), 'Llista.portades');
    cal(r.clau >= ed.t, 'l\'ordre de Discos en Rotació continua comptant l\'última pista desada: ' + r.clau);
    igual(r.rel, 'rel-banc-ii', 'el release de l\'edició (Info i segell) sense les pistes');
    igual(r.darrera, r.abans.l[0], 'l\'última escolta de la Llista sense les pistes');
    igual(JSON.stringify(r.portades), JSON.stringify(['release/rel-banc-ii']), 'les portades de la Llista sense les pistes');
    await esperaDesat();
  } },
];
