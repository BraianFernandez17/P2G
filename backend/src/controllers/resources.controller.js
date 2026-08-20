/* ============================================================
   RESOURCES CONTROLLER
   list -> GET /api/v1/resources
   Reemplaza el arreglo "salones" escrito a mano en reservas.js.
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

const list = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, type, total_quantity
     FROM resources
     WHERE active = true
     ORDER BY type, name`
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      nombre: r.name,
      tipo: r.type,
      cantidadTotal: r.total_quantity,
    }))
  );
});

module.exports = { list };
