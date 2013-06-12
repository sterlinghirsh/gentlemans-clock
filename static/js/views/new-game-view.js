define(['jquery', 'underscore', 'backbone',
'models/game', 'collections/games']
, function($, _, Backbone, Game, Games) {
   return Backbone.View.extend({
      events: {
         'submit form': function(ev) {
            var that = this;
            ev.preventDefault();
            var form = $(ev.currentTarget);
            var data = form.serializeObject();
            var model = new Game(data);
            model.set({
               state: 'paused'
               , date_created: new Date
               , date_updated: new Date
               , current_turn: 1
               , count_up: false
               , public: false
               , players: []
            });
            //that.collection.add(model);
            that.options.gameView.setModel(model);
            this.options.router.navigate('game/new', {trigger: true});
            /*
            model.save(null, {success: function(model) {
               //;
            }});
            */
         }
      }
   });
});

