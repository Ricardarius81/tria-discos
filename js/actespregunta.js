// Obra H (ACT-787 a i b; Ricard, 20-11, «de acuerdo», ACT-829). Fitxer nou perquè faristol.js no creixi (ACT-756).
//  (a) Una pista d'una caixa per actes que no diu el seu acte es pregunta a la targeta de la safata, amb un botó per part
//      («Acte 1 / 2 / 3»). La resposta es desa a meta, una clau per pista: «acte:<Scrobble.id>» = número. Scrobble.id no
//      canvia mai (les pistes només creixen, §3.5), i així no cal estructura nova. recalcula la llegeix després del nom de
//      la pista i abans del número del CD: la pista contestada va a la part triada. Camps: Scrobble.id, Scrobble.pista,
//      Part.Numero, Part.Nom, meta.
//      DECISIONS DE CONSTRUCCIÓ, POR RATIFICAR: (1) una caixa és «per actes» si té dues parts o més i el nom de TOTES diu
//      un acte (numeroDActe de Part.Nom); (2) es pregunta pista per pista, només a les targetes que són a la safata, i
//      la pregunta no reté la targeta ni compta al número; (3) sense resposta, la pista fa com fins ara (la part viva).
//  (b) Un disc nou que MusicBrainz no dona amb pistes (la durada proposada és «el que ha sonat») porta un enllaç
//      «És una òpera per actes»: quants actes i els minuts de cadascun fan les parts «Acte N» (Part.Numero, Part.Nom,
//      Part.Durada). DECISIÓ DE CONSTRUCCIÓ, POR RATIFICAR: (4) amb els actes posats, Edició.Durada_total és la suma
//      dels actes, i la casella de la durada no compta; si en falta un, no es desa i ho diu.
import { numeroDActe } from './actes.js?v=1';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const r = [];
  while (st.step()) r.push(st.getAsObject());
  st.free(); return r;
};

// Map Scrobble.id → número d'acte contestat.
export function actesDesats(db) {
  const m = new Map();
  for (const r of files(db, "SELECT clau, valor FROM meta WHERE clau LIKE 'acte:%'")) {
    const id = +r.clau.slice(5), n = +r.valor;
    if (id && n) m.set(id, n);
  }
  return m;
}
export const desaActe = (scrobbleId, n) => db => db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', ['acte:' + scrobbleId, String(n)]);

// Les parts d'una edició si és una caixa per actes (1); si no, null.
export function partsPerActes(db, edicioId) {
  const ps = files(db, 'SELECT id, numero, nom FROM part WHERE edicio_id = ? ORDER BY numero', [edicioId]);
  return ps.length >= 2 && ps.every(p => numeroDActe(p.nom) !== null) ? ps : null;
}

// Les pistes d'un disc d'una targeta que no diuen l'acte, amb la resposta que ja tinguin: [{ s, n }].
export function pistesSenseActe(db, edicioId, scr) {
  if (!edicioId || !partsPerActes(db, edicioId)) return [];
  const des = actesDesats(db), vistes = new Set(), out = [];
  for (const s of scr || []) {
    if (numeroDActe(s.pista) !== null || vistes.has(s.id)) continue;
    vistes.add(s.id); out.push({ s, n: des.get(s.id) ?? null });
  }
  return out;
}

// (b) Les parts escrites a mà: [{ numero, nom, durada }] o un text amb el que falta.
export function partsAMa(n, minuts) {
  n = parseInt(n, 10);
  if (!(n >= 2)) return 'Una òpera per actes en té dos o més.';
  const ps = [];
  for (let i = 1; i <= n; i++) {
    const m = parseInt(minuts?.[i], 10);
    if (!(m >= 1)) return `Falten els minuts de l'acte ${i}.`;
    ps.push({ numero: i, nom: 'Acte ' + i, durada: m });
  }
  return ps;
}
