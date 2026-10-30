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
  `
];

// Les taules on una baixada de files és sospitosa. Les escoltes només poden créixer (§3.5).
export const TAULES = ['artista', 'album', 'edicio', 'puntuacio', 'part', 'escolta', 'preferent'];
