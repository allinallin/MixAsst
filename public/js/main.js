var app = {
	core: {
		queryList: [],
		userList: []
	},
	api: {},
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
	    	setBodyBackground( e.tracks[0].album.image_url );
	    });

	    $(document).on('click', '.action button', function(e) {
	    	var trackId = $(this).closest('.track').attr('data-id');
	    	var queryList = app.core.queryList;

	    	for (var i = 0; i < queryList.length; i++) {
	    		if (queryList[i].uri == trackId) {
	    			app.core.userList.push(queryList[i]);
	    			break;
	    		}
	    	};

	    	$(this).text('Added').prop('disabled', true);
	    });
	});

	function renderQueryResults( jsonResults ) {
		var hbsSource = $('#search-results-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.search-results');
		var userList = app.core.userList;

		for (var i = 0; i < userList.length; i++) {
			var userTrack = userList[i];
			for (var j = 0; j < jsonResults.length; j++) {
				if (userTrack.uri == jsonResults[j].uri) {
					jsonResults[j].onUserList = true;
					break;
				}
			};
		};

		$hbsPlaceholder.html( hbsTemplate( jsonResults ) );
		
		$.event.trigger({
			type: 'searchResultsLoaded',
			tracks: jsonResults
		});

		app.core.queryList = jsonResults;
	}

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

	function moveSearchBox() {
		var $searchWrapper = $('.search-wrapper');
		var $searchResults = $('.search-results');
		var formTop = $('form', $searchWrapper).offset().top;

		$searchWrapper.add($searchResults).css({
			transform: 'translate3d(0,0,0)'
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