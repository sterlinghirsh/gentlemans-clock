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
            data.time_per_turn = parseInt(data.time_per_turn, 10);
            data.time_per_game = parseInt(data.time_per_game, 10);
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
            model.addNewPlayer();
            model.addNewPlayer();
            //that.collection.add(model);
            that.options.gameView.setModel(model);
            this.options.router.navigate('game/new', {trigger: true});
         }
      }
   });
});
