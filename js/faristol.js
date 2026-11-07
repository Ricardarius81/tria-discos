// El Faristol viu (tram 3, bloc 3.1): la maqueta v13 pintada sobre l'arxiu de debò.
// Tot el que es toca s'escriu a l'arxiu (arxiu.canvia) i es desa al Drive. Cada canvi porta «Desfés».
// Bloc 3.2: portades i fotos que arriben soles i es recorden sense connexió, foto d'artista pujada a mà,
// connexió amb el Drive en un toc, i l'ajust del «car pendent» del 30-10.
// Bloc 3.2 bis (31-10): una sola fitxa del disc, que creix (ACT-391): el canal, la nota amb els seus dos gestos
// i els tags en dos grups; la revisió de tags en treure un disc de rotació (pregunta 11).
// Blocs 3.3 + 3.4 + 3.5 (v1.44), una sola publicació: les escoltes de ListenBrainz, la safata viva i la bústia.
// Pas u: el Scrobble, l'Arrencada, la lectura de les dues comptes, la pregunta 2, les tirades, l'Historial i «Grup».

import * as A from './arxiu.js?v=17';
import * as D from './dades.js?v=22';
import * as E from './escoltes.js?v=11';
import * as LB from './listenbrainz.js?v=2';
import * as I from './imatges.js?v=4';
import * as T from './tags.js?v=1';
import * as C from './copies.js?v=2';
import * as X from './excel.js?v=2';
import * as L from './llistes.js?v=1';
import * as V from './discografia.js?v=1';

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
  $('#avisTxt').textContent = txt; $('#avis').classList.add('obert');
  $('#avisBt').style.display = desfes ? 'inline' : 'none'; estat.ultima = desfes || null;
  clearTimeout(window._t); window._t = setTimeout(() => $('#avis').classList.remove('obert'), 6500);
}
// complet: les fitxes i La Cabina ocupen tota la pantalla, com la safata (3-11, Ricard). Les fulles d'acció ràpida
// (la nota, el ▶ del grup, el canal…) es queden a mitja pantalla, perquè el fons fa de context.
function obreFull(h, complet = false) {
  estat.resoltaOberta = null;
  $('#full').innerHTML = '<button class="torna-full" data-tornafull="1">← Tornar</button>' + h;
  $('#full').classList.toggle('complet', complet);
  $('#full').classList.add('obert'); $('#fons').classList.add('obert'); $('#full').scrollTop = 0;
  I.omple($('#full'));
}
function tancaFull() {
  const f = $('#full');
  // Tancar la fulla de puntuar sense tocar res desfà tota la sortida: el disc continua en rotació (decisió B de Ricard, 30-10).
  // Per treure'l sense nota, «Encara no».
  if (f.dataset.encaraNo) {
    delete f.dataset.encaraNo;
    const b = estat.abansSortida; estat.abansSortida = null;
    // Si has tocat els tags però no la nota, el disc continua en rotació i els tags es queden: són judici sobre el disc,
    // no sobre la sortida (invenció de Claude del 31-10, per validar).
    const tg = estat.tagsSortida; estat.tagsSortida = null; estat.sortint = null;
    if (b) { A.restaura(b).then(async r => { if (tg) await fes(D.desaTags(tg.id, tg.album_id, tg), null, { desfes: false }); pinta(); marcaDesat(r); });
             avisa(tg ? 'Sense nota: el disc continua en rotació, i els tags que has tocat es queden.' : 'Sense tocar res: el disc continua en rotació.'); }
  }
  f.classList.remove('obert'); $('#fons').classList.remove('obert');
}
function marcaDesat(r) {
  const pendent = A.estat.pendent;
  if (r && r.motiu === 'sense connectar amb el Drive') document.body.classList.add('desconnectat');
  $('#desat').classList.toggle('visible', !!pendent);
  if (r && !r.desat && r.motiu !== 'obrint' && !document.body.classList.contains('desconnectat')) {
    // Si el que hi ha pendent són només lectures de la màquina (ListenBrainz, sonda, bústia), no és un conflicte: es torna a
    // obrir l'arxiu del Drive en silenci i es tornen a fer (ACT-492). El sortia en tornar a primer pla amb dos mòbils (3-11).
    if (r.motiu === 'conflicte' && !A.estat.manual) { connecta(false); return; }
    if (r.motiu === 'conflicte') avisa('L\'arxiu ha canviat en un altre lloc: torna a connectar per triar quin mana.');
    else avisa('Encara no s\'ha pogut desar al Drive (' + r.motiu + '). Queda en aquest mòbil i es torna a provar sol.');
  }
}

// Fer un canvi: s'escriu a l'arxiu, es pinta de seguida i es desa. «Desfés» torna l'arxiu a com era abans.
async function fes(fn, text, { desfes = true, abans = null, auto = false } = {}) {
  abans = abans || A.estat.db.export();
  let res;
  const p = A.canvia(d => { res = fn(d); }, { auto });
  pinta();
  if (text) avisa(typeof text === 'function' ? text(res) : text,
    desfes ? async () => { delete $('#full').dataset.encaraNo; if ($('#full').classList.contains('obert')) tancaFull();
                           const r = await A.restaura(abans); pinta(); marcaDesat(r); } : null);
  marcaDesat();
  const r = await p; marcaDesat(r);
  return res;
}

