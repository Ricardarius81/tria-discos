// L'Excel de l'arxiu (tram 4, §3.5, ACT-603 i ACT-604). La traducció llegible de l'arxiu: per a Ricard, o per a
// qualsevol màquina futura. Es genera des de l'estructura, no a mà, així que és complet per construcció.
//
// El mapa (ACT-603):
//  · Pestanyes: Edició, Part, Artista, Àlbum, Puntuació, Escolta, Scrobble, Preferent i Meta, i des de l'estructura 7
//    les dues de les Llistes de reproducció, Llista i Cançó de llista (ACT-632: l'Excel és complet per construcció).
//  · Edició, Part i Artista comencen amb les columnes del fitxer de càrrega (§3.2, H-06.b), en el mateix ordre.
//    «ID de càrrega» = Edició.id, que lliga Part amb Edició. «Avisos» va buida: no hi ha cap camp darrere, només hi és
//    per la forma del fitxer de càrrega.
//  · Títol, Artista, Nom de l'artista i Any original van a Edició com a columnes de lectura (capçalera en cursiva grisa):
//    viuen a Àlbum, i si se'n corregeix una a Edició i es torna a carregar, mana Àlbum.
//  · Després de les columnes de càrrega, la resta de camps de cada taula en l'ordre de l'esquema i amb el nom tal com és,
//    perquè un camp nou surti sol.
// Els valors (ACT-604): les llistes en JSON, tal com són a l'arxiu; les dates en text ISO en UTC, tal com són a l'arxiu;
// el que viu a meta, a la pestanya Meta (clau, valor).
//
// Sense cap biblioteca de fora (§3.6): un .xlsx és un zip de fitxers XML, i el zip s'escriu aquí.
// També es llegeix aquí, per a la prova d'anada i tornada del §3.5 (exportar, carregar en una base buida, comparar).

import { TAULES, TAULES_LLISTES } from './esquema.js?v=9';

const CARREGA = {
  edicio: {
    full: 'Edició', de: 'edicio x LEFT JOIN album a ON a.id = x.album_id LEFT JOIN artista ar ON ar.id = a.artista_id',
    cols: [['ID de càrrega', 'id'], ['ID d\'àlbum', 'album_id'], ['Títol', null, 'a.titol'], ['Artista', null, 'a.artista_id'],
           ['Nom de l\'artista', null, 'ar.nom_canonic'], ['Nom de l\'edició', 'nom_edicio'], ['Durada total', 'durada_total'],
           ['Any de publicació original', null, 'a.any_original'], ['Any d\'aquesta edició', 'any_edicio'], ['Segell', 'segell'],
           ['Codi de catàleg', 'codis_cataleg'], ['Formats disponibles', 'formats'], ['Estat d\'estrena', 'estat_estrena'],
           ['Lot de càrrega', 'lot_carrega'], ['Procedència', 'procedencia'], ['Avisos', null, 'NULL']]
  },
  part: {
    full: 'Part', de: 'part x LEFT JOIN edicio e ON e.id = x.edicio_id LEFT JOIN album a ON a.id = e.album_id LEFT JOIN artista ar ON ar.id = a.artista_id',
    cols: [['ID de càrrega', 'edicio_id'], ['Nom de l\'artista', null, 'ar.nom_canonic'], ['Nom de l\'edició', null, 'e.nom_edicio'],
           ['Part.Número', 'numero'], ['Títol de la part', 'nom'], ['Durada', 'durada']]
  },
  artista: {
    full: 'Artista', de: 'artista x',
    cols: [['ID d\'artista', 'id'], ['Nom canònic', 'nom_canonic'], ['Variants d\'escriptura', 'variants'], ['Persona', 'persona']]
  }
};
const ALTRES = [['album', 'Àlbum'], ['puntuacio', 'Puntuació'], ['escolta', 'Escolta'], ['scrobble', 'Scrobble'], ['preferent', 'Preferent'],
                ['llista', 'Llista'], ['llista_canco', 'Cançó de llista']];
export const PESTANYES = ['Edició', 'Part', 'Artista', 'Àlbum', 'Puntuació', 'Escolta', 'Scrobble', 'Preferent', 'Llista', 'Cançó de llista', 'Meta'];

const campsDe = (db, t) => db.exec(`PRAGMA table_info(${t})`)[0].values.map(v => v[1]);

// El mapa de cada pestanya: { full, taula, cols: [{ cap, camp, lectura, expr }], sql }
export function mapa(db) {
  const out = [];
  for (const [taula, c] of Object.entries(CARREGA)) {
    const cols = c.cols.map(([cap, camp, expr]) => ({ cap, camp, lectura: !camp, expr: camp ? 'x.' + camp : expr }));
    const posats = new Set(c.cols.map(x => x[1]).filter(Boolean));
    for (const camp of campsDe(db, taula)) if (!posats.has(camp)) cols.push({ cap: camp, camp, lectura: false, expr: 'x.' + camp });
    out.push({ full: c.full, taula, cols, sql: `SELECT ${cols.map(x => x.expr).join(', ')} FROM ${c.de} ORDER BY x.rowid` });
  }
  for (const [taula, full] of ALTRES) {
    const cols = campsDe(db, taula).map(camp => ({ cap: camp, camp, lectura: false, expr: camp }));
    out.push({ full, taula, cols, sql: `SELECT ${cols.map(x => x.expr).join(', ')} FROM ${taula} ORDER BY rowid` });
  }
  out.push({ full: 'Meta', taula: 'meta', cols: [{ cap: 'clau', camp: 'clau', lectura: false }, { cap: 'valor', camp: 'valor', lectura: false }],
             sql: 'SELECT clau, valor FROM meta ORDER BY clau' });
  return out;
}

