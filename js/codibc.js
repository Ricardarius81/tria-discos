// Obra B (ACT-814 (3), ACT-817, ACT-818): el codi de Bandcamp a la fitxa i el marcador «Codi per a la Discoteca».
// Fitxer nou (ACT-756). Cap estructura nova: Edició.codi_bandcamp i Edició.enllac_bandcamp ja hi eren; la versió del codi
// i el repte de la pàgina van a la taula meta, una fila per disc, com les nits de bandcamp.js.
//  · «Codi de Bandcamp · canvia'l» (3.1): a tota edició de Bandcamp, tingui codi o no. Accepta un enllaç (la tasca de nit en
//    treu el codi) o el número (entra al moment).
//  · Un enllaç nou en una edició amb codi (3.2): el codi vell surt al moment i la versió puja. La línia de pendents porta la
//    versió («E43.2»), perquè la tasca se salta les claus que ja són al full de codis; en llegir el full, una fila d'una
//    versió vella no torna a posar el codi vell: mana sempre l'últim codi de cada disc.
//  · El repte de la pàgina (3.3): si la tasca deixa «repte» com a codi, la fitxa ho diu i ensenya el marcador.
//  · El marcador (ACT-817, ACT-818): llegeix el codi dins la pàgina de Bandcamp i obre la Discoteca amb ?bc=codi&enllac=…
import { aplicaCodis } from './escoltes.js?v=15';
import { llegeixEnllac } from './bandcamp.js?v=1';

const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const r = [];
  while (st.step()) r.push(st.getAsObject());
  st.free(); return r;
};
const un = (db, sql, p = []) => files(db, sql, p)[0] || null;
const meta = (db, k) => un(db, 'SELECT valor FROM meta WHERE clau = ?', [k])?.valor ?? null;
const posaMeta = (db, k, v) => v == null ? db.run('DELETE FROM meta WHERE clau = ?', [k]) : db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [k, String(v)]);
const VERSIO = 'bc-versio:', REPTE = 'bc-repte:', NITS = 'bc-nits:';

export const versio = (db, clau) => +(meta(db, VERSIO + clau) || 1);
// La clau que va al fitxer de pendents: «E43» a la primera versió, «E43.2» després d'un enllaç nou.
export const clauAmbVersio = (db, clau) => { const v = versio(db, clau); return v > 1 ? clau + '.' + v : clau; };
export const repte = (db, id) => meta(db, REPTE + 'E' + id);

// Un número de Bandcamp (el que surt a album=… o a l'adreça de l'app): només xifres, quatre o més.
export const llegeixNumero = t => { const m = String(t || '').trim().match(/^(?:.*album=)?(\d{4,})\/?$/); return m ? m[1] : null; };

// El que s'enganxa a la fitxa: un enllaç o un número.
export const desaCodiOEnllac = (id, text) => db => {
  const n = llegeixNumero(text);
  if (n) return desaCodi(id, n)(db);
  const u = llegeixEnllac(text);
  if (!u) return { error: 'No és ni un enllaç d\'un àlbum de Bandcamp ni un número.' };
  return desaEnllacNou(id, u)(db);
};
// El número entra al moment (també des del marcador). Mana el darrer: substitueix el que hi hagi.
export const desaCodi = (id, codi, enllac = null) => db => {
  db.run('UPDATE edicio SET codi_bandcamp = ? WHERE id = ?', [codi, id]);
  if (enllac) db.run('UPDATE edicio SET enllac_bandcamp = ? WHERE id = ?', [enllac, id]);
  posaMeta(db, REPTE + 'E' + id, null); posaMeta(db, NITS + 'E' + id, null);
  return { codi };
};
// Un enllaç: si l'edició tenia codi i l'enllaç és un altre, el codi surt i la versió puja (3.2).
export const desaEnllacNou = (id, url) => db => {
  const e = un(db, 'SELECT codi_bandcamp, enllac_bandcamp FROM edicio WHERE id = ?', [id]); if (!e) return { error: 'No trobo el disc.' };
  const treu = !!e.codi_bandcamp && e.enllac_bandcamp !== url;
  db.run('UPDATE edicio SET enllac_bandcamp = ? WHERE id = ?', [url, id]);
  if (treu) { db.run('UPDATE edicio SET codi_bandcamp = NULL WHERE id = ?', [id]); posaMeta(db, VERSIO + 'E' + id, versio(db, 'E' + id) + 1); }
  posaMeta(db, REPTE + 'E' + id, null); posaMeta(db, NITS + 'E' + id, null);
  return { enllac: url, treu };
};

