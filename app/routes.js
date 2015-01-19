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
module.exports = function(app, request, querystring, Promise, spotifyApi, echo, io, _) {
    
    var generateRandomString = function(length) {
        var text = '';
        var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    };

    function ApiError(errorObj) {
        this.name = 'ApiError';
        this.status = 400;
        this.message = '';
        if (errorObj) _.assign(this, errorObj);
        Error.captureStackTrace(this, ApiError);
    }

    function requireAuthentication(req, res, next) {
        if (spotifyApi.getAccessToken()) {
            next();
        } else {
            res.redirect('/login');
        }
    }

    ApiError.prototype = Object.create(Error.prototype);
    ApiError.prototype.constructor = ApiError;

    app.get('/login', function(req, res) {
        var scope = [
            'playlist-read-private', 
            'playlist-modify-public', 
            'playlist-modify-private'
        ];
        var state = generateRandomString(16);
        var redirectURI = req.protocol + '://' + req.get('host') + '/callback';
        spotifyApi.setRedirectURI(redirectURI);
        var authorizeURL = spotifyApi.createAuthorizeURL(scope, state);
        
        res.cookie('mixasst_auth_state', state);
        res.redirect(authorizeURL);
    });

    app.get('/callback', function(req, res) {
        var code = req.query.code || null;
        var state = req.query.state || null;
        var storedState = req.cookies ? req.cookies['mixasst_auth_state'] : null;

        if (state === null || state !== storedState) {
            res.redirect('/#' +
                querystring.stringify({ error: 'state_mismatch' })
            );
        } else {
            res.clearCookie('mixasst_auth_state');
            spotifyApi.authorizationCodeGrant(code)
                .then(function(data) {
                    // console.log('The token expires in ' + data['expires_in']);
                    // console.log('The access token is ' + data['access_token']);
                    // console.log('The refresh token is ' + data['refresh_token']);

                    // Set the access token on the API object to use it in later calls
                    spotifyApi.setAccessToken(data['access_token']);
                    spotifyApi.setRefreshToken(data['refresh_token']);

                    return spotifyApi.getMe();
                })
                .then(function(data) {
                    res.clearCookie('mixasst_userid');
                    res.cookie('mixasst_userid', data.id);
                    res.redirect('/#mylist');
                })
                .catch(function(err) {
                    console.log(err);
                    res.redirect('/#' +
                        querystring.stringify({ error: 'invalid_token' })
                    );
                });
        }
    });

    app.post('/createplaylist', requireAuthentication, function(req, res) {
        var userId = req.cookies['mixasst_userid'];
        var isPublic = (req.body.isPublic === 'true');

        spotifyApi.createPlaylist(userId, req.body.name)
            .then(function(data) {
                console.log(data);
                return spotifyApi.addTracksToPlaylist(userId, data.id, req.body.tracks)
            })
            .then(function(data) {
                console.log(data)
                res.send(201);
            })
            .catch(function(err) {
                console.log(err);
                res.send(err);
            });

        // function makeNewPlaylist(userId, playlistName, isPublic) {
        //     return new Promise(function(resolve, reject) {
        //         request.post({
        //             url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
        //             headers: {
        //                 Authorization: 'Bearer ' + spotifyApi.getAccessToken()
        //             },
        //             json: true,
        //             body: {
        //                 name: playlistName,
        //                 'public': isPublic
        //             }
        //         }, function(err, response, body) {
        //             console.log(response);
        //             if (body.error) {
        //                 reject(new ApiError({
        //                     name: 'SpotifyError',
        //                     status: body.error.status,
        //                     message: body.error.message
        //                 }));
        //             } else {
        //                 resolve(body);
        //             }
        //         });
        //     });
        // }
    });

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

        getTrackList(req.query.q)
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
            .catch(AbortError, function(err) {
                console.log(err);
                updateQueryProgress(2);
                res.status(err.status).send(err.payload);
            })
            .catch(ApiError, function(err) {
                console.log(err);
                res.status(err.status).send(err.toString());
            })
            .catch(function(err) {
                console.log(err);
                res.status(500).send(err.toString());
            });

        function getTrackList(query) {
            return new Promise(function(resolve, reject) {
                // https://api.spotify.com/v1/search
                spotifyApi.searchTracks(query, {
                    type: 'track',
                    limit: 7
                }, function(err, data) {
                    if (err) {
                        // https://developer.spotify.com/web-api/user-guide/#response-status-codes
                        reject(new ApiError({
                            name: 'SpotifyError',
                            message: err.message
                        }));
                    } else {
                        console.log(data);
                        resolve(data);
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
                }, function(err, data) {
                    if (err) {
                        // http://developer.echonest.com/docs/v4/#response-codes
                        reject(new ApiError({
                            name: 'EchoNestError',
                            status: err,
                            code: data.response.status.code,
                            message: data.response.status.message
                        }));
                    } else {
                        resolve(data);
                    }
                });
            });
        }

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