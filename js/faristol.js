// El Faristol viu (tram 3, bloc 3.1): la maqueta v13 pintada sobre l'arxiu de debò.
// Tot el que es toca s'escriu a l'arxiu (arxiu.canvia) i es desa al Drive. Cada canvi porta «Desfés».
// Bloc 3.2: portades i fotos que arriben soles i es recorden sense connexió, foto d'artista pujada a mà,
// connexió amb el Drive en un toc, i l'ajust del «car pendent» del 30-10.
// Bloc 3.2 bis (31-10): una sola fitxa del disc, que creix (ACT-391): el canal, la nota amb els seus dos gestos
// i els tags en dos grups; la revisió de tags en treure un disc de rotació (pregunta 11).
// Blocs 3.3 + 3.4 + 3.5 (v1.44), una sola publicació: les escoltes de ListenBrainz, la safata viva i la bústia.
// Pas u: el Scrobble, l'Arrencada, la lectura de les dues comptes, la pregunta 2, les tirades, l'Historial i «Grup».
// v1.52 (14-11): la fitxa nova de la maqueta v14 (ACT-732 a ACT-736) i l'Historial amb finestra de cent (ACT-737).

import * as A from './arxiu.js?v=21';
import * as D from './dades.js?v=25';
import * as E from './escoltes.js?v=15';
import { partsPerActe } from './actes.js?v=1';
import * as AP from './actespregunta.js?v=1';
import * as SG from './segells.js?v=1';
import * as LB from './listenbrainz.js?v=2';
import * as I from './imatges.js?v=5';
import * as T from './tags.js?v=1';
import * as C from './copies.js?v=6';
import * as X from './excel.js?v=6';
import * as L from './llistes.js?v=1';
import * as V from './discografia.js?v=1';
import * as F from './afinacio.js?v=4';
import * as P from './piles.js?v=1';
import * as N from './navegacio.js?v=1';
import * as FX from './fitxa.js?v=1';
import * as INI from './inici.js?v=1';
import * as R from './rajoles.js?v=1';
import * as B from './bandcamp.js?v=1';
import * as J from './arreglos.js?v=1';
import * as PR from './proper.js?v=1';
import * as CB from './codibc.js?v=1';
import * as BR from './branques.js?v=1';
import * as INF from './info.js?v=1';
import * as EM from './escoltama.js?v=1';
import * as ANYS from './anys.js?v=1';
import * as PG from './progres.js?v=1';
import * as O4 from './obra4.js?v=1';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inicials = n => String(n || '').replace(/[^\p{L}\s.]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
// Les imatges es pinten buides, amb la seva referència; imatges.js les omple des del mòbil o des de la xarxa.
const IMG = ref => `<img data-ref="${esc(ref)}" alt="" referrerpolicy="no-referrer" onerror="var c=this.closest('.coberta');if(c)c.classList.remove('amb-img');this.remove()">`;
I.usaDrive(id => A.baixaImatge(id));
const db = () => A.estat.db;
const norm = E.norm;
const hora = iso => iso ? new Date(iso).toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ───────── els canals (§3.1) ─────────
const CANALS = {
  amazon: { nom: 'Amazon Music', url: t => 'https://music.amazon.com/search/' + encodeURIComponent(t) },
  youtube: { nom: 'YouTube Music', url: t => 'https://music.youtube.com/search?q=' + encodeURIComponent(t) },
  bandcamp: { nom: 'Bandcamp', url: t => 'https://bandcamp.com/search?q=' + encodeURIComponent(t) + '&item_type=a' },
  aimp: { nom: 'AIMP', url: null }
};
const NOMS_FISICS = { CD: 'CD', vinil: 'Vinil' };
// AIMP s'obre donant-li un quart de segon de silenci (prova D bis de l'11-10). El fitxer viu en aquest mateix lloc.
const SILENCI = location.host + location.pathname.replace(/[^/]*$/, '') + 'so/silenci.mp3';
const AIMP_APP = () => 'intent://' + SILENCI + '#Intent;scheme=https;action=android.intent.action.VIEW;type=audio/mpeg;package=com.aimp.player;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';

function enllac(canal, d) {
  const q = d.art + ' ' + d.tit;
  if (canal === 'bandcamp') {
    return d.bc ? { href: 'x-bandcamp://show_tralbum?tralbum_type=a&tralbum_id=' + d.bc, nota: "obre el disc a l'app", ext: false }
         : d.bce ? { href: B.hrefEnllac(d.bce), nota: "obre l'enllaç; el codi arriba de nit", ext: true }   // ACT-767, ACT-791
                 : { href: CANALS.bandcamp.url(q), nota: 'cerca: falta el codi', ext: true };
  }
  if (canal === 'aimp') return { href: AIMP_APP(), nota: "obre l'app; el disc el tries tu", ext: false };
  if (CANALS[canal]?.propi) return { href: '#', nota: "obre-ho tu: no en té l'adreça", ext: false, propi: CANALS[canal].nom };
  const c = CANALS[canal] || CANALS.amazon;
  return { href: c.url(q), nota: 'obre la cerca', ext: true };
}
const aAttrs = e => `href="${esc(e.href)}" ${e.ext ? 'target="_blank" rel="noopener"' : ''}${e.propi ? ` data-propi="${esc(e.propi)}"` : ''}`;
// Els canals escrits a mà (v1.35) s'afegeixen als quatre de sempre cada vegada que es pinta.
function sincroCanals() {
  if (!A.estat.db) return;
  for (const k of Object.keys(CANALS)) if (CANALS[k].propi) delete CANALS[k];
  for (const nom of D.canalsPropis(A.estat.db)) CANALS['propi:' + nom] = { nom, url: null, propi: true };
}
const nomCanal = k => CANALS[k]?.nom || (k?.startsWith('propi:') ? k.slice(6) : k) || '—';
// «Un altre…»: el botó i el camp per escriure'l. El mateix a la targeta de disc nou i a la fulla del canal.
const altreCanal = (obert, on, val) => obert
  ? `<span class="sf-altre"><input id="inCanalNou" type="text" placeholder="Nom del canal" autocomplete="off"><button class="principal" data-afegeixcanal="${on}|${esc(val)}">Afegeix</button></span>`
  : `<button class="mes" data-obrealtrecanal="${on}|${esc(val)}">Un altre…</button>`;

// ───────── estat de la pantalla ─────────
const estat = { superficie: 'entrada', sub: 'rot', ordena: false, ordreTmp: null, artista: null, escoltant: null, ultima: null, lloc: 'Fora', gps: 'Encara no s\'ha mirat la ubicació.' };

// ───────── avisos, fulls, desat ─────────
function avisa(txt, desfes) {
  PG.treu();
  $('#avisTxt').textContent = txt; $('#avis').classList.add('obert');
  $('#avisBt').style.display = desfes ? 'inline' : 'none'; estat.ultima = desfes || null;
  clearTimeout(window._t); window._t = setTimeout(() => $('#avis').classList.remove('obert'), 6500);
}
// complet: les fitxes i La Cabina ocupen tota la pantalla, com la safata (3-11, Ricard). Les fulles d'acció ràpida
// (la nota, el ▶ del grup, el canal…) es queden a mitja pantalla, perquè el fons fa de context.
function obreFull(h, complet = false) {
  estat.resoltaOberta = null;
  // ACT-742 (7): una fulla que s'obre des de la fitxa (la fitxa és oberta i la fulla la substitueix) és a pantalla completa,
  // per homogeneïtat. Es tanca amb «← Tornar», que torna a la fitxa. Fora de la fitxa (la safata, «Un altre…»), com sempre.
  const f = $('#full'), cadena = f.classList.contains('obert') ? f.dataset.cadena : null;
  if (cadena) complet = true; else delete f.dataset.cadena;
  $('#full').innerHTML = '<button class="torna-full" data-tornafull="1">← Tornar</button>' + h;
  $('#full').classList.toggle('complet', complet);
  $('#full').classList.remove('nota-sortida');
  $('#full').classList.add('obert'); $('#fons').classList.add('obert'); $('#full').scrollTop = 0;
  I.omple($('#full'));
}
function tancaFull() {
  const f = $('#full');
  delete f.dataset.cadena;
  // Tancar la fulla de puntuar sense tocar res desfà tota la sortida: el disc continua en rotació (decisió B de Ricard, 30-10).
  // Per treure'l sense nota, «Encara no».
  if (f.dataset.encaraNo) {
    delete f.dataset.encaraNo;
    const b = estat.abansSortida; estat.abansSortida = null;
    // Si has tocat els tags però no la nota, el disc continua en rotació i els tags es queden: són judici sobre el disc,
    // no sobre la sortida (invenció de Claude del 31-10, per validar).
    const tg = estat.tagsSortida; estat.tagsSortida = null; estat.sortint = null;
    if (b) { A.restaura(b).then(async r => { puntBrut = true; if (tg) await fes(D.desaTags(tg.id, tg.album_id, tg), null, { desfes: false }); pinta(); marcaDesat(r); });
             avisa(tg ? 'Sense nota: el disc continua en rotació, i els tags que has tocat es queden.' : 'Sense tocar res: el disc continua en rotació.'); }
  }
  f.classList.remove('obert'); $('#fons').classList.remove('obert');
  if (estat.dubteProper) setTimeout(obreDubteProper, 250);
}
// «Era aquest el proper?» (ACT-812, 1.1): una sola vegada, quan entra en rotació un disc de l'artista que no és el proper.
// Si hi ha una fulla oberta, espera que es tanqui.
function obreDubteProper() {
  const x = estat.dubteProper; if (!x || $('#full').classList.contains('obert')) return;
  estat.dubteProper = null;
  obreFull(`<h3>Era aquest el proper?</h3><p>El proper de ${esc(x.nom)} era «${esc(x.proper)}». Ara ha entrat en rotació «${esc(x.titol)}».</p>
    <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-eraproper="${x.pid}">Sí, era aquest</button>
      <button class="bt" data-tornafull="1">No: el proper s'espera</button></div>`);
}
// «Sense desar» (ACT-750 a): un toc de Ricard que encara espera la calma o la pujada, o una pujada que ha fallat. El que
// han llegit les lectures automàtiques i espera el rellotge de 30 s no ho és: és a la còpia del mòbil i puja sol.
const ESPERA_NORMAL = ['obrint', 'en espera'];
function marcaDesat(r) {
  const pendent = A.estat.pendent;
  if (r && r.motiu === 'sense connectar amb el Drive') document.body.classList.add('desconnectat');
  if (r?.desat) estat.desatFallat = false; else if (r && !ESPERA_NORMAL.includes(r.motiu)) estat.desatFallat = true;
  $('#desat').classList.toggle('visible', !!pendent && (A.estat.manual || !!estat.desatFallat));
  if (r && !r.desat && !ESPERA_NORMAL.includes(r.motiu) && !document.body.classList.contains('desconnectat')) {
    // Si el que hi ha pendent són només lectures de la màquina (ListenBrainz, sonda, bústia), no és un conflicte: es torna a
    // obrir l'arxiu del Drive en silenci i es tornen a fer (ACT-492). El sortia en tornar a primer pla amb dos mòbils (3-11).
    if (r.motiu === 'conflicte' && !A.estat.manual) { connecta(false); return; }
    if (r.motiu === 'conflicte') avisa('L\'arxiu ha canviat en un altre lloc: torna a connectar per triar quin mana.');
    else avisa('Encara no s\'ha pogut desar al Drive (' + r.motiu + '). Queda en aquest mòbil i es torna a provar sol.');
  }
}

addEventListener('tria-desat', () => marcaDesat());   // l'avís «sense desar» es torna a mirar a cada pujada acabada (arreglo 20-11)
// Fer un canvi: s'escriu a l'arxiu, es pinta de seguida i es desa. «Desfés» torna l'arxiu a com era abans.
async function fes(fn, text, { desfes = true, abans = null, auto = false, proper = true } = {}) {
  abans = abans || A.estat.db.export();
  let res;
  const rotAbans = auto || !proper ? null : PR.enRotacio(A.estat.db);   // ACT-812 (1.1): què entra en rotació amb aquest canvi
  // Les Piles (ACT-707, ACT-744): dins de cada canvi, les entrades que una escolta nova ha tret de la seva Pila.
  const p = A.canvia(d => { res = fn(d); P.sortides(d); }, { auto });
  if (!auto) puntBrut = true;   // ACT-796: un canvi seu (no una lectura automàtica) pot moure L'Afinació
  pinta();
  if (rotAbans) { const nous = [...PR.enRotacio(A.estat.db)].filter(id => !rotAbans.has(id)), dub = nous.length ? PR.dubtesProper(A.estat.db, nous) : [];
                  if (dub.length) { estat.dubteProper = dub[0]; setTimeout(obreDubteProper, 350); } }
  if (text) avisa(typeof text === 'function' ? text(res) : text,
    desfes ? async () => { delete $('#full').dataset.encaraNo; if ($('#full').classList.contains('obert')) tancaFull();
                           const r = await A.restaura(abans); puntBrut = true; pinta(); marcaDesat(r); } : null);
  marcaDesat();
  const r = await p; marcaDesat(r);
  return res;
}

// Una durada nova: es tornen a calcular les escoltes d'aquesta edició, de la primera endavant (ACT-582, ACT-738). Sense cap
// escolta, no hi ha res a calcular.
function recalculaEdicio(y, id) { const d = E.desDeEdicions(y, [id]); return d ? E.recalcula(y, { desDe: d }) : null; }

// ───────── pintar ─────────
function pinta() {
  if (!A.estat.db) return;
  sincroCanals();
  try { estat.enPiles = P.edicionsEnPiles(db()); estat.colorsPila = P.colorsPiles(db()); } catch { estat.enPiles = null; }
  pintaReixa(); pintaFiles(); pintaHistorial(); pintaSafata(); alertaCopia(); if (puntBrut) { puntBrut = false; programaPunt(); } pintaPiles(); pintaSegells();
  if (estat.superficie === 'prestatgeria') pintaPrestatgeria();
  if (estat.superficie === 'artista' && estat.artista) pintaArtista(estat.artista);
  I.omple();
}

// Les agrupacions (§7.5). Un àlbum és d'un sol grup (Àlbum.Conjunt). La portada combinada ensenya com van sonar els
// discos l'última vegada (ACT-443): els que van sonar «d'una tirada» —dins d'una finestra de 24 hores (ACT-446)— surten
// junts, i la resta, solts. Un grup sense escoltes surt junt (ACT-444), i el ▶ ni junta ni separa: només ordena.
// Només hi surten els discos del grup que són en rotació (ACT-430). El grup ocupa el lloc del seu disc més recent.
const perOrdre = (x, y) => (x.posicio || 99) - (y.posicio || 99) || x.id - y.id;
function junts(rot, nom, fg = E.grupsAmbEscoltes(db())) {
  const j = E.juntsARotacio(fg.get(nom));                 // null: cap escolta, junts tots
  const m = rot.filter(x => x.conjunt === nom && (j === null || j.has(x.album_id))).sort(perOrdre);
  return m.length > 1 ? m : [];
}
function grups(rot) {
  const fg = E.grupsAmbEscoltes(db());
  const fets = new Set(), out = [], dins = new Map();
  for (const nom of new Set(rot.map(d => d.conjunt).filter(Boolean))) for (const x of junts(rot, nom, fg)) dins.set(x.id, nom);
  for (const d of rot) {
    const nom = dins.get(d.id);
    if (!nom) { out.push(d); continue; }
    if (fets.has(nom)) continue; fets.add(nom);
    out.push({ grup: nom, membres: rot.filter(x => dins.get(x.id) === nom).sort(perOrdre) });
  }
  return out;
}
const membresDe = nom => junts(D.rotacio(db()), nom);
// El títol d'un grup: el del primer disc, i dels altres només el que els distingeix (decisió de Ricard, 31-10).
// «Careful Now + Unmasked», «Infinitati + Intrusion Dubs + Variant Immersions».
function titolGrup(nom, m) {
  return D.nomsGrups(db())[nom] || titolAuto(nom, m);     // el que hi ha posat Ricard, si n'hi ha (ACT-520)
}
function titolAuto(nom, m) {
  const re = new RegExp('^' + nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
  return m.map((x, i) => i === 0 ? x.titol : (x.titol.replace(re, '').replace(/^\((.*)\)$/, '$1').trim() || x.titol)).join(' + ');
}
function tileGrup(g, prefs) {
  const m = g.membres, arts = [...new Set(m.map(x => x.art))].join(' · ');
  const total = m.every(x => x.min) ? m.reduce((s, x) => s + x.min, 0) : null;
  // El títol sempre hi és, sota la imatge: si la portada no arriba, el tros no es queda buit (4-11, Infinitati).
  const trossos = m.slice(0, 4).map(x => `<span class="tros"><i>${esc(x.titol)}</i>${x.portada ? IMG(x.portada) : ''}</span>`).join('');
  const pref = m.some(x => prefs.has(x.artista_id)) ? ' pref' : '';
  return `<div class="disc grup${pref}">
      <button class="coberta collage amb-img n${Math.min(m.length, 4)}" data-grup="${esc(g.grup)}" aria-label="Grup ${esc(g.grup)}">
        <span class="trossos">${trossos}</span>${total ? `<span class="durada">${total}′</span>` : `<span class="durada falta">falta la durada</span>`}
      </button><button class="escoltar" data-grupplay="${esc(g.grup)}" aria-label="Escoltar ${esc(g.grup)}">▶</button>
      <button class="nom-sota" data-grup="${esc(g.grup)}" tabindex="-1"><span><b>${esc(titolGrup(g.grup, m))}</b><i>${esc(arts)}</i></span></button>
      <div class="peu"><span class="part">${m.length} discos junts</span></div>
    </div>`;
}
// El ▶ d'un grup no pot llançar-los tots: les apps de fora obren un disc cada vegada.
// Obre una fulla amb els discos en ordre, cadascun amb el seu ▶ i la seva fitxa (proposta de Claude acceptada el 31-10).
function fullGrupEscolta(nom) {
  const m = membresDe(nom);
  if (!m.length) { fullGrup(nom); return; }
  obreFull(`<h3>${esc(titolGrup(nom, m))}</h3><p>${m.length} discos que van junts${m.every(x => x.min) ? ' · ' + m.reduce((s, x) => s + x.min, 0) + '′ en total' : ''}.</p>
    <div class="llista-grup">${m.map((x, i) => {
      const e = x.app_escolta ? enllac(x.app_escolta, { art: x.art, tit: x.titol, bc: x.bc, bce: x.bce }) : null;
      return `<div class="membre">
        <button class="mini" data-fitxa="${x.id}">${x.portada ? IMG(x.portada) : ''}</button>
        <button class="txt" data-fitxa="${x.id}"><b>${i + 1}. ${esc(x.titol)}</b><small>${esc(x.art)}${x.min ? ' · ' + x.min + '′' : ''}</small></button>
        ${e ? `<a class="play" ${aAttrs(e)} data-obre="${x.id}" aria-label="Escoltar ${esc(x.titol)}">▶</a>` : `<button class="play" data-escoltar="${x.id}">▶</button>`}
      </div>`; }).join('')}</div>
    <p class="gris" style="font-size:12px">Toca un títol per obrir-ne la fitxa. <button class="sf-link" style="padding:0" data-fitxagrup="${esc(nom)}">La fitxa del grup</button>: el nom, i afegir-hi o treure'n discos.</p>`);
}
// La fitxa del grup (2-11, proposta de Ricard): on es veuen tots els discos del grup, en rotació o no, i on es canvia el
// nom i s'hi afegeixen o se'n treuen discos. La fitxa d'un disc només porta «obre el grup» o, si no en té, «agrupa'l amb…».
function fullGrup(nom) {
  const m = D.grup(db(), nom);
  if (!m.length) { tancaFull(); return; }
  estat.grupObert = nom;
  const total = m.every(x => x.min) ? m.reduce((a, x) => a + x.min, 0) : null, nRot = m.filter(x => x.rotacio_actual).length;
  const propi = D.nomsGrups(db())[nom];
  obreFull(`<h3>${esc(titolGrup(nom, m))}</h3>
    <p>${m.length} discos${total ? ' · ' + total + '′ en total' : ''} · ${nRot ? (nRot === m.length ? 'tots en rotació' : nRot + ' en rotació') : 'cap en rotació'}
      ${propi ? `<br><small class="gris">El nom l'has posat tu. El de la màquina: ${esc(titolAuto(nom, m))}.</small>` : ''}</p>
    <div class="barra-accions" style="position:static;padding:0 0 10px"><button class="bt" data-nomgrup="${m[0].id}">Canvia-li el nom</button>
      <button class="bt" data-agrupa="${m[0].id}">Afegeix-hi un disc</button></div>
    <div class="llista-grup">${m.map((x, i) => `<div class="membre">
        <button class="mini" data-fitxa="${x.id}">${x.portada ? IMG(x.portada) : ''}</button>
        <button class="txt" data-fitxa="${x.id}"><b>${i + 1}. ${esc(x.titol)}</b><small>${esc(x.art)}${x.min ? ' · ' + x.min + '′' : ''}${x.rotacio_actual ? ' · en rotació' : ''}</small></button>
        <button class="treu" data-treugrup="${x.id}" aria-label="Treu ${esc(x.titol)} del grup">treu-lo</button>
        ${botoPlay(x, 'play')}
      </div>`).join('')}</div>
    <p class="gris" style="font-size:12px">${m.length === 2 ? 'Si en treus un, el grup es desfà: un grup d\'un sol disc no és un grup.' : 'Un disc que s\'afegeix va al final.'}${propi ? ' Si el grup es desfà, el nom es perd.' : ''}</p>`, true);
}

function botoPlay(d, classe) {
  if (d.esperant) return '';
  return d.app_escolta
    ? `<a class="${classe}" ${aAttrs(enllac(d.app_escolta, { art: d.art, tit: d.titol, bc: d.bc, bce: d.bce }))} data-obre="${d.id}" aria-label="Escoltar ara ${esc(d.titol)}">▶</a>`
    : `<button class="${classe}" data-escoltar="${d.id}" aria-label="Escoltar ara ${esc(d.titol)}">▶</button>`;
}
function pintaReixa() {
  const rot = D.rotacio(db()), prefs = D.artistesPreferents(db());
  let segs; try { segs = SG.edicionsDeSegellsPreferents(db()); } catch { segs = new Set(); }   // obra G (7.8): marc platejat
  $('#reixa').innerHTML = grups(rot).map(d => { if (d.grup) return tileGrup(d, prefs);
    const part = d.esperant
      ? `<span class="part">esperant</span><button class="repren" data-repren="${d.id}">Reprèn</button>`
      : (d.viva ? `<span class="part">${d.viva.nom ? esc(d.viva.nom) + ' · ' : ''}part ${d.viva.numero}/${d.parts.length}</span>` : '');
    const tags = T.curts(d.album_tags, d.tags).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const dur = d.esperant ? '' : (d.min ? `<span class="durada">${d.min}′</span>` : `<span class="durada falta">falta la durada</span>`);
    const tit = d.viva?.nom && d.parts.length ? d.titol : d.titol;
    const canal = d.app_escolta;
    const play = d.esperant ? '' : (canal
      ? `<a class="escoltar" ${aAttrs(enllac(canal, { art: d.art, tit: d.titol, bc: d.bc, bce: d.bce }))} data-obre="${d.id}" aria-label="Escoltar ara ${esc(tit)}">▶</a>`
      : `<button class="escoltar" data-escoltar="${d.id}" aria-label="Escoltar ara ${esc(tit)}">▶</button>`);
    return `<div class="disc${prefs.has(d.artista_id) ? ' pref' : ''}${segs.has(d.id) ? ' seg' : ''}">
      <button class="coberta ${d.portada ? 'amb-img' : ''}" data-fitxa="${d.id}" aria-label="Fitxa de ${esc(tit)}">
        ${d.portada ? IMG(d.portada) : ''}${icoPila(d.id, true)}<span class="a">${esc(d.art)}</span><span class="t">${esc(tit)}</span><span class="filet"></span>${dur}
      </button>${play}
      <button class="nom-sota" data-fitxa="${d.id}" tabindex="-1"><span><b>${esc(tit)}</b><i>${esc(d.art)}</i></span></button>
      <div class="peu">${part}${tags}</div>
    </div>`;
  }).join('') || `<p class="subtitol" style="margin:6px 0 0">No hi ha cap disc en rotació.</p>`;
}

// El «proper» és un títol sense fitxa (§7.7, v1.34): el ▶ no pot obrir el disc, només buscar-lo al canal de l'artista.
function playPreferent(p) {
  if (p.rot) return botoPlay(p.rot, 'fplay');
  if (!p.proper_titol) return '';
  const canal = D.canalPerDefecte(db(), p.artista_id), e = enllac(canal, { art: p.nom, tit: p.proper_titol });
  return `<a class="fplay cerca" ${aAttrs(e)} aria-label="Busca ${esc(p.proper_titol)} a ${esc(nomCanal(canal))}">▶</a>`;
}
function pintaFiles() {
  let ps = D.preferents(db());
  if (estat.ordena && estat.ordreTmp) ps = estat.ordreTmp.map(id => ps.find(p => p.id === id)).filter(Boolean);
  else ps = R.ordenaPreferents(db(), ps);   // ACT-775: l'ordre triat; només Manual s'arrossega
  const manual = R.ordrePref() === 'manual', sel = $('#ordrePref');
  if (sel && sel.value !== R.ordrePref()) sel.value = R.ordrePref();
  $('#btOrdena').hidden = !manual && !estat.ordena;
  $('#files').classList.toggle('ordenant', estat.ordena);
  $('#files').innerHTML = ps.map((p, i) => {
    const r = p.rot, foto = p.retrat || r?.portada || null;
    const linia = r ? `Ara estudies <em>${esc(r.titol)}</em>` : (p.proper_titol ? `El proper: <em>${esc(p.proper_titol)}</em>` : '');
    const mou = estat.ordena ? `<span class="mou">
        <button data-mou="${i}:-1" aria-label="Amunt" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button data-mou="${i}:1" aria-label="Avall" ${i === ps.length - 1 ? 'disabled' : ''}>▼</button></span>
        <button class="nansa" aria-label="Arrossega ${esc(p.nom)}">⠿</button>` : '';
    const cob = r?.portada ? `<span class="cob-fila">${IMG(r.portada)}</span>` : '';
    return `<div class="fila" data-fila="${p.id}">
      <button class="fila-cap" data-artista="${p.id}">
        <span class="foto ${!p.retrat && foto ? 'quadrat' : ''} ${r ? 'viu' : ''}">${esc(inicials(p.nom))}${foto ? IMG(foto) : ''}</span>
        <span class="fila-txt"><span class="nom">${esc(p.nom)}</span>${linia ? `<span class="estat">${linia}</span>` : ''}</span>${cob}
      </button>${estat.ordena ? '' : playPreferent(p)}${mou}
    </div>`;
  }).join('') || `<p class="subtitol" style="margin:12px 0 0">Encara no hi ha cap artista preferent.</p>`;
  I.omple($('#files'));   // ACT-768 (d): «Ordena la llista» torna a pintar les files sense passar per pinta(): les fotos, també
}

function pintaArtista(id) {
  const p = D.preferents(db()).find(x => x.id === id);
  if (!p) { vesA('faristol'); sub('pref'); return; }
  const r = p.rot, foto = p.retrat || r?.portada || null, pv = D.partidesVei(db(), p.id);
  // El proper (ACT-627): a la pantalla de l'artista es veu també quan té disc en rotació, sota «Ara estudies».
  // A la fila de preferents continua amagat (ACT-619).
  const blocProper = p.proper_titol ? `<div class="marcador"><p class="cita">El proper: ${esc(p.proper_titol)}.</p><p>Quan aquest disc entri en rotació, aquesta nota s'esborra. Si n'entra un altre seu, la nota s'espera.</p>
          <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-escproper="${p.id}">Escoltar ara</button>
          <button class="bt" data-triaproper="${p.id}">Canvia'l</button><button class="bt discret" data-treuproper="${p.id}">Treu-lo</button></div></div>` : '';
  // El disc anterior i el següent (ACT-626, ACT-646): aquí, al costat del proper. Sense partida, la discografia (ACT-650).
  const desDe = pv.discos.length > 1 ? `des de quin? ${pv.discos.length} en rotació` : pv.discos.length ? `des de «${esc(pv.discos[0].titol)}»` : '';
  const botonsVei = pv.discos.length
    ? `<button data-vei="${p.id}:ant">◀ Disc anterior <small>${desDe}</small></button><button data-vei="${p.id}:seg">Disc següent ▶ <small>${desDe}</small></button>`
    : `<button data-discografia="${p.id}">Tria de la discografia <small>segons MusicBrainz</small></button>`;
  $('#s-artista').innerHTML = `<button class="enrere" data-tornar="1">← Tornar</button>
    <div class="cap-artista">
      <span class="retrat-gran">${esc(inicials(p.nom))}${foto ? IMG(foto) : ''}</span>
      <div><h1>${esc(p.nom)}</h1><div class="estat" style="font-size:12.5px">${r ? 'Amb disc en rotació' : 'Preferent'}</div></div>
    </div>
    ${r ? `<div class="marcador ${r.portada ? 'amb-cob' : ''}">${r.portada ? `<span class="cob-fila">${IMG(r.portada)}</span>` : ''}<div><p class="cita">Ara estudies ${esc(r.titol)}.</p><p>És a Discos en Rotació.</p></div></div>${blocProper}`
      : p.proper_titol ? blocProper
      : pv.de === 'escolta' ? `<div class="marcador"><p class="cita">L'últim que ha sonat: ${esc(pv.discos[0].titol)}.</p><p>D'aquí compten el disc anterior i el següent.</p></div>`
      : `<div class="marcador"><p class="cita">Encara no ha sonat res seu.</p><p>La màquina només sap el que passa des del dia que arrenca. Quan arribin les escoltes, sortirà aquí.</p></div>`}
    <div class="canals" style="margin-top:14px">
      ${botonsVei}
      ${!p.proper_titol ? `<button data-triaproper="${p.id}">Tria el proper disc <small>${r ? 'el que vols escoltar després' : 'el primer que vols escoltar'}</small></button>` : ''}
      <button data-canviafoto="${p.id}">Canvia la foto <small>${{ ma: 'la vas pujar tu', triat: 'la vas triar tu', sonda: 'la va trobar la màquina', rebutjat: 'la de la màquina no era' }[p.retrat_origen] || 'no n\'ha arribat cap de sola'}</small></button>
    </div>
    <div class="barra-accions" style="position:static;padding:14px 0 0"><button class="bt discret" data-desprefer="${p.id}">Treu-lo de preferents</button></div>`;
  I.omple($('#s-artista'));
}

// ───────── el disc anterior i el següent (ACT-626, ACT-646 a ACT-652) ─────────
// Un selector com el de les portades: es cerca quan es toca, es tria i va al proper. Si ja n'hi ha, ho diu abans
// (ACT-647), i després de triar surt «Desfés».
const substitueix = pv => pv.proper
  ? `<p class="substitueix">Substitueix «${esc(pv.proper)}»: el que triïs passa a ser el proper.</p>`
  : `<p>El que triïs passa a ser el proper.</p>`;
function fullVei(pid, dir, idx = null) {
  const pv = D.partidesVei(db(), pid); if (!pv || !pv.discos.length) return;
  const quin = dir === 'seg' ? 'següent' : 'anterior';
  if (pv.discos.length > 1 && idx === null) {        // ACT-648
    obreFull(`<h3>Des de quin?</h3><p>${esc(pv.art)} té ${pv.discos.length} discos en rotació. El disc ${quin} es compta des del que triïs.</p>
      <div class="canals">${pv.discos.map((x, i) => `<button data-veides="${pid}:${dir}:${i}">${esc(x.titol)} <small>${esc(x.art)}</small></button>`).join('')}</div>`);
    return;
  }
  const partida = pv.discos[idx ?? 0];
  estat.vei = { pid, dir, partida, candidats: [] };
  obreFull(`<h3>El disc ${quin}</h3><p>${esc(partida.art)} · des de «${esc(partida.titol)}»</p>${substitueix(pv)}
    <div class="canals" id="veins"><p class="subtitol">Cercant…</p></div>`, true);
  cercaVei();
}
function fullDiscografia(pid) {
  const pv = D.partidesVei(db(), pid); if (!pv) return;
  estat.vei = { pid, llista: true, art: pv.art, noms: pv.noms, candidats: [] };
  obreFull(`<h3>Tria de la discografia</h3><p>${esc(pv.art)} · segons MusicBrainz, per data</p>${substitueix(pv)}
    <div class="canals" id="veins"><p class="subtitol">Cercant…</p></div>`, true);
  cercaVei();
}
let cercaVeiN = 0;
async function cercaVei(mbid = null) {
  const v = estat.vei; if (!v) return;
  const n = ++cercaVeiN;
  const r = v.llista ? await V.discografia({ art: v.art, noms: v.noms, mbid }) : await V.vei(v.partida, v.dir, { mbid });
  if (n !== cercaVeiN || !$('#veins')) return;
  const caixa = $('#veins');
  if (r.sense) { caixa.innerHTML = '<p class="subtitol">Sense connexió: la cerca necessita xarxa.</p>'; return; }
  if (r.error) { caixa.innerHTML = `<p class="subtitol">No respon (${esc(r.error)}). Torna-hi d'aquí a una estona.</p>`; return; }
  if (r.homonims) {
    caixa.innerHTML = (r.motiu ? `<p class="subtitol">A la Wikipedia, ${esc(r.motiu)}.</p>` : '') + `<p class="subtitol">A MusicBrainz hi ha més d'un artista amb aquest nom. Quin és?</p>`
      + r.homonims.map(a => `<button data-veimb="${esc(a.id)}">${esc(a.nom)} <small>${esc(a.desamb || 'sense més dades')}</small></button>`).join('');
    return;
  }
  v.candidats = r.candidats || [];
  const font = x => x.font === 'Wikipedia' ? 'Segons la Wikipedia' : 'Segons MusicBrainz';
  caixa.innerHTML = (r.avis ? `<p class="subtitol">${esc(r.avis)}</p>` : '')
    + (!v.candidats.length && r.motiu ? `<p class="subtitol">No he trobat res: ${esc(r.motiu)}.</p>` : '')
    + v.candidats.map((x, i) => `<button data-triavei="${i}">${esc(x.titol)} <small>${font(x)} · ${esc([x.tipus, x.any].filter(Boolean).join(' · '))}${x.cronologia ? ` · cronologia «${esc(x.cronologia)}»` : ''}</small></button>`).join('')
    + (!v.candidats.length && !r.avis && !r.motiu ? '<p class="subtitol">Res.</p>' : '')
    + (v.pid ? `<button data-triaproper="${v.pid}">Escriu-lo tu <small>si la cerca no el troba</small></button>` : '');   // ACT-812 (1.3)
}

// ───────── l'Historial (§7.7, v1.34 i ACT-448) ─────────
// Una fila per grup amb tirades (compta les tirades i porta les portades de l'última) i una per disc amb escoltes
// soltes (compta només les soltes). Ordenat per l'última vegada que va sonar, en tres trams, amb cercador.
// La data relativa («ahir», «fa 3 dies») és només per a la pantalla: l'arxiu i l'Excel porten dates concretes.
const DIA = 864e5;
function quan(iso) {
  const d0 = new Date().setHours(0, 0, 0, 0), d = new Date(iso);
  const q = Math.round((d0 - new Date(iso).setHours(0, 0, 0, 0)) / DIA);
  const h = d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  return q <= 0 ? 'avui · ' + h : q === 1 ? 'ahir · ' + h : q < 7 ? 'fa ' + q + ' dies' : d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: q > 300 ? 'numeric' : undefined });
}
const tram = iso => { const q = (Date.now() - Date.parse(iso)) / DIA; return q < 7 ? 'Aquesta setmana' : q < 31 ? 'Aquest mes' : 'Abans'; };
// L'Historial amb finestra (v1.52, ACT-737): es pinten els cent discos més recents, amb «Mostra'n més» al final, que en
// pinta cent més; el cercador busca en tot l'Historial; no s'esborra res. Ricard proposava que els més antics
// desapareguessin per no arrossegar portades; la causa és una altra: les portades es guarden un sol cop al mòbil i les
// comparteixen totes les pantalles, així que retallar no allibera res. El que creixia és el pintat: cada fila llegia la seva
// fitxa sencera (D.fitxa) i es dibuixaven totes. Ara només es llegeix la fitxa de les files que es pinten, i els noms per
// cercar surten d'una sola consulta. Sense camp: és pantalla (decisió de Ricard: «Vale, si mantenemos la app agil igualmente perfecto»).
const FINESTRA_HIST = 100;
function filaHistorial(f) {
  if (f.grup) {
    const m = f.edicions.map(id => D.fitxa(db(), id)).filter(Boolean).sort(perOrdre);
    return { ...f, membres: m, titol: titolGrup(f.grup, m), art: [...new Set(m.map(x => x.art))].join(' · '),
             min: m.every(x => x.min) ? m.reduce((a, x) => a + x.min, 0) : null };
  }
  const d = D.fitxa(db(), f.edicio_id);
  return d ? { ...f, d, titol: d.titol, art: d.art, min: d.min } : null;
}
function nomsPerCercar() {
  const st = db().prepare(`SELECT e.id, a.titol, ar.nom_canonic AS art FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id`);
  const m = new Map(); while (st.step()) { const r = st.getAsObject(); m.set(r.id, r.art + ' ' + r.titol); } st.free();
  return m;
}
function pintaHistorial() {
  const caixa = $('#hist'); if (!caixa) return;
  const totes = E.historial(db());
  const filtre = norm($('#cerca')?.value);
  let vistes = totes;
  if (filtre) {
    const noms = nomsPerCercar(), propis = D.nomsGrups(db());
    const text = f => f.grup ? [f.grup, propis[f.grup] || '', ...f.edicions.map(id => noms.get(id) || '')].join(' ') : noms.get(f.edicio_id) || '';
    vistes = totes.filter(f => norm(text(f)).includes(filtre));
  }
  const max = estat.histMax || FINESTRA_HIST;
  let tr = '', h = '';
  for (const f0 of vistes.slice(0, max)) {
    const f = filaHistorial(f0); if (!f) continue;
    const g = tram(f.darrera); if (g !== tr) { tr = g; h += `<div class="hgrup">${g}</div>`; }
    // Un grup sonat d'una tirada compta com una escolta, igual que un disc (3-11, Ricard): el «tirada» de la fila sobrava.
    // «a mitges» (ACT-578): l'última escolta del disc encara no compta.
    const n = f.n + (f.n === 1 ? ' escolta' : ' escoltes') + (f.mitges ? ' · <span class="mitges">a mitges</span>' : '');
    if (f.grup) {
      const cob = f.membres.find(x => x.portada)?.portada;
      const fons = cob && I.adreca(cob) ? `--img:url('${esc(I.adreca(cob))}')` : '';
      h += `<div class="hfila" style="${fons}">
        <button class="hcap" data-fitxagrup="${esc(f.grup)}" aria-label="Fitxa del grup ${esc(f.titol)}">
          <span class="hcob collage n${Math.min(f.membres.length, 4)}"><span class="trossos">${f.membres.slice(0, 4).map(x => `<span class="tros">${x.portada ? IMG(x.portada) : ''}</span>`).join('')}</span></span>
          <span class="htxt"><span class="htit">${esc(f.titol)}</span><span class="hart">${esc(f.art)}</span>
            <span class="hmeta"><u>${quan(f.darrera)}</u> · ${n}</span></span>
        </button>
        <span class="hdreta">${f.min ? `<span class="hdur">${f.min}′</span>` : ''}</span><button class="hplay" data-hgrup="${esc(f.grup)}" aria-label="Escoltar ${esc(f.titol)}">▶</button>
      </div>`;
      continue;
    }
    const d = f.d, fons = d.portada && I.adreca(d.portada) ? `--img:url('${esc(I.adreca(d.portada))}')` : '';
    h += `<div class="hfila" style="${fons}">
      <button class="hcap" data-fitxa="${d.id}" aria-label="Fitxa de ${esc(d.titol)}">
        <span class="hcob">${esc(inicials(d.art))}${d.portada ? IMG(d.portada) : ''}</span>
        <span class="htxt"><span class="htit">${esc(d.titol)}</span><span class="hart">${esc(d.art)}</span>
          <span class="hmeta"><u>${quan(f.darrera)}</u> · ${n}</span></span>
      </button>
      <span class="hdreta"><span class="hdl">${icoPila(d.id)}${d.min ? `<span class="hdur">${d.min}′</span>` : ''}</span>
        ${d.rotacio_actual ? `<span class="hja">en rotació</span>` : `<button class="hrot" data-hrot="${d.id}">＋ Rotació</button>`}</span>${botoPlay(d, 'hplay')}
    </div>`;
  }
  if (vistes.length > max) h += `<div class="barra-accions hmes"><button class="bt discret" data-histmes="1">Mostra'n més <small>· en queden ${vistes.length - max}</small></button></div>`;
  caixa.innerHTML = h || (totes.length ? `<p class="subtitol" style="margin:18px 0 0">Res amb aquest nom.</p>`
    : `<div class="marcador"><p class="cita">L'Historial encara és buit.</p><p>S'omple amb el que sona${E.arrencada(db()) ? ' des del ' + dia(E.arrencada(db())) : ''}: la màquina només sap el que passa des del dia que arrenca. Un disc hi surt tan bon punt sona; mentre no arriba al 75 %, porta «a mitges».</p></div>`);
  I.omple(caixa);
}
// La fila d'un grup a l'Historial s'obre com la del ▶ d'un grup: els discos de l'última tirada, cadascun amb el seu ▶.
function fullGrupHistorial(nom) {
  const f0 = E.historial(db()).find(x => x.grup === nom), f = f0 && filaHistorial(f0); if (!f) return;
  obreFull(`<h3>${esc(f.titol)}</h3><p>${f.n === 1 ? 'Una escolta' : f.n + ' escoltes'} · l'última, ${esc(quan(f.darrera))}.</p>
    <div class="llista-grup">${f.membres.map((x, i) => {
      const e = x.app_escolta ? enllac(x.app_escolta, { art: x.art, tit: x.titol, bc: x.bc, bce: x.bce }) : null;
      return `<div class="membre">
        <button class="mini" data-fitxa="${x.id}">${x.portada ? IMG(x.portada) : ''}</button>
        <button class="txt" data-fitxa="${x.id}"><b>${i + 1}. ${esc(x.titol)}</b><small>${esc(x.art)}${x.min ? ' · ' + x.min + '′' : ''}${x.rotacio_actual ? ' · en rotació' : ''}</small></button>
        ${e ? `<a class="play" ${aAttrs(e)} data-obre="${x.id}" aria-label="Escoltar ${esc(x.titol)}">▶</a>` : `<button class="play" data-escoltar="${x.id}">▶</button>`}
      </div>`; }).join('')}</div>`);
}

// ───────── La Prestatgeria, primer bloc (ACT-622) ─────────
// Tots els discos: una fila per edició (ACT-637), per artista, amb cercador i sense filtres (ACT-636). La fila obre la
// mateixa fitxa del Faristol (ACT-391). Agrupacions: els grups i les Llistes de reproducció (ACT-632 a ACT-635).
// L'Afinació (v1.49, ACT-671 a ACT-686): una sola llista, sense subpantalles.
const MIN_MS = 60e3;
const minutsDe = ms => Math.round(ms / MIN_MS);
function pintaPrestatgeria() {
  if (!A.estat.db) return;
  if (estat.psub === 'agr') pintaAgrupacions(); else if (estat.psub === 'afi') pintaAfinacio(); else pintaArxiu();
}
// Obra 6 (ACT-774): Tots els discos és una pantalla de rajoles (rajoles.js), amb el cercador a dalt. «Tots» obre la llista
// d'abans; cercar sense rajola triada busca a tot l'arxiu. estat.rajola: la rajola oberta (null, les rajoles).
function filaArxiu(x, clau) {
  const extra = clau === 'escoltes' ? ` · ${escoltesTxt(x.escoltes)}` : '';
  return `<button class="ar-fila" data-fitxa="${x.id}">
      <span class="hcob">${esc(inicials(x.art))}${x.portada ? IMG(x.portada) : ''}</span>
      <span class="htxt"><span class="htit">${esc(x.titol)}</span><span class="hart">${esc(x.art)}${x.n_edicions > 1 && x.nom_edicio ? ' · ' + esc(x.nom_edicio) : ''}${x.n_parts ? ` · <i>${x.n_parts} parts</i>` : ''}${x.rotacio_actual ? ' · <i>en rotació</i>' : ''}${extra}</span></span>
      ${icoPila(x.id)}<span class="m">${x.durada_total}′</span></button>`;
}
function pintaArxiu() {
  const caixa = $('#arxiu'), rj = $('#rajoles'), cap = $('#rajolaCap'); if (!caixa || !rj) return;
  const f = norm($('#cercaArxiu')?.value), clau = estat.rajola || (f ? 'tots' : null);
  if (!clau) {
    const c = R.comptes(db());
    cap.hidden = true; cap.innerHTML = ''; caixa.innerHTML = ''; rj.hidden = false;
    $('#arxiuCompte').textContent = c.tots ? '' : 'L\'arxiu encara és buit.';
    rj.innerHTML = R.RAJOLES.map(r => `<button class="rajola${r.clau === 'tots' ? ' rj-tots' : ''}" data-rajola="${r.clau}"><b>${esc(r.nom)}</b><span class="rj-n">${esc(R.textCompte(r.clau, c))}</span></button>`).join('');
    return;
  }
  rj.hidden = true; rj.innerHTML = '';
  const nom = R.RAJOLES.find(r => r.clau === clau)?.nom || '';
  cap.hidden = !estat.rajola;
  const ordre = R.ordreRajola(clau);   // ACT-800 a, ACT-801: ascendent o descendent, recordat per rajola; A l'atzar, cap
  cap.innerHTML = estat.rajola ? `<button class="torna-rajoles" data-rajoles="1">← Tornar</button><b>${esc(nom)}</b>${ordre ? `<button class="ordre-rj" data-ordre-rj="${clau}" aria-label="Canvia l'ordre">${ordre === 'asc' ? '↑ ascendent' : '↓ descendent'}</button>` : ''}` : '';
  const ss = R.ordena(R.seccions(db(), clau), clau, ordre), tots = ss.reduce((a, s) => a + s.files.length, 0);
  const filtra = ll => f ? ll.filter(x => x.cerca.includes(f)) : ll;
  const fs = ss.map(s => ({ ...s, files: filtra(s.files), ...(s.tambe ? { tambe: filtra(s.tambe) } : {}) }));
  const n = fs.reduce((a, s) => a + s.files.length, 0);
  $('#arxiuCompte').textContent = f ? `${n} de ${tots} discos` : (clau === 'tots' ? `${tots} discos, per artista` : `${tots} ${tots === 1 ? 'disc' : 'discos'}`);
  const titol = s => clau === 'canal' ? nomCanal(s.clau) : clau === 'nota' ? `${s.titol} ★` : s.titol;
  // Per Gènere (ACT-801): «Ambient 120 · +35», els de rama principal i, després de «També», els de rama secundària.
  const compte = s => clau === 'durada' ? ' · ' + s.files.length : s.tambe ? ` ${s.files.length}${s.tambe.length ? ' · +' + s.tambe.length : ''}` : '';
  caixa.innerHTML = fs.filter(s => s.files.length || s.tambe?.length || (clau === 'durada' && !f)).map(s => (s.titol ? `<h2 class="ag-cap rj-cap"${clau === 'canal' ? ` data-canal="${esc(s.clau)}"` : ''}>${esc(titol(s))}${compte(s)}</h2>` : '')
      + s.files.map(x => filaArxiu(x, clau)).join('')
      + (s.tambe?.length ? `<p class="rj-tambe">També</p>` + s.tambe.map(x => filaArxiu(x, clau)).join('') : '')).join('')
    || `<p class="subtitol" style="margin:14px 0 0">${f ? 'Res amb aquest nom.' : (clau === 'dia' ? 'Cap escolta d\'aquest dia en anys anteriors.' : 'Encara cap disc aquí.')}</p>`;
  I.omple(caixa);
}
// ───────── Les Piles de Discos per escoltar (ACT-706, ACT-710 a ACT-714, ACT-720, ACT-744) ─────────
// La Pila és només la llista, sense portades (ACT-712), la més recent a dalt i sense «fa X dies» (ACT-713); no es distingeix
// una casada d'una de text (ACT-714 g). Cada fila obre, i el ▶ va a part a la dreta (ACT-714 e, ACT-720). La darrera Pila
// triada és estat de pantalla (ACT-706): tria-pila, al navegador, i no va a l'arxiu.
const PILA = 'tria-pila';
// ACT-773: la icona de Pila a la cantonada de la portada, quan l'àlbum té una entrada casada sense data_sortida. Es calcula un
// cop per pintada (estat.enPiles) i es fa servir a Discos en rotació, a l'Historial i a La Prestatgeria.
const icoPila = (edId, ple = false) => { const l = estat.enPiles?.get(edId); if (!l) return '';
  // ACT-836 (a): a Discos en Rotació, un cercle ple del color de la Pila, com la tecla play, amb el dibuix negre o blanc per luminància.
  const fig = x => { const c = estat.colorsPila?.get(x.pila_id);
    return ple && c ? `<i class="ple" title="${esc(x.nom)}" style="background:${c};color:${P.tintaSobre(c)}">${P.figura(x.nom)}</i>` : `<i title="${esc(x.nom)}">${P.figura(x.nom, c)}</i>`; };
  return `<span class="ico-pila${ple ? ' plena' : ''}" data-icopila="${esc(l.map(x => x.nom).join(' · '))}">${l.map(fig).join('')}</span>`; };
const edDe = id => D.edicio(db(), +id) || D.fitxa(db(), +id);
const darreraPila = ps => { let v = null; try { v = +localStorage.getItem(PILA); } catch {} return ps.find(p => p.id === v) || ps[0] || null; };
function fullNovaPila(repinta = false) {
  const nom = repinta ? $('#inNovaPila')?.value || '' : '';
  if (!repinta) estat.novaPilaCtx = new Set();
  const cx = estat.novaPilaCtx, col = P.COLORS_PILA[P.piles(db()).length % P.COLORS_PILA.length];
  obreFull(`<h3>Una Pila nova</h3><p>Els seus discos en surten quan sonen en el context que triïs. Pren el color següent: <span class="punt-color" style="background:${col}"></span></p>
    <label class="camp"><span>Nom</span><input id="inNovaPila" type="text" autocomplete="off" value="${esc(nom)}" placeholder="p. ex. Platja"></label>
    <div class="camp"><span>Context</span></div>
    <div class="sf-chips">${E.CONTEXTOS.map(c => `<button class="${cx.has(c) ? 'principal' : ''}" data-ctxnovapila="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="barra-accions" style="position:static;padding:10px 0 0"><button class="bt principal" data-desanovapila="1">Crea-la</button></div>`);
}
function pintaPiles() {
  const caixa = $('#piles'); if (!caixa) return;
  const ps = P.piles(db()), p = darreraPila(ps);
  if (!p) { caixa.innerHTML = ''; return; }
  const ents = P.entrades(db(), p.id), ja = P.jaEscoltats(db(), p.id);
  caixa.innerHTML = `<div class="apar-tabs pila-tabs" role="tablist">${ps.map(x => `<button role="tab" data-pila="${x.id}" aria-selected="${x.id === p.id}">${esc(x.nom)}</button>`).join('')}</div>
    <div class="pila-gestio"><button class="afegeix" data-afegeixpila="${p.id}">＋ Afegeix</button><button class="mes" data-novapila="1">＋ Pila</button><button class="mes discret" data-treupila="${p.id}">Treu la Pila</button></div>
    <div class="llista-grup pila-llista">${ents.map(filaPila).join('') || '<p class="subtitol" style="margin:14px 0 0">La Pila és buida.</p>'}</div>
    ${ja.length ? `<button class="ar-fila pila-ja" data-jaescoltats="${p.id}"><span class="htxt"><span class="htit">Ja escoltats</span></span><span class="m">${ja.length}</span></button>` : ''}`;
  I.omple(caixa);   // ACT-814 (4.2): les portades de les entrades
}
// ACT-814 (4.2): la portada de les entrades casades; les de text, un quadre amb les inicials de l'àlbum (encara no és a l'arxiu).
const cobPila = x => { const d = x.album_id && x.edicio_id ? D.fitxa(db(), x.edicio_id) : null;
  return d?.portada ? `<span class="cob-pila">${IMG(d.portada)}</span>` : `<span class="cob-pila text" title="${x.album_id ? '' : 'encara no és a l\'arxiu'}">${esc(inicials(x.titol) || '?')}</span>`; };
const filaPila = x => `<div class="membre pila-fila" data-entrada="${x.id}">${cobPila(x)}
    <button class="txt" data-tocaentrada="${x.id}"><b>${esc(x.titol)}</b><small>${esc(x.artista)}</small></button>${playEntrada(x)}</div>`;
// El ▶ (ACT-714 e): casada amb una edició, la llança; amb diverses, obre les edicions; de text, cerca al canal de l'artista
// (D.canalPerDefecte, com el ▶ del proper disc) i, sense artista a l'arxiu, a Amazon (ACT-712).
function playEntrada(x) {
  if (x.album_id && x.n_edicions === 1) { const d = D.fitxa(db(), x.edicio_id); if (d) return botoPlay(d, 'play'); }
  if (x.album_id && x.n_edicions > 1) return `<button class="play" data-edicionspila="${x.id}" aria-label="Edicions de ${esc(x.titol)}">▶</button>`;
  const a = D.trobaArtista(db(), x.artista), e = enllac(D.canalPerDefecte(db(), a?.id), { art: x.artista, tit: x.titol });
  return `<a class="play" ${aAttrs(e)} aria-label="Escoltar ${esc(x.titol)}">▶</a>`;
}
// Tocar la fila (ACT-712, ACT-714 d): casada amb una edició, la seva fitxa; amb diverses, les edicions; de text, la fulla.
function tocaEntrada(id) {
  const x = P.entrades(db(), P.entrada(db(), id)?.pila_id).find(e => e.id === id); if (!x) return;
  if (x.album_id && x.n_edicions === 1) { const d = edDe(x.edicio_id); if (d) fullFitxa(d); return; }
  if (x.album_id && x.n_edicions > 1) { fullEdicionsPila(x); return; }
  fullEntradaText(x);
}
function fullEdicionsPila(x) {
  const eds = (db().exec('SELECT id FROM edicio WHERE album_id = ? ORDER BY id', [x.album_id])[0]?.values || []).map(v => D.fitxa(db(), v[0])).filter(Boolean);
  obreFull(`<h3>${esc(x.titol)}</h3><p>${esc(x.artista)} · ${eds.length} edicions a l'arxiu. Tria la que et vagi millor.</p>
    <div class="llista-grup pila-edicions">${eds.map(d => `<div class="membre">
        <button class="mini" data-fitxa="${d.id}">${d.portada ? IMG(d.portada) : ''}</button>
        <button class="txt" data-fitxa="${d.id}"><b>${esc(d.nom_edicio || 'sense nom')}</b><small>${d.min ? d.min + '′' : 'falta la durada'}</small></button>
        ${botoPlay(d, 'play')}</div>`).join('')}</div>`);
}
// Una entrada de text (ACT-712 (2), ACT-714 f): els altres canals, sense recordar quin es tria, i «Treu de la Pila».
function fullEntradaText(x) {
  const canals = Object.keys(CANALS).filter(k => !CANALS[k].propi && k !== 'aimp');
  obreFull(`<h3>${esc(x.titol)}</h3><p>${esc(x.artista)}</p>
    <div class="barra-accions" style="position:static;padding:0 0 10px">${canals.map(k => `<a class="bt" ${aAttrs(enllac(k, { art: x.artista, tit: x.titol }))}>${esc(CANALS[k].nom)}</a>`).join('')}</div>
    <div class="barra-accions" style="position:static;padding:0 0 10px"><button class="bt" data-treuentrada="${x.id}">Treu de la Pila</button></div>`);
}
function fullAfegeixPila(pilaId) {
  const p = P.piles(db()).find(x => x.id === pilaId); if (!p) return;
  obreFull(`<h3>Afegeix a ${esc(p.nom)}</h3>
    <input class="cerca" id="pilaArt" placeholder="Artista" autocomplete="off">
    <input class="cerca" id="pilaTit" placeholder="Títol" autocomplete="off">
    <div class="llista-grup" id="pilaSug"></div>
    <div class="barra-accions" style="position:static;padding:8px 0 10px"><button class="bt principal" data-afegeixtext="${p.id}">Afegeix</button></div>`);
  const sug = () => { const s = P.suggeriments(db(), $('#pilaArt').value, $('#pilaTit').value);
    $('#pilaSug').innerHTML = s.map(a => `<div class="membre"><button class="txt" data-afegeixalbum="${p.id}:${a.id}"><b>${esc(a.titol)}</b><small>${esc(a.art)}</small></button></div>`).join(''); };
  $('#pilaArt').addEventListener('input', sug); $('#pilaTit').addEventListener('input', sug);
}
function fullJaEscoltats(pilaId) {
  const ja = P.jaEscoltats(db(), pilaId);
  obreFull(`<h3>Ja escoltats</h3><p>La sortida més recent primer. «Torna a la Pila» la torna a dalt de tot.</p>
    <div class="llista-grup">${ja.map(x => `<div class="membre"><span class="txt"><b>${esc(x.titol)}</b><small>${esc(x.artista)}</small></span>
      <button class="treu" data-tornapila="${x.id}">Torna a la Pila</button></div>`).join('')}</div>`);
}
// A la fitxa (ACT-710, ACT-744): «A la Pila Gimnàs · Treu» per cada Pila on és l'àlbum, i «Afegeix a una Pila».
function pilesFitxa(d) {
  const ps = P.pilesDeLAlbum(db(), d.album_id);
  return `<div class="fitxa-piles">${ps.map(x => `<span class="a-pila">A la Pila ${esc(x.nom)} · <button class="sf-link" data-treuentrada="${x.id}" data-fitxaed="${d.id}">Treu</button></span>`).join(' ')}
    <button class="bt" data-afegeixapila="${d.id}">Afegeix a una Pila</button></div>`;
}
function fullTriaPila(edId) {
  const d = edDe(edId); if (!d) return;
  const ja = new Set(P.pilesDeLAlbum(db(), d.album_id).map(x => x.pila_id)), ps = P.piles(db()).filter(p => !ja.has(p.id));
  obreFull(`<h3>Afegeix a una Pila</h3><p>${esc(d.titol)} · ${esc(d.art)}</p>
    <div class="barra-accions" style="position:static;padding:0 0 10px">${ps.map(p => `<button class="bt" data-posaapila="${p.id}:${d.id}">${esc(p.nom)}</button>`).join('') || 'Ja és a totes les Piles.'}</div>`);
}

// L'Afinació (ACT-683, ACT-686): una fila per edició, que obre la seva fitxa. A dalt les marcades «Per afinar», de la més
// recent a la més antiga, amb «marcat fa X»; a sota les que no tenen gènere o els falten els eixos de la clàssica, per
// escoltes que compten. Cada fila diu el seu motiu.
function pintaAfinacio() {
  const caixa = $('#afinacio'); if (!caixa) return;
  const { marcats, resta } = F.llistaAfinacio(db()), n = marcats.length + resta.length;
  $('#afiCompte').textContent = n ? `${n} discos · ${marcats.length} per afinar` : '';
  const fila = x => `<button class="ar-fila afi-fila" data-fitxa="${x.id}">
      <span class="hcob">${esc(inicials(x.art))}${x.portada ? IMG(x.portada) : ''}</span>
      <span class="htxt"><span class="htit">${esc(x.titol)}</span><span class="hart">${esc(x.art)}${x.n_edicions > 1 && x.nom_edicio ? ' · ' + esc(x.nom_edicio) : ''}</span>
        <span class="hmeta afi-motiu">${x.motius.map(m => m === 'per afinar' ? `per afinar · marcat ${esc(fa(x.per_afinar))}` : esc(m)).join(' · ')}${x.per_afinar ? '' : ' · ' + escoltesTxt(x.escoltes)}</span></span>
      <span class="m">${x.durada_total}′</span></button>`;
  caixa.innerHTML = n ? marcats.map(fila).join('') + resta.map(fila).join('')
    : '<p class="subtitol" style="margin:14px 0 0">Res per afinar: tots els discos tenen gènere, i cap no és marcat.</p>';
  I.omple(caixa);
}
// Sense cap portada encara, les inicials del nom, com les files de l'Historial.
const mosaic = (refs, nom = '') => refs.length
  ? `<span class="hcob collage n${Math.min(refs.length, 4)}"><span class="trossos">${refs.slice(0, 4).map(r => `<span class="tros">${IMG(r)}</span>`).join('')}</span></span>`
  : `<span class="hcob collage buit">${esc(inicials(nom))}</span>`;
const textDurLlista = l => l.durada_ms ? minutsDe(l.durada_ms) + '′' + (l.incompleta ? '+' : '') : (l.n ? '—' : '0′');
function pintaAgrupacions() {
  const caixa = $('#agrupacions'); if (!caixa) return;
  const gs = D.grupsArxiu(db()), ls = L.llistes(db());
  const filaGrup = g => {
    const m = g.membres, total = m.every(x => x.min) ? m.reduce((a, x) => a + x.min, 0) : null;
    return `<button class="ar-fila ag-fila" data-grup="${esc(g.nom)}">${mosaic(m.map(x => x.portada).filter(Boolean), titolGrup(g.nom, m))}
      <span class="htxt"><span class="htit">${esc(titolGrup(g.nom, m))}</span><span class="hart">${esc([...new Set(m.map(x => x.art))].join(' · '))}</span>
        <span class="hmeta">${m.length} discos${m.some(x => x.rotacio_actual) ? ' · ' + m.filter(x => x.rotacio_actual).length + ' en rotació' : ''}</span></span>
      <span class="m">${total ? total + '′' : ''}</span></button>`;
  };
  const filaLlista = l => `<button class="ar-fila ag-fila" data-llista="${l.id}">${mosaic(l.portades, l.nom)}
      <span class="htxt"><span class="htit">${esc(l.nom)}</span><span class="hart">${l.n === 1 ? 'una cançó' : l.n + ' cançons'}</span>
        <span class="hmeta">${l.darrera ? 'l\'última, ' + esc(quan(l.darrera)) : 'encara no ha sonat'}</span></span>
      <span class="m">${textDurLlista(l)}</span></button>`;
  // Obra IV (b): dues subpantalles, com L'Aparador, perquè les llistes no quedin enterrades sota els grups. La darrera
  // triada es recorda al mòbil (obra4.js).
  const v = O4.agSub();
  caixa.innerHTML = `<div class="apar-tabs ag-tabs" role="tablist">${O4.SUBS_AGR.map(([k, n]) =>
      `<button id="agtab-${k}" role="tab" aria-selected="${v === k}" data-agsub="${k}">${n}</button>`).join('')}</div>
    <div class="apanell ${v === 'disc' ? 'activa' : ''}" id="ag-disc">${gs.map(filaGrup).join('') || '<p class="subtitol">Encara no hi ha cap grup. Es fa des de la fitxa d\'un disc: «agrupa\'l amb…».</p>'}</div>
    <div class="apanell ${v === 'll' ? 'activa' : ''}" id="ag-ll">${ls.map(filaLlista).join('') || '<p class="subtitol">Encara no hi ha cap llista. Es fa des de la safata, amb les cançons soltes d\'una sessió: «Això és una llista».</p>'}
    ${ls.some(l => l.incompleta) ? '<p class="subtitol" style="font-size:12px;margin:10px 0 0">Una durada amb «+» és incompleta: alguna cançó va arribar sense durada.</p>' : ''}</div>`;
  I.omple(caixa);
}
// La fitxa d'una llista (ACT-635): les cançons en ordre, canviar-li el nom, treure'n una i esborrar-la. Sense ▶: viu fora.
function fullLlista(id) {
  const l = L.llista(db(), id); if (!l) { tancaFull(); return; }
  estat.llistaOberta = id;
  const cs = L.cancons(db(), id);
  obreFull(`${l.portades.length ? `<div class="fitxa-portada mosaic-llista">${mosaic(l.portades, l.nom)}</div>` : ''}<h3>${esc(l.nom)}</h3>
    <p>${l.n === 1 ? 'Una cançó' : l.n + ' cançons'} · ${textDurLlista(l)}${l.incompleta ? ' (alguna sense durada)' : ''} · ${l.darrera ? 'l\'última vegada, ' + esc(quan(l.darrera)) : 'encara no ha sonat'}</p>
    <p class="gris" style="font-size:12px;margin-top:-6px">La llista viu a Amazon o a YouTube: aquí la màquina només la reconeix quan sona.</p>
    <div class="barra-accions" style="position:static;padding:0 0 10px"><button class="bt" data-nomllista="${id}">Canvia-li el nom</button></div>
    <div class="llista-cancons">${cs.map(c => `<div class="canco"><span class="n">${c.posicio}</span>
        <span class="txt"><b>${esc(c.pista || '(sense títol)')}</b><small>${esc(c.artista || '')}${c.durada_ms ? ' · ' + minutsDe(c.durada_ms) + '′' : ''}</small></span>
        <button class="treu" data-treucanco="${c.id}" aria-label="Treu ${esc(c.pista || '')} de la llista">treu-la</button></div>`).join('')}</div>
    <div class="barra-accions" style="position:static;padding:14px 0 0"><button class="bt discret" data-esborrallista="${id}">Esborra la llista</button></div>`, true);
}
function fullNomLlista(id) {
  const l = L.llista(db(), id); if (!l) return;
  obreFull(`<h3>El nom de la llista</h3><p>Ara es diu <b>${esc(l.nom)}</b>.</p>
    <label class="camp"><span>Nom</span><input id="inNomLlista" type="text" autocomplete="off" value="${esc(l.nom)}"></label>
    <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-desanomllista="${id}">Desa'l</button></div>`);
  setTimeout(() => $('#inNomLlista')?.select(), 30);
}
const PSUBS = ['tots', 'agr', 'afi'];
function psub(v) {
  const de = PSUBS.indexOf(estat.psub || 'tots'), a = PSUBS.indexOf(v), p = $('#q-' + v);
  p.classList.remove('entra-dreta', 'entra-esquerra');
  if (a !== de) { void p.offsetWidth; p.classList.add(a > de ? 'entra-dreta' : 'entra-esquerra'); window.scrollTo(0, 0); }
  estat.psub = v;
  PSUBS.forEach(k => { $('#ptab-' + k).setAttribute('aria-selected', v === k); $('#q-' + k).classList.toggle('activa', v === k); });
  pintaPrestatgeria();
}

// ───────── les llistes a la safata (ACT-632 a ACT-634) ─────────
// Les pistes de les cançons soltes d'una targeta: les dels discos sense edició que la màquina no fa néixer com a disc.
function pistesSoltes(c, solta) {
  return c.discos.filter(d => !d.edicio_id && solta.has(clauDisc(d))).flatMap(d => d.scr.map(x => x.id));
}
// El bloc de la targeta: les llistes que la sessió ja té, en una línia cadascuna, i per a la resta, la llista reconeguda
// (un toc) o «Això és una llista» (només el nom). On: a la targeta i al «Canvia» d'una resolta.
function blocLlista(c, solta) {
  const ps = pistesSoltes(c, solta); if (!ps.length) return '';
  const s = L.deLaSessio(db(), ps), clau = c.clau;
  let h = s.ja.map(l => `<p class="sf-llista">Llista · <b>${esc(l.nom)}</b> · ${l.n === 1 ? 'una cançó' : l.n + ' cançons'} d'aquesta sessió
      <button class="sf-link" style="padding:0 0 0 6px" data-llista="${l.id}">obre-la</button></p>`).join('');
  if (!s.resta.length) return h;
  const n = new Set(s.resta.map(x => x.recording_msid)).size;
  if (estat.nomLlistaDe === clau) return h + `<div class="sf-nova-llista"><label class="camp"><span>Nom de la llista</span>
      <input id="inLlista" type="text" autocomplete="off" placeholder="p. ex. AA Händel" value="${esc(estat.nomLlistaTxt || '')}"></label>
      <div class="sf-chips sug-llista" id="sugLlista">${chipsSugLlista()}</div>
      <div class="sf-chips"><button class="principal" data-sfllistanova="${clau}">Desa-la</button><button class="mes" data-sfllistaobre="">Deixa-ho</button></div></div>`;
  const p = s.proposta;
  const altra = `<button class="${p ? 'mes' : ''}" data-sfllistaobre="${clau}">${p ? 'No: és una altra llista' : 'Això és una llista'}</button>`;
  return h + `<div class="sf-chips sf-llistes">${p ? `<button class="principal" data-sfllistasi="${clau}|${p.id}">${p.continua ? 'Afegeix-les a ' + esc(p.nom) : 'Sí, és ' + esc(p.nom)}${p.noves ? ` · s'hi ${p.noves === 1 ? 'afegeix una cançó' : 'afegeixen ' + p.noves + ' cançons'}` : ''}</button>` : ''}${altra}</div>
    ${p || n < 2 ? '' : `<p class="sf-pre" style="margin-top:4px">${n} cançons soltes en aquesta sessió.</p>`}`;
}
// Obra IV (a): les llistes que ja hi ha (llista.nom) que contenen el que s'escriu; un toc posa el nom. Només es repinta
// aquesta tira, no la safata, per no perdre el focus a cada tecla.
const chipsSugLlista = () => O4.suggerimentsLlista(L.llistes(db()), estat.nomLlistaTxt || '')
  .map(n => `<button class="mes" data-sugllista="${esc(n)}">${esc(n)}</button>`).join('');
function pintaSugLlista() { const c = $('#sugLlista'); if (c) c.innerHTML = chipsSugLlista(); }
// Les targetes d'una clau (ACT-738): la que comença amb aquesta pista i les que la segueixen, no tota la història.
const tgDe = clau => E.targetesDes(db(), +String(clau).replace(/^[td]/, '').split(':')[0]);
const targetaDe = clau => tgDe(clau).find(x => x.clau === +clau);
const restaDe = c => L.deLaSessio(db(), pistesSoltes(c, solteSet())).resta.map(x => x.id);
// Després de tocar una llista: la safata es torna a pintar sola (fes → pinta); el «Canvia» d'una resolta, es torna a obrir.
function refrescaLlista() { if (estat.resoltaOberta && $('#full').classList.contains('obert')) obreResolta(estat.resoltaOberta); else pintaSafata(); }
const solteSet = () => new Set(E.discosNous(db(), mbCache).soltes.map(x => x.clau));

// El «Canvia» d'una sessió resolta. Des de la v7, també hi viu la llista de les seves cançons soltes (ACT-632).
function obreResolta(clau) {
  const c = targetaDe(clau); if (!c) { tancaFull(); return; }
  const ll = blocLlista(c, solteSet());
  obreFull(`<h3>${esc(franja(c))}</h3><p>${ctxPerDisc(c)}</p><div class="canals">
      <button data-sfreobre="${c.scr.map(x => x.id).join(',')}">On ho escoltaves${c.discos.length > 1 ? ', tota la sessió' : ''} <small>torna la targeta a la safata</small></button>
      ${c.discos.length > 1 ? c.discos.map(x => `<button data-sfreobre="${x.scr.map(s => s.id).join(',')}">On escoltaves ${esc(x.titol)} <small>ara: ${esc(ctxDisc(x))} · només aquest disc torna a la safata</small></button>`).join('') : ''}
      ${c.discos.filter(x => x.edicio_id).map(x => `<button data-canviaedicio="${x.edicio_id}">L'edició de ${esc(x.titol)} <small>la mateixa operació que a la fitxa</small></button>`).join('')}
      ${c.discos.filter(x => x.edicio_id).map(x => `<button data-sfcanaldisc="${x.edicio_id}">El canal de ${esc(x.titol)} <small>ara: ${esc(nomCanal(x.app_escolta))}</small></button>`).join('')}
    </div>${ll ? `<h3 style="margin-top:18px">Les cançons soltes</h3>${ll}` : ''}`);
  estat.resoltaOberta = clau;
  I.omple($('#full'));
}

// ───────── la safata (§8.7) ─────────
// Una sola cua: la pregunta 2, els discos nous, les preguntes 7, 8 i 9, i les targetes de sessió. A sota, les resoltes,
// cadascuna amb «Canvia». La màquina no interromp: el número del icona fa la feina (v1.34).
const nomCompte = c => c.length > 1 ? 'els dos mòbils' : (E.COMPTES.find(k => k.nom === c[0])?.feina ? 'compte de feina' : 'compte personal');
const hm = iso => new Date(iso).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
const franja = c => quan(c.inici).replace(/ · .*/, '') + ' · ' + hm(c.inici) + ' – ' + hm(c.fi);
const mbCache = (() => { try { return new Map(Object.entries(JSON.parse(localStorage.getItem('tria-mb') || '{}'))); } catch { return new Map(); } })();
function minDisc(d, extra = '') {
  return `<span class="sf-disc"><span class="hcob">${esc(inicials(d.art))}${d.portada ? IMG(d.portada) : ''}</span>
    <span><span class="t">${esc(d.titol || '')}</span><span class="a">${esc(d.art || '')}${d.partNom ? ' · ' + esc(d.partNom) : ''}${extra}</span></span><span class="m">${d.min || d.durada_total ? (d.min || d.durada_total) + '′' : ''}</span></span>`;
}
// La durada sospitosa (ACT-696): una escolta ha sonat més del que diu la fitxa. Es resol igual a la safata i a la fitxa
// (on porta L'Afinació): «Posa X′» escriu Edició.Durada total i torna a calcular; «La durada és bona» guarda els minuts.
function avisDurada(id, q, estil = '') {
  return `<div class="sf-durada"${estil}><p class="sf-pre">Ha sonat més del que diu la fitxa: <b>${q.proposta}′ sonats</b>, la fitxa en diu ${q.durada}′.</p>
    <div class="sf-chips"><button class="principal" data-posadurada="${id}:${q.proposta}">Posa ${q.proposta}′</button>
      <button data-durabona="${id}">La durada és bona</button></div></div>`;
}
// Les targetes que la safata necessita (ACT-738), sense tallar tota la història a cada toc: de la primera pista per
// contestar endavant (amb la sessió que sona), les que porten un disc per identificar (la pregunta 2 o un disc nou), encara
// que siguin de fa mesos, i a sota les vuit resoltes més recents: per a aquestes, la finestra s'allarga fins que n'hi ha
// vuit o s'arriba al principi. Mateix resultat que abans, que les tallava totes.
const RESOLTES = 8;
function targetesSafata(q2, nous) {
  const pendent = E.primeraPendent(db()), hores = [...q2, ...nous].flatMap(x => x.hores);
  for (let dies = 3; ; dies *= 4) {
    const recents = new Date(Date.now() - dies * 864e5).toISOString();
    const desDe = [pendent, recents].filter(Boolean).sort()[0];
    const tg = E.targetes(db(), { estat: 'totes', desDe, hores: hores.filter(h => h < desDe) });
    const claus = new Set([...q2.map(q => q.clau), ...nous.map(x => x.clau)]);
    // Les que no són per contestar ni per identificar: les resoltes i, en un mòbil que encara no ha llegit mai ListenBrainz,
    // les que es donen per obertes (abans, en aquest cas, sortia tota la història com a «Sonant ara»).
    const lliures = tg.filter(c => c.estat !== 'pendent' && !c.discos.some(d => claus.has(clauDisc(d)))).length;
    if (lliures >= RESOLTES || !E.hiHaAbans(db(), desDe)) return tg;
  }
}
function cuaSafata() {
  if (!A.estat.db) return { q2: [], nous: [], soltes: [], rot: [], tg: [] };
  const { nous, soltes } = E.discosNous(db(), mbCache), q2 = E.preguntes2(db());
  return { q2, nous, soltes, rot: E.preguntesRotacio(db()), tg: targetesSafata(q2, nous) };
}
function xipsContext(clau, c, cap) {
  const tmp = estat.ctxTmp?.[clau];
  if (tmp) return `<p class="sf-q">${tmp === 'No ho sé' ? 'I com ho escoltaves?' : 'A casa: com ho escoltaves?'}</p>
    <div class="sf-chips">${E.ATENCIONS.map(([b]) => `<button data-sfatencio="${clau}|${b}">${b}</button>`).join('')}</div>
    <button class="sf-link" data-sfctxdesfes="${clau}">Canvia el lloc</button>`;
  const tots = estat.ctxTots?.[clau], llista = tots ? E.CONTEXTOS : E.habituals(db());
  const pre = c.feina ? 'Treballant' : null;
  const ll = pre && !llista.includes(pre) ? [pre, ...llista] : llista;
  return `${pre ? `<p class="sf-pre">${c.comptes.length > 1 ? 'Hi ha pistes' : 'Ve'} del compte de feina: la màquina proposa <b>Treballant</b>.</p>` : ''}
    <p class="sf-q">${cap || 'On ho escoltaves?'}</p>
    <div class="sf-chips">${ll.map(x => `<button class="${x === pre ? 'principal' : ''}" data-sfctx="${clau}|${esc(x)}">${esc(x)}</button>`).join('')}
      <button class="nose" data-sfctx="${clau}|No ho sé">No ho sé</button>
      ${tots ? '' : `<button class="mes" data-sftots="${clau}">Veure'ls tots</button>`}
      <button class="mes" data-sfignora="${clau}">Ignora</button>
      <button class="mes" data-sfignorasempre="${clau}">Ignora sempre…</button></div>`;
}
// Els artistes de les pistes d'una targeta o d'un disc, sense repetir, tal com arriben (ACT-524).
function artistesDe(clau) {
  const tg = tgDe(clau), ids = new Set(idsDe(clau, tg));
  const out = [];
  for (const c of tg) for (const s of c.scr) if (ids.has(s.id) && s.artista && !out.some(a => norm(a) === norm(s.artista))) out.push(s.artista);
  return out;
}
function ignoraSempreArt(nom) {
  fes(E.afegeixIgnoraSempre(nom), r => `«${nom}» s'ignorarà sempre${r.n ? ' (' + (r.n === 1 ? 'una pista' : r.n + ' pistes') + ' ja fora)' : ''}. La llista és a La Cabina.`);
}
// Les claus de resposta: «t<primera pista>» per a la targeta sencera, «d<primera pista>:<disc>» per a un disc separat.
// La targeta sencera només toca les pistes encara per contestar: un disc ja contestat sol no es trepitja (ACT-528).
function idsDe(clau, tg) {
  const [t, d] = clau.slice(1).split(':');
  const c = tg.find(x => String(x.clau) === t); if (!c) return [];
  return (d ? c.discos.find(x => x.clau === d)?.scr || [] : c.scr.filter(s => s.estat === 'pendent')).map(s => s.id);
}
const deQui = clau => clau[0] === 'd' ? 'disc' : 'targeta';
// La pregunta 2 i el disc nou, com a bloc: dins de la targeta de la seva escolta (1-11) o, si no en té, en una targeta pròpia.
function blocQ2(q) {
  const [prop, ...altres] = q.candidates;
  const nomEd = c => esc(c.titol) + (c.nom_edicio ? ` <small>${esc(c.nom_edicio)}</small>` : '') + ` <small>${c.durada_total}′ · ${esc(c.art)}</small>`;
  return `<p class="sf-q">És aquesta edició?</p>
    <div class="sf-chips sf-eds">
      <button class="principal" data-q2si="${esc(q.clau)}|${prop.id}">Sí: ${nomEd(prop)}</button>
      ${estat.q2obert === q.clau ? altres.map(c => `<button data-q2si="${esc(q.clau)}|${c.id}">${nomEd(c)}</button>`).join('') : (altres.length ? `<button data-q2altres="${esc(q.clau)}">Una altra…</button>` : '')}
      <button class="nose" data-q2no="${esc(q.clau)}">No és cap d'aquestes</button>
    </div>`;
}
// ACT-787 (a): les pistes d'una caixa per actes que no diuen l'acte, cadascuna amb un botó per part (actespregunta.js).
function blocActes(d) {
  const ps = d.edicio_id ? AP.pistesSenseActe(db(), d.edicio_id, d.scr) : [];
  if (!ps.length) return '';
  const parts = AP.partsPerActes(db(), d.edicio_id);
  return `<div class="sf-actes" style="padding-left:54px"><p class="sf-pre">${ps.length === 1 ? 'Aquesta pista no diu' : 'Aquestes pistes no diuen'} de quin acte és:</p>
    ${ps.map(({ s, n }) => `<div data-sfactepista="${esc(s.recording_msid)}"><p class="sf-pre"><i>${esc(s.pista || '')}</i></p>
      <div class="sf-chips">${parts.map(p => `<button class="${n === p.numero ? 'triat' : ''}" data-sfacte="${s.id}|${p.numero}">${esc(p.nom)}</button>`).join('')}</div></div>`).join('')}</div>`;
}
// ACT-787 (b): els actes escrits a mà d'un disc nou que MusicBrainz no dona amb pistes.
function blocActesMa(x) {
  if (x.proposta.parts || x.proposta.font !== 'el que ha sonat') return '';
  const a = estat.actesMaDe?.[x.clau];
  if (!a) return `<button class="sf-link" data-sfoperaactes="${esc(x.clau)}">És una òpera per actes</button>`;
  const n = parseInt(a.n, 10) || 0;
  return `<p class="sf-q">Una òpera per actes <button class="sf-link" data-sfoperaactes="${esc(x.clau)}">No ho és</button></p>
    <label class="camp"><span>Quants actes?</span><input data-sfnactes="${esc(x.clau)}" type="number" inputmode="numeric" min="2" max="9" value="${n || ''}"></label>
    ${Array.from({ length: n >= 2 && n <= 9 ? n : 0 }, (_, i) => `<label class="camp"><span>Acte ${i + 1}, en minuts</span>
      <input data-sfactemin="${esc(x.clau)}|${i + 1}" type="number" inputmode="numeric" min="1" value="${esc(a.min?.[i + 1] ?? '')}"></label>`).join('')}
    ${n >= 2 ? `<p class="sf-pre">La durada del disc serà la suma dels actes.</p>` : ''}`;
}
function blocNou(x) {
  const a = D.trobaArtista(db(), x.artista);
  const canal = estat.nouCanalDe?.[x.clau] || D.canalPerDefecte(db(), a?.id);
  const pref = estat.nouPrefDe?.[x.clau], pr = PR.properDelDisc(db(), x.artista, x.album || x.pista);
  return `<div data-nou="${esc(x.clau)}"><p class="sf-q">Disc nou: la durada i el canal</p>
    ${pr ? `<p class="sf-pre es-proper"><b>És el proper de ${esc(pr.nom)}.</b> Posa'l en rotació i la nota s'esborra.</p>` : ''}
    <label class="camp"><span>Durada en minuts <small class="gris">· ${x.proposta.font}</small></span>
      <input data-sfdur="${esc(x.clau)}" type="number" inputmode="numeric" min="1" value="${esc(estat.nouMinDe?.[x.clau] ?? x.proposta.minuts)}"></label>
    ${x.proposta.font === 'el que ha sonat' ? `<p class="sf-pre">Només és la del disc si l'has sentit sencer.</p>` : ''}
    ${x.proposta.parts && estat.sensePartsDe?.[x.clau] ? `<p class="sf-pre" data-sfparts="${esc(x.clau)}">Entrarà sense parts. <button class="sf-link" data-sfambparts="${esc(x.clau)}">Torna a les parts</button></p>`
      : x.proposta.parts ? `<p class="sf-q" data-sfparts="${esc(x.clau)}">Una caixa de ${x.proposta.parts.length} parts, una per acte <small class="gris">· segons MusicBrainz</small></p>
      <p class="sf-pre">${x.proposta.parts.map(p => `${esc(p.nom)} · ${p.durada}′`).join('<br>')}</p>
      <div class="sf-chips"><button class="mes" data-sfsenseparts="${esc(x.clau)}">Sense parts</button></div>` : ''}
    ${blocActesMa(x)}
    <p class="sf-q">Per on l'escoltes?</p>
    <div class="sf-chips">${Object.keys(CANALS).map(k => `<button class="${canal === k ? 'triat' : ''}" data-sfcanal="${esc(x.clau)}|${esc(k)}">${esc(CANALS[k].nom)}</button>`).join('')}
      ${altreCanal(estat.altreCanalDe === 'nou:' + x.clau, 'nou', x.clau)}</div>
    ${canal === 'bandcamp' ? `<p class="sf-pre">El codi de Bandcamp el busca Claude cada nit. No has de fer res.</p>` : ''}
    <div class="sf-chips" style="margin-top:12px">
      <button class="${pr ? '' : 'principal'}" data-sfnou="${esc(x.clau)}|arxiu">Desa'l</button>
      <button class="${pr ? 'principal' : ''}" data-sfnou="${esc(x.clau)}|rotacio">Desa'l i posa'l en rotació</button>
      ${a && D.preferents(db()).some(p => p.artista_id === a.id) ? '' : `<button class="${pref ? 'triat' : ''}" data-sfnoupref="${esc(x.clau)}">${pref ? '✓ ' : ''}Afegeix l'artista a preferents</button>`}
      <button class="mes" data-sfnouignora="${esc(x.clau)}">Ignora</button>
    </div></div>`;
}
// La clau d'un disc d'una targeta, tal com la fan servir la pregunta 2 i el disc nou.
// Els discos d'una targeta que són del mateix grup surten junts sota el nom del grup (3-11, Ricard). Només es veu:
// la resposta continua sent de la targeta o de cada disc, i Scrobble.resposta_de no guanya cap tercer valor.
function perGrups(discos, pinta) {
  const n = {}; for (const d of discos) if (d.conjunt) n[d.conjunt] = (n[d.conjunt] || 0) + 1;
  const fets = new Set(); let h = '';
  for (const d of discos) {
    const g = d.conjunt && n[d.conjunt] > 1 ? d.conjunt : null;
    if (!g) { h += pinta(d); continue; }
    if (fets.has(g)) continue; fets.add(g);
    const ms = discos.filter(x => x.conjunt === g), m = D.grup(db(), g);
    h += `<div class="sf-grup"><p class="sf-grupcap">Grup · <b>${esc(titolGrup(g, m.length ? m : ms))}</b></p>${ms.map(pinta).join('')}</div>`;
  }
  return h;
}
const clauDisc = d => d.clau[0] === 'n' ? d.clau.slice(1) : d.clau[0] === 'm' ? 'msid:' + d.clau.slice(1) : null;
// El context de cada disc d'una targeta contestada (3-11, Savall): una sessió pot tenir discos contestats diferent, i
// ensenyar només el de la primera pista contestada va fer veure «Treballant» on Ricard havia posat «Amor».
const ctxDisc = d => d.scr.find(s => s.estat === 'resolt')?.context || '';
function ctxPerDisc(c) {
  const v = c.discos.map(d => [d.titol + (d.partNom ? ' · ' + d.partNom : ''), ctxDisc(d)]), unics = [...new Set(v.map(x => x[1]))];
  return unics.length <= 1 ? esc(v.map(x => x[0]).join(', ')) + ' · ' + esc(unics[0] || '')
    : v.map(([t, x]) => `${esc(t)} · <b>${esc(x)}</b>`).join('; ');
}
function pintaSafata() {
  // La safata es torna a pintar sola (una lectura de ListenBrainz, un desat): el nom de la llista que s'està escrivint
  // es conserva, i el cursor també.
  const escrivint = document.activeElement?.id === 'inLlista';
  // ACT-768 (a): la durada escrita d'un disc nou es queda encara que es torni a pintar (triar el canal, una lectura).
  // Només la que ha tocat ell (value ≠ defaultValue): la proposta pot canviar sola (una part per acte, ACT-777) i ha de seguir.
  for (const i of document.querySelectorAll('[data-sfdur]')) if (i.value !== i.defaultValue) (estat.nouMinDe ||= {})[i.dataset.sfdur] = i.value;
  try { pintaSafata_(); } finally { if (escrivint) { const i = $('#inLlista'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } }
}
function pintaSafata_() {
  sincroCanals();
  const cua = cuaSafata();
  const q2 = new Map(cua.q2.map(q => [q.clau, q])), nous = new Map(cua.nous.map(x => [x.clau, x]));
  const solta = new Set(cua.soltes.map(x => x.clau));
  const tg = cua.tg;
  const perIdentificar = c => c.discos.some(d => { const k = clauDisc(d); return k && (q2.has(k) || nous.has(k)); });
  // A la cua: les targetes tancades amb alguna pista per contestar, i les ja contestades que encara tenen un disc per
  // identificar (la pregunta 2 o el disc nou viuen dins la targeta de la seva escolta, no en una de pròpia).
  const cuaTg = tg.filter(c => c.estat === 'pendent' || (c.estat === 'resolta' && perIdentificar(c)));
  const dins = new Set();       // cada pregunta, una sola vegada: a la targeta més recent on surt
  for (const c of cuaTg) for (const d of c.discos) { const k = clauDisc(d); if (k && (q2.has(k) || nous.has(k))) dins.add(k); }
  // Una sessió que encara sona (ACT-528): cada disc que ja ha acabat es contesta dins la targeta, amb la seva pregunta 2 o
  // el seu disc nou; el que encara sona espera i no es pregunta a mitja escolta.
  const perFer = d => !d.contestat || (() => { const k = clauDisc(d); return !!(k && (q2.has(k) || nous.has(k))); })();
  // Una sessió oberta on ja està tot contestat i no sona res no surt (3-11, opció A de Ricard): no hi ha res a fer, i
  // «Sonant ara» feia dues feines. Torna si comença un altre disc dins els 30 minuts; en tancar-se, va a les resoltes.
  const obertes = tg.filter(c => c.estat === 'oberta' && c.discos.some(d => !d.llest || perFer(d)));
  for (const c of obertes) for (const d of c.discos) { const k = clauDisc(d); if (k) dins.add(k); }
  const q2Sols = cua.q2.filter(q => !dins.has(q.clau)), nousSols = cua.nous.filter(x => !dins.has(x.clau));
  // El número compta també cada disc llest d'una sessió que sona (ACT-530).
  const llestos = obertes.reduce((a, c) => a + c.discos.filter(d => d.llest && perFer(d)).length, 0);
  const nt = C.nota(db());
  const n = q2Sols.length + nousSols.length + cua.rot.length + cuaTg.length + llestos + (nt ? 1 : 0);
  const p = $('#safataNum'); if (p) { p.textContent = n; p.classList.toggle('zero', !n); }
  const caixa = $('#safataCos'); if (!caixa) return;
  let h = '';
  const posats = new Set(), sosp = E.duradesSospitoses(db());
  const fila = d => {
    const k = clauDisc(d), esSolta = !d.edicio_id && k && solta.has(k);
    let bloc = '';
    if (k && (q2.has(k) || nous.has(k))) {
      if (posats.has(k)) bloc = `<p class="sf-pre" style="padding-left:54px">Es resol a la targeta de sobre.</p>`;
      else { posats.add(k); bloc = q2.has(k) ? blocQ2(q2.get(k)) : blocNou(nous.get(k)); }
    }
    const extra = d.edicio_id ? '' : esSolta ? ` · <i>cançó solta</i>` : '';
    const dq = d.edicio_id ? sosp.get(d.edicio_id) : null;
    if (dq && d.scr?.some(s => dq.escoltes.has(s.escolta_id))) bloc = avisDurada(d.edicio_id, dq, ' style="padding-left:54px"') + bloc;
    return minDisc(d, extra) + (esSolta ? `<button class="sf-link" style="padding:0 0 6px 54px" data-sfdisc="${esc(k)}">És un disc</button>` : '')
      + (d.edicio_id ? `<button class="sf-link sf-canal" data-sfcanaldisc="${d.edicio_id}">Canal: ${esc(nomCanal(d.app_escolta))} · canvia'l</button>` : '') + blocActes(d) + bloc;
  };
  const jaContestat = d => `<p class="sf-pre" style="padding-left:54px">On: <b>${esc(d.context || '')}</b>, ja contestat.</p>`;
  // La nota de la còpia de seguretat (§3.5, ACT-569): han baixat les edicions, els àlbums o els artistes. Es confirma amb un toc.
  if (nt) h += `<div class="sf-card sf-copia"><span class="sf-tipus">Còpia de seguretat</span>
    <p class="sf-pre">A la còpia del ${diaD(nt.data)} hi ha ${textBaixades(nt.baixades)} que a la del ${diaD(nt.anterior)}. La màquina sap quants, no quins.</p>
    <p class="sf-pre">Si ho has fet tu (has ajuntat duplicats o has tret un disc), toca «Entesos». Si no, no toquis res i digues-ho a Claude: la còpia anterior és al Drive.</p>
    <div class="sf-chips" style="margin-top:10px"><button class="principal" data-notaok="1">Entesos</button></div></div>`;
  // La sessió que encara sona (ACT-528): els discos acabats es contesten ara, un per un; el que sona, en gris.
  h += obertes.map(c => `<div class="sf-card sf-oberta${c.discos.some(d => d.llest && perFer(d)) ? ' amb-llestos' : ''}"><span class="sf-tipus">Sonant ara</span>
      <div class="sf-cap"><b>${esc(quan(c.inici).replace(/ · .*/, ''))} · des de les ${hm(c.inici)}</b><span>${nomCompte(c.comptes)}</span></div>
      ${perGrups(c.discos, d => !d.llest ? `<div class="sf-sonant">${minDisc(d, ' · <i>sonant</i>')}</div>`
        : d.contestat ? fila(d) + jaContestat(d)
        : `<div class="sf-separat">${fila(d)}${xipsContext('d' + c.clau + ':' + d.clau, c, 'Acabat. On l\'escoltaves?')}</div>`)}
      ${blocLlista(c, solta)}
      <p class="sf-pre">Cada disc es pot contestar quan fa 5 minuts que ha acabat o quan en comença un altre. Si esperes, quan faci 30 minuts que no sona res, la sessió sencera es contesta amb un toc.</p></div>`).join('');
  // la pregunta 2 i el disc nou que no tenen cap targeta a la cua (per exemple, d'escoltes d'abans de l'1-11)
  h += q2Sols.map(q => `<div class="sf-card"><span class="sf-tipus">És aquesta edició?</span>
      <div class="sf-cap"><b>${esc(q.album || '(sense nom d\'àlbum)')}</b><span>${esc(quan(q.darrera))}</span></div>
      <p class="sf-pre">${esc(q.artista || '')} · ${q.n === 1 ? 'una pista' : q.n + ' pistes'}${q.minuts ? ' · ' + q.minuts + '′ del que ha sonat' : ''}${q.album ? '' : ' · ' + esc(q.pista || '')}</p>
      ${blocQ2(q).replace('<p class="sf-q">És aquesta edició?</p>', '')}</div>`).join('');
  h += nousSols.map(x => `<div class="sf-card"><span class="sf-tipus">Disc nou</span>
      ${minDisc({ titol: x.album || x.pista, art: x.artista }, ' · ' + (x.n === 1 ? 'una pista' : x.n + ' pistes'))}${blocNou(x)}</div>`).join('');
  // les preguntes 7, 8 i 9
  h += cua.rot.map(x => {
    const d = { titol: x.titol, art: x.art, durada_total: x.durada_total, portada: x.portada };
    if (x.q === 7) return `<div class="sf-card"><span class="sf-tipus">Cinc escoltes en sis mesos</span>${minDisc(d)}
      <p class="sf-q">Sembla que l'estàs estudiant. El poso en rotació?</p>
      <div class="sf-chips"><button class="principal" data-sfq7="${x.id}|si">Sí, posa'l</button><button data-sfq7="${x.id}|no">No</button></div></div>`;
    if (x.q === 8) return `<div class="sf-card"><span class="sf-tipus">Cinc escoltes</span>${minDisc(d)}
      <p class="sf-q">Ja el dones per estudiat?</p>
      <div class="sf-chips"><button class="principal" data-sfq8="${x.id}|si">Sí</button><button data-sfq8="${x.id}|encara">Encara no</button><button data-sfq8="${x.id}|ara">No, i posa'l ara</button></div></div>`;
    return `<div class="sf-card"><span class="sf-tipus">Un mes sense sonar</span>${minDisc(d)}
      <p class="sf-q">Encara l'estàs estudiant?</p>
      <div class="sf-chips"><button class="principal" data-sfq9="${x.id}|si">Sí</button><button data-sfq9="${x.id}|no">No</button><button data-sfq9="${x.id}|ara">Sí, i posa'l ara</button></div></div>`;
  }).join('');
  // les targetes de sessió: una per escolta, amb tot el que s'hi ha de resoldre a dins
  h += cuaTg.map(c => {
    const sep = estat.separades?.has(c.clau) && c.estat === 'pendent';
    // Una sessió on algun disc ja es va contestar sol (ACT-528): aquests surten contestats i la pregunta és per a la resta.
    const parcial = c.estat === 'pendent' && c.discos.some(d => d.contestat);
    const cos = c.estat === 'resolta'
      ? perGrups(c.discos, fila) + `<p class="sf-pre">On ho escoltaves: <b>${esc(c.contextos.join(' · ') || c.context || '')}</b>, ja contestat.</p>`
      : sep
        ? perGrups(c.discos, d => d.contestat ? fila(d) + jaContestat(d) : `<div class="sf-separat">${fila(d)}${xipsContext('d' + c.clau + ':' + d.clau, c, 'On escoltaves aquest?')}</div>`)
        : perGrups(c.discos, d => fila(d) + (parcial && d.contestat ? jaContestat(d) : '')) + xipsContext('t' + c.clau, c, parcial ? 'On escoltaves la resta?' : null)
          + (c.discos.filter(d => !d.contestat).length > 1 ? `<button class="sf-link" data-sfsepara="${c.clau}">Separa: cada disc per la seva banda</button>` : '');
    return `<div class="sf-card"><div class="sf-cap"><b>${esc(franja(c))}</b><span>${nomCompte(c.comptes)} · ${c.discos.length} ${c.discos.length === 1 ? 'disc' : 'discos'}</span></div>${cos}${blocLlista(c, solta)}</div>`;
  }).join('');
  if (!n) h += `<div class="sf-buit"><b>Res per resoldre</b>${E.arrencada(db()) ? 'La màquina llegeix les dues comptes de ListenBrainz des del ' + dia(E.arrencada(db())) + ' cada vegada que obres l\'app i quan toques la safata.' : 'Quan hi hagi connexió, la màquina començarà a llegir ListenBrainz.'}${estat.lbError ? '<br><small>' + esc(estat.lbError) + '</small>' : ''}</div>`;
  // les resoltes, amb «Canvia» (tot el que es contesta aquí és editable sempre, §8.7)
  // També la sessió oberta amagada (tot contestat i res sonant): surt ja aquí, «sonant fa poc» (6-11, Ricard), perquè el que
  // s'acaba de contestar es pugui veure i canviar. Si comença un altre disc dins els 30 minuts, torna a «Sonant ara».
  const res = tg.filter(c => (c.estat === 'resolta' && !cuaTg.includes(c)) || (c.estat === 'oberta' && !obertes.includes(c))).slice(0, RESOLTES);
  if (res.length) h += `<h2 style="margin-top:22px">Resoltes</h2>` + res.map(c => `<div class="sf-resolta"><span><b>${esc(franja(c))}</b>${c.estat === 'oberta' ? ' · <i>sonant fa poc</i>' : ''} · ${ctxPerDisc(c)}</span>
      <button data-sfresolta="${c.clau}">Canvia</button></div>`).join('');
  caixa.innerHTML = h;
  I.omple(caixa);
  if (cua.nous.some(x => x.mbid && !mbCache.has(x.mbid))) consultaMB(cua.nous);
}
// MusicBrainz, per al disc nou: el títol, el nombre de pistes i la durada. Es consulta i no es desa a l'arxiu (ACT-461);
// es recorda en aquest mòbil perquè no es torni a demanar.
let consultant = false;
async function consultaMB(nous) {
  if (consultant || !navigator.onLine) return; consultant = true;
  try {
    for (const x of nous) {
      if (!x.mbid || mbCache.has(x.mbid)) continue;
      try {
        const r = await fetch(`https://musicbrainz.org/ws/2/release/${x.mbid}?inc=recordings&fmt=json`);
        if (!r.ok) { mbCache.set(x.mbid, null); continue; }
        const j = await r.json(), pistes = (j.media || []).flatMap(m => m.tracks || []);
        const ms_ = pistes.reduce((a, t) => a + (t.length || 0), 0);
        // ACT-777: si totes les pistes diuen el seu acte, les parts per acte amb la seva durada (actes.js).
        mbCache.set(x.mbid, { titol: j.title, pistes: pistes.length, minuts: pistes.every(t => t.length) ? Math.round(ms_ / 60000) : null, actes: partsPerActe(pistes) });
      } catch { mbCache.set(x.mbid, null); }
      await new Promise(r => setTimeout(r, 1100));          // MusicBrainz demana una consulta per segon
    }
    try { localStorage.setItem('tria-mb', JSON.stringify(Object.fromEntries(mbCache))); } catch {}
  } finally { consultant = false; pintaSafata(); }
}

// ───────── la lectura de ListenBrainz (§3.3, ACT-453 i ACT-454) ─────────
// En obrir l'app amb connexió i en tocar la safata. Les dues comptes, des de l'Arrencada o des de l'últim que ja té.
// L'Arrencada s'escriu una sola vegada, la primera vegada que aquesta versió llegeix.
// La darrera lectura bona d'aquest dispositiu (3-11): els 5 i els 30 minuts es compten fins aquí (escoltes.js, finsA).
// Es guarda al mòbil, no a l'arxiu: cada dispositiu té la seva i no escriu res al Drive per llegir.
const LECTURA = 'tria-lectura-lb';
E.fixaLectura((() => { try { return +localStorage.getItem(LECTURA) || null; } catch { return null; } })());
let llegint = false;
async function llegeixEscoltes() {
  if (llegint || !navigator.onLine || !A.estat.db) return;
  llegint = true; estat.lbError = null;
  // L'hora d'abans de la primera crida: el que es llegeix és, com a mínim, tot el que hi havia en aquell moment.
  const inici = Date.now();
  try {
    const arr = E.arrencada(db()) || new Date().toISOString();
    const noves = [];
    for (const c of E.COMPTES) {
      // Amb un marge de 24 hores enrere: un mòbil sense cobertura envia les pistes tard, amb la seva hora d'inici, i
      // ListenBrainz filtra per aquesta hora. Sense el marge, una pista enviada tard i més antiga que l'última llegida
      // es perdria. Rellegir no duplica res (la clau única de Scrobble). Mai abans de l'Arrencada.
      const ult = E.darrerLlegit(db(), c.nom);
      const des = [arr, ult ? new Date(Date.parse(ult) - 24 * 3600e3).toISOString() : null].filter(Boolean).sort().pop();
      noves.push(...await LB.llegeixCompte(c.nom, des));
    }
    // Les pistes que arriben tard a una targeta ja contestada n'hereten la resposta (1-11). Es mira cada vegada, encara que
    // no n'arribi cap de nova, perquè una targeta es tanca amb el temps: 30 minuts sense sonar.
    const tard = (db_, cal) => E.heretaRespostes(Date.now(), cal)(db_);
    // Un arxiu sense unió (estructura 6, ACT-585) o calculat amb una altra estructura o regles (ACT-700): es torna a calcular un cop.
    const unio = E.calRecalcular(db());
    const cal = !E.arrencada(db()) || noves.length || E.calHeretar(db()) || unio;
    if (cal) {
      // ACT-738: es torna a calcular des de la pista més antiga que s'ha llegit o tocat, no des del principi.
      const r = await fes(x => { E.fixaArrencada(arr)(x); const cal = {}; const n = E.desaScrobbles(noves)(x); E.aplicaIgnoraSempre(x, cal); const h = tard(x, cal); const em = E.emparellaSols(x, cal);
        for (const s of noves) if (!cal.desDe || s.listened_at < cal.desDe) cal.desDe = s.listened_at;
        return { n, h, em, ...((n || h || em || unio) ? E.recalcula(x, { desDe: cal.desDe }) : {}) }; }, null, { desfes: false, auto: true });
      // Sense avís de «pistes noves» (2-11): el número de la safata ja ho diu, i l'avís tapava la franja magenta.
    }
    // Només una lectura sencera (les dues comptes) i ja desada al mòbil compta com a bona.
    E.fixaLectura(inici); try { localStorage.setItem(LECTURA, String(inici)); } catch {}
    // Els fitxers d'any (obra III): primer el recàlcul que els demana (ACT-841 1), després el moviment del mes (ACT-838).
    // Una estona després (ANYS.ESPERA_MS), per no frenar l'obertura ni la lectura; un sol cop alhora.
    if (!estat.anysProgramat) { estat.anysProgramat = true; setTimeout(anysAlDia, ANYS.ESPERA_MS); }
  } catch (e) { estat.lbError = e.message; }
  finally { llegint = false; pintaSafata(); }
}

// La foto d'un artista pujada a mà: reduïda, al Drive (carpeta «Retrats») i guardada al mòbil.
async function pujaFoto(p, fitxer) {
  if (!A.tePermis()) { avisa('Per pujar una foto cal estar connectat amb el Drive.'); return; }
  avisa('Pujant la foto…');
  try {
    const blob = await I.redueix(fitxer);
    const ref = 'drive:' + await A.pujaRetrat(p.nom, blob);
    await I.guardaJa(ref, blob);
    tancaFull(); fes(D.posaRetratMa(p.artista_id, ref), 'Foto de ' + p.nom + ' desada');
  } catch (e) { avisa('No s\'ha pogut pujar la foto: ' + e.message); }
}

// ───────── fulls ─────────
const ORIGEN_PORTADA = { sonda: 'endevinada pel títol', escolta: 'la de l\'edició que has escoltat', triada: 'triada per tu', pujada: 'pujada per tu',
  rebutjada: 'cap: la que va trobar la màquina no era', cap: 'no n\'ha arribat cap' };

// «Canvia la portada» (decisió de Ricard, 30-10): primer triar-la entre les que troba MusicBrainz; pujar-la, l'últim recurs.
function fullPortada(d) {
  estat.portadaDe = d;
  const t = d.titol.includes(':') ? d.titol.split(':').slice(1).join(':').trim() : d.titol;   // «Bartók: …» → sense el compositor
  obreFull(`<h3>La portada de ${esc(d.titol)}</h3><p>${esc(d.art)}</p>
    <p style="margin:10px 0 6px"><b>Tria-la tu.</b> Si no surt, canvia el títol o buida l'artista: a la clàssica, el disc sol anar a nom del compositor.</p>
    <label class="camp"><span>Títol</span><input id="inPTit" type="text" autocomplete="off" value="${esc(t)}"></label>
    <label class="camp"><span>Artista</span><input id="inPArt" type="text" autocomplete="off" value="${esc(d.art)}"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-cercaportada="1">Cerca</button></div>
    <div class="candidats" id="candidats"></div>
    <div class="canals" style="margin-top:16px">
      <button data-pujaportada="1">Puja-la <small>si no surt enlloc: una foto o una imatge teva</small></button>
      ${d.portada ? `<button data-noportada="${d.partId ? 'p' + d.partId : d.id}">Treu-la <small>${d.partId ? 'la part torna a fer servir la de la caixa' : 'no és aquesta, i no en tinc cap altra'}</small></button>` : ''}
    </div>
    <input type="file" id="inPortada" accept="image/*" hidden>`, true);
  $('#inPortada').onchange = e => { const f = e.target.files?.[0]; if (f) pujaPortada(d, f); };
  cercaPortada();
}
async function cercaPortada() {
  const caixa = $('#candidats'); if (!caixa) return;
  if (!navigator.onLine) { caixa.innerHTML = '<p class="subtitol">Sense connexió: la cerca necessita xarxa.</p>'; return; }
  caixa.innerHTML = '<p class="subtitol">Cercant…</p>';
  try {
    const c = await I.candidats({ titol: $('#inPTit').value, art: $('#inPArt').value });
    if (!$('#candidats')) return;
    caixa.innerHTML = c.map(x => `<button class="candidat" data-triaportada="${esc(x.ref)}">
        <img src="${esc(I.miniatura(x.ref))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.candidat').remove()">
        <span><b>${esc(x.titol)}</b>${esc(x.art)}${x.any ? ' · ' + x.any : ''}</span></button>`).join('')
      || '<p class="subtitol">Res. Prova un altre títol, o buida l\'artista.</p>';
  } catch (e) { caixa.innerHTML = `<p class="subtitol">MusicBrainz no respon (${esc(e.message)}). Torna-hi d'aquí a una estona.</p>`; }
}
// Després de canviar una portada (de l'edició o d'una part), es torna a la fitxa del disc, no a la pantalla de sota.
function tornaFitxa(id) { const y = id && (D.edicio(db(), +id) || D.fitxa(db(), +id)); if (y) fullFitxa(y); else tancaFull(); }
async function pujaPortada(d, fitxer) {
  if (!A.tePermis()) { avisa('Per pujar una portada cal estar connectat amb el Drive.'); return; }
  avisa('Pujant la portada…');
  try {
    const blob = await I.redueix(fitxer);
    const ref = 'drive:' + await A.pujaPortada(d.art + ' - ' + d.titol, blob);
    await I.guardaJa(ref, blob);
    fes(d.partId ? D.posaPortadaPart(d.partId, ref) : D.posaPortada(d.id, ref, 'pujada'), 'Portada desada'); tornaFitxa(d.id);
  } catch (e) { avisa('No s\'ha pogut pujar la portada: ' + e.message); }
}

// «Canvia la foto» d'un artista: pujar-ne una, o treure la que hi ha.
function fullFoto(p) {
  obreFull(`<h3>La foto de ${esc(p.nom)}</h3>
    <p>${{ ma: 'És la que vas pujar tu.', triat: 'La vas triar tu.', sonda: 'La va trobar la màquina pel nom.', rebutjat: 'La que va trobar la màquina no era.' }[p.retrat_origen] || 'No n\'ha arribat cap de sola.'}
       Sense foto, la fila fa servir la portada del disc que tens en rotació, o les inicials.</p>
    <p style="margin:10px 0 6px"><b>Tria-la tu.</b> Van arribant d'una en una: Wikipedia primer, i després cada artista de MusicBrainz que es diu així.</p>
    <label class="camp"><span>Nom</span><input id="inFNom" type="text" autocomplete="off" value="${esc(p.nom)}"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-cercafoto="1">Cerca</button></div>
    <div class="candidats" id="candidatsFoto"></div>
    <div class="canals" style="margin-top:16px">
      <button data-pujafoto="1">Puja'n una <small>es desa al teu Drive</small></button>
      ${p.retrat ? `<button data-noretrat="${p.artista_id}">Treu-la <small>no és ell, i no en tinc cap altra</small></button>` : ''}
    </div>
    <input type="file" id="inFoto" accept="image/*" hidden>`, true);
  $('#inFoto').onchange = e => { const f = e.target.files?.[0]; if (f) pujaFoto(p, f); };
  estat.fotoDe = p; cercaFoto();
}
let cercaFotoN = 0;
async function cercaFoto() {
  const caixa = $('#candidatsFoto'); if (!caixa) return;
  if (!navigator.onLine) { caixa.innerHTML = '<p class="subtitol">Sense connexió: la cerca necessita xarxa.</p>'; return; }
  const n = ++cercaFotoN;
  caixa.innerHTML = '<p class="subtitol" id="fotoCercant">Cercant…</p>';
  await I.candidatsRetrat($('#inFNom').value, x => {
    if (n !== cercaFotoN || !$('#candidatsFoto')) return;
    $('#fotoCercant')?.insertAdjacentHTML('beforebegin', `<button class="candidat" data-triafoto="${esc(x.url)}">
      <img src="${esc(x.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.candidat').remove()"><span>${esc(x.peu)}</span></button>`);
  });
  if (n !== cercaFotoN) return;
  const c = $('#fotoCercant'); if (c) c.textContent = $('#candidatsFoto .candidat') ? 'Ja està: no n\'hi ha més.' : 'Res. Prova una altra forma del nom, o puja\'n una.';
}
function fullEscoltar(d, tots) {
  estat.escoltant = d;
  const lleida = estat.lloc === 'Lleida';
  const fisic = (lleida && d.fisic) ? `<button data-fisic="1">Tinc el disc <small>a casa, a Lleida</small></button>` : '';
  const k = d.canal && CANALS[d.canal] ? d.canal : null;
  const principal = k ? (() => { const e = enllac(k, d); return `<a class="canal-principal" ${aAttrs(e)} ${d.id ? `data-obre="${d.id}"` : ''}>${CANALS[k].nom} <small>${e.nota}</small></a>`; })() : '';
  const altres = Object.keys(CANALS).filter(x => x !== k);
  obreFull(`<h3>${esc(d.tit)}</h3><p>${esc(d.art)}${d.min ? ' · ' + d.min + '′' : ''}</p>
    <div class="canals">${fisic}${principal}</div>
    ${!k && !fisic ? `<p>${d.fisic ? 'És un disc físic: fora de Lleida, tria un canal per escoltar-lo.' : 'Aquest disc no té canal: tria\'n un.'}</p>` : ''}
    ${(tots || !k) ? `<p style="margin:14px 0 8px">${d.id ? 'Tria el canal d\'aquest disc. Queda recordat.' : 'Tria el canal.'}</p>
      <div class="canals">${altres.map(x => `<button data-canvicanal="${x}">${CANALS[x].nom}</button>`).join('')}</div>`
      : `<div class="barra-accions" style="position:static;padding:10px 0 0"><button class="bt discret" data-altrecanal="1">Un altre canal</button></div>`}
    ${d.id ? `<div class="barra-accions" style="position:static;padding:6px 0 0"><button class="bt discret" data-fitxa="${d.id}">Fitxa del disc</button></div>` : ''}`);
}

// ───────── la fitxa del disc (v1.52, ACT-732 a ACT-736; maqueta v14 amb les dues correccions de Ricard del 14-11) ─────────
// Capçalera (ACT-734): portada, títol, artista, la durada gran amb «canvia», i l'edició, que es toca per «Canvia l'edició»
// (puja del final de la fitxa). «Per afinar» és un botó ample al costat de la portada: un toc marca i un altre desmarca,
// sense diàleg (Ricard, 14-11: «Pulsar una vez ya es suficiente»). Edició.Per afinar. A sota, «Escoltar ara» i «Treu de rotació».
// La reixa, vuit botons. TARONJA ÉS QUE FALTA, i cada taronja surt d'un camp (§13.3):
//   Gènere: Àlbum.Gènere sense branca, o Clàssica sense Àlbum.Llenguatge o Àlbum.Formació (F.falta, el mateix que L'Afinació);
//   Tags: sense el tag VEU, o «amb veu» sense cap IDIOMA (Ricard: «OK naranja»);
//   Nota: «Encara no» (cap Puntuació i Edició.Data darrera pregunta puntuació plena);
//   Canal: Edició.App d'escolta buida en un disc que no és físic; Portada: Edició.Portada buida; Durada buida, a la capçalera.
// PLE ÉS EL COLOR DEL LLOC (Ricard, 14-11): blau fora i groc a Lleida, que és var(--accent) de l'estil «ricard».
// Grup, Escoltes i Més… no s'omplen: sense color, amb vora discontínua. «Més…» guarda preferents, juntar, «És part» i esborrar.
// La Nota d'un disc que encara no ha sortit mai de rotació («sense nota») no és ni taronja ni plena: va sense color
// (decisió de construcció de Claude, per ratificar: no falta res, perquè la nota arriba en treure'l, però tampoc hi és).
// El context no va a la fitxa: és de cada escolta (ACT-736). Avís dit: amb la col·lecció física, gairebé totes sortiran
// taronja a Tags.
const notaEncaraNo = d => !d.nota && !!d.data_darrera_pregunta_puntuacio;
function estatTags(d) {
  const st = T.llegeix(d.album_tags, d.tags);
  if (!st.veu) return { falta: true, txt: 'falta la veu' };
  if (st.veu === 'amb veu' && !st.idiomes.length) return { falta: true, txt: 'falta l\'idioma' };
  const n = st.si.size + 1 + (st.estacio ? 1 : 0) + st.idiomes.length;
  return { falta: false, txt: n + (n === 1 ? ' marcat' : ' marcats') };
}
function estatGenere(d) {
  const f = F.falta({ generes: d.generes, llenguatge: d.llenguatge, formacio: d.formacio });
  if (f === 'sense gènere') return { falta: true, txt: 'falta' };
  const txt = d.generes.join(' · ') + (d.subgeneres?.length ? ' · ' + d.subgeneres.join(', ') : '');
  return f ? { falta: true, txt: 'falten llenguatge / formació' } : { falta: false, txt };
}
const cel = (attr, val, classe, titol, txt) =>
  `<button class="cel ${classe}" data-${attr}="${esc(val)}"><b>${titol}</b><span>${txt}</span></button>`;
// «← Tornar» d'una fulla oberta des de la fitxa torna a la fitxa, no tanca (abans tancava: s'havia de tornar a obrir el disc).
function tornaA(id) { const b = $('#full .torna-full'); if (b && id) { delete b.dataset.tornafull; b.dataset.fitxa = id; } }

// ACT-767 i ACT-766: «Enganxa l'enllaç» a la fitxa d'un disc de Bandcamp sense codi (una edició sense parts), i l'avís
// si la tasca de nit no l'ha trobat en B.NITS nits.
function blocEnllac(d) {
  if (d.app_escolta !== 'bandcamp' || d.parts.length) return '';
  // ACT-814 (3.1): a tota edició de Bandcamp, també amb codi: «Codi de Bandcamp · canvia'l».
  if (d.bc) return `<div class="codi-bc"><p class="linia-bc">Codi de Bandcamp <b>${esc(d.bc)}</b> <button class="sf-link" data-codibc="${d.id}">canvia'l</button></p></div>`;
  const nits = B.apartat(db(), d.id), rp = CB.repte(db(), d.id);
  return `<div class="enllac-bc">
    <p class="linia-bc">Codi de Bandcamp <b>encara no</b> <button class="sf-link" data-codibc="${d.id}">canvia'l</button></p>
    ${rp ? `<p class="avis-bc"><b>La pàgina de Bandcamp té un repte</b> que la tasca de nit no pot passar. Treu-ne el codi amb el marcador «Codi per a la Discoteca» (toca «canvia'l»).</p>` : ''}
    ${nits !== null ? `<p class="avis-bc"><b>Bandcamp no l'ha trobat</b> en ${nits} nits: queda apartat. Enganxa l'enllaç i la tasca hi tornarà.</p>` : ''}
    ${d.bce ? `<p class="gris" style="font-size:12px">Enllaç desat: el ▶ ja l'obre. El codi el treu la tasca aquesta nit.</p>` : ''}
    <label class="camp"><span>Enganxa l'enllaç o el número <small class="gris">· l'enllaç, el de «Compartir» a l'app de Bandcamp</small></span>
      <input id="inEnllacBc" type="url" inputmode="url" autocomplete="off" placeholder="https://….bandcamp.com/album/…" value="${esc(d.bce || '')}"></label>
    <button class="bt" data-desaenllac="${d.id}">Desa</button></div>`;
}
// «canvia'l» (ACT-814 3.1, ACT-817): enllaç o número, i el marcador explicat pas a pas.
const BASE_APP = () => location.origin + location.pathname.replace(/[^/]*$/, '');
function fullCodiBc(d) {
  obreFull(`<h3>El codi de Bandcamp</h3><p>${esc(d.titol)} · ${esc(d.art)}${d.bc ? ` · ara <b>${esc(d.bc)}</b>` : ' · encara sense codi'}</p>
    <label class="camp"><span>Enganxa l'enllaç o el número</span>
      <input id="inEnllacBc" type="text" inputmode="url" autocomplete="off" placeholder="https://….bandcamp.com/album/…  o  1234567890" value=""></label>
    <p class="gris" style="font-size:12.5px">El número entra al moment. L'enllaç (el de «Compartir» a l'app de Bandcamp, de la versió bona): ${d.bc ? 'el codi d\'ara surt de seguida, el ▶ obre l\'enllaç a la web, i ' : ''}la tasca de nit en treu el codi.</p>
    <div class="barra-accions" style="position:static;padding:0 0 10px"><button class="bt principal" data-desaenllac="${d.id}">Desa</button></div>
    <h3 style="margin-top:14px">El marcador «Codi per a la Discoteca»</h3>
    <p>Per treure tu el codi quan la tasca no pot. Es prepara una sola vegada:</p>
    <ol class="passos"><li>Toca «Copia el marcador».</li><li>Al Chrome del mòbil, guarda qualsevol pàgina a les adreces d'interès (l'estrella del menú ⋮).</li>
      <li>Edita aquesta adreça d'interès: posa-li de nom <b>disco</b> i, a l'adreça, esborra el que hi ha i enganxa el que has copiat (comença per «javascript:»).</li></ol>
    <p>Després, cada vegada: obre al Chrome la pàgina de l'àlbum a Bandcamp, escriu <b>disco</b> a la barra d'adreces i toca el marcador que surt a la llista. La Discoteca s'obre amb el codi posat.</p>
    <textarea id="txtMarcador" readonly rows="3" style="width:100%;font:11px ui-monospace,monospace">${esc(CB.textMarcador(BASE_APP()))}</textarea>
    <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt" data-copiamarcador="1">Copia el marcador</button></div>`, true);
}
// El marcador obre l'app amb ?bc=…&enllac=…: el codi va al disc que té aquest enllaç, o es pregunta a quin.
function marcadorBandcamp() {
  const m = CB.llegeixMarcador(location.search); if (!m) return;
  try { history.replaceState(null, '', location.pathname); } catch {}
  const id = CB.edicioPerEnllac(db(), m.enllac);
  if (id) { fes(CB.desaCodi(id, m.codi, m.enllac), 'Codi de Bandcamp posat: el ▶ ja obre el disc a l\'app.'); return; }
  estat.marcador = m;
  const c = CB.candidatsMarcador(db());
  obreFull(`<h3>De quin disc és aquest codi?</h3><p>Codi ${esc(m.codi)}${m.enllac ? ` · ${esc(m.enllac.replace(/^https:\/\//, ''))}` : ''}</p>
    <div class="canals">${c.map(x => `<button data-marcadorde="${x.id}">${esc(x.titol)} <small>${esc(x.art)}${x.nom_edicio ? ' · ' + esc(x.nom_edicio) : ''}${x.codi_bandcamp ? ' · ja té codi' : ' · sense codi'}${x.rotacio_actual ? ' · en rotació' : ''}</small></button>`).join('')
      || '<p class="subtitol">No hi ha cap disc de Bandcamp a l\'arxiu.</p>'}</div>`, true);
}

function fullFitxa(d) {
  const canal = d.app_escolta ? CANALS[d.app_escolta]?.nom || nomCanal(d.app_escolta) : (d.fisic ? 'disc físic' : '');
  const codi = d.app_escolta === 'bandcamp' ? (d.bc ? ' · amb codi' : d.bce ? ' · amb enllaç' : ' · sense codi') : '';
  const gen = estatGenere(d), tg = estatTags(d), esc_ = E.escoltesDeLEdicio(db(), d.id);
  const origen = ORIGEN_PORTADA[d.portada_edicio ? d.portada_origen || 'escolta' : d.portada_origen === 'rebutjada' ? 'rebutjada' : 'cap'];
  const edicio = d.nom_edicio ? esc(d.nom_edicio) : (d.n_edicions > 1 ? 'sense nom' : 'l\'única que hi ha');
  const q = E.duradesSospitoses(db()).get(d.id);
  const grup = d.discosGrup.length > 1;
  const tEsc = esc_.escoltes.length ? `${esc_.compten}${esc_.mitges ? ` · ${esc_.mitges} a mitges` : ''}` : 'cap encara';
  // «Per afinar» (ACT-742, 1): a dalt de tot, damunt de la portada i a tot l'ample, marcat o no. Ricard: «Siempre arriba. Si
  // vemos que no funciona te aviso». Consequència dita: és el primer de cada fitxa, també als discos que estan bé.
  obreFull(`${d.per_afinar
      ? `<button class="afinar dalt marcat per-afinar" data-jaafinat="${d.id}">Per afinar<small>marcat ${esc(fa(d.per_afinar))} · toca per «Ja està afinat»</small></button>`
      : `<button class="afinar dalt" data-perafinar="${d.id}">Per afinar</button>`}
    <div class="fitxa-cap">
      <button class="info-i" data-info="${d.id}" aria-label="Info: la Wikipedia, MusicBrainz, Discogs, RYM i AllMusic" title="Info">i</button>
      <div class="fitxa-portada cap-cob">${d.portada ? IMG(d.portada) : `<span class="inicials">${esc(inicials(d.art))}</span>`}</div>
      <div class="cap-txt">
        <h3>${esc(d.titol)} <button class="sf-link" data-canvianoms="${d.id}">canvia</button></h3><p class="cap-art">${esc(d.art)}</p>
        ${botoPrefCap(d)}
        <div class="cap-ed"><span class="min ${d.min ? '' : 'falta'}">${d.min ? d.min + '′' : 'falta la durada'}</span><button class="sf-link" data-durada="${d.id}">canvia</button><br>
          Edició <button class="sf-link" data-canviaedicio="${d.id}">${edicio}</button>
          <br>Segell <button class="sf-link" data-segellfitxa="${d.id}">${esc(SG.segellDe(db(), d.id) || 'cap')} · canvia'l</button>
          ${d.parts.length ? `<br>${d.esperant ? 'Cap part viva: la caixa espera' : 'Part viva: ' + esc(d.viva.nom || '') + ' · ' + d.viva.numero + ' de ' + d.parts.length}` : ''}
          ${d.formats.length ? `<br><small>${esc(d.formats.map(f => NOMS_FISICS[f] || f).join(', '))}</small>` : ''}</div>
      </div>
    </div>
    ${q ? `<div class="avis-durada"><b>Durada?</b> ${avisDurada(d.id, q)}</div>` : ''}
    <div class="barra-accions fitxa-accions">
      ${d.esperant ? `<button class="bt principal" data-repren="${d.id}">Reprèn</button>` : `<button class="bt principal" data-escoltar="${d.id}">▶ Escoltar ara</button>`}
      ${d.rotacio_actual ? `<button class="bt" data-treure="${d.id}">Treu de rotació</button>` : `<button class="bt" data-hrot="${d.id}">Posa'l en rotació</button>`}
    </div>
    ${blocEnllac(d)}
    ${pilesFitxa(d)}
    <div class="graella">
      ${cel('generefitxa', d.id, (gen.falta ? 'falta' : 'ple') + ' cel-genere', 'Gènere', esc(gen.txt))}
      ${cel('tagsfitxa', d.id, tg.falta ? 'falta' : 'ple', 'Tags', esc(tg.txt))}
      ${cel('canalfitxa', d.id, canal ? 'ple' : 'falta', 'Canal', canal ? esc(canal) + codi : 'falta')}
      ${cel('notafitxa', d.id, notaEncaraNo(d) ? 'falta' : d.nota ? 'ple' : 'buit', 'Nota', d.nota ? esc(nomNota(d.nota.valor)) : notaEncaraNo(d) ? 'Encara no' : 'sense nota')}
      ${cel('canviaportada', d.id, d.portada_edicio ? 'ple' : 'falta', 'Portada', esc(d.portada_edicio ? origen : 'falta'))}
      ${grup ? cel('fitxagrup', d.conjunt, 'neutre', 'Grup', esc(titolGrup(d.conjunt, d.discosGrup)) + ' · ' + d.discosGrup.length)
             : cel('agrupa', d.id, 'neutre', 'Grup', 'cap · agrupa\'l amb…')}
      ${cel('escoltesfitxa', d.id, 'neutre', 'Escoltes', tEsc)}
      ${cel('mesfitxa', d.id, 'neutre', 'Més…', 'preferents, juntar, esborrar')}
    </div>
    ${blocObra5(d)}
    <div class="llegenda"><span><i class="l-falta"></i>falta omplir</span><span><i class="l-ple"></i>omplert</span><span><i class="l-neutre"></i>no s'omple</span></div>
    ${d.parts.length ? blocParts(d) : ''}`, true);
  // La cadena de la fitxa (ACT-742, 7): les fulles que s'obren des d'aquí són a pantalla completa, i en recarregar l'app
  // aquesta fitxa es torna a obrir (ACT-743).
  $('#full').dataset.cadena = d.id; recordaPantalla();
}
// Obra IV (e): el botó propi de preferent, a la capçalera, fora de la quadrícula de vuit (ACT-734). «＋ Preferent» el fa
// preferent (preferent.artista_id) i la fitxa es queda oberta; si ja ho és, «★ Preferent» porta a la seva pantalla.
function botoPrefCap(d) {
  if (!d.artista_id) return '';
  const pid = FX.preferentDe(db(), d.artista_id);
  return pid ? `<button class="pref-cap ja" data-prefja="${pid}" aria-label="${esc(d.art)} és preferent: ves a l'artista">★ Preferent</button>`
             : `<button class="pref-cap" data-prefcap="${d.id}|${d.artista_id}" aria-label="Afegeix ${esc(d.art)} a Artistes Preferents">＋ Preferent</button>`;
}
// Obra 5 (ACT-771, ACT-772): l'artista i copiar. Preferent → «Ves a l'artista»; no preferent → «Tria el següent de X».
function blocObra5(d) {
  const pid = FX.preferentDe(db(), d.artista_id);
  return `<div class="canals fitxa-obra5" style="margin-top:12px">
    ${pid ? `<button data-vesartista="${pid}">Ves a l'artista <small>${esc(d.art)} · anterior i següent</small></button>`
          : `<button data-triaseguent="${d.id}">Tria el proper de ${esc(d.art)} <small>el següent o l'anterior; el fa preferent</small></button>`}
    <button data-copiade="${d.id}">Copia d'un altre disc <small>gènere, subgèneres, llenguatge, formació i tags de l'àlbum</small></button></div>`;
}
// «Info» (ACT-815, 6): A, els enllaços; B, la fitxa de la Wikipedia (en anglès) i de MusicBrainz, desada per veure-la sense
// connexió. Es busca només quan es toca «Busca la fitxa» o quan no n'hi ha cap de desada i hi ha xarxa.
function fullInfo(d, cercant = false) {
  const rel = INF.releaseDeLAlbum(db(), d.album_id), inf = INF.desada(db(), d.album_id);
  const links = INF.enllacos({ art: d.art, titol: d.titol, release: inf?.mb?.release || rel });
  const w = inf?.wiki, m = inf?.mb;
  const fitxa = inf ? `${w ? `<div class="info-wiki"><h4 class="gen-eix">Wikipedia <small>· en anglès</small></h4><p class="info-resum" lang="en">${esc(w.resum).replace(/\n+/g, '</p><p class="info-resum" lang="en">')}</p>
        <p><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.titol)} a la Wikipedia</a></p></div>` : '<p class="gris">La Wikipedia no té cap pàgina d\'aquest disc (o no l\'he trobada).</p>'}
      ${m ? `<h4 class="gen-eix">MusicBrainz</h4><p>${[m.data, m.segell, m.cataleg].filter(Boolean).map(esc).join(' · ') || 'sense data ni segell'}</p>
        ${m.pistes.length ? `<ol class="info-pistes">${m.pistes.map(t => `<li>${esc(t.titol)}${t.min ? ` <small>${t.min}′</small>` : ''}</li>`).join('')}</ol>` : ''}` : '<p class="gris">MusicBrainz no té aquest disc (o no l\'he trobat).</p>'}
      <p class="gris" style="font-size:11.5px">Desada ${esc(fa(inf.quan))}: es veu sense connexió.</p>` : '';
  obreFull(`<h3>Info</h3><p>${esc(d.titol)} · ${esc(d.art)}</p>
    <div class="canals">${links.map(l => `<a class="bt-enllac" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nom)} <small>${esc(l.nota)}</small></a>`).join('')}</div>
    ${fitxa}
    <div class="barra-accions" style="position:static;padding:8px 0 0"><button class="bt ${inf ? '' : 'principal'}" data-buscainfo="${d.id}" ${cercant ? 'disabled' : ''}>${cercant ? 'Cercant…' : inf ? 'Torna-la a buscar' : 'Busca la fitxa'}</button></div>`, true);
  tornaA(d.id);
}
async function buscaInfo(id) {
  const d = D.fitxa(db(), id); if (!d) return;
  if (!navigator.onLine) { avisa('Sense connexió: la fitxa es busca amb xarxa.'); return; }
  fullInfo(d, true);
  const r = await INF.busca({ art: d.art, titol: d.titol, release: INF.releaseDeLAlbum(db(), d.album_id) });
  if (!r.wiki && !r.mb) { avisa('Ni la Wikipedia ni MusicBrainz en saben res.'); }
  const relEd = SG.releaseDeLEdicio(db(), id);   // obra G (7.2): el segell, només de l'edició exacta i si no en té
  fes(y => { INF.desa(d.album_id, r)(y); SG.segellDeMB(id, relEd, r.mb)(y); }, null, { desfes: false });
  if ($('#full.obert [data-buscainfo]')) fullInfo(D.fitxa(db(), id));
}
function fullCopiaTria(d, filtre = '') {
  const llista = FX.candidatsCopia(db(), d.album_id, filtre);
  const files_ = llista.map(r => `<button data-copiaorigen="${r.id}">${esc(r.titol)} <small>${esc(r.art)}</small></button>`).join('')
    || `<p class="subtitol">${filtre ? 'Cap disc amb aquest nom.' : 'Cap altre disc seu amb gènere o tags: cerca a tot l\'arxiu.'}</p>`;
  if ($('#copiaLlista') && estat.copia?.id === d.id) { $('#copiaLlista').innerHTML = files_; return; }
  estat.copia = { id: d.id };
  obreFull(`<h3>Copia d'un altre disc</h3><p>${esc(d.titol)} · ${esc(d.art)}. A dalt, els seus; per a un altre, cerca'l.</p>
    <label class="camp"><span>Cerca a tot l'arxiu</span><input id="inCopia" type="text" autocomplete="off" value="${esc(filtre)}"></label>
    <div class="canals" id="copiaLlista">${files_}</div>`, true);
  tornaA(d.id);
  const i = $('#inCopia'); if (i) i.oninput = () => fullCopiaTria(d, i.value);
}
function fullCopia(d, de) {
  const items = FX.copiable(db(), de), o = db().exec('SELECT a.titol FROM album a WHERE a.id = ' + (+de))[0]?.values[0][0] || '';
  estat.copia = { id: d.id, de };
  obreFull(`<h3>Què es copia</h3><p>De «${esc(o)}» a «${esc(d.titol)}». El gènere, el llenguatge, la formació, la veu i l'estació substitueixen; els subgèneres, els tags i els idiomes se sumen.</p>
    ${items.length ? `<div class="copia-caselles">${items.map(x => `<label class="camp" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-clau="${esc(x.clau)}" ${x.marcat ? 'checked' : ''}><span>${esc(x.txt)}</span></label>`).join('')}</div>
      <p class="gris" style="font-size:12px">Amor, Acompanyat, Absorbeix i En directe surten desmarcats: marca'ls només si també valen per a aquest disc.</p>
      <div class="barra-accions" style="position:static;padding:8px 0 0"><button class="bt principal" data-fescopia="${d.id}|${+de}">Copia</button></div>`
      : '<p class="gris">Aquest disc no té res per copiar.</p>'}`, true);
  tornaA(d.id);
}
// La pregunta en sortir de rotació (ACT-771): després de la nota, i només si l'artista és preferent.
function preguntaSortida(id) {
  const d = D.fitxa(db(), id); if (!d) return;
  const pid = FX.preferentDe(db(), d.artista_id); if (!pid) return;
  const pr = PR.properDe(db(), d.artista_id);   // ACT-812 (1.2): si ja té proper, primer aquest
  obreFull(`<h3>I ara, de ${esc(d.art)}?</h3>${pr ? `<div class="marcador"><p class="cita">El proper: ${esc(pr.proper_titol)}.</p><p>El que havies decidit escoltar després.</p>
      <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-posaproper="${pr.id}">Posa'l en rotació</button>
        <button class="bt" data-escproper="${pr.id}">Escoltar ara</button></div></div><p>O un altre, comptat des de ${esc(d.titol)}:</p>`
      : `<p>${esc(d.titol)} ha sortit de rotació. El disc anterior o el següent, comptat des d'aquest, passa a ser el proper.</p>`}
    <div class="canals"><button data-veisortida="${pid}:ant:${d.album_id}">◀ Disc anterior <small>des de «${esc(d.titol)}»</small></button>
      <button data-veisortida="${pid}:seg:${d.album_id}">Disc següent ▶ <small>des de «${esc(d.titol)}»</small></button></div>
    <div class="barra-accions" style="position:static;padding:8px 0 0"><button class="bt discret" data-tornafull="1">Ara no</button></div>`);
}
function fullVeiDe(partida, dir, v) {
  const quin = dir === 'seg' ? 'següent' : 'anterior';
  estat.vei = { ...v, dir, partida, candidats: [] };
  obreFull(`<h3>El disc ${quin}</h3><p>${esc(partida.art)} · des de «${esc(partida.titol)}»</p>
    ${v.pid ? substitueix(D.partidesVei(db(), v.pid)) : `<p>El que triïs passa a ser el proper, i ${esc(partida.art)} entra a Artistes Preferents.</p>
      <div class="canals"><button data-veinou="${dir === 'seg' ? 'ant' : 'seg'}">${dir === 'seg' ? '◀ Vull l\'anterior' : 'Vull el següent ▶'} <small>des de «${esc(partida.titol)}»</small></button></div>`}
    <div class="canals" id="veins"><p class="subtitol">Cercant…</p></div>`, true);
  cercaVei();
}
// «fa X», per a la marca «Per afinar» (ACT-686): el símptoma de la ACT-676 es llegeix en aquesta xifra.
function fa(iso) {
  const q = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / DIA);
  return q <= 0 ? 'avui' : q === 1 ? 'ahir' : q < 14 ? `fa ${q} dies` : q < 60 ? `fa ${Math.floor(q / 7)} setmanes` : `fa ${Math.floor(q / 30)} mesos`;
}
// «Més…» (ACT-734): el que es fa poc, fora de la vista. Preferents, la pregunta d'identitat com a acció (ACT-658, opció B) i
// esborrar. Una fitxa amb parts no es junta ni es fa part d'una altra (ACT-664; les parts són d'un sol nivell, §8.4).
function fullMes(d) {
  const jaPref = D.preferents(db()).some(p => p.artista_id === d.artista_id);
  obreFull(`<h3>Més</h3><p>${esc(d.titol)} · ${esc(d.art)}. El que fas poc, fora de la vista.</p>
    <div class="canals mes-ll">
      ${jaPref ? '' : `<button data-fespref="${d.artista_id}">Afegir a Artistes Preferents <small>${esc(d.art)}</small></button>`}
      ${d.parts.length ? '' : `<button data-juntar="${d.id}">Un que ja tinc amb un altre nom <small>juntar dues fitxes</small></button>
        <button data-espart="${d.id}">És part d'un que ja tinc <small>una caixa</small></button>`}
    </div>
    ${blocEsborra(d)}`, true);
  tornaA(d.id);
}
// La fulla dels tags (ACT-734): els mateixos dos grups d'abans, que abans eren a la fitxa. Cada toc es desa.
function fullTags(d) {
  obreFull(`<h3>Els tags</h3><p>${esc(d.titol)} · ${esc(d.art)}</p>${blocTags(d)}
    <p class="gris" style="font-size:12px;margin-top:12px">El botó surt taronja mentre falti la veu, o l'idioma si és «amb veu». La resta de tags no ho pot saber: no marcar-ne cap és una resposta vàlida.</p>`, true);
  tornaA(d.id);
}

// ───────── «Escoltes» a la fitxa (ACT-736) ─────────
// Totals a dalt i la llista, de la més recent a la més antiga, amb context, atenció, completitud i «a mitges». Tocar una
// escolta deixa corregir el context i l'atenció de cada tros (Ricard: «asi puedo retocar cosas de la safata que tal vez puse
// mal y ya no he vuelto a ver»). Compleix el símptoma escrit per a la fila del grup de l'Historial: el total va a la fitxa.
const pct = x => Math.round(Math.min(x, 1) * 100) + ' %';
const ctxTxt = t => t.context ? esc(t.context) + (t.atencio && t.atencio !== 'Efectes plens' && t.context !== 'Dormir' ? ' · ' + esc(t.atencio) : '') : '<i>sense contestar</i>';
function textEscolta(x) {
  const n = x.trossos.length;
  return x.compta ? (x.sencera ? 'sencera' : 'compta · ' + pct(x.cobertura)) + (n > 1 ? `, en ${n} trossos` : '') : 'a mitges · ' + pct(x.cobertura);
}
function fullEscoltes(d) {
  const r = E.escoltesDeLEdicio(db(), d.id);
  const dia_ = iso => new Date(iso).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
  obreFull(`<h3>Les escoltes</h3><p>${esc(d.titol)} · ${esc(d.art)}${d.min ? ' · ' + d.min + '′' : ''}</p>
    <div class="esc-total"><div><b>${r.compten}</b>${r.compten === 1 ? 'escolta' : 'escoltes'}</div><div><b>${r.mitges}</b>a mitges</div>
      <div><b>${r.darrera ? fa(r.darrera.data) : '—'}</b>la darrera${r.darrera && !r.darrera.compta ? ' · a mitges' : ''}</div></div>
    <div class="canals" style="margin:10px 0"><button data-escoltama="${d.id}">＋ Apunta una escolta <small>a mà: un CD, un vinil o streaming sense ListenBrainz</small></button></div>
    ${r.escoltes.length ? `<ul class="esc-llista">${r.escoltes.map(x => `<li><div class="esc-fila ${x.compta ? '' : 'mitges'}">
      <span class="q">${dia_(x.data)}<small>${hm(x.data)}</small></span>
      <span class="ctx">${textEscolta(x)}<small>${[...new Set(x.trossos.map(ctxTxt))].join(' + ')}${x.fisica ? ' · física' : x.ama ? ' · a mà' : ''}</small></span>
      <button class="modifica" data-corregeix="${d.id}|${x.u}">Modifica</button></div></li>`).join('')}</ul>`
      : '<p class="gris">Encara no n\'hi ha cap.</p>'}
    <p class="gris" style="font-size:12px;margin-top:10px">«Modifica» corregeix el context o l'atenció d'una escolta. Es torna a calcular: passar-la a Dormir canvia si compta.</p>`, true);
  tornaA(d.id);
}
// L'escolta a mà (obra II, ACT-839, ACT-840 2): CD, vinil o streaming (i el canal), l'inici «ara menys la durada», el context
// i l'atenció. Si ja hi ha una escolta de ListenBrainz del disc a prop d'aquesta hora, avisa i demana confirmar.
const dataLocal = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
function fullEscoltaMa(d) {
  const { min } = EM.duradaDe(db(), d.id), ini = EM.iniciPerDefecte(min);
  const perDefecte = d.formats.includes('vinil') && !d.formats.includes('CD') ? 'vinil' : d.formats.includes('CD') ? 'CD' : 'streaming';
  const apps = [...new Set([...Object.keys(CANALS), ...D.canalsPropis(db())])], app = d.app_escolta && apps.includes(d.app_escolta) ? d.app_escolta : 'amazon';
  estat.atencioMa = null;
  obreFull(`<h3>Apunta una escolta</h3><p>${esc(d.titol)} · ${esc(d.art)}${min ? ' · ' + min + '′' : ''}. Compta com el disc sencer.</p>
    <label class="camp"><span>Com</span><select id="selCanalMa">${EM.CANALS_MA.map(c => `<option value="${c}"${c === perDefecte ? ' selected' : ''}>${{ CD: 'CD', vinil: 'Vinil', streaming: 'Streaming' }[c]}</option>`).join('')}</select></label>
    <label class="camp" id="campAppMa"${perDefecte === 'streaming' ? '' : ' hidden'}><span>Canal</span><select id="selAppMa">${apps.map(a => `<option value="${esc(a)}"${a === app ? ' selected' : ''}>${esc(CANALS[a]?.nom || nomCanal(a))}</option>`).join('')}</select></label>
    <label class="camp"><span>Va començar</span><input id="inIniciMa" type="datetime-local" value="${dataLocal(ini)}"></label>
    <label class="camp"><span>Context</span><select id="selCtxMa"><option value="">—</option>${E.CONTEXTOS.map(c => `<option>${esc(c)}</option>`).join('')}<option>No ho sé</option></select></label>
    <div class="sf-chips" id="atencioMa">${E.ATENCIONS.map(([b]) => `<button data-atencioma="${esc(b)}">${b}</button>`).join('')}</div>
    <div id="avisDupMa" hidden></div>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desaescoltama="${d.id}">Apunta-la</button></div>`, true);
  $('#selCanalMa').onchange = e => { $('#campAppMa').hidden = e.target.value !== 'streaming'; };
  tornaA(d.id);
}
// Corregir una escolta: un bloc per tros, amb els contextos i, si cal, l'atenció (la pregunta 4 de la safata).
function fullCorregeix(edId, u) {
  const d = D.fitxa(db(), edId); if (!d) return;
  const x = E.escoltesDeLEdicio(db(), edId).escoltes.find(y => y.u === u);
  if (!x) { fullEscoltes(d); return; }
  const tmp = estat.corrAtencio;
  obreFull(`<h3>Corregeix l'escolta</h3><p>${esc(d.titol)} · ${new Date(x.data).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })} · ${textEscolta(x)}</p>
    ${x.trossos.map(t => `<div class="corr-tros"><p class="sf-q">${x.trossos.length > 1 ? `Tros de les ${hm(t.data_hora)} · ${pct(t.completitud ?? 0)} · ` : ''}ara: ${ctxTxt(t)}</p>
      ${tmp?.id === t.id ? `<p class="sf-pre">${esc(tmp.ctx)}: com ho escoltaves?</p><div class="sf-chips">${E.ATENCIONS.map(([b]) => `<button data-corratencio="${edId}|${u}|${t.id}|${esc(b)}">${b}</button>`).join('')}</div>`
        : `<div class="sf-chips">${[...E.CONTEXTOS, 'No ho sé'].map(c => `<button class="${t.context === c ? 'principal' : ''}" data-corrctx="${edId}|${u}|${t.id}|${esc(c)}">${esc(c)}</button>`).join('')}</div>`}
    </div>`).join('')}`, true);
  const b = $('#full .torna-full'); if (b) { delete b.dataset.tornafull; b.dataset.escoltesfitxa = edId; }
}

// ───────── el gènere a la fitxa (ACT-684; des de la v1.52, ACT-732 i ACT-733) ─────────
// La fulla del gènere: es toca en ordre (la primera és la principal), es reordena i es treu. Des de la ACT-732 cada toc és
// una escriptura i tornar a tocar és el desfés: desapareix «Desa'l». La fulla recorda en memòria el que s'hi ha tocat mentre
// és oberta (estat.gen): si treus «Clàssica» i la tornes a posar, els eixos tornen; si treus l'última branca, els subgèneres
// marxen de l'arxiu (no n'hi pot haver sense branca) i tornen en tocar una branca. Tancar la fulla oblida la memòria.
// Els subgèneres (ACT-733), a sota de les branques: els ja usats a l'arxiu més «＋ Altre». Sense arbre. Mai taronja.
function fullGenere(d) {
  const g = estat.gen?.id === d.id ? estat.gen : (estat.gen = { id: d.id, album_id: d.album_id, generes: [...d.generes], llenguatge: [...d.llenguatge],
    formacio: [...d.formacio], instrument: d.instrument_solista || '', subgeneres: [...(d.subgeneres || [])], vistos: [...(d.subgeneres || [])] });
  const xip = (attr, val, on, txt = val, cls = '') => `<button data-${attr}="${esc(val)}" class="${on ? 'triat' : ''} ${cls}" aria-pressed="${on}">${esc(txt)}</button>`;
  const cl = g.generes.includes(F.CLASSICA);
  // Els que s'han tocat en aquesta fulla es queden a la vista encara que ja no els tingui cap disc: tornar a tocar és el desfés.
  for (const x of g.subgeneres) if (!g.vistos.includes(x)) g.vistos.push(x);
  const subs = [...new Set([...g.vistos, ...F.subgeneresUsats(db())])];
  obreFull(`<h3>El gènere</h3><p>${esc(d.titol)} · ${esc(d.art)}</p>
    ${d.n_edicions > 1 ? `<p class="gris" style="font-size:11.5px;margin:2px 0 6px">És de l'àlbum: canvia a les ${d.n_edicions} edicions.</p>` : ''}
    ${!g.generes.length && (estat.comAltres = FX.generePelsAltres(db(), d.album_id)) ? `<div class="canals"><button data-comaltres="1">Com els altres de ${esc(d.art)} <small>${esc(estat.comAltres.generes.join(' · '))}</small></button></div>` : ''}
    <h4 class="gen-eix">Ordre <small>· la primera és la principal</small></h4>
    <div class="gen-triats">${g.generes.map((x, i) => `<div class="gen-triat"><span>${i + 1}. ${esc(x)}</span>
      ${i ? `<button class="mes" data-genamunt="${i}" aria-label="Puja ${esc(x)}">↑</button>` : ''}<button class="mes" data-gentreu="${i}" aria-label="Treu ${esc(x)}">✕</button></div>`).join('') || '<p class="gris">Encara cap. Toca una branca.</p>'}</div>
    <h4 class="gen-eix">Branques</h4>
    <div class="chips gen-branques">${[...new Set([...BR.branques(db()), ...g.generes])].map(b => BR.esNova(b)
        ? `<span class="sub-amb-llapis">${xip('genbr', b, g.generes.includes(b))}<button class="llapis" data-renombranca="${esc(b)}" aria-label="Canvia el nom de ${esc(b)}">✎</button></span>`
        : xip('genbr', b, g.generes.includes(b))).join('')}
      <button class="mes" data-altrabranca="1">＋ Altra branca</button></div>
    ${cl ? `<h4 class="gen-eix">Llenguatge</h4><div class="chips">${F.LLENGUATGES.map(v => xip('genll', v, g.llenguatge.includes(v))).join('')}</div>
      <h4 class="gen-eix">Formació</h4><div class="chips">${F.FORMACIONS.map(v => xip('genfo', v, g.formacio.includes(v))).join('')}</div>
      ${g.formacio.includes(F.INSTRUMENT_SOL) ? `<label class="camp"><span>Instrument solista <small>(opcional)</small></span><input id="inInstrument" type="text" autocomplete="off" value="${esc(g.instrument)}" placeholder="p. ex. piano"></label>` : ''}` : ''}
    <h4 class="gen-eix">Subgèneres <small>· opcionals, sense arbre</small></h4>
    ${g.generes.length ? `<div class="chips gen-subs">${subs.map(s => `<span class="sub-amb-llapis">${xip('gensub', s, g.subgeneres.includes(s), s, 'sub')}<button class="llapis" data-renomsub="${esc(s)}" aria-label="Canvia el nom de ${esc(s)}">✎</button></span>`).join('')}
        <button class="mes" data-altresub="1">＋ Altre</button></div>`
      : '<p class="gris" style="font-size:12.5px">Primer una branca: sense branca, el disc no sortiria quan la demanis.</p>'}
    <p class="gris desat-toc">Cada toc es desa al moment. Tornar a tocar és el desfés.</p>`, true);
  tornaA(d.id);
  const i = $('#inInstrument'); if (i) i.onchange = () => tocaGenere(g2 => { g2.instrument = i.value; });
}
// Canviar el nom d'un subgènere (ACT-742, 3), des del llapis ✎ del costat de cada un (descartat mantenir premut: no es veu i
// xoca amb la selecció de text). Canvia Àlbum.Subgèneres a tots els àlbums que el porten. Si el nom nou ja és un altre
// subgènere, tots dos es fonen: abans es diu, i no hi ha «Desfés» automàtic. Consequència acceptada: un subgènere que no
// porta cap disc desapareix de la llista.
function fullRenomSub(vell, avisFusio = null) {
  const g = estat.gen; if (!g) return;
  const n = F.albumsAmbSubgenere(db(), vell);
  obreFull(`<h3>El nom del subgènere</h3><p>Ara es diu <b>${esc(vell)}</b>${n ? ` · ${n === 1 ? 'un disc el porta' : n + ' discos el porten'}` : ''}. Canvia a tots els discos.</p>
    ${avisFusio ? `<div class="avis-durada"><b>«${esc(avisFusio.nom)}» ja existeix.</b> Si continues, els dos es fonen en «${esc(avisFusio.nom)}» a tots els discos, i no es pot desfer amb un toc.</div>
      <div class="barra-accions" style="position:static;padding:10px 0 0"><button class="bt principal" data-fonsub="1">Fon-los</button><button class="bt discret" data-renomsub="${esc(vell)}">Torna</button></div>`
    : `<label class="camp"><span>Nom nou</span><input id="inRenomSub" type="text" autocomplete="off" value="${esc(vell)}"></label>
      <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-desarenomsub="1">Canvia el nom</button></div>`}`);
  estat.renomSub = { vell, nou: avisFusio ? avisFusio.escrit : null };
  const b = $('#full .torna-full'); if (b) { delete b.dataset.tornafull; b.dataset.tornagenere = g.id; }
  setTimeout(() => $('#inRenomSub')?.select(), 30);
}
function reanomenaSub(vell, nou) {
  const g = estat.gen; if (!g) return;
  const r = F.fusioSubgenere(db(), vell, nou);
  fes(F.reanomenaSubgenere(vell, nou), x => x.fos ? `Fosos: tot és «${x.nom}» (${x.albums === 1 ? 'un disc' : x.albums + ' discos'}).` : `Ara es diu «${x.nom}»${x.albums ? ` (${x.albums === 1 ? 'un disc' : x.albums + ' discos'})` : ''}.`, { desfes: false });
  const k = F.clauSubgenere(vell), canvia = l => [...new Map(l.map(s => F.clauSubgenere(s) === k ? (r?.nom || s) : s).map(s => [F.clauSubgenere(s), s])).values()];
  g.subgeneres = canvia(g.subgeneres); g.vistos = canvia(g.vistos);
  estat.renomSub = null;
  const d = D.fitxa(db(), g.id); if (d) { fullGenere(d); }
}
// El ✎ d'una branca nova (ACT-809 a): canviar-li el nom o fondre-la amb una altra.
function fullRenomBranca(vell) {
  const g = estat.gen; if (!g) return;
  estat.renomBranca = vell;
  const n = BR.albumsAmbBranca(db(), vell);
  obreFull(`<h3>Canvia el nom de la branca</h3><p>«${esc(vell)}» · ${n === 1 ? 'un disc' : n + ' discos'}. Canvia a tots. Si el nom nou ja és una altra branca, es fonen.</p>
    <label class="camp"><span>Nom nou</span><input id="inRenomBranca" type="text" autocomplete="off" value="${esc(vell)}"></label>
    <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-desarenombranca="1">Canvia el nom</button></div>`);
  const b = $('#full .torna-full'); if (b) { delete b.dataset.tornafull; b.dataset.tornagenere = g.id; }
  setTimeout(() => $('#inRenomBranca')?.select(), 30);
}
function tocaGenere(fn) {
  const g = estat.gen; if (!g) return;
  const i = $('#inInstrument'); if (i) g.instrument = i.value;
  fn(g);
  fes(F.desaGenere(g.album_id, g), null, { desfes: false });   // ACT-732: s'escriu ja; el Drive es desa en segon pla
  const d = D.fitxa(db(), g.id); if (d) fullGenere(d);
}
// ───────── la pregunta d'identitat (ACT-658 a ACT-670, ACT-680, ACT-685) ─────────
const escoltesTxt = n => n === 1 ? 'una escolta' : `${n} escoltes`;
// El selector (ACT-670): a dalt els discos del mateix artista; a sota, el cercador de tot l'arxiu.
function fullTriaIdentitat(d, mode, filtre = '') {
  const { mateix, altres } = F.candidatesIdentitat(db(), d.id), f = norm(filtre);
  const attr = mode === 'junta' ? 'juntaamb' : 'espartamb';
  const fila = x => `<div class="membre"><button class="txt" data-${attr}="${d.id}|${x.id}">
      <b>${esc(x.titol)}</b><small>${esc(x.art)}${x.nom_edicio ? ' · ' + esc(x.nom_edicio) : ''} · ${x.durada_total}′ · ${escoltesTxt(x.escoltes)} · ${x.ambTags ? 'amb tags' : 'sense tags'}${x.n_parts ? ` · caixa de ${x.n_parts} parts` : ''}${x.rotacio_actual ? ' · en rotació' : ''}</small></button></div>`;
  const al = f ? altres.filter(x => x.cerca.includes(f)).slice(0, 40) : [];
  obreFull(`<h3>${mode === 'junta' ? 'Un que ja tinc amb un altre nom' : 'És part d\'un que ja tinc'}</h3>
    <p>${mode === 'junta' ? `«${esc(d.titol)}» desapareix, i el disc que triïs es queda amb les escoltes, el que la safata recorda i les notes de tots dos.`
                          : `«${esc(d.titol)}» passa a ser una part del disc que triïs. Tria la caixa.`}</p>
    <h4 class="ag-cap">Del mateix artista</h4><div class="llista-grup" id="identMateix">${mateix.map(fila).join('') || '<p class="gris">Cap altre disc seu a l\'arxiu.</p>'}</div>
    <label class="camp"><span>Busca a tot l'arxiu</span><input id="inIdentitat" type="search" value="${esc(filtre)}" placeholder="artista o títol" autocomplete="off"></label>
    <div class="llista-grup" id="identAltres">${al.map(fila).join('') || (f ? '<p class="gris">Res amb aquest nom.</p>' : '')}</div>`, true);
  const i = $('#inIdentitat'); if (i) i.oninput = () => { const pos = i.selectionStart; fullTriaIdentitat(d, mode, i.value); const j = $('#inIdentitat'); j.focus(); j.setSelectionRange(pos, pos); };
}
const resumDisc = x => `${x.nom_edicio ? esc(x.nom_edicio) + ', ' : ''}${x.durada_total}′`;
// Juntar: confirmació, o l'avís del doble (ACT-680, 2), que no bloqueja.
function fullConfirmaJunta(de, a, doble = false) {
  const x = D.fitxa(db(), de), y = D.fitxa(db(), a); if (!x || !y) return;
  const n = F.escoltesPerEdicio(db());
  obreFull(`<h3>${doble ? 'Dura molt més: no serà una part d\'aquest?' : `Juntar «${esc(x.titol)}»?`}</h3>
    ${doble ? `<p>«${esc(y.titol)}» dura ${y.durada_total}′ i «${esc(x.titol)}» ${x.durada_total}′, més del doble. Si és una caixa sense parts, «${esc(x.titol)}» n'és un disc.</p>` : ''}
    <p><b>Desapareix:</b> ${esc(x.titol)} · ${esc(x.art)} · ${resumDisc(x)} · ${escoltesTxt(n.get(de) || 0)}${x.nota ? ' · amb nota' : ''}${x.rotacio_actual ? ' · en rotació' : ''}</p>
    <p><b>Es queda:</b> ${esc(y.titol)} · ${esc(y.art)} · ${resumDisc(y)} · ${escoltesTxt(n.get(a) || 0)}${y.nota ? ' · amb nota' : ''}${y.rotacio_actual ? ' · en rotació' : ''}</p>
    <p class="gris" style="font-size:12.5px">Les escoltes, el que la safata recorda, les notes, els formats i els codis passen a la que es queda. Tens «Desfés».</p>
    <div class="barra-accions" style="position:static;padding:4px 0 0">
      ${doble ? `<button class="bt principal" data-espartamb="${de}|${a}">És part d'aquest</button><button class="bt" data-juntasi="${de}|${a}">No, junta'ls</button>`
              : `<button class="bt principal" data-juntasi="${de}|${a}">Sí, junta'ls</button><button class="bt discret" data-tornafull="1">No</button>`}
    </div>`, true);
}
// «És part d'un que ja tinc», segon pas: una part que ja hi és, o una de nova amb el número que escriu Ricard (ACT-669).
function fullEsPartDe(de, a, desDeJuntar = false) {
  const x = D.fitxa(db(), de), y = D.fitxa(db(), a); if (!x || !y) return;
  const ps = F.partsDe(db(), a), nota = F.notaQueNoPassa(db(), de, a), notaNom = nota === null ? null : (D.ESCALA.find(e => e[1] === nota)?.[0] || nota);
  obreFull(`${desDeJuntar ? `<p class="avis-caixa">És una caixa: fes servir «És part d'un que ja tinc». Ja és triada.</p>` : ''}
    <h3>«${esc(x.titol)}», part de «${esc(y.titol)}»</h3>
    <p>${ps.length ? `La caixa té ${ps.length} parts. Tria quina és, o afegeix-la com a part nova.` : `«${esc(y.titol)}» encara no té parts: aquesta serà la primera, i la caixa passa de bloc a caixa amb parts.`}</p>
    ${nota !== null ? `<p class="avis-caixa">La nota de ${esc(x.titol)} (${esc(notaNom)}) no passa a la caixa: la caixa conserva la seva.</p>` : ''}
    ${ps.length ? `<div class="parts-caixa">${ps.map(p => `<button class="part-fila tria-part" data-espartpart="${de}|${a}|${p.id}"><span class="mini">${p.numero}</span>
      <span class="txt"><b>${esc(p.nom || 'Part ' + p.numero)}</b><small>${p.durada ? p.durada + '′' : 'sense durada'}${p.rotacio_actual ? ' · viva' : ''}</small></span></button>`).join('')}</div>` : ''}
    <p style="margin:14px 0 6px"><b>Afegeix-la com a part nova</b> · amb els ${x.durada_total}′ de ${esc(x.titol)} com a durada.</p>
    <label class="camp"><span>Número de la part</span><input id="inNumPart" type="number" inputmode="numeric" min="1" value="${F.seguentLliure(db(), a)}"><span class="ajuda">El número és l'ordre dins la caixa i diu quina ve després: escriu el de debò, no el de l'escolta.</span></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-espartnova="${de}|${a}">Afegeix-la com a part nova</button></div>`, true);
}
// «Esborra aquest disc» (7-11): només quan el disc no ha deixat rastre (D.rastre). Si en té i no és en rotació, es diu
// què l'impedeix: llavors no s'ha d'esborrar sinó ajuntar, i això és la pregunta d'identitat de L'Afinació.
function blocEsborra(d) {
  const m = D.rastre(db(), d.id);
  if (!m.length) return `<div class="barra-accions" style="position:static;padding:18px 0 0"><button class="bt discret" data-esborradisc="${d.id}">Esborra aquest disc</button></div>`;
  if (d.rotacio_actual || m.includes('és en rotació')) return '';
  return `<p class="gris" style="font-size:12px;margin-top:16px">No es pot esborrar: ${esc(m.join(', '))}.</p>`;
}

// La caixa sencera a la fitxa (ACT-624): totes les parts, amb número, títol, durada i estat, i la portada de cada una.
// L'estat surt de Part.Rotació actual (viva) i Part.Data darrera escolta (escoltada); si no, pendent.
// La reixa i Tots els discos fan servir la portada de la part viva si en té; si no, la de la caixa.
function blocParts(d) {
  return `<h3 style="margin:4px 0 8px">La caixa · ${d.parts.length} parts</h3><div class="parts-caixa">${d.parts.map(p => {
    const est = p.rotacio_actual ? ['viva', 'viva'] : p.data_darrera_escolta ? ['escoltada', ''] : ['pendent', ''];
    const cob = p.portada || d.portada_edicio;
    return `<div class="part-fila"><span class="mini">${p.numero}${cob ? IMG(cob) : ''}</span>
      <span class="txt"><b>${esc(p.nom || 'Part ' + p.numero)}</b><small>${p.durada ? p.durada + '′' : 'sense durada'}${p.portada ? '' : cob ? ' · la portada de la caixa' : ''}</small>
        <button class="sf-link" style="padding:2px 0 0;font-size:12px" data-portadapart="${d.id}:${p.id}">canvia la portada</button></span>
      <span class="estat-part ${est[1]}">${est[0]}</span></div>`; }).join('')}</div>`;
}

// El nom d'un grup (ACT-520): el posa la màquina i Ricard el canvia. Es desa a meta; Àlbum.Conjunt no es toca.
function fullNomGrup(d) {
  const propi = D.nomsGrups(db())[d.conjunt], auto = titolAuto(d.conjunt, D.grup(db(), d.conjunt));
  estat.nomGrupDe = d.id;
  obreFull(`<h3>El nom del grup</h3><p>El que posa la màquina: <b>${esc(auto)}</b>.${propi ? ` Ara surt el teu: <b>${esc(propi)}</b>.` : ''} Si el grup es desfà, el nom es perd.</p>
    <label class="camp"><span>Nom</span><input id="inNomGrup" type="text" autocomplete="off" value="${esc(propi || auto)}"></label>
    <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-desanomgrup="1">Desa'l</button>
      ${propi ? `<button class="bt discret" data-nomgrupauto="1">Torna al de la màquina</button>` : ''}</div>`);
  setTimeout(() => $('#inNomGrup')?.select(), 30);
}

// Agrupar des de la fitxa (1-11): es busca l'altre disc a l'arxiu. Crear un grup, sumar-s'hi i treure'n un disc;
// la pestanya Agrupacions de La Prestatgeria (tram 6) ho farà tot amb més calma.
function fullAgrupa(d, filtre = '') {
  const tots = D.albumsPerAgrupar(db(), d.album_id), f = norm(filtre);
  const l = tots.filter(x => !f || norm(x.art + ' ' + x.titol).includes(f)).slice(0, 40);
  obreFull(`<h3>Agrupa «${esc(d.titol)}»</h3>
    <p>${d.conjunt ? `És al grup «${esc(titolGrup(d.conjunt, D.grup(db(), d.conjunt)))}». El disc que triïs s'hi suma al final.` : 'Tria l\'altre disc. Aquest serà el primer del grup, i el grup en portarà el nom.'}</p>
    <label class="camp"><span>Busca a l'arxiu</span><input id="inAgrupa" type="search" value="${esc(filtre)}" placeholder="artista o títol"></label>
    <div class="llista-grup">${l.map(x => `<div class="membre"><button class="txt" data-agrupaamb="${d.id}|${x.id}" ${x.conjunt && d.conjunt && x.conjunt !== d.conjunt ? 'disabled' : ''}>
      <b>${esc(x.titol)}</b><small>${esc(x.art)}${x.conjunt ? ' · grup «' + esc(x.conjunt) + '»' : ''}</small></button></div>`).join('') || '<p class="gris">Res amb aquest nom.</p>'}</div>`);
  const i = $('#inAgrupa'); if (i) { i.oninput = () => { const pos = i.selectionStart; fullAgrupa(d, i.value); const j = $('#inAgrupa'); j.focus(); j.setSelectionRange(pos, pos); }; }
}

// ───────── la nota a la fitxa (bloc 3.2 bis) ─────────
const nomNota = v => (D.ESCALA.find(([, x]) => x === v) || ['?'])[0];
const dia = iso => iso ? new Date(iso).toLocaleDateString('ca-ES', { dateStyle: 'short' }) : '';
function textNota(d) {
  if (d.nota) return esc(nomNota(d.nota.valor)) + ` <small class="gris">des del ${dia(d.nota.data)}</small>`;
  return d.data_darrera_pregunta_puntuacio ? 'encara no' : 'sense nota';
}
// Dos gestos quan ja hi ha nota (ACT-392, noms de Ricard del 31-10). Quan no n'hi ha, un de sol: «Posa-li nota».
function fullNota(d, mode) {
  estat.notaDe = d.id;
  if (!d.nota) mode = 'nova';
  const hist = d.notes.length > 1 ? `<p class="gris" style="font-size:12px;margin:0 0 12px">Abans: ${d.notes.slice(0, -1).map(n => esc(nomNota(n.valor)) + ' (' + dia(n.data) + ')').join(' → ')}</p>` : '';
  if (!mode) {
    obreFull(`<h3>La nota de ${esc(d.titol)}</h3><p>${esc(d.art)} · ara és <b>${esc(nomNota(d.nota.valor))}</b>, des del ${dia(d.nota.data)}.</p>${hist}
      <div class="canals">
        <button data-modenota="subst">Substitueix la nota actual <small>m'havia equivocat</small></button>
        <button data-modenota="nova">Afegeix una nota nova</button>
      </div>`);
    return;
  }
  const titol = !d.nota ? 'Posa-li nota' : mode === 'subst' ? 'Substitueix la nota actual' : 'Afegeix una nota nova';
  const peu = !d.nota ? '' : mode === 'subst' ? `<p class="gris" style="font-size:12px">La nota de ${dia(d.nota.data)} canvia de valor i es queda amb la seva data.</p>`
                                              : `<p class="gris" style="font-size:12px">La de ${dia(d.nota.data)} es queda a l'historial; la nova porta la data d'avui.</p>`;
  obreFull(`<h3>${titol}</h3><p>${esc(d.titol)} · ${esc(d.art)}</p>${hist}
    <div class="escala">${D.ESCALA.map(([n, v]) => `<button data-desanota="${mode}:${v}" class="${mode === 'subst' && d.nota?.valor === v ? 'triat' : ''}">${n}</button>`).join('')}</div>${peu}`);
}

// El canal, des de la fitxa: el mateix camp que «Un altre canal» (Edició.App d'escolta, ACT-232). Queda recordat.
function fullCanal(d) {
  sincroCanals();
  obreFull(`<h3>El canal de ${esc(d.titol)}</h3><p>Per on l'escoltes. El ▶ el farà servir a partir d'ara.</p>
    <div class="canals">${Object.keys(CANALS).map(k => `<button data-desacanal="${d.id}|${esc(k)}" class="${d.app_escolta === k ? 'triat' : ''}">${esc(CANALS[k].nom)}${d.app_escolta === k ? ' <small>ara</small>' : ''}${CANALS[k].propi ? ' <small>sense adreça</small>' : ''}</button>`).join('')}</div>
    <div class="sf-chips" style="margin-top:12px">${altreCanal(estat.altreCanalDe === 'disc:' + d.id, 'disc', d.id)}</div>`);
}

// ───────── els tags (bloc 3.2 bis, §6.3 i pregunta 11 del §8.10) ─────────
// Dos grups: el que és de l'àlbum (si el treus, marxa de totes les seves edicions) i el que és d'aquesta edició.
// Es veu el que ja hi ha marcat, i es pot treure: és un moment de revisió, no de captura (§8.10, pregunta 11).
function blocTags(d) {
  const st = T.llegeix(d.album_tags, d.tags);
  const xip = (attr, val, on, txt) => `<button data-${attr}="${esc(val)}" class="${on ? 'triat' : ''}" aria-pressed="${on}">${esc(txt)}</button>`;
  const altres = d.n_edicions > 1 ? `<p class="gris" style="font-size:11.5px;margin:2px 0 6px">Aquest àlbum té ${d.n_edicions} edicions: el que toquis aquí canvia a totes.</p>` : '';
  const idiomes = [...new Set([...D.idiomesUsats(db()), ...st.idiomes])];
  return `<div class="bloc-tags" id="blocTags" data-edicio="${d.id}">
    <div class="grup-tags"><h4>De l'àlbum</h4>${altres}
      <div class="chips">${T.SI_NO.filter(x => x.nivell === 'album').map(x => xip('tag', x.nom, st.si.has(x.nom), x.curt)).join('')}</div>
      <div class="fila-valor"><span>Veu</span><div class="chips">${T.VEU.valors.map(v => xip('veu', v, st.veu === v, v[0].toUpperCase() + v.slice(1))).join('')}</div></div>
      <div class="fila-valor"><span>Estació</span><div class="chips">${T.ESTACIO.valors.map(v => xip('estacio', v, st.estacio === v, v[0].toUpperCase() + v.slice(1))).join('')}</div></div>
      <div class="fila-valor"><span>Idioma</span><div class="chips">${idiomes.map(v => xip('idioma', v, st.idiomes.includes(v), v)).join('')}
        <button data-altreidioma="1" class="mes">＋ Altre idioma</button></div></div>
    </div>
    <div class="grup-tags"><h4>D'aquesta edició</h4>
      <div class="chips">${T.SI_NO.filter(x => x.nivell === 'edicio').map(x => xip('tag', x.nom, st.si.has(x.nom), x.curt)).join('')}</div>
    </div>
  </div>`;
}
// Cada toc s'escriu de seguida. Tornar a tocar-lo és el «Desfés».
function tocaTags(fn) {
  const caixa = $('#blocTags'); if (!caixa) return;
  const d = D.fitxa(db(), +caixa.dataset.edicio); if (!d) return;
  const r = fn(d); if (!r) return;
  fes(D.desaTags(d.id, d.album_id, r), null, { desfes: false });   // s'escriu ja; el Drive es desa en segon pla
  if (estat.sortint === d.id) estat.tagsSortida = { id: d.id, album_id: d.album_id, ...r };
  const nou = D.fitxa(db(), d.id);
  if (nou && $('#blocTags')) { $('#blocTags').outerHTML = blocTags(nou); }
}

// «Canvia l'edició» (ACT-308, ACT-466, ACT-467): triar una altra edició de l'àlbum, o crear-ne una. Si la que hi ha té
// escoltes, emparellaments o nota, es pregunta si eren de l'altra: sí = es corregeix l'error; no = només canvia la de rotació.
function fullEdicio(d) {
  const altres = E.altresEdicions(db(), d.id);
  obreFull(`<h3>Canvia l'edició</h3><p>${esc(d.titol)} · ${esc(d.art)} · ara: ${d.nom_edicio ? esc(d.nom_edicio) : 'sense nom'}, ${d.durada_total}′</p>
    ${altres.length ? `<div class="canals">${altres.map(x => `<button data-triaedicio="${d.id}:${x.id}">${x.nom_edicio ? esc(x.nom_edicio) : 'Sense nom'} <small>${x.durada_total}′${x.rotacio_actual ? ' · en rotació' : ''}</small></button>`).join('')}</div>` : ''}
    <p style="margin:14px 0 6px"><b>Una altra edició</b> · no és a l'arxiu. Com tot disc, demana la durada.</p>
    <label class="camp"><span>Nom de l'edició</span><input id="inEdNom" type="text" autocomplete="off" placeholder="p. ex. 25th Anniversary Edition"></label>
    <label class="camp"><span>Durada en minuts</span><input id="inEdMin" type="number" inputmode="numeric" min="1"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-novaedicio="${d.id}">Crea-la i canvia</button></div>`);
}
function preguntaCorreccio(de, a) {
  const d = D.fitxa(db(), de), n = D.fitxa(db(), a);
  if (!E.teRastre(db(), de)) { fes(E.canviaEdicio({ de, a, correccio: false }), `Ara és ${n.nom_edicio || 'l\'altra edició'}`); tancaFull(); return; }
  obreFull(`<h3>Les escoltes d'abans</h3><p>${esc(d.titol)}: les escoltes i la nota que té ${d.nom_edicio ? esc(d.nom_edicio) : 'aquesta edició'}, eren de ${n.nom_edicio ? esc(n.nom_edicio) : 'l\'altra'}?</p>
    <div class="canals">
      <button data-correccio="${de}:${a}:1">Sí, eren d'aquesta <small>es corregeix l'error: es mouen les escoltes, el que la safata recorda i la nota</small></button>
      <button data-correccio="${de}:${a}:0">No <small>només canvia la que tinc en rotació</small></button>
    </div>`);
}

function fullDurada(d) {
  obreFull(`<h3>${esc(d.viva?.nom || d.titol)}</h3><p>${esc(d.art)}${d.viva ? ' · durada de la part ' + d.viva.numero : ''}</p>
    <label class="camp"><span>Durada en minuts</span><input id="inDurada" type="number" inputmode="numeric" min="1" value="${d.min || ''}"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desadurada="${d.id}">Desa-la</button></div>`);
  setTimeout(() => $('#inDurada')?.select(), 50);
}

// La fulla de la nota en sortir de rotació (ACT-735), amb el taronja de les alertes, «asi la alerta es mas homogenea en el
// sentido de "aqui hay algo que completar"»: franja taronja, l'etiqueta «Surt de rotació» i l'escala més gran. Sense camp.
const nEscoltes = id => E.escoltesDeLEdicio(db(), id).compten;
function fullPuntuar(d, encara = true) {
  const n = nEscoltes(d.id);
  obreFull(`<span class="etiq-sortida">Surt de rotació</span><h3>Quina nota li poses?</h3><p>${esc(d.titol)} · ${esc(d.art)} · ${n === 1 ? 'una escolta' : n + ' escoltes'}</p>
    <div class="escala">${D.ESCALA.map(([n, v]) => `<button data-punt="${v}" data-id="${d.id}">${n}</button>`).join('')}</div>
    <div class="barra-accions" style="position:static;padding:0">
      <button class="bt" data-puntencara="${d.id}">Encara no</button>
      <button class="bt discret" data-torna="${d.id}">Torna'l a la rotació</button></div>
    <h3 style="margin-top:22px">Els tags</h3>${blocTags(D.fitxa(db(), d.id) || d)}`);
  $('#full').classList.add('nota-sortida');
  if (encara) $('#full').dataset.encaraNo = d.id;
  estat.sortint = d.id; estat.tagsSortida = null;
}

function fullPart(d) {
  const n = d.viva.numero, ultima = Math.max(...d.parts.map(p => p.numero));
  const nom = d.viva.nom || d.titol;
  if (n >= ultima) {
    fes(D.treu(d.id), `${d.titol} fora de rotació`, { abans: estat.abansSortida });
    obreFull(`<span class="etiq-sortida">Surt de rotació</span><h3>${esc(nom)}: quina nota li poses?</h3><p>Era l'última part de ${esc(d.titol)}. L'edició es tanca, i la nota d'una caixa arriba en tancar la caixa.</p>
      <div class="escala">${D.ESCALA.map(([k, v]) => `<button data-punt="${v}" data-id="${d.id}">${k}</button>`).join('')}</div>
      <div class="barra-accions" style="position:static;padding:0"><button class="bt" data-puntencara="${d.id}">Encara no</button></div>
      <h3 style="margin-top:22px">Els tags</h3>${blocTags(D.fitxa(db(), d.id) || d)}`);
    $('#full').classList.add('nota-sortida');
    $('#full').dataset.encaraNo = d.id; estat.sortint = d.id; estat.tagsSortida = null; return;
  }
  const seg = d.parts.find(p => p.numero === n + 1);
  if (!seg) {
    obreFull(`<h3>${esc(nom)} surt de rotació</h3>
      <p>És la part ${n} de ${d.parts.length} de ${esc(d.titol)}, i la ${n + 1} no està catalogada: la màquina no sap quin disc és ni quant dura. No se la pot inventar.</p>
      <div class="barra-accions" style="position:static;padding:0">
        <button class="bt principal" data-espera="${d.id}">Deixa ${esc(d.titol)} esperant</button>
        <button class="bt" data-treuedicio="${d.id}">Treu-ho tot de rotació</button></div>`);
    return;
  }
  obreFull(`<h3>${esc(nom)} surt de rotació</h3>
    <p>Aquí no es puntua: la nota viu a l'edició sencera. Arriba quan es tanqui ${esc(d.titol)}.</p>
    <p>Vols posar <em>${esc(seg.nom || 'la part ' + seg.numero)}</em> en rotació?</p>
    <div class="barra-accions" style="position:static;padding:0">
      <button class="bt principal" data-seguent="${d.id}:${seg.numero}">Sí, posa-la</button>
      <button class="bt" data-espera="${d.id}">No: deixa-la esperant</button>
      <button class="bt discret" data-treuedicio="${d.id}">Treu-ho tot</button></div>`);
}

function fullRepren(d) {
  obreFull(`<h3>Reprèn ${esc(d.titol)}</h3><p>Quina part poses en rotació? Pots triar també una que ja hagis escoltat.</p>
    <div class="canals">${d.parts.map(p => `<button data-reprenpart="${d.id}:${p.numero}">${esc(p.nom || 'Part ' + p.numero)} <small>${p.durada ? p.durada + '′' : 'sense durada'}</small></button>`).join('')}</div>`);
}

function fullAfegeixDisc(pre = null) {
  estat.nouCanal = pre?.canal || 'amazon';
  const botons = () => [...Object.keys(CANALS), ...Object.keys(NOMS_FISICS)]
    .map(k => `<button data-noucanal="${k}" class="${estat.nouCanal === k ? 'triat' : ''}">${CANALS[k]?.nom || NOMS_FISICS[k]}</button>`).join('');
  obreFull(`<h3>Posa un disc en rotació</h3>
    <p>Els discos que sonen arriben sols a la safata. Aquí en poses un a mà: un de físic, o un que encara no ha sonat. Cap disc entra sense durada: llegeix-la del disc o de l'app, no de memòria.</p>
    <label class="camp"><span>Artista</span><input id="inArt" type="text" autocomplete="off" value="${esc(pre?.art || '')}"></label>
    <label class="camp"><span>Títol</span><input id="inTit" type="text" autocomplete="off" value="${esc(pre?.tit || '')}"></label>
    <label class="camp"><span>Durada en minuts <small class="gris" id="fontMin"></small></span><input id="inMin" type="number" inputmode="numeric" min="1"><span class="ajuda">Si el disc ja té fitxa a l'arxiu, es queda la seva durada i aquí no cal res.</span></label>
    ${pre ? `<div class="canals"><button data-buscaa="1">Busca-ho a ${esc(nomCanal(estat.nouCanal))} <small>per validar la durada a l'app</small></button></div>` : ''}
    <div class="camp"><span>Per on l'escoltes</span></div>
    <div class="canals-tria" id="nousCanals">${botons()}</div>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desaama="1">Posa'l en rotació</button></div>`);
  estat.pintaCanals = () => { $('#nousCanals').innerHTML = botons(); };
  // ACT-812 (1.2 A): amb el proper, la durada que proposa MusicBrainz; la valida ell a l'app del canal.
  if (pre) PR.duradaMB(pre.art, pre.tit).then(x => { const m = $('#inMin'); if (x && m && !m.value) { m.value = x.minuts; $('#fontMin').textContent = '· ' + x.font + ', valida-la'; } });
  $('#inArt').addEventListener('change', e => {
    const a = D.trobaArtista(db(), e.target.value);
    if (a) { estat.nouCanal = D.canalPerDefecte(db(), a.id); estat.pintaCanals(); }
  });
  setTimeout(() => $('#inArt')?.focus(), 50);
}

// Canviar els noms (ACT-813): el títol de l'àlbum, el de l'edició i el de l'artista. Sense «suprimir».
function fullNoms(d) {
  obreFull(`<h3>Canvia els noms</h3><p>El títol és de l'àlbum (totes les edicions). El de l'artista canvia a tots els seus discos, i el vell es guarda per reconèixer les escoltes que arribin amb aquell nom.</p>
    <label class="camp"><span>Títol</span><input id="inNomTit" type="text" autocomplete="off" value="${esc(d.titol)}"></label>
    <label class="camp"><span>Nom de l'edició</span><input id="inNomEd" type="text" autocomplete="off" value="${esc(d.nom_edicio || '')}" placeholder="sense nom"></label>
    <label class="camp"><span>Artista</span><input id="inNomArt" type="text" autocomplete="off" value="${esc(d.art)}"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desanoms="${d.id}">Desa</button></div>`, true);
}
function fullProper(id) {
  const p = D.preferents(db()).find(x => x.id === id); if (!p) return;
  estat.properDe = id;
  obreFull(`<h3>El proper disc de ${esc(p.nom)}</h3>
    <p>El que has decidit escoltar primer. Només el títol: no entra a la rotació fins que l'hagis sentit.</p>
    <label class="camp"><span>Títol</span><input id="inProper" type="text" autocomplete="off" value="${esc(p.proper_titol || '')}"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desaproper="1">Desa'l</button></div>`);
  setTimeout(() => $('#inProper')?.focus(), 50);
}

// ───────── Segells Preferents (obra G, ACT-816, ACT-817, ACT-827) ─────────
// Com Artistes Preferents (7.1): la llista, el proper a mà o l'anterior i el següent per número de catàleg (segells.js),
// i la portada del disc del segell en rotació o, si no, de l'últim que ha sonat. Camps: segell_preferent.*, Edició.segell.
function pintaSegells() {
  const caixa = $('#segells'); if (!caixa) return;
  let ss; try { ss = SG.segellsPreferents(db()); } catch { caixa.innerHTML = ''; return; }
  // Obra IV (d): l'ordre triat (obra4.js); només Manual s'ordena a mà, com els Artistes Preferents (ACT-775).
  if (estat.ordenaSeg && estat.ordreSegTmp) ss = estat.ordreSegTmp.map(id => ss.find(s => s.id === id)).filter(Boolean);
  else ss = O4.ordenaSegells(ss);
  const manualSeg = O4.ordreSeg() === 'manual', selS = $('#ordreSeg');
  if (selS && selS.value !== O4.ordreSeg()) selS.value = O4.ordreSeg();
  if ($('#btOrdenaSeg')) $('#btOrdenaSeg').hidden = !manualSeg && !estat.ordenaSeg;
  caixa.classList.toggle('ordenant', !!estat.ordenaSeg);
  caixa.innerHTML = ss.map((s, i) => {
    const r = s.rot, cob = (r || s.darrer)?.portada || null;
    const linia = r ? `Ara estudies <em>${esc(r.titol)}</em> · ${esc(r.art)}` : s.proper_titol ? `El proper: <em>${esc(s.proper_titol)}</em>${s.proper_artista ? ' · ' + esc(s.proper_artista) : ''}`
      : s.darrer ? `L'últim: <em>${esc(s.darrer.titol)}</em>` : 'Encara no ha sonat res seu';
    // ACT-836 (e): amb logo (segell_preferent.retrat), el logo a l'esquerra i la portada del disc del segell al costat, com la
    // fila de l'artista; sense logo, com abans: la portada a l'esquerra.
    const foto = s.retrat || cob, alCostat = s.retrat && cob ? `<span class="cob-fila">${IMG(cob)}</span>` : '';
    return `<div class="fila fila-segell" data-filasegell="${s.id}">
      <button class="fila-cap" data-segell="${s.id}">
        <span class="foto quadrat segell ${s.retrat ? 'logo' : ''} ${r ? 'viu' : ''}">${esc(inicials(s.nom))}${foto ? IMG(foto) : ''}</span>
        <span class="fila-txt"><span class="nom">${esc(s.nom)}</span><span class="estat">${linia}</span></span>${alCostat}
      </button>${estat.ordenaSeg ? `<span class="mou">
        <button data-mouseg="${i}:-1" aria-label="Amunt" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button data-mouseg="${i}:1" aria-label="Avall" ${i === ss.length - 1 ? 'disabled' : ''}>▼</button></span>
        <button class="nansa" aria-label="Arrossega ${esc(s.nom)}">⠿</button>` : ''}</div>`;
  }).join('') || `<p class="subtitol" style="margin:12px 0 0">Encara no hi ha cap segell preferent.</p>`;
  I.omple(caixa);
}
function fullSegell(id, veins = null) {
  const s = SG.segellsPreferents(db()).find(x => x.id === id); if (!s) { tancaFull(); return; }
  const r = s.rot, ref = r || s.darrer;
  const canal = ref?.app_escolta || 'amazon';
  const pr = s.proper_titol ? `<div class="marcador"><p class="cita">El proper: ${esc(s.proper_titol)}${s.proper_artista ? ', de ' + esc(s.proper_artista) : ''}.</p>
      <p>Quan entri en rotació, la nota s'esborra.</p>
      <div class="barra-accions" style="position:static;padding:4px 0 0"><a class="bt principal" ${aAttrs(enllac(canal, { art: s.proper_artista || '', tit: s.proper_titol }))}>Busca'l a ${esc(nomCanal(canal))}</a>
      <button class="bt discret" data-segtreuproper="${s.id}">Treu-lo</button></div></div>` : '';
  const v = veins === 'buscant' ? `<p class="sf-pre">Buscant a MusicBrainz i, si cal, a Discogs…</p>`
    : veins?.error ? `<p class="sf-pre">${esc(veins.error)}</p>`
    : veins ? `<p class="sf-pre">Des de «${esc(veins.partida.titol)}» (núm. ${veins.partida.n}), segons ${esc(veins.font)}:</p>
      ${[['◀ Anterior', veins.anterior], ['Següent ▶', veins.seguent]].map(([t, e]) => e
        ? `<div class="marcador"><p class="cita">${t}: ${esc(e.titol)}</p><p>${esc(e.artista)} · ${esc(e.cataleg)}</p>
           <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt" data-segposaproper="${s.id}" data-art="${esc(e.artista)}" data-tit="${esc(e.titol)}">Posa'l de proper</button></div></div>`
        : `<p class="sf-pre">${t}: no n'hi ha cap a la llista.</p>`).join('')}` : '';
  obreFull(`<h3>${esc(s.nom)}</h3>
    <p class="subtitol">${r ? `Ara estudies ${esc(r.titol)} (${esc(r.art)}).` : s.darrer ? `L'últim que ha sonat: ${esc(s.darrer.titol)} (${esc(s.darrer.art)}).` : 'Encara no ha sonat res seu des que la màquina arrenca.'}
      ${s.n ? ` ${s.n === 1 ? 'Un disc' : s.n + ' discos'} a l'arxiu amb aquest segell.` : ''}</p>
    ${pr}
    <div class="canals" style="margin-top:12px">
      <button data-segvei="${s.id}">◀ Anterior i següent ▶ <small>pel número de catàleg</small></button>
      <button data-segpropma="${s.id}">${s.proper_titol ? 'Canvia el proper' : 'Tria el proper'} <small>a mà: artista i títol</small></button>
    </div>
    ${v}
    <div class="canals" style="margin-top:12px">
      <button data-seglogo="${s.id}">${s.retrat ? 'Canvia el logo' : 'Puja el logo'} <small>es desa al teu Drive; cap font el porta sol</small></button>
      ${s.retrat ? `<button data-segtreulogo="${s.id}">Treu el logo</button>` : ''}
    </div>
    <input type="file" id="inLogo" accept="image/*" hidden>
    <div class="barra-accions" style="position:static;padding:14px 0 0"><button class="bt discret" data-segtreu="${s.id}">Treu-lo de Segells Preferents</button></div>`);
  $('#inLogo').onchange = e => { const f = e.target.files?.[0]; if (f) pujaLogo(s, f); };
}
// El logo d'un segell pujat a mà (ACT-836 e): reduït, al Drive (carpeta «Retrats», com les fotos d'artista) i guardat al mòbil.
async function pujaLogo(s, fitxer) {
  if (!A.tePermis()) { avisa('Per pujar un logo cal estar connectat amb el Drive.'); return; }
  avisa('Pujant el logo…');
  try {
    const blob = await I.redueix(fitxer);
    const ref = 'drive:' + await A.pujaRetrat('Segell ' + s.nom, blob);
    await I.guardaJa(ref, blob);
    tancaFull(); fes(SG.posaLogo(s.id, ref), 'Logo de ' + s.nom + ' desat');
  } catch (e) { avisa('No s\'ha pogut pujar el logo: ' + e.message); }
}
function fullProperSegell(id) {
  const s = SG.segellsPreferents(db()).find(x => x.id === id); if (!s) return;
  obreFull(`<h3>El proper de ${esc(s.nom)}</h3>
    <label class="camp"><span>Artista</span><input id="inSegArt" type="text" autocomplete="off" value="${esc(s.proper_artista || '')}"></label>
    <label class="camp"><span>Títol</span><input id="inSegTit" type="text" autocomplete="off" value="${esc(s.proper_titol || '')}"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-segdesaproper="${s.id}">Desa'l</button></div>`);
  setTimeout(() => $('#inSegArt')?.focus(), 50);
}
function fullAfegeixSegell() {
  obreFull(`<h3>Afegeix un segell</h3>
    <p>Entra al capdavant de la llista. Escriu el nom com el vols veure: els discos hi casen pel segell de la seva fitxa.</p>
    <label class="camp"><span>Nom</span><input id="inSegell" type="text" autocomplete="off"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desasegell="1">Afegeix-lo</button></div>`);
  setTimeout(() => $('#inSegell')?.focus(), 50);
}
// ACT-836 (d): el desplegable porta només els Segells Preferents; «Un altre» escriu un segell qualsevol només en aquesta
// edició, i la casella «i fes-lo preferent» a més el crea a segell_preferent (entra a dalt). Consequència acceptada: un segell
// no preferent pot quedar escrit de dues maneres en discos diferents sense avís.
function fullSegellFitxa(id) {
  const sg = SG.segellDe(db(), id) || '', prefs = SG.nomsPreferents(db());
  const casa = prefs.find(n => E.norm(n) === E.norm(sg)), altre = !!sg && !casa;
  obreFull(`<h3>Segell</h3>
    <p>El de l'edició. Mai el posa la màquina per deducció: tu, o la tasca de Bandcamp quan la pàgina és la d'un segell.</p>
    <label class="camp"><span>Segell</span><select id="selSegFitxa">
      <option value=""${!sg ? ' selected' : ''}>cap</option>
      ${prefs.map(n => `<option value="${esc(n)}"${n === casa ? ' selected' : ''}>${esc(n)}</option>`).join('')}
      <option value="__altre"${altre ? ' selected' : ''}>Un altre…</option></select></label>
    <div id="segAltre"${altre ? '' : ' hidden'}>
      <label class="camp"><span>Un altre</span><input id="inSegFitxa" type="text" autocomplete="off" value="${altre ? esc(sg) : ''}"></label>
      <label class="camp" style="display:flex;gap:8px;align-items:center"><input id="chkSegPref" type="checkbox"><span>i fes-lo preferent <small>entra a dalt de Segells Preferents</small></span></label>
    </div>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desasegellfitxa="${id}">Desa'l</button></div>`);
  $('#selSegFitxa').onchange = e => { const a = e.target.value === '__altre'; $('#segAltre').hidden = !a; if (a) setTimeout(() => $('#inSegFitxa')?.focus(), 30); };
  tornaA(id);
}

function fullAfegeixArtista() {
  obreFull(`<h3>Afegeix un artista</h3>
    <p>Encara que no tingui cap disc. Entra al capdavant de la llista. Escriu-ne bé el nom: si ja és a l'arxiu (o en una variant), es fa servir el mateix.</p>
    <label class="camp"><span>Nom</span><input id="inNom" type="text" autocomplete="off"></label>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desaartista="1">Afegeix-lo</button></div>`);
  setTimeout(() => $('#inNom')?.focus(), 50);
}

function fullCabina() {
  const r = A.recomptes(), conn = !document.body.classList.contains('desconnectat');
  obreFull(`<div class="menu-net"><h3>La Cabina</h3>
    <ul class="dades-arxiu">
      <li><span>Arxiu</span><span>${A.NOM_CARPETA} / ${A.NOM_ARXIU}</span></li>
      <li><span>Drive</span><span class="${conn ? 'ok' : 'mal'}">${conn ? 'connectat' : 'sense connectar'}</span></li>
      <li><span>Estat</span><span class="${A.estat.pendent ? 'mal' : 'ok'}">${A.estat.pendent ? 'pendent de desar' : 'desat'}</span></li>
      <li><span>Darrera versió al Drive</span><span>${hora(A.estat.base)}</span></li>
      <li><span>Integritat</span><span class="${A.comprovaIntegritat() === 'ok' ? 'ok' : 'mal'}">${A.comprovaIntegritat()}</span></li>
      <li><span>Estructura</span><span>versió ${A.versioEsquema()}</span></li>
      <li><span>Edicions · artistes · preferents</span><span>${r.edicio} · ${r.artista} · ${r.preferent}</span></li>
      <li><span>Escoltes · puntuacions</span><span>${r.escolta} · ${r.puntuacio}</span></li>
      <li><span>Pistes de ListenBrainz</span><span>${r.scrobble}</span></li>
    </ul>
    <ul class="llista-ajust">
      <li><button data-connecta="1">${conn ? 'Torna a obrir des del Drive' : 'Connecta amb el Drive'} <small>${conn ? 'baixa la versió del Drive' : 'cal per desar'}</small></button></li>
      ${A.estat.pendent && conn ? `<li><button data-desaara="1">Desa ara <small>prova-ho una altra vegada</small></button></li>` : ''}
      ${liniaPes()}
      ${(() => { const v = E.veredicte(db()); if (!v) return '';
        const pc = x => Math.round(x * 100) + ' %';
        return `<li><span class="ll-info">Prova de la safata <small>${v.llest
          ? `${v.falla ? '<b class="mal">no la passa</b>' : '<b class="ok">la passa</b>'} · «No ho sé» ${pc(v.pctNose)} de ${v.contestades} (màxim 33 %) · ignorades ${pc(v.pctIgnorades)} de ${v.targetes} (màxim 10 %)`
          : `el resultat surt el ${dia(v.dataLlesta)}, quan faci un mes`}</small></span></li>`; })()}
      <li><button data-ignorats="1">Artistes que s'ignoren sempre <small>${(n => n ? (n === 1 ? 'un' : n) + ' · obre la llista' : 'cap')(E.ignoraSempre(db()).length)}</small></button></li>
      <li><span class="ll-info">ListenBrainz <small>${E.arrencada(db()) ? 'les dues comptes, des del ' + dia(E.arrencada(db())) + ' · ' + r.scrobble + ' pistes' : 'encara no s\'ha llegit'}${estat.lbError ? ' · ' + esc(estat.lbError) : ''}</small></span></li>
      <li><span class="ll-info">Bústia de Bandcamp <small>${(b => !b ? 'encara no s\'ha mirat en aquesta sessió (cal connexió amb el Drive)'
        : (b.pendents === null ? '' : b.pendents ? (b.pendents === 1 ? 'un disc espera' : b.pendents + ' discos esperen') + ' codi; es busquen cada nit' : 'cap disc espera codi') + (b.apartats ? ` · ${b.apartats === 1 ? 'un apartat' : b.apartats + ' apartats'} (no trobats en ${B.NITS} nits)` : '')
          + (b.errors.length ? ` · <b class="mal">${esc(b.errors.join(' · ').slice(0, 160))}</b>` : ''))(estat.bustia)}</small></span></li>
      ${liniesCopia()}
      <li><a href="privadesa.html" target="_blank" rel="noopener">Política de privadesa <small>què surt d'aquest mòbil, i cap a on</small></a></li>
    </ul></div>`, true);
}

// El pes de l'arxiu a la vista (ACT-750 c1): taronja i vermell (15 i 25 MB des de l'obra III, ACT-840 1), sense frenar res.
function liniaPes() {
  const m = A.pes.mida, u = A.pes.pujada; if (!m) return '';
  const color = m >= A.PES_VERMELL ? 'mal' : m >= A.PES_TARONJA ? 'pes-taronja' : '';
  const mb = `L'arxiu pesa ${(m / 1e6).toLocaleString('ca', { maximumFractionDigits: 1 })} MB`;
  return `<li class="linia-pes"><span class="ll-info">Pes de l'arxiu <small>${color ? `<b class="${color}">${mb}</b>` : mb}${u ? ` · l'última pujada va trigar ${(u.ms / 1000).toLocaleString('ca', { maximumFractionDigits: 1 })} s` : ''}</small></span></li>`;
}

// ───────── la còpia de seguretat (tram 4, §3.5) ─────────
const diaD = d => d ? dia(d + 'T12:00:00Z') : '—';
const textBaixades = l => l.map(b => `${b.abans - b.ara} ${C.NOMS[b.taula]} menys`).join(' i ');
// L'exclamació vermella a La Cabina: més de 8 dies sense còpia (sense connexió, amb l'última data que ha vist aquest
// dispositiu, ACT-568), dades que han desaparegut, o una còpia que no s'ha pogut fer perquè l'arxiu no està sencer.
function alertaCopia() {
  if (!A.estat.db) return;
  document.body.classList.toggle('sense-copia', C.caducada() || !!C.alarma(db()) || !!estat.copiaError);
}
function liniesCopia() {
  const dv = C.darreraVista(), al = C.alarma(db());
  const propera = dv ? new Date(Date.parse(dv + 'T12:00:00Z') + C.CADA * 864e5).toISOString().slice(0, 10) : null;
  return `${copiant ? `<li><span class="ll-info">Fent la còpia… <small>l'arxiu i l'Excel, al Drive</small></span></li>` : ''}<li><span class="ll-info">Còpia de seguretat <small>${dv ? `la darrera, del ${diaD(dv)} · la propera, sola, a partir del ${diaD(propera)}` : 'encara no n\'hi ha cap'}${C.caducada() ? ' · <b class="mal">fa més de 8 dies</b>' : ''} · se'n guarden ${C.MANTENIR}</small></span></li>
    ${al ? `<li><span class="ll-info"><b class="mal">Han desaparegut dades</b><small>A la còpia del ${diaD(al.data)} hi ha ${textBaixades(al.baixades)} que a la del ${diaD(al.anterior)}. Això no hauria de baixar mai. La rotació s'ha aturat: les còpies d'abans són al Drive. Si no ho has fet tu, no toquis res i digues-ho a Claude.</small></span></li>
      <li><button data-alarmaok="1">D'acord, ho he vist <small>la propera còpia torna a rotar</small></button></li>` : ''}
    ${estat.copiaError ? `<li><span class="ll-info"><b class="mal">La darrera còpia no s'ha pogut fer</b><small>${esc(estat.copiaError)}</small></span></li>` : ''}
    <li><button data-copiaara="1">Fes-ne una ara <small>l'arxiu i l'Excel, al Drive</small></button></li>
    <li><button data-excel="1">Descarrega l'Excel <small>a aquest dispositiu</small></button></li>`;
}
async function despresDeCopia(r, manual) {
  if (!r) return;
  if (!r.feta) {
    if (r.integritat) estat.copiaError = r.motiu;
    if (manual && r.motiu) avisa('No s\'ha fet la còpia: ' + r.motiu + '.');
    alertaCopia(); return;
  }
  estat.copiaError = null;
  if (r.vermelles.length) await fes(C.posaAlarma({ data: r.data, anterior: r.anterior, baixades: r.vermelles }), null, { desfes: false, auto: true });
  if (r.nota.length) await fes(C.posaNota({ data: r.data, anterior: r.anterior, baixades: r.nota }), null, { desfes: false, auto: true });
  if (manual) avisa(r.vermelles.length ? 'Còpia feta, però han desaparegut dades: mira La Cabina.' : `Còpia de seguretat feta: l'arxiu i l'Excel, al Drive${r.paperera ? ` (${r.paperera === 1 ? 'una de vella' : r.paperera + ' fitxers vells'} a la paperera)` : ''}.`);
  alertaCopia();
}
// La còpia automàtica (ACT-566): en obrir i en tornar a primer pla, una consulta petita al Drive com a molt cada 15 minuts.
// Des de la ACT-750 (e), uns 10 s després d'obrir, amb la pantalla ja pintada i cap targeta a mitges (cap fulla oberta ni la
// pregunta de l'atenció a la safata): si n'hi ha, torna a mirar cada 5 s. Mentre es fa, La Cabina diu «Fent la còpia…».
// Si es tanca l'app a mitges, aquell dia no hi ha còpia i es torna a provar en obrir. El seu temps, a la prova de velocitat.
export const ESPERA_COPIA = 10e3;
let copiant = false, copiaMirada = 0, copiaEnEspera = null;
const aMitges = () => $('#full').classList.contains('obert') || !!document.querySelector('#s-safata.activa [data-sfatencio]');
async function copiaAuto() {
  if (copiaEnEspera || copiant || Date.now() - copiaMirada < 15 * 60e3) return;
  // primer, mirar (una consulta petita): l'exclamació es posa al dia de seguida, i si no toca còpia no s'espera res
  try { const cal = await C.toca(); alertaCopia(); if (!cal) { copiaMirada = Date.now(); return; } } catch { return; }
  if (copiaEnEspera || copiant) return;
  const prova = () => {
    if (aMitges()) { copiaEnEspera = setTimeout(prova, 5e3); return; }
    copiaEnEspera = null; copiaAutoAra();
  };
  copiaEnEspera = setTimeout(prova, +(sessionStorage.getItem('tria-banc-espera-copia') ?? ESPERA_COPIA));
}
async function copiaAutoAra() {
  if (copiant || Date.now() - copiaMirada < 15 * 60e3) return;
  copiaMirada = Date.now(); copiant = 'auto'; refrescaCabina();
  try { await despresDeCopia(await C.siToca(), false); }
  catch (e) { estat.copiaError = 'no s\'ha pogut fer: ' + e.message; alertaCopia(); }
  finally { copiant = false; refrescaCabina(); }
}
// La Cabina oberta es torna a pintar (la línia de la còpia).
function refrescaCabina() { if ($('#full').classList.contains('obert') && $('#full .menu-net')) fullCabina(); }
async function copiaAra() {
  if (copiant) { avisa('Ja s\'està fent una còpia.'); return; }
  copiant = 'ara'; avisa('Fent la còpia…');
  try { await despresDeCopia(await C.fes(), true); }
  catch (e) { estat.copiaError = 'no s\'ha pogut fer: ' + e.message; alertaCopia(); avisa('No s\'ha pogut fer la còpia: ' + e.message); }
  finally { copiant = false; if ($('#full').classList.contains('obert') && $('#full .menu-net')) fullCabina(); }
}
async function anysAlDia() {
  try { if (ANYS.calObrir(db())) { const r = await ANYS.recalculaAmbAnys({ avisa }); if (r.fet) avisa('Escoltes recalculades amb els fitxers d\'any.'); }
        await ANYS.mouMes(); } catch (e) { estat.anysError = e.message; } finally { estat.anysProgramat = false; }
}
async function descarregaExcel() {
  try {
    // ACT-841 (3): l'Excel descarregat porta les pistes de tots els anys, amb una barra de progrés (22/11, Ricard: «Mejor
    // la barra»): cada pas és un any baixat; el darrer, el fitxer. Cada any, més lent.
    let nAnys = 0;
    const t = await ANYS.ambTotsElsAnys(db(), (i, n, any) => { nAnys = n; PG.pinta(i - 1, n + 1, `Excel: afegint les pistes del ${any} (${i} de ${n})…`); });
    PG.pinta(nAnys, nAnys + 1, 'Excel: preparant el fitxer…');
    let b; try { b = await X.xlsx(t.db); } finally { t.tanca(); }
    PG.pinta(1, 1, 'Excel: preparant el fitxer…'); await new Promise(r => setTimeout(r, 300));   // que el 100 % es vegi
    const url = URL.createObjectURL(new Blob([b], { type: A.XLSX_MIME }));
    const a = document.createElement('a'); a.href = url; a.download = `la-meva-discoteca ${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60e3);
    avisa('Excel descarregat.');
  } catch (e) { avisa('No s\'ha pogut fer l\'Excel: ' + e.message); }
}

// La llista d'«Ignora sempre» (2-11): un botó a La Cabina que l'obre, i cada nom amb el seu «Treu-lo».
function fullIgnorats() {
  const l = E.ignoraSempre(db());
  obreFull(`<h3>S'ignoren sempre</h3>
    <p>Tot el que arriba amb un artista que comença per un d'aquests noms s'ignora sol i no compta al veredicte de la safata. Treure'n un val per al que arribi després: el que ja es va ignorar, s'hi queda.</p>
    ${l.length ? `<div class="llista-grup">${l.map(n => `<div class="membre"><span class="txt"><b>${esc(n)}</b></span>
      <button class="treu" data-treuignora="${esc(n)}">Treu-lo</button></div>`).join('')}</div>`
      : `<p class="gris">Cap. Es posa amb «Ignora sempre…» a una targeta de la safata.</p>`}
    <div class="barra-accions" style="position:static;padding:10px 0 0"><button class="bt discret" data-cabina="1">← La Cabina</button></div>`, true);
}
function fullLloc() {
  obreFull(`<h3>On ets?</h3>
    <p>La màquina només necessita saber si ets a Lleida, que és on hi ha els discos físics, a dalt i a baix. A qualsevol altre lloc, només streaming.</p>
    <div class="canals">
      <button data-lloc="Lleida">A Lleida <small>${estat.lloc === 'Lleida' ? 'ara · ' : ''}físic i streaming</small></button>
      <button data-lloc="Fora">Fora de Lleida <small>${estat.lloc === 'Fora' ? 'ara · ' : ''}només streaming</small></button>
      <button data-gps="1">Mira-ho per la ubicació <small>${esc(estat.gps)}</small></button>
    </div>`);
}

// ───────── el lloc (§12) ─────────
const LLEIDA = [41.6176, 0.6200];
function km(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180, dl = r(c - a), dg = r(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function posaLloc(v, nota) {
  estat.lloc = v; document.body.dataset.lloc = v; $('#llocTxt').textContent = v === 'Lleida' ? 'Lleida' : '';
  try { localStorage.setItem('tria-lloc', v); } catch {}
  if (nota !== false) avisa((v === 'Lleida' ? 'A Lleida: físic i streaming' : 'Fora de Lleida: només streaming') + (nota || ''));
}
function detectaLloc(manual) {
  if (!window.isSecureContext || !navigator.geolocation) { estat.gps = 'Aquest navegador no dona la ubicació.'; if (manual) { avisa(estat.gps); fullLloc(); } return; }
  navigator.geolocation.getCurrentPosition(p => {
    const v = km(p.coords.latitude, p.coords.longitude, LLEIDA[0], LLEIDA[1]) < 20 ? 'Lleida' : 'Fora';
    estat.gps = 'Mirat ara: ' + (v === 'Lleida' ? 'a Lleida' : 'fora de Lleida');
    if (v !== estat.lloc) posaLloc(v, ' (per la ubicació)'); else if (manual) avisa(estat.gps);
    if (manual) fullLloc();
  }, () => { estat.gps = 'Sense permís d\'ubicació: tria-ho a mà.'; if (manual) { avisa(estat.gps); fullLloc(); } },
  { timeout: 12000, maximumAge: 600000 });
}

// ───────── navegació ─────────
// El punt taronja de L'Afinació (ACT-769, opció A): sense número, encès sempre que la llista no és buida. Es calcula una mica
// després de pintar, una sola vegada per tanda de canvis, perquè la llista sencera no frena el toc.
let puntEnEspera = null;
// ACT-796: el punt ja no es recalcula a cada repintat (recórrer l'arxiu creix amb els anys, ACT-785): només en obrir l'arxiu
// (mostraMaquina, també en carregar-lo del Drive), després d'un canvi seu (fes sense auto) i en desfer.
let puntBrut = true;
function programaPunt() {
  clearTimeout(puntEnEspera);
  puntEnEspera = setTimeout(() => { const p = $('#afiPunt'); if (!p || !A.estat.db) return;
    try { p.hidden = !N.hiHaPerAfinar(db()); } catch { p.hidden = true; }
    p.dataset.calculs = (+p.dataset.calculs || 0) + 1; }, 120);   // quantes vegades s'ha calculat (el banc ho mira, ACT-796)
}
// L'Aparador (ACT-705): la pestanya del mig del Faristol, amb Artistes Preferents i Discos per escoltar. Obre la darrera
// subpantalla usada (ACT-706).
function aparador(v) {
  if (!N.SUBS_APARADOR.includes(v)) v = 'pref';
  if (estat.asub && estat.asub !== v) window.scrollTo(0, 0);
  estat.asub = v; N.apuntaAparador(v);
  N.SUBS_APARADOR.forEach(k => { $('#atab-' + k)?.setAttribute('aria-selected', v === k); $('#a-' + k)?.classList.toggle('activa', v === k); });
}
function vesA(sup) {
  estat.superficie = sup;
  document.querySelectorAll('.superficie').forEach(s => s.classList.toggle('activa', s.id === 's-' + sup));
  document.querySelectorAll('nav.peu button').forEach(b => {
    const act = b.dataset.anar === sup || (sup === 'artista' && b.dataset.anar === 'faristol');
    if (act) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  marcaEnrere();
}
// Obra VI (ACT-883 b, c): Inici i Tornar. On és ara, per tornar-hi; Tornar surt només amb un pas enrere, i no a la safata ni a la
// pantalla de l'artista, que porten el seu «← Tornar» (decisió de construcció, per ratificar: no dos Tornar a la mateixa pantalla).
const llocAra = () => ({ sup: estat.superficie, sub: estat.sub, psub: estat.psub });
function marcaEnrere() {
  const t = $('#btTornar'); if (t) t.hidden = !INI.hiHaEnrere() || ['artista', 'safata', 'entrada'].includes(estat.superficie);
  $('#btInici')?.setAttribute('aria-pressed', String(estat.superficie === 'inici'));
}
function anarA(sup, sb) {
  if ($('#full').classList.contains('obert')) tancaFull();
  vesA(sup);
  if (sup === 'faristol' && sb) sub(sb);
  if (sup === 'prestatgeria') { pintaPrestatgeria(); if (sb) psub(sb); }
}
function obreInici() { if (estat.superficie === 'inici') return; INI.empeny(llocAra()); anarA('inici'); }
function tornaEnrere() { const l = INI.treu(); if (!l) { marcaEnrere(); return; } anarA(l.sup, l.sup === 'faristol' ? l.sub : l.sup === 'prestatgeria' ? l.psub : null); }
addEventListener('popstate', () => { if (INI.hiHaEnrere()) tornaEnrere(); });
const SUBS = ['rot', 'pref', 'hist'];
function sub(v) {
  const de = SUBS.indexOf(estat.sub), a = SUBS.indexOf(v), p = $('#p-' + v);
  p.classList.remove('entra-dreta', 'entra-esquerra');
  if (a !== de) { void p.offsetWidth; p.classList.add(a > de ? 'entra-dreta' : 'entra-esquerra'); window.scrollTo(0, 0); }
  estat.sub = v;
  SUBS.forEach(k => { $('#tab-' + k).setAttribute('aria-selected', v === k); $('#p-' + k).classList.toggle('activa', v === k); });
}
function lliscar(el, llista = SUBS, actual = () => estat.sub, ves = sub) {
  let toc = null;
  el.addEventListener('touchstart', e => {
    toc = null; if (e.touches.length !== 1 || arros || e.target.closest('input,.nansa')) return;
    toc = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!toc || arros) return;
    const dx = e.changedTouches[0].clientX - toc.x, dy = e.changedTouches[0].clientY - toc.y; toc = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.6 * Math.abs(dy)) return;
    const i = llista.indexOf(actual()) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < llista.length) ves(llista[i]);
  }, { passive: true });
}

// ───────── els tocs ─────────
document.addEventListener('click', e => {
  const t = e.target.closest('button,a'); if (!t) return;
  const d = t.dataset;

  // Els enllaços d'escoltar naveguen sols; aquí només s'apunta l'obertura (opció C de l'ordre).
  if (t.tagName === 'A') {
    if (d.propi) { e.preventDefault(); avisa(`Obre-ho tu a ${d.propi}: la màquina no en té l'adreça.`); }
    if (d.obre) { const id = +d.obre; setTimeout(() => fes(D.obre(id), null), 0); if ($('#full').classList.contains('obert')) tancaFull(); }
    return;
  }
  if (t.disabled) return;
  const rot = id => D.edicio(db(), +id) || D.fitxa(db(), +id);

  if (d.tornafull) { tancaFull(); return; }
  if (t.id === 'avisBt') { const f = estat.ultima; estat.ultima = null; $('#avis').classList.remove('obert'); if (f) f(); return; }
  if (t.id === 'btConnecta' || d.connecta) { tancaFull(); connecta(true); return; }
  if (d.desaara) { tancaFull(); A.desaJa().then(r => { marcaDesat(r); if (r.desat) avisa('Desat al Drive.'); }); return; }
  if (t.id === 'btAjustos') { if (A.estat.db) fullCabina(); return; }
  if (t.id === 'btLloc') { fullLloc(); return; }
  if (d.lloc) { estat.gps = 'Triat a mà.'; posaLloc(d.lloc); tancaFull(); return; }
  if (d.gps) { estat.gps = 'Mirant…'; detectaLloc(true); return; }
  if (t.id === 'btInici') { if (A.estat.db) obreInici(); return; }
  if (t.id === 'btTornar') { if (INI.hiHaEnrere()) { try { history.back(); } catch { tornaEnrere(); } } else marcaEnrere(); return; }
  if (d.menu) { const [s, sb] = d.menu.split(':'); INI.empeny(llocAra()); anarA(s, sb || null); return; }
  if (t.id === 'btAfinacio') { if (!A.estat.db) return; if (estat.superficie === 'inici') INI.empeny(llocAra()); tancaFull(); vesA('prestatgeria'); if (estat.psub === 'afi') pintaPrestatgeria(); else psub('afi'); return; }
  if (d.asub) { aparador(d.asub); return; }
  if (d.novapila) { fullNovaPila(); return; }
  if (d.ctxnovapila) { const s = (estat.novaPilaCtx ||= new Set()); s.has(d.ctxnovapila) ? s.delete(d.ctxnovapila) : s.add(d.ctxnovapila); fullNovaPila(true); return; }
  if (d.desanovapila) { const nom = $('#inNovaPila')?.value, cx = [...(estat.novaPilaCtx || [])];
    if (!String(nom || '').trim()) { avisa('Posa-li nom.'); return; } if (!cx.length) { avisa('Tria almenys un context: per ell surten els discos de la Pila.'); return; }
    let id; fes(y => (id = P.creaPila(nom, cx)(y)), `Pila «${String(nom).trim()}» creada.`); estat.novaPilaCtx = null; tancaFull();
    try { localStorage.setItem(PILA, id); } catch {} pintaPiles(); return; }
  if (d.treupila) { const p = P.piles(db()).find(x => x.id === +d.treupila); if (!p) return; const n = P.entrades(db(), p.id).length;
    obreFull(`<h3>Treu la Pila «${esc(p.nom)}»?</h3><p>${n ? `Les seves ${n === 1 ? 'entrada' : n + ' entrades'} se'n van amb ella, també les ja escoltades.` : 'És buida.'} Tens «Desfés».</p>
      <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-treupilasi="${p.id}">Treu-la</button><button class="bt" data-tornafull="1">No</button></div>`); return; }
  if (d.treupilasi) { tancaFull(); fes(P.treuPila(+d.treupilasi), 'Pila treta.'); try { localStorage.removeItem(PILA); } catch {} pintaPiles(); return; }
  if (d.pila) { try { localStorage.setItem(PILA, d.pila); } catch {} pintaPiles(); return; }
  if (d.tocaentrada) { tocaEntrada(+d.tocaentrada); return; }
  if (d.edicionspila) { const x = P.entrades(db(), P.entrada(db(), +d.edicionspila)?.pila_id).find(e => e.id === +d.edicionspila); if (x) fullEdicionsPila(x); return; }
  if (d.afegeixpila) { fullAfegeixPila(+d.afegeixpila); return; }
  if (d.jaescoltats) { fullJaEscoltats(+d.jaescoltats); return; }
  if (d.afegeixtext) { const art = $('#pilaArt').value.trim(), tit = $('#pilaTit').value.trim();
    if (!art && !tit) { avisa('Escriu l\'artista i el títol.'); return; }
    tancaFull(); fes(P.afegeix(+d.afegeixtext, art, tit), r => r.album_id ? 'Afegit: és a l\'arxiu.' : 'Afegit com a text.'); return; }
  if (d.afegeixalbum) { const [pila, alb] = d.afegeixalbum.split(':').map(Number); tancaFull(); fes(P.afegeix(pila, null, null, alb), 'Afegit a la Pila.'); return; }
  if (d.afegeixapila) { fullTriaPila(+d.afegeixapila); return; }
  if (d.posaapila) { const [pila, ed] = d.posaapila.split(':').map(Number), x = rot(ed);
    if (x) { fes(P.afegeix(pila, null, null, x.album_id), 'Afegit a la Pila.'); const y = rot(ed); if (y) fullFitxa(y); } return; }   // ACT-813 (2.1): al moment, no quan acaba de desar
  if (d.treuentrada) { const ed = +d.fitxaed;
    fes(P.treu(+d.treuentrada), 'Tret de la Pila.', { desfes: false }); { const y = ed && rot(ed); if (y) fullFitxa(y); else tancaFull(); } return; }
  if (d.tornapila) { tancaFull(); fes(P.tornaALaPila(+d.tornapila), 'Torna a ser a la Pila, a dalt de tot.'); return; }
  if (t.id === 'btSafata') { if (!A.estat.db) return; if (estat.superficie !== 'safata') { estat.abansSafata = estat.superficie; N.apuntaAlcada('safata', { sup: estat.superficie }); } tancaFull(); vesA('safata'); pintaSafata(); llegeixEscoltes(); return; }
  if (d.tornasafata) { vesA(estat.abansSafata || 'faristol');
    if (estat.sotaSensePintar) {   // tornar a la pantalla de sota d'una safata recarregada (ACT-748): encara no s'ha pintat
      if (estat.superficie === 'prestatgeria') pintaPrestatgeria();
      if (estat.superficie === 'artista' && estat.artista) pintaArtista(estat.artista);
      I.omple(); delete estat.sotaSensePintar;
    }
    N.tornaAlcada('safata', { sup: estat.superficie });   // ACT-691: a la mateixa alçada
    return; }
  if (d.anar) { vesA(d.anar); if (d.anar === 'prestatgeria') pintaPrestatgeria(); return; }
  if (d.psub) { if ($('#full').classList.contains('obert')) tancaFull(); if (d.psub === 'tots') estat.rajola = null; psub(d.psub); return; }
  if (d.rajola) { estat.rajola = d.rajola; if (d.rajola === 'atzar') R.remena(); window.scrollTo(0, 0); pintaArxiu(); return; }
  if (d.rajoles) { estat.rajola = null; window.scrollTo(0, 0); pintaArxiu(); return; }
  if (d.ordreRj) { R.posaOrdreRajola(d.ordreRj, R.ordreRajola(d.ordreRj) === 'asc' ? 'desc' : 'asc'); pintaArxiu(); return; }
  if (d.sub) { if ($('#full').classList.contains('obert')) tancaFull(); sub(d.sub); return; }
  if (d.tornar) { vesA('faristol'); sub('pref'); aparador('pref'); N.tornaAlcada('artista', { sup: 'faristol', sub: 'pref' }); return; }   // ACT-691

  // Discos en Rotació
  if (t.id === 'btAfegeixDisc') { fullAfegeixDisc(); return; }
  if (d.noucanal) { estat.nouCanal = d.noucanal; estat.pintaCanals?.(); return; }
  if (d.desaama) {
    const art = $('#inArt').value.trim(), tit = $('#inTit').value.trim(), min = parseInt($('#inMin').value, 10);
    if (!art || !tit) { avisa('Calen l\'artista i el títol.'); return; }
    if ((!min || min < 1) && !D.trobaEdicio(db(), art, tit)) { avisa('Cap disc entra sense durada.'); return; }
    tancaFull(); vesA('faristol'); sub('rot');
    fes(D.posaEnRotacio({ art, tit, min, canal: estat.nouCanal }), r => r.nou ? `${tit} entra a Discos en Rotació` : `${tit} ja era a l'arxiu: torna a la rotació amb la seva fitxa`);
    return;
  }
  if (d.fitxa) { const x = rot(d.fitxa); if (x) fullFitxa(x); return; }
  if (d.agrupa) { const x = rot(d.agrupa); if (x) { fullAgrupa(x); tornaA(x.id); } return; }
  if (d.agrupaamb) { const [id, amb] = d.agrupaamb.split('|').map(Number); const x = rot(id); if (!x) return;
    // L'error (un disc que ja és d'un altre grup) es mira abans d'escriure: un canvi que llança no s'ha de desar.
    const amb_ = D.albumsPerAgrupar(db(), x.album_id).find(y => y.id === amb);
    if (amb_?.conjunt && x.conjunt && amb_.conjunt !== x.conjunt) { avisa(`«${amb_.titol}» ja és al grup «${amb_.conjunt}». Treu-lo'n primer.`); return; }
    let r; fes(y => { r = D.agrupa(x.album_id, amb)(y); }, () => `Agrupats al grup «${titolGrup(r.grup, D.grup(db(), r.grup))}»`);
    if (r?.grup) fullGrup(r.grup); else fullFitxa(rot(id)); return; }
  if (d.nomgrup) { const x = rot(d.nomgrup); if (x?.conjunt) fullNomGrup(x); return; }
  if (d.desanomgrup || d.nomgrupauto) { const x = rot(estat.nomGrupDe); if (!x?.conjunt) return;
    const nom = d.nomgrupauto ? null : $('#inNomGrup')?.value.trim();
    if (d.desanomgrup && !nom) { avisa('Cal un nom. Per tornar al de la màquina, «Torna al de la màquina».'); return; }
    fes(D.posaNomGrup(x.conjunt, nom), nom ? 'El grup es diu «' + nom + '»' : 'El grup torna a portar el nom de la màquina'); fullGrup(x.conjunt); return; }
  if (d.treugrup) { const x = rot(d.treugrup); if (!x) return; const id = x.id;
    const nomVist = x.conjunt ? titolGrup(x.conjunt, D.grup(db(), x.conjunt)) : '';
    let r; fes(y => { r = D.treuDelGrup(x.album_id)(y); }, () => r?.desfet ? `Grup «${nomVist}» desfet: només hi quedava un disc` : `${x.titol}, fora del grup`);
    if (r && !r.desfet) fullGrup(r.grup); else fullFitxa(rot(id)); return; }
  if (d.durada) { const x = rot(d.durada); if (x) { fullDurada(x); tornaA(x.id); } return; }
  if (d.desadurada) { const x = rot(d.desadurada), m = parseInt($('#inDurada').value, 10);
    if (!x) return; if (!m || m < 1) { avisa('Cap disc es queda sense durada.'); return; }
    // Les escoltes es calculen amb la durada (Escolta.completitud): en canviar-la, es tornen a calcular (ACT-582, Variant Immersions).
    tancaFull(); fes(y => { D.canviaDurada(x.id, m, x.viva?.id)(y); recalculaEdicio(y, x.id); }, `Durada: ${m}′`); return; }
  if (d.escoltar) { const x = rot(d.escoltar); if (!x) return; tancaFull();
    fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, bce: x.bce, fisic: x.fisic }); return; }
  if (d.altrecanal) { fullEscoltar(estat.escoltant, true); return; }
  if (d.canvicanal) {
    const x = estat.escoltant; if (!x) return;
    x.canal = d.canvicanal;
    if (x.id) fes(D.canviaCanal(x.id, x.canal), `Canal: ${CANALS[x.canal].nom}. Queda recordat.`);
    fullEscoltar(x); return;
  }
  if (d.fisic) { const x = estat.escoltant; tancaFull(); if (x?.id) fes(D.obre(x.id), 'Bona escolta.', { desfes: false }); return; }
  if (d.treure) {
    const x = rot(d.treure); if (!x) return; delete $('#full').dataset.encaraNo;
    estat.abansSortida = A.estat.db.export();
    if (x.viva) { fullPart(x); return; }
    fes(D.treu(x.id), `${x.titol} fora de rotació`, { abans: estat.abansSortida }); fullPuntuar(x); return;
  }
  if (d.punt !== undefined) { const id = +d.id; delete $('#full').dataset.encaraNo; estat.sortint = null; estat.tagsSortida = null; tancaFull();
    const nom = D.ESCALA.find(([, v]) => v === +d.punt)[0];
    fes(D.puntua(id, +d.punt), 'Puntuat: ' + nom, { abans: estat.abansSortida }).then(() => preguntaSortida(id)); return; }
  if (d.puntencara) { delete $('#full').dataset.encaraNo; estat.sortint = null; estat.tagsSortida = null; tancaFull(); fes(D.encaraNo(+d.puntencara), 'Sense nota, de moment. Tornarà.', { abans: estat.abansSortida }); return; }
  if (d.torna) { delete $('#full').dataset.encaraNo; estat.sortint = null; estat.tagsSortida = null; tancaFull(); fes(D.tornaARotacio(+d.torna), 'Torna a la rotació', { abans: estat.abansSortida, proper: false }); return; }
  if (d.espera) { tancaFull(); fes(D.deixaEsperant(+d.espera), 'La caixa queda esperant', { abans: estat.abansSortida }); return; }
  if (d.treuedicio) { const id = +d.treuedicio; const x = rot(id); tancaFull(); fes(D.treu(id), 'Fora de rotació', { abans: estat.abansSortida }); if (x) fullPuntuar(x); return; }
  if (d.seguent) { const [id, n] = d.seguent.split(':').map(Number); tancaFull(); fes(D.posaPart(id, n), 'La part ' + n + ' entra en rotació', { abans: estat.abansSortida }); return; }
  if (d.repren) { const x = rot(d.repren); tancaFull(); if (x) fullRepren(x); return; }
  if (d.reprenpart) { const [id, n] = d.reprenpart.split(':').map(Number); tancaFull(); fes(D.posaPart(id, n), 'La part ' + n + ' entra en rotació'); return; }
  if (d.fespref) { const aid = +d.fespref; tancaFull(); fes(D.afegeixPreferentId(aid), 'Afegit a Artistes Preferents'); sub('pref'); return; }

  // Les Llistes de reproducció (ACT-632 a ACT-635)
  if (d.llista) { fullLlista(+d.llista); return; }
  if (d.nomllista) { fullNomLlista(+d.nomllista); return; }
  if (d.desanomllista) { const id = +d.desanomllista, nom = $('#inNomLlista')?.value.trim();
    if (!nom) { avisa('Cal un nom.'); return; }
    const altra = L.perNom(db(), nom); if (altra && altra.id !== id) { avisa(`Ja hi ha una llista que es diu «${altra.nom}».`); return; }
    fes(L.canviaNom(id, nom), `La llista es diu «${nom}»`); fullLlista(id); return; }
  if (d.treucanco) { const id = estat.llistaOberta; fes(L.treuCanco(+d.treucanco), 'Cançó fora de la llista'); if (id) fullLlista(id); return; }
  if (d.esborrallista) { const l = L.llista(db(), +d.esborrallista); if (!l) return; tancaFull();
    fes(L.esborra(l.id), `Llista «${l.nom}» esborrada. Les seves cançons tornen a ser soltes.`); return; }
  if (d.sfllistaobre !== undefined) { estat.nomLlistaDe = d.sfllistaobre ? +d.sfllistaobre : null; estat.nomLlistaTxt = ''; refrescaLlista(); if (estat.nomLlistaDe) setTimeout(() => $('#inLlista')?.focus(), 30); return; }
  if (d.sfllistanova) { const c = targetaDe(d.sfllistanova); if (!c) return; const nom = $('#inLlista')?.value.trim();
    if (!nom) { avisa('Cal un nom.'); return; }
    const ids = restaDe(c); if (!ids.length) return;
    estat.nomLlistaDe = null; estat.nomLlistaTxt = '';
    fes(L.crea(nom, ids), r => r.existia ? `Ja hi havia «${r.nom}»: ${r.noves ? (r.noves === 1 ? 'una cançó afegida' : r.noves + ' cançons afegides') : 'ja hi eren totes'}`
                                         : `Llista «${r.nom}», amb ${r.noves === 1 ? 'una cançó' : r.noves + ' cançons'}. És a La Prestatgeria, Agrupacions.`);
    refrescaLlista(); return; }
  if (d.sfllistasi) { const [clau, id] = d.sfllistasi.split('|').map(Number), c = targetaDe(clau); if (!c) return;
    const ids = restaDe(c); if (!ids.length) return;
    const nom = L.llista(db(), id)?.nom || 'la llista';
    fes(L.confirma(id, ids), r => `És ${nom}${r.noves ? ': ' + (r.noves === 1 ? 'una cançó afegida' : r.noves + ' cançons afegides') + ' al final' : ''}`);
    refrescaLlista(); return; }

  if (d.esborradisc) { const x = rot(d.esborradisc); if (!x) return;
    obreFull(`<h3>Esborrar «${esc(x.titol)}»?</h3><p>${esc(x.art)}${x.nom_edicio ? ' · ' + esc(x.nom_edicio) : ''} · ${x.durada_total}′</p>
      <p>No té escoltes, ni nota, ni és en rotació, ni en cap grup. S'esborra la fitxa${x.parts.length ? ' amb les seves parts' : ''}; l'artista es queda. Tens «Desfés», i la còpia del Drive.</p>
      <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-esborradiscsi="${x.id}">Sí, esborra'l</button><button class="bt discret" data-tornafull="1">No</button></div>`);
    return; }
  if (d.esborradiscsi) { const x = rot(d.esborradiscsi); if (!x) return; tancaFull();
    fes(D.esborraEdicio(x.id), `«${x.titol}» esborrat`); return; }

  // L'afinació a la fitxa (v1.49)
  if (d.perafinar) { const id = +d.perafinar; fes(F.marcaPerAfinar(id), 'Marcat per afinar: és a L\'Afinació fins que toquis «Ja està afinat».'); const x = rot(id); if (x) fullFitxa(x); return; }
  // ACT-696: la durada sospitosa, des de la safata o des de la fitxa.
  if (d.posadurada) { const [id, m] = d.posadurada.split(':').map(Number); const obert = $('#full').classList.contains('obert');
    fes(y => { D.canviaDurada(id, m)(y); recalculaEdicio(y, id); }, `Durada: ${m}′`); if (obert) { const x = rot(id); if (x) fullFitxa(x); } return; }
  if (d.durabona) { const id = +d.durabona; const obert = $('#full').classList.contains('obert');
    fes(E.confirmaDurada(id), 'Durada confirmada: no tornarà a avisar mentre no la canviïs.'); if (obert) { const x = rot(id); if (x) fullFitxa(x); } return; }
  if (d.jaafinat) { const id = +d.jaafinat; fes(F.jaAfinat(id), 'Afinat'); const x = rot(id); if (x) fullFitxa(x); return; }
  if (d.generefitxa) { const x = rot(d.generefitxa); if (x) { estat.gen = null; fullGenere(x); } return; }
  if (d.comaltres) { const s = estat.comAltres; if (s) tocaGenere(g => { g.generes = [...s.generes]; }); return; }
  if (d.altrabranca) { t.outerHTML = `<span class="nou-idioma"><input id="inBranca" type="text" autocomplete="off" placeholder="p. ex. Electrònica"><button data-desabranca="1">Afegeix</button></span>`;
    setTimeout(() => $('#inBranca')?.focus(), 30); return; }
  if (d.desabranca || d.brancaigualment) { const v = d.brancaigualment || BR.brancaCanonica(db(), $('#inBranca')?.value); if (!v) { avisa('Escriu el nom de la branca.'); return; }
    // ACT-809 (b): si el nom ja és un subgènere, s'avisa i tria ell.
    const sg = !d.brancaigualment && !BR.branques(db()).includes(v) && BR.esSubgenere(db(), v);
    if (sg) { const g = estat.gen; obreFull(`<h3>«${esc(v)}» ja és un subgènere</h3><p>Si la crees com a branca, hi haurà dues coses amb el mateix nom: la branca i el subgènere.</p>
        <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-brancaigualment="${esc(v)}">Crea-la igualment</button>
        <button class="bt" data-tornagenere="${g?.id}">No</button></div>`); return; }
    if (!estat.gen?.generes.includes(v)) tocaGenere(g => { g.generes.push(v); }); else { const x = D.fitxa(db(), estat.gen.id); if (x) fullGenere(x); }
    return; }
  if (d.renombranca) { fullRenomBranca(d.renombranca); return; }
  if (d.desarenombranca) { const vell = estat.renomBranca, nou = $('#inRenomBranca')?.value, g = estat.gen; if (!vell || !g) return;
    let r; fes(y => (r = BR.reanomenaBranca(vell, nou)(y)), x => x.fos ? `Fosos: tot és «${x.nom}» (${x.albums === 1 ? 'un disc' : x.albums + ' discos'}).` : `Ara es diu «${x.nom}».`, { desfes: false });
    if (r) { const k = F.clauSubgenere(vell); g.generes = [...new Map(g.generes.map(x => F.clauSubgenere(x) === k ? r.nom : x).map(x => [F.clauSubgenere(x), x])).values()]; }
    estat.renomBranca = null; const x = D.fitxa(db(), g.id); if (x) fullGenere(x); return; }
  if (d.genbr) { tocaGenere(g => { const i = g.generes.indexOf(d.genbr); if (i >= 0) g.generes.splice(i, 1); else g.generes.push(d.genbr); }); return; }
  if (d.genamunt) { tocaGenere(g => { const i = +d.genamunt; [g.generes[i - 1], g.generes[i]] = [g.generes[i], g.generes[i - 1]]; }); return; }
  if (d.gentreu) { tocaGenere(g => { g.generes.splice(+d.gentreu, 1); }); return; }
  if (d.genll) { tocaGenere(g => { const i = g.llenguatge.indexOf(d.genll); if (i >= 0) g.llenguatge.splice(i, 1); else g.llenguatge.push(d.genll); }); return; }
  if (d.genfo) { tocaGenere(g => { const i = g.formacio.indexOf(d.genfo); if (i >= 0) g.formacio.splice(i, 1); else g.formacio.push(d.genfo); }); return; }
  // Els subgèneres (ACT-733): tocar-ne un el posa o el treu; «＋ Altre» n'escriu un de nou.
  if (d.gensub) { tocaGenere(g => { const i = g.subgeneres.indexOf(d.gensub); if (i >= 0) g.subgeneres.splice(i, 1); else g.subgeneres.push(d.gensub); }); return; }
  if (d.altresub) { t.outerHTML = `<span class="nou-idioma"><input id="inSub" type="text" autocomplete="off" placeholder="p. ex. field recordings"><button data-desasub="1">Afegeix</button></span>`;
    setTimeout(() => $('#inSub')?.focus(), 30); return; }
  if (d.tornagenere) { const x = D.fitxa(db(), +d.tornagenere); if (x) fullGenere(x); return; }
  if (d.renomsub) { fullRenomSub(d.renomsub); return; }
  if (d.desarenomsub) { const r = estat.renomSub, nou = $('#inRenomSub')?.value; if (!r) return;
    const f = F.fusioSubgenere(db(), r.vell, nou); if (!f) { avisa('Escriu el nom nou.'); return; }
    if (F.clauSubgenere(f.nom) === F.clauSubgenere(r.vell) && f.nom === r.vell) { const x = D.fitxa(db(), estat.gen.id); if (x) fullGenere(x); return; }
    if (f.fos) { fullRenomSub(r.vell, { nom: f.nom, escrit: nou }); return; }
    reanomenaSub(r.vell, nou); return; }
  if (d.fonsub) { const r = estat.renomSub; if (r?.nou) reanomenaSub(r.vell, r.nou); return; }
  if (d.desasub) { const v = F.subgenereCanonic(db(), $('#inSub')?.value); if (!v) { avisa('Escriu un subgènere.'); return; }
    tocaGenere(g => { if (!g.subgeneres.includes(v)) g.subgeneres.push(v); }); return; }
  // Les fulles de la fitxa nova (ACT-734, ACT-736)
  if (d.tagsfitxa) { const x = rot(d.tagsfitxa); if (x) fullTags(x); return; }
  if (d.mesfitxa) { const x = rot(d.mesfitxa); if (x) fullMes(x); return; }
  if (d.escoltesfitxa) { const x = rot(d.escoltesfitxa); estat.corrAtencio = null; if (x) fullEscoltes(x); return; }
  if (d.escoltama) { const x = rot(d.escoltama); if (x) fullEscoltaMa(x); return; }
  if (d.atencioma) { estat.atencioMa = d.atencioma; document.querySelectorAll('#atencioMa button').forEach(b => b.classList.toggle('triat', b.dataset.atencioma === d.atencioma)); return; }
  if (d.desaescoltama) { const id = +d.desaescoltama, c = $('#selCanalMa').value, canal = c === 'streaming' ? $('#selAppMa').value : c;
    const inici = new Date($('#inIniciMa').value), ctx = $('#selCtxMa').value || null;
    if (isNaN(inici)) { avisa('Cal l\'hora d\'inici.'); return; }
    if (!d.forca) { const x = EM.duplicat(db(), id, inici); if (x) {
      $('#avisDupMa').hidden = false;
      $('#avisDupMa').innerHTML = `<div class="avis-durada"><b>Potser ja hi és.</b> ListenBrainz ja té una escolta d'aquest disc a les ${hm(x.data_hora)} del ${new Date(x.data_hora).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}.
        <div class="barra-accions" style="position:static;padding:6px 0 0"><button class="bt" data-desaescoltama="${id}" data-forca="1">Apunta-la igualment</button></div></div>`; return; } }
    const at = estat.atencioMa ? (E.ATENCIONS.find(([b]) => b === estat.atencioMa)?.[1] || estat.atencioMa) : (ctx ? (ctx === 'Dormir' ? 'Dormir' : 'Efectes plens') : null);
    fes(EM.apunta({ edicioId: id, canal, inici, context: ctx, atencio: at, forca: true }), 'Escolta apuntada');
    const x = rot(id); if (x) fullEscoltes(x); return; }
  if (d.corregeix) { const [ed, u] = d.corregeix.split('|').map(Number); estat.corrAtencio = null; fullCorregeix(ed, u); return; }
  if (d.corrctx || d.corratencio) {
    const [ed, u, id, val] = (d.corrctx || d.corratencio).split('|'); const x = rot(ed); if (!x) return;
    if (d.corrctx && E.preguntaAtencio(val)) { estat.corrAtencio = { id: +id, ctx: val }; fullCorregeix(+ed, +u); return; }
    const ctx = d.corrctx ? val : estat.corrAtencio?.ctx, at = d.corratencio ? val : null; estat.corrAtencio = null;
    if (!ctx) return;
    fes(E.corregeixEscolta(+id, ctx, at), r => `Escolta corregida: ${r?.ctx || ctx}`); fullEscoltes(rot(ed)); return; }
  if (d.juntar) { const x = rot(d.juntar); if (x) fullTriaIdentitat(x, 'junta'); return; }
  if (d.espart) { const x = rot(d.espart); if (x) fullTriaIdentitat(x, 'part'); return; }
  if (d.juntaamb) { const [de, a] = d.juntaamb.split('|').map(Number), m = F.noEsPotJuntar(db(), de, a);
    if (m === 'caixa') { fullEsPartDe(de, a, true); return; }
    if (m) { avisa('No es pot juntar: ' + (m === 'parts' ? 'té parts.' : m + '.')); return; }
    fullConfirmaJunta(de, a, F.duraMoltMes(db(), de, a)); return; }
  if (d.juntasi) { const [de, a] = d.juntasi.split('|').map(Number), x = rot(de), y = rot(a); if (!x || !y || F.noEsPotJuntar(db(), de, a)) return;
    tancaFull();
    fes(F.junta({ de, a }), `«${x.titol}» és «${y.titol}»: juntats en una sola fitxa.`).catch(e => avisa(e.message));
    const z = rot(a); if (z) fullFitxa(z); return; }
  if (d.espartamb) { const [de, a] = d.espartamb.split('|').map(Number); if (de === a) return; fullEsPartDe(de, a); return; }
  if (d.espartpart || d.espartnova) {
    const [de, a, pid] = (d.espartpart || d.espartnova).split('|').map(Number), x = rot(de), y = rot(a); if (!x || !y) return;
    const numero = d.espartnova ? Math.round(Number($('#inNumPart')?.value)) : null;
    if (d.espartnova && !(numero > 0)) { avisa('Cal el número de la part.'); return; }
    if (d.espartnova && F.partsDe(db(), a).some(p => p.numero === numero)) { avisa(`Ja hi ha la part ${numero}: tria-la a la llista, o un altre número.`); return; }
    tancaFull();
    fes(F.esPart({ de, a, partId: d.espartpart ? pid : null, numero }), r => `«${x.titol}» és la part ${r?.part?.numero ?? numero ?? ''} de «${y.titol}».`).catch(e => avisa(e.message));
    const z = rot(a); if (z) fullFitxa(z); return; }
  if (d.grup) { fullGrup(d.grup); return; }
  if (d.grupplay) { fullGrupEscolta(d.grupplay); return; }
  if (d.fitxagrup) { fullGrup(d.fitxagrup); return; }

  // La safata: la pregunta 2 (§8.10, ACT-469). Confirmar o triar una altra edició queda recordat a l'edició.
  if (d.q2si) { const [clau, id] = [d.q2si.slice(0, d.q2si.lastIndexOf('|')), +d.q2si.slice(d.q2si.lastIndexOf('|') + 1)];
    const q = E.preguntes2(db()).find(x => x.clau === clau); if (!q) return;
    const ed = q.candidates.find(c => c.id === id);
    fes(x => { E.confirmaEdicio(id, q)(x); return E.recalcula(x, { desDe: q.primera }); }, `${q.album || q.pista}: és ${ed ? ed.titol + (ed.nom_edicio ? ' (' + ed.nom_edicio + ')' : '') : 'aquesta edició'}. Queda recordat.`);
    return; }
  if (d.q2altres) { estat.q2obert = d.q2altres; pintaSafata(); return; }
  // les targetes de sessió
  if (d.sfctx) { const [clau, ctx] = d.sfctx.split('|');
    if (E.preguntaAtencio(ctx)) { (estat.ctxTmp ||= {})[clau] = ctx; pintaSafata(); return; }
    const ids = idsDe(clau, tgDe(clau)); if (!ids.length) return;
    fes(E.contesta(ids, ctx, null, deQui(clau)), ctx === 'No ho sé' ? 'No ho sé' : ctx); return; }
  if (d.sfatencio) { const [clau, b] = d.sfatencio.split('|'), ctx = estat.ctxTmp?.[clau]; if (!ctx) return; delete estat.ctxTmp[clau];
    const ids = idsDe(clau, tgDe(clau)); if (!ids.length) return;
    fes(E.contesta(ids, ctx, b, deQui(clau)), r => r.ctx === 'Dormir' && ctx === 'A casa' ? 'A casa, dormint: queda com a Dormir' : ctx + ' · ' + b); return; }
  if (d.sfctxdesfes) { delete estat.ctxTmp[d.sfctxdesfes]; pintaSafata(); return; }
  if (d.sftots) { (estat.ctxTots ||= {})[d.sftots] = true; pintaSafata(); return; }
  if (d.sfsepara) { (estat.separades ||= new Set()).add(+d.sfsepara); pintaSafata(); return; }
  if (d.sfignora) { const ids = idsDe(d.sfignora, tgDe(d.sfignora)); if (!ids.length) return;
    fes(E.ignora(ids), 'Ignorat. No compta i no tornarà.'); return; }
  if (d.sfignorasempre) { const arts = artistesDe(d.sfignorasempre); if (!arts.length) { avisa('Aquestes pistes no porten nom d\'artista.'); return; }
    if (arts.length === 1) { ignoraSempreArt(arts[0]); return; }
    obreFull(`<h3>Ignora sempre</h3><p>Tot el que arribi amb un artista que comenci per aquest nom s'ignorarà sol. La llista és a La Cabina, per treure'n un nom.</p>
      <div class="canals">${arts.map(a => `<button data-ignoraart="${esc(a)}">${esc(a)}</button>`).join('')}</div>`); return; }
  if (d.ignoraart) { tancaFull(); ignoraSempreArt(d.ignoraart); return; }
  if (d.treuignora) { const nom = d.treuignora; fes(E.treuIgnoraSempre(nom), `«${nom}» ja no s'ignora sol. El que ja estava ignorat, s'hi queda.`); fullIgnorats(); return; }
  if (d.ignorats) { fullIgnorats(); return; }
  if (d.cabina) { fullCabina(); return; }
  if (d.copiaara) { copiaAra(); return; }
  if (d.excel) { descarregaExcel(); return; }
  if (d.alarmaok) { fes(C.treuAlarma, 'D\'acord. La propera còpia torna a rotar.', { desfes: false }).then(() => fullCabina()); return; }
  if (d.notaok) { fes(C.treuNota, 'Entesos.', { desfes: false }); return; }
  if (d.sfresolta) { obreResolta(+d.sfresolta); return; }
  if (d.sfreobre) { tancaFull(); fes(E.reobre(d.sfreobre.split(',').map(Number)), 'Torna a la safata'); return; }
  if (d.canviaedicio) { const x = D.fitxa(db(), +d.canviaedicio), dins = !!t.closest('#full'); if (x) { fullEdicio(x); if (dins) tornaA(x.id); } return; }   // dins: abans de repintar (el botó ja no hi és)
  if (d.triaedicio) { const [de, a] = d.triaedicio.split(':').map(Number); preguntaCorreccio(de, a); return; }
  if (d.novaedicio) { const de = +d.novaedicio, min = parseInt($('#inEdMin').value, 10), nom = $('#inEdNom').value.trim();
    if (!min || min < 1) { avisa('Cap disc entra sense durada.'); return; }
    let a; fes(y => { a = E.creaEdicio(de, { nom, minuts: min })(y); }, null, { desfes: false }).then(() => preguntaCorreccio(de, a)); return; }
  if (d.correccio) { const [de, a, si] = d.correccio.split(':').map(Number); tancaFull();
    fes(E.canviaEdicio({ de, a, correccio: !!si }), si ? 'Corregit: les escoltes i la nota són de l\'altra edició' : 'Canviada l\'edició en rotació'); return; }
  if (d.sfdisc) { fes(E.declaraDisc(d.sfdisc), 'És un disc: et pregunto la durada a dalt'); return; }
  // el disc nou
  if (d.sfcanal) { const i = d.sfcanal.lastIndexOf('|'), k = d.sfcanal.slice(0, i), c = d.sfcanal.slice(i + 1);
    (estat.nouCanalDe ||= {})[k] = c; delete estat.altreCanalDe; pintaSafata(); return; }
  // El canal d'un disc que ja és a l'arxiu, des de la safata (targeta oberta o «Canvia» d'una resolta): el mateix camp
  // que a la fitxa (Edició.App d'escolta). Queda recordat i és el que proposarà als discos nous del mateix artista.
  if (d.sfcanaldisc) { const x = rot(d.sfcanaldisc); if (!x) return; estat.canalDes = 'safata'; delete estat.altreCanalDe; fullCanal(x); return; }
  if (d.obrealtrecanal) { const [on, v] = d.obrealtrecanal.split(/\|(.*)/s);
    estat.altreCanalDe = on + ':' + v;
    if (on === 'nou') { pintaSafata(); } else { const x = rot(v); if (x) fullCanal(x); }
    setTimeout(() => $('#inCanalNou')?.focus(), 0); return; }
  if (d.afegeixcanal) { const [on, v] = d.afegeixcanal.split(/\|(.*)/s), nom = $('#inCanalNou')?.value.trim();
    if (!nom) { avisa('Cal un nom.'); return; }
    const base = Object.keys(CANALS).find(k => !CANALS[k].propi && CANALS[k].nom.toLowerCase() === nom.toLowerCase());
    delete estat.altreCanalDe;
    if (on === 'nou') {
      if (base) { (estat.nouCanalDe ||= {})[v] = base; pintaSafata(); return; }
      fes(y => { (estat.nouCanalDe ||= {})[v] = D.afegeixCanalPropi(nom)(y); }, `${nom} queda a la llista de canals`, { desfes: false }); return; }
    if (base) { fes(D.canviaCanal(+v, base), `Canal: ${CANALS[base].nom}. Queda recordat.`); }
    else fes(y => { D.canviaCanal(+v, D.afegeixCanalPropi(nom)(y))(y); }, `Canal: ${nom}. Queda a la llista i recordat.`);
    if (estat.canalDes === 'safata') tancaFull(); else { const x = rot(v); if (x) fullFitxa(x); } return; }
  if (d.sfnoupref) { (estat.nouPrefDe ||= {})[d.sfnoupref] = !estat.nouPrefDe?.[d.sfnoupref]; pintaSafata(); return; }
  if (d.sfnouignora) { const x = E.discosNous(db(), mbCache).nous.find(y => y.clau === d.sfnouignora); if (!x) return;
    fes(E.ignora(x.scr), (x.album || x.pista) + ': ignorat'); return; }
  if (d.sfsenseparts) { (estat.sensePartsDe ||= {})[d.sfsenseparts] = true; pintaSafata(); return; }
  if (d.sfambparts) { if (estat.sensePartsDe) delete estat.sensePartsDe[d.sfambparts]; pintaSafata(); return; }
  if (d.sfacte) { const [id, n] = d.sfacte.split('|').map(Number);
    fes(y => { AP.desaActe(id, n)(y); E.recalcula(y, { desDe: E.desDePistes(y, [id]) }); }, `Acte ${n}`); return; }
  if (d.sfoperaactes) { const k = d.sfoperaactes; estat.actesMaDe ||= {};
    if (estat.actesMaDe[k]) delete estat.actesMaDe[k]; else estat.actesMaDe[k] = { n: '', min: {} }; pintaSafata(); return; }
  if (d.sfnou) { const [k, on] = d.sfnou.split('|');
    const x = E.discosNous(db(), mbCache).nous.find(y => y.clau === k); if (!x) return;
    const ma = estat.actesMaDe?.[k] ? AP.partsAMa(estat.actesMaDe[k].n, estat.actesMaDe[k].min) : null;   // ACT-787 (b)
    if (typeof ma === 'string') { avisa(ma); return; }
    const min = ma ? ma.reduce((s, p) => s + p.durada, 0) : parseInt(document.querySelector(`[data-sfdur="${CSS.escape(k)}"]`)?.value, 10);
    if (!min || min < 1) { avisa('Cap disc entra sense durada.'); return; }
    const a = D.trobaArtista(db(), x.artista), canal = estat.nouCanalDe?.[k] || D.canalPerDefecte(db(), a?.id), pref = estat.nouPrefDe?.[k];
    fes(y => { const r = E.creaDiscNou({ album: x.album || x.pista, artista: x.artista, recording_msid: x.recording_msid, minuts: min, canal, rotacio: on === 'rotacio', parts: estat.sensePartsDe?.[k] ? null : x.proposta.parts, ...(ma ? { parts: ma } : {}) })(y);   // ACT-787 (c); (b), els actes a mà manen
               if (pref) D.afegeixPreferentId(r.artista_id)(y); return r; },
      `${x.album || x.pista} entra a l'arxiu${on === 'rotacio' ? ' i a la rotació' : ''}${pref ? ', i l\'artista a preferents' : ''}`); return; }
  // les preguntes 7, 8 i 9
  if (d.sfq7) { const [id, r] = d.sfq7.split('|'); fes(E.respon7(+id, r === 'si'), r === 'si' ? 'Entra a la rotació' : 'D\'acord: no tornaré a preguntar fins d\'aquí a cinc escoltes'); return; }
  if (d.sfq8) { const [id, r] = d.sfq8.split('|'), x = D.fitxa(db(), +id); if (!x) return;
    if (r === 'si') { estat.abansSortida = A.estat.db.export(); fes(y => { E.tocaReferencia(+id)(y); D.treu(+id)(y); }, `${x.titol} fora de rotació`, { abans: estat.abansSortida }); fullPuntuar(x); return; }
    fes(E.tocaReferencia(+id), r === 'ara' ? null : 'Encara no: segueix en rotació');
    if (r === 'ara') fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, bce: x.bce, fisic: x.fisic }); return; }
  if (d.sfq9) { const [id, r] = d.sfq9.split('|'), x = D.fitxa(db(), +id); if (!x) return;
    if (r === 'no') { estat.abansSortida = A.estat.db.export(); fes(y => { E.tocaReferencia(+id)(y); D.treu(+id)(y); }, `${x.titol} fora de rotació`, { abans: estat.abansSortida }); fullPuntuar(x); return; }
    fes(E.tocaReferencia(+id), r === 'ara' ? null : 'Segueix en rotació');
    if (r === 'ara') fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, bce: x.bce, fisic: x.fisic }); return; }
  if (d.q2no) { const q = E.preguntes2(db()).find(x => x.clau === d.q2no); if (!q) return;
    fes(E.rebutjaEmparellament(q), `${q.album || q.pista}: no és cap d'aquestes. Serà un disc nou.`); return; }

  // L'Historial
  if (d.hescoltar) { const x = D.fitxa(db(), +d.hescoltar); if (!x) return;
    fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, bce: x.bce, fisic: x.fisic }); return; }
  if (d.hrot) { const id = +d.hrot, x = D.fitxa(db(), id); if (!x) return;
    fes(D.posaIdEnRotacio(id), `${x.titol} entra a Discos en Rotació`); if (t.closest('#full')) fullFitxa(rot(id)); return; }
  if (d.hgrup) { fullGrupHistorial(d.hgrup); return; }
  if (d.desaenllac) { const id = +d.desaenllac, txt = $('#inEnllacBc')?.value;
    if (!CB.llegeixNumero(txt) && !B.llegeixEnllac(txt)) { avisa('No hi trobo cap enllaç d\'un àlbum de Bandcamp (https://….bandcamp.com/album/…) ni cap número.'); return; }
    { const dins = !!t.closest('#full'); fes(CB.desaCodiOEnllac(id, txt), r => r.codi ? 'Codi desat: el ▶ ja obre el disc a l\'app.' : r.treu ? 'Enllaç desat: el codi vell ha sortit. El ▶ obre l\'enllaç; el codi nou arriba aquesta nit.' : 'Enllaç desat: el ▶ ja l\'obre. El codi arriba aquesta nit.');
      const x = D.fitxa(db(), id); if (x && dins) fullFitxa(x); } return; }
  if (d.codibc) { const x = D.fitxa(db(), +d.codibc); if (x) { fullCodiBc(x); tornaA(x.id); } return; }
  if (d.copiamarcador) { const tx = $('#txtMarcador'); try { navigator.clipboard.writeText(tx.value).then(() => avisa('Marcador copiat.'), () => { tx.select(); avisa('Selecciona i copia el text.'); }); } catch { tx.select(); } return; }
  if (d.marcadorde) { const m = estat.marcador; estat.marcador = null; tancaFull(); if (m) fes(CB.desaCodi(+d.marcadorde, m.codi, m.enllac), 'Codi de Bandcamp posat: el ▶ ja obre el disc a l\'app.'); return; }
  if (d.histmes) { estat.histMax = (estat.histMax || FINESTRA_HIST) + FINESTRA_HIST; pintaHistorial(); return; }   // ACT-737

  // La fitxa que creix (bloc 3.2 bis)
  if (d.canalfitxa) { const x = rot(d.canalfitxa); if (x) { estat.canalDes = 'fitxa'; delete estat.altreCanalDe; fullCanal(x); tornaA(x.id); } return; }
  if (d.desacanal) { const i = d.desacanal.indexOf('|'), id = d.desacanal.slice(0, i), k = d.desacanal.slice(i + 1); const x = rot(id); if (!x) return;
    fes(D.canviaCanal(+id, k), `Canal: ${nomCanal(k)}. Queda recordat.`);
    if (estat.canalDes === 'safata') tancaFull(); else fullFitxa(rot(id)); return; }
  if (d.notafitxa) { const x = rot(d.notafitxa); if (x) { fullNota(x); tornaA(x.id); } return; }
  if (d.modenota) { const x = rot(estat.notaDe); if (x) fullNota(x, d.modenota); return; }
  if (d.desanota) { const [mode, v] = d.desanota.split(':'); const id = estat.notaDe, x = rot(id); if (!x) return;
    const nom = nomNota(+v);
    fes(mode === 'subst' ? D.substitueixNota(id, +v) : D.puntua(id, +v), mode === 'subst' ? 'Nota substituïda: ' + nom : 'Nota: ' + nom);
    fullFitxa(rot(id)); return; }
  if (d.tag) { const nom = d.tag; tocaTags(x => { const r = T.commuta(x.album_tags, x.tags, nom);
      if (x.n_edicions > 1 && T.SI_NO.find(y => y.nom === nom)?.nivell === 'album') avisa('També canvia a l\'altra edició.'); return r; }); return; }
  if (d.veu) { const v = d.veu; tocaTags(x => ({ album: T.posaValor(x.album_tags, T.VEU, v), edicio: x.tags })); return; }
  if (d.estacio) { const v = d.estacio; tocaTags(x => ({ album: T.posaValor(x.album_tags, T.ESTACIO, v), edicio: x.tags })); return; }
  if (d.idioma) { const v = d.idioma; tocaTags(x => ({ album: T.commutaIdioma(x.album_tags, v), edicio: x.tags })); return; }
  if (d.altreidioma) { t.outerHTML = `<span class="nou-idioma"><input id="inIdioma" type="text" autocomplete="off" placeholder="p. ex. francès"><button data-desaidioma="1">Afegeix</button></span>`;
    setTimeout(() => $('#inIdioma')?.focus(), 30); return; }
  if (d.desaidioma) { const v = T.idiomaCanonic($('#inIdioma')?.value); if (!v) { avisa('Escriu un idioma.'); return; }
    tocaTags(x => { const ja = T.llegeix(x.album_tags, x.tags).idiomes.includes(v);
      return { album: ja ? x.album_tags : T.commutaIdioma(x.album_tags, v), edicio: x.tags }; }); return; }

  // Imatges (bloc 3.2)
  if (d.canviaportada) { const x = rot(d.canviaportada); if (x) { fullPortada({ ...x, portada: x.portada_edicio, partId: null }); tornaA(x.id); } return; }
  // La portada d'una part d'una caixa (ACT-624): la mateixa fulla, amb el títol de la part per cercar.
  if (d.portadapart) { const [id, pid] = d.portadapart.split(':').map(Number), x = rot(id), p = x?.parts.find(y => y.id === pid); if (!p) return;
    fullPortada({ ...x, titol: x.titol + (p.nom ? ' ' + p.nom : ' ' + p.numero), portada: p.portada, partId: pid }); return; }
  if (d.cercaportada) { cercaPortada(); return; }
  if (d.reprovaportada) { I.reprova(t); return; }   // ACT-726: la portada pendent, ara mateix
  if (d.triaportada) { const x = estat.portadaDe; if (!x) return;
    fes(x.partId ? D.posaPortadaPart(x.partId, d.triaportada) : D.posaPortada(x.id, d.triaportada, 'triada'), x.partId ? 'Portada de la part triada' : 'Portada triada'); tornaFitxa(x.id); return; }
  if (d.pujaportada) { $('#inPortada')?.click(); return; }
  if (d.noportada?.startsWith('p')) { const id = estat.portadaDe?.id; fes(D.posaPortadaPart(+d.noportada.slice(1), null), 'Portada de la part fora: fa servir la de la caixa.'); tornaFitxa(id); return; }
  if (d.noportada) { const id = +d.noportada; fes(D.rebutjaPortada(id), 'Portada fora. Arribarà amb les escoltes, o la tries tu.'); tornaFitxa(id); return; }
  if (d.canviafoto) { const p = D.preferents(db()).find(x => x.id === +d.canviafoto); if (p) fullFoto(p); return; }
  if (d.cercafoto) { cercaFoto(); return; }
  if (d.triafoto) { const p = estat.fotoDe; if (!p) return; tancaFull(); cercaFotoN++;
    fes(D.posaRetrat(p.artista_id, d.triafoto, 'triat'), 'Foto de ' + p.nom + ' triada'); return; }
  if (d.noretrat) { tancaFull(); fes(D.rebutjaRetrat(+d.noretrat), 'Foto fora.'); return; }
  if (d.pujafoto) { $('#inFoto')?.click(); return; }

  // Artistes Preferents
  if (t.id === 'btAfegeixArtista') { fullAfegeixArtista(); return; }
  // Segells Preferents (obra G)
  if (t.id === 'btAfegeixSegell') { fullAfegeixSegell(); return; }
  if (d.desasegell) { const n = $('#inSegell').value.trim(); if (!n) { avisa('Cal un nom.'); return; }
    tancaFull(); fes(SG.afegeixSegell(n), r => r?.error || `${n} a Segells Preferents`); return; }
  if (d.segell) { fullSegell(+d.segell); return; }
  if (d.segvei) { const id = +d.segvei, s = SG.segellsPreferents(db()).find(x => x.id === id); if (!s) return;
    fullSegell(id, 'buscant'); SG.veinsDeSegell(db(), s).then(v => { if ($('#full.obert') && $('[data-segvei]')) fullSegell(id, v); }); return; }
  if (d.segposaproper) { const id = +d.segposaproper; tancaFull(); fes(SG.posaProperSegell(id, d.art, d.tit), `El proper: ${d.tit}`); return; }
  if (d.segpropma) { fullProperSegell(+d.segpropma); return; }
  if (d.segdesaproper) { const t_ = $('#inSegTit').value.trim(); if (!t_) { avisa('Cal el títol.'); return; }
    tancaFull(); fes(SG.posaProperSegell(+d.segdesaproper, $('#inSegArt').value.trim(), t_), `El proper: ${t_}`); return; }
  if (d.segtreuproper) { tancaFull(); fes(SG.posaProperSegell(+d.segtreuproper, null, null), 'Nota del proper treta'); return; }
  if (d.seglogo) { $('#inLogo')?.click(); return; }
  if (d.segtreulogo) { tancaFull(); fes(SG.posaLogo(+d.segtreulogo, null), 'Logo tret'); return; }
  if (d.segtreu) { tancaFull(); fes(SG.treuSegell(+d.segtreu), 'Segell tret de Segells Preferents'); return; }
  if (d.segellfitxa) { fullSegellFitxa(+d.segellfitxa); return; }
  if (d.desasegellfitxa) { const id = +d.desasegellfitxa, v = $('#selSegFitxa').value, altre = v === '__altre';
    const n = altre ? $('#inSegFitxa').value.trim() : v, fesPref = altre && !!n && $('#chkSegPref').checked;
    fes(db => { SG.canviaSegell(id, n)(db); if (fesPref) SG.afegeixSegell(n)(db); },
      n ? `Segell: ${n}${fesPref ? ' · afegit a Segells Preferents' : ''}` : 'Segell tret'); const x = rot(id); if (x) fullFitxa(x); return; }
  if (d.desaartista) { const n = $('#inNom').value.trim(); if (!n) { avisa('Cal un nom.'); return; }
    tancaFull(); fes(D.afegeixPreferent(n), r => r.jaHiEra ? n + ' ja hi era.' : n + ' afegit a Artistes Preferents'); return; }
  if (t.id === 'btOrdena') {
    if (!estat.ordena) { estat.ordena = true; estat.ordreTmp = D.preferents(db()).map(p => p.id); t.textContent = 'Fet'; t.setAttribute('aria-pressed', 'true'); pintaFiles(); return; }
    const ids = estat.ordreTmp; estat.ordena = false; estat.ordreTmp = null; t.textContent = 'Ordena la llista'; t.setAttribute('aria-pressed', 'false');
    fes(D.ordenaPreferents(ids), 'Ordre desat'); return;
  }
  if (t.id === 'btOrdenaSeg') {   // Obra IV (d)
    if (!estat.ordenaSeg) { estat.ordenaSeg = true; estat.ordreSegTmp = SG.segellsPreferents(db()).map(s => s.id); t.textContent = 'Fet'; t.setAttribute('aria-pressed', 'true'); pintaSegells(); return; }
    const ids = estat.ordreSegTmp; estat.ordenaSeg = false; estat.ordreSegTmp = null; t.textContent = 'Ordena la llista'; t.setAttribute('aria-pressed', 'false');
    fes(O4.desaOrdreSegells(ids), 'Ordre desat'); return;
  }
  if (d.mouseg) { const [i, dir] = d.mouseg.split(':').map(Number), j = i + dir, o = estat.ordreSegTmp;
    if (!o || j < 0 || j >= o.length) return; const [a] = o.splice(i, 1); o.splice(j, 0, a); pintaSegells(); return; }
  if (d.agsub) { O4.posaAgSub(d.agsub); pintaAgrupacions(); return; }   // Obra IV (b)
  if (d.sugllista !== undefined) { const i = $('#inLlista'); if (i) { i.value = d.sugllista; estat.nomLlistaTxt = d.sugllista; pintaSugLlista(); i.focus(); } return; }   // Obra IV (a)
  if (d.prefja) { N.apuntaAlcada('artista', { sup: estat.superficie, sub: estat.sub }); tancaFull(); estat.artista = +d.prefja; pintaArtista(estat.artista); vesA('artista'); return; }   // Obra IV (e): com «Ves a l'artista»
  if (d.prefcap) { const [id, aid] = d.prefcap.split('|').map(Number);   // Obra IV (e)
    fes(D.afegeixPreferentId(aid), 'Afegit a Artistes Preferents'); const x = rot(id); if (x) fullFitxa(x); return; }
  if (d.mou) { const [i, dir] = d.mou.split(':').map(Number), j = i + dir, o = estat.ordreTmp;
    if (!o || j < 0 || j >= o.length) return; const [a] = o.splice(i, 1); o.splice(j, 0, a); pintaFiles(); return; }
  if (d.artista) { N.apuntaAlcada('artista', { sup: estat.superficie, sub: estat.sub }); estat.artista = +d.artista; pintaArtista(estat.artista); vesA('artista'); return; }
  if (d.vei) { const [pid, dir] = d.vei.split(':'); fullVei(+pid, dir); return; }
  if (d.veides) { const [pid, dir, i] = d.veides.split(':'); fullVei(+pid, dir, +i); return; }
  if (d.discografia) { fullDiscografia(+d.discografia); return; }
  if (d.veimb) { const c = $('#veins'); if (c) c.innerHTML = '<p class="subtitol">Cercant…</p>'; cercaVei(d.veimb); return; }
  if (d.triavei) { const v = estat.vei, x = v?.candidats[+d.triavei]; if (!x) return;
    tancaFull(); fes(v.nouPref ? FX.fesPreferentAmbProper(v.nouPref, x.titol) : D.posaProper(v.pid, x.titol),
      v.nouPref ? `${v.partida.art} a Artistes Preferents · el proper: ${x.titol}` : 'El proper: ' + x.titol); return; }
  if (d.vesartista) { N.apuntaAlcada('artista', { sup: estat.superficie, sub: estat.sub }); tancaFull(); estat.artista = +d.vesartista; pintaArtista(estat.artista); vesA('artista'); return; }
  if (d.veinou) { const v = estat.vei; if (v?.nouPref) fullVeiDe(v.partida, d.veinou, { pid: null, nouPref: v.nouPref }); return; }   // ACT-799
  if (d.triaseguent) { const x = rot(d.triaseguent); if (!x) return; fullVeiDe(FX.partidaDelDisc(db(), x.album_id), 'seg', { pid: null, nouPref: x.artista_id }); tornaA(x.id); return; }
  if (d.veisortida) { const [pid, dir, al] = d.veisortida.split(':'); fullVeiDe(FX.partidaDelDisc(db(), +al), dir, { pid: +pid }); return; }
  if (d.copiade) { const x = rot(d.copiade); if (x) { estat.copia = null; fullCopiaTria(x); } return; }
  if (d.copiaorigen) { const x = estat.copia && rot(estat.copia.id); if (x) fullCopia(x, +d.copiaorigen); return; }
  if (d.fescopia) { const [id, de] = d.fescopia.split('|').map(Number), claus = [...$('#full').querySelectorAll('input[data-clau]:checked')].map(i => i.dataset.clau);
    const x = rot(id); if (!x) return;
    fes(FX.copia(de, x.album_id, claus), 'Copiat: ' + claus.length + (claus.length === 1 ? ' cosa' : ' coses')); { const y = rot(id); if (y) fullFitxa(y); } return; }
  if (d.triaproper) { fullProper(+d.triaproper); return; }
  if (d.eraproper) { tancaFull(); fes(PR.esborraProper(+d.eraproper), 'D\'acord: el proper era aquest, nota esborrada.'); return; }
  if (d.posaproper) { const p = D.preferents(db()).find(x => x.id === +d.posaproper); if (!p) return;
    fullAfegeixDisc({ art: p.nom, tit: p.proper_titol, canal: D.canalPerDefecte(db(), p.artista_id) }); return; }
  if (d.buscaa) { const art = $('#inArt').value.trim(), tit = $('#inTit').value.trim(), e = enllac(estat.nouCanal, { art, tit });
    if (e.href && e.href !== '#') window.open(e.href, e.ext ? '_blank' : '_self'); return; }
  if (d.info) { const x = D.fitxa(db(), +d.info); if (x) fullInfo(x); return; }
  if (d.buscainfo) { buscaInfo(+d.buscainfo); return; }
  if (d.canvianoms) { const x = D.fitxa(db(), +d.canvianoms); if (x) { fullNoms(x); tornaA(x.id); } return; }
  if (d.desanoms) { const id = +d.desanoms, v = { titol: $('#inNomTit').value, nomEdicio: $('#inNomEd').value, artista: $('#inNomArt').value };
    let r; fes(y => (r = PR.canviaNoms(id, v)(y)), x => x.error || (x.canvis.length ? 'Canviat: ' + x.canvis.join(', ') + '.' : 'Res a canviar.'));
    if (!r?.error) { const x = D.fitxa(db(), id); if (x) fullFitxa(x); } return; }
  if (d.desaproper) { const t2 = $('#inProper').value.trim(); if (!t2) { avisa('Cal un títol.'); return; }
    tancaFull(); fes(D.posaProper(estat.properDe, t2), 'El proper: ' + t2); return; }
  if (d.treuproper) { fes(D.posaProper(+d.treuproper, null), 'Nota esborrada'); return; }
  if (d.escproper) { const p = D.preferents(db()).find(x => x.id === +d.escproper); if (!p) return;
    fullEscoltar({ art: p.nom, tit: p.proper_titol, canal: D.canalPerDefecte(db(), p.artista_id) }); return; }
  if (d.desprefer) { const id = +d.desprefer, p = D.preferents(db()).find(x => x.id === id);
    vesA('faristol'); sub('pref'); fes(D.treuPreferent(id), (p ? p.nom : 'L\'artista') + ' fora de preferents'); return; }
});

