var deps = [
	'jquery', 'underscore', 'backbone',
	'text!tpls/docTable.html',
	'modules/datatypes/dispatcher',
	'modules/alerts/alerts',
	'models/mdispenser'
];
define(deps, function($,_,Backbone, tplSource, dispatcher, Alerts, Dispenser){
	'use strict';
	var DocumentView = Backbone.View.extend({
		tpl: _.template($(tplSource).find('#docTpl').html()),

		initialize: function(opts){
			this.fields = opts.fields || [{href: '#', className: 'remove', icon: 'times'}];
			this.editing = opts.editing || false;
			this.objectView = false;
			this.docOptions = opts.docOptions || {};
			this.docOptions.mode = 'edit';
			this.hidden = opts.hidden || [];
		},
		render: function(){
			this.$el.html(this.tpl({id: this.model.id, editing: this.editing, fields: this.fields, doc: this.model.toJSON()}));

			if(this.editing){
				this.objectView = dispatcher.getView('object', this.docOptions, dispatcher.createModel(this.model.toJSON()));
				this.$('.document-content').find('td').prepend(this.objectView.$el);
				this.objectView.mode = 'edit';
				this.objectView.render();
				this.listenTo(this.objectView.model, 'change:value', function(){
					this.model.clear({silent: true});
					this.model.set(this.objectView.model.get('value'));
				});
			}
			this.trigger('rendered');

		},

		close: function(){
			if(!this.editing)
				return false;

			this.objectView.remove();
			this.editing = false;
			this.render();
		},

		open: function(){
			if(this.editing)
				return false;

			this.editing = true;
			this.render();
		},

		getValue: function(){
			if(this.editing)
				return this.objectView.getValue();
			return this.model.toJSON();
		}

	});

	var NewDocView = Backbone.View.extend({
		tpl: _.template($(tplSource).find('#addNewTpl').html()),
		tplForm: $(tplSource).find('#newFormTpl').html(),
		events: {
			'click .document-new': 'onClickNew',
			'click .document-cancel': 'onClickCancel',
			'click .document-create': 'onClickCreate'
		},
		initialize: function(opts){			
			this.type = opts.type;
			this.collectionView = opts.collectionView;
			this.settings = opts.settings;		
		},

		render: function(){
			this.el = this.$el.html(this.tpl({type: this.type}));			
			this.el.append(this.collectionView.$el);
		},

		onClickNew: function(e){
			e.preventDefault();

			this.objectView = dispatcher.getView('object', this.settings, undefined);

			this.el.find(".form-placeholder").append(this.tplForm);
			this.el.find(".object-form").append(this.objectView.$el);
			this.objectView.mode = 'edit';
			this.objectView.typeOptions.editAllProperties = true;
			this.objectView.render();

			var section = $(e.target).parentsUntil( '.content' );
			section.find('.new-document-form').css('display', 'none');
			section.find('.form').css('display', 'block');
		},

		onClickCancel: function(e){
			e.preventDefault();
			this.objectView = false;
			this.$el.find('.form').remove();
			this.close();
		},

		close: function(){
			var section = this.$el;
			section.find('.form').css('display', 'none');
			section.find('.new-document-form').css('display', 'block');
		},

		onClickCreate: function(e){
			e.preventDefault();

			var doc = Dispenser.getMDoc(this.objectView.getValue()),
				me = this
			;

			_.each(this.objectView.subViews, function(subView){
				subView.typeView.save();
				subView.changeMode('display');
				doc.set(subView.key, subView.typeView.getValue(), {silent:true});
			});

			doc.save(null, {success: function(){
				Alerts.add({message:'Document saved correctly', autoclose:6000});	
				doc.url = '/api/docs/' + this.type + '/' + this.id;			
				me.objectView = false;
				me.$el.find('.form').remove();
				me.close();
				// Render collection view
				me.collection.add(doc);
				me.collectionView.createDocViews();
				me.collectionView.render();	
			}});
		
		}
	});

	var NewCollectionView = NewDocView.extend({
		
		onClickCreate: function(e){
			e.preventDefault();

			var doc = Dispenser.getMCollection(this.objectView.getValue()),
				me = this
			;			

			_.each(this.objectView.subViews, function(subView){
				subView.typeView.save();
				subView.changeMode('display');
				doc.set(subView.key, subView.typeView.getValue(), {silent:true});
			});

			doc.url = '/api/collection';

			doc.save(null, {success: function(){
				Alerts.add({message:'Document saved correctly', autoclose:6000});
				//doc.id = 'collection_' + me.objectView.getValue()['name'];
				//doc.type = me.objectView.getValue()['name'];
				me.objectView = false;
				me.$el.find('.form').remove();
				me.close();
				// Render collection view
				me.collection.add(doc);
				me.collectionView.createDocViews();
				me.collectionView.render();
			}});
		
		}
	});


	var CollectionView = Backbone.View.extend({
		tpl: $(tplSource).find('#tableTpl').html(),
		events: {
			'click .document-ok': 'onClickOk',
			'click .document-cancel': 'onClickCancel',
			'click .document-header>td': 'onClickField'
		},
		initialize: function(opts) {
			this.fields = opts.fields || [{href: '#', className: 'remove', icon: 'times'}];
			this.docViews = {};
			this.docOptions = opts.docOptions || {};
			this.createDocViews();
			this.listenTo(this.collection, 'remove', $.proxy(this.removeSubView, this));
		},
		createDocViews: function(){
			var me = this,
				docViews = {}
			;
			this.collection.each(function(doc){
				var docId = doc.id;
				docViews[docId] = new DocumentView({
					model: doc,
					fields: me.fields,
					editing: (me.docViews[docId] ? me.docViews[docId].editing : false),
					docOptions: me.docOptions,
					hidden: [doc.get('_id')]
				});
				docViews[docId].on('rendered', function(){
					me.renderSubview(docViews[docId]);
				});
			});
			this.docViews = docViews;
		},

		render: function(){			
			this.$el.html(this.tpl);
			var table = this.$('table');
			_.each(this.docViews, function(view){
				view.render();
				table.append(view.el.children);
				view.delegateEvents();
			});

		},

		renderSubview: function(subView){
			var id = subView.model.id,
				form = $(document.getElementById('document-editing-' + id)),
				header = $(document.getElementById('document-' + id))
			;
			form.remove();
			header.replaceWith(subView.el.children);
			subView.delegateEvents();

		},

		removeSubView: function(model){
			var id = model.id,
				form = $(document.getElementById('document-editing-' + id)),
				header = $(document.getElementById('document-' + id))
			;
			this.docViews[id].remove();
			delete(this.docViews[id]);
			form.remove();
			header.remove();
		},

		onClickOk: function(e){
			e.preventDefault();
			var	docId = $(e.target).closest('tr').data('id'),
				doc = this.collection.get(docId),
				view = this.docViews[docId]
			;

			_.each(view.getValue(), function(value, key){
				doc.set(key, value, {silent:true});
			});

			doc.save(null, {success: function(){
				Alerts.add({message:'Document saved correctly', autoclose:6000});
				view.render();
			}});
		},

		onClickCancel: function(e){
			e.preventDefault();

			var	docId = $(e.target).closest('tr').data('id');
			this.docViews[docId].close();
		},

		onClickField: function(e){
			e.preventDefault();
			var td = $(e.currentTarget),
				docId = td.closest('tr').data('id')
			;
			this.trigger('click:' + td.data('action'), this.docViews[docId]);
		}
	});

	return {
		DocumentView: DocumentView,
		CollectionView: CollectionView,
		NewDocView: NewDocView,
		NewCollectionView: NewCollectionView
	};

});