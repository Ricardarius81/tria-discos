// Les comprovacions de l'obra VII — la fitxa del disc nova (ACT-882, ACT-884 e i f, ACT-887 a, ACT-888). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
const obreFitxa1 = async pagina => {
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]').click(); });
  await pagina.click('[data-sub="rot"]'); await pagina.waitForTimeout(150);
  await pagina.locator('#reixa .coberta[data-fitxa="1"]').click(); await pagina.waitForSelector('#full.obert .graella');
};
const tanca = pagina => pagina.evaluate(() => { const t = document.querySelector('#full .torna-full'); if (t) t.click(); else document.querySelector('#fons')?.click(); });

export const OBRA_VII = [
  { bloc: 'obra VII: la fitxa del disc (ACT-882, ACT-884 e i f, ACT-887 a, ACT-888)' },
  { nom: 'quadrícula (ACT-888): Gènere, Tags, Canal, Formats, Grup, Unifica, Escoltes i Nota; sense Portada ni «Més…»', sintetic: true, async fes({ pagina }) {
    await obreFitxa1(pagina);
    igual(JSON.stringify((await pagina.locator('#full .graella .cel b').allInnerTexts()).map(s => s.trim())),
      JSON.stringify(['Gènere', 'Tags', 'Canal', 'Formats', 'Grup', 'Unifica', 'Escoltes', 'Nota']), 'les vuit cel·les, en ordre');
    igual(await pagina.locator('#full [data-mesfitxa]').count(), 0, '«Més…» encara hi és');
  } },
  { nom: 'dins de la seva fitxa, la portada i el títol l\'editen (ACT-887 a): la portada obre «Canvia la portada» i el títol, canviar-lo', sintetic: true, async fes({ pagina }) {
    cal(await pagina.locator('#full .fitxa-cap button.fitxa-portada[data-canviaportada="1"]').count() === 1, 'la portada no és un botó que la canvia');
    cal(await pagina.locator('#full .fitxa-cap h3 button[data-canvianoms="1"]').count() === 1, 'el títol no és un botó que el canvia');
    await pagina.click('#full .fitxa-cap h3 [data-canvianoms]'); await pagina.waitForTimeout(150);
    cal(await pagina.locator('#full .torna-full[data-fitxa="1"]').count() === 1, 'el títol no obre la seva fulla, amb Tornar a la fitxa');
    await pagina.click('#full .torna-full'); await pagina.waitForSelector('#full .graella');
  } },
  { nom: 'accions (ACT-887 a, ACT-888, ACT-884 e): «Escoltar ara», «En rotació» amb els auriculars i «Per afinar» amb el diapasó, rodons', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(() => { const a = document.querySelector('#full .fitxa-accions'); return {
      rot: a.querySelector('.bt-rodo.rot.actiu[data-treure="1"]')?.innerText.trim(), afi: a.querySelector('.bt-rodo.afinar')?.innerText.trim(),
      svgs: a.querySelectorAll('.bt-rodo .rodo svg').length, dalt: !!document.querySelector('#full > .afinar.dalt') }; });
    igual(r.rot, 'En rotació', 'el botó de rotació d\'un disc en rotació'); igual(r.afi, 'Per afinar', 'el botó d\'afinar');
    igual(r.svgs, 2, 'les dues icones'); cal(!r.dalt, '«Per afinar» encara és a dalt');
  } },
  { nom: 'formats (ACT-887 a): la cel·la Formats marca i desmarca el CD a Edició.formats', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const abans = consulta('SELECT formats FROM edicio WHERE id = 1')[0].formats;
    await pagina.click('#full [data-formatsfitxa="1"]'); await pagina.waitForSelector('#full [data-formatfitxa="1|CD"]');
    await pagina.click('#full [data-formatfitxa="1|CD"]'); await esperaDesat();
    const f1 = JSON.parse(consulta('SELECT formats FROM edicio WHERE id = 1')[0].formats || '[]');
    igual(f1.includes('CD'), !(JSON.parse(abans || '[]').includes('CD')), 'Edició.formats, després del toc');
    await pagina.click('#full [data-formatfitxa="1|CD"]'); await esperaDesat();
    igual(consulta('SELECT formats FROM edicio WHERE id = 1')[0].formats, abans, 'Edició.formats, després del segon toc (el desfés)');
    await pagina.click('#full .torna-full'); await pagina.waitForSelector('#full .graella');
  } },
  { nom: 'Piles (ACT-884 f, ACT-887 a): una fila d\'etiquetes amb la icona de la seva Pila i ×; «＋» les ensenya totes per marcar i desmarcar', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.click('#full .fitxa-piles [data-afegeixapila="1"]'); await pagina.waitForTimeout(150);
    const n = consulta('SELECT COUNT(*) AS n FROM pila')[0].n;
    igual(await pagina.locator('#full [data-posaapila], #full [data-treuentrada]').count(), n, 'totes les Piles a la fulla del «＋»');
    await pagina.click('#full [data-posaapila="1:1"]'); await esperaDesat(); await pagina.waitForSelector('#full .fitxa-piles .a-pila');
    cal(await pagina.locator('#full .fitxa-piles .a-pila .fp-ic svg').count() >= 1, 'l\'etiqueta no porta la icona de la Pila');
    igual(consulta('SELECT COUNT(*) AS n FROM pila_entrada WHERE pila_id = 1 AND album_id = (SELECT album_id FROM edicio WHERE id = 1) AND data_sortida IS NULL')[0].n, 1, 'Pila_entrada a la Pila 1');
    await pagina.click('#full .fitxa-piles .a-pila .fp-treu'); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM pila_entrada WHERE pila_id = 1 AND album_id = (SELECT album_id FROM edicio WHERE id = 1)')[0].n, 0, 'la × treu la fila');
  } },
  { nom: 'Unifica (ACT-887 a, ACT-888): una cel·la pròpia amb juntar i «És part»', sintetic: true, async fes({ pagina }) {
    await pagina.waitForSelector('#full [data-unifica="1"]'); await pagina.click('#full [data-unifica="1"]'); await pagina.waitForTimeout(150);
    cal(await pagina.locator('#full [data-juntar="1"]').count() === 1 && await pagina.locator('#full [data-espart="1"]').count() === 1, 'Unifica no porta juntar i «És part»');
    await pagina.click('#full .torna-full'); await pagina.waitForSelector('#full .graella');
  } },
  { nom: 'copiar (ACT-887 a): no a la fitxa; dins de Gènere copia el gènere i dins de Tags, els tags', sintetic: true, async fes({ pagina }) {
    igual(await pagina.locator('#full .fitxa-obra5 [data-copiade]').count(), 0, '«Copia d\'un altre disc» encara és a la fitxa');
    await pagina.click('#full [data-generefitxa="1"]'); await pagina.waitForTimeout(150);
    igual(await pagina.getAttribute('#full [data-copiade]', 'data-copiade'), '1|genere', 'la còpia de la fulla del gènere');
    await pagina.click('#full .torna-full'); await pagina.waitForSelector('#full .graella');
    await pagina.click('#full [data-tagsfitxa="1"]'); await pagina.waitForTimeout(150);
    igual(await pagina.getAttribute('#full [data-copiade]', 'data-copiade'), '1|tags', 'la còpia de la fulla dels tags');
    await pagina.click('#full .torna-full'); await pagina.waitForSelector('#full .graella'); await tanca(pagina);
  } },
];
