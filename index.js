import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import secrets from './secrets.json' assert {type:'json'};

const app = express();
const port = 3000;

const tmdbApiKey = secrets.tmdbApiKey;
const imdbApiKey = secrets.imdbApiKey;

const ytsBaseUrl = "https://yts.mx";

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Function to fetch data from a URL
const fetchData = async (url) => {
    const response = await axios.get(url);
    return response.data;
};

app.get('/', async (req, res) => {
    try {
        var [popularResponse,topRatedResponse,ytsNewReleasesResponse] = await Promise.all([
            fetchData(`https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`),
            fetchData(`https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbApiKey}`),
            fetchData(`${ytsBaseUrl}/api/v2/list_movies.json?sort_by=date_added`)
        ]);
        res.render('index.ejs', {
            resultsPopular: popularResponse.results,
            resultsTopRated: topRatedResponse.results,
            resultsNewlyAdded: ytsNewReleasesResponse.data.movies,
        });
    } catch (error) {
        res.send(500);
        console.log(error)
    };
});

app.get('/movie', async (req, res) => {
    if (req.query.movie_id[0] != 't') {
        var tmdbId = req.query.movie_id;
        var tmdbResponse = (await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}&append_to_response=external_ids,credits`)).data;
        var imdbId = tmdbResponse.external_ids.imdb_id;
        var imdbResponse = (await axios.get(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`)).data;
    } else {
        var imdbId = req.query.movie_id;
        var [imdbResponse,tmdbResponse] = await Promise.all([
            fetchData(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`),
            fetchData(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${tmdbApiKey}`)
        ]);
        var tmdbId = tmdbResponse.movie_results[0].id;
        var tmdbResponse = (await axios.get(`https://api.themoviedb.org/3/movie/${tmdbResponse.movie_results[0].id}?api_key=${tmdbApiKey}&append_to_response=credits`)).data;
    };
    
    var genres = [];
    tmdbResponse.genres.forEach((genre) => {
        genres.push(genre.name);
    });
    var title = tmdbResponse.title;
    var description = tmdbResponse.overview;
    if (description.length > 400) {
        description = description.slice(0,400) + "...";
    };
    var year = tmdbResponse.release_date.slice(0, 4);
    var runtime = tmdbResponse.runtime + ' min';

    const [similarResponse,tmdbImages] = await Promise.all([
        fetchData(`https://api.themoviedb.org/3/movie/${tmdbId}/recommendations?api_key=${tmdbApiKey}`),
        fetchData(`https://api.themoviedb.org/3/movie/${tmdbId}/images?include_image_language=null&api_key=${tmdbApiKey}`)
    ]);

    if (tmdbImages.backdrops[0]) {
        var backdrops=tmdbImages.backdrops.slice(0,10)
    } else {
        const ytsResponse = await axios.get(`${ytsBaseUrl}/api/v2/movie_details.json?imdb_id=${imdbId}`);
        var backdrops=[{file_path:ytsResponse.data.data.movie.background_image_original}];
    };
    res.render('movie.ejs', {
        resultsSimilar: similarResponse.results,
        title: title,
        imdb_rating: imdbResponse.imdbRating,
        year: year,
        genre1: genres[0],
        genre2: genres[1],
        runtime: runtime,
        description: description,
        imdbId: imdbId,
        cast:tmdbResponse.credits.cast,
        backdrops:backdrops 
    });
});

app.get('/search/movie',async (req,res) => {
    const tmdbSearch = await axios.get(`https://api.themoviedb.org/3/search/movie?query=${req.query.query}&include_adult=false&language=en-US&page=${req.query.page || 1}&api_key=${tmdbApiKey}`);
    res.render('search.ejs',{
        searchResults:tmdbSearch.data.results,
        query:req.query.query,
        total_pages:tmdbSearch.data.total_pages,
        page:req.query.page || 1
    });
});

app.get('/download/movie', async (req, res) => {
    try {
        const { imdb_id, title } = req.query;
        const ytsUrl = `${ytsBaseUrl}/api/v2/movie_details.json?imdb_id=${imdb_id}`;
        const tpbBaseUrl = `https://pirate-proxy.black/newapi/q.php?q=`;

        // Initiate all requests in parallel
        const [ytsResponse, tpbResults, tpbResults720p, tpbResults1080p, tpbResults4k] = await Promise.all([
            fetchData(ytsUrl),
            fetchData(`${tpbBaseUrl}${imdb_id}`),
            fetchData(`${tpbBaseUrl}${title} 720p`),
            fetchData(`${tpbBaseUrl}${title} 1080p`),
            fetchData(`${tpbBaseUrl}${title} 2160p`)
        ]);

        // Extract data from YTS response
        const ytsTorrents = ytsResponse.data.movie.torrents;
        const titleLong = ytsResponse.data.movie.title_long;

        // Render the response with fetched data
        res.render('download_movie.ejs', {
            ytsTorrents,
            title,
            title_long: titleLong,
            tpbResults,
            tpbResults720p,
            tpbResults1080p,
            tpbResults4k
        });
    } catch (error) {
        console.error('Error fetching movie data:', error);
        res.status(500).send('Error fetching movie data');
    }
});

app.get('/download/tpb',async (req,res) => {
    const [tpbResponse,tpbFiles] = await Promise.all([
        fetchData(`https://pirate-proxy.black/newapi/t.php?id=${req.query.tpbId}`),
        fetchData(`https://pirate-proxy.black/newapi/f.php?id=${req.query.tpbId}`)
    ]);

    var moviesClasses = "";
    var tvShowsClasses = "";
    var myListClasses = "";
    if (req.query.from == 'movies') {
        moviesClasses = "underline"
    } else if (req.query.from == 'tvShows') {
        tvShowsClasses = "underline"
    } else if (req.query.from == 'myList') {
        myListClasses = "underline"
    };

    res.render('tpb_details.ejs',{
        tpbResponse:tpbResponse,
        tpbFiles:tpbFiles,
        myListClasses:myListClasses,
        tvShowsClasses:tvShowsClasses,
        moviesClasses:moviesClasses,
        tpbId:req.query.tpbId
    });
});

app.get('/stream/movie',(req,res) => {
    res.render('stream.ejs',{
        title:req.query.title,
        id:req.query.imdb_id
    })
});

app.listen(port);
console.log('App running on port 3000.')