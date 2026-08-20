/* ============================================================
   COMPANIES CONTROLLER (vista del admin)
   list    -> GET   /api/v1/companies              (admin)
   approve -> PATCH /api/v1/companies/:id/approve  (admin)
   reject  -> PATCH /api/v1/companies/:id/reject   (admin)
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const list = asyncHandler(async (req, res) => {
  const { status } = req.query; // opcional: pending_approval | active | suspended
  const params = [];
  let where = "1 = 1";
  if (status) {
    params.push(status);
    where = `status = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT id, legal_name, sector, status FROM companies WHERE ${where} ORDER BY legal_name`,
    params
  );

  res.json(
    rows.map((r) => ({ id: r.id, razonSocial: r.legal_name, sector: r.sector, estado: r.status }))
  );
});

const approve = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE companies SET status = 'active' WHERE id = $1 RETURNING id, legal_name, sector, status",
    [req.params.id]
  );
  if (rows.length === 0) throw new HttpError(404, "Empresa no encontrada.");
  res.json({ id: rows[0].id, razonSocial: rows[0].legal_name, sector: rows[0].sector, estado: rows[0].status });
});

// No existe un estado "rejected" propio para companies (ver CHECK
// en schema.sql: pending_approval / active / suspended), así que
// rechazar equivale a dejarla "suspended": no puede publicar
// pasantías, pero el registro histórico queda.
const reject = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE companies SET status = 'suspended' WHERE id = $1 RETURNING id, legal_name, sector, status",
    [req.params.id]
  );
  if (rows.length === 0) throw new HttpError(404, "Empresa no encontrada.");
  res.json({ id: rows[0].id, razonSocial: rows[0].legal_name, sector: rows[0].sector, estado: rows[0].status });
});

module.exports = { list, approve, reject };