// arrossegar les files dels preferents per la nansa
let arros = null;
document.addEventListener('pointerdown', e => {
  const nansa = e.target.closest('.nansa'); if (!nansa) return;
  const fila = nansa.closest('.fila'); if (!fila) return;
  e.preventDefault(); arros = { fila }; fila.classList.add('agafat'); document.body.classList.add('arrossegant');
  try { nansa.setPointerCapture(e.pointerId); } catch {}
});
document.addEventListener('pointermove', e => {
  if (!arros) return; e.preventDefault();
  const caixa = arros.fila.parentNode, sota = document.elementFromPoint(e.clientX, e.clientY), altra = sota && sota.closest('.fila');
  if (altra && altra !== arros.fila && altra.parentNode === caixa) { const r = altra.getBoundingClientRect();
    altra.parentNode.insertBefore(arros.fila, (e.clientY < r.top + r.height / 2) ? altra : altra.nextSibling); }
}, { passive: false });
document.addEventListener('pointerup', () => {
  if (!arros) return;
  const seg = arros.fila.parentNode?.id === 'segells';   // Obra IV (d): també els Segells Preferents
  if (seg) estat.ordreSegTmp = [...document.querySelectorAll('#segells .fila')].map(f => +f.dataset.filasegell);
  else estat.ordreTmp = [...document.querySelectorAll('#files .fila')].map(f => +f.dataset.fila);
  arros.fila.classList.remove('agafat'); document.body.classList.remove('arrossegant'); arros = null; if (seg) pintaSegells(); else pintaFiles();
});
$('#fons').addEventListener('click', tancaFull);
$('#cerca').addEventListener('input', () => pintaHistorial());
document.addEventListener('keydown', e => { if (e.key === 'Escape') tancaFull(); });

