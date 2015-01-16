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
module.exports = function(app, request, querystring, Promise, echo, io, _) {
    var requestP = Promise.promisify(request);

    app.get('/search', function(req, res) {
        var searchResults = {
            json: [],
            ids: []
        };

        var socketId = req.headers['socket-id'];

        if (socketId)
            io.sockets.connected[socketId].emit('progress', '1');

        var spotifyReqUrl = 'https://api.spotify.com/v1/search?';

        spotifyReqUrl += querystring.stringify({
            q: req.query.q,
            type: 'track',
            limit: 7
        });
        
        // https://api.spotify.com/v1/search
        requestP(spotifyReqUrl)
            .spread(function(response, body) {
                var status = {
                    code: response.statusCode
                };

                if (ClientError(status.code) || SpotifyError(status.code))
                    throw new Error("Oh no!");

                var jsonFull = JSON.parse(body).tracks.items;
                var jsonShort = condenseSpotifyJSON(jsonFull);
                var trackIds = _.map(jsonShort, function( track ) {
                    return track.uri;
                });

                searchResults.json = addTopLevelToJson(jsonShort, 'uri');
                searchResults.trackIds = trackIds;

                if (socketId)
                    io.sockets.connected[socketId].emit('progress', '2');

                return getTrackSpecs(trackIds); // Promise
            })
            // http://developer.echonest.com/docs/v4/song/profile
            .then(function(contents) {
                var status = {
                    code: contents.response.status.code,
                    message: contents.response.status.message
                };

                if (ClientError(status.code) || EchonestError(status.code))
                    throw new Error("Oh no!");

                var jsonFull = contents.response.songs;
                var jsonShort = condenseEchonestJSON(jsonFull, searchResults.trackIds);

                return mergeIntoResults(jsonShort); // Json
            })
            .then(function(jsonFinal) {
                if (socketId)
                    io.sockets.connected[socketId].emit('progress', '3');
                
                res.send(jsonFinal);
            })
            .catch(function(err) {
                console.log(err);
            });

        function addTopLevelToJson(targetJson, targetKey) {
            var newObj = {};

            for (var i = 0; i < targetJson.length; i++) {
                var targetValue = targetJson[i][targetKey];
                if (!newObj.hasOwnProperty(targetValue)) {
                    newObj[targetValue] = targetJson[i];
                }
            };

            return newObj;
        }

        function getTrackSpecs(trackArray) {
            return new Promise(function(resolve, reject) {
                echo('song/profile').get({
                    track_id: trackArray,
                    bucket: ['audio_summary', 'tracks', 'id:whosampled', 'id:spotify']
                }, function(err, json) {
                    if (err) {
                        reject(err);
                    } else if (json) {
                        resolve(json);
                    }
                });
            });
        }
        
        function ClientError(e) {
            return e.code >= 400 && e.code < 500;
        }

        function SpotifyError(e) {
            return e.code == 200;
        }

        function EchonestError(e) {
            return e.code == 0;
        }

        function condenseSpotifyJSON(jsonFull) {
            return _.map(jsonFull, function(item) {
                return {
                    uri: item.uri,
                    name: item.name,
                    album: {
                        image_url: item.album.images[1].url,
                        name: item.album.name
                    },
                    artist: _.map(item.artists, function(artist) {
                        return artist.name
                    }).join(', '),
                    preview_url: item.preview_url
                };
            });
        }

        function condenseEchonestJSON(jsonFull, trackIds) {
            return _.map(jsonFull, function(item) {
                return {
                    name: item.title,
                    key: item.audio_summary.key,
                    mode: item.audio_summary.mode,
                    tempo: item.audio_summary.tempo,
                    tonicFriendly: getTonicFriendly(item.audio_summary.key, item.audio_summary.mode),
                    whosampledUrl: getWhosampledUrl(item.tracks),
                    spotifyId: getSpotifyId(item.tracks, trackIds)
                };
            });
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

        function getSpotifyId(idInfo, trackIds) {
            if (!idInfo) return null;

            var ids = [];
            
            for (var i = 0; i < idInfo.length; i++) {
                if (idInfo[i].catalog == 'spotify') {
                    if (trackIds.indexOf( idInfo[i].foreign_id ) != -1)
                        ids.push( idInfo[i].foreign_id );
                }
            };
            
            return ids;
        }

        function mergeIntoResults(specResults) {
            var mainResults = searchResults.json;

            for (var i = 0; i < specResults.length; i++) {
                var singleSpec = specResults[i];
                var singleSpecId = singleSpec.spotifyId;

                for (var j = 0; j < singleSpecId.length; j++) {
                    if (mainResults.hasOwnProperty(singleSpecId[j])) {
                        var matchedResult = mainResults[singleSpecId[j]];
                        matchedResult.key = singleSpec.key;
                        matchedResult.mode = singleSpec.mode;
                        matchedResult.tempo = singleSpec.tempo;
                        matchedResult.tonicFriendly = singleSpec.tonicFriendly;
                        matchedResult.whosampledUrl = singleSpec.whosampledUrl;
                    }
                };
            };

            return mainResults;
        }
    });
};