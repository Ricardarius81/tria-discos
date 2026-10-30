// El Faristol viu (tram 3, bloc 3.1): la maqueta v13 pintada sobre l'arxiu de debò.
// Tot el que es toca s'escriu a l'arxiu (arxiu.canvia) i es desa al Drive. Cada canvi porta «Desfés».
// Bloc 3.2: portades i fotos que arriben soles i es recorden sense connexió, foto d'artista pujada a mà,
// connexió amb el Drive en un toc, i l'ajust del «car pendent» del 30-10.
// Encara no hi ha ListenBrainz (3.3), safata viva (3.4) ni Bandcamp automàtic (3.5).

import * as A from './arxiu.js?v=8';
import * as D from './dades.js?v=6';
import * as I from './imatges.js?v=3';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inicials = n => String(n || '').replace(/[^\p{L}\s.]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
// Les imatges es pinten buides, amb la seva referència; imatges.js les omple des del mòbil o des de la xarxa.
const IMG = ref => `<img data-ref="${esc(ref)}" alt="" referrerpolicy="no-referrer" onerror="var c=this.closest('.coberta');if(c)c.classList.remove('amb-img');this.remove()">`;
I.usaDrive(id => A.baixaImatge(id));
const db = () => A.estat.db;
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
  const c = CANALS[canal] || CANALS.amazon;
  return { href: c.url(q), nota: 'obre la cerca', ext: true };
}
const aAttrs = e => `href="${esc(e.href)}" ${e.ext ? 'target="_blank" rel="noopener"' : ''}`;

// ───────── estat de la pantalla ─────────
const estat = { superficie: 'entrada', sub: 'rot', ordena: false, ordreTmp: null, artista: null, escoltant: null, ultima: null, lloc: 'Fora', gps: 'Encara no s\'ha mirat la ubicació.' };

// ───────── avisos, fulls, desat ─────────
function avisa(txt, desfes) {
  $('#avisTxt').textContent = txt; $('#avis').classList.add('obert');
  $('#avisBt').style.display = desfes ? 'inline' : 'none'; estat.ultima = desfes || null;
  clearTimeout(window._t); window._t = setTimeout(() => $('#avis').classList.remove('obert'), 6500);
}
function obreFull(h) {
  $('#full').innerHTML = '<button class="torna-full" data-tornafull="1">← Tornar</button>' + h;
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
    if (b) { A.restaura(b).then(r => { pinta(); marcaDesat(r); }); avisa('Sense tocar res: el disc continua en rotació.'); }
  }
  f.classList.remove('obert'); $('#fons').classList.remove('obert');
}
function marcaDesat(r) {
  const pendent = A.estat.pendent;
  if (r && r.motiu === 'sense connectar amb el Drive') document.body.classList.add('desconnectat');
  $('#desat').classList.toggle('visible', !!pendent);
  if (r && !r.desat && !document.body.classList.contains('desconnectat')) {
    if (r.motiu === 'conflicte') avisa('L\'arxiu ha canviat en un altre lloc: torna a connectar per triar quin mana.');
    else avisa('Encara no s\'ha pogut desar al Drive (' + r.motiu + '). Queda en aquest mòbil i es torna a provar sol.');
  }
}

// Fer un canvi: s'escriu a l'arxiu, es pinta de seguida i es desa. «Desfés» torna l'arxiu a com era abans.
async function fes(fn, text, { desfes = true, abans = null } = {}) {
  abans = abans || A.estat.db.export();
  let res;
  const p = A.canvia(d => { res = fn(d); });
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
  pintaReixa(); pintaFiles();
  if (estat.superficie === 'artista' && estat.artista) pintaArtista(estat.artista);
  I.omple();
}

