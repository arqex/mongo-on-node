var deps = [
	'jquery', 'underscore', 'backbone', 'services',
	'modules/alerts/alerts',
	'modules/navigation/navigationController',
	'region'
];

define(deps, function($,_,Backbone, Services, Alerts, Navigation, Region){

	var MainController = Backbone.View.extend({
		initialize: function(opts){
			window.alerter = Alerts.alerter;
			this.$('.pagetitle').after(Alerts.alerter.el);

			this.navigation 		= opts.navigation;
			this.navigationRegion 	= new Region({el: this.$('#navigationRegion')});
			this.pageRegion 		= new Region({el: this.$('#pageRegion')});

			this.navigationRegion.show(this.navigation);
			this.navigation.manager(location.pathname);

			this.listenTo(this.pageRegion, 'save', function(routes){
				this.navigation.update(routes);
				this.navigation.manager(location.pathname);
			});
		},

		loadContent: function(file, args){
			var me = this;
			require([file], function(Controller){
				var controller = new Controller({args: args});
				me.pageRegion.show(controller);
			});
		}
	});

	return MainController;
});