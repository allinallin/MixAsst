// SERVER SETUP
var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var SpotifyWebApi = require('spotify-web-api-node');
var echojs = require('echojs');
var Promise = require('bluebird');
var _ = require('lodash');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

// MIDDLEWARE
app
	.use(express.static(__dirname + '/public'))
	.use(cookieParser())
	.use(bodyParser.json())
	.use(bodyParser.urlencoded({
  		extended: true
	}));

// USER CONFIG
var userConfig = require('./app/userConfig.js');
var spotifyApi = new SpotifyWebApi({
    clientId: userConfig.SPOTIFY_KEY || process.env.SPOTIFY_KEY,
    clientSecret: userConfig.SPOTIFY_SECRET || process.env.SPOTIFY_SECRET,
    redirectUri: userConfig.SPOTIFY_REDIRECT || process.env.SPOTIFY_REDIRECT
});
var echo = echojs({
    key: userConfig.ECHONEST_KEY || process.env.ECHONEST_KEY
});

// ROUTES
require('./app/routes.js')(app, request, querystring, Promise, spotifyApi, echo, io, _);

// BOOT
console.log('Listening on 7000');
server.listen(7000);