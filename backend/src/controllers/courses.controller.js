/* ============================================================
   COURSES CONTROLLER
   Endpoint público que reemplaza el <select> escrito a mano en
   registro-estudiante.html (ver el comentario ahí mismo que ya
   pedía GET /api/v1/courses).
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

const list = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, slug FROM courses ORDER BY name"
  );
  res.json(rows);
});

module.exports = { list };