// ───────── arrencar i connectar ─────────
// ───────── recarregar i quedar-se on era (ACT-743, 14-11, Ricard: «Ahora al refrescar siempre vuelve al inicio») ─────────
// Proposta de Claude, «Si a las tres»: (1) en recarregar (lliscar avall) tornen la pestanya, la subpantalla, l'alçada de la
// llista i la fitxa si era oberta (la Pila, quan hi hagi L'Aparador); (2) les fulles que s'obren des de la fitxa no es tornen
// a obrir, i el que s'hi escrivia a mitges es perd: torna la fitxa; (3) només en recarregar: amb l'app tancada del tot es
// torna a Discos en Rotació. Estat de pantalla a la memòria del navegador de la sessió (sessionStorage), com la ACT-706: no
// va a l'arxiu, sense estructura nova. «Recarregar» és el tipus de navegació del navegador (reload); obrir l'app no ho és.
const PANTALLA = 'tria-pantalla';
function recordaPantalla() {
  if (estat.superficie === 'entrada') return;
  const f = $('#full'), fitxa = f.classList.contains('obert') ? +f.dataset.cadena || null : null;
  N.desaPantalla({ sup: estat.superficie, abansSafata: estat.abansSafata || null, sub: estat.sub, psub: estat.psub || 'tots', rajola: estat.rajola || null, artista: estat.artista,
                   asub: estat.asub || 'pref', histMax: estat.histMax || null, y: Math.round(window.scrollY), fitxa, t: Date.now() });
}
addEventListener('pagehide', recordaPantalla);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') recordaPantalla(); });
// Si el navegador no ho diu (a vegades la llista de navegacions és buida), es dona per recàrrega un estat desat fa menys de
// dos minuts: lliscar avall torna en segons, i amb l'app tancada la memòria de la sessió ja no hi és.
const tipusNavegacio = (() => { try { return performance.getEntriesByType?.('navigation')?.[0]?.type || null; } catch { return null; } })();
// ACT-770 (canvia el punt 3): també obrir l'app abans de 15 minuts des de l'últim ús (t) torna on era.
const esRecarrega = p => tipusNavegacio === 'reload' || N.recent(p);
let pantallaTornada = false;
function tornaPantalla() {
  if (pantallaTornada) return false; pantallaTornada = true;
  const p = N.llegeixPantalla();
  // La safata també (ACT-748, 14-11: «al recargar en la safata vuelve a Discos en rotació»), amb la pantalla d'on s'havia
  // obert a sota, perquè «← Tornar» hi torni. Camp: el mateix estat de pantalla a sessionStorage, amb abansSafata.
  const LLOCS = ['faristol', 'prestatgeria', 'gramola', 'artista'];
  if (!p || !esRecarrega(p) || ![...LLOCS, 'safata'].includes(p.sup)) return false;
  const sota = p.sup === 'safata' ? (LLOCS.includes(p.abansSafata) ? p.abansSafata : 'faristol') : p.sup;
  if (sota === 'artista' && !p.artista) return false;
  if (p.histMax) estat.histMax = p.histMax;
  if (sota === 'artista') estat.artista = p.artista;
  if (p.sup === 'safata') { estat.abansSafata = sota; estat.sotaSensePintar = sota; }   // pinta() només pinta la de dalt
  vesA(p.sup);
  sub(SUBS.includes(p.sub) ? p.sub : 'rot');
  if (p.asub) aparador(p.asub);
  if (sota === 'prestatgeria') {   // com psub(), sense pintar: mostraMaquina pinta tot just després
    estat.psub = PSUBS.includes(p.psub) ? p.psub : 'tots';
    estat.rajola = R.esRajola(p.rajola) ? p.rajola : null;
    PSUBS.forEach(k => { $('#ptab-' + k).setAttribute('aria-selected', estat.psub === k); $('#q-' + k).classList.toggle('activa', estat.psub === k); });
  }
  const x = p.fitxa && p.sup !== 'safata' ? D.edicio(db(), p.fitxa) || D.fitxa(db(), p.fitxa) : null;
  if (x) fullFitxa(x);
  // l'alçada, quan la pantalla ja és pintada
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, p.y || 0)));
  return true;
}
function mostraMaquina() {
  puntBrut = true;   // ACT-796: obrir l'arxiu o carregar-lo del Drive
  $('#peu').hidden = false; $('#btInici').hidden = false; marcaEnrere();
  if (estat.superficie === 'entrada' && !tornaPantalla()) { vesA('faristol'); sub('rot'); }
  pinta(); marcaDesat();
  marcadorBandcamp();   // ACT-817: l'app oberta pel marcador «Codi per a la Discoteca»
}
function entrada(text, botons = '', classe = '') {
  vesA('entrada'); $('#peu').hidden = true; $('#btInici').hidden = true; INI.buida(); marcaEnrere(); document.body.classList.remove('desconnectat');
  $('#entradaTxt').className = classe; $('#entradaTxt').textContent = text; $('#entradaAccions').innerHTML = botons;
}
const BT = (id, text, principal) => `<button class="bt ${principal ? 'principal' : ''}" id="${id}">${text}</button>`;

