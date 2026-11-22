// La barra de progrés dins l'avís de dalt (22/11, Ricard: «Mejor la barra», ACT-841 3; abans, un avís de text any a any).
// Primer ús: «Descarrega l'Excel», que baixa els fitxers d'any un a un (cada any, més lent). Fitxer propi (ACT-756).
// pinta(i, n, txt): la barra a i/n (de 0 a 100 %) i el text a l'avís, que es queda obert mentre dura. treu(): l'amaga; ho fa
// avisa() en acabar, perquè l'avís següent no hereti una barra vella.
export function pinta(i, n, txt) {
  const av = document.getElementById('avis'); if (!av) return 0;
  let b = document.getElementById('avisBarra');
  if (!b) { b = document.createElement('span'); b.id = 'avisBarra'; b.className = 'avis-barra'; b.innerHTML = '<i></i>'; av.appendChild(b); }
  const pct = n > 0 ? Math.round(Math.min(Math.max(i, 0), n) / n * 100) : 0;
  b.style.display = 'block'; b.firstChild.style.width = pct + '%';
  if (txt) document.getElementById('avisTxt').textContent = txt;
  const bt = document.getElementById('avisBt'); if (bt) bt.style.display = 'none';
  clearTimeout(window._t); av.classList.add('obert');
  return pct;
}
export function treu() { const b = document.getElementById('avisBarra'); if (b) b.style.display = 'none'; }
