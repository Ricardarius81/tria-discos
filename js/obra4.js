// Obra IV (22-11): els comentaris de la ACT-848, decidits a la ACT-849. Fitxer propi (ACT-756).
// (a) Llistes: en escriure el nom, les llistes que ja hi ha (llista.nom), com amb els segells; un nom nou en fa una de nova.
// (b) Agrupacions en dues subpantalles, «Discos Agrupats» i «Llistes de Reproducció», com L'Aparador. Estat de pantalla
//     del mòbil (localStorage), fora de l'arxiu.
// (d) L'ordre dels Segells Preferents, amb la mateixa lògica que els Artistes Preferents (ACT-775): Manual
//     (segell_preferent.ordre, l'únic que s'arrossega i es desa), A-Z i Z-A (segell_preferent.nom), Inclusió ↑↓
//     (segell_preferent.id, l'ordre d'alta) i Darrera escolta (Escolta.data_hora de les edicions amb aquell Edició.segell).
//     L'ordre triat és estat de pantalla, com el dels artistes.
import { ORDRES } from './rajoles.js?v=1';

export { ORDRES };
const CA = new Intl.Collator('ca', { sensitivity: 'base', numeric: true });
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// ───────── (d) l'ordre dels Segells Preferents ─────────
const ORDRE_SEG = 'tria-ordre-segells';
export function ordreSeg() { try { const v = localStorage.getItem(ORDRE_SEG); return ORDRES.some(([k]) => k === v) ? v : 'manual'; } catch { return 'manual'; } }
export function posaOrdreSeg(v) { try { localStorage.setItem(ORDRE_SEG, v); } catch {} }
// ss ve de segellsPreferents (ordre manual: segell_preferent.ordre, id), amb s.darrer.darrera = la darrera escolta.
export function ordenaSegells(ss, ordre = ordreSeg()) {
  const ll = [...ss];
  if (ordre === 'az') return ll.sort((a, b) => CA.compare(a.nom, b.nom) || a.id - b.id);
  if (ordre === 'za') return ll.sort((a, b) => CA.compare(b.nom, a.nom) || a.id - b.id);
  if (ordre === 'inclusio-asc') return ll.sort((a, b) => a.id - b.id);
  if (ordre === 'inclusio-desc') return ll.sort((a, b) => b.id - a.id);
  if (ordre === 'escolta') return ll.map((s, i) => ({ s, i, d: s.darrer?.darrera || '' }))
    .sort((a, b) => (b.d > a.d) - (b.d < a.d) || a.i - b.i).map(x => x.s);
  return ll;
}
// «Ordena la llista» (Manual): desa segell_preferent.ordre 1..n en l'ordre que queda.
export const desaOrdreSegells = ids => db => ids.forEach((id, i) => db.run('UPDATE segell_preferent SET ordre = ? WHERE id = ?', [i + 1, id]));

// ───────── (b) les dues subpantalles d'Agrupacions ─────────
export const SUBS_AGR = [['disc', 'Discos Agrupats'], ['ll', 'Llistes de Reproducció']];
const AGR = 'tria-agrupacions-sub';
export function agSub() { try { const v = localStorage.getItem(AGR); return SUBS_AGR.some(([k]) => k === v) ? v : 'disc'; } catch { return 'disc'; } }
export function posaAgSub(v) { try { if (SUBS_AGR.some(([k]) => k === v)) localStorage.setItem(AGR, v); } catch {} }

// ───────── (a) les llistes que ja hi ha, mentre s'escriu el nom ─────────
// ls ve de llistes() (la més recent primer). Surten les que contenen el que s'ha escrit (sense accents ni majúscules);
// res escrit, o el nom exacte d'una que ja hi és, no en proposa cap.
export function suggerimentsLlista(ls, text, max = 6) {
  const t = norm(text); if (!t) return [];
  if (ls.some(l => norm(l.nom) === t)) return [];
  return ls.filter(l => norm(l.nom).includes(t)).slice(0, max).map(l => l.nom);
}