// Connectar amb el Drive. Els casos difícils (paperera, conflicte, malmès…) són els del tram 1 i no es toquen.
async function connecta(ambGest) {
  try {
    if (ambGest) await A.permis();
    const r = await A.obre();
    if (r.cas === 'obert') {
      document.body.classList.toggle('desconnectat', !!r.fora);
      mostraMaquina();
      if (r.fora) avisa('Sense connexió: treballes amb la còpia d\'aquest mòbil.');
      else if (r.desat && !r.desat.desat) avisa('Hi ha canvis d\'aquest mòbil que encara no s\'han pogut desar: ' + r.desat.motiu + '.');
      // «Connectat» ja no s'avisa (3-11, Ricard): la franja magenta que desapareix ja ho diu. Només els avisos que diuen alguna cosa.
      else if (r.avis) avisa(r.avis);
      if (!r.fora) despresDeConnectar();
      llegeixEscoltes();
      return;
    }
    if (r.cas === 'sense-res') { entrada(r.detall + ' Entra amb Google per obrir l\'arxiu.', BT('entra', 'Entra amb Google', true), 'mal'); $('#entra').onclick = () => connecta(true); return; }
    if (r.cas === 'primera-vegada') { entrada('No hi ha cap arxiu al teu Drive, ni a la paperera, ni cap còpia en aquest mòbil. La llavor ja es va carregar el 26-10, així que això no hauria de passar: no creo res. Mira el Drive.', '', 'mal'); return; }
    if (r.cas === 'a-la-paperera') { entrada(`L'arxiu és a la paperera del Drive (${hora(r.fitxer.modifiedTime)}). No en creo cap de nou.`, BT('recupera', 'Treu-lo de la paperera', true), 'mal');
      $('#recupera').onclick = async () => { await A.recuperaDeLaPaperera(r.fitxer); connecta(false); }; return; }
    if (r.cas === 'nomes-local') { entrada(`No trobo l'arxiu al Drive, però aquest mòbil en té una còpia (${hora(r.copia.desat)}). No en creo cap de buit.`, BT('puja', 'Torna a pujar aquesta còpia', true), 'mal');
      $('#puja').onclick = async () => { await A.pujaCopiaLocal(r.copia); document.body.classList.remove('desconnectat'); mostraMaquina(); avisa('Còpia pujada al Drive.'); }; return; }
    if (r.cas === 'carpeta-sense-arxiu') { entrada(`La carpeta «${A.NOM_CARPETA}» existeix però l'arxiu no hi és, ni a la paperera. No en creo cap de buit: caldrà recuperar-lo d'una còpia de seguretat.`, '', 'mal'); return; }
    if (r.cas === 'malmes') { entrada('L\'arxiu del Drive no passa la comprovació d\'integritat: ' + r.detall + '. No el toco.', '', 'mal'); return; }
    if (r.cas === 'conflicte') {
      entrada(`L'arxiu ha canviat en un altre lloc (${hora(r.drive.modifiedTime)}) i aquest mòbil té canvis sense pujar. Quin mana? L'altre no s'esborra: es desa apart al Drive.`,
        BT('mDrive', 'Mana el Drive') + BT('mAqui', 'Mana aquest mòbil'), 'avis');
      // Els dos botons diuen que treballen i, si falla, ensenyen l'error i es poden tornar a tocar (fallada ACT-493).
      const treballa = async (boto, text, feina) => {
        const bs = [$('#mDrive'), $('#mAqui')]; bs.forEach(b => { b.disabled = true; }); const abans = boto.textContent; boto.textContent = text;
        try { await feina(); }
        catch (e) { bs.forEach(b => { b.disabled = false; }); boto.textContent = abans;
                    $('#entradaTxt').textContent = 'No s\'ha pogut fer: ' + e.message + '. Torna-ho a provar.'; $('#entradaTxt').className = 'mal'; }
      };
      $('#mDrive').onclick = () => treballa($('#mDrive'), 'Baixant el Drive…', async () => { const x = await A.resolConflicte('drive', r); if (x?.cas !== 'obert') throw new Error('el Drive no s\'ha pogut obrir'); connecta(false); });
      $('#mAqui').onclick = () => treballa($('#mAqui'), 'Pujant aquest mòbil…', async () => { await A.resolConflicte('aqui', r); document.body.classList.remove('desconnectat'); mostraMaquina(); avisa('Pujat al Drive. L\'altra versió s\'ha desat apart.'); });
      return;
    }
  } catch (e) {
    if (A.estat.db) { avisa('No s\'ha pogut connectar: ' + e.message); return; }
    entrada('No s\'ha pogut obrir: ' + e.message, BT('entra', 'Entra amb Google', true), 'mal'); $('#entra').onclick = () => connecta(true);
  }
}

