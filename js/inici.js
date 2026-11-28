// El menú principal, «La Meva Discoteca» (obra VI; v1.59 §7.7, ACT-880 a ACT-884, i ACT-886 a ACT-888). Fitxer propi (ACT-756).
// Sense camp del model: tot és pantalla (§13.3).
//  · ACT-881: tres columnes, Prestatgeria (Tots els discos, Agrupacions, L'Afinació), Faristol (Discos en rotació, L'Aparador,
//    Historial) i Gramola; cada secció, una il·lustració amb el seu títol a sota, les dues una sola zona de toc; a baix, La Cabina.
//    Substitueix la barra de baix. Discos en rotació segueix sent la pantalla d'inici.
//  · ACT-884 d: L'Afinació surt de la capçalera i queda aquí, amb el seu punt taronja quan hi ha alguna cosa per afinar.
//  · ACT-883 d: l'exclamació de les còpies, sobre Inici i, dins del menú, al costat de La Cabina.
//  · ACT-888: els títols de columna i de secció, en la lletra del títol (Archivo estreta i grossa); les il·lustracions, a
//    icones-inici.js.
//  · ACT-883 b i c, ACT-888: Inici, sempre visible i al mateix lloc, porta al menú; Tornar surt només quan hi ha un pas enrere,
//    i l'«enrere» del mòbil fa el mateix. El dit llisca entre les tres seccions de cada columna (com fins ara, lliscar a
//    faristol.js); dins de L'Aparador, Agrupacions i L'Afinació, les germanes només es toquen.
import { ICONES, FILTRES } from './icones-inici.js?v=1';

export const COLUMNES = [
  { nom: 'Prestatgeria', seccions: [['prestatgeria:tots', 'Tots els discos', 'tots'], ['prestatgeria:agr', 'Agrupacions', 'agr'], ['prestatgeria:afi', 'L\'Afinació', 'afi']] },
  { nom: 'Faristol', seccions: [['faristol:rot', 'Discos en rotació', 'rot'], ['faristol:pref', 'L\'Aparador', 'apa'], ['faristol:hist', 'Historial', 'hist']] },
  { nom: 'Gramola', seccions: [['gramola:', 'aviat', 'gram']] },
];

const boto = ([on, nom, ic]) => {
  // L'Afinació porta l'id i el punt de sempre (btAfinacio, afiPunt): el toc i el punt fan el que feien a la capçalera.
  const afi = ic === 'afi';
  return `<button class="ini-sec${ic === 'gram' ? ' ini-aviat' : ''}" ${afi ? 'id="btAfinacio" aria-label="L\'Afinació"' : `data-menu="${on}"`}>
    <span class="ini-tile">${ICONES[ic]}${afi ? '<span class="punt" id="afiPunt" hidden></span>' : ''}</span>
    <span class="ini-nom">${nom}</span></button>`;
};

export const htmlInici = () => `${FILTRES}
  <div class="ini-cap"><h1>La Meva<br>Discoteca</h1></div>
  <div class="ini-cols">${COLUMNES.map(c => `<div class="ini-col"><h2>${c.nom}</h2>${c.seccions.map(boto).join('')}</div>`).join('')}</div>
  <div class="ini-peu"><button class="ini-cabina" id="btAjustos" aria-label="La Cabina"><span class="ini-tile">${ICONES.cab}</span>
    <span class="ini-cab-txt"><b>La Cabina</b><small>còpies de seguretat, Excel, comptes</small></span><span class="alerta" aria-hidden="true">!</span></button></div>`;

// El camí enrere: on era abans de cada pas que no és entre germanes (Inici, una secció del menú). Cada pas és una entrada de
// l'historial del navegador, perquè l'«enrere» del mòbil torni pel mateix camí (ACT-883 c).
const cami = [];
export const hiHaEnrere = () => cami.length > 0;
export function empeny(lloc) {
  cami.push(lloc);
  try { history.pushState({ tria: cami.length }, ''); } catch {}
}
export const treu = () => cami.pop() || null;
export const buida = () => { cami.length = 0; };
