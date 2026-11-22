// Els resums desats a la seva fitxa (obra II, v1.57, ACT-841 4; estructura 14).
// Avui unes quantes coses es dedueixen de les pistes (Scrobble): el release de MusicBrainz d'una edició (Info i el segell),
// l'última pista que ha sonat d'una edició (l'ordre de Discos en Rotació) i l'última escolta i el mosaic de portades de
// cada Llista de reproducció. Quan les pistes de més de 12 mesos surtin al fitxer del seu any (ACT-838), es perdrien.
// desaResums les guarda a la fitxa; s'ha de cridar abans de treure pistes de l'arxiu principal (obra III). Mai fa baixar
// res: l'última pista i l'última escolta es queden amb la més recent entre la desada i la de les pistes; el release, el de
// la pista més recent que en porti, si n'hi ha cap; les portades, les de les pistes primer i després les desades, fins a 4.
// Camps: Edició.release_mbid, Edició.darrer_scrobble, Llista.darrera_escolta, Llista.portades; Scrobble.listened_at,
// Scrobble.caa_release_mbid, Scrobble.escolta_id, Scrobble.llista_id.
const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
export const MAX_PORTADES = 4;
const llistaDe = j => { try { const v = JSON.parse(j || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
// Les portades d'una Llista: primer les vives (de les pistes), després les desades, sense repetir, fins a 4.
export const unePortades = (vives, desades) => [...new Set([...vives, ...llistaDe(desades)])].slice(0, MAX_PORTADES);

// Les portades vives d'una Llista: les de les pistes que han sonat amb ella, la més recent primer, de cançons que encara hi són.
export const portadesVives = (db, id) => files(db, `SELECT s.caa_release_mbid AS m, MAX(s.listened_at) AS t FROM scrobble s
                    WHERE s.llista_id = ? AND s.caa_release_mbid IS NOT NULL
                      AND s.recording_msid IN (SELECT recording_msid FROM llista_canco WHERE llista_id = ?)
                    GROUP BY s.caa_release_mbid ORDER BY t DESC LIMIT ${MAX_PORTADES}`, [id, id]).map(r => 'release/' + r.m);

export function desaResums(db) {
  for (const r of files(db, `SELECT x.edicio_id AS id, MAX(p.listened_at) AS t FROM scrobble p JOIN escolta x ON x.id = p.escolta_id GROUP BY x.edicio_id`))
    db.run("UPDATE edicio SET darrer_scrobble = ? WHERE id = ? AND COALESCE(darrer_scrobble, '') < ?", [r.t, r.id, r.t]);
  for (const r of files(db, `SELECT x.edicio_id AS id, p.caa_release_mbid AS m, MAX(p.listened_at) AS t FROM scrobble p JOIN escolta x ON x.id = p.escolta_id
                             WHERE p.caa_release_mbid IS NOT NULL GROUP BY x.edicio_id`))
    db.run('UPDATE edicio SET release_mbid = ? WHERE id = ?', [r.m, r.id]);
  for (const l of files(db, 'SELECT id, darrera_escolta, portades FROM llista')) {
    const t = files(db, 'SELECT MAX(listened_at) AS t FROM scrobble WHERE llista_id = ?', [l.id])[0]?.t || null;
    const darrera = [l.darrera_escolta, t].filter(Boolean).sort().pop() || null;
    const p = unePortades(portadesVives(db, l.id), l.portades);
    db.run('UPDATE llista SET darrera_escolta = ?, portades = ? WHERE id = ?', [darrera, p.length ? JSON.stringify(p) : null, l.id]);
  }
}
