const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/companies.controller");

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), ctrl.list);
router.patch("/:id/approve", requireAuth, requireRole("admin"), ctrl.approve);
router.patch("/:id/reject", requireAuth, requireRole("admin"), ctrl.reject);

module.exports = router;
