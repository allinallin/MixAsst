var app = {
	core: 	{},
	api: 	{},
	musescore: 	{}
};

app.core.debug = false;

/* Search Query */

app.api.searchQuery = function ( searchValue, callback ) {
	if (app.core.debug) {
		$.ajax({
			url: '/js/fakeQuery.json',
      	success: onSuccess
		});
	} else {
		$.ajax({
      url: '/search',
      data: { q: searchValue },
      success: onSuccess
    });
	}

  function onSuccess(data) {
    if (callback && typeof(callback) == 'function')
    	callback(data);
  } 
}

/* Search Query Pt 2 */

app.api.getTrackSpecs = function( ids, callback ) {
	if (app.core.debug) {
		$.ajax({
			url: '/js/fakeTrackSpecs.json',
      	success: onSuccess
		});
	} else {
		$.ajax({
      url: '/getTrackSpecs',
      data: { ids: ids },
      success: onSuccess
    });
	}

  function onSuccess(data) {
    if (callback && typeof(callback) == 'function')
    	callback(data);
  } 
};

/* Helper Functions */

function viewport() {
    // workaround for http://bugs.jquery.com/ticket/6724
    // $(window).height gives screensize on iOS, not innerHeight
    return {
        width: window.innerWidth ? window.innerWidth : $(window).width(),
        height: window.innerHeight ? window.innerHeight : $(window).height()
    };
};

(function iife(window, document, app, $) {
	$(function() {
		centerSearchBox();

    $('.search-form').on('submit', function(e) {
      e.preventDefault();
      var searchVal = $('input').val();
      app.api.searchQuery( searchVal, renderQueryResults );
    });

    $(document).on('searchResultsLoaded', function(e) {
			moveSearchBox();
    	animateTracks();

    	var tracks = e.tracks;
    	app.core.searchResults = tracks;

    	if (!tracks) return;

    	setBodyBackground( tracks[0].album.image_url );

    	var trackIds = tracks.map(function( track ) {
    		return track.uri;
    	});

    	app.api.getTrackSpecs( trackIds, displayTrackSpecs );
    });
	});

	function animateTracks() {
		var $tracks = $('.track');

		$tracks
			.addClass('no-transition')
			.css({
				transform: 'translate3d(0,'+viewport().height+'px,0)'
			});
		
		$tracks.height(); // repaint
		
		$tracks
			.removeClass('no-transition')
			.addClass('show');
	}

	function centerSearchBox() {
		var $searchBox = $('.search-wrapper');
		var $inputBarPos = $searchBox.find('input').offset().top;
		var searchBoxY = ( viewport().height - $searchBox.height() ) / 2 - $inputBarPos;

		$searchBox.css({
			transform: 'translate3d(0,'+searchBoxY+'px,0)'
		});
	}

	function renderQueryResults( jsonResults ) {
		var hbsSource = $('#search-results-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.search-results');

		$hbsPlaceholder.html( hbsTemplate( jsonResults ) );

		$.event.trigger({
			type: 'searchResultsLoaded',
			tracks: jsonResults
		});
	}

	function moveSearchBox() {
		var $searchWrapper = $('.search-wrapper');
		var $searchResults = $('.search-results');
		var formTop = $('form', $searchWrapper).offset().top;

		$searchWrapper.add($searchResults).css({
			transform: 'translate3d(0,0,0)'
		});
	}

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
				.text(singleTrackSpecs.tonicFriendly);

			$searchResult
				.find('.tempo')
				.text(singleTrackSpecs.tempo);

			// if (singleTrackSpecs.whosampledUrl) {
			// 	var $whosampledElm = $('<li><a>');
			// 	$whosampledElm.children()
			// 		.text('Whosampled')
			// 		.attr('href', singleTrackSpecs.whosampledUrl);
			// 	$searchResult.find('.tempo').after( $whosampledElm );
			// }
		};

		$.event.trigger({
			type: 'trackSpecsLoaded',
			tracksSpecs: allTrackSpecs
		});
	}

	function setBodyBackground( imageUrl ) {
		var $img = $('<img />');
		var $bg = $('.body-bg');

		$bg.removeClass('show');

		$img.load(function() {
			$bg.css({
					backgroundImage: 'url(' + imageUrl + ')'
				});
			$bg.addClass('show');
		});

		$img[0].src = imageUrl;
	}
})(window, document, app, jQuery);