// Els serveis de fora, falsos, per al banc de proves: el Drive, ListenBrainz i el component d'inici de sessió de Google.
// Cap petició no surt de la màquina: el que no és d'aquí ni d'un d'aquests tres s'avorta i es compta.

// ───────── el Drive fals ─────────
// Un magatzem a la memòria amb el que la màquina fa servir: buscar per nom, metadades, baixar, crear (multipart),
// sobreescriure, treure de la paperera, exportar un full a CSV i «about».
export class DriveFals {
  constructor() { this.fitxers = new Map(); this.n = 0; this.rellotge = Date.now() - 3600e3; this.peticions = []; }
  hora() { this.rellotge += 1000; return new Date(this.rellotge).toISOString(); }
  afegeix({ name, mimeType, parents = [], bytes = new Uint8Array(), trashed = false }) {
    const id = 'f' + (++this.n);
    this.fitxers.set(id, { id, name, mimeType, parents, bytes: Buffer.from(bytes), trashed, modifiedTime: this.hora() });
    return this.fitxers.get(id);
  }
  per(nom) { return [...this.fitxers.values()].filter(f => f.name === nom && !f.trashed).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))[0] || null; }
  meta(f) { return { id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, size: String(f.bytes.length), parents: f.parents, trashed: f.trashed }; }
  // La consulta «name = '…' and trashed = … [and '…' in parents] [and mimeType = '…']»
  cerca(q) {
    const nom = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, '$1');
    const pap = /trashed = (true|false)/.exec(q)?.[1] === 'true';
    const pare = /'([^']+)' in parents/.exec(q)?.[1];
    const mime = /mimeType = '([^']+)'/.exec(q)?.[1];
    return [...this.fitxers.values()].filter(f => (!nom || f.name === nom) && f.trashed === pap && (!pare || f.parents.includes(pare)) && (!mime || f.mimeType === mime))
      .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)).map(f => this.meta(f));
  }
  async atén(route) {
    const rq = route.request(), u = new URL(rq.url()), m = rq.method();
    this.peticions.push(m + ' ' + u.pathname + u.search);
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/drive/v3/about') return json({ user: { emailAddress: 'banc@proves.local' } });
    if (u.pathname === '/drive/v3/files' && m === 'GET') return json({ files: this.cerca(u.searchParams.get('q') || '') });
    let mt = /^\/drive\/v3\/files\/([^/]+)(\/export)?$/.exec(u.pathname);
    if (mt) {
      const f = this.fitxers.get(mt[1]); if (!f) return json({ error: 'not found' }, 404);
      if (mt[2]) return route.fulfill({ status: 200, contentType: 'text/csv', body: f.bytes });
      if (m === 'PATCH') { const b = JSON.parse(rq.postData() || '{}'); if ('trashed' in b) f.trashed = b.trashed; f.modifiedTime = this.hora(); return json(this.meta(f)); }
      if (u.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: f.bytes });
      return json(this.meta(f));
    }
    if (u.pathname === '/upload/drive/v3/files' && m === 'POST') {
      const tipus = rq.headers()['content-type'] || '', vora = /boundary=(.+)$/.exec(tipus)?.[1];
      const cos = rq.postDataBuffer() || Buffer.alloc(0);
      const trossos = []; let i = 0; const sep = Buffer.from('--' + vora);
      while ((i = cos.indexOf(sep, i)) >= 0) { trossos.push(i); i += sep.length; }
      const parts = trossos.slice(0, -1).map((a, k) => cos.subarray(a + sep.length, trossos[k + 1]));
      const cap = p => { const j = p.indexOf('\r\n\r\n'); return j < 0 ? Buffer.alloc(0) : p.subarray(j + 4); };
      const meta = JSON.parse(cap(parts[0]).toString('utf8'));
      const dades = parts[1] ? cap(parts[1]) : Buffer.alloc(0);
      const f = this.afegeix({ name: meta.name, mimeType: meta.mimeType, parents: meta.parents || [], bytes: dades.subarray(0, Math.max(0, dades.length - 2)) });
      return json(this.meta(f));
    }
    mt = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (mt && m === 'PATCH') {
      const f = this.fitxers.get(mt[1]); if (!f) return json({ error: 'not found' }, 404);
      f.bytes = Buffer.from(rq.postDataBuffer() || []); f.modifiedTime = this.hora();
      return json(this.meta(f));
    }
    return json({ error: 'el Drive fals no sap fer ' + m + ' ' + u.pathname }, 501);
  }
}

// ───────── ListenBrainz fals ─────────
// Torna les pistes de cada compte amb listened_at >= min_ts (com el de veritat), de la més recent a la més antiga.
export class ListenBrainzFals {
  constructor(escoltes = []) { this.escoltes = escoltes; this.crides = 0; }
  async atén(route) {
    this.crides++;
    const u = new URL(route.request().url());
    const compte = decodeURIComponent(/\/user\/([^/]+)\/listens/.exec(u.pathname)?.[1] || '');
    const min = +(u.searchParams.get('min_ts') || 0);
    const l = this.escoltes.filter(x => x.compte === compte && x.listened_at > min).sort((a, b) => b.listened_at - a.listened_at)
      .map(({ compte: _c, ...x }) => x);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payload: { count: l.length, listens: l } }) });
  }
}

// ───────── el component de Google, fals ─────────
// Dona un testimoni que caduca d'aquí una hora, sense finestra ni comptes.
export const GSI_FALS = `window.google = { accounts: { oauth2: { initTokenClient(o) {
  const c = { callback: o.callback, error_callback: null, requestAccessToken() {
    window.__permisos = (window.__permisos || 0) + 1;
    setTimeout(() => c.callback({ access_token: 'testimoni-fals', expires_in: 3600 }), 10); } };
  return c; } } } };`;
