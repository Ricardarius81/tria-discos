// La fitxa (obra 5): «Ves a l'artista», «Tria el següent de X» i la pregunta en sortir de rotació (ACT-771); «Copia d'un
// altre disc» i «Com els altres de X» (ACT-772). Aquí no hi ha pantalla: el que es pregunta a l'arxiu i el que s'hi escriu.
import * as T from './tags.js?v=1';
import * as F from './afinacio.js?v=4';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// ───────── ACT-771 ─────────
// El preferent d'un artista, amb l'abast del §7.7 (la Persona compartida compta, com al marc daurat): Preferent.id o null.
export function preferentDe(db, artistaId) {
  const a = un(db, 'SELECT COALESCE(persona, nom_canonic) AS p FROM artista WHERE id = ?', [artistaId]); if (!a) return null;
  const r = files(db, `SELECT pr.id, COALESCE(ar.persona, ar.nom_canonic) AS p FROM preferent pr JOIN artista ar ON ar.id = pr.artista_id
                       ORDER BY pr.artista_id = ? DESC, pr.ordre`, [artistaId]).find(x => norm(x.p) === norm(a.p));
  return r ? r.id : null;
}
// La partida del disc anterior i el següent a partir d'un àlbum concret (el de la fitxa, o el que surt de rotació).
export function partidaDelDisc(db, albumId) {
  const r = un(db, 'SELECT a.titol, ar.nom_canonic AS art, ar.variants FROM album a JOIN artista ar ON ar.id = a.artista_id WHERE a.id = ?', [albumId]);
  return r && { titol: r.titol, art: r.art, noms: new Set([r.art, ...llista(r.variants)].map(norm).filter(Boolean)) };
}
// «Tria el següent de X» en un no preferent: l'artista entra a Artistes Preferents (a dalt, com «Afegir a Artistes
// Preferents») amb aquest disc de proper (Preferent.proper_titol, schema v2). Motiu (ACT-771): un no preferent no té camp.
export const fesPreferentAmbProper = (artistaId, titol) => db => {
  let p = un(db, 'SELECT id FROM preferent WHERE artista_id = ?', [artistaId]);
  if (!p) {
    const min = un(db, 'SELECT MIN(ordre) AS m FROM preferent')?.m ?? 1;
    db.run('INSERT INTO preferent (artista_id, ordre) VALUES (?, ?)', [artistaId, min - 1]);
    p = un(db, 'SELECT id FROM preferent WHERE artista_id = ?', [artistaId]);
  }
  db.run('UPDATE preferent SET proper_titol = ? WHERE id = ?', [titol || null, p.id]);
  return p.id;
};

// ───────── ACT-772 (a): «Com els altres de X» ─────────
// La llista de branques (Àlbum.Gènere, sencera i en ordre) que més es repeteix entre els altres àlbums del mateix artista
// (Àlbum.artista_id). Sense cap altre àlbum amb gènere, o amb empat al capdamunt, no hi ha suggeriment (POR RATIFICAR).
export function generePelsAltres(db, albumId) {
  const a = un(db, 'SELECT artista_id FROM album WHERE id = ?', [albumId]); if (!a) return null;
  const n = new Map();
  for (const r of files(db, 'SELECT generes FROM album WHERE artista_id = ? AND id <> ?', [a.artista_id, albumId])) {
    const g = llista(r.generes).filter(x => F.BRANQUES.includes(x)); if (!g.length) continue;
    const k = JSON.stringify(g); n.set(k, (n.get(k) || 0) + 1);
  }
  const ord = [...n].sort((x, y) => y[1] - x[1]);
  if (!ord.length || (ord[1] && ord[1][1] === ord[0][1])) return null;
  return { generes: JSON.parse(ord[0][0]), discos: ord[0][1] };
}

