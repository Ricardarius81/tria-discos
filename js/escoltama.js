// L'escolta a mà (obra II, v1.57, ACT-839, ACT-840 2).
// Un botó crea l'escolta directament, sense ListenBrainz: canal CD, vinil o streaming, i amb streaming es tria el canal
// d'escolta. Hora d'inici per defecte «ara menys Edició.durada_total» (o la durada de la part viva), editable. Compta sempre
// com a disc sencer (completitud 1). Avís de possible duplicat si ja hi ha una escolta de ListenBrainz d'aquest disc a prop
// d'aquesta hora. Context i atenció a la mateixa fulla.
// Camps: Escolta.origen ('a mà'), Escolta.canal, Escolta.data_hora, Escolta.completitud, Escolta.context, Escolta.atencio,
// Escolta.part_id, Escolta.unio (buit: no és de cap unió del recàlcul, que mai la toca).
// «A prop» (decisió de construcció, per ratificar): una escolta de ListenBrainz de la mateixa edició que comença a menys d'una
// durada del disc de l'inici triat, abans o després. Avisa, no impedeix: es pot apuntar igualment.
const files = (db, sql, p = []) => {
  const st = db.prepare(sql); st.bind(p); const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free(); return out;
};
export const CANALS_MA = ['CD', 'vinil', 'streaming'];

// La durada que es fa servir: la de la part viva, si n'hi ha, i si no la de l'edició.
export function duradaDe(db, edicioId) {
  const e = files(db, `SELECT e.durada_total AS d, (SELECT p.durada FROM part p WHERE p.edicio_id = e.id AND p.rotacio_actual = 1) AS dp,
                              (SELECT p.id FROM part p WHERE p.edicio_id = e.id AND p.rotacio_actual = 1) AS part
                       FROM edicio e WHERE e.id = ?`, [edicioId])[0];
  return { min: e?.dp || e?.d || 0, part: e?.part || null };
}
export const iniciPerDefecte = (min, ara = Date.now()) => new Date(ara - min * 60000);

export function duplicat(db, edicioId, inici) {
  const { min } = duradaDe(db, edicioId), t = new Date(inici).getTime(), marge = Math.max(min, 1) * 60000;
  return files(db, "SELECT id, data_hora FROM escolta WHERE edicio_id = ? AND origen = 'listenbrainz' ORDER BY data_hora DESC", [edicioId])
    .find(x => Math.abs(new Date(x.data_hora).getTime() - t) < marge) || null;
}

// canal: 'CD', 'vinil' o la clau d'un canal d'streaming ('amazon', 'youtube'…). Torna { duplicat } sense escriure res si
// n'hi ha un i no es força, o { id }.
export const apunta = ({ edicioId, canal, inici, context, atencio, forca = false }) => db => {
  if (!canal) return { error: 'Tria el canal.' };
  const d = new Date(inici); if (isNaN(d)) return { error: 'L\'hora d\'inici no és bona.' };
  if (!forca) { const x = duplicat(db, edicioId, d); if (x) return { duplicat: x }; }
  const { part } = duradaDe(db, edicioId);
  db.run(`INSERT INTO escolta (edicio_id, part_id, data_hora, canal, context, atencio, completitud, compte, unio, origen)
          VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL, 'a mà')`, [edicioId, part, d.toISOString(), canal, context || null, atencio || null]);
  return { id: files(db, 'SELECT last_insert_rowid() AS id')[0].id };
};
