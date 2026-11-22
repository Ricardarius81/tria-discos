// Obra G — Segells Preferents (ACT-816, ACT-817, ACT-827; Ricard, 20-11, ACT-829: el número de darrere de qualsevol
// prefix). Fitxer nou perquè faristol.js no creixi (ACT-756). Aquí no hi ha pantalla: dades i xarxa.
//  · La taula segell_preferent (estructura 12): nom, ordre, el proper a mà (artista i títol: un disc d'un segell és de
//    qualsevol artista) i l'id de Discogs. Les sis d'entrada, amb els id de la ACT-827.
//  · Un disc és d'un segell per Edició.segell, comparat normalitzat (escoltes.norm). Mai deduït (14-10): l'omple Ricard a
//    la fitxa («Segell · canvia'l»), o la tasca de Bandcamp quan la pàgina diu que és la compta d'un segell (ACT-817 7.7).
//  · L'anterior i el següent per número de catàleg (7.3): el número és el de DARRERE de qualsevol prefix («H|N043» → 43,
//    «homen226» → 226, «no.66» → 66, «isolatedmix 100» → 100), i s'ordena per aquest número dins del segell (ACT-829).
//    Fonts (7.6), en aquest ordre: MusicBrainz (el segell pel nom i les seves edicions amb el número de catàleg),
//    després Discogs (les edicions del segell pel seu id, sense clau, ACT-827). El disc de partida és el que el segell té
//    en rotació o, si no, l'últim que ha sonat; es busca pel títol a la llista del segell, i si no hi és, pel número de
//    catàleg de la seva fitxa (Edició.codis_cataleg).
//    DECISIONS DE CONSTRUCCIÓ, POR RATIFICAR: (1) a cada número, la primera edició que dona la font (n'hi pot haver
//    diverses: CD, vinil); (2) dues sèries amb el mateix número (Sonic Pieces SP020 i PATTERN020) són el mateix lloc, i
//    surt la primera: és la conseqüència de l'opció que Ricard va triar; (3) es miren com a molt 3 pàgines de 100
//    edicions per font; (4) la pàgina de segell de Bandcamp llegida de nit (7.6, tercera font) queda per a una obra
//    següent: la tasca encara no la llegeix.
import { norm } from './escoltes.js?v=15';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const r = [];
  while (st.step()) r.push(st.getAsObject());
  st.free(); return r;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { const v = s ? JSON.parse(s) : []; return Array.isArray(v) ? v : [String(v)]; } catch { return s ? [String(s)] : []; } };

// El número de catàleg: el de darrere de qualsevol prefix.
export function numeroCataleg(c) {
  const m = String(c ?? '').match(/(\d+)\D*$/);
  return m ? +m[1] : null;
}

// Les edicions de cada segell (normalitzat) per a la portada i el disc en rotació.
function edicionsPerSegell(db) {
  const per = new Map();
  for (const e of files(db, `SELECT e.id, e.segell, e.rotacio_actual, e.portada, e.codis_cataleg, e.app_escolta, a.titol, ar.nom_canonic AS art,
                                   (SELECT MAX(x.data_hora) FROM escolta x WHERE x.edicio_id = e.id) AS darrera
                            FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id
                            WHERE e.segell IS NOT NULL AND e.segell != ''`)) {
    const k = norm(e.segell); (per.get(k) || per.set(k, []).get(k)).push(e);
  }
  return per;
}

export function segellsPreferents(db) {
  const per = edicionsPerSegell(db);
  return files(db, 'SELECT id, nom, ordre, proper_artista, proper_titol, discogs_id, retrat FROM segell_preferent ORDER BY ordre, id').map(s => {
    const eds = per.get(norm(s.nom)) || [];
    const rot = eds.find(e => e.rotacio_actual) || null;
    const darrer = eds.filter(e => e.darrera).sort((a, b) => (a.darrera < b.darrera ? 1 : -1))[0] || null;
    return { ...s, rot, darrer, n: eds.length };
  });
}

// Les edicions en rotació d'un segell preferent: per al marc platejat (7.8).
export function edicionsDeSegellsPreferents(db) {
  const noms = new Set(files(db, 'SELECT nom FROM segell_preferent').map(r => norm(r.nom)));
  if (!noms.size) return new Set();
  return new Set(files(db, "SELECT id, segell FROM edicio WHERE segell IS NOT NULL AND segell != ''").filter(e => noms.has(norm(e.segell))).map(e => e.id));
}

export const afegeixSegell = nom => db => {
  nom = String(nom || '').trim(); if (!nom) return { error: 'Escriu el nom del segell.' };
  if (files(db, 'SELECT nom FROM segell_preferent').some(r => norm(r.nom) === norm(nom))) return { error: `${nom} ja és a Segells Preferents.` };
  const o = (un(db, 'SELECT MIN(ordre) AS m FROM segell_preferent')?.m ?? 1) - 1;   // entra a dalt, com els artistes nous (14-10, opció A)
  db.run('INSERT INTO segell_preferent (nom, ordre, data_alta) VALUES (?, ?, ?)', [nom, o, new Date().toISOString()]);
  return { nom };
};
// ACT-836 (d): els noms dels Segells Preferents, en l'ordre de la llista, per al desplegable de la fitxa.
export const nomsPreferents = db => files(db, 'SELECT nom FROM segell_preferent ORDER BY ordre, id').map(r => r.nom);
// ACT-836 (e): el logo, només a mà (segell_preferent.retrat, estructura 13). null el treu.
export const posaLogo = (id, ref) => db => db.run('UPDATE segell_preferent SET retrat = ? WHERE id = ?', [ref || null, id]);
export const treuSegell = id => db => db.run('DELETE FROM segell_preferent WHERE id = ?', [id]);
export const posaProperSegell = (id, artista, titol) => db => db.run('UPDATE segell_preferent SET proper_artista = ?, proper_titol = ? WHERE id = ?', [artista || null, titol || null, id]);
export const canviaSegell = (edicioId, nom) => db => db.run('UPDATE edicio SET segell = ? WHERE id = ?', [String(nom || '').trim() || null, edicioId]);
// L'edició de MusicBrainz que porten les escoltes d'AQUESTA edició (7.2: l'edició exacta), si n'hi ha.
export const releaseDeLEdicio = (db, edicioId) => un(db, `SELECT p.caa_release_mbid AS m FROM scrobble p JOIN escolta x ON x.id = p.escolta_id
  WHERE x.edicio_id = ? AND p.caa_release_mbid IS NOT NULL ORDER BY p.listened_at DESC LIMIT 1`, [edicioId])?.m || null;
