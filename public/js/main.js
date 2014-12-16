var app = {
	core: 		{},
	spotify: 	{},
	echonest: 	{},
	musescore: 	{}
};

app.spotify.searchTrack = function ( searchValue, callback ) {
	$.ajax({
        url: '/search',
        data: { q: searchValue },
        success: function(data) {
            if (callback && typeof(callback) == 'function')
            	callback.apply(this, [data]);
        }
    });
}

app.core.displaySearchResults = function ( jsonResults ) {
	var hbsSource = $('#search-results-template').html();
	var hbsTemplate = Handlebars.compile( hbsSource );
	var $hbsPlaceholder = $('.search-results');

	$hbsPlaceholder.html( hbsTemplate( jsonResults ) );

	$.event.trigger({
		type: 'searchResultsLoaded',
		tracks: jsonResults
	});
}

app.echonest.getTrackSpecs = function( ids, callback ) {
	$.ajax({
        url: '/getTrackSpecs',
        data: { ids: ids },
        success: function(data) {
            if (callback && typeof(callback) == 'function')
            	callback.apply(this, [data]);
        }
    });

    console.log('hit')
};

function displayTrackSpecs( allTrackSpecs ) {
	var $searchResultRows = $('.search-result');

	for (var i = 0; i < allTrackSpecs.length; i++) {
		var singleTrackSpecs = allTrackSpecs[i];
		var $searchResult = $searchResultRows.filter(function() {
			var elmId = this.getAttribute('data-id');
			return singleTrackSpecs.spotifyId.indexOf(elmId) != -1;
		});
		
		$searchResult
			.find('.key')
			.text('Key: ' + singleTrackSpecs.tonicFriendly);

		$searchResult
			.find('.tempo')
			.text('Tempo: ' + singleTrackSpecs.tempo);

		if (singleTrackSpecs.whosampledUrl) {
			var $whosampledElm = $('<li><a>');
			$whosampledElm.children()
				.text('Whosampled')
				.attr('href', singleTrackSpecs.whosampledUrl);
			$searchResult.find('.tempo').after( $whosampledElm );
		}
	};

	$.event.trigger({
		type: 'trackSpecsLoaded',
		tracksSpecs: allTrackSpecs
	});
}

function setBodyBackground( imageUrl ) {
	$('.body-bg').css({
		backgroundImage: 'url(' + imageUrl + ')'
	});
}

$(function() {
    $('.search-form').on('submit', function(e) {
        e.preventDefault();
        var searchVal = $('input').val();
        app.spotify.searchTrack( searchVal, app.core.displaySearchResults );
    });

    $(document).on('searchResultsLoaded', function(e) {
    	var tracks = e.tracks;
    	app.core.searchResults = tracks;

    	if (!tracks) return;

    	setBodyBackground( tracks[0].album.image_url );

    	var trackIds = tracks.map(function( track ) {
    		return track.uri;
    	});

    	app.echonest.getTrackSpecs( trackIds, displayTrackSpecs );
    });
});