// Els fitxers d'any (obra III, v1.57, ACT-837, ACT-838, ACT-840 1, ACT-841 1 a 3).
// L'arxiu principal guarda les pistes (Scrobble) dels últims 12 mesos; cada mes, les de més de 12 mesos passen al fitxer
// del seu any al Drive («la-meva-discoteca · pistes AAAA.sqlite»), llevat de les pendents de la safata (ACT-838). Les
// escoltes (Escolta) no surten mai del principal: «Tal dia com avui» i les estadístiques les llegeixen d'allà.
//  · Una pista només surt si tota la seva escolta (la unió, ACT-585) és de més de 12 mesos: una unió no queda partida.
//  · Primer es desen els resums a la fitxa (resums.js, ACT-841 4), després es puja el fitxer d'any, i només quan és al
//    Drive les pistes s'esborren del principal. Si l'app es tanca entremig, la pista és als dos llocs i mana la del
//    principal: el moviment següent la torna a escriure (INSERT OR REPLACE per id). Mai es perd res.
//  · El total de pistes (principal més fitxers d'any) s'apunta al principal a cada moviment (meta «pistes-anys»), i
//    l'alarma de les còpies (ACT-608) compta aquest total (ACT-841 2): si no, sonaria en fals cada mes.
//  · El recàlcul (ACT-841 1): quan puja CALCUL, o una correcció toca pistes de més de 12 mesos, recalcula ho marca
//    (meta «anys-per-recalcular») i aquí s'obren els fitxers d'any que calen, amb el progrés a la vista («Recalculant
//    2027…»). Sense connexió, espera i es queda el càlcul anterior. Les pistes de l'any entren al principal, es torna a
//    calcular, el fitxer d'any es puja amb les escoltes noves i només llavors surten del principal.
// Camps: Scrobble.* (Scrobble.listened_at, Scrobble.estat, Scrobble.escolta_id), Escolta.unio, meta.
import * as A from './arxiu.js?v=21';
import * as E from './escoltes.js?v=15';
import * as R from './resums.js?v=1';

export const FINESTRA_MESOS = 12;
// Com a molt tantes pistes per vegada: un arxiu amb anys d'història (o el primer moviment després d'una càrrega gran) es
// va buidant en unes quantes obertures, sense penjar l'app. El mes no es dona per fet fins que no en queda cap.
export const MAX_PER_VEGADA = 5000;
// El moviment i el recàlcul amb els anys es fan una estona després d'obrir, quan ja ha passat la lectura i la còpia.
export const ESPERA_MS = 30000;
const META_ANYS = 'pistes-anys', META_MES = 'moviment-anys-mes';
const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
const meta = (db, k) => files(db, 'SELECT valor FROM meta WHERE clau = ?', [k])[0]?.valor ?? null;
const posaMeta = (db, k, v) => v == null ? db.run('DELETE FROM meta WHERE clau = ?', [k]) : db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [k, String(v)]);

const VIST = 'tria-anys-mes';
const mesVist = () => { try { return localStorage.getItem(VIST); } catch { return null; } };
const veuMes = m => { try { localStorage.setItem(VIST, m); } catch {} };
export const limit = (ara = Date.now()) => { const d = new Date(ara); d.setUTCMonth(d.getUTCMonth() - FINESTRA_MESOS); return d.toISOString(); };
export const mes = (ara = Date.now()) => new Date(ara).toISOString().slice(0, 7);
// {"2027": 20314, …}: quantes pistes hi ha a cada fitxer d'any.
export const comptesAnys = db => { try { return JSON.parse(meta(db, META_ANYS) || '{}'); } catch { return {}; } };
export const anys = db => Object.keys(comptesAnys(db)).sort();
export const pistesAlsAnys = db => Object.values(comptesAnys(db)).reduce((x, n) => x + (+n || 0), 0);
export const calObrir = db => !!E.anysPerRecalcular(db) && anys(db).length > 0;

