const express = require('express');
const router = express.Router();
const castController = require('../controllers/cast.controller');

router.get('/:id', castController.getCastById);

module.exports = router;
