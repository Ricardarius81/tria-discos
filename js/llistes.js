// Les Llistes de reproducció (ACT-632 a ACT-635). Aquí no hi ha pantalla: el que es pregunta a l'arxiu i el que s'hi escriu.
// Una llista és bàsica: un nom i les seves cançons en ordre (recording_msid, artista i pista tal com van arribar, i la
// durada de Scrobble.duration_ms). Viu a Amazon o a YouTube: la màquina no la reprodueix, només la reconeix.
//
// D'on surt cada cosa:
//  · «Això és una llista» (ACT-632): les cançons soltes d'una sessió (les que no formen disc, ACT-461) passen a una llista
//    nova, o a la que ja es diu així. Scrobble.llista_id queda apuntat a cada pista.
//  · El reconeixement (ACT-633): la safata proposa una llista quan 3 cançons soltes de la sessió hi són, o totes si la
//    sessió en té menys de 3. Es compta per cançons diferents (recording_msid). Sense calibrar: es canvia amb l'ús.
//  · Confirmar-la (ACT-634): les cançons soltes de la sessió que no hi eren s'hi afegeixen soles, al final.
//  · Agrupacions (ACT-635): mosaic de portades (Scrobble.caa_release_mbid de les pistes de la llista), ordre per l'última
//    que ha sonat (Scrobble.llista_id), nombre de cançons, última escolta i durada total (llista_canco.durada_ms).

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const MINIM = 3;      // ACT-633, sense calibrar

// ───────── llegir ─────────
// Totes les llistes, per a Agrupacions: la que ha sonat més recentment primer; les que no han sonat mai, per data d'alta.
export function llistes(db) {
  return files(db, `
    SELECT l.id, l.nom, l.data_alta,
           (SELECT COUNT(*) FROM llista_canco c WHERE c.llista_id = l.id) AS n,
           (SELECT SUM(c.durada_ms) FROM llista_canco c WHERE c.llista_id = l.id) AS durada_ms,
           (SELECT COUNT(*) FROM llista_canco c WHERE c.llista_id = l.id AND c.durada_ms IS NULL) AS sense_durada,
           (SELECT MAX(s.listened_at) FROM scrobble s WHERE s.llista_id = l.id) AS darrera
    FROM llista l`)
    .map(l => ({ ...l, portades: portades(db, l.id), incompleta: l.sense_durada > 0 }))
    .sort((a, b) => (b.darrera || '').localeCompare(a.darrera || '') || b.data_alta.localeCompare(a.data_alta) || b.id - a.id);
}
// Les portades del mosaic: les de les pistes de la llista que han sonat amb ella, la més recent primer, sense repetir.
// Només de cançons que encara hi són.
function portades(db, id) {
  return files(db, `SELECT s.caa_release_mbid AS m, MAX(s.listened_at) AS t FROM scrobble s
                    WHERE s.llista_id = ? AND s.caa_release_mbid IS NOT NULL
                      AND s.recording_msid IN (SELECT recording_msid FROM llista_canco WHERE llista_id = ?)
                    GROUP BY s.caa_release_mbid ORDER BY t DESC LIMIT 4`, [id, id]).map(r => 'release/' + r.m);
}
export const llista = (db, id) => llistes(db).find(l => l.id === id) || null;
export const cancons = (db, id) => files(db, 'SELECT id, posicio, recording_msid, artista, pista, durada_ms FROM llista_canco WHERE llista_id = ? ORDER BY posicio, id', [id]);
export const perNom = (db, nom) => files(db, 'SELECT id, nom FROM llista').find(l => norm(l.nom) === norm(nom)) || null;

// ───────── la safata: què hi ha de llista en una sessió ─────────
// scrIds: les pistes (Scrobble.id) de les cançons soltes d'una targeta. Torna el que la targeta ha d'ensenyar:
//   ja: les llistes que la sessió ja té, amb quantes cançons de la sessió hi són
//   resta: les pistes soltes que encara no són de cap llista ({ id, recording_msid })
//   proposta: la llista que la màquina reconeix per a la resta (ACT-633), o la que la sessió ja té, amb les cançons noves
export function deLaSessio(db, scrIds) {
  const pistes = scrIds.length ? files(db, `SELECT id, recording_msid, llista_id FROM scrobble WHERE id IN (${scrIds.map(() => '?').join(',')})`, scrIds) : [];
  const ja = new Map();
  for (const s of pistes) if (s.llista_id) ja.set(s.llista_id, (ja.get(s.llista_id) || new Set()).add(s.recording_msid));
  const resta = pistes.filter(s => !s.llista_id);
  const jaLl = [...ja.entries()].map(([id, ms]) => { const l = un(db, 'SELECT id, nom FROM llista WHERE id = ?', [id]); return l ? { ...l, n: ms.size } : null; }).filter(Boolean);
  if (!resta.length) return { ja: jaLl, resta, proposta: null };
  const msids = [...new Set(resta.map(s => s.recording_msid))];
  // Si la sessió ja és d'una llista (s'ha confirmat abans que arribés tota), la resta s'hi proposa sense comptar.
  if (jaLl.length) {
    const l = jaLl[0], dins = new Set(cancons(db, l.id).map(c => c.recording_msid));
    return { ja: jaLl, resta, proposta: { id: l.id, nom: l.nom, coincidencies: msids.filter(m => dins.has(m)).length, noves: msids.filter(m => !dins.has(m)).length, continua: true } };
  }
  const cal = Math.min(MINIM, msids.length);
  let millor = null;
  for (const l of files(db, 'SELECT id, nom FROM llista')) {
    const dins = new Set(cancons(db, l.id).map(c => c.recording_msid));
    const n = msids.filter(m => dins.has(m)).length;
    if (n >= cal && (!millor || n > millor.coincidencies)) millor = { id: l.id, nom: l.nom, coincidencies: n, noves: msids.length - n };
  }
  return { ja: jaLl, resta, proposta: millor };
}

