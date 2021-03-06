var config = require('config'),
	express = require('express'),
	log = require('winston'),
	Path = require('path'),
	MongoStore = require('connect-mongo')(express),
	jsx = require('express-jsxtransform'),
	settings
;

var app,
	middlewares = [
		{name: 'bodyparser',  handler: express.bodyParser()},
		{name: 'methodoverride', handler: express.methodOverride()}
	]
;

/**
 * Finds a handler index in the middlewares stack by name
 * @param  {String} name The name of the middleware
 * @return {Number}      The index in the stack or -1 if not found.
 */
function getMiddlewareIndex( name, middlewares ) {
	var found = false,
		i = 0,
		current
	;

	while( !found && i<middlewares.length ){
		current = middlewares[i];
		if( current.name == name )
			found = i;
		i++;
	}

	return found === false ? -1 : found;
}

module.exports = {
	init: function( appObject ) {

		if( app ){
			// The init method has been already called
			return;
		}

		app = appObject;

		settings = config.require('settings');

		// Add session middleware
		app.hooks.addFilter( 'middleware', sessionMiddlewareFilter );

		// Add public folder
		app.hooks.addFilter( 'middleware', -10, publicMiddlewareFilter );

		var promise = app.hooks.filter( 'middleware', middlewares )
			.then( function( handlers ){

				var route;

				// Add the middleware to the app
				for (var i = 0; i < handlers.length; i++) {
					route = handlers[i].route || '';
					app.use( route, handlers[i].handler );
					log.debug( 'Middleware enabled', handlers[i] );
				}

				log.debug( app.stack );
				log.debug( 'Middleware initialized.' );
			})
			.catch( function (err ){
				log.error( err.stack );
			})
		;

		return promise;
	},

	getMiddlewareIndex: getMiddlewareIndex
};

/**
 * Add the session middleware to the stack.
 * The default hanlder can be overriden using the filter 'middleware:session'
 *
 * @param  {Array} handlers Objects in the way {name, handler} that define middleware
 * @return {Array}          Updated handlers
 */
function sessionMiddlewareFilter( handlers ) {

	var defaultSessionHandler = config.tule.session ? getSessionHandler() : false;

	if( defaultSessionHandler ) {

	}

	// Filter the session middleware
	return app.hooks.filter('middleware:session', defaultSessionHandler)
		.then( function( sessionHandler ) {

			if( ! sessionHandler ) {
				return handlers;
			}

			log.debug( 'Enabling sessions.' );

			// Add the handlers after body parser
			var i = getMiddlewareIndex( 'bodyparser', handlers );
			handlers.splice( i + 1, 0,
				{name:'cookieparser', handler: express.cookieParser() },
				{name:'session', handler: sessionHandler}
			);
			return handlers;
		})
	;
}

function getSessionHandler(){
	var sessionSettings = config.tule.session,
		db = config.require( 'db' )
	;

	sessionSettings.store = new MongoStore({
		db: db.getInstance('settings').db, // Mongo driver
		collection: 'sessions'
	});

	return express.session( sessionSettings );
}

function publicMiddlewareFilter( handlers ){

	var publicConfig = {
		name: 'tulepublic',
		handler: express.static( config.path.public )
	};

	console.log( publicConfig );

	return settings.get( 'assetsUrl' )
		.then( function( assetsUrl ){
			log.info( 'Adding static folder ' + Path.join( assetsUrl, 'tule') );
			publicConfig.route = Path.join( assetsUrl, 'tule');
			handlers.unshift( publicConfig );

			// Add also the jsx transformer
			handlers.unshift( {name: 'jsx', handler: jsx(), route: '/' });
			return handlers;
		})
		.catch( function( err ){
			log.error( err );
			publicConfig.route = config.tule.assetsUrl;
			handlers.unshift( publicConfig );
			return handlers;
		})
	;
}
