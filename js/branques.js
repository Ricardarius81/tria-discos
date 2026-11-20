// Obra C (ACT-809, ACT-810): les branques noves fetes a mà. Fitxer nou (ACT-756).
// L'arbre de 26 branques del §6.2 s'obre: una branca nova és un valor més d'Àlbum.Gènere (generes). Les 26 continuen a
// afinacio.js (BRANQUES); les noves no tenen llista pròpia, surten dels àlbums que les porten, i una branca sense cap disc
// desapareix, com un subgènere (ACT-810 c). Es comparen com els subgèneres (clauSubgenere: sense majúscules, accents ni
// signes): «Electrónica» és Electrònica, i es fa servir la que ja existeix (ACT-809 a). El ✎ canvia el nom o fon, a tots
// els àlbums que la porten; només a les branques noves (decisió de construcció de Claude, per ratificar: les 26 són les
// de la skill classificacio-generes i les seves fronteres). Camps: Àlbum.Gènere, Àlbum.Subgèneres.
import { BRANQUES, clauSubgenere, subgenereNet, subgeneresUsats } from './afinacio.js?v=4';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const r = [];
  while (st.step()) r.push(st.getAsObject());
  st.free(); return r;
};
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };

// Les branques noves que porta algun àlbum (fora de les 26), per ordre alfabètic.
export function branquesNoves(db) {
  const fixes = new Set(BRANQUES.map(clauSubgenere)), m = new Map();
  for (const r of files(db, 'SELECT generes FROM album WHERE generes IS NOT NULL'))
    for (const g of llista(r.generes)) { const k = clauSubgenere(g); if (k && !fixes.has(k) && !m.has(k)) m.set(k, g); }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'ca'));
}
export const branques = db => [...BRANQUES, ...branquesNoves(db)];
export const esNova = nom => !BRANQUES.some(b => clauSubgenere(b) === clauSubgenere(nom));
// La que ja existeix amb aquest nom (comparació de subgèneres), o el nom net si és nova.
export function brancaCanonica(db, txt) {
  const net = subgenereNet(txt); if (!net) return null;
  return branques(db).find(b => clauSubgenere(b) === clauSubgenere(net)) || net;
}
// ACT-809 (b): si el nom ja és un subgènere, s'avisa (dues coses amb un nom).
export const esSubgenere = (db, nom) => subgeneresUsats(db).find(s => clauSubgenere(s) === clauSubgenere(nom)) || null;
export const albumsAmbBranca = (db, nom) => files(db, 'SELECT generes FROM album WHERE generes IS NOT NULL')
  .filter(a => llista(a.generes).some(g => clauSubgenere(g) === clauSubgenere(nom))).length;
// El ✎: canvia el nom a tots els àlbums; si el nom nou ja és una altra branca, es fonen en aquella (sense repetir-la).
export const reanomenaBranca = (vell, nou) => db => {
  const net = subgenereNet(nou); if (!net) throw new Error('Escriu el nom nou.');
  const kv = clauSubgenere(vell);
  const altra = branques(db).find(b => clauSubgenere(b) === clauSubgenere(net) && clauSubgenere(b) !== kv);
  const nom = altra || net; let n = 0;
  for (const a of files(db, 'SELECT id, generes FROM album WHERE generes IS NOT NULL')) {
    const l = llista(a.generes); if (!l.some(g => clauSubgenere(g) === kv)) continue;
    const nova = [...new Map(l.map(g => clauSubgenere(g) === kv ? nom : g).map(g => [clauSubgenere(g), g])).values()];
    db.run('UPDATE album SET generes = ? WHERE id = ?', [JSON.stringify(nova), a.id]); n++;
  }
  return { nom, fos: !!altra, albums: n };
};
