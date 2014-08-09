var deps = [
	'jquery', 'underscore', 'backbone', 'services',

	'baseView',
	'pageController',

	'alerts',
	'events',

	'text!./tpls/tuleSettings.html'
];

define(deps, function($,_,Backbone, Services, BaseView, PageController, Alerts, Events, tplSource) {
	'use strict';

	var SettingsController = BaseView.extend({
		tpl: _.template(tplSource),
		settingsName: 'tule',

		events: {
			'click .js-settings-ok': 'onSettingsSave'
		},

		defaults: {
			siteTitle: 'Tule',
			pageSize: 10
		},

		initialize: function(options) {
			var me = this;

			this.service = Services.get('settings');

			this.loading = this.service.get(this.settingsName)
				.fail(function(err){
					console.log(err);
					Alerts.add('Unexpected error fetching the settings. Please, try again.');
				})
				.then(function(tuleSettings){
					me.settings = tuleSettings.value;
				})
			;
		},

		render: function() {
			this.$el.html('Loading...');

			var me = this;
			this.loading
				.then(function() {
					me.$el.html(me.tpl(_.extend(me.defaults, me.settings)));
				})
				.fail(function(){
					me.$el.html('Whooops!');
				})
			;
			return this;
		},

		onSettingsSave: function(e) {
			e.preventDefault();
			var settings = this.getSettingsValue();
			this.saveSettings(settings);
		},

		saveSettings: function(updatedSettings) {
			var me = this;

			this.service.save(this.settingsName, updatedSettings)
				.then(function(){
					me.settings = updatedSettings;
					Alerts.add({
						message: 'Settings updated.',
						autoclose: 6000
					});

					Events.trigger('settings:updated', updatedSettings);
				})
				.fail(function(err){
					console.log(err);
					Alerts.add({
						message: 'Error updating settings. Please, retry.',
						level: 'error'
					});
				})
			;
		},

		getSettingsValue: function(){
			var settings = {};

			settings.siteTitle = this.$('.js-setting-title').val();
			settings.pageSize = this.$('.js-setting-pageSize').val();

			return settings;
		}

	});

	return PageController.extend({
		title: 'Tule Settings',
		contentView: SettingsController
	});
});