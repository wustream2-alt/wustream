const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movie.controller');

router.get('/grouped-by-year', movieController.groupByYear);
router.get('/grouped-by-genre', movieController.groupByGenre);
router.get('/a_z/:page', movieController.getMoviesAZ);
router.get('/latest/:page', movieController.getLatestMovies);
router.get('/categories/:category/:page', movieController.getCategory);
router.get('/trending/:page', (req, res, next) => {
    req.params.category = 'trendingToday';
    next(); // IMPORTANT!
}, movieController.getCategory);
router.get('/year/:year/:page', movieController.getYear);
router.get('/genre/:page', movieController.getGenre);
router.get('/categories', movieController.getTrendingMovies);
router.get('/popular/:page', movieController.getPopularMovies);
router.get('/id/:id', movieController.getMovieById);

module.exports = router;