function pintaReixa() {
  const rot = D.rotacio(db());
  $('#reixa').innerHTML = rot.map(d => {
    const part = d.esperant
      ? `<span class="part">esperant</span><button class="repren" data-repren="${d.id}">Reprèn</button>`
      : (d.viva ? `<span class="part">${d.viva.nom ? esc(d.viva.nom) + ' · ' : ''}part ${d.viva.numero}/${d.parts.length}</span>` : '');
    const tags = d.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const dur = d.esperant ? '' : (d.min ? `<span class="durada">${d.min}′</span>` : `<span class="durada falta">falta la durada</span>`);
    const tit = d.viva?.nom && d.parts.length ? d.titol : d.titol;
    const canal = d.app_escolta;
    const play = d.esperant ? '' : (canal
      ? `<a class="escoltar" ${aAttrs(enllac(canal, { art: d.art, tit: d.titol, bc: d.bc }))} data-obre="${d.id}" aria-label="Escoltar ara ${esc(tit)}">▶</a>`
      : `<button class="escoltar" data-escoltar="${d.id}" aria-label="Escoltar ara ${esc(tit)}">▶</button>`);
    return `<div class="disc">
      <button class="coberta ${d.portada ? 'amb-img' : ''}" data-fitxa="${d.id}" aria-label="Fitxa de ${esc(tit)}">
        ${d.portada ? IMG(d.portada) : ''}<span class="a">${esc(d.art)}</span><span class="t">${esc(tit)}</span><span class="filet"></span>${dur}
      </button>${play}
      <button class="nom-sota" data-fitxa="${d.id}" tabindex="-1"><span><b>${esc(tit)}</b><i>${esc(d.art)}</i></span></button>
      <div class="peu">${part}${tags}</div>
    </div>`;
  }).join('') || `<p class="subtitol" style="margin:6px 0 0">No hi ha cap disc en rotació.</p>`;
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
      </button>${mou}
    </div>`;
  }).join('') || `<p class="subtitol" style="margin:12px 0 0">Encara no hi ha cap artista preferent.</p>`;
}

function pintaArtista(id) {
  const p = D.preferents(db()).find(x => x.id === id);
  if (!p) { vesA('faristol'); sub('pref'); return; }
  const r = p.rot, foto = p.retrat || r?.portada || null;
  $('#s-artista').innerHTML = `<button class="enrere" data-tornar="1">← Tornar</button>
    <div class="cap-artista">
      <span class="retrat-gran">${esc(inicials(p.nom))}${foto ? IMG(foto) : ''}</span>
      <div><h1>${esc(p.nom)}</h1><div class="estat" style="font-size:12.5px">${r ? 'Amb disc en rotació' : 'Preferent'}</div></div>
    </div>
    ${r ? `<div class="marcador ${r.portada ? 'amb-cob' : ''}">${r.portada ? `<span class="cob-fila">${IMG(r.portada)}</span>` : ''}<div><p class="cita">Ara estudies ${esc(r.titol)}.</p><p>És a Discos en Rotació.</p></div></div>`
      : p.proper_titol ? `<div class="marcador"><p class="cita">El proper: ${esc(p.proper_titol)}.</p><p>Quan un disc seu entri en rotació, aquesta nota s'esborra.</p>
          <div class="barra-accions" style="position:static;padding:4px 0 0"><button class="bt principal" data-escproper="${p.id}">Escoltar ara</button>
          <button class="bt" data-triaproper="${p.id}">Canvia'l</button><button class="bt discret" data-treuproper="${p.id}">Treu-lo</button></div></div>`
      : `<div class="marcador"><p class="cita">Encara no ha sonat res seu.</p><p>La màquina només sap el que passa des del dia que arrenca. Quan arribin les escoltes, sortirà aquí.</p></div>`}
    <div class="canals" style="margin-top:14px">
      ${(!r && !p.proper_titol) ? `<button data-triaproper="${p.id}">Tria el proper disc <small>el primer que vols escoltar</small></button>` : ''}
      <button data-canviafoto="${p.id}">Canvia la foto <small>${{ ma: 'la vas pujar tu', triat: 'la vas triar tu', sonda: 'la va trobar la màquina', rebutjat: 'la de la màquina no era' }[p.retrat_origen] || 'no n\'ha arribat cap de sola'}</small></button>
    </div>
    <div class="barra-accions" style="position:static;padding:14px 0 0"><button class="bt discret" data-desprefer="${p.id}">Treu-lo de preferents</button></div>`;
  I.omple($('#s-artista'));
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
      ${d.portada ? `<button data-noportada="${d.id}">Treu-la <small>no és aquesta, i no en tinc cap altra</small></button>` : ''}
    </div>
    <input type="file" id="inPortada" accept="image/*" hidden>`);
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
async function pujaPortada(d, fitxer) {
  if (!A.tePermis()) { avisa('Per pujar una portada cal estar connectat amb el Drive.'); return; }
  avisa('Pujant la portada…');
  try {
    const blob = await I.redueix(fitxer);
    const ref = 'drive:' + await A.pujaPortada(d.art + ' - ' + d.titol, blob);
    await I.guardaJa(ref, blob);
    tancaFull(); fes(D.posaPortada(d.id, ref, 'pujada'), 'Portada desada');
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
    <input type="file" id="inFoto" accept="image/*" hidden>`);
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
      : `<div class="barra-accions" style="position:static;padding:10px 0 0"><button class="bt discret" data-altrecanal="1">Un altre canal</button></div>`}`);
}

