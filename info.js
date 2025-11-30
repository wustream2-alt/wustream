const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getDetails } = require('./details');
const { Movie, Op, Series } = require('./models');
const { where } = require('sequelize');

const MAX_RETRIES = 3;

/* ------------------------------------------------
   FETCH DETAILS WITH RETRIES
--------------------------------------------------- */
async function fetchInfo(movieId, attempt = 1) {
  try {
    const details = await getDetails(movieId);
    return details ?? null;
  } catch (err) {
    if (attempt < MAX_RETRIES) return fetchInfo(movieId, attempt + 1);
    return null;
  }
}

/* ------------------------------------------------
   WATCH PROVIDERS EXTRACTOR
--------------------------------------------------- */
async function fetchWatchProviders(results) {
  if (!results || typeof results !== "object") return [];

  const seen = new Set();
  const uniqueProviders = [];

  for (const countryCode in results) {
    const info = results[countryCode];
    if (!info) continue;

    for (const typeKey of Object.keys(info)) {
      const providers = info[typeKey];

      if (Array.isArray(providers)) {
        for (const provider of providers) {
          const { provider_id, provider_name, logo_path } = provider;

          if (!seen.has(provider_id)) {
            seen.add(provider_id);
            uniqueProviders.push({
              provider_id,
              provider_name,
              type: typeKey,
              logo: `https://image.tmdb.org/t/p/w500${logo_path}`,
            });
          }
        }
      }
    }
  }

  return uniqueProviders;
}

/* ------------------------------------------------
   FILTER MOVIE ATTRIBUTES
--------------------------------------------------- */
async function filterMovieAttributes(url, id) {
  let movie = await fetchInfo(url);
  if (!movie) {
    console.error(`❌ Failed to fetch movie details for: ${url}`);
    return null;
  }

  const providers = await fetchWatchProviders(movie.watchProviders?.results || {});
  movie.watchProviders = providers;

  // Remove unwanted fields
  delete movie.createdAt;
  delete movie.updatedAt;
  delete movie._count;
  delete movie.favorite;
  delete movie.lastAiredEpisode;
  delete movie.clicksCount;
  delete movie.published;

  movie.f_id = movie.id;
  movie.id = id;

  movie.videos = (movie.videos || []).map(v => ({
    name: v.name,
    key: v.key,
    site: v.site,
  }));

  movie.casts = (movie.casts || []).map(cast => ({
    character: cast.character,
    profilePath: cast.profileUrl,
    name: cast.name,
  }));

  movie.crew = (movie.crew || []).map(crew => ({
    profilePath: crew.profileUrl,
    name: crew.name,
    job: crew.job,
  }));

  movie.recommendations = await Promise.all(
    (movie.recommendations || []).map(async (rec) => {

      const mv = await Movie.findOne({
        where: { f_id: rec.id }
      });

      return {
        id: mv ? mv.id : null,
        title: rec.title,
        slug: rec.slug,
        genres: rec.genres,
        posterUrl: rec.posterUrl,
        backdropUrl: rec.backdropUrl,
        year: rec.releaseDate ? new Date(rec.releaseDate).getFullYear() : null,
        releaseDate: rec.releaseDate,
        runtime: rec.runtime,
        type: rec.type || "movie",
        voteAverage: rec.voteAverage,
        tmdbId: rec.tmdbId || null,
        voteCount: rec.voteCount || null,
      };
    })
  );

  movie.type = 'movie';

  return movie;
}

/* ------------------------------------------------
   FILTER TV ATTRIBUTES
--------------------------------------------------- */
async function filterTvAttributes(url, id) {
  let tv = await fetchInfo(url);
  if (!tv) {
    console.error(`❌ Failed to fetch TV details for: ${url}`);
    return null;
  }

  const providers = await fetchWatchProviders(tv.watchProviders?.results || {});
  tv.watchProviders = providers;

  delete tv.createdAt;
  delete tv.updatedAt;
  delete tv._count;
  delete tv.favorite;
  delete tv.lastAiredEpisode;

  tv.f_id = tv.id;
  tv.id = id;

  tv.seasons = (tv.seasons || []).map(season => {
    season.f_id = season.id;
    season.seriesId = id;

    delete season.id;
    delete season.createdAt;
    delete season.updatedAt;

    season.episodes = (season.episodes || []).map(ep => {
      ep.f_id = ep.id;
      delete ep.id;
      delete ep.createdAt;
      delete ep.updatedAt;
      delete ep.videoDownloadStatus;
      delete ep.videoDownloadTrialCount;
      delete ep.downloads;
      delete ep.views;
      delete ep.published;
      
      return ep;
    });

    return season;
  });

  tv.videos = (tv.videos || []).map(v => ({
    name: v.name,
    key: v.key,
    site: v.site,
  }));

  tv.casts = (tv.casts || []).map(cast => ({
    character: cast.character,
    profilePath: cast.profileUrl,
    name: cast.name,
  }));

  tv.crew = (tv.crew || []).map(crew => ({
    profilePath: crew.profileUrl,
    name: crew.name,
    job: crew.job,
  }));

  tv.recommendations = await Promise.all(
    (tv.recommendations || []).map(async (rec) => {

      const vv = await Series.findOne({
        where: { f_id: rec.id }
      });

      return {
        id: vv.id,
        title: rec.title,
        slug: rec.slug,
        genres: rec.genres,
        posterUrl: rec.posterUrl,
        backdropUrl: rec.backdropUrl,
        year: rec.firstAirDate ? new Date(rec.firstAirDate).getFullYear() : null,
        firstAirDate: rec.firstAirDate,
        runtime: rec.runtime,
        type: rec.type || 'tv',
        voteAverage: rec.voteAverage,
      };
    })
  );

  tv.type = 'tv';


  delete tv.clicksCount;
  delete tv.imdbId;
  delete tv.tmdbId;

  return tv;
}

/* ------------------------------------------------
   EXPORT MOVIE DETAILS
--------------------------------------------------- */
exports.getMovieDetails = async (id, f_id) => {
  try {
    const url = `https://www.films365.org/movie/${f_id}`;
    return await filterMovieAttributes(url, id);
  } catch (err) {
    return { message: 'Failed to fetch movie', error: err.message };
  }
};

/* ------------------------------------------------
   EXPORT TV DETAILS
--------------------------------------------------- */
exports.getTvDetails = async (id, f_id) => {
  try {
    const url = `https://www.films365.org/tv/${f_id}?season=1&episode=1`;
    return await filterTvAttributes(url, id);
  } catch (err) {
    return { message: 'Failed to fetch tv', error: err.message };
  }
};
