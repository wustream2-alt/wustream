const fs = require("fs");
const axios = require("axios");
const path = require("path");
const { progressDB } = require("./progress");
const e = require("express");
require('dotenv').config();
const { Movie } = require('./models');

const OUTPUT_FILE = "categorized-movies.json";
const CONCURRENCY_LIMIT = 60;
const CHUNK_SIZE = 100;

// 🔥 ROTATING API KEYS
const API_KEYS = [
  process.env.MY_TMDB_API_KEY_1,
  process.env.MY_TMDB_API_KEY_2,
  process.env.MY_TMDB_API_KEY_3
].filter(Boolean);

let apiIndex = 0;
function getApiKey() {
  apiIndex = (apiIndex + 1) % API_KEYS.length;
  return API_KEYS[apiIndex];
}

const endpoints = {
  movies: {
    trendingToday: `https://api.themoviedb.org/3/trending/movie/day`,
    trendingWeek: `https://api.themoviedb.org/3/trending/movie/week`,
    topRated: `https://api.themoviedb.org/3/movie/top_rated`,
    nowPlaying: `https://api.themoviedb.org/3/movie/now_playing`,
  }
};

async function setNextFetchTime(time) {
  await progressDB.update({}, { $set: { nextFetchTime: time } }, { upsert: true });
}

async function getNextFetchTime() {
  const doc = await progressDB.findOne({});
  return doc ? doc.nextFetchTime : null;
}

async function getStatus() {
  const doc = await progressDB.findOne({});
  return doc ? doc.status : null;
}

async function setStatus(status) {
  await progressDB.updateOne({}, { $set: { status } }, { upsert: true });
}

function loadJSON(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const checkMovies = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  let movies = await Movie.findAll({
    where: {
      f_id: (v) => v != null,
      tmdbId: (v) => ids.includes(v),
    },
    attributes: ['tmdbId'],
  });

  return movies.map(movie => movie.tmdbId);
};

async function fetchPage(url, type, category, page, seen, allIDs, progress, key) {
  try {
    const API_KEY = getApiKey(); // 🔥 Rotate API key every request

    const res = await axios.get(`${url}?api_key=${API_KEY}&page=${page}`);
    const results = res.data.results || [];
    if (results.length === 0) return;

    results.sort((a, b) => {
      const dateA = new Date(a.release_date || '1900-01-01');
      const dateB = new Date(b.release_date || '1900-01-01');
      return dateB - dateA;
    });

    for (const item of results) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        allIDs[category].push(item.id);

        // FIX: must await checkMovies()
        allIDs[category] = await checkMovies(allIDs[category]);
      }
    }

    progress[key] = page + 1;
    console.log(`✅ ${key} page ${page}: added ${results.length} items`);

  } catch (err) {
    const message = err.response?.status || err.message;

    if (err.response?.status === 429) {
      console.warn(`⏳ Rate limited on ${key} page ${page}. Waiting 10s...`);
      await delay(10000);
      return fetchPage(url, type, category, page, seen, allIDs, progress, key);
    } else {
      console.warn(`⚠️ Skipping ${key} page ${page} due to error:`, message);
    }
  }
}

async function runQueue(tasks, limit) {
  let index = 0;
  async function next() {
    if (index >= tasks.length) return;
    await tasks[index++]();
    await next();
  }
  const runners = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    runners.push(next());
  }
  await Promise.all(runners);
}

exports.fetchAll = async () => {
  const currentStatus = await getStatus();

  if (currentStatus === "fetching") {
    console.log("⛔️ Fetch already in progress. Aborting new fetch.");
    return;
  }

  const nextTime = await getNextFetchTime();
  const now = Date.now();

  if (nextTime && now < nextTime) {
    const remainingMs = nextTime - now;
    const remainingSec = Math.floor(remainingMs / 1000);
    const hours = Math.floor(remainingSec / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    const seconds = remainingSec % 60;

    console.log(`⏱ Too early. Next fetch scheduled for: ${new Date(nextTime).toISOString()}`);
    console.log(`⏳ Time remaining: ${hours}h ${minutes}m ${seconds}s`);
    return;
  }

  await setStatus("fetching");

  // Exact structure
  const allIDs = {
    trendingToday: [],
    trendingWeek: [],
    topRated: [],
    nowPlaying: []
  };

  const progress = {};

  try {
    const categories = endpoints.movies;

    for (const [category, url] of Object.entries(categories)) {
      const key = `movies.${category}`;
      const seen = new Set(allIDs[category]);
      const startPage = progress[key] || 1;

      const tasks = [];
      for (let page = startPage; page <= 50; page++) {
        tasks.push(() => fetchPage(url, "movies", category, page, seen, allIDs, progress, key));
      }

      console.log(`🚀 Fetching ${key} with ${tasks.length} pages...`);
      await runQueue(tasks, CONCURRENCY_LIMIT);
    }

    saveJSON(OUTPUT_FILE, allIDs);
    await setNextFetchTime(Date.now() + 24 * 60 * 60 * 1000);

    console.log("🎉 Done! All data saved.");
  } catch (error) {
    console.error("❌ Fetching process failed:", error);
  } finally {
    await setStatus("idle");
  }
};

// Graceful shutdown
let isShuttingDown = false;

async function cleanupAndExit(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 ${signal} received. Cleaning up...`);

  try {
    await setStatus("idle");
    console.log("✅ Status reset to 'idle'.");
  } catch (err) {
    console.error("❌ Failed to reset status:", err.message);
  }

  process.exit(0);
}

process.on("SIGINT", () => cleanupAndExit("SIGINT"));
process.on("SIGTERM", () => cleanupAndExit("SIGTERM"));
