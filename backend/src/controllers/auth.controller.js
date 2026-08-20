/* ============================================================
   AUTH CONTROLLER
   Cubre exactamente los 4 endpoints que ya estaban comentados en
   Code P2G/js/autenticacion.js:
     POST /api/v1/auth/login
     POST /api/v1/auth/register/student
     POST /api/v1/auth/register/company
     POST /api/v1/auth/register/professor
   más GET /api/v1/auth/me para validar el token guardado.
   ============================================================ */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, withTransaction } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

const SALT_ROUNDS = 10;

function firmarToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// Arma el mismo "objeto de sesión" que hoy escribe a mano
// Code P2G/js/sesion.js (guardarSesion), para que conectar el
// frontend más adelante sea un cambio mínimo.
function armarSesion(user, perfil) {
  const base = { id: user.id, email: user.email, role: user.role };
  if (user.role === "student") {
    return { ...base, name: `${perfil.first_name} ${perfil.last_name}`, courseId: perfil.course_id };
  }
  if (user.role === "company") {
    return { ...base, name: perfil.legal_name, sector: perfil.sector, status: perfil.status };
  }
  if (user.role === "professor") {
    return { ...base, name: `${perfil.first_name} ${perfil.last_name}` };
  }
  return { ...base, name: "Administrador del Polo" };
}

async function buscarPerfilPorRol(userId, role) {
  if (role === "student") {
    const { rows } = await pool.query("SELECT * FROM students WHERE user_id = $1", [userId]);
    return rows[0];
  }
  if (role === "company") {
    const { rows } = await pool.query("SELECT * FROM companies WHERE user_id = $1", [userId]);
    return rows[0];
  }
  if (role === "professor") {
    const { rows } = await pool.query("SELECT * FROM professors WHERE user_id = $1", [userId]);
    return rows[0];
  }
  return null;
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new HttpError(400, "Email y contraseña son obligatorios.");
  }

  const { rows } = await pool.query(
    "SELECT id, email, role, password_hash FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );
  const user = rows[0];

  // Mismo mensaje genérico exista o no el email, para no filtrar
  // qué emails están registrados.
  if (!user) throw new HttpError(401, "Email o contraseña incorrectos.");

  const coincide = await bcrypt.compare(password, user.password_hash);
  if (!coincide) throw new HttpError(401, "Email o contraseña incorrectos.");

  const perfil = await buscarPerfilPorRol(user.id, user.role);
  const token = firmarToken(user);

  res.json({ token, user: armarSesion(user, perfil) });
});

const registerStudent = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, courseId } = req.body;

  if (!firstName || !lastName || !email || !password || !courseId) {
    throw new HttpError(400, "Faltan campos obligatorios.");
  }
  if (password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres.");
  }

  const { rows: cursoRows } = await pool.query(
    "SELECT id FROM courses WHERE slug = $1",
    [courseId]
  );
  if (cursoRows.length === 0) {
    throw new HttpError(400, "La carrera seleccionada no existe.");
  }

  const resultado = await withTransaction(async (client) => {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let userRow;
    try {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'student') RETURNING id, email, role`,
        [email.toLowerCase().trim(), passwordHash]
      );
      userRow = rows[0];
    } catch (err) {
      if (err.code === "23505") throw new HttpError(409, "Ese email ya está registrado.");
      throw err;
    }

    const { rows: studentRows } = await client.query(
      `INSERT INTO students (user_id, first_name, last_name, course_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userRow.id, firstName.trim(), lastName.trim(), cursoRows[0].id]
    );

    return { user: userRow, perfil: studentRows[0] };
  });

  const token = firmarToken(resultado.user);
  res.status(201).json({ token, user: armarSesion(resultado.user, resultado.perfil) });
});

const registerCompany = asyncHandler(async (req, res) => {
  const { legalName, sector, email, password } = req.body;

  if (!legalName || !sector || !email || !password) {
    throw new HttpError(400, "Faltan campos obligatorios.");
  }
  if (password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres.");
  }

  const resultado = await withTransaction(async (client) => {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let userRow;
    try {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'company') RETURNING id, email, role`,
        [email.toLowerCase().trim(), passwordHash]
      );
      userRow = rows[0];
    } catch (err) {
      if (err.code === "23505") throw new HttpError(409, "Ese email ya está registrado.");
      throw err;
    }

    // Toda empresa nueva arranca en pending_approval (ver aviso en
    // registro-empresa.html): no puede publicar pasantías hasta que
    // el admin la apruebe.
    let companyRow;
    try {
      const { rows } = await client.query(
        `INSERT INTO companies (user_id, legal_name, sector, status)
         VALUES ($1, $2, $3, 'pending_approval') RETURNING *`,
        [userRow.id, legalName.trim(), sector]
      );
      companyRow = rows[0];
    } catch (err) {
      if (err.code === "23514") throw new HttpError(400, "El rubro seleccionado no es válido.");
      throw err;
    }

    return { user: userRow, perfil: companyRow };
  });

  const token = firmarToken(resultado.user);
  res.status(201).json({ token, user: armarSesion(resultado.user, resultado.perfil) });
});

const registerProfessor = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    throw new HttpError(400, "Faltan campos obligatorios.");
  }
  if (password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres.");
  }

  const resultado = await withTransaction(async (client) => {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let userRow;
    try {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'professor') RETURNING id, email, role`,
        [email.toLowerCase().trim(), passwordHash]
      );
      userRow = rows[0];
    } catch (err) {
      if (err.code === "23505") throw new HttpError(409, "Ese email ya está registrado.");
      throw err;
    }

    const { rows: profRows } = await client.query(
      `INSERT INTO professors (user_id, first_name, last_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [userRow.id, firstName.trim(), lastName.trim()]
    );

    return { user: userRow, perfil: profRows[0] };
  });

  const token = firmarToken(resultado.user);
  res.status(201).json({ token, user: armarSesion(resultado.user, resultado.perfil) });
});

const me = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, role FROM users WHERE id = $1",
    [req.user.sub]
  );
  const user = rows[0];
  if (!user) throw new HttpError(404, "Usuario no encontrado.");

  const perfil = await buscarPerfilPorRol(user.id, user.role);
  res.json({ user: armarSesion(user, perfil) });
});

module.exports = { login, registerStudent, registerCompany, registerProfessor, me };