function fullFitxa(d) {
  const canal = d.app_escolta ? CANALS[d.app_escolta]?.nom || d.app_escolta : (d.fisic ? 'disc físic' : '—');
  const codi = d.app_escolta === 'bandcamp' ? (d.bc ? ' · amb codi' : ' · sense codi') : '';
  const jaPref = D.preferents(db()).some(p => p.artista_id === d.artista_id);
  obreFull(`${d.portada ? `<div class="fitxa-portada">${IMG(d.portada)}</div>` : ''}<h3>${esc(d.titol)}</h3><p>${esc(d.art)}</p>
    <ul class="fitxa-dades">
      <li><b>Durada</b><span>${d.min ? d.min + '′' : 'pendent'} <button class="sf-link" style="padding:0 0 0 8px" data-durada="${d.id}">canvia-la</button></span></li>
      <li><b>Canal</b><span>${esc(canal)}${codi}</span></li>
      ${d.formats.length ? `<li><b>Format</b><span>${esc(d.formats.map(f => NOMS_FISICS[f] || f).join(', '))}</span></li>` : ''}
      ${d.nom_edicio ? `<li><b>Edició</b><span>${esc(d.nom_edicio)}</span></li>` : ''}
      ${d.parts.length ? `<li><b>Part viva</b><span>${d.esperant ? 'cap: la caixa espera' : esc(d.viva.nom || '') + ' · ' + d.viva.numero + ' de ' + d.parts.length}</span></li>` : ''}
      <li><b>Portada</b><span>${ORIGEN_PORTADA[d.portada ? d.portada_origen || 'escolta' : d.portada_origen === 'rebutjada' ? 'rebutjada' : 'cap']}
        <button class="sf-link" style="padding:0 0 0 8px" data-canviaportada="${d.id}">canvia-la</button></span></li>
    </ul>
    <div class="barra-accions" style="position:static;padding:0">
      ${d.esperant ? `<button class="bt principal" data-repren="${d.id}">Reprèn</button>` : `<button class="bt principal" data-escoltar="${d.id}">Escoltar ara</button>`}
      ${jaPref ? '' : `<button class="bt" data-fespref="${d.artista_id}">Afegir a Artistes Preferents</button>`}
      <button class="bt" data-treure="${d.id}">Treu de rotació</button>
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
      <button class="bt discret" data-torna="${d.id}">Torna'l a la rotació</button></div>`);
  if (encara) $('#full').dataset.encaraNo = d.id;
}

