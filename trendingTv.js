const fs = require("fs");
const axios = require("axios");
const path = require("path");
const progressDB = require("./progress").progressDB2;
const { Series } = require("./models");

require("dotenv").config();

// 🔁 ROTATING API KEYS
const API_KEYS = [
  process.env.MY_TMDB_API_KEY_1,
  process.env.MY_TMDB_API_KEY_2,
  process.env.MY_TMDB_API_KEY_3,
].filter(Boolean);

let apiIndex = 0;
function getAPIKey() {
  const key = API_KEYS[apiIndex];
  apiIndex = (apiIndex + 1) % API_KEYS.length;
  return key;
}

const OUTPUT_FILE = "categorized-tvs.json";
const CONCURRENCY_LIMIT = 60;

const endpoints = {
  tvs: {
    trendingToday: "https://api.themoviedb.org/3/trending/tv/day",
    trendingWeek: "https://api.themoviedb.org/3/trending/tv/week",
    topRated: "https://api.themoviedb.org/3/tv/top_rated",
    onTheAir: "https://api.themoviedb.org/3/tv/on_the_air",
    airingToday: "https://api.themoviedb.org/3/tv/airing_today",
  },
};

// -------------------------------------------------------
// DB Helpers
// -------------------------------------------------------
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

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// -------------------------------------------------------
// Check If Series Already Exists
// -------------------------------------------------------
const checkSeries = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  let tvs = await Series.findAll({
    where: {
      f_id: (v) => v != null,
      tmdbId: (v) => ids.includes(v),
    },
    attributes: ["tmdbId"],
  });

  return tvs.map((tv) => tv.tmdbId);
};

// -------------------------------------------------------
// Fetch One Page
// -------------------------------------------------------
async function fetchPage(url, category, page, seen, allIDs, progress, key) {
  const apiKey = getAPIKey();

  try {
    const res = await axios.get(`${url}?api_key=${apiKey}&page=${page}`);
    const results = res.data.results || [];
    if (results.length === 0) return;

    results.sort((a, b) => {
      const dateA = new Date(a.first_air_date || "1900-01-01");
      const dateB = new Date(b.first_air_date || "1900-01-01");
      return dateB - dateA;
    });

    for (const item of results) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        allIDs[category].push(item.id);

        allIDs[category] = await checkSeries(allIDs[category]);
      }
    }

    progress[key] = page + 1;
    console.log(`✅ ${key} page ${page}: added ${results.length} items`);
  } catch (err) {
    const message = err.response?.status || err.message;

    if (err.response?.status === 429) {
      console.warn(`⏳ 429 rate limit on ${key} page ${page}. Waiting 10s...`);
      await delay(10000);
      return fetchPage(url, category, page, seen, allIDs, progress, key);
    } else {
      console.warn(`⚠️ Error on ${key} page ${page}:`, message);
    }
  }
}

// -------------------------------------------------------
// Parallel Queue
// -------------------------------------------------------
async function runQueue(tasks, limit) {
  let index = 0;

  async function next() {
    if (index >= tasks.length) return;
    const i = index++;
    await tasks[i]();
    await next();
  }

  const runners = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    runners.push(next());
  }

  await Promise.all(runners);
}

// -------------------------------------------------------
// MAIN FUNCTION
// -------------------------------------------------------
exports.fetchAll = async () => {
  const currentStatus = await getStatus();
  if (currentStatus === "fetching") {
    console.log("⛔ Fetch already running.");
    return;
  }

  const nextTime = await getNextFetchTime();
  const now = Date.now();

  if (nextTime && now < nextTime) {
    console.log(`⏱ Too early. Next fetch: ${new Date(nextTime).toISOString()}`);
    return;
  }

  await setStatus("fetching");

  // ✔ EXACT OUTPUT STRUCTURE
  const allIDs = {
    trendingToday: [],
    trendingWeek: [],
    topRated: [],
    onTheAir: [],
    airingToday: [],
  };

  const progress = {};

  try {
    for (const [category, url] of Object.entries(endpoints.tvs)) {
      const key = `tvs.${category}`;
      const seen = new Set(allIDs[category]);
      const startPage = progress[key] || 1;

      const tasks = [];
      for (let page = startPage; page <= 50; page++) {
        tasks.push(() => fetchPage(url, category, page, seen, allIDs, progress, key));
      }

      console.log(`🚀 Fetching ${key} (${tasks.length} pages)...`);
      await runQueue(tasks, CONCURRENCY_LIMIT);
    }

    saveJSON(OUTPUT_FILE, allIDs);
    await setNextFetchTime(Date.now() + 24 * 60 * 60 * 1000);

    console.log("🎉 TV Fetch Complete — Saved to categorized-tvs.json");
  } catch (err) {
    console.error("❌ Fetching failed:", err);
  } finally {
    await setStatus("idle");
  }
};

// -------------------------------------------------------
// CLEAN SHUTDOWN
// -------------------------------------------------------
let isShuttingDown = false;

async function cleanupAndExit(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 ${signal} detected. Cleaning up...`);
  await setStatus("idle");
  process.exit(0);
}

process.on("SIGINT", () => cleanupAndExit("SIGINT"));
process.on("SIGTERM", () => cleanupAndExit("SIGTERM"));
