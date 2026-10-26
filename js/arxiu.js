// L'arxiu: un sol fitxer SQLite al Drive de Ricard (§3.5), amb una còpia de treball al navegador.
// La veritat viu al Drive. El navegador només guarda la còpia de treball i els canvis encara no pujats.
// Regles que aquest fitxer fa complir:
//  · H-04: mai es llisten fitxers sense excloure la paperera, i entre homònims mana el més recent.
//  · Mai es crea un arxiu buit si no es troba: s'atura i ofereix recuperar-lo (§3.5, v1.35).
//  · «Pendent de desar» fins que la data de modificació del fitxer al Drive canvia (§3.5, v1.35).
//  · Comprovació d'integritat en obrir (§3.5).

import { MIGRACIONS, TAULES } from './esquema.js?v=2';

export const CLIENT_ID = '918975060033-hs8so80pee5mjlrlpeu9gnleuoqjib3a.apps.googleusercontent.com';
const ABAST = 'https://www.googleapis.com/auth/drive.file';
// PROVISIONAL fins que Ricard en decideixi el nom: és una constant que ja no es pot canviar
// sense perdre de vista l'arxiu, perquè la màquina el troba pel nom (H-04).
export const NOM_CARPETA = 'La Meva Discoteca';
export const NOM_ARXIU = 'la-meva-discoteca.sqlite';
const SQLITE_MIME = 'application/x-sqlite3';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const PUJADA = 'https://www.googleapis.com/upload/drive/v3/files';

// ───────── permís ─────────
let testimoni = null, caducitat = 0, client = null;
export function permis({ silenci = false } = {}) {
  if (testimoni && Date.now() < caducitat - 60_000) return Promise.resolve(testimoni);
  return new Promise((resol, rebutja) => {
    if (!window.google?.accounts?.oauth2) return rebutja(new Error('El component d\'inici de sessió de Google no s\'ha carregat.'));
    client = client || google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: ABAST, callback: () => {} });
    client.callback = r => {
      if (r.error) return rebutja(new Error('Permís de Google: ' + r.error));
      testimoni = r.access_token; caducitat = Date.now() + r.expires_in * 1000; resol(testimoni);
    };
    client.error_callback = e => rebutja(new Error('Permís de Google: ' + (e?.type || 'cancel·lat')));
    client.requestAccessToken({ prompt: silenci ? '' : undefined });
  });
}
export const tePermis = () => !!testimoni && Date.now() < caducitat;

async function g(url, opcions = {}) {
  const t = await permis({ silenci: true });
  const r = await fetch(url, { ...opcions, headers: { Authorization: 'Bearer ' + t, ...(opcions.headers || {}) } });
  if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// H-04: sempre excloent la paperera, el més recent primer.
async function buscar(nom, { paperera = false, pare = null, mime = null } = {}) {
  let q = `name = '${esc(nom)}' and trashed = ${paperera}`;
  if (pare) q += ` and '${pare}' in parents`;
  if (mime) q += ` and mimeType = '${mime}'`;
  const r = await g(`${DRIVE}?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size,parents)&pageSize=20`);
  return (await r.json()).files || [];
}
async function metadades(id) {
  return (await g(`${DRIVE}/${id}?fields=id,name,modifiedTime,size,trashed`)).json();
}
async function baixa(id) {
  return new Uint8Array(await (await g(`${DRIVE}/${id}?alt=media`)).arrayBuffer());
}
async function creaFitxer(nom, mime, pares, cos) {
  const V = 'tria-discos-' + Math.random().toString(36).slice(2);
  const meta = { name: nom, mimeType: mime, ...(pares ? { parents: pares } : {}) };
  const parts = ['\r\n--' + V + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta)];
  if (cos) parts.push('\r\n--' + V + '\r\nContent-Type: ' + mime + '\r\n\r\n', cos);
  parts.push('\r\n--' + V + '--');
  const r = await g(`${PUJADA}?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + V }, body: new Blob(parts) });
  return r.json();
}
async function sobreescriu(id, bytes) {
  const r = await g(`${PUJADA}/${id}?uploadType=media&fields=id,modifiedTime`, {
    method: 'PATCH', headers: { 'Content-Type': SQLITE_MIME }, body: bytes });
  return r.json();
}
async function treuDeLaPaperera(id) {
  await g(`${DRIVE}/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: false }) });
}

// ───────── còpia de treball al navegador (IndexedDB) ─────────
// Pot no estar disponible (finestra privada, dades esborrades): la màquina funciona igual, només sense còpia local.
const BD = 'tria-discos', MAGATZEM = 'treball';
function idb() {
  return new Promise((resol, rebutja) => {
    try {
      const o = indexedDB.open(BD, 1);
      o.onupgradeneeded = () => o.result.createObjectStore(MAGATZEM);
      o.onsuccess = () => resol(o.result); o.onerror = () => rebutja(o.error);
    } catch (e) { rebutja(e); }
  });
}
async function local(op, valor) {
  try {
    const bd = await idb();
    return await new Promise((resol, rebutja) => {
      const tx = bd.transaction(MAGATZEM, op === 'get' ? 'readonly' : 'readwrite');
      const st = tx.objectStore(MAGATZEM);
      const rq = op === 'get' ? st.get('arxiu') : op === 'put' ? st.put(valor, 'arxiu') : st.delete('arxiu');
      rq.onsuccess = () => resol(rq.result); rq.onerror = () => rebutja(rq.error);
    });
  } catch { return null; }
}

