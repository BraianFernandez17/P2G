/* ============================================================
   ADMIN CONTROLLER
   stats             -> GET  /api/v1/admin/stats
   applications      -> GET  /api/v1/admin/applications        (vista agregada, dashboard-admin-pasantias.html)
   interviewsPending -> GET  /api/v1/admin/interviews-pending
   scheduleInterview -> POST /api/v1/admin/interviews/:applicationId/schedule
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const stats = asyncHandler(async (req, res) => {
  const [empresas, pasantias, postulaciones, reservas, salonesTop] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active') AS activas,
         COUNT(*) FILTER (WHERE status = 'pending_approval') AS pendientes
       FROM companies`
    ),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'published') AS publicadas FROM internships`),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('submitted','under_review','shortlisted')) AS en_revision,
              COUNT(*) FILTER (WHERE status = 'selected') AS seleccionadas
       FROM applications`
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pendientes,
              COUNT(*) FILTER (WHERE status = 'approved') AS aprobadas
       FROM bookings`
    ),
    pool.query(
      `SELECT res.name, COUNT(*) AS reservas
       FROM bookings b JOIN resources res ON res.id = b.resource_id
       WHERE b.status = 'approved'
       GROUP BY res.name ORDER BY reservas DESC LIMIT 3`
    ),
  ]);

  res.json({
    empresas: {
      activas: Number(empresas.rows[0].activas),
      pendientesDeAprobar: Number(empresas.rows[0].pendientes),
    },
    pasantiasPublicadas: Number(pasantias.rows[0].publicadas),
    postulaciones: {
      enRevision: Number(postulaciones.rows[0].en_revision),
      seleccionadas: Number(postulaciones.rows[0].seleccionadas),
    },
    reservas: {
      pendientes: Number(reservas.rows[0].pendientes),
      aprobadas: Number(reservas.rows[0].aprobadas),
    },
    salonesMasPedidos: salonesTop.rows.map((r) => ({ salon: r.name, reservas: Number(r.reservas) })),
  });
});

const applications = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.status, s.first_name, s.last_name, c.name AS course_name,
            i.title AS internship_title, comp.legal_name AS company_name
     FROM applications a
     JOIN students s ON s.id = a.student_id
     JOIN courses c ON c.id = s.course_id
     JOIN internships i ON i.id = a.internship_id
     JOIN companies comp ON comp.id = i.company_id
     ORDER BY a.applied_at DESC`
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      alumno: `${r.first_name} ${r.last_name}`,
      carrera: r.course_name,
      pasantia: r.internship_title,
      empresa: r.company_name,
      estado: r.status,
    }))
  );
});

// Postulaciones en estado "selected" que todavía no tienen una
// reserva de entrevista asociada (bookings.related_application_id).
const interviewsPending = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, s.first_name, s.last_name, i.title AS internship_title, comp.legal_name AS company_name
     FROM applications a
     JOIN students s ON s.id = a.student_id
     JOIN internships i ON i.id = a.internship_id
     JOIN companies comp ON comp.id = i.company_id
     WHERE a.status = 'selected'
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.related_application_id = a.id AND b.status IN ('pending', 'approved')
       )
     ORDER BY a.applied_at ASC`
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      nombreEstudiante: `${r.first_name} ${r.last_name}`,
      tituloPasantia: r.internship_title,
      nombreEmpresa: r.company_name,
    }))
  );
});

// Agenda la sala de entrevista para una postulación "selected".
// A diferencia del mock (que fijaba sala y horario a mano), acá el
// admin elige recurso y horario de verdad; nace en estado
// "approved" porque quien la pide es la misma autoridad que
// aprueba (mismo criterio que ya explica el comentario original
// en reservas.js).
const scheduleInterview = asyncHandler(async (req, res) => {
  const { resourceId, desde, hasta } = req.body;
  if (!resourceId || !desde || !hasta) {
    throw new HttpError(400, "Faltan el salón y el horario de la entrevista.");
  }
  if (new Date(hasta) <= new Date(desde)) {
    throw new HttpError(400, "La hora de fin tiene que ser posterior a la hora de inicio.");
  }

  const { rows: appRows } = await pool.query(
    `SELECT a.id, a.status, s.first_name, s.last_name, comp.legal_name AS company_name
     FROM applications a
     JOIN students s ON s.id = a.student_id
     JOIN internships i ON i.id = a.internship_id
     JOIN companies comp ON comp.id = i.company_id
     WHERE a.id = $1`,
    [req.params.applicationId]
  );
  const application = appRows[0];
  if (!application) throw new HttpError(404, "Postulación no encontrada.");
  if (application.status !== "selected") {
    throw new HttpError(400, "Solo se puede agendar entrevista para postulaciones en estado 'selected'.");
  }

  const motivo = `Entrevista: ${application.first_name} ${application.last_name} (${application.company_name})`;

  let inserted;
  try {
    const { rows } = await pool.query(
      `INSERT INTO bookings (resource_id, requested_by, title, starts_at, ends_at, status, related_application_id)
       VALUES ($1, $2, $3, $4, $5, 'approved', $6) RETURNING id`,
      [resourceId, req.user.sub, motivo, desde, hasta, req.params.applicationId]
    );
    inserted = rows[0];
  } catch (err) {
    if (err.code === "23503") throw new HttpError(400, "El salón indicado no existe.");
    throw err; // 23P01 -> ya hay otra reserva en ese horario para ese salón
  }

  res.status(201).json({ id: inserted.id, motivo, estado: "approved" });
});

module.exports = { stats, applications, interviewsPending, scheduleInterview };
