// /home/vicali/Desktop/Projects/Websites/stream/movies/search.js
// Single API endpoint usage: /api/search?page=1&title=...


const searchResultsContainer = document.getElementById('searchResults');
const searchInput = document.getElementById('searchInput');

let searchTimeout = null;
let currentPage = 1;
let currentQuery = '';
let isLoading = false;
let reachedEnd = false;

searchResultsContainer.innerHTML = '<span class="loading"><span class="loading-indicator"></span></span>';

function setLoadingIndicator(visible = true) {
  if (visible) {
    if (!searchResultsContainer.querySelector('.loading')) {
      const progress = document.createElement('span');
      progress.className = 'loading';
      const loading = document.createElement('span');
      loading.className = 'loading-indicator';
      loading.style.marginBottom = '150px';
      progress.appendChild(loading);
      searchResultsContainer.appendChild(progress);
    }
  } else {
    const node = searchResultsContainer.querySelector('.loading');
    if (node) node.remove();
  }
}

async function fetchPage(page = 1, query = '', options = {}) {

    const headers = {
      ...(options.headers || {}),
    };
  const url = `/api/explore/search?page=${encodeURIComponent(page)}&title=${encodeURIComponent(query)}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error('Failed to fetch results.');
  return res.json();
}

function createMovieCard(movie) {
  const movieCard = document.createElement('div');
  movieCard.classList.add('suggestion-card');
  movieCard.addEventListener('click', () => goToDetails(movie));

  const release = movie.releaseDate || movie.firstAirDate || '';
  movieCard.innerHTML = `
    <img src="${movie.posterUrl || ''}" alt="${movie.title || ''}">
    <span class="movie-details">
      <p class="movie-title">${movie.title || ''}</p>
      <p class="movie-genre">${movie.genres || ''}</p>
      <p class="movie-year">${formatMySQLDate(release) || ''}</p>
    </span>
  `;
  return movieCard;
}

function formatMySQLDate(mysqlDate) {
  if (!mysqlDate) return '';
  const date = new Date(mysqlDate);
  if (isNaN(date)) return mysqlDate;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function searchMovies(query, reset = true) {
  if (!query || !query.trim()) query = '';

    if (query.length < 2) { // simpler than split('').length
    currentPage = 1;
    reachedEnd = false;

    searchResultsContainer.innerHTML = `
      <div class="no-results">
        <p>Type something to search...</p>
      </div>
    `;
    return;
  }
  
  if (reset) {
    currentPage = 1;
    reachedEnd = false;
    searchResultsContainer.innerHTML = '';
  }
  if (reachedEnd || isLoading) return;

  isLoading = true;
  setLoadingIndicator(true);

  try {
    const data = await fetchPage(currentPage, query);
    const results = Array.isArray(data.results) ? data.results : [];

    if (reset && results.length === 0) {
      searchResultsContainer.innerHTML = '<span class="loading">No results found.</span>';
      reachedEnd = true;
      return;
    }

    // append results
    results.forEach(movie => {
      const card = createMovieCard(movie);
      searchResultsContainer.appendChild(card);
    });

    // if fewer results than page size (or zero) => assume end
    if (results.length === 0) reachedEnd = true;
  } catch (err) {
    console.error(err);
    if (reset) {
      searchResultsContainer.innerHTML = '<span class="loading">No results found.</span>';
    }
  } finally {
    isLoading = false;
    setLoadingIndicator(false);
  }
}

// Debounced input handler
function debounceSearch(event) {
  const query = event.target.value || '';
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentQuery = query;
    searchMovies(currentQuery, true);
  }, 300);
}

function clearSearch() {
  window.history.back();
}

function goToDetails(data) {
  if (!data) return;
  const contentType = data.type || window.type || 'movie';
  const id = data.id;
  if (!id) {
    console.warn('goToDetails called without an id, data:', data);
    return;
  }
  window.location.href = `/${contentType}/${encodeURIComponent(id)}`;
}

// initial fetch (page 1, empty query)
async function fetchInitial() {
  currentPage = 1;
  currentQuery = '';
  reachedEnd = false;
  await searchMovies('', true);
}

// Single scroll listener for infinite load
searchResultsContainer.addEventListener('scroll', async () => {
  const containerScrollUp = searchResultsContainer.scrollTop;
  const containerHeight = searchResultsContainer.offsetHeight;
  const contentHeight = searchResultsContainer.scrollHeight;

  if (Math.ceil(containerScrollUp + containerHeight) >= contentHeight - 2) {
    if (isLoading || reachedEnd) return;
    if (searchResultsContainer.querySelector('.loading')) return;

    // load next page for current query
    currentPage += 1;
    await searchMovies(currentQuery, false);
  }
});

// Wire up input and initial focus/load
if (searchInput) {
  searchInput.addEventListener('input', debounceSearch);
}

window.onload = () => {
  if (searchInput) {
    setTimeout(() => {
      searchInput.focus();
      fetchInitial();
    }, 500);
  } else {
    fetchInitial();
  }
};