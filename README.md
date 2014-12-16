# Mix Asst
Web app that displays helpful information on songs fetched from third-party music APIs.

## TODO
Refer to workflow comments in `routes.js`.

## Inspiration
At the very early stage of creating a music mashup, DJs dedicate most of their effort to finding compatible song pairings. Many song characteristics are taken into account, including but not limited to: song key, tempo, genre, lyrics.

This tool is meant to facilitate the search for song pairings and primarily focuses on displaying song key and tempo - the more useful but less obvious song characteristics.

Additional features in progress.

## Setup and Installation

Follow directions [here](http://static.echonest.com/enspex/) to set up developer accounts for Spotify and The Echo Nest.

Edit `userConfig.js` to fill in your third-party API Keys. This file is git ignored and should not be committed to a public repo. The current file uploaded is a template.

Project runs on `node` and uses `bower` for file management. Run the following in the root:
<pre>
$ npm install
$ bower install
</pre>

Run `node app.js` in the root to start the server at `127.0.0.1:7000`.

## Stack Overview
- [Spotify Web API](https://developer.spotify.com/web-api/)
- [The Echo Nest API](http://developer.echonest.com/)
- [echojs](https://github.com/tcr/echojs) - Echo Nest node.js helper
- [Bootstrap](http://getbootstrap.com/)
- [jQuery](http://jquery.com/)
- [Bower](http://bower.io/)

## Beyond

I wanted this to be a quick and free tool. For something better and more accurate, I recommend checking out software dedicated to analyzing song key and tempo.