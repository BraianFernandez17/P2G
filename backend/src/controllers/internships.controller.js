/* ============================================================
   INTERNSHIPS CONTROLLER
   list         -> GET  /api/v1/internships            (público, solo publicadas)
   getOne       -> GET  /api/v1/internships/:id         (público)
   mine         -> GET  /api/v1/internships/mine        (empresa dueña)
   create       -> POST /api/v1/internships             (empresa, "Versión real" de empresa.js)
   applicants   -> GET  /api/v1/internships/:id/applications (empresa dueña)
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

async function buscarCompanyIdDelUsuario(userId) {
  const { rows } = await pool.query("SELECT id, status FROM companies WHERE user_id = $1", [userId]);
  return rows[0];
}

const list = asyncHandler(async (req, res) => {
  const { modalidad } = req.query;
  const params = [];
  let where = "i.status = 'published'";

  if (modalidad && modalidad !== "todas") {
    params.push(modalidad);
    where += ` AND i.modality = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT i.id, i.title, i.modality, i.duration_months, i.published_at,
            c.legal_name AS company_name, c.sector AS company_sector
     FROM internships i
     JOIN companies c ON c.id = i.company_id
     WHERE ${where}
     ORDER BY i.published_at DESC NULLS LAST`,
    params
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      titulo: r.title,
      empresa: r.company_name,
      sector: r.company_sector,
      modalidad: r.modality,
      duracionMeses: r.duration_months,
    }))
  );
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, c.legal_name AS company_name, c.sector AS company_sector
     FROM internships i
     JOIN companies c ON c.id = i.company_id
     WHERE i.id = $1`,
    [req.params.id]
  );
  const pasantia = rows[0];
  if (!pasantia) throw new HttpError(404, "Pasantía no encontrada.");

  res.json({
    id: pasantia.id,
    titulo: pasantia.title,
    empresa: pasantia.company_name,
    sector: pasantia.company_sector,
    modalidad: pasantia.modality,
    duracionMeses: pasantia.duration_months,
    estado: pasantia.status,
  });
});

const mine = asyncHandler(async (req, res) => {
  if (req.user.role !== "company") throw new HttpError(403, "Solo empresas pueden ver esto.");

  const company = await buscarCompanyIdDelUsuario(req.user.sub);
  if (!company) throw new HttpError(404, "Perfil de empresa no encontrado.");

  const { rows } = await pool.query(
    `SELECT i.id, i.title, i.modality, i.duration_months, i.status,
            COUNT(a.id) AS postulantes
     FROM internships i
     LEFT JOIN applications a ON a.internship_id = i.id
     WHERE i.company_id = $1
     GROUP BY i.id
     ORDER BY i.published_at DESC NULLS LAST`,
    [company.id]
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      titulo: r.title,
      modalidad: r.modality,
      duracionMeses: r.duration_months,
      estado: r.status,
      postulantes: Number(r.postulantes),
    }))
  );
});

const create = asyncHandler(async (req, res) => {
  if (req.user.role !== "company") throw new HttpError(403, "Solo empresas pueden publicar pasantías.");

  const { titulo, modalidad, duracionMeses } = req.body;
  if (!titulo || !modalidad || !duracionMeses) {
    throw new HttpError(400, "Completá todos los campos para publicar la pasantía.");
  }

  const company = await buscarCompanyIdDelUsuario(req.user.sub);
  if (!company) throw new HttpError(404, "Perfil de empresa no encontrado.");
  if (company.status !== "active") {
    throw new HttpError(
      403,
      "Tu cuenta todavía está pendiente de aprobación del Polo: no podés publicar pasantías hasta que te aprueben."
    );
  }

  let pasantia;
  try {
    const { rows } = await pool.query(
      `INSERT INTO internships (company_id, title, modality, duration_months, status, published_at)
       VALUES ($1, $2, $3, $4, 'published', now())
       RETURNING *`,
      [company.id, titulo.trim(), modalidad, duracionMeses]
    );
    pasantia = rows[0];
  } catch (err) {
    if (err.code === "23514") throw new HttpError(400, "La modalidad indicada no es válida.");
    throw err;
  }

  res.status(201).json({
    id: pasantia.id,
    titulo: pasantia.title,
    modalidad: pasantia.modality,
    duracionMeses: pasantia.duration_months,
    estado: pasantia.status,
  });
});

const applicants = asyncHandler(async (req, res) => {
  if (req.user.role !== "company") throw new HttpError(403, "Solo empresas pueden ver esto.");

  const company = await buscarCompanyIdDelUsuario(req.user.sub);
  if (!company) throw new HttpError(404, "Perfil de empresa no encontrado.");

  const { rows: internshipRows } = await pool.query(
    "SELECT id, title FROM internships WHERE id = $1 AND company_id = $2",
    [req.params.id, company.id]
  );
  if (internshipRows.length === 0) {
    throw new HttpError(404, "Pasantía no encontrada (o no te pertenece).");
  }

  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.applied_at,
            s.first_name, s.last_name, c.name AS course_name
     FROM applications a
     JOIN students s ON s.id = a.student_id
     JOIN courses c ON c.id = s.course_id
     WHERE a.internship_id = $1
     ORDER BY a.applied_at ASC`,
    [req.params.id]
  );

  res.json({
    pasantia: internshipRows[0].title,
    postulantes: rows.map((r) => ({
      id: r.id,
      nombre: `${r.first_name} ${r.last_name}`,
      carrera: r.course_name,
      estado: r.status,
      postuladoEl: r.applied_at,
    })),
  });
});

module.exports = { list, getOne, mine, create, applicants };
