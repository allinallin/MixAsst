// ROUTES

/**
 *  Since node is all about non-blocking I/O, functions 
 *  generally return their results using callbacks. 
 *  The convention used by the node core is to reserve the 
 *  first parameter of any callback for an optional error 
 *  object. 
 *  
 *  You should use the same approach for your own callbacks.
 *
 */
module.exports = function(app, request, querystring, echo) {
    // https://api.spotify.com/v1/search
    app.get('/search', function(req, res) {
        var reqUrl = 'https://api.spotify.com/v1/search?';
        var reqParams = {
            q: req.query.q,
            type: 'track',
            limit: 7
        };
        reqUrl += querystring.stringify(reqParams);

        request(reqUrl, function(error, response, body) {
            if (!error && response.statusCode === 200) {
                condenseAndSendResponse(JSON.parse(body).tracks.items);
                // res.send(JSON.parse(body).tracks.items);
            } else {
                console.log(error)
                console.log(response.statusCode)
            }
        });

        function condenseAndSendResponse(jsonFull) {
            var jsonTrimmed = [];
            for (var i = 0; i < jsonFull.length; i++) {
                var singleTrack = jsonFull[i];
                var info = {
                    uri: singleTrack.uri,
                    name: singleTrack.name,
                    album: {
                        image_url: singleTrack.album.images[0].url,
                        name: singleTrack.album.name
                    },
                    artist: singleTrack.artists.map(function(artist) {
                        return artist.name
                    }).join(', '),
                    preview_url: singleTrack.preview_url
                };
                jsonTrimmed.push(info);
            };
            res.send(jsonTrimmed);
        }
    });
    // http://developer.echonest.com/docs/v4/song/profile
    app.get('/getTrackSpecs', function(req, res) {
        var reqIds = req.query.ids;

        echo('song/profile').get({
            track_id: reqIds,
            bucket: ['audio_summary', 'tracks', 'id:whosampled', 'id:spotify']
        }, function(error, json) {
            if (!error && json.response.status.code === 0) {
                condenseAndSendResponse(json.response.songs);
            } else {
                console.log(error);
                console.log(json.response.status.code);
                console.log(json.response.status.message);
            }
        });

        function condenseAndSendResponse(jsonFull) {
            var jsonTrimmed = [];
            for (var i = 0; i < jsonFull.length; i++) {
                var singleTrack = jsonFull[i];
                var info = {
                    name: singleTrack.title,
                    key: singleTrack.audio_summary.key,
                    mode: singleTrack.audio_summary.mode,
                    tempo: singleTrack.audio_summary.tempo
                };
                info.tonicFriendly = getTonicFriendly(info.key, info.mode);
                info.whosampledUrl = getWhosampledUrl(singleTrack.tracks);
                info.spotifyId = getSpotifyId(singleTrack.tracks);
                jsonTrimmed.push(info);
            };
            res.send(jsonTrimmed);
        }

        function getTonicFriendly(key, mode) {
            var defs = {
                keys: {
                    0: 'C',
                    1: 'C#',
                    2: 'D',
                    3: 'D#',
                    4: 'E',
                    5: 'F',
                    6: 'F#',
                    7: 'G',
                    8: 'G#',
                    9: 'A',
                    10: 'A#',
                    11: 'B'
                },
                modes: {
                    0: 'Minor',
                    1: 'Major'
                }
            };
            var tonicFriendly = defs.keys[key] + ' ' + defs.modes[mode];
            return tonicFriendly;
        }

        function getWhosampledUrl(sampleInfo) {
            if (!sampleInfo) return null;

            var url, base = 'http://www.whosampled.com/track/view/';            

            for (var i = 0; i < sampleInfo.length; i++) {
                if (sampleInfo[i].catalog == 'whosampled') {
                    // get track # from value: whosampled:track:#
                    url = base + sampleInfo[i].foreign_id.split(':')[2];
                }
            };
            
            return url;
        }

        function getSpotifyId(idInfo) {
            if (!idInfo) return null;

            var ids = [];
            
            for (var i = 0; i < idInfo.length; i++) {
                if (idInfo[i].catalog == 'spotify') {
                    if (reqIds.indexOf( idInfo[i].foreign_id ) != -1)
                        ids.push( idInfo[i].foreign_id );
                }
            };
            
            return ids;
        }
    });
};