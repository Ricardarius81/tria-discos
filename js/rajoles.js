// Obra 6 (19-11): la Prestatgeria de rajoles (ACT-774) i l'ordre dels preferents (ACT-775).
// - ACT-774: la pestanya Tots els discos és una pantalla de rajoles, amb el cercador a dalt. Cada rajola diu quants discos
//   té i obre la llista filtrada o ordenada. Els camps: Artista, Àlbum.Títol, Àlbum.Gènere (generes), Àlbum.Any de
//   publicació original (any_original), Escolta (data_hora, les que compten: SQL_COMPTA), Edició.Durada total,
//   Edició.Estat d'estrena, Edició.Puntuació (la darrera de puntuacio) i Edició.App d'escolta.
//   Rendiment: tot el que les rajoles necessiten es llegeix en una sola passada per arxiu (memo amb total_changes(), com
//   dades.js); els comptadors i les llistes surten d'aquesta passada, sense tornar a recórrer l'arxiu a cada pintat.
// - ACT-775: l'ordre dels Artistes Preferents (Manual, A-Z, Z-A, Inclusió ↑↓, Darrera escolta). Estat de pantalla del
//   mòbil (localStorage), fora de l'arxiu; només Manual es pot arrossegar.
import { totsElsDiscos } from './dades.js?v=25';
import { escoltesPerEdicio } from './afinacio.js?v=4';
import { SQL_COMPTA } from './escoltes.js?v=15';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p);
  const out = []; let cols = null;
  while (st.step()) { const v = st.get(); cols ||= st.getColumnNames(); const o = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = v[i]; out.push(o); }
  st.free(); return out;
};
const memories = new WeakMap();
// Ull: db.export() de sql.js tanca i torna a obrir l'arxiu, i total_changes() torna a 0 (fes() exporta abans de cada
// canvi): un canvi just després podia tornar al mateix número i servir la llista vella (la fila esborrada seguia a Tots,
// primera puerta de l'obra 6). Per això cada export oblida el que es recordava d'aquest arxiu.
const vigilats = new WeakSet();
const vigila = db => { if (vigilats.has(db) || !db.export) return; vigilats.add(db); const ex = db.export.bind(db); db.export = (...a) => { memories.delete(db); return ex(...a); }; };
const memo = (db, clau, f) => {
  vigila(db);
  const n = db.exec('SELECT total_changes()')[0].values[0][0];
  let m = memories.get(db); if (!m || m.n !== n) { m = { n, v: new Map() }; memories.set(db, m); }
  if (!m.v.has(clau)) m.v.set(clau, f());
  return m.v.get(clau);
};
const CA = new Intl.Collator('ca', { sensitivity: 'base' });
const perNom = (x, y) => CA.compare(x.art, y.art) || CA.compare(x.titol, y.titol) || x.id - y.id;
const llista = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export const RAJOLES = [
  { clau: 'tots', nom: 'Tots' }, { clau: 'artista', nom: 'Per Artista' }, { clau: 'album', nom: 'Per Àlbum' },
  { clau: 'genere', nom: 'Per Gènere' }, { clau: 'any', nom: 'Per Any' }, { clau: 'escoltes', nom: 'Per Escoltes' },
  { clau: 'durada', nom: 'Per Durada' }, { clau: 'estrena', nom: 'Sense estrenar' }, { clau: 'nota', nom: 'Per nota' },
  { clau: 'canal', nom: 'Per canal' }, { clau: 'atzar', nom: 'A l\'atzar' }, { clau: 'dia', nom: 'Tal dia com avui' }
];
export const esRajola = k => RAJOLES.some(r => r.clau === k);

