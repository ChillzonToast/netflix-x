import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import secrets from './secrets.json' assert {type:'json'};

const app = express();
const port = 3000;

const tmdbApiKey = secrets.tmdbApiKey;
const imdbApiKey = secrets.imdbApiKey;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    const popularResponse = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`);
    const topRatedResponse = await axios.get(`https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbApiKey}`);
    const ytsNewReleasesResponse = await axios.get('https://yts.mx/api/v2/list_movies.json?sort_by=date_added');
    res.render('index.ejs', {
        resultsPopular: popularResponse.data.results,
        resultsTopRated: topRatedResponse.data.results,
        resultsNewlyAdded: ytsNewReleasesResponse.data.data.movies,
    });
});

app.get('/movie', async (req, res) => {
    if (req.query.movie_id[0] != 't') {
        var tmdbId = req.query.movie_id;
        var tmdbResponse = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}&append_to_response=external_ids`);
        var imdbId = tmdbResponse.data.external_ids.imdb_id;
        var imdbResponse = await axios.get(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`);

    } else {
        var imdbId = req.query.movie_id;
        var imdbResponse = await axios.get(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`);
        var tmdbResponse = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${tmdbApiKey}`);
        var tmdbId = tmdbResponse.data.movie_results[0].id;
        var tmdbResponse = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbResponse.data.movie_results[0].id}?api_key=${tmdbApiKey}`)

    };

    if (tmdbResponse.data.backdrop_path == undefined) {
        const ytsResponse = await axios.get(`https://yts.mx/api/v2/movie_details.json?imdb_id=${imdbId}`);
        var backdrop = ytsResponse.data.data.movie.background_image_original;
    } else {
        var backdrop = 'https://image.tmdb.org/t/p/w1280' + tmdbResponse.data.backdrop_path;
    };
    if (imdbResponse.data.Response == 'True') {
        var genres = imdbResponse.data.Genre.split(", ");
        var title = imdbResponse.data.Title;
        var description = imdbResponse.data.Plot;
        var year = imdbResponse.data.Year;
        var runtime = imdbResponse.data.Runtime;
    } else {
        var genres = [];
        tmdbResponse.data.genres.forEach((genre) => {
            genres.push(genre.name);
        });
        var title = tmdbResponse.data.title;
        var description = tmdbResponse.data.overview;
        var year = tmdbResponse.data.release_date.slice(0, 4);
        var runtime = tmdbResponse.data.runtime + ' min';
    };


    const similarResponse = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${tmdbApiKey}`);

    res.render('movie.ejs', {
        resultsSimilar: similarResponse.data.results,
        backdrop: backdrop,
        title: title,
        imdb_rating: imdbResponse.data.imdbRating,
        year: year,
        genre1: genres[0],
        genre2: genres[1],
        runtime: runtime,
        description: description,
        imdbId: imdbId
    });
});

app.listen(port);