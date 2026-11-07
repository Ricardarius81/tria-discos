// Les escoltes (blocs 3.3 + 3.4 + 3.5, v1.44). Aquí no hi ha pantalla ni xarxa: només el que es calcula
// sobre l'arxiu a partir dels scrobbles. La lectura de ListenBrainz és a listenbrainz.js.
//
// Les regles que aquest fitxer fa complir, i d'on surten:
//  · Scrobble és la pista; Escolta és l'escolta d'una edició o d'una part, calculada (§8.3, ACT-451 i ACT-452).
//  · Una escolta compta si sona el 75 % de la durada dins d'una finestra de 15 hores; dormir, el 50 % (§8.5).
//  · El que va sonar una pista és el temps fins al scrobble següent DE LA MATEIXA COMPTE (ACT-456); l'última
//    pista d'una tanda es compta sencera (v1.3).
//  · Una «tirada» són dos o més discos del mateix Conjunt que compten dins d'una finestra fixa de 24 hores,
//    oberta per la primera escolta de qualsevol d'ells; res del que soni enmig la trenca (§7.5, ACT-446).
//  · No s'empareja res sense confirmar: el release_name confirmat viu a Edició.Emparellaments (§8.8, ACT-469).
//
// Decisions de construcció que no són al pla, i que van a la v1.45 per ratificar:
//  (a) el que va sonar una pista no passa mai de la seva duration_ms: una pausa llarga no infla l'escolta;
//  (b) una mateixa pista que torna a sonar dins la finestra de 15 h obre una escolta nova: és una segona escolta;
//      des de l'estructura 6 (ACT-585), només quan l'escolta ja compta; mentre no compta, la pista repetida compta un
//      sol cop (la que més va sonar) i no talla;
//  (c) un release_name confirmat a dues edicions va a la que és en rotació, i si no, a la més recent (la pregunta 3
//      no entra en aquesta construcció);
//  (d) una escolta nova d'una caixa va a la part viva en aquell moment, i ja no es mou.
//      Des de l'ACT-625 (6-11): si el nom de l'àlbum diu el número de la part («vol / volume / CD / disc» + número),
//      la pista va a aquella part, i en tornar a calcular hi torna sola encara que abans hagués anat a la viva;
//      si no el diu, (d) com abans. Camps: Scrobble.album, Part.numero.

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
// ACT-625: el número de part que porta el nom de l'àlbum: «The Italian Chronicles volume 1» → 1, «… (CD 2)» → 2.
// Els números que ja porta el títol de l'àlbum de l'arxiu no compten («Jazz Masters Vol. 3», caixa de dos CD:
// «Jazz Masters Vol. 3 CD 2» → 2; «Jazz Masters Vol. 3» sol → cap, i va a la viva). Si n'hi queda més d'un, mana l'últim.
const RE_PART = /\b(?:vol(?:ume)?|cd|dis[ck])\.?\s*(\d{1,2})\b/gi;
const numeros = t => [...String(t ?? '').matchAll(RE_PART)].map(m => Number(m[1]));
export const numeroDePart = (album, titol = '') => {
  const ns = numeros(album);
  for (const n of numeros(titol)) { const i = ns.indexOf(n); if (i >= 0) ns.splice(i, 1); }
  return ns.length ? ns[ns.length - 1] : null;
};
export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// ACT-619 (opció B de Ricard, 5-11): el «proper» d'un preferent només s'esborra quan entra en rotació el disc que diu,
// amb el mateix títol (la normalització de la ACT-557) i d'aquest artista o d'un altre nom seu (Persona). Si entra un altre
// disc seu, el proper es queda: no es pinta mentre l'artista té disc en rotació, i torna quan se'n queda sense.
// Camps: preferent.proper_titol, album.titol, artista.persona.
export function esborraProperSiEsAquest(db, edicioId) {
  const e = un(db, `SELECT a.titol, COALESCE(ar.persona, ar.nom_canonic) AS p FROM edicio e JOIN album a ON a.id = e.album_id
                    JOIN artista ar ON ar.id = a.artista_id WHERE e.id = ?`, [edicioId]);
  if (!e || !norm(e.titol)) return 0;
  const ps = files(db, `SELECT pr.id, pr.proper_titol, COALESCE(ar.persona, ar.nom_canonic) AS p FROM preferent pr
                        JOIN artista ar ON ar.id = pr.artista_id WHERE pr.proper_titol IS NOT NULL`)
    .filter(x => norm(x.p) === norm(e.p) && norm(x.proper_titol) === norm(e.titol));
  for (const x of ps) db.run('UPDATE preferent SET proper_titol = NULL WHERE id = ?', [x.id]);
  return ps.length;
}
const ms = iso => Date.parse(iso);
const H = 3600e3, MIN = 60e3;

export const COMPTES = [{ nom: 'crimsonnnn', feina: false }, { nom: 'crimsonnnnfeina', feina: true }];
export const FINESTRA_ESCOLTA = 15 * H;   // §8.5
export const FINESTRA_TIRADA = 24 * H;    // §7.5, ACT-446 — dues finestres, dos números (ACT-447)
export const SILENCI_TARGETA = 30 * MIN;  // §8.7, ACT-455 — sense calibrar
export const ESPERA_DISC = 5 * MIN;       // ACT-528: un disc d'una sessió que sona es pot contestar 5 minuts després de la seva última pista

// La darrera lectura bona de ListenBrainz d'aquest dispositiu (3-11, opció A de Ricard). «Ha acabat» vol dir dues coses:
// que ha passat el temps i que sabem que no ha sonat res més. El rellotge només diu la primera; la segona la diu la
// lectura. Per això els 5 minuts d'un disc i els 30 d'una targeta es compten fins a la darrera lectura bona, no fins
// ara: el que encara no s'ha llegit no es dona per acabat. Cada dispositiu té la seva (es guarda al mòbil o al
// navegador, no a l'arxiu): cap dispositiu dona res per acabat amb el que va llegir un altre.
// undefined = ningú no l'ha fixada (el banc en node, les proves): mana el rellotge, com abans. null = encara cap lectura.
let darreraLectura;
export const fixaLectura = t => { darreraLectura = Number.isFinite(t) && t > 0 ? t : null; };
const finsA = (ara, llegit) => llegit === undefined ? ara : Math.min(ara, llegit ?? -Infinity);
export const LLINDAR = 0.75, LLINDAR_DORMIR = 0.5;

// ───────── l'Arrencada (ACT-453) ─────────
const ARRENCADA = 'arrencada-escoltes';
export const arrencada = db => un(db, 'SELECT valor FROM meta WHERE clau = ?', [ARRENCADA])?.valor || null;
// S'escriu una sola vegada. Retorna la data, nova o la que ja hi era.
export const fixaArrencada = (ara = new Date().toISOString()) => db => {
  const ja = arrencada(db); if (ja) return ja;
  db.run('INSERT INTO meta (clau, valor) VALUES (?, ?)', [ARRENCADA, ara]);
  return ara;
};

// ───────── desar el que arriba ─────────
// Fins on s'ha llegit una compte no necessita camp: és el listened_at més recent (§3.3).
export const darrerLlegit = (db, compte) => un(db, 'SELECT MAX(listened_at) AS m FROM scrobble WHERE compte = ?', [compte])?.m || null;

// Rellegir no duplica: la clau única és compte + listened_at + recording_msid. Retorna quants han canviat: els nous i els
// que ara porten el lligam amb MusicBrainz que abans no tenien.
// ListenBrainz lliga cada pista amb MusicBrainz (mbid_mapping) una estona després de rebre-la. Una pista llegida abans
// d'aquest lligam es desava sense release_mbid ni caa_release_mbid, i rellegir-la no l'omplia mai: el disc es quedava
// sense la portada de l'escolta (4-11, Infinitati, escoltat a l'avió i llegit en aterrar). Ara rellegir l'omple, sense
// tocar res més de la pista (ni la resposta de Ricard).
export const desaScrobbles = llistaS => db => {
  let canvis = 0;
  const st = db.prepare(`INSERT OR IGNORE INTO scrobble (compte, listened_at, artista, pista, album, duration_ms,
                         recording_msid, release_mbid, caa_release_mbid) VALUES (?,?,?,?,?,?,?,?,?)`);
  const lliga = db.prepare(`UPDATE scrobble SET release_mbid = COALESCE(release_mbid, ?), caa_release_mbid = COALESCE(caa_release_mbid, ?)
                            WHERE compte = ? AND listened_at = ? AND recording_msid = ?
                              AND ((release_mbid IS NULL AND ? IS NOT NULL) OR (caa_release_mbid IS NULL AND ? IS NOT NULL))`);
  for (const s of llistaS) {
    st.run([s.compte, s.listened_at, s.artista, s.pista, s.album, s.duration_ms, s.recording_msid, s.release_mbid, s.caa_release_mbid]);
    if (db.getRowsModified()) { canvis++; continue; }
    if (!s.release_mbid && !s.caa_release_mbid) continue;
    lliga.run([s.release_mbid, s.caa_release_mbid, s.compte, s.listened_at, s.recording_msid, s.release_mbid, s.caa_release_mbid]);
    canvis += db.getRowsModified();
  }
  st.free(); lliga.free();
  return canvis;
};

