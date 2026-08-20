const express = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/internships.controller");
const applicationsCtrl = require("../controllers/applications.controller");

const router = express.Router();

// Importante: "/mine" tiene que ir ANTES que "/:id", si no Express
// interpreta "mine" como si fuera un :id.
router.get("/mine", requireAuth, ctrl.mine);
router.get("/", ctrl.list);
router.post("/", requireAuth, ctrl.create);
router.get("/:id", ctrl.getOne);
router.get("/:id/applications", requireAuth, ctrl.applicants);
router.post("/:id/applications", requireAuth, applicationsCtrl.apply);

module.exports = router;
