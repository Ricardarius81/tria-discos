// Les dades del Faristol, llegides i escrites sobre l'arxiu (tram 3, bloc 3.1).
// Aquí no hi ha pantalla: només el que es pregunta a l'arxiu i el que s'hi escriu.
// Cada escriptura és una funció (db) => … que la pantalla passa a arxiu.canvia().

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
const json = v => (v && v.length ? JSON.stringify(v) : null);
const ara = () => new Date().toISOString();
import * as T from './tags.js?v=1';
import { SQL_COMPTA } from './escoltes.js?v=5';

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// La puntuació (§5.1): de 5 a 0. «Sense puntuar» no és un valor: és no tenir-ne.
export const ESCALA = [['Mític', 5], ['Discàs', 4], ['Bo', 3], ['Normal', 2], ['Fluix', 1], ['Ignorar', 0]];
export const FISICS = ['CD', 'vinil'];

// ───────── Discos en Rotació ─────────
// Una edició és a la rotació si té Rotació actual. Si té parts i cap no és viva, la caixa espera (§7.1, v1.33).
// L'ordre (§7.7, v1.37, opció C): el més recent entre l'últim «Escoltar ara», l'última escolta real
// i el dia que va entrar a la rotació. Si empaten —la llavor va entrar tota alhora—, l'ordre de càrrega (ACT-356).
export function rotacio(db) {
  return carrega(db, 'e.rotacio_actual = 1').sort((x, y) => (y.clau.localeCompare(x.clau)) || (x.id - y.id));
}
// La fitxa d'una edició, sigui o no a la rotació: és la que es pinta després de treure-la (pregunta 11).
export const fitxa = (db, id) => carrega(db, 'e.id = ?', [id])[0] || null;
function carrega(db, on, params = []) {
  const eds = files(db, `
    SELECT e.id, e.album_id, e.nom_edicio, e.durada_total, e.rotacio_actual, e.app_escolta, e.codi_bandcamp, e.formats, e.tags,
           e.darrera_obertura, e.data_referencia_rotacio, e.portada, e.portada_origen, e.data_darrera_pregunta_puntuacio,
           a.titol, a.artista_id, a.tags AS album_tags, a.conjunt, a.posicio, ar.nom_canonic AS art,
           (SELECT COUNT(*) FROM edicio x WHERE x.album_id = e.album_id) AS n_edicions,
           (SELECT MAX(s.data_hora) FROM escolta s WHERE s.edicio_id = e.id AND ${SQL_COMPTA}) AS darrera_escolta
    FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id
    WHERE ${on}`, params);
  for (const e of eds) {
    e.parts = files(db, 'SELECT id, numero, nom, durada, rotacio_actual, codi_bandcamp FROM part WHERE edicio_id = ? ORDER BY numero', [e.id]);
    e.viva = e.parts.find(p => p.rotacio_actual) || null;
    e.esperant = e.parts.length > 0 && !e.viva;
    e.formats = llista(e.formats); e.tags = llista(e.tags); e.album_tags = llista(e.album_tags);
    // L'historial sencer de notes (§5.2): la vigent és l'última.
    e.notes = files(db, 'SELECT id, valor, data FROM puntuacio WHERE edicio_id = ? ORDER BY data, id', [e.id]);
    e.nota = e.notes[e.notes.length - 1] || null;
    e.fisic = e.formats.some(f => FISICS.includes(f));
    e.min = e.viva ? (e.viva.durada || null) : e.durada_total;
    e.bc = e.viva ? e.viva.codi_bandcamp : e.codi_bandcamp;
    e.clau = [e.darrera_obertura, e.darrera_escolta, e.data_referencia_rotacio].filter(Boolean).sort().pop() || '';
    // La línia «Grup» de la fitxa (ACT-449): tots els discos del grup que són a l'arxiu, en el seu ordre, en rotació o no.
    e.discosGrup = e.conjunt ? files(db, 'SELECT id, titol, posicio FROM album WHERE conjunt = ? ORDER BY COALESCE(posicio, 99), id', [e.conjunt]) : [];
  }
  return eds;
}