// ───────── l'emparellament (§8.8) ─────────
// Una entrada d'Edició.Emparellaments és un release_name confirmat, o «msid:<recording_msid>» per a l'1 % que arriba
// sense álbum (§3.3): aquest s'agafa a la pista, no al nom.
export const clauMsid = msid => 'msid:' + msid;
function mapaEmparellaments(db) {
  const m = new Map();
  for (const e of files(db, 'SELECT id, emparellaments, rotacio_actual FROM edicio WHERE emparellaments IS NOT NULL ORDER BY id')) {
    for (const nom of llista(e.emparellaments)) {
      const k = nom.startsWith('msid:') ? nom : norm(nom);
      const ja = m.get(k);
      // (c) dues edicions amb el mateix nom: mana la que és en rotació, i si no, la més recent
      if (!ja || (e.rotacio_actual && !ja.rot) || (!!e.rotacio_actual === ja.rot)) m.set(k, { id: e.id, rot: !!e.rotacio_actual });
    }
  }
  return m;
}
const edicioDe = (mapa, s) => (s.album ? mapa.get(norm(s.album)) : null)?.id ?? mapa.get(clauMsid(s.recording_msid))?.id ?? null;

// Confirmar la pregunta 2: el nom queda recordat a l'edició i ja no es torna a preguntar.
export const confirmaEdicio = (edicioId, { album, recording_msid }) => db => {
  const e = un(db, 'SELECT emparellaments FROM edicio WHERE id = ?', [edicioId]); if (!e) return;
  const k = album ? album : clauMsid(recording_msid);
  const l = llista(e.emparellaments);
  if (!l.some(x => (x.startsWith('msid:') ? x : norm(x)) === (k.startsWith('msid:') ? k : norm(k)))) l.push(k);
  db.run('UPDATE edicio SET emparellaments = ? WHERE id = ?', [JSON.stringify(l), edicioId]);
};

// L'emparellament sol quan no hi ha dubte (opció B de Ricard, 3-11; revisa la confirmació d'un a un del 31-10):
// el release_name és exactament el títol (normalitzat), l'artista coincideix, només hi ha un àlbum així i aquest àlbum
// té una sola edició a l'arxiu. S'escriu a Edició.Emparellaments com si l'hagués confirmat Ricard: cap regla no els
// distingeix, i «Canvia l'edició» ho corregeix. La pregunta 2 queda per als casos amb dubte. Retorna quants n'ha fet.
export const emparellaSols = db => {
  let n = 0;
  for (const q of preguntes2(db)) {
    if (!q.album) continue;
    const aid = artistaDe(db, q.artista); if (!aid) continue;
    const ok = files(db, `SELECT e.id, a.titol, a.id AS album_id, (SELECT COUNT(*) FROM edicio x WHERE x.album_id = a.id) AS n_eds
                          FROM edicio e JOIN album a ON a.id = e.album_id WHERE a.artista_id = ?`, [aid])
      .filter(e => norm(e.titol) === norm(q.album));
    if (ok.length !== 1 || ok[0].n_eds !== 1) continue;
    confirmaEdicio(ok[0].id, { album: q.album })(db); n++;
  }
  return n;
};

// «No és cap d'aquestes»: es recorda per al nom, perquè la pregunta 2 no torni i el disc passi a ser candidat a nou
// (§8.10, pregunta 2). Es desa a meta, que viatja amb l'arxiu. Camp de la construcció, per ratificar.
const REBUTJATS = 'emparellaments-rebutjats';
export const rebutjats = db => { try { return JSON.parse(un(db, 'SELECT valor FROM meta WHERE clau = ?', [REBUTJATS])?.valor || '[]'); } catch { return []; } };
export const rebutjaEmparellament = ({ album, recording_msid }) => db => {
  const l = rebutjats(db), k = album ? norm(album) : clauMsid(recording_msid);
  if (!l.includes(k)) l.push(k);
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [REBUTJATS, JSON.stringify(l)]);
};

// Treu del nom el que sol ser l'edició: «Stankonia (25th Anniversary Edition)» → «Stankonia».
const sensEdicio = t => String(t || '')
  .replace(/\s*[\(\[][^)\]]*(edition|edició|edicion|deluxe|remaster|anniversary|expanded|version|bonus|reissue|live|en directe)[^)\]]*[\)\]]\s*$/i, '')
  .replace(/\s+-\s+(\d{4}\s+)?remaster(ed)?(\s+\d{4})?\s*$/i, '').trim();

function artistaDe(db, nom) {
  const n = norm(nom); if (!n) return null;
  for (const a of files(db, 'SELECT id, nom_canonic, variants, persona FROM artista')) {
    if (norm(a.nom_canonic) === n || norm(a.persona) === n || llista(a.variants).some(v => norm(v) === n)) return a.id;
  }
  return null;
}

// Les edicions candidates per a un release_name (pregunta 2), de la més probable a la menys.
// La més probable: el títol coincideix; després, l'artista; després, si el nom de l'edició hi surt; i la durada desempata.
// perArtista (opció A de Ricard, 5-11, cas Bartók): quan el que ha sonat té cara de disc i el títol no casa amb cap,
// les edicions del mateix artista també són candidates, per sota de les del títol. Abans, sense títol igual no hi havia
// pregunta 2 i la safata ho donava per «Disc nou», i desar-lo duplicava l'àlbum. Camps: Artista (nom, persona, variants)
// i Àlbum.artista_id. Una cançó solta d'un artista conegut no hi entra (no té cara de disc): seguiria preguntant a cada llista.
export function candidates(db, { album, artista, minuts, perArtista = false }) {
  const nt = norm(album), nb = norm(sensEdicio(album)), aid = artistaDe(db, artista);
  const eds = files(db, `SELECT e.id, e.nom_edicio, e.durada_total, e.rotacio_actual, a.titol, a.artista_id, ar.nom_canonic AS art
                         FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id`);
  const out = [];
  for (const e of eds) {
    const t = norm(e.titol);
    let p = 0;
    if (nt && t === nt) p += 100; else if (nb && t === nb) p += 80; else if ((!nt || perArtista) && aid && e.artista_id === aid) p += 10; else continue;
    if (aid && e.artista_id === aid) p += 30;
    if (e.nom_edicio && nt.includes(norm(e.nom_edicio))) p += 20;
    if (minuts && e.durada_total) p += 10 - Math.min(10, Math.abs(minuts - e.durada_total) / 3);
    if (e.rotacio_actual) p += 1;
    out.push({ ...e, punts: p });
  }
  return out.sort((x, y) => y.punts - x.punts);
}

// ───────── el que va sonar cada pista ─────────
// Retorna els scrobbles en ordre amb `sonat` (ms). La següent es busca a la mateixa compte (ACT-456).
function cronologia(scr) {
  const perCompte = {};
  for (const s of scr) (perCompte[s.compte] ||= []).push(s);
  for (const l of Object.values(perCompte)) {
    l.sort((a, b) => a.t - b.t);
    l.forEach((s, i) => {
      const seg = l[i + 1];
      const fi = s.t + (s.duration_ms || 0);
      // Dins la mateixa tanda (el silenci no passa de 30 minuts) el que va sonar és el temps fins a la següent;
      // l'última de la tanda es compta sencera (v1.3). (a) Mai més que la seva durada.
      if (seg && seg.t - fi <= SILENCI_TARGETA) s.sonat = s.duration_ms ? Math.min(seg.t - s.t, s.duration_ms) : Math.max(0, seg.t - s.t);
      else s.sonat = s.duration_ms || 0;
    });
  }
  return scr;
}