// ───────── escriure ─────────
const LLETRES = n => { let s = ''; n++; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
// Els caràcters que l'XML no admet, i el «_x» literal, es codifiquen com fa l'Excel: _xHHHH_.
const xml = s => String(s).replace(/_x([0-9A-Fa-f]{4})_/g, '_x005F_x$1_')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r]/g, c => '_x' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + '_')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MAX_CEL = 32767;

function full(m, files) {
  const r = [];
  r.push('<row r="1">' + m.cols.map((c, i) => `<c r="${LLETRES(i)}1" s="${c.lectura ? 2 : 1}" t="inlineStr"><is><t xml:space="preserve">${xml(c.cap)}</t></is></c>`).join('') + '</row>');
  files.forEach((f, k) => {
    const n = k + 2; let cel = '';
    f.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const ref = LLETRES(i) + n;
      if (typeof v === 'number') { cel += `<c r="${ref}"><v>${String(v)}</v></c>`; return; }
      const s = String(v);
      if (s.length > MAX_CEL) throw new Error(`${m.full}.${m.cols[i].cap}, fila ${n}: ${s.length} caràcters, i l'Excel n'admet ${MAX_CEL} per cel·la`);
      cel += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(s)}</t></is></c>`;
    });
    r.push(`<row r="${n}">${cel}</row>`);
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<sheetData>' + r.join('') + '</sheetData></worksheet>';
}

// Torna les pestanyes amb les seves files: [{ full, taula, cols, files }]
export function fulls(db) {
  return mapa(db).map(m => ({ ...m, files: db.exec(m.sql)[0]?.values || [] }));
}

export async function xlsx(db) {
  const fs = fulls(db);
  const NS = 'http://schemas.openxmlformats.org/';
  const fitxers = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="' + NS + 'package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + fs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="' + NS + 'package/2006/relationships">'
      + '<Relationship Id="rId1" Type="' + NS + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="' + NS + 'spreadsheetml/2006/main" xmlns:r="' + NS + 'officeDocument/2006/relationships"><sheets>'
      + fs.map((f, i) => `<sheet name="${xml(f.full)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="' + NS + 'package/2006/relationships">'
      + fs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${fs.length + 1}" Type="${NS}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    // Tres estils: el normal, la capçalera en negreta i la capçalera d'una columna de lectura, en cursiva grisa.
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="' + NS + 'spreadsheetml/2006/main">'
      + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>'
      + '<font><b/><i/><sz val="11"/><color rgb="FF808080"/><name val="Calibri"/></font></fonts>'
      + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
      + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ...fs.map((f, i) => [`xl/worksheets/sheet${i + 1}.xml`, full(f, f.files)])
  ];
  return zip(fitxers.map(([nom, text]) => [nom, new TextEncoder().encode(text)]));
}

// ───────── el zip ─────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function flux(bytes, s) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(s)).arrayBuffer()); }
const comprimeix = b => typeof CompressionStream === 'function' ? flux(b, new CompressionStream('deflate-raw')) : null;

async function zip(entrades) {
  const locals = [], centrals = []; let pos = 0;
  for (const [nom, dades] of entrades) {
    const n = new TextEncoder().encode(nom), crc = crc32(dades);
    const comp = await comprimeix(dades), metode = comp ? 8 : 0, cos = comp || dades;
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, metode, true);
    l.setUint16(10, 0, true); l.setUint16(12, 0x21, true); l.setUint32(14, crc, true); l.setUint32(18, cos.length, true);
    l.setUint32(22, dades.length, true); l.setUint16(26, n.length, true); l.setUint16(28, 0, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, metode, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, cos.length, true); c.setUint32(24, dades.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, pos, true);
    locals.push(new Uint8Array(l.buffer), n, cos); centrals.push(new Uint8Array(c.buffer), n);
    pos += 30 + n.length + cos.length;
  }
  const midaC = centrals.reduce((a, b) => a + b.length, 0);
  const f = new DataView(new ArrayBuffer(22));
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, entrades.length, true); f.setUint16(10, entrades.length, true);
  f.setUint32(12, midaC, true); f.setUint32(16, pos, true);
  return new Uint8Array(await new Blob([...locals, ...centrals, new Uint8Array(f.buffer)]).arrayBuffer());
}

