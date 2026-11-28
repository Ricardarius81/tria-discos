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
  `,
  // v8 · L'Afinació (v1.49, ACT-674, ACT-676 i ACT-681). edicio.per_afinar: la DATA en què Ricard toca «Per afinar» a la
  //   fitxa, en text ISO en UTC; buit = no marcat. «Ja està afinat» la buida. És una data i no un sí o no perquè el símptoma
  //   de la ACT-676 —«Per afinar» amb discos marcats fa mesos— només es pot calcular amb una data (§13.3).
  //   Nom de la columna fixat en la construcció (el §8.3 el deixava per fixar).
  `
  ALTER TABLE edicio ADD COLUMN per_afinar TEXT;
  `,
  // v9 · La durada sospitosa (8-11, ACT-696). edicio.durada_confirmada: els minuts que Ricard ha dit que són bons amb
  //   «La durada és bona», quan una escolta va sonar més del que diu la fitxa (cobertura per sobre de 1,05). Buit = mai
  //   confirmada. Si Edició.durada_total canvia, ja no és igual i l'avís pot tornar.
  `
  ALTER TABLE edicio ADD COLUMN durada_confirmada INTEGER;
  `,
  // v10 · Els subgèneres (v1.52, ACT-733). album.subgeneres: una llista, com Idioma, que Ricard escriu a la fulla del gènere
  //   de la fitxa, desada a cada toc. Llista oberta i sense arbre: un subgènere no penja de cap branca, però no se'n pot
  //   desar cap si Àlbum.Gènere no té almenys una branca. Buit no és cap avís (mai taronja). Nom de la columna i número
  //   d'estructura fixats en la construcció (el §8.3 els deixava per fixar).
  `
  ALTER TABLE album ADD COLUMN subgeneres TEXT;
  `,
  // v11 · Les Piles de L'Aparador (v1.51 i v1.53, ACT-707 a ACT-714 i ACT-744). Les regles són a piles.js.
  //   pila: nom i contextos (la llista de Escolta.context que en treuen un disc, ACT-327 i ACT-707). Les tres d'entrada, amb
  //     el nom del seu context: Gimnàs = «Al gimnàs»; Avió/Tren/Bus = «Avió / Tren / Bus»; Cotxe = els dos de conduir.
  //   pila_entrada: artista i títol escrits; album_id, l'ÀLBUM amb què es casa (ACT-711, no l'edició); data_alta (ACT-708,
  //     ACT-713) i data_sortida, el camp nou de la estructura 11 (ACT-744): buida mentre hi és.
  //   La llavor (llavor.js, APARADOR): The Fat of the Land a Gimnàs, del «car pendent», entra ara, com a text.
  //   Noms de les taules i de les columnes fixats en la construcció (el §8.3 els deixava per fixar).
  `
  CREATE TABLE pila (
    id        INTEGER PRIMARY KEY,
    nom       TEXT NOT NULL,
    contextos TEXT NOT NULL,
    posicio   INTEGER
  );
  CREATE TABLE pila_entrada (
    id           INTEGER PRIMARY KEY,
    pila_id      INTEGER NOT NULL REFERENCES pila(id),
    artista      TEXT,
    titol        TEXT,
    album_id     INTEGER REFERENCES album(id),
    data_alta    TEXT NOT NULL,
    data_sortida TEXT
  );
  CREATE INDEX pila_entrada_pila ON pila_entrada(pila_id, data_sortida);
  CREATE INDEX pila_entrada_album ON pila_entrada(album_id);
  INSERT INTO pila (id, nom, contextos, posicio) VALUES
    (1, 'Gimnàs', '["Al gimnàs"]', 1),
    (2, 'Avió/Tren/Bus', '["Avió / Tren / Bus"]', 2),
    (3, 'Cotxe', '["Conduint (sol)","Conduint (acompanyat)"]', 3);
  INSERT INTO pila_entrada (pila_id, artista, titol, data_alta) VALUES
    (1, 'The Prodigy', 'The Fat of the Land', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  `,
  // v12 · Segells Preferents (v1.56, ACT-816, ACT-817, ACT-827, obra G). Les regles són a segells.js.
  //   segell_preferent: nom (es compara normalitzat amb Edició.segell), ordre (manual; els nous entren a dalt), el proper
  //     a mà —artista i títol, perquè un disc d'un segell és de qualsevol artista— i l'id de Discogs (la segona font de
  //     l'anterior i el següent). Les sis d'entrada (7.4), amb els id de Discogs de la sonda del 20-11 (ACT-827).
  //   Noms de la taula i de les columnes fixats en la construcció (el §8.3 els deixava per fixar).
  `
  CREATE TABLE segell_preferent (
    id             INTEGER PRIMARY KEY,
    nom            TEXT NOT NULL,
    ordre          INTEGER NOT NULL,
    proper_artista TEXT,
    proper_titol   TEXT,
    discogs_id     INTEGER,
    data_alta      TEXT
  );
  INSERT INTO segell_preferent (nom, ordre, discogs_id, data_alta) VALUES
    ('Quiet Details', 1, 3052813, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ('Home Normal', 2, 143072, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ('Sonic Pieces', 3, 157803, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ('Past Inside The Present', 4, 1558852, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ('Dragon''s Eye Recordings', 5, 80927, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ('A Strangely Isolated Place', 6, 307352, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  `,
  // v13 · obra I (v1.57, ACT-836 e, ACT-840 2), una sola estructura per a les dues columnes:
  //   segell_preferent.retrat: el logo del segell, només a mà («drive:<id>», com artista.retrat); buit = sense logo.
  //   escolta.origen: 'listenbrainz' (feta pel recàlcul amb pistes) · 'a mà' (apuntada a mà: física o d'streaming).
  //     Cal perquè, quan les pistes velles surtin a un fitxer d'any (ACT-838), «sense pistes» ja no voldrà dir «a mà» (ACT-837).
  //     En migrar: les que tenen pistes, 'listenbrainz'; les que no, 'a mà' (fins ara, les físiques, registrades a mà).
  `
  ALTER TABLE segell_preferent ADD COLUMN retrat TEXT;
  ALTER TABLE escolta ADD COLUMN origen TEXT;
  UPDATE escolta SET origen = CASE WHEN id IN (SELECT escolta_id FROM scrobble WHERE escolta_id IS NOT NULL) THEN 'listenbrainz' ELSE 'a mà' END;
  `,
  // v14 · obra II (v1.57, ACT-841 4): el que avui es dedueix de les pistes, desat a la seva fitxa, perquè no es perdi quan
  //   les pistes de més de 12 mesos surtin al fitxer del seu any (ACT-838). Ho escriu resums.js (desaResums); les pantalles
  //   prenen el més recent entre el desat i el que diuen les pistes que encara hi són.
  //   edicio.release_mbid: el release de MusicBrainz de l'última pista que en portava (Info, segell). edicio.darrer_scrobble:
  //   l'última pista que ha sonat de l'edició (l'ordre de Discos en Rotació). llista.darrera_escolta i llista.portades (JSON,
  //   fins a quatre «release/…»): l'última escolta i el mosaic de cada Llista de reproducció.
  `
  ALTER TABLE edicio ADD COLUMN release_mbid TEXT;
  ALTER TABLE edicio ADD COLUMN darrer_scrobble TEXT;
  ALTER TABLE llista ADD COLUMN darrera_escolta TEXT;
  ALTER TABLE llista ADD COLUMN portades TEXT;
  `,
  // v15 · obra V (v1.59, ACT-856 a): edicio.data_ordre_rotacio, la clau d'ordre de Discos en Rotació quan el disc ENTRA a la
  //   rotació. Abans l'ordre feia servir edicio.data_referencia_rotacio, que fa dues feines (la data des de la qual es
  //   compten les escoltes de l'oferta d'entrar i les preguntes 8 i 9, ACT-763, i l'ordre): treure'l i cancel·lar la
  //   sortida, o contestar «Encara no», el pujava a dalt sense haver sonat. Ara l'ordre el mouen només un toc de ▶
  //   (darrera_obertura), una escolta real (escolta.data_hora, scrobble.listened_at, darrer_scrobble) i l'entrada a la
  //   rotació (aquest camp). En migrar: el de data_referencia_rotacio dels discos que ara són en rotació, perquè l'ordre
  //   d'avui no es mogui.
  `
  ALTER TABLE edicio ADD COLUMN data_ordre_rotacio TEXT;
  UPDATE edicio SET data_ordre_rotacio = data_referencia_rotacio WHERE rotacio_actual = 1;
  `
];

// Les taules de les Llistes de reproducció (v7). No són a TAULES: treure una cançó o esborrar una llista és normal,
// i la còpia de seguretat no ha d'avisar quan baixen. Sí que van a l'Excel i a la comparació de l'anada i tornada.
export const TAULES_LLISTES = ['llista', 'llista_canco', 'pila', 'pila_entrada', 'segell_preferent'];   // v11: les Piles; v12: els Segells Preferents, pel mateix motiu

// Les taules on una baixada de files és sospitosa. Les escoltes i els scrobbles només poden créixer (§3.5).
export const TAULES = ['artista', 'album', 'edicio', 'puntuacio', 'part', 'escolta', 'preferent', 'scrobble'];
