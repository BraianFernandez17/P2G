const express = require("express");
const ctrl = require("../controllers/courses.controller");

const router = express.Router();

router.get("/", ctrl.list);

module.exports = router;
