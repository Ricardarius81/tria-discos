// La llavor: el que entra a l'arxiu des del «car pendent» del 22-10-2026 (Pla de projecte, tram 2).
// Revisada i aprovada per Ricard línia a línia el 24 i el 26-10-2026. Res d'aquí és deduït:
// cada durada, canal i «proper» és seu o surt d'una font verificada (els codis de Bandcamp, llegits l'11-10).
// Es carrega UNA sola vegada: la clau 'llavor' de meta ho impedeix una segona.

export const LOT = 'LLAVOR-CP-2026-10-22';

// ── Artistes ──
// persona: només quan dues fitxes són el mateix músic (§7.6). Slow Reels queda sense persona
// a propòsit (decisió de Ricard, 26-10): són dues persones i el camp només n'admet una.
export const ARTISTES = [
  { nom: 'Jon Anderson' },
  { nom: 'Phase90' },
  { nom: 'Peter Hammill' },
  { nom: 'Keller Quartet', variants: ['Bartók'] },
  { nom: 'Fish' },
  { nom: 'Roger Mas' },
  { nom: 'Ludwig Göransson', variants: ['Ludwig Goransson'] },
  { nom: 'Marillion' },
  { nom: 'Glenn Gould', variants: ['Gould'] },
  { nom: 'Rafael Anton Irisarri' },
  { nom: 'Slow Reels', variants: ['Slow Reels (Ian Hawgood + James Murray)'] },
  { nom: 'Jordi Savall', variants: ['Savall'] },
  { nom: 'The Mothers of Invention', variants: ['Frank Zappa & The Mothers of Invention', 'Frank Zappa & The Mothers'], persona: 'Frank Zappa' },
  { nom: 'Bvdub', variants: ['BVDUB'] },
  { nom: 'Sarah Davachi' },
  { nom: 'Deepspace' },
  { nom: 'D York', variants: ['d york'] },
  { nom: 'theAdelaidean' },
  { nom: 'Chris Zabriskie' },
  { nom: 'Deaf Center' },
  { nom: 'Bob Dylan' },
  { nom: 'The Inward Circles', persona: 'Richard Skelton' },
  { nom: 'Øystein Skar', variants: ['Oystein Skar'] },
  { nom: 'Tom Leclerc' },
  { nom: 'Outkast', variants: ['OUTKAST'] },
  { nom: 'Weezer' },
  { nom: 'James Murray', variants: ['JAMES MURRAY'] },
  // preferents sense disc en rotació
  { nom: 'Miles Davis' }, { nom: 'John Coltrane' }, { nom: 'Weather Report' },
  { nom: 'Lana Del Rey' }, { nom: 'Federico Durand' },
  { nom: 'Brian Eno' }, { nom: 'Joni Mitchell' }, { nom: 'Steve Roach' }, { nom: 'Max Richter' },
  { nom: 'Biosphere' }, { nom: 'Sigur Rós', variants: ['SIGUR ROS'] }, { nom: 'Grouper' }, { nom: 'Mount Eerie' },
  { nom: 'Will Johnson' }, { nom: 'Sun Kil Moon' }, { nom: 'Father John Misty' }, { nom: 'Devin Townsend' },
  { nom: 'Tinariwen' }, { nom: 'Burial' }, { nom: 'Villagers' }, { nom: 'Al Tall' }, { nom: 'Peter Gabriel' },
  { nom: 'Summer Heart' }, { nom: 'Bill Callahan', variants: ['BILL CALAHAN'] }, { nom: 'Ian Hawgood' },
  { nom: 'Pearl Jam' }, { nom: 'Foo Fighters' }, { nom: 'Elliott Smith' }, { nom: 'Björk', variants: ['BJORK'] },
  { nom: 'zakè', variants: ['ZAKÈ'] }, { nom: 'Richard Skelton', persona: 'Richard Skelton' }, { nom: 'Yann Novak' },
  { nom: 'Joachim Spieth' }, { nom: 'Benoît Pioulard', variants: ['BENOIT PIOULARD'] }, { nom: 'Lambchop' },
  { nom: 'Wilco' }, { nom: 'Michael Jackson' }, { nom: 'Dinosaur Jr.' }, { nom: 'Crippled Black Phoenix' }
];

