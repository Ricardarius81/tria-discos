// L'Afinació (v1.49, §8.4, §8.7 bis; ACT-656 a ACT-686). Aquí no hi ha pantalla: només el que es pregunta a l'arxiu i el
// que s'hi escriu. Cada escriptura és una funció (db) => … que la pantalla passa a arxiu.canvia(), com a dades.js.
//
// El que fa complir, i d'on surt:
//  · La llista de L'Afinació (ACT-673, ACT-683, ACT-684, ACT-686): una fila per EDICIÓ. Hi entra la que té Àlbum.Gènere
//    buit o, si porta «Clàssica», sense cap llenguatge o sense cap formació; i la que té Edició.Per afinar; i des de la
//    ACT-696, la que té una escolta que ha sonat més del que diu la fitxa (motiu «durada?», duradesSospitoses). A dalt les
//    marcades, de la més recent a la més antiga; a sota la resta, per escoltes QUE COMPTEN (SQL_COMPTA, el 75 %).
//  · El gènere a la fitxa (ACT-684): les 26 branques del §6.2 en l'ordre en què es toquen; si hi ha «Clàssica», Llenguatge
//    i Formació (diversos valors cadascun), i Instrument solista si hi ha «instrument sol». Treure «Clàssica» i desar-ho
//    esborra els tres.
//  · «Per afinar» / «Ja està afinat» (ACT-674, ACT-676, ACT-681): Edició.Per afinar guarda la data; buit = no marcat.
//  · «Un que ja tinc amb un altre nom» (ACT-658 a ACT-664, ACT-670, ACT-680): juntar dues fitxes en una.
//  · «És part d'un que ja tinc» (ACT-665 a ACT-669, ACT-685): una fitxa passa a ser una Part d'una altra.

import { SQL_COMPTA, norm, recalcula, canviaEdicio, duradesSospitoses } from './escoltes.js?v=14';
import { treuDelGrup } from './dades.js?v=25';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
const json = v => (v && v.length ? JSON.stringify(v) : null);
const ara = () => new Date().toISOString();
// Juntar i fer part toquen moltes taules: o es fa tot, o res (un error a mitges no pot deixar l'arxiu partit).
const tot = fn => db => {
  db.run('SAVEPOINT afinacio');
  try { const r = fn(db); db.run('RELEASE afinacio'); return r; }
  catch (e) { db.run('ROLLBACK TO afinacio'); db.run('RELEASE afinacio'); throw e; }
};

// ───────── el gènere (§6.2, §7.7) ─────────
export const CLASSICA = 'Clàssica';
export const INSTRUMENT_SOL = 'instrument sol';
// Les 26 branques, en l'ordre de la taula del §6.2. Afegir-ne una és gratis (§8.9): és un valor d'aquesta llista.
export const BRANQUES = ['Clàssica', 'Neoclàssica', 'Ambient', 'New Age', 'Electrònica', 'Krautrock', 'Rock', 'Hard-Rock', 'Heavy',
  'Metal', 'Progressiu', 'Punk / New wave', 'Shoegaze / Dream pop', 'Post-rock', 'Pop', 'Indie / Alternatiu', 'Folk / cantautor',
  'Cançó tradicional / arrel', 'Country / Americana', 'Blues', 'Jazz', 'Soul / Funk / R&B', 'Rap / Hip-hop', 'Reggae', 'Musical', 'Zappa'];
// Els dos eixos de la clàssica (§6.2): tres llenguatges i vuit formacions (v1.3).
export const LLENGUATGES = ['Antiga', 'Canon', 'Atonal / Dodecafònica'];
export const FORMACIONS = ['vocal-coral', 'lied', 'òpera', 'ballet', 'sarsuela', 'orquestral', 'cambra', 'instrument sol'];

