// L'arrencada sense connexió (ACT-581, 4-11). Sense això, a l'avió la màquina no s'obria: les portades i l'arxiu ja
// eren al mòbil, però el codi de l'app no. Aquest service worker guarda el codi i l'obre sense xarxa; l'arxiu el posa
// la còpia del mòbil (IndexedDB), com sempre.
//
// Com s'actualitza: cada publicació canvia VERSIO (la calcula proves/sw.mjs amb el contingut de tots els FITXERS, i el
// banc falla si no està al dia). El navegador veu el sw.js nou en obrir l'app amb xarxa, el guarda tot de nou i
// esborra la versió vella. L'app que ja era oberta continua amb la seva; la versió nova surt en la propera obertura
// (a vegades amb una obertura de retard: és la conseqüència que es va dir a Ricard).
//
// Només es toca el que és d'aquest lloc. Google, el Drive, ListenBrainz, MusicBrainz i les portades passen de llarg.

const VERSIO = '07e9e6a7ba79';
const FITXERS = [
  'index.html',
  'manifest.webmanifest',
  'css/faristol.css',
  'js/afinacio.js',
  'js/arxiu.js',
  'js/copies.js',
  'js/dades.js',
  'js/discografia.js',
  'js/escoltes.js',
  'js/esquema.js',
  'js/excel.js',
  'js/faristol.js',
  'js/imatges.js',
  'js/listenbrainz.js',
  'js/llistes.js',
  'js/llavor.js',
  'js/tags.js',
  'vendor/sqljs/sql-wasm.js',
  'vendor/sqljs/sql-wasm.wasm',
  'vendor/fonts/archivo-latin-wdth-normal.woff2',
  'icones/icona-192.png',
  'icones/icona-512.png',
  'icones/icona-maskable-512.png',
  'icones/apple-touch-icon.png',
  'so/silenci.mp3'
];
const CAIXA = 'tria-discos-' + VERSIO;

self.addEventListener('install', e => {
  // cache: 'reload' salta la memòria cau del navegador (GitHub Pages hi deixa els fitxers deu minuts): així la versió
  // guardada és sencera la nova, i no una barreja.
  e.waitUntil(caches.open(CAIXA).then(c => c.addAll(FITXERS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('tria-discos-') && k !== CAIXA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const rq = e.request;
  if (rq.method !== 'GET') return;
  const u = new URL(rq.url);
  if (u.origin !== location.origin) return;                      // de fora: com si no hi fos
  const abast = new URL('./', location.href).pathname;
  if (!u.pathname.startsWith(abast)) return;
  const cami = u.pathname.slice(abast.length) || 'index.html';
  e.respondWith((async () => {
    const c = await caches.open(CAIXA);
    // La pàgina de l'app, s'hi arribi per «./» o per «index.html».
    const clau = rq.mode === 'navigate' && (cami === 'index.html' || cami.endsWith('/')) ? 'index.html' : cami;
    // Els «?v=» dels mòduls no importen aquí: dins d'una mateixa VERSIO tot és de la mateixa publicació.
    const desat = FITXERS.includes(clau) ? await c.match(clau, { ignoreSearch: true }) : null;
    if (desat) return desat;
    return fetch(rq);                                               // el que no és de l'app (proves, privadesa…): la xarxa
  })());
});