// Posar en rotació una edició que ja és a l'arxiu (des de l'Historial): té durada per força (ACT-188).
export const posaIdEnRotacio = id => db => {
  db.run('UPDATE edicio SET rotacio_actual = 1, data_referencia_rotacio = ? WHERE id = ?', [ara(), id]);
  const a = un(db, 'SELECT a.artista_id FROM edicio e JOIN album a ON a.id = e.album_id WHERE e.id = ?', [id]);
  if (a) db.run('UPDATE preferent SET proper_titol = NULL WHERE artista_id = ?', [a.artista_id]);
};

export function edicio(db, id) {
  return rotacio(db).find(e => e.id === id) || null;
}

// ───────── Artistes Preferents ─────────
export function preferents(db) {
  const ps = files(db, `
    SELECT p.id, p.ordre, p.proper_titol, ar.id AS artista_id, ar.nom_canonic AS nom, ar.retrat, ar.retrat_origen, ar.variants
    FROM preferent p JOIN artista ar ON ar.id = p.artista_id ORDER BY p.ordre, p.id`);
  const rot = rotacio(db);
  for (const p of ps) p.rot = rot.find(e => e.artista_id === p.artista_id) || null;
  return ps;
}

// Els artistes que compten com a preferents: els de la llista i les fitxes que comparteixen Persona amb algun d'ells
// (l'abast del §7.7, F4-22). Així The Inward Circles compta com a Richard Skelton. Per al marc daurat de la rotació (31-10).
export function artistesPreferents(db) {
  const pers = new Set(files(db, `SELECT COALESCE(ar.persona, ar.nom_canonic) AS p FROM preferent pr JOIN artista ar ON ar.id = pr.artista_id`).map(r => norm(r.p)));
  return new Set(files(db, 'SELECT id, COALESCE(persona, nom_canonic) AS p FROM artista').filter(r => pers.has(norm(r.p))).map(r => r.id));
}

// El canal que la màquina proposa per a un disc nou: el del darrer disc del mateix artista, o Amazon (ACT-349).
export function canalPerDefecte(db, artistaId) {
  if (!artistaId) return 'amazon';
  const r = un(db, `SELECT e.app_escolta FROM edicio e JOIN album a ON a.id = e.album_id
                    WHERE a.artista_id = ? AND e.app_escolta IS NOT NULL ORDER BY e.id DESC LIMIT 1`, [artistaId]);
  return r?.app_escolta || 'amazon';
}

// Busca un artista pel nom o per una variant d'escriptura. No en crea cap.
export function trobaArtista(db, nom) {
  const n = norm(nom);
  if (!n) return null;
  for (const a of files(db, 'SELECT id, nom_canonic, variants FROM artista')) {
    if (norm(a.nom_canonic) === n || llista(a.variants).some(v => norm(v) === n)) return a;
  }
  return null;
}

// Si el disc ja té fitxa a l'arxiu (mateix artista i títol), la seva edició. Llavors no cal tornar a escriure la durada.
export function trobaEdicio(db, art, tit) {
  const a = trobaArtista(db, art); if (!a) return null;
  const al = files(db, 'SELECT id, titol FROM album WHERE artista_id = ?', [a.id]).find(x => norm(x.titol) === norm(tit));
  return al ? un(db, 'SELECT id, durada_total FROM edicio WHERE album_id = ? ORDER BY id DESC LIMIT 1', [al.id]) : null;
}

// ───────── escriptures ─────────
// Totes reben db i el que calgui, i no pinten res.

// «Escoltar ara»: queda la data, que mou el disc al capdavant (opció C). No és una escolta: l'escolta la porta ListenBrainz.
export const obre = id => db => db.run('UPDATE edicio SET darrera_obertura = ? WHERE id = ?', [ara(), id]);

// Corregir la durada: de la part viva si n'hi ha, si no de l'edició. Mai buida (ACT-188).
export const canviaDurada = (id, min, partId) => db => partId
  ? db.run('UPDATE part SET durada = ? WHERE id = ?', [min, partId])
  : db.run('UPDATE edicio SET durada_total = ? WHERE id = ?', [min, id]);
