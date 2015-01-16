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
            json: {},
            trackIds: []
        };

        var socketId = req.headers['socket-id'];

        updateQueryProgress(0);

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

                searchResults.json = addTopLevelToJson(jsonShort, 'uri');
                searchResults.trackIds = _.pluck(jsonShort, 'uri');

                updateQueryProgress(1);

                return getTrackSpecs(searchResults.trackIds); // Promise
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
                updateQueryProgress(2);
                res.send(jsonFinal);
            })
            .catch(function(err) {
                console.log(err);
                res.send(err);
            });

        function addTopLevelToJson(targetJson, targetKey) {
            var newObj = {};

            for (var i = 0, len = targetJson.length; i < len; i++) {
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
        
        function updateQueryProgress(msg) {
            if (!socketId) return;
            io.sockets.connected[socketId].emit('progress', msg);
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
            return _.map(jsonFull, function(track) {
                return {
                    uri: track.uri,
                    name: track.name,
                    album: {
                        image_url: track.album.images[1].url,
                        name: track.album.name
                    },
                    artist: _.pluck(track.artists, 'name').join(', '),
                    preview_url: track.preview_url
                };
            });
        }

        function condenseEchonestJSON(jsonFull, trackIds) {
            return _.map(jsonFull, function(track) {
                var trackBuckets = _.groupBy(track.tracks, 'catalog');
                return {
                //    name: track.title,
                    key: track.audio_summary.key,
                    mode: track.audio_summary.mode,
                    tempo: track.audio_summary.tempo,
                    tonicFriendly: getTonicFriendly(track.audio_summary.key, track.audio_summary.mode),
                    whosampledUrl: getWhosampledUrl(trackBuckets),
                    uriAliases: getSpotifyIds(trackBuckets, trackIds)
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
            return defs.keys[key] + ' ' + defs.modes[mode];
        }

        function getWhosampledUrl(buckets) {
            if (!buckets.whosampled) return null;
            var baseUrl = 'http://www.whosampled.com/track/view/';            
            return baseUrl + buckets.whosampled.foreign_id.split(':')[2];
        }

        function getSpotifyIds(buckets, trackIds) {
            if (!buckets.spotify) return null;
            return _.map(buckets.spotify, function(item) {
                if (trackIds.indexOf( item.foreign_id ) !== -1)
                    return item.foreign_id
            });
        }

        function mergeIntoResults(specResults) {
            var mainResults = searchResults.json;
            var i, ilen = specResults.length;

            for (i = 0; i < ilen; i++) {
                var track = specResults[i];
                var j, jlen = track.uriAliases.length;

                for (var j = 0; j < jlen; j++) {
                    var uri = track.uriAliases[j];
                    if (mainResults.hasOwnProperty(uri)) {
                        _.extend(mainResults[uri], track);
                    }
                };

            };

            return mainResults;
        }
    });
};