// Dormir compta amb el 50 % (§8.5, §4.6). Mentre la targeta és pendent no se sap si dormia: es calcula amb el 75 % (ACT-447).
// Des de l'estructura 6 (ACT-585), el que compta és l'escolta sencera (la unió), no el tros. Llindar mixt: cada tros pesa
// la seva completitud dividida pel seu llindar, i la unió compta si la suma arriba a 1. Un tros sol que arriba al seu
// llindar pesa 1: la regla d'abans és el cas d'un sol tros. Una escolta física (sense unió) es mira sola, com abans.
const llindarDe = at => at === 'Dormir' ? LLINDAR_DORMIR : LLINDAR;
const PES = x => `(${x}.completitud / (CASE WHEN ${x}.atencio = 'Dormir' THEN ${LLINDAR_DORMIR} ELSE ${LLINDAR} END))`;
const PROU = 1 - 1e-9;                     // la suma de quocients pot quedar a una milionèsima d'1 per l'arrodoniment
export const SQL_COMPTA = `(CASE WHEN s.unio IS NULL THEN (s.completitud >= ${LLINDAR} OR (s.atencio = 'Dormir' AND s.completitud >= ${LLINDAR_DORMIR}))
  ELSE (SELECT SUM(${PES('x')}) FROM escolta x WHERE x.unio = s.unio) >= ${PROU} END)`;
// Que falta posar la unió a les escoltes que vénen de scrobbles (un arxiu que acaba de passar a l'estructura 6).
export const calRecalcular = db => !!un(db, `SELECT 1 AS x FROM escolta s WHERE s.unio IS NULL
                                            AND EXISTS (SELECT 1 FROM scrobble p WHERE p.escolta_id = s.id) LIMIT 1`);

// ───────── tornar a calcular les escoltes ─────────
// Les escoltes que vénen de scrobbles es tornen a calcular senceres des dels scrobbles cada vegada que n'arriben
// de nous o que es confirma un emparellament. El que Ricard hi ha contestat (context, atenció) i la part de la caixa
// es conserven: viatgen amb els scrobbles de cada escolta. Les escoltes físiques, sense scrobble, no es toquen.
// Retorna { escoltes, portades } amb el que ha canviat.
export const recalcula = db => {
  const mapa = mapaEmparellaments(db);
  const scr = files(db, `SELECT s.id, s.compte, s.listened_at, s.duration_ms, s.recording_msid, s.album, s.caa_release_mbid,
                                s.estat, s.escolta_id, s.context, s.atencio, e.part_id
                         FROM scrobble s LEFT JOIN escolta e ON e.id = s.escolta_id
                         WHERE s.estat != 'ignorat'`)
    .map(s => ({ ...s, t: ms(s.listened_at) }));
  cronologia(scr);
  scr.sort((a, b) => a.t - b.t || a.id - b.id);

  // Les edicions amb les seves durades i parts.
  const eds = new Map(files(db, 'SELECT e.id, e.durada_total, e.app_escolta, a.titol FROM edicio e JOIN album a ON a.id = e.album_id').map(e => [e.id, e]));
  const parts = new Map();
  for (const p of files(db, 'SELECT id, edicio_id, numero, durada, rotacio_actual FROM part')) (parts.get(p.edicio_id) || parts.set(p.edicio_id, []).get(p.edicio_id)).push(p);

  // Agrupar (ACT-585, opció B de Ricard del 4-11; abans: mateix context o res).
  // La unió és l'escolta sencera: mateixa edició (i part), dins de 15 hores des del seu primer tros (c).
  // Dins de la unió, cada context i atenció és un tros, i cada tros és la seva pròpia Escolta.
  // Pistes repetides (b): mentre la unió no compta, una pista repetida compta un sol cop —la que més va sonar— i no talla;
  // quan ja compta, repetir-ne una obre una escolta nova (una segona escolta, com abans).
  const durDe = (ed, part) => part ? (parts.get(ed) || []).find(p => p.id === part)?.durada : eds.get(ed).durada_total;
  const sonatDe = (u, t) => t.s.reduce((x, s) => x + (u.millor.get(s.recording_msid) === s ? s.sonat : 0), 0);
  const complDe = (u, t) => u.durada ? Math.round(sonatDe(u, t) / (u.durada * MIN) * 1000) / 1000 : null;
  const compta = u => [...u.trossos.values()].reduce((x, t) => x + (complDe(u, t) ?? 0) / llindarDe(t.at), 0) >= PROU;
  const trossos = [], oberta = new Map();
  for (const s of scr) {
    const ed = edicioDe(mapa, s);
    if (!ed || !eds.has(ed)) continue;
    const ctx = s.context ?? null, at = s.atencio ?? null;
    const ps = parts.get(ed) || [];
    const viva = ps.find(p => p.rotacio_actual);
    const nPart = ps.length ? numeroDePart(s.album, eds.get(ed).titol) : null;
    const perNom = nPart !== null ? ps.find(p => p.numero === nPart) : null;                     // ACT-625
    const part = perNom ? perNom.id : (s.escolta_id ? (s.part_id ?? null) : (viva?.id ?? null));   // (d)
    const ku = ed + '|' + part;
    let u = oberta.get(ku);
    if (!u || s.t - u.t0 >= FINESTRA_ESCOLTA || (u.millor.has(s.recording_msid) && compta(u))) {
      u = { ed, part, t0: s.t, durada: durDe(ed, part), trossos: new Map(), millor: new Map(), id: null };
      oberta.set(ku, u);
    }
    const kt = ctx + '|' + at;
    let t = u.trossos.get(kt);
    if (!t) { t = { u, ctx, at, t0: s.t, s: [], comptes: new Set() }; u.trossos.set(kt, t); trossos.push(t); }
    t.s.push(s); t.comptes.add(s.compte);
    const m = u.millor.get(s.recording_msid);
    if (!m || s.sonat > m.sonat) u.millor.set(s.recording_msid, s);
  }

  // Esborrar les escoltes que vénen de scrobbles i tornar-les a escriure.
  // Les físiques, registrades a mà, no tenen cap scrobble lligat i no es toquen.
  db.run('DELETE FROM escolta WHERE id IN (SELECT DISTINCT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)');
  db.run('UPDATE scrobble SET escolta_id = NULL WHERE escolta_id IS NOT NULL');

  const ins = db.prepare(`INSERT INTO escolta (edicio_id, part_id, data_hora, canal, context, atencio, completitud, compte, unio)
                          VALUES (?, ?, ?, 'App', ?, ?, ?, ?, ?)`);
  const lliga = db.prepare('UPDATE scrobble SET escolta_id = ? WHERE id = ?');
  let n = 0;
  for (const t of trossos) {
    const u = t.u;
    ins.run([u.ed, u.part, new Date(t.t0).toISOString(), t.ctx, t.at, complDe(u, t), [...t.comptes].sort().join(','), u.id]);
    const id = un(db, 'SELECT last_insert_rowid() AS id').id;
    if (u.id === null) { u.id = id; db.run('UPDATE escolta SET unio = ? WHERE id = ?', [id, id]); }   // la unió porta l'id del seu primer tros
    for (const s of t.s) lliga.run([id, s.id]);
    n++;
  }
  ins.free(); lliga.free();

  // La data de la darrera escolta de cada part (§8.5): la mou només una escolta que compta.
  db.run(`UPDATE part SET data_darrera_escolta = (SELECT MAX(s.data_hora) FROM escolta s WHERE s.part_id = part.id AND ${SQL_COMPTA})
          WHERE EXISTS (SELECT 1 FROM escolta s WHERE s.part_id = part.id)`);

  // La portada que arriba amb l'escolta (bloc 3.2): mana sobre la de la sonda i sobre un rebuig, mai sobre la que ha
  // triat o pujat Ricard. Es fa servir la de l'escolta més recent que en porta.
  let portades = 0;
  const cobs = new Map(), quan_ = new Map();
  for (const t of trossos) for (const s of t.s) if (s.caa_release_mbid && !(quan_.get(t.u.ed) > s.t)) { cobs.set(t.u.ed, s.caa_release_mbid); quan_.set(t.u.ed, s.t); }
  for (const [ed, mbid] of cobs) {
    db.run(`UPDATE edicio SET portada = ?, portada_origen = 'escolta'
            WHERE id = ? AND (portada_origen IS NULL OR portada_origen IN ('sonda', 'rebutjada')) `, ['release/' + mbid, ed]);
    portades += db.getRowsModified();
  }
  return { escoltes: n, portades };
};

