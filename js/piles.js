// Les Piles de L'Aparador (estructura 11; v1.51 i v1.53, §7.7 i §8.3; ACT-707 a ACT-714, ACT-720, ACT-744 i ACT-773).
// Aquí no hi ha pantalla: només el que es pregunta a l'arxiu i el que s'hi escriu. Cada escriptura és una funció (db) => …
// que la pantalla passa a arxiu.canvia(), com a afinacio.js.
//
// El que fa complir, i d'on surt:
//  · La llista (ACT-713): les entrades sense Pila_entrada.data_sortida, per Pila_entrada.data_alta, la més recent a dalt.
//  · Afegir (ACT-710, ACT-711): artista i títol escrits; si Ricard tria un suggeriment, queda casada (Pila_entrada.album_id)
//    al moment. Si no, el text es casa amb l'ÀLBUM per la normalització de la ACT-557 (Àlbum.Títol i Artista.Nom canònic o
//    Artista.Persona) i només si no hi ha dubte: si en coincideixen dos, queda com a text.
//  · La sortida (ACT-707, ACT-708, ACT-744): una entrada surt quan, en una escolta (Escolta.unio), els trossos del context
//    de la seva Pila posteriors a Pila_entrada.data_alta sumen sols el 75 % (suma de Escolta.completitud ≥ 0,75). Es compara
//    amb l'àlbum (Escolta.edicio_id → Edició.album_id), mai amb l'edició. Una de text també surt: en sortir (i no en donar
//    d'alta) s'ignora el que va entre parèntesis o claudàtors al final del títol, als dos costats, i si en coincideixen dos
//    guanya el que ha sonat; la entrada s'hi casa i surt. Pila_entrada.data_sortida guarda la data i deixa de veure's.
//  · «Torna a la Pila» (ACT-744): buida data_sortida i posa data_alta a avui (si no, l'escolta que la va treure la tornaria
//    a treure). «Treu de la Pila»: esborra la fila, no va a «Ja escoltats» i no es desfà.

import { norm } from './escoltes.js?v=15';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; let cols = null;
  while (st.step()) { const v = st.get(); cols ||= st.getColumnNames(); const o = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = v[i]; out.push(o); }
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
const ara = () => new Date().toISOString();
const LLINDAR_PILA = 0.75;
const teTaula = db => !!un(db, "SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'pila_entrada'");

// El títol sense el que va entre parèntesis o claudàtors al final (ACT-744, només en sortir): «Live (1975)» = «Live».
export const senseCua = s => { let t = String(s ?? ''); for (;;) { const u = t.replace(/\s*[\(\[][^\(\)\[\]]*[\)\]]\s*$/, ''); if (u === t) return t; t = u; } };

export function piles(db) {
  if (!teTaula(db)) return [];
  return files(db, 'SELECT id, nom, contextos FROM pila ORDER BY COALESCE(posicio, 99), id').map(p => ({ ...p, contextos: llista(p.contextos) }));
}
// Les entrades d'una Pila que hi són (ACT-713): la més recent primer.
export function entrades(db, pilaId) {
  return files(db, `SELECT pe.id, pe.pila_id, pe.artista, pe.titol, pe.album_id, pe.data_alta,
                           (SELECT COUNT(*) FROM edicio e WHERE e.album_id = pe.album_id) AS n_edicions,
                           (SELECT MIN(e.id) FROM edicio e WHERE e.album_id = pe.album_id) AS edicio_id
                    FROM pila_entrada pe WHERE pe.pila_id = ? AND pe.data_sortida IS NULL
                    ORDER BY pe.data_alta DESC, pe.id DESC`, [pilaId]);
}
// «Ja escoltats» (ACT-744): les que han sortit, la sortida més recent primer.
export function jaEscoltats(db, pilaId) {
  return files(db, `SELECT id, artista, titol, album_id, data_alta, data_sortida FROM pila_entrada
                    WHERE pila_id = ? AND data_sortida IS NOT NULL ORDER BY data_sortida DESC, id DESC`, [pilaId]);
}
export const entrada = (db, id) => un(db, 'SELECT * FROM pila_entrada WHERE id = ?', [id]);

// Les Piles on és un àlbum ara (casada i sense data_sortida): la fitxa (ACT-744) i la icona (ACT-773).
export function pilesDeLAlbum(db, albumId) {
  if (!teTaula(db) || !albumId) return [];
  return files(db, `SELECT pe.id, p.id AS pila_id, p.nom FROM pila_entrada pe JOIN pila p ON p.id = pe.pila_id
                    WHERE pe.album_id = ? AND pe.data_sortida IS NULL ORDER BY COALESCE(p.posicio, 99), p.id`, [albumId]);
}
// Tots els àlbums que són a alguna Pila, amb les seves Piles (ACT-773): album_id → [{ nom, pila_id }].
export function albumsEnPiles(db) {
  const m = new Map(); if (!teTaula(db)) return m;
  for (const r of files(db, `SELECT pe.album_id, p.id AS pila_id, p.nom FROM pila_entrada pe JOIN pila p ON p.id = pe.pila_id
                             WHERE pe.album_id IS NOT NULL AND pe.data_sortida IS NULL ORDER BY COALESCE(p.posicio, 99), p.id`)) {
    const l = m.get(r.album_id) || []; if (!l.some(x => x.pila_id === r.pila_id)) l.push(r); m.set(r.album_id, l);
  }
  return m;
}

