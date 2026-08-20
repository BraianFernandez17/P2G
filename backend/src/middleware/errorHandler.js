/* ============================================================
   MANEJO CENTRALIZADO DE ERRORES
   asyncHandler evita el try/catch repetido en cada controlador:
   envuelve la función async y, si tira una excepción, se la pasa
   a next(), que termina acá.
   ============================================================ */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Errores conocidos de Postgres que conviene traducir a un mensaje
// entendible en vez de devolver el error crudo de la base.
const PG_ERROR_MESSAGES = {
  "23505": "Ya existe un registro con esos datos (violación de unicidad).",
  "23503": "El registro referenciado no existe (violación de clave foránea).",
  "23514": "Los datos no cumplen una regla de la base (violación de CHECK).",
  "exclusion_violation": "Ese horario se solapa con otra reserva para el mismo recurso.",
};

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  // Error de exclusión (solapamiento de reservas): Postgres lo
  // reporta con code 23P01.
  if (err.code === "23P01") {
    return res.status(409).json({
      error: "Ese horario se solapa con otra reserva para el mismo recurso.",
    });
  }

  if (err.code && PG_ERROR_MESSAGES[err.code]) {
    return res.status(400).json({ error: PG_ERROR_MESSAGES[err.code], detalle: err.detail });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  return res.status(500).json({ error: "Error interno del servidor." });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { asyncHandler, errorHandler, HttpError };
