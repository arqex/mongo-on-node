var deps = [
	'jquery', 'underscore', 'backbone'
];

define(deps, function($,_,Backbone){
	'use strict';

	var datatypes;

	var DatatypeService = function(){
		datatypes = {};
	};

	DatatypeService.prototype = {
		/**
		 * Create a new datatype View.
		 * @param  {Object} options Options needed to initialize the DataTypeView object.
		 *                          * datatype {Object} : Required. An object with the datatype of the view to create. {id, options}
		 *                          * value {Mixed}: The value for de view. If a Backbone model is passed as value, it will
		 *                          	be the model of the view, otherwise a new model will be generated with the value attribute
		 *                          	setted as this value.
		 *                          * viewOptions {Object}: Extra options to initialize the view
		 *                          * state {Object}: An initial state for the view. View's state can change during the life of the view.
		 *
		 * @return {DataTypeView} A particular view for the datatype given, or false on error.
		 */
		get: function(options) {
			var datatype = options.datatype,
				typeDefinition,
				viewOptions
			;

			if(!datatype || !datatype.id || !(typeDefinition = datatypes[datatype.id]))
				return false;

			// Make sure there is an option object
			if(!datatype.options)
				datatype.options = {};

			viewOptions = {
				datatype: datatype,
				viewOptions: options.viewOptions || {},
				state: options.state || {}
			}

			// Check the value/model for the view.
			if(typeof options.value == 'undefined'){
				viewOptions.value = typeDefinition.defaultValue;
			}
			else {
				if(options.value instanceof Backbone.Model)
					viewOptions.model = options.value;
				else
					viewOptions.value = options.value;
			}

			// Initialize the view
			var view = new typeDefinition.View(viewOptions);

			return view;
		},

		add: function(options) {
			datatypes[options.id] = options;
		},

		/**
		 * Return a Datatype View guessing the datatype depending on the value-
		 * @param  {Object} options Options needed to initialize the DataTypeView:
		 *                          * value: The value to guess the view
		 *                          * viewOptions: Extra options to initialize the view.
		 *                          * state: Initial state for the view.
		 *
		 * @return {DataTypeView} A particular view for the value given, or false on error.
		 */
		guessAndGet: function(options) {
			var typeId = 'string',
				value = options.value
			;

			if( _.isArray(value) ) {
				typeId = 'array';
			} else if( _.isObject(value) ) {
				typeId = 'object';
			} else if( (value === parseInt(value, 10)) && ( !isNaN(parseInt(value,10))) ) {
				value = parseInt(value, 10);

				// Big integers are considered as timestamp
				if(Math.abs(value) > 100000000000)
					typeId = 'date';
				else
					typeId = 'integer';
			} else if( (value === parseFloat(value)) && ( !isNaN(parseFloat(value))) ) {
				value = parseFloat(value);
				typeId = 'float';
			} else if( _.isBoolean(value) ) {
				typeId = 'bool';
			}

			return this.get({
				datatype: {id: typeId},
				value: value,
				viewOptions: options.viewOptions || {},
				state: options.state || {}
			});
		},

		getDefinitions: function(){
			return _.extend({}, datatypes);
		}
	}

	return new DatatypeService();
});
