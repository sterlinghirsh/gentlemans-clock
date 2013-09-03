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
            join_code = Custom.makeid(5, true);
            var data = {
               state: 'paused'
               , time_per_turn: parseInt(formData.time_per_turn, 10)
               , time_per_game: parseInt(formData.time_per_game, 10)
               , date_created: new Date
               , date_updated: new Date
               , current_turn: 1
               , count_up: false
               , public: false
               , players: []
               , join_code: join_code
               , backend: {name: 'g', channel: join_code}
            };
            var model = new Game(data);
            model.addNewPlayer();
            model.addNewPlayer();
            //that.collection.add(model);
            //that.options.publicCollection.add(model);
            that.options.gameView.setModel(model);
            this.options.router.navigate('game/new', {trigger: true});
         }
      }
   });
});
