// Les il·lustracions del menú «La Meva Discoteca» (obra VI, ACT-887 c i ACT-888). Ricard: «inspirados en portadas de discos»,
// «bonitos, con color realista, no de dibujos animados», «mas cercano a una foto sin que sea una foto, pero mas realista con
// lo que representa». I, el 28-11 al vespre: que «no se vean tan iguales entre ellos». Per això cada una té la seva llum,
// el seu fons i la seva paleta (cap comparteix el fons fosc amb vinyeta de la Maqueta 4), un sol objecte gran que omple el
// quadre, ombres i reflexos de material (fusta, cartró, llautó, vinil, vidre, plàstic, cromat, vidre il·luminat) i un gra fi
// comú, que és l'única cosa que es repeteix. SVG a mà, sense fitxers ni connexió: es guarden amb el codi (sw.js).
// Sense camp del model: és aspecte.

// Els filtres que fan servir totes: el gra de foto, la fusta, el feltre, l'ombra tova i el desenfocament.
export const FILTRES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="ig-gra" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .22 0"/></filter>
  <filter id="ig-fusta" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .42" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .18  0 0 0 0 .07  0 0 0 1.3 -.35"/></filter>
  <filter id="ig-feltre" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .3  0 0 0 0 .2  0 0 0 .55 0"/></filter>
  <filter id="ig-teixit" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".6 .05" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 .8  0 0 0 0 .85  0 0 0 0 .9  0 0 0 .18 0"/></filter>
  <filter id="ig-ombra" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.6"/><feOffset dx="1.5" dy="3.2"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="ig-boira" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="ig-boira2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