// ── Discos en rotació, en l'ordre del «car pendent» (el més antic primer) ──
// L'ordre inicial del Faristol és aquest al revés: sense escoltes ni obertures, mana l'ordre de càrrega (v1.40).
// canal: amazon · bandcamp · youtube · aimp. bc: codi de Bandcamp, llegit l'11-10-2026 (§3.1, A.53).
// conjunt/posicio: el grup del §7.5. Es desa ara, però fins al tram 6 el Faristol els ensenya solts.
export const ROTACIO = [
  { art: 'Jon Anderson', tit: 'Animation', min: 57, canal: 'aimp' },
  { art: 'Phase90', tit: 'Infinitati (Variant Immersions)', min: 138, canal: 'aimp', conjunt: 'Infinitati', posicio: 3,
    nota: 'Durada llegida per Ricard a AIMP (26-10). La línia del «car pendent» deia 210′ per als tres discos; les tres d\'AIMP sumen 269′.' },
  { art: 'Phase90', tit: 'Infinitati (Intrusion Dubs)', min: 73, canal: 'aimp', conjunt: 'Infinitati', posicio: 2 },
  { art: 'Phase90', tit: 'Infinitati', min: 58, canal: 'aimp', conjunt: 'Infinitati', posicio: 1, bc: '3428588828' },
  { art: 'Peter Hammill', tit: 'Patience', min: 40, canal: 'amazon' },
  { art: 'Keller Quartet', tit: 'Bartók: The 6 String Quartets', min: 149, canal: 'amazon', compositors: ['Béla Bartók'] },
  { art: 'Fish', tit: 'Weltschmerz', min: 84, canal: 'amazon' },
  { art: 'Roger Mas', tit: 'Parnàs', min: 43, canal: 'amazon' },
  { art: 'Ludwig Göransson', tit: 'The Odyssey (Original Motion Picture Soundtrack)', min: 118, canal: 'amazon' },
  { art: 'Marillion', tit: 'Anoraknophobia', min: 63, canal: 'amazon' },
  // La integral de Gould no entra: el port de càrrega exigeix les 81 durades de part (§3.2, v1.29).
  // Les Suites franceses entren soltes; la integral, amb la col·lecció física (P-01, decisió de Ricard, 26-10).
  { art: 'Glenn Gould', tit: 'Bach: The French Suites', min: 39, canal: 'amazon', compositors: ['Johann Sebastian Bach'] },
  // Una sola edició en rotació; les escoltes de l'original s'hi apunten pels emparellaments (decisió de Ricard, 24-10).
  { art: 'Rafael Anton Irisarri', tit: 'The North Bend', edicio: '10th Anniversary Edition', min: 40, canal: 'amazon',
    bc: '2047526199', emparellaments: ['The North Bend', 'The North Bend (10th Anniversary Edition)'] },
  { art: 'Slow Reels', tit: 'Everyday Exotic', min: 39, canal: 'bandcamp', bc: '1646776080' },
  { art: 'Jordi Savall', tit: 'Schumann: Das Paradies und die Peri', min: 99, canal: 'amazon', compositors: ['Robert Schumann'] },
  { art: 'The Mothers of Invention', tit: 'Weasels Ripped My Flesh', min: 40, canal: 'amazon' },
  { art: 'Bvdub', tit: 'Wrath and Apathy', min: 76, canal: 'amazon', bc: '2082848946' },
  { art: 'Sarah Davachi', tit: 'The Will of Tongues', min: 139, canal: 'amazon', bc: '1798022475', tags: ['bon equip'] },
  { art: 'Deepspace', tit: 'The Atlas Sector', min: 96, canal: 'bandcamp', bc: '295441197', tags: ['apte acompanyat'] },
  // Un disc en cinc parts (§8.4); la part viva és la 1. La durada total és la suma de les cinc.
  { art: 'D York', tit: 'The Italian Chronicles', min: 331, canal: 'bandcamp', tags: ['apte dormir'],
    parts: [['Vol. 1', 112, '1619048694'], ['Vol. 2', 56], ['Vol. 3', 61], ['Vol. 4', 50], ['Vol. 5', 52]], partViva: 1 },
  { art: 'theAdelaidean', tit: 'Airward', min: 55, canal: 'bandcamp', bc: '847531634', tags: ['apte dormir'] },
  { art: 'Chris Zabriskie', tit: 'I Want You To Think About Me', min: 53, canal: 'amazon', bc: '2842653166' },
  { art: 'Deaf Center', tit: 'Reverie', min: 34, canal: 'bandcamp', bc: '2429362044' },
  { art: 'Bob Dylan', tit: 'Under the Red Sky', min: 35, canal: 'amazon' },
  { art: 'The Inward Circles', tit: 'I Have Heard a Music and It Is Delirious', min: 19, canal: 'amazon', bc: '252589909' },
  { art: 'Øystein Skar', tit: 'Hem', min: 37, canal: 'bandcamp' },
  { art: 'Tom Leclerc', tit: 'A Brief Story of Slowness', min: 34, canal: 'bandcamp', bc: '3867378599' },
  // Un àlbum amb dues edicions; en rotació, només la 25th Anniversary (decisió de Ricard, v1.38).
  { art: 'Outkast', tit: 'Stankonia', edicio: 'Deluxe Edition', min: 98, canal: 'amazon', foraDeRotacio: true },
  { art: 'Outkast', tit: 'Stankonia', edicio: '25th Anniversary Edition', min: 112, canal: 'amazon' },
  { art: 'Weezer', tit: 'Weezer (Blue Album)', min: 41, canal: 'amazon' },
  { art: 'James Murray', tit: 'Careful Now Unmasked', min: 36, canal: 'bandcamp', conjunt: 'Careful Now', posicio: 2 },
  { art: 'James Murray', tit: 'Careful Now', min: 39, canal: 'bandcamp', conjunt: 'Careful Now', posicio: 1 }
];

