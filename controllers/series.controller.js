const { Series, RecommendedSeries, SeriesTrailer, SeriesCrew, SeriesCast, Season, Episode, Op } = require('../models');

const fs = require('fs');
const path = require('path');
const { where } = require('sequelize');
const fetchTrending = require('../trendingTv').fetchAll;
const filePath = path.resolve(__dirname, "../categorized-tvs.json");
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.MY_TMDB_API_KEY_2; // Your TMDb API key
const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, '../genres.json'))).genres;
// Read and parse the JSON
const tvCategories = JSON.parse(fs.readFileSync(filePath, "utf-8"))


const { generateMovieUrl } = require("../helpers/tokenHelper");
const getInfo = require('../info').getTvDetails;

// Get a single tv by ID with related data
exports.getTvById = async (req, res, next) => {
  try {

    // Fetch tv with all relations in a single optimized call
    let tv = await Series.findByPk(req.params.id)

    // Tv not found in local DB, fetch from TMDb
    if (!tv) {

      // tv = await getAllTvDetails(req.params.id);
      if (!tv) {
        return res.status(404).json({ message: 'Tv not found' });
      }
      //return res.json(tv);

    }

    const { id, f_id } = tv;

    // If IMDb ID missing, trigger next middleware to fetch from TMDB/OMDb
    if (!tv.seasons || tv.seasons.length === 0) {
      tv = await getInfo(id, f_id);
    }

    // Clean up unwanted fields

    delete tv.published;
    delete tv.createdAt;
    delete tv.updatedAt;
    delete tv.go_id;
    delete tv.poster_path;
    delete tv.imdbRating;
    delete tv.numRatings;
    delete tv.published;

    // Clean up unwanted fields from seasons
    // For a single TV object
    tv.seasons = await Promise.all(
      tv.seasons.map(async season => {
        delete season.id;
        delete season.createdAt;
        delete season.updatedAt;
        delete season.seriesId;

        if (season.episodes && Array.isArray(season.episodes)) {
          season.episodes = await Promise.all(
            season.episodes.map(async episode => {

              delete episode.createdAt;
              delete episode.updatedAt;
              delete episode.seasonId;
              delete episode.sourceUrl;
              delete episode.auxillarySourceUrl;

              const title = `${tv.title}-Sn${season.seasonNumber}-Ep${episode.episodeNumber}`;

              // Generate URLs concurrently
              const [downloadUrl, videoUrl] = await Promise.all([
                generateMovieUrl(episode.f_id, title, 'tv', 'download', req.apiKey),
                generateMovieUrl(episode.f_id, title, 'tv', 'watch', req.apiKey, episode.runtime || 60)
              ]);

              episode.downloadUrl = downloadUrl;
              episode.videoUrl = videoUrl;
              delete episode.f_id;


              return episode;
            })
          );
        }

        return season;
      })
    );


    tv.type = 'tv';

    // ✅ Convert Sequelize model to plain JSON before sending
    res.json(tv);
  } catch (error) {
    console.error('❌ Error fetching tv:', error.message);
    res.status(500).json({ message: 'Error fetching tv', error: error.message });
  }
};



