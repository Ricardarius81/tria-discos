// La lectura de ListenBrainz (§3.3, ACT-452 a ACT-454): les dues comptes, per l'API pública, sense contrasenya,
// des de l'Arrencada de les escoltes (o des de l'últim scrobble ja llegit de cada compte, si és més recent).
// No escriu a l'arxiu: torna les pistes en la forma de la taula scrobble, i qui crida les desa.

const API = 'https://api.listenbrainz.org/1/user/';
const PER_CRIDA = 1000;          // el màxim que admet l'API
const MAX_CRIDES = 30;           // fre: 30.000 pistes en una sola lectura vol dir que alguna cosa no va

// Una pista de ListenBrainz → una fila de scrobble.
export function aScrobble(compte, l) {
  const m = l.track_metadata || {}, info = m.additional_info || {}, map = m.mbid_mapping || {};
  const dur = info.duration_ms ?? (info.duration != null ? info.duration * 1000 : null);
  return {
    compte,
    listened_at: new Date(l.listened_at * 1000).toISOString(),
    artista: m.artist_name ?? null,
    pista: m.track_name ?? null,
    album: m.release_name || null,
    duration_ms: Number.isFinite(+dur) && +dur > 0 ? Math.round(+dur) : null,
    recording_msid: l.recording_msid || info.recording_msid || ('sense-msid:' + l.listened_at + ':' + (m.track_name || '')),
    release_mbid: map.release_mbid || info.release_mbid || null,
    caa_release_mbid: map.caa_release_mbid || null
  };
}

// Llegeix una compte des de `desDe` (ISO, exclusiu). Va avançant pel temps fins que no n'hi ha més.
export async function llegeixCompte(compte, desDe, { fetch: f = fetch } = {}) {
  let min = Math.floor(Date.parse(desDe) / 1000);
  const out = [];
  for (let i = 0; i < MAX_CRIDES; i++) {
    const r = await f(`${API}${encodeURIComponent(compte)}/listens?min_ts=${min}&count=${PER_CRIDA}`);
    if (!r.ok) throw new Error(`ListenBrainz ${r.status} (${compte})`);
    const l = (await r.json())?.payload?.listens || [];
    if (!l.length) break;
    out.push(...l.map(x => aScrobble(compte, x)));
    const mx = Math.max(...l.map(x => x.listened_at));
    if (l.length < PER_CRIDA || mx <= min) break;
    min = mx;
  }
  return out;
}
