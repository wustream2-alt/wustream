const express = require('express');
const router = express.Router();

const { Movie, Series } = require('../models');
const fSearch = require('../fSearch');

/**
 * Standardized error response
 */
const sendError = (res, status, message, code, details = null) => {
    const payload = { success: false, message, code };
    if (details) payload.details = details;
    return res.status(status).json(payload);
};

// ====================================================================
//                      SEARCH MOVIES + SERIES
// ====================================================================

router.get('/', async (req, res) => {
    try {
        const titleQuery = req.query.title || '';

        // 1) External search function
        let searched = await fSearch(titleQuery);

        if (!Array.isArray(searched)) searched = [];

        // 2) Convert each search result to final structure
        const results = await Promise.all(
            searched.map(async (s) => {

                // Correct model mapping
                const model = s.type === 'tv' ? Series : Movie;

                // Fetch from DB using f_id
                const mv = await model.findOne({
                    where: { f_id: s.id }
                });

                // Clean release year
                const rawDate = s.releaseDate || s.firstAirDate || '';
                const year = rawDate.replace("$D", "").split('-')[0] || null;

                return {
                    id: mv ? mv.id : null,
                    title: s.title || null,
                    slug: s.slug || null,
                    genres: s.genres || [],
                    posterUrl: s.posterUrl || null,
                    backdropUrl: s.backdropUrl || null,

                    year,
                    releaseDate: s.releaseDate || null,
                    runtime: s.runtime || null,
                    type: s.type || "movie",

                    voteAverage: s.voteAverage || null,
                    voteCount: s.voteCount || null,
                    tmdbId: s.tmdbId || null,
                };
            })
        );

        // 3) Final Response
        return res.json({
            success: true,
            page: 1,
            totalPages: 1,
            totalResults: results.length,
            results
        });

    } catch (err) {
        console.error("🔥 UNEXPECTED SERVER ERROR:", err);

        return sendError(
            res,
            500,
            "Unexpected server error",
            "SERVER_CRASH",
            err.message
        );
    }
});

module.exports = router;
