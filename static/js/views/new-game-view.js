define(['jquery', 'underscore', 'backbone', 'custom',
'models/game', 'collections/games']
, function($, _, Backbone, Custom, Game, Games) {
   return Backbone.View.extend({
      events: {
         'submit form': function(ev) {
            var that = this;
            ev.preventDefault();
            var form = $(ev.currentTarget);
            var formData = form.serializeObject();
            var data = {
               state: 'paused'
               , time_per_turn: parseInt(formData.time_per_turn, 10)
               , time_per_game: parseInt(formData.time_per_game, 10)
               , date_created: new Date
               , date_updated: new Date
               , count_up: false
               , public: false
               , players: []
               , join_code: null
            };
            Custom.sharedGame = new Game(data);
            Custom.sharedGame.addNewPlayer();
            Custom.sharedGame.addNewPlayer();
            //that.collection.add(model);
            //that.options.publicCollection.add(model);
            that.options.gameView.setModel(Custom.sharedGame);
            this.options.router.navigate('game/new', {trigger: true});
         }
      }
   });
});
