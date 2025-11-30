const fs = require("fs");
const path = require("path");

// Path to your movies.json
const filePath = path.join(__dirname, "public", "data", "movies.json");

// Load JSON
let data = JSON.parse(fs.readFileSync(filePath, "utf8"));

// Ensure valid
if (!Array.isArray(data)) {
  console.error("❌ movies.json must contain an array!");
  process.exit(1);
}

console.log(`📦 Loaded ${data.length} movies...`);

// Allowed fields
const ALLOWED = [
  "id",
  'f_id',
  "title",
  "slug",
  "genres",
  "posterUrl",
  "backdropUrl",
  "synopsis",
  "releaseDate",
  "runtime",
  "type",
  "mpaRating",
  "voteAverage",
  "tmdbId",
  "voteCount",
  "popularity"
];

// Concurrency size
const BATCH_SIZE = 5000;

/** Filter a single movie */
function filterMovie(movie) {
  const filtered = {};
  for (const key of ALLOWED) {
    filtered[key] = movie[key] ?? null;
  }
  return filtered;
}

/** Process movies in chunks concurrently */
async function processInBatches() {
  console.log(`🚀 Processing in batches of ${BATCH_SIZE}...`);

  const result = [];
  let index = 0;

  while (index < data.length) {
    const chunk = data.slice(index, index + BATCH_SIZE);

    console.log(
      `⚡ Batch ${Math.floor(index / BATCH_SIZE) + 1} → Processing ${
        chunk.length
      } items...`
    );

    const cleanedChunk = await Promise.all(chunk.map(filterMovie));

    result.push(...cleanedChunk);
    index += BATCH_SIZE;
  }

  return result;
}

(async () => {
  const cleaned = await processInBatches();

  // Save result
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), "utf8");

  console.log("🎉 movies.json cleaned successfully!");
  console.log(`📁 Total processed: ${cleaned.length}`);
})();
