// La foto de l'arxiu sintètic amb l'estructura d'ara i les escoltes calculades amb el codi d'ara (ACT-750 d).
// La comprovació «marca del càlcul (ACT-750 d)» la migra a l'estructura que hi hagi en cada construcció i ho torna a
// calcular tot: si surt diferent i CALCUL no ha pujat, falla. Per això, la foto es torna a fer DESPRÉS de publicar cada
// estructura nova (node proves/foto-estructura.mjs), i es puja amb ella. No té cap dada real: és l'arxiu sintètic del banc
// amb les seves pistes, totes d'abans del 2 d'octubre de 2026, perquè cap finestra de temps de les regles (7 dies, 24 hores)
// no faci canviar el càlcul segons el dia que es passi el banc.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ARREL, arxiu, escoltesLB, motor } from './fixture.mjs';

export const FOTO = path.join(ARREL, 'proves/foto-estructura.sqlite');
const ARA = Date.parse('2026-10-01T20:00:00Z');

export async function fesFoto() {
  const S = await motor();
  const E = await import(pathToFileURL(path.join(ARREL, 'js/escoltes.js')).href + '?v=14');
  const db = new S.Database(await arxiu(ARA));
  const m = 60e3, t0 = ARA - 6 * 3600e3;
  const lb = [...escoltesLB(ARA)].map(x => ({ compte: x.compte, listened_at: new Date(x.listened_at * 1000).toISOString(), artista: x.track_metadata.artist_name,
    pista: x.track_metadata.track_name, album: x.track_metadata.release_name, duration_ms: x.track_metadata.additional_info?.duration_ms || null,
    recording_msid: x.recording_msid, release_mbid: null, caa_release_mbid: null }));
  // el grup Careful Now + Unmasked seguit, i un disc a mitges que es reprèn l'endemà (trossos)
  const p = (t, msid, artista, pista, album, min) => ({ compte: 'crimsonnnn', listened_at: new Date(t).toISOString(), artista, pista, album,
    duration_ms: min * m, recording_msid: msid, release_mbid: null, caa_release_mbid: null });
  lb.push(p(t0, 'msid-foto-cn1', 'James Murray', 'Careful Now', 'Careful Now', 52), p(t0 + 52 * m, 'msid-foto-cn2', 'James Murray', 'Unmasked', 'Careful Now (Unmasked)', 48),
    p(ARA - 3 * 864e5, 'msid-foto-inf1', 'Phase90', 'Infinitati I', 'Infinitati', 20), p(ARA - 2 * 864e5, 'msid-foto-inf2', 'Phase90', 'Infinitati II', 'Infinitati', 21));
  db.run('SAVEPOINT f');
  db.run(`UPDATE edicio SET emparellaments = CASE id WHEN 2 THEN '["Careful Now"]' WHEN 3 THEN '["Careful Now (Unmasked)"]' WHEN 6 THEN '["Infinitati"]' END WHERE id IN (2, 3, 6)`);
  E.desaScrobbles(lb)(db);
  const ids = db.exec("SELECT id FROM scrobble WHERE artista NOT LIKE 'Beck%'")[0].values.map(v => v[0]);
  E.contesta(ids, 'A casa', 'Despert')(db);
  E.recalcula(db);
  db.run('RELEASE f');
  const bytes = db.export(); db.close();
  return bytes;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const b = await fesFoto();
  fs.writeFileSync(FOTO, b);
  console.log(`Foto feta: ${path.relative(ARREL, FOTO)} · ${(b.length / 1024).toFixed(0)} KB`);
}
