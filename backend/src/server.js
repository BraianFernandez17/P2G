require("dotenv").config();
const app = require("./app");
const { pool } = require("./config/db");

const PORT = process.env.PORT || 3000;

async function start() {
  // Falla rápido y con un mensaje claro si la base no está
  // disponible, en vez de levantar el server y recién enterarse
  // en el primer request.
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("✘ No se pudo conectar a PostgreSQL. Revisá DATABASE_URL en .env");
    console.error(err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✔ API de Polo 2 Gestión escuchando en http://localhost:${PORT}`);
  });
}

start();
