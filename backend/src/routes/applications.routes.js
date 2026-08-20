const express = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/applications.controller");

const router = express.Router();

router.get("/me", requireAuth, ctrl.mine);
router.patch("/:id", requireAuth, ctrl.updateStatus);

module.exports = router;
