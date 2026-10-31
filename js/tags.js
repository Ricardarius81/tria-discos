// El vocabulari dels tags de propietat (Pla de projecte, §6.3) i com es veuen a la fitxa (bloc 3.2 bis, 31-10-2026).
// Al fitxer sempre es desa el NOM COMPLET; el nom curt és només el que es pinta (decisió de Ricard, 31-10).
// El nivell el decideix el §6.3: si la resposta canvia entre màsters, edició; si no, àlbum.
// Els tags efectius d'una edició són els de l'àlbum més els seus (regla estructural del §6.3).

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Els de sí o buit. El buit vol dir «no» i també «no ho he mirat»: per a la màquina es comporten igual.
export const SI_NO = [
  { nom: 'Absorbeix', curt: 'Absorbeix', nivell: 'album' },
  { nom: 'En directe', curt: 'Directe', nivell: 'album' },
  { nom: 'Apte per acompanyat', curt: 'Acompanyat', nivell: 'album', alies: ['apte acompanyat'] },
  { nom: 'Apte per dormir', curt: 'Dormir', nivell: 'album', alies: ['apte dormir'] },
  // Les dues paraules juntes: per a Ricard són una sola apetència (§6.3). No s'escurça.
  { nom: 'Meditatiu / Espiritual', curt: 'Meditatiu / Espiritual', nivell: 'album' },
  { nom: 'Apte per «Amor»', curt: 'Amor', nivell: 'album', alies: ['apte per amor'] },
  { nom: 'Banda sonora', curt: 'Banda sonora', nivell: 'album' },
  { nom: 'Acústic', curt: 'Acústic', nivell: 'album' },
  { nom: 'Recompensa bon equip', curt: 'Bon equip', nivell: 'edicio', alies: ['bon equip'] },
  { nom: 'Resisteix soroll', curt: 'Resisteix soroll', nivell: 'edicio' },
  // «Volum alt» és decisió de Ricard (31-10). Al fitxer i al pla segueix sent «Guanya a volum alt», amb la seva definició.
  { nom: 'Guanya a volum alt', curt: 'Volum alt', nivell: 'edicio' }
];

// Els de valor, tots d'àlbum. Es desen com a «Nom: valor».
// Veu i Estació: un sol valor (decisió de Ricard, 31-10). El disc mixt és «amb veu»; si serveix per a diverses èpoques, en blanc.
export const VEU = { nom: 'Instrumental / amb veu', curt: 'Instrumental / Amb veu', valors: ['instrumental', 'amb veu'], un: true };
export const ESTACIO = { nom: "Estació / Moment de l'any", curt: 'Estació', valors: ['hivern', 'primavera', 'estiu', 'tardor', 'Nadal', 'Setmana Santa'], un: true };
// Idioma: llista oberta i diversos per disc (decisió de Ricard, opció B, 31-10). Cada idioma, un nom canònic en català.
export const IDIOMA = { nom: 'Idioma', curt: 'Idioma', un: false };
export const IDIOMES_BASE = ['català', 'castellà', 'anglès'];
const IDIOMES_ALIES = {
  català: ['catala', 'catalan', 'catalán', 'catalano'],
  castellà: ['castella', 'castellano', 'espanol', 'español', 'spanish', 'espanyol'],
  anglès: ['angles', 'ingles', 'inglés', 'english', 'anglais', 'inglese'],
  francès: ['frances', 'francés', 'french', 'francais', 'français'],
  italià: ['italia', 'italiano', 'italian', 'italien'],
  alemany: ['aleman', 'alemán', 'german', 'deutsch', 'allemand'],
  portuguès: ['portugues', 'portugués', 'portuguese', 'português'],
  llatí: ['llati', 'latin', 'latín', 'latino'],
  gallec: ['gallego', 'galician', 'galego'],
  basc: ['euskera', 'basque', 'vasco', 'euskara'],
  occità: ['occita', 'occitano', 'occitan'],
  rus: ['ruso', 'russian'],
  japonès: ['japones', 'japonés', 'japanese'],
  hebreu: ['hebreo', 'hebrew'],
  àrab: ['arab', 'arabe', 'árabe', 'arabic'],
  tamazight: ['tamasheq', 'amazic', 'berber', 'bereber']
};
// Un idioma escrit a mà passa per la normalització i els àlies (§4.1): «inglés» queda «anglès».
// Si no se'n coneix cap, entra tal com s'ha escrit, en minúscula: és un idioma nou (opció B).
export function idiomaCanonic(txt) {
  const n = norm(txt); if (!n) return null;
  for (const [can, al] of Object.entries(IDIOMES_ALIES)) if (norm(can) === n || al.some(a => norm(a) === n)) return can;
  return String(txt).trim().toLowerCase();
}

