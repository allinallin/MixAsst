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
module.exports = function(app, request, querystring, Promise, echo) {
    var requestP = Promise.promisify(request);

    app.get('/search', function(req, res) {
        var searchResults = {
            json: [],
            ids: []
        };

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
                var trackIds = jsonShort.map(function( track ) {
                    return track.uri;
                });

                searchResults.json = addTopLevelToJson(jsonShort, 'uri');
                searchResults.trackIds = trackIds;

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
            var jsonTrimmed = [];

            for (var i = 0; i < jsonFull.length; i++) {
                var singleTrack = jsonFull[i];
                var info = {
                    uri: singleTrack.uri,
                    name: singleTrack.name,
                    album: {
                        image_url: singleTrack.album.images[1].url,
                        name: singleTrack.album.name
                    },
                    artist: singleTrack.artists.map(function(artist) {
                        return artist.name
                    }).join(', '),
                    preview_url: singleTrack.preview_url
                };
                jsonTrimmed.push(info);
            };

            return jsonTrimmed;
        }

        function condenseEchonestJSON(jsonFull, trackIds) {
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
                info.spotifyId = getSpotifyId(singleTrack.tracks, trackIds);
                jsonTrimmed.push(info);
            };
            return jsonTrimmed;
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