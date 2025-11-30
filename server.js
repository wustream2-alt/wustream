const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multiRateLimiter = require('./middlewares/rateLimiter');
const checkApiKey = require('./middlewares/checkApiKey');
const admin = require('firebase-admin');
const apiKeys = require('./apiKeys'); // NeDB instance
const db = require('./firebase/firebase'); // Firestore
const cookieParser = require('cookie-parser');
const { loadBlockedIpsToMemory } = require("./helpers/blockedIpsService");
const { prefetchData } = require('./models.js');


const setCookie = require('./middlewares/set_cookie');
// /home/vicali/Desktop/Projects/Websites/stream/server copy 3.js
// Full server file with robust Host/Origin/Subdomain detection and safe per-request routing
const app = express();
require('dotenv').config();

app.use(cookieParser());
app.set('trust proxy', true); // respect X-Forwarded-* headers if behind a proxy
app.use(express.json());
app.use(cors());

// Helper: get a hostname string from request headers (handles ports, x-forwarded-host, origin, referer)
function extractHostname(req) {
  // Prefer x-forwarded-host when behind proxies (may contain comma-separated list)
  let host = req.headers['x-forwarded-host'] || req.headers['host'] || req.hostname || '';
  if (Array.isArray(host)) host = host[0];
  if (typeof host === 'string' && host.indexOf(',') !== -1) host = host.split(',')[0].trim();

  // If host looks like a full URL (safety), try extracting hostname from origin or referer
  if (!host || host.indexOf('.') === -1) {
    const origin = req.headers.origin || req.headers.referer || '';
    try {
      if (origin) {
        const u = new URL(origin);
        host = u.hostname;
      }
    } catch (e) {
      // ignore
    }
  }

  // strip port if present
  host = (host || '').toString().toLowerCase();
  if (host.includes(':')) host = host.split(':')[0];
  return host;
}

// Determine subdomain semantic based on host/origin/referrer and configurable base domain
function detectSubdomain(req) {
  const host = extractHostname(req);

  // Define your canonical root domain here
  const ROOT_DOMAIN = 'wustream.com';
  if (!host) return null;

  // Exact match to root domain (www or naked)
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;

  // If the host explicitly starts with known subdomains, return those
  if (host === `api.${ROOT_DOMAIN}` || host.startsWith('api.')) return 'api';
  if (host === `watch.${ROOT_DOMAIN}` || host.startsWith('watch.')) return 'watch';
  if (host === `download.${ROOT_DOMAIN}` || host.startsWith('download.')) return 'download';

  // Handle localhost / development: detect intended target via Origin/Referer headers
  const origin = (req.headers.origin || req.headers.referer || '').toString();
  try {
    if (origin) {
      const u = new URL(origin);
      const oHost = u.hostname.toLowerCase();
      if (oHost === `api.${ROOT_DOMAIN}` || oHost.startsWith('api.')) return 'api';
      if (oHost === `watch.${ROOT_DOMAIN}` || oHost.startsWith('watch.')) return 'watch';
      if (oHost === `download.${ROOT_DOMAIN}` || oHost.startsWith('download.')) return 'download';
    }
  } catch (e) {
    // ignore invalid origin/referrer
  }

  // Fallback: if host contains the root domain but has a prefix (something.wustream.com)
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const prefix = host.slice(0, host.length - (`.${ROOT_DOMAIN}`).length);
    if (prefix === 'api') return 'api';
    if (prefix === 'watch') return 'watch';
    if (prefix === 'download') return 'download';
    // unknown subdomain -> treat as main (or null)
    return null;
  }

  // Otherwise unknown host (could be custom domain). Treat as main site.
  return null;
}

// Create routers once (do not register routes on every request)
const apiRouter = express.Router();
const watchRouter = express.Router();
const downloadRouter = express.Router();
const mainRouter = express.Router();

apiRouter.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// --- API Subdomain routes (api.wustream.com) ---
apiRouter.get('/docs', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'api_doc.html'));
});
apiRouter.get('/docs.md', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'API_DOC.md'));
});
apiRouter.get('/', multiRateLimiter, (req, res) => {
  res.send('API is Running');
});
apiRouter.use('/movies', multiRateLimiter, checkApiKey, require('./routes/movies'));
apiRouter.use('/tvs', multiRateLimiter, checkApiKey, require('./routes/series'));
apiRouter.use('/explore/search', multiRateLimiter, checkApiKey, require('./routes/search'));
apiRouter.use('/g/download', require('./routes/download'));
apiRouter.use('/g/watch', multiRateLimiter, require('./routes/stream'));
apiRouter.use('/image', require('./routes/image'));

// --- Watch Subdomain routes (watch.wustream.com) ---
watchRouter.use('/', multiRateLimiter, require('./routes/stream'));

// --- Download Subdomain routes (download.wustream.com) ---
downloadRouter.use('/', require('./routes/download'));

const TARGET_URL = "https://dramaspots.com/"; //
// Apply to all main /api routes
mainRouter.use('/api', (req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive'); // tells Google not to index
  next();
});

// Apply to all main /api routes
mainRouter.use('/g', (req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive'); // tells Google not to index
  next();
});

