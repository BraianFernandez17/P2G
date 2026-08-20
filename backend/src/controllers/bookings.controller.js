/* ============================================================
   BOOKINGS CONTROLLER
   mine     -> GET   /api/v1/bookings/me            (profesor/admin dueño)
   create   -> POST  /api/v1/bookings                (profesor/admin)
   cancel   -> PATCH /api/v1/bookings/:id/cancel     (dueño, si sigue pending)
   pending  -> GET   /api/v1/bookings/pending        (admin, cola a aprobar)
   approve  -> PATCH /api/v1/bookings/:id/approve    (admin)
   reject   -> PATCH /api/v1/bookings/:id/reject     (admin)
   publicAgenda -> GET /api/v1/bookings/public        (sin auth)

   El solapamiento de horarios NO se valida a mano acá: lo hace
   Postgres con el EXCLUDE USING gist definido en schema.sql. Si
   hay choque, el INSERT tira un error con code 23P01, que
   middleware/errorHandler.js traduce a un 409 legible.
   ============================================================ */
const { pool } = require("../config/db");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");

function mapRow(r) {
  return {
    id: r.id,
    salonId: r.resource_id,
    salon: r.resource_name,
    tipoSalon: r.resource_type,
    motivo: r.title,
    desde: r.starts_at,
    hasta: r.ends_at,
    estado: r.status,
    pedidaPor: r.requester_name,
    relacionConPostulacionId: r.related_application_id,
  };
}

const SELECT_BASE = `
  SELECT b.id, b.resource_id, b.title, b.starts_at, b.ends_at, b.status,
         b.related_application_id, b.requested_by,
         res.name AS resource_name, res.type AS resource_type,
         COALESCE(p.first_name || ' ' || p.last_name, 'Admin del Polo') AS requester_name
  FROM bookings b
  JOIN resources res ON res.id = b.resource_id
  LEFT JOIN professors p ON p.user_id = b.requested_by
`;

const mine = asyncHandler(async (req, res) => {
  if (!["professor", "admin"].includes(req.user.role)) {
    throw new HttpError(403, "Solo profesores o el admin pueden ver sus reservas.");
  }

  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE b.requested_by = $1 ORDER BY b.starts_at DESC`,
    [req.user.sub]
  );

  res.json(rows.map((r) => ({ ...mapRow(r), esMia: true })));
});

const create = asyncHandler(async (req, res) => {
  if (!["professor", "admin"].includes(req.user.role)) {
    throw new HttpError(403, "Solo profesores o el admin pueden pedir reservas.");
  }

  const { salonId, motivo, desde, hasta } = req.body;
  if (!salonId || !motivo || !desde || !hasta) {
    throw new HttpError(400, "Completá todos los campos para pedir la reserva.");
  }
  if (new Date(hasta) <= new Date(desde)) {
    throw new HttpError(400, "La hora de fin tiene que ser posterior a la hora de inicio.");
  }

  let inserted;
  try {
    const { rows } = await pool.query(
      `INSERT INTO bookings (resource_id, requested_by, title, starts_at, ends_at, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [salonId, req.user.sub, motivo.trim(), desde, hasta]
    );
    inserted = rows[0];
  } catch (err) {
    if (err.code === "23503") throw new HttpError(400, "El salón/recurso indicado no existe.");
    throw err; // el 23P01 (solapamiento) lo traduce errorHandler.js
  }

  const { rows } = await pool.query(`${SELECT_BASE} WHERE b.id = $1`, [inserted.id]);
  res.status(201).json({ ...mapRow(rows[0]), esMia: true });
});

const cancel = asyncHandler(async (req, res) => {
  const { rows: existentes } = await pool.query(
    "SELECT id, requested_by, status FROM bookings WHERE id = $1",
    [req.params.id]
  );
  const reserva = existentes[0];
  if (!reserva) throw new HttpError(404, "Reserva no encontrada.");
  if (reserva.requested_by !== req.user.sub && req.user.role !== "admin") {
    throw new HttpError(403, "Esta reserva no te pertenece.");
  }
  if (reserva.status !== "pending") {
    throw new HttpError(400, "Solo se pueden cancelar reservas que todavía están pendientes.");
  }

  const { rows } = await pool.query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING id, status",
    [req.params.id]
  );
  res.json({ id: rows[0].id, estado: rows[0].status });
});

const pending = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") throw new HttpError(403, "Solo el admin puede ver la cola de reservas.");

  const { tipo } = req.query;
  const params = [];
  let where = "b.status = 'pending'";
  if (tipo && tipo !== "todos") {
    params.push(tipo);
    where += ` AND res.type = $${params.length}`;
  }

  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE ${where} ORDER BY b.starts_at ASC`,
    params
  );
  res.json(rows.map(mapRow));
});

async function decidir(req, res, nuevoEstado) {
  if (req.user.role !== "admin") throw new HttpError(403, "Solo el admin puede aprobar o rechazar reservas.");

  const { rows } = await pool.query(
    "UPDATE bookings SET status = $1 WHERE id = $2 AND status = 'pending' RETURNING id, status",
    [nuevoEstado, req.params.id]
  );
  if (rows.length === 0) {
    throw new HttpError(404, "Reserva no encontrada o ya no está pendiente.");
  }
  res.json({ id: rows[0].id, estado: rows[0].status });
}

const approve = asyncHandler((req, res) => decidir(req, res, "approved"));
const reject = asyncHandler((req, res) => decidir(req, res, "rejected"));

// Agenda pública (agenda-publica.html): no requiere login, solo
// muestra qué está ocupado, no quién ni por qué en detalle.
const publicAgenda = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE b.status = 'approved' ORDER BY b.starts_at ASC`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      salon: r.resource_name,
      tipoSalon: r.resource_type,
      desde: r.starts_at,
      hasta: r.ends_at,
    }))
  );
});

module.exports = { mine, create, cancel, pending, approve, reject, publicAgenda };
