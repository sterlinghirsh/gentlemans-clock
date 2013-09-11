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
      , refreshTime: 1000
      , lastGuidString: ''
      , refreshInterval: null
      , initialize: function() {
         if (this.model !== null) {
            this.model.on('change', this.render, this);
            this.render();
            //this.model.fetch(); // re-get the model
         }
         this.refreshInterval = window.setInterval(
          _.bind(this.render, this), this.refreshTime);
         this.editPlayerView = new EditPlayerView({
            el: $('#editPlayerFormHolder')
            , game: this.model
            , gameView: this
         });
      }
      , restartInterval: function() {
         if (this.refreshInterval !== null) {
            window.clearInterval(this.refreshInterval);
         }
         this.refreshInterval = window.setInterval(
          _.bind(this.render, this), this.refreshTime);
      }
      , setModel: function(model) {
         var that = this;
         if (model.get('error')) {
            bootbox.alert(model.get('error'), function() {
               that.options.router.navigate('/', {trigger: true});
            });
            return;
         }
         if (this.model !== null) {
            this.model.off('change');
         }
         this.model = model;
         this.editPlayerView.setGame(model);
         this.model.on('change', this.render, this);
         this.model.on('change:join_code', function() {
            that.options.router.navigate('game/' + this.model.get('join_code'));
         }, this);
         this.lastNumPlayers = -1;
         this.lastGuidString = '';
         this.render();
      }
      , updateTimes: function() {
         var that = this;
         var now = new Date;
         this.$('li.player').each(function() {
            var guid = $(this).data('guid');
            var player = that.model.getPlayerByGuid(guid);
            if (player === null) {
               return;
            }

            var playerTimeLeft = that.model.getPlayerTimeLeft(player, now);
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
               // Player becoming active.
               if (!$(this).hasClass('playing')) {
                  $(this).removeClass('waiting').addClass('playing');
                  var gameDisplay = $('.gameDisplay');
                  var elTop = $(this).position().top;
                  var elHeight = $(this).outerHeight();
                  var elBottom = elTop + elHeight;
                  var scrollTop = gameDisplay.scrollTop();
                  var scrollHeight = gameDisplay.innerHeight();
                  var scrollBottom = scrollTop + scrollHeight;
                  var offset = (scrollHeight / 2) - (elHeight / 2);

                  if (elTop < scrollTop || elBottom > scrollBottom) {
                     gameDisplay.animate({
                        scrollTop: elTop - offset
                     }, 200);
                  }
               }
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
         var now = new Date;
         game.players = _.map(game.players, function(player) {
            var playerTimeLeft = that.model.getPlayerTimeLeft(player, now);
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
      , save: function() {
         if (this.model.get('public')) {
            this.render();
            this.model.save();
         } else {
            this.render();
         }
      }
      , events: {
         'click .addPlayerButton': function(ev) {
            ev.preventDefault();
            var player = this.model.addNewPlayer();
            this.save();
            this.editPlayerView.showPlayer(player);
         }
         , 'click .nextPlayerButton': function(ev) {
            ev.preventDefault();
            this.model.startNextPlayer();
            this.save();
            this.restartInterval();
         }
         , 'click .prevPlayerButton': function(ev) {
            ev.preventDefault();
            this.model.startPrevPlayer();
            this.save();
            this.restartInterval();
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

            this.save();
            this.restartInterval();
         }
         , 'click .makePublicButton': function(ev) {
            Custom.socketConnect();
            var model = this.model;
            var that = this;
            this.model.set({'public': true}, {silent: true}).save(null, {
               success: function() {
                  that.options.router.navigate('game/' + that.model.get('join_code'));
                  that.$('#gameSettingsFormHolder').modal('hide');
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
               this.save();
            }, this));
         }
         , 'click .returnToMainMenuButton': function(ev) {
            ev.preventDefault();
            this.undelegateEvents();
            bootbox.confirm("Are you sure you want to leave the current game? It will be lost if it's not public.", 
            _.bind(function(result) {
               this.delegateEvents();
               if (!result) return;
               Custom.socketDisconnect();
               this.model.set({public: false, join_code: null});
               this.$('#gameSettingsFormHolder').modal('hide');
               delete Custom.sharedGame;
               Custom.sharedGame = null;
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
            this.editPlayerView.showPlayer(player);
         }
         , 'click .gameSettingsButton': function(ev) {
            this.$('#gameSettingsFormHolder').html(this.settingsTemplate(this.model.toJSON())).modal();
         }
      }
   });
});
