const { CastInfo, Detail, Cast, Crew } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');

require('dotenv').config();
const TMDB_API_KEY = process.env.MY_TMDB_API_KEY_2;
const CHUNK_SIZE = 500;

async function saveMovies(movies) {
  try {
    const formatted = movies.map(m => ({
      ...m,
      genres: m.genre_ids || [],
    }));

    for (let i = 0; i < formatted.length; i += CHUNK_SIZE) {
      await Detail.bulkCreate(formatted.slice(i, i + CHUNK_SIZE), {
        ignoreDuplicates: true,
      });
    }
  } catch (error) {
    console.error('❌ Error saving movies:', error.message);
  }
}

exports.getCastById = async (req, res) => {
  const id = req.params.id;

  try {
    let castInfo = await CastInfo.findByPk(id);
    let combined = [];

    if (!castInfo) {
      const [personRes, creditsRes] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/person/${id}`, {
          params: { api_key: TMDB_API_KEY }
        }),
        axios.get(`https://api.themoviedb.org/3/person/${id}/movie_credits`, {
          params: { api_key: TMDB_API_KEY }
        }),
      ]);

      const person = personRes.data;
      const credits = creditsRes.data;
      combined = [...credits.cast, ...credits.crew];

      const known_for = Array.from(
        new Map(
          combined
            .filter(m => m.vote_count > 0)
            .sort((a, b) => b.popularity - a.popularity)
            .map(m => [m.id, m])
        ).values()
      ).slice(0, 10).map(m => m.id);

      castInfo = await CastInfo.create({
        id: person.id,
        gender: person.gender,
        known_for_department: person.known_for_department,
        name: person.name,
        original_name: person.original_name,
        popularity: person.popularity?.toString(),
        profile_path: person.profile_path,
        known_for,
        also_known_as: person.also_known_as,
        biography: person.biography,
        birthday: person.birthday,
        deathday: person.deathday,
        imdb_id: person.imdb_id,
        place_of_birth: person.place_of_birth,
        adult: person.adult,
        homepage: person.homepage
      });

      await saveMovies(combined);
    }

    const knownForMovies = castInfo.known_for?.length
      ? await Detail.findAll({ where: { id: { [Op.in]: castInfo.known_for } } })
      : [];

    castInfo.known_for = knownForMovies;

    const actingCredits = await Cast.findAll({
      where: { castId: id },
      include: [{ model: Detail, as: 'movie' }]
    });

    const crewCredits = await Crew.findAll({
      where: { castId: id },
      include: [{ model: Detail, as: 'movie' }]
    });

    res.json({
      castInfo,
      actingCredits,
      crewCredits
    });
  } catch (error) {
    console.error('❌ Error in getCastById:', error.message);
    res.status(500).json({ message: 'Error fetching cast details', error: error.message });
  }
};