// ───────── el que la màquina sap de les escoltes ─────────
// Les escoltes que compten, en ordre de temps, amb l'àlbum i el grup. Una per escolta sencera (ACT-585): els trossos
// d'una unió que compta són una sola escolta, amb l'hora del primer tros. u: l'id de la unió (o de l'escolta física).
export function escoltesQueCompten(db) {
  return files(db, `SELECT MIN(s.id) AS id, s.edicio_id, MIN(s.data_hora) AS data_hora, e.album_id, a.conjunt, COALESCE(s.unio, s.id) AS u
                    FROM escolta s JOIN edicio e ON e.id = s.edicio_id JOIN album a ON a.id = e.album_id
                    WHERE ${SQL_COMPTA} GROUP BY COALESCE(s.unio, s.id) ORDER BY data_hora, id`);
}

// Les finestres de 24 hores d'un grup (§7.5, ACT-446). La primera l'obre la primera escolta de qualsevol disc del grup;
// tot el que compta dins seu hi queda, sigui del disc que sigui i en l'ordre que sigui; el que arriba quan s'ha tancat
// n'obre una altra. Una finestra amb dos discos o més és una tirada.
export function finestres(escoltes) {
  const out = []; let f = null;
  for (const e of escoltes) {
    const t = ms(e.data_hora);
    if (!f || t >= f.t0 + FINESTRA_TIRADA) { f = { t0: t, darrera: t, escoltes: [], albums: new Set() }; out.push(f); }
    f.escoltes.push(e); f.albums.add(e.album_id); f.darrera = t;
  }
  for (const x of out) x.tirada = x.albums.size >= 2;
  return out;
}

// Per a cada grup: les seves finestres. Per a la rotació i per a l'Historial.
export function grupsAmbEscoltes(db) {
  const per = new Map();
  for (const e of escoltesQueCompten(db)) if (e.conjunt) (per.get(e.conjunt) || per.set(e.conjunt, []).get(e.conjunt)).push(e);
  const out = new Map();
  for (const [g, l] of per) out.set(g, finestres(l));
  // El mosaic de Discos en Rotació (ACT-583, opció B de Ricard del 4-11): un disc del grup que ha sonat dins la finestra
  // de 24 hores de l'última tirada s'hi ajunta encara que no arribi al 75 %. Camps: Escolta.data_hora (l'inici de cada
  // tros) i Escolta.completitud. El que compta com a escoltes (l'Historial) no canvia: per això va a part, a «sonats».
  const sonats = files(db, `SELECT s.data_hora, e.album_id, a.conjunt FROM escolta s JOIN edicio e ON e.id = s.edicio_id
                            JOIN album a ON a.id = e.album_id WHERE a.conjunt IS NOT NULL`);
  for (const [g, fs] of out) {
    const u = fs[fs.length - 1]; if (!u?.tirada) continue;
    u.sonats = new Set(u.albums);
    for (const x of sonats) { const t = ms(x.data_hora); if (x.conjunt === g && t >= u.t0 && t < u.t0 + FINESTRA_TIRADA) u.sonats.add(x.album_id); }
  }
  return out;
}

// Com surt un grup a Discos en Rotació (§7.5, ACT-443 i ACT-444): sense escoltes, junts; si no, com van sonar
// l'última vegada. Retorna el conjunt d'àlbums que van junts (pot ser buit: tots solts).
export function juntsARotacio(finestresGrup) {
  if (!finestresGrup || !finestresGrup.length) return null;     // null = cap escolta: junts tots
  const u = finestresGrup[finestresGrup.length - 1];
  return u.tirada ? (u.sonats || u.albums) : new Set();
}

// L'Historial (§7.7, v1.34 i ACT-448): una fila per grup amb tirades i una per disc amb escoltes soltes.
// La fila del grup compta les tirades i porta els àlbums de l'última; la del disc compta només les soltes.
// Totes s'ordenen per l'última vegada que van sonar.
// «A mitges» (ACT-578, opció B de Ricard del 4-11): un disc puja a dalt tan bon punt sona, i la fila porta «a mitges»
// mentre l'última escolta seva no compta; el número d'escoltes compta només les que compten. L'ordre surt de l'últim
// Scrobble.listened_at lligat a una Escolta de l'edició; «a mitges», de la unió d'aquesta última escolta (completitud).
// Llegit així per Claude: «a mitges» és l'escolta en curs, no el disc. Un disc amb tres escoltes que tornes a començar
// surt «3 escoltes · a mitges»; un disc que no has acabat mai, «0 escoltes · a mitges».
export function historial(db) {
  const totes = escoltesQueCompten(db), compten = new Set(totes.map(e => e.u));
  // L'última pista de cada escolta sencera, i l'última escolta de cada edició.
  const sons = files(db, `SELECT x.edicio_id, COALESCE(x.unio, x.id) AS u, MAX(p.listened_at) AS darrer, MIN(x.data_hora) AS inici,
                                 a.id AS album_id, a.conjunt
                          FROM escolta x JOIN scrobble p ON p.escolta_id = x.id JOIN edicio e ON e.id = x.edicio_id
                          JOIN album a ON a.id = e.album_id GROUP BY x.edicio_id, COALESCE(x.unio, x.id)`);
  const darrerU = new Map(sons.map(r => [r.u, r.darrer])), darreraEd = new Map();
  for (const r of sons) { const ja = darreraEd.get(r.edicio_id); if (!ja || r.darrer > ja.darrer) darreraEd.set(r.edicio_id, r); }
  const quanSona = e => darrerU.get(e.u) || e.data_hora;     // una escolta física no té pistes: la seva hora
  const perGrup = new Map(), soltes = [];
  for (const e of totes) if (e.conjunt) (perGrup.get(e.conjunt) || perGrup.set(e.conjunt, []).get(e.conjunt)).push(e); else soltes.push(e);
  const files_ = [], tiradesDe = new Map(), filaDe = new Map();
  for (const [g, l] of perGrup) {
    const fs = finestres(l);
    const tir = fs.filter(f => f.tirada);
    tiradesDe.set(g, tir);
    if (tir.length) {
      const u = tir[tir.length - 1];
      const fila = { grup: g, n: tir.length, darrera: u.escoltes.map(quanSona).sort().pop(), albums: [...u.albums],
                     edicions: [...new Set(u.escoltes.map(e => e.edicio_id))] };
      files_.push(fila); filaDe.set(g, { fila, u });
    }
    for (const f of fs) if (!f.tirada) soltes.push(...f.escoltes);
  }
  const perEd = new Map();
  for (const e of soltes) { const x = perEd.get(e.edicio_id) || { edicio_id: e.edicio_id, n: 0, darrera: '', mitges: false };
    x.n++; const d = quanSona(e); if (d > x.darrera) x.darrera = d; perEd.set(e.edicio_id, x); }
  // L'escolta en curs que encara no compta: fa pujar el disc i el marca. Si l'última compta i és d'una tirada, ja surt
  // a la fila del grup; si és solta, ja és a perEd.
  // ACT-592 (Ricard, 5-11: «el historial también debe absorber»): un disc d'un grup sonat a mitges dins la finestra de
  // 24 hores d'una tirada s'ajunta a la fila del grup, com al mosaic de la rotació (ACT-583), i no fa fila solta. Si és
  // la finestra de l'última tirada, la fila del grup el porta i puja amb ell. El número d'escoltes no canvia: compta
  // tirades. Camps: Escolta.data_hora (l'inici del tros), Escolta.completitud, Àlbum.Conjunt.
  const dinsTirada = r => {
    const tir = r.conjunt ? tiradesDe.get(r.conjunt) : null; if (!tir || !tir.length) return null;
    const t = ms(r.inici);
    return tir.find(f => t >= f.t0 && t < f.t0 + FINESTRA_TIRADA) || null;
  };
  for (const [ed, r] of darreraEd) {
    if (compten.has(r.u)) continue;
    const f = dinsTirada(r);
    if (f) {
      const q = filaDe.get(r.conjunt);
      if (q && q.u === f) {
        if (!q.fila.edicions.includes(ed)) q.fila.edicions.push(ed);
        if (!q.fila.albums.includes(r.album_id)) q.fila.albums.push(r.album_id);
        if (r.darrer > q.fila.darrera) q.fila.darrera = r.darrer;
      }
      continue;
    }
    const x = perEd.get(ed) || { edicio_id: ed, n: 0, darrera: '', mitges: false };
    x.mitges = true; if (r.darrer > x.darrera) x.darrera = r.darrer; perEd.set(ed, x);
  }
  files_.push(...perEd.values());
  return files_.sort((a, b) => b.darrera.localeCompare(a.darrera));
}

