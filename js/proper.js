// Obra A (ACT-812, ACT-813): el proper i la fitxa. Fitxer nou perquè faristol.js no creixi (ACT-756).
//  · «Era aquest el proper?» (ACT-812, 1.1): el proper es compara normalitzat (ACT-557, escoltes.norm); si el disc que entra
//    en rotació no hi coincideix però és del mateix artista (o d'un altre nom seu, Persona), la màquina pregunta UNA vegada,
//    en aquell moment. Sense camp nou: la pregunta viu només a la pantalla. Camps: preferent.proper_titol, album.titol,
//    artista.persona, edicio.rotacio_actual.
//  · El proper reconegut a la safata (ACT-812, 1.2 B): un disc nou que és el proper d'un preferent ho diu a la targeta.
//  · La durada de MusicBrainz per al proper (ACT-812, 1.2 A): la proposta; ningú entra sense durada.
//  · Canviar el títol, el nom de l'edició i el de l'artista (ACT-813, ACT-814 2.2 bis): el nom vell de l'artista passa a
//    Artista.variants, perquè les escoltes amb el nom vell es continuïn reconeixent. Camps: album.titol, edicio.nom_edicio,
//    artista.nom_canonic, artista.variants.
import { norm } from './escoltes.js?v=15';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const r = [];
  while (st.step()) r.push(st.getAsObject());
  st.free(); return r;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };

// Les edicions que ara són en rotació (per saber, després d'un canvi, quines hi acaben d'entrar).
export const enRotacio = db => new Set(files(db, 'SELECT id FROM edicio WHERE rotacio_actual = 1').map(x => x.id));

// Per a cada edició que acaba d'entrar: els preferents del mateix artista (Persona) amb un proper que NO és aquest títol.
// (Si coincidís, esborraProperSiEsAquest ja l'hauria esborrat: aquí només queden els dubtes.)
export function dubtesProper(db, ids) {
  const out = [];
  for (const id of ids) {
    const e = un(db, `SELECT e.id, a.titol, COALESCE(ar.persona, ar.nom_canonic) AS p FROM edicio e JOIN album a ON a.id = e.album_id
                      JOIN artista ar ON ar.id = a.artista_id WHERE e.id = ? AND e.rotacio_actual = 1`, [id]);
    if (!e) continue;
    for (const x of files(db, `SELECT pr.id, pr.proper_titol, ar.nom_canonic AS nom, COALESCE(ar.persona, ar.nom_canonic) AS p FROM preferent pr
                               JOIN artista ar ON ar.id = pr.artista_id WHERE pr.proper_titol IS NOT NULL`))
      if (norm(x.p) === norm(e.p) && norm(x.proper_titol) !== norm(e.titol))
        out.push({ pid: x.id, nom: x.nom, proper: x.proper_titol, edicio: e.id, titol: e.titol });
  }
  return out;
}
export const esborraProper = pid => db => db.run('UPDATE preferent SET proper_titol = NULL WHERE id = ?', [pid]);

// El preferent (i el seu proper) d'un artista, per Persona.
export function properDe(db, artistaId) {
  const a = un(db, 'SELECT COALESCE(persona, nom_canonic) AS p FROM artista WHERE id = ?', [artistaId]); if (!a) return null;
  return files(db, `SELECT pr.id, pr.proper_titol, ar.nom_canonic AS nom, COALESCE(ar.persona, ar.nom_canonic) AS p FROM preferent pr
                    JOIN artista ar ON ar.id = pr.artista_id WHERE pr.proper_titol IS NOT NULL`)
    .find(x => norm(x.p) === norm(a.p)) || null;
}

