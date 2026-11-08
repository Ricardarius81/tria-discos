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
      const E = await import('./js/escoltes.js?v=12'); const A = await import('./js/arxiu.js?v=18');
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
    const v = await pagina.evaluate(async () => { const E = await import('./js/escoltes.js?v=12'); const A = await import('./js/arxiu.js?v=18'); return E.veredicte(A.estat.db); });
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
      const E = await import('./js/escoltes.js?v=12'); const A = await import('./js/arxiu.js?v=18');
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
    igual(await pagina.evaluate(async () => (await import('./js/arxiu.js?v=18')).estat.base), f.modifiedTime, 'la versió del Drive sobre la qual treballa');
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
    igual(await pagina.evaluate(async () => (await import('./js/arxiu.js?v=18')).estat.base), drive.per('la-meva-discoteca.sqlite').modifiedTime, 'la versió del Drive sobre la qual treballa');
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
  { nom: 'sessió oberta: la que s\'amaga surt ja a «Resoltes», «sonant fa poc», i el seu «Canvia» s\'obre', sintetic: true, async fes({ pagina }) {
    const fila = pagina.locator('#safataCos .sf-resolta', { hasText: 'Structures from Silence' });
    igual(await fila.count(), 1, 'files de «Resoltes» amb Structures from Silence');
    cal(/sonant fa poc/.test(await fila.innerText()), 'la fila no diu «sonant fa poc»: ' + await fila.innerText());
    await fila.locator('[data-sfresolta]').click(); await pagina.waitForTimeout(300);
    cal(await pagina.locator('#full.obert [data-sfreobre]').count() > 0, '«Canvia» d\'una sessió oberta no obre la fulla');
    await pagina.click('[data-tornafull]').catch(() => {}); await pagina.waitForTimeout(300);
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
      const A = await import('./js/arxiu.js?v=18');
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
      const n = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18');
        return A.estat.db.exec("SELECT COUNT(*) FROM scrobble WHERE album = 'Das Paradies und die Peri'")[0].values[0][0]; });
      quietes = n === 6 ? quietes + 1 : 0; await pagina.waitForTimeout(250);
    }
    // la tarda, Amor (les tres primeres); la nit, Dormir (la repetida, la quarta i la primera que torna)
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18'), E = await import('./js/escoltes.js?v=12');
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
      const A = await import('./js/arxiu.js?v=18');
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
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), E = await import('./js/escoltes.js?v=12');
      await A.canvia(db => { db.run('UPDATE edicio SET durada_total = 79 WHERE id = 11'); E.recalcula(db); }); });
  } },
  { nom: 'pregunta 2 (A): un disc en rotació amb un títol diferent (Bartók) es pregunta per l\'artista, no surt com a disc nou', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    const r0 = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18');
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
      const A = await import('./js/arxiu.js?v=18');
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
    await pagina.waitForFunction(async () => { const A = await import('./js/arxiu.js?v=18');
      return A.estat.db.exec("SELECT COUNT(*) FROM scrobble WHERE recording_msid LIKE 'msid-banc-ic%' AND escolta_id IS NOT NULL")[0].values[0][0] === 2; }, null, { timeout: 10000, polling: 250 });
    await pagina.waitForTimeout(1500); await esperaDesat();
    const partDe = msid => consulta(`SELECT e.part_id FROM scrobble s JOIN escolta e ON e.id = s.escolta_id WHERE s.recording_msid = '${msid}'`)[0]?.part_id;
    igual(partDe('msid-banc-ic1'), 931, 'Escolta.part_id del «volume 1» (la part 1, no la viva)');
    igual(partDe('msid-banc-ic2'), 932, 'Escolta.part_id de la pista sense número (la part viva)');
    // el cas d'abans de l'ACT-625: l'escolta del vol. 1 havia quedat a la part 2; en tornar a calcular hi torna sola
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18'), E = await import('./js/escoltes.js?v=12');
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
  { nom: 'safata: la targeta d\'una caixa diu la part que ha sonat i la seva durada, no la de la caixa', sintetic: true, async fes({ pagina, obreSafata }) {
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18'), E = await import('./js/escoltes.js?v=12');
      return E.targetes(A.estat.db, { estat: 'totes' }).flatMap(c => c.discos).filter(d => d.edicio_id === 922)
        .map(d => ({ nom: d.partNom, min: d.min, total: d.durada_total }));
    });
    igual(JSON.stringify(r.map(x => x.nom).sort()), '["Vol. 1","Vol. 2"]', 'Part.nom de cada targeta de la caixa (per Escolta.part_id)');
    cal(r.every(x => x.min === 30 && x.total === null), 'la durada de cada targeta hauria de ser la de la part (30′), no la de la caixa (90′): ' + JSON.stringify(r));
    await obreSafata(); await pagina.waitForTimeout(300);
    const t = (await pagina.locator('#s-safata').innerText()).replace(/\s+/g, ' ');
    cal(/D York · Vol\. 1/.test(t) && /D York · Vol\. 2/.test(t), 'la safata no diu «D York · Vol. 1» i «D York · Vol. 2»');
    cal(!/The Italian Chronicles D York[^·]*90′/.test(t), 'la safata encara ensenya els 90′ de la caixa');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
  // ───────── La Prestatgeria, primer bloc (ACT-622 a ACT-637) ─────────
  { nom: 'prestatgeria (ACT-637): Tots els discos, una fila per edició ordenada per artista; Stankonia surt dues vegades, 98′ i 112′', sintetic: true, async fes({ pagina, consulta }) {
    await pagina.click('[data-anar="prestatgeria"]'); await pagina.waitForSelector('#s-prestatgeria.activa'); await pagina.waitForTimeout(300);
    const n = consulta('SELECT COUNT(*) AS n FROM edicio')[0].n;
    igual(await pagina.locator('#arxiu .ar-fila').count(), n, 'files de Tots els discos (una per Edició)');
    const arts = await pagina.locator('#arxiu .ar-fila .hart').allInnerTexts();
    const nomArt = arts.map(a => a.split(' · ')[0]);
    igual(JSON.stringify(nomArt), JSON.stringify([...nomArt].sort((a, b) => a.localeCompare(b, 'ca', { sensitivity: 'base' }))), 'ordre per Artista.nom_canonic');
    const stk = await pagina.locator('#arxiu .ar-fila', { hasText: 'Stankonia' }).allInnerTexts();
    igual(stk.length, 2, 'files de Stankonia (dues edicions del mateix àlbum)');
    cal(stk.some(t => t.includes('98′')) && stk.some(t => t.includes('112′')), 'les dues Stankonia s\'haurien de distingir per Edició.Durada total: ' + JSON.stringify(stk));
  } },
  { nom: 'prestatgeria: el cercador troba per artista i per títol, sense filtres; la fila obre la mateixa fitxa del Faristol', sintetic: true, async fes({ pagina }) {
    cal(!(await pagina.locator('#q-tots select, #q-tots [data-filtre]').count()), 'Tots els discos no ha de portar filtres (ACT-636)');
    await pagina.fill('#cercaArxiu', 'outkast'); await pagina.waitForTimeout(200);
    igual(await pagina.locator('#arxiu .ar-fila').count(), 2, 'files en cercar «outkast»');
    await pagina.fill('#cercaArxiu', 'silent way'); await pagina.waitForTimeout(200);
    igual(await pagina.locator('#arxiu .ar-fila').count(), 1, 'files en cercar «silent way»');
    await pagina.locator('#arxiu .ar-fila').first().click(); await pagina.waitForTimeout(300);
    const t = await pagina.locator('#full').innerText();
    cal(t.includes('In a Silent Way') && t.includes('Durada') && t.includes('Canal') && t.includes('Nota'), 'la fila no obre la fitxa del disc: ' + t.slice(0, 120));
    cal(await pagina.locator('#full.complet').count() === 1, 'la fitxa ha de sortir a pantalla completa, com des del Faristol');
    await pagina.click('[data-tornafull]'); await pagina.fill('#cercaArxiu', ''); await pagina.waitForTimeout(150);
  } },
  { nom: 'caixa (ACT-624): la fitxa ensenya totes les parts amb el seu estat, i la portada de la part viva mana a la reixa i a Tots els discos', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol }) {
    // The Italian Chronicles (edició 922): la part 1 escoltada, la 2 viva, la 3 pendent. Part.Portada només a la 2.
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23');
      return A.canvia(D.posaPortadaPart(932, 'release/banc-vol-2')); });
    cal(r.desat, 'no s\'ha desat la portada de la part: ' + r.motiu);
    await esperaDesat(); await reobre(pagina);   // A.canvia no repinta
    igual(consulta('SELECT portada FROM part WHERE id = 932')[0].portada, 'release/banc-vol-2', 'Part.Portada de la part 2');
    igual(consulta('SELECT portada FROM edicio WHERE id = 922')[0].portada, null, 'Edició.Portada de la caixa (no s\'ha de tocar)');
    cal(consulta('SELECT data_darrera_escolta AS d FROM part WHERE id = 931')[0].d, 'la part 1 hauria de tenir Part.Data darrera escolta');
    // La imatge inventada no carrega i la pàgina la treu (onerror): es mira la portada que la pantalla rep per pintar.
    const pint = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23');
      return { reixa: D.rotacio(A.estat.db).find(e => e.id === 922)?.portada, edicio: D.fitxa(A.estat.db, 922)?.portada_edicio,
               tots: D.totsElsDiscos(A.estat.db).find(e => e.id === 922)?.portada }; });
    igual(pint.reixa, 'release/banc-vol-2', 'portada que pinta la reixa (la de la part viva)');
    igual(pint.tots, 'release/banc-vol-2', 'portada que pinta Tots els discos (la de la part viva)');
    igual(pint.edicio, null, 'la portada de l\'edició, a part');
    await tornaFaristol('rot');
    const tile = pagina.locator('#reixa .disc', { hasText: 'The Italian Chronicles' });
    await tile.locator('.coberta').click(); await pagina.waitForTimeout(300);
    igual(await pagina.locator('#full .part-fila').count(), 3, 'parts a la fitxa de la caixa');
    const est = await pagina.locator('#full .part-fila .estat-part').allInnerTexts();
    igual(est.join(','), 'escoltada,viva,pendent', 'estat de cada part (Part.Data darrera escolta, Part.Rotació actual)');
    igual(await pagina.locator('#full [data-portadapart]').count(), 3, '«canvia la portada» per part');
    await pagina.click('[data-tornafull]');
  } },
  { nom: 'caixa: «Treu-la» a la portada d\'una part la buida i torna a la de la caixa; l\'edició no es toca', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol }) {
    await tornaFaristol('rot');
    await pagina.locator('#reixa .disc', { hasText: 'The Italian Chronicles' }).locator('.coberta').click(); await pagina.waitForTimeout(300);
    await pagina.click('#full [data-portadapart="922:932"]'); await pagina.waitForTimeout(300);
    cal((await pagina.locator('#full').innerText()).includes('torna a fer servir la de la caixa'), 'la fulla de la portada de la part no diu que torna a la de la caixa');
    await pagina.click('#full [data-noportada="p932"]'); await esperaDesat();
    igual(consulta('SELECT portada FROM part WHERE id = 932')[0].portada, null, 'Part.Portada després de «Treu-la»');
    igual(consulta('SELECT portada_origen FROM edicio WHERE id = 922')[0].portada_origen, null, 'Edició.portada_origen (no l\'ha de marcar com a rebutjada)');
    await pagina.waitForTimeout(200);
    const tf = await pagina.locator('#full.obert').innerText().catch(e => 'ERR ' + e.message.slice(0, 80));
    if (!tf.includes('La caixa · 3 parts')) await pagina.click('[data-tornafull]').catch(() => {});
    cal(tf.includes('La caixa · 3 parts'), 'després de canviar la portada d\'una part s\'ha de tornar a la fitxa de la caixa, no a la pantalla de sota');
    await pagina.click('[data-tornafull]');
  } },
  { nom: 'llistes (ACT-632): les cançons soltes d\'una sessió es fan llista només amb el nom; llista_canco en ordre amb la durada, i Scrobble.llista_id apuntat', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    // Una sessió de fa 8 h 20 min a la compte personal, lliure a les dues comptes: quatre cançons soltes de 3′, cadascuna d'un àlbum.
    const t0 = Date.now() - (8 * 60 + 20) * 60e3, m = 60e3;
    const c = (i, t, nom, album) => ({ compte: 'crimsonnnn', listened_at: Math.floor(t / 1000), recording_msid: 'msid-banc-ll' + i,
      track_metadata: { artist_name: 'Händel', track_name: nom, release_name: album, additional_info: { duration_ms: 3 * m } } });
    lb.escoltes.push(c(1, t0, 'Ombra mai fù', 'Serse (Aria)'), c(2, t0 + 3 * m, 'Lascia ch\'io pianga', 'Rinaldo (Aria)'),
      c(3, t0 + 6 * m, 'Ev\'ry valley', 'Messiah (Aria)'), c(4, t0 + 9 * m, 'Piangerò', 'Giulio Cesare (Aria)'));
    await obreSafata(); await pagina.waitForTimeout(800); await esperaDesat();
    const card = pagina.locator('#safataCos .sf-card', { hasText: 'Serse (Aria)' });
    const bt = card.locator('[data-sfllistaobre]', { hasText: 'Això és una llista' });
    igual(await bt.count(), 1, 'botó «Això és una llista» a la targeta de les cançons soltes');
    await bt.click(); await pagina.fill('#inLlista', 'AA Händel'); await pagina.click('[data-sfllistanova]'); await esperaDesat();
    igual(JSON.stringify(consulta('SELECT nom FROM llista').map(x => x.nom)), '["AA Händel"]', 'Llista.Nom');
    const cs = consulta('SELECT posicio, recording_msid, pista, durada_ms FROM llista_canco ORDER BY posicio');
    igual(cs.map(x => x.recording_msid).join(','), 'msid-banc-ll1,msid-banc-ll2,msid-banc-ll3,msid-banc-ll4', 'llista_canco en l\'ordre en què van sonar');
    cal(cs.every(x => x.durada_ms === 180000), 'llista_canco.durada_ms hauria de ser la Scrobble.duration_ms (180000): ' + JSON.stringify(cs));
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE recording_msid LIKE 'msid-banc-ll%' AND llista_id IS NOT NULL")[0].n, 4, 'Scrobble.llista_id apuntat');
    cal((await card.innerText()).includes('Llista · AA Händel · 4 cançons'), 'la targeta no diu «Llista · AA Händel · 4 cançons»');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
  { nom: 'llistes (ACT-633 i ACT-634): una sessió amb 3 cançons de la llista la proposa amb un toc, i la cançó nova s\'hi afegeix sola al final', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    const t0 = Date.now() - (7 * 60 + 30) * 60e3, m = 60e3;   // 38 minuts després de l'altra: una sessió nova
    const c = (msid, t, nom, album) => ({ compte: 'crimsonnnn', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'Händel', track_name: nom, release_name: album, additional_info: { duration_ms: 3 * m } } });
    lb.escoltes.push(c('msid-banc-ll2', t0, 'Lascia ch\'io pianga', 'Rinaldo (Aria)'), c('msid-banc-ll1', t0 + 3 * m, 'Ombra mai fù', 'Serse (Aria)'),
      c('msid-banc-ll5', t0 + 6 * m, 'Dopo notte', 'Ariodante (Aria)'), c('msid-banc-ll4', t0 + 9 * m, 'Piangerò', 'Giulio Cesare (Aria)'));
    await obreSafata(); await pagina.waitForTimeout(800); await esperaDesat();
    const card = pagina.locator('#safataCos .sf-card', { hasText: 'Ariodante (Aria)' });
    const si = card.locator('[data-sfllistasi]');
    igual(await si.count(), 1, 'proposta de la llista reconeguda');
    igual((await si.innerText()).trim(), 'Sí, és AA Händel · s\'hi afegeix una cançó', 'text del botó');
    await si.click(); await esperaDesat();
    const cs = consulta('SELECT posicio, recording_msid FROM llista_canco ORDER BY posicio');
    igual(cs.map(x => x.posicio + ':' + x.recording_msid).join(','), '1:msid-banc-ll1,2:msid-banc-ll2,3:msid-banc-ll3,4:msid-banc-ll4,5:msid-banc-ll5', 'la cançó nova, al final (llista_canco.posicio)');
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE recording_msid LIKE 'msid-banc-ll%' AND llista_id IS NULL")[0].n, 0, 'pistes de les dues sessions sense Scrobble.llista_id');
    await pagina.click('[data-tornasafata]').catch(() => {});
  } },
  { nom: 'llistes (ACT-633): el llindar és 3 cançons, o totes si la sessió en té menys; i «Això és una llista» amb un nom que ja existeix hi afegeix', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18'), L = await import('./js/llistes.js?v=1');
      const ids = [];
      // pistes de fa nou dies, ignorades perquè no surtin a la safata: el llindar no mira l'estat
      await A.canvia(db => {
        const t = d => new Date(Date.now() - 9 * 864e5 + d * 60e3).toISOString();
        const fa = [['ll1', 0, 180000], ['ll2', 3, 180000], ['x1', 6, 180000], ['ll3', 9, 180000], ['x2', 12, null], ['x3', 15, 200000]];
        for (const [k, d, dur] of fa) { db.run(`INSERT INTO scrobble (compte, listened_at, artista, pista, album, duration_ms, recording_msid, estat) VALUES ('crimsonnnn', ?, 'Banc', ?, ?, ?, ?, 'ignorat')`,
          [t(d), k, 'Àlbum ' + k, dur, 'msid-banc-' + k]); ids.push(db.exec('SELECT last_insert_rowid()')[0].values[0][0]); }
      });
      const db = A.estat.db, [a1, a2, b1, a3, b2, b3] = ids;
      const p = x => L.deLaSessio(db, x).proposta?.nom || null;
      const out = { dues: p([a1, a2]), duesIUnaAltra: p([a1, a2, b1]), tres: p([a1, a2, b1, a3]), una: p([a1]) };
      let c; await A.canvia(d => { c = L.crea('Prova', [b1, b2, b3])(d); });
      let c2; await A.canvia(d => { c2 = L.crea('  prova ', [a1])(d); });
      out.crea = c; out.crea2 = c2; out.n = db.exec("SELECT COUNT(*) FROM llista WHERE nom = 'Prova'")[0].values[0][0];
      return out;
    });
    igual(r.dues, 'AA Händel', 'sessió de 2 cançons, totes dues a la llista (menys de 3: totes)');
    igual(r.una, 'AA Händel', 'sessió d\'una cançó que és a la llista');
    igual(r.duesIUnaAltra, null, 'sessió de 3 cançons amb només 2 a la llista (no arriba a 3)');
    igual(r.tres, 'AA Händel', 'sessió de 4 cançons amb 3 a la llista');
    igual(r.crea.noves, 3, 'cançons de la llista nova «Prova»');
    cal(r.crea2.existia && r.crea2.noves === 1 && r.n === 1, '«Això és una llista» amb el nom «prova» ha d\'afegir a «Prova», no fer-ne una de bessona: ' + JSON.stringify(r.crea2));
  } },
  { nom: 'agrupacions (ACT-635): els grups i les llistes amb mosaic; la llista amb cançons, última escolta i durada total (incompleta amb «+»), la més recent primer', sintetic: true, async fes({ pagina }) {
    await pagina.click('[data-anar="prestatgeria"]'); await pagina.click('[data-psub="agr"]'); await pagina.waitForTimeout(300);
    const t = await pagina.locator('#agrupacions').innerText();
    cal(/Grups[\s\S]*Careful Now/.test(t), 'falta el grup Careful Now a Agrupacions');
    const ls = await pagina.locator('#agrupacions [data-llista]').allInnerTexts();
    igual(ls.length, 2, 'llistes a Agrupacions');
    cal(ls[0].includes('AA Händel') && ls[0].includes('5 cançons') && ls[0].includes('15′'), 'la primera ha de ser AA Händel, 5 cançons, 15′: ' + JSON.stringify(ls[0]));
    cal(ls[1].includes('Prova') && ls[1].includes('+'), 'la segona ha de ser Prova, amb la durada incompleta («+»): ' + JSON.stringify(ls[1]));
    const files_ = await pagina.locator('#agrupacions .ag-fila').count();
    cal(files_ >= 3, 'files a Agrupacions (grups i llistes): ' + files_);
    igual(await pagina.locator('#agrupacions .ag-fila .collage').count(), files_, 'un mosaic a cada fila d\'Agrupacions');
  } },
  { nom: 'agrupacions: la fitxa de la llista canvia el nom, treu una cançó tornant a numerar, i «Esborra la llista» deixa les cançons soltes', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#agrupacions [data-llista]', { hasText: 'AA Händel' }).click(); await pagina.waitForTimeout(300);
    igual(await pagina.locator('#full .canco').count(), 5, 'cançons a la fitxa de la llista');
    cal(!(await pagina.locator('#full .play, #full a.escoltar').count()), 'la fitxa de la llista no porta ▶ (viu a Amazon o YouTube)');
    await pagina.click('#full [data-nomllista]'); await pagina.fill('#inNomLlista', 'AA Händel 2026'); await pagina.click('[data-desanomllista]'); await esperaDesat();
    igual(consulta('SELECT nom FROM llista WHERE id = (SELECT llista_id FROM llista_canco WHERE recording_msid = \'msid-banc-ll5\')')[0].nom, 'AA Händel 2026', 'Llista.Nom després de canviar-lo');
    await pagina.locator('#full .canco', { hasText: 'Ev\'ry valley' }).locator('[data-treucanco]').click(); await esperaDesat();
    const cs = consulta('SELECT posicio, recording_msid FROM llista_canco WHERE llista_id = (SELECT id FROM llista WHERE nom = \'AA Händel 2026\') ORDER BY posicio');
    igual(cs.map(x => x.posicio + ':' + x.recording_msid).join(','), '1:msid-banc-ll1,2:msid-banc-ll2,3:msid-banc-ll4,4:msid-banc-ll5', 'posicions després de treure Ev\'ry valley');
    await pagina.click('[data-tornafull]');
    const prova = consulta("SELECT id FROM llista WHERE nom = 'Prova'")[0].id;
    await pagina.locator('#agrupacions [data-llista]', { hasText: 'Prova' }).click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-esborrallista]'); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM llista WHERE id = ?', [prova])[0].n, 0, 'la llista Prova, esborrada');
    igual(consulta('SELECT COUNT(*) AS n FROM llista_canco WHERE llista_id = ?', [prova])[0].n, 0, 'les cançons de Prova, esborrades');
    igual(consulta('SELECT COUNT(*) AS n FROM scrobble WHERE llista_id = ?', [prova])[0].n, 0, 'Scrobble.llista_id de Prova, buidat');
    igual(await pagina.locator('#agrupacions [data-llista]').count(), 1, 'llistes a Agrupacions després d\'esborrar Prova');
    await pagina.click('[data-anar="faristol"]');
  } },
  { nom: 'llistes (opció C, 7-11): dues cançons del mateix àlbum no fan néixer un disc si una és d\'una llista (llista_canco.recording_msid)', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18'), L = await import('./js/llistes.js?v=1'), E = await import('./js/escoltes.js?v=12');
      const t = d => new Date(Date.now() - 9 * 864e5 - 60 * 60e3 + d * 60e3).toISOString();
      const posa = (db, k, d) => { db.run(`INSERT INTO scrobble (compte, listened_at, artista, pista, album, duration_ms, recording_msid, estat, context) VALUES ('crimsonnnn', ?, 'Händel', ?, 'Messiah (Chorus)', 180000, ?, 'resolt', 'Treballant')`,
        [t(d), 'Cor ' + k, 'msid-banc-' + k]); return db.exec('SELECT last_insert_rowid()')[0].values[0][0]; };
      let a, l; await A.canvia(db => { a = posa(db, 'll6', 0); l = L.crea('AA Messiah', [a])(db).id; posa(db, 'll7', 40); });
      const db = A.estat.db, clau = 'messiahchorus';
      const ambLlista = { nou: E.discosNous(db).nous.some(x => x.clau === clau), solta: E.discosNous(db).soltes.some(x => x.clau === clau) };
      await A.canvia(d => L.esborra(l)(d));
      const senseLlista = { nou: E.discosNous(db).nous.some(x => x.clau === clau) };
      await A.canvia(d => d.run("DELETE FROM scrobble WHERE recording_msid IN ('msid-banc-ll6', 'msid-banc-ll7')"));
      return { ambLlista, senseLlista };
    });
    cal(!r.ambLlista.nou && r.ambLlista.solta, 'amb una de les dues a la llista, «Messiah (Chorus)» ha de quedar com a cançó solta: ' + JSON.stringify(r.ambLlista));
    cal(r.senseLlista.nou, 'sense la llista, les dues cançons sí que fan néixer el disc (la regla de l\'ACT-461 no canvia)');
  } },
  { nom: 'esborrar (7-11): «Esborra aquest disc» només surt sense rastre (escoltes, nota, rotació, preferent, grup) i esborra l\'edició, les parts i l\'àlbum buit', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const ids = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18');
      let r; await A.canvia(db => {
        const art = db.exec("SELECT id FROM artista WHERE nom_canonic = 'Jordi Savall'")[0].values[0][0];
        db.run("INSERT INTO album (titol, artista_id) VALUES ('Das Paradies und die Peri', ?)", [art]);
        const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run('INSERT INTO edicio (album_id, durada_total) VALUES (?, 99)', [al]);
        r = { album: al, edicio: db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
        db.run("INSERT INTO part (edicio_id, numero, nom, durada) VALUES (?, 1, 'CD 1', 50)", [r.edicio]);
      }); return r; });
    await esperaDesat(); await reobre(pagina);
    // un disc amb escoltes fora de rotació no es pot esborrar, i es diu per què
    const silent = consulta("SELECT e.id FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.titol = 'In a Silent Way'")[0].id;
    await pagina.click('[data-anar="prestatgeria"]'); await pagina.click('[data-psub="tots"]');
    await pagina.locator(`#arxiu [data-fitxa="${silent}"]`).click(); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#full [data-esborradisc]').count(), 0, 'botó d\'esborrar a In a Silent Way (té escoltes)');
    cal((await pagina.locator('#full').innerText()).includes('No es pot esborrar: té'), 'la fitxa no diu per què no es pot esborrar');
    await pagina.click('[data-tornafull]');
    await pagina.locator(`#arxiu [data-fitxa="${ids.edicio}"]`).click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-esborradisc]'); await pagina.click('#full [data-esborradiscsi]'); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM edicio WHERE id = ?', [ids.edicio])[0].n, 0, 'l\'edició esborrada');
    igual(consulta('SELECT COUNT(*) AS n FROM part WHERE edicio_id = ?', [ids.edicio])[0].n, 0, 'les seves parts');
    igual(consulta('SELECT COUNT(*) AS n FROM album WHERE id = ?', [ids.album])[0].n, 0, 'l\'àlbum sense edicions');
    igual(consulta("SELECT COUNT(*) AS n FROM artista WHERE nom_canonic = 'Jordi Savall'")[0].n, 1, 'l\'artista es queda');
    igual(await pagina.locator(`#arxiu [data-fitxa="${ids.edicio}"]`).count(), 0, 'la fila a Tots els discos');
    await pagina.click('[data-anar="faristol"]');
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
    const id = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23');
      let r; await A.canvia(db => { r = D.posaEnRotacio({ art: 'Miles Davis', tit: 'Sketches of Spain', min: 41, canal: 'youtube' })(db); }); return r.id; });
    await esperaDesat();
    igual(proper(), 'Kind of Blue', 'preferent.proper_titol després d\'entrar un altre disc seu');
    await reobre(pagina); await tornaFaristol('pref');   // A.canvia no repinta: es torna a obrir
    let t = await pagina.locator('#files').innerText();
    cal(/Ara estudies\s+Sketches of Spain/.test(t) && !t.includes('El proper: Kind of Blue'), 'amb disc en rotació el proper no s\'ha de pintar: ' + JSON.stringify(t));
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23'); await A.canvia(D.treu(id)); }, id);
    await esperaDesat(); await reobre(pagina); await tornaFaristol('pref');
    t = await pagina.locator('#files').innerText();
    cal(t.includes('El proper: Kind of Blue'), 'sense disc en rotació el proper havia de tornar: ' + t.slice(0, 200));
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23');
      await A.canvia(D.posaEnRotacio({ art: 'Miles Davis', tit: 'kind of blue', min: 46, canal: 'youtube' })); });
    await esperaDesat();
    igual(proper(), null, 'preferent.proper_titol després d\'entrar el mateix disc (amb majúscules diferents)');
  } },
  // ───────── el disc anterior i el següent d'un preferent (ACT-626, ACT-627, ACT-646 a ACT-652) ─────────
  { nom: 'veïns (ACT-627): a la pantalla de l\'artista el proper surt sota «Ara estudies» i a la fila continua amagat; hi ha anterior i següent (ACT-646)', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol }) {
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23'); await A.canvia(D.posaProper(2, 'Bitches Brew')); });
    await esperaDesat(); await reobre(pagina); await tornaFaristol('pref');
    igual(consulta('SELECT proper_titol AS t FROM preferent WHERE id = 2')[0].t, 'Bitches Brew', 'preferent.proper_titol de Miles Davis');
    const fila = await pagina.locator('#files').innerText();
    cal(!fila.includes('Bitches Brew'), 'a la fila, amb disc en rotació, el proper ha de seguir amagat: ' + JSON.stringify(fila.slice(0, 200)));
    await pagina.click('[data-artista="2"]'); await pagina.waitForSelector('#s-artista.activa');
    const t = await pagina.locator('#s-artista').innerText();
    cal(/Ara estudies kind of blue/i.test(t) && t.includes('El proper: Bitches Brew'), 'a la pantalla de l\'artista falten «Ara estudies» i el proper: ' + JSON.stringify(t.slice(0, 300)));
    cal(t.includes('Disc anterior') && t.includes('Disc següent') && !t.includes('Tria de la discografia'), 'amb partida han de sortir anterior i següent, no la discografia: ' + JSON.stringify(t.slice(0, 400)));
  } },
  { nom: 'veïns (ACT-647, 651, 652): següent des de la Wikipedia salta el recopilatori, avisa del proper que substitueix i el desa amb «Desfés»; anterior, un directe', sintetic: true, async fes({ pagina, consulta, esperaDesat, fonts }) {
    const ib = (name, type, prev, next) => `{{Infobox album\n| name = ${name}\n| type = ${type}\n| artist = [[Miles Davis]]\n| chronology = [[Miles Davis discography|Miles Davis]]\n${prev ? `| prev_title = ''[[${prev}]]''\n| prev_year = 1958\n` : ''}${next ? `| next_title = ''[[${next}]]''\n| next_year = 1960\n` : ''}}}`;
    fonts.actiu = true;
    fonts.wp.cerques['kind of blue'] = ['Kind of Blue (disambiguation)', 'Kind of Blue'];
    fonts.wp.pagines['Kind of Blue'] = ib('Kind of Blue', 'studio', 'Jazz at the Plaza', "Miles Davis' Greatest Hits");
    fonts.wp.pagines["Miles Davis' Greatest Hits"] = ib("Miles Davis' Greatest Hits", 'compilation', 'Kind of Blue', 'Sketches of Spain (album)');
    fonts.wp.pagines['Sketches of Spain (album)'] = ib('Sketches of Spain', 'studio', "Miles Davis' Greatest Hits", null);
    fonts.wp.pagines['Jazz at the Plaza'] = ib('Jazz at the Plaza', 'live', null, 'Kind of Blue');
    try {
      await pagina.click('[data-vei="2:seg"]'); await pagina.waitForSelector('#veins [data-triavei]', { timeout: 15000 });
      let t = await pagina.locator('#full').innerText();
      cal(t.includes('Sketches of Spain') && t.includes('Segons la Wikipedia') && !t.includes('Greatest Hits'), 'el següent havia de ser Sketches of Spain, segons la Wikipedia, sense el recopilatori: ' + JSON.stringify(t));
      cal(/Substitueix «Bitches Brew»/.test(await pagina.locator('#full .substitueix').innerText()), 'falta l\'avís «Substitueix «Bitches Brew»» abans de triar');
      await pagina.click('#veins [data-triavei="0"]'); await esperaDesat();
      igual(consulta('SELECT proper_titol AS t FROM preferent WHERE id = 2')[0].t, 'Sketches of Spain', 'preferent.proper_titol després de triar el següent');
      cal(await pagina.isVisible('#avisBt'), 'després de triar, l\'avís ha de portar «Desfés»');
      await pagina.click('#avisBt'); await esperaDesat();
      igual(consulta('SELECT proper_titol AS t FROM preferent WHERE id = 2')[0].t, 'Bitches Brew', 'preferent.proper_titol després de «Desfés»');
      await pagina.click('[data-vei="2:ant"]'); await pagina.waitForSelector('#veins [data-triavei]', { timeout: 15000 });
      t = await pagina.locator('#veins').innerText();
      cal(t.includes('Jazz at the Plaza') && t.includes('directe'), 'l\'anterior havia de ser el directe Jazz at the Plaza: ' + JSON.stringify(t));
      await pagina.click('[data-tornafull]');
    } finally { fonts.actiu = false; }
  } },
  { nom: 'veïns (ACT-648, 651, 652): dos discos en rotació pregunten «Des de quin?»; una fitxa d\'un altre artista passa a MusicBrainz, que deixa fora remescles i recopilatoris', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol, fonts }) {
    fonts.actiu = true;
    fonts.wp.cerques['careful now'] = ['Careful Now'];
    fonts.wp.pagines['Careful Now'] = `{{Infobox album\n| name = Careful Now\n| type = studio\n| artist = [[Someone Else]]\n| prev_title = [[Something]]\n| next_title = [[Other]]\n}}`;
    fonts.mb.artistes['James Murray'] = [{ id: 'mb-jm', name: 'James Murray', disambiguation: 'UK ambient' }];
    const g = (id, title, d, p, s = []) => ({ id, title, 'first-release-date': d, 'primary-type': p, 'secondary-types': s });
    fonts.mb.grups['mb-jm'] = [g('g6', 'Killing Ground', '2015-03-01', 'Album', ['Live']), g('g1', 'Floods', '2010-01-01', 'Album'), g('g2', 'Collected', '2011-01-01', 'Album', ['Compilation']),
      g('g3', 'Careful Now', '2012-05-01', 'Album'), g('g4', 'Careful Now Remixed', '2013-01-01', 'Album', ['Remix']), g('g5', 'Mount Ida Lights', '2014-02-01', 'EP'), g('g7', 'Single', '2014-06-01', 'Single')];
    try {
      await tornaFaristol('pref'); await pagina.click('[data-artista="3"]'); await pagina.waitForSelector('#s-artista.activa');
      await pagina.click('[data-vei="3:seg"]'); await pagina.waitForSelector('[data-veides]');
      igual(await pagina.locator('[data-veides]').count(), 2, 'files de «Des de quin?» (Careful Now i Careful Now (Unmasked), tots dos en rotació)');
      await pagina.evaluate(() => [...document.querySelectorAll('[data-veides]')].find(b => b.firstChild.textContent.trim() === 'Careful Now').click());
      await pagina.waitForSelector('#veins [data-triavei]', { timeout: 20000 });
      let t = await pagina.locator('#full').innerText();
      cal(t.includes('Mount Ida Lights') && t.includes('Killing Ground') && t.includes('Segons MusicBrainz'), 'el següent havia de sortir de MusicBrainz amb l\'EP i el directe: ' + JSON.stringify(t));
      cal(!t.includes('Remixed') && !t.includes('Collected') && !/\bSingle\b/.test(t), 'les remescles, els recopilatoris i els senzills no hi han de ser: ' + JSON.stringify(t));
      cal(t.includes('d\'un altre artista'), 'havia de dir per què no ha servit la Wikipedia (cas 3): ' + JSON.stringify(t));
      cal(!(await pagina.locator('#full .substitueix').count()), 'James Murray no té proper: no hi ha res a substituir');
      await pagina.click('#veins [data-triavei="0"]'); await esperaDesat();
      igual(consulta('SELECT proper_titol AS t FROM preferent WHERE id = 3')[0].t, 'Mount Ida Lights', 'preferent.proper_titol de James Murray');
      await pagina.click('[data-vei="3:ant"]'); await pagina.waitForSelector('[data-veides]');
      await pagina.evaluate(() => [...document.querySelectorAll('[data-veides]')].find(b => b.firstChild.textContent.trim() === 'Careful Now').click());
      await pagina.waitForSelector('#veins [data-triavei]', { timeout: 20000 });
      t = await pagina.locator('#veins').innerText();
      cal(t.includes('Floods') && !t.includes('Collected'), 'l\'anterior havia de ser Floods, sense el recopilatori: ' + JSON.stringify(t));
      cal(/Substitueix «Mount Ida Lights»/.test(await pagina.locator('#full .substitueix').innerText()), 'ara sí que hi ha un proper a substituir');
      await pagina.click('[data-tornafull]');
      await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23'); await A.canvia(D.posaProper(3, null)); });
      await esperaDesat();
    } finally { fonts.actiu = false; }
  } },
  { nom: 'veïns (ACT-649, 650): sense partida, «Tria de la discografia» amb els homònims a triar; sense connexió, «Sense connexió»; l\'última escolta resolta fa de partida', sintetic: true, async fes({ pagina, consulta, esperaDesat, tornaFaristol, fonts }) {
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18');
      await A.canvia(db => { db.run("INSERT INTO artista (id, nom_canonic) VALUES (930, 'Federico Durand')"); db.run('INSERT INTO preferent (id, artista_id, ordre) VALUES (930, 930, 99)'); }); });
    await esperaDesat(); await reobre(pagina); await tornaFaristol('pref');
    await pagina.click('[data-artista="930"]'); await pagina.waitForSelector('#s-artista.activa');
    let t = await pagina.locator('#s-artista').innerText();
    cal(t.includes('Tria de la discografia') && !t.includes('Disc anterior'), 'sense partida, només «Tria de la discografia»: ' + JSON.stringify(t.slice(0, 400)));
    fonts.actiu = true;
    fonts.mb.artistes['Federico Durand'] = [{ id: 'mb-fd1', name: 'Federico Durand', disambiguation: 'Argentine ambient' }, { id: 'mb-fd2', name: 'Federico Durand', disambiguation: 'footballer' }];
    fonts.mb.grups['mb-fd1'] = [{ id: 'f2', title: 'Pequeñas melodías', 'first-release-date': '2015', 'primary-type': 'Album', 'secondary-types': [] },
      { id: 'f1', title: 'El idioma de las luciérnagas', 'first-release-date': '2011', 'primary-type': 'Album', 'secondary-types': [] },
      { id: 'f3', title: 'Lo mejor', 'first-release-date': '2019', 'primary-type': 'Album', 'secondary-types': ['Compilation'] }];
    try {
      await pagina.click('[data-discografia="930"]'); await pagina.waitForSelector('#veins [data-veimb]', { timeout: 15000 });
      igual(await pagina.locator('#veins [data-veimb]').count(), 2, 'homònims de MusicBrainz per triar');
      await pagina.click('#veins [data-veimb="mb-fd1"]'); await pagina.waitForSelector('#veins [data-triavei]', { timeout: 15000 });
      t = await pagina.locator('#veins').innerText();
      cal(t.indexOf('El idioma de las luciérnagas') >= 0 && t.indexOf('El idioma') < t.indexOf('Pequeñas melodías') && !t.includes('Lo mejor'), 'la discografia, per data i sense el recopilatori: ' + JSON.stringify(t));
      await pagina.click('[data-tornafull]');
      const ctx = pagina.context(); await ctx.setOffline(true);
      try {
        await pagina.click('[data-discografia="930"]'); await pagina.waitForSelector('#veins');
        await pagina.waitForFunction(() => /Sense connexió/.test(document.getElementById('veins')?.textContent || ''), null, { timeout: 5000 });
      } finally { await ctx.setOffline(false); }
      await pagina.click('[data-tornafull]');
    } finally { fonts.actiu = false; }
    // L'última escolta resolta (ACT-649): la de fa 40 dies compta; la de fa 39, amb una pista pendent a la safata, no.
    const pv = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), D = await import('./js/dades.js?v=23');
      const fa = d => new Date(Date.now() - d * 864e5).toISOString();
      await A.canvia(db => {
        db.run("INSERT INTO album (id, titol, artista_id) VALUES (930, 'La niña dormida', 930), (931, 'Jardín de invierno', 930)");
        db.run('INSERT INTO edicio (id, album_id, durada_total, rotacio_actual) VALUES (930, 930, 40, 0), (931, 931, 42, 0)');
        db.run('INSERT INTO escolta (id, edicio_id, data_hora, completitud) VALUES (930, 930, ?, 1), (931, 931, ?, 1)', [fa(40), fa(39)]);
        db.run("INSERT INTO scrobble (id, compte, listened_at, artista, pista, album, recording_msid, estat, escolta_id) VALUES (930, 'crimsonnnn', ?, 'Federico Durand', 'Pista', 'Jardín de invierno', 'msid-banc-930', 'pendent', 931)", [fa(39)]);
      });
      const r = D.partidesVei(A.estat.db, 930); return { de: r.de, titol: r.discos[0]?.titol };
    });
    await esperaDesat();
    igual(JSON.stringify(pv), JSON.stringify({ de: 'escolta', titol: 'La niña dormida' }), 'partida de Federico Durand (Escolta.data_hora, sense la que espera a la safata)');
    // Es treu tot el que s'ha posat, perquè les comprovacions de després trobin l'arxiu com era.
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18');
      await A.canvia(db => { db.run('DELETE FROM scrobble WHERE id = 930'); db.run('DELETE FROM escolta WHERE id IN (930, 931)'); db.run('DELETE FROM edicio WHERE id IN (930, 931)');
        db.run('DELETE FROM album WHERE id IN (930, 931)'); db.run('DELETE FROM preferent WHERE id = 930'); db.run('DELETE FROM artista WHERE id = 930'); }); });
    await esperaDesat(); await reobre(pagina);
    igual(consulta('SELECT COUNT(*) AS n FROM artista WHERE id = 930')[0].n, 0, 'Federico Durand, tret després de la prova');
  } },
  // ───────── L'Afinació (v1.49, ACT-656 a ACT-686) ─────────
  { nom: 'afinació (ACT-681): l\'arxiu és a l\'estructura 8, amb Edició.per_afinar', sempre: true, async fes({ consulta }) {
    igual(consulta('PRAGMA user_version')[0].user_version, 8, 'estructura de l\'arxiu');
    cal(consulta('PRAGMA table_info(edicio)').some(c => c.name === 'per_afinar'), 'Edició no té la columna per_afinar');
  } },
  { nom: 'afinació (ACT-683, ACT-686): una fila per edició sense gènere, per escoltes que compten (SQL_COMPTA), i cada fila diu el seu motiu', sintetic: true, async fes({ pagina, consulta }) {
    const sense = consulta('SELECT COUNT(*) AS n FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.generes IS NULL')[0].n;
    await pagina.click('[data-anar="prestatgeria"]'); await pagina.click('[data-psub="afi"]'); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#afinacio .afi-fila').count(), sense, 'files de L\'Afinació (edicions amb Àlbum.Gènere buit)');
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), F = await import('./js/afinacio.js?v=1'); return F.llistaAfinacio(A.estat.db); });
    cal(r.resta.every((x, i, l) => !i || l[i - 1].escoltes >= x.escoltes), 'la resta no va per escoltes que compten: ' + r.resta.map(x => x.escoltes).join(','));
    cal(r.resta[0].escoltes > 0, 'la primera fila hauria de ser una amb escoltes que compten');
    const ids = await pagina.locator('#afinacio .afi-fila').evaluateAll(l => l.map(b => +b.dataset.fitxa));
    igual(ids.join(','), [...r.marcats, ...r.resta].map(x => x.id).join(','), 'l\'ordre de la pantalla');
    cal((await pagina.locator('#afinacio .afi-fila').first().innerText()).includes('sense gènere'), 'la fila no diu «sense gènere»');
  } },
  { nom: 'gènere (ACT-684): «posa-li gènere» a la fitxa; l\'ordre dels tocs és l\'ordre d\'Àlbum.Gènere, es reordena, i el disc surt de L\'Afinació', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#afinacio [data-fitxa="1"]').click(); await pagina.waitForTimeout(250);
    cal((await pagina.locator('#full .fila-genere').innerText()).includes('Gènere'), 'la fitxa no porta la línia «Gènere»');
    await pagina.click('#full [data-generefitxa]');
    await pagina.click('#full [data-genbr="Ambient"]'); await pagina.click('#full [data-genbr="New Age"]'); await pagina.click('#full [data-genbr="Pop"]');
    await pagina.click('#full [data-gentreu="2"]');      // treu Pop
    await pagina.click('#full [data-genamunt="1"]');     // New Age, primera
    igual(await pagina.locator('#full [data-genll]').count(), 0, 'eixos de la clàssica sense «Clàssica»');
    await pagina.click('#full [data-desagenere]'); await esperaDesat();
    igual(consulta('SELECT generes FROM album WHERE id = 1')[0].generes, '["New Age","Ambient"]', 'Àlbum.Gènere, ordenat');
    cal((await pagina.locator('#full .fila-genere').innerText()).includes('New Age · Ambient'), 'la fitxa no ensenya el gènere desat');
    await pagina.click('[data-tornafull]');
    igual(await pagina.locator('#afinacio [data-fitxa="1"]').count(), 0, 'Angel\'s Flight encara és a L\'Afinació');
  } },
  { nom: 'gènere (ACT-684): amb «Clàssica» surten Llenguatge, Formació i Instrument solista; sense els dos eixos es queda a L\'Afinació; treure «Clàssica» els esborra', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    await pagina.locator('#afinacio [data-fitxa="7"]').click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-generefitxa]');
    cal((await pagina.locator('#full').innerText()).includes('canvia a les 2 edicions'), 'no avisa que el gènere és de l\'àlbum i canvia a les dues edicions');
    await pagina.click('#full [data-genbr="Clàssica"]');
    igual(await pagina.locator('#full [data-genll]').count(), 3, 'llenguatges');
    igual(await pagina.locator('#full [data-genfo]').count(), 8, 'formacions');
    await pagina.click('#full [data-genfo="orquestral"]'); await pagina.click('#full [data-genfo="instrument sol"]');
    await pagina.fill('#inInstrument', 'piano');
    await pagina.click('#full [data-desagenere]'); await esperaDesat();
    const a = consulta('SELECT generes, llenguatge, formacio, instrument_solista FROM album WHERE id = 7')[0];
    igual(JSON.stringify(a), JSON.stringify({ generes: '["Clàssica"]', llenguatge: null, formacio: '["orquestral","instrument sol"]', instrument_solista: 'piano' }), 'Àlbum amb Clàssica sense llenguatge');
    await pagina.click('[data-tornafull]');
    for (const id of [7, 8]) cal((await pagina.locator(`#afinacio [data-fitxa="${id}"]`).innerText()).includes('falten llenguatge / formació'), `l'edició ${id} no diu «falten llenguatge / formació»`);
    await pagina.locator('#afinacio [data-fitxa="8"]').click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-generefitxa]'); await pagina.click('#full [data-genll="Canon"]'); await pagina.click('#full [data-desagenere]'); await esperaDesat();
    await pagina.click('[data-tornafull]');
    igual(await pagina.locator('#afinacio [data-fitxa="7"], #afinacio [data-fitxa="8"]').count(), 0, 'Stankonia surt de L\'Afinació per les dues edicions');
    // treure Clàssica i desar esborra llenguatge, formació i instrument
    await pagina.click('[data-psub="tots"]'); await pagina.locator('#arxiu [data-fitxa="7"]').click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-generefitxa]'); await pagina.click('#full [data-genbr="Clàssica"]'); await pagina.click('#full [data-genbr="Rap / Hip-hop"]');
    await pagina.click('#full [data-desagenere]'); await esperaDesat();
    const b = consulta('SELECT generes, llenguatge, formacio, instrument_solista FROM album WHERE id = 7')[0];
    igual(JSON.stringify(b), JSON.stringify({ generes: '["Rap / Hip-hop"]', llenguatge: null, formacio: null, instrument_solista: null }), 'Àlbum després de treure Clàssica');
    await pagina.click('[data-tornafull]');
  } },
  { nom: 'per afinar (ACT-681, ACT-686): desa la data a Edició.per_afinar; les marcades a dalt, la més recent primer, amb «marcat fa X»; surt a l\'Excel; «Ja està afinat» la buida', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    for (const id of [5, 1]) {
      await pagina.click('[data-psub="tots"]'); await pagina.locator(`#arxiu [data-fitxa="${id}"]`).click(); await pagina.waitForTimeout(250);
      await pagina.click('#full [data-perafinar]'); await esperaDesat();
      cal((await pagina.locator('#full .per-afinar').innerText()).includes('marcat avui'), 'la fitxa no diu «marcat avui»');
      await pagina.click('[data-tornafull]');
    }
    const d = consulta('SELECT id, per_afinar FROM edicio WHERE id IN (1, 5) ORDER BY id');
    cal(d.every(x => /^\d{4}-\d\d-\d\dT/.test(x.per_afinar || '')), 'Edició.per_afinar no és una data: ' + JSON.stringify(d));
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18');
      await A.canvia(db => db.run('UPDATE edicio SET per_afinar = ? WHERE id = 5', [new Date(Date.now() - 10 * 864e5).toISOString()])); });
    await esperaDesat();
    await pagina.click('[data-psub="afi"]'); await pagina.waitForTimeout(250);
    const ids = await pagina.locator('#afinacio .afi-fila').evaluateAll(l => l.slice(0, 2).map(b => +b.dataset.fitxa));
    igual(ids.join(','), '1,5', 'les dues marcades a dalt, la més recent primer');
    const t5 = await pagina.locator('#afinacio [data-fitxa="5"]').innerText();
    cal(t5.includes('per afinar · marcat fa 10 dies') && t5.includes('sense gènere'), 'la fila d\'In a Silent Way no diu els dos motius: ' + t5);
    const xl = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), X = await import('./js/excel.js?v=3');
      const l = (await X.llegeix(await X.xlsx(A.estat.db)))['Edició']; const c = l[0].indexOf('per_afinar');
      return { c, v: c >= 0 ? l.find(f => String(f[0]) === '5')?.[c] : null }; });
    cal(xl.c >= 0, 'l\'Excel no porta la columna per_afinar');
    igual(String(xl.v), consulta('SELECT per_afinar FROM edicio WHERE id = 5')[0].per_afinar, 'la data concreta a l\'Excel');
    await pagina.locator('#afinacio [data-fitxa="1"]').click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-jaafinat]'); await esperaDesat();
    igual(consulta('SELECT per_afinar FROM edicio WHERE id = 1')[0].per_afinar, null, 'Edició.per_afinar després de «Ja està afinat»');
    await pagina.click('[data-tornafull]');
    igual(await pagina.locator('#afinacio [data-fitxa="1"]').count(), 0, 'Angel\'s Flight (amb gènere) encara és a L\'Afinació');
  } },
  { nom: 'juntar (ACT-659 a ACT-663, ACT-670): a dalt el mateix artista; la fitxa oberta desapareix i l\'elegida s\'emporta escoltes, emparellaments, nota, formats, Per afinar i la portada triada; un sol «Desfés»', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const x = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'); let id;
      await A.canvia(db => {
        db.run("INSERT INTO album (titol, artista_id, tags) VALUES ('In a Silent Way (Legacy Edition)', 4, '[\"Per estudiar\"]')");
        const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run(`INSERT INTO edicio (album_id, durada_total, formats, emparellaments, portada, portada_origen, app_escolta)
                VALUES (?, 40, '["CD"]', '["In a Silent Way (Legacy Edition)"]', 'release/banc-legacy', 'triada', 'youtube')`, [al]);
        id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run('INSERT INTO puntuacio (edicio_id, valor, data) VALUES (?, 4, ?)', [id, new Date(Date.now() - 30 * 864e5).toISOString()]);
        db.run("INSERT INTO escolta (edicio_id, data_hora, canal, completitud) VALUES (?, ?, 'CD', 1)", [id, new Date(Date.now() - 20 * 864e5).toISOString()]);
      }); return id; });
    await esperaDesat();
    const escAbans = consulta('SELECT COUNT(*) AS n FROM escolta WHERE edicio_id = 5')[0].n;
    await pagina.click('[data-psub="tots"]'); await pagina.locator(`#arxiu [data-fitxa="${x}"]`).click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-juntar]'); await pagina.waitForTimeout(200);
    const mateix = await pagina.locator('#identMateix [data-juntaamb]').evaluateAll(l => l.map(b => +b.dataset.juntaamb.split('|')[1]));
    const seus = consulta('SELECT e.id FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.artista_id = 4 AND e.id != ?', [x]).map(r => r.id);
    igual(mateix.sort().join(','), seus.sort().join(','), 'a dalt, els altres discos de Miles Davis (Artista)');
    cal(mateix.includes(5), 'In a Silent Way no és a dalt');
    await pagina.fill('#inIdentitat', 'stankonia'); await pagina.waitForTimeout(150);
    igual(await pagina.locator('#identAltres [data-juntaamb]').count(), 2, 'el cercador troba les dues edicions de Stankonia');
    await pagina.click(`#identMateix [data-juntaamb="${x}|5"]`);
    cal((await pagina.locator('#full').innerText()).includes('Desapareix'), 'falta la confirmació');
    await pagina.click('#full [data-juntasi]'); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM edicio WHERE id = ?', [x])[0].n, 0, 'la fitxa oberta desapareix');
    igual(consulta("SELECT COUNT(*) AS n FROM album WHERE titol = 'In a Silent Way (Legacy Edition)'")[0].n, 0, 'el seu àlbum, sense edicions');
    const e = consulta('SELECT emparellaments, formats, portada, portada_origen, per_afinar FROM edicio WHERE id = 5')[0];
    igual(e.emparellaments, '["In a Silent Way","In a Silent Way (Legacy Edition)"]', 'Emparellaments units');
    igual(e.formats, '["CD"]', 'Formats disponibles units');
    igual(e.portada + ' ' + e.portada_origen, 'release/banc-legacy triada', 'la portada triada per Ricard guanya');
    cal(!!e.per_afinar, 'Per afinar de la que es queda s\'ha perdut');
    igual(consulta('SELECT COUNT(*) AS n FROM puntuacio WHERE edicio_id = 5 AND valor = 4')[0].n, 1, 'la nota passa a la que es queda');
    igual(consulta('SELECT COUNT(*) AS n FROM escolta WHERE edicio_id = 5')[0].n, escAbans + 1, 'l\'escolta física passa a la que es queda');
    igual(consulta('SELECT tags FROM album WHERE id = 5')[0].tags, '["Per estudiar"]', 'la descripció buida de la que es queda pren la de l\'altra');
    // un sol «Desfés» ho desfà tot
    await pagina.click('#avisBt'); await esperaDesat();
    igual(consulta('SELECT COUNT(*) AS n FROM edicio WHERE id = ?', [x])[0].n, 1, 'després de «Desfés», la fitxa torna');
    igual(consulta('SELECT emparellaments FROM edicio WHERE id = 5')[0].emparellaments, '["In a Silent Way"]', 'després de «Desfés», els emparellaments tornen');
    // es torna a juntar, per deixar l'arxiu net per a les que venen
    await pagina.evaluate(async x => { const A = await import('./js/arxiu.js?v=18'), F = await import('./js/afinacio.js?v=1'); await A.canvia(F.junta({ de: x, a: 5 })); }, x);
    await esperaDesat();
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'), F = await import('./js/afinacio.js?v=1'); await A.canvia(F.jaAfinat(5)); });
    await esperaDesat();
  } },
  { nom: 'juntar (ACT-664, ACT-680): una fitxa amb parts no ofereix juntar; si l\'elegida és una caixa, porta a «És part» amb la caixa triada; més del doble avisa sense bloquejar', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const ids = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=18'); const r = {};
      await A.canvia(db => {
        const id = () => db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run("INSERT INTO artista (nom_canonic) VALUES ('Glenn Gould')"); const art = id();
        const ed = (titol, min, extra = {}) => { db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [titol, art]); const al = id();
          db.run('INSERT INTO edicio (album_id, durada_total, emparellaments, portada, portada_origen, codi_bandcamp) VALUES (?, ?, ?, ?, ?, ?)',
            [al, min, extra.emp ? JSON.stringify(extra.emp) : null, extra.portada || null, extra.portada ? 'escolta' : null, extra.bc || null]); return id(); };
        r.integral = ed('Bach: The Complete Recordings', 1200);
        r.french = ed('Bach: The French Suites', 70, { emp: ['Bach: The French Suites'], portada: 'release/banc-french', bc: '5550001' });
        db.run('INSERT INTO puntuacio (edicio_id, valor, data) VALUES (?, 3, ?)', [r.french, new Date(Date.now() - 5 * 864e5).toISOString()]);
        r.partitas = ed('Bach: Partitas', 100);
        db.run("INSERT INTO part (edicio_id, numero, nom, durada) VALUES (?, 1, 'Partitas 1-3', 50)", [r.partitas]);
        db.run('INSERT INTO part (edicio_id, numero, nom, durada) VALUES (?, 2, NULL, NULL)', [r.partitas]);
        db.run('INSERT INTO puntuacio (edicio_id, valor, data) VALUES (?, 5, ?)', [r.partitas, new Date(Date.now() - 50 * 864e5).toISOString()]);
        r.goldberg = ed('Bach: Goldberg Variations (1981)', 51, { emp: ['Goldberg Variations (1981)'] });
        db.run('INSERT INTO puntuacio (edicio_id, valor, data) VALUES (?, 4, ?)', [r.goldberg, new Date(Date.now() - 6 * 864e5).toISOString()]);
      }); return r; });
    await esperaDesat();
    await pagina.click('[data-psub="tots"]'); await pagina.locator(`#arxiu [data-fitxa="${ids.partitas}"]`).click(); await pagina.waitForTimeout(250);
    igual(await pagina.locator('#full [data-juntar], #full [data-espart]').count(), 0, 'una fitxa amb parts ofereix juntar o fer-la part');
    await pagina.click('[data-tornafull]');
    await pagina.locator(`#arxiu [data-fitxa="${ids.french}"]`).click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-juntar]'); await pagina.click(`#full [data-juntaamb="${ids.french}|${ids.partitas}"]`); await pagina.waitForTimeout(150);
    let t = await pagina.locator('#full').innerText();
    cal(t.includes('És una caixa: fes servir «És part d\'un que ja tinc»'), 'no diu «És una caixa»');
    igual(await pagina.locator('#full [data-espartpart]').count(), 2, 'les parts de la caixa ja triada');
    cal(t.includes('(Bo) no passa a la caixa'), 'no avisa que la nota de les French Suites no passa a la caixa');
    await pagina.click('[data-tornafull]');
    await pagina.locator(`#arxiu [data-fitxa="${ids.french}"]`).click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-juntar]'); await pagina.click(`#full [data-juntaamb="${ids.french}|${ids.integral}"]`); await pagina.waitForTimeout(150);
    t = await pagina.locator('#full').innerText();
    cal(t.includes('Dura molt més: no serà una part d\'aquest?'), 'no avisa del doble (1200′ contra 70′)');
    igual(await pagina.locator('#full [data-juntasi]').count(), 1, 'l\'avís no bloqueja: hi ha «No, junta\'ls»');
    igual(consulta('SELECT COUNT(*) AS n FROM edicio WHERE id = ?', [ids.french])[0].n, 1, 'res no ha canviat encara');
    await pagina.evaluate(r => { window.__gould = r; }, ids);
  } },
  { nom: 'és part (ACT-666, ACT-668, ACT-669, ACT-685): la caixa sense parts guanya la primera amb el número que escriu Ricard, Part.Nom de l\'escolta, la durada, la portada i el codi; la nota passa; la pista següent hi va pel nom (ACT-665)', sintetic: true, async fes({ pagina, consulta, esperaDesat, lb, obreSafata }) {
    const ids = await pagina.evaluate(() => window.__gould);
    await pagina.click('#full [data-espartamb]'); await pagina.waitForTimeout(150);
    cal((await pagina.locator('#full').innerText()).includes('encara no té parts: aquesta serà la primera'), 'no diu que serà la primera part');
    igual(await pagina.locator('#inNumPart').inputValue(), '1', 'el número proposat (el següent lliure)');
    await pagina.fill('#inNumPart', '48'); await pagina.click('#full [data-espartnova]'); await esperaDesat();
    const p = consulta('SELECT id, numero, nom, durada, portada, codi_bandcamp, rotacio_actual FROM part WHERE edicio_id = ?', [ids.integral]);
    igual(JSON.stringify(p.map(({ id, ...x }) => x)), JSON.stringify([{ numero: 48, nom: 'Bach: The French Suites', durada: 70, portada: 'release/banc-french', codi_bandcamp: '5550001', rotacio_actual: 0 }]), 'la part nova');
    igual(consulta('SELECT COUNT(*) AS n FROM edicio WHERE id = ?', [ids.french])[0].n, 0, 'la fitxa de les French Suites desapareix');
    igual(consulta('SELECT valor FROM puntuacio WHERE edicio_id = ?', [ids.integral]).map(x => x.valor).join(','), '3', 'la nota passa a la caixa, que no en tenia');
    cal(consulta('SELECT emparellaments FROM edicio WHERE id = ?', [ids.integral])[0].emparellaments.includes('Bach: The French Suites'), 'l\'emparellament passa a la caixa');
    // la pista següent, sense número al nom, va a la part pel seu Nom (i no a la viva, que no n'hi ha)
    const t0 = Date.now() - 22.5 * 3600e3, m = 60e3;   // compte personal, lliure: res a menys de 30 minuts
    const pista = (t, msid, nom) => ({ compte: 'crimsonnnn', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'Glenn Gould', track_name: nom, release_name: 'Bach: The French Suites', additional_info: { duration_ms: 35 * m } } });
    lb.escoltes.push(pista(t0, 'msid-banc-fs1', 'French Suite No. 1'), pista(t0 + 35 * m, 'msid-banc-fs2', 'French Suite No. 5'));
    cal((await pagina.locator('#full').innerText()).includes('La caixa · 1 parts'), 'després, la fitxa de la caixa amb la part 48');
    await pagina.click('[data-tornafull]');
    await obreSafata(); await pagina.waitForTimeout(800); await esperaDesat();
    const esc = consulta(`SELECT DISTINCT e.edicio_id, e.part_id FROM escolta e JOIN scrobble s ON s.escolta_id = e.id WHERE s.recording_msid LIKE 'msid-banc-fs%'`);
    igual(JSON.stringify(esc), JSON.stringify([{ edicio_id: ids.integral, part_id: p[0].id }]), 'l\'escolta va a la caixa i a la part 48');
    await pagina.click('[data-tornasafata]').catch(() => {});
    // una part que ja hi és: nom genèric → nom de l'escolta, durada buida → la de la fitxa; la caixa amb nota conserva la seva
    await pagina.click('[data-anar="prestatgeria"]'); await pagina.click('[data-psub="tots"]');
    await pagina.locator(`#arxiu [data-fitxa="${ids.goldberg}"]`).click(); await pagina.waitForTimeout(250);
    await pagina.click('#full [data-espart]'); await pagina.click(`#full [data-espartamb="${ids.goldberg}|${ids.partitas}"]`); await pagina.waitForTimeout(150);
    cal((await pagina.locator('#full').innerText()).includes('(Discàs) no passa a la caixa'), 'no avisa que la nota no passa');
    const p2 = consulta('SELECT id FROM part WHERE edicio_id = ? AND numero = 2', [ids.partitas])[0].id;
    await pagina.click(`#full [data-espartpart="${ids.goldberg}|${ids.partitas}|${p2}"]`); await esperaDesat();
    igual(JSON.stringify(consulta('SELECT nom, durada FROM part WHERE id = ?', [p2])[0]), JSON.stringify({ nom: 'Goldberg Variations (1981)', durada: 51 }), 'la part 2');
    igual(consulta('SELECT nom FROM part WHERE edicio_id = ? AND numero = 1', [ids.partitas])[0].nom, 'Partitas 1-3', 'un nom de debò no es trepitja');
    igual(consulta('SELECT valor FROM puntuacio WHERE edicio_id = ?', [ids.partitas]).map(x => x.valor).join(','), '5', 'la caixa conserva la seva nota');
    cal((await pagina.locator('#full').innerText()).includes('La caixa · 2 parts'), 'després, la fitxa de la caixa');
    await pagina.click('[data-tornafull]'); await pagina.click('[data-anar="faristol"]');
  } },
  { nom: 'excel: anada i tornada idèntica fila a fila, amb les onze pestanyes (les dues de les llistes, des de l\'estructura 7) i les columnes de càrrega del §3.2', async fes({ pagina, consulta, real }) {
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=18'), X = await import('./js/excel.js?v=3'), { MIGRACIONS } = await import('./js/esquema.js?v=7');
      const l = await X.llegeix(await X.xlsx(A.estat.db));
      const SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f });
      const buida = () => { const d = new SQL.Database(); MIGRACIONS.forEach((m, i) => { d.exec(m); d.exec(`PRAGMA user_version = ${i + 1}`); }); return d; };
      const d = buida(); X.carrega(d, l); const dif = X.compara(A.estat.db, d); d.close();
      // Una correcció del títol a Edició, que és una columna de lectura: mana Àlbum.
      const t = l['Edició'][0].indexOf('Títol'); l['Edició'][1][t] = 'Un títol corregit a Edició';
      const d2 = buida(); X.carrega(d2, l); const dif2 = X.compara(A.estat.db, d2); d2.close();
      return { dif, dif2, pestanyes: Object.keys(l), edicio: l['Edició'][0].slice(0, 16), part: l['Part'][0].slice(0, 6), artista: l['Artista'][0].slice(0, 4),
               escolta: l['Escolta'][0], scrobbles: l['Scrobble'].length - 1, meta: l['Meta'].slice(1).map(f => f[0]),
               llistes: l['Cançó de llista'].length - 1, partCols: l['Part'][0] };
    });
    cal(!r.dif.length, 'l\'anada i tornada no és idèntica: ' + r.dif.slice(0, 3).join(' | '));
    cal(!r.dif2.length, 'una correcció del títol a Edició ha manat sobre Àlbum: ' + r.dif2.slice(0, 2).join(' | '));
    igual(r.pestanyes.join(','), 'Edició,Part,Artista,Àlbum,Puntuació,Escolta,Scrobble,Preferent,Llista,Cançó de llista,Meta', 'pestanyes');
    igual(r.llistes, consulta('SELECT COUNT(*) AS n FROM llista_canco')[0].n, 'files de la pestanya Cançó de llista');
    if (!real) cal(r.llistes > 0, 'la pestanya Cançó de llista hauria de portar les cançons de les llistes de les comprovacions d\'abans');
    cal(r.part.length && r.partCols.includes('portada'), 'la pestanya Part no porta la columna portada (ACT-624)');
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
    const fs = await import('node:fs'), X = await import('../js/excel.js?v=3');
    const l = await X.llegeix(new Uint8Array(fs.readFileSync(await baixada.path())));
    igual(Object.keys(l).length, 11, 'pestanyes del fitxer baixat');
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
