// routes/apiList.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/apiListController");

router.get("/", controller.viewAll);

module.exports = router;
