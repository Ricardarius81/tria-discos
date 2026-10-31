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
//  (c) un release_name confirmat a dues edicions va a la que és en rotació, i si no, a la més recent (la pregunta 3
//      no entra en aquesta construcció);
//  (d) una escolta nova d'una caixa va a la part viva en aquell moment, i ja no es mou.

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const llista = s => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const ms = iso => Date.parse(iso);
const H = 3600e3, MIN = 60e3;

export const COMPTES = [{ nom: 'crimsonnnn', feina: false }, { nom: 'crimsonnnnfeina', feina: true }];
export const FINESTRA_ESCOLTA = 15 * H;   // §8.5
export const FINESTRA_TIRADA = 24 * H;    // §7.5, ACT-446 — dues finestres, dos números (ACT-447)
export const SILENCI_TARGETA = 30 * MIN;  // §8.7, ACT-455 — sense calibrar
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

// Rellegir no duplica: la clau única és compte + listened_at + recording_msid. Retorna quants són nous.
export const desaScrobbles = llistaS => db => {
  let nous = 0;
  const st = db.prepare(`INSERT OR IGNORE INTO scrobble (compte, listened_at, artista, pista, album, duration_ms,
                         recording_msid, release_mbid, caa_release_mbid) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const s of llistaS) {
    st.run([s.compte, s.listened_at, s.artista, s.pista, s.album, s.duration_ms, s.recording_msid, s.release_mbid, s.caa_release_mbid]);
    nous += db.getRowsModified();
  }
  st.free();
  return nous;
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
export function candidates(db, { album, artista, minuts }) {
  const nt = norm(album), nb = norm(sensEdicio(album)), aid = artistaDe(db, artista);
  const eds = files(db, `SELECT e.id, e.nom_edicio, e.durada_total, e.rotacio_actual, a.titol, a.artista_id, ar.nom_canonic AS art
                         FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id`);
  const out = [];
  for (const e of eds) {
    const t = norm(e.titol);
    let p = 0;
    if (nt && t === nt) p += 100; else if (nb && t === nb) p += 80; else if (!nt && aid && e.artista_id === aid) p += 10; else continue;
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

const compta = e => e.completitud != null && e.completitud >= (e.context === 'dormir' ? LLINDAR_DORMIR : LLINDAR);
export const SQL_COMPTA = `(s.completitud >= ${LLINDAR} OR (s.context = 'dormir' AND s.completitud >= ${LLINDAR_DORMIR}))`;

// ───────── tornar a calcular les escoltes ─────────
// Les escoltes que vénen de scrobbles es tornen a calcular senceres des dels scrobbles cada vegada que n'arriben
// de nous o que es confirma un emparellament. El que Ricard hi ha contestat (context, atenció) i la part de la caixa
// es conserven: viatgen amb els scrobbles de cada escolta. Les escoltes físiques, sense scrobble, no es toquen.
// Retorna { escoltes, portades } amb el que ha canviat.
export const recalcula = db => {
  const mapa = mapaEmparellaments(db);
  const scr = files(db, `SELECT s.id, s.compte, s.listened_at, s.duration_ms, s.recording_msid, s.album, s.caa_release_mbid,
                                s.estat, s.escolta_id, e.context, e.atencio, e.part_id
                         FROM scrobble s LEFT JOIN escolta e ON e.id = s.escolta_id
                         WHERE s.estat != 'ignorat'`)
    .map(s => ({ ...s, t: ms(s.listened_at) }));
  cronologia(scr);
  scr.sort((a, b) => a.t - b.t || a.id - b.id);

  // Les edicions amb les seves durades i parts.
  const eds = new Map(files(db, 'SELECT id, durada_total, app_escolta FROM edicio').map(e => [e.id, e]));
  const parts = new Map();
  for (const p of files(db, 'SELECT id, edicio_id, durada, rotacio_actual FROM part')) (parts.get(p.edicio_id) || parts.set(p.edicio_id, []).get(p.edicio_id)).push(p);

  // Agrupar: mateixa edició (i part), mateix context, dins de 15 hores, sense repetir pista (b).
  const grups = [], obert = new Map();
  for (const s of scr) {
    const ed = edicioDe(mapa, s);
    if (!ed || !eds.has(ed)) continue;
    const ctx = s.context ?? null, at = s.atencio ?? null;
    const viva = (parts.get(ed) || []).find(p => p.rotacio_actual);
    const part = s.escolta_id ? (s.part_id ?? null) : (viva?.id ?? null);   // (d)
    const k = ed + '|' + part + '|' + ctx + '|' + at;
    let g = obert.get(k);
    if (!g || s.t - g.t0 >= FINESTRA_ESCOLTA || g.msids.has(s.recording_msid)) {
      g = { ed, part, ctx, at, t0: s.t, s: [], msids: new Set(), comptes: new Set() };
      obert.set(k, g); grups.push(g);
    }
    g.s.push(s); g.msids.add(s.recording_msid); g.comptes.add(s.compte);
  }

  // Esborrar les escoltes que vénen de scrobbles i tornar-les a escriure.
  // Les físiques, registrades a mà, no tenen cap scrobble lligat i no es toquen.
  db.run('DELETE FROM escolta WHERE id IN (SELECT DISTINCT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL)');
  db.run('UPDATE scrobble SET escolta_id = NULL WHERE escolta_id IS NOT NULL');

  const ins = db.prepare(`INSERT INTO escolta (edicio_id, part_id, data_hora, canal, context, atencio, completitud, compte)
                          VALUES (?, ?, ?, 'App', ?, ?, ?, ?)`);
  const lliga = db.prepare('UPDATE scrobble SET escolta_id = ? WHERE id = ?');
  let n = 0;
  for (const g of grups) {
    const ed = eds.get(g.ed);
    const durada = g.part ? (parts.get(g.ed) || []).find(p => p.id === g.part)?.durada : ed.durada_total;
    const sonat = g.s.reduce((x, s) => x + s.sonat, 0);
    const compl = durada ? Math.round(sonat / (durada * MIN) * 1000) / 1000 : null;
    ins.run([g.ed, g.part, new Date(g.t0).toISOString(), g.ctx, g.at, compl, [...g.comptes].sort().join(',')]);
    const id = un(db, 'SELECT last_insert_rowid() AS id').id;
    for (const s of g.s) lliga.run([id, s.id]);
    n++;
  }
  ins.free(); lliga.free();

  // La data de la darrera escolta de cada part (§8.5): la mou només una escolta que compta.
  db.run(`UPDATE part SET data_darrera_escolta = (SELECT MAX(s.data_hora) FROM escolta s WHERE s.part_id = part.id AND ${SQL_COMPTA})
          WHERE EXISTS (SELECT 1 FROM escolta s WHERE s.part_id = part.id)`);

  // La portada que arriba amb l'escolta (bloc 3.2): mana sobre la de la sonda i sobre un rebuig, mai sobre la que ha
  // triat o pujat Ricard. Es fa servir la de l'escolta més recent que en porta.
  let portades = 0;
  const cobs = new Map();
  for (const g of grups) for (const s of g.s) if (s.caa_release_mbid) cobs.set(g.ed, s.caa_release_mbid);
  for (const [ed, mbid] of cobs) {
    db.run(`UPDATE edicio SET portada = ?, portada_origen = 'escolta'
            WHERE id = ? AND (portada_origen IS NULL OR portada_origen IN ('sonda', 'rebutjada')) `, ['release/' + mbid, ed]);
    portades += db.getRowsModified();
  }
  return { escoltes: n, portades };
};

// ───────── el que la màquina sap de les escoltes ─────────
// Les escoltes que compten, en ordre de temps, amb l'àlbum i el grup.
export function escoltesQueCompten(db) {
  return files(db, `SELECT s.id, s.edicio_id, s.data_hora, s.context, s.completitud, e.album_id, a.conjunt
                    FROM escolta s JOIN edicio e ON e.id = s.edicio_id JOIN album a ON a.id = e.album_id
                    WHERE ${SQL_COMPTA} ORDER BY s.data_hora, s.id`);
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
  return out;
}

// Com surt un grup a Discos en Rotació (§7.5, ACT-443 i ACT-444): sense escoltes, junts; si no, com van sonar
// l'última vegada. Retorna el conjunt d'àlbums que van junts (pot ser buit: tots solts).
export function juntsARotacio(finestresGrup) {
  if (!finestresGrup || !finestresGrup.length) return null;     // null = cap escolta: junts tots
  const u = finestresGrup[finestresGrup.length - 1];
  return u.tirada ? u.albums : new Set();
}

// L'Historial (§7.7, v1.34 i ACT-448): una fila per grup amb tirades i una per disc amb escoltes soltes.
// La fila del grup compta les tirades i porta els àlbums de l'última; la del disc compta només les soltes.
// Totes s'ordenen per l'última vegada que van sonar.
export function historial(db) {
  const totes = escoltesQueCompten(db);
  const perGrup = new Map(), soltes = [];
  for (const e of totes) if (e.conjunt) (perGrup.get(e.conjunt) || perGrup.set(e.conjunt, []).get(e.conjunt)).push(e); else soltes.push(e);
  const files_ = [];
  for (const [g, l] of perGrup) {
    const fs = finestres(l);
    const tir = fs.filter(f => f.tirada);
    if (tir.length) {
      const u = tir[tir.length - 1];
      files_.push({ grup: g, n: tir.length, darrera: new Date(u.darrera).toISOString(), albums: [...u.albums],
                     edicions: [...new Set(u.escoltes.map(e => e.edicio_id))] });
    }
    for (const f of fs) if (!f.tirada) soltes.push(...f.escoltes);
  }
  const perEd = new Map();
  for (const e of soltes) { const x = perEd.get(e.edicio_id) || { edicio_id: e.edicio_id, n: 0, darrera: '' };
    x.n++; if (e.data_hora > x.darrera) x.darrera = e.data_hora; perEd.set(e.edicio_id, x); }
  files_.push(...perEd.values());
  return files_.sort((a, b) => b.darrera.localeCompare(a.darrera));
}

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
  const out = [];
  for (const x of per.values()) {
    const minuts = Math.round([...x.pistes.values()].reduce((a, b) => a + b, 0) / MIN) || null;
    const c = candidates(db, { album: x.album, artista: x.artista, minuts });
    if (!c.length) continue;
    out.push({ ...x, n: x.pistes.size, minuts, candidates: c.slice(0, 6) });
  }
  return out;
}
