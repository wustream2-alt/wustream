# 🎬 Movie & TV API — Professional Documentation


Base URL: `https://api.wustream.com`
Response format: JSON (binary for direct downloads, e.g., `.mp4`)  
Authentication: API key — include header `x-api-key: <YOUR_API_KEY>`

Summary
- Purpose: Provide read-only endpoints for movies and TV shows, with search, grouping, trending, and download links.
- Audience: Frontend developers, integrators, and partners.
- Rate limiting: Standard (e.g., 1000 req/day). Exceeding limits returns 429.

Table of contents
- Authentication & headers
- Common concepts & models
- Pagination & filtering
- Error responses
- Movies endpoints
- TV endpoints
- Search & explore
- Examples (curl & TypeScript fetch)

---

## Authentication & headers
All requests require:
- Header `x-api-key: <YOUR_API_KEY>`
- Header `Accept: application/json` (unless requesting binary download)

Common headers:
- `x-api-key`: string (required)
- `Accept`: `application/json` | other
- `Accept-Language`: optional, e.g., `en-US`

Unauthorized or missing key returns: 401 Unauthorized.

---

## Common concepts & models

Movie (representative)
```json
{
    "id": 123,
    "title": "Title",
    "slug": "title-slug",
    "genres": ["Action","Sci-Fi"],
    "genre_ids":[28,878],
    "posterUrl":"https://...",
    "backdropUrl":"https://...",
    "synopsis":"Short description",
    "releaseDate":"YYYY-MM-DD",
    "runtime":120,
    "mpaRating":"PG-13",
    "voteAverage":8.5,
    "voteCount":1500,
    "casts":[{"name":"Actor","character":"Role","profileUrl":"..."}],
    "crew":[{"name":"Director","job":"Director"}],
    "videos":[{"type":"trailer","site":"YouTube","key":"..."}],
    "downloadUrl":null
}
```

TV Show (representative)
```json
{
    "id":101,
    "title":"Show Title",
    "slug":"show-title",
    "genres":["Drama"],
    "firstAirDate":"YYYY-MM-DD",
    "seasons":[
        {"seasonNumber":1,"episodes":[
            {"episodeNumber":1,"title":"Pilot","runtime":45,"airDate":"YYYY-MM-DD","downloadUrls":[{"quality":"720p","url":"..."}]}
        ]}
    ],
    "posterUrl":"...",
    "voteAverage":8.0
}
```

Notes:
- `downloadUrl` fields may be direct binary (stream) or a 302 redirect to CDN.
- Genres may be returned as names and/or IDs (check specific endpoints).

---

## Pagination & filtering
Standard paginated response:
```json
{
    "success": true,
    "page": 1,
    "totalPages": 5,
    "totalResults": 100,
    "results": [ ... ]
}
```
Common query params:
- `page` (integer, default 1)
- `limit` (integer, optional)
- `sort` (string, optional; e.g., `popularity.desc`, `releaseDate.desc`)
- `genre` (string; case-insensitive)
- `year` (integer)

Default page = 1. Endpoints that return lists support pagination unless stated.

---

## Error responses
Standard structure:
```json
{"success": false, "status": 404, "message": "Resource not found"}
```
Common codes:
- 200 — OK
- 400 — Bad Request (invalid params)
- 401 — Unauthorized (missing/invalid API key)
- 404 — Not Found
- 429 — Rate Limit Exceeded
- 500 — Internal Server Error

---

# Movies Endpoints
All endpoints require `x-api-key` header.

Get movie by ID
- Method: GET
- Path: `/movies/:id`
- Path params: `id` (integer)
- Description: Full movie details, cast/crew, videos, and download links when available.
- Example:
    curl:
    ```
    curl -H "x-api-key: YOUR_KEY" "https://your-api-domain.com/api/movies/123"
    ```
- Errors: 404 if not found.

Get trending movies
- Method: GET
- Path: `/movies/trending/:page`
- Description: Returns curated sections (featured, trendingToday, thisWeek, topRated).
- Response example:
    ```json
    {"category":"trendingToday","movies":[ ... ]}
    ```

