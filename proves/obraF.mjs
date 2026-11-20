// Les comprovacions de l'obra F (retocs: Piles, ACT-787 c, ACT-798, ACT-799, ACT-800). Fitxer propi (ACT-756).
const cal = (cond, msg) => { if (!cond) throw new Error(msg); };
const igual = (a, b, msg) => cal(a === b, `${msg}: s'esperava ${JSON.stringify(b)} i hi ha ${JSON.stringify(a)}`);
async function reobre(pagina) {
  await pagina.reload(); await pagina.waitForSelector('#peu:not([hidden])', { timeout: 10000 });
  await pagina.waitForFunction(() => !document.body.classList.contains('desconnectat'), null, { timeout: 8000 });
  await pagina.evaluate(() => { if (document.querySelector('#full.obert')) document.querySelector('#fons')?.click(); document.querySelector('[data-anar="faristol"]')?.click(); document.querySelector('[data-sub="rot"]')?.click(); });
  await pagina.waitForSelector('#s-faristol.activa', { timeout: 10000 });
}
const llegeix = (pagina, sql) => pagina.evaluate(async sql => { const A = await import('./js/arxiu.js?v=21');
  const r = A.estat.db.exec(sql)[0]; return r ? r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []; }, sql);

export const OBRA_F = [
  { bloc: 'obra F: retocs (Piles, ACT-787 c, ACT-798 a ACT-800)' },
  { nom: 'actes (ACT-798, ACT-799): una pista sense acte pren el de l\'anterior (la primera, l\'1); el preludi pren el de la següent; Intermezzo no és preludi', async fes({ pagina }) {
    const o = await pagina.evaluate(async () => { const { partsPerActe, esPreludi } = await import('./js/actes.js?v=1');
      const m = 60000;
      return {
        p: partsPerActe([{ title: 'Parsifal: Vorspiel', length: 14 * m }, { title: 'Act 1: Nun achtet mir', length: 50 * m }, { title: 'Verwandlungsmusik', length: 6 * m },
                         { title: 'Act 2: Zeit ist\'s', length: 60 * m }, { title: 'Act 3: Vorspiel', length: 8 * m }, { title: 'Interview with the conductor', length: 10 * m }]),
        cap: partsPerActe([{ title: 'Una', length: m }, { title: 'Dues', length: m }]),
        pre: [esPreludi('Ouvertüre'), esPreludi("Entr'acte"), esPreludi('Intermezzo'), esPreludi('Zwischenspiel'), esPreludi('Introducció')] };
    });
    igual(JSON.stringify(o.p), JSON.stringify([{ numero: 1, nom: 'Acte 1', durada: 70 }, { numero: 2, nom: 'Acte 2', durada: 60 }, { numero: 3, nom: 'Acte 3', durada: 18 }]),
      'actes de Parsifal: el Vorspiel a l\'1, la Verwandlungsmusik a l\'1, l\'entrevista final al 3');
    igual(o.cap, null, 'sense cap pista amb acte, cap proposta');
    igual(JSON.stringify(o.pre), JSON.stringify([true, true, false, false, true]), 'família del preludi');
  } },
  { nom: 'Piles (§7.7, 18-10): «＋ Pila» crea una Pila amb el seu context (Pila.contextos) i el color següent; «Treu la Pila» la treu amb les seves entrades', async fes({ pagina, esperaDesat }) {
    await reobre(pagina);
    await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="esc"]').catch(() => {}); await pagina.waitForSelector('#piles [data-novapila]', { timeout: 5000 });
    await pagina.click('#piles [data-novapila]'); await pagina.waitForSelector('#inNovaPila');
    await pagina.fill('#inNovaPila', 'Platja'); await pagina.click('#full [data-ctxnovapila="Platja"]');
    await pagina.click('#full [data-desanovapila]'); await esperaDesat();
    const p = (await llegeix(pagina, "SELECT id, contextos, posicio FROM pila WHERE nom = 'Platja'"))[0];
    cal(p && JSON.parse(p.contextos).includes('Platja'), 'Pila.contextos de la Pila nova: ' + JSON.stringify(p));
    const c = await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), P = await import('./js/piles.js?v=1'); return P.colorsPiles(A.estat.db).get(id); }, p.id);
    igual(c, '#1d9a9a', 'la quarta Pila pren el quart color');
    await pagina.evaluate(async id => { const A = await import('./js/arxiu.js?v=21'), P = await import('./js/piles.js?v=1'); await A.canvia(db => P.afegeix(id, 'Ningú', 'A la Platja', null)(db)); }, p.id);
    await esperaDesat(); await reobre(pagina);
    await pagina.click('[data-sub="pref"]'); await pagina.click('[data-asub="esc"]').catch(() => {});
    await pagina.click(`#piles [data-pila="${p.id}"]`); await pagina.click(`#piles [data-treupila="${p.id}"]`);
    await pagina.waitForSelector('#full [data-treupilasi]'); await pagina.click('#full [data-treupilasi]'); await esperaDesat();
    igual((await llegeix(pagina, `SELECT COUNT(*) AS n FROM pila WHERE id = ${p.id}`))[0].n, 0, 'la Pila treta');
    igual((await llegeix(pagina, `SELECT COUNT(*) AS n FROM pila_entrada WHERE pila_id = ${p.id}`))[0].n, 0, 'les entrades de la Pila treta');
  } },
  { nom: 'fitxa (ACT-799, ACT-800): «Tria el proper de X» ofereix el següent i, amb un toc, l\'anterior; ACT-787 (c): «Sense parts» a la targeta de disc nou', async fes({ pagina }) {
    const codi = (await import('node:fs')).readFileSync(new URL('../js/faristol.js', import.meta.url), 'utf8');
    cal(codi.includes('Tria el proper de ${esc(d.art)}') && codi.includes('data-veinou='), 'falta «Tria el proper de X» amb l\'anterior');
    cal(codi.includes('data-sfsenseparts=') && codi.includes("parts: estat.sensePartsDe?.[k] ? null : x.proposta.parts"), 'falta «Sense parts» a la targeta de disc nou');
  } },
];
