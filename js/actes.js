// Les òperes per actes (Obra 4, ACT-777, 18-11, Ricard, opció B, cas Parsifal de Knappertsbusch). Aquí no hi ha
// pantalla ni xarxa: només llegir l'acte al nom d'una pista i agrupar per actes la llista de pistes de MusicBrainz.
//
// La regla: una caixa d'òpera té una part per acte (no per CD). La màquina llegeix l'acte al nom de cada pista
// («Act 1», «Akt 2», «Aufzug 3»…) i, al disc nou, agrupa per acte les pistes de MusicBrainz i proposa les parts amb la
// seva durada. Camps: Scrobble.pista, Part.Numero, Part.Nom, Part.Durada.
//
// Decisions de construcció, POR RATIFICAR (el pla no fixa la llista de paraules):
//  (1) les paraules: act / acte / acto / atto / akt / aufzug / akte, en anglès, català-francès, castellà, italià i alemany;
//  (2) el número va darrere la paraula, en xifres (1-9) o romà (I a V), o en lletres (one…five, primo…quinto, erster…fünfter
//      davant de «Aufzug/Akt», «1. Akt»); sense número no és cap acte: «Act Naturally», «Dog Act» → cap;
//  (3) només es fa servir si l'edició ja té parts i n'hi ha una amb aquest número: un disc que no és caixa no canvia mai.
const ROMA = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
const LLETRES = { one: 1, two: 2, three: 3, four: 4, five: 5, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  primo: 1, secondo: 2, terzo: 3, quarto: 4, quinto: 5, primero: 1, segundo: 2, tercero: 3, cuarto: 4,
  premier: 1, deuxieme: 2, troisieme: 3, quatrieme: 4, cinquieme: 5 };
const ALEMANY = { erster: 1, zweiter: 2, dritter: 3, vierter: 4, funfter: 5, erste: 1, zweite: 2, dritte: 3 };
const PARAULA = '(?:act|acte|acto|atto|akt|aufzug)';
const sense = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RE_DARRERE = new RegExp(`\\b${PARAULA}\\.?\\s+(\\d|[ivx]{1,3}|[a-z]+)\\b`, 'g');
const RE_DAVANT = new RegExp(`\\b(\\d)\\.\\s*(?:akt|aufzug)\\b|\\b([a-z]+)\\s+(?:akt|aufzug)\\b`, 'g');

export function numeroDActe(pista) {
  const t = sense(pista);
  for (const m of t.matchAll(RE_DARRERE)) {
    const w = m[1];
    if (/^\d$/.test(w) && +w >= 1) return +w;
    if (ROMA[w]) return ROMA[w];
    if (LLETRES[w]) return LLETRES[w];
  }
  for (const m of t.matchAll(RE_DAVANT)) {
    if (m[1] && +m[1] >= 1) return +m[1];
    if (m[2] && ALEMANY[m[2]]) return ALEMANY[m[2]];
  }
  return null;
}

// La llista de pistes de MusicBrainz ({ title, length en ms }) agrupada per actes: [{ numero, nom, durada en minuts }].
// Només si TOTES les pistes diuen el seu acte, n'hi ha dos o més i totes tenen durada (decisió POR RATIFICAR (4)): si no,
// cap proposta, i el disc entra com sempre.
// Des de la ACT-798 (Ricard, 19-11, «sí»), que canvia la (4): una pista sense acte ja no impedeix proposar parts; pren
// l'acte de la pista anterior, i si és la primera, l'1. La família del preludi (ACT-798, confirmada a la ACT-799, sense
// Intermezzo ni Zwischenspiel) pren el de la pista SEGÜENT que en diu un: un preludi obre l'acte que ve. CONSEQÜÈNCIA DITA:
// una pista extra al final (entrevista, bonus) cau a l'últim acte. Calen dos actes o més, i que totes tinguin durada.
const PRELUDI = /\b(vorspiel|einleitung|ouverture|overture|prelude|introduction|entr ?acte|preludio|sinfonia|introduzione|obertura|introduccion|preludi|introduccio)\b/;
export const esPreludi = t => PRELUDI.test(sense(t).replace(/['’]/g, ' '));
export function partsPerActe(pistes) {
  if (!pistes?.length) return null;
  const per = new Map();
  const ns = pistes.map(p => numeroDActe(p.title));
  if (!ns.some(n => n !== null)) return null;
  let ant = null;
  for (let i = 0; i < pistes.length; i++) {
    const p = pistes[i];
    if (!(p.length > 0)) return null;
    let n = ns[i];
    if (n === null && esPreludi(p.title)) n = ns.slice(i + 1).find(x => x !== null) ?? null;
    if (n === null) n = ant ?? 1;
    ant = n;
    per.set(n, (per.get(n) || 0) + p.length);
  }
  if (per.size < 2) return null;
  return [...per.entries()].sort((a, b) => a[0] - b[0]).map(([numero, ms]) => ({ numero, nom: 'Acte ' + numero, durada: Math.round(ms / 60000) }));
}
