define(['jquery', 'underscore', 'backbone',
'views/edit-player-view',
'text!templates/game.html', 'text!templates/new-player.html',
'text!templates/game-controls.html', 'custom']
, function($, _, Backbone, 
EditPlayerView,
_Game, _NewPlayer, _GameControls, Custom) {
   return Backbone.View.extend({
      template: _.template(_Game)
      , controlsTemplate: _.template(_GameControls)
      , newPlayerTemplate: _.template(_NewPlayer)
      , lastNumPlayers: -1
      , initialize: function() {
         if (this.model !== null) {
            this.model.on('change', this.render, this);
            this.render();
            if (this.model.get('public')) {
               this.model.startLongPolling();
            }
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
         this.model.on('change:join_code', function() {
            this.options.router.navigate('game/' + this.model.get('join_code'));
            this.model.startLongPolling();
         }, this);
         this.model.on('change:public', function() {
            if (this.model.get('public')) {
               this.model.startLongPolling();
            } else {
               this.model.stopLongPolling();
            }
         }, this);
         this.lastNumPlayers = -1;
         this.render();
         if (this.model.get('public')) {
            this.model.startLongPolling();
         }
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
            this.$('#newPlayerForm').html(this.newPlayerTemplate(game));
         }

         if (game.state != this.lastState) {
            this.lastState = game.state;
            this.$('.gameControlsHolder').html(this.controlsTemplate(game));
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
         , 'click .addPlayerButton': function(ev) {
            ev.preventDefault();
            this.model.addNewPlayer();
            if (this.model.get('public')) {
               this.model.save();
            } else {
               this.render();
            }
         }
         , 'click .nextPlayerButton': function(ev) {
            ev.preventDefault();
            this.model.startNextPlayer();
            if (this.model.get('public')) {
               this.model.save();
            } else {
               this.render();
            }
         }
         , 'click .prevPlayerButton': function(ev) {
            ev.preventDefault();
            this.model.startPrevPlayer();
            if (this.model.get('public')) {
               this.model.save();
            } else {
               this.render();
            }
         }
         , 'click .resetClockButton': function(ev) {
            ev.preventDefault();

            this.model.resetClock();
            if (this.model.get('public')) {
               this.model.save();
            } else {
               this.render();
            }
         }
         , 'click .startClockButton': function(ev) {
            ev.preventDefault();

            if (this.model.get('state') == 'paused') {
               this.model.startClock();
            } else if (this.model.get('state') == 'active') {
               this.model.pauseClock();
            } else {
               this.model.resetClock();
            }

            if (this.model.get('public')) {
               this.model.save();
            } else {
               this.render();
            }
         }
         , 'click .makePublicButton': function(ev) {
            var model = this.model;
            this.model.set({'public': true}, {silent: true}).save(null, {
               success: function() {
                  bootbox.alert("Have friends join with code: " + model.get('join_code'));
               }
            });
         }
         , 'click li': function(ev) {
            var li = $(ev.currentTarget);
            var playerid = li.data('playerid');
            var players = this.model.get('players');
            var player = null;
            for (var i = 0; i < players.length; ++i) {
               if (players[i].guid == playerid) {
                  player = players[i];
                  break;
               }
            }
            if (player === null) {
               console.error("Null player clicked.");
               return;
            }
            new EditPlayerView({
               el: $('#editPlayerFormHolder')
               , model: player
               , game: this.model
               , gameView: this
            });
         }
      }
   });
});
