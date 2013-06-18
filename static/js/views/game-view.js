define(['jquery', 'underscore', 'backbone',
'views/edit-player-view',
'text!templates/game.html',
'text!templates/game-controls.html', 
'text!templates/game-settings.html', 'custom']
, function($, _, Backbone, 
EditPlayerView,
_Game, _GameControls, _GameSettings, Custom) {
   return Backbone.View.extend({
      template: _.template(_Game)
      , controlsTemplate: _.template(_GameControls)
      , settingsTemplate: _.template(_GameSettings)
      , lastNumPlayers: -1
      , lastGuidString: ''
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
         this.lastGuidString = '';
         this.render();
         if (this.model.get('public')) {
            this.model.startLongPolling();
         }
      }
      , updateTimes: function() {
         var that = this;
         this.$('li.player').each(function() {
            var guid = $(this).data('guid');
            var player = that.model.getPlayerByGuid(guid);
            if (player === null) {
               return;
            }

            var playerTimeLeft = that.model.getPlayerTimeLeft(player);
            var gameTimeString = Custom.displayTime(playerTimeLeft.gameTimeLeft);
            var turnTimeString = Custom.displayTime(playerTimeLeft.turnTimeLeft);

            $(this).find('.playerGameTime').text(gameTimeString);
            if (player.state == 'waiting') {
               $(this).find('.playerTurnTimeHolder').addClass('hidden');
            } else {
               $(this).find('.playerTurnTimeHolder').removeClass('hidden').
               find('.playerTurnTime').text(turnTimeString);
            }
         });
      }
      , updatePlayerStates: function() {
         var that = this;
         this.$('li.player').each(function() {
            var guid = $(this).data('guid');
            var player = that.model.getPlayerByGuid(guid);
            if (player === null) {
               return;
            }

            if (player.state == 'waiting') {
               $(this).removeClass('playing').addClass('waiting');
            } else {
               $(this).removeClass('waiting').addClass('playing');
            }
         });
      }
      , updatePlayerNamesAndColors: function() {
         var that = this;
         var validColorsString = Custom.validColors.join(' ');
         this.$('li.player').each(function() {
            var guid = $(this).data('guid');
            var player = that.model.getPlayerByGuid(guid);
            if (player === null) {
               return;
            }

            $(this).removeClass(validColorsString).addClass(player.color).
            find('.playerName').text(player.name);
         });
      }
      , render: function() {
         if (this.model === null) {
            return this;
         }
         var that = this;
         var game = this.model.toJSON();
         game.gameTimeString = Custom.displayTime(game.time_per_game);
         game.turnTimeString = Custom.displayTime(game.time_per_turn);
         var now = new Date;
         game.players = _.map(game.players, function(player) {
            var playerTimeLeft = that.model.getPlayerTimeLeft(player);
            player.gameTimeString = Custom.displayTime(playerTimeLeft.gameTimeLeft);
            player.turnTimeString = Custom.displayTime(playerTimeLeft.turnTimeLeft);
            return player;
         });

         
         var newNumPlayers = game.players.length;
         var newGuidString = this.model.getPlayerGuidString();

         if (newGuidString != this.lastGuidString) {
            this.$('.gameDisplay').html(this.template(game));
            this.lastGuidString = newGuidString;
         } else {
            this.updatePlayerNamesAndColors();
            this.updatePlayerStates();
            this.updateTimes();
         }

         if (game.state != this.lastState) {
            this.lastState = game.state;
            this.$('.gameControlsHolder').html(this.controlsTemplate(game));
         }
         return this;
      }
      , events: {
         'click .addPlayerButton': function(ev) {
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
                  this.$('#gameSettingsFormHolder').modal('hide');
                  bootbox.alert("Have friends join with code: " + model.get('join_code') +
                   '<br>Or send a direct link:<br><a href="' + window.location.href +
                   '">' + window.location.href + '</a>');
               }
            });
         }, 'click .resetClockButton': function(ev) {
            this.undelegateEvents();
            bootbox.confirm("Are you sure you want to reset the clock? All players' times will be lost.", 
            _.bind(function(result) {
               this.delegateEvents();
               if (!result)  return;

               this.$('#gameSettingsFormHolder').modal('hide');
               this.model.resetClock();
               if (this.model.get('public')) {
                  this.model.save();
               } else {
                  this.model.render();
               }
            }, this));
         }
         , 'click .returnToMainMenuButton': function(ev) {
            ev.preventDefault();
            this.undelegateEvents();
            bootbox.confirm("Are you sure you want to leave the current game? It will be lost if it's not public.", 
            _.bind(function(result) {
               this.delegateEvents();
               if (!result) return;
               this.$('#gameSettingsFormHolder').modal('hide');
               this.options.router.navigate('#', {trigger: true});
            }, this));
         }
         , 'click li': function(ev) {
            var li = $(ev.currentTarget);
            var guid = li.data('guid');
            var players = this.model.get('players');
            var player = null;
            for (var i = 0; i < players.length; ++i) {
               if (players[i].guid == guid) {
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
         , 'click .gameSettingsButton': function(ev) {
            this.$('#gameSettingsFormHolder').html(this.settingsTemplate(this.model.toJSON())).modal();
         }
      }
   });
});
