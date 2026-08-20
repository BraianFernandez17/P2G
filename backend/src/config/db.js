/* ============================================================
   CONEXIÓN A POSTGRESQL
   Un único pool de conexiones, reutilizado por todos los
   controladores. Usa DATABASE_URL (ver .env.example), que ya
   apunta a la misma base "polotec" que levanta el
   docker-compose.yml del proyecto original.
   ============================================================ */
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  // Un error acá es sobre una conexión ociosa del pool, no sobre
  // una query puntual (esas se manejan en cada controlador).
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

// Helper chiquito para no repetir pool.query en todos lados y para
// tener un único lugar donde loguear queries lentas si hace falta.
async function query(text, params) {
  return pool.query(text, params);
}

// Para operaciones que necesitan transacción (ej: crear una reserva
// y, si corresponde, marcar la postulación como agendada).
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultado = await callback(client);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