// ───────── SQLite ─────────
let SQL = null;
async function motor() {
  if (!SQL) SQL = await initSqlJs({ locateFile: f => 'vendor/sqljs/' + f });
  return SQL;
}
function migra(db) {
  const v = db.exec('PRAGMA user_version')[0].values[0][0];
  for (let i = v; i < MIGRACIONS.length; i++) {
    db.exec('BEGIN'); db.exec(MIGRACIONS[i]); db.exec(`PRAGMA user_version = ${i + 1}`); db.exec('COMMIT');
  }
  return MIGRACIONS.length - v; // quantes s'han aplicat
}
function integritat(db) {
  try { return db.exec('PRAGMA integrity_check')[0].values[0][0]; } catch (e) { return String(e.message || e); }
}

// ───────── l'estat de l'arxiu obert ─────────
export const estat = {
  db: null, fitxerId: null, carpetaId: null,
  base: null,          // modifiedTime del Drive sobre el qual es treballa
  pendent: false,      // hi ha canvis que no han arribat al Drive
  origen: null         // 'drive' | 'local'
};

async function desaLocal() {
  await local('put', { bytes: estat.db.export(), fitxerId: estat.fitxerId, carpetaId: estat.carpetaId,
                       base: estat.base, pendent: estat.pendent, desat: new Date().toISOString() });
}

// Resultat d'obrir: { cas: 'obert' } o un cas que demana decisió de Ricard.
export async function obre() {
  await motor();
  const copia = await local('get');

  // Sense xarxa o sense permís: es treballa amb la còpia del navegador, si n'hi ha.
  let enLinia = navigator.onLine;
  if (enLinia) { try { await permis({ silenci: true }); } catch { enLinia = false; } }
  if (!enLinia) {
    if (!copia) return { cas: 'sense-res', detall: 'Sense connexió i sense còpia en aquest navegador.' };
    obreBytes(copia.bytes); Object.assign(estat, { fitxerId: copia.fitxerId, carpetaId: copia.carpetaId, base: copia.base, pendent: copia.pendent, origen: 'local' });
    return { cas: 'obert', fora: true };
  }

  const trobats = await buscar(NOM_ARXIU, { mime: SQLITE_MIME });
  if (trobats.length) {
    const f = trobats[0];
    const avis = trobats.length > 1 ? `Hi ha ${trobats.length} fitxers amb el nom de l'arxiu; s'obre el més recent (H-04).` : null;
    if (copia?.pendent && copia.fitxerId === f.id) {
      if (copia.base === f.modifiedTime) {           // els canvis locals parteixen de la versió que hi ha al Drive
        obreBytes(copia.bytes); Object.assign(estat, { fitxerId: f.id, carpetaId: copia.carpetaId, base: f.modifiedTime, pendent: true, origen: 'local' });
        const r = await desa();                      // i es pugen ara mateix: no s'esperen a un altre canvi
        return { cas: 'obert', avis, desat: r };
      }
      return { cas: 'conflicte', drive: f, copia };  // el Drive ha canviat des d'un altre lloc i aquí hi ha canvis sense pujar
    }
    const bytes = await baixa(f.id);
    obreBytes(bytes);
    const ok = integritat(estat.db);
    if (ok !== 'ok') return { cas: 'malmes', detall: ok, fitxer: f };
    Object.assign(estat, { fitxerId: f.id, carpetaId: f.parents?.[0] || null, base: f.modifiedTime, pendent: false, origen: 'drive' });
    const aplicades = migra(estat.db);
    if (aplicades) { estat.pendent = true; await desaLocal(); await desa(); } else await desaLocal();
    return { cas: 'obert', avis };
  }

  // No hi ha arxiu viu. Mai se'n crea un de buit sense mirar abans què hi ha (§3.5, v1.35).
  const aLaPaperera = await buscar(NOM_ARXIU, { paperera: true, mime: SQLITE_MIME });
  if (aLaPaperera.length) return { cas: 'a-la-paperera', fitxer: aLaPaperera[0] };
  if (copia?.bytes) return { cas: 'nomes-local', copia };
  const carpetes = await buscar(NOM_CARPETA, { mime: 'application/vnd.google-apps.folder' });
  if (carpetes.length) return { cas: 'carpeta-sense-arxiu', carpeta: carpetes[0] }; // hi va haver arxiu; caldrà una còpia
  return { cas: 'primera-vegada' };
}

function obreBytes(bytes) {
  if (estat.db) estat.db.close();
  estat.db = new SQL.Database(bytes);
}