// Té cara de disc (el mateix llindar que fa néixer un disc nou, ACT-461): «És un disc», dues pistes o més, o 15 minuts sonats.
// Les cançons d'una Llista de reproducció no compten per fer néixer un disc (opció C de Ricard, 7-11): el que sona amb una
// llista no és escoltar un disc. Es calcula amb llista_canco.recording_msid: si una pista és a alguna llista, no compta ni
// pel nombre de pistes ni pel temps sonat. Si totes les pistes del nom són de llistes, queden com a cançons soltes.
const pistesDeLlista = db => new Set(files(db, 'SELECT DISTINCT recording_msid FROM llista_canco').map(r => r.recording_msid));
const propies = (x, enLlista) => [...x.pistes.entries()].filter(([m]) => !enLlista.has(m)).map(([, d]) => d);
const caraDeDisc = (x, forcats, enLlista = new Set()) => { const p = propies(x, enLlista);
  return forcats.has(x.clau) || p.length >= 2 || p.reduce((a, b) => a + b, 0) >= 15 * MIN; };

// ───────── la pregunta 2, per a la safata ─────────
// Els noms d'àlbum que han sonat des de l'Arrencada, no estan confirmats ni rebutjats, i tenen alguna edició candidata.
// Cada un, una sola vegada (no es repeteix: §8.10). Els que no tenen cap candidata són discos nous (§8.7 bis).
export function preguntes2(db) {
  const mapa = mapaEmparellaments(db), rebs = new Set(rebutjats(db));
  const scr = files(db, `SELECT id, compte, listened_at, artista, pista, album, duration_ms, recording_msid FROM scrobble
                         WHERE estat != 'ignorat' ORDER BY listened_at`);
  const per = new Map();
  for (const s of scr) {
    if (edicioDe(mapa, s)) continue;
    const k = s.album ? norm(s.album) : clauMsid(s.recording_msid);
    if (rebs.has(k)) continue;
    const x = per.get(k) || { clau: k, album: s.album || null, recording_msid: s.album ? null : s.recording_msid,
                              artista: s.artista, pista: s.pista, pistes: new Map(), primera: s.listened_at, darrera: s.listened_at };
    x.pistes.set(s.recording_msid, s.duration_ms || 0); x.darrera = s.listened_at;
    per.set(k, x);
  }
  const out = [], forcats = new Set(esUnDisc(db)), enLlista = pistesDeLlista(db);
  for (const x of per.values()) {
    const minuts = Math.round([...x.pistes.values()].reduce((a, b) => a + b, 0) / MIN) || null;
    const c = candidates(db, { album: x.album, artista: x.artista, minuts, perArtista: caraDeDisc(x, forcats, enLlista) });
    if (!c.length) continue;
    out.push({ ...x, n: x.pistes.size, minuts, candidates: c.slice(0, 6) });
  }
  return out;
}

// ═════════ Pas dos: la safata viva (bloc 3.4) ═════════

// Els contextos del §4.5, i els que refreden fort (columna Refredament), per a la pregunta 8.
export const CONTEXTOS = ['A casa', 'Escolta activa', 'Conduint (sol)', 'Conduint (acompanyat)', 'Llegir', 'Llegir acompanyat',
  'Dinar / sopar familiar', 'Treballant', 'Al gimnàs', 'Caminant / pel carrer', 'Netejar / Cuinar', 'Dutxa', 'Amor', 'Platja',
  'Avió / Tren / Bus', 'Malalt al llit', 'Dormir'];
const FORT = new Set(['Escolta activa', 'Conduint (sol)', 'Al gimnàs', 'Caminant / pel carrer', 'Netejar / Cuinar', 'Avió / Tren / Bus']);
const HABITUALS_INICI = ['Treballant', 'A casa', 'Caminant / pel carrer', 'Avió / Tren / Bus', 'Dormir', 'Escolta activa'];  // maqueta v13
// Els sis que més fa servir (v1.34): el recompte d'Escolta.Context. Mentre no n'hi ha prou, els de la maqueta.
export function habituals(db) {
  const r = files(db, `SELECT context, COUNT(*) AS n FROM escolta WHERE context IS NOT NULL AND context != 'No ho sé'
                       GROUP BY context ORDER BY n DESC`).map(x => x.context);
  return [...new Set([...r, ...HABITUALS_INICI])].slice(0, 6);
}
// Els botons d'atenció i els seus valors no es diuen igual, i és expressament (pregunta 4).
export const ATENCIONS = [['Despert', 'Efectes plens'], ['Dormint', 'Dormir'], ['Estudi cant', 'Estudi cant']];
// L'atenció es deriva del context (pregunta 1). «A casa» i «No ho sé» la pregunten.
export const preguntaAtencio = ctx => ctx === 'A casa' || ctx === 'No ho sé';
const atencioDe = ctx => ctx === 'Dormir' ? 'Dormir' : 'Efectes plens';

