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
    app.get('/search', function(req, res) {
        var client = {
            queryId: parseInt(req.headers['query-id']),
            socketId: req.headers['socket-id']
        };
        var searchResults = {
            json: {},
            trackIds: []
        };
        
        updateQueryProgress(0);

        getTrackList()
            .then(function(contents) {
                var jsonFull = contents.tracks.items;

                if (!jsonFull.length) {
                    throw new AbortError({
                        status: 200,
                        message: 'No track list results',
                        payload: searchResults.json
                    });
                }

                var jsonShort = condenseSpotifyJSON(jsonFull);

                searchResults.json = addTopLevelToJson(jsonShort, 'uri');
                searchResults.trackIds = Object.keys(searchResults.json);

                updateQueryProgress(1);

                // return Promise
                return getTrackSpecs(searchResults.trackIds);
            })
            .then(function(contents) {
                var jsonFull = contents.response.songs;

                if (!jsonFull || !jsonFull.length) {
                    throw new AbortError({
                        status: 200,
                        message: 'No track spec results',
                        payload: searchResults.json
                    });
                }

                var jsonShort = condenseEchoNestJSON(jsonFull, searchResults.trackIds);

                // return value
                return mergeIntoResults(jsonShort);
            })
            .then(function(payload) {
                updateQueryProgress(2);
                res.send(payload);
            })
            .catch(ApiError, function(err) {
                console.log(err);
                res.status(err.status).send(err.toString());
            })
            .catch(AbortError, function(err) {
                console.log(err);
                updateQueryProgress(2);
                res.status(err.status).send(err.payload);
            })
            .catch(function(err) {
                console.log(err);
                res.status(500).send(err.toString());
            });

        function getTrackList() {
            return new Promise(function(resolve, reject) {
                // https://api.spotify.com/v1/search
                var spotifyReqUrl = 'https://api.spotify.com/v1/search?';
                spotifyReqUrl += querystring.stringify({
                    q: req.query.q,
                    type: 'track',
                    limit: 7
                });
                request(spotifyReqUrl, function(error, response, body) {
                    var jsonFull = JSON.parse(body);
                    
                    if (jsonFull.error) {
                        // https://developer.spotify.com/web-api/user-guide/#response-status-codes
                        reject(new ApiError({
                            name: 'SpotifyError',
                            status: jsonFull.error.status,
                            message: jsonFull.error.message
                        }));
                    } else {
                        resolve(jsonFull);
                    }
                });
            });
        }

        function getTrackSpecs(trackArray) {
            return new Promise(function(resolve, reject) {
                // http://developer.echonest.com/docs/v4/song/profile
                echo('song/profile').get({
                    track_id: trackArray,
                    bucket: ['audio_summary', 'tracks', 'id:whosampled', 'id:spotify']
                }, function(err, json) {
                    if (err) {
                        // http://developer.echonest.com/docs/v4/#response-codes
                        reject(new ApiError({
                            name: 'EchoNestError',
                            status: err,
                            code: json.response.status.code,
                            message: json.response.status.message
                        }));
                    } else {
                        resolve(json);
                    }
                });
            });
        }

        function ApiError(errorObj) {
            this.name = 'ApiError';
            this.status = 400;
            this.message = '';
            if (errorObj) _.assign(this, errorObj);
            Error.captureStackTrace(this, ApiError);
        }

        ApiError.prototype = Object.create(Error.prototype);
        ApiError.prototype.constructor = ApiError;

        function AbortError(errorObj) {
            this.name = 'AbortError';
            this.status = 200;
            this.message = '';
            this.payload = {};
            if (errorObj) _.assign(this, errorObj);
            Error.captureStackTrace(this, AbortError);
        }

        AbortError.prototype = Object.create(Error.prototype);
        AbortError.prototype.constructor = AbortError;
        
        function updateQueryProgress(msg) {
            if (!client.socketId) return;
            io.sockets.connected[client.socketId].emit('progress', {queryId: client.queryId, stage: msg});
        }

        function addTopLevelToJson(targetJson, targetKey) {
            var newObj = {};

            for (var i = 0, len = targetJson.length; i < len; i++) {
                var targetValue = targetJson[i][targetKey];
                if (!newObj.hasOwnProperty(targetValue)) {
                    newObj[targetValue] = targetJson[i];
                    delete newObj[targetValue].uri;
                }
            };

            return newObj;
        }

        function condenseSpotifyJSON(jsonFull) {
            return _.map(jsonFull, function(track) {
                return {
                    uri: track.uri,
                    name: track.name,
                    album: {
                        imageUrl: track.album.images[1].url,
                        name: track.album.name
                    },
                    artist: _.pluck(track.artists, 'name').join(', '),
                    previewUrl: track.preview_url
                };
            });
        }

        function condenseEchoNestJSON(jsonFull, trackIds) {
            return _.map(jsonFull, function(track) {
                var trackBuckets = _.groupBy(track.tracks, 'catalog');
                return {
                //    name: track.title,
                //    key: track.audio_summary.key,
                //    mode: track.audio_summary.mode,
                    analysisUrl: track.audio_summary.analysis_url,
                    tonicFriendly: getTonicFriendly(track.audio_summary.key, track.audio_summary.mode),
                    tempo: track.audio_summary.tempo,
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
            if (!buckets.whosampled) return;
            var baseUrl = 'http://www.whosampled.com/track/view/'; 
            return _.map(buckets.whosampled, function(item) {
                return baseUrl + item.foreign_id.split(':')[2];
            });
        }

        function getSpotifyIds(buckets, trackIds) {
            if (!buckets.spotify) return;
            return _.reduce(buckets.spotify, function(acc, item) {
                if (trackIds.indexOf( item.foreign_id ) !== -1)
                    acc.push(item.foreign_id);
                return acc;
            }, []);
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
                        _.assign(mainResults[uri], track);
                        delete mainResults[uri].uriAliases;
                    }
                };

            };

            return mainResults;
        }
    });
};