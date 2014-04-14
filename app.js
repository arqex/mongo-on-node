// Config * Hack, this should be an enviroment variable
process.env.NODE_CONFIG_DIR = __dirname + '/server/config';
var config = require('config');
if(!config.mon.settingsCollection){
	console.error('\r\n*** There is not a collection name for the settings. ***');
	process.exit(1);
}

//Start express
var express = require('express');
var app = express();

//Start plugins
var pluginManager = require(config.path.modules + '/plugins/pluginManager.js');

pluginManager.init(app).then(function(){
	app.managers = {plugins: pluginManager};

	//Start database
	var dbManager = require(config.path.modules + '/db/dbManager.js');
	dbManager.init(app).then(function(){
		console.log('DATABASE OK!');
		var http = require('http');
		var server = http.createServer(app);
		var _u = require('underscore');

		app.use(express.static('public'), {maxAge: 0});
		app.use(express.bodyParser());
		app.use(express.methodOverride());

		//Templates
		var UTA = require('underscore-template-additions'),
			templates = new UTA()
		;
		app.set('views', config.path.views);
		app.engine('html', templates.forExpress());

		//Init routes
		var routeManager = require(config.path.modules + '/routes/routeManager.js');
		routeManager.init(app);
		console.log('ROUTES OK!');

		server.listen(3000);
		console.log('Listening on port 3000');
	});


}).catch(function(err){
	throw err;
});
