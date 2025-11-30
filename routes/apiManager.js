// routes/apiManager.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/apiQuotaController");

// Show dashboard
router.get("/", controller.renderManager);

// Apply changes
router.post("/update", controller.updateManager);

module.exports = router;
