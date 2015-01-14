'use strict';

var app = {
	debug: false,
	core: {
		queryList: {},
		userList: {},
		activeTrack: [],
		socketId: ''
	},
	api: {}
};

// app.debug = true;

/* Helper Functions */

function viewport() {
    // workaround for http://bugs.jquery.com/ticket/6724
    // $(window).height gives screensize on iOS, not innerHeight
    return {
        width: window.innerWidth ? window.innerWidth : $(window).width(),
        height: window.innerHeight ? window.innerHeight : $(window).height()
    };
};

(function iife(window, document, app, $, store, io) {
	/* WEBSOCKETS SETUP */
	var socket = io();

	socket.on('connect', function() {
		app.core.socketId = socket.io.engine.id;
	});

	/* USERLIST CACHE */
	app.core.userList = store.get('mixasst_user_list') || {};

	/* LISTENERS */
	$(function() {
    	updateUserListCount();
		centerSearchBox();

	    $('.search-form').on('submit', onSearchSubmit);
	    
		$(document)
			.on('click', '.user-bar button', renderUserList)
	    	.on('click', '.action button', addRemoveTrack)
	    	.on('click', '.audio-controls', playPauseTrack)
	    	.on('trackListLoaded', onTrackListLoaded);

	});

	/* SEARCH QUERY */
	function onSearchSubmit(e) {
		e.preventDefault();
		var searchVal = $('input').val();

		if (!searchVal) {
			searchVal = 'firework katy perry';
			$('input').val(searchVal);
		}

		moveSearchBox();
		showLoadingBox();
		$('.container').attr('data-mode', 'query');
    	app.api.searchQuery( searchVal, renderQueryList );
	}

	app.api.searchQuery = function ( searchValue, callback ) {
		var url = app.debug ? '/js/fakeQuery.json' : '/search';

		$.ajax({
			url: url,
			data: { q: searchValue },
			headers: {
				'socket-id': app.core.socketId
			},
			success: onSuccess
	    });

		function onSuccess(data) {
			if (callback && typeof(callback) == 'function')
				callback(data);
		} 
	}
	
	/* LOADING BOX */

	socket.on('progress', changeLoadingStage);

	function changeLoadingStage(stage) {
		var $loadingStages = $('li', '.loading-box');
		var $nextStage = $loadingStages.eq(stage);

		$nextStage.addClass('active').siblings().removeClass('active');
	}

	function showLoadingBox() {
		$('.list').html('');
	    animateNodeFromBottom($('.loading-box'));
	}

	function hideLoadingBox() {
		$('.loading-box').removeClass('show');
		changeLoadingStage(1);
	}

	/* TRACKLIST RENDERING */

	function updateUserListCount() {
		var $countNode = $('.count', '.user-bar');
		var trackCount = Object.keys(app.core.userList).length;

		$countNode.text(trackCount);
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

		hideLoadingBox();
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

	function onTrackListLoaded(data) {
		moveSearchBox();
    	animateNodeFromBottom($('.track'));

    	for (var track in data.tracks) {
    		setBodyBackground( data.tracks[track].album.image_url );
    		break;
    	}
	}

	/* TRACK ACTIONS */

	function playPauseTrack(e) {
		var $track = $(this).closest('.track');
		var audio = $track.find('audio').get(0);

		if (app.core.activeTrack.length && app.core.activeTrack[0].src !== audio.src) {
			app.core.activeTrack[0].pause();
			app.core.activeTrack[0].currentTime = 0;
			onTrackEnded.call(app.core.activeTrack[0]);
		}

		$track.addClass('active');
		app.core.activeTrack = [audio];

		if (!$track.hasClass('init')) {
			$track.addClass('init loading');

			$(audio).on('playing', onTrackPlaying);
			$(audio).on('pause', onTrackPause);
			$(audio).on('ended', onTrackEnded);
		}
		
		if (audio.paused) {
			audio.play();
		} else {
			audio.pause();
		}
	}

	function onTrackPlaying() {
		var $track = $(this).closest('.track');
		$track.removeClass('loading paused').addClass('playing');
	}

	function onTrackPause() {
		var $track = $(this).closest('.track');
		$track.removeClass('loading playing').addClass('paused');
	}

	function onTrackEnded() {
		var $track = $(this).closest('.track');
		$track.removeClass('active loading playing paused');
		app.core.activeTrack = [];
	}

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

	/* UI */

	function animateNodeFromBottom($node) {
		$node
			.addClass('no-transition')
			.removeClass('show')
			.css({
				transform: 'translate3d(0,'+viewport().height+'px,0)'
			});
		
		$node.height(); // repaint
		
		$node
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
})(window, document, app, jQuery, store, io);