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

// ───────── l'arxiu gran, per a la prova de velocitat (ACT-738) ─────────
// «Un archivo falso grande (miles de discos, años de escuchas)». Res de real: noms inventats, sempre els mateixos
// (llavor fixa), perquè dues publicacions es puguin comparar. Les escoltes es calculen amb el mateix recalcula de la màquina.
// Per defecte, 10.000 discos i 5 anys d'escoltes (unes 50 pistes al dia, unes 90.000 en total).
export async function arxiuGran(ara = Date.now(), { discos = 10000, anys = 5 } = {}) {
  const S = await motor(), M = await migracions();
  const E = await import(pathToFileURL(path.join(ARREL, 'js/escoltes.js')).href + '?v=14');
  const db = new S.Database();
  M.forEach((m, i) => { db.exec(m); db.exec(`PRAGMA user_version = ${i + 1}`); });
  let llavor = 738;
  const atzar = () => { llavor = (llavor + 0x6D2B79F5) | 0; let t = Math.imul(llavor ^ (llavor >>> 15), 1 | llavor);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const tria = l => l[Math.floor(atzar() * l.length)];
  const entre = (a, b) => a + Math.floor(atzar() * (b - a + 1));
  const PARAULES = ['Silent', 'Structures', 'Flight', 'Light', 'Ocean', 'Night', 'Glass', 'Mirror', 'Forest', 'Stone', 'River', 'Echo',
    'Drift', 'Horizon', 'Winter', 'Salt', 'Ash', 'Signal', 'Field', 'Pulse', 'Garden', 'Shadow', 'Morning', 'Dust', 'Ember', 'Cloud'];
  const BR = ['Ambient', 'Jazz', 'Clàssica', 'Rock', 'Electrònica', 'Neoclàssica', 'Progressiu', 'Folk / cantautor', 'Krautrock', 'Post-rock'];
  const CTX = ['Treballant', 'A casa', 'Caminant / pel carrer', 'Avió / Tren / Bus', 'Dormir', 'Escolta activa', 'Conduint (sol)', 'Llegir'];
  const inici = ara - anys * 365 * D;
  db.exec('BEGIN');
  const run = (sql, p = []) => db.run(sql, p);
  run(`INSERT INTO meta (clau, valor) VALUES ('creat', ?), ('arrencada-escoltes', ?), ('ajust-car-pendent-30-10', 'banc'), ('ajust-3-2-bis-31-10', 'banc')`,
      [iso(inici - D), iso(inici)]);
  const nArt = Math.max(10, Math.round(discos / 4));
  for (let i = 1; i <= nArt; i++) run('INSERT INTO artista (id, nom_canonic) VALUES (?, ?)', [i, `Artista ${tria(PARAULES)} ${i}`]);
  const eds = [];
  let edId = 0, partId = 0;
  const nGrups = Math.round(discos / 250);
  for (let a = 1; a <= discos; a++) {
    const titol = `${tria(PARAULES)} ${tria(PARAULES)} ${a}`;
    const grup = a <= nGrups * 2 ? 'Grup ' + Math.ceil(a / 2) : null;
    const gen = atzar() < 0.85 ? JSON.stringify([tria(BR)]) : null;
    run('INSERT INTO album (id, titol, artista_id, conjunt, posicio, generes) VALUES (?, ?, ?, ?, ?, ?)',
        [a, titol, entre(1, nArt), grup, grup ? (a % 2) + 1 : null, gen]);
    const nEd = atzar() < 0.08 ? 2 : 1;
    for (let k = 0; k < nEd; k++) {
      edId++;
      const durada = entre(25, 80), rot = eds.length < 300 && atzar() < 0.05 ? 1 : 0;
      run(`INSERT INTO edicio (id, album_id, nom_edicio, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio, portada)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [edId, a, k ? 'Deluxe' : null, durada, rot, tria(['amazon', 'bandcamp', 'youtube', 'aimp']),
           JSON.stringify([k ? titol + ' (Deluxe)' : titol]), iso(inici + atzar() * (ara - inici)), atzar() < 0.7 ? 'release/fals-' + edId : null]);
      const e = { id: edId, titol: k ? titol + ' (Deluxe)' : titol, durada, rot, parts: [] };
      if (atzar() < 0.03) {
        for (let n = 1, np = entre(2, 5); n <= np; n++) {
          partId++; run('INSERT INTO part (id, edicio_id, numero, nom, durada, rotacio_actual) VALUES (?, ?, ?, ?, ?, ?)',
            [partId, edId, n, 'Volume ' + n, Math.round(durada / np), n === 1 ? 1 : 0]);
          e.parts.push(n);
        }
        // els noms de cada volum, confirmats, com fa Ricard a la safata
        run('UPDATE edicio SET emparellaments = ? WHERE id = ?', [JSON.stringify([e.titol, ...e.parts.map(n => e.titol + ' Volume ' + n)]), edId]);
      }
      eds.push(e);
    }
  }
  for (let i = 1; i <= 40; i++) run('INSERT INTO preferent (artista_id, ordre) VALUES (?, ?)', [i, i]);
  for (let i = 0; i < 3000; i++) run('INSERT INTO puntuacio (edicio_id, valor, data) VALUES (?, ?, ?)', [entre(1, edId), entre(0, 5), iso(inici + atzar() * (ara - inici))]);
  // Les escoltes: cada dia, de dues a quatre sessions, cada una d'un a tres discos; tres de cada cinc, de la rotació.
  const rotacio = eds.filter(e => e.rot);
  const st = db.prepare(`INSERT OR IGNORE INTO scrobble (compte, listened_at, artista, pista, album, duration_ms, recording_msid, caa_release_mbid,
                         estat, context, atencio, resposta_de) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let dia = 0; dia < anys * 365; dia++) {
    let t = inici + dia * D + entre(7, 10) * H;
    for (let s = 0, ns = entre(2, 4); s < ns; s++) {
      const compte = atzar() < 0.8 ? 'crimsonnnn' : 'crimsonnnnfeina';
      const resolt = ara - t > 2 * D, ctx = tria(CTX);
      for (let d = 0, nd = entre(1, 3); d < nd; d++) {
        const r = atzar();
        if (r < 0.03) {   // un pòdcast o una cançó solta, sense disc a l'arxiu
          st.run([compte, iso(t), 'Pòdcast ' + entre(1, 20), 'Episodi ' + entre(1, 500), null, 40 * 60e3, 'msid-podcast-' + entre(1, 3000), null,
                  resolt ? 'ignorat' : 'pendent', null, null, null]);
          t += 41 * 60e3; continue;
        }
        // Dos discos que no són a l'arxiu, per identificar a la safata: un de fa 300 dies i un de fa 10 (el que encara no s'ha
        // resolt també ha de sortir sense tallar tota la història).
        const desconegut = dia === anys * 365 - 300 && s === 0 && d === 0 ? 'A' : dia === anys * 365 - 10 && s === 0 && d === 0 ? 'B' : null;
        const e = desconegut ? { id: 'desc-' + desconegut, titol: 'Disc desconegut ' + desconegut, durada: 40, parts: [] }
          : r < 0.6 && rotacio.length ? tria(rotacio) : tria(eds);
        // les pistes sumen la durada de l'edició, com un disc de veritat
        const durada = (e.parts.length ? Math.round(e.durada / e.parts.length) : e.durada) * 60e3;
        const np = Math.max(1, Math.round(durada / (60e3 * entre(4, 9))));
        const fins = atzar() < 0.7 ? np : entre(1, np);
        const album = e.parts.length ? e.titol + ' Volume ' + tria(e.parts) : e.titol;
        for (let p = 1; p <= fins; p++) {
          const pista = Math.round(durada * p / np) - Math.round(durada * (p - 1) / np);
          st.run([compte, iso(t), desconegut ? 'Artista desconegut' : 'Artista', `Pista ${p}`, album, pista, `msid-${e.id}-${p}`, atzar() < 0.3 ? 'caa-' + e.id : null,
                  resolt ? 'resolt' : 'pendent', resolt ? ctx : null, resolt ? (ctx === 'Dormir' ? 'Dormir' : 'Efectes plens') : null, resolt ? 'targeta' : null]);
          t += pista;
        }
      }
      t += entre(45, 180) * 60e3;
    }
  }
  st.free();
  for (let l = 1; l <= 5; l++) {
    run('INSERT INTO llista (id, nom, data_alta) VALUES (?, ?, ?)', [l, 'Llista ' + l, iso(inici + l * D)]);
    for (let p = 1; p <= 20; p++) run('INSERT INTO llista_canco (llista_id, posicio, recording_msid, artista, pista, durada_ms) VALUES (?, ?, ?, ?, ?, ?)',
                                      [l, p, `msid-llista-${l}-${p}`, 'Artista', 'Cançó ' + p, 240e3]);
  }
  db.exec('COMMIT');
  const t0 = Date.now();
  E.recalcula(db);
  const recalcul = Date.now() - t0;
  const n = { discos: edId, scrobbles: db.exec('SELECT COUNT(*) FROM scrobble')[0].values[0][0], escoltes: db.exec('SELECT COUNT(*) FROM escolta')[0].values[0][0] };
  const bytes = db.export(); db.close();
  return { bytes, n, recalcul };
}