// Les pistes que toca treure: de més de 12 mesos, no pendents, i amb tota la seva unió de més de 12 mesos. Primer les unions
// vives (les que tenen alguna pista dels últims 12 mesos: poques, per l'índex de listened_at) i després la resta: una
// subconsulta per pista penjava el banc amb l'arxiu gran de 5 anys (75.000 pistes, trobat a la primera porta de l'obra III).
export function aMoure(db, lim) {
  return files(db, `WITH vives AS (SELECT DISTINCT COALESCE(x.unio, x.id) AS u FROM scrobble t JOIN escolta x ON x.id = t.escolta_id WHERE t.listened_at >= ?)
    SELECT s.id, substr(s.listened_at, 1, 4) AS any FROM scrobble s LEFT JOIN escolta y ON y.id = s.escolta_id
    WHERE s.listened_at < ? AND s.estat != 'pendent' AND (y.id IS NULL OR COALESCE(y.unio, y.id) NOT IN (SELECT u FROM vives))
    ORDER BY s.listened_at`, [lim, lim]);
}
const columnes = db => files(db, 'PRAGMA table_info(scrobble)').map(c => c.name);
// Una base nova per a un any: la mateixa taula scrobble que el principal, i una meta amb l'any.
export function baseAny(SQL, db, bytes = null) {
  if (bytes) return new SQL.Database(bytes);
  const d = new SQL.Database();
  d.exec(files(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'scrobble'")[0].sql);
  d.exec('CREATE TABLE meta (clau TEXT PRIMARY KEY, valor TEXT)');
  return d;
}
// Copia unes pistes del principal a una altra base (INSERT OR REPLACE per id: mana el principal). Les columnes que el
// fitxer d'any encara no té (una estructura nova del principal) s'hi afegeixen abans.
export function copia(db, desti, ids) {
  const cs = columnes(db), ja = new Set(columnes(desti));
  for (const c of cs) if (!ja.has(c)) desti.exec(`ALTER TABLE scrobble ADD COLUMN ${c}`);
  const ins = desti.prepare(`INSERT OR REPLACE INTO scrobble (${cs.join(', ')}) VALUES (${cs.map(() => '?').join(', ')})`);
  for (let i = 0; i < ids.length; i += 500) {
    const tros = ids.slice(i, i + 500);
    const st = db.prepare(`SELECT ${cs.join(', ')} FROM scrobble WHERE id IN (${tros.map(() => '?').join(',')})`); st.bind(tros);
    while (st.step()) ins.run(st.get());
    st.free();
  }
  ins.free();
}
// Les pistes d'un fitxer d'any, cap al principal (INSERT OR IGNORE: si ja hi és, mana el principal).
function entra(any, db) {
  const cs = columnes(any).filter(c => new Set(columnes(db)).has(c));
  const ids = files(any, 'SELECT id FROM scrobble').map(r => r.id);
  const ins = db.prepare(`INSERT OR IGNORE INTO scrobble (${cs.join(', ')}) VALUES (${cs.map(() => '?').join(', ')})`);
  const st = any.prepare(`SELECT ${cs.join(', ')} FROM scrobble`);
  while (st.step()) ins.run(st.get());
  st.free(); ins.free();
  return ids;
}
const treu = (db, ids) => { for (let i = 0; i < ids.length; i += 500) { const t = ids.slice(i, i + 500); db.run(`DELETE FROM scrobble WHERE id IN (${t.map(() => '?').join(',')})`, t); } };
const connectat = () => A.tePermis() && navigator.onLine;

// El moviment del mes. forca: encara que ja s'hagi fet aquest mes (el banc).
export async function mouMes({ ara = Date.now(), forca = false } = {}) {
  const db = A.estat.db; if (!db) return { fet: false, motiu: 'l\'arxiu no és obert' };
  if (!forca && (meta(db, META_MES) === mes(ara) || mesVist() === mes(ara))) return { fet: false, motiu: 'ja fet aquest mes' };
  if (!connectat()) return { fet: false, motiu: 'sense connexió' };
  const lim = limit(ara), per = new Map(), totes = aMoure(db, lim), tros = totes.slice(0, MAX_PER_VEGADA);
  for (const r of tros) (per.get(r.any) || per.set(r.any, []).get(r.any)).push(r.id);
  // Res a moure: es recorda en aquest dispositiu, sense tocar l'arxiu. Escriure a l'arxiu cada mes per no res deixava un
  // desat automàtic pendent mitja hora (trobat a la segona porta de l'obra III, «desat agrupat», ACT-750 a).
  if (!per.size) { veuMes(mes(ara)); return { fet: true, mogudes: 0 }; }
  await A.canvia(d => R.desaResums(d), { auto: true });   // ACT-841 (4): abans que les pistes surtin
  const SQL = await A.motorSql(), comptes = {};
  for (const [any, ids] of per) {
    const f = await A.fitxerAny(any);
    const base = baseAny(SQL, db, f ? await A.baixaFitxer(f.id) : null);
    copia(db, base, ids);
    comptes[any] = files(base, 'SELECT COUNT(*) AS n FROM scrobble')[0].n;
    await A.desaFitxerAny(any, base.export(), f?.id || null);
    base.close();
  }
  let mogudes = 0;
  await A.canvia(d => {
    for (const ids of per.values()) { treu(d, ids); mogudes += ids.length; }
    posaMeta(d, META_ANYS, JSON.stringify({ ...comptesAnys(d), ...comptes }));
    if (tros.length === totes.length) posaMeta(d, META_MES, mes(ara));   // si en queden, la propera obertura continua
    E.posaLimitAnys(d, lim);   // una cota: tota pista dels fitxers d'any és d'abans (obrir-los de més és innocu)
  }, { auto: true });
  return { fet: true, mogudes, anys: Object.keys(comptes), queden: totes.length - tros.length };
}

// El recàlcul amb els anys (ACT-841 1). avisa: per al progrés («Recalculant 2027…»).
export async function recalculaAmbAnys({ avisa = () => {} } = {}) {
  const db = A.estat.db; if (!db || !calObrir(db)) return { fet: false };
  if (!connectat()) return { fet: false, espera: true };   // sense connexió: espera, i es queda el càlcul anterior
  const desDe = E.anysPerRecalcular(db), SQL = await A.motorSql();
  const obrir = anys(db).filter(a => desDe === 'tot' || a >= desDe.slice(0, 4));   // els anys des de la pista més antiga tocada
  const bases = [];
  for (const any of obrir) {
    avisa(`Recalculant ${any}…`);
    const f = await A.fitxerAny(any); if (!f) continue;
    bases.push({ any, f, base: baseAny(SQL, db, await A.baixaFitxer(f.id)) });
  }
  // 1. Les pistes de l'any entren, i es torna a calcular (sense tornar a marcar els anys).
  const perAny = new Map();
  await A.canvia(d => {
    for (const b of bases) perAny.set(b.any, entra(b.base, d));
    E.recalcula(d, { desDe: desDe === 'tot' ? null : desDe, ambAnys: true });
  }, { auto: true });
  // 2. Cada fitxer d'any, amb les escoltes noves, al Drive. 3. Només llavors surten del principal.
  for (const b of bases) {
    avisa(`Desant ${b.any}…`);
    copia(A.estat.db, b.base, perAny.get(b.any));
    await A.desaFitxerAny(b.any, b.base.export(), b.f.id); b.base.close();
  }
  await A.canvia(d => { for (const ids of perAny.values()) treu(d, ids); E.netejaAnysPerRecalcular(d); }, { auto: true });
  return { fet: true, anys: obrir };
}

// Una còpia de l'arxiu amb totes les pistes, per a «Descarrega l'Excel» (ACT-841 3). progres(i, n, any).
export async function ambTotsElsAnys(db, progres = () => {}) {
  const as = anys(db); if (!as.length) return { db, tanca: () => {} };
  const SQL = await A.motorSql(), tot = new SQL.Database(db.export());
  for (let i = 0; i < as.length; i++) {
    progres(i + 1, as.length, as[i]);
    const f = await A.fitxerAny(as[i]); if (!f) continue;
    const b = new SQL.Database(await A.baixaFitxer(f.id)); entra(b, tot); b.close();
  }
  return { db: tot, tanca: () => tot.close() };
}

// Les còpies dels fitxers d'any (ACT-841 3). Obert: encara en rebrà (les pistes del seu any no han acabat de sortir):
// entra a la còpia setmanal, amb el mateix nom de data que la parella, i rota amb ella. Tancat: una còpia fixa, un sol cop.
export function estatAny(db, any, ara = Date.now()) {
  const lim = limit(ara), seg = `${+any + 1}-01-01`;
  const queden = files(db, 'SELECT COUNT(*) AS n FROM scrobble WHERE substr(listened_at, 1, 4) = ?', [any])[0].n;
  return lim >= seg && !queden ? 'tancat' : 'obert';
}
export const nomCopiaAny = (any, data) => `la-meva-discoteca · pistes ${any} · còpia de seguretat ${data}.sqlite`;
export const nomFixaAny = any => `la-meva-discoteca · pistes ${any} · còpia fixa.sqlite`;
export async function copiesAnys(db, data) {
  const fetes = [];
  for (const any of anys(db)) {
    const f = await A.fitxerAny(any); if (!f) continue;
    if (estatAny(db, any) === 'obert') { await A.creaCopia(nomCopiaAny(any, data), A.SQLITE_MIME, await A.baixaFitxer(f.id), { tria: 'copia-any', any }); fetes.push(any); }
    else if (!meta(db, 'copia-fixa-' + any)) {
      await A.creaCopia(nomFixaAny(any), A.SQLITE_MIME, await A.baixaFitxer(f.id), { tria: 'copia-fixa', any });
      await A.canvia(d => posaMeta(d, 'copia-fixa-' + any, data), { auto: true }); fetes.push(any + ' (fixa)');
    }
  }
  return fetes;
}