// Després de connectar: l'ajust únic del «car pendent» i, en segon pla, la sonda d'imatges.
async function despresDeConnectar() {
  // ACT-793 a: un sol cop a la vida de l'arxiu, en silenci (només són dates; marca a meta, no es repeteix en cap mòbil).
  if (!J.ajust793Fet(db())) await fes(J.ajusta793, null, { desfes: false, auto: true });
  if (!D.ajustFet(db())) {   // (amb l'arxiu d'abans del 30-10; ja aplicat, no torna a passar)
    try { await A.copiaAlDrive('abans del car pendent del 30-10'); }
    catch (e) { avisa('No he pogut fer la còpia de seguretat (' + e.message + '): l\'ajust del car pendent espera a la propera connexió.'); return; }
    const fets = await fes(D.ajustaCarPendent3010, 'Car pendent del 30-10 aplicat');
    obreFull(`<h3>El «car pendent» del 30-10</h3><p>Abans de tocar res, s'ha desat una còpia de l'arxiu al Drive, al costat de l'original.</p>
      <ul class="fitxa-dades">${fets.map(f => `<li><span>${esc(f)}</span></li>`).join('')}</ul>
      <p>Si alguna cosa no quadra, «Desfés» a l'avís ho torna tot enrere.</p>`);
  }
  if (!D.ajust32bisFet(db())) {
    try { await A.copiaAlDrive('abans de l\'ajust del bloc 3.2 bis'); }
    catch (e) { avisa('No he pogut fer la còpia de seguretat (' + e.message + '): l\'ajust dels tags i dels codis espera a la propera connexió.'); sondes(); return; }
    const fets = await fes(D.ajusta32bis, 'Tags i codis de Bandcamp posats al seu lloc');
    obreFull(`<h3>Ajust del bloc 3.2 bis</h3><p>Abans de tocar res, s'ha desat una còpia de l'arxiu al Drive.</p>
      <ul class="fitxa-dades">${fets.map(f => `<li><span>${esc(f)}</span></li>`).join('')}</ul>
      <p>Si alguna cosa no quadra, «Desfés» a l'avís ho torna tot enrere.</p>`);
  }
  sondes();
  bustia();
  copiaAuto();
}