// ───────── les targetes (§8.7, ACT-455 i ACT-456) ─────────
// Una targeta acaba quan passen més de 30 minuts de silenci entre el final d'una pista (listened_at + duration_ms) i
// l'inici de la següent, sigui de la compte que sigui: canviar de mòbil no obre targeta. Sense duration_ms, d'inici a inici.
// Dins de cada targeta, els discos: els emparellats, per edició; els altres, pel nom de l'àlbum (o per la pista).
//
// Des de l'1-11 (petició de Ricard: «esperar a resoldre les coses quan cada escolta ha finalitzat»), les targetes es
// tallen sobre TOTES les pistes no ignorades, contestades o no, i una targeta té tres estats:
//   'oberta'  · encara sona: no han passat 30 minuts des del final de l'última pista. No es pot contestar.
//   'pendent' · tancada i amb alguna pista sense contestar.
//   'resolta' · tancada i tota contestada.
// Abans es tallaven només les pendents, i una targeta contestada mentre sonava tornava a sortir amb les pistes que
// arribaven després (la «mateixa cosa dues vegades» de la prova de l'1-11, Glass Menagerie).
export function targetes(db, { estat = 'pendent', limit = null, ara = Date.now(), llegit = darreraLectura } = {}) {
  const ref = finsA(ara, llegit);
  const mapa = mapaEmparellaments(db);
  const scr = files(db, `SELECT s.id, s.compte, s.listened_at, s.duration_ms, s.artista, s.pista, s.album, s.recording_msid,
                                s.release_mbid, s.escolta_id, s.context, s.atencio, s.estat, s.resposta_de
                         FROM scrobble s WHERE s.estat != 'ignorat' ORDER BY s.listened_at, s.id`).map(s => ({ ...s, t: ms(s.listened_at) }));
  const out = []; let cur = null, fi = 0;
  for (const s of scr) {
    if (!cur || s.t - fi > SILENCI_TARGETA) { cur = { scr: [], fiMs: 0 }; out.push(cur); fi = 0; }
    cur.scr.push(s); fi = Math.max(fi, s.t + (s.duration_ms || 0)); cur.fiMs = fi;
  }
  const eds = new Map(files(db, `SELECT e.id, a.titol, a.conjunt, ar.nom_canonic AS art, e.durada_total, e.portada, e.app_escolta
                                 FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id`).map(e => [e.id, e]));
  const partDe = new Map(files(db, `SELECT e.id AS escolta, p.id, p.numero, p.nom, p.durada FROM escolta e JOIN part p ON p.id = e.part_id`)
    .map(x => [x.escolta, x]));
  for (const c of out) {
    c.clau = c.scr[0].id;                         // la targeta es reconeix per la seva primera pista
    c.inici = c.scr[0].listened_at;
    c.fi = new Date(c.fiMs).toISOString();
    c.estat = ref - c.fiMs <= SILENCI_TARGETA ? 'oberta' : c.scr.some(s => s.estat === 'pendent') ? 'pendent' : 'resolta';
    c.comptes = [...new Set(c.scr.map(s => s.compte))];
    c.feina = c.scr.some(s => COMPTES.find(k => k.nom === s.compte)?.feina);
    const r = c.scr.find(s => s.estat === 'resolt');
    c.context = r?.context ?? null; c.atencio = r?.atencio ?? null;
    const discos = new Map();
    for (const s of c.scr) {
      const ed = edicioDe(mapa, s);
      const k = ed ? 'e' + ed : (s.album ? 'n' + norm(s.album) : 'm' + s.recording_msid);
      const d = discos.get(k) || { clau: k, edicio_id: ed, ...(ed ? eds.get(ed) : { titol: s.album || s.pista, art: s.artista }), scr: [] };
      d.scr.push(s); discos.set(k, d);
    }
    c.discos = [...discos.values()];
    // La part que ha sonat d'una caixa (6-11, The Italian Chronicles): el nom i la durada de la part, no els de la caixa
    // sencera. Dos volums seguits a la mateixa targeta fan una sola línia, «Vol. 1 + Vol. 2», amb la suma de durades.
    // Camps: Escolta.part_id → Part.nom, Part.numero, Part.durada. Sense durada en alguna part, no se n'ensenya cap.
    for (const d of c.discos) {
      if (!d.edicio_id) continue;
      const ps = [...new Map(d.scr.map(s => partDe.get(s.escolta_id)).filter(Boolean).map(p => [p.id, p])).values()].sort((a, b) => a.numero - b.numero);
      if (!ps.length) continue;
      d.parts = ps;
      d.partNom = ps.map(p => p.nom || 'Part ' + p.numero).join(' + ');
      d.min = ps.every(p => p.durada) ? ps.reduce((x, p) => x + p.durada, 0) : null;
      d.durada_total = null;
    }
    // Cada disc, el seu estat (ACT-528). Dins d'una sessió que encara sona, un disc es pot contestar quan fa 5 minuts que
    // ha acabat la seva última pista (listened_at + duration_ms) o quan ja ha començat una pista d'un altre disc.
    // Pano envia cada pista al 50 % o als 4 minuts (ACT-529): la següent sempre arriba abans dels 5 minuts.
    // Els 5 minuts es compten fins a la darrera lectura bona (ref), no fins ara (3-11, Porgy and Bess).
    for (const d of c.discos) {
      const fiD = Math.max(...d.scr.map(s => s.t + (s.duration_ms || 0))), iniciDarrera = Math.max(...d.scr.map(s => s.t));
      d.fiMs = fiD;
      d.contestat = d.scr.every(s => s.estat === 'resolt');
      d.llest = c.estat !== 'oberta' || ref - fiD >= ESPERA_DISC || c.scr.some(s => s.t > iniciDarrera && !d.scr.includes(s));
      d.context = d.scr.find(s => s.estat === 'resolt')?.context ?? null;
    }
    c.contextos = [...new Set(c.scr.filter(s => s.estat === 'resolt').map(s => s.context))];
  }
  out.reverse();                                  // la més recent primer
  const triades = estat === 'totes' ? out : out.filter(c => c.estat === (estat === 'resolt' ? 'resolta' : estat));
  return limit ? triades.slice(0, limit) : triades;
}
// Una pista que arriba tard a una targeta ja contestada (un mòbil sense cobertura que envia després) hereta la resposta
// de la targeta: la del mateix disc si n'hi ha, i si no, la de la pista contestada més propera. Retorna quantes.
// Una targeta amb respostes diferents per disc és una targeta separada: per això es mira primer el disc.
// Des de la v1.46 (ACT-537, opció B): d'un altre disc només s'hereta una resposta donada a la targeta sencera
// (Scrobble.resposta_de 'targeta' o buit). Un disc que no s'ha contestat i que comparteix sessió amb un disc contestat
// sol no hereta res: es pregunta.
function herencies(db, ara) {
  const out = [];
  for (const c of targetes(db, { estat: 'totes', ara, llegit: ara })) {   // només es crida just després d'una lectura bona
    if (c.estat === 'oberta') continue;
    const deTargeta = c.scr.filter(s => s.estat === 'resolt' && s.resposta_de !== 'disc');
    for (const s of c.scr.filter(x => x.estat === 'pendent')) {
      const d = c.discos.find(x => x.scr.includes(s));
      const mateix = d.scr.filter(x => x.estat === 'resolt');
      const pool = mateix.length ? mateix : deTargeta;
      if (!pool.length) continue;
      const m = pool.reduce((a, b) => Math.abs(b.t - s.t) < Math.abs(a.t - s.t) ? b : a);
      out.push([m.context, m.atencio, m.resposta_de || 'targeta', s.id]);
    }
  }
  return out;
}
export const calHeretar = (db, ara = Date.now()) => herencies(db, ara).length > 0;
export const heretaRespostes = (ara = Date.now()) => db => {
  const h = herencies(db, ara);
  const st = db.prepare("UPDATE scrobble SET context = ?, atencio = ?, resposta_de = ?, estat = 'resolt' WHERE id = ? AND estat = 'pendent'");
  for (const x of h) st.run(x);
  st.free();
  return h.length;
};

// El veredicte de la prova de la safata (ACT-453, ACT-463 i ACT-499): més d'un terç de targetes contestades «No ho sé»,
// o més d'una de cada deu ignorada, en un mes. Es compta per targetes tancades des de l'Arrencada, amb les ignorades
// incloses (aquí sí: són el segon símptoma). Camps: Scrobble.context i Scrobble.estat. Es veu a La Cabina a partir del dia 30.
export function veredicte(db, ara = Date.now()) {
  const ref = finsA(ara, darreraLectura);
  const arr = arrencada(db); if (!arr) return null;
  // El que «Ignora sempre» treu sol no entra al compte: ni obre targetes ni les fa ignorades (ACT-524).
  const isem = ignoraSempre(db);
  const scr = files(db, 'SELECT listened_at, duration_ms, estat, context, artista FROM scrobble ORDER BY listened_at, id')
    .filter(s => !(s.estat === 'ignorat' && esIgnoratSempre(isem, s.artista))).map(s => ({ ...s, t: ms(s.listened_at) }));
  const tg = []; let cur = null, fi = 0;
  for (const s of scr) { if (!cur || s.t - fi > SILENCI_TARGETA) { cur = []; tg.push(cur); fi = 0; } cur.push(s); fi = Math.max(fi, s.t + (s.duration_ms || 0)); }
  const tancades = tg.filter(c => ref - Math.max(...c.map(s => s.t + (s.duration_ms || 0))) > SILENCI_TARGETA);
  const ignorades = tancades.filter(c => c.every(s => s.estat === 'ignorat')).length;
  const contestades = tancades.filter(c => c.some(s => s.estat === 'resolt'));
  const nose = contestades.filter(c => c.some(s => s.estat === 'resolt' && s.context === 'No ho sé')).length;
  const dies = Math.floor((ara - ms(arr)) / 864e5);
  return { dies, llest: dies >= 30, dataLlesta: new Date(ms(arr) + 30 * 864e5).toISOString(), targetes: tancades.length,
           contestades: contestades.length, nose, ignorades,
           pctNose: contestades.length ? nose / contestades.length : 0, pctIgnorades: tancades.length ? ignorades / tancades.length : 0,
           falla: (contestades.length && nose / contestades.length > 1 / 3) || (tancades.length && ignorades / tancades.length > 0.1) };
}

// Contestar una targeta (o un disc d'una targeta separada): la resposta va a cada pista, i l'escolta es torna a calcular.
// «A casa» + «Dormint» es reescriu a Dormir (pregunta 4, v1.10).
// de: 'targeta' si es contesta la targeta sencera, 'disc' si es contesta un disc sol (ACT-528, ACT-537).
export const contesta = (ids, context, atencioBoto = null, de = 'targeta') => db => {
  let ctx = context, at = atencioBoto ? (ATENCIONS.find(([b]) => b === atencioBoto)?.[1] || atencioBoto) : atencioDe(context);
  if (ctx === 'A casa' && at === 'Dormir') ctx = 'Dormir';
  const st = db.prepare("UPDATE scrobble SET context = ?, atencio = ?, resposta_de = ?, estat = 'resolt' WHERE id = ? AND estat != 'ignorat'");
  for (const id of ids) st.run([ctx, at, de, id]);
  st.free();
  return { ctx, at, ...recalcula(db) };
};
// «Canvia»: la targeta torna a la safata, sense resposta.
export const reobre = ids => db => {
  const st = db.prepare("UPDATE scrobble SET context = NULL, atencio = NULL, resposta_de = NULL, estat = 'pendent' WHERE id = ?");
  for (const id of ids) st.run([id]); st.free();
  return recalcula(db);
};
// «Ignora sempre» (v1.46, ACT-524): els noms d'artista a meta, clau 'ignora-sempre'. Tot el que arriba amb un artista que
// COMENÇA per un d'aquests noms es marca ignorat sol («Outkast [feat. Killer Mike]» comença per «Outkast»). Camps:
// Scrobble.artista i Scrobble.estat. No compta al veredicte: si comptés, els pòdcasts farien saltar el símptoma.
// Només toca pistes pendents: una de contestada no es desfà. Treure un nom de la llista val per al que arribi després;
// el que ja es va ignorar sol es queda ignorat (decisió de construcció de Claude, per ratificar).
const IGNORA_SEMPRE = 'ignora-sempre';
export const ignoraSempre = db => { try { return JSON.parse(un(db, 'SELECT valor FROM meta WHERE clau = ?', [IGNORA_SEMPRE])?.valor || '[]'); } catch { return []; } };
export const esIgnoratSempre = (llistaNoms, artista) => { const a = norm(artista); return !!a && llistaNoms.some(n => norm(n) && a.startsWith(norm(n))); };
export const aplicaIgnoraSempre = db => {
  const l = ignoraSempre(db); if (!l.length) return 0;
  let n = 0;
  const st = db.prepare("UPDATE scrobble SET estat = 'ignorat', context = NULL, atencio = NULL WHERE id = ?");
  for (const s of files(db, "SELECT id, artista FROM scrobble WHERE estat = 'pendent'")) if (esIgnoratSempre(l, s.artista)) { st.run([s.id]); n++; }
  st.free();
  return n;
};
export const afegeixIgnoraSempre = nom => db => {
  const l = ignoraSempre(db), net = String(nom || '').trim(); if (!net) return { n: 0 };
  if (!l.some(x => norm(x) === norm(net))) l.push(net);
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [IGNORA_SEMPRE, JSON.stringify(l)]);
  const n = aplicaIgnoraSempre(db);
  return { n, ...recalcula(db) };
};
export const treuIgnoraSempre = nom => db => {
  const l = ignoraSempre(db).filter(x => norm(x) !== norm(nom));
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [IGNORA_SEMPRE, JSON.stringify(l)]);
};