// Només per al cas 'primera-vegada', i després de confirmar-ho Ricard.
export async function creaPerPrimeraVegada() {
  const carpeta = await creaFitxer(NOM_CARPETA, 'application/vnd.google-apps.folder', null, null);
  estat.db = new SQL.Database();
  migra(estat.db);
  estat.db.run('INSERT INTO meta (clau, valor) VALUES (?, ?)', ['creat', new Date().toISOString()]);
  const f = await creaFitxer(NOM_ARXIU, SQLITE_MIME, [carpeta.id], estat.db.export());
  Object.assign(estat, { fitxerId: f.id, carpetaId: carpeta.id, base: f.modifiedTime, pendent: false, origen: 'drive' });
  await desaLocal();
}

export async function recuperaDeLaPaperera(fitxer) {
  await treuDeLaPaperera(fitxer.id);
  return obre();
}

// Torna a pujar la còpia d'aquest navegador com a arxiu, quan al Drive no n'hi ha cap.
export async function pujaCopiaLocal(copia) {
  obreBytes(copia.bytes);
  const ok = integritat(estat.db);
  if (ok !== 'ok') throw new Error('La còpia del navegador no passa la comprovació d\'integritat: ' + ok);
  let carpetaId = copia.carpetaId;
  if (!carpetaId) carpetaId = (await creaFitxer(NOM_CARPETA, 'application/vnd.google-apps.folder', null, null)).id;
  const f = await creaFitxer(NOM_ARXIU, SQLITE_MIME, [carpetaId], estat.db.export());
  Object.assign(estat, { fitxerId: f.id, carpetaId, base: f.modifiedTime, pendent: false, origen: 'drive' });
  await desaLocal();
}

// Conflicte: Ricard tria quina versió mana. L'altra no s'esborra: es desa com a fitxer apart al Drive.
export async function resolConflicte(guanya, { drive, copia }) {
  if (guanya === 'drive') {
    await creaFitxer(`${NOM_ARXIU} · canvis d'aquest dispositiu ${new Date().toISOString().slice(0, 16)}`, SQLITE_MIME, copia.carpetaId ? [copia.carpetaId] : null, copia.bytes);
    await local('del');
    return obre();
  }
  obreBytes(copia.bytes);
  Object.assign(estat, { fitxerId: drive.id, carpetaId: copia.carpetaId, base: drive.modifiedTime, pendent: true, origen: 'local' });
  await desa({ forca: true });
  return { cas: 'obert' };
}

// Escriure: primer a la còpia del navegador (no es perd res), després al Drive.
export async function canvia(fn) {
  fn(estat.db);
  estat.pendent = true;
  await desaLocal();
  return desa();
}

// Puja l'arxiu sencer. Si el Drive ha canviat des d'un altre lloc, no el trepitja.
export async function desa({ forca = false } = {}) {
  if (!estat.pendent) return { desat: true };
  if (!navigator.onLine) return { desat: false, motiu: 'sense connexió' };
  try {
    const ara = await metadades(estat.fitxerId);
    if (ara.trashed) return { desat: false, motiu: 'l\'arxiu del Drive és a la paperera' };
    if (!forca && ara.modifiedTime !== estat.base) return { desat: false, motiu: 'conflicte', drive: ara };
    const r = await sobreescriu(estat.fitxerId, estat.db.export());
    if (r.modifiedTime === ara.modifiedTime) return { desat: false, motiu: 'el Drive no ha canviat la data' };
    estat.base = r.modifiedTime; estat.pendent = false;
    await desaLocal();
    return { desat: true };
  } catch (e) { return { desat: false, motiu: e.message }; }
}

// Mentre hi hagi canvis pendents, es torna a provar: quan torna la xarxa (que a Android avisa abans
// de funcionar de veritat), quan la pantalla torna a ser visible, i cada 30 segons. Cada intent avisa.
let rellotge = null, provant = false;
export function vigilaPendents(avisa) {
  const prova = async (esperes = [0]) => {
    if (provant || !estat.pendent || !estat.db) return;
    provant = true;
    try {
      for (const ms of esperes) {
        if (ms) await new Promise(r => setTimeout(r, ms));
        const r = await desa();
        avisa(r);
        if (r.desat || r.motiu === 'conflicte' || r.motiu?.includes('paperera')) break;
      }
    } finally { provant = false; }
  };
  window.addEventListener('online', () => prova([1500, 4000, 10000]));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') prova(); });
  clearInterval(rellotge);
  rellotge = setInterval(() => { if (navigator.onLine) prova(); }, 30_000);
}

export function recomptes() {
  const r = {};
  for (const t of TAULES) r[t] = estat.db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
  return r;
}
export const versioEsquema = () => estat.db.exec('PRAGMA user_version')[0].values[0][0];
export const llegeixMeta = clau => estat.db.exec('SELECT valor FROM meta WHERE clau = ?', [clau])[0]?.values[0][0] ?? null;
export const comprovaIntegritat = () => integritat(estat.db);
