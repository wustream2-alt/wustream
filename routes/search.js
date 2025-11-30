const express = require('express');
const router = express.Router();
const { Movie, Series } = require('../models');

// -----------------------------
// Helper: Error Formatter
// -----------------------------
const sendError = (res, status, message, code, details = null) => {
    const payload = { success: false, message, code };
    if (details) payload.details = details;
    return res.status(status).json(payload);
};

// -----------------------------
// Helper: Normalize record
// -----------------------------
const normalizeRecord = (item, modelType) => {
    try {
        if (typeof item.genres === "string") {
            item.genres = JSON.parse(item.genres);
        }
    } catch (err) {
        console.error(`⚠️ Failed parsing genres for ID ${item.id}:`, err.message);
        item.genres = [];
    }

    // Convert series field to movie-like field for unified structure
    if (modelType === "series") {
        item.releaseDate = item.firstAirDate;
        item.type = "tv";
    }

    return item;
};

// -----------------------------
// Helper: Calculate match score
// -----------------------------
const calculateScore = (title, queryWords) => {
    let score = 0;
    const t = title.toLowerCase();

    queryWords.forEach(w => {
        if (t === w) score += 10;                 // Exact match
        else if (t.startsWith(w)) score += 6;     // Starts with
        else if (t.includes(w)) score += 3;       // Contains
    });

    return score;
};


// ========================================================
//               SEARCH MOVIE + SERIES COMBINED
// ========================================================
router.get('/', async (req, res) => {
    try {
        const titleQuery = req.query.title || '';
        const type = req.query.type || null; // "movie" or "tv"

        // Page validation
        const page = parseInt(req.params.page || req.query.page || "1", 10);
        if (isNaN(page) || page <= 0) {
            return sendError(res, 400, "Invalid page number. Must be positive integer.", "INVALID_PAGE");
        }

        const limit = 20;
        const offset = (page - 1) * limit;

        const words = titleQuery.toLowerCase().split(/\s+/);

        let movieResults = [];
        let seriesResults = [];

        // ----------------------------------------------------------
        // 1) Fetch MOVIES if type is null or "movie"

        if (!type || type === "movie") {
            try {
                const movieQuery = await Movie.findAll({
                    where: {
                        f_id: (v) => v != null,
                        title: (v) =>
                            typeof v === "string" &&
                            v.toLowerCase().includes(titleQuery.toLowerCase()),
                    },
                    order: [['popularity', 'DESC']],
                    attributes: [
                        'id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl',
                        'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating',
                        'voteAverage', 'tmdbId', 'voteCount'
                    ],
                });

                movieResults = movieQuery
                    .filter(m => m.posterUrl !== null)
                    .map(m => normalizeRecord(m, "movie"));
            } catch (err) {
                console.error("❌ MOVIE DB ERROR:", err);
                return sendError(res, 500, "Failed to fetch movies", "DATABASE_MOVIE_ERROR", err.message);
            }
        }

        // ----------------------------------------------------------
        // 2) Fetch SERIES if type is null or "tv"

        if (!type || type === "tv") {
            try {
                const seriesQuery = await Series.findAll({
                    where: {
                        f_id: (v) => v != null,
                        title: (v) =>
                            typeof v === "string" &&
                            v.toLowerCase().includes(titleQuery.toLowerCase()),
                    },
                    attributes: [
                        'id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl',
                        'synopsis', 'firstAirDate', 'runtime', 'voteAverage',
                        'tmdbId', 'voteCount'
                    ],
                });

                seriesResults = seriesQuery
                    .filter(s => s.posterUrl !== null)
                    .map(s => normalizeRecord(s, "series"));
            } catch (err) {
                console.error("❌ SERIES DB ERROR:", err);
                return sendError(res, 500, "Failed to fetch series", "DATABASE_SERIES_ERROR", err.message);
            }
        }

        // ----------------------------------------------------------
        // 3) Combine + Sort by match score

        let combined = [...movieResults, ...seriesResults];

        if (combined.length === 0) {
            return res.json({
                success: true,
                page,
                totalPages: 0,
                totalResults: 0,
                results: [],
                message: "No results found."
            });
        }

        combined = combined.map(item => ({
            ...item,
            matchScore: calculateScore(item.title, words)
        }));

        // Sort best match first
        combined.sort((a, b) => b.matchScore - a.matchScore);

        const totalResults = combined.length;
        const paginated = combined.slice(offset, offset + limit);

        // ----------------------------------------------------------
        // 4) Response
        return res.json({
            success: true,
            page,
            totalPages: Math.ceil(totalResults / limit),
            totalResults,
            results: paginated
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
