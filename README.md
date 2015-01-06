# Mix Asst
Web app that displays helpful information on songs fetched from third-party music APIs.
## Demo
[MixAsst Website](http://mixasst.callinaryarts.co)

## TODO
- Preview track feature
- Spec confidence indicators
- Loading indicators
- Error handling

## Inspiration
At the very early stage of creating a music mashup, DJs dedicate most of their effort to finding compatible song pairings. Many song characteristics are taken into account, including but not limited to: song key, tempo, genre, lyrics.

This tool is meant to facilitate the search for song pairings and primarily focuses on displaying song key and tempo - the more useful but less obvious song characteristics.

Additional features in progress.

## Setup and Installation

Follow directions [here](http://static.echonest.com/enspex/) to set up developer accounts for Spotify and The Echo Nest.

Edit `app/userConfig.js` to fill in your third-party API Keys. This file is git ignored and should not be committed to a public repo. The current file uploaded is a template.

Project runs on `node` and uses `grunt` and `bower` for task and file management, respectively. Run the following in the root:
<pre>
$ npm install
$ bower install
</pre>

Run `grunt serve` in the root to start the server at `localhost:7000`.

## Stack Overview
- [Spotify Web API](https://developer.spotify.com/web-api/)
- [The Echo Nest API](http://developer.echonest.com/)
- [echojs](https://github.com/tcr/echojs) - Echo Nest node.js helper
- [jQuery](http://jquery.com/)
- [store.js](https://github.com/marcuswestin/store.js) - localStorage helper
- [Handlebars](http://handlebarsjs.com/)
- [Grunt](http://gruntjs.com/)
- [Bower](http://bower.io/)

## Beyond

I wanted this to be a quick and free tool. For something better and more accurate, I recommend checking out software dedicated to analyzing song key and tempo.