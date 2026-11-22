// Les comprovacions de l'obra IV — els comentaris de la ACT-848, decidits a la ACT-849. Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#peu:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const alsSegells = async pagina => { await pagina.click('[data-anar="faristol"]'); await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="seg"]'); await pagina.waitForSelector('#a-seg.activa'); };
const nomsSegells = pagina => pagina.locator('#segells .fila .nom').allInnerTexts();
const posa = (pagina, art, tit) => pagina.evaluate(async ([art, tit]) => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
  let r; await A.canvia(db => { r = D.posaEnRotacio({ art, tit, min: 40, canal: 'amazon' })(db); }); return r.id; }, [art, tit]);
const CA = new Intl.Collator('ca', { sensitivity: 'base', numeric: true });

export const OBRA_IV = [
  { bloc: 'obra IV: llistes, Agrupacions, l\'ordre dels segells i «＋ Preferent» (ACT-848, ACT-849)' },
  { nom: 'llistes (ACT-849 a): en escriure el nom surten les llistes que ja hi ha (llista.nom); un toc posa el nom i «Desa-la» hi afegeix, sense fer-ne una de bessona', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    // Una llista que ja existeix, amb una cançó que no és de la sessió (no arriba a 3: no la proposa sola).
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21');
      await A.canvia(db => { db.run("INSERT INTO llista (nom, data_alta) VALUES ('AA Händel', '2026-11-01T10:00:00Z')");
        const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO llista_canco (llista_id, posicio, recording_msid, pista, artista, durada_ms) VALUES (?, 1, 'msid-banc-iv-x', 'Banc', 'Händel', 180000)", [id]); }); });
    await esperaDesat();
    const t0 = Date.now() - (8 * 60 + 20) * 60e3, m = 60e3;
    const c = (i, t, nom, album) => ({ compte: 'crimsonnnn', listened_at: Math.floor(t / 1000), recording_msid: 'msid-banc-iv' + i,
      track_metadata: { artist_name: 'Händel', track_name: nom, release_name: album, additional_info: { duration_ms: 3 * m } } });
    lb.escoltes.push(c(1, t0, 'Ombra mai fù', 'Serse (Aria)'), c(2, t0 + 3 * m, 'Lascia ch\'io pianga', 'Rinaldo (Aria)'),
      c(3, t0 + 6 * m, 'Ev\'ry valley', 'Messiah (Aria)'), c(4, t0 + 9 * m, 'Piangerò', 'Giulio Cesare (Aria)'));
    await obreSafata(); await pagina.waitForTimeout(800); await esperaDesat();
    const card = pagina.locator('#safataCos .sf-card', { hasText: 'Serse (Aria)' });
    await card.locator('[data-sfllistaobre]', { hasText: 'Això és una llista' }).click();
    await pagina.locator('#inLlista').pressSequentially('hän'); await pagina.waitForTimeout(150);
    igual(JSON.stringify(await pagina.locator('#sugLlista [data-sugllista]').allInnerTexts()), JSON.stringify(['AA Händel']), 'llistes proposades en escriure «hän»');
    igual(await pagina.evaluate(() => document.activeElement?.id), 'inLlista', 'el focus es queda al nom mentre surten les propostes');
    await pagina.locator('#inLlista').fill(''); await pagina.locator('#inLlista').pressSequentially('zzz'); await pagina.waitForTimeout(150);
    igual(await pagina.locator('#sugLlista [data-sugllista]').count(), 0, 'cap proposta per a un nom que no s\'hi assembla');
    await pagina.locator('#inLlista').fill(''); await pagina.locator('#inLlista').pressSequentially('aa'); await pagina.waitForTimeout(150);
    await pagina.click('#sugLlista [data-sugllista="AA Händel"]');
    igual(await pagina.inputValue('#inLlista'), 'AA Händel', 'el toc posa el nom de la llista');
    await pagina.click('[data-sfllistanova]'); await esperaDesat();
    igual(consulta("SELECT COUNT(*) AS n FROM llista WHERE nom = 'AA Händel'")[0].n, 1, 'una sola llista AA Händel (llista.nom)');
    igual(consulta("SELECT COUNT(*) AS n FROM llista_canco WHERE llista_id = (SELECT id FROM llista WHERE nom = 'AA Händel')")[0].n, 5, 'cançons a AA Händel (la d\'abans i les quatre noves)');
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE recording_msid LIKE 'msid-banc-iv%' AND llista_id = (SELECT id FROM llista WHERE nom = 'AA Händel')")[0].n, 4, 'Scrobble.llista_id de les quatre');
  } },
  { nom: 'agrupacions (ACT-849 b): dues subpantalles, «Discos Agrupats» i «Llistes de Reproducció», com L\'Aparador; la darrera triada es recorda', sintetic: true, async fes({ pagina }) {
    await pagina.evaluate(() => { try { localStorage.removeItem('tria-agrupacions-sub'); } catch {} });
    await pagina.click('[data-anar="prestatgeria"]'); await pagina.click('[data-psub="agr"]'); await pagina.waitForTimeout(300);
    igual(JSON.stringify(await pagina.locator('#agrupacions .ag-tabs [data-agsub]').allInnerTexts()), JSON.stringify(['Discos Agrupats', 'Llistes de Reproducció']), 'les dues pastilles d\'Agrupacions');
    cal(await pagina.locator('#ag-disc.activa').count() === 1 && await pagina.locator('#ag-ll.activa').count() === 0, 'per defecte, Discos Agrupats');
    cal((await pagina.locator('#ag-disc').innerText()).includes('Careful Now'), 'el grup Careful Now a Discos Agrupats');
    igual(await pagina.locator('#ag-disc [data-llista]').count(), 0, 'cap llista a Discos Agrupats');
    await pagina.click('[data-agsub="ll"]'); await pagina.waitForTimeout(200);
    cal(await pagina.locator('#ag-ll.activa').count() === 1 && await pagina.locator('#ag-disc.activa').count() === 0, 'Llistes de Reproducció, activa');
    cal(await pagina.locator('#ag-ll [data-llista]', { hasText: 'AA Händel' }).isVisible(), 'la llista AA Händel es veu a Llistes de Reproducció');
    igual(await pagina.locator('#ag-ll [data-grup]').count(), 0, 'cap grup a Llistes de Reproducció');
    await reobre(pagina); await pagina.click('[data-anar="prestatgeria"]'); await pagina.click('[data-psub="agr"]'); await pagina.waitForTimeout(300);
    igual(await pagina.locator('#ag-ll.activa').count(), 1, 'en tornar a obrir, la darrera subpantalla triada (Llistes de Reproducció)');
    await pagina.click('[data-agsub="disc"]'); await pagina.click('[data-anar="faristol"]');
  } },
  { nom: 'segells (ACT-849 d): s\'ordenen com els Artistes Preferents — A-Z, Z-A, Inclusió (segell_preferent.id), Darrera escolta (Escolta.data_hora per Edició.segell) — i «Ordena la llista» desa segell_preferent.ordre', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await alsSegells(pagina);
    const man = consulta('SELECT id, nom FROM segell_preferent ORDER BY ordre, id');
    igual(JSON.stringify(await nomsSegells(pagina)), JSON.stringify(man.map(x => x.nom)), 'per defecte, l\'ordre manual (segell_preferent.ordre)');
    await pagina.selectOption('#ordreSeg', 'az'); await pagina.waitForTimeout(150);
    igual(JSON.stringify(await nomsSegells(pagina)), JSON.stringify(man.map(x => x.nom).sort(CA.compare)), 'A-Z (segell_preferent.nom)');
    cal(await pagina.locator('#btOrdenaSeg').isHidden(), '«Ordena la llista» només amb l\'ordre Manual');
    await pagina.selectOption('#ordreSeg', 'za'); await pagina.waitForTimeout(150);
    igual(JSON.stringify(await nomsSegells(pagina)), JSON.stringify(man.map(x => x.nom).sort(CA.compare).reverse()), 'Z-A');
    const perId = consulta('SELECT nom FROM segell_preferent ORDER BY id DESC').map(x => x.nom);
    await pagina.selectOption('#ordreSeg', 'inclusio-desc'); await pagina.waitForTimeout(150);
    igual(JSON.stringify(await nomsSegells(pagina)), JSON.stringify(perId), 'Inclusió ↓ (segell_preferent.id)');
    // Darrera escolta: Sonic Pieces passa a ser el segell de l'edició amb l'escolta més recent de l'arxiu.
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21');
      await A.canvia(db => db.run("UPDATE edicio SET segell = 'Sonic Pieces' WHERE id = (SELECT edicio_id FROM escolta ORDER BY data_hora DESC LIMIT 1)")); });
    await esperaDesat(); await alsSegells(pagina);
    await pagina.selectOption('#ordreSeg', 'escolta'); await pagina.waitForTimeout(150);
    igual((await nomsSegells(pagina))[0], 'Sonic Pieces', 'Darrera escolta: a dalt, el segell de l\'escolta més recent');
    await reobre(pagina); await alsSegells(pagina);
    igual(await pagina.inputValue('#ordreSeg'), 'escolta', 'l\'ordre triat es recorda en tornar a obrir');
    await pagina.selectOption('#ordreSeg', 'manual'); await pagina.waitForTimeout(150);
    cal(await pagina.locator('#btOrdenaSeg').isVisible(), '«Ordena la llista» amb l\'ordre Manual');
    await pagina.click('#btOrdenaSeg'); await pagina.waitForTimeout(150);
    igual(await pagina.locator('#segells .fila .nansa').count(), man.length, 'una nansa per segell mentre s\'ordena');
    await pagina.click('#segells [data-mouseg="0:1"]'); await pagina.waitForTimeout(100);
    await pagina.click('#btOrdenaSeg'); await esperaDesat();
    const nou = consulta('SELECT nom FROM segell_preferent ORDER BY ordre, id').map(x => x.nom);
    igual(JSON.stringify(nou.slice(0, 2)), JSON.stringify([man[1].nom, man[0].nom]), 'segell_preferent.ordre després de baixar el primer');
    igual(JSON.stringify(await nomsSegells(pagina)), JSON.stringify(nou), 'la pantalla, en l\'ordre desat');
  } },
  { nom: 'fitxa (ACT-849 e): «＋ Preferent» a la capçalera, fora de la quadrícula, fa l\'artista preferent (preferent.artista_id) sense tancar la fitxa, i passa a «★ Preferent», que porta a l\'artista', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const id = await posa(pagina, 'Banc Artista IV', 'Banc Disc IV'); await esperaDesat(); await reobre(pagina);
    await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert');
    const bt = pagina.locator('#full .fitxa-cap .pref-cap[data-prefcap]');
    igual(await bt.count(), 1, '«＋ Preferent» a la capçalera de la fitxa');
    igual((await bt.innerText()).trim(), '＋ Preferent', 'el text del botó');
    igual(await pagina.locator('#full .fitxa-accions .pref-cap').count(), 0, 'no és a la quadrícula de baix');
    await bt.click(); await esperaDesat();
    const aid = consulta(`SELECT a.artista_id AS a FROM edicio e JOIN album a ON a.id = e.album_id WHERE e.id = ${id}`)[0].a;
    igual(consulta(`SELECT COUNT(*) AS n FROM preferent WHERE artista_id = ${aid}`)[0].n, 1, 'preferent.artista_id després de «＋ Preferent»');
    cal(await pagina.locator('#full.obert').count() === 1, 'la fitxa es queda oberta');
    const ja = pagina.locator('#full .fitxa-cap .pref-cap.ja[data-prefja]');
    igual((await ja.innerText()).trim(), '★ Preferent', 'ja és preferent: «★ Preferent»');
    await ja.click(); await pagina.waitForSelector('#s-artista.activa', { timeout: 5000 });
    cal((await pagina.locator('#s-artista').innerText()).includes('Banc Artista IV'), '«★ Preferent» porta a la pantalla de l\'artista');
    await pagina.click('[data-anar="faristol"]').catch(() => {});
  } },
];