export function genere(db, albumId) {
  const a = un(db, 'SELECT generes, llenguatge, formacio, instrument_solista, subgeneres FROM album WHERE id = ?', [albumId]) || {};
  return { generes: llista(a.generes), llenguatge: llista(a.llenguatge), formacio: llista(a.formacio), instrument: a.instrument_solista || '',
           subgeneres: llista(a.subgeneres) };
}
// ───────── els subgèneres (v1.52, ACT-733) ─────────
// Llista oberta, sense arbre. Un subgènere escrit a mà es neteja (espais) i va en minúscula, com un idioma nou (§6.3); si,
// normalitzat, ja n'hi ha un d'igual a l'arxiu, es fa servir aquell: és el que redueix els noms dobles («Piano Ambient» i
// «piano ambient»). Decisió de construcció de Claude, per ratificar. «Ambient piano» és un altre nom: la màquina no ho sap.
export const subgenereNet = txt => String(txt ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
// Els ja usats, per oferir-los primer a la fulla (ACT-733): tots els de l'arxiu, els més usats primer i, a igualtat,
// per ordre alfabètic. D'on surt la llista: d'Àlbum.Subgèneres de tots els àlbums (fixat en la construcció).
export function subgeneresUsats(db) {
  const n = new Map();
  for (const r of files(db, 'SELECT subgeneres FROM album WHERE subgeneres IS NOT NULL')) for (const s of llista(r.subgeneres)) n.set(s, (n.get(s) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ca')).map(([s]) => s);
}
export function subgenereCanonic(db, txt) {
  const net = subgenereNet(txt); if (!net) return null;
  return subgeneresUsats(db).find(s => norm(s) === norm(net)) || net;
}
// El que li falta a un àlbum per sortir de L'Afinació (ACT-684): res, el gènere, o els eixos de la clàssica.
export const falta = g => !g.generes.length ? 'sense gènere'
  : g.generes.includes(CLASSICA) && (!g.llenguatge.length || !g.formacio.length) ? 'falten llenguatge / formació' : null;

// Desar el gènere de l'àlbum (és de l'àlbum: canvia a totes les edicions, §6.2). Sense «Clàssica» no hi ha eixos ni
// instrument (ACT-684). L'instrument també se'n va si ja no hi ha «instrument sol»: només té sentit amb aquesta formació
// (§6.2, «solo se rellena en la formació instrument sol»; decisió de construcció de Claude, per ratificar).
// Des de la v1.52 (ACT-732) es crida a cada toc de la fulla, sense «Desa'l». La fulla guarda en memòria el que hi ha tocat
// mentre és oberta: si treus «Clàssica» i la tornes a tocar, els eixos tornen (tornar a tocar és el desfés).
// Els subgèneres (ACT-733) només es desen si hi ha almenys una branca: sense branca, la columna queda buida i la fulla els
// recorda mentre és oberta. Així es compleix que un disc amb subgènere sempre té branca (decisió de construcció de Claude).
export const desaGenere = (albumId, { generes, llenguatge, formacio, instrument, subgeneres = null }) => db => {
  const gs = [...new Set(generes.filter(g => BRANQUES.includes(g)))];
  const cl = gs.includes(CLASSICA);
  const ll = cl ? LLENGUATGES.filter(x => llenguatge.includes(x)) : [];
  const fo = cl ? FORMACIONS.filter(x => formacio.includes(x)) : [];
  const ins = cl && fo.includes(INSTRUMENT_SOL) && String(instrument || '').trim() ? String(instrument).trim() : null;
  db.run('UPDATE album SET generes = ?, llenguatge = ?, formacio = ?, instrument_solista = ? WHERE id = ?', [json(gs), json(ll), json(fo), ins, albumId]);
  if (subgeneres !== null) {
    const sub = gs.length ? [...new Map(subgeneres.map(subgenereNet).filter(Boolean).map(x => [norm(x), x])).values()] : [];
    db.run('UPDATE album SET subgeneres = ? WHERE id = ?', [json(sub), albumId]);
  }
};

// ───────── «Per afinar» (ACT-674, ACT-676, ACT-681) ─────────
export const marcaPerAfinar = id => db => db.run('UPDATE edicio SET per_afinar = ? WHERE id = ?', [ara(), id]);
export const jaAfinat = id => db => db.run('UPDATE edicio SET per_afinar = NULL WHERE id = ?', [id]);

// Les escoltes que compten de cada edició, una per escolta sencera (ACT-585): el mateix que compta l'Historial (ACT-683).
export function escoltesPerEdicio(db) {
  return new Map(files(db, `SELECT s.edicio_id AS id, COUNT(DISTINCT COALESCE(s.unio, s.id)) AS n FROM escolta s WHERE ${SQL_COMPTA} GROUP BY s.edicio_id`)
    .map(r => [r.id, r.n]));
}
const perNom = (x, y) => x.art.localeCompare(y.art, 'ca', { sensitivity: 'base' }) || x.titol.localeCompare(y.titol, 'ca', { sensitivity: 'base' }) || x.id - y.id;

// ───────── la llista de L'Afinació (ACT-683, ACT-686) ─────────
// Torna { marcats, resta }. Cada fila diu els seus motius: «per afinar», «durada?» (ACT-696), «sense gènere»,
// «falten llenguatge / formació».
// Una marcada que a més no té gènere els porta tots dos (decisió de construcció, per ratificar). Empat d'escoltes, per artista
// i títol, com Tots els discos (decisió de construcció).
export function llistaAfinacio(db) {
  const n = escoltesPerEdicio(db), sosp = duradesSospitoses(db);
  const out = files(db, `
    SELECT e.id, e.album_id, e.nom_edicio, e.durada_total, e.per_afinar, e.rotacio_actual,
           COALESCE((SELECT p.portada FROM part p WHERE p.edicio_id = e.id AND p.rotacio_actual = 1), e.portada) AS portada,
           (SELECT COUNT(*) FROM edicio x WHERE x.album_id = e.album_id) AS n_edicions,
           a.titol, a.generes, a.llenguatge, a.formacio, ar.nom_canonic AS art
    FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id`)
    .map(r => {
      const f = falta({ generes: llista(r.generes), llenguatge: llista(r.llenguatge), formacio: llista(r.formacio) });
      // ACT-696: «durada?», calculat (duradesSospitoses), no guardat; s'apaga amb «Posa X′» o «La durada és bona».
      const dq = sosp.get(r.id);
      return { ...r, escoltes: n.get(r.id) || 0, falta: f, durada_sospitosa: dq || null,
               motius: [r.per_afinar ? 'per afinar' : null, dq ? 'durada?' : null, f].filter(Boolean) };
    })
    .filter(r => r.motius.length);
  return {
    marcats: out.filter(r => r.per_afinar).sort((x, y) => y.per_afinar.localeCompare(x.per_afinar) || x.id - y.id),
    resta: out.filter(r => !r.per_afinar).sort((x, y) => y.escoltes - x.escoltes || perNom(x, y))
  };
}

// ───────── la pregunta d'identitat a la fitxa (ACT-658) ─────────
// Les candidates (ACT-670): totes les edicions de l'arxiu menys aquesta (ACT-661); a dalt, les del mateix artista o d'un
// altre nom seu (Artista.Persona, com la ACT-600). Cada una ensenya les seves escoltes, si té tags i si té parts (ACT-660).
export function candidatesIdentitat(db, id) {
  const de = un(db, `SELECT a.artista_id, COALESCE(ar.persona, ar.nom_canonic) AS p FROM edicio e JOIN album a ON a.id = e.album_id
                     JOIN artista ar ON ar.id = a.artista_id WHERE e.id = ?`, [id]);
  if (!de) return { mateix: [], altres: [] };
  const n = escoltesPerEdicio(db);
  const tot = files(db, `
    SELECT e.id, e.album_id, e.nom_edicio, e.durada_total, e.rotacio_actual, e.tags, a.tags AS album_tags, a.titol, a.artista_id,
           ar.nom_canonic AS art, ar.variants, COALESCE(ar.persona, ar.nom_canonic) AS p,
           (SELECT COUNT(*) FROM part p WHERE p.edicio_id = e.id) AS n_parts
    FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id WHERE e.id != ?`, [id])
    .map(r => ({ ...r, escoltes: n.get(r.id) || 0, ambTags: !!(llista(r.tags).length || llista(r.album_tags).length),
                 cerca: norm([r.art, ...llista(r.variants), r.titol, r.nom_edicio].join(' ')) }))
    .sort(perNom);
  const seu = r => r.artista_id === de.artista_id || norm(r.p) === norm(de.p);
  return { mateix: tot.filter(seu), altres: tot.filter(r => !seu(r)) };
}

const edicioSencera = (db, id) => un(db, 'SELECT * FROM edicio WHERE id = ?', [id]);
const nParts = (db, id) => un(db, 'SELECT COUNT(*) AS n FROM part WHERE edicio_id = ?', [id]).n;

// Esborra una edició que ja s'ha buidat (després de juntar o de fer-la part). No passa per D.rastre: l'àlbum compartit pot ser
// d'un grup sense que això importi. Si l'àlbum es queda sense edicions, s'esborra; si era d'un grup, abans en surt (ACT-520).
function esborraBuida(db, id) {
  const e = un(db, 'SELECT album_id FROM edicio WHERE id = ?', [id]); if (!e) return;
  if (un(db, 'SELECT 1 AS x FROM escolta WHERE edicio_id = ? LIMIT 1', [id])) throw new Error('Encara té escoltes: no s\'esborra.');
  db.run('UPDATE preferent SET proper_edicio_id = NULL WHERE proper_edicio_id = ?', [id]);
  db.run('UPDATE preferent SET edicio_actual_id = NULL WHERE edicio_actual_id = ?', [id]);
  db.run('DELETE FROM puntuacio WHERE edicio_id = ?', [id]);
  db.run('DELETE FROM part WHERE edicio_id = ?', [id]);
  db.run('DELETE FROM edicio WHERE id = ?', [id]);
  if (!un(db, 'SELECT COUNT(*) AS n FROM edicio WHERE album_id = ?', [e.album_id]).n) {
    treuDelGrup(e.album_id)(db);
    db.run('DELETE FROM album WHERE id = ?', [e.album_id]);
  }
}
const uneix = (a, b, clau = x => x) => { const out = [...a]; for (const x of b) if (!out.some(y => clau(y) === clau(x))) out.push(x); return out; };
const propia = o => o === 'triada' || o === 'pujada';

// ───────── «Un que ja tinc amb un altre nom»: juntar (ACT-659 a ACT-664, ACT-680) ─────────
// Per què no es pot juntar, o null. La fitxa que desapareix amb parts no es junta (ACT-664); si l'elegida és una caixa amb
// parts, és «És part» (ACT-680, 1).
export function noEsPotJuntar(db, de, a) {
  if (de === a) return 'és el mateix disc';
  if (nParts(db, de)) return 'parts';
  if (a && nParts(db, a)) return 'caixa';
  return null;
}
// «Dura molt més: no serà una part d'aquest?» (ACT-680, 2): l'elegida, sense parts, dura més del doble. «El doble» és una
// xifra de Claude, SENSE CALIBRAR. Avisa i no bloqueja.
export const DOBLE = 2;
export function duraMoltMes(db, de, a) {
  const x = edicioSencera(db, de), y = edicioSencera(db, a);
  return !!(x && y && !nParts(db, a) && y.durada_total > DOBLE * x.durada_total);
}
// La fitxa que s'obre (de) desapareix i l'elegida a la llista (a) es queda (ACT-660). El rastre (ACT-662):
//  · llistes d'INVENTARI, s'uneixen: Formats disponibles, Codi de catàleg, Emparellaments, l'historial de Puntuació i
//    Suggeriments descartats (els de l'edició i els de l'àlbum);
//  · llistes de DESCRIPCIÓ, com un bloc —Gènere, Llenguatge, Formació, Instrument solista, Compositor i els tags de l'àlbum i
//    de l'edició—: mana el de la que es queda si hi té alguna cosa; si no, passa el de l'altra;
//  · la resta, la que es queda; si és buit, el de l'altra. Edició.Per afinar també (ACT-681);
//  · les escoltes a la que es queda; la rotació passa si només l'altra hi era; els Preferent apunten a la que es queda;
//    Àlbum.Conjunt passa si només l'altre àlbum era d'un grup;
//  · la portada (ACT-663): la que va triar o pujar Ricard guanya a la de la màquina, sigui on sigui.
// Escoltes, emparellaments, nota i rotació es mouen amb «Canvia l'edició» (ACT-659), perquè les dues portes deixin el mateix
// rastre (ACT-466). Tot dins d'un sol canvi: un sol «Desfés» ho desfà tot.
export const junta = ({ de, a }) => tot(db => {
  const motiu = noEsPotJuntar(db, de, a);
  if (motiu === 'parts') throw new Error('Una fitxa amb parts no es junta (ACT-664).');
  if (motiu === 'caixa') throw new Error('És una caixa: fes servir «És part d\'un que ja tinc».');
  if (motiu) throw new Error('No es pot juntar: ' + motiu + '.');
  const x = edicioSencera(db, de), y = edicioSencera(db, a);
  if (!x || !y) throw new Error('No trobo el disc.');
  // inventari de l'edició
  for (const c of ['formats', 'codis_cataleg', 'suggeriments_descartats']) {
    const u = uneix(llista(y[c]), llista(x[c]), v => typeof v === 'string' ? norm(v) : JSON.stringify(v));
    db.run(`UPDATE edicio SET ${c} = ? WHERE id = ?`, [json(u), a]);
  }
  // descripció: un bloc
  const ax = un(db, 'SELECT * FROM album WHERE id = ?', [x.album_id]), ay = un(db, 'SELECT * FROM album WHERE id = ?', [y.album_id]);
  const mateixAlbum = ax.id === ay.id;
  const BLOC = ['generes', 'llenguatge', 'formacio', 'compositors', 'tags', 'subgeneres'];   // subgeneres: ACT-733
  const teBloc = (al, ed) => (!mateixAlbum && (BLOC.some(c => llista(al[c]).length) || !!al.instrument_solista)) || llista(ed.tags).length > 0;
  if (!teBloc(ay, y) && teBloc(ax, x)) {
    if (!mateixAlbum) db.run('UPDATE album SET generes = ?, llenguatge = ?, formacio = ?, compositors = ?, tags = ?, instrument_solista = ?, subgeneres = ? WHERE id = ?',
      [ax.generes, ax.llenguatge, ax.formacio, ax.compositors, ax.tags, ax.instrument_solista, ax.subgeneres, ay.id]);
    db.run('UPDATE edicio SET tags = ? WHERE id = ?', [x.tags, a]);
  }
  if (!mateixAlbum) {
    db.run('UPDATE album SET suggeriments_descartats = ? WHERE id = ?', [json(uneix(llista(ay.suggeriments_descartats), llista(ax.suggeriments_descartats), v => JSON.stringify(v))), ay.id]);
    for (const c of ['any_original', 'caracter_1', 'caracter_2']) db.run(`UPDATE album SET ${c} = COALESCE(${c}, ?) WHERE id = ?`, [ax[c], ay.id]);
    // el grup passa si només l'altre era d'un grup, i si l'altre àlbum es queda sense edicions (si no, continua al seu grup)
    const sola = un(db, 'SELECT COUNT(*) AS n FROM edicio WHERE album_id = ?', [ax.id]).n === 1;
    if (ax.conjunt && !ay.conjunt && sola) {
      db.run('UPDATE album SET conjunt = ?, posicio = ? WHERE id = ?', [ax.conjunt, ax.posicio, ay.id]);
      db.run('UPDATE album SET conjunt = NULL, posicio = NULL WHERE id = ?', [ax.id]);
    }
  }
  // la resta de l'edició: la que es queda, i si és buit, el de l'altra
  for (const c of ['nom_edicio', 'any_edicio', 'segell', 'productor', 'procedencia', 'enllac_bandcamp', 'codi_bandcamp', 'app_escolta',
                   'data_primera_escolta', 'lot_carrega', 'per_afinar'])
    db.run(`UPDATE edicio SET ${c} = COALESCE(${c}, ?) WHERE id = ?`, [x[c], a]);
  // la portada (ACT-663)
  if (x.portada && ((propia(x.portada_origen) && !propia(y.portada_origen)) || !y.portada))
    db.run('UPDATE edicio SET portada = ?, portada_origen = ? WHERE id = ?', [x.portada, x.portada_origen, a]);
  // els preferents
  db.run('UPDATE preferent SET proper_edicio_id = ? WHERE proper_edicio_id = ?', [a, de]);
  db.run('UPDATE preferent SET edicio_actual_id = ? WHERE edicio_actual_id = ?', [a, de]);
  // escoltes, emparellaments, nota i rotació: «Canvia l'edició» amb correcció (ACT-659)
  const r = canviaEdicio({ de, a, correccio: true })(db);
  esborraBuida(db, de);
  return r;
});

// ───────── «És part d'un que ja tinc» (ACT-665 a ACT-669, ACT-685) ─────────
// El nom que porta l'escolta: el primer release_name recordat de la fitxa que sobra; si no en té, el títol del seu àlbum.
export function nomDeLescolta(db, de) {
  const x = un(db, 'SELECT e.emparellaments, a.titol FROM edicio e JOIN album a ON a.id = e.album_id WHERE e.id = ?', [de]);
  return llista(x?.emparellaments).find(n => !n.startsWith('msid:')) || x?.titol || null;
}
// Un nom genèric de part (ACT-665): cap nom, o «Part 48».
export const nomGeneric = nom => !String(nom ?? '').trim() || /^part\s*\d+$/i.test(String(nom).trim());
// El número que proposa la app per a una part nova (ACT-669): el següent lliure. Ricard escriu el bo.
export const seguentLliure = (db, a) => (un(db, 'SELECT MAX(numero) AS m FROM part WHERE edicio_id = ?', [a])?.m || 0) + 1;
export const partsDe = (db, a) => files(db, 'SELECT id, numero, nom, durada, rotacio_actual, portada, data_darrera_escolta FROM part WHERE edicio_id = ? ORDER BY numero', [a]);
// La nota que no passa (ACT-685): si la caixa ja en té, la de la fitxa que desapareix es perd. Torna el valor, o null.
export function notaQueNoPassa(db, de, a) {
  if (!un(db, 'SELECT 1 AS x FROM puntuacio WHERE edicio_id = ? LIMIT 1', [a])) return null;
  return un(db, 'SELECT valor FROM puntuacio WHERE edicio_id = ? ORDER BY data DESC, id DESC LIMIT 1', [de])?.valor ?? null;
}
// partId: una part que ja existeix; si no, numero: una part nova (ACT-666), amb la Durada total de la fitxa que sobra.
// Si la caixa no té parts, es crea la primera i passa de bloc a caixa amb parts (ACT-668).
export const esPart = ({ de, a, partId = null, numero = null }) => tot(db => {
  if (de === a) throw new Error('És el mateix disc.');
  if (nParts(db, de)) throw new Error('Una caixa no pot ser part d\'una altra: les parts són d\'un sol nivell (§8.4).');
  const x = edicioSencera(db, de), y = edicioSencera(db, a);
  if (!x || !y) throw new Error('No trobo el disc.');
  const nom = nomDeLescolta(db, de);
  let part;
  if (partId) {
    part = un(db, 'SELECT * FROM part WHERE id = ? AND edicio_id = ?', [partId, a]);
    if (!part) throw new Error('No trobo la part.');
    if (nomGeneric(part.nom) && nom) db.run('UPDATE part SET nom = ? WHERE id = ?', [nom, part.id]);            // ACT-665
    if (!part.durada) db.run('UPDATE part SET durada = ? WHERE id = ?', [x.durada_total, part.id]);
  } else {
    const n = Math.round(Number(numero));
    if (!(n > 0)) throw new Error('Cal el número de la part.');
    if (un(db, 'SELECT 1 AS x FROM part WHERE edicio_id = ? AND numero = ?', [a, n])) throw new Error(`Ja hi ha la part ${n}: tria-la a la llista, o un altre número.`);
    db.run('INSERT INTO part (edicio_id, numero, nom, durada) VALUES (?, ?, ?, ?)', [a, n, nom, x.durada_total]);
    part = un(db, 'SELECT * FROM part WHERE id = last_insert_rowid()');
  }
  // la portada i el codi de Bandcamp, a la part si no en té (ratificats, ACT-685: 2 i 3)
  if (x.portada && !part.portada) db.run('UPDATE part SET portada = ? WHERE id = ?', [x.portada, part.id]);
  if (x.codi_bandcamp && !part.codi_bandcamp) db.run('UPDATE part SET codi_bandcamp = ? WHERE id = ?', [x.codi_bandcamp, part.id]);
  // els emparellaments passen a la caixa: les pistes que arribin amb aquest nom hi aniran, i a la part pel seu Nom (ACT-665)
  db.run('UPDATE edicio SET emparellaments = ? WHERE id = ?', [json(uneix(llista(y.emparellaments), llista(x.emparellaments), v => v.startsWith('msid:') ? v : norm(v))), a]);
  db.run('UPDATE edicio SET emparellaments = NULL WHERE id = ?', [de]);
  // les escoltes: totes a aquesta part. Les físiques es mouen; les de scrobbles es tornen a calcular, i conserven la part
  // que porten (ACT-680), que és la que es posa aquí.
  db.run('UPDATE escolta SET part_id = ? WHERE edicio_id = ?', [part.id, de]);
  db.run('UPDATE escolta SET edicio_id = ? WHERE edicio_id = ? AND id NOT IN (SELECT DISTINCT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)', [a, de]);
  // la nota (ACT-685, opció C): si la caixa no en té, la de la fitxa que desapareix és la seva primera; si en té, la caixa
  // conserva la seva. Passa amb el seu historial, perquè no es perdi cap judici (decisió de construcció, per ratificar).
  if (!un(db, 'SELECT 1 AS x FROM puntuacio WHERE edicio_id = ? LIMIT 1', [a])) db.run('UPDATE puntuacio SET edicio_id = ? WHERE edicio_id = ?', [a, de]);
  // Per afinar, com al juntar (ACT-681); els preferents, a la caixa
  db.run('UPDATE edicio SET per_afinar = COALESCE(per_afinar, ?) WHERE id = ?', [x.per_afinar, a]);
  db.run('UPDATE preferent SET proper_edicio_id = ? WHERE proper_edicio_id = ?', [a, de]);
  db.run('UPDATE preferent SET edicio_actual_id = ? WHERE edicio_actual_id = ?', [a, de]);
  // La part viva no canvia (ACT-667). Si la fitxa que desapareix era en rotació i la caixa no, la caixa hi entra amb
  // aquesta part viva: el disc que s'escoltava continua en rotació (decisió de construcció, per ratificar).
  if (x.rotacio_actual && !y.rotacio_actual) {
    db.run('UPDATE part SET rotacio_actual = 0 WHERE edicio_id = ?', [a]);
    db.run('UPDATE part SET rotacio_actual = 1 WHERE id = ?', [part.id]);
    db.run('UPDATE edicio SET rotacio_actual = 1, data_referencia_rotacio = ?, darrera_obertura = COALESCE(darrera_obertura, ?) WHERE id = ?',
      [x.data_referencia_rotacio || ara(), x.darrera_obertura, a]);
  }
  db.run('UPDATE edicio SET rotacio_actual = 0 WHERE id = ?', [de]);
  const r = recalcula(db);
  esborraBuida(db, de);
  return { ...r, part: un(db, 'SELECT numero, nom FROM part WHERE id = ?', [part.id]) };
});
