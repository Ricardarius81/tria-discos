// Les imatges del Faristol (tram 3, bloc 3.2): portades de disc i fotos d'artista.
// Tres feines: trobar-les soles (la sonda), guardar-les en aquest mòbil perquè es vegin sense connexió,
// i pintar-les. Mai no s'inventa res: si no arriba cap imatge, el quadre es queda amb el text.
//
// D'on surten (§3.3, §7.7, v1.33):
//   Portada → MusicBrainz (títol i artista exactes; si n'hi ha uns quants, el més antic) + Cover Art Archive.
//             És una endevinada: es marca 'sonda' i l'escolta del bloc 3.3 la substituirà per la de l'edició exacta.
//   Foto    → MusicBrainz (l'artista pel nom exacte) → Wikidata (propietat P18) → Wikimedia Commons.
//             Les fonts que demanen una clau es van descartar: el repositori és públic.
//   Pujada a mà → el Drive de Ricard, carpeta «Retrats» dins de «La Meva Discoteca».

const MB = 'https://musicbrainz.org/ws/2';
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const espera = ms => new Promise(r => setTimeout(r, ms));

// ───────── on viu cada imatge ─────────
// La referència que es desa a l'arxiu → l'adreça d'on es baixa.
export function adreca(ref) {
  if (!ref) return null;
  if (/^(release|release-group)\//.test(ref)) return `https://coverartarchive.org/${ref}/front-500`;
  if (ref.startsWith('drive:')) return null;          // la baixa arxiu.js amb el permís del Drive
  return ref;                                         // una adreça completa (Commons)
}

// ───────── el magatzem d'imatges d'aquest mòbil (IndexedDB) ─────────
// Una imatge que ha entrat un cop es queda recordada sense connexió (decisió de Ricard, v1.33).
const BD = 'tria-imatges', MAG = 'imatges';
let bdP = null;
function bd() {
  if (!bdP) bdP = new Promise((resol, rebutja) => {
    try {
      const o = indexedDB.open(BD, 1);
      o.onupgradeneeded = () => o.result.createObjectStore(MAG);
      o.onsuccess = () => resol(o.result); o.onerror = () => rebutja(o.error);
    } catch (e) { rebutja(e); }
  });
  return bdP;
}
async function guardat(op, clau, valor) {
  try {
    const b = await bd();
    return await new Promise((resol, rebutja) => {
      const tx = b.transaction(MAG, op === 'get' ? 'readonly' : 'readwrite');
      const st = tx.objectStore(MAG);
      const rq = op === 'get' ? st.get(clau) : st.put(valor, clau);
      rq.onsuccess = () => resol(rq.result); rq.onerror = () => rebutja(rq.error);
    });
  } catch { return null; }
}

// ───────── pintar ─────────
// La pantalla pinta <img data-ref="…"> buides; aquí s'omplen. Primer, el que hi ha guardat al mòbil.
// Si no hi és i hi ha xarxa, es baixa, es guarda i es pinta. Si la font no deixa guardar-la (CORS),
// es pinta igual des de la xarxa: es veurà amb connexió, però no sense.
const urls = new Map();            // ref → objectURL ja preparat en aquesta sessió
const enCurs = new Map();
let baixaDrive = null;             // (id) => Blob, el posa la pantalla amb arxiu.js
export const usaDrive = fn => { baixaDrive = fn; };

async function blobDe(ref) {
  if (ref.startsWith('drive:')) { if (!baixaDrive) throw new Error('sense Drive'); return baixaDrive(ref.slice(6)); }
  const r = await fetch(adreca(ref), { mode: 'cors', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const b = await r.blob();
  if (!b.type.startsWith('image/')) throw new Error('no és una imatge');
  return b;
}

export async function url(ref) {
  if (!ref) return null;
  if (urls.has(ref)) return urls.get(ref);
  if (enCurs.has(ref)) return enCurs.get(ref);
  const p = (async () => {
    const b = await guardat('get', ref);
    if (b) { const u = URL.createObjectURL(b); urls.set(ref, u); return u; }
    if (!navigator.onLine) return null;
    try {
      const nou = await blobDe(ref);
      await guardat('put', ref, nou);
      const u = URL.createObjectURL(nou); urls.set(ref, u); return u;
    } catch {
      return ref.startsWith('drive:') ? null : adreca(ref);   // sense guardar: només amb connexió
    }
  })();
  enCurs.set(ref, p);
  try { return await p; } finally { enCurs.delete(ref); }
}

// Omple totes les imatges pendents d'un tros de pantalla. Si una no arriba, treu-la i deixa el text.
export function omple(arrel = document) {
  arrel.querySelectorAll('img[data-ref]:not([src])').forEach(async im => {
    const u = await url(im.dataset.ref);
    if (!im.isConnected) return;
    if (u) im.src = u; else treu(im);
  });
}
export function treu(im) {
  const c = im.closest('.coberta'); if (c) c.classList.remove('amb-img');
  im.remove();
}

// Una imatge pujada a mà es guarda de seguida, sense tornar-la a baixar.
export async function guardaJa(ref, blob) {
  await guardat('put', ref, blob);
  urls.set(ref, URL.createObjectURL(blob));
}

// ───────── la sonda ─────────
async function json(u) {
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const ESPERA_MB = 1100;            // MusicBrainz demana com a màxim una consulta per segon

// Una portada: el grup de llançament amb el títol i l'artista exactes (el més antic si n'hi ha uns quants)
// que tingui portada a Cover Art Archive. Torna la referència o null.
export async function sondaPortada({ art, titol }) {
  // Dues formes del títol: tal com és, i sense el que va entre parèntesis («Weezer (Blue Album)» → «Weezer»).
  const t2 = titol.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || titol;
  const q = encodeURIComponent(`releasegroup:"${t2}" AND artist:"${art}"`);
  const j = await json(`${MB}/release-group/?query=${q}&fmt=json&limit=25`);
  const titols = new Set([norm(titol), norm(t2)]);
  const bons = (j['release-groups'] || [])
    .filter(g => titols.has(norm(g.title)) && creditEs(g['artist-credit'], art))
    .sort((a, b) => (a['first-release-date'] || '9').localeCompare(b['first-release-date'] || '9'));
  for (const g of bons.slice(0, 3)) {
    const ref = 'release-group/' + g.id;
    if (await existeix(adreca(ref))) return ref;
  }
  return null;
}
// L'artista coincideix si és un dels noms del crèdit o el crèdit sencer («Steve Roach & Serena Gabriel»).
function creditEs(credit = [], art) {
  const n = norm(art);
  const sencer = credit.map(a => (a.name || '') + (a.joinphrase || '')).join('');
  return norm(sencer) === n || credit.some(a => norm(a.name) === n || norm(a.artist?.name) === n);
}

// «Tria-la tu» (decisió de Ricard, 30-10): els grups de llançament que MusicBrainz troba amb una cerca més ampla.
// Ricard toca el bo. Torna [{ ref, titol, art, any }]; la pantalla els pinta i amaga els que no tenen portada.
const net = s => String(s || '').replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();
export async function candidats({ titol, art }) {
  const t = net(titol), a = net(art);
  if (!t) return [];
  const q = `releasegroup:(${t})` + (a ? ` AND artist:(${a})` : '');
  const j = await json(`${MB}/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=18`);
  return (j['release-groups'] || []).map(g => ({
    ref: 'release-group/' + g.id, titol: g.title, any: (g['first-release-date'] || '').slice(0, 4),
    art: (g['artist-credit'] || []).map(x => (x.name || '') + (x.joinphrase || '')).join('')
  }));
}
export const miniatura = ref => `https://coverartarchive.org/${ref}/front-250`;

// Sense baixar-la sencera: n'hi ha prou que el navegador la pugui obrir.
function existeix(u) {
  return new Promise(r => { const im = new Image(); im.referrerPolicy = 'no-referrer';
    im.onload = () => r(true); im.onerror = () => r(false); im.src = u; setTimeout(() => r(false), 15000); });
}

// Una foto d'artista: MusicBrainz pel nom exacte (si hi ha dos artistes amb el mateix nom, no se n'endevina cap),
// el seu enllaç a Wikidata, la imatge P18 i la miniatura de Commons. Torna l'adreça o null.
export async function sondaRetrat({ nom }) {
  const j = await json(`${MB}/artist/?query=${encodeURIComponent(`artist:"${nom}"`)}&fmt=json&limit=10`);
  const iguals = (j.artists || []).filter(a => norm(a.name) === norm(nom) || (a.aliases || []).some(x => norm(x.name) === norm(nom)));
  if (iguals.length !== 1) return null;            // cap, o homònims: millor el text que una foto d'una altra persona
  await espera(ESPERA_MB);
  const a = await json(`${MB}/artist/${iguals[0].id}?inc=url-rels&fmt=json`);
  const wd = (a.relations || []).find(r => r.type === 'wikidata')?.url?.resource?.match(/Q\d+$/)?.[0];
  if (!wd) return null;
  const w = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wd}&props=claims&format=json&origin=*`);
  const fitxer = w.entities?.[wd]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!fitxer) return null;
  const c = await json(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + fitxer)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`);
  const info = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0];
  return info?.thumburl || null;
}

// Passa la sonda per una llista, d'un en un i a poc a poc. Cada tants resultats els lliura (desa)
// perquè, si es tanca l'app a mitges, no es perdi el que ja s'ha trobat. Torna quants n'ha trobat.
export async function passa(llista, prova, lliura, { cada = 8 } = {}) {
  let lot = [], trobats = 0;
  for (const x of llista) {
    if (!navigator.onLine) break;
    try { const r = await prova(x); if (r) { lot.push([x.id, r]); trobats++; } } catch {}
    if (lot.length >= cada) { await lliura(lot); lot = []; }
    await espera(ESPERA_MB);
  }
  if (lot.length) await lliura(lot);
  return trobats;
}

// Redueix una foto pujada a mà a 600 px pel costat llarg, en JPEG. Un retrat no necessita més.
export async function redueix(fitxer, mida = 600) {
  const bmp = await createImageBitmap(fitxer);
  const k = Math.min(1, mida / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
}
