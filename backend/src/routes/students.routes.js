const express = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/students.controller");

const router = express.Router();

router.get("/me", requireAuth, ctrl.me);

module.exports = router;