// Les franges de durada (ACT-774, de Ricard): menys de 15′, 15-29, 30-44, 45-59, 60-79 i de 20 en 20 fins al disc més
// llarg; per sobre de 80′, només les que tenen algun disc. [de, a): un disc de 30′ va a 30-44. Els rètols no solapen els
// números rodons (ACT-800 b): amb minuts sencers és el mateix repartiment, només canvia el rètol.
export function franja(d) {
  if (d < 15) return { de: 0, nom: 'menys de 15′' };
  for (const [a, b] of [[15, 30], [30, 45], [45, 60], [60, 80]]) if (d < b) return { de: a, nom: `${a}-${b - 1}′` };
  const a = 80 + Math.floor((d - 80) / 20) * 20;
  return { de: a, nom: `${a}-${a + 19}′` };
}
const FRANGES_FIXES = [0, 15, 30, 45, 60].map(franja);

// El dia d'avui, local (mes-dia) i l'any.
const diaDe = iso => { const d = new Date(iso); return isNaN(d) ? null : { md: (d.getMonth() + 1) * 100 + d.getDate(), any: d.getFullYear() }; };
const ddmmaaaa = iso => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

// Una sola passada: les files de Tots els discos amb els camps de les rajoles, i els comptadors.
function base(db) {
  return memo(db, 'rajoles', () => {
    const tots = totsElsDiscos(db), n = escoltesPerEdicio(db);
    const extra = new Map(files(db, `
      SELECT e.id, e.estat_estrena, e.app_escolta, a.generes, a.any_original, a.artista_id,
             (SELECT p.valor FROM puntuacio p WHERE p.edicio_id = e.id ORDER BY p.data DESC, p.id DESC LIMIT 1) AS nota
      FROM edicio e JOIN album a ON a.id = e.album_id`).map(r => [r.id, r]));
    const files_ = tots.map(x => { const e = extra.get(x.id) || {};
      const gs = llista(e.generes).filter(Boolean);
      return { ...x, escoltes: n.get(x.id) || 0, estrena: e.estat_estrena, canal: e.app_escolta || null, genere: gs[0] || null, generes: gs,
               any: e.any_original ?? null, nota: e.nota ?? null, artista_id: e.artista_id }; });
    const c = { tots: files_.length, artista: new Set(files_.map(x => x.artista_id)).size, album: new Set(files_.map(x => x.album_id)).size,
                genere: 0, any: 0, escoltes: 0, durada: files_.length, estrena: 0, nota: 0, canal: 0, atzar: files_.length };
    for (const x of files_) {
      if (x.genere) c.genere++; if (x.any != null) c.any++; if (x.escoltes) c.escoltes++;
      if (x.estrena === 'Sense estrenar') c.estrena++; if (x.nota != null) c.nota++; if (x.canal) c.canal++;
    }
    const des = files(db, 'SELECT MIN(data_hora) AS d FROM escolta')[0]?.d || null;
    return { files: files_, c, des };
  });
}

// Tal dia com avui: les escoltes que compten d'aquest dia i mes, d'anys anteriors. Una fila per disc i any.
function delDia(db, ara = new Date()) {
  const avui = { md: (ara.getMonth() + 1) * 100 + ara.getDate(), any: ara.getFullYear() };
  return memo(db, 'dia-' + avui.any + '-' + avui.md, () => {
    // Prefiltre a SQL (el dia UTC d'ahir, avui i demà), i el dia local de debò en JS.
    const mds = [-1, 0, 1].map(k => { const d = new Date(ara.getTime() + k * 864e5); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; });
    const vist = new Set(), out = [];
    for (const r of files(db, `SELECT s.edicio_id AS id, s.data_hora FROM escolta s WHERE substr(s.data_hora, 6, 5) IN (?, ?, ?) AND ${SQL_COMPTA} ORDER BY s.data_hora DESC`, mds)) {
      const d = diaDe(r.data_hora); if (!d || d.md !== avui.md || d.any >= avui.any) continue;
      const k = d.any + ':' + r.id; if (vist.has(k)) continue; vist.add(k); out.push({ id: r.id, any: d.any });
    }
    return out;
  });
}

