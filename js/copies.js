// La còpia de seguretat (tram 4, §3.5 i §3.6). Decisions de Ricard:
//  · ACT-566: la còpia automàtica es fa la primera vegada que s'obre la màquina, en qualsevol dispositiu, quan han passat
//    7 dies des de l'última, manual o automàtica. La data surt del nom de les còpies al Drive (sense la paperera, H-04).
//  · ACT-571: una còpia és la parella «· còpia de seguretat AAAA-MM-DD» (.sqlite + .xlsx), que entra i surt junta. Se'n
//    guarden cinc; la sisena va a la paperera del Drive. Les «· abans de l'estructura N» i les «· canvis d'aquest
//    dispositiu» queden fora de la rotació.
//  · §3.5 (v1.35): abans de cada còpia, la comprovació d'integritat; si falla, no es fa la còpia ni es rota res.
//  · ACT-569: els recomptes de files, a les propietats internes de cada .sqlite, comparats amb la còpia anterior que els
//    tingui. Opció A de Ricard (5-11): si baixen les pistes de ListenBrainz o les escoltes físiques, exclamació vermella;
//    si baixen les edicions, els àlbums o els artistes, una nota a la safata que es confirma amb un toc.
//    Les escoltes de l'app es tornen a calcular (ACT-481) i poden baixar amb raó: no avisen.
//  · ACT-568: l'exclamació dels 8 dies, sense connexió, amb l'última data de còpia que ha vist aquest dispositiu.
// Decisions de construcció de Claude, per ratificar:
//  · Una segona còpia el mateix dia substitueix la primera (la vella, a la paperera): les cinc són cinc dies.
//  · Quan salta la vermella, la còpia es fa però no va res a la paperera, ni la del mateix dia: les d'abans són les bones.

import * as A from './arxiu.js?v=20';
import * as X from './excel.js?v=5';

const PATRO = /· còpia de seguretat (\d{4}-\d{2}-\d{2})\.(sqlite|xlsx)$/;
export const nomCopia = (data, ext) => `la-meva-discoteca · còpia de seguretat ${data}.${ext}`;
export const MANTENIR = 5, CADA = 7, AVIS = 8;
const avui = () => new Date().toISOString().slice(0, 10);
export const diesEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

// L'última data de còpia que ha vist aquest dispositiu (ACT-568). Només serveix per a l'exclamació sense connexió.
const VISTA = 'tria-darrera-copia';
export function darreraVista() { try { return localStorage.getItem(VISTA); } catch { return null; } }
function apunta(data) { try { if (!darreraVista() || data > darreraVista()) localStorage.setItem(VISTA, data); } catch {} }
// Més de 8 dies sense còpia, o cap còpia vista mai: exclamació. Només s'equivoca cap a l'avís, mai cap a la calma.
export const caducada = (data = darreraVista(), ara = avui()) => !data || diesEntre(data, ara) > AVIS;

// ───────── l'avís i l'alarma, a l'arxiu (els veu qualsevol dispositiu) ─────────
const ALARMA = 'copia-alarma', NOTA = 'copia-nota';
const llegeixMeta = (db, k) => { try { return JSON.parse(db.exec('SELECT valor FROM meta WHERE clau = ?', [k])[0]?.values[0][0] || 'null'); } catch { return null; } };
export const alarma = db => llegeixMeta(db, ALARMA);
export const nota = db => llegeixMeta(db, NOTA);
export const posaAlarma = v => db => db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [ALARMA, JSON.stringify(v)]);
export const posaNota = v => db => db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [NOTA, JSON.stringify(v)]);
export const treuAlarma = db => db.run('DELETE FROM meta WHERE clau = ?', [ALARMA]);
export const treuNota = db => db.run('DELETE FROM meta WHERE clau = ?', [NOTA]);

// El que es compta a cada còpia. escolta_fisica: les escoltes sense cap pista de ListenBrainz (CD, vinil).
export function recomptes(db) {
  const n = A.recomptes();
  n.escolta_fisica = db.exec('SELECT COUNT(*) FROM escolta WHERE id NOT IN (SELECT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)')[0].values[0][0];
  return n;
}
const VERMELLES = ['scrobble', 'escolta_fisica'], DE_NOTA = ['edicio', 'album', 'artista'];
export const NOMS = { scrobble: 'pistes de ListenBrainz', escolta_fisica: 'escoltes físiques', edicio: 'edicions', album: 'àlbums', artista: 'artistes' };

