// Les comprovacions de l'obra III — els fitxers d'any (ACT-837, ACT-838, ACT-840 1, ACT-841 1 a 3). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
const NOM_ANY = any => `la-meva-discoteca · pistes ${any}.sqlite`;
// Les pistes d'un fitxer d'any del Drive fals.
async function delFitxer(drive, S, any) {
  const f = drive.per(NOM_ANY(any)); if (!f) return null;
  const d = new S.Database(f.bytes); const r = d.exec('SELECT id, escolta_id, listened_at, estat FROM scrobble ORDER BY id')[0]?.values || []; d.close();
  return r.map(([id, escolta_id, listened_at, estat]) => ({ id, escolta_id, listened_at, estat }));
}
// Unes pistes velles: còpies de les d'una escolta del banc, 400 dies enrere (i 800, per a un any tancat), i una pendent.
const posaVelles = pagina => pagina.evaluate(async () => {
  const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15');
  let r; await A.canvia(db => {
    const esc = db.exec('SELECT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL GROUP BY escolta_id ORDER BY COUNT(*) DESC LIMIT 1')[0].values[0][0];
    const cols = 'compte, artista, pista, album, duration_ms, recording_msid, release_mbid, caa_release_mbid, context, atencio';
    for (const dies of [400, 800])   // resoltes: les pendents de la safata no surten mai (ACT-838)
      db.run(`INSERT INTO scrobble (listened_at, estat, ${cols}) SELECT strftime('%Y-%m-%dT%H:%M:%fZ', listened_at, '-${dies} days'), 'resolt', ${cols} FROM scrobble WHERE escolta_id = ?`, [esc]);
    db.run(`INSERT INTO scrobble (listened_at, compte, recording_msid, estat, album) VALUES (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-420 days'), 'crimsonnnn', 'msid-banc-iii-pendent', 'pendent', 'Banc Pendent Vell')`);
    E.recalcula(db);
    const q = s => db.exec(s)[0]?.values || [];
    r = { esc, velles: q("SELECT COUNT(*) FROM scrobble WHERE listened_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months')")[0][0],
      lligades: q("SELECT COUNT(*) FROM scrobble WHERE listened_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months') AND escolta_id IS NOT NULL")[0][0],
      total: q('SELECT COUNT(*) FROM scrobble')[0][0] };
  });
  return r;
});