export const canviaCanal = (id, canal) => db => db.run('UPDATE edicio SET app_escolta = ? WHERE id = ?', [canal, id]);

// La fitxa d'un grup (2-11, proposta de Ricard): tots els discos del grup que són a l'arxiu, en el seu ordre, en rotació o no.
// Per a cada àlbum, l'edició que es pinta és la que és en rotació, i si no, la més recent.
export function grup(db, conjunt) {
  return files(db, 'SELECT id, posicio FROM album WHERE conjunt = ? ORDER BY COALESCE(posicio, 99), id', [conjunt]).map(a => {
    const e = un(db, 'SELECT id FROM edicio WHERE album_id = ? ORDER BY rotacio_actual DESC, id DESC LIMIT 1', [a.id]);
    return e ? fitxa(db, e.id) : null;
  }).filter(Boolean);
}

// El nom d'un grup posat per Ricard (v1.46, ACT-520 i ACT-521). Àlbum.Conjunt identifica el grup i el títol curt
// es calcula amb ell, així que no es toca: el nom que posa Ricard viu a meta, clau 'noms-grups', com { conjunt: nom }.
// Si hi és, surt en lloc del títol automàtic a Discos en Rotació, a l'Historial i a la fitxa. Buit = el de la màquina.
const NOMS_GRUPS = 'noms-grups';
export const nomsGrups = db => { try { return JSON.parse(un(db, 'SELECT valor FROM meta WHERE clau = ?', [NOMS_GRUPS])?.valor || '{}'); } catch { return {}; } };
export const posaNomGrup = (conjunt, nom) => db => {
  const m = nomsGrups(db), net = String(nom || '').trim();
  if (net) m[conjunt] = net; else delete m[conjunt];
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [NOMS_GRUPS, JSON.stringify(m)]);
  return net || null;
};

// Els canals escrits a mà (v1.35, «Altre»): entren a la llista i la propera vegada surten com a opció.
// Viuen a meta, clau 'canals-propis' (camp de la construcció, per ratificar), i viatgen amb l'arxiu.
// A Edició.App d'escolta s'hi escriu 'propi:<nom>'. No tenen adreça: el ▶ no pot obrir res.
const CANALS_PROPIS = 'canals-propis';
export const canalsPropis = db => llista(un(db, 'SELECT valor FROM meta WHERE clau = ?', [CANALS_PROPIS])?.valor);
export const afegeixCanalPropi = nom => db => {
  const l = canalsPropis(db);
  if (!l.some(x => norm(x) === norm(nom))) l.push(nom);
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [CANALS_PROPIS, JSON.stringify(l)]);
  return 'propi:' + l.find(x => norm(x) === norm(nom));
};

// Treure una edició sencera de la rotació (amb totes les seves parts).
export const treu = id => db => {
  db.run('UPDATE edicio SET rotacio_actual = 0 WHERE id = ?', [id]);
  db.run('UPDATE part SET rotacio_actual = 0 WHERE edicio_id = ?', [id]);
};

// La part viva surt i la caixa es queda esperant.
export const deixaEsperant = id => db => db.run('UPDATE part SET rotacio_actual = 0 WHERE edicio_id = ?', [id]);

// Posa viva una part concreta de la caixa (la següent, o qualsevol amb «Reprèn»).
export const posaPart = (id, numero) => db => {
  db.run('UPDATE part SET rotacio_actual = 0 WHERE edicio_id = ?', [id]);
  db.run('UPDATE part SET rotacio_actual = 1 WHERE edicio_id = ? AND numero = ?', [id, numero]);
  db.run('UPDATE edicio SET rotacio_actual = 1, data_referencia_rotacio = ? WHERE id = ?', [ara(), id]);
};

