// Les comprovacions de l'obra VI — el menú «La Meva Discoteca», Inici i Tornar (v1.59 §7.7, ACT-880 a ACT-884, ACT-886 a
// ACT-888). Fitxer propi (ACT-756). Sense camp del model: tot és pantalla, i es mira la pantalla.
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
const visible = (pagina, sel) => pagina.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const anar = (pagina, s) => pagina.evaluate(s => document.querySelector(`[data-anar="${s}"]`).click(), s);

export const OBRA_VI = [
  { bloc: 'obra VI: el menú, Inici i Tornar (ACT-880 a ACT-884, ACT-886 a ACT-888)' },
  { nom: 'menú (ACT-881, ACT-888): Inici a la capçalera obre «La Meva Discoteca» amb tres columnes, set seccions amb il·lustració i La Cabina; la barra de baix ja no es veu', sintetic: true, async fes({ pagina }) {
    await anar(pagina, 'faristol'); await pagina.click('[data-sub="rot"]');
    cal(await visible(pagina, 'header.barra #btInici'), 'Inici no es veu a la capçalera');
    cal(!(await visible(pagina, 'nav.peu')), 'la barra de baix encara es veu');
    await pagina.click('#btInici'); await pagina.waitForSelector('#s-inici.activa');
    igual(JSON.stringify(await pagina.locator('#s-inici .ini-col h2').allInnerTexts()), JSON.stringify(['Prestatgeria', 'Faristol', 'Gramola']), 'els títols de columna');
    igual(JSON.stringify((await pagina.locator('#s-inici .ini-sec .ini-nom').allInnerTexts()).map(s => s.trim())),
      JSON.stringify(['Tots els discos', 'Agrupacions', 'L\'Afinació', 'Discos en rotació', 'L\'Aparador', 'Historial', 'aviat']), 'les seccions, en ordre');
    igual(await pagina.locator('#s-inici .ini-sec .ini-tile svg').count(), 7, 'una il·lustració per secció');
    cal(await visible(pagina, '#s-inici #btAjustos'), 'La Cabina no és al menú');
    const f = await pagina.evaluate(() => [getComputedStyle(document.querySelector('#s-inici .ini-nom')).fontFamily, getComputedStyle(document.querySelector('#s-inici .ini-col h2')).fontFamily]);
    cal(f.every(x => /Archivo/.test(x)), 'els títols i les seccions, en la lletra del títol (Archivo): ' + f.join(' | '));
  } },
  { nom: 'il·lustracions (ACT-887 c, ACT-888): vuit, totes diferents, cadascuna amb el seu fons; cap bitllet de fora', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const I = await import('./js/icones-inici.js?v=1');
      const v = Object.values(I.ICONES); return { n: v.length, unics: new Set(v).size, fons: new Set(v.map(s => (s.match(/<stop offset="0" stop-color="([^"]+)"/) || [])[1])).size, fora: v.some(s => /https?:/.test(s.replace('http://www.w3.org', ''))) }; });
    igual(r.n, 8, 'il·lustracions'); igual(r.unics, 8, 'il·lustracions diferents'); igual(r.fons, 8, 'colors de fons diferents');
    cal(!r.fora, 'una il·lustració carrega alguna cosa de fora');
  } },
  { nom: 'Tornar (ACT-883 b, c): una secció del menú porta Tornar, que torna al menú i després a on era; l\'«enrere» del mòbil fa el mateix; a l\'inici no n\'hi ha', sintetic: true, async fes({ pagina }) {
    await pagina.evaluate(() => { if (!document.querySelector('#s-inici.activa')) document.getElementById('btInici').click(); });
    await pagina.click('#s-inici [data-menu="faristol:hist"]'); await pagina.waitForTimeout(150);
    igual(await pagina.locator('#s-faristol.activa #p-hist.activa').count(), 1, 'Historial des del menú');
    cal(await visible(pagina, '#btTornar'), 'Tornar no surt');
    await pagina.click('#btTornar'); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#s-inici.activa').count(), 1, 'Tornar, al menú');
    await pagina.click('#btTornar'); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#s-faristol.activa #p-rot.activa').count(), 1, 'Tornar altre cop, a Discos en rotació');
    cal(!(await visible(pagina, '#btTornar')), 'a la pantalla d\'inici, sense pas enrere, Tornar no hi ha de ser');
    // L'enrere del mòbil.
    await pagina.click('#btInici'); await pagina.click('#s-inici [data-menu="prestatgeria:agr"]'); await pagina.waitForTimeout(150);
    igual(await pagina.locator('#s-prestatgeria.activa #q-agr.activa').count(), 1, 'Agrupacions des del menú');
    await pagina.goBack(); await pagina.waitForTimeout(300);
    igual(await pagina.locator('#s-inici.activa').count(), 1, 'l\'enrere del mòbil, al menú');
    await pagina.click('#btTornar'); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#s-faristol.activa').count(), 1, 'i Tornar, on era');
  } },
  { nom: 'L\'Afinació i La Cabina (ACT-884 d, ACT-883 d): surten de la capçalera; al menú, el punt taronja i l\'exclamació de les còpies, que també surt sobre Inici', sintetic: true, async fes({ pagina }) {
    igual(await pagina.locator('header.barra #btAfinacio, header.barra #btAjustos').count(), 0, 'L\'Afinació o La Cabina encara a la capçalera');
    await pagina.evaluate(() => document.body.classList.add('sense-copia'));
    cal(await visible(pagina, '#btInici .alerta'), 'l\'exclamació no surt sobre Inici');
    await pagina.click('#btInici'); await pagina.waitForTimeout(150);
    cal(await visible(pagina, '#s-inici .ini-cabina .alerta'), 'l\'exclamació no surt al costat de La Cabina');
    await pagina.evaluate(() => document.body.classList.remove('sense-copia'));
    cal(await pagina.locator('#s-inici #btAfinacio #afiPunt').count() === 1, 'el punt de L\'Afinació no és a la seva il·lustració');
    await pagina.click('#s-inici #btAfinacio'); await pagina.waitForTimeout(200);
    igual(await pagina.locator('#s-prestatgeria.activa #q-afi.activa').count(), 1, 'L\'Afinació des del menú');
    cal(await visible(pagina, '#btTornar'), 'des de L\'Afinació, Tornar');
    await pagina.click('#btTornar'); await pagina.waitForTimeout(200); await pagina.click('#btTornar'); await pagina.waitForTimeout(200);
  } },
  { nom: 'L\'Aparador (ACT-883 a): Piles, Artistes Preferents i Segells Preferents, en aquest ordre', sintetic: true, async fes({ pagina }) {
    await anar(pagina, 'faristol'); await pagina.click('[data-sub="pref"]');
    igual(JSON.stringify((await pagina.locator('#p-pref > .apar-tabs > button').allInnerTexts()).map(s => s.trim())), JSON.stringify(['Piles', 'Artistes Preferents', 'Segells Preferents']), 'les tres pastilles');
    await pagina.click('[data-sub="rot"]');
  } },
];