// ───────── escriure ─────────
// Afegeix al final de la llista les cançons de les pistes que encara no hi són, en l'ordre en què van sonar, i apunta
// Scrobble.llista_id a totes les pistes. La durada, de la primera pista que la porti.
function afegeix(db, id, scrIds) {
  if (!scrIds.length) return 0;
  const pistes = files(db, `SELECT id, recording_msid, artista, pista, duration_ms FROM scrobble WHERE id IN (${scrIds.map(() => '?').join(',')}) ORDER BY listened_at, id`, scrIds);
  const dins = new Set(cancons(db, id).map(c => c.recording_msid));
  let pos = un(db, 'SELECT COALESCE(MAX(posicio), 0) AS p FROM llista_canco WHERE llista_id = ?', [id]).p, noves = 0;
  for (const s of pistes) {
    if (dins.has(s.recording_msid)) {
      if (s.duration_ms) db.run('UPDATE llista_canco SET durada_ms = ? WHERE llista_id = ? AND recording_msid = ? AND durada_ms IS NULL', [s.duration_ms, id, s.recording_msid]);
      continue;
    }
    dins.add(s.recording_msid); noves++;
    db.run('INSERT INTO llista_canco (llista_id, posicio, recording_msid, artista, pista, durada_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [id, ++pos, s.recording_msid, s.artista, s.pista, s.duration_ms || null]);
  }
  db.run(`UPDATE scrobble SET llista_id = ? WHERE id IN (${scrIds.map(() => '?').join(',')})`, [id, ...scrIds]);
  return noves;
}
// «Això és una llista»: només el nom. Si ja n'hi ha una que es diu així, les cançons hi van (no se'n fa una de bessona).
export const crea = (nom, scrIds) => db => {
  nom = String(nom || '').trim();
  if (!nom) throw new Error('Cal un nom.');
  const ja = perNom(db, nom);
  let id = ja?.id;
  if (!id) { db.run('INSERT INTO llista (nom, data_alta) VALUES (?, ?)', [nom, new Date().toISOString()]); id = un(db, 'SELECT last_insert_rowid() AS id').id; }
  return { id, nom: ja?.nom || nom, existia: !!ja, noves: afegeix(db, id, scrIds) };
};
// Confirmar la llista reconeguda (ACT-634): les cançons de la sessió que no hi eren, al final.
export const confirma = (id, scrIds) => db => ({ id, noves: afegeix(db, id, scrIds) });
export const canviaNom = (id, nom) => db => {
  nom = String(nom || '').trim();
  if (!nom) throw new Error('Cal un nom.');
  const altra = perNom(db, nom);
  if (altra && altra.id !== id) throw new Error(`Ja hi ha una llista que es diu «${altra.nom}».`);
  db.run('UPDATE llista SET nom = ? WHERE id = ?', [nom, id]);
};
// Treure una cançó: surt de la llista i les posicions es tornen a numerar. Les pistes que ja van sonar amb la llista
// conserven Scrobble.llista_id: van sonar així, i l'última escolta de la llista no canvia.
export const treuCanco = cancoId => db => {
  const c = un(db, 'SELECT llista_id FROM llista_canco WHERE id = ?', [cancoId]); if (!c) return;
  db.run('DELETE FROM llista_canco WHERE id = ?', [cancoId]);
  cancons(db, c.llista_id).forEach((x, i) => db.run('UPDATE llista_canco SET posicio = ? WHERE id = ?', [i + 1, x.id]));
};
// Esborrar la llista: les cançons i el nom. Les pistes tornen a ser cançons soltes (Scrobble.llista_id buit).
export const esborra = id => db => {
  db.run('UPDATE scrobble SET llista_id = NULL WHERE llista_id = ?', [id]);
  db.run('DELETE FROM llista_canco WHERE llista_id = ?', [id]);
  db.run('DELETE FROM llista WHERE id = ?', [id]);
};
