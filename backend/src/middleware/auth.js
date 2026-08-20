/* ============================================================
   AUTENTICACIÓN Y AUTORIZACIÓN
   requireAuth: exige un JWT válido en el header Authorization.
   requireRole: además, exige que el rol del token sea uno de los
   permitidos para esa ruta (ej: solo "company" puede publicar
   pasantías, solo "admin" puede aprobar reservas).
   ============================================================ */
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ error: "Falta el token de autenticación." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { sub: userId, role, email }
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o vencido." });
  }
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Falta el token de autenticación." });
    }
    if (!rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ error: "No tenés permiso para hacer esto." });
    }
    return next();
  };
}

// Igual que requireAuth, pero no falla si no hay token: solo deja
// req.user en null. Sirve para rutas públicas que además quieren
// personalizar la respuesta si hay sesión (no se usa por ahora,
// pero queda lista para agenda pública / listado de pasantías).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");

  if (tipo === "Bearer" && token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  return next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
