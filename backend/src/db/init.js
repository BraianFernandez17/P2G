/* ============================================================
   INIT DB
   Aplica, en orden, sobre la base indicada por DATABASE_URL:
     1) Code P2G/db/schema.sql   (sin modificar)
     2) Code P2G/db/seed.sql     (sin modificar, opcional)
     3) src/db/migrations/*.sql  (ajustes propios del backend)

   Uso:
     node src/db/init.js            -> schema + seed + migraciones
     node src/db/init.js --no-seed  -> solo schema + migraciones
   ============================================================ */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const FRONTEND_DB_DIR = path.resolve(__dirname, "../../../Code P2G/db");
const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");

async function ejecutarArchivo(pool, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  console.log(`→ Ejecutando ${path.relative(process.cwd(), filePath)}`);
  await pool.query(sql);
}

async function main() {
  const incluirSeed = !process.argv.includes("--no-seed");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await ejecutarArchivo(pool, path.join(FRONTEND_DB_DIR, "schema.sql"));

    if (incluirSeed) {
      await ejecutarArchivo(pool, path.join(FRONTEND_DB_DIR, "seed.sql"));
    }

    const migraciones = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const archivo of migraciones) {
      await ejecutarArchivo(pool, path.join(MIGRATIONS_DIR, archivo));
    }

    console.log("✔ Base de datos inicializada correctamente.");
  } catch (err) {
    console.error("✘ Error inicializando la base de datos:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
