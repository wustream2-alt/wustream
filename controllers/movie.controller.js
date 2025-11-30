const { Movie, Op } = require('../models');

const fs = require('fs');
const path = require('path');
const fetchTrending = require('../tmds').fetchAll;
const filePath = path.resolve(__dirname, "../categorized-movies.json");
const axios = require('axios');
require('dotenv').config();
const db = require('../firebase/firebase');

const { generateMovieUrl } = require("../helpers/tokenHelper");
const getInfo = require('../info').getMovieDetails;

const API_KEY = process.env.MY_TMDB_API_KEY_2; // Your TMDb API key
const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, '../genres.json'))).genres;
// Read and parse the JSON
const movieCategories = JSON.parse(fs.readFileSync(filePath, "utf-8"))

// Get a single movie by ID with related data
exports.getMovieById = async (req, res, next) => {
  try {

    // Fetch movie with all relations in a single optimized call
    let movie = await Movie.findByPk(req.params.id);

    // Movie not found
    if (!movie) {

      // movie = await getAllMovieDetails(req.params.id);
      if (!movie) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      //return res.json(movie);

    }

    const { id, f_id } = movie;

    // If IMDb ID missing, trigger next middleware to fetch from TMDB/OMDb
    if (!movie.casts) {
      movie = await getInfo(id, f_id);
    }

    delete movie.published;
    delete movie.createdAt;
    delete movie.updatedAt;
    delete movie.go_id;
    delete movie.poster_path;
    delete movie.imdbRating;
    delete movie.numRatings;
    delete movie.published;

    // Generate URLs concurrently
    // Generate URLs concurrently
    const [downloadUrl, videoUrl] = await Promise.all([
      generateMovieUrl(movie.f_id, movie.title, 'movie', 'download', req.apiKey),
      generateMovieUrl(movie.f_id, movie.title, 'movie', 'watch', req.apiKey, movie.runtime)
    ]);

    movie.downloadUrl = downloadUrl;
    movie.videoUrl = videoUrl;
    delete movie.f_id;

    movie.type = 'movie';

    // ✅ Convert Sequelize model to plain JSON before sending
    res.json(movie);
  } catch (error) {
    console.error('❌ Error fetching movie:', error.message);
    res.status(500).json({ message: 'Error fetching movie', error: error.message });
  }
};



