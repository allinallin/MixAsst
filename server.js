// SERVER SETUP
var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var echojs = require('echojs');
var app = express();

app.use(express.static(__dirname + '/public')).use(cookieParser());

// USER CONFIG
var userConfig = require('./app/userConfig.js');
var echo = echojs({
    key: userConfig.ECHONEST_KEY || process.env.ECHONEST_KEY
});

// ROUTES
require('./app/routes.js')(app, request, querystring, echo);

// BOOT
console.log('Listening on 7000');
app.listen(7000);