Group movies by year
- Method: GET
- Path: `/movies/group/year`
- Description: Groups movies by release year (current → 2000).
- Response:
    ```json
    {"success":true,"data":[{"year":2025,"movies":[...]}, ...]}
    ```

Group movies by genre
- Method: GET
- Path: `/movies/group/genre`
- Description: Returns groups keyed by genre from genres.json.

Movies A–Z
- Method: GET
- Path: `/movies/az/:page?`
- Optional `page` default 1. Sorted alphabetically.

Popular movies
- Method: GET
- Path: `/movies/popular/:page?`

Movies by category
- Method: GET
- Path: `/movies/category/:category/:page?`
- Params: `category` key from categories.json (e.g., `topRated`, `nowPlaying`)

Movies by year
- Method: GET
- Path: `/movies/year/:year/:page?`
- Params: `year` (YYYY)

Movies by genre
- Method: GET
- Path: `/movies/genre/:page?`
- Query: `?genre=<name>`
- Example: `/movies/genre?page=1&genre=Action`

Latest movies
- Method: GET
- Path: `/movies/latest/:page?` — newest releases sorted by releaseDate desc.

Download movie (if available)
- Method: GET
- Path: `/movies/:id/download/:quality`
- Description: Returns binary stream or 302 redirect. Use `Accept` header to request binary.

---

# TV Shows Endpoints
Shape and behavior mirror Movies, with TV-specific fields (seasons, episodes).

Get TV show by ID
- Method: GET
- Path: `/tv/:id`
- Description: Returns seasons and episodes with per-episode download URLs.
- Example response snippet:
    ```json
    {
        "id":101,"title":"Example Show",
        "seasons":[{"seasonNumber":1,"episodes":[{"episodeNumber":1,"title":"Pilot","downloadUrls":[{"quality":"720p","url":"..."}]}]}]
    }
    ```

Trending TV shows
- Method: GET
- Path: `/tv/trending`

Group TV by year
- Method: GET
- Path: `/tv/group/year`

Group TV by genre
- Method: GET
- Path: `/tv/group/genre`

TV A–Z
- Method: GET
- Path: `/tv/az/:page?`

Popular TV shows
- Method: GET
- Path: `/tv/popular/:page?`

TV by category
- Method: GET
- Path: `/tv/category/:category/:page?`

TV by year
- Method: GET
- Path: `/tv/year/:year/:page?`

TV by genre
- Method: GET
- Path: `/tv/genre/:page?` (query `?genre=<name>`)

Latest TV shows
- Method: GET
- Path: `/tv/latest/:page?`

Episode download
- Method: GET
- Path: `/tv/:tvId/seasons/:season/episodes/:episode/download/:quality`

---

# Search / Explore
Search endpoint
- Method: GET
- Path: `/explore/search`
- Query params:
    - `title` (required) — search term
    - `page` (optional)
    - `type` (optional) — `movie` or `tv`
- Example:
    `GET /explore/search?title=matrix&page=1&type=movie`
- Response:
    ```json
    {"success":true,"page":1,"totalPages":3,"totalResults":35,"results":[ ... ]}
    ```

---

# Additional notes & best practices
- Always use HTTPS.
- Validate API key server-side and enforce rate limits.
- Filtered results typically exclude items with missing `posterUrl`.
- For large file downloads the API may return a 302 redirect to a CDN; clients should follow redirects.
- Use `Accept-Language` for localized content where supported.
- Cache list endpoints (e.g., trending) for short periods to reduce load.
- Provide graceful fallback for missing assets (poster/backdrop).

---

# Examples

Get movie by ID (curl)
```
curl -H "x-api-key: YOUR_KEY" \
         -H "Accept: application/json" \
         "https://your-api-domain.com/api/movies/123"
```

Search using fetch (TypeScript)
```ts
async function searchTitle(title: string, page = 1) {
    const res = await fetch(`https://your-api-domain.com/api/explore/search?title=${encodeURIComponent(title)}&page=${page}`, {
        headers: { "x-api-key": "YOUR_KEY", "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
```

---

If you want, provide an API key and I can generate example curl commands or typed client stubs for any specific endpoint.

Changelog
- v1.0 — Initial spec for movies & TV (endpoints, models, errors, examples).
