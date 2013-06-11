define(['jquery', 'underscore', 'backbone',
'text!templates/game.html', 'text!templates/new-player.html', 'custom']
, function($, _, Backbone, _Game, _NewPlayer, Custom) {
   return Backbone.View.extend({
      el: $('#gameDetail')
      , template: _.template(_Game)
      , lastNumPlayers: -1
      , initialize: function() {
         if (this.model !== null) {
            this.model.on('change', this.render, this);
            this.render();
            this.model.startLongPolling();
            //this.model.fetch(); // re-get the model
         }
         this.refreshInterval = window.setInterval(
          _.bind(this.render, this), 1000);
      }
      , setModel: function(model) {
         if (this.model !== null) {
            this.model.off('change');
            this.model.stopLongPolling();
         }
         this.model = model;
         this.model.on('change', this.render, this);
         this.lastNumPlayers = -1;
         this.render();
         this.model.startLongPolling();
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
               var timeDiff = Math.floor((now - serverToLocal(player.date_turn_started)) / 1000);
               turnTimeLeft -= timeDiff;
               turnTimeLeft = _.min([game.time_per_turn, turnTimeLeft]);
               if (turnTimeLeft < 0) {
                  gameTimeLeft += turnTimeLeft;
                  turnTimeLeft = 0;
               }
            };
            player.gameTimeString = Custom.displayTime(gameTimeLeft);
            player.turnTimeString = Custom.displayTime(turnTimeLeft);
            return player;
         });

         var newNumPlayers = game.players.length;

         this.$('#gameDisplay').html(this.template(game));

         if (newNumPlayers != this.lastNumPlayers) {
            this.lastNumPlayers = newNumPlayers;
            this.$('#newPlayerForm').html(_.template(_NewPlayer)(game));
         }
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