mainRouter.get("/APK", (req, res) => {
  const version = "1.0.0";
  const apkDownloadUrl = "/download/apk"; // URL for APK download
  const siteUrl = "https://films.wustream.com"; // Replace with your domain
  const appName = "Wustream";
  const description = "Download Wustream APK - Watch and stream movies directly on your Android device. Install the latest version safely from our website.";

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="${description}">
        <meta name="keywords" content="Wustream, APK download, Android app, Movies app, Watch movies">
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="${siteUrl}/APK">
        <title>Download Wustream APK - Version ${version}</title>

        <!-- Open Graph / Social -->
        <meta property="og:title" content="Download Wustream APK - Version ${version}">
        <meta property="og:description" content="${description}">
        <meta property="og:type" content="website">
        <meta property="og:url" content="${siteUrl}/APK">
        <meta property="og:image" content="${siteUrl}/logo.png">

        <!-- Twitter Card -->
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Download Wustream APK - Version ${version}">
        <meta name="twitter:description" content="${description}">
        <meta name="twitter:image" content="${siteUrl}/logo.png">

        <!-- Structured Data for App -->
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          "name": "${appName}",
          "operatingSystem": "ANDROID",
          "applicationCategory": "GameApplication",
          "url": "${siteUrl}/APK",
          "downloadUrl": "${siteUrl}${apkDownloadUrl}",
          "version": "${version}",
          "description": "${description}"
        }
        </script>

        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #f8f9fa; margin:0; }
          h1 { color: #ff5c5c; margin-top: 40px; }
          main { max-width: 600px; margin: auto; }
          a.download-btn {
            display: inline-block; margin-top: 30px; padding: 14px 28px;
            background: #ff5c5c; color: #fff; text-decoration: none; border-radius: 8px;
            font-weight: bold; font-size: 16px;
          }
          a.download-btn:hover { background: #ff5c5c; }
          p { color: #555; font-size: 1rem; line-height: 1.6; }
          footer { margin-top: 40px; font-size: 0.85rem; color: #888; }
        </style>
      </head>
      <body>
        <header>
          <h1>Download Wustream APK</h1>
        </header>
        <main>
          <p>Version: ${version}</p>
          <p>Click the button below to download and install the app directly on your Android device.</p>
          <a href="${apkDownloadUrl}" class="download-btn">Download APK</a>
          <p>Make sure "Install unknown apps" is enabled on your Android device.</p>
        </main>
        <footer>
          &copy; ${new Date().getFullYear()} Wustream. All rights reserved.
        </footer>
      </body>
    </html>
  `);
});


// --- ROUTE: Download APK ---
mainRouter.get("/download/apk", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "app-release.apk");

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    if (!res.headersSent) res.status(500).send('Download failed.');
    console.error(err);
  });

  res.setHeader('Content-Disposition', 'attachment; filename=Wustream.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');

  stream.pipe(res);
});

// --- 1. Apply setCookie ONLY to frontend pages ---
mainRouter.use((req, res, next) => {
    const isApiOrG = req.path.startsWith('/api') || req.path.startsWith('/g/');
    if (!isApiOrG) return setCookie(req, res, next);
    next();
});


// --- Main website routes (wustream.com & www.wustream.com) ---
mainRouter.use(express.static(path.join(__dirname, 'movies')));

mainRouter.get('/', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'movies.html'));
});

mainRouter.get('/search', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'search.html'));
});

mainRouter.get('/api', multiRateLimiter, (req, res) => {
  res.send('API is Running');
});

mainRouter.get('/api/docs', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'api_doc.html'));
});

mainRouter.get('/api/docs.md', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'API_DOC.md'));
});

mainRouter.use('/image', require('./routes/image'));


mainRouter.post('/api/v1/user/register', require('./controllers/registerController').register);
mainRouter.get('/api/v1/user/register', require('./controllers/registerController').registerForm);

// API routes under main domain (/api/...) protected
mainRouter.use('/api/movies', multiRateLimiter, checkApiKey, require('./routes/movies'));
mainRouter.use('/api/tvs', multiRateLimiter, checkApiKey, require('./routes/series'));
mainRouter.use('/api/explore/search', multiRateLimiter, checkApiKey, require('./routes/search'));
mainRouter.use('/g/download', require('./routes/download'));
mainRouter.use('/g/watch', multiRateLimiter, require('./routes/stream'));
mainRouter.use("/api/manage", require("./routes/apiManager"));
mainRouter.use("/api/apikeys", require("./routes/apiList"));
mainRouter.get('/:type/:id', multiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'details.html'));
});

// REQUEST ROUTING MIDDLEWARE
app.use((req, res, next) => {
  // determine subdomain once per request
  const sub = detectSubdomain(req);
  req.subdomain = sub; // for logging or downstream usage
  // route to the appropriate router (router is an express middleware)
  if (sub === 'api') {
    return apiRouter(req, res, next);
  }
  if (sub === 'watch') {
    return watchRouter(req, res, next);
  }
  if (sub === 'download') {
    return downloadRouter(req, res, next);
  }
  // default: main site
  return mainRouter(req, res, next);
});



async function startServer() {
  try {
    apiKeys.remove({}, { multi: true }, function (err, numDeleted) {
      console.log('Deleted', numDeleted, 'user(s)');
    });

      await loadBlockedIpsToMemory();

    const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  setImmediate(async () => {
    await prefetchData();
    console.log('Prefetch complete');
  });
});
  } catch (err) {
    console.error('Failed to clear API keys. Server not started.', err);
  }
}

// Call startServer to initialize
startServer();
