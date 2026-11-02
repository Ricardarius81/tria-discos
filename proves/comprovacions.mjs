// Les comprovacions del banc, en ordre: cadascuna parteix de l'estat que deixa l'anterior.
// { nom, fes(ctx), sintetic?: només amb l'arxiu sintètic, sempre?: passa encara que es filtri amb --nomes }
// Una comprovació falla llançant un error amb una frase que digui què s'esperava i què hi ha.
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);

export const COMPROVACIONS = [
  // ───────── arrencar i connectar ─────────
  { nom: 'arrenca: sense còpia al mòbil, demana entrar amb Google', sempre: true, async fes({ pagina }) {
    await pagina.waitForSelector('#entra', { timeout: 10000 });
  } },
  { nom: 'connecta: un toc obre l\'arxiu del Drive i surt el Faristol', sempre: true, async fes({ pagina, esperaDesat }) {
    await pagina.click('#entra');
    await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
    cal(await pagina.isVisible('#peu'), 'el peu de navegació no surt');
    await esperaDesat(12000);
  } },
  { nom: 'connecta: no crea cap arxiu nou ni cap còpia «abans de l\'estructura» si no cal', sintetic: true, async fes({ drive }) {
    const noms = [...drive.fitxers.values()].map(f => f.name);
    igual(noms.filter(x => x === 'la-meva-discoteca.sqlite').length, 1, 'arxius amb el nom de l\'arxiu');
    cal(!noms.some(x => x.includes('abans de l\'estructura')), 'ha fet una còpia d\'estructura: ' + noms.join(', '));
  } },
  { nom: 'connecta: l\'arxiu del Drive passa la comprovació d\'integritat', sempre: true, async fes({ consulta }) {
    igual(consulta('PRAGMA integrity_check')[0].integrity_check, 'ok', 'integritat');
  } },

  // ───────── Discos en Rotació ─────────
  { nom: 'rotació: els cinc discos en rotació, el grup Careful Now en una sola rajola', sintetic: true, async fes({ pagina }) {
    igual(await pagina.locator('#reixa .disc').count(), 4, 'rajoles a Discos en Rotació (3 discos + 1 grup)');
    cal(await pagina.locator('#reixa .disc.grup').count() === 1, 'no hi ha la rajola del grup');
    cal((await pagina.locator('#reixa .disc.grup').innerText()).includes('Careful Now + Unmasked'), 'el títol curt del grup no és «Careful Now + Unmasked»');
  } },
  { nom: 'rotació: el disc de Bandcamp amb codi obre l\'app, sense cerca', sintetic: true, async fes({ pagina }) {
    const href = await pagina.locator('#reixa a.escoltar[aria-label*="Structures"]').getAttribute('href');
    cal(href?.startsWith('x-bandcamp://'), 'el ▶ no obre l\'app de Bandcamp: ' + href);
  } },
  { nom: 'rotació: el disc d\'un preferent porta el marc daurat', sintetic: true, async fes({ pagina }) {
    cal(await pagina.locator('#reixa .disc.pref').count() >= 2, 'falten marcs de preferent (Biosphere i James Murray)');
  } },

  // ───────── Artistes Preferents ─────────
  { nom: 'preferents: les tres files, amb el disc en rotació o el proper', sintetic: true, async fes({ pagina }) {
    await pagina.click('[data-sub="pref"]'); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#files .fila').count(), 3, 'files de preferents');
    const t = await pagina.locator('#files').innerText();
    cal(t.includes('Ara estudies') && t.includes('Kind of Blue'), 'falta «Ara estudies» o el proper «Kind of Blue»');
  } },

  // ───────── ListenBrainz i la safata ─────────
  { nom: 'listenbrainz: les set pistes de les dues comptes arriben i es desen', sintetic: true, async fes({ consulta, esperaDesat, pagina }) {
    await pagina.waitForFunction(() => +document.getElementById('safataNum').textContent > 0, null, { timeout: 8000 }).catch(() => {});
    await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM scrobble')[0].n, 7, 'pistes a Scrobble');
  } },
  { nom: 'listenbrainz: rellegir no duplica cap pista', sintetic: true, async fes({ pagina, consulta, esperaDesat, obreSafata }) {
    await obreSafata(); await pagina.waitForTimeout(600); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM scrobble')[0].n, 7, 'pistes a Scrobble després de rellegir');
  } },
  { nom: 'safata: la sessió que sona surt a dalt, en gris', sintetic: true, async fes({ pagina }) {
    cal(await pagina.locator('#safataCos .sf-oberta').count() === 1, 'no hi ha la targeta «Sonant ara»');
  } },
  { nom: 'safata: In a Silent Way i el pòdcast, dues targetes per contestar', sintetic: true, async fes({ pagina }) {
    const t = await pagina.locator('#safataCos').innerText();
    cal(t.includes('In a Silent Way'), 'falta la targeta d\'In a Silent Way');
    cal(t.includes('Beck Did It Better'), 'falta la targeta del pòdcast');
  } },
  { nom: 'safata: contestar In a Silent Way «A casa · Despert» escriu la resposta a les dues pistes', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const targeta = pagina.locator('#safataCos .sf-card', { hasText: 'In a Silent Way' }).first();
    await targeta.locator('[data-sfctx$="|A casa"]').click();
    await pagina.locator('[data-sfatencio$="|Despert"]').first().click();
    await esperaDesat();
    const r = consulta("SELECT estat, context, atencio FROM scrobble WHERE album = 'In a Silent Way'");
    cal(r.length === 2 && r.every(x => x.estat === 'resolt' && x.context === 'A casa' && x.atencio === 'Efectes plens'), 'resposta: ' + JSON.stringify(r));
  } },
  { nom: 'escoltes: In a Silent Way compta com una escolta, amb les seves pistes', sintetic: true, async fes({ consulta }) {
    const e = consulta('SELECT id, context, completitud FROM escolta WHERE edicio_id = 5');
    igual(e.length, 1, 'escoltes d\'In a Silent Way');
    igual(consulta('SELECT COUNT(*) AS n FROM scrobble WHERE escolta_id = ?', [e[0].id])[0].n, 2, 'pistes lligades a l\'escolta');
  } },
  { nom: 'historial: In a Silent Way hi surt, amb una escolta', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('hist');
    const t = await pagina.locator('#hist').innerText();
    cal(t.includes('In a Silent Way') && t.includes('1 escolta'), 'l\'Historial no té In a Silent Way amb una escolta: ' + t.slice(0, 200));
  } },
  { nom: 'safata: «Canvia» d\'una resolta la torna a la cua sense resposta', sintetic: true, async fes({ pagina, consulta, esperaDesat, obreSafata }) {
    await obreSafata();
    await pagina.locator('[data-sfresolta]').first().click(); await pagina.waitForTimeout(300);
    const porta = pagina.locator('#full [data-sfreobre]').first();
    if (await porta.count()) await porta.click(); else throw new Error('la fulla de «Canvia» no té la porta per tornar a contestar');
    await esperaDesat();
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE album = 'In a Silent Way' AND estat = 'pendent'")[0].n, 2, 'pistes tornades a pendent');
    // i es torna a contestar, per deixar-ho com estava
    await pagina.waitForTimeout(300);
    const targeta = pagina.locator('#safataCos .sf-card', { hasText: 'In a Silent Way' }).first();
    await targeta.locator('[data-sfctx$="|A casa"]').click();
    await pagina.locator('[data-sfatencio$="|Despert"]').first().click();
    await esperaDesat();
  } },

  // ───────── la fitxa ─────────
  { nom: 'fitxa: s\'obre des de la portada i porta la línia «Grup»', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('rot');
    await pagina.locator('#reixa .coberta[data-fitxa]').first().click(); await pagina.waitForSelector('#full.obert');
    cal((await pagina.locator('#full').innerText()).includes('Grup'), 'la fitxa no té la línia «Grup»');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
  } },

  // ───────── v1.46: el ▶ de l'Historial i dels preferents (ACT-516) ─────────
  { nom: 'historial ▶: cada fila de disc porta el seu ▶ directe al canal', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('hist');
    const fila = pagina.locator('#hist .hfila', { hasText: 'In a Silent Way' }).first();
    const href = await fila.locator('a.hplay').getAttribute('href');
    cal(href?.includes('music.youtube.com') && href.includes('In%20a%20Silent%20Way'), 'el ▶ no obre YouTube Music amb el disc: ' + href);
    cal(await fila.locator('a.hplay').getAttribute('data-obre') === '5', 'el ▶ no apunta l\'obertura');
  } },
  { nom: 'historial ▶: tocar la fila obre la fitxa, no la fulla d\'escoltar', sintetic: true, async fes({ pagina }) {
    await pagina.locator('#hist .hfila', { hasText: 'In a Silent Way' }).first().locator('.hcap').click();
    await pagina.waitForSelector('#full.obert');
    const t = await pagina.locator('#full').innerText();
    cal(t.includes('Durada') && t.includes('Grup') && !t.includes('Un altre canal'), 'no és la fitxa: ' + t.slice(0, 120));
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
  } },
  { nom: 'historial ▶: tocar el ▶ apunta l\'obertura a l\'arxiu', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.evaluate(() => { const a = [...document.querySelectorAll('#hist a.hplay')].find(x => x.dataset.obre === '5');
      a.removeAttribute('target'); a.setAttribute('href', '#'); a.click(); });
    await pagina.waitForTimeout(300); await esperaDesat();
    cal(consulta('SELECT darrera_obertura FROM edicio WHERE id = 5')[0].darrera_obertura, 'no s\'ha apuntat darrera_obertura');
  } },
  { nom: 'preferents ▶: amb disc en rotació, directe; amb només el proper, la cerca al canal de l\'artista', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('pref');
    const bio = await pagina.locator('#files .fila', { hasText: 'Biosphere' }).locator('a.fplay').getAttribute('href');
    cal(bio?.includes('music.amazon.com') && bio.includes('Angel'), 'Biosphere: ' + bio);
    const miles = pagina.locator('#files .fila', { hasText: 'Miles Davis' }).locator('a.fplay');
    const h = await miles.getAttribute('href');
    cal(h?.includes('music.youtube.com') && h.includes('Kind%20of%20Blue'), 'Miles Davis (proper): ' + h);
    cal(!(await miles.getAttribute('data-obre')), 'el ▶ del proper no ha d\'apuntar cap obertura: no té fitxa');
  } },
  { nom: 'preferents ▶: en ordenar la llista, el ▶ desapareix', sintetic: true, async fes({ pagina }) {
    await pagina.click('#btOrdena'); await pagina.waitForTimeout(200);
    igual(await pagina.locator('#files .fplay').count(), 0, '▶ mentre s\'ordena');
    await pagina.click('#btOrdena'); await pagina.waitForTimeout(300);
  } },

  // ───────── v1.46: «Veure'ls tots» (ACT-517) i «Ignora sempre» (ACT-524) ─────────
  { nom: 'safata: el botó dels contextos diu «Veure\'ls tots»', sintetic: true, async fes({ pagina, obreSafata }) {
    await obreSafata();
    const t = await pagina.locator('#safataCos').innerText();
    cal(t.includes('Veure\'ls tots') && !/Tots \(\d+\)/.test(t), 'el botó encara diu «Tots (N)»');
  } },
  { nom: 'ignora sempre: el pòdcast surt de la safata i el nom queda a meta', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const targeta = pagina.locator('#safataCos .sf-card', { hasText: 'Beck Did It Better' }).first();
    await targeta.locator('[data-sfignorasempre]').click();
    await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'ignora-sempre'")[0]?.valor, '["Beck Did It Better"]', 'meta ignora-sempre');
    igual(consulta("SELECT estat FROM scrobble WHERE artista = 'Beck Did It Better'")[0].estat, 'ignorat', 'estat del pòdcast');
    cal(!(await pagina.locator('#safataCos .sf-card', { hasText: 'Beck Did It Better' }).count()), 'el pòdcast encara és a la safata');
  } },
  { nom: 'ignora sempre: un episodi nou del pòdcast (amb «feat.») s\'ignora sol en arribar', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    lb.escoltes.push({ compte: 'crimsonnnn', listened_at: Math.floor((Date.now() - 2 * 3600e3) / 1000), recording_msid: 'msid-banc-podcast-2',
      track_metadata: { artist_name: 'Beck Did It Better [feat. Convidat]', track_name: 'Episodi 13', release_name: null, additional_info: {} } });
    await pagina.click('#safataCos'); await obreSafata(); await pagina.waitForTimeout(800); await esperaDesat();
    igual(consulta("SELECT estat FROM scrobble WHERE recording_msid = 'msid-banc-podcast-2'")[0]?.estat, 'ignorat', 'estat de l\'episodi nou');
    cal(!(await pagina.locator('#safataCos .sf-card', { hasText: 'Episodi 13' }).count()) && !(await pagina.locator('#safataCos .sf-card', { hasText: 'Beck Did It' }).count()), 'el pòdcast ha tornat a la safata');
  } },
  { nom: 'ignora sempre: no compta al veredicte de la safata', sintetic: true, async fes({ pagina }) {
    // El veredicte és una funció pura sobre l'arxiu: es crida dins la pàgina, amb el mòdul de la màquina.
    const v = await pagina.evaluate(async () => { const E = await import('./js/escoltes.js?v=4'); const A = await import('./js/arxiu.js?v=12'); return E.veredicte(A.estat.db); });
    igual(v.ignorades, 0, 'targetes ignorades al veredicte');
  } },
  { nom: 'ignora sempre: la llista és a La Cabina, i «treu-lo» la buida', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.click('#btAjustos'); await pagina.waitForSelector('#full.obert');
    const b = pagina.locator('#full [data-treuignora="Beck Did It Better"]');
    cal(await b.count() === 1, 'La Cabina no ensenya la llista');
    await b.click(); await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'ignora-sempre'")[0]?.valor, '[]', 'meta ignora-sempre després de treure');
    igual(consulta("SELECT estat FROM scrobble WHERE artista = 'Beck Did It Better'")[0].estat, 'ignorat', 'el ja ignorat s\'hi queda');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
  } },

  // ───────── v1.46: «canvia-li el nom» d'un grup (ACT-520) ─────────
  { nom: 'nom del grup: «canvia-li el nom» el desa a meta i surt a la rajola i a la fitxa', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol }) {
    await tornaFaristol('rot');
    await pagina.locator('#reixa .disc.grup [data-grup]').first().click(); await pagina.waitForSelector('#full.obert');
    await pagina.locator('#full [data-fitxa]').first().click(); await pagina.waitForTimeout(200);
    await pagina.locator('#full [data-nomgrup]').click(); await pagina.waitForTimeout(150);
    await pagina.fill('#inNomGrup', 'Les dues Careful'); await pagina.click('[data-desanomgrup]'); await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'noms-grups'")[0]?.valor, '{"Careful Now":"Les dues Careful"}', 'meta noms-grups');
    cal((await pagina.locator('#full').innerText()).includes('Les dues Careful'), 'la fitxa no ensenya el nom');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
    cal((await pagina.locator('#reixa .disc.grup').innerText()).includes('Les dues Careful'), 'la rajola encara porta el títol automàtic');
    igual(consulta("SELECT COUNT(*) AS n FROM album WHERE conjunt = 'Careful Now'")[0].n, 2, 'Àlbum.Conjunt no s\'ha de tocar');
  } },
  { nom: 'nom del grup: si el grup es desfà, el nom es perd', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#reixa .disc.grup [data-grup]').first().click(); await pagina.waitForSelector('#full.obert');
    await pagina.locator('#full [data-fitxa]').first().click(); await pagina.waitForTimeout(200);
    await pagina.locator('#full [data-treugrup]').click(); await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'noms-grups'")[0]?.valor, '{}', 'meta noms-grups després de desfer');
    // es torna a agrupar, per deixar el banc com estava
    await pagina.locator('#full [data-agrupa]').click(); await pagina.waitForTimeout(200);
    await pagina.locator('#full [data-agrupaamb]', { hasText: 'Unmasked' }).click(); await esperaDesat();
    await pagina.click('[data-tornafull]').catch(() => {}); await pagina.waitForTimeout(200);
    igual(consulta("SELECT COUNT(*) AS n FROM album WHERE conjunt IS NOT NULL")[0].n, 2, 'discos agrupats de nou');
  } },

  // ───────── v1.46: el permís guardat (ACT-522), l'avís (ACT-525) i la vista ampla (ACT-523) ─────────
  { nom: 'permís: en recarregar l\'app, es connecta sola, sense toc i sense franja magenta', sempre: true, async fes({ pagina, esperaDesat }) {
    const abans = await pagina.evaluate(() => window.__permisos || 0);
    cal(await pagina.evaluate(() => !!localStorage.getItem('tria-permis')), 'el permís no s\'ha guardat al mòbil');
    await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
    await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
    cal(!(await pagina.isVisible('#btConnecta')), 'la franja magenta torna a sortir');
    igual(await pagina.evaluate(() => window.__permisos || 0), 0, 'permisos nous demanats a Google després de recarregar (abans ' + abans + ')');
    await esperaDesat();
  } },
  { nom: 'avís: surt sota la capçalera i no tapa la icona de la safata', sempre: true, async fes({ pagina }) {
    await pagina.waitForSelector('#avis.obert', { timeout: 6000 }).catch(() => pagina.evaluate(() => document.getElementById('avis').classList.add('obert')));
    const a = await pagina.locator('#avis').boundingBox(), s = await pagina.locator('#btSafata').boundingBox();
    cal(a.y >= s.y + s.height, `l'avís (y=${Math.round(a.y)}) tapa la safata (fins a y=${Math.round(s.y + s.height)})`);
  } },
  { nom: 'vista ampla: al portàtil, sis portades per fila i la fulla al mig; al mòbil, tres', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('rot');
    const cols = () => pagina.evaluate(() => getComputedStyle(document.getElementById('reixa')).gridTemplateColumns.split(' ').length);
    igual(await cols(), 3, 'columnes al mòbil');
    await pagina.setViewportSize({ width: 1280, height: 860 }); await pagina.waitForTimeout(250);
    igual(await cols(), 6, 'columnes al portàtil');
    await pagina.locator('#reixa .coberta[data-fitxa]').first().click(); await pagina.waitForSelector('#full.obert'); await pagina.waitForTimeout(250);
    const f = await pagina.locator('#full').boundingBox();
    cal(Math.abs(f.x + f.width / 2 - 640) < 4 && f.y > 20, 'la fulla no és al mig de la pantalla');
    await pagina.click('[data-tornafull]'); await pagina.setViewportSize({ width: 390, height: 844 }); await pagina.waitForTimeout(250);
    igual(await cols(), 3, 'columnes al mòbil, després');
  } },

  // ───────── el que no ha de passar mai ─────────
  { nom: 'cap petició no surt a internet', sempre: true, async fes({ fugides }) {
    const fora = fugides.filter(h => !/musicbrainz|coverartarchive|wikipedia|wikimedia|wikidata|bandcamp/.test(h));
    cal(!fora.length, 'han intentat sortir: ' + [...new Set(fora)].join(', '));
  } },
  { nom: 'cap error a la consola de la pàgina', sempre: true, async fes({ errors }) {
    cal(!errors.length, errors.slice(0, 3).join(' | '));
  } },
  { nom: 'l\'arxiu del Drive acaba sencer i sense res pendent de desar', sempre: true, async fes({ consulta, pagina }) {
    igual(consulta('PRAGMA integrity_check')[0].integrity_check, 'ok', 'integritat');
    cal(!(await pagina.locator('#desat.visible').count()), 'queda «sense desar»');
  } }
];