// ───────── pintar ─────────
function pinta() {
  if (!A.estat.db) return;
  sincroCanals();
  pintaReixa(); pintaFiles(); pintaHistorial(); pintaSafata(); alertaCopia();
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
      const e = x.app_escolta ? enllac(x.app_escolta, { art: x.art, tit: x.titol, bc: x.bc }) : null;
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
    ? `<a class="${classe}" ${aAttrs(enllac(d.app_escolta, { art: d.art, tit: d.titol, bc: d.bc }))} data-obre="${d.id}" aria-label="Escoltar ara ${esc(d.titol)}">▶</a>`
    : `<button class="${classe}" data-escoltar="${d.id}" aria-label="Escoltar ara ${esc(d.titol)}">▶</button>`;
}
function pintaReixa() {
  const rot = D.rotacio(db()), prefs = D.artistesPreferents(db());
  $('#reixa').innerHTML = grups(rot).map(d => { if (d.grup) return tileGrup(d, prefs);
    const part = d.esperant
      ? `<span class="part">esperant</span><button class="repren" data-repren="${d.id}">Reprèn</button>`
      : (d.viva ? `<span class="part">${d.viva.nom ? esc(d.viva.nom) + ' · ' : ''}part ${d.viva.numero}/${d.parts.length}</span>` : '');
    const tags = T.curts(d.album_tags, d.tags).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const dur = d.esperant ? '' : (d.min ? `<span class="durada">${d.min}′</span>` : `<span class="durada falta">falta la durada</span>`);
    const tit = d.viva?.nom && d.parts.length ? d.titol : d.titol;
    const canal = d.app_escolta;
    const play = d.esperant ? '' : (canal
      ? `<a class="escoltar" ${aAttrs(enllac(canal, { art: d.art, tit: d.titol, bc: d.bc }))} data-obre="${d.id}" aria-label="Escoltar ara ${esc(tit)}">▶</a>`
      : `<button class="escoltar" data-escoltar="${d.id}" aria-label="Escoltar ara ${esc(tit)}">▶</button>`);
    return `<div class="disc${prefs.has(d.artista_id) ? ' pref' : ''}">
      <button class="coberta ${d.portada ? 'amb-img' : ''}" data-fitxa="${d.id}" aria-label="Fitxa de ${esc(tit)}">
        ${d.portada ? IMG(d.portada) : ''}<span class="a">${esc(d.art)}</span><span class="t">${esc(tit)}</span><span class="filet"></span>${dur}
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
      ${(!r && !p.proper_titol) ? `<button data-triaproper="${p.id}">Tria el proper disc <small>el primer que vols escoltar</small></button>` : ''}
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
    + (!v.candidats.length && !r.avis && !r.motiu ? '<p class="subtitol">Res.</p>' : '');
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
function filesHistorial() {
  return E.historial(db()).map(f => {
    if (f.grup) {
      const m = f.edicions.map(id => D.fitxa(db(), id)).filter(Boolean).sort(perOrdre);
      return { ...f, membres: m, titol: titolGrup(f.grup, m), art: [...new Set(m.map(x => x.art))].join(' · '),
               min: m.every(x => x.min) ? m.reduce((a, x) => a + x.min, 0) : null };
    }
    const d = D.fitxa(db(), f.edicio_id);
    return d ? { ...f, d, titol: d.titol, art: d.art, min: d.min } : null;
  }).filter(Boolean);
}
function pintaHistorial() {
  const caixa = $('#hist'); if (!caixa) return;
  const totes = filesHistorial();
  const filtre = norm($('#cerca')?.value);
  let tr = '', h = '';
  for (const f of totes) {
    if (filtre && !norm(f.art + ' ' + f.titol).includes(filtre)) continue;
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
      <span class="hdreta">${d.min ? `<span class="hdur">${d.min}′</span>` : ''}
        ${d.rotacio_actual ? `<span class="hja">en rotació</span>` : `<button class="hrot" data-hrot="${d.id}">＋ Rotació</button>`}</span>${botoPlay(d, 'hplay')}
    </div>`;
  }
  caixa.innerHTML = h || (totes.length ? `<p class="subtitol" style="margin:18px 0 0">Res amb aquest nom.</p>`
    : `<div class="marcador"><p class="cita">L'Historial encara és buit.</p><p>S'omple amb el que sona${E.arrencada(db()) ? ' des del ' + dia(E.arrencada(db())) : ''}: la màquina només sap el que passa des del dia que arrenca. Un disc hi surt tan bon punt sona; mentre no arriba al 75 %, porta «a mitges».</p></div>`);
  I.omple(caixa);
}
// La fila d'un grup a l'Historial s'obre com la del ▶ d'un grup: els discos de l'última tirada, cadascun amb el seu ▶.
function fullGrupHistorial(nom) {
  const f = filesHistorial().find(x => x.grup === nom); if (!f) return;
  obreFull(`<h3>${esc(f.titol)}</h3><p>${f.n === 1 ? 'Una escolta' : f.n + ' escoltes'} · l'última, ${esc(quan(f.darrera))}.</p>
    <div class="llista-grup">${f.membres.map((x, i) => {
      const e = x.app_escolta ? enllac(x.app_escolta, { art: x.art, tit: x.titol, bc: x.bc }) : null;
      return `<div class="membre">
        <button class="mini" data-fitxa="${x.id}">${x.portada ? IMG(x.portada) : ''}</button>
        <button class="txt" data-fitxa="${x.id}"><b>${i + 1}. ${esc(x.titol)}</b><small>${esc(x.art)}${x.min ? ' · ' + x.min + '′' : ''}${x.rotacio_actual ? ' · en rotació' : ''}</small></button>
        ${e ? `<a class="play" ${aAttrs(e)} data-obre="${x.id}" aria-label="Escoltar ${esc(x.titol)}">▶</a>` : `<button class="play" data-escoltar="${x.id}">▶</button>`}
      </div>`; }).join('')}</div>`);
}

// ───────── La Prestatgeria, primer bloc (ACT-622) ─────────
// Tots els discos: una fila per edició (ACT-637), per artista, amb cercador i sense filtres (ACT-636). La fila obre la
// mateixa fitxa del Faristol (ACT-391). Agrupacions: els grups i les Llistes de reproducció (ACT-632 a ACT-635).
// L'Afinació espera (ACT-622).
const MIN_MS = 60e3;
const minutsDe = ms => Math.round(ms / MIN_MS);
function pintaPrestatgeria() {
  if (!A.estat.db) return;
  if (estat.psub === 'agr') pintaAgrupacions(); else pintaArxiu();
}
function pintaArxiu() {
  const caixa = $('#arxiu'); if (!caixa) return;
  const tots = D.totsElsDiscos(db()), f = norm($('#cercaArxiu')?.value);
  const ll = f ? tots.filter(x => x.cerca.includes(f)) : tots;
  $('#arxiuCompte').textContent = f ? `${ll.length} de ${tots.length} discos` : `${tots.length} discos, per artista`;
  // Dues edicions del mateix àlbum: el nom de l'edició, si en té, i sempre la durada (ACT-637).
  caixa.innerHTML = ll.map(x => `<button class="ar-fila" data-fitxa="${x.id}">
      <span class="hcob">${esc(inicials(x.art))}${x.portada ? IMG(x.portada) : ''}</span>
      <span class="htxt"><span class="htit">${esc(x.titol)}</span><span class="hart">${esc(x.art)}${x.n_edicions > 1 && x.nom_edicio ? ' · ' + esc(x.nom_edicio) : ''}${x.n_parts ? ` · <i>${x.n_parts} parts</i>` : ''}${x.rotacio_actual ? ' · <i>en rotació</i>' : ''}</span></span>
      <span class="m">${x.durada_total}′</span></button>`).join('')
    || `<p class="subtitol" style="margin:14px 0 0">${tots.length ? 'Res amb aquest nom.' : 'L\'arxiu encara és buit.'}</p>`;
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
  caixa.innerHTML = `<h2 class="ag-cap">Grups</h2>${gs.map(filaGrup).join('') || '<p class="subtitol">Encara no hi ha cap grup. Es fa des de la fitxa d\'un disc: «agrupa\'l amb…».</p>'}
    <h2 class="ag-cap">Llistes</h2>${ls.map(filaLlista).join('') || '<p class="subtitol">Encara no hi ha cap llista. Es fa des de la safata, amb les cançons soltes d\'una sessió: «Això és una llista».</p>'}
    ${ls.some(l => l.incompleta) ? '<p class="subtitol" style="font-size:12px;margin:10px 0 0">Una durada amb «+» és incompleta: alguna cançó va arribar sense durada.</p>' : ''}`;
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
      <div class="sf-chips"><button class="principal" data-sfllistanova="${clau}">Desa-la</button><button class="mes" data-sfllistaobre="">Deixa-ho</button></div></div>`;
  const p = s.proposta;
  const altra = `<button class="${p ? 'mes' : ''}" data-sfllistaobre="${clau}">${p ? 'No: és una altra llista' : 'Això és una llista'}</button>`;
  return h + `<div class="sf-chips sf-llistes">${p ? `<button class="principal" data-sfllistasi="${clau}|${p.id}">${p.continua ? 'Afegeix-les a ' + esc(p.nom) : 'Sí, és ' + esc(p.nom)}${p.noves ? ` · s'hi ${p.noves === 1 ? 'afegeix una cançó' : 'afegeixen ' + p.noves + ' cançons'}` : ''}</button>` : ''}${altra}</div>
    ${p || n < 2 ? '' : `<p class="sf-pre" style="margin-top:4px">${n} cançons soltes en aquesta sessió.</p>`}`;
}
const targetaDe = clau => E.targetes(db(), { estat: 'totes' }).find(x => x.clau === +clau);
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
function cuaSafata() {
  if (!A.estat.db) return { q2: [], nous: [], soltes: [], rot: [], tg: [] };
  const { nous, soltes } = E.discosNous(db(), mbCache);
  return { q2: E.preguntes2(db()), nous, soltes, rot: E.preguntesRotacio(db()), tg: E.targetes(db(), { estat: 'totes' }) };
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
  const ids = new Set(idsDe(clau, E.targetes(db(), { estat: 'totes' })));
  const out = [];
  for (const c of E.targetes(db(), { estat: 'totes' })) for (const s of c.scr) if (ids.has(s.id) && s.artista && !out.some(a => norm(a) === norm(s.artista))) out.push(s.artista);
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
function blocNou(x) {
  const a = D.trobaArtista(db(), x.artista);
  const canal = estat.nouCanalDe?.[x.clau] || D.canalPerDefecte(db(), a?.id);
  const pref = estat.nouPrefDe?.[x.clau];
  return `<div data-nou="${esc(x.clau)}"><p class="sf-q">Disc nou: la durada i el canal</p>
    <label class="camp"><span>Durada en minuts <small class="gris">· ${x.proposta.font}</small></span>
      <input data-sfdur="${esc(x.clau)}" type="number" inputmode="numeric" min="1" value="${x.proposta.minuts}"></label>
    ${x.proposta.font === 'el que ha sonat' ? `<p class="sf-pre">Només és la del disc si l'has sentit sencer.</p>` : ''}
    <p class="sf-q">Per on l'escoltes?</p>
    <div class="sf-chips">${Object.keys(CANALS).map(k => `<button class="${canal === k ? 'triat' : ''}" data-sfcanal="${esc(x.clau)}|${esc(k)}">${esc(CANALS[k].nom)}</button>`).join('')}
      ${altreCanal(estat.altreCanalDe === 'nou:' + x.clau, 'nou', x.clau)}</div>
    ${canal === 'bandcamp' ? `<p class="sf-pre">El codi de Bandcamp el busca Claude cada nit. No has de fer res.</p>` : ''}
    <div class="sf-chips" style="margin-top:12px">
      <button class="principal" data-sfnou="${esc(x.clau)}|arxiu">Desa'l</button>
      <button data-sfnou="${esc(x.clau)}|rotacio">Desa'l i posa'l en rotació</button>
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
  const posats = new Set();
  const fila = d => {
    const k = clauDisc(d), esSolta = !d.edicio_id && k && solta.has(k);
    let bloc = '';
    if (k && (q2.has(k) || nous.has(k))) {
      if (posats.has(k)) bloc = `<p class="sf-pre" style="padding-left:54px">Es resol a la targeta de sobre.</p>`;
      else { posats.add(k); bloc = q2.has(k) ? blocQ2(q2.get(k)) : blocNou(nous.get(k)); }
    }
    const extra = d.edicio_id ? '' : esSolta ? ` · <i>cançó solta</i>` : '';
    return minDisc(d, extra) + (esSolta ? `<button class="sf-link" style="padding:0 0 6px 54px" data-sfdisc="${esc(k)}">És un disc</button>` : '')
      + (d.edicio_id ? `<button class="sf-link sf-canal" data-sfcanaldisc="${d.edicio_id}">Canal: ${esc(nomCanal(d.app_escolta))} · canvia'l</button>` : '') + bloc;
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
    if (x.q === 7) return `<div class="sf-card"><span class="sf-tipus">Tres escoltes en sis mesos</span>${minDisc(d)}
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
  const res = tg.filter(c => (c.estat === 'resolta' && !cuaTg.includes(c)) || (c.estat === 'oberta' && !obertes.includes(c))).slice(0, 8);
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
        mbCache.set(x.mbid, { titol: j.title, pistes: pistes.length, minuts: pistes.every(t => t.length) ? Math.round(ms_ / 60000) : null });
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
    const tard = db_ => E.heretaRespostes()(db_);
    // Un arxiu que acaba de passar a l'estructura 6 té les escoltes sense unió: es tornen a calcular un cop (ACT-585).
    const unio = E.calRecalcular(db());
    const cal = !E.arrencada(db()) || noves.length || E.calHeretar(db()) || unio;
    if (cal) {
      const r = await fes(x => { E.fixaArrencada(arr)(x); const n = E.desaScrobbles(noves)(x); E.aplicaIgnoraSempre(x); const h = tard(x); const em = E.emparellaSols(x); return { n, h, em, ...((n || h || em || unio) ? E.recalcula(x) : {}) }; }, null, { desfes: false, auto: true });
      // Sense avís de «pistes noves» (2-11): el número de la safata ja ho diu, i l'avís tapava la franja magenta.
    }
    // Només una lectura sencera (les dues comptes) i ja desada al mòbil compta com a bona.
    E.fixaLectura(inici); try { localStorage.setItem(LECTURA, String(inici)); } catch {}
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

function fullFitxa(d) {
  const canal = d.app_escolta ? CANALS[d.app_escolta]?.nom || d.app_escolta : (d.fisic ? 'disc físic' : '—');
  const codi = d.app_escolta === 'bandcamp' ? (d.bc ? ' · amb codi' : ' · sense codi') : '';
  const jaPref = D.preferents(db()).some(p => p.artista_id === d.artista_id);
  obreFull(`${d.portada ? `<div class="fitxa-portada">${IMG(d.portada)}</div>` : ''}<h3>${esc(d.titol)}</h3><p>${esc(d.art)}</p>
    <ul class="fitxa-dades">
      <li><b>Durada</b><span>${d.min ? d.min + '′' : 'pendent'} <button class="sf-link" style="padding:0 0 0 8px" data-durada="${d.id}">canvia-la</button></span></li>
      <li><b>Canal</b><span>${esc(canal)}${codi} <button class="sf-link" style="padding:0 0 0 8px" data-canalfitxa="${d.id}">canvia'l</button></span></li>
      <li><b>Nota</b><span>${textNota(d)} <button class="sf-link" style="padding:0 0 0 8px" data-notafitxa="${d.id}">${d.nota ? 'canvia-la' : 'posa-li nota'}</button></span></li>
      ${d.formats.length ? `<li><b>Format</b><span>${esc(d.formats.map(f => NOMS_FISICS[f] || f).join(', '))}</span></li>` : ''}
      <li><b>Edició</b><span>${d.nom_edicio ? esc(d.nom_edicio) : (d.n_edicions > 1 ? 'sense nom' : 'l\'única que hi ha')} <button class="sf-link" style="padding:0 0 0 8px" data-canviaedicio="${d.id}">canvia-la</button></span></li>
      <li><b>Grup</b><span>${d.discosGrup.length > 1 ? `<b>${esc(titolGrup(d.conjunt, d.discosGrup))}</b> · ${d.discosGrup.length} discos
        <button class="sf-link" style="padding:0 0 0 8px" data-fitxagrup="${esc(d.conjunt)}">obre el grup</button>`
        : `cap <button class="sf-link" style="padding:0 0 0 8px" data-agrupa="${d.id}">agrupa'l amb…</button>`}</span></li>
      ${d.parts.length ? `<li><b>Part viva</b><span>${d.esperant ? 'cap: la caixa espera' : esc(d.viva.nom || '') + ' · ' + d.viva.numero + ' de ' + d.parts.length}</span></li>` : ''}
      <li><b>Portada</b><span>${d.parts.length ? '<small class="gris">de la caixa:</small> ' : ''}${ORIGEN_PORTADA[d.portada_edicio ? d.portada_origen || 'escolta' : d.portada_origen === 'rebutjada' ? 'rebutjada' : 'cap']}
        <button class="sf-link" style="padding:0 0 0 8px" data-canviaportada="${d.id}">canvia-la</button></span></li>
    </ul>
    ${d.parts.length ? blocParts(d) : ''}
    ${blocTags(d)}
    <div class="barra-accions" style="position:static;padding:0">
      ${d.esperant ? `<button class="bt principal" data-repren="${d.id}">Reprèn</button>` : `<button class="bt principal" data-escoltar="${d.id}">Escoltar ara</button>`}
      ${jaPref ? '' : `<button class="bt" data-fespref="${d.artista_id}">Afegir a Artistes Preferents</button>`}
      ${d.rotacio_actual ? `<button class="bt" data-treure="${d.id}">Treu de rotació</button>` : `<button class="bt" data-hrot="${d.id}">Posa'l en rotació</button>`}
    </div>
    ${blocEsborra(d)}`, true);
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

function fullPuntuar(d, encara = true) {
  obreFull(`<h3>${esc(d.titol)} surt de rotació</h3><p>Com el puntues?</p>
    <div class="escala">${D.ESCALA.map(([n, v]) => `<button data-punt="${v}" data-id="${d.id}">${n}</button>`).join('')}</div>
    <div class="barra-accions" style="position:static;padding:0">
      <button class="bt" data-puntencara="${d.id}">Encara no</button>
      <button class="bt discret" data-torna="${d.id}">Torna'l a la rotació</button></div>
    <h3 style="margin-top:22px">Els tags</h3>${blocTags(D.fitxa(db(), d.id) || d)}`);
  if (encara) $('#full').dataset.encaraNo = d.id;
  estat.sortint = d.id; estat.tagsSortida = null;
}

function fullPart(d) {
  const n = d.viva.numero, ultima = Math.max(...d.parts.map(p => p.numero));
  const nom = d.viva.nom || d.titol;
  if (n >= ultima) {
    fes(D.treu(d.id), `${d.titol} fora de rotació`, { abans: estat.abansSortida });
    obreFull(`<h3>${esc(nom)} surt de rotació</h3><p>Era l'última part de ${esc(d.titol)}. L'edició es tanca, i la nota d'una caixa arriba en tancar la caixa.</p><p>Com la puntues?</p>
      <div class="escala">${D.ESCALA.map(([k, v]) => `<button data-punt="${v}" data-id="${d.id}">${k}</button>`).join('')}</div>
      <div class="barra-accions" style="position:static;padding:0"><button class="bt" data-puntencara="${d.id}">Encara no</button></div>
      <h3 style="margin-top:22px">Els tags</h3>${blocTags(D.fitxa(db(), d.id) || d)}`);
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

function fullAfegeixDisc() {
  estat.nouCanal = 'amazon';
  const botons = () => [...Object.keys(CANALS), ...Object.keys(NOMS_FISICS)]
    .map(k => `<button data-noucanal="${k}" class="${estat.nouCanal === k ? 'triat' : ''}">${CANALS[k]?.nom || NOMS_FISICS[k]}</button>`).join('');
  obreFull(`<h3>Posa un disc en rotació</h3>
    <p>Els discos que sonen arriben sols a la safata. Aquí en poses un a mà: un de físic, o un que encara no ha sonat. Cap disc entra sense durada: llegeix-la del disc o de l'app, no de memòria.</p>
    <label class="camp"><span>Artista</span><input id="inArt" type="text" autocomplete="off"></label>
    <label class="camp"><span>Títol</span><input id="inTit" type="text" autocomplete="off"></label>
    <label class="camp"><span>Durada en minuts</span><input id="inMin" type="number" inputmode="numeric" min="1"><span class="ajuda">Si el disc ja té fitxa a l'arxiu, es queda la seva durada i aquí no cal res.</span></label>
    <div class="camp"><span>Per on l'escoltes</span></div>
    <div class="canals-tria" id="nousCanals">${botons()}</div>
    <div class="barra-accions" style="position:static;padding:0"><button class="bt principal" data-desaama="1">Posa'l en rotació</button></div>`);
  estat.pintaCanals = () => { $('#nousCanals').innerHTML = botons(); };
  $('#inArt').addEventListener('change', e => {
    const a = D.trobaArtista(db(), e.target.value);
    if (a) { estat.nouCanal = D.canalPerDefecte(db(), a.id); estat.pintaCanals(); }
  });
  setTimeout(() => $('#inArt')?.focus(), 50);
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
      ${(() => { const v = E.veredicte(db()); if (!v) return '';
        const pc = x => Math.round(x * 100) + ' %';
        return `<li><span class="ll-info">Prova de la safata <small>${v.llest
          ? `${v.falla ? '<b class="mal">no la passa</b>' : '<b class="ok">la passa</b>'} · «No ho sé» ${pc(v.pctNose)} de ${v.contestades} (màxim 33 %) · ignorades ${pc(v.pctIgnorades)} de ${v.targetes} (màxim 10 %)`
          : `el resultat surt el ${dia(v.dataLlesta)}, quan faci un mes`}</small></span></li>`; })()}
      <li><button data-ignorats="1">Artistes que s'ignoren sempre <small>${(n => n ? (n === 1 ? 'un' : n) + ' · obre la llista' : 'cap')(E.ignoraSempre(db()).length)}</small></button></li>
      <li><span class="ll-info">ListenBrainz <small>${E.arrencada(db()) ? 'les dues comptes, des del ' + dia(E.arrencada(db())) + ' · ' + r.scrobble + ' pistes' : 'encara no s\'ha llegit'}${estat.lbError ? ' · ' + esc(estat.lbError) : ''}</small></span></li>
      ${liniesCopia()}
      <li><a href="privadesa.html" target="_blank" rel="noopener">Política de privadesa <small>què surt d'aquest mòbil, i cap a on</small></a></li>
    </ul></div>`, true);
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
  return `<li><span class="ll-info">Còpia de seguretat <small>${dv ? `la darrera, del ${diaD(dv)} · la propera, sola, a partir del ${diaD(propera)}` : 'encara no n\'hi ha cap'}${C.caducada() ? ' · <b class="mal">fa més de 8 dies</b>' : ''} · se'n guarden ${C.MANTENIR}</small></span></li>
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
let copiant = false, copiaMirada = 0;
async function copiaAuto() {
  if (copiant || Date.now() - copiaMirada < 15 * 60e3) return;
  copiaMirada = Date.now(); copiant = true;
  try { await despresDeCopia(await C.siToca(), false); }
  catch (e) { estat.copiaError = 'no s\'ha pogut fer: ' + e.message; alertaCopia(); }
  finally { copiant = false; }
}
async function copiaAra() {
  if (copiant) { avisa('Ja s\'està fent una còpia.'); return; }
  copiant = true; avisa('Fent la còpia…');
  try { await despresDeCopia(await C.fes(), true); }
  catch (e) { estat.copiaError = 'no s\'ha pogut fer: ' + e.message; alertaCopia(); avisa('No s\'ha pogut fer la còpia: ' + e.message); }
  finally { copiant = false; if ($('#full').classList.contains('obert') && $('#full .menu-net')) fullCabina(); }
}
async function descarregaExcel() {
  try {
    const b = await X.xlsx(db());
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
function vesA(sup) {
  estat.superficie = sup;
  document.querySelectorAll('.superficie').forEach(s => s.classList.toggle('activa', s.id === 's-' + sup));
  document.querySelectorAll('nav.peu button').forEach(b => {
    const act = b.dataset.anar === sup || (sup === 'artista' && b.dataset.anar === 'faristol');
    if (act) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}
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
  if (d.desaara) { tancaFull(); A.desa().then(r => { marcaDesat(r); if (r.desat) avisa('Desat al Drive.'); }); return; }
  if (t.id === 'btAjustos') { if (A.estat.db) fullCabina(); return; }
  if (t.id === 'btLloc') { fullLloc(); return; }
  if (d.lloc) { estat.gps = 'Triat a mà.'; posaLloc(d.lloc); tancaFull(); return; }
  if (d.gps) { estat.gps = 'Mirant…'; detectaLloc(true); return; }
  if (t.id === 'btSafata') { if (!A.estat.db) return; if (estat.superficie !== 'safata') estat.abansSafata = estat.superficie; tancaFull(); vesA('safata'); pintaSafata(); llegeixEscoltes(); return; }
  if (d.tornasafata) { vesA(estat.abansSafata || 'faristol'); return; }
  if (d.anar) { vesA(d.anar); if (d.anar === 'prestatgeria') pintaPrestatgeria(); return; }
  if (d.psub) { if ($('#full').classList.contains('obert')) tancaFull(); psub(d.psub); return; }
  if (d.sub) { if ($('#full').classList.contains('obert')) tancaFull(); sub(d.sub); return; }
  if (d.tornar) { vesA('faristol'); sub('pref'); return; }

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
  if (d.agrupa) { const x = rot(d.agrupa); if (x) fullAgrupa(x); return; }
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
  if (d.durada) { const x = rot(d.durada); if (x) fullDurada(x); return; }
  if (d.desadurada) { const x = rot(d.desadurada), m = parseInt($('#inDurada').value, 10);
    if (!x) return; if (!m || m < 1) { avisa('Cap disc es queda sense durada.'); return; }
    // Les escoltes es calculen amb la durada (Escolta.completitud): en canviar-la, es tornen a calcular (ACT-582, Variant Immersions).
    tancaFull(); fes(y => { D.canviaDurada(x.id, m, x.viva?.id)(y); E.recalcula(y); }, `Durada: ${m}′`); return; }
  if (d.escoltar) { const x = rot(d.escoltar); if (!x) return; tancaFull();
    fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, fisic: x.fisic }); return; }
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
    fes(D.puntua(id, +d.punt), 'Puntuat: ' + nom, { abans: estat.abansSortida }); return; }
  if (d.puntencara) { delete $('#full').dataset.encaraNo; estat.sortint = null; estat.tagsSortida = null; tancaFull(); fes(D.encaraNo(+d.puntencara), 'Sense nota, de moment. Tornarà.', { abans: estat.abansSortida }); return; }
  if (d.torna) { delete $('#full').dataset.encaraNo; estat.sortint = null; estat.tagsSortida = null; tancaFull(); fes(D.tornaARotacio(+d.torna), 'Torna a la rotació', { abans: estat.abansSortida }); return; }
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
  if (d.grup) { fullGrup(d.grup); return; }
  if (d.grupplay) { fullGrupEscolta(d.grupplay); return; }
  if (d.fitxagrup) { fullGrup(d.fitxagrup); return; }

  // La safata: la pregunta 2 (§8.10, ACT-469). Confirmar o triar una altra edició queda recordat a l'edició.
  if (d.q2si) { const [clau, id] = [d.q2si.slice(0, d.q2si.lastIndexOf('|')), +d.q2si.slice(d.q2si.lastIndexOf('|') + 1)];
    const q = E.preguntes2(db()).find(x => x.clau === clau); if (!q) return;
    const ed = q.candidates.find(c => c.id === id);
    fes(x => { E.confirmaEdicio(id, q)(x); return E.recalcula(x); }, `${q.album || q.pista}: és ${ed ? ed.titol + (ed.nom_edicio ? ' (' + ed.nom_edicio + ')' : '') : 'aquesta edició'}. Queda recordat.`);
    return; }
  if (d.q2altres) { estat.q2obert = d.q2altres; pintaSafata(); return; }
  // les targetes de sessió
  if (d.sfctx) { const [clau, ctx] = d.sfctx.split('|');
    if (E.preguntaAtencio(ctx)) { (estat.ctxTmp ||= {})[clau] = ctx; pintaSafata(); return; }
    const ids = idsDe(clau, E.targetes(db(), { estat: 'totes' })); if (!ids.length) return;
    fes(E.contesta(ids, ctx, null, deQui(clau)), ctx === 'No ho sé' ? 'No ho sé' : ctx); return; }
  if (d.sfatencio) { const [clau, b] = d.sfatencio.split('|'), ctx = estat.ctxTmp?.[clau]; if (!ctx) return; delete estat.ctxTmp[clau];
    const ids = idsDe(clau, E.targetes(db(), { estat: 'totes' })); if (!ids.length) return;
    fes(E.contesta(ids, ctx, b, deQui(clau)), r => r.ctx === 'Dormir' && ctx === 'A casa' ? 'A casa, dormint: queda com a Dormir' : ctx + ' · ' + b); return; }
  if (d.sfctxdesfes) { delete estat.ctxTmp[d.sfctxdesfes]; pintaSafata(); return; }
  if (d.sftots) { (estat.ctxTots ||= {})[d.sftots] = true; pintaSafata(); return; }
  if (d.sfsepara) { (estat.separades ||= new Set()).add(+d.sfsepara); pintaSafata(); return; }
  if (d.sfignora) { const ids = idsDe(d.sfignora, E.targetes(db(), { estat: 'totes' })); if (!ids.length) return;
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
  if (d.canviaedicio) { const x = D.fitxa(db(), +d.canviaedicio); if (x) fullEdicio(x); return; }
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
  if (d.sfnou) { const [k, on] = d.sfnou.split('|');
    const x = E.discosNous(db(), mbCache).nous.find(y => y.clau === k); if (!x) return;
    const min = parseInt(document.querySelector(`[data-sfdur="${CSS.escape(k)}"]`)?.value, 10);
    if (!min || min < 1) { avisa('Cap disc entra sense durada.'); return; }
    const a = D.trobaArtista(db(), x.artista), canal = estat.nouCanalDe?.[k] || D.canalPerDefecte(db(), a?.id), pref = estat.nouPrefDe?.[k];
    fes(y => { const r = E.creaDiscNou({ album: x.album || x.pista, artista: x.artista, recording_msid: x.recording_msid, minuts: min, canal, rotacio: on === 'rotacio' })(y);
               if (pref) D.afegeixPreferentId(r.artista_id)(y); return r; },
      `${x.album || x.pista} entra a l'arxiu${on === 'rotacio' ? ' i a la rotació' : ''}${pref ? ', i l\'artista a preferents' : ''}`); return; }
  // les preguntes 7, 8 i 9
  if (d.sfq7) { const [id, r] = d.sfq7.split('|'); fes(E.respon7(+id, r === 'si'), r === 'si' ? 'Entra a la rotació' : 'D\'acord: no tornaré a preguntar fins d\'aquí a tres escoltes'); return; }
  if (d.sfq8) { const [id, r] = d.sfq8.split('|'), x = D.fitxa(db(), +id); if (!x) return;
    if (r === 'si') { estat.abansSortida = A.estat.db.export(); fes(y => { E.tocaReferencia(+id)(y); D.treu(+id)(y); }, `${x.titol} fora de rotació`, { abans: estat.abansSortida }); fullPuntuar(x); return; }
    fes(E.tocaReferencia(+id), r === 'ara' ? null : 'Encara no: segueix en rotació');
    if (r === 'ara') fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, fisic: x.fisic }); return; }
  if (d.sfq9) { const [id, r] = d.sfq9.split('|'), x = D.fitxa(db(), +id); if (!x) return;
    if (r === 'no') { estat.abansSortida = A.estat.db.export(); fes(y => { E.tocaReferencia(+id)(y); D.treu(+id)(y); }, `${x.titol} fora de rotació`, { abans: estat.abansSortida }); fullPuntuar(x); return; }
    fes(E.tocaReferencia(+id), r === 'ara' ? null : 'Segueix en rotació');
    if (r === 'ara') fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, fisic: x.fisic }); return; }
  if (d.q2no) { const q = E.preguntes2(db()).find(x => x.clau === d.q2no); if (!q) return;
    fes(E.rebutjaEmparellament(q), `${q.album || q.pista}: no és cap d'aquestes. Serà un disc nou.`); return; }

  // L'Historial
  if (d.hescoltar) { const x = D.fitxa(db(), +d.hescoltar); if (!x) return;
    fullEscoltar({ id: x.id, art: x.art, tit: x.titol, min: x.min, canal: x.app_escolta, bc: x.bc, fisic: x.fisic }); return; }
  if (d.hrot) { const id = +d.hrot, x = D.fitxa(db(), id); if (!x) return;
    fes(D.posaIdEnRotacio(id), `${x.titol} entra a Discos en Rotació`); if (t.closest('#full')) fullFitxa(rot(id)); return; }
  if (d.hgrup) { fullGrupHistorial(d.hgrup); return; }

  // La fitxa que creix (bloc 3.2 bis)
  if (d.canalfitxa) { const x = rot(d.canalfitxa); if (x) { estat.canalDes = 'fitxa'; delete estat.altreCanalDe; fullCanal(x); } return; }
  if (d.desacanal) { const i = d.desacanal.indexOf('|'), id = d.desacanal.slice(0, i), k = d.desacanal.slice(i + 1); const x = rot(id); if (!x) return;
    fes(D.canviaCanal(+id, k), `Canal: ${nomCanal(k)}. Queda recordat.`);
    if (estat.canalDes === 'safata') tancaFull(); else fullFitxa(rot(id)); return; }
  if (d.notafitxa) { const x = rot(d.notafitxa); if (x) fullNota(x); return; }
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
  if (d.canviaportada) { const x = rot(d.canviaportada); if (x) fullPortada({ ...x, portada: x.portada_edicio, partId: null }); return; }
  // La portada d'una part d'una caixa (ACT-624): la mateixa fulla, amb el títol de la part per cercar.
  if (d.portadapart) { const [id, pid] = d.portadapart.split(':').map(Number), x = rot(id), p = x?.parts.find(y => y.id === pid); if (!p) return;
    fullPortada({ ...x, titol: x.titol + (p.nom ? ' ' + p.nom : ' ' + p.numero), portada: p.portada, partId: pid }); return; }
  if (d.cercaportada) { cercaPortada(); return; }
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
  if (d.desaartista) { const n = $('#inNom').value.trim(); if (!n) { avisa('Cal un nom.'); return; }
    tancaFull(); fes(D.afegeixPreferent(n), r => r.jaHiEra ? n + ' ja hi era.' : n + ' afegit a Artistes Preferents'); return; }
  if (t.id === 'btOrdena') {
    if (!estat.ordena) { estat.ordena = true; estat.ordreTmp = D.preferents(db()).map(p => p.id); t.textContent = 'Fet'; t.setAttribute('aria-pressed', 'true'); pintaFiles(); return; }
    const ids = estat.ordreTmp; estat.ordena = false; estat.ordreTmp = null; t.textContent = 'Ordena la llista'; t.setAttribute('aria-pressed', 'false');
    fes(D.ordenaPreferents(ids), 'Ordre desat'); return;
  }
  if (d.mou) { const [i, dir] = d.mou.split(':').map(Number), j = i + dir, o = estat.ordreTmp;
    if (!o || j < 0 || j >= o.length) return; const [a] = o.splice(i, 1); o.splice(j, 0, a); pintaFiles(); return; }
  if (d.artista) { estat.artista = +d.artista; pintaArtista(estat.artista); vesA('artista'); return; }
  if (d.vei) { const [pid, dir] = d.vei.split(':'); fullVei(+pid, dir); return; }
  if (d.veides) { const [pid, dir, i] = d.veides.split(':'); fullVei(+pid, dir, +i); return; }
  if (d.discografia) { fullDiscografia(+d.discografia); return; }
  if (d.veimb) { const c = $('#veins'); if (c) c.innerHTML = '<p class="subtitol">Cercant…</p>'; cercaVei(d.veimb); return; }
  if (d.triavei) { const v = estat.vei, x = v?.candidats[+d.triavei]; if (!x) return;
    tancaFull(); fes(D.posaProper(v.pid, x.titol), 'El proper: ' + x.titol); return; }
  if (d.triaproper) { fullProper(+d.triaproper); return; }
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
  const sota = document.elementFromPoint(e.clientX, e.clientY), altra = sota && sota.closest('#files .fila');
  if (altra && altra !== arros.fila) { const r = altra.getBoundingClientRect();
    altra.parentNode.insertBefore(arros.fila, (e.clientY < r.top + r.height / 2) ? altra : altra.nextSibling); }
}, { passive: false });
document.addEventListener('pointerup', () => {
  if (!arros) return;
  estat.ordreTmp = [...document.querySelectorAll('#files .fila')].map(f => +f.dataset.fila);
  arros.fila.classList.remove('agafat'); document.body.classList.remove('arrossegant'); arros = null; pintaFiles();
});
$('#fons').addEventListener('click', tancaFull);
$('#cerca').addEventListener('input', () => pintaHistorial());
document.addEventListener('keydown', e => { if (e.key === 'Escape') tancaFull(); });

