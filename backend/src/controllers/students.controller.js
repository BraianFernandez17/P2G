/* ============================================================
   STUDENTS CONTROLLER
   Cubre GET /api/v1/students/me, que es el fetch que ya estaba
   comentado arriba de todo en Code P2G/js/script.js.
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

// El frontend pinta una barra de "perfil completo" en %. La tabla
// students solo guarda datos discretos (cv_url, profile_completed),
// así que acá los convertimos a un porcentaje: 40% por tener el
// perfil básico (nombre + carrera, que siempre están), 30% más por
// tener CV cargado, 30% más si profile_completed está en true.
function calcularPorcentajePerfil(perfil) {
  let porcentaje = 40;
  if (perfil.cv_url) porcentaje += 30;
  if (perfil.profile_completed) porcentaje += 30;
  return Math.min(100, porcentaje);
}

const me = asyncHandler(async (req, res) => {
  if (req.user.role !== "student") {
    throw new HttpError(403, "Este endpoint es solo para estudiantes.");
  }

  const { rows } = await pool.query(
    `SELECT s.*, c.name AS course_name, c.slug AS course_slug
     FROM students s
     JOIN courses c ON c.id = s.course_id
     WHERE s.user_id = $1`,
    [req.user.sub]
  );
  const perfil = rows[0];
  if (!perfil) throw new HttpError(404, "Perfil de estudiante no encontrado.");

  const { rows: postCountRows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review', 'shortlisted')) AS en_revision,
       COUNT(*) AS total
     FROM applications WHERE student_id = $1`,
    [perfil.id]
  );

  res.json({
    id: perfil.id,
    nombre: `${perfil.first_name} ${perfil.last_name}`,
    email: req.user.email,
    carrera: perfil.course_name,
    carreraId: perfil.course_slug,
    cvUrl: perfil.cv_url,
    perfilCompleto: perfil.profile_completed,
    porcentajePerfil: calcularPorcentajePerfil(perfil),
    postulaciones: Number(postCountRows[0].total),
    postulacionesEnRevision: Number(postCountRows[0].en_revision),
  });
});

module.exports = { me };