export const puntua = (id, valor) => db => {
  db.run('INSERT INTO puntuacio (edicio_id, valor, data) VALUES (?, ?, ?)', [id, valor, ara()]);
  db.run('UPDATE edicio SET data_darrera_pregunta_puntuacio = ? WHERE id = ?', [ara(), id]);
};
// Canviar la nota des de la fitxa (bloc 3.2 bis, ACT-392 i decisió de Ricard del 31-10, opció A).
// «Substitueix la nota actual» (m'havia equivocat): canvia el valor de l'última fila i en CONSERVA la data,
// perquè l'error es corregeix al moment en què es va cometre i la pregunta 13 segueix comptant des d'aquell judici.
// «Afegeix una nota nova» és puntua(): una fila nova amb la data d'avui. «Posa-li nota», quan no n'hi ha cap, també.
export const substitueixNota = (id, valor) => db => {
  const u = un(db, 'SELECT id FROM puntuacio WHERE edicio_id = ? ORDER BY data DESC, id DESC LIMIT 1', [id]);
  if (u) db.run('UPDATE puntuacio SET valor = ? WHERE id = ?', [valor, u.id]);
  else puntua(id, valor)(db);
};

// Els tags (bloc 3.2 bis): s'escriuen les dues llistes, la de l'àlbum i la de l'edició (§6.3).
export const desaTags = (edicioId, albumId, { album, edicio }) => db => {
  db.run('UPDATE album SET tags = ? WHERE id = ?', [json(album), albumId]);
  db.run('UPDATE edicio SET tags = ? WHERE id = ?', [json(edicio), edicioId]);
};
// Els idiomes que ja fa servir l'arxiu, perquè es puguin tocar sense escriure'ls.
export function idiomesUsats(db) {
  const s = new Set(T.IDIOMES_BASE);
  for (const r of files(db, 'SELECT tags FROM album WHERE tags IS NOT NULL'))
    for (const t of llista(r.tags)) if (t.startsWith(T.IDIOMA.nom + ':')) s.add(t.slice(T.IDIOMA.nom.length + 1).trim());
  return [...s];
}

// «Encara no»: no hi ha nota; queda la data de la pregunta perquè torni més endavant (§5.1, v1.7).
export const encaraNo = id => db => db.run('UPDATE edicio SET data_darrera_pregunta_puntuacio = ? WHERE id = ?', [ara(), id]);

// Torna a la rotació una edició que s'acaba de treure.
export const tornaARotacio = id => db => db.run('UPDATE edicio SET rotacio_actual = 1 WHERE id = ?', [id]);

// Posar un disc en rotació a mà. Cap disc entra sense durada (ACT-188).
// Si l'àlbum ja existeix per a aquest artista, no se'n fa un de duplicat: torna a entrar la seva edició.
// Retorna el que ha passat, per poder-ho dir.
export const posaEnRotacio = ({ art, tit, min, canal }) => db => {
  let a = trobaArtista(db, art);
  if (!a) { db.run('INSERT INTO artista (nom_canonic) VALUES (?)', [art.trim()]); a = { id: un(db, 'SELECT last_insert_rowid() AS id').id }; }
  const albums = files(db, 'SELECT id, titol FROM album WHERE artista_id = ?', [a.id]).filter(x => norm(x.titol) === norm(tit));
  const fisic = FISICS.includes(canal);
  let res = { nou: true };
  if (albums.length) {
    const e = un(db, 'SELECT id FROM edicio WHERE album_id = ? ORDER BY id DESC LIMIT 1', [albums[0].id]);
    if (e) {
      db.run('UPDATE edicio SET rotacio_actual = 1, data_referencia_rotacio = ? WHERE id = ?', [ara(), e.id]);
      res = { nou: false, id: e.id };
    }
  }
  if (res.nou) {
    let albumId = albums[0]?.id;
    if (!albumId) { db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [tit.trim(), a.id]); albumId = un(db, 'SELECT last_insert_rowid() AS id').id; }
    db.run(`INSERT INTO edicio (album_id, durada_total, rotacio_actual, app_escolta, formats, data_referencia_rotacio, lot_carrega)
            VALUES (?, ?, 1, ?, ?, ?, 'FARISTOL')`, [albumId, min, fisic ? null : canal, fisic ? json([canal]) : null, ara()]);
    res.id = un(db, 'SELECT last_insert_rowid() AS id').id;
  }
  // Quan un disc d'un preferent entra a la rotació, la nota del «proper» s'esborra (maqueta v13, A.49).
  db.run('UPDATE preferent SET proper_titol = NULL WHERE artista_id = ?', [a.id]);
  return res;
};

