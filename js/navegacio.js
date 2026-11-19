// Obra 2 (19-11): la navegació. Tot és estat de la pantalla, sense camp del model i fora de l'arxiu (§13.3):
// - ACT-770: obrir l'app abans de 15 minuts des de l'últim ús torna on era, l'hagi tancada el sistema o Ricard. Per això
//   l'estat de la ACT-743 es desa també a localStorage (sessionStorage es perd quan el sistema mata l'app), amb l'hora (t).
// - ACT-706: L'Aparador obre la darrera subpantalla usada (localStorage, tria-aparador). La darrera Pila, amb l'obra 3.
// - ACT-691 i ACT-692: tornar d'una subpantalla (la fitxa d'un preferent, la safata) torna a la mateixa alçada.
// - ACT-769: el punt taronja de L'Afinació, encès sempre que la llista (afinacio.js, llistaAfinacio) no és buida.
import * as F from './afinacio.js?v=4';

export const QUINZE_MINUTS = 15 * 60e3;   // ACT-770: xifra de Ricard, sense calibrar
const PANTALLA = 'tria-pantalla', APARADOR = 'tria-aparador';

export function desaPantalla(p) {
  const t = JSON.stringify(p);
  try { sessionStorage.setItem(PANTALLA, t); } catch {}
  try { localStorage.setItem(PANTALLA, t); } catch {}
}
export function llegeixPantalla() {
  for (const m of ['localStorage', 'sessionStorage']) {
    try { const p = JSON.parse(globalThis[m].getItem(PANTALLA) || 'null'); if (p) return p; } catch {}
  }
  return null;
}
export const recent = (p, ara = Date.now()) => !!p && ara - (p.t || 0) < QUINZE_MINUTS;

export const SUBS_APARADOR = ['pref', 'esc'];
export function darrerAparador() { try { const v = localStorage.getItem(APARADOR); return SUBS_APARADOR.includes(v) ? v : 'pref'; } catch { return 'pref'; } }
export function apuntaAparador(v) { try { localStorage.setItem(APARADOR, v); } catch {} }

// L'alçada d'on es venia, per clau ('artista', 'safata'), amb la pantalla on era.
const alcades = new Map();
export function apuntaAlcada(clau, on) { alcades.set(clau, { ...on, y: Math.round(window.scrollY) }); }
export function tornaAlcada(clau, on) {
  const a = alcades.get(clau); alcades.delete(clau);
  if (!a || Object.keys(on).some(k => on[k] !== a[k])) return false;
  const ves = () => window.scrollTo(0, a.y);
  ves(); requestAnimationFrame(() => requestAnimationFrame(ves));
  return true;
}

export const hiHaPerAfinar = db => { const { marcats, resta } = F.llistaAfinacio(db); return marcats.length + resta.length > 0; };