// La bústia de Bandcamp (bloc 3.5): primer es recullen els codis que ha deixat la tasca de nit, després s'escriu el que
// falta. El fitxer de pendents només s'escriu si ha canviat, i buit si no falta res: la tasca acaba sense buscar (ACT-468).
let bustiant = false;
async function bustia() {
  if (bustiant || !navigator.onLine || !A.tePermis()) return; bustiant = true;
  // L'estat es guarda per ensenyar-lo a La Cabina (12-11): abans un error es quedava a estat.bustiaError, que no llegia ningú.
  const b = estat.bustia = { quan: new Date().toISOString(), pendents: null, errors: [] };
  try {
    // Dos passos independents: si la lectura dels codis falla, els pendents s'escriuen igualment (i a l'inrevés).
    try {
      const codis = await A.llegeixCodisBustia();
      const fets = codis.length ? await fes(CB.aplicaCodisV(codis), null, { desfes: false, auto: true }) : [];   // ACT-814 (3.2, 3.3)
      if (fets.length) avisa(`Bandcamp: ${fets.length === 1 ? 'un codi nou' : fets.length + ' codis nous'}. El ▶ ja obre el disc a l'app.`);
    } catch (e) { b.errors.push('codis: ' + e.message); }
    try {
      // ACT-766: els que no s'han trobat en B.NITS nits queden apartats (fora del fitxer) i s'avisa una vegada.
      const r = B.pendentsAmbNits(db()), pend = r.envia, text = B.textPendents(pend.map(x => ({ ...x, clau: CB.clauAmbVersio(db(), x.clau) })));
      if (B.nitsNoves(db())) await fes(B.apuntaNits(), null, { desfes: false, auto: true });
      if (r.nous.length) avisa(r.nous.length === 1 ? `Bandcamp: «${r.nous[0].titol}» no s'ha trobat en ${B.NITS} nits. Queda apartat: enganxa l'enllaç a la seva fitxa.`
                                                   : `Bandcamp: ${r.nous.length} discos no s'han trobat en ${B.NITS} nits. Queden apartats: enganxa l'enllaç a la fitxa de cadascun.`);
      b.pendents = pend.length; b.apartats = r.apartats.length;
      let abans = null; try { abans = localStorage.getItem('tria-bustia'); } catch {}
      if (text !== abans) { await A.escriuPendentsBustia(text); try { localStorage.setItem('tria-bustia', text); } catch {} }
    } catch (e) { b.errors.push('pendents: ' + e.message); }
  } finally { bustiant = false; }
}

