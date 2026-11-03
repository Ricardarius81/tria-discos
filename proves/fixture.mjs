// L'arxiu sintètic del banc de proves: es construeix amb les mateixes migracions que fa servir la màquina (js/esquema.js),
// de manera que sempre té l'estructura vigent. No surt de dades reals de Ricard: noms de discos que coneix, i res més.
// Les hores es calculen des d'ara: el banc sempre prova una sessió que «sona ara».
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const ARREL = path.resolve(AQUI, '..');
const require = createRequire(import.meta.url);

let SQL = null;
export async function motor() {
  if (!SQL) SQL = await require(path.join(ARREL, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(ARREL, 'vendor/sqljs', f) });
  return SQL;
}
export async function migracions() {
  return (await import(pathToFileURL(path.join(ARREL, 'js/esquema.js')).href)).MIGRACIONS;
}

const MIN = 60e3, H = 60 * MIN, D = 24 * H;
const iso = t => new Date(t).toISOString();

// Les pistes que «envia» el ListenBrainz fals. Hores relatives a `ara`.
export function escoltesLB(ara) {
  const p = (compte, t, artista, pista, album, min, extra = {}) => ({ compte, t, artista, pista, album, min, ...extra });
  const out = [];
  // S1 · fa dos dies, tancada: In a Silent Way sencer (dues pistes, 38′). Una targeta pendent.
  const s1 = ara - 2 * D;
  out.push(p('crimsonnnn', s1, 'Miles Davis', 'Shhh / Peaceful', 'In a Silent Way', 18));
  out.push(p('crimsonnnn', s1 + 18 * MIN, 'Miles Davis', 'In a Silent Way / It\'s About That Time', 'In a Silent Way', 20));
  // S0 · un pòdcast fa tres hores, sol: per a «Ignora sempre».
  out.push(p('crimsonnnn', ara - 3 * H, 'Beck Did It Better', 'Episodi 12', null, null));
  // S2 · ara: Angel's Flight sencer (3 × 15′) que va acabar fa 10 minuts, i Structures from Silence que va començar fa 6.
  const s2 = ara - 55 * MIN;
  out.push(p('crimsonnnn', s2, 'Biosphere', 'Angel\'s Flight I', 'Angel\'s Flight', 15));
  out.push(p('crimsonnnn', s2 + 15 * MIN, 'Biosphere', 'Angel\'s Flight II', 'Angel\'s Flight', 15));
  out.push(p('crimsonnnnfeina', s2 + 30 * MIN, 'Biosphere', 'Angel\'s Flight III', 'Angel\'s Flight', 15));
  out.push(p('crimsonnnn', ara - 6 * MIN, 'Steve Roach', 'Reflections in Suspension', 'Structures from Silence', 28));
  return out.map((x, i) => ({
    listened_at: Math.floor(x.t / 1000),
    recording_msid: 'msid-banc-' + (i + 1),
    compte: x.compte,
    track_metadata: { artist_name: x.artista, track_name: x.pista, release_name: x.album,
                      additional_info: x.min ? { duration_ms: x.min * MIN } : {} }
  }));
}

// L'arxiu, en bytes.
export async function arxiu(ara = Date.now()) {
  const S = await motor(), M = await migracions();
  const db = new S.Database();
  M.forEach((m, i) => { db.exec(m); db.exec(`PRAGMA user_version = ${i + 1}`); });
  const run = (sql, p = []) => db.run(sql, p);
  run(`INSERT INTO meta (clau, valor) VALUES ('creat', ?), ('arrencada-escoltes', ?), ('ajust-car-pendent-30-10', 'banc'), ('ajust-3-2-bis-31-10', 'banc')`,
      [iso(ara - 10 * D), iso(ara - 3 * D)]);
  const art = [[1, 'Biosphere'], [2, 'James Murray'], [3, 'Steve Roach'], [4, 'Miles Davis'], [5, 'Phase90'], [6, 'Outkast']];
  for (const [id, n] of art) run('INSERT INTO artista (id, nom_canonic) VALUES (?, ?)', [id, n]);
  // [id, títol, artista, conjunt, posició]
  const alb = [[1, 'Angel\'s Flight', 1, null, null], [2, 'Careful Now', 2, 'Careful Now', 1], [3, 'Careful Now (Unmasked)', 2, 'Careful Now', 2],
               [4, 'Structures from Silence', 3, null, null], [5, 'In a Silent Way', 4, null, null], [6, 'Infinitati', 5, null, null], [7, 'Stankonia', 6, null, null]];
  for (const [id, t, a, c, p] of alb) run('INSERT INTO album (id, titol, artista_id, conjunt, posicio) VALUES (?, ?, ?, ?, ?)', [id, t, a, c, p]);
  // [id, àlbum, durada, rotació, canal, codi bandcamp, emparellaments]
  const eds = [[1, 1, 45, 1, 'amazon', null, ['Angel\'s Flight']], [2, 2, 52, 1, 'amazon', null, null], [3, 3, 48, 1, 'amazon', null, null],
               [4, 4, 60, 1, 'bandcamp', '1234567890', ['Structures from Silence']], [5, 5, 38, 0, 'youtube', null, ['In a Silent Way']],
               [6, 6, 41, 1, 'aimp', null, null], [7, 7, 98, 0, 'amazon', null, null], [8, 7, 112, 0, 'amazon', null, null]];
  eds.forEach(([id, a, d, r, c, bc, emp], i) => run(`INSERT INTO edicio (id, album_id, durada_total, rotacio_actual, app_escolta, codi_bandcamp,
      emparellaments, data_referencia_rotacio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, a, d, r, c, bc, emp ? JSON.stringify(emp) : null, iso(ara - 5 * D + i * MIN)]));
  run('INSERT INTO preferent (artista_id, ordre) VALUES (1, 1)');
  run('INSERT INTO preferent (artista_id, ordre, proper_titol) VALUES (4, 2, ?)', ['Kind of Blue']);
  run('INSERT INTO preferent (artista_id, ordre) VALUES (2, 3)');
  const bytes = db.export(); db.close();
  return bytes;
}
