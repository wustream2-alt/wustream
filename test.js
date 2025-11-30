const fs = require("fs");
const path = require("path");

// -------------------------------
// Load movies.json
// -------------------------------
const filePath = path.join(__dirname, "public", "data", "series.json");
let data = JSON.parse(fs.readFileSync(filePath, "utf8"));

if (!Array.isArray(data)) {
  console.error("❌ movies.json must contain an array!");
  process.exit(1);
}

console.log(`📦 Loaded ${data.length} movies...`);

// -------------------------------
// Load genres.json and build map
// -------------------------------
const genresJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "genres.json"), "utf8")
);

const GENRE_MAP = {};
genresJson.tv_genres.forEach(g => GENRE_MAP[g.id] = g.name);

console.log("📚 Genre map loaded.");

// -------------------------------
// Allowed fields
// -------------------------------
const ALLOWED = [
  "id",
  "f_id",
  "title",
  "slug",
  "genres",
  "posterUrl",
  "backdropUrl",
  "synopsis",
  "firstAirDate",
  "runtime",
  "type",
  "mpaRating",
  "voteAverage",
  "tmdbId",
  "voteCount",
  "popularity"
];

// -------------------------------
// Normalize genres
// -------------------------------
function normalizeGenres(movie) {
  let g = movie.genres || movie.genre_ids || null;

  if (!g) return [];

  // Case: stringified JSON array
  if (typeof g === "string") {
    g = g.trim();

    if (g.startsWith("[") && g.endsWith("]")) {
      try {
        g = JSON.parse(g);
      } catch (e) {
        g = [];
      }
    } else {
      return [g]; // single string genre
    }
  }

  // Case: array
  if (Array.isArray(g)) {
    return g
      .map(item => {
        if (typeof item === "number") return GENRE_MAP[item] || null;
        return String(item);
      })
      .filter(Boolean);
  }

  return [];
}

// -------------------------------
// Filter a single movie
// -------------------------------
function filterMovie(movie) {
  // ❌ Filter out movies missing f_id
  if (!movie.f_id) return null;

  const filtered = {};

  for (const key of ALLOWED) {
    filtered[key] = movie[key] ?? null;
  }

  // Always overwrite genres with normalized format
  filtered.genres = normalizeGenres(movie);

  return filtered;
}

// -------------------------------
// Batch Processing
// -------------------------------
const BATCH_SIZE = 5000;

async function processInBatches() {
  console.log(`🚀 Processing in batches of ${BATCH_SIZE}...`);

  const result = [];
  let index = 0;

  while (index < data.length) {
    const chunk = data.slice(index, index + BATCH_SIZE);

    console.log(
      `⚡ Batch ${Math.floor(index / BATCH_SIZE) + 1} → Processing ${
        chunk.length
      } movies...`
    );

    const cleanedChunk = await Promise.all(chunk.map(filterMovie));

    // remove null entries (missing f_id)
    result.push(...cleanedChunk.filter(Boolean));

    index += BATCH_SIZE;
  }

  return result;
}

// -------------------------------
// Main Runner
// -------------------------------
(async () => {
  const cleaned = await processInBatches();

  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), "utf8");

  console.log("🎉 movies.json cleaned & normalized successfully!");
  console.log(`📁 Total saved: ${cleaned.length}`);
})();