// ───────── arrencar i connectar ─────────
function mostraMaquina() {
  $('#peu').hidden = false;
  if (estat.superficie === 'entrada') { vesA('faristol'); sub('rot'); }
  pinta(); marcaDesat();
}
function entrada(text, botons = '', classe = '') {
  vesA('entrada'); $('#peu').hidden = true; document.body.classList.remove('desconnectat');
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
  try {
    const codis = await A.llegeixCodisBustia();
    const fets = codis.length ? await fes(E.aplicaCodis(codis), null, { desfes: false, auto: true }) : [];
    if (fets.length) avisa(`Bandcamp: ${fets.length === 1 ? 'un codi nou' : fets.length + ' codis nous'}. El ▶ ja obre el disc a l'app.`);
    const text = E.textPendents(E.pendentsBandcamp(db()));
    let abans = null; try { abans = localStorage.getItem('tria-bustia'); } catch {}
    if (text !== abans) { await A.escriuPendentsBustia(text); try { localStorage.setItem('tria-bustia', text); } catch {} }
  } catch (e) { estat.bustiaError = e.message; }
  finally { bustiant = false; }
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
      lot => fes(D.posaPortadaSonda(lot), null, { desfes: false, auto: true }), { cada: 2 });
    const n2 = await I.passa(arts, async x => { const r = await I.sondaRetrat(x); if (!r) apunta('a' + x.id); return r; },
      lot => fes(D.posaRetratSonda(lot), null, { desfes: false, auto: true }), { cada: 2 });
    avisa(`La sonda: ${n1} portades de ${discos.length} i ${n2} fotos de ${arts.length}.`);
  } finally { sondant = false; }
}

A.vigilaPendents(r => {
  if (document.body.classList.contains('desconnectat')) return;
  marcaDesat(r); if (r.desat) avisa('Desat al Drive.');
});
lliscar($('#s-faristol'));
lliscar($('#s-prestatgeria'), PSUBS, () => estat.psub || 'tots', psub);
$('#cercaArxiu').addEventListener('input', () => pintaArxiu());
document.addEventListener('input', e => { if (e.target.id === 'inLlista') estat.nomLlistaTxt = e.target.value; });
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