// ── Artistes Preferents, en ordre (decisió de Ricard, 24-10) ──
// [nom, «proper» o null]. Els tres segells del «car pendent» no hi són i s'ignoren sempre (decisió de Ricard, 24-10).
// James Murray no porta «proper»: el seu disc ja és a la rotació, i el «proper» s'esborra quan n'hi entra un (§7.7).
export const PREFERENTS = [
  ['Miles Davis', null], ['John Coltrane', null], ['Weather Report', null],
  ['Lana Del Rey', null], ['Outkast', null], ['Federico Durand', null],
  ['Brian Eno', null], ['Glenn Gould', null], ['Joni Mitchell', null], ['Steve Roach', null], ['Peter Hammill', null],
  ['Max Richter', null], ['Biosphere', "Angel's Flight"], ['Sigur Rós', null], ['Grouper', null], ['Mount Eerie', null],
  ['Will Johnson', null], ['Bob Dylan', null], ['Sun Kil Moon', null], ['Father John Misty', null], ['Devin Townsend', null],
  ['Tinariwen', null], ['Burial', null], ['Villagers', null], ['Al Tall', null], ['Peter Gabriel', null], ['Bvdub', null],
  ['Summer Heart', null], ['Bill Callahan', null], ['Ian Hawgood', 'Mono Sleep Patterns'], ['James Murray', null],
  ['Jon Anderson', null], ['Pearl Jam', 'Vitalogy'], ['Foo Fighters', 'Foo Fighters'],
  ['Elliott Smith', 'From a Basement on the Hill'], ['Björk', 'Telegram'], ['zakè', null], ['Richard Skelton', null],
  ['Yann Novak', null], ['Joachim Spieth', null], ['Benoît Pioulard', null], ['Lambchop', 'Mr. M'],
  ['Wilco', 'The Whole Love (Deluxe Edition 2025)'], ['Michael Jackson', 'Thriller'],
  ['Dinosaur Jr.', "You're Living All Over Me"], ['Crippled Black Phoenix', null]
];

// ── L'Aparador: encara no té on desar-se (tram 5). Queda escrit aquí i entra aleshores. ──
export const APARADOR = { 'Gimnàs': [['The Prodigy', 'The Fat of the Land']], 'Avió/Tren/Bus': [], 'Cotxe': [] };

const json = v => (v == null ? null : JSON.stringify(v));

// Comprova la llavor abans de tocar res: cap error de dades arriba a l'arxiu.
export function comprova() {
  const errors = [];
  const noms = new Set();
  for (const a of ARTISTES) { if (noms.has(a.nom)) errors.push('Artista repetit: ' + a.nom); noms.add(a.nom); }
  for (const d of ROTACIO) {
    if (!noms.has(d.art)) errors.push('Disc sense artista al catàleg: ' + d.art + ' — ' + d.tit);
    if (!(Number.isInteger(d.min) && d.min > 0)) errors.push('Disc sense durada: ' + d.tit);
    if (!['amazon', 'bandcamp', 'youtube', 'aimp'].includes(d.canal)) errors.push('Canal desconegut: ' + d.tit);
    if (d.parts && d.parts.reduce((s, p) => s + p[1], 0) !== d.min) errors.push('Les parts no sumen la durada total: ' + d.tit);
  }
  const pref = new Set();
  for (const [n] of PREFERENTS) {
    if (!noms.has(n)) errors.push('Preferent sense artista al catàleg: ' + n);
    if (pref.has(n)) errors.push('Preferent repetit: ' + n);
    pref.add(n);
  }
  return errors;
}

