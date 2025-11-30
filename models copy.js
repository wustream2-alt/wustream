import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

export const BASE_URL =
    process.env.BASE_URL2 ||
    "https://storage.googleapis.com/wema-3fd47.appspot.com/data";

// List of JSON files
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

// -----------------------------
// Prefetch JSON files from URL
// -----------------------------
export async function prefetchData() {
    console.log("⚡ Prefetching JSON data...");
    for (const file of files) {
        try {
            const res = await fetch(`${BASE_URL}/${file}.json`);
            if (!res.ok) throw new Error(`Failed to fetch ${file}.json`);
            dbCache[file] = await res.json();
            console.log(`✔ Loaded ${file}.json (${dbCache[file].length || "unknown"} items)`);
        } catch (err) {
            console.error(`❌ Error loading ${file}:`, err);
            dbCache[file] = [];
        }
    }
    console.log("🎉 Prefetch complete!");
}

// -----------------------------
// Helper: Apply where filter
// -----------------------------

const applyWhere = (data, where = {}) => {
  if (!where || Object.keys(where).length === 0) return data;

  const matchCondition = (itemValue, condition) => {
    if (typeof condition === "function") return condition(itemValue);
    if (Array.isArray(condition)) return condition.includes(itemValue);
    if (isPlainObject(condition)) {
      for (const [op, val] of Object.entries(condition)) {
        switch (op) {
          case Op.eq.toString(): if (itemValue !== val) return false; break;
          case Op.ne.toString(): if (itemValue === val) return false; break;
          case Op.gte.toString(): if (!(itemValue >= val)) return false; break;
          case Op.gt.toString(): if (!(itemValue > val)) return false; break;
          case Op.lte.toString(): if (!(itemValue <= val)) return false; break;
          case Op.lt.toString(): if (!(itemValue < val)) return false; break;
          case Op.not.toString(): if (itemValue === val) return false; break;
          case Op.in.toString(): if (!val.includes(itemValue)) return false; break;
          case Op.notIn.toString(): if (val.includes(itemValue)) return false; break;
          case Op.like.toString(): 
          case Op.iLike.toString(): {
            if (typeof itemValue !== "string") return false;
            const regex = new RegExp(val.replace(/%/g, ".*"), op === Op.iLike.toString() ? "i" : "");
            if (!regex.test(itemValue)) return false;
            break;
          }
          case Op.notLike.toString(): 
          case Op.notILike.toString(): {
            if (typeof itemValue !== "string") return false;
            const regex = new RegExp(val.replace(/%/g, ".*"), op === Op.notILike.toString() ? "i" : "");
            if (regex.test(itemValue)) return false;
            break;
          }
          case Op.and.toString():
            if (!Array.isArray(val)) break;
            if (!val.every(cond => matchCondition(itemValue, cond))) return false;
            break;
          case Op.or.toString():
            if (!Array.isArray(val)) break;
            if (!val.some(cond => matchCondition(itemValue, cond))) return false;
            break;
          case Op.between.toString():
            if (!(itemValue >= val[0] && itemValue <= val[1])) return false;
            break;
          case Op.notBetween.toString():
            if (itemValue >= val[0] && itemValue <= val[1]) return false;
            break;
          default:
            if (isPlainObject(val) && isPlainObject(itemValue)) {
              if (!Object.entries(val).every(([k,v]) => itemValue[k] === v)) return false;
            } else {
              if (itemValue !== val) return false;
            }
        }
      }
      return true;
    }
    return itemValue === condition;
  };

  return data.filter(item =>
    Object.entries(where).every(([key, condition]) => {
      const itemValue = item[key];
      return matchCondition(itemValue, condition);
    })
  );
};


const applyWhere = (data, where = {}) => {
    if (!where || Object.keys(where).length === 0) return data;
    return data.filter((item) =>
        Object.entries(where).every(([key, value]) => item[key] === value)
    );
};

// -----------------------------
// Helper: Apply order
// -----------------------------
const applyOrder = (data, order = []) => {
    if (!order || !Array.isArray(order) || order.length === 0) return data;
    const [field, direction] = order[0];
    return data.sort((a, b) => {
        if (a[field] === b[field]) return 0;
        if (direction.toUpperCase() === "DESC") return a[field] < b[field] ? 1 : -1;
        return a[field] > b[field] ? 1 : -1;
    });
};

async function makeAssociation(item, include) {


    // Attach relations
    for (const options of include) {

        let file = null;

        switch (options.model) {
            case Movie:
                file = 'movies';
                break;
            default:

        }

        if (!dbCache[file]) item[as] = [];
        let data = [...dbCache[file]];

        // Apply where filter
        if (options.where) data = applyWhere(data, options.where);

        // Apply order
        if (options.order) data = applyOrder(data, options.order);

        // Apply limit & offset
        if (options.offset) data = data.slice(options.offset);
        if (options.limit) data = data.slice(0, options.limit);

        // Pick attributes
        if (options.attributes && Array.isArray(options.attributes)) {
            data = data.map((item) => {
                const obj = {};
                options.attributes.forEach((attr) => {
                    if (item.hasOwnProperty(attr)) obj[attr] = item[attr];
                });
                return obj;
            });
        }

        data = data.map((item) => {
            return makeAssociation(item, options.include);
        })


        item[as] = data;

    }

    return item;



}

// -----------------------------
// Generic Model Creator
// -----------------------------
const createModel = (file) => {
    return {
        findAll: async (options = {}) => {
            if (!dbCache[file]) return [];
            let data = [...dbCache[file]];

            // Apply where filter
            if (options.where) data = applyWhere(data, options.where);

            // Apply order
            if (options.order) data = applyOrder(data, options.order);

            // Apply limit & offset
            if (options.offset) data = data.slice(options.offset);
            if (options.limit) data = data.slice(0, options.limit);

            // Pick attributes
            if (options.attributes && Array.isArray(options.attributes)) {
                data = data.map((item) => {
                    const obj = {};
                    options.attributes.forEach((attr) => {
                        if (item.hasOwnProperty(attr)) obj[attr] = item[attr];
                    });
                    return obj;
                });
            }

            data = data.map((item) => {
                return makeAssociation(item, options.include);
            })


            return data;
        },

        findByPk: async (id, options = {}) => {
            if (!dbCache[file]) return null;
            let item = dbCache[file].find((d) => d.id === id);
            if (!item) return null;

            // Pick attributes
            if (options.attributes && Array.isArray(options.attributes)) {
                const obj = {};
                options.attributes.forEach((attr) => {
                    if (item.hasOwnProperty(attr)) obj[attr] = item[attr];
                });
                item = obj;
            }

            item = makeAssociation(item, options.include);


            return item;
        },

        findOne: async (options = {}) => {
            const data = await this.findAll(options);
            return data[0] || null;
        },
    };
};

// -----------------------------
// Models
// -----------------------------
export const Movie = createModel("movies", {
    casts: "movie_cast",
    crews: "movie_crew",
    trailers: "movie_trailers",
});

export const Cast = createModel("movie_cast");
export const Crew = createModel("movie_crew");
export const Trailer = createModel("movie_trailers");
export const RecommendedMovie = createModel("movie_recommendations");
export const Series = createModel("series");
export const Season = createModel("seasons");
export const Episode = createModel("episodes");
export const SeriesCast = createModel("series_cast");
export const SeriesCrew = createModel("series_crew");
export const SeriesTrailer = createModel("series_trailers");
export const RecommendedSeries = createModel("series_recommendations");
