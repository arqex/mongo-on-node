'use strict';

var fs = require('fs'),
	config = require('config'),
	path = require('path'),
	when = require('when'),
	promisify = require('when/node/function'),
	pluginsPath = config.path.plugins,
	_ = require('underscore'),
	hooksManager = require('./hooksManager.js')
;

//Hooks
var actions = {},
	filters = {},
	pluginHashes = {}
;

var PluginManager = function(){
		this.plugins = {};
	},
	app = false
;

PluginManager.prototype = {
	init: function(appObject){
		var me = this,
			deferred = when.defer()
		;
		console.log(hooksManager);
		app = appObject;
		app.hooks = me.getHooks(''); // Empty id for core hooks
		this.getActivePlugins().then(
			function(definitions){
				console.log(definitions);
				_.each(definitions, function(def){
					var plugin = me.initPlugin(def);
					if(!plugin.error)
						me.plugins[def.id] = plugin;
				});
				deferred.resolve();
			},
			function(){
				deferred.reject('Error retrieving plugin definitions');
			}
		);

		return deferred.promise;
	},

	initPlugin: function(definition){
		var me = this,
			error = false,
			plugin
		;

		try {
			if(!definition.main)
				throw ('Unknown entry point for plugin ' + definition.id);

			var entryPoint = path.join(config.path.plugins, definition.id, definition.main);

			plugin = require(entryPoint);
			if(!_.isFunction(plugin.init))
				throw ('No init function for plugin ' + definition.id);

			var hooks = me.getHooks(definition.id);
			plugin.init(hooks);

		} catch (e) {
			console.error(e);
			plugin = {error: e};
		}

		return plugin;
	},
	getHooks: function(pluginId){

		// Every plugin need to be its own hooks, so it is possible
		// to remove its filters and actions on deactivate.
		var pluginHash = 'p' + Math.floor(Math.random() * 10000000);
		pluginHashes[pluginId] = pluginHash;
		return {
			on: hooksManager.on.bind(this, actions, pluginHash),
			off: hooksManager.off.bind(this, actions),
			trigger: hooksManager.trigger.bind(this, actions, false),
			addFilter: hooksManager.on.bind(this, filters, pluginHash),
			removeFilter: hooksManager.off.bind(this, filters),
			filter: hooksManager.trigger.bind(this, filters, true)
		};
	},
	getAllPluginDefinitions: function(){
		var me = this,
			deferred = when.defer()
		;
		fs.readdir(pluginsPath, function(err, files){
			if(err)
				return deferred.reject('ERROR READING PLUGIN DIRECTORY ' + err);

			var statPromises = [],
				pluginList = []
			;

			_.each(files, function(file){
				var filePath = path.join(pluginsPath, file),
					promise = promisify.call(fs.stat, filePath)
				;
				promise.then(function(stat){
					if(stat.isDirectory)
						pluginList.push(file);
				});
				statPromises.push(promise);
			});

			when.all(statPromises).then(function(){
				me.getPluginDefinitions(pluginList).then(function(definitions){
					deferred.resolve(definitions);
				});
			});
		});

		return deferred.promise;
	},
	getPluginDefinitions: function(pluginList){
		var me = this,
			deferred = when.defer(),
			promises = [],
			definitions = []
		;

		if(!pluginList.length)
			return deferred.resolve([]);

		_.each(pluginList, function(pluginDir){
			promises.push(me.getPluginDefinition(pluginDir));
		});

		var addDefinitions = function(){
			_.each(promises, function(promise){
				var status = promise.inspect();

				if(status.state == 'fulfilled')
					definitions.push(status.value);
			});
			deferred.resolve(definitions);
		};

		when.all(promises).then(addDefinitions, addDefinitions);

		return deferred.promise;
	},
	getPluginDefinition: function(dirName){
		var descriptionPath = path.join(config.path.plugins, dirName, 'package.json'),
			deferred = when.defer()
		;

		fs.readFile(descriptionPath, function(err, contents){
			var description;

			if(err)
				return deferred.reject('Error reading package.json for ' + dirName);

			try {
				description = JSON.parse(contents);
			} catch (e) {
				return deferred.reject('Invalid package.json for ' + dirName);
			}

			description.id = dirName;

			deferred.resolve(description);
		});

		return deferred.promise;
	},
	createDefinitionsObject: function(promises){
		var definitions = [];
		_.each(promises, function(promise, dirName){
			var status = promise.inspect();
			if(status.state == 'fulfilled'){
				var def = status.value;
				def.id = dirName;
				definitions.push(def);
			}
			else
				console.log('Definition error for ' + dirName + ': ' + status.reason);
		});
		return definitions;
	},


	getActivePlugins: function(){
		var me = this,
			deferred = when.defer()
		;

		if(this.active){
			deferred.resolve(this.active);
			return deferred.promise;
		}

		fs.readFile(__dirname + '/activePlugins.json', function(err, contents){
			var pluginList = [];

			if(err){
				console.log(err);
				contents = '[]';
			}
			try {
				pluginList = JSON.parse(contents);
			} catch(e) {
				console.log('Cant parse ' + contents);
				pluginList = [];
			}

			console.log("**********PLUGIN INIT");
			console.log(pluginList);

			if(!pluginList.length){
				deferred.resolve([]);
			}

			me.getPluginDefinitions(pluginList).then(function(definitions){
				me.active = definitions;
				console.log(definitions);

				if(pluginList.length != definitions.length){
					pluginList = definitions.map(function(def){return def.id;});
					me.saveActivePlugins(pluginList);
				}

				deferred.resolve(definitions);
			});
		});
		return deferred.promise;
	},

	saveActivePlugins: function(pluginList){
		var deferred = when.defer();
		pluginList.sort();
		fs.writeFile(__dirname + '/activePlugins.json', JSON.stringify(pluginList), 'utf8', function(err){
			if(err){
				console.log('Can\'t write activePlugins.json');
				return deferred.reject('Can\'t write activePlugins.json');
			}
			return deferred.resolve(pluginList);
		});
		return deferred.promise;
	},

	activate: function(pluginId){
		var me = this,
			deferred = when.defer()
		;
		this.getActivePlugins().then(function(definitions){
			var definition = _.find(definitions, function(def){ return def.id == pluginId; }),
				pluginList
			;

			if(definition)
				return deferred.resolve(definitions);

			me.getPluginDefinition(pluginId).then(function(definition){
				var plugin = me.initPlugin(definition);
				if(plugin.error)
					return deferred.reject(plugin.error);

				me.plugins[pluginId] = plugin;
				definitions.push(definition);

				pluginList = definitions.map(function(def){return def.id;});

				me.saveActivePlugins(pluginList).then(function(){
					//Update current active definitions
					me.active = definitions;
					deferred.resolve(pluginList);
					app.hooks.trigger('plugin:activated', pluginId);
				});
			});
		});
		return deferred.promise;
	},

	deactivate: function(pluginId){
		var me = this,
			deferred = when.defer()
		;
		this.getActivePlugins().then(function(definitions){
			var definition = _.find(definitions, function(def){ return def.id == pluginId; }),
				pluginList
			;
			if(!definition)
				return deferred.resolve(definitions);

			if(me.plugins[pluginId])
				delete me.plugins[pluginId];

			definitions = _.filter(definitions, function(def){return def.id != pluginId;});
			pluginList = definitions.map(function(def){return def.id;});

			me.saveActivePlugins(pluginList).then(function(){
				//Update current active definitions
				me.active = definitions;
				deferred.resolve(pluginList);
				me.cleanPluginCallbacks(pluginId);
				app.hooks.trigger('plugin:deactivated', pluginId);
			});
		});
		return deferred.promise;
	},

	cleanPluginCallbacks: function(pluginId){
		var callbackObjects = [actions, filters],
			pluginHash = pluginHashes[pluginId]
		;

		callbackObjects.forEach(function(callbackObj){
			for(var hookName in callbackObj){
				for(var priority in callbackObj[hookName]){
					var callbacks = callbackObj[hookName][priority];
					for (var i = callbacks.length - 1; i >= 0; i--) {
						if(callbacks[i].pluginId == pluginHash)
							callbacks.splice(i, 1);
					};
				}
			}
		});
		delete pluginHashes[pluginId];
	}
};

module.exports = new PluginManager();