// Escriu la llavor dins una transacció: o entra tota, o no entra res.
export function carrega(db, ara = new Date().toISOString()) {
  const errors = comprova();
  if (errors.length) throw new Error('La llavor té errors i no s\'ha carregat:\n' + errors.join('\n'));
  if (db.exec("SELECT valor FROM meta WHERE clau = 'llavor'")[0]) throw new Error('La llavor ja es va carregar. No es carrega dues vegades.');
  const ple = ['artista', 'album', 'edicio', 'preferent'].filter(t => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0] > 0);
  if (ple.length) throw new Error('L\'arxiu ja té dades (' + ple.join(', ') + '). La llavor només entra en un arxiu buit.');

  const id = {};
  const val = sql => db.exec(sql)[0].values[0][0];
  db.exec('BEGIN');
  try {
    for (const a of ARTISTES) {
      db.run('INSERT INTO artista (nom_canonic, variants, persona) VALUES (?, ?, ?)', [a.nom, json(a.variants), a.persona || null]);
      id[a.nom] = val('SELECT last_insert_rowid()');
    }
    const albums = {};
    let edicions = 0, parts = 0;
    for (const d of ROTACIO) {
      const clau = d.art + '|' + d.tit;
      if (!albums[clau]) {
        db.run('INSERT INTO album (titol, artista_id, compositors, conjunt, posicio) VALUES (?, ?, ?, ?, ?)',
          [d.tit, id[d.art], json(d.compositors), d.conjunt || null, d.posicio || null]);
        albums[clau] = val('SELECT last_insert_rowid()');
      }
      const enRot = d.foraDeRotacio ? 0 : 1;
      db.run(`INSERT INTO edicio (album_id, nom_edicio, durada_total, rotacio_actual, app_escolta, codi_bandcamp,
                tags, emparellaments, data_referencia_rotacio, lot_carrega)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [albums[clau], d.edicio || null, d.min, enRot, d.canal, d.parts ? null : (d.bc || null),
         json(d.tags), json(d.emparellaments), enRot ? ara : null, LOT]);
      const edId = val('SELECT last_insert_rowid()');
      edicions++;
      (d.parts || []).forEach(([nom, min, bc], i) => {
        db.run('INSERT INTO part (edicio_id, numero, nom, durada, rotacio_actual, codi_bandcamp) VALUES (?, ?, ?, ?, ?, ?)',
          [edId, i + 1, nom, min, i + 1 === d.partViva ? 1 : 0, bc || null]);
        parts++;
      });
    }
    PREFERENTS.forEach(([n, proper], i) =>
      db.run('INSERT INTO preferent (artista_id, ordre, proper_titol) VALUES (?, ?, ?)', [id[n], i + 1, proper]));
    db.run('INSERT INTO meta (clau, valor) VALUES (?, ?)', ['llavor', JSON.stringify({
      lot: LOT, data: ara, artistes: ARTISTES.length, albums: Object.keys(albums).length, edicions, parts, preferents: PREFERENTS.length })]);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// El que ha entrat, tal com ho veurà el Faristol: el més recent de la llista, primer.
export function resum(db) {
  const files = db.exec(`
    SELECT a.titol, ar.nom_canonic, e.nom_edicio, e.durada_total, e.app_escolta,
           (SELECT nom FROM part p WHERE p.edicio_id = e.id AND p.rotacio_actual = 1) AS part_viva,
           (SELECT COUNT(*) FROM part p WHERE p.edicio_id = e.id) AS n_parts, a.conjunt
    FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id
    WHERE e.rotacio_actual = 1 ORDER BY e.id DESC`)[0]?.values || [];
  const pref = db.exec(`
    SELECT ar.nom_canonic, p.proper_titol FROM preferent p JOIN artista ar ON ar.id = p.artista_id ORDER BY p.ordre`)[0]?.values || [];
  return {
    rotacio: files.map(([tit, art, ed, min, canal, viva, nParts, conjunt]) => ({ tit, art, ed, min, canal, viva, nParts, conjunt })),
    preferents: pref.map(([nom, proper]) => ({ nom, proper }))
  };
}