function fullPart(d) {
  const n = d.viva.numero, ultima = Math.max(...d.parts.map(p => p.numero));
  const nom = d.viva.nom || d.titol;
  if (n >= ultima) {
    fes(D.treu(d.id), `${d.titol} fora de rotació`, { abans: estat.abansSortida });
    obreFull(`<h3>${esc(nom)} surt de rotació</h3><p>Era l'última part de ${esc(d.titol)}. L'edició es tanca, i la nota d'una caixa arriba en tancar la caixa.</p><p>Com la puntues?</p>
      <div class="escala">${D.ESCALA.map(([k, v]) => `<button data-punt="${v}" data-id="${d.id}">${k}</button>`).join('')}</div>
      <div class="barra-accions" style="position:static;padding:0"><button class="bt" data-puntencara="${d.id}">Encara no</button></div>`);
    $('#full').dataset.encaraNo = d.id; return;
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
    <p>Fins que arribin les escoltes de ListenBrainz (bloc 3.3), els discos entren així, a mà. Cap disc entra sense durada: llegeix-la del disc o de l'app, no de memòria.</p>
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
    </ul>
    <ul class="llista-ajust">
      <li><button data-connecta="1">${conn ? 'Torna a obrir des del Drive' : 'Connecta amb el Drive'} <small>${conn ? 'baixa la versió del Drive' : 'cal per desar'}</small></button></li>
      ${A.estat.pendent && conn ? `<li><button data-desaara="1">Desa ara <small>prova-ho una altra vegada</small></button></li>` : ''}
      <li><button disabled style="opacity:.6">ListenBrainz <small>bloc 3.3</small></button></li>
      <li><button disabled style="opacity:.6">Còpia de seguretat i Excel <small>tram 4</small></button></li>
      <li><a href="privadesa.html" target="_blank" rel="noopener">Política de privadesa <small>què surt d'aquest mòbil, i cap a on</small></a></li>
    </ul></div>`);
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
function lliscar(el) {
  let toc = null;
  el.addEventListener('touchstart', e => {
    toc = null; if (e.touches.length !== 1 || arros || e.target.closest('input,.nansa')) return;
    toc = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!toc || arros) return;
    const dx = e.changedTouches[0].clientX - toc.x, dy = e.changedTouches[0].clientY - toc.y; toc = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.6 * Math.abs(dy)) return;
    const i = SUBS.indexOf(estat.sub) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < SUBS.length) sub(SUBS[i]);
  }, { passive: true });
}

// ───────── els tocs ─────────
document.addEventListener('click', e => {
  const t = e.target.closest('button,a'); if (!t) return;
  const d = t.dataset;

  // Els enllaços d'escoltar naveguen sols; aquí només s'apunta l'obertura (opció C de l'ordre).
  if (t.tagName === 'A') {
    if (d.obre) { const id = +d.obre; setTimeout(() => fes(D.obre(id), null), 0); if ($('#full').classList.contains('obert')) tancaFull(); }
    return;
  }
  if (t.disabled) return;
  const rot = id => D.edicio(db(), +id);

  if (d.tornafull) { tancaFull(); return; }
  if (t.id === 'avisBt') { const f = estat.ultima; estat.ultima = null; $('#avis').classList.remove('obert'); if (f) f(); return; }
  if (t.id === 'btConnecta' || d.connecta) { tancaFull(); connecta(true); return; }
  if (d.desaara) { tancaFull(); A.desa().then(r => { marcaDesat(r); if (r.desat) avisa('Desat al Drive.'); }); return; }
  if (t.id === 'btAjustos') { if (A.estat.db) fullCabina(); return; }
  if (t.id === 'btLloc') { fullLloc(); return; }
  if (d.lloc) { estat.gps = 'Triat a mà.'; posaLloc(d.lloc); tancaFull(); return; }
  if (d.gps) { estat.gps = 'Mirant…'; detectaLloc(true); return; }
  if (t.id === 'btSafata') { if (!A.estat.db) return; if (estat.superficie !== 'safata') estat.abansSafata = estat.superficie; tancaFull(); vesA('safata'); return; }
  if (d.tornasafata) { vesA(estat.abansSafata || 'faristol'); return; }
  if (d.anar) { vesA(d.anar); return; }
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
  if (d.durada) { const x = rot(d.durada); if (x) fullDurada(x); return; }
  if (d.desadurada) { const x = rot(d.desadurada), m = parseInt($('#inDurada').value, 10);
    if (!x) return; if (!m || m < 1) { avisa('Cap disc es queda sense durada.'); return; }
    tancaFull(); fes(D.canviaDurada(x.id, m, x.viva?.id), `Durada: ${m}′`); return; }
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
  if (d.punt !== undefined) { const id = +d.id; delete $('#full').dataset.encaraNo; tancaFull();
    const nom = D.ESCALA.find(([, v]) => v === +d.punt)[0];
    fes(D.puntua(id, +d.punt), 'Puntuat: ' + nom, { abans: estat.abansSortida }); return; }
  if (d.puntencara) { delete $('#full').dataset.encaraNo; tancaFull(); fes(D.encaraNo(+d.puntencara), 'Sense nota, de moment. Tornarà.', { abans: estat.abansSortida }); return; }
  if (d.torna) { delete $('#full').dataset.encaraNo; tancaFull(); fes(D.tornaARotacio(+d.torna), 'Torna a la rotació', { abans: estat.abansSortida }); return; }
  if (d.espera) { tancaFull(); fes(D.deixaEsperant(+d.espera), 'La caixa queda esperant', { abans: estat.abansSortida }); return; }
  if (d.treuedicio) { const id = +d.treuedicio; const x = rot(id); tancaFull(); fes(D.treu(id), 'Fora de rotació', { abans: estat.abansSortida }); if (x) fullPuntuar(x); return; }
  if (d.seguent) { const [id, n] = d.seguent.split(':').map(Number); tancaFull(); fes(D.posaPart(id, n), 'La part ' + n + ' entra en rotació', { abans: estat.abansSortida }); return; }
  if (d.repren) { const x = rot(d.repren); tancaFull(); if (x) fullRepren(x); return; }
  if (d.reprenpart) { const [id, n] = d.reprenpart.split(':').map(Number); tancaFull(); fes(D.posaPart(id, n), 'La part ' + n + ' entra en rotació'); return; }
  if (d.fespref) { const aid = +d.fespref; tancaFull(); fes(D.afegeixPreferentId(aid), 'Afegit a Artistes Preferents'); sub('pref'); return; }

  // Imatges (bloc 3.2)
  if (d.canviaportada) { const x = rot(d.canviaportada); if (x) fullPortada(x); return; }
  if (d.cercaportada) { cercaPortada(); return; }
  if (d.triaportada) { const x = estat.portadaDe; if (!x) return; tancaFull();
    fes(D.posaPortada(x.id, d.triaportada, 'triada'), 'Portada triada'); return; }
  if (d.pujaportada) { $('#inPortada')?.click(); return; }
  if (d.noportada) { const id = +d.noportada; tancaFull(); fes(D.rebutjaPortada(id), 'Portada fora. Arribarà amb les escoltes, o la tries tu.'); return; }
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
      else if (r.desat) avisa('Connectat. Els canvis d\'aquest mòbil ja són al Drive.');
      else avisa(r.avis || 'Connectat amb el Drive.');
      if (!r.fora) despresDeConnectar();
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
      $('#mDrive').onclick = async () => { await A.resolConflicte('drive', r); connecta(false); };
      $('#mAqui').onclick = async () => { await A.resolConflicte('aqui', r); document.body.classList.remove('desconnectat'); mostraMaquina(); };
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
  sondes();
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
      lot => fes(D.posaPortadaSonda(lot), null, { desfes: false }), { cada: 2 });
    const n2 = await I.passa(arts, async x => { const r = await I.sondaRetrat(x); if (!r) apunta('a' + x.id); return r; },
      lot => fes(D.posaRetratSonda(lot), null, { desfes: false }), { cada: 2 });
    avisa(`La sonda: ${n1} portades de ${discos.length} i ${n2} fotos de ${arts.length}.`);
  } finally { sondant = false; }
}

A.vigilaPendents(r => {
  if (document.body.classList.contains('desconnectat')) return;
  marcaDesat(r); if (r.desat) avisa('Desat al Drive.');
});
lliscar($('#s-faristol'));
try { const l = localStorage.getItem('tria-lloc'); if (l === 'Lleida' || l === 'Fora') posaLloc(l, false); } catch {}
try { navigator.permissions?.query({ name: 'geolocation' }).then(r => { if (r.state === 'granted') detectaLloc(false); }).catch(() => {}); } catch {}

// Primer, la còpia d'aquest mòbil: el Faristol surt de seguida, sense esperar el Drive.
// Després, un toc a «Connecta amb el Drive» (Google el demana amb un gest) i es desa tot el que hagi quedat pendent.
(async () => {
  try {
    // La sonda no espera el Drive: busca sempre que hi ha xarxa, i el que troba es desa quan es connecti.
    if (await A.obreLocal()) { document.body.classList.add('desconnectat'); mostraMaquina(); sondes(); return; }
  } catch {}
  entrada('Entra amb Google per obrir l\'arxiu del teu Drive.', BT('entra', 'Entra amb Google', true));
  $('#entra').onclick = () => connecta(true);
})();