const dataDe = f => PATRO.exec(f.name)?.[1] || null;
export const darreraDelDrive = copies => copies.map(dataDe).filter(Boolean).sort().pop() || null;

// Fa la còpia ara. Torna { feta, data, baixades: { vermelles, nota }, paperera: n } o { feta: false, motiu }.
export async function fes({ copies = null } = {}) {
  if (!A.estat.db) return { feta: false, motiu: 'l\'arxiu no és obert' };
  if (!A.tePermis() || !navigator.onLine) return { feta: false, motiu: 'sense connexió amb el Drive' };
  const ok = A.comprovaIntegritat();
  if (ok !== 'ok') return { feta: false, motiu: 'l\'arxiu no passa la comprovació d\'integritat (' + ok + ')', integritat: true };
  const db = A.estat.db;
  copies = (copies || await A.llistaCopies()).filter(f => dataDe(f));
  const n = recomptes(db), data = avui();
  // La còpia anterior que tingui recomptes (una feta a mà al Drive no en porta i se salta, ACT-569).
  const anterior = copies.filter(f => f.name.endsWith('.sqlite') && f.appProperties?.n_scrobble !== undefined)
    .sort((a, b) => (dataDe(b) + b.modifiedTime).localeCompare(dataDe(a) + a.modifiedTime))[0] || null;
  const baixa = k => anterior && anterior.appProperties['n_' + k] !== undefined && n[k] < +anterior.appProperties['n_' + k]
    ? [{ taula: k, abans: +anterior.appProperties['n_' + k], ara: n[k] }] : [];
  const vermelles = VERMELLES.flatMap(baixa), deNota = DE_NOTA.flatMap(baixa);
  // L'Excel primer: si no es pot generar, no es puja res.
  const xl = await X.xlsx(db), bytes = db.export();
  const props = { tria: 'copia', data, ...Object.fromEntries(Object.entries(n).map(([k, v]) => ['n_' + k, String(v)])) };
  const fs = await A.creaCopia(nomCopia(data, 'sqlite'), A.SQLITE_MIME, bytes, props);
  try { await A.creaCopia(nomCopia(data, 'xlsx'), A.XLSX_MIME, xl, { tria: 'copia', data }); }
  catch (e) { try { await A.aLaPaperera(fs.id); } catch {} throw e; }   // la parella entra junta, o no entra
  // Les del mateix dia, substituïdes, i les que passen de cinc dies, a la paperera. Si ha saltat la vermella, no es toca
  // res: la d'abans d'avui mateix pot ser l'última bona.
  const fora = [];
  if (!vermelles.length) {
    const dies = [...new Set([data, ...copies.map(dataDe)])].sort().reverse();
    const vells = new Set(dies.slice(MANTENIR));
    fora.push(...copies.filter(f => dataDe(f) === data || vells.has(dataDe(f))));
  }
  for (const f of fora) await A.aLaPaperera(f.id);
  apunta(data);
  return { feta: true, data, anterior: anterior ? dataDe(anterior) : null, vermelles, nota: deNota, paperera: fora.length };
}

// En obrir (i en tornar a primer pla): si fa 7 dies o més de l'última còpia, manual o automàtica, se'n fa una.
export async function siToca() {
  if (!A.estat.db || !A.tePermis() || !navigator.onLine) return null;
  const copies = await A.llistaCopies();
  const darrera = darreraDelDrive(copies);
  if (darrera) apunta(darrera);
  // La vista d'aquest dispositiu es posa al dia amb el Drive, encara que el Drive digui una data més vella
  // (una còpia que ha anat a la paperera a mà): l'exclamació ha de dir la veritat del Drive quan hi ha connexió.
  try { if (darrera) localStorage.setItem(VISTA, darrera); else localStorage.removeItem(VISTA); } catch {}
  if (darrera && diesEntre(darrera, avui()) < CADA) return { feta: false, darrera };
  return fes({ copies });
}
