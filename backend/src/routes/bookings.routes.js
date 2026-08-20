const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/bookings.controller");

const router = express.Router();

router.get("/public", ctrl.publicAgenda);
router.get("/me", requireAuth, ctrl.mine);
router.get("/pending", requireAuth, requireRole("admin"), ctrl.pending);
router.post("/", requireAuth, ctrl.create);
router.patch("/:id/cancel", requireAuth, ctrl.cancel);
router.patch("/:id/approve", requireAuth, requireRole("admin"), ctrl.approve);
router.patch("/:id/reject", requireAuth, requireRole("admin"), ctrl.reject);

module.exports = router;