// La sonda no torna a provar cada dia el que no ha trobat: espera una setmana (es recorda en aquest mòbil).
const PROVATS = 'tria-sonda-provats-2', SETMANA = 7 * 864e5;   // -2: la cerca millorada del 30-10 torna a provar-ho tot
function provats() { try { return JSON.parse(localStorage.getItem(PROVATS) || '{}'); } catch { return {}; } }
function apunta(clau) { const p = provats(); p[clau] = Date.now(); try { localStorage.setItem(PROVATS, JSON.stringify(p)); } catch {} }
let sondant = false;
async function sondes() {
  if (sondant || !navigator.onLine) return; sondant = true;
  try {
    const p = provats(), fresc = k => !p[k] || Date.now() - p[k] > SETMANA;
    const discos = D.discosSensePortada(db()).filter(x => fresc('e' + x.id));
    const arts = D.artistesSenseRetrat(db()).filter(x => fresc('a' + x.id));
    if (!discos.length && !arts.length) return;
    const n1 = await I.passa(discos, async x => { const r = await I.sondaPortada(x); if (!r) apunta('e' + x.id); return r; },
      lot => fes(D.posaPortadaSonda(lot), null, { desfes: false, auto: true }), { cada: 25, cadaMs: 60e3 });   // ACT-750 (b)
    const n2 = await I.passa(arts, async x => { const r = await I.sondaRetrat(x); if (!r) apunta('a' + x.id); return r; },
      lot => fes(D.posaRetratSonda(lot), null, { desfes: false, auto: true }), { cada: 25, cadaMs: 60e3 });
    avisa(`La sonda: ${n1} portades de ${discos.length} i ${n2} fotos de ${arts.length}.`);
  } finally { sondant = false; }
}

