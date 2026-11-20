// Ajustos únics de l'arxiu que no són estructura (cap migració, CALCUL no es toca): cadascun es marca a meta i no torna a
// passar en cap mòbil. Viu aquí perquè els fitxers grans no creixin (ACT-756).

// ACT-793 a (decisió de Ricard, 19-11): els discos que han estat en rotació i ja no hi són prenen la data d'ara a
// Edició.data_referencia_rotacio, perquè l'oferta d'entrar (cinc escoltes des d'aquesta data) no surti amb escoltes
// d'abans de treure'ls (cas Cobham). «Han estat en rotació» = no hi són i tenen data: els que entren només a l'arxiu
// per la safata la tenen buida (decisió de construcció de Claude, per ratificar).
export const AJUST_793 = 'ajust-ref-rotacio-793a';
export const ajust793Fet = db => {
  const st = db.prepare('SELECT 1 FROM meta WHERE clau = ?'); st.bind([AJUST_793]); const fet = st.step(); st.free(); return fet;
};
export const ajusta793 = db => {
  const ara = new Date().toISOString();
  db.run('UPDATE edicio SET data_referencia_rotacio = ? WHERE rotacio_actual = 0 AND data_referencia_rotacio IS NOT NULL', [ara]);
  const n = db.getRowsModified();
  db.run('INSERT OR REPLACE INTO meta (clau, valor) VALUES (?, ?)', [AJUST_793, JSON.stringify({ data: ara, discos: n })]);
  return n;
};