const getMovieDetails = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];


  let movies = await Movie.findAll({
    where: {
      f_id: (v) => v != null,
      tmdbId: (v) => ids.includes(v),
    },
    attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
  });

  movies = movies.filter(m => m.posterUrl !== null);

  movies = movies.map(movie => {
    try {
      if (typeof movie.genres === "string") {
        movie.genres = JSON.parse(movie.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
      movie.genres = []; // fallback if parsing fails
    }
    return movie;
  });


  return movies;
};


exports.getTrendingMovies = async (req, res) => {
  try {
    const [
      trendingToday,
      trendingWeek,
      topRated,
      nowPlaying
    ] = await Promise.all([
      getMovieDetails(movieCategories['trendingToday'].slice(0, 15)),
      getMovieDetails(movieCategories['trendingWeek'].slice(0, 15)),
      getMovieDetails(movieCategories['topRated'].slice(0, 15)),
      getMovieDetails(movieCategories['nowPlaying'].slice(0, 15)),
    ]);

    const data = [
      {
        type: 'featured',
        buttonText: 'VIEW MOVIE',
        data: trendingToday[0]
      },
      {
        type: 'movieList',
        title: 'TRENDING TODAY',
        category: 'trendingToday',
        movies: trendingToday
      },
      {
        type: 'featured',
        buttonText: 'VIEW MOVIE',
        data: trendingWeek[0]
      },
      {
        type: 'movieList',
        title: 'TRENDING THIS WEEK',
        category: 'trendingWeek',
        movies: trendingWeek
      },
      {
        type: 'featured',
        buttonText: 'VIEW MOVIE',
        data: topRated[0]
      },
      {
        type: 'movieList',
        title: 'TOP RATED',
        category: 'topRated',
        movies: topRated
      },
      {
        type: 'featured',
        buttonText: 'VIEW MOVIE',
        data: nowPlaying[0]
      },
      {
        type: 'movieList',
        title: 'NOW PLAYING',
        category: 'nowPlaying',
        movies: nowPlaying
      }
    ];

    res.json(data);

    // Call fetchTrending() without waiting for it
    fetchTrending().catch(err => console.error("fetchTrending error:", err));

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch trending movies.' });
  }
};



exports.groupByYear = async (req, res, next) => {
  const yearData = [];
  const currentYear = new Date().getFullYear();

  try {
    for (let year = currentYear; year >= 2005; year--) {
      let movies = await Movie.findAll({
        where: {
          releaseDate: (v) => {
            if (!v) return false; // handle null/undefined
            const date = new Date(v); // parse the ISO string
            if (isNaN(date)) return false; // invalid date
            return date.getFullYear() === Number(year);
          }
        },
        attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
        order: [['popularity', 'DESC']],
        limit: 15
      });

      movies = movies.filter(m => m.posterUrl !== null);
      movies = movies.map(movie => {
        try {
          if (typeof movie.genres === "string") {
            movie.genres = JSON.parse(movie.genres);
          }
        } catch (err) {
          console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
          movie.genres = []; // fallback if parsing fails
        }
        return movie;
      });
      yearData.push({
        year,
        movies
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
      message: 'Failed to group movies by year',
      error: error.message
    });
  }
};

exports.groupByGenre = async (req, res, next) => {
  const genreData = [];

  try {
    for (const genre of GENRES) {
      let movies = await Movie.findAll({
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
        attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
        order: [['popularity', 'DESC']],
        limit: 15
      });

      console.log(`Fetched ${movies.length} movies for genre: ${genre.name}`);

      movies = movies.filter(m => m.posterUrl !== null);
      movies = movies.map(movie => {
        try {
          if (typeof movie.genres === "string") {
            movie.genres = JSON.parse(movie.genres);
          }
        } catch (err) {
          console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
          movie.genres = []; // fallback if parsing fails
        }
        return movie;
      });
      genreData.push({
        genre: genre.name,
        genre_id: genre.id,
        movies
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
      message: 'Failed to group movies by genre',
      error: error.message
    });
  }
};


exports.getMoviesAZ = async (req, res) => {
  const page = parseInt(req.params.page) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    let { count, rows: movies } = await Movie.findAndCountAll({
      attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
      order: [['title', 'ASC']],
      limit,
      offset
    });

    movies = movies.filter(m => m.posterUrl !== null);
    movies = movies.map(movie => {
      try {
        if (typeof movie.genres === "string") {
          movie.genres = JSON.parse(movie.genres);
        }
      } catch (err) {
        console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
        movie.genres = []; // fallback if parsing fails
      }
      return movie;
    });
    res.json({
      success: true,
      page,
      totalPages: Math.ceil(count / limit),
      totalResults: count,
      movies
    });
  } catch (error) {
    console.error("❌ Error fetching A–Z movies:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch movies sorted A–Z",
      error: error.message
    });
  }
};


exports.getPopularMovies = async (req, res, next) => {
  const page = parseInt(req.params.page, 10) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  let { count, rows: movies } = await Movie.findAndCountAll({
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
      'releaseDate',
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
  movies = movies.filter(m => m.posterUrl !== null);
  movies = movies.map(movie => {
    try {
      if (typeof movie.genres === "string") {
        movie.genres = JSON.parse(movie.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
      movie.genres = []; // fallback if parsing fails
    }
    return movie;
  });

  res.json({ category: 'popular', page, totalPages, movies });

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
  const ids = movieCategories[category];

  if (!ids) return res.status(404).json({ error: 'Category not found' });

  const { items, totalPages } = await paginateArray(ids, page);
  const detailed = await getMovieDetails(items);

  res.json({ category, page: parseInt(page), totalPages, movies: detailed });
}
const CHUNK_SIZE = 500; // safe batch size for bulkCreate

async function saveMovies(movies) {
  try {
    const formattedMovies = movies.map(movie => ({
      ...movie,
      genres: movie.genre_ids || [],
    }));

    for (let i = 0; i < formattedMovies.length; i += CHUNK_SIZE) {
      const chunk = formattedMovies.slice(i, i + CHUNK_SIZE);

      await Movie.bulkCreate(chunk, {
        ignoreDuplicates: true, // only works if `id` is unique in DB
      });

      console.log(`✅ Saved ${chunk.length} movies (batch ${i / CHUNK_SIZE + 1})`);
    }

  } catch (error) {
    console.error("❌ Failed during bulk movie insert:", error.message);
  }
}
async function getMoviesByYear(year, page) {
  const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
    params: {
      api_key: API_KEY,
      sort_by: 'popularity.desc',
      primary_release_year: year,
      page
    }
  });

  let movies = response.data.results;

  movies = movies.filter(m => m.poster_path !== null);
  // Save all movies to the database
  await saveMovies(movies);
  return movies;
};

async function getMoviesByGenre(genreId, page) {
  const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
    params: {
      api_key: API_KEY,
      sort_by: 'popularity.desc',
      with_genres: genreId,
      page
    }
  });

  let movies = response.data.results;

  movies = movies.filter(m => m.poster_path !== null);
  // Save all movies to the database
  await saveMovies(movies);
  return movies;
};

exports.getYear = async (req, res) => {
  const year = req.params.year;
  const limit = 20;
  const page = parseInt(req.params.page, 10) || 1;
  const offset = (page - 1) * limit;

  let { count, rows: movies } = await Movie.findAndCountAll({
    where: {
      releaseDate: (v) => {
        if (!v) return false; // handle null/undefined
        const date = new Date(v); // parse the ISO string
        if (isNaN(date)) return false; // invalid date
        return date.getFullYear() === Number(year);
      }
    },
    attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
    order: [['popularity', 'DESC']],
    limit,
    offset
  });

  if (!movies.length) {
    movies = await getMoviesByYear(year, page);
  };

  movies = movies.filter(m => m.posterUrl !== null);
  movies = movies.map(movie => {
    try {
      if (typeof movie.genres === "string") {
        movie.genres = JSON.parse(movie.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
      movie.genres = []; // fallback if parsing fails
    }
    return movie;
  });
  res.json({
    success: true,
    page,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
    movies: movies
  });
}

exports.getGenre = async (req, res) => {

  const genre = req.query.genre;
  const limit = 20;
  const page = parseInt(req.params.page, 10) || 1;
  const offset = (page - 1) * limit;
  if (!genre) return res.status(404).json({ error: 'Genre not found' });

  let { count, rows: movies } = await Movie.findAndCountAll({
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
    attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
    order: [['popularity', 'DESC']],
    limit,
    offset
  });

  movies = movies.filter(m => m.posterUrl !== null);
  movies = movies.map(movie => {
    try {
      if (typeof movie.genres === "string") {
        movie.genres = JSON.parse(movie.genres);
      }
    } catch (err) {
      console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
      movie.genres = []; // fallback if parsing fails
    }
    return movie;
  });
  res.json({
    success: true,
    page,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
    movies: movies
  });
}


exports.getLatestMovies = async (req, res) => {
  try {
    const page = parseInt(req.params.page, 10) || 1;
    const limit = 30;
    const offset = (page - 1) * limit;

    const today = new Date();

    let { count, rows: movies } = await Movie.findAndCountAll({
      where: {
        releaseDate: (v) => v <= today,
        releaseDate: (v) => v != null,
      },
      attributes: ['id', 'title', 'slug', 'genres', 'posterUrl', 'backdropUrl', 'synopsis', 'releaseDate', 'runtime', 'type', 'mpaRating', 'voteAverage', 'tmdbId', 'voteCount'],
      order: [['releaseDate', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);
    movies = movies.filter(m => m.posterUrl !== null);
    movies = movies.map(movie => {
      try {
        if (typeof movie.genres === "string") {
          movie.genres = JSON.parse(movie.genres);
        }
      } catch (err) {
        console.error(`⚠️ Failed to parse genres for movie ID ${movie.id}:`, err.message);
        movie.genres = []; // fallback if parsing fails
      }
      return movie;
    });
    res.json({
      success: true,
      page,
      totalPages,
      totalResults: count,
      movies
    });

  } catch (error) {
    console.error('❌ Error fetching latest movies:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest movies',
      error: error.message
    });
  }
};