A.vigilaPendents(r => {
  if (document.body.classList.contains('desconnectat')) return;
  // «Desat al Drive» només quan torna a funcionar després d'una fallada: el rellotge puja les lectures cada 30 s (ACT-750 a).
  const fallava = estat.desatFallat; marcaDesat(r); if (r.desat && fallava) avisa('Desat al Drive.');
});
$('#s-inici').innerHTML = INI.htmlInici();   // obra VI: el menú es pinta un cop; el punt i l'exclamació hi viuen
lliscar($('#s-faristol'));
aparador(N.darrerAparador());
lliscar($('#s-prestatgeria'), PSUBS, () => estat.psub || 'tots', psub);
$('#cercaArxiu').addEventListener('input', () => pintaArxiu());
$('#ordrePref').innerHTML = R.ORDRES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
$('#ordrePref').value = R.ordrePref();
$('#ordrePref').addEventListener('change', e => { R.posaOrdrePref(e.target.value); pintaFiles(); });
$('#ordreSeg').innerHTML = O4.ORDRES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');   // Obra IV (d)
$('#ordreSeg').value = O4.ordreSeg();
$('#ordreSeg').addEventListener('change', e => { O4.posaOrdreSeg(e.target.value); pintaSegells(); });
document.addEventListener('input', e => { if (e.target.id === 'inLlista') { estat.nomLlistaTxt = e.target.value; pintaSugLlista(); }
  const am = e.target.dataset?.sfactemin; if (am) { const [k, i] = am.split('|'); const a = estat.actesMaDe?.[k]; if (a) a.min[i] = e.target.value; } });
// ACT-787 (b): en canviar quants actes, es repinten les caselles (al «change», per no perdre el focus a cada tecla)
document.addEventListener('change', e => { const k = e.target.dataset?.sfnactes; if (!k || !estat.actesMaDe?.[k]) return;
  estat.actesMaDe[k].n = e.target.value; pintaSafata(); });
try { const l = localStorage.getItem('tria-lloc'); if (l === 'Lleida' || l === 'Fora') posaLloc(l, false); } catch {}
try { navigator.permissions?.query({ name: 'geolocation' }).then(r => { if (r.state === 'granted') detectaLloc(false); }).catch(() => {}); } catch {}

// Quan la màquina torna a primer pla (3-11): un altre mòbil o el portàtil poden haver canviat l'arxiu mentrestant.
// Si el Drive ha canviat, es torna a obrir pel camí de sempre (que llegeix ListenBrainz després); si no, només es llegeix.
// Sense això, el mòbil que tornava seguia amb la seva còpia vella i, en contestar, xocava amb el Drive.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !A.estat.db || !navigator.onLine) return;
  if (await A.haCanviat()) { connecta(false); return; }
  llegeixEscoltes();
  copiaAuto();
});

// Primer, la còpia d'aquest mòbil: el Faristol surt de seguida, sense esperar el Drive.
// Després, un toc a «Connecta amb el Drive» (Google el demana amb un gest) i es desa tot el que hagi quedat pendent.
(async () => {
  try {
    // La sonda no espera el Drive: busca sempre que hi ha xarxa, i el que troba es desa quan es connecti.
    if (await A.obreLocal()) {
      document.body.classList.add('desconnectat'); mostraMaquina(); sondes();
      // Amb el permís encara vigent en aquest mòbil (ACT-522), es connecta sol, sense toc i sense franja.
      if (A.tePermis() && navigator.onLine) connecta(false); else llegeixEscoltes();
      return;
    }
  } catch {}
  if (A.tePermis() && navigator.onLine) { connecta(false); return; }
  entrada('Entra amb Google per obrir l\'arxiu del teu Drive.', BT('entra', 'Entra amb Google', true));
  $('#entra').onclick = () => connecta(true);
})();
