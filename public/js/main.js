'use strict';

var app = {
	debug: false,
	core: {
		queryList: {},
		userList: {}
	},
	api: {}
};

// app.debug = true;

/* Search Query */

app.api.searchQuery = function ( searchValue, callback ) {
	var url = app.debug ? '/js/fakeQuery.json' : '/search';

	$.ajax({
		url: url,
		data: { q: searchValue },
		success: onSuccess
    });

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

(function iife(window, document, app, $, store) {

	app.core.userList = store.get('mixasst_user_list') || {};

	$(function() {
    	updateUserListCount();
		centerSearchBox();

	    $('.search-form').on('submit', function(e) {
	      e.preventDefault();
	      var searchVal = $('input').val();
	      app.api.searchQuery( searchVal, renderQueryList );
	    });
	    
		$(document).on('click', '.user-bar button', renderUserList);

	    $(document).on('trackListLoaded', function(e) {
			moveSearchBox();
	    	animateTracks();

	    	for (var track in e.tracks) {
	    		setBodyBackground( e.tracks[track].album.image_url );
	    		break;
	    	}
	    });

	    $(document).on('click', '.action button', addRemoveTrack);

	});

	function addRemoveTrack() {
    	var trackId = $(this).closest('.track').attr('data-id');

    	if (app.core.userList.hasOwnProperty(trackId)) {
			delete app.core.userList[trackId];
			$(this).text('Add to List');
    	} else {
			app.core.userList[trackId] = app.core.queryList[trackId];
			app.core.userList[trackId].onUserList = true;
			$(this).text('Remove');
    	}

    	updateUserListCount();

    	store.set('mixasst_user_list', app.core.userList);
	}

	function updateUserListCount() {
		var $countElm = $('.count', '.user-bar');
		var trackCount = Object.keys(app.core.userList).length;

		$countElm.text(trackCount);
	}

	function renderQueryList( jsonResults ) {
		var hbsSource = $('#track-list-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.list', '.query-list');
		var userList = app.core.userList;

		$('.container').attr('data-mode', 'query');
		for (var trackId in userList) {
			if (userList.hasOwnProperty(trackId) && jsonResults.hasOwnProperty(trackId)) {
				jsonResults[trackId].onUserList = true;
			}
		}

		$hbsPlaceholder.html( hbsTemplate( jsonResults ) );
		
		$.event.trigger({
			type: 'trackListLoaded',
			tracks: jsonResults
		});

		app.core.queryList = jsonResults;
	}

	function renderUserList() {
		var hbsSource = $('#track-list-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.list', '.user-list');

		$('.container').attr('data-mode', 'user');
		$hbsPlaceholder.html( hbsTemplate( app.core.userList ) );

		$.event.trigger({
			type: 'trackListLoaded',
			tracks: app.core.userList
		});
	}

	function animateTracks() {
		var $tracks = $('.track');

		$tracks
			.addClass('no-transition')
			.removeClass('show')
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

		$searchWrapper.css({
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
})(window, document, app, jQuery, store);