const AMB_VALOR = [VEU, ESTACIO, IDIOMA];
const valorDe = (t, tag) => { const p = tag.nom + ':'; return t.startsWith(p) ? t.slice(p.length).trim() : null; };

// Porta qualsevol forma vella al nom complet (la llavor va desar «apte dormir», «bon equip»…).
export function canonic(t) {
  const n = norm(t);
  for (const x of SI_NO) if (norm(x.nom) === n || norm(x.curt) === n || (x.alies || []).some(a => norm(a) === n)) return x;
  return null;
}

// Llegir: de les dues llistes (àlbum, edició) en surt l'estat que pinta la fitxa.
export function llegeix(albumTags, edicioTags) {
  const tots = [...(albumTags || []), ...(edicioTags || [])];
  const si = new Set(SI_NO.filter(x => tots.some(t => canonic(t) === x)).map(x => x.nom));
  const val = tag => tots.map(t => valorDe(t, tag)).filter(Boolean);
  return { si, veu: val(VEU)[0] || null, estacio: val(ESTACIO)[0] || null, idiomes: [...new Set(val(IDIOMA))] };
}
// El que es veu a la reixa: només els de sí, amb el nom curt.
export const curts = (albumTags, edicioTags) => SI_NO.filter(x => llegeix(albumTags, edicioTags).si.has(x.nom)).map(x => x.curt);

// Escriure: torna les dues llistes noves. Res no es toca fora del tag que es canvia.
export function commuta(albumTags, edicioTags, nom) {
  const x = SI_NO.find(y => y.nom === nom); if (!x) return null;
  const a = [...(albumTags || [])], e = [...(edicioTags || [])];
  const te = [...a, ...e].some(t => canonic(t) === x);
  const sense = l => l.filter(t => canonic(t) !== x);
  if (te) return { album: sense(a), edicio: sense(e) };
  return x.nivell === 'album' ? { album: [...sense(a), x.nom], edicio: sense(e) } : { album: sense(a), edicio: [...sense(e), x.nom] };
}
// Veu i Estació: tocar el valor que ja hi és el treu; tocar-ne un altre el substitueix.
export function posaValor(albumTags, tag, valor) {
  const a = (albumTags || []).filter(t => valorDe(t, tag) === null);
  const ara = (albumTags || []).map(t => valorDe(t, tag)).find(Boolean);
  return ara === valor ? a : [...a, `${tag.nom}: ${valor}`];
}
// Idioma: cada toc posa o treu aquell idioma; els altres es queden.
export function commutaIdioma(albumTags, idioma) {
  const l = albumTags || [], ja = l.some(t => valorDe(t, IDIOMA) === idioma);
  return ja ? l.filter(t => valorDe(t, IDIOMA) !== idioma) : [...l, `${IDIOMA.nom}: ${idioma}`];
}

// La migració dels tags de la llavor: noms complets, i els d'àlbum, a l'àlbum.
export function normalitza(albumTags, edicioTags) {
  let album = [], edicio = [];
  for (const [t, d] of [...(albumTags || []).map(t => [t, 'a']), ...(edicioTags || []).map(t => [t, 'e'])]) {
    const x = canonic(t);
    if (x) { (x.nivell === 'album' ? album : edicio).push(x.nom); continue; }
    if (AMB_VALOR.some(tag => valorDe(t, tag) !== null)) { album.push(t); continue; }
    (d === 'a' ? album : edicio).push(t);   // el que no es reconeix es queda on era: no s'esborra res
  }
  return { album: [...new Set(album)], edicio: [...new Set(edicio)] };
}