// Les files del full de codis: es tradueixen les claus amb versió, es llencen les de versions velles, «repte» es recorda,
// i la resta va a aplicaCodis de sempre (que mai trepitja un codi que ja hi és).
export const aplicaCodisV = files_ => db => {
  const bones = [];
  for (const f of files_) {
    const m = String(f.clau).match(/^([EP]\d+)(?:\.(\d+))?$/); if (!m) continue;
    const v = +(m[2] || 1), ara = versio(db, m[1]);
    if (v < ara) continue;
    if (/^repte$/i.test(String(f.codi).trim())) {
      if (m[1][0] === 'E' && !un(db, 'SELECT codi_bandcamp FROM edicio WHERE id = ?', [+m[1].slice(1)])?.codi_bandcamp && !meta(db, REPTE + m[1]))
        posaMeta(db, REPTE + m[1], f.data || new Date().toISOString());
      continue;
    }
    bones.push({ ...f, clau: m[1] });
  }
  return aplicaCodis(bones)(db);
};

// El marcador: ?bc=número&enllac=adreça. Torna { codi, enllac } o null.
export function llegeixMarcador(search) {
  const q = new URLSearchParams(search || ''); const codi = llegeixNumero(q.get('bc'));
  if (!codi) return null;
  return { codi, enllac: llegeixEnllac(q.get('enllac') || '') || null };
}
// L'edició de Bandcamp que ja té aquest enllaç (sense / final ni majúscules al domini).
const netUrl = u => String(u || '').replace(/\/+$/, '').replace(/^https?:\/\/([^/]+)/i, (_, h) => 'https://' + h.toLowerCase());
export function edicioPerEnllac(db, url) {
  if (!url) return null;
  return files(db, "SELECT id, enllac_bandcamp AS u FROM edicio WHERE enllac_bandcamp IS NOT NULL AND enllac_bandcamp != ''").find(x => netUrl(x.u) === netUrl(url))?.id || null;
}
// Per triar a quin disc va el codi del marcador: els de Bandcamp sense codi primer, i després els que en tenen.
export const candidatsMarcador = db => files(db, `SELECT e.id, a.titol, ar.nom_canonic AS art, e.nom_edicio, e.codi_bandcamp, e.rotacio_actual
  FROM edicio e JOIN album a ON a.id = e.album_id JOIN artista ar ON ar.id = a.artista_id
  WHERE e.app_escolta = 'bandcamp' AND NOT EXISTS (SELECT 1 FROM part p WHERE p.edicio_id = e.id)
  ORDER BY (e.codi_bandcamp IS NOT NULL), e.rotacio_actual DESC, a.titol`);

// El marcador mateix: un text que comença per «javascript:». Llegeix el número de l'àlbum de la pàgina (la meta
// bc-page-properties; si no hi és, el data-tralbum o un album=… de la pàgina) i obre la Discoteca.
export function textMarcador(base) {
  const f = `(()=>{let id=null,t=null;try{const p=JSON.parse(document.querySelector('meta[name="bc-page-properties"]').content);t=p.item_type;id=p.item_id}catch(e){}`
    + `if(t==='t'||!id){try{const d=JSON.parse(document.querySelector('[data-tralbum]').getAttribute('data-tralbum'));id=d.current&&d.current.album_id||(d.item_type==='album'?d.id:null)||id}catch(e){}}`
    + `if(!id){const m=document.documentElement.innerHTML.match(/album=(\\d{4,})/);id=m&&m[1]}`
    + `if(!id){alert('No trobo el codi en aquesta pàgina: obre la pàgina de l\\'àlbum.');return}`
    + `location.href='${base}?bc='+id+'&enllac='+encodeURIComponent(location.origin+location.pathname)})()`;
  return 'javascript:' + f;
}