export function comptes(db, ara = new Date()) {
  const b = base(db);
  return { ...b.c, dia: delDia(db, ara).length, des: b.des };
}
export function textCompte(clau, c) {
  const n = c[clau], dsc = n === 1 ? 'disc' : 'discos';
  if (clau === 'artista') return `${n} ${n === 1 ? 'artista' : 'artistes'}`;
  if (clau === 'album') return `${n} ${n === 1 ? 'àlbum' : 'àlbums'}`;
  if (clau === 'dia') return `${n} ${n === 1 ? 'escolta' : 'escoltes'} · ${c.des ? 'compta des del ' + ddmmaaaa(c.des) : 'encara cap escolta: compta des del primer dia'}`;
  return `${n} ${dsc}`;
}

// A l'atzar: un ordre nou cada cop que es toca la rajola, el mateix mentre es cerca o es repinta.
let llavorAtzar = Math.random();
export const remena = () => { llavorAtzar = Math.random(); };
const atzar = (id) => { const x = Math.sin(id * 12.9898 + llavorAtzar * 78.233) * 43758.5453; return x - Math.floor(x); };

// Les seccions d'una rajola: [{ titol, canal?, files }]. Una secció sense títol és una llista seguida.
export function seccions(db, clau, ara = new Date()) {
  const { files: fs } = base(db);
  const agrupa = (ll, k, ordre) => { const m = new Map(); for (const x of ll) { const v = k(x); if (!m.has(v)) m.set(v, []); m.get(v).push(x); }
    return [...m.entries()].sort(ordre).map(([titol, files]) => ({ titol: String(titol), clau: titol, files })); };
  switch (clau) {
    case 'artista': return agrupa(fs, x => x.art, () => 0);   // ja venen per artista
    case 'album': return [{ titol: '', files: [...fs].sort((x, y) => CA.compare(x.titol, y.titol) || CA.compare(x.art, y.art) || x.id - y.id) }];
    case 'genere': {
      // ACT-801: cada disc surt sota TOTES les seves rames (Àlbum.Gènere); a cada rama, primer on és la principal (posició 1)
      // i, a «També», on és secundària. Les xifres principals sumen els discos amb gènere; les +N, no.
      const m = new Map(), sec = g => { if (!m.has(g)) m.set(g, { titol: g, clau: g, files: [], tambe: [] }); return m.get(g); };
      for (const x of fs) x.generes.forEach((g, i) => { const t = sec(g); if (!i) t.files.push(x); else if (!x.generes.slice(0, i).includes(g)) t.tambe.push(x); });
      return [...m.values()].sort((a, b) => CA.compare(a.titol, b.titol));
    }
    case 'any': return agrupa(fs.filter(x => x.any != null), x => x.any, ([a], [b]) => a - b);
    case 'escoltes': return [{ titol: '', files: fs.filter(x => x.escoltes).sort((x, y) => y.escoltes - x.escoltes || perNom(x, y)) }];
    case 'durada': {
      const ss = agrupa([...fs].sort((x, y) => x.durada_total - y.durada_total || perNom(x, y)), x => franja(x.durada_total).nom, () => 0);
      const tot = [...FRANGES_FIXES.map(f => ss.find(s => s.titol === f.nom) || { titol: f.nom, files: [] }), ...ss.filter(s => franja(s.files[0].durada_total).de >= 80)];
      return tot;
    }
    case 'estrena': return [{ titol: '', files: fs.filter(x => x.estrena === 'Sense estrenar') }];
    case 'nota': return agrupa(fs.filter(x => x.nota != null), x => x.nota, ([a], [b]) => b - a);
    case 'canal': return agrupa(fs.filter(x => x.canal), x => x.canal, ([a, la], [b, lb]) => lb.length - la.length || CA.compare(a, b));
    case 'atzar': return [{ titol: '', files: [...fs].sort((x, y) => atzar(x.id) - atzar(y.id)) }];
    case 'dia': { const per = new Map(fs.map(x => [x.id, x]));
      return agrupa(delDia(db, ara).filter(r => per.has(r.id)).map(r => ({ ...per.get(r.id), any_escolta: r.any })), x => x.any_escolta, ([a], [b]) => b - a); }
    default: return [{ titol: '', files: fs }];
  }
}

