// Les comprovacions de l'obra H (ACT-787 a i b, ratificades per Ricard el 20-11, ACT-829). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);

export const OBRA_H = [
  { bloc: 'obra H: preguntar l\'acte i les parts d\'una òpera (ACT-787 a i b)' },
  { nom: 'actes (ACT-787 a): una pista d\'una caixa per actes que no diu l\'acte es pregunta a la targeta; la resposta (meta acte:<scrobble>) la porta a la part triada, també en tornar a calcular', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    const r0 = await pagina.evaluate(async () => {
      const A = await import('./js/arxiu.js?v=21');
      return A.canvia(db => {
        db.run("INSERT INTO artista (id, nom_canonic) VALUES (960, 'Banc Wagner H')");
        db.run("INSERT INTO album (id, titol, artista_id) VALUES (961, 'Banc Lohengrin', 960)");
        db.run(`INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio) VALUES (962, 961, 210, 1, 'amazon', ?, ?)`,
               [JSON.stringify(['Banc Lohengrin (Live)']), new Date(Date.now() - 3 * 864e5).toISOString()]);
        db.run(`INSERT INTO part (id, edicio_id, numero, nom, durada, rotacio_actual) VALUES (971, 962, 1, 'Acte 1', 70, 1), (972, 962, 2, 'Acte 2', 80, 0), (973, 962, 3, 'Acte 3', 60, 0)`);
      });
    });
    cal(r0.desat, 'no s\'ha desat la caixa: ' + r0.motiu);
    const t = Date.now() - 16 * 3600e3, m = 60e3;
    const pista = (t, msid, nom, min) => ({ compte: 'crimsonnnnfeina', listened_at: Math.floor(t / 1000), recording_msid: msid,
      track_metadata: { artist_name: 'Banc Wagner H', track_name: nom, release_name: 'Banc Lohengrin (Live)', additional_info: { duration_ms: min * m } } });
    lb.escoltes.push(pista(t, 'msid-banc-lo1', 'Act 2: Erhebe dich, Genossin', 10), pista(t + 10 * m, 'msid-banc-lo2', 'Einsam in trüben Tagen', 12));
    await obreSafata();
    const sel = '[data-sfacte^="msid-banc-lo2|"]';
    await pagina.waitForSelector(`[data-sfactepista="msid-banc-lo2"]`, { timeout: 15000 }).catch(() => {});
    igual(await pagina.locator('[data-sfactepista="msid-banc-lo1"]').count(), 0, 'la pista que ja diu l\'acte no es pregunta');
    const botons = await pagina.locator(`[data-sfactepista="msid-banc-lo2"] [data-sfacte]`).allInnerTexts();
    igual(JSON.stringify(botons), JSON.stringify(['Acte 1', 'Acte 2', 'Acte 3']), 'els botons de la pregunta, un per Part.Numero');
    await pagina.click(`[data-sfactepista="msid-banc-lo2"] [data-sfacte$="|3"]`);
    await esperaDesat();
    const sid = consulta(`SELECT id FROM scrobble WHERE recording_msid = 'msid-banc-lo2'`)[0]?.id;
    igual(consulta(`SELECT valor FROM meta WHERE clau = 'acte:${sid}'`)[0]?.valor, '3', 'meta acte:<Scrobble.id>');
    const partDe = msid => consulta(`SELECT e.part_id FROM scrobble s JOIN escolta e ON e.id = s.escolta_id WHERE s.recording_msid = '${msid}'`)[0]?.part_id;
    igual(partDe('msid-banc-lo2'), 973, 'Escolta.part_id de la pista contestada (la part 3)');
    igual(partDe('msid-banc-lo1'), 972, 'Escolta.part_id de «Act 2» (no canvia)');
    const r = await pagina.evaluate(async () => { const A = await import('./js/arxiu.js?v=21'), E = await import('./js/escoltes.js?v=15');
      return A.canvia(db => { db.run("UPDATE escolta SET part_id = 971 WHERE id IN (SELECT escolta_id FROM scrobble WHERE recording_msid LIKE 'msid-banc-lo%')"); E.recalcula(db); }); });
    cal(r.desat, 'no s\'ha desat el recàlcul: ' + r.motiu);
    igual(partDe('msid-banc-lo2'), 973, 'Escolta.part_id de la pista contestada, després de tornar a calcular');
    const triat = await pagina.locator(`[data-sfactepista="msid-banc-lo2"] .triat`).allInnerTexts().catch(() => []);
    igual(JSON.stringify(triat), JSON.stringify(['Acte 3']), 'la resposta queda marcada i es pot canviar');
  } },
  { nom: 'actes (ACT-787 b): un disc nou sense pistes a MusicBrainz ofereix «És una òpera per actes»; quants actes i la durada de cadascun fan les parts, i la durada total és la suma', sintetic: true, async fes({ pagina, lb, consulta, esperaDesat, obreSafata }) {
    const t = Date.now() - 20 * 3600e3, m = 60e3;
    ['Medea: Ouverture', 'Dei tuoi figli', 'Solo un pianto'].forEach((nom, i) => lb.escoltes.push({ compte: 'crimsonnnnfeina', listened_at: Math.floor((t + i * 5 * m) / 1000),
      recording_msid: 'msid-banc-me' + i, track_metadata: { artist_name: 'Banc Cherubini', track_name: nom, release_name: 'Banc Medea', additional_info: { duration_ms: 5 * m } } }));
    await obreSafata();
    const sel = '[data-nou="bancmedea"]';
    await pagina.waitForSelector(sel, { timeout: 15000 });
    await pagina.click(sel + ' [data-sfoperaactes]');
    await pagina.fill(sel + ' [data-sfnactes]', '3'); await pagina.dispatchEvent(sel + ' [data-sfnactes]', 'change');
    await pagina.waitForSelector(sel + ' [data-sfactemin="bancmedea|3"]', { timeout: 5000 });
    for (const [i, v] of [[1, '50'], [2, '40'], [3, '30']]) await pagina.fill(`${sel} [data-sfactemin="bancmedea|${i}"]`, v);
    await pagina.click(sel + ' [data-sfnou$="|arxiu"]');
    await esperaDesat();
    const p = consulta(`SELECT p.numero, p.nom, p.durada FROM part p JOIN edicio e ON e.id = p.edicio_id JOIN album a ON a.id = e.album_id WHERE a.titol = 'Banc Medea' ORDER BY p.numero`);
    igual(JSON.stringify(p), JSON.stringify([{ numero: 1, nom: 'Acte 1', durada: 50 }, { numero: 2, nom: 'Acte 2', durada: 40 }, { numero: 3, nom: 'Acte 3', durada: 30 }]), 'Part.Numero, Part.Nom i Part.Durada');
    igual(consulta(`SELECT e.durada_total FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.titol = 'Banc Medea'`)[0]?.durada_total, 120, 'Edició.Durada_total = suma dels actes');
  } },
];