// La targeta de disc nou de la safata (1.2 B): és el proper d'algun preferent? Per nom d'artista (canònic o variant) i títol.
export function properDelDisc(db, artista, titol) {
  const n = norm(artista), t = norm(titol); if (!n || !t) return null;
  for (const x of files(db, `SELECT pr.id, pr.proper_titol, ar.nom_canonic AS nom, ar.variants, COALESCE(ar.persona, ar.nom_canonic) AS p
                             FROM preferent pr JOIN artista ar ON ar.id = pr.artista_id WHERE pr.proper_titol IS NOT NULL`)) {
    if (norm(x.proper_titol) !== t) continue;
    const noms = new Set([x.nom, x.p, ...llista(x.variants)].map(norm));
    for (const o of files(db, 'SELECT nom_canonic, variants FROM artista WHERE COALESCE(persona, nom_canonic) = ?', [x.p]))
      for (const v of [o.nom_canonic, ...llista(o.variants)]) noms.add(norm(v));
    if (noms.has(n)) return { pid: x.id, nom: x.nom, proper: x.proper_titol };
  }
  return null;
}

// La durada de MusicBrainz d'un àlbum per artista i títol: la primera edició oficial que en dona la llargada de les pistes.
// Torna { minuts, font } o null. MusicBrainz demana una consulta per segon: aquí en són dues, seguides d'una espera.
const MB = 'https://musicbrainz.org/ws/2';
export async function duradaMB(art, tit) {
  try {
    const q = `release:"${String(tit).replace(/"/g, '')}" AND artist:"${String(art).replace(/"/g, '')}"`;
    const r = await fetch(`${MB}/release/?query=${encodeURIComponent(q)}&fmt=json&limit=5`);
    if (!r.ok) return null;
    const rels = ((await r.json()).releases || []).filter(x => norm(x.title) === norm(tit));
    for (const rel of rels.slice(0, 2)) {
      await new Promise(f => setTimeout(f, 1100));
      const d = await fetch(`${MB}/release/${rel.id}?inc=recordings&fmt=json`);
      if (!d.ok) continue;
      const ms = ((await d.json()).media || []).flatMap(m => m.tracks || []).reduce((s, t) => s + (t.length || 0), 0);
      if (ms > 0) return { minuts: Math.max(1, Math.round(ms / 60000)), font: 'MusicBrainz' };
    }
  } catch {}
  return null;
}

// Canviar els noms (ACT-813). El títol és de l'àlbum (totes les edicions); el nom de l'edició, només d'aquesta; el de
// l'artista, de l'artista (tots els seus discos), i el vell va a variants. Si el nom nou ja és d'un altre artista, no es
// fon res: es diu, i es queda com estava (fondre dos artistes és una altra operació, sense decidir).
export const canviaNoms = (edicioId, { titol, nomEdicio, artista }) => db => {
  const e = un(db, `SELECT e.id, e.nom_edicio, a.id AS album_id, a.titol, ar.id AS artista_id, ar.nom_canonic, ar.variants
                    FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id WHERE e.id = ?`, [edicioId]);
  if (!e) return { error: 'No trobo el disc.' };
  const res = { canvis: [] };
  const t = String(titol ?? '').trim(), ne = String(nomEdicio ?? '').trim(), ar = String(artista ?? '').trim();
  if (ar && ar !== e.nom_canonic) {
    const altre = files(db, 'SELECT id, nom_canonic, variants FROM artista WHERE id <> ?', [e.artista_id])
      .find(x => [x.nom_canonic, ...llista(x.variants)].some(v => norm(v) === norm(ar)));
    if (altre) return { error: `«${ar}» ja és un altre artista de l'arxiu (${altre.nom_canonic}). No ho canvio: fondre dos artistes encara no està decidit.` };
    const vs = llista(e.variants);
    if (!vs.some(v => v === e.nom_canonic)) vs.push(e.nom_canonic);
    db.run('UPDATE artista SET nom_canonic = ?, variants = ? WHERE id = ?', [ar, JSON.stringify(vs.filter(v => norm(v) !== norm(ar) || v === e.nom_canonic)), e.artista_id]);
    res.canvis.push('artista');
  }
  if (t && t !== e.titol) { db.run('UPDATE album SET titol = ? WHERE id = ?', [t, e.album_id]); res.canvis.push('títol'); }
  if ((ne || null) !== (e.nom_edicio || null)) { db.run('UPDATE edicio SET nom_edicio = ? WHERE id = ?', [ne || null, edicioId]); res.canvis.push('edició'); }
  return res;
};