const getTvDetails = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];


  let tvs = await Series.findAll({
    where: {
      f_id: (v) => v != null,
      tmdbId: (v) => ids.includes(v),
    },
    attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
  });

  tvs = tvs.filter(m => m.posterUrl !== null);

  tvs = tvs.map(tv => {
    try {
      if (typeof tv.genres === "string") {
        tv.genres = JSON.parse(tv.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
      tv.genres = []; // fallback if parsing fails
    }
    return tv;
  });


  return tvs;
};


exports.getTrendingTvs = async (req, res) => {
  try {
    // Fetch 16 tvs from each category
    const trendingToday = await getTvDetails(tvCategories['trendingToday'].slice(0, 15));
    const trendingWeek = await getTvDetails(tvCategories['trendingWeek'].slice(0, 15));
    const topRated = await getTvDetails(tvCategories['topRated'].slice(0, 15));
    const nowPlaying = await getTvDetails(tvCategories['onTheAir'].slice(0, 15));

    const data = [
      {
        type: 'featured',
        buttonText: 'VIEW Tv',
        data: trendingToday[0] // Use first item for featured
      },
      {
        type: 'movieList',
        title: 'TRENDING TODAY',
        category: 'trendingToday',
        tvs: trendingToday
      },
      {
        type: 'featured',
        buttonText: 'VIEW Tv',
        data: trendingWeek[0]
      },
      {
        type: 'movieList',
        title: 'TRENDING THIS WEEK',
        category: 'trendingWeek',
        tvs: trendingWeek
      },
      {
        type: 'featured',
        buttonText: 'VIEW Tv',
        data: topRated[0]
      },
      {
        type: 'movieList',
        title: 'TOP RATED',
        category: 'topRated',
        tvs: topRated
      },
      {
        type: 'featured',
        buttonText: 'VIEW Tv',
        data: nowPlaying[0]
      },
      {
        type: 'movieList',
        title: 'ON THE AIR',
        category: 'onTheAir',
        tvs: nowPlaying
      }
    ];

    res.json(data);

    await fetchTrending(); // calling the fetchAll function
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch trending tvs.' });
  }
};


exports.groupByYear = async (req, res, next) => {
  const yearData = [];
  const currentYear = new Date().getFullYear();

  try {
    for (let year = currentYear; year >= 2005; year--) {
      let tvs = await Series.findAll({
        where: {
          firstAirDate: (v) => {
            if (!v) return false; // handle null/undefined
            const date = new Date(v); // parse the ISO string
            if (isNaN(date)) return false; // invalid date
            return date.getFullYear() === Number(year);
          }
        },
        attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
        order: [['popularity', 'DESC']],
        limit: 15
      });

      tvs = tvs.filter(m => m.posterUrl !== null);
      tvs = tvs.map(tv => {
        try {
          if (typeof tv.genres === "string") {
            tv.genres = JSON.parse(tv.genres);
          }
        } catch (err) {
          console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
          tv.genres = []; // fallback if parsing fails
        }
        return tv;
      });
      yearData.push({
        year,
        tvs
      });
    }

    res.json({
      success: true,
      data: yearData
    });

  } catch (error) {
    console.error('❌ Error in groupByYear:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to group tvs by year',
      error: error.message
    });
  }
};

exports.groupByGenre = async (req, res, next) => {
  const genreData = [];

  try {
    for (const genre of GENRES) {
      let tvs = await Series.findAll({
        where: {
          genres: (arr) => {
            if (!arr) return false;
            if (typeof arr === "string" && arr.startsWith("[") && arr.endsWith("]")) {
              try {
                arr = JSON.parse(arr);
              } catch (err) {
                arr = [];
              }
            }
            return arr.some(g =>
              String(g).toLowerCase().includes(genre.name.toLowerCase())
            );
          }
        },
        attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
        order: [['popularity', 'DESC']],
        limit: 15
      });

      tvs = tvs.filter(m => m.posterUrl !== null);
      tvs = tvs.map(tv => {
        try {
          if (typeof tv.genres === "string") {
            tv.genres = JSON.parse(tv.genres);
          }
        } catch (err) {
          console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
          tv.genres = []; // fallback if parsing fails
        }
        return tv;
      });
      genreData.push({
        genre: genre.name,
        genre_id: genre.id,
        tvs
      });
    }

    res.json({
      success: true,
      data: genreData
    });

  } catch (error) {
    console.error('❌ Error in groupByGenre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to group tvs by genre',
      error: error.message
    });
  }
};


exports.getTvsAZ = async (req, res) => {
  const page = parseInt(req.params.page) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    let { count, rows: tvs } = await Series.findAndCountAll({
      attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
      order: [['title', 'ASC']],
      limit,
      offset
    });

    tvs = tvs.filter(m => m.posterUrl !== null);
    tvs = tvs.map(tv => {
      try {
        if (typeof tv.genres === "string") {
          tv.genres = JSON.parse(tv.genres);
        }
      } catch (err) {
        console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
        tv.genres = []; // fallback if parsing fails
      }
      return tv;
    });
    res.json({
      success: true,
      page,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
      tvs
    });
  } catch (error) {
    console.error("❌ Error fetching A–Z tvs:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tvs sorted A–Z",
      error: error.message
    });
  }
};

