const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const BASE_URL =
  process.env.BASE_URL2 ||
  "https://storage.googleapis.com/wema-3fd47.appspot.com/data";

// List of JSON files
const files = [
  "movies",
  "series",
];

// Global cache
const dbCache = {};

// -----------------------------
// Prefetch JSON files from URL
// -----------------------------
// Load JSON file using stream
function loadJSONStream(filePath) {
  return new Promise((resolve, reject) => {
    let jsonString = "";

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });

    stream.on("data", (chunk) => {
      jsonString += chunk;
    });

    stream.on("end", () => {
      try {
        const json = JSON.parse(jsonString);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

// MAIN PREFETCH FUNCTION
async function prefetchData() {
  console.log("⚡ Prefetching JSON data from /public/data...");

  for (const file of files) {
    const filePath = path.join(__dirname, "public", "data", `${file}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error("File not found");
      }

      const jsonData = await loadJSONStream(filePath);

      dbCache[file] = jsonData;

      console.log(
        `✔ Loaded ${file}.json (${Array.isArray(jsonData) ? jsonData.length : "non-array"})`
      );

    } catch (err) {
      console.error(`❌ Error loading ${file}.json:`, err.message);
      dbCache[file] = [];
    }
  }

  console.log("🎉 Prefetch complete!");
}


// -----------------------------
// Apply where condition (in-memory)
// -----------------------------
function applyWhere(data, where = {}) {
  if (!where || Object.keys(where).length === 0) return data;

  return data.filter((item) =>
    Object.entries(where).every(([key, condition]) => {
      let value = item[key];

      // If field is a stringified array, parse it
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        try {
          value = JSON.parse(value);
        } catch (err) {
          value = [];
        }
      }

      // CASE 1: condition is function
      if (typeof condition === "function") {
        return condition(value);
      }

      // CASE 2: array of possible values
      if (Array.isArray(condition)) {
        return condition.includes(value);
      }

      // CASE 3: simple equality
      return value === condition;
    })
  );
}

const applyOrder = (data, order = []) => {
  if (!order || !Array.isArray(order) || order.length === 0) return data;
  return data.sort((a, b) => {
    for (const rule of order) {
      const [field, dir = "ASC"] = rule;
      if (a[field] === b[field]) continue;
      if (dir.toUpperCase() === "DESC") return a[field] < b[field] ? 1 : -1;
      return a[field] > b[field] ? -1 : 1;
    }
    return 0;
  });
};

// -----------------------------
// Generic Model Creator
// -----------------------------
const createModel = (file) => {
  return {
    findAll: async (options = {}) => {
      if (!dbCache[file]) return [];
      let data = [...dbCache[file]];

      if (options.where) data = applyWhere(data, options.where);
      if (options.order) data = applyOrder(data, options.order);
      if (options.offset) data = data.slice(options.offset);
      if (options.limit) data = data.slice(0, options.limit);

      if (options.attributes && Array.isArray(options.attributes)) {
        data = data.map((item) => {
          const obj = {};
          options.attributes.forEach((attr) => {
            if (Object.prototype.hasOwnProperty.call(item, attr))
              obj[attr] = item[attr];
          });
          if (options.include && item.id !== undefined && obj.id === undefined)
            obj.__preserve_id = item.id;
          return obj;
        });
      }

      return data;
    },

    findAndCountAll: async (options = {}) => {

      let count = 0

      if (!dbCache[file]) return [];
      let data = [...dbCache[file]];

      count = data.length;

      if (options.where) data = applyWhere(data, options.where);
      if (options.order) data = applyOrder(data, options.order);
      if (options.offset) data = data.slice(options.offset);
      if (options.limit) data = data.slice(0, options.limit);


      return { count, rows: data };
    },

    findByPk: async (id, options = {}) => {
      if (!dbCache[file]) return null;
      let item = dbCache[file].find((d) => parseInt(d.id) === parseInt(id));

      if (!item) return null;

      if (options.attributes && Array.isArray(options.attributes)) {
        const obj = {};
        options.attributes.forEach((attr) => {
          if (Object.prototype.hasOwnProperty.call(item, attr))
            obj[attr] = item[attr];
        });
        if (options.include && obj.id === undefined)
          obj.__preserve_id = item.id;
        item = obj;
      }

      return item;
    },

    findOne: async (options = {}) => {
      if (!dbCache[file]) return [];
      let data = [...dbCache[file]];

      if (options.where) data = applyWhere(data, options.where);
      if (options.order) data = applyOrder(data, options.order);
      if (options.offset) data = data.slice(options.offset);
      if (options.limit) data = data.slice(0, options.limit);

      if (options.attributes && Array.isArray(options.attributes)) {
        data = data.map((item) => {
          const obj = {};
          options.attributes.forEach((attr) => {
            if (Object.prototype.hasOwnProperty.call(item, attr))
              obj[attr] = item[attr];
          });
          return obj;
        });
      }

      return data[0];
    },
  };
};

// -----------------------------
// Models (CommonJS export)
// -----------------------------
const Movie = createModel("movies");
const Series = createModel("series");

module.exports = {
  BASE_URL,
  prefetchData,
  Movie,
  Series,
};