export const OBRA_III = [
  { bloc: 'obra III: els fitxers d\'any (ACT-837, ACT-838, ACT-840 1, ACT-841)' },
  { nom: 'pes (ACT-840 1): els avisos del pes es recalibren a l\'arxiu principal, taronja a 15 MB i vermell a 25 MB', async fes({ pagina }) {
    const p = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'); return [A.PES_TARONJA, A.PES_VERMELL]; });
    igual(JSON.stringify(p), JSON.stringify([15e6, 25e6]), 'PES_TARONJA i PES_VERMELL');
  } },
  { nom: 'moviment del mes (ACT-838, ACT-841 2 i 4): les pistes de més de 12 mesos van al fitxer del seu any, menys les pendents; les escoltes es queden; es desen els resums; el total de pistes no baixa', sintetic: true, async fes({ pagina, consulta, drive, S, esperaDesat }) {
    const v = await posaVelles(pagina); await esperaDesat();
    cal(v.lligades > 0, 'les pistes velles havien de formar una escolta: ' + JSON.stringify(v));
    const escAbans = consulta('SELECT COUNT(*) AS n FROM escolta')[0].n;
    const r = await pagina.evaluate(async () => { const N = await import('./js/anys.js?v=1'), C = await import('./js/copies.js?v=6'), A = await import('./js/arxiu.js?v=21');
      const abans = C.recomptes(A.estat.db).scrobble; const m = await N.mouMes({ forca: true }); return { m, abans, despres: C.recomptes(A.estat.db).scrobble, anys: N.comptesAnys(A.estat.db) }; });
    await esperaDesat();
    cal(r.m.fet && r.m.mogudes === v.velles - 1, 'mogudes totes les velles menys la pendent: ' + JSON.stringify(r.m) + ' de ' + v.velles);
    const anys = Object.keys(r.anys).sort();
    cal(anys.length >= 2, 'dos fitxers d\'any (400 i 800 dies): ' + JSON.stringify(r.anys));
    let enAnys = 0;
    for (const a of anys) { const f = await delFitxer(drive, S, a); cal(!!f, 'el fitxer ' + NOM_ANY(a) + ' al Drive'); igual(f.length, r.anys[a], 'meta pistes-anys de ' + a); enAnys += f.length;
      cal(f.every(x => x.listened_at.startsWith(a) && x.estat !== 'pendent'), 'al fitxer de ' + a + ' només pistes d\'aquell any i no pendents'); }
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE listened_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months')")[0].n, 1, 'al principal només queda la pendent vella');
    igual(consulta('SELECT COUNT(*) AS n FROM escolta')[0].n, escAbans, 'les escoltes no surten del principal');
    igual(r.despres, r.abans, 'el total de pistes de les còpies (principal + fitxers d\'any, ACT-841 2)');
    cal(consulta(`SELECT darrer_scrobble FROM edicio WHERE id = (SELECT edicio_id FROM escolta WHERE id = ${v.esc})`)[0].darrer_scrobble, 'Edició.darrer_scrobble desat abans de moure (ACT-841 4)');
    const r2 = await pagina.evaluate(async () => { const N = await import('./js/anys.js?v=1'); return N.mouMes(); });
    igual(r2.fet, false, 'el mateix mes no torna a moure');
  } },
  { nom: 'recàlcul amb els anys (ACT-841 1): un recàlcul sencer marca els anys; sense connexió espera; amb connexió els obre, es torna a calcular i el fitxer d\'any queda lligat a escoltes que existeixen, sense duplicats', sintetic: true, async fes({ pagina, consulta, drive, S, esperaDesat }) {
    await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15'); await A.canvia(db => E.recalcula(db)); });
    await esperaDesat();
    const escAbans = consulta('SELECT COUNT(*) AS n FROM escolta')[0].n;
    cal(await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), N = await import('./js/anys.js?v=1'); return N.calObrir(A.estat.db); }), 'un recàlcul sencer havia de marcar els anys per obrir');
    await pagina.context().setOffline(true);
    const off = await pagina.evaluate(async () => { const N = await import('./js/anys.js?v=1'); return N.recalculaAmbAnys(); });
    await pagina.context().setOffline(false);
    igual(off.espera, true, 'sense connexió, espera');
    const avisos = [];
    await pagina.exposeFunction('__avisAny', t => avisos.push(t)).catch(() => {});
    const on = await pagina.evaluate(async () => { const N = await import('./js/anys.js?v=1'), A = await import('./js/arxiu.js?v=21');
      const r = await N.recalculaAmbAnys({ avisa: t => window.__avisAny?.(t) }); return { r, encara: N.calObrir(A.estat.db) }; });
    await esperaDesat();
    cal(on.r.fet && !on.encara, 'amb connexió, recalcula i treu la marca: ' + JSON.stringify(on));
    cal(avisos.some(t => /^Recalculant \d{4}…$/.test(t)), 'el progrés a la vista («Recalculant AAAA…»): ' + JSON.stringify(avisos));
    igual(consulta("SELECT COUNT(*) AS n FROM scrobble WHERE listened_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months') AND estat != 'pendent'")[0].n, 0, 'les pistes dels anys tornen a sortir del principal');
    igual(consulta('SELECT COUNT(*) AS n FROM escolta')[0].n, escAbans, 'cap escolta duplicada ni perduda');
    const ids = new Set(consulta('SELECT id FROM escolta').map(r => r.id));
    for (const a of Object.keys(await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), N = await import('./js/anys.js?v=1'); return N.comptesAnys(A.estat.db); }))) {
      const f = await delFitxer(drive, S, a);
      cal(f.some(x => x.escolta_id) && f.every(x => !x.escolta_id || ids.has(x.escolta_id)), 'al fitxer de ' + a + ' les pistes apunten a escoltes que existeixen');
    }
  } },
  { nom: 'còpies (ACT-841 3): el fitxer d\'un any obert entra a la còpia setmanal amb la data de la parella; un any tancat té una còpia fixa, un sol cop, fora de la rotació', sintetic: true, async fes({ pagina, drive }) {
    const r = await pagina.evaluate(async () => { const C = await import('./js/copies.js?v=6'), N = await import('./js/anys.js?v=1'), A = await import('./js/arxiu.js?v=21');
      const c = await C.fes(); return { c, estats: Object.fromEntries(N.anys(A.estat.db).map(a => [a, N.estatAny(A.estat.db, a)])) }; });
    cal(r.c.feta, 'la còpia: ' + JSON.stringify(r.c));
    const noms = [...drive.fitxers.values()].filter(f => !f.trashed).map(f => f.name);
    for (const [a, e] of Object.entries(r.estats)) {
      if (e === 'obert') cal(noms.includes(`la-meva-discoteca · pistes ${a} · còpia de seguretat ${r.c.data}.sqlite`), 'l\'any obert ' + a + ' a la còpia setmanal: ' + noms.filter(n => n.includes('pistes')).join(' | '));
      else cal(noms.filter(n => n === `la-meva-discoteca · pistes ${a} · còpia fixa.sqlite`).length === 1, 'l\'any tancat ' + a + ' amb una còpia fixa: ' + noms.filter(n => n.includes('pistes')).join(' | '));
    }
    cal(Object.values(r.estats).includes('obert') && Object.values(r.estats).includes('tancat'), 'el banc havia de tenir un any obert i un de tancat: ' + JSON.stringify(r.estats));
    await pagina.evaluate(async () => { const C = await import('./js/copies.js?v=6'); await C.fes(); });
    const fixes = [...drive.fitxers.values()].filter(f => !f.trashed && f.name.endsWith('· còpia fixa.sqlite')).length;
    igual(fixes, Object.values(r.estats).filter(e => e === 'tancat').length, 'la còpia fixa no es repeteix');
  } },
  { nom: 'Excel (ACT-841 3): «Descarrega l\'Excel» porta les pistes de tots els anys, amb el progrés; el de la còpia setmanal, només el principal', sintetic: true, async fes({ pagina }) {
    const r = await pagina.evaluate(async () => { const N = await import('./js/anys.js?v=1'), A = await import('./js/arxiu.js?v=21'), X = await import('./js/excel.js?v=6');
      const db = A.estat.db, prog = [];
      const t = await N.ambTotsElsAnys(db, (i, n, a) => prog.push(`${i}/${n} ${a}`));
      const n = f => f.find(x => x.taula === 'scrobble' || x.full === 'Scrobble')?.files.length;
      const r = { tot: n(X.fulls(t.db)), principal: n(X.fulls(db)), anys: N.pistesAlsAnys(db), prog }; t.tanca(); return r; });
    igual(r.tot, r.principal + r.anys, 'les pistes de l\'Excel descarregat (principal + anys)');
    igual(r.prog.length, Object.keys(r.prog).length, 'el progrés');
    cal(r.prog.length >= 2, 'el progrés, un pas per any: ' + JSON.stringify(r.prog));
  } },
  { nom: 'Excel (ACT-841 3; 22/11, Ricard: «Mejor la barra»): «Descarrega l\'Excel» pinta una barra de progrés que avança any a any fins al 100 %, i s\'amaga en acabar', sintetic: true, async fes({ pagina }) {
    await pagina.evaluate(() => { window.__barra = []; const av = document.getElementById('avis');
      new MutationObserver(() => { const b = document.getElementById('avisBarra'), i = b?.querySelector('i');
        if (i && b.style.display !== 'none' && window.__barra.at(-1) !== i.style.width) window.__barra.push(i.style.width); })
        .observe(av, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] }); });
    await pagina.evaluate(() => document.getElementById('btAjustos').click()); await pagina.waitForTimeout(300);
    await Promise.all([pagina.waitForEvent('download', { timeout: 15000 }), pagina.click('[data-excel]')]);
    const r = await pagina.evaluate(() => ({ passos: window.__barra, amagada: document.getElementById('avisBarra')?.style.display === 'none', txt: document.getElementById('avisTxt').textContent }));
    await pagina.click('[data-tornafull]').catch(() => {});
    const pct = r.passos.map(w => parseFloat(w));
    cal(pct.length >= 3, 'la barra havia d\'avançar any a any (com a mínim 0 %, un any i 100 %): ' + JSON.stringify(r.passos));
    cal(pct.every((v, k) => !k || v >= pct[k - 1]), 'la barra no pot anar enrere: ' + JSON.stringify(r.passos));
    igual(r.passos.at(-1), '100%', 'el darrer pas de la barra');
    cal(r.amagada, 'en acabar, la barra s\'amaga (l\'avís diu «' + r.txt + '»)');
  } },
  { nom: 'alarma de les còpies (22/11, Ricard: «OK también las de streaming»): el recompte escolta_ma compta les escoltes d\'streaming apuntades a mà (Escolta.origen, Escolta.canal); si en desapareix una, sona la vermella', sintetic: true, async fes({ pagina, consulta, esperaDesat }) {
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=21'), C = await import('./js/copies.js?v=6'), M = await import('./js/escoltama.js?v=1');
      const ed = A.estat.db.exec('SELECT id FROM edicio ORDER BY id LIMIT 1')[0].values[0][0];
      let st, cd; await A.canvia(db => {
        st = M.apunta({ edicioId: ed, canal: 'amazon', inici: new Date(Date.now() - 5 * 86400e3), forca: true })(db);
        cd = M.apunta({ edicioId: ed, canal: 'CD', inici: new Date(Date.now() - 6 * 86400e3), forca: true })(db);
      });
      const n1 = C.recomptes(A.estat.db).escolta_ma;
      const c1 = await C.fes();
      await A.canvia(db => db.run('DELETE FROM escolta WHERE id = ?', [st.id]));
      const c2 = await C.fes();
      return { n1, c1: c1.feta, vermelles: (c2.vermelles || []).map(v => v.taula), feta2: c2.feta, nom: C.NOMS.escolta_ma };
    });
    await esperaDesat();
    igual(r.n1, consulta("SELECT COUNT(*) AS n FROM escolta WHERE origen = 'a mà' AND canal NOT IN ('CD', 'vinil')")[0].n + 1, 'escolta_ma = les d\'streaming a mà (abans d\'esborrar-ne una)');
    cal(r.c1 && r.feta2, 'les dues còpies s\'havien de fer: ' + JSON.stringify(r));
    cal(r.vermelles.includes('escolta_ma'), 'la vermella havia de sonar per escolta_ma: ' + JSON.stringify(r.vermelles));
    cal(!r.vermelles.includes('escolta_fisica'), 'la del CD no s\'ha tocat, escolta_fisica no baixa: ' + JSON.stringify(r.vermelles));
    cal(typeof r.nom === 'string' && r.nom.length > 0, 'el nom de l\'avís per a escolta_ma');
  } },
];
