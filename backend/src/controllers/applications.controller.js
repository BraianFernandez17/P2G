/* ============================================================
   APPLICATIONS CONTROLLER
   apply        -> POST  /api/v1/internships/:id/applications (estudiante)
   mine         -> GET   /api/v1/applications/me              (estudiante)
   updateStatus -> PATCH /api/v1/applications/:id             (empresa dueña o admin)
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const ESTADOS_VALIDOS = ["submitted", "under_review", "shortlisted", "selected", "rejected", "withdrawn"];

const apply = asyncHandler(async (req, res) => {
  if (req.user.role !== "student") throw new HttpError(403, "Solo estudiantes pueden postularse.");

  const { rows: studentRows } = await pool.query(
    "SELECT id FROM students WHERE user_id = $1",
    [req.user.sub]
  );
  const student = studentRows[0];
  if (!student) throw new HttpError(404, "Perfil de estudiante no encontrado.");

  const { rows: internshipRows } = await pool.query(
    "SELECT id, status FROM internships WHERE id = $1",
    [req.params.id]
  );
  const pasantia = internshipRows[0];
  if (!pasantia) throw new HttpError(404, "Pasantía no encontrada.");
  if (pasantia.status !== "published") {
    throw new HttpError(400, "Esta pasantía ya no está abierta a postulaciones.");
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO applications (student_id, internship_id)
       VALUES ($1, $2) RETURNING *`,
      [student.id, req.params.id]
    );
    res.status(201).json({ id: rows[0].id, estado: rows[0].status });
  } catch (err) {
    if (err.code === "23505") {
      throw new HttpError(409, "Ya estás postulado a esta pasantía.");
    }
    throw err;
  }
});

const mine = asyncHandler(async (req, res) => {
  if (req.user.role !== "student") throw new HttpError(403, "Solo estudiantes pueden ver esto.");

  const { rows: studentRows } = await pool.query(
    "SELECT id FROM students WHERE user_id = $1",
    [req.user.sub]
  );
  const student = studentRows[0];
  if (!student) throw new HttpError(404, "Perfil de estudiante no encontrado.");

  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.applied_at, i.title, c.legal_name AS empresa
     FROM applications a
     JOIN internships i ON i.id = a.internship_id
     JOIN companies c ON c.id = i.company_id
     WHERE a.student_id = $1
     ORDER BY a.applied_at DESC`,
    [student.id]
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      titulo: r.title,
      empresa: r.empresa,
      estado: r.status,
      postuladoEl: r.applied_at,
    }))
  );
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!ESTADOS_VALIDOS.includes(status)) {
    throw new HttpError(400, `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}.`);
  }

  const { rows: appRows } = await pool.query(
    `SELECT a.id, i.company_id
     FROM applications a
     JOIN internships i ON i.id = a.internship_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  const application = appRows[0];
  if (!application) throw new HttpError(404, "Postulación no encontrada.");

  if (req.user.role === "company") {
    const { rows } = await pool.query("SELECT id FROM companies WHERE user_id = $1", [req.user.sub]);
    if (!rows[0] || rows[0].id !== application.company_id) {
      throw new HttpError(403, "Esta postulación no corresponde a tu empresa.");
    }
  } else if (req.user.role !== "admin") {
    throw new HttpError(403, "No tenés permiso para cambiar el estado de esta postulación.");
  }

  const { rows } = await pool.query(
    "UPDATE applications SET status = $1 WHERE id = $2 RETURNING id, status",
    [status, req.params.id]
  );

  res.json({ id: rows[0].id, estado: rows[0].status });
});

module.exports = { apply, mine, updateStatus };
