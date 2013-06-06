define(['jquery', 'underscore', 'backbone',
'text!templates/game.html', 'custom']
, function($, _, Backbone, _Game, Custom) {
   return Backbone.View.extend({
      el: $('#gameDetail')
      , template: _.template(_Game)
      , initialize: function() {
         if (this.model !== null) {
            this.model.on('change', this.render, this);
            this.render();
            this.model.fetch(); // re-get the model
         }
         this.refreshInterval = window.setInterval(
          _.bind(this.render, this), 1000);
      }
      , setModel: function(model) {
         if (this.model !== null) {
            this.model.off('change');
         }
         this.model = model;
         this.model.on('change', this.render, this);
         this.render();
         this.model.fetch();
      }
      , render: function() {
         if (this.model === null) {
            return this;
         }
         var game = this.model.toJSON();
         game.gameTimeString = Custom.displayTime(game.time_per_game);
         game.turnTimeString = Custom.displayTime(game.time_per_turn);
         var now = new Date;
         game.players = _.map(game.players, function(player) {
            var gameTimeLeft  = game.time_per_game - player.game_time_used;
            var turnTimeLeft = game.time_per_turn - player.turn_time_used;
            if (player.date_turn_started !== null) {
               var timeDiff = Math.floor((now - new Date(player.date_turn_started)) / 1000);
               turnTimeLeft -= timeDiff;
               if (turnTimeLeft < 0) {
                  gameTimeLeft += turnTimeLeft;
                  turnTimeLeft = 0;
               }
            };
            player.gameTimeString = Custom.displayTime(gameTimeLeft);
            player.turnTimeString = Custom.displayTime(turnTimeLeft);
            return player;
         });
         this.$el.html(this.template(game));
         this.delegateEvents();
         return this;
      }
      , events: {
         'submit #newPlayerForm': function(ev) {
            ev.preventDefault();
            var form = $(ev.currentTarget);
            var data = form.serializeObject();
            var players = this.model.get('players');
            players.push(data);
            this.model.set('players', players);
            this.model.save();
         }
         , 'click #nextPlayerButton': function(ev) {
            ev.preventDefault();
            this.model.startNextPlayer().save();
         }
         , 'click #startClockButton': function(ev) {
            ev.preventDefault();
            this.model.startClock().save();
         }
      }
   });
});
