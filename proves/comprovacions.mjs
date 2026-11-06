// Les comprovacions del banc, en ordre: cadascuna parteix de l'estat que deixa l'anterior.
// { nom, fes(ctx), sintetic?: només amb l'arxiu sintètic, sempre?: passa encara que es filtri amb --nomes }
// Una comprovació falla llançant un error amb una frase que digui què s'esperava i què hi ha.
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);

// Les còpies de seguretat vives (no a la paperera) del Drive fals.
const copiesVives = drive => [...drive.fitxers.values()].filter(f => !f.trashed && f.name.includes('· còpia de seguretat '));
async function espera(cond, msg, max = 10000) { const t = Date.now(); while (!cond()) { if (Date.now() - t > max) throw new Error(msg); await new Promise(r => setTimeout(r, 150)); } }
async function fesUnaAra(pagina) {
  await pagina.click('#btAjustos'); await pagina.waitForSelector('[data-copiaara]');
  await pagina.click('[data-copiaara]');
  await pagina.waitForFunction(() => /Còpia (de seguretat )?feta|No s'ha/.test(document.getElementById('avisTxt')?.textContent || ''), null, { timeout: 10000 });
  await pagina.click('[data-tornafull]').catch(() => {}); await pagina.waitForTimeout(300);
}
async function reobre(pagina) { await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 }); await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 }); }

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
      const E = await import('./js/escoltes.js?v=10'); const A = await import('./js/arxiu.js?v=16');
      const SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f });
      const c = new SQL.Database(A.estat.db.export()), despres = Date.now() + 2 * 3600e3;
      const n = E.heretaRespostes(despres)(c);
      const q = sql => c.exec(sql)[0]?.values || [];
      const out = { n, tard: q("SELECT estat, resposta_de FROM scrobble WHERE recording_msid = 'msid-banc-tard'")[0],
        structures: q("SELECT estat FROM scrobble WHERE album = 'Structures from Silence'")[0]?.[0],
        estatTargeta: E.targetes(c, { estat: 'totes', ara: despres, llegit: despres }).find(t => t.discos.some(d => d.titol === 'Structures from Silence'))?.estat };
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
    const v = await pagina.evaluate(async () => { const E = await import('./js/escoltes.js?v=10'); const A = await import('./js/arxiu.js?v=16'); return E.veredicte(A.estat.db); });
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

  // ───────── la darrera lectura (3-11, Porgy and Bess) ─────────
  { nom: 'lectura: un disc que sona no es dona per acabat fins que una lectura ho sap, encara que el rellotge digui que sí', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => {
      const E = await import('./js/escoltes.js?v=10'); const A = await import('./js/arxiu.js?v=16');
      const ara = Date.now(), despres = ara + 40 * 60e3;          // Structures from Silence acaba d'aquí 22 minuts
      const d = (llegit, a = despres) => { const c = E.targetes(A.estat.db, { estat: 'totes', ara: a, llegit }).find(t => t.discos.some(x => x.titol === 'Structures from Silence'));
        return { targeta: c.estat, llest: c.discos.find(x => x.titol === 'Structures from Silence').llest }; };
      return { guardada: +localStorage.getItem('tria-lectura-lb'), ara, vella: d(ara), nova: d(despres), cap: d(null, ara + 3 * 3600e3) };
    });
    cal(r.guardada > r.ara - 10 * 60e3 && r.guardada <= r.ara, 'la màquina no ha guardat al mòbil l\'hora de la darrera lectura: ' + r.guardada);
    igual(r.vella.llest, false, 'Structures, d\'aquí 40 minuts però amb la lectura d\'ara, es pot contestar');
    igual(r.vella.targeta, 'oberta', 'la sessió, amb la lectura d\'ara, ja es dona per tancada');
    igual(r.nova.llest, true, 'Structures, amb una lectura d\'aquí 40 minuts, encara no es pot contestar');
    igual(r.cap.targeta, 'oberta', 'sense cap lectura en aquest dispositiu, la sessió es dona per tancada');
  } },
  { nom: 'primer pla: si l\'arxiu ha canviat al Drive des d\'un altre lloc, la màquina el torna a obrir', sintetic: true, async fes({ pagina, drive, esperaDesat }) {
    const f = drive.per('la-meva-discoteca.sqlite');
    f.modifiedTime = drive.hora();                               // «l'altre mòbil» el desa
    const baixades = () => drive.peticions.filter(x => x.includes('alt=media') && x.includes(f.id)).length;
    const abans = baixades();
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await pagina.waitForTimeout(1500); await esperaDesat();
    cal(baixades() > abans, 'no ha tornat a baixar l\'arxiu del Drive');
    igual(await pagina.evaluate(async () => (await import('./js/arxiu.js?v=16')).estat.base), f.modifiedTime, 'la versió del Drive sobre la qual treballa');
    const n = baixades();
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await pagina.waitForTimeout(800);
    igual(baixades(), n, 'baixades en tornar a primer pla sense cap canvi al Drive');
  } },

  { nom: 'dos mòbils: una lectura de la màquina que xoca amb el Drive es torna a fer en silenci, sense l\'avís «ha canviat en un altre lloc»', sintetic: true, async fes({ pagina, drive, lb, esperaDesat, consulta }) {
    const f = drive.per('la-meva-discoteca.sqlite');
    f.modifiedTime = drive.hora();                               // «l'altre mòbil» desa mentre aquest llegeix
    lb.escoltes.push({ compte: 'crimsonnnnfeina', listened_at: Math.floor((Date.now() - 90e3) / 1000), recording_msid: 'msid-banc-dosmobils',
      track_metadata: { artist_name: 'Biosphere', track_name: 'Angel\'s Flight (reprise)', release_name: 'Angel\'s Flight', additional_info: { duration_ms: 60e3 } } });
    await pagina.evaluate(() => document.getElementById('avis').classList.remove('obert'));
    await pagina.click('#btSafata'); await pagina.waitForTimeout(2500); await esperaDesat();
    const avis = await pagina.evaluate(() => document.getElementById('avis').classList.contains('obert') ? document.getElementById('avisTxt').textContent : '');
    cal(!avis.includes('ha canviat en un altre lloc'), 'ha sortit l\'avís: ' + avis);
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE recording_msid = 'msid-banc-dosmobils'")[0].n, 1, 'la pista nova, al Drive');
    igual(await pagina.evaluate(async () => (await import('./js/arxiu.js?v=16')).estat.base), drive.per('la-meva-discoteca.sqlite').modifiedTime, 'la versió del Drive sobre la qual treballa');
  } },

  // ───────── la sessió acabada i els discos contestats diferent (3-11, Savall) ─────────
  { nom: '«Canvia» d\'una sessió amb dos discos: cada disc amb el seu context, i es pot tornar a la safata un disc sol', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat }) {
    // una sessió tancada de fa tres hores, amb dos discos seguits, contestats per separat (com Porgy and Bess i Savall)
    const t0 = Math.floor((Date.now() - 3 * 3600e3) / 1000);
    lb.escoltes.push(
      { compte: 'crimsonnnnfeina', listened_at: t0, recording_msid: 'msid-banc-sav1', track_metadata: { artist_name: 'Miles Davis', track_name: 'Shhh / Peaceful', release_name: 'In a Silent Way', additional_info: { duration_ms: 283e3 } } },
      { compte: 'crimsonnnn', listened_at: t0 + 600, recording_msid: 'msid-banc-sav2', track_metadata: { artist_name: 'Phase90', track_name: 'Infinitati I', release_name: 'Infinitati', additional_info: { duration_ms: 240e3 } } });
    await pagina.click('#btSafata'); await pagina.waitForTimeout(1200); await esperaDesat();
    const card = () => pagina.locator('#safataCos .sf-card', { hasText: 'Infinitati' }).first();
    await card().locator('[data-sfsepara]').click(); await pagina.waitForTimeout(250);
    const respon = async (titol, ctx) => {
      const bloc = card().locator('.sf-separat', { hasText: titol });
      await bloc.locator('[data-sftots]').click(); await pagina.waitForTimeout(250);
      await card().locator('.sf-separat', { hasText: titol }).locator(`[data-sfctx$="|${ctx}"]`).click(); await pagina.waitForTimeout(400); await esperaDesat();
    };
    await respon('In a Silent Way', 'Treballant');
    await respon('Infinitati', 'Amor');
    const fila = pagina.locator('#safataCos .sf-resolta', { hasText: 'Infinitati' }).first();
    const text = await fila.innerText();
    cal(text.includes('Treballant') && text.includes('Amor'), 'la fila de «Resoltes» no ensenya el context de cada disc: ' + text);
    await fila.locator('[data-sfresolta]').click(); await pagina.waitForTimeout(300);
    igual(await pagina.locator('#full [data-sfreobre]').count(), 3, 'botons de «Canvia» (la sessió i un per disc)');
    await pagina.locator('#full [data-sfreobre]', { hasText: 'Infinitati' }).click();
    await pagina.waitForTimeout(400); await esperaDesat();
    igual(consulta("SELECT estat FROM scrobble WHERE recording_msid = 'msid-banc-sav2'")[0].estat, 'pendent', 'Infinitati, tornat a la safata');
    igual(JSON.stringify(consulta("SELECT estat, context FROM scrobble WHERE recording_msid = 'msid-banc-sav1'")[0]), '{"estat":"resolt","context":"Treballant"}', 'In a Silent Way (no s\'ha de tocar)');
    // es torna a contestar, per deixar-ho com estava («Veure'ls tots» ja hi pot ser obert)
    if (!await card().locator('[data-sfctx$="|Amor"]').count()) { await card().locator('[data-sftots]').first().click(); await pagina.waitForTimeout(250); }
    await card().locator('[data-sfctx$="|Amor"]').first().click(); await pagina.waitForTimeout(400); await esperaDesat();
    igual(JSON.stringify(consulta("SELECT context FROM scrobble WHERE recording_msid IN ('msid-banc-sav1','msid-banc-sav2') ORDER BY recording_msid").map(x => x.context)), '["Treballant","Amor"]', 'contextos després de tornar a contestar Infinitati');
  } },
  { nom: 'sessió oberta: quan tot està contestat i no sona res, no surt a la safata (opció A)', sintetic: true, async fes({ pagina, esperaDesat }) {
    // d'aquí 40 minuts: Structures from Silence ja ha acabat i la sessió encara no es tanca (fins als 52)
    await pagina.clock.setFixedTime(new Date(Date.now() + 40 * 60e3));
    await pagina.click('#btSafata'); await pagina.waitForTimeout(1200); await esperaDesat();
    const oberta = () => pagina.locator('#safataCos .sf-oberta', { hasText: 'Structures from Silence' });
    cal(await oberta().count() === 1, 'Structures, acabat i sense contestar, no surt dins la sessió oberta');
    // es contesta tot el que hi queda (Structures i el que hagin deixat les comprovacions d'abans)
    for (let i = 0; i < 6 && await oberta().locator('[data-sftots^="d"]').count(); i++) {
      await oberta().locator('[data-sftots^="d"]').first().click(); await pagina.waitForTimeout(250);
      await oberta().locator('[data-sfctx$="|Llegir"]').first().click(); await pagina.waitForTimeout(400); await esperaDesat();
    }
    igual(await oberta().count(), 0, 'sessions obertes amb Structures, tot contestat i res sonant');
  } },

  // ───────── 4-11: portades, trossos sumats, «a mitges», el mosaic del grup i l'arrencada sense connexió ─────────
  { nom: 'portada: una pista llegida abans del lligam amb MusicBrainz l\'agafa en rellegir-la, i el disc pren la portada de l\'escolta', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat }) {
    // Infinitati (msid-banc-sav2) va arribar sense mbid_mapping; ara ListenBrainz ja l'ha lligada (cas de l'avió, 4-11)
    const caa = '256d5e0c-09f4-4a36-a44c-b272b894cd64';
    const x = lb.escoltes.find(e => e.recording_msid === 'msid-banc-sav2');
    x.track_metadata.mbid_mapping = { release_mbid: caa, caa_release_mbid: caa };
    igual(consulta("SELECT caa_release_mbid FROM scrobble WHERE recording_msid = 'msid-banc-sav2'")[0].caa_release_mbid, null, 'Scrobble.caa_release_mbid abans de rellegir');
    await pagina.click('#btSafata'); await pagina.waitForTimeout(1500); await esperaDesat();
    igual(consulta("SELECT caa_release_mbid FROM scrobble WHERE recording_msid = 'msid-banc-sav2'")[0].caa_release_mbid, caa, 'Scrobble.caa_release_mbid després de rellegir');
    igual(JSON.stringify(consulta('SELECT portada, portada_origen FROM edicio WHERE id = 6')[0]), JSON.stringify({ portada: 'release/' + caa, portada_origen: 'escolta' }), 'Edició.Portada d\'Infinitati');
    igual(consulta("SELECT context FROM scrobble WHERE recording_msid = 'msid-banc-sav2'")[0].context, 'Amor', 'la resposta de Ricard (no s\'ha de tocar)');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
  { nom: 'trossos sumats: Savall en dos contextos compta com una escolta; la pista repetida compta un sol cop; repetir quan ja compta n\'obre una altra', sintetic: true, async fes({ pagina, lb, consulta }) {
    const r0 = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16');
      return A.canvia(db => {
        db.run("INSERT INTO artista (id, nom_canonic) VALUES (7, 'Jordi Savall')");
        db.run("INSERT INTO album (id, titol, artista_id) VALUES (8, 'Das Paradies und die Peri', 7)");
        db.run(`INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, app_escolta, emparellaments) VALUES (9, 8, 99, 0, 'amazon', '["Das Paradies und die Peri"]')`);
      });
    });
    cal(r0.desat, 'no s\'ha desat el disc de Savall: ' + r0.motiu);
    const t0 = Date.now() - 10.5 * 3600e3, m = 60e3, H = 3600e3;
    // a la compte de feina: a la personal hi ha Careful Now a la mateixa hora, i un disc no sona damunt d'un altre
    const pista = (t, msid, nom, min) => ({ compte: 'crimsonnnnfeina', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'Jordi Savall', track_name: nom, release_name: 'Das Paradies und die Peri', additional_info: { duration_ms: min * m } } });
    lb.escoltes.push(pista(t0, 'msid-banc-svT1', 'Part I', 20), pista(t0 + 20 * m, 'msid-banc-svT2', 'Part II', 20), pista(t0 + 40 * m, 'msid-banc-svT3', 'Part III', 20),
      pista(t0 + 4 * H, 'msid-banc-svT3', 'Part III', 20), pista(t0 + 4 * H + 20 * m, 'msid-banc-svT4', 'Part IV', 35),
      pista(t0 + 6 * H, 'msid-banc-svT1', 'Part I', 20));
    await pagina.click('#btSafata');
    // que hagin arribat les sis pistes abans de contestar, i que s'hi quedin: si la lectura xoca amb el Drive es torna
    // a fer en silenci (la comprovació «dos mòbils») i durant un instant l'arxiu del mòbil torna a ser el d'abans de llegir
    for (let quietes = 0, t = Date.now(); quietes < 4; ) {
      cal(Date.now() - t < 12000, 'les sis pistes de Savall no es queden a l\'arxiu del mòbil');
      const n = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=16');
        return A.estat.db.exec("SELECT COUNT(*) FROM scrobble WHERE album = 'Das Paradies und die Peri'")[0].values[0][0]; });
      quietes = n === 6 ? quietes + 1 : 0; await pagina.waitForTimeout(250);
    }
    // la tarda, Amor (les tres primeres); la nit, Dormir (la repetida, la quarta i la primera que torna)
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16'), E = await import('./js/escoltes.js?v=10');
      const ids = A.estat.db.exec("SELECT id FROM scrobble WHERE album = 'Das Paradies und die Peri' ORDER BY listened_at")[0].values.map(v => v[0]);
      return A.canvia(db => { E.contesta(ids.slice(0, 3), 'Amor')(db); E.contesta(ids.slice(3), 'Dormir')(db); });
    });
    cal(r.desat, 'no s\'ha desat la resposta: ' + r.motiu);
    const esc = consulta('SELECT id, context, atencio, completitud, unio FROM escolta WHERE edicio_id = 9 ORDER BY data_hora');
    igual(esc.length, 3, 'trossos (Escolta) de Savall');
    igual(esc[0].unio, esc[0].id, 'Escolta.unio del primer tros (la unió porta el seu id)');
    igual(esc[1].unio, esc[0].id, 'Escolta.unio del tros de Dormir (de la mateixa escolta sencera)');
    cal(esc[2].unio !== esc[0].unio, 'la primera pista que torna quan ja compta no obre una escolta nova (Escolta.unio)');
    igual(esc[0].completitud, 0.606, 'Escolta.completitud del tros d\'Amor');
    igual(esc[1].completitud, 0.354, 'Escolta.completitud del tros de Dormir (la Part III repetida compta un sol cop)');
    igual(JSON.stringify(esc.map(e => e.context)), '["Amor","Dormir","Dormir"]', 'Escolta.context de cada tros');
    const { SQL_COMPTA } = await import('../js/escoltes.js');
    igual(consulta(`SELECT COUNT(DISTINCT COALESCE(s.unio, s.id)) AS n FROM escolta s WHERE s.edicio_id = 9 AND ${SQL_COMPTA}`)[0].n, 1, 'escoltes senceres de Savall que compten');
  } },
  { nom: 'historial «a mitges»: Savall surt amb una escolta i «a mitges», per sobre de Careful Now', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('hist');
    await pagina.fill('#cerca', 'a'); await pagina.fill('#cerca', ''); await pagina.waitForTimeout(200);   // es torna a pintar
    const fila = pagina.locator('#hist .hfila', { hasText: 'Das Paradies' });
    igual(await fila.count(), 1, 'files de Savall a l\'Historial');
    const t = (await fila.innerText()).replace(/\s+/g, ' ');
    cal(/1 escolta · a mitges/.test(t), 'la fila de Savall no diu «1 escolta · a mitges»: ' + t);
    const ordre = await pagina.locator('#hist .htit').allInnerTexts();
    const iS = ordre.findIndex(x => x.includes('Das Paradies')), iC = ordre.findIndex(x => x.includes('Careful'));
    cal(iS >= 0 && iC >= 0 && iS < iC, 'Savall (última pista fa 4 h 30) no és per sobre de Careful Now: ' + ordre.join(' / '));
  } },
  { nom: 'mosaic del grup (B): Variant Immersions, sonat a mitges dins la finestra de la tirada, s\'ajunta al mosaic', sintetic: true, async fes({ pagina, lb, consulta, tornaFaristol, esperaDesat }) {
    const r0 = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16');
      return A.canvia(db => {
        db.run("UPDATE album SET conjunt = 'Infinitati', posicio = 1 WHERE id = 6");
        db.run("INSERT INTO album (id, titol, artista_id, conjunt, posicio) VALUES (9, 'Intrusion Dubs', 5, 'Infinitati', 2), (10, 'Variant Immersions', 5, 'Infinitati', 3)");
        db.run(`INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio)
                VALUES (10, 9, 73, 1, 'aimp', '["Intrusion Dubs"]', ?), (11, 10, 79, 1, 'aimp', '["Variant Immersions"]', ?)`, [new Date(Date.now() - 864e5).toISOString(), new Date(Date.now() - 864e5).toISOString()]);
      });
    });
    cal(r0.desat, 'no s\'ha desat el grup de Phase90: ' + r0.motiu);
    const tp = Date.now() - 14 * 3600e3, m = 60e3;   // sense trepitjar cap altra pista de la mateixa compte
    const pista = (t, msid, nom, album, min) => ({ compte: 'crimsonnnn', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'Phase90', track_name: nom, release_name: album, additional_info: { duration_ms: min * m } } });
    lb.escoltes.push(pista(tp, 'msid-banc-inf', 'Infinitati', 'Infinitati', 41), pista(tp + 41 * m, 'msid-banc-intr', 'Intrusion', 'Intrusion Dubs', 73),
      pista(tp + 114 * m, 'msid-banc-var', 'Variant', 'Variant Immersions', 40));
    await pagina.click('#btSafata'); await pagina.waitForTimeout(1500); await esperaDesat();
    const v = consulta('SELECT completitud FROM escolta WHERE edicio_id = 11');
    cal(v.length === 1 && v[0].completitud < 0.75, 'Variant Immersions hauria de tenir una escolta que no compta: ' + JSON.stringify(v));
    await tornaFaristol('rot');
    const g = pagina.locator('#reixa .disc.grup', { hasText: 'Intrusion' });
    igual(await g.count(), 1, 'rajoles del grup de Phase90');
    igual(await g.locator('.tros').count(), 3, 'portades al mosaic del grup (Variant Immersions inclòs)');
    igual(await pagina.locator('#reixa .disc:not(.grup)', { hasText: 'Variant Immersions' }).count(), 0, 'rajoles soltes de Variant Immersions');
  } },
  { nom: 'historial (ACT-592): Variant Immersions, a mitges dins la tirada, no fa fila solta; la fila del grup el porta', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('hist');
    await pagina.fill('#cerca', 'a'); await pagina.fill('#cerca', ''); await pagina.waitForTimeout(200);
    const files = await pagina.locator('#hist .hfila').allInnerTexts();
    const soltes = files.filter(x => x.includes('Variant Immersions') && !x.includes('Intrusion'));
    igual(soltes.length, 0, 'files soltes de Variant Immersions a l\'Historial');
    const g = files.filter(x => x.includes('Intrusion'));
    igual(g.length, 1, 'files del grup de Phase90 a l\'Historial');
    cal(g[0].includes('Variant'), 'la fila del grup no porta Variant Immersions: ' + g[0].replace(/\s+/g, ' '));
    await tornaFaristol('rot');
  } },
  { nom: 'durada: canviar-la torna a calcular les escoltes (Variant Immersions a 52′ passa a comptar)', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#reixa .disc.grup', { hasText: 'Intrusion' }).locator('.coberta[data-grup]').click(); await pagina.waitForSelector('#full.obert');
    await pagina.locator('#full .membre [data-fitxa="11"]').first().click(); await pagina.waitForTimeout(200);
    await pagina.locator('#full [data-durada="11"]').click(); await pagina.waitForTimeout(150);
    await pagina.fill('#inDurada', '52'); await pagina.click('[data-desadurada]'); await esperaDesat();
    igual(consulta('SELECT durada_total FROM edicio WHERE id = 11')[0].durada_total, 52, 'Edició.Durada total de Variant Immersions');
    igual(consulta('SELECT completitud FROM escolta WHERE edicio_id = 11')[0].completitud, 0.769, 'Escolta.completitud de Variant Immersions (40′ de 52′)');
    // i es deixa com era, per a les comprovacions que vénen després
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=16'), E = await import('./js/escoltes.js?v=10');
      await A.canvia(db => { db.run('UPDATE edicio SET durada_total = 79 WHERE id = 11'); E.recalcula(db); }); });
  } },
  { nom: 'pregunta 2 (A): un disc en rotació amb un títol diferent (Bartók) es pregunta per l\'artista, no surt com a disc nou', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    const r0 = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16');
      return A.canvia(db => {
        db.run(`INSERT INTO artista (id, nom_canonic, variants) VALUES (907, 'Keller Quartet', '["Bartók"]')`);
        db.run(`INSERT INTO album (id, titol, artista_id) VALUES (911, 'Bartók: The 6 String Quartets', 907)`);
        db.run(`INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, app_escolta, data_referencia_rotacio) VALUES (912, 911, 149, 1, 'amazon', ?)`,
               [new Date(Date.now() - 2 * 864e5).toISOString()]);
      });
    });
    cal(r0.desat, 'no s\'ha desat el Bartók: ' + r0.motiu);
    const t = Date.now() - 20 * 3600e3, m = 60e3;   // compte de feina, sense trepitjar cap altra pista
    const pista = (t, msid, nom, album, min) => ({ compte: 'crimsonnnnfeina', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'Keller Quartet', track_name: nom, release_name: album, additional_info: { duration_ms: min * m } } });
    lb.escoltes.push(pista(t, 'msid-banc-bk5', 'String Quartet No. 5', 'Bartók: String Quartets Nos. 1 - 6', 30),
      pista(t + 30 * m, 'msid-banc-bk6', 'String Quartet No. 6', 'Bartók: String Quartets Nos. 1 - 6', 27),
      // una cançó solta del mateix artista, d'una llista: no té cara de disc i no ha de preguntar
      pista(t - 6 * 3600e3, 'msid-banc-bach', 'Contrapunctus I', 'Bach: The Art of Fugue', 4));
    await obreSafata(); await pagina.waitForTimeout(1500); await esperaDesat();
    igual(await pagina.locator('#safataCos [data-q2si="bartokstringquartetsnos16|912"]').count(), 1, 'botons «Sí: Bartók» de la pregunta 2');
    igual(await pagina.locator('#safataCos [data-q2si^="bachtheartoffugue|"]').count(), 0, 'pregunta 2 per a la cançó solta');
    await pagina.click('#safataCos [data-q2si="bartokstringquartetsnos16|912"]'); await pagina.waitForTimeout(500); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM album WHERE artista_id = 907')[0].n, 1, 'àlbums del Keller Quartet (cap de duplicat)');
    igual(consulta('SELECT emparellaments FROM edicio WHERE id = 912')[0].emparellaments, '["Bartók: String Quartets Nos. 1 - 6"]', 'Edició.Emparellaments del Bartók');
    const e = consulta('SELECT completitud FROM escolta WHERE edicio_id = 912');
    cal(e.length >= 1 && e.every(x => x.completitud < 0.75), 'el Bartók hauria de tenir escoltes que no compten (57′ de 149′): ' + JSON.stringify(e));
  } },
  { nom: 'pregunta 2 (A): el Bartók emparellat surt a l\'Historial amb «0 escoltes · a mitges»', sintetic: true, async fes({ pagina, tornaFaristol }) {
    await tornaFaristol('hist');
    await pagina.fill('#cerca', 'a'); await pagina.fill('#cerca', ''); await pagina.waitForTimeout(200);
    const f = pagina.locator('#hist .hfila', { hasText: 'String Quartets' });
    igual(await f.count(), 1, 'files del Bartók a l\'Historial');
    cal(/0 escoltes · a mitges/.test((await f.innerText()).replace(/\s+/g, ' ')), 'la fila del Bartók no diu «0 escoltes · a mitges»');
  } },
  // ───────── el tram 4: la còpia de seguretat i l'Excel (§3.5, ACT-566 a ACT-571, ACT-603, ACT-604) ─────────
  { nom: 'caixa (ACT-625): la pista va a la part que diu el nom de l\'àlbum; sense número, a la viva; en tornar a calcular, el vol. 1 torna sol a la part 1', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    const r0 = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16');
      return A.canvia(db => {
        db.run("INSERT INTO artista (id, nom_canonic) VALUES (920, 'D York')");
        db.run("INSERT INTO album (id, titol, artista_id) VALUES (921, 'The Italian Chronicles', 920)");
        db.run(`INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio) VALUES (922, 921, 90, 1, 'amazon', ?, ?)`,
               [JSON.stringify(['The Italian Chronicles volume 1', 'The Italian Chronicles']), new Date(Date.now() - 3 * 864e5).toISOString()]);
        db.run(`INSERT INTO part (id, edicio_id, numero, nom, durada, rotacio_actual) VALUES (931, 922, 1, 'Vol. 1', 30, 0), (932, 922, 2, 'Vol. 2', 30, 1), (933, 922, 3, 'Vol. 3', 30, 0)`);
      });
    });
    cal(r0.desat, 'no s\'ha desat la caixa: ' + r0.motiu);
    const t = Date.now() - 16 * 3600e3, m = 60e3;   // compte de feina, entre el Bartók (−20 h) i Savall (−10 h 30); la lectura només mira 24 h enrere
    const pista = (t, msid, album, min) => ({ compte: 'crimsonnnnfeina', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'D York', track_name: msid, release_name: album, additional_info: { duration_ms: min * m } } });
    // el vol. 1 sona amb la part 2 viva; després, una pista amb el nom sense número
    lb.escoltes.push(pista(t, 'msid-banc-ic1', 'The Italian Chronicles volume 1', 25), pista(t + 60 * m, 'msid-banc-ic2', 'The Italian Chronicles', 10));
    await obreSafata();
    await pagina.waitForFunction(async () => { const A = await import('./js/arxiu.js?v=16');
      return A.estat.db.exec("SELECT COUNT(*) FROM scrobble WHERE recording_msid LIKE 'msid-banc-ic%' AND escolta_id IS NOT NULL")[0].values[0][0] === 2; }, null, { timeout: 10000, polling: 250 });
    await pagina.waitForTimeout(1500); await esperaDesat();
    const partDe = msid => consulta(`SELECT e.part_id FROM scrobble s JOIN escolta e ON e.id = s.escolta_id WHERE s.recording_msid = '${msid}'`)[0]?.part_id;
    igual(partDe('msid-banc-ic1'), 931, 'Escolta.part_id del «volume 1» (la part 1, no la viva)');
    igual(partDe('msid-banc-ic2'), 932, 'Escolta.part_id de la pista sense número (la part viva)');
    // el cas d'abans de l'ACT-625: l'escolta del vol. 1 havia quedat a la part 2; en tornar a calcular hi torna sola
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16'), E = await import('./js/escoltes.js?v=10');
      return A.canvia(db => {
        db.run("UPDATE escolta SET part_id = 932 WHERE id = (SELECT escolta_id FROM scrobble WHERE recording_msid = 'msid-banc-ic1')");
        E.recalcula(db);
      });
    });
    cal(r.desat, 'no s\'ha desat el recàlcul: ' + r.motiu);
    igual(partDe('msid-banc-ic1'), 931, 'Escolta.part_id del «volume 1» després de tornar a calcular');
    igual(partDe('msid-banc-ic2'), 932, 'Escolta.part_id de la pista sense número després de tornar a calcular (no es mou)');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
  { nom: 'còpia: la primera obertura n\'ha fet una, la parella .sqlite + .xlsx amb els recomptes a les propietats', async fes({ drive, pagina }) {
    const avui = new Date().toISOString().slice(0, 10);
    await pagina.waitForFunction(() => !document.body.classList.contains('sense-copia'), null, { timeout: 10000 }).catch(() => {});
    const vius = copiesVives(drive);
    igual(vius.filter(f => f.name === `la-meva-discoteca · còpia de seguretat ${avui}.sqlite`).length, 1, 'còpies .sqlite d\'avui');
    igual(vius.filter(f => f.name === `la-meva-discoteca · còpia de seguretat ${avui}.xlsx`).length, 1, 'còpies .xlsx d\'avui');
    const sq = vius.find(f => f.name.endsWith('.sqlite'));
    for (const k of ['edicio', 'album', 'artista', 'scrobble', 'escolta', 'escolta_fisica']) cal(/^\d+$/.test(sq.appProperties?.['n_' + k] || ''), 'falta el recompte n_' + k + ' a les propietats: ' + JSON.stringify(sq.appProperties));
    cal(sq.parents.includes([...drive.fitxers.values()].find(f => f.name === 'La Meva Discoteca').id), 'la còpia no és dins de La Meva Discoteca');
    cal(!(await pagina.evaluate(() => document.body.classList.contains('sense-copia'))), 'surt l\'exclamació vermella amb una còpia d\'avui');
  } },
  { nom: 'còpia: «Fes-ne una ara» substitueix la d\'avui, en guarda cinc dies i la sisena va a la paperera; les «abans de l\'estructura» no es toquen', async fes({ drive, pagina, consulta }) {
    const fa = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    for (const d of [8, 15, 22, 29, 36]) for (const ext of ['sqlite', 'xlsx'])
      drive.afegeix({ name: `la-meva-discoteca · còpia de seguretat ${fa(d)}.${ext}`, mimeType: 'application/octet-stream', parents: [] });
    const estructura = drive.afegeix({ name: 'la-meva-discoteca.sqlite · abans de l\'estructura 4 2026-10-31 21:35', mimeType: 'application/x-sqlite3' });
    const davui = copiesVives(drive).filter(f => f.name.includes(fa(0))).map(f => f.id);
    await fesUnaAra(pagina);
    const vius = copiesVives(drive), dates = [...new Set(vius.map(f => /(\d{4}-\d{2}-\d{2})/.exec(f.name)[1]))].sort().reverse();
    igual(JSON.stringify(dates), JSON.stringify([fa(0), fa(8), fa(15), fa(22), fa(29)]), 'dies que queden');
    igual(vius.length, 10, 'fitxers vius (cinc parelles)');
    cal(davui.every(id => drive.fitxers.get(id).trashed), 'la còpia d\'avui d\'abans no ha anat a la paperera');
    cal([...drive.fitxers.values()].filter(f => f.name.includes(fa(36))).every(f => f.trashed), 'la sisena no ha anat a la paperera');
    cal(!estructura.trashed, 'ha tocat una «abans de l\'estructura»');
    const sq = vius.find(f => f.name.endsWith(fa(0) + '.sqlite'));
    igual(+sq.appProperties.n_scrobble, consulta('SELECT COUNT(*) AS n FROM scrobble')[0].n, 'n_scrobble de la còpia');
  } },
  { nom: 'còpia: amb l\'última a 6 dies, obrir no en fa cap; a 7, en fa una', async fes({ drive, pagina }) {
    const fa = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    const reanomena = (de, a) => { for (const f of copiesVives(drive)) if (f.name.includes(de)) f.name = f.name.replace(de, a); };
    reanomena(fa(0), fa(6));
    await reobre(pagina); await pagina.waitForTimeout(2500);
    igual(copiesVives(drive).filter(f => f.name.includes(fa(0))).length, 0, 'còpies noves amb l\'última a 6 dies');
    reanomena(fa(6), fa(7));
    await reobre(pagina);
    await espera(() => copiesVives(drive).filter(f => f.name.includes(fa(0))).length === 2, 'no s\'ha fet la còpia amb l\'última a 7 dies');
    // Cinc dies: avui, 7, 8, 15 i 22. La de 29 dies va a la paperera quan la parella nova ja hi és.
    await espera(() => copiesVives(drive).length === 10, 'fitxers vius després de la còpia automàtica: ' + copiesVives(drive).length + ' (se n\'esperaven 10)');
    cal(copiesVives(drive).every(f => !f.name.includes(fa(29))), 'la de 29 dies no ha anat a la paperera');
  } },
  { nom: 'còpia (opció A): si baixen les pistes de ListenBrainz, exclamació vermella i no va res a la paperera', async fes({ drive, pagina, consulta }) {
    const ultima = copiesVives(drive).filter(f => f.name.endsWith('.sqlite') && f.appProperties).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))[0];
    ultima.appProperties = { ...ultima.appProperties, n_scrobble: String(+ultima.appProperties.n_scrobble + 5) };
    const aLaPaperera = () => [...drive.fitxers.values()].filter(f => f.trashed).length, abans = aLaPaperera();
    await fesUnaAra(pagina);
    igual(aLaPaperera(), abans, 'fitxers a la paperera');
    const al = JSON.parse(consulta(`SELECT valor FROM meta WHERE clau = 'copia-alarma'`)[0]?.valor || 'null');
    cal(al?.baixades?.[0]?.taula === 'scrobble' && al.baixades[0].abans - al.baixades[0].ara === 5, 'meta copia-alarma: ' + JSON.stringify(al));
    cal(await pagina.evaluate(() => document.body.classList.contains('sense-copia')), 'no surt l\'exclamació vermella');
    await pagina.click('#btAjustos'); await pagina.waitForTimeout(300);
    cal((await pagina.locator('#full').innerText()).includes('5 pistes de ListenBrainz menys'), 'La Cabina no diu quantes pistes falten');
    await pagina.click('[data-alarmaok]'); await pagina.waitForTimeout(500);
    await pagina.waitForFunction(() => !document.body.classList.contains('sense-copia'), null, { timeout: 5000 });
    await pagina.click('[data-tornafull]').catch(() => {});
  } },
  { nom: 'còpia: si baixen els artistes, una nota a la safata que diu quants i es confirma amb un toc; les escoltes de l\'app no avisen', async fes({ drive, pagina, consulta, esperaDesat, obreSafata }) {
    await esperaDesat();
    igual(consulta(`SELECT COUNT(*) AS n FROM meta WHERE clau = 'copia-alarma'`)[0].n, 0, 'alarma després de «D\'acord»');
    const ultima = copiesVives(drive).filter(f => f.name.endsWith('.sqlite') && f.appProperties).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))[0];
    ultima.appProperties = { ...ultima.appProperties, n_artista: String(+ultima.appProperties.n_artista + 2), n_escolta: String(+ultima.appProperties.n_escolta + 3) };
    await fesUnaAra(pagina);
    await esperaDesat();
    const nt = JSON.parse(consulta(`SELECT valor FROM meta WHERE clau = 'copia-nota'`)[0]?.valor || 'null');
    igual(JSON.stringify(nt?.baixades?.map(b => b.taula)), '["artista"]', 'el que diu la nota (les escoltes de l\'app no hi han de ser)');
    igual(consulta(`SELECT COUNT(*) AS n FROM meta WHERE clau = 'copia-alarma'`)[0].n, 0, 'alarma vermella per unes escoltes de l\'app');
    await obreSafata();
    const t = await pagina.locator('#safataCos .sf-copia').innerText();
    cal(t.includes('2 artistes menys'), 'la nota de la safata no diu «2 artistes menys»: ' + t);
    await pagina.click('#safataCos [data-notaok]'); await esperaDesat();
    igual(consulta(`SELECT COUNT(*) AS n FROM meta WHERE clau = 'copia-nota'`)[0].n, 0, 'nota després d\'«Entesos»');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
  // ───────── el proper d'un preferent (ACT-619) ─────────
  { nom: 'proper: si entra un altre disc de l\'artista es queda amagat i torna; només l\'esborra el mateix títol', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol }) {
    const proper = () => consulta(`SELECT proper_titol AS t FROM preferent WHERE artista_id = 4`)[0].t;
    igual(proper(), 'Kind of Blue', 'proper de Miles Davis abans de res');
    const id = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=16'), D = await import('./js/dades.js?v=18');
      let r; await A.canvia(db => { r = D.posaEnRotacio({ art: 'Miles Davis', tit: 'Sketches of Spain', min: 41, canal: 'youtube' })(db); }); return r.id; });
    await esperaDesat();
    igual(proper(), 'Kind of Blue', 'preferent.proper_titol després d\'entrar un altre disc seu');
    await reobre(pagina); await tornaFaristol('pref');   // A.canvia no repinta: es torna a obrir
    let t = await pagina.locator('#files').innerText();
    cal(/Ara estudies\s+Sketches of Spain/.test(t) && !t.includes('El proper: Kind of Blue'), 'amb disc en rotació el proper no s\'ha de pintar: ' + JSON.stringify(t));
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=16'), D = await import('./js/dades.js?v=18'); await A.canvia(D.treu(id)); }, id);
    await esperaDesat(); await reobre(pagina); await tornaFaristol('pref');
    t = await pagina.locator('#files').innerText();
    cal(t.includes('El proper: Kind of Blue'), 'sense disc en rotació el proper havia de tornar: ' + t.slice(0, 200));
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=16'), D = await import('./js/dades.js?v=18');
      await A.canvia(D.posaEnRotacio({ art: 'Miles Davis', tit: 'kind of blue', min: 46, canal: 'youtube' })); });
    await esperaDesat();
    igual(proper(), null, 'preferent.proper_titol després d\'entrar el mateix disc (amb majúscules diferents)');
  } },
  { nom: 'excel: anada i tornada idèntica fila a fila, amb les nou pestanyes i les columnes de càrrega del §3.2', async fes({ pagina, consulta }) {
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=16'), X = await import('./js/excel.js?v=1'), { MIGRACIONS } = await import('./js/esquema.js?v=5');
      const l = await X.llegeix(await X.xlsx(A.estat.db));
      const SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f });
      const buida = () => { const d = new SQL.Database(); MIGRACIONS.forEach((m, i) => { d.exec(m); d.exec(`PRAGMA user_version = ${i + 1}`); }); return d; };
      const d = buida(); X.carrega(d, l); const dif = X.compara(A.estat.db, d); d.close();
      // Una correcció del títol a Edició, que és una columna de lectura: mana Àlbum.
      const t = l['Edició'][0].indexOf('Títol'); l['Edició'][1][t] = 'Un títol corregit a Edició';
      const d2 = buida(); X.carrega(d2, l); const dif2 = X.compara(A.estat.db, d2); d2.close();
      return { dif, dif2, pestanyes: Object.keys(l), edicio: l['Edició'][0].slice(0, 16), part: l['Part'][0].slice(0, 6), artista: l['Artista'][0].slice(0, 4),
               escolta: l['Escolta'][0], scrobbles: l['Scrobble'].length - 1, meta: l['Meta'].slice(1).map(f => f[0]) };
    });
    cal(!r.dif.length, 'l\'anada i tornada no és idèntica: ' + r.dif.slice(0, 3).join(' | '));
    cal(!r.dif2.length, 'una correcció del títol a Edició ha manat sobre Àlbum: ' + r.dif2.slice(0, 2).join(' | '));
    igual(r.pestanyes.join(','), 'Edició,Part,Artista,Àlbum,Puntuació,Escolta,Scrobble,Preferent,Meta', 'pestanyes');
    igual(r.edicio.join(' | '), 'ID de càrrega | ID d\'àlbum | Títol | Artista | Nom de l\'artista | Nom de l\'edició | Durada total | Any de publicació original | Any d\'aquesta edició | Segell | Codi de catàleg | Formats disponibles | Estat d\'estrena | Lot de càrrega | Procedència | Avisos', 'columnes de càrrega d\'Edició');
    igual(r.part.join(' | '), 'ID de càrrega | Nom de l\'artista | Nom de l\'edició | Part.Número | Títol de la part | Durada', 'columnes de càrrega de Part');
    igual(r.artista.join(' | '), 'ID d\'artista | Nom canònic | Variants d\'escriptura | Persona', 'columnes de càrrega d\'Artista');
    cal(r.escolta.includes('unio'), 'la pestanya Escolta no porta unio');
    igual(r.scrobbles, consulta('SELECT COUNT(*) AS n FROM scrobble')[0].n, 'files de Scrobble');
    cal(r.meta.includes('arrencada-escoltes'), 'la pestanya Meta no porta arrencada-escoltes: ' + r.meta.join(', '));
  } },
  { nom: 'excel: «Descarrega l\'Excel» a La Cabina baixa un .xlsx que es torna a llegir', async fes({ pagina }) {
    await pagina.click('#btAjustos'); await pagina.waitForTimeout(300);
    const [baixada] = await Promise.all([pagina.waitForEvent('download', { timeout: 10000 }), pagina.click('[data-excel]')]);
    cal(/^la-meva-discoteca \d{4}-\d{2}-\d{2}\.xlsx$/.test(baixada.suggestedFilename()), 'nom del fitxer: ' + baixada.suggestedFilename());
    const fs = await import('node:fs'), X = await import('../js/excel.js?v=1');
    const l = await X.llegeix(new Uint8Array(fs.readFileSync(await baixada.path())));
    igual(Object.keys(l).length, 9, 'pestanyes del fitxer baixat');
    await pagina.click('[data-tornafull]').catch(() => {});
  } },
  { nom: 'sense connexió: sw.js està al dia amb el codi que guarda', sempre: true, async fes() {
    const { estatSW } = await import('./sw.mjs');
    const e = estatSW();
    cal(!e.falten.length, 'falten a FITXERS de sw.js: ' + e.falten.join(', '));
    igual(e.versio, e.deuria, 'VERSIO de sw.js (passa «node proves/sw.mjs»)');
  } },
  { nom: 'sense connexió: la màquina s\'obre amb el codi guardat i la còpia del mòbil', sempre: true, async fes({ pagina, esperaDesat }) {
    const llest = await pagina.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]));
    cal(llest, 'no hi ha cap service worker registrat');
    await pagina.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 })
      .catch(async () => { await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 }); });
    const ctx = pagina.context();
    await ctx.setOffline(true);
    try {
      await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
      cal(await pagina.locator('#reixa .disc').count() > 0, 'sense connexió, Discos en Rotació surt buit');
      cal(await pagina.evaluate(() => document.body.classList.contains('desconnectat')), 'sense connexió, no diu que treballa amb la còpia del mòbil');
    } finally { await ctx.setOffline(false); }
    await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
    await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
    await esperaDesat();
  } },

  { nom: 'còpia: sense connexió, l\'exclamació dels 8 dies surt amb l\'última data que ha vist el mòbil; amb connexió, mana el Drive', async fes({ pagina, esperaDesat }) {
    const ctx = pagina.context();
    await pagina.evaluate(d => localStorage.setItem('tria-darrera-copia', d), new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 10));
    await ctx.setOffline(true);
    try {
      await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
      cal(await pagina.evaluate(() => document.body.classList.contains('sense-copia')), 'sense connexió, amb la darrera còpia vista fa 9 dies, no surt l\'exclamació');
    } finally { await ctx.setOffline(false); }
    await pagina.reload(); await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
    await pagina.waitForFunction(() => !document.body.classList.contains('sense-copia'), null, { timeout: 10000 });
    await esperaDesat();
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
