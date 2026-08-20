const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/admin.controller");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/stats", ctrl.stats);
router.get("/applications", ctrl.applications);
router.get("/interviews-pending", ctrl.interviewsPending);
router.post("/interviews/:applicationId/schedule", ctrl.scheduleInterview);

module.exports = router;
