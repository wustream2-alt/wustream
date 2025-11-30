const express = require('express');
const router = express.Router();
const tvController = require('../controllers/series.controller');
const getInfo = require('../info').getTvDetails;

 router.get('/grouped-by-year', tvController.groupByYear);
 router.get('/grouped-by-genre', tvController.groupByGenre);
 router.get('/a_z/:page', tvController.getTvsAZ);
 router.get('/latest/:page', tvController.getLatestTvs);
 router.get('/categories/:category/:page', tvController.getCategory);
 router.get('/trending/:page', (req, res, next) => {
     req.params.category = 'trendingToday';
     next(); // IMPORTANT!
 }, tvController.getCategory);
 router.get('/year/:year/:page', tvController.getYear);
// router.get('/', tvController.getAllTvs);
router.get('/genre/:page', tvController.getGenre);
router.get('/categories', tvController.getTrendingTvs);
router.get('/popular/:page', tvController.getPopularTvs);
router.get('/id/:id', tvController.getTvById, getInfo);

module.exports = router;
