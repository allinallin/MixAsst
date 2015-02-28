'use strict';

var app = {
	debug: false,
	core: {
		queryList: {},
		userList: {},
		activeQuery: {
			id: 0,
			ajax: null
		},
		activeTrack: [],
		socketId: ''
	},
	api: {}
};

/* Helper Functions */

(function injectLivereload(window, document) {
	if (location.host.indexOf('localhost') === -1 && location.host.indexOf('127.0.0.1') === -1)
		return;

	document.write('<script src="http://'
	+ window.location.hostname
	+ ':35729/livereload.js?snipver=1"><\/script>');
})(window, document);

function viewport() {
    // workaround for http://bugs.jquery.com/ticket/6724
    // $(window).height gives screensize on iOS, not innerHeight
    return {
        width: window.innerWidth ? window.innerWidth : $(window).width(),
        height: window.innerHeight ? window.innerHeight : $(window).height()
    };
};

/* Real functions */

(function iife(window, document, app, $, _, store, io) {
	/* WEBSOCKETS SETUP */
	var socket = io.connect(location.origin);

	socket.on('connect', function() {
		app.core.socketId = socket.io.engine.id;
	});

	/* USERLIST CACHE */
	app.core.userList = store.get('mixasst_user_list') || {};

	/* DEFAULT AUTH STATE */
	sessionStorage.setItem('mixasst_auth', 'false');

	/* RESIZE EVENT SETUP */
	var throttleCenterSearchBox = _.throttle(centerSearchBox, 250);

	/* LISTENERS */
	$(function() {
    	updateUserListCount();

    	// handle auth state
		if (location.search === '?auth=success') {
			sessionStorage.setItem('mixasst_auth', 'true');
			window.history.replaceState({}, '', location.origin + location.pathname + location.hash);
		} else if (location.search === '?auth=error') {
			// error state
		}

	   	$(window)
	   		.on('resize', throttleCenterSearchBox);
		$(document)
	    	.on('trackListLoaded', onTrackListLoaded)
			.on('submit', '.search-form', onSearchSubmit)
			.on('click', '.create-playlist-form', onClickPlaylistModal)
			.on('click', '.user-bar button', handleUserListTrigger)
	    	.on('click', '.action button', addRemoveTrack)
	    	.on('click', '.audio-controls', playPauseTrack)
	    	.on('click', '.create-playlist-button', triggerCreatePlaylist);
    	
    	// handle path /#mylist
    	if (location.hash === '#mylist') {
			$('.container').attr('data-mode', 'user');
			moveSearchBox();
			renderUserList();
		} else {
			centerSearchBox();
		}

	});

	function onClickPlaylistModal(e) {
		if ($(e.target).hasClass('close') || $(e.target).hasClass('modal')) {
			e.preventDefault();
			closeModal($(e.target).closest('.modal'));
			return;
		} else if ($(e.target).closest('button').hasClass('submit')) {
			e.preventDefault();
			var $form = $(e.target).closest('form');
			var inputName = $('input[type=text]', $form).val();
			var inputPublic = $('input[type=checkbox]', $form).is(':checked');
			var tracks = Object.keys(app.core.userList);
			
			if (!inputName.trim()) {
				inputName = 'Awesome Mix 6';
				$('input[type=text]', $form).val('Awesome Mix 6');
			}
			$(e.target).closest('button').prop('disabled', true);
			app.api.createPlaylist(inputName, inputPublic, tracks);
		}
	}

	function showPlaylistResult(result, name) {
		var $form = $('.create-playlist-form form');
		var $submit = $form.find('.submit');

		if (name) {
			$form.find('.name').html(name);
		}

		$form.addClass(result);
		$submit.prop('disabled', false);
	}

	function showPlaylistError() {
		var $form = $('.create-playlist-form');
		var $submit = $form.find('.submit');

		$form.addClass('error');
		$submit.prop('disabled', false);
	}

	function triggerCreatePlaylist(e) {
		var $modal = $(e.target.parentNode).find('.modal');
		openModal($modal);
	}

	function openModal($node) {
		var $modalObj = $node.find('.modal-object');

		$node.addClass('show');

		$modalObj
			.addClass('no-transition')
			.removeClass('show')
			.css({
				transform: 'translate3d(0,'+viewport().height+'px,0)'
			});
		
		$modalObj.height(); // repaint
		
		$modalObj
			.removeClass('no-transition')
			.addClass('show')
			.find('input[type=text]')
			.select();

		$(window).on('keyup', shortcutCloseModal);
	}

	function shortcutCloseModal(e) {
		if (e.keyCode === 27) {
			var $modal = $('.create-playlist-form');
			closeModal($modal);
		}
	}

	function closeModal($node) {
		var $modalObj = $node.find('.modal-object');

		$modalObj.removeClass('success error');
		$node.add($modalObj).removeClass('show');
		$(window).off('keyup', shortcutCloseModal);
	}

	/* SEARCH QUERY */
	function onSearchSubmit(e) {
		e.preventDefault();
		var $input = $('input', this);
		var searchVal = $input.val().trim();

		if (!searchVal) {
			searchVal = 'firework katy perry';
			$input.val(searchVal);
		}

		$input.blur();

		moveSearchBox();
		endActiveQuery();
		hideMessageBoxes();
		showLoadingBox();

		$('.container').attr('data-mode', 'query');
    	app.api.searchQuery( searchVal, renderQueryList );
	}

	app.api.createPlaylist = function(playlistName, isPublic, trackIds, callback) {
		$.ajax({
			type: 'POST',
			url: '/createplaylist',
			data: {
				name: playlistName,
				isPublic: isPublic,
				tracks: trackIds
			},
			success: onAjaxSuccess,
			error: onAjaxError
		});

		function onAjaxSuccess(playlistName) {
			console.log(playlistName);
			showPlaylistResult('success', playlistName);
		}

		function onAjaxError(data) {
			console.log(data);
			showPlaylistResult('error');
		}
	}

	app.api.searchQuery = function ( searchValue, callback ) {
		var url = app.debug ? '/js/fakeQueryResponse.json' : '/search';
		
		++app.core.activeQuery.id;
		
		app.core.activeQuery.ajax = $.ajax({
			url: url,
			data: { q: searchValue },
			headers: {
				'query-id': app.core.activeQuery.id,
				'socket-id': app.core.socketId
			},
			success: onAjaxSuccess,
			error: showErrorBox
	    });

		function onAjaxSuccess(data) {
			if (callback && typeof(callback) == 'function')
				callback(data);
		}
	}

	function endActiveQuery() {
		if (!app.core.activeQuery.ajax) return;
		
		app.core.activeQuery.ajax.abort();
		app.core.activeQuery.ajax = null;
	}

	/* MESSAGE BOXES */

	function hideMessageBoxes() {
		hideLoadingBox();
		hideErrorBox();
		hideNoResultsBox();
	}
	
	/* LOADING BOX */

	socket.on('progress', changeLoadingStage);

	function changeLoadingStage(data) {
		if (data.queryId !== app.core.activeQuery.id) return;

		var $loadingStages = $('li', '.loading-box');
		var $nextStage = $loadingStages.eq(data.stage);

		$nextStage.addClass('active').siblings().removeClass('active');
	}

	function showLoadingBox() {
		$('.list').html('');
	    animateNodeFromBottom($('.loading-box'));
	}

	function hideLoadingBox() {
		$('.loading-box').removeClass('show');
		changeLoadingStage({queryId: app.core.activeQuery.id, stage: 0});
	}

	/* ERROR BOX */

	function showErrorBox(data) {
		hideLoadingBox();
		$('.error-box .status').text(data.status);
		$('.error-box .message').text(data.responseText);
	    animateNodeFromBottom($('.error-box'));
	}

	function hideErrorBox() {
		$('.error-box').removeClass('show');
	}

	/* NO RESULTS BOX */

	function showNoResultsBox() {
		$('.list').html('');
	    animateNodeFromBottom($('.no-results-box'));
	}

	function hideNoResultsBox() {
		$('.no-results-box').removeClass('show');
	}

	/* TRACKLIST RENDERING */

	function updateUserListCount() {
		var $countNode = $('.count', '.user-bar');
		var trackCount = Object.keys(app.core.userList).length;

		$countNode.text(trackCount);
	}

	function renderQueryList( jsonResults ) {
		hideLoadingBox();

		if ($.isEmptyObject(jsonResults)) {
			showNoResultsBox();
			return;
		}
		
		var hbsSource = $('#track-list-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.list', '.query-list');
		var userList = app.core.userList;

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

	function handleUserListTrigger() {
		moveSearchBox();
		endActiveQuery();
		hideMessageBoxes();
		
		window.history.replaceState({}, '', '#mylist');
		$('.container').attr('data-mode', 'user');
		renderUserList();
	}

	function renderUserList() {
		if ($.isEmptyObject(app.core.userList)) {
			showNoResultsBox();
		}

		var hbsSource = $('#track-list-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.list', '.user-list');

		$hbsPlaceholder.html( hbsTemplate( app.core.userList ) );

		$.event.trigger({
			type: 'trackListLoaded',
			tracks: app.core.userList
		});

		renderUserActions();
	}

	function renderUserActions() {
		var hbsSource = $('#user-actions-template').html();
		var hbsTemplate = Handlebars.compile( hbsSource );
		var $hbsPlaceholder = $('.actions', '.user-list');

		$hbsPlaceholder.html( hbsTemplate( {auth: sessionStorage.getItem('mixasst_auth') } ) );
	}

	function onTrackListLoaded(data) {
    	animateNodeFromBottom($('.track'));

    	for (var track in data.tracks) {
    		setBodyBackground( data.tracks[track].album.imageUrl );
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

	var userBarTimeout = null;

	function addRemoveTrack() {
    	var trackId = $(this).closest('.track').attr('data-id');
    	var $userBar = $('.user-bar');

		if (userBarTimeout)
			clearTimeout(userBarTimeout);

		$userBar
			.removeClass('track-added track-removed')
			.height();

    	if (app.core.userList.hasOwnProperty(trackId)) {
			delete app.core.userList[trackId];
			$(this).text('Add to List');
			$userBar.addClass('track-removed');
    	} else {
			app.core.userList[trackId] = app.core.queryList[trackId];
			app.core.userList[trackId].onUserList = true;
			$(this).text('Remove');
			$userBar.addClass('track-added');
		}

		userBarTimeout = setTimeout(function() {
			$userBar.removeClass('track-removed track-added');
		}, 1000);

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
		var userBarHeight = $('.user-bar').outerHeight();
		var searchBoxY = ( viewport().height - $searchBox.outerHeight() ) / 2 - userBarHeight;

		$searchBox.css({
			transform: 'translate3d(0,'+searchBoxY+'px,0)'
		});
	}

	function moveSearchBox() {
		var $searchWrapper = $('.search-wrapper');

		$(window).off('resize');
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
})(window, document, app, jQuery, _, store, io);