async function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('no és un fitxer .xlsx (no és un zip)');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  const out = new Map(), td = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const metode = v.getUint16(p + 10, true), mida = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true);
    const lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const nom = td.decode(bytes.subarray(p + 46, p + 46 + ln));
    const ini = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    const cos = bytes.subarray(ini, ini + mida);
    if (metode === 0) out.set(nom, cos);
    else if (metode === 8) out.set(nom, await flux(cos, new DecompressionStream('deflate-raw')));
    else throw new Error('compressió desconeguda a ' + nom);
    p += 46 + ln + lx + lc;
  }
  return out;
}

// ───────── llegir ─────────
const desxml = s => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, x) =>
  x === 'amp' ? '&' : x === 'lt' ? '<' : x === 'gt' ? '>' : x === 'quot' ? '"' : x === 'apos' ? "'" :
  String.fromCodePoint(x[1] === 'x' ? parseInt(x.slice(2), 16) : parseInt(x.slice(1), 10)))
  .replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const textDe = s => [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map(m => desxml(m[1] || '')).join('');
const colDe = ll => [...ll].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

// Llegeix un .xlsx (el d'aquesta màquina, o el mateix desat de nou per l'Excel, amb cadenes compartides).
// Torna { 'Edició': [[capçalera…], [fila…], …], … }.
export async function llegeix(bytes) {
  const z = await unzip(bytes), td = new TextDecoder(), t = nom => z.has(nom) ? td.decode(z.get(nom)) : '';
  const compartides = [...t('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textDe(m[1]));
  const rels = new Map([...t('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(m => [/Id="([^"]+)"/.exec(m[0])[1], /Target="([^"]+)"/.exec(m[0])[1]]));
  const out = {};
  for (const m of t('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const nom = desxml(/name="([^"]*)"/.exec(m[0])[1]), rid = /r:id="([^"]+)"/.exec(m[0])[1];
    const desti = rels.get(rid).replace(/^\/?xl\//, '').replace(/^\//, '');
    const files = [];
    for (const r of t('xl/' + desti).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const fila = [];
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1], cos = c[2] || '', i = colDe(/r="([A-Z]+)\d+"/.exec(at)[1]), tipus = /t="([^"]+)"/.exec(at)?.[1];
        const vv = /<v>([\s\S]*?)<\/v>/.exec(cos)?.[1];
        let val = null;
        if (tipus === 'inlineStr') val = textDe(cos);
        else if (tipus === 's') val = compartides[+vv] ?? null;
        else if (tipus === 'str') val = vv !== undefined ? desxml(vv) : null;
        else if (tipus === 'b') val = vv === '1' ? 1 : 0;
        else if (vv !== undefined) val = Number(vv);
        fila[i] = val;
      }
      files.push(Array.from(fila, x => x === undefined ? null : x));
    }
    out[nom] = files;
  }
  return out;
}

// Carrega el que s'ha llegit en una base buida (amb l'estructura ja posada). Les columnes de lectura no s'escriuen:
// mana la seva taula (Àlbum per al títol, l'artista i l'any original). Torna quantes files ha posat per taula.
export function carrega(db, llegit) {
  const posades = {};
  for (const m of mapa(db)) {
    const files = llegit[m.full]; if (!files) throw new Error('falta la pestanya ' + m.full);
    const [cap, ...dades] = files;
    const idx = m.cols.filter(c => !c.lectura).map(c => {
      const i = cap.indexOf(c.cap); if (i < 0) throw new Error(`falta la columna «${c.cap}» a ${m.full}`); return [c.camp, i];
    });
    const st = db.prepare(`INSERT ${m.taula === 'meta' ? 'OR REPLACE ' : ''}INTO ${m.taula} (${idx.map(x => x[0]).join(', ')}) VALUES (${idx.map(() => '?').join(', ')})`);
    for (const f of dades) { if (!f.some(x => x !== null)) continue; st.run(idx.map(([, i]) => f[i] ?? null)); }
    st.free(); posades[m.taula] = dades.length;
  }
  return posades;
}

// Compara dues bases fila a fila, amb el tipus de cada valor. Torna la llista de diferències (buida = idèntiques).
export function compara(a, b) {
  const dif = [];
  const ver = d => d.exec('PRAGMA user_version')[0].values[0][0];
  if (ver(a) !== ver(b)) dif.push(`estructura ${ver(a)} ≠ ${ver(b)}`);
  for (const t of [...TAULES, ...TAULES_LLISTES, 'meta']) {
    const q = `SELECT * FROM ${t} ORDER BY ${t === 'meta' ? 'clau' : 'rowid'}`;
    const fa = a.exec(q)[0]?.values || [], fb = b.exec(q)[0]?.values || [];
    if (fa.length !== fb.length) { dif.push(`${t}: ${fa.length} files ≠ ${fb.length}`); continue; }
    for (let i = 0; i < fa.length; i++) {
      const ja = JSON.stringify(fa[i]), jb = JSON.stringify(fb[i]);
      if (ja !== jb) { dif.push(`${t}, fila ${i + 1}: ${ja.slice(0, 160)} ≠ ${jb.slice(0, 160)}`); if (dif.length > 20) return dif; }
    }
  }
  return dif;
}
