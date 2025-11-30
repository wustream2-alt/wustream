import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

export const BASE_URL = process.env.BASE_URL2 || "https://storage.googleapis.com/wema-3fd47.appspot.com/data";

// List of all JSON files you want to load
const files = [
    "movies",
    "movie_cast",
    "movie_crew",
    "movie_trailers",
    "movie_recommendations",
    "series",
    "seasons",
    "episodes",
    "series_cast",
    "series_crew",
    "series_trailers",
    "series_recommendations",
];

// Global cache
const dbCache = {};

// Prefetch all JSON files at server start
export async function prefetchData() {
    console.log("⚡ Prefetching JSON data from Firebase...");
    for (const file of files) {
        try {
            const res = await fetch(`${BASE_URL}/${file}.json`);
            if (!res.ok) throw new Error(`Failed to fetch ${file}.json`);
            dbCache[file] = await res.json();
            console.log(`✔ Loaded ${file}.json (${dbCache[file].length || "unknown"} items)`);
        } catch (err) {
            console.error(`❌ Error loading ${file}:`, err);
            dbCache[file] = []; // fallback empty array
        }
    }
    console.log("🎉 Prefetch complete!");
}

// Fetch any file from cache and optionally return selected fields
export function getData(file, fields = null) {

    // If file not found in cache
    if (!dbCache[file]) return [];

    const data = dbCache[file];

    // If no fields requested, return full dataset
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return data;
    }

    // Map and pick only the requested fields
    return data.map(item => {
        let obj = {};
        fields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(item, field)) {
                obj[field] = item[field];
            }
        });
        return obj;
    });
}


// Simple pagination utility
export function paginate(array, page = 1, limit = 50) {
    const start = (page - 1) * limit;
    const end = page * limit;
    return array.slice(start, end);
}