</defs></svg>`;

const gra = '<rect width="100" height="100" filter="url(#ig-gra)"/>';
const svg = (cos) => `<svg viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${cos}${gra}</svg>`;

export const ICONES = {
  // Tots els discos: un prestatge de roure clar amb els lloms de les caixes de CD, de dia, contra una paret de calç.
  tots: svg(`<defs><linearGradient id="it-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3EBDD"/><stop offset="1" stop-color="#CFC2AA"/></linearGradient>
    <linearGradient id="it-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E1B985"/><stop offset=".55" stop-color="#B98650"/><stop offset="1" stop-color="#7E5530"/></linearGradient>
    <linearGradient id="it-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".18" stop-color="#fff" stop-opacity="0"/><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
    <linearGradient id="it-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#it-p)"/><path d="M58 0L100 0L100 60Z" fill="#fff" opacity=".35"/>
    <g>${[['#1F4E79', 9, 20], ['#E9E4DA', 8, 16], ['#B33A2B', 10, 22], ['#2B2B2E', 7, 18], ['#D7A63B', 9, 15], ['#5E7F4E', 8, 21], ['#EDEBE6', 9, 17], ['#7A3E68', 8, 19], ['#16827A', 10, 16], ['#C96B2C', 8, 20]]
      .map(([c, w, y], i, a) => { const x = 6 + a.slice(0, i).reduce((s, v) => s + v[1], 0) + i * .6;
        return `<rect x="${x}" y="${y}" width="${w}" height="${66 - y}" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="${66 - y}" fill="url(#it-v)"/>` +
          `<rect x="${x + w * .3}" y="${y + 6}" width="${w * .4}" height="${(66 - y) * .45}" fill="${['#E9E4DA', '#EDEBE6', '#D7A63B'].includes(c) ? '#3A3530' : '#fff'}" opacity=".55"/>` +
          `<rect x="${x + 1}" y="${y + 2}" width="1" height="${66 - y - 4}" fill="#fff" opacity=".5"/>`; }).join('')}</g>
    <rect x="0" y="66" width="100" height="8" fill="url(#it-s)"/>
    <rect x="0" y="64" width="100" height="36" fill="url(#it-f)"/><rect x="0" y="64" width="100" height="36" filter="url(#ig-fusta)" opacity=".55"/>
    <rect x="0" y="64" width="100" height="1.6" fill="#F6D9AE"/><rect x="0" y="65.6" width="100" height="2.4" fill="#5A3A1E" opacity=".35"/>
    <rect x="0" y="86" width="100" height="14" fill="#000" opacity=".12"/>`),

  // Agrupacions: una caixa de cartró oberta, vista des de dalt, amb un grapat de discos dins, sobre un lli blau.
  agr: svg(`<defs><linearGradient id="ia-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5D7E99"/><stop offset="1" stop-color="#2D4459"/></linearGradient>
    <linearGradient id="ia-k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9AE76"/><stop offset=".6" stop-color="#B98A50"/><stop offset="1" stop-color="#8E6534"/></linearGradient>
    <linearGradient id="ia-i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A3E1F"/><stop offset="1" stop-color="#8A6232"/></linearGradient>
    <radialGradient id="ia-d" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="100" height="100" fill="url(#ia-l)"/><rect width="100" height="100" filter="url(#ig-teixit)"/>
    <g filter="url(#ig-ombra)" transform="rotate(-8 50 52)"><path d="M14 22h72v64H14z" fill="url(#ia-k)"/><path d="M14 22l-8-9h72l8 9z" fill="#E7C493"/><path d="M86 22l9-7v62l-9 9z" fill="#A87A44"/></g>
    <g transform="rotate(-8 50 52)"><rect x="19" y="27" width="62" height="54" fill="url(#ia-i)"/>
      <rect x="21" y="35" width="57" height="12" fill="#1C3D5A" transform="skewX(-12)"/><rect x="24" y="44" width="57" height="12" fill="#D7DCD4" transform="skewX(-10)"/>
      <rect x="22" y="53" width="57" height="12" fill="#9B2F30" transform="skewX(-8)"/><rect x="21" y="62" width="58" height="13" fill="#E4B23F" transform="skewX(-6)"/>
      <rect x="21" y="35" width="58" height="40" fill="url(#ia-d)"/>
      <path d="M19 27h62" stroke="#3A2810" stroke-width="1.4" opacity=".6"/><path d="M30 18l20 2" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></g>`),

  // L'Afinació: un diapasó de llautó estirat en diagonal sobre feltre verd de taula, molt a prop, amb el fons desenfocat.
  afi: svg(`<defs><radialGradient id="if-b" cx=".3" cy=".25" r="1"><stop offset="0" stop-color="#3E8A64"/><stop offset=".6" stop-color="#1F5A40"/><stop offset="1" stop-color="#0F3324"/></radialGradient>
    <linearGradient id="if-m" gradientUnits="userSpaceOnUse" x1="36" y1="0" x2="64" y2="0"><stop offset="0" stop-color="#6B4712"/><stop offset=".28" stop-color="#C8973A"/><stop offset=".42" stop-color="#FFF3C9"/><stop offset=".55" stop-color="#D9A84A"/><stop offset="1" stop-color="#5A3B0C"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#if-b)"/><rect width="100" height="100" filter="url(#ig-feltre)"/>
    <g transform="rotate(32 50 50)"><g transform="translate(4 5)" filter="url(#ig-boira)" opacity=".55"><path d="M40 4v40a10 10 0 0 0 20 0V4" stroke="#000" stroke-width="8" fill="none"/><path d="M50 54v38" stroke="#000" stroke-width="8"/></g>
      <path d="M40 4v40a10 10 0 0 0 20 0V4" stroke="url(#if-m)" stroke-width="7.5" fill="none" stroke-linecap="round"/>
      <path d="M50 54v36" stroke="url(#if-m)" stroke-width="7.5" stroke-linecap="round"/><ellipse cx="50" cy="93" rx="6.2" ry="3.4" fill="url(#if-m)"/>
      <path d="M38.7 6v37M58.7 6v14M48.7 57v32" stroke="#fff" stroke-opacity=".75" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M44 46q6 4 12 0" stroke="#fff" stroke-opacity=".45" stroke-width="1"/></g>
    <circle cx="84" cy="14" r="9" fill="#8FD0A8" opacity=".25" filter="url(#ig-boira)"/>`),

  // Discos en rotació: un vinil a mig sortir de la funda, sobre un fons de terracota encès, amb la llum que llisca pels solcs.
  rot: svg(`<defs><linearGradient id="ir-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E37A45"/><stop offset="1" stop-color="#A63E1E"/></linearGradient>
    <radialGradient id="ir-v" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2B2B30"/><stop offset=".35" stop-color="#111114"/><stop offset="1" stop-color="#050506"/></radialGradient>
    <linearGradient id="ir-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F1EA"/><stop offset="1" stop-color="#CFC8B8"/></linearGradient>
    <radialGradient id="ir-l" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFD36B"/><stop offset="1" stop-color="#D98B12"/></radialGradient></defs>
    <rect width="100" height="100" fill="url(#ir-f)"/><path d="M0 0h100L0 70z" fill="#fff" opacity=".08"/>
    <g filter="url(#ig-ombra)"><circle cx="64" cy="52" r="34" fill="url(#ir-v)"/></g>
    <g fill="none" stroke="#fff">${[32, 30, 28, 26, 24, 21.5, 19.5, 17.5, 15].map((r, i) => `<circle cx="64" cy="52" r="${r}" stroke-opacity="${i % 2 ? .05 : .1}" stroke-width=".6"/>`).join('')}</g>
    <path d="M64 52L95 30A34 34 0 0 1 97 62Z" fill="#fff" opacity=".16"/><path d="M64 52L33 74A34 34 0 0 1 31 42Z" fill="#fff" opacity=".07"/>
    <circle cx="64" cy="52" r="11" fill="url(#ir-l)"/><path d="M58 48h12M59.5 53h9" stroke="#7A4A06" stroke-opacity=".6" stroke-width=".9"/><circle cx="64" cy="52" r="1.4" fill="#1A1A1A"/>
    <g filter="url(#ig-ombra)"><rect x="4" y="15" width="50" height="74" fill="url(#ir-s)"/></g>
    <rect x="10" y="22" width="38" height="38" fill="#1E3B57"/><circle cx="29" cy="41" r="12" fill="none" stroke="#E9C27A" stroke-width="2.2"/><circle cx="29" cy="41" r="4.5" fill="#E9C27A"/>
    <rect x="10" y="66" width="28" height="2.6" fill="#3A3A3A" opacity=".8"/><rect x="10" y="71" width="18" height="1.8" fill="#3A3A3A" opacity=".5"/>
    <rect x="52.5" y="15" width="1.5" height="74" fill="#000" opacity=".25"/><path d="M5 16h48" stroke="#fff" stroke-opacity=".8"/>`),

  // L'Aparador: un aparador de botiga de discos al vespre, vist des del carrer: tres portades dins, llum càlida i el reflex del vidre.
  apa: svg(`<defs><linearGradient id="ip-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2B45"/><stop offset="1" stop-color="#0B1220"/></linearGradient>
    <radialGradient id="ip-i" cx=".5" cy=".2" r=".9"><stop offset="0" stop-color="#FFD99A"/><stop offset=".55" stop-color="#C9813C"/><stop offset="1" stop-color="#5A2E12"/></radialGradient>
    <linearGradient id="ip-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity=".1"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#ip-c)"/>
    <rect x="9" y="10" width="82" height="74" fill="url(#ip-i)"/>
    <g filter="url(#ig-ombra)"><rect x="14" y="40" width="22" height="22" fill="#2F7A8C" transform="rotate(-6 25 62)"/><rect x="38" y="30" width="25" height="25" fill="#F0E6D2"/><rect x="65" y="40" width="22" height="22" fill="#B23A3A" transform="rotate(5 76 62)"/></g>
    <circle cx="50.5" cy="42.5" r="7" fill="#1A1A1A"/><circle cx="50.5" cy="42.5" r="2.2" fill="#E4B23F"/><path d="M18 46h14" stroke="#F3E3B0" stroke-width="1.6" transform="rotate(-6 25 62)"/><rect x="69" y="45" width="14" height="6" fill="#F5D7A0" opacity=".8" transform="rotate(5 76 62)"/>
    <rect x="9" y="62" width="82" height="6" fill="#3A2412"/><rect x="9" y="62" width="82" height="1.2" fill="#FFE3B0" opacity=".7"/>
    <g filter="url(#ig-boira2)"><circle cx="26" cy="16" r="2.4" fill="#FFF4D6"/><circle cx="50" cy="15" r="2.4" fill="#FFF4D6"/><circle cx="74" cy="16" r="2.4" fill="#FFF4D6"/></g>
    <rect x="9" y="10" width="82" height="74" fill="url(#ip-r)"/>
    <rect x="6" y="7" width="88" height="80" fill="none" stroke="#2A2A2E" stroke-width="4"/><rect x="0" y="86" width="100" height="14" fill="#0A0E16"/><rect x="0" y="86" width="100" height="1" fill="#6F86A8" opacity=".5"/>
    <path d="M60 86L78 100H92L70 86Z" fill="#FFB866" opacity=".12"/>`),

  // Historial: una casset d'abans, de biaix, sobre una taula clara de color menta, amb la llum d'una finestra.
  hist: svg(`<defs><linearGradient id="ih-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFE6DC"/><stop offset="1" stop-color="#93BFAE"/></linearGradient>
    <linearGradient id="ih-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3D44"/><stop offset="1" stop-color="#1B1D21"/></linearGradient>
    <linearGradient id="ih-e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF6E8"/><stop offset="1" stop-color="#E9DEC2"/></linearGradient>
    <linearGradient id="ih-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#ih-t)"/><path d="M-10 30L40 -10L70 -10L10 50Z" fill="#fff" opacity=".22"/>
    <g transform="rotate(-11 50 52)"><g filter="url(#ig-ombra)"><rect x="8" y="24" width="84" height="56" rx="5" fill="url(#ih-c)"/></g>
      <rect x="14" y="29" width="72" height="34" rx="2" fill="url(#ih-e)"/><rect x="14" y="29" width="72" height="8" fill="#E2603E"/><rect x="14" y="37" width="72" height="1.4" fill="#F0B23C"/>
      <path d="M20 43c9-.8 20 .6 34-.4M20 48c7-.5 14 .3 22-.2" stroke="#24336E" stroke-opacity=".8" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <rect x="30" y="51" width="40" height="11" rx="5.5" fill="#111216"/><rect x="41" y="54" width="18" height="5" fill="#5A3A22"/>
      <circle cx="37" cy="56.5" r="4.8" fill="#F2F2F4"/><circle cx="37" cy="56.5" r="1.8" fill="#2A2A2E"/><circle cx="63" cy="56.5" r="4.8" fill="#F2F2F4"/><circle cx="63" cy="56.5" r="1.8" fill="#2A2A2E"/>
      <path d="M26 80L32 69H68L74 80Z" fill="#141519"/><circle cx="38" cy="75" r="1.7" fill="#000"/><circle cx="62" cy="75" r="1.7" fill="#000"/>
      <rect x="8" y="24" width="84" height="56" rx="5" fill="url(#ih-g)"/></g>`),

  // La Gramola: el frontal d'una gramola de nit, amb l'arc de neó encès i llums desenfocats al fons morat.
  gram: svg(`<defs><radialGradient id="ij-b" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#5B2A6E"/><stop offset="1" stop-color="#190826"/></radialGradient>
    <linearGradient id="ij-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A220F"/><stop offset=".5" stop-color="#9C5E33"/><stop offset="1" stop-color="#3A190A"/></linearGradient>
    <linearGradient id="ij-n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1A8"/><stop offset=".5" stop-color="#FF5FA8"/><stop offset="1" stop-color="#7A4CFF"/></linearGradient>
    <linearGradient id="ij-c" gradientUnits="userSpaceOnUse" x1="33" y1="0" x2="67" y2="0"><stop offset="0" stop-color="#8A8F96"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#7D838A"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#ij-b)"/>
    <g filter="url(#ig-boira)"><circle cx="12" cy="20" r="5" fill="#FF7FC6" opacity=".55"/><circle cx="88" cy="16" r="6" fill="#7FB8FF" opacity=".5"/><circle cx="86" cy="70" r="4" fill="#FFD36B" opacity=".45"/></g>
    <g filter="url(#ig-ombra)"><path d="M20 96V42a30 30 0 0 1 60 0v54z" fill="url(#ij-w)"/></g><path d="M20 96V42a30 30 0 0 1 60 0v54z" filter="url(#ig-fusta)" opacity=".45"/>
    <path d="M27 96V44a23 23 0 0 1 46 0v52" fill="none" stroke="url(#ij-n)" stroke-width="9" filter="url(#ig-boira)" opacity=".9"/>
    <path d="M27 96V44a23 23 0 0 1 46 0v52" fill="none" stroke="url(#ij-n)" stroke-width="3.6"/><path d="M27 96V44a23 23 0 0 1 46 0v52" fill="none" stroke="#fff" stroke-width="1" opacity=".7"/>
    <rect x="35" y="44" width="30" height="18" rx="2" fill="url(#ij-c)"/><rect x="37" y="46" width="26" height="14" rx="1.4" fill="#FFF3CF"/><path d="M40 50h20M40 54.5h14" stroke="#9C5E33" stroke-width="1.1"/>
    <path d="M34 70h32M34 76h32M34 82h32M34 88h32" stroke="url(#ij-c)" stroke-width="2.2"/>`),

  // La Cabina: un vúmetre de taula de mescles, d'esfera crema il·luminada per darrere, dins d'un marc d'alumini raspallat.
  cab: svg(`<defs><linearGradient id="ic-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9CCD1"/><stop offset=".5" stop-color="#8E939B"/><stop offset="1" stop-color="#5F646C"/></linearGradient>
    <radialGradient id="ic-e" cx=".5" cy=".85" r=".9"><stop offset="0" stop-color="#FFEFB8"/><stop offset=".6" stop-color="#F3D58E"/><stop offset="1" stop-color="#C79B4E"/></radialGradient>
    <linearGradient id="ic-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#ic-m)"/>${[...Array(25)].map((_, i) => `<path d="M0 ${i * 4 + 1}h100" stroke="#fff" stroke-opacity="${i % 3 ? .06 : .12}" stroke-width=".6"/>`).join('')}
    <g filter="url(#ig-ombra)"><rect x="9" y="14" width="82" height="62" rx="4" fill="#1E1F22"/></g>
    <rect x="12" y="17" width="76" height="56" rx="2.5" fill="url(#ic-e)"/><circle cx="50" cy="70" r="40" fill="#FFB347" opacity=".2" filter="url(#ig-boira)"/>
    <path d="M19.5 52A44 44 0 0 1 80.5 52" fill="none" stroke="#2A2218" stroke-width="1.2"/><path d="M63 40.5A44 44 0 0 1 80.5 52" fill="none" stroke="#C0322A" stroke-width="3.4"/>
    ${[-42, -32, -23, -14, -5, 4, 12, 20, 29, 38].map(a => { const r = a * Math.PI / 180, x1 = 50 + 44 * Math.sin(r), y1 = 84 - 44 * Math.cos(r), x2 = 50 + 39 * Math.sin(r), y2 = 84 - 39 * Math.cos(r);
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${a > 16 ? '#C0322A' : '#2A2218'}" stroke-width="1.2"/>`; }).join('')}
    <text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="10" fill="#2A2218">VU</text>
    <path d="M52 77L44 34" stroke="#000" stroke-opacity=".3" stroke-width="2" filter="url(#ig-boira2)"/><path d="M50 76L42.6 33" stroke="#151515" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="12" y="66" width="76" height="7" fill="#1E1F22"/><circle cx="50" cy="73" r="5" fill="#2E2F33"/><circle cx="48.8" cy="71.8" r="1.5" fill="#fff" opacity=".3"/>
    <rect x="12" y="17" width="76" height="56" rx="2.5" fill="url(#ic-g)"/>
    <g fill="#4A4E55"><circle cx="6" cy="8" r="2"/><circle cx="94" cy="8" r="2"/><circle cx="6" cy="92" r="2"/><circle cx="94" cy="92" r="2"/></g>`),
};
