// Les comprovacions de l'obra D (ACT-815, 5): el «repàs». Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);

export const OBRA_D = [
  { bloc: 'obra D: el repàs (ACT-815)' },
  { nom: 'repàs (ACT-815): després d\'una escolta que compta, només pistes ja sonades dins de 15 h i per sota del 50 % no fan escolta; al 50 % o passades les 15 h, sí', sintetic: true, async fes({ pagina, consulta }) {
    // Discos de 12′ (quatre pistes de 3′), lluny de tota la resta (dies 60 a 54, compte crimsonnnnfeina). Cada pista va a
    // l'hora que diu el seu tram: [pista, dia, minuts després de l'inici del dia triat].
    //  · Disc Dutxa: 0-3 sencer, i dues hores després la 0 (25 %) → repàs: una sola unió, cap «a mitges».
    //  · Disc Meitat: 0-3 sencer, i dues hores després la 0 i la 1 (50 %) → no és repàs: dues unions.
    //  · Disc Endemà: 0-3 sencer, i vint hores després la 0 → fora de les 15 h: dues unions.
    const r = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15');
      return A.canvia(db => {
        db.run("INSERT INTO artista (nom_canonic) VALUES ('Banc Repàs')"); const ar = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        const disc = (titol, dia, pistes) => {
          db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [titol, ar]); const al = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
          db.run(`INSERT INTO edicio (album_id, durada_total, rotacio_actual, app_escolta, emparellaments) VALUES (?, 12, 0, 'amazon', ?)`, [al, JSON.stringify([titol])]);
          const t0 = Date.now() - dia * 864e5;
          pistes.forEach(([i, min]) => db.run(`INSERT INTO scrobble (compte, listened_at, artista, pista, album, duration_ms, recording_msid, estat, context, atencio)
            VALUES ('crimsonnnnfeina', ?, 'Banc Repàs', ?, ?, 180000, ?, 'resolt', 'A casa', 'Efectes plens')`,
            [new Date(t0 + min * 60000).toISOString(), titol + ' ' + i, titol, 'msid-' + titol + '-' + i]));
        };
        disc('Disc Dutxa', 60, [[0, 0], [1, 3], [2, 6], [3, 9], [0, 129]]);
        disc('Disc Meitat', 58, [[0, 0], [1, 3], [2, 6], [3, 9], [0, 129], [1, 132]]);
        disc('Disc Endemà', 56, [[0, 0], [1, 3], [2, 6], [3, 9], [0, 9 + 20 * 60]]);
        E.recalcula(db);
      });
    });
    cal(r.desat, 'no s\'ha desat: ' + r.motiu);
    const unions = titol => [...new Set(consulta(`SELECT s.unio FROM escolta s JOIN edicio e ON e.id = s.edicio_id JOIN album a ON a.id = e.album_id WHERE a.titol = ?`, [titol]).map(x => x.unio))].length;
    const solts = titol => consulta(`SELECT COUNT(*) AS n FROM scrobble p WHERE p.album = ? AND p.escolta_id IS NULL`, [titol])[0].n;
    igual(unions('Disc Dutxa'), 1, 'Escolta.unio del Disc Dutxa: el repàs no obre escolta');
    igual(solts('Disc Dutxa'), 0, 'pistes del Disc Dutxa sense escolta (el repàs va a l\'escolta d\'abans)');
    igual(unions('Disc Meitat'), 2, 'unions del Disc Meitat (al 50 % ja no és repàs)');
    igual(unions('Disc Endemà'), 2, 'unions del Disc Endemà (passades les 15 hores)');
    const h = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15');
      const db = A.estat.db, ed = t => db.exec('SELECT e.id FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.titol = ?', [t])[0].values[0][0];
      const f = t => E.historial(db).find(x => x.edicio_id === ed(t)) || null;
      return { dutxa: f('Disc Dutxa'), meitat: f('Disc Meitat') }; });
    cal(h.dutxa && !h.dutxa.mitges, 'el Disc Dutxa surt «a mitges» a l\'Historial: ' + JSON.stringify(h.dutxa));
    // (L'Historial només marca «a mitges» l'escolta en curs; el Disc Meitat és de fa dos mesos: aquí només hi ha de ser.)
    cal(h.meitat, 'el Disc Meitat no surt a l\'Historial');
    const codi = (await import('node:fs')).readFileSync(new URL('../js/escoltes.js', import.meta.url), 'utf8');
    cal(+(codi.match(/export const CALCUL = (\d+)\b/)?.[1]) >= 6, 'CALCUL no ha pujat a 6 amb la regla nova');   // ≥ 6: l'obra H el va pujar a 7 (20-11)
  } },
];