// ───────── l'ordre ascendent o descendent de cada rajola (ACT-800 a, ACT-801) ─────────
// L'ordre natural de cada rajola és el de la ACT-789; triar l'altre gira les seccions i les files de dins (a Per Gènere,
// dins de cada tram: la principal sempre davant de «També»). A l'atzar no en té. El mòbil el recorda per a cada rajola.
export const ORDRE_NATURAL = { tots: 'asc', artista: 'asc', album: 'asc', genere: 'asc', any: 'asc', escoltes: 'desc', durada: 'asc',
  estrena: 'asc', nota: 'desc', canal: 'desc', dia: 'desc' };
const ORDRE_RJ = 'tria-ordre-rajoles';
const ordresRj = () => { try { const v = JSON.parse(localStorage.getItem(ORDRE_RJ) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
export function ordreRajola(clau) { const n = ORDRE_NATURAL[clau]; if (!n) return null; const v = ordresRj()[clau]; return v === 'asc' || v === 'desc' ? v : n; }
export function posaOrdreRajola(clau, v) { if (!ORDRE_NATURAL[clau]) return; try { localStorage.setItem(ORDRE_RJ, JSON.stringify({ ...ordresRj(), [clau]: v })); } catch {} }
export function ordena(ss, clau, ordre = ordreRajola(clau)) {
  if (!ordre || ordre === ORDRE_NATURAL[clau]) return ss;
  return [...ss].reverse().map(s => ({ ...s, files: [...s.files].reverse(), ...(s.tambe ? { tambe: [...s.tambe].reverse() } : {}) }));
}

// ───────── l'ordre dels Artistes Preferents (ACT-775) ─────────
export const ORDRES = [['manual', 'Manual'], ['az', 'A-Z'], ['za', 'Z-A'], ['inclusio-asc', 'Inclusió ↑'], ['inclusio-desc', 'Inclusió ↓'], ['escolta', 'Darrera escolta']];
const ORDRE = 'tria-ordre-preferents';
export function ordrePref() { try { const v = localStorage.getItem(ORDRE); return ORDRES.some(([k]) => k === v) ? v : 'manual'; } catch { return 'manual'; } }
export function posaOrdrePref(v) { try { localStorage.setItem(ORDRE, v); } catch {} }
// La darrera escolta de cada artista (Escolta.data_hora de les edicions dels seus àlbums), en una consulta. Compta també
// les fitxes que comparteixen Persona (ACT-800, com el marc daurat i la obra 5): la clau és COALESCE(persona, nom_canonic).
const normP = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const darreres = db => memo(db, 'darrera-artista', () => {
  const art = files(db, 'SELECT ar.id, COALESCE(ar.persona, ar.nom_canonic) AS p FROM artista ar');
  const d = new Map(files(db, `SELECT a.artista_id AS id, MAX(s.data_hora) AS d FROM escolta s JOIN edicio e ON e.id = s.edicio_id JOIN album a ON a.id = e.album_id
    GROUP BY a.artista_id`).map(r => [r.id, r.d]));
  const perP = new Map();
  for (const a of art) { const k = normP(a.p), v = d.get(a.id); if (v && (!perP.has(k) || perP.get(k) < v)) perP.set(k, v); }
  return new Map(art.map(a => [a.id, perP.get(normP(a.p)) || null]));
});
// ps ve en ordre manual (preferent.ordre, id). Inclusió = preferent.id, l'ordre d'alta.
export function ordenaPreferents(db, ps, ordre = ordrePref()) {
  const ll = [...ps];
  if (ordre === 'az') return ll.sort((a, b) => CA.compare(a.nom, b.nom) || a.id - b.id);
  if (ordre === 'za') return ll.sort((a, b) => CA.compare(b.nom, a.nom) || a.id - b.id);
  if (ordre === 'inclusio-asc') return ll.sort((a, b) => a.id - b.id);
  if (ordre === 'inclusio-desc') return ll.sort((a, b) => b.id - a.id);
  if (ordre === 'escolta') { const m = darreres(db);
    return ll.map((p, i) => ({ p, i, d: m.get(p.artista_id) || '' })).sort((a, b) => (b.d > a.d) - (b.d < a.d) || a.i - b.i).map(x => x.p); }
  return ll;
}