// Afegeix un artista a preferents, al capdavant de la llista (ACT de la v1.37, opció A).
export const afegeixPreferent = nom => db => {
  let a = trobaArtista(db, nom);
  if (!a) { db.run('INSERT INTO artista (nom_canonic) VALUES (?)', [nom.trim()]); a = { id: un(db, 'SELECT last_insert_rowid() AS id').id }; }
  if (un(db, 'SELECT id FROM preferent WHERE artista_id = ?', [a.id])) return { jaHiEra: true };
  const min = un(db, 'SELECT MIN(ordre) AS m FROM preferent')?.m ?? 1;
  db.run('INSERT INTO preferent (artista_id, ordre) VALUES (?, ?)', [a.id, min - 1]);
  return { jaHiEra: false };
};
export const afegeixPreferentId = artistaId => db => {
  if (un(db, 'SELECT id FROM preferent WHERE artista_id = ?', [artistaId])) return;
  const min = un(db, 'SELECT MIN(ordre) AS m FROM preferent')?.m ?? 1;
  db.run('INSERT INTO preferent (artista_id, ordre) VALUES (?, ?)', [artistaId, min - 1]);
};
export const treuPreferent = id => db => db.run('DELETE FROM preferent WHERE id = ?', [id]);
export const ordenaPreferents = ids => db => ids.forEach((id, i) => db.run('UPDATE preferent SET ordre = ? WHERE id = ?', [i + 1, id]));
export const posaProper = (id, titol) => db => db.run('UPDATE preferent SET proper_titol = ? WHERE id = ?', [titol || null, id]);

// ───────── portades i retrats (bloc 3.2) ─────────
// edicio.portada: la referència a Cover Art Archive, «release-group/<mbid>» o «release/<mbid>».
// artista.retrat: l'adreça de la miniatura de Wikimedia Commons, o «drive:<id>» si l'ha pujada Ricard.

// Els discos en rotació sense portada que la sonda pot provar. Els rebutjats esperen l'escolta (3.3).
function senseportada(db) {
  return files(db, `SELECT e.id, a.titol, ar.nom_canonic AS art FROM edicio e JOIN album a ON a.id = e.album_id
                    JOIN artista ar ON ar.id = a.artista_id
                    WHERE e.rotacio_actual = 1 AND e.portada IS NULL AND e.portada_origen IS NULL ORDER BY e.id DESC`);
  // Els més nous primer: són els que es miren ara, i si la sonda es talla, que no siguin sempre ells els que esperen.
}
export const discosSensePortada = senseportada;
// Els preferents sense foto que la sonda pot provar.
export function artistesSenseRetrat(db) {
  return files(db, `SELECT ar.id, ar.nom_canonic AS nom FROM preferent p JOIN artista ar ON ar.id = p.artista_id
                    WHERE ar.retrat IS NULL AND ar.retrat_origen IS NULL ORDER BY p.ordre, p.id`);
}
// La sonda només escriu on encara no hi ha res: mai trepitja una imatge que ja hi és, ni un rebuig.
export const posaPortadaSonda = llistaRes => db => llistaRes.forEach(([id, ref]) =>
  db.run("UPDATE edicio SET portada = ?, portada_origen = 'sonda' WHERE id = ? AND portada IS NULL AND portada_origen IS NULL", [ref, id]));
export const posaRetratSonda = llistaRes => db => llistaRes.forEach(([id, url]) =>
  db.run("UPDATE artista SET retrat = ?, retrat_origen = 'sonda' WHERE id = ? AND retrat IS NULL AND retrat_origen IS NULL", [url, id]));
