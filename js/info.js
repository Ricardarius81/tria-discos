// Obra E (ACT-815, 6): el botó «Info» de la fitxa. Fitxer nou (ACT-756).
//  · A: enllaços a MusicBrainz (l'edició emparellada si se'n sap, o una cerca), Discogs, Wikipedia, RateYourMusic i AllMusic.
//  · B: una fitxa pintada a l'app amb el resum de la Wikipedia SEMPRE EN ANGLÈS i sense traduir, i la data, el segell i les
//    pistes de MusicBrainz, desada per veure-la sense connexió i amb l'enllaç a la Wikipedia.
// On es desa (decisió de construcció de Claude, per ratificar): a l'arxiu, taula meta, una fila per àlbum («info:A12»), com
// les nits de Bandcamp. Va amb l'arxiu i passa d'un mòbil a l'altre; el resum es talla a 3.000 caràcters perquè la fila
// càpiga a l'Excel de la còpia (32.767 per cel·la). Cap estructura nova. Camps: Àlbum.Títol, Artista.Nom canònic,
// Scrobble.caa_release_mbid (l'edició emparellada, si alguna escolta la porta).
const WP = 'https://en.wikipedia.org/w/api.php', MB = 'https://musicbrainz.org/ws/2';
const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const r = [];
  while (st.step()) r.push(st.getAsObject());
  st.free(); return r;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const CLAU = id => 'info:A' + id;
const MAX_RESUM = 3000;

// L'edició de MusicBrainz que porten les escoltes d'aquest àlbum (la més recent), si n'hi ha.
export const releaseDeLAlbum = (db, albumId) => un(db, `SELECT p.caa_release_mbid AS m FROM scrobble p JOIN escolta x ON x.id = p.escolta_id
  JOIN edicio e ON e.id = x.edicio_id WHERE e.album_id = ? AND p.caa_release_mbid IS NOT NULL ORDER BY p.listened_at DESC LIMIT 1`, [albumId])?.m
  || un(db, `SELECT release_mbid AS m FROM edicio WHERE album_id = ? AND release_mbid IS NOT NULL
             ORDER BY COALESCE(darrer_scrobble, '') DESC LIMIT 1`, [albumId])?.m || null;   // ACT-841 (4): el desat a la fitxa

// A: els enllaços.
export function enllacos({ art, titol, release = null }) {
  const q = encodeURIComponent(art + ' ' + titol);
  return [
    { nom: 'MusicBrainz', url: release ? `https://musicbrainz.org/release/${release}` : `https://musicbrainz.org/search?query=${encodeURIComponent(`release:"${titol}" AND artist:"${art}"`)}&type=release&method=advanced`, nota: release ? 'l\'edició de les teves escoltes' : 'cerca' },
    { nom: 'Discogs', url: `https://www.discogs.com/search/?q=${q}&type=all`, nota: 'cerca' },
    { nom: 'Wikipedia', url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(`${titol} ${art} album`)}`, nota: 'cerca, en anglès' },
    { nom: 'RateYourMusic', url: `https://rateyourmusic.com/search?searchterm=${q}&searchtype=l`, nota: 'cerca' },
    { nom: 'AllMusic', url: `https://www.allmusic.com/search/albums/${q}`, nota: 'cerca' },
  ];
}

export const desada = (db, albumId) => { try { return JSON.parse(un(db, 'SELECT valor FROM meta WHERE clau = ?', [CLAU(albumId)])?.valor || 'null'); } catch { return null; } };
export const desa = (albumId, info) => db => db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [CLAU(albumId), JSON.stringify(info)]);

async function json(u) { const r = await fetch(u, { headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
const espera = ms => new Promise(f => setTimeout(f, ms));

// B: la fitxa. Wikipedia: la pàgina de l'àlbum (cerca «títol artista album», i una pàgina que porta el títol); el resum,
// la introducció en text pla, en anglès. MusicBrainz: l'edició emparellada o la primera de la cerca amb el mateix títol.
// Torna { wiki: { titol, resum, url } | null, mb: { release, data, segell, pistes: [{ n, titol, min }] } | null, quan }.
export async function busca({ art, titol, release = null }) {
  const out = { wiki: null, mb: null, quan: new Date().toISOString() };
  try {
    const s = await json(`${WP}?action=query&list=search&srsearch=${encodeURIComponent(`${titol} ${art} album`)}&srlimit=5&srprop=&format=json&formatversion=2&origin=*`);
    const pag = (s.query?.search || []).map(x => x.title).find(t => norm(t).includes(norm(titol)));
    if (pag) {
      const e = await json(`${WP}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(pag)}&format=json&formatversion=2&origin=*`);
      const p = (e.query?.pages || [])[0];
      if (p?.extract) out.wiki = { titol: p.title || pag, resum: String(p.extract).slice(0, MAX_RESUM), url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(p.title || pag).replace(/ /g, '_')) };
    }
  } catch {}
  try {
    let id = release;
    if (!id) {
      const q = `release:"${String(titol).replace(/"/g, '')}" AND artist:"${String(art).replace(/"/g, '')}"`;
      const r = await json(`${MB}/release/?query=${encodeURIComponent(q)}&fmt=json&limit=5`);
      id = ((r.releases || []).find(x => norm(x.title) === norm(titol)) || {}).id || null;
      if (id) await espera(1100);
    }
    if (id) {
      const d = await json(`${MB}/release/${id}?inc=recordings+labels&fmt=json`);
      const pistes = (d.media || []).flatMap(m => m.tracks || []).map((t, i) => ({ n: i + 1, titol: t.title, min: t.length ? Math.round(t.length / 6000) / 10 : null }));
      const li = (d['label-info'] || [])[0];
      out.mb = { release: id, data: d.date || null, segell: li?.label?.name || null, cataleg: li?.['catalog-number'] || null, pistes };
    }
  } catch {}
  return out;
}
