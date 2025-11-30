// Format MySQL date to readable format
function formatMySQLDate(mysqlDate) {
  if (!mysqlDate) return null;
  const date = new Date(mysqlDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Get director(s) from crew array
function getDirector(crew) {
  if (!Array.isArray(crew)) return null;
  const directors = crew.filter(member => member.job === 'Director');
  if (directors.length === 0) return 'Unknown';
  return directors.map(d => d.name).join(', ');
}

// Variables to hold trailer info for download
let videoUrl = '';
let downloadUrl = '';
let name = '';

// Function to trigger download
function downloadTrailer() {
  if (!downloadUrl) return alert("No available download found.");
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Navigate to trailer page
function loadVideo(link) {
  window.location.href = `trailer.html?videoId=${link}&name=${encodeURIComponent(name)}`;
}

// Fetch movie data by ID
async function fetchData(id) {
  try {
    // Create a URLSearchParams object from the current page URL
    const urlParams = new URLSearchParams(window.location.search);

    // Get the value of "type"
    const type = urlParams.get('type') || 'movies';

    // Hardcoded API key
    const apiKey = '5b30ac97-21e6-4397-bd57-238914578aff';
    const headers = {
      ...(options.headers || {}),
      "x-api-key": apiKey
    };

    const response = await fetch(`/api/${type}/id/${id}`, { ...options, headers });
    if (!response.ok) throw new Error('Failed to fetch movie details');
    const data = await response.json();

    // Poster and backdrop
    document.getElementById('movie-poster').src = `https://image.tmdb.org/t/p/w500${data.posterUrl}`;
    const imagePath = data.backdropUrl ?? data.posterUrl;
    document.getElementById('videoPlaceholder').style.backgroundImage =
      imagePath
        ? `url('https://image.tmdb.org/t/p/w500${imagePath}')`
        : `url('path/to/default/image.jpg')`;

    // Movie Info
    document.getElementById('movie-title').textContent = data.title;
    document.getElementById('movie-title2').textContent = data.title;
    document.getElementById('director').innerHTML = `<strong>Director:</strong> ${getDirector(data.crews)}`;
    document.getElementById('release-date').innerHTML = `<strong>Release Date:</strong> ${formatMySQLDate(data.releaseDate)}`;
    document.getElementById('genres').innerHTML = `<strong>Genres:</strong> ${data.genres}`;
    document.getElementById('imdb-rating').innerHTML = `<strong>IMDb Rating:</strong> ${data.voteAverage} <i>&#9733;</i> | ${data.voteCount} Votes`;
    document.getElementById('description').textContent = data.synopsis;

    downloadUrl = data.downloadUrl;
    // Trailers
    const trailersContainer = document.getElementById('trailers');
    const trailersContainer1 = document.getElementById('trailers1');
    trailersContainer.innerHTML = '';
    trailersContainer1.innerHTML = '';

    if (Array.isArray(data.videos) && data.videos.length > 0) {
      videoUrl = `https://www.youtube.com/watch?v=${data.videos[0].key}`;
      name = data.videos[0].name;
      data.videos.forEach(trailer => {
        const trailerCard = document.createElement('div');
        trailerCard.className = 'trailer-card';
        trailerCard.innerHTML = `
                  <div 
                  style="background-image: url('https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg');"
                  class="trailer-thumbnail" role="button" aria-label="Click to play trailer" onclick="loadVideo('${trailer.key}')">
            <svg id="play-button" class="play-button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="72"
              height="72" fill="currentColor">
              <path d="M16 12v40l36-20z" />
            </svg>
          </div>
          <p>${trailer.site}-${trailer.name}</p>
        `;
        trailersContainer.appendChild(trailerCard);
        trailersContainer1.appendChild(trailerCard.cloneNode(true));
      });
    }

    // Cast
    const castContainer = document.getElementById('cast');
    castContainer.innerHTML = '';
    if (Array.isArray(data.casts)) {
      data.casts.forEach(actor => {
        const castCard = document.createElement('div');
        castCard.className = 'cast-card';
        const profileImage = actor.profilePath
          ? `https://image.tmdb.org/t/p/w500${actor.profilePath}`
          : 'https://t3.ftcdn.net/jpg/06/33/54/78/360_F_633547842_AugYzexTpMJ9z1YcpTKUBoqBF0CUCk10.jpg';
        castCard.innerHTML = `
          <img src="${profileImage}" alt="${actor.name}">
          <p>${actor.name}</p>
          <p>Character: ${actor.character}</p>
        `;
        castCard.addEventListener("click", () => {
          window.location.href = `cast.html?name=${encodeURIComponent(actor.name)}`;
        });
        castContainer.appendChild(castCard);
      });
    }

    const crewContainer = document.getElementById('crew');
    crewContainer.innerHTML = '';
    if (Array.isArray(data.crew)) {
      data.crew.forEach(actor => {
        const castCard = document.createElement('div');
        castCard.className = 'cast-card';
        const profileImage = actor.profilePath
          ? `https://image.tmdb.org/t/p/w500${actor.profilePath}`
          : 'https://t3.ftcdn.net/jpg/06/33/54/78/360_F_633547842_AugYzexTpMJ9z1YcpTKUBoqBF0CUCk10.jpg';
        castCard.innerHTML = `
          <img src="${profileImage}" alt="${actor.name}">
          <p>${actor.name}</p>
          <p> ${actor.job}</p>
        `;
        castCard.addEventListener("click", () => {
          window.location.href = `cast.html?name=${encodeURIComponent(actor.name)}`;
        });
        crewContainer.appendChild(castCard);
      });
    }


    if (data.videoUrl) {
      document.getElementById('videoPlaceholder').outerHTML = `
    <video id="videoPlayer" class="stream-video" controls autoplay
      style="width:100%;max-height:90vh;background:#000;">
      <source src="${data.videoUrl}" type="video/mp4">
      Your browser does not support the video tag.
    </video>`;
    }


  } catch (error) {
    console.error('❌ Error loading movie details:', error);
  }
}

// Load movie from local storage on page load
const movieClicked = JSON.parse(localStorage.getItem('movieClicked'));
if (movieClicked) {
  const movieData = movieClicked;

  // Initial poster and basic info
  document.getElementById('movie-poster').src = `https://image.tmdb.org/t/p/w500${movieData.posterUrl}`;
  const imagePath = movieData.backdropUrl ?? movieData.posterUrl;
  document.getElementById('videoPlaceholder').style.backgroundImage =
    imagePath
      ? `url('https://image.tmdb.org/t/p/w500${imagePath}')`
      : `url('path/to/default/image.jpg')`;
  document.getElementById('movie-title').textContent = movieData.title;
  document.getElementById('movie-title2').textContent = movieData.title;
  document.getElementById('director').innerHTML = `<strong>Director:</strong> ...`;

  document.getElementById('release-date').innerHTML = `<strong>Release Date:</strong> ${formatMySQLDate(movieData.releaseDate)}`;
  document.getElementById('genres').innerHTML = `<strong>Genres:</strong> ${movieData.genres}`;
  document.getElementById('imdb-rating').innerHTML = `<strong>IMDb Rating:</strong> ${movieData.voteAverage} <i>&#9733;</i> | ${movieData.voteCount} Votes`;
  document.getElementById('description').textContent = movieData.synopsis;
  // Fetch full details
  fetchData(movieData.f_id);
}