// «Ignora» (ACT-462): un estat del Scrobble, no un esborrat. Rellegir ListenBrainz el reconeix i no torna.
export const ignora = ids => db => {
  const st = db.prepare("UPDATE scrobble SET estat = 'ignorat', context = NULL, atencio = NULL WHERE id = ?");
  for (const id of ids) st.run([id]); st.free();
  return recalcula(db);
};

// ───────── el disc nou (§8.7 bis, ACT-457, ACT-458 i ACT-461) ─────────
// Els noms d'àlbum que han sonat i no casen amb res: sense cap edició candidata, o amb «No és cap d'aquestes».
// infoMB: Map de release_mbid → { titol, pistes, minuts } que porta qui crida (es consulta, no es desa).
export function discosNous(db, infoMB = new Map()) {
  const mapa = mapaEmparellaments(db), rebs = new Set(rebutjats(db)), forcats = new Set(esUnDisc(db)), enLlista = pistesDeLlista(db);
  const scr = files(db, `SELECT id, listened_at, artista, pista, album, duration_ms, recording_msid, release_mbid FROM scrobble
                         WHERE estat != 'ignorat' ORDER BY listened_at`);
  const per = new Map();
  for (const s of scr) {
    if (edicioDe(mapa, s)) continue;
    const k = s.album ? norm(s.album) : clauMsid(s.recording_msid);
    const x = per.get(k) || { clau: k, album: s.album, artista: s.artista, pista: s.pista, recording_msid: s.recording_msid,
                              pistes: new Map(), mbids: new Map(), scr: [], darrera: s.listened_at };
    if (!x.pistes.has(s.recording_msid) || !x.pistes.get(s.recording_msid)) x.pistes.set(s.recording_msid, s.duration_ms || 0);
    if (s.release_mbid) x.mbids.set(s.release_mbid, (x.mbids.get(s.release_mbid) || 0) + 1);
    x.scr.push(s.id); x.darrera = s.listened_at; per.set(k, x);
  }
  const nous = [], soltes = [];
  for (const x of per.values()) {
    if (!rebs.has(x.clau) && candidates(db, { album: x.album, artista: x.artista, perArtista: caraDeDisc(x, forcats, enLlista) }).length) continue;   // espera la pregunta 2
    const mbid = [...x.mbids.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const mb = mbid ? infoMB.get(mbid) : null;
    // El nombre de pistes de MusicBrainz només es creu si el seu títol és el release_name (ACT-461): si no, el mapeig
    // ha lligat una cançó solta al seu single.
    const mbBo = mb && x.album && norm(mb.titol) === norm(x.album);
    const durs = [...x.pistes.values()];
    const totes = mbBo && mb.pistes && x.pistes.size >= mb.pistes;
    const sonat = durs.reduce((a, b) => a + b, 0);
    const neix = totes || caraDeDisc(x, forcats, enLlista);
    // La durada proposada (ACT-457): la de MusicBrainz si l'escolta ve identificada; si no, la suma del que ha sonat,
    // sense la pista que dura com totes les altres juntes (l'alarma de resolucio-durades).
    let suma = sonat;
    const gran = Math.max(0, ...durs);
    if (durs.length > 2 && Math.abs(gran - (sonat - gran)) <= Math.max(60e3, 0.05 * gran)) suma = sonat - gran;
    const prop = mbBo && mb.minuts ? { minuts: mb.minuts, font: 'segons MusicBrainz' } : { minuts: Math.max(1, Math.round(suma / MIN)), font: 'el que ha sonat' };
    (neix ? nous : soltes).push({ ...x, n: x.pistes.size, mbid, proposta: prop });
  }
  return { nous, soltes };
}
// «És un disc» (ACT-461): una cançó solta que Ricard declara disc. Es recorda a meta, amb la seva clau.
const FORCATS = 'es-un-disc';
const esUnDisc = db => { try { return JSON.parse(un(db, 'SELECT valor FROM meta WHERE clau = ?', [FORCATS])?.valor || '[]'); } catch { return []; } };
export const declaraDisc = clau => db => {
  const l = esUnDisc(db); if (!l.includes(clau)) l.push(clau);
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [FORCATS, JSON.stringify(l)]);
};
// Crear la fitxa del disc nou. Per defecte només entra a l'arxiu i a l'Historial (ACT-458); la rotació i els preferents
// són dues opcions a part. Cap disc entra sense durada (§2). El nom de l'àlbum queda com a emparellament confirmat.
export const creaDiscNou = ({ album, artista, recording_msid, minuts, canal, rotacio = false }) => db => {
  if (!(minuts > 0)) throw new Error('Cap disc entra sense durada.');
  const n = norm(artista);
  let a = files(db, 'SELECT id, nom_canonic, variants FROM artista').find(x => norm(x.nom_canonic) === n || llista(x.variants).some(v => norm(v) === n));
  if (!a) { db.run('INSERT INTO artista (nom_canonic) VALUES (?)', [String(artista || 'Desconegut').trim()]); a = { id: un(db, 'SELECT last_insert_rowid() AS id').id }; }
  db.run('INSERT INTO album (titol, artista_id) VALUES (?, ?)', [String(album || 'Sense títol').trim(), a.id]);
  const albumId = un(db, 'SELECT last_insert_rowid() AS id').id;
  const ara = new Date().toISOString();
  db.run(`INSERT INTO edicio (album_id, durada_total, rotacio_actual, app_escolta, emparellaments, data_referencia_rotacio, lot_carrega)
          VALUES (?, ?, ?, ?, ?, ?, 'SAFATA')`, [albumId, minuts, rotacio ? 1 : 0, canal, JSON.stringify([album ? album : clauMsid(recording_msid)]), rotacio ? ara : null]);
  const id = un(db, 'SELECT last_insert_rowid() AS id').id;
  if (rotacio) esborraProperSiEsAquest(db, id);
  recalcula(db);
  return { id, artista_id: a.id };
};

