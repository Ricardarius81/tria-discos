// El disc anterior i el següent d'un artista preferent (ACT-626, ACT-646 a ACT-652, 7-11).
// Aquí només hi ha la cerca a fora: la Wikipedia en anglès i, si falla, MusicBrainz. Res no es desa ni es precarrega:
// es consulta quan Ricard toca el botó i s'oblida. La pantalla posa al proper el que ell tria (Preferent.Proper disc).
//
// Quins discos compten (ACT-651): estudi, directes, EP, discos de versions, bandes sonores, enregistraments de camp
// i discos a mitges amb un altre artista. Fora: recopilatoris, remescles, DJ-mix, mixtapes, senzills, demos,
// caixes, vídeos, entrevistes, spoken word, audiollibres i ràdio.
//
// Quan es passa a MusicBrainz (ACT-652): (1) no hi ha fitxa del disc a la Wikipedia; (2) la fitxa no té cronologia;
// (3) la fitxa és d'un altre artista; (4) la cronologia s'acaba després de saltar els tipus de fora; (5) més de
// SALTS salts seguits per tipus de fora.

const WP = 'https://en.wikipedia.org/w/api.php';
const MB = 'https://musicbrainz.org/ws/2';
export const SALTS = 5;                 // ACT-652, cas 5: xifra de Claude, sense calibrar
const DE_MB = 5;                        // quants discos de MusicBrainz es proposen en cada sentit
const ESPERA_MB = 1100;                 // MusicBrainz: com a màxim una consulta per segon

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const espera = ms => new Promise(r => setTimeout(r, ms));
// «Kind of Blue (album)», «Foo (Pearl Jam album)», «Bar (EP)» → sense la desambiguació de la Wikipedia.
export const senseDesamb = t => String(t || '').replace(/\s*\((?:[^()]*\s)?(?:album|EP|soundtrack|mixtape)\)\s*$/i, '').trim();
const sensePar = t => String(t || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || String(t || '');
const titolsDe = t => new Set([norm(t), norm(sensePar(t)), norm(senseDesamb(t))].filter(Boolean));

async function json(u, mb) {
  const r = await fetch(u, mb ? { headers: { Accept: 'application/json' } } : {});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// ───────── els tipus (ACT-651) ─────────
// Wikipedia: el paràmetre «type» de l'infobox. El que no és a la llista no entra.
const TIPUS_WP = { studio: 'estudi', live: 'directe', ep: 'EP', soundtrack: 'banda sonora', cover: 'versions' };
export function tipusWP(v) {
  const net = String(v || '').toLowerCase().replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').trim();
  if (net === 'album') return 'estudi';            // les fitxes velles: «Type = Album» volia dir d'estudi
  return TIPUS_WP[net.replace(/\balbum\b/g, '').replace(/[^a-z]/g, '')] || null;
}
// MusicBrainz: el tipus principal Album o EP, i com a secundaris només Live, Soundtrack o Field recording.
const SEC_MB = { Live: 'directe', Soundtrack: 'banda sonora', 'Field recording': 'enregistrament de camp' };
export function tipusMB(g) {
  const p = g['primary-type'], s = g['secondary-types'] || [];
  if (p !== 'Album' && p !== 'EP') return null;
  if (s.some(x => !SEC_MB[x])) return null;
  return s.length ? s.map(x => SEC_MB[x]).join(', ') : (p === 'EP' ? 'EP' : 'estudi');
}

// ───────── llegir l'infobox de la Wikipedia ─────────
// Les plantilles «{{Nom …}}» d'un text, amb les claus niades ben comptades.
export function plantilles(text, nom) {
  const out = [], re = new RegExp('\\{\\{\\s*(?:' + nom + ')\\s*[|}]', 'gi');
  let m;
  while ((m = re.exec(text))) {
    let i = m.index, d = 0;
    for (; i < text.length; i++) {
      if (text.startsWith('{{', i)) { d++; i++; }
      else if (text.startsWith('}}', i)) { d--; i++; if (d === 0) break; }
    }
    out.push(text.slice(m.index + 2, i - 1));
    re.lastIndex = i;
  }
  return out;
}
// Els paràmetres «| clau = valor» del primer nivell d'una plantilla.
export function parametres(t) {
  const parts = []; let d = 0, cur = '';
  for (let i = 0; i < t.length; i++) {
    const dos = t.slice(i, i + 2);
    if (dos === '{{' || dos === '[[') { d++; cur += dos; i++; continue; }
    if (dos === '}}' || dos === ']]') { d--; cur += dos; i++; continue; }
    if (t[i] === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += t[i];
  }
  parts.push(cur);
  const o = {};
  for (const p of parts.slice(1)) {
    const k = p.indexOf('='); if (k < 0) continue;
    o[p.slice(0, k).trim().toLowerCase().replace(/\s+/g, '_')] = p.slice(k + 1).trim();
  }
  return o;
}
// Un valor de l'infobox: el text net i, si n'hi ha, la pàgina a què enllaça.
export function valor(v) {
  const s = String(v || '').replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const m = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/.exec(s);
  const text = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '').replace(/\{\{[^{}]*\}\}/g, '').replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '').trim();
  return { text, pagina: m ? m[1].trim() : null };
}
// Els noms que surten al camp «artist» (els enllaçats i el text sencer).
function nomsArtista(v) {
  const s = String(v || '');
  const enllacats = [...s.matchAll(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g)].map(m => m[1]);
  const tot = valor(s).text;
  return [tot, ...enllacats, ...tot.split(/\s+(?:and|&|with|featuring|feat\.)\s+|,\s*/i)].map(norm).filter(Boolean);
}
const esDeLArtista = (v, noms) => nomsArtista(v).some(n => noms.has(n));

// L'infobox d'un disc: el títol, l'artista, el tipus i les seves cronologies (la principal i les «Extra chronology»
// que són del mateix artista). Cada cronologia porta l'anterior i el següent, amb la pàgina si n'hi ha enllaç.
export function llegeixInfobox(wikitext, noms) {
  const ib = plantilles(wikitext, 'Infobox album')[0];
  if (!ib) return null;
  const p = parametres(ib);
  const any = s => (/\b(1[89]\d\d|20\d\d)\b/.exec(String(s || '')) || [])[1] || '';
  const veí = (titol, year) => { if (!titol) return null; const v = valor(titol); return v.text ? { ...v, text: v.text.replace(/\s*\(\d{4}\)\s*$/, ''), any: any(year || titol) } : null; };
  const out = { titol: valor(p.name).text, artista: p.artist || '', tipus: tipusWP(p.type), deLArtista: esDeLArtista(p.artist, noms), cronologies: [] };
  const ant = veí(p.prev_title, p.prev_year) || veí(p.last_album), seg = veí(p.next_title, p.next_year) || veí(p.next_album);
  if (out.deLArtista && (ant || seg)) out.cronologies.push({ nom: valor(p.chronology).text || 'principal', principal: true, ant, seg });
  for (const x of plantilles(ib, 'Extra chronology')) {
    const q = parametres(x);
    if (q.artist && !esDeLArtista(q.artist, noms)) continue;
    if (!q.artist && !out.deLArtista) continue;
    const a = veí(q.prev_title, q.prev_year), s = veí(q.next_title, q.next_year);
    if (a || s) out.cronologies.push({ nom: valor(q.type).text || 'altra', ant: a, seg: s });
  }
  return out;
}

async function wikitext(pagina) {
  const j = await json(`${WP}?action=parse&page=${encodeURIComponent(pagina)}&prop=wikitext&section=0&redirects=1&format=json&formatversion=2&origin=*`);
  return j?.parse?.wikitext || '';
}

// La fitxa del disc de partida: la cerca de la Wikipedia, i de les tres primeres pàgines amb el mateix títol,
// la primera que és un disc. Si n'hi ha amb el títol però d'un altre artista, es diu (cas 3).
async function fitxaWP({ titol, art }, noms) {
  const q = `${sensePar(titol)} ${art} album`;
  const j = await json(`${WP}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=8&srprop=&format=json&formatversion=2&origin=*`);
  const tit = titolsDe(titol);
  const pags = (j?.query?.search || []).map(x => x.title).filter(t => tit.has(norm(senseDesamb(t))) || tit.has(norm(sensePar(t)))).slice(0, 3);
  let altre = false;
  for (const pg of pags) {
    const ib = llegeixInfobox(await wikitext(pg), noms);
    if (!ib || !(tit.has(norm(ib.titol)) || tit.has(norm(senseDesamb(pg))))) continue;
    if (!ib.deLArtista) { altre = true; continue; }
    return { ib, pagina: pg };
  }
  return { motiu: altre ? 'la fitxa és d\'un altre artista' : 'no hi ha fitxa d\'aquest disc' };
}

// Camina una cronologia en un sentit fins al primer disc d'un tipus que entra. Torna el disc, o el motiu del fracàs.
async function camina(cron, dir, noms) {
  let v = cron[dir];
  for (let salt = 0; v; salt++) {
    if (salt >= SALTS) return { motiu: `més de ${SALTS} salts per discos que no entren` };
    if (!v.pagina) return { motiu: 'la cronologia arriba a un disc sense fitxa' };
    const ib = llegeixInfobox(await wikitext(v.pagina), noms);
    if (!ib) return { motiu: 'la cronologia arriba a un disc sense fitxa' };
    if (ib.tipus) return { disc: { titol: senseDesamb(ib.titol || v.text), any: v.any, tipus: ib.tipus, font: 'Wikipedia', cronologia: cron.principal ? null : cron.nom } };
    // Un tipus que no entra: el seu veí, a la cronologia del mateix nom (o la principal).
    const c = ib.cronologies.find(x => norm(x.nom) === norm(cron.nom)) || ib.cronologies[0];
    v = c ? c[dir] : null;
  }
  return { motiu: 'la cronologia s\'acaba' };
}

// ───────── MusicBrainz ─────────
// Els artistes de MusicBrainz que es diuen com el nostre (pel nom o un àlies).
async function artistesMB(art, noms) {
  const j = await json(`${MB}/artist/?query=${encodeURIComponent(`artist:"${art}"`)}&fmt=json&limit=10`, true);
  return (j.artists || []).filter(a => noms.has(norm(a.name)) || (a.aliases || []).some(x => noms.has(norm(x.name))))
    .map(a => ({ id: a.id, nom: a.name, desamb: [a.disambiguation, a.country].filter(Boolean).join(' · ') }));
}
// La discografia d'un artista de MusicBrainz, només amb els tipus que entren, per data (sense data, al final).
export async function discografiaMB(id) {
  const tots = [];
  for (let off = 0, total = 1; off < total && off < 300; off += 100) {
    if (off) await espera(ESPERA_MB);
    const j = await json(`${MB}/release-group?artist=${encodeURIComponent(id)}&type=album|ep&limit=100&offset=${off}&fmt=json`, true);
    total = j['release-group-count'] || 0;
    tots.push(...(j['release-groups'] || []));
  }
  return tots.map(g => ({ g, tipus: tipusMB(g) })).filter(x => x.tipus)
    .map(({ g, tipus }) => ({ titol: g.title, any: (g['first-release-date'] || '').slice(0, 4), data: g['first-release-date'] || '9999', tipus, font: 'MusicBrainz', mbid: g.id }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.titol.localeCompare(b.titol));
}
// La posició del disc de partida: primer pel títol exacte (normalitzat), i només si no hi és, sense el parèntesi final.
const posicio = (llista, titol) => {
  const i = llista.findIndex(x => norm(x.titol) === norm(titol)); if (i >= 0) return i;
  const t = titolsDe(titol); return llista.findIndex(x => t.has(norm(x.titol)) || t.has(norm(sensePar(x.titol))));
};

// La discografia sencera, per a «Tria de la discografia» i quan la partida no es troba (ACT-650).
// Si hi ha homònims a MusicBrainz, torna la llista perquè Ricard triï quin és: no se n'endevina cap.
export async function discografia({ art, noms, mbid = null }) {
  if (!navigator.onLine) return { sense: true };
  try {
    let id = mbid;
    if (!id) {
      const as = await artistesMB(art, noms);
      if (!as.length) return { motiu: 'MusicBrainz no coneix aquest artista', candidats: [] };
      if (as.length > 1) return { homonims: as };
      id = as[0].id; await espera(ESPERA_MB);
    }
    return { candidats: await discografiaMB(id), font: 'MusicBrainz', llista: true, mbid: id };
  } catch (e) { return { error: e.message }; }
}

// ───────── el disc anterior o el següent ─────────
// partida: { titol, art, noms } (noms: el conjunt normalitzat de nom canònic i variants de l'artista del disc).
// dir: 'ant' o 'seg'. Torna { candidats, font, avis?, llista? } o { sense } o { homonims } o { error }.
export async function vei(partida, dir, { mbid = null } = {}) {
  if (!navigator.onLine) return { sense: true };
  const { noms } = partida;
  let motiu = null;
  try {
    if (!mbid) {
      const f = await fitxaWP(partida, noms);
      if (f.ib) {
        if (!f.ib.cronologies.length) motiu = 'la fitxa no té cronologia';
        else {
          const trobats = [], motius = [];
          for (const c of f.ib.cronologies) {
            const r = await camina(c, dir, noms);
            if (r.disc && !trobats.some(x => norm(x.titol) === norm(r.disc.titol))) trobats.push(r.disc); else if (r.motiu) motius.push(r.motiu);
          }
          if (trobats.length) return { candidats: trobats, font: 'Wikipedia' };
          motiu = motius[0] || 'la cronologia s\'acaba';
        }
      } else motiu = f.motiu;
    }
    // MusicBrainz (ACT-652).
    let id = mbid;
    if (!id) {
      const as = await artistesMB(partida.art, noms);
      if (!as.length) return { candidats: [], motiu: (motiu ? motiu + ', i ' : '') + 'MusicBrainz no coneix aquest artista' };
      // Entre homònims, el que té el disc de partida; si no es pot saber, tria Ricard.
      if (as.length > 1) {
        const amb = [];
        for (const a of as.slice(0, 3)) { await espera(ESPERA_MB); const l = await discografiaMB(a.id); if (posicio(l, partida.titol) >= 0) amb.push({ a, l }); }
        if (amb.length !== 1) return { homonims: as, motiu };
        return desDeLlista(amb[0].l, partida, dir, motiu, amb[0].a.id);
      }
      id = as[0].id;
    }
    await espera(ESPERA_MB);
    return desDeLlista(await discografiaMB(id), partida, dir, motiu, id);
  } catch (e) { return { error: e.message }; }
}
function desDeLlista(llista, partida, dir, motiu, mbid) {
  const i = posicio(llista, partida.titol);
  const per = motiu ? `A la Wikipedia, ${motiu}.` : '';
  // La partida no hi és: la discografia sencera (ACT-650).
  if (i < 0) return { candidats: llista, font: 'MusicBrainz', llista: true, mbid, avis: [per, `No he trobat «${partida.titol}» a MusicBrainz: tria de la discografia.`].filter(Boolean).join(' ') };
  const c = dir === 'seg' ? llista.slice(i + 1, i + 1 + DE_MB) : llista.slice(Math.max(0, i - DE_MB), i).reverse();
  return { candidats: c, font: 'MusicBrainz', mbid, avis: [per, c.length ? '' : (dir === 'seg' ? 'Segons MusicBrainz, és l\'últim.' : 'Segons MusicBrainz, és el primer.')].filter(Boolean).join(' ') };
}
