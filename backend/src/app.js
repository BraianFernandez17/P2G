/* ============================================================
   APP
   Configura Express y monta cada grupo de rutas bajo /api/v1,
   siguiendo exactamente los paths que ya estaban comentados en
   el frontend (fetch("/api/v1/...")).
   ============================================================ */
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const coursesRoutes = require("./routes/courses.routes");
const studentsRoutes = require("./routes/students.routes");
const internshipsRoutes = require("./routes/internships.routes");
const applicationsRoutes = require("./routes/applications.routes");
const companiesRoutes = require("./routes/companies.routes");
const resourcesRoutes = require("./routes/resources.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const adminRoutes = require("./routes/admin.routes");

const { errorHandler } = require("./middleware/errorHandler");

const app = express();

const origenesPermitidos = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origenesPermitidos.length ? origenesPermitidos : true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/courses", coursesRoutes);
app.use("/api/v1/students", studentsRoutes);
app.use("/api/v1/internships", internshipsRoutes);
app.use("/api/v1/applications", applicationsRoutes);
app.use("/api/v1/companies", companiesRoutes);
app.use("/api/v1/resources", resourcesRoutes);
app.use("/api/v1/bookings", bookingsRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

app.use(errorHandler);

module.exports = app;
