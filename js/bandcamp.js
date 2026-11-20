// La bústia de Bandcamp, obra 1 (ACT-766, ACT-767): «Enganxa l'enllaç» i la sortida per al que no es troba.
// Viu aquí perquè els fitxers grans no creixin (ACT-756). Cap estructura nova: Edició.Enllaç de Bandcamp ja hi era
// (esquema v1) i les dates dels pendents van a la taula meta, com els canals propis.
import { pendentsBandcamp } from './escoltes.js?v=15';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; let cols = null;
  while (st.step()) { const v = st.get(); cols ||= st.getColumnNames(); const o = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = v[i]; out.push(o); }
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;

// ───────── ACT-767: «Enganxa l'enllaç» ─────────
// El que dona «Compartir» a l'app de Bandcamp és un text amb l'adreça a dins. Se n'agafa la primera adreça https, i
// només si és d'un àlbum o d'una pista de Bandcamp (decisió de construcció de Claude, per ratificar). Si no, null.
export function llegeixEnllac(text) {
  const m = String(text || '').match(/https:\/\/[^\s<>"']+/);
  if (!m) return null;
  let u; try { u = new URL(m[0].replace(/[).,;]+$/, '')); } catch { return null; }
  // ACT-793 c: qualsevol adreça https amb /album/ o /track/ (els segells amb domini propi); la tasca de nit comprova que és Bandcamp.
  if (!/^\/(album|track)\//.test(u.pathname)) return null;
  return u.origin + u.pathname;
}
// ACT-791: a Android, el ▶ d'un disc amb enllaç i sense codi prova l'app de Bandcamp amb un intent amb el seu paquet (com el
// truc d'AIMP); si no l'obre, el navegador (S.browser_fallback_url). Fora d'Android, l'enllaç tal qual.
export const PAQUET_BANDCAMP = 'com.bandcamp.android';
export function hrefEnllac(url, ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  if (!/Android/i.test(ua || '')) return url;
  let u; try { u = new URL(url); } catch { return url; }
  return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;action=android.intent.action.VIEW;package=' + PAQUET_BANDCAMP
    + ';S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
}
// Es desa a Edició.Enllaç de Bandcamp. El compte de nits d'aquest disc torna a zero: amb l'enllaç, la tasca ho té fàcil.
export const desaEnllac = (id, url) => db => {
  db.run('UPDATE edicio SET enllac_bandcamp = ? WHERE id = ?', [url, id]);
  const m = dates(db); delete m['E' + id]; desaDates(db, m);
};

// ───────── ACT-766: el que no es troba en N nits ─────────
// ACT-790: N = 3 nits de calendari («si falla tres dias seguidos, fuera»): es compten els canvis de dia, a l'hora d'aquest
// mòbil, des que el disc va entrar per primer cop al fitxer de pendents. Una nit que la tasca no corre compta igual.
export const NITS = 3;
// El dia canvia a les 6 del matí, no a mitjanit: la tasca corre cap a la 1:30, i així la seva passada de la tercera nit
// encara compta abans d'apartar el disc (si no, obrir l'app entre les 0 i la 1:30 l'apartaria amb només dues proves).
const migdia = t => { const d = new Date(t - 6 * 36e5); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
export const nitsEntre = (des, ara = Date.now()) => Math.round((migdia(ara) - migdia(Date.parse(des))) / 864e5);
// Una fila de meta per disc («bc-nits:E43»), no una sola amb tots: a l'arxiu gran del banc una sola fila passava dels
// 32767 caràcters que admet una cel·la de l'Excel de la còpia (trobat a la puerta del 19-11).
const PREFIX = 'bc-nits:';
const dates = db => { const m = {};
  for (const r of files(db, 'SELECT clau, valor FROM meta WHERE clau LIKE ?', [PREFIX + '%'])) { try { m[r.clau.slice(PREFIX.length)] = JSON.parse(r.valor); } catch {} }
  return m; };
const desaDates = (db, m) => {
  const abans = dates(db);
  for (const k of Object.keys(abans)) if (!(k in m)) db.run('DELETE FROM meta WHERE clau = ?', [PREFIX + k]);
  for (const [k, v] of Object.entries(m)) if (JSON.stringify(abans[k]) !== JSON.stringify(v)) db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [PREFIX + k, JSON.stringify(v)]);
};

// Els pendents de sempre, partits en dos: els que van al fitxer de la tasca i els apartats (N nits sense codi).
// `nous`: els que acaben de quedar apartats, per avisar-ne una sola vegada.
export function pendentsAmbNits(db, ara = Date.now()) {
  const m = dates(db), totes = pendentsBandcamp(db);
  const enllacos = new Map(files(db, "SELECT id, enllac_bandcamp FROM edicio WHERE enllac_bandcamp IS NOT NULL AND enllac_bandcamp != ''").map(r => ['E' + r.id, r.enllac_bandcamp]));
  const envia = [], apartats = [];
  for (const x of totes) {
    const y = { ...x, enllac: enllacos.get(x.clau) || null, des: m[x.clau]?.des || null };
    const nits = y.des ? nitsEntre(y.des, ara) : 0;
    (nits >= NITS ? apartats : envia).push({ ...y, nits });
  }
  return { envia, apartats, nous: apartats.filter(x => !m[x.clau]?.avisat) };
}
// Apunta la data dels que entren per primer cop, oblida els que ja no hi són (ja tenen codi) i marca com a avisats els
// apartats. `nitsNoves` torna el mapa nou, o null si no canvia res: així només es desa quan cal.
export function nitsNoves(db, ara = Date.now()) {
  const m = dates(db), abans = JSON.stringify(m), { envia, apartats } = pendentsAmbNits(db, ara), vius = new Set();
  for (const x of envia) { vius.add(x.clau); m[x.clau] ||= { des: new Date(ara).toISOString() }; }
  for (const x of apartats) { vius.add(x.clau); m[x.clau].avisat = true; }
  for (const k of Object.keys(m)) if (!vius.has(k)) delete m[k];
  return JSON.stringify(m) === abans ? null : m;
}
export const apuntaNits = (ara = Date.now()) => db => { const m = nitsNoves(db, ara); if (m) desaDates(db, m); };
// La línia del fitxer: com sempre, i l'enllaç al final si n'hi ha (decisió de construcció de Claude, per ratificar).
const net = s => String(s || '').replace(/[|\r\n]+/g, ' ').trim();
export const textPendents = l => l.map(x => `${x.clau} | ${net(x.art)} | ${net(x.titol)}${x.enllac ? ' | ' + net(x.enllac) : ''}`).join('\n') + (l.length ? '\n' : '');
// Per a la fitxa: si aquesta edició és apartada, quantes nits fa.
export function apartat(db, id, ara = Date.now()) {
  const x = pendentsAmbNits(db, ara).apartats.find(y => y.clau === 'E' + id);
  return x ? x.nits : null;
}