// 7.2: el segell de MusicBrainz entra sol només si ve de l'edició exacta i l'edició no en té cap.
export const segellDeMB = (edicioId, release, mb) => db => {
  if (!mb?.segell || !release || mb.release !== release) return false;
  db.run("UPDATE edicio SET segell = ? WHERE id = ? AND (segell IS NULL OR segell = '')", [mb.segell, edicioId]);
  return true;
};
// El segell d'una edició (Edició.segell), tal com és escrit.
export const segellDe = (db, edicioId) => un(db, 'SELECT segell FROM edicio WHERE id = ?', [edicioId])?.segell || null;
// El proper s'esborra quan entra en rotació el disc que diu: ho fa escoltes.esborraProperSiEsAquest, com el dels artistes.

// ───────── l'anterior i el següent per número de catàleg (7.3, 7.6) ─────────
const MB = 'https://musicbrainz.org/ws/2', DG = 'https://api.discogs.com';
const espera = ms => new Promise(r => setTimeout(r, ms));
const memo = new Map();   // nom del segell → llista, mentre l'app és oberta

async function deMusicBrainz(nom) {
  const r = await fetch(`${MB}/label?query=${encodeURIComponent('label:"' + nom.replace(/"/g, '') + '"')}&fmt=json&limit=5`);
  if (!r.ok) return null;
  const lab = ((await r.json()).labels || []).find(l => norm(l.name) === norm(nom));
  if (!lab) return null;
  const out = [];
  for (let pag = 0; pag < 3; pag++) {
    await espera(1100);                                   // MusicBrainz demana una consulta per segon
    const d = await fetch(`${MB}/release?label=${lab.id}&inc=artist-credits+labels&fmt=json&limit=100&offset=${pag * 100}`);
    if (!d.ok) break;
    const j = await d.json(), rels = j.releases || [];
    for (const x of rels) {
      const cat = (x['label-info'] || []).filter(li => li.label?.id === lab.id).map(li => li['catalog-number']).find(Boolean);
      out.push({ titol: x.title, artista: (x['artist-credit'] || []).map(a => a.name + (a.joinphrase || '')).join(''), cataleg: cat || null });
    }
    if (out.length >= (j['release-count'] || 0) || rels.length < 100) break;
  }
  return out.length ? { font: 'MusicBrainz', eds: out } : null;
}
async function deDiscogs(id) {
  if (!id) return null;
  const out = [];
  for (let pag = 1; pag <= 3; pag++) {
    const r = await fetch(`${DG}/labels/${id}/releases?per_page=100&page=${pag}`);
    if (!r.ok) break;
    const j = await r.json();
    for (const x of j.releases || []) out.push({ titol: x.title, artista: x.artist || '', cataleg: x.catno || null });
    if (pag >= (j.pagination?.pages || 1)) break;
  }
  return out.length ? { font: 'Discogs', eds: out } : null;
}
// La llista ordenada per número, una edició per número (1).
function ordena(eds) {
  const per = new Map();
  for (const e of eds) { const n = numeroCataleg(e.cataleg); if (n !== null && !per.has(n)) per.set(n, { ...e, n }); }
  return [...per.values()].sort((a, b) => a.n - b.n);
}
// { font, partida, anterior, seguent } o { error }.
export async function veinsDeSegell(db, s) {
  const ref = s.rot || s.darrer;
  if (!ref) return { error: `Encara no hi ha cap disc de ${s.nom} a la rotació ni a les escoltes. Posa'n el proper a mà.` };
  const numFitxa = llista(ref.codis_cataleg).map(numeroCataleg).find(n => n !== null) ?? null;
  for (const [k, via] of [['mb', () => deMusicBrainz(s.nom)], ['dg', () => deDiscogs(s.discogs_id)]]) {
    let l = memo.get(k + '|' + s.nom);
    if (!l) { try { l = await via(); } catch { l = null; } if (l) memo.set(k + '|' + s.nom, l); }
    if (!l) continue;
    const ord = ordena(l.eds);
    const n = ord.find(e => norm(e.titol) === norm(ref.titol))?.n ?? numFitxa;
    if (n === null) continue;
    return { font: l.font, partida: { titol: ref.titol, n }, anterior: [...ord].reverse().find(e => e.n < n) || null, seguent: ord.find(e => e.n > n) || null };
  }
  return { error: `No he trobat «${ref.titol}» a la llista de ${s.nom} de MusicBrainz ni de Discogs. Posa'n el proper a mà.` };
}
