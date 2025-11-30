const express = require('express');
const app = express();
require('dotenv').config();
app.use(express.json());
const cors = require('cors');
app.use(cors());
const path = require('path');
const { prefetchData } = require('./models.js');

// Serve static
app.use(express.static(path.join(__dirname, 'movies')));

// Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'movies.html'));
});

app.get('/:type/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'movies', 'details.html'));
});

// 🔥 IMPORT API-KEY MIDDLEWARE
const checkApiKey = require('./middlewares/checkApiKey');

// 🔥 REGISTER USER ENDPOINT
app.post('/api/register', require('./controllers/registerController').register);

// 🔥 PROTECT YOUR EXISTING API ROUTES
app.use('/api/movies', checkApiKey, require('./routes/movies'));
app.use('/api/tvs', checkApiKey, require('./routes/series'));
app.use('/api/explore/search', checkApiKey, require('./routes/search'));
app.use('/g/download', require('./routes/download')); 
app.use('/g/watch', require('./routes/stream')); 

// START SERVER
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  setImmediate(async () => {
    await prefetchData();
    console.log('Prefetch complete');
  });
});