// ───────── ACT-772: «Copia d'un altre disc» ─────────
// Els quatre que surten desmarcats (consequències dites a Ricard): Amor i Acompanyat són llistes curades de 30-40 discos;
// Absorbeix treu el disc de treballant, llegir i els contextos d'acompanyat; En directe és un fet de la gravació.
export const DESMARCATS = ['Apte per «Amor»', 'Apte per acompanyat', 'Absorbeix', 'En directe'];
// Els discos d'on es pot copiar: els altres àlbums amb gènere o tags, primer els del mateix artista; amb filtre, de tot l'arxiu.
export function candidatsCopia(db, albumId, filtre = '') {
  const a = un(db, 'SELECT artista_id FROM album WHERE id = ?', [albumId]); if (!a) return [];
  const f = norm(filtre);
  const rs = files(db, `SELECT a.id, a.titol, ar.nom_canonic AS art, a.artista_id = ? AS mateix FROM album a JOIN artista ar ON ar.id = a.artista_id
                        WHERE a.id <> ? AND (a.generes IS NOT NULL OR a.tags IS NOT NULL) ORDER BY mateix DESC, ar.nom_canonic, a.titol`, [a.artista_id, albumId]);
  return (f ? rs.filter(r => norm(r.titol + r.art).includes(f)) : rs.filter(r => r.mateix)).slice(0, 40);
}
// El que es copiaria: una casella per cosa. Només els tags DE L'ÀLBUM (Àlbum.tags), mai els de l'edició.
export function copiable(db, deAlbum) {
  const g = F.genere(db, deAlbum), tags = llista(un(db, 'SELECT tags FROM album WHERE id = ?', [deAlbum])?.tags);
  const st = T.llegeix(tags, []), out = [];
  if (g.generes.length) out.push({ clau: 'genere', txt: 'Gènere: ' + g.generes.join(' · '), marcat: true });
  if (g.subgeneres.length) out.push({ clau: 'subgeneres', txt: 'Subgèneres: ' + g.subgeneres.join(', '), marcat: true });
  if (g.llenguatge.length) out.push({ clau: 'llenguatge', txt: 'Llenguatge: ' + g.llenguatge.join(', '), marcat: true });
  if (g.formacio.length) out.push({ clau: 'formacio', txt: 'Formació: ' + g.formacio.join(', ') + (g.instrument ? ' (' + g.instrument + ')' : ''), marcat: true });
  for (const x of T.SI_NO) if (x.nivell === 'album' && st.si.has(x.nom)) out.push({ clau: 'tag:' + x.nom, txt: x.curt, marcat: !DESMARCATS.includes(x.nom) });
  if (st.veu) out.push({ clau: 'veu:' + st.veu, txt: 'Veu: ' + st.veu, marcat: true });
  if (st.estacio) out.push({ clau: 'estacio:' + st.estacio, txt: 'Estació: ' + st.estacio, marcat: true });
  for (const i of st.idiomes) out.push({ clau: 'idioma:' + i, txt: 'Idioma: ' + i, marcat: true });
  return out;
}
// Copiar (POR RATIFICAR): el que és un sol valor o una llista amb ordre substitueix (gènere, llenguatge, formació amb
// l'instrument, veu, estació); el que és un conjunt se suma (subgèneres, tags de sí, idiomes). Res més no es toca.
export const copia = (deAlbum, aAlbum, claus) => db => {
  const k = new Set(claus), o = F.genere(db, deAlbum), t = F.genere(db, aAlbum), nou = { ...t };
  if (k.has('genere')) nou.generes = o.generes;
  if (k.has('subgeneres')) nou.subgeneres = [...t.subgeneres, ...o.subgeneres];
  if (k.has('llenguatge')) nou.llenguatge = o.llenguatge;
  if (k.has('formacio')) { nou.formacio = o.formacio; nou.instrument = o.instrument; }
  F.desaGenere(aAlbum, nou)(db);
  let at = llista(un(db, 'SELECT tags FROM album WHERE id = ?', [aAlbum])?.tags);
  for (const c of k) {
    const [tipus, ...r] = c.split(':'), v = r.join(':'), st = T.llegeix(at, []);
    if (tipus === 'tag' && !st.si.has(v)) at = T.commuta(at, [], v)?.album || at;
    else if (tipus === 'veu' && st.veu !== v) at = T.posaValor(at, T.VEU, v);
    else if (tipus === 'estacio' && st.estacio !== v) at = T.posaValor(at, T.ESTACIO, v);
    else if (tipus === 'idioma' && !st.idiomes.includes(v)) at = T.commutaIdioma(at, v);
  }
  db.run('UPDATE album SET tags = ? WHERE id = ?', [at.length ? JSON.stringify(at) : null, aAlbum]);
};
