// Les comprovacions de l'obra E (ACT-815, 6): el botó «Info». Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#btInici:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}

export const OBRA_E = [
  { bloc: 'obra E: el botó «Info» (ACT-815)' },
  { nom: 'Info (ACT-815, 6): A, cinc enllaços; B, la fitxa de la Wikipedia en anglès i de MusicBrainz (data, segell, pistes), desada a meta i visible sense les fonts', async fes({ pagina, esperaDesat, fonts }) {
    fonts.actiu = true;
    fonts.wp.cerques['banc info disc'] = ['Banc Info Disc'];
    fonts.wp.extractes['Banc Info Disc'] = 'Banc Info Disc is the second studio album by Banc Info.\nIt was recorded in a single night.';
    fonts.mb.cerquesRelease['Banc Info Disc'] = [{ id: 'rel-banc-info', title: 'Banc Info Disc' }];
    fonts.mb.releases['rel-banc-info'] = { date: '2019-05-01', 'label-info': [{ label: { name: 'Quiet Details' }, 'catalog-number': 'QD10' }],
      media: [{ tracks: [{ title: 'Una', length: 300000 }, { title: 'Dues', length: 240000 }] }] };
    try {
      const id = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), D = await import('./js/dades.js?v=25');
        let r; await A.canvia(db => { r = D.posaEnRotacio({ art: 'Banc Info', tit: 'Banc Info Disc', min: 9, canal: 'amazon' })(db); }); return r.id; });
      await esperaDesat(); await reobre(pagina);
      await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert [data-info]');
      await pagina.click('#full [data-info]'); await pagina.waitForSelector('#full [data-buscainfo]');
      igual(await pagina.locator('#full .bt-enllac').count(), 5, 'enllaços (MusicBrainz, Discogs, Wikipedia, RYM, AllMusic)');
      await pagina.click('#full [data-buscainfo]');
      await pagina.waitForSelector('#full .info-resum', { timeout: 10000 }); await esperaDesat();
      const t = await pagina.locator('#full').innerText();
      cal(t.includes('second studio album') && t.includes('Quiet Details') && t.includes('2019-05-01') && t.includes('Dues'), 'la fitxa no porta el resum, el segell, la data o les pistes: ' + t.slice(0, 300));
      const m = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21');
        const al = A.estat.db.exec('SELECT album_id FROM edicio WHERE id = ' + id)[0].values[0][0];
        return A.estat.db.exec("SELECT valor FROM meta WHERE clau = 'info:A" + al + "'")[0]?.values[0][0] || null; }, id);
      const j = JSON.parse(m || 'null');
      cal(j && j.wiki && j.mb && j.mb.segell === 'Quiet Details' && j.mb.pistes.length === 2, 'meta «info:A…» no porta la fitxa: ' + m);
      fonts.actiu = false;
      await reobre(pagina);
      await pagina.locator(`[data-fitxa="${id}"]`).first().click(); await pagina.waitForSelector('#full.obert [data-info]');
      await pagina.click('#full [data-info]'); await pagina.waitForSelector('#full [data-buscainfo]');
      cal((await pagina.locator('#full').innerText()).includes('second studio album'), 'sense les fonts, la fitxa desada no es veu');
    } finally { fonts.actiu = false; }
  } },
  { bloc: 'arreglo: l\'avís «sense desar» (20-11)' },
  { nom: 'avís: quan l\'arxiu acaba de desar-se per un altre camí, «sense desar» s\'apaga (abans es quedava encès i el banc esperava 8 s)', async fes({ pagina, esperaDesat }) {
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21');
      document.getElementById('desat').classList.add('visible');
      const x = await A.canvia(db => db.run("INSERT INTO meta (clau, valor) VALUES ('banc-avis', '1')"));
      await new Promise(f => setTimeout(f, 400));
      return { desat: x.desat, pendent: A.estat.pendent, visible: document.getElementById('desat').classList.contains('visible') }; });
    cal(r.desat && !r.pendent, 'no s\'ha desat: ' + JSON.stringify(r));
    igual(r.visible, false, '«sense desar» visible amb l\'arxiu desat');
    await esperaDesat();
  } },
];