// El mateix per edició (ACT-773): edicio_id → [{ nom, pila_id }], per pintar la icona a la portada de qualsevol edició de l'àlbum.
export function edicionsEnPiles(db) {
  const a = albumsEnPiles(db), m = new Map(); if (!a.size) return m;
  for (const r of files(db, `SELECT id, album_id FROM edicio WHERE album_id IN (${[...a.keys()].map(() => '?').join(',')})`, [...a.keys()])) m.set(r.id, a.get(r.album_id));
  return m;
}
// La icona d'una Pila (ACT-773): les tres d'entrada, la seva figura; una Pila nova, un cercle amb la inicial.
const FIGURA = { 'Gimnàs': '🏋', 'Avió/Tren/Bus': '✈', 'Cotxe': '🚗' };
export const figura = nom => FIGURA[nom] || String(nom || '?').trim().charAt(0).toUpperCase();

// Els àlbums de l'arxiu amb el seu artista (nom canònic i persona), per casar i per suggerir.
const albums = db => files(db, `SELECT a.id, a.titol, ar.nom_canonic AS art, ar.persona FROM album a JOIN artista ar ON ar.id = a.artista_id`);
const casaArtista = (a, art) => { const n = norm(art); return !n || norm(a.art) === n || (!!a.persona && norm(a.persona) === n); };

// ACT-711: el text es casa només si hi ha UN sol àlbum amb aquest títol i aquest artista (normalització de la ACT-557).
export function casaText(db, art, tit) {
  const t = norm(tit); if (!t || !norm(art)) return null;
  const c = albums(db).filter(a => norm(a.titol) === t && casaArtista(a, art));
  return c.length === 1 ? c[0].id : null;
}
// Els suggeriments mentre s'escriu (ACT-710): àlbums de l'arxiu que contenen el que s'ha escrit, a l'artista i al títol.
export function suggeriments(db, art, tit, max = 6) {
  const na = norm(art), nt = norm(tit); if (!na && !nt) return [];
  return albums(db).filter(a => (!nt || norm(a.titol).includes(nt)) && (!na || norm(a.art).includes(na) || (!!a.persona && norm(a.persona).includes(na))))
    .sort((x, y) => x.titol.localeCompare(y.titol)).slice(0, max);
}

// ───────── escriptures ─────────
export const afegeix = (pilaId, art, tit, albumId = null) => db => {
  let a = albumId || casaText(db, art, tit);
  if (a) { const r = un(db, 'SELECT a.titol, ar.nom_canonic AS art FROM album a JOIN artista ar ON ar.id = a.artista_id WHERE a.id = ?', [a]);
    if (r) { art = r.art; tit = r.titol; } }   // casada: amb el nom de l'arxiu
  db.run('INSERT INTO pila_entrada (pila_id, artista, titol, album_id, data_alta) VALUES (?, ?, ?, ?, ?)',
    [pilaId, String(art || '').trim(), String(tit || '').trim(), a || null, ara()]);
  return { album_id: a || null };
};
export const treu = id => db => { db.run('DELETE FROM pila_entrada WHERE id = ?', [id]); };
export const tornaALaPila = id => db => { db.run('UPDATE pila_entrada SET data_sortida = NULL, data_alta = ? WHERE id = ?', [ara(), id]); };

// La sortida automàtica (ACT-707, ACT-708, ACT-744). Es passa dins de cada canvi de l'arxiu: només llegeix les escoltes dels
// contextos de les Piles posteriors a la data d'alta més antiga de les entrades que hi són, i només escriu si alguna surt.
export function sortides(db) {
  if (!teTaula(db)) return 0;
  const ents = files(db, 'SELECT pe.id, pe.pila_id, pe.artista, pe.titol, pe.album_id, pe.data_alta, p.contextos FROM pila_entrada pe JOIN pila p ON p.id = pe.pila_id WHERE pe.data_sortida IS NULL');
  if (!ents.length) return 0;
  const ctxs = [...new Set(ents.flatMap(e => llista(e.contextos)))]; if (!ctxs.length) return 0;
  const desDe = ents.reduce((m, e) => (e.data_alta < m ? e.data_alta : m), ents[0].data_alta);
  const trossos = files(db, `SELECT COALESCE(s.unio, s.id) AS u, s.data_hora, s.context, s.completitud, e.album_id, a.titol, ar.nom_canonic AS art, ar.persona
                             FROM escolta s JOIN edicio e ON e.id = s.edicio_id JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id
                             WHERE s.data_hora > ? AND s.context IN (${ctxs.map(() => '?').join(',')})`, [desDe, ...ctxs]);
  if (!trossos.length) return 0;
  let n = 0;
  for (const en of ents) {
    const cs = new Set(llista(en.contextos)), suma = new Map();
    const t = norm(senseCua(en.titol));
    for (const x of trossos) {
      if (!cs.has(x.context) || x.data_hora <= en.data_alta) continue;
      if (en.album_id ? x.album_id !== en.album_id : !(t && norm(senseCua(x.titol)) === t && casaArtista(x, en.artista))) continue;
      const k = x.album_id + '|' + x.u, s = suma.get(k) || { album_id: x.album_id, c: 0, data: x.data_hora };
      s.c += x.completitud || 0; if (x.data_hora > s.data) s.data = x.data_hora; suma.set(k, s);
    }
    const bons = [...suma.values()].filter(s => s.c >= LLINDAR_PILA - 1e-9).sort((a, b) => (b.data > a.data ? 1 : -1));
    if (!bons.length) continue;
    db.run('UPDATE pila_entrada SET data_sortida = ?, album_id = ? WHERE id = ?', [bons[0].data, bons[0].album_id, en.id]); n++;
  }
  return n;
}
