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
            var time_per_game_data = {
               hours: parseInt(formData.hours_per_game, 10)
               , mins: parseInt(formData.mins_per_game, 10)
               , secs: parseInt(formData.secs_per_game, 10)
            }
            var time_per_turn_data = {
               hours: parseInt(formData.hours_per_turn, 10)
               , mins: parseInt(formData.mins_per_turn, 10)
               , secs: parseInt(formData.secs_per_turn, 10)
            }
            var data = {
               state: 'paused'
               , time_per_turn: Custom.timeStructToSeconds(time_per_turn_data)
               , time_per_game: Custom.timeStructToSeconds(time_per_game_data)
               , date_created: new Date
               , date_updated: new Date
               , count_up: formData.clockDirection == 'up'
               , public: false
               , players: []
               , join_code: null
            };
            Custom.sharedGame = new Game(data);
            Custom.sharedGame.addNewPlayer();
            Custom.sharedGame.addNewPlayer();
            that.options.gameView.setModel(Custom.sharedGame);
            this.$el.modal('hide');
            this.options.router.navigate('game/new', {trigger: true});
         }
         , 'change .radio': function(ev) {
            var val = $('input:radio[name=clockDirection]:checked').val();
            if (val === 'up') {
               $('.clockTimeInputs').addClass('hidden');
            } else {
               $('.clockTimeInputs').removeClass('hidden');
            }
         }
      }
   });
});
