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

import * as A from './arxiu.js?v=21';
import * as X from './excel.js?v=6';
import { FISICS } from './dades.js?v=25';
import * as N from './anys.js?v=1';

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

// El que es compta a cada còpia. escolta_fisica: les escoltes de CD o vinil, per Escolta.canal (ACT-837, ACT-840 2). Abans,
// «sense cap pista»; amb les pistes velles als fitxers d'any (ACT-838), això voldria dir també «les seves pistes són fora».
export function recomptes(db) {
  const n = A.recomptes();
  n.escolta_fisica = db.exec(`SELECT COUNT(*) FROM escolta WHERE canal IN (${FISICS.map(f => `'${f}'`).join(', ')})`)[0].values[0][0];
  // escolta_ma (22/11, Ricard: «OK también las de streaming»): les escoltes d'streaming apuntades a mà (Escolta.origen 'a mà',
  // Escolta.canal que no és CD ni vinil). El recàlcul no les pot refer, com les físiques; sense recompte propi, en desaparèixer
  // no sonaria res. Una còpia anterior sense n_escolta_ma no compara (com les fetes a mà, ACT-569).
  n.escolta_ma = db.exec(`SELECT COUNT(*) FROM escolta WHERE origen = 'a mà' AND canal NOT IN (${FISICS.map(f => `'${f}'`).join(', ')})`)[0].values[0][0];
  n.scrobble += N.pistesAlsAnys(db);   // obra III (ACT-841 2): el TOTAL de pistes, principal més fitxers d'any
  return n;
}
const VERMELLES = ['scrobble', 'escolta_fisica', 'escolta_ma'], DE_NOTA = ['edicio', 'album', 'artista'];
export const NOMS = { scrobble: 'pistes de ListenBrainz', escolta_fisica: 'escoltes físiques', escolta_ma: 'escoltes d\'streaming apuntades a mà', edicio: 'edicions', album: 'àlbums', artista: 'artistes' };

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
  // Els fitxers d'any (ACT-841 3): l'obert, amb la data de la parella (rota amb ella); el tancat, una còpia fixa un sol cop.
  // Si falla, la parella ja hi és: no es desfà res, i el fitxer d'any original continua al Drive.
  let anys = []; try { anys = await N.copiesAnys(db, data); } catch {}
  apunta(data);
  return { feta: true, data, anterior: anterior ? dataDe(anterior) : null, vermelles, nota: deNota, paperera: fora.length, anys };
}

// La parella entra junta o no entra (ACT-571, ACT-750 e). Si l'app es tanca entre les dues pujades, al Drive queda una
// meitat: no compta com a còpia, i a la propera obertura va a la paperera i la còpia es torna a fer. Una meitat de fa
// menys de 10 minuts pot ser una còpia que un altre dispositiu està fent ara mateix: es deixa.
export function meitats(copies, ara = Date.now()) {
  const per = new Map();
  for (const f of copies) { const m = PATRO.exec(f.name); if (m) (per.get(m[1]) || per.set(m[1], []).get(m[1])).push(f); }
  return [...per.values()].filter(l => !(l.some(f => f.name.endsWith('.sqlite')) && l.some(f => f.name.endsWith('.xlsx'))))
    .flat().filter(f => ara - Date.parse(f.modifiedTime || 0) > 10 * 60e3);
}
// Només mirar (ACT-750 e): l'última còpia del Drive, per posar al dia l'exclamació de seguida, i si en toca una. La còpia
// es fa després, uns 10 s més tard (siToca).
export async function toca() {
  if (!A.estat.db || !A.tePermis() || !navigator.onLine) return false;
  const copies = await A.llistaCopies(), darrera = darreraDelDrive(copies.filter(f => !meitats(copies).includes(f)));
  try { if (darrera) localStorage.setItem(VISTA, darrera); else localStorage.removeItem(VISTA); } catch {}
  return !darrera || diesEntre(darrera, avui()) >= CADA;
}
// En obrir (i en tornar a primer pla): si fa 7 dies o més de l'última còpia, manual o automàtica, se'n fa una.
export async function siToca() {
  if (!A.estat.db || !A.tePermis() || !navigator.onLine) return null;
  let copies = await A.llistaCopies();
  const orfes = meitats(copies);
  for (const f of orfes) await A.aLaPaperera(f.id);
  if (orfes.length) copies = copies.filter(f => !orfes.includes(f));
  const darrera = darreraDelDrive(copies);
  if (darrera) apunta(darrera);
  // La vista d'aquest dispositiu es posa al dia amb el Drive, encara que el Drive digui una data més vella
  // (una còpia que ha anat a la paperera a mà): l'exclamació ha de dir la veritat del Drive quan hi ha connexió.
  try { if (darrera) localStorage.setItem(VISTA, darrera); else localStorage.removeItem(VISTA); } catch {}
  if (darrera && diesEntre(darrera, avui()) < CADA) return { feta: false, darrera };
  return fes({ copies });
}
