const express = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", ctrl.login);
router.post("/register/student", ctrl.registerStudent);
router.post("/register/company", ctrl.registerCompany);
router.post("/register/professor", ctrl.registerProfessor);
router.get("/me", requireAuth, ctrl.me);

module.exports = router;
