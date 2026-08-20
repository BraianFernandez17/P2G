# Backend — Polo 2 Gestión

API REST en **Node.js + Express + PostgreSQL** para el proyecto que vive en
`../Code P2G/`. Este backend **no modifica nada de esa carpeta**: solo la
usa como fuente de verdad (`db/schema.sql`, `db/seed.sql`) y expone,
exactamente en los paths que ya estaban comentados en el frontend
(`fetch("/api/v1/...")`), los endpoints que le faltaban.

## Qué incluye

- Autenticación con JWT y contraseñas hasheadas con bcrypt.
- Los 4 módulos completos: pasantías, postulaciones, empresas (con
  aprobación del admin) y reservas institucionales.
- El solapamiento de horarios de las reservas **lo valida Postgres**, no
  el backend a mano: se apoya en el `EXCLUDE USING gist` que ya definía
  `db/schema.sql`. El backend solo traduce ese error a un 409 legible.
- El "puente" pasantías ↔ reservas: agendar la sala de una entrevista para
  una postulación en estado `selected`.
- Una migración propia (`src/db/migrations/`) que **no toca** `db/schema.sql`
  ni `db/seed.sql` originales, y solo agrega lo mínimo para que el login y
  el registro funcionen de verdad (ver más abajo, "Por qué existe la
  migración").

## Requisitos

- Node.js 18+
- PostgreSQL 14+ (local o vía Docker)

## Cómo levantarlo

### Opción A — Docker (recomendada, todo junto)

```bash
cd backend
docker compose up -d --build
```

Esto levanta Postgres + Adminer + la API en un solo paso, y ya carga
`schema.sql`, `seed.sql` y la migración del backend automáticamente. La API
queda en `http://localhost:3000`.

> Si ya tenías levantado el `docker-compose.yml` de `Code P2G/` por
> separado, bajalo primero (`docker compose down` parado en esa carpeta)
> para no chocar por los puertos 5432/8080.

### Opción B — Postgres local + API a mano

```bash
# 1. Instalar dependencias
cd backend
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env si tu Postgres no usa esos valores por defecto

# 3. Crear la base (una sola vez)
createdb polotec   # o el nombre que hayas puesto en DATABASE_URL

# 4. Cargar schema + seed + migración del backend
npm run db:init
#   (si no querés los datos de ejemplo: npm run db:init:no-seed)

# 5. Levantar la API
npm run dev     # con recarga automática (nodemon)
# o: npm start  # sin recarga
```

La API queda escuchando en `http://localhost:3000` (configurable con `PORT`
en `.env`).

## Cuentas de prueba (vía `db/seed.sql`)

Todas usan la contraseña **`demo1234`** (el backend reemplaza, al migrar,
el hash de mentira del seed por uno real):

| Rol | Email |
|---|---|
| Admin | `admin@polotec.edu.uy` |
| Profesor | `ana@polotec.edu.uy` |
| Empresa | `contacto@techcorp.com` |

(Ver `db/seed.sql` para el resto de las cuentas de ejemplo.)

## Por qué existe la migración

`src/db/migrations/001_backend_additions.sql` se aplica **después** de
`schema.sql` y `seed.sql` originales (nunca los edita) y arregla dos cosas
puntuales para que el backend sea real:

1. `courses` no tenía una columna para relacionar el `value` de cada
   `<option>` de `registro-estudiante.html` (ej. `tecnologo-informatica`)
   con la fila real. Se agrega `courses.slug` con esos mismos valores.
2. Los `password_hash` de `seed.sql` son un placeholder de mentira
   (`$2b$10$demoDemo...`), no un hash de verdad, así que ningún login iba a
   funcionar contra esos datos. Se reemplazan por el hash real de bcrypt
   para `demo1234`.

## Endpoints

Los que ya estaban comentados en el frontend original, más los que hacían
falta para completar cada flujo:

### Auth (`/api/v1/auth`)
| Método | Ruta | Rol |
|---|---|---|
| POST | `/login` | público |
| POST | `/register/student` | público |
| POST | `/register/company` | público |
| POST | `/register/professor` | público |
| GET | `/me` | autenticado |

### Carreras (`/api/v1/courses`)
| GET | `/` | público — reemplaza el `<select>` escrito a mano |

### Estudiante (`/api/v1/students`)
| GET | `/me` | student |

### Pasantías (`/api/v1/internships`)
| Método | Ruta | Rol |
|---|---|---|
| GET | `/` | público (solo publicadas, filtro `?modalidad=`) |
| GET | `/mine` | company (propias, con conteo de postulantes) |
| GET | `/:id` | público |
| POST | `/` | company (con cuenta `active`) |
| GET | `/:id/applications` | company dueña |
| POST | `/:id/applications` | student (postularse) |

### Postulaciones (`/api/v1/applications`)
| GET | `/me` | student |
| PATCH | `/:id` (body `{status}`) | company dueña o admin |

### Empresas — panel admin (`/api/v1/companies`)
| GET | `/?status=` | admin |
| PATCH | `/:id/approve` | admin |
| PATCH | `/:id/reject` | admin (deja `status = suspended`) |

### Recursos reservables (`/api/v1/resources`)
| GET | `/` | público |

### Reservas (`/api/v1/bookings`)
| Método | Ruta | Rol |
|---|---|---|
| GET | `/public` | público — agenda pública, solo aprobadas |
| GET | `/me` | professor/admin (propias) |
| GET | `/pending?tipo=` | admin (cola a aprobar) |
| POST | `/` | professor/admin |
| PATCH | `/:id/cancel` | dueño (si sigue `pending`) |
| PATCH | `/:id/approve` | admin |
| PATCH | `/:id/reject` | admin |

### Admin (`/api/v1/admin`)
| GET | `/stats` | resumen general (empresas, pasantías, postulaciones, reservas) |
| GET | `/applications` | vista agregada de todas las postulaciones |
| GET | `/interviews-pending` | postulaciones `selected` sin entrevista agendada |
| POST | `/interviews/:applicationId/schedule` | agenda la sala (crea la reserva ya `approved`) |

## Conectar esto al frontend

A propósito, **no toqué ningún archivo de `Code P2G/`**. Cuando quieras
conectar el frontend de verdad, cada `js/*.js` ya tiene comentado
exactamente qué `fetch(...)` va en lugar de cada mock (son los mismos
paths de la tabla de arriba) — es cuestión de reemplazar esos bloques de
datos hardcodeados por las llamadas reales usando el token que devuelve
`/api/v1/auth/login` en el header `Authorization: Bearer <token>`.