// ───────── les preguntes 7, 8 i 9 (§8.10, ACT-464 i ACT-465) ─────────
// La moneda (v1.18): escoltes d'Efectes plens que arriben al llindar, dins d'una finestra de sis mesos i des de la Data de
// referència de rotació. Només les de targetes contestades: una de pendent pot ser de dormir. Les de part no són de l'edició.
const SIS_MESOS = 182 * 864e5, UN_MES = 30 * 864e5;
export function preguntesRotacio(db, ara = Date.now()) {
  const arr = arrencada(db); if (!arr) return [];
  const desDe = new Date(ara - SIS_MESOS).toISOString();
  const eds = files(db, `SELECT e.id, e.rotacio_actual, e.data_referencia_rotacio AS ref, a.titol, ar.nom_canonic AS art, e.durada_total, e.portada,
                                (SELECT COUNT(*) FROM part p WHERE p.edicio_id = e.id) AS n_parts
                         FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id`);
  // Una moneda per escolta sencera que compta i que té algun tros d'Efectes plens (ACT-585; decisió de construcció de
  // Claude, per ratificar). Els contextos de la pregunta 8 són els dels seus trossos d'Efectes plens.
  const esc = [...files(db, `SELECT s.edicio_id, MIN(s.data_hora) AS data_hora, GROUP_CONCAT(s.context, '|') AS contextos FROM escolta s
                         WHERE s.part_id IS NULL AND s.atencio = 'Efectes plens' AND s.data_hora >= ? AND ${SQL_COMPTA}
                         GROUP BY COALESCE(s.unio, s.id)`, [desDe])]
    .map(x => ({ ...x, contextos: String(x.contextos || '').split('|') }));
  const darrera = new Map(files(db, `SELECT s.edicio_id, MAX(s.data_hora) AS d FROM escolta s WHERE ${SQL_COMPTA} GROUP BY s.edicio_id`).map(r => [r.edicio_id, r.d]));
  const out = [];
  for (const e of eds) {
    const meves = esc.filter(x => x.edicio_id === e.id && (!e.ref || x.data_hora > e.ref));
    if (!e.rotacio_actual && meves.length >= 3) out.push({ q: 7, ...e });
    else if (e.rotacio_actual && !e.n_parts && meves.length >= 5 && meves.some(x => x.contextos.some(c => FORT.has(c)))) out.push({ q: 8, ...e });
    else if (e.rotacio_actual) {
      const base = [darrera.get(e.id), arr].filter(Boolean).sort().pop();
      if (ara - ms(base) >= UN_MES && (!e.ref || ara - ms(e.ref) >= UN_MES)) out.push({ q: 9, ...e });
    }
  }
  return out;
}
// Les respostes. Només el «no» de la 7 reescriu la data; a la 8 i a la 9, qualsevol resposta (§8.10).
export const respon7 = (id, si) => db => si ? (db.run('UPDATE edicio SET rotacio_actual = 1 WHERE id = ?', [id]), esborraProperSiEsAquest(db, id))
                                          : db.run('UPDATE edicio SET data_referencia_rotacio = ? WHERE id = ?', [new Date().toISOString(), id]);
export const tocaReferencia = id => db => db.run('UPDATE edicio SET data_referencia_rotacio = ? WHERE id = ?', [new Date().toISOString(), id]);

// ═════════ Pas tres: la bústia de Bandcamp (bloc 3.5, §3.1) ═════════
// Els discos de Bandcamp sense codi: «E<edició>» o «P<part>» per a cada part d'una caixa. Una línia per disc, sense
// claudàtors (ACT-297), i res més: la tasca de nit llegeix només això (ACT-468, condició de Ricard).
export function pendentsBandcamp(db) {
  const eds = files(db, `SELECT e.id, a.titol, ar.nom_canonic AS art, e.nom_edicio, e.codi_bandcamp,
                                (SELECT COUNT(*) FROM part p WHERE p.edicio_id = e.id) AS n_parts
                         FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id
                         WHERE e.app_escolta = 'bandcamp' ORDER BY e.id`);
  const out = [];
  for (const e of eds) {
    if (!e.n_parts) { if (!e.codi_bandcamp) out.push({ clau: 'E' + e.id, art: e.art, titol: e.titol + (e.nom_edicio ? ' (' + e.nom_edicio + ')' : '') }); continue; }
    for (const p of files(db, 'SELECT id, numero, nom FROM part WHERE edicio_id = ? AND codi_bandcamp IS NULL ORDER BY numero', [e.id]))
      out.push({ clau: 'P' + p.id, art: e.art, titol: e.titol + ' — ' + (p.nom || 'part ' + p.numero) });
  }
  return out;
}
const net = s => String(s || '').replace(/[|\r\n]+/g, ' ').trim();
export const textPendents = l => l.map(x => `${x.clau} | ${net(x.art)} | ${net(x.titol)}`).join('\n') + (l.length ? '\n' : '');
// Les files del full: si n'hi ha dues per al mateix disc, mana la més recent (ACT-294). Mai trepitja un codi que ja hi és.
export const aplicaCodis = files_ => db => {
  const darrera = new Map();
  for (const f of files_) { if (!/^\d{4,}$/.test(f.codi) || !/^[EP]\d+$/.test(f.clau)) continue;
    const ja = darrera.get(f.clau); if (!ja || f.data >= ja.data) darrera.set(f.clau, f); }
  const fets = [];
  for (const [clau, f] of darrera) {
    const [t, id] = [clau[0], +clau.slice(1)];
    if (t === 'E') db.run('UPDATE edicio SET codi_bandcamp = ? WHERE id = ? AND codi_bandcamp IS NULL', [f.codi, id]);
    else db.run('UPDATE part SET codi_bandcamp = ? WHERE id = ? AND codi_bandcamp IS NULL', [f.codi, id]);
    if (db.getRowsModified()) fets.push(clau);
  }
  return fets;
};

// ═════════ «Canvia l'edició» (ACT-308, ACT-466 i ACT-467) ═════════
// Les edicions del mateix àlbum, per triar-ne una altra.
export const altresEdicions = (db, id) => files(db, `SELECT x.id, x.nom_edicio, x.durada_total, x.rotacio_actual FROM edicio x
  WHERE x.album_id = (SELECT album_id FROM edicio WHERE id = ?) AND x.id != ? ORDER BY x.id`, [id, id]);
// Si l'edició ja té alguna cosa que es podria moure: escoltes, emparellaments o nota.
export function teRastre(db, id) {
  const e = un(db, 'SELECT emparellaments FROM edicio WHERE id = ?', [id]);
  return !!(llista(e?.emparellaments).length || un(db, 'SELECT 1 AS x FROM escolta WHERE edicio_id = ? LIMIT 1', [id]) || un(db, 'SELECT 1 AS x FROM puntuacio WHERE edicio_id = ? LIMIT 1', [id]));
}
// «Una altra edició»: una edició nova del mateix àlbum, que com tot disc demana durada (§2).
export const creaEdicio = (deId, { nom, minuts, canal }) => db => {
  if (!(minuts > 0)) throw new Error('Cap disc entra sense durada.');
  const e = un(db, 'SELECT album_id, app_escolta FROM edicio WHERE id = ?', [deId]);
  db.run(`INSERT INTO edicio (album_id, nom_edicio, durada_total, app_escolta, lot_carrega) VALUES (?, ?, ?, ?, 'CANVIA-EDICIO')`,
    [e.album_id, nom || null, minuts, canal || e.app_escolta]);
  return un(db, 'SELECT last_insert_rowid() AS id').id;
};
// La mateixa operació per les dues portes (ACT-466). correccio = «sí, les escoltes d'abans eren d'aquesta»: es mouen els
// emparellaments recordats —i amb ells les escoltes, que se'n calculen— i la nota. Sense correcció, només canvia quina
// edició és en rotació. En tots dos casos la rotació passa a la nova si la vella hi era.
export const canviaEdicio = ({ de, a, correccio }) => db => {
  if (correccio) {
    const v = un(db, 'SELECT emparellaments FROM edicio WHERE id = ?', [de]), n = un(db, 'SELECT emparellaments FROM edicio WHERE id = ?', [a]);
    const junts = [...llista(n?.emparellaments)];
    for (const x of llista(v?.emparellaments)) if (!junts.some(y => norm(y) === norm(x))) junts.push(x);
    db.run('UPDATE edicio SET emparellaments = ? WHERE id = ?', [junts.length ? JSON.stringify(junts) : null, a]);
    db.run('UPDATE edicio SET emparellaments = NULL WHERE id = ?', [de]);
    db.run('UPDATE puntuacio SET edicio_id = ? WHERE edicio_id = ?', [a, de]);
    db.run(`UPDATE edicio SET data_darrera_pregunta_puntuacio = COALESCE(data_darrera_pregunta_puntuacio,
              (SELECT data_darrera_pregunta_puntuacio FROM edicio WHERE id = ?)) WHERE id = ?`, [de, a]);
    // les escoltes físiques, sense scrobble, es mouen a mà; les altres es tornen a calcular
    db.run('UPDATE escolta SET edicio_id = ? WHERE edicio_id = ? AND id NOT IN (SELECT DISTINCT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)', [a, de]);
  }
  const v = un(db, 'SELECT rotacio_actual, data_referencia_rotacio, darrera_obertura FROM edicio WHERE id = ?', [de]);
  if (v?.rotacio_actual) {
    db.run('UPDATE edicio SET rotacio_actual = 0 WHERE id = ?', [de]);
    db.run('UPDATE edicio SET rotacio_actual = 1, data_referencia_rotacio = ?, darrera_obertura = COALESCE(darrera_obertura, ?) WHERE id = ?',
      [v.data_referencia_rotacio || new Date().toISOString(), v.darrera_obertura, a]);
  }
  return recalcula(db);
};
