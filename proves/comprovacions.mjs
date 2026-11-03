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
  { nom: 'connecta: un arxiu d\'una estructura anterior es migra, i abans en queda una còpia al Drive', sempre: true, async fes({ drive, consulta, versioInicial }) {
    const { MIGRACIONS } = await import('../js/esquema.js');
    igual(consulta('PRAGMA user_version')[0].user_version, MIGRACIONS.length, 'estructura de l\'arxiu del Drive');
    const copies = [...drive.fitxers.values()].filter(f => f.name.includes('abans de l\'estructura ' + MIGRACIONS.length));
    igual(copies.length, versioInicial < MIGRACIONS.length ? 1 : 0, 'còpies «abans de l\'estructura ' + MIGRACIONS.length + '»');
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
  // ───────── 3-11: el disc que sona puja a dalt encara que no arribi al 75 % (opció B) ─────────
  { nom: 'rotació (B): Structures from Silence, que sona ara, puja al primer lloc pel seu darrer scrobble', sintetic: true, async fes({ pagina, consulta, tornaFaristol }) {
    // el camp: l'última pista d'aquesta edició, lligada a una escolta que encara no arriba al 75 %
    const r = consulta(`SELECT MAX(p.listened_at) AS m, MAX(x.completitud) AS c FROM scrobble p JOIN escolta x ON x.id = p.escolta_id WHERE x.edicio_id = 4`)[0];
    cal(r.m && r.c < 0.75, 'Structures no té cap pista lligada a una escolta per sota del 75 %: ' + JSON.stringify(r));
    await tornaFaristol('rot'); await pagina.waitForTimeout(300);
    cal((await pagina.locator('#reixa .disc').first().innerText()).includes('Structures'), 'la primera rajola no és Structures from Silence');
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
  // ───────── ACT-528 i ACT-537 (B): cada disc d'una sessió que sona, quan acaba ─────────
  { nom: 'sessió que sona: Angel\'s Flight (acabat fa 10′) es pot contestar; Structures (sonant) no', sintetic: true, async fes({ pagina }) {
    const ob = pagina.locator('#safataCos .sf-oberta');
    const angel = ob.locator('.sf-separat', { hasText: 'Angel\'s Flight' });
    cal(await angel.locator('[data-sfctx^="d"]').count() > 0, 'Angel\'s Flight no té els botons per contestar-lo');
    const sonant = ob.locator('.sf-sonant', { hasText: 'Structures from Silence' });
    cal(await sonant.count() === 1 && !(await sonant.locator('[data-sfctx]').count()), 'Structures from Silence no surt com a «sonant» sense botons');
  } },
  { nom: 'sessió que sona: el disc llest compta al número de la safata (ACT-530)', sintetic: true, async fes({ pagina }) {
    igual(await pagina.locator('#safataNum').innerText(), '3', 'número de la safata (In a Silent Way, el pòdcast i Angel\'s Flight)');
  } },
  { nom: 'sessió que sona: contestar Angel\'s Flight sol escriu resposta_de «disc» i deixa Structures per contestar', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const b = pagina.locator('#safataCos .sf-oberta .sf-separat', { hasText: 'Angel\'s Flight' }).locator('[data-sfctx^="d"]:not([data-sfctx$="|A casa"]):not([data-sfctx$="|No ho sé"])').first();
    const ctx = (await b.getAttribute('data-sfctx')).split('|')[1];
    await b.click(); await esperaDesat();
    const a = consulta("SELECT estat, context, resposta_de FROM scrobble WHERE album = 'Angel''s Flight'");
    cal(a.length === 3 && a.every(x => x.estat === 'resolt' && x.context === ctx && x.resposta_de === 'disc'), 'Angel\'s Flight: ' + JSON.stringify(a));
    igual(consulta("SELECT estat FROM scrobble WHERE album = 'Structures from Silence'")[0].estat, 'pendent', 'Structures from Silence');
    igual(await pagina.locator('#safataNum').innerText(), '2', 'número de la safata després de contestar Angel\'s Flight');
    cal((await pagina.locator('#safataCos .sf-oberta').innerText()).includes('ja contestat'), 'Angel\'s Flight no surt com a contestat dins la sessió');
  } },
  { nom: 'herència (B): quan la sessió es tanqui, Structures no hereta la resposta d\'Angel\'s Flight; una pista tardana d\'Angel\'s sí', sintetic: true, async fes({ pagina, lb, esperaDesat }) {
    // una pista d'Angel's Flight que arriba tard (un mòbil sense cobertura), dins la mateixa sessió
    lb.escoltes.push({ compte: 'crimsonnnnfeina', listened_at: Math.floor((Date.now() - 52 * 60e3) / 1000), recording_msid: 'msid-banc-tard',
      track_metadata: { artist_name: 'Biosphere', track_name: 'Angel\'s Flight (bonus)', release_name: 'Angel\'s Flight', additional_info: { duration_ms: 60e3 } } });
    await pagina.click('#btSafata'); await pagina.waitForTimeout(900); await esperaDesat();
    const r = await pagina.evaluate(async () => {
      const E = await import('./js/escoltes.js?v=7'); const A = await import('./js/arxiu.js?v=13');
      const SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f });
      const c = new SQL.Database(A.estat.db.export()), despres = Date.now() + 2 * 3600e3;
      const n = E.heretaRespostes(despres)(c);
      const q = sql => c.exec(sql)[0]?.values || [];
      const out = { n, tard: q("SELECT estat, resposta_de FROM scrobble WHERE recording_msid = 'msid-banc-tard'")[0],
        structures: q("SELECT estat FROM scrobble WHERE album = 'Structures from Silence'")[0]?.[0],
        estatTargeta: E.targetes(c, { estat: 'totes', ara: despres }).find(t => t.discos.some(d => d.titol === 'Structures from Silence'))?.estat };
      c.close(); return out;
    });
    igual(JSON.stringify(r.tard), '["resolt","disc"]', 'la pista tardana d\'Angel\'s Flight (hereta del seu disc)');
    igual(r.structures, 'pendent', 'Structures from Silence (no hereta d\'un altre disc contestat sol)');
    igual(r.estatTargeta, 'pendent', 'la sessió, tancada, segueix per contestar');
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
    const v = await pagina.evaluate(async () => { const E = await import('./js/escoltes.js?v=7'); const A = await import('./js/arxiu.js?v=13'); return E.veredicte(A.estat.db); });
    igual(v.ignorades, 0, 'targetes ignorades al veredicte');
  } },
  { nom: 'ignora sempre: un botó de La Cabina obre la llista, i «Treu-lo» la buida', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.click('#btAjustos'); await pagina.waitForSelector('#full.obert');
    await pagina.locator('#full [data-ignorats]').click(); await pagina.waitForTimeout(150);
    const b = pagina.locator('#full [data-treuignora="Beck Did It Better"]');
    cal(await b.count() === 1, 'el botó de La Cabina no obre la llista amb el nom');
    await b.click(); await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'ignora-sempre'")[0]?.valor, '[]', 'meta ignora-sempre després de treure');
    igual(consulta("SELECT estat FROM scrobble WHERE artista = 'Beck Did It Better'")[0].estat, 'ignorat', 'el ja ignorat s\'hi queda');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
  } },

  // ───────── 3-11: el grup a la safata, i les fitxes a pantalla completa ─────────
  { nom: 'safata: Careful Now + Unmasked escoltats seguits surten junts sota el nom del grup', sintetic: true, async fes({ pagina, lb, esperaDesat, obreSafata }) {
    const t0 = Date.now() - 6 * 3600e3, m = 60e3;
    lb.escoltes.push({ compte: 'crimsonnnn', listened_at: Math.floor(t0 / 1000), recording_msid: 'msid-banc-cn1',
      track_metadata: { artist_name: 'James Murray', track_name: 'Careful Now', release_name: 'Careful Now', additional_info: { duration_ms: 52 * m } } });
    lb.escoltes.push({ compte: 'crimsonnnn', listened_at: Math.floor((t0 + 52 * m) / 1000), recording_msid: 'msid-banc-cn2',
      track_metadata: { artist_name: 'James Murray', track_name: 'Unmasked', release_name: 'Careful Now (Unmasked)', additional_info: { duration_ms: 48 * m } } });
    // i un disc amb dues edicions a l'arxiu (Stankonia): aquest no s'empareja sol
    lb.escoltes.push({ compte: 'crimsonnnn', listened_at: Math.floor((t0 - 3 * 3600e3) / 1000), recording_msid: 'msid-banc-stk',
      track_metadata: { artist_name: 'Outkast', track_name: 'So Fresh, So Clean', release_name: 'Stankonia', additional_info: { duration_ms: 4 * m } } });
    await obreSafata(); await pagina.waitForTimeout(800); await esperaDesat();
    const g = pagina.locator('#safataCos .sf-grup');
    igual(await g.count(), 1, 'blocs de grup a la safata');
    cal((await g.innerText()).includes('Careful Now + Unmasked'), 'el bloc no porta el nom del grup: ' + await g.innerText());
    igual(await g.locator('.sf-disc').count(), 2, 'discos dins el bloc del grup');
  } },
  { nom: 'emparellament sol (B): Careful Now i Unmasked s\'emparellen sense preguntar; Stankonia, amb dues edicions, no', sintetic: true, async fes({ pagina, consulta }) {
    igual(consulta('SELECT emparellaments FROM edicio WHERE id = 2')[0].emparellaments, '["Careful Now"]', 'Edició.Emparellaments de Careful Now');
    igual(consulta('SELECT emparellaments FROM edicio WHERE id = 3')[0].emparellaments, '["Careful Now (Unmasked)"]', 'Edició.Emparellaments d\'Unmasked');
    igual(consulta('SELECT COUNT(*) AS n FROM edicio WHERE id IN (7, 8) AND emparellaments IS NOT NULL')[0].n, 0, 'edicions de Stankonia emparellades soles');
    const t = await pagina.locator('#safataCos').innerText();
    cal(t.includes('Stankonia') && (await pagina.locator('#safataCos [data-q2si]').count()) > 0, 'Stankonia no fa la pregunta 2');
    cal(!(await pagina.locator('#safataCos .sf-grup [data-q2si]').count()), 'el grup Careful Now encara fa la pregunta 2');
  } },
  { nom: 'rotació (B): Careful Now, ara emparellat, puja per les seves escoltes', sintetic: true, async fes({ consulta }) {
    cal(consulta('SELECT COUNT(*) AS n FROM escolta WHERE edicio_id IN (2, 3)')[0].n === 2, 'Careful Now i Unmasked no tenen escolta');
  } },
  { nom: 'historial: el grup Careful Now compta en escoltes, com un disc, sense «tirada»', sintetic: true, async fes({ pagina, tornaFaristol, consulta }) {
    await tornaFaristol('hist'); await pagina.waitForTimeout(300);
    const t = await pagina.locator('#hist').innerText();
    cal(t.includes('Careful Now'), 'el grup no surt a l\'Historial');
    cal(!/tirad/i.test(t), 'a l\'Historial encara hi diu «tirada»');
  } },
  { nom: 'pantalla completa: la fitxa del disc i La Cabina ocupen tota la pantalla; la fulla del ▶ del grup, no', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('rot');
    const alt = async () => { const b = await pagina.locator('#full').boundingBox(); return { y: b.y, h: b.height }; };
    await pagina.locator('#reixa .coberta[data-fitxa]').first().click(); await pagina.waitForSelector('#full.obert'); await pagina.waitForTimeout(150);
    let b = await alt(); cal(b.y < 1 && b.h > 840, `la fitxa no és a pantalla completa (y=${Math.round(b.y)}, h=${Math.round(b.h)})`);
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(150);
    await pagina.click('#btAjustos'); await pagina.waitForSelector('#full.obert'); await pagina.waitForTimeout(150);
    b = await alt(); cal(b.y < 1 && b.h > 840, 'La Cabina no és a pantalla completa');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(150);
    await pagina.locator('#reixa .disc.grup [data-grupplay]').click(); await pagina.waitForSelector('#full.obert'); await pagina.waitForTimeout(150);
    b = await alt(); cal(b.y > 100, 'la fulla del ▶ del grup ha passat a pantalla completa');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(150);
  } },
  { nom: 'connecta: ja no surt l\'avís «Connectat amb el Drive»', sintetic: true, async fes({ pagina }) {
    cal(!(await pagina.evaluate(() => /Connectat/.test(document.getElementById('avisTxt').textContent))), 'l\'avís «Connectat» encara hi és');
  } },

  // ───────── v1.46: «canvia-li el nom» d'un grup (ACT-520) ─────────
  { nom: 'fitxa del grup: la portada del grup l\'obre, amb tots els discos, el nom i afegir o treure', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('rot');
    await pagina.locator('#reixa .disc.grup .coberta[data-grup]').click(); await pagina.waitForSelector('#full.obert');
    const f = pagina.locator('#full');
    igual(await f.locator('.membre').count(), 2, 'discos a la fitxa del grup');
    cal(await f.locator('[data-nomgrup]').count() === 1 && await f.locator('[data-agrupa]').count() === 1 && await f.locator('[data-treugrup]').count() === 2,
        'falten «Canvia-li el nom», «Afegeix-hi un disc» o els «treu-lo»');
    igual(await f.locator('a.play, button.play').count(), 2, '▶ a la fitxa del grup');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(150);
  } },
  { nom: 'fitxa del grup: el ▶ de la rajola obre la fulla d\'escoltar, no la fitxa', sintetic: true, async fes({ pagina }) {
    await pagina.locator('#reixa .disc.grup [data-grupplay]').click(); await pagina.waitForSelector('#full.obert');
    cal(!(await pagina.locator('#full [data-treugrup]').count()) && await pagina.locator('#full [data-fitxagrup]').count() === 1, 'no és la fulla d\'escoltar del grup');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(150);
  } },
  { nom: 'fitxa d\'un disc: la línia Grup només porta «obre el grup»', sintetic: true, async fes({ pagina }) {
    await pagina.locator('#reixa .disc.grup .coberta[data-grup]').click(); await pagina.waitForSelector('#full.obert');
    await pagina.locator('#full .membre [data-fitxa]').first().click(); await pagina.waitForTimeout(150);
    const f = pagina.locator('#full');
    cal(await f.locator('[data-fitxagrup]').count() === 1 && !(await f.locator('[data-nomgrup], [data-treugrup]').count()), 'la fitxa del disc encara porta les accions del grup');
    await f.locator('[data-fitxagrup]').click(); await pagina.waitForTimeout(150);
    igual(await f.locator('.membre').count(), 2, '«obre el grup» no porta a la fitxa del grup');
  } },
  { nom: 'nom del grup: «Canvia-li el nom» el desa a meta i surt a la fitxa del grup i a la rajola', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#full [data-nomgrup]').click(); await pagina.waitForTimeout(150);
    await pagina.fill('#inNomGrup', 'Les dues Careful'); await pagina.click('[data-desanomgrup]'); await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'noms-grups'")[0]?.valor, '{"Careful Now":"Les dues Careful"}', 'meta noms-grups');
    cal((await pagina.locator('#full h3').innerText()).includes('Les dues Careful'), 'la fitxa del grup no ensenya el nom');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
    cal((await pagina.locator('#reixa .disc.grup').innerText()).includes('Les dues Careful'), 'la rajola encara porta el títol automàtic');
    igual(consulta("SELECT COUNT(*) AS n FROM album WHERE conjunt = 'Careful Now'")[0].n, 2, 'Àlbum.Conjunt no s\'ha de tocar');
  } },
  { nom: 'nom del grup: si el grup es desfà des de la seva fitxa, el nom es perd; i es torna a fer des de la fitxa del disc', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#reixa .disc.grup .coberta[data-grup]').click(); await pagina.waitForSelector('#full.obert');
    await pagina.locator('#full [data-treugrup]').first().click(); await esperaDesat();
    igual(consulta("SELECT valor FROM meta WHERE clau = 'noms-grups'")[0]?.valor, '{}', 'meta noms-grups després de desfer');
    igual(consulta("SELECT COUNT(*) AS n FROM album WHERE conjunt IS NOT NULL")[0].n, 0, 'discos agrupats després de desfer');
    await pagina.locator('#full [data-agrupa]').click(); await pagina.waitForTimeout(200);
    await pagina.locator('#full [data-agrupaamb]', { hasText: 'Unmasked' }).click(); await esperaDesat();
    igual(consulta("SELECT COUNT(*) AS n FROM album WHERE conjunt IS NOT NULL")[0].n, 2, 'discos agrupats de nou');
    igual(await pagina.locator('#full .membre').count(), 2, 'després d\'agrupar, s\'obre la fitxa del grup');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(200);
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
    const fc = await pagina.locator('#full').boundingBox();
    cal(Math.abs(fc.x + fc.width / 2 - 640) < 4 && fc.y < 1, 'la fitxa, al portàtil, no és centrada i d\'alt a baix');
    await pagina.click('[data-tornafull]'); await pagina.waitForTimeout(150);
    await pagina.locator('#reixa .disc.grup [data-grupplay]').click(); await pagina.waitForSelector('#full.obert'); await pagina.waitForTimeout(250);
    const f = await pagina.locator('#full').boundingBox();
    cal(Math.abs(f.x + f.width / 2 - 640) < 4 && f.y > 20, 'la fulla ràpida no és al mig de la pantalla');
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
