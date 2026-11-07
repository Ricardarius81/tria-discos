// L'estructura de l'arxiu (Pla de projecte, §8.3).
// Cada migració porta l'arxiu d'una versió a la següent i no es toca mai un cop publicada:
// si cal canviar alguna cosa, s'afegeix una migració nova al final.
// Les llistes es desen com a text JSON. Les dates, com a text ISO 8601 en UTC.

export const MIGRACIONS = [
  // v1 · el model del §8.3 que fa servir el Faristol mínim (v1.33-v1.37)
  `
  CREATE TABLE meta (clau TEXT PRIMARY KEY, valor TEXT);

  CREATE TABLE artista (
    id            INTEGER PRIMARY KEY,
    nom_canonic   TEXT NOT NULL,
    variants      TEXT,               -- llista
    persona       TEXT,
    retrat        TEXT                -- referència de la foto (§8.3, v1.33)
  );

  CREATE TABLE album (
    id                      INTEGER PRIMARY KEY,
    titol                   TEXT NOT NULL,
    artista_id              INTEGER NOT NULL REFERENCES artista(id),
    compositors             TEXT,     -- llista
    any_original            INTEGER,
    generes                 TEXT,     -- llista ordenada de branques
    llenguatge              TEXT,     -- llista, només clàssica
    formacio                TEXT,     -- llista, només clàssica
    instrument_solista      TEXT,
    conjunt                 TEXT,
    posicio                 INTEGER,
    tags                    TEXT,     -- llista: tags de propietat d'àlbum
    caracter_1              TEXT,
    caracter_2              TEXT,
    anys_quarantena         INTEGER NOT NULL DEFAULT 5,
    suggeriments_descartats TEXT      -- llista
  );

  CREATE TABLE edicio (
    id                              INTEGER PRIMARY KEY,
    album_id                        INTEGER NOT NULL REFERENCES album(id),
    nom_edicio                      TEXT,
    durada_total                    INTEGER NOT NULL CHECK (durada_total > 0), -- minuts enters, arrodonits
    any_edicio                      INTEGER,
    segell                          TEXT,
    codis_cataleg                   TEXT,     -- llista
    productor                       TEXT,
    formats                         TEXT,     -- llista: CD, CD 5.1, SACD, vinil, digital, streaming, DVD-Blu-Ray
    procedencia                     TEXT,
    estat_estrena                   TEXT NOT NULL DEFAULT 'Escoltada',
    tags                            TEXT,     -- llista: tags de propietat d'edició
    rotacio_actual                  INTEGER NOT NULL DEFAULT 0,
    darrera_obertura                TEXT,     -- §8.3, v1.37
    enllac_bandcamp                 TEXT,
    codi_bandcamp                   TEXT,     -- §8.3, v1.34
    app_escolta                     TEXT,     -- §8.3, v1.34
    portada                         TEXT,     -- §8.3, v1.33
    data_primera_escolta            TEXT,
    emparellaments                  TEXT,     -- llista de release_name confirmats (§8.8)
    data_referencia_rotacio         TEXT,
    data_darrera_pregunta_puntuacio TEXT,
    suggeriments_descartats         TEXT,
    lot_carrega                     TEXT
  );

  CREATE TABLE puntuacio (            -- historial complet, no només el valor actual
    id        INTEGER PRIMARY KEY,
    edicio_id INTEGER NOT NULL REFERENCES edicio(id),
    valor     INTEGER NOT NULL CHECK (valor BETWEEN 0 AND 5),
    data      TEXT NOT NULL
  );

  CREATE TABLE part (
    id                  INTEGER PRIMARY KEY,
    edicio_id           INTEGER NOT NULL REFERENCES edicio(id),
    numero              INTEGER NOT NULL,
    nom                 TEXT,
    durada              INTEGER,          -- no obligatòria (v1.26)
    data_darrera_escolta TEXT,
    rotacio_actual      INTEGER NOT NULL DEFAULT 0,
    codi_bandcamp       TEXT,             -- v1.35
    UNIQUE (edicio_id, numero)
  );

  CREATE TABLE escolta (
    id            INTEGER PRIMARY KEY,
    edicio_id     INTEGER NOT NULL REFERENCES edicio(id),
    part_id       INTEGER REFERENCES part(id),
    data_hora     TEXT NOT NULL,
    canal         TEXT,                   -- App, CD, vinil, DVD-Blu-Ray
    context       TEXT,
    atencio       TEXT,
    completitud   REAL,
    compte        TEXT,                   -- compte de ListenBrainz
    recording_msid TEXT
  );

  CREATE TABLE preferent (
    id                INTEGER PRIMARY KEY,
    artista_id        INTEGER NOT NULL UNIQUE REFERENCES artista(id),
    ordre             INTEGER NOT NULL,
    proper_edicio_id  INTEGER REFERENCES edicio(id),  -- v1.34
    edicio_actual_id  INTEGER REFERENCES edicio(id),  -- congelat (v1.33)
    direccio          TEXT                            -- congelat (v1.33)
  );

  CREATE INDEX escolta_edicio ON escolta(edicio_id, data_hora);
  CREATE INDEX edicio_album ON edicio(album_id);
  CREATE INDEX album_artista ON album(artista_id);
  `,
  // v2 · el «proper disc» d'un preferent és només un títol, sense fitxa ni durada (§7.7, v1.34).
  // La v1 el feia apuntar a una edició, i tota edició exigeix durada: cap «proper» no s'hauria pogut desar.
  // preferent.proper_edicio_id es queda sense ús, com els camps congelats de la v1.33.
  `
  ALTER TABLE preferent ADD COLUMN proper_titol TEXT;
  `,
  // v3 · d'on ve la imatge (bloc 3.2, decisió de Ricard del 30-10). La marca «endevinada» que es va aprovar
  // es desa com a origen, perquè «No és aquesta» també s'ha de recordar: si no, la sonda tornaria a posar la mateixa.
  //   edicio.portada_origen: 'sonda' (endevinada pel títol) · 'rebutjada' (Ricard ha dit «No és aquesta»)
  //                          · 'escolta' (arribarà amb el scrobble, bloc 3.3, i mana sobre la sonda)
  //                          · 'triada' o 'pujada' (la tria Ricard, 30-10: no la trepitja res). Buit = cap.
  //   artista.retrat_origen: 'sonda' · 'rebutjat' · 'ma' (pujada per Ricard) · 'triat' (triada per Ricard): aquestes dues no les trepitja res. Buit = cap.
  `
  ALTER TABLE edicio ADD COLUMN portada_origen TEXT;
  ALTER TABLE artista ADD COLUMN retrat_origen TEXT;
  `,
  // v4 · la pista i l'escolta són dues coses (v1.44, ACT-451 i ACT-452).
  // scrobble: una fila per pista tal com arriba de ListenBrainz, identificada per compte + listened_at + recording_msid,
  //   de manera que rellegir no duplica res. estat: 'pendent' · 'resolt' · 'ignorat' (ACT-462).
  //   escolta_id: l'escolta que se'n calcula (nul mentre la pista no sap de quin disc és). És el lligam que fa
  //   comprovable el símptoma del §8.3 —una Escolta sense cap Scrobble que no sigui física— i el que permet tornar
  //   a calcular les escoltes sense perdre el context que Ricard hi ha contestat. Camp de la construcció, per ratificar.
  // escolta.recording_msid es queda sense ús (es muda a scrobble), com els camps congelats de la v1.33:
  //   una migració publicada no esborra columnes.
  // context i atencio: la resposta de la targeta, a cada pista. Escolta.Context i Escolta.Atenció es calculen d'aquí,
  //   com tota l'escolta: si la resposta visqués només a l'escolta, una escolta de 15 hores que junta dues targetes
  //   rebria la resposta de la primera, i una pista que encara no sap de quin disc és la perdria. Per ratificar.
  // L'Arrencada de les escoltes (ACT-453) viu a meta, clau 'arrencada-escoltes': viatja amb l'arxiu i amb la seva còpia.
  `
  CREATE TABLE scrobble (
    id               INTEGER PRIMARY KEY,
    compte           TEXT NOT NULL,          -- crimsonnnn · crimsonnnnfeina
    listened_at      TEXT NOT NULL,          -- l'inici de la pista, ISO 8601 en UTC
    artista          TEXT,
    pista            TEXT,
    album            TEXT,                   -- release_name, tal com arriba
    duration_ms      INTEGER,
    recording_msid   TEXT NOT NULL,
    release_mbid     TEXT,
    caa_release_mbid TEXT,
    estat            TEXT NOT NULL DEFAULT 'pendent' CHECK (estat IN ('pendent', 'resolt', 'ignorat')),
    escolta_id       INTEGER REFERENCES escolta(id),
    context          TEXT,                   -- la resposta de la targeta de la safata (pregunta 1)
    atencio          TEXT,                   -- Efectes plens · Dormir · Estudi cant (pregunta 4)
    UNIQUE (compte, listened_at, recording_msid)
  );
  CREATE INDEX scrobble_temps ON scrobble(listened_at);
  CREATE INDEX scrobble_escolta ON scrobble(escolta_id);
  `,
  // v5 · com es va donar la resposta (ACT-528 i ACT-537, opció B de Ricard del 2-11). Des que cada disc d'una sessió que
  // encara sona es pot contestar sol, «heretar la resposta» feia dues feines: la pista que arriba tard a una targeta
  // contestada sencera, i el disc que encara no s'ha contestat. Amb aquest camp, una pista només hereta d'un altre disc si
  // la resposta es va donar a la targeta sencera. 'targeta' · 'disc'. Buit = 'targeta' (totes les respostes d'abans).
  `
  ALTER TABLE scrobble ADD COLUMN resposta_de TEXT;
  `,
  // v6 · l'escolta sencera feta de trossos (ACT-585, opció B de Ricard del 4-11; cas Savall del 3-11). Una escolta compta
  // sumant trossos de contextos diferents. Cada tros continua sent la seva pròpia Escolta, amb el seu context i la seva
  // atenció (La Gramola no en perd cap); unio és l'id de l'escolta sencera a què pertany: el del seu primer tros.
  // Si una escolta compta es decideix sobre la unió, no sobre el tros. Buit = una escolta física, sense trossos.
  `
  ALTER TABLE escolta ADD COLUMN unio INTEGER;
  CREATE INDEX escolta_unio ON escolta(unio);
  `,
  // v7 · el primer bloc de La Prestatgeria (ACT-624, ACT-632 i ACT-635), en una sola migració:
  //   part.portada: la portada d'una part d'una caixa (ACT-624). La reixa fa servir la de la part viva si en té, i si no,
  //     la de l'edició. Es canvia a mà des de la fitxa de la caixa; cap sonda no l'omple.
  //   llista: les Llistes de reproducció (ACT-632). Només nom i data d'alta: res del cor (és del cor, data del concert,
  //     estat del programa i l'enllaç a l'Obra queden fora; les tres regles del cor, congelades).
  //   llista_canco: les cançons de cada llista, en ordre, amb el recording_msid, l'artista i la pista tal com van arribar,
  //     i la durada en mil·lisegons presa de Scrobble.duration_ms en afegir-la (ACT-635). Buida si la pista no la portava:
  //     llavors la durada total de la llista surt com a incompleta.
  //   scrobble.llista_id: la llista amb què va sonar la pista (ACT-632). D'aquí surten l'última escolta i l'ordre d'Agrupacions.
  `
  ALTER TABLE part ADD COLUMN portada TEXT;
  CREATE TABLE llista (
    id        INTEGER PRIMARY KEY,
    nom       TEXT NOT NULL,
    data_alta TEXT NOT NULL
  );
  CREATE TABLE llista_canco (
    id             INTEGER PRIMARY KEY,
    llista_id      INTEGER NOT NULL REFERENCES llista(id),
    posicio        INTEGER NOT NULL,
    recording_msid TEXT NOT NULL,
    artista        TEXT,
    pista          TEXT,
    durada_ms      INTEGER
  );
  CREATE INDEX llista_canco_llista ON llista_canco(llista_id, posicio);
  CREATE INDEX llista_canco_msid ON llista_canco(recording_msid);
  ALTER TABLE scrobble ADD COLUMN llista_id INTEGER REFERENCES llista(id);
  `
];

// Les taules de les Llistes de reproducció (v7). No són a TAULES: treure una cançó o esborrar una llista és normal,
// i la còpia de seguretat no ha d'avisar quan baixen. Sí que van a l'Excel i a la comparació de l'anada i tornada.
export const TAULES_LLISTES = ['llista', 'llista_canco'];

// Les taules on una baixada de files és sospitosa. Les escoltes i els scrobbles només poden créixer (§3.5).
export const TAULES = ['artista', 'album', 'edicio', 'puntuacio', 'part', 'escolta', 'preferent', 'scrobble'];