// «No és aquesta»: la imatge marxa i es recorda que no era, perquè la sonda no la torni a posar.
export const rebutjaPortada = id => db => db.run("UPDATE edicio SET portada = NULL, portada_origen = 'rebutjada' WHERE id = ?", [id]);
export const rebutjaRetrat = id => db => db.run("UPDATE artista SET retrat = NULL, retrat_origen = 'rebutjat' WHERE id = ?", [id]);
// La portada que tria o puja Ricard: mana sobre tot, també sobre la de l'escolta (3.3). origen: 'triada' · 'pujada'.
export const posaPortada = (id, ref, origen) => db => db.run('UPDATE edicio SET portada = ?, portada_origen = ? WHERE id = ?', [ref, origen, id]);
// La foto triada per Ricard entre les candidates ('triat'): mana com la pujada.
export const posaRetrat = (id, ref, origen) => db => db.run('UPDATE artista SET retrat = ?, retrat_origen = ? WHERE id = ?', [ref, origen, id]);
// La foto pujada a mà: mana sobre tot.
export const posaRetratMa = (id, ref) => db => db.run("UPDATE artista SET retrat = ?, retrat_origen = 'ma' WHERE id = ?", [ref, id]);

// ───────── ajust únic: el «car pendent» del 30-10-2026 (decisió de Ricard, opció B) ─────────
// No es recarrega l'arxiu: s'aplica només la diferència amb la llavor del 26-10, i es conserva tot el que s'ha fet a l'app.
// Es marca a meta perquè no es repeteixi mai, ni en aquest mòbil ni en cap altre.
export const AJUST_CP = 'ajust-car-pendent-30-10';
export const ajustFet = db => !!un(db, 'SELECT valor FROM meta WHERE clau = ?', [AJUST_CP]);
export const ajustaCarPendent3010 = db => {
  const fets = [];
  const edicioDe = (art, tit) => { const a = trobaArtista(db, art); if (!a) return null;
    const al = files(db, 'SELECT id, titol FROM album WHERE artista_id = ?', [a.id]).find(x => norm(x.titol) === norm(tit));
    return al ? un(db, 'SELECT id, rotacio_actual FROM edicio WHERE album_id = ? ORDER BY id DESC LIMIT 1', [al.id]) : null; };
  // 1. Les dues notes de prova (Animation i Weasels Ripped My Flesh) eren inventades: fora, i sense data de pregunta.
  //    Al «car pendent» tots dos discos segueixen marcats *R*: si van sortir de la rotació per la prova, hi tornen.
  for (const [art, tit] of [['Jon Anderson', 'Animation'], ['The Mothers of Invention', 'Weasels Ripped My Flesh']]) {
    const e = edicioDe(art, tit); if (!e) { fets.push('no trobat: ' + tit); continue; }
    const n = un(db, 'SELECT COUNT(*) AS n FROM puntuacio WHERE edicio_id = ?', [e.id]).n;
    db.run('DELETE FROM puntuacio WHERE edicio_id = ?', [e.id]);
    db.run('UPDATE edicio SET data_darrera_pregunta_puntuacio = NULL, rotacio_actual = 1 WHERE id = ?', [e.id]);
    fets.push(`${tit}: ${n} nota${n === 1 ? '' : 's'} de prova esborrada${n === 1 ? '' : 's'}${e.rotacio_actual ? '' : ', torna a la rotació'}`);
  }
  // 2. Patience surt de la rotació (al «car pendent» ja no porta *R*). Sense nota: es podrà posar des de la fitxa.
  const pat = edicioDe('Peter Hammill', 'Patience');
  if (pat) { db.run('UPDATE edicio SET rotacio_actual = 0 WHERE id = ?', [pat.id]); fets.push('Patience surt de la rotació'); }
  // 3. Entren cinc discos, en l'ordre del «car pendent»: l'últim anotat queda primer. Canal: Amazon Music per a tots
  //    (la regla de la llavor; The Love Songs l'hereta de Patience). Steve Roach & Serena Gabriel, artista apart i sense Persona.
  const nous = [['Steve Roach & Serena Gabriel', 'Temple of the Melting Dawn', 71], ['William Basinski', 'Passing the Cup of Sorrows', 37],
                ['The Avalanches', 'No Bad Memories', 52], ['Tom Petty', 'Full Moon Fever', 40], ['Peter Hammill', 'The Love Songs', 43]];
  const t0 = Date.now() - nous.length * 1000;
  nous.forEach(([art, tit, min], i) => {
    if (edicioDe(art, tit)?.rotacio_actual) { fets.push(tit + ' ja hi era'); return; }
    const r = posaEnRotacio({ art, tit, min, canal: 'amazon' })(db);
    db.run('UPDATE edicio SET data_referencia_rotacio = ?, lot_carrega = ? WHERE id = ?', [new Date(t0 + i * 1000).toISOString(), 'CP-30-10', r.id]);
    fets.push(tit + ' entra');
  });
  db.run('INSERT INTO meta (clau, valor) VALUES (?, ?)', [AJUST_CP, ara() + ' · ' + fets.join(' · ')]);
  return fets;
};