exports.getPopularTvs = async (req, res, next) => {
  const page = parseInt(req.params.page, 10) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  let { count, rows: tvs } = await Series.findAndCountAll({
    where: {
      // Add filters here if needed
    },
    attributes: [
      'id',
      'title',
      'slug',
      'genres',
      'posterUrl',
      'backdropUrl',
      'synopsis',
      'firstAirDate',
      'runtime',
      'type',
      'mpaRating',
      'voteAverage',
      'voteCount',

      'tmdbId',
      'popularity'
    ],
    order: [['popularity', 'DESC']], // ✅ sort by popularity descending
    limit,
    offset
  });


  const totalPages = Math.ceil(count / limit);
  tvs = tvs.filter(m => m.posterUrl !== null);
  tvs = tvs.map(tv => {
    try {
      if (typeof tv.genres === "string") {
        tv.genres = JSON.parse(tv.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
      tv.genres = []; // fallback if parsing fails
    }
    return tv;
  });

  res.json({ category: 'popular', page, totalPages, tvs });

};


async function paginateArray(data, page = 1, perPage = 30) {
  const start = (page - 1) * perPage;
  const end = start + perPage;

  return {
    page,
    totalPages: Math.ceil(data.length / perPage),
    items: data.slice(start, end),
  };
}

exports.getCategory = async (req, res) => {
  const { category, page = 1 } = req.params;
  const ids = tvCategories[category];

  if (!ids) return res.status(404).json({ error: 'Category not found' });

  const { items, totalPages } = await paginateArray(ids, page);
  const detailed = await getTvDetails(items);

  res.json({ category, page: parseInt(page), totalPages, tvs: detailed });
}
const CHUNK_SIZE = 500; // safe batch size for bulkCreate

async function saveTvs(tvs) {
  try {
    const formattedTvs = tvs.map(tv => ({
      ...tv,
      genres: tv.genre_ids || [],
    }));

    for (let i = 0; i < formattedTvs.length; i += CHUNK_SIZE) {
      const chunk = formattedTvs.slice(i, i + CHUNK_SIZE);

      await Series.bulkCreate(chunk, {
        ignoreDuplicates: true, // only works if `id` is unique in DB
      });

      console.log(`✅ Saved ${chunk.length} tvs (batch ${i / CHUNK_SIZE + 1})`);
    }

  } catch (error) {
    console.error("❌ Failed during bulk tv insert:", error.message);
  }
}
async function getTvsByYear(year, page) {
  const response = await axios.get('https://api.themoviedb.org/3/discover/tv', {
    params: {
      api_key: API_KEY,
      sort_by: 'popularity.desc',
      primary_release_year: year,
      page
    }
  });

  let tvs = response.data.results;

  tvs = tvs.filter(m => m.poster_path !== null);
  // Save all tvs to the database
  await saveTvs(tvs);
  return tvs;
};

async function getTvsByGenre(genreId, page) {
  const response = await axios.get('https://api.themoviedb.org/3/discover/tv', {
    params: {
      api_key: API_KEY,
      sort_by: 'popularity.desc',
      with_genres: genreId,
      page
    }
  });

  let tvs = response.data.results;

  tvs = tvs.filter(m => m.poster_path !== null);
  // Save all tvs to the database
  await saveTvs(tvs);
  return tvs;
};

exports.getYear = async (req, res) => {
  const year = req.params.year;
  const limit = 20;
  const page = parseInt(req.params.page, 10) || 1;
  const offset = (page - 1) * limit;

  let { count, rows: tvs } = await Series.findAndCountAll({
    where: {
      firstAirDate: (v) => {
        if (!v) return false; // handle null/undefined
        const date = new Date(v); // parse the ISO string
        if (isNaN(date)) return false; // invalid date
        return date.getFullYear() === Number(year);
      }
    },
    attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
    order: [['popularity', 'DESC']],
    limit,
    offset
  });

  if (!tvs.length) {
    tvs = await getTvsByYear(year, page);
  };

  tvs = tvs.filter(m => m.posterUrl !== null);
  tvs = tvs.map(tv => {
    try {
      if (typeof tv.genres === "string") {
        tv.genres = JSON.parse(tv.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
      tv.genres = []; // fallback if parsing fails
    }
    return tv;
  });
  res.json({
    success: true,
    page,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
    tvs: tvs
  });
}

exports.getGenre = async (req, res) => {

  const genre = req.query.genre;
  const limit = 20;
  const page = parseInt(req.params.page, 10) || 1;
  const offset = (page - 1) * limit;
  if (!genre) return res.status(404).json({ error: 'Genre not found' });
  let { count, rows: tvs } = await Series.findAndCountAll({
    where: {
      genres: (arr) => {
        // If it's a stringified array, parse it
        if (typeof arr === "string" && arr.startsWith("[") && arr.endsWith("]")) {
          try {
            arr = JSON.parse(arr);
          } catch (err) {
            arr = [];
          }
        }

        // Now check if array contains the genre (case-insensitive)
        return arr.some(g =>
          String(g).toLowerCase().includes(genre.toLowerCase())
        );
      }
    },
    attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
    order: [['popularity', 'DESC']],
    limit,
    offset
  });

  tvs = tvs.filter(m => m.posterUrl !== null);
  tvs = tvs.map(tv => {
    try {
      if (typeof tv.genres === "string") {
        tv.genres = JSON.parse(tv.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
      tv.genres = []; // fallback if parsing fails
    }
    return tv;
  });
  res.json({
    success: true,
    page,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
    tvs: tvs
  });
}


async function searchTvsFromTMDb(query, page) {
  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/tv', {
      params: {
        api_key: API_KEY,
        query: query,
        page: page,
        include_adult: false
      }
    });

    return response.data.results;
  } catch (error) {
    console.error('❌ TMDb search error:', error.message);
    return [];
  }
}

exports.getLatestTvs = async (req, res) => {
  try {
    const page = parseInt(req.params.page, 10) || 1;
    const limit = 30;
    const offset = (page - 1) * limit;

    const today = new Date();

    let { count, rows: tvs } = await Series.findAndCountAll({
      where: {
        firstAirDate: (v) => v <= today,
        firstAirDate: (v) => v != null,
      },
      attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'firstAirDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
      order: [['firstAirDate', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);
    tvs = tvs.filter(m => m.posterUrl !== null);
    tvs = tvs.map(tv => {
      try {
        if (typeof tv.genres === "string") {
          tv.genres = JSON.parse(tv.genres);
        }
      } catch (err) {
        console.error(`⚠️ Failed to parse genres for tv ID ${tv.id}:`, err.message);
        tv.genres = []; // fallback if parsing fails
      }
      return tv;
    });
    res.json({
      success: true,
      page,
      totalPages,
      totalResults: count,
      tvs
    });

  } catch (error) {
    console.error('❌ Error fetching latest tvs:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest tvs',
      error: error.message
    });
  }
};


exports.downloads = async (req, res) => {
  const { id, title } = req.params;

  if (!id || !title) {
    return res.status(400).send("Missing id or title parameter");
  }

  const originalUrl = `https://xstreamx.films365.org/tv/${id}/${title}`;

  console.log(`🎬 Proxying download request: ${originalUrl}`);

  try {
    const response = await axios({
      method: "GET",
      url: originalUrl,
      responseType: "stream",
      timeout: 60000,
    });

    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }

    const safeTitle = title.replace(/[^\w\s()-]/g, "").trim();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeTitle}.mp4"`
    );

    response.data.pipe(res);

    response.data.on("error", (err) => {
      console.error("Stream error:", err.message);
      res.end();
    });
  } catch (err) {
    console.error("❌ Download failed:", err.message);
    if (err.response) {
      res
        .status(err.response.status)
        .send(`Error fetching file: ${err.response.statusText}`);
    } else {
      res.status(500).send("Failed to download file");
    }
  }
};





