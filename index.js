import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const tmdbApiKey = process.env.tmdbApiKey;
const imdbApiKey = process.env.omdbApiKey;

const ytsBaseUrl = "https://yts.mx";

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Function to fetch data from a URL
const fetchData = async (url) => {
    var i=1;
    while (i<=100) {
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (err) {};
        i++;
    };
    var resp = {
        'results':[],
        'movies':[],
        'data':{'movies':[]}
    };
    return resp;
};
app.get('/', (req,res) => {
    res.redirect('/movies')
});

app.get('/movies', async (req, res) => {
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
            myListClasses:"",
            tvShowsClasses:"",
            moviesClasses:"underline"
        });
    } catch (error) {
        res.send(500);
        console.log(error)
    };
});

app.get('/tvs', async (req, res) => {
    try {
        var [popularResponse,topRatedResponse,newReleasesResponse] = await Promise.all([
            fetchData(`https://api.themoviedb.org/3/tv/popular?api_key=${tmdbApiKey}`),
            fetchData(`https://api.themoviedb.org/3/tv/top_rated?api_key=${tmdbApiKey}`),
            fetchData(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${tmdbApiKey}`)
        ]);
        res.render('index.ejs', {
            resultsPopular: popularResponse.results,
            resultsTopRated: topRatedResponse.results,
            resultsNewlyAdded: newReleasesResponse.results,
            myListClasses:"",
            tvShowsClasses:"underline",
            moviesClasses:""
        });
    } catch (error) {
        res.send(500);
        console.log(error)
    };
});

app.get('/movie', async (req, res) => {
    if (req.query.movie_id[0] != 't') {
        var tmdbId = req.query.movie_id;
        var tmdbResponse = (await Promise.all([fetchData(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}&append_to_response=external_ids,credits`)]))[0];
        var imdbId = tmdbResponse.external_ids.imdb_id;
        var imdbResponse = (await Promise.all([fetchData(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`)]))[0];
    } else {
        var imdbId = req.query.movie_id;
        var [imdbResponse,tmdbResponse] = await Promise.all([
            fetchData(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`),
            fetchData(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${tmdbApiKey}`)
        ]);
        var tmdbId = tmdbResponse.movie_results[0].id;
        var tmdbResponse = (await Promise.all([fetchData(`https://api.themoviedb.org/3/movie/${tmdbResponse.movie_results[0].id}?api_key=${tmdbApiKey}&append_to_response=credits`)]))[0];
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
        try {
            const ytsResponse = await axios.get(`${ytsBaseUrl}/api/v2/movie_details.json?imdb_id=${imdbId}`);
            var backdrops=[{file_path:ytsResponse.data.data.movie.background_image_original}];
        } catch (err) {
            console.log(err);
            var backdrops = [];
        }
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
        backdrops:backdrops,
        myListClasses:"",
        tvShowsClasses:"",
        moviesClasses:"underline"
    });
});

app.get('/tv', async (req, res) => {
    var tmdbId = req.query.tv_id;
    var tmdbResponse = (await Promise.all([fetchData(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbApiKey}&append_to_response=external_ids,credits`)]))[0];
    var imdbId = tmdbResponse.external_ids.imdb_id;
    var imdbResponse = (await Promise.all([fetchData(`http://www.omdbapi.com/?apikey=${imdbApiKey}&i=${imdbId}`)]))[0];
    var genres = [];
    tmdbResponse.genres.forEach((genre) => {
        genres.push(genre.name);
    });
    var description = tmdbResponse.overview;
    if (description.length > 400) {
        description = description.slice(0,400) + "...";
    };
    var year = tmdbResponse.first_air_date.slice(0, 4) + "-" + tmdbResponse.last_air_date.slice(0, 4);

    const [similarResponse,tmdbImages] = await Promise.all([
        fetchData(`https://api.themoviedb.org/3/tv/${tmdbId}/recommendations?api_key=${tmdbApiKey}`),
        fetchData(`https://api.themoviedb.org/3/tv/${tmdbId}/images?include_image_language=null&api_key=${tmdbApiKey}`)
    ]);
    var backdrops=tmdbImages.backdrops.slice(0,10);
    res.render('movie.ejs', {
        resultsSimilar: similarResponse.results,
        title: tmdbResponse.name,
        imdb_rating: imdbResponse.imdbRating,
        year: year,
        genre1: genres[0],
        genre2: genres[1],
        runtime: tmdbResponse.seasons.length + " Seasons",
        description: description,
        imdbId: imdbId,
        cast:tmdbResponse.credits.cast,
        backdrops:backdrops,
        myListClasses:"",
        tvShowsClasses:"underline",
        moviesClasses:""
    });
});


app.get('/search/movie',async (req,res) => {
    const tmdbSearch = (await Promise.all([fetchData(`https://api.themoviedb.org/3/search/movie?query=${req.query.query}&include_adult=false&language=en-US&page=${req.query.page || 1}&api_key=${tmdbApiKey}`)]))[0];
    res.render('search.ejs',{
        searchResults:tmdbSearch.results,
        query:req.query.query,
        total_pages:tmdbSearch.total_pages,
        page:req.query.page || 1,
        myListClasses:"",
        tvShowsClasses:"",
        moviesClasses:"underline"
    });
});
app.get('/search/tv',async (req,res) => {
    const tmdbSearch = (await Promise.all([fetchData(`https://api.themoviedb.org/3/search/tv?query=${req.query.query}&include_adult=false&language=en-US&page=${req.query.page || 1}&api_key=${tmdbApiKey}`)]))[0];
    res.render('search.ejs',{
        searchResults:tmdbSearch.results,
        query:req.query.query,
        total_pages:tmdbSearch.total_pages,
        page:req.query.page || 1,
        myListClasses:"",
        tvShowsClasses:"underline",
        moviesClasses:""
    });
});

app.get('/download/movie', async (req, res) => {
    try {
        const { imdb_id, title } = req.query;
        const ytsUrl = `${ytsBaseUrl}/api/v2/movie_details.json?imdb_id=${imdb_id}`;
        const tpbBaseUrl = `https://thepiratebay.cloud/api.php?url=/q.php?q=`;

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
        fetchData(`https://thepiratebay.cloud/api.php?url=/t.php?id=${req.query.tpbId}`),
        fetchData(`https://thepiratebay.cloud/api.php?url=/f.php?id=${req.query.tpbId}`)
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