// ───────── ajust únic del bloc 3.2 bis (31-10-2026) ─────────
// 1. Els tags de la llavor, al seu lloc: amb el nom complet, i els d'àlbum a l'àlbum (§6.3). Fallada de Claude a la llavor.
// 2. Els set codis de Bandcamp que faltaven, llegits el 31-10 de la pàgina de cada disc (item_id). Només on no n'hi ha cap.
export const AJUST_3_2_BIS = 'ajust-3-2-bis-31-10';
export const ajust32bisFet = db => !!un(db, 'SELECT valor FROM meta WHERE clau = ?', [AJUST_3_2_BIS]);
export const ajusta32bis = db => {
  const fets = [];
  let moguts = 0;
  for (const e of files(db, 'SELECT e.id, e.tags, a.id AS album_id, a.tags AS album_tags FROM edicio e JOIN album a ON a.id = e.album_id')) {
    const abans = { a: llista(e.album_tags), e: llista(e.tags) };
    const r = T.normalitza(abans.a, abans.e);
    if (JSON.stringify(r.album) !== JSON.stringify(abans.a) || JSON.stringify(r.edicio) !== JSON.stringify(abans.e)) {
      db.run('UPDATE album SET tags = ? WHERE id = ?', [json(r.album), e.album_id]);
      db.run('UPDATE edicio SET tags = ? WHERE id = ?', [json(r.edicio), e.id]);
      moguts++;
    }
  }
  fets.push(`Tags de la llavor posats al seu lloc: ${moguts} disc${moguts === 1 ? '' : 's'}`);
  const edicioDe = (art, tit) => { const a = trobaArtista(db, art); if (!a) return null;
    const al = files(db, 'SELECT id, titol FROM album WHERE artista_id = ?', [a.id]).find(x => norm(x.titol) === norm(tit));
    return al ? un(db, 'SELECT id, codi_bandcamp FROM edicio WHERE album_id = ? ORDER BY id DESC LIMIT 1', [al.id]) : null; };
  for (const [art, tit, codi, alt] of [['Øystein Skar', 'Hem', '3495443710'], ['James Murray', 'Careful Now', '3810550386'],
                                       ['James Murray', 'Careful Now Unmasked', '1431708919', 'Careful Now (Unmasked)']]) {
    const e = edicioDe(art, tit) || (alt && edicioDe(art, alt));
    if (!e) { fets.push('No trobat: ' + tit); continue; }
    if (e.codi_bandcamp) { fets.push(tit + ': ja tenia codi'); continue; }
    db.run('UPDATE edicio SET codi_bandcamp = ? WHERE id = ?', [codi, e.id]); fets.push(tit + ': codi de Bandcamp posat');
  }
  const ic = edicioDe('D York', 'The Italian Chronicles');
  if (!ic) fets.push('No trobat: The Italian Chronicles');
  else {
    let n = 0;
    for (const [num, codi] of [[2, '2526469990'], [3, '2113399248'], [4, '1029541982'], [5, '1492360063']]) {
      const p = un(db, 'SELECT id, codi_bandcamp FROM part WHERE edicio_id = ? AND numero = ?', [ic.id, num]);
      if (p && !p.codi_bandcamp) { db.run('UPDATE part SET codi_bandcamp = ? WHERE id = ?', [codi, p.id]); n++; }
    }
    fets.push(`The Italian Chronicles: ${n} codi${n === 1 ? '' : 's'} de volum posat${n === 1 ? '' : 's'} (del 2 al 5)`);
  }
  db.run('INSERT INTO meta (clau, valor) VALUES (?, ?)', [AJUST_3_2_BIS, ara() + ' · ' + fets.join(' · ')]);
  return fets;
};

