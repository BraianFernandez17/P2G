const express = require("express");
const ctrl = require("../controllers/resources.controller");

const router = express.Router();

router.get("/", ctrl.list);

module.exports = router;