// ───────── agrupar des de la fitxa (1-11, adelanta una part de la pestanya Agrupacions) ─────────
// Àlbum.Conjunt és el nom del grup i Àlbum.Posició l'ordre (§7.5). Un àlbum és d'un sol grup.
// L'ordre és el d'afegir-los: el disc de la fitxa d'on es parteix és el primer d'un grup nou; un disc que s'hi suma va al final.
// El nom d'un grup nou és el títol del primer disc, com els de la llavor («Careful Now», «Infinitati»).
export const albumsPerAgrupar = (db, albumId) => files(db, `
  SELECT a.id, a.titol, a.conjunt, ar.nom_canonic AS art, (SELECT MIN(e.id) FROM edicio e WHERE e.album_id = a.id) AS edicio_id
  FROM album a JOIN artista ar ON ar.id = a.artista_id WHERE a.id != ? ORDER BY ar.nom_canonic, a.titol`, [albumId]);
export const agrupa = (deId, ambId) => db => {
  const de = un(db, 'SELECT id, titol, conjunt FROM album WHERE id = ?', [deId]), amb = un(db, 'SELECT id, titol, conjunt FROM album WHERE id = ?', [ambId]);
  if (!de || !amb) throw new Error('No trobo el disc.');
  if (de.conjunt && amb.conjunt) {
    if (de.conjunt === amb.conjunt) return { grup: de.conjunt, res: true };
    throw new Error(`«${amb.titol}» ja és al grup «${amb.conjunt}». Un disc només pot ser d'un grup: treu-lo'n primer.`);
  }
  const seguent = g => (un(db, 'SELECT MAX(posicio) AS m FROM album WHERE conjunt = ?', [g])?.m || 0) + 1;
  if (de.conjunt || amb.conjunt) {
    const g = de.conjunt || amb.conjunt, nou = de.conjunt ? amb : de;
    db.run('UPDATE album SET conjunt = ?, posicio = ? WHERE id = ?', [g, seguent(g), nou.id]);
    return { grup: g };
  }
  let g = de.titol, i = 2;
  while (un(db, 'SELECT 1 AS x FROM album WHERE conjunt = ?', [g])) g = `${de.titol} (${i++})`;
  db.run('UPDATE album SET conjunt = ?, posicio = 1 WHERE id = ?', [g, de.id]);
  db.run('UPDATE album SET conjunt = ?, posicio = 2 WHERE id = ?', [g, amb.id]);
  return { grup: g };
};
// Treure un disc del grup. Si només en queda un, el grup es desfà: un grup d'un sol disc no és un grup.
// Els que queden es tornen a numerar sense forats, en el mateix ordre.
export const treuDelGrup = albumId => db => {
  const a = un(db, 'SELECT conjunt FROM album WHERE id = ?', [albumId]); if (!a?.conjunt) return null;
  db.run('UPDATE album SET conjunt = NULL, posicio = NULL WHERE id = ?', [albumId]);
  const resta = files(db, 'SELECT id FROM album WHERE conjunt = ? ORDER BY COALESCE(posicio, 99), id', [a.conjunt]);
  // Un grup que es desfà perd el nom que li havia posat Ricard (consequència dita, ACT-520).
  if (resta.length < 2) { db.run('UPDATE album SET conjunt = NULL, posicio = NULL WHERE conjunt = ?', [a.conjunt]); posaNomGrup(a.conjunt, null)(db); return { grup: a.conjunt, desfet: true }; }
  resta.forEach((x, i) => db.run('UPDATE album SET posicio = ? WHERE id = ?', [i + 1, x.id]));
  return { grup: a.conjunt, desfet: false };
};
