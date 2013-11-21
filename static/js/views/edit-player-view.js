define(['jquery', 'underscore', 'backbone', 'bootbox',
'custom', 
'text!templates/edit-player.html', 'bootstrap']
, function($, _, Backbone, bootbox, Custom, _EditPlayer) {
   return Backbone.View.extend({
      template: _.template(_EditPlayer)
      , updateTimeInterval: null
      , initialize: function() {
         var that = this;
         this.form = this.$('form');
         this.validColors = Custom.validColors;
         this.$el.on('hidden', function() {
            that.undelegateEvents();
            if (that.updateTimeInterval !== null) {
               clearInterval(that.updateTimeInterval);
            }
            that.updateTimeInterval = null;
         }).on('shown', function() {
            that.delegateEvents();
            that.$('#playerName').focus();
            if (that.updateTimeInterval !== null) {
               clearInterval(that.updateTimeInterval);
            }
            that.updateTimeInterval = setInterval(_.bind(that.updateTimeDisplay, that), 1000);
         });
      }
      , setGame: function(game) {
         this.options.game = game ;
      }
      , showPlayer: function(player) {
         this.model = player;
         this.render();
      }
      , render: function() {
         var data = _.extend({
            validColors: this.validColors
            , positionInfo: this.options.game.
             getPlayerPositionByGuid(this.model.guid)
         }, this.model);
         this.form.html(this.template(data));
         $('.focusedInput').val('false');

         this.updateTimeDisplay();
         this.$el.modal();
      }, updateTimeDisplay: function() {
         var time = this.options.game.getPlayerTimeLeft(this.model).gameTimeLeft;
         var struct = Custom.timeDisplayStruct(Custom.secondsToStruct(time));
         $('.hoursInput').val(struct.hours);
         $('.minutesInput').val(struct.mins);
         $('.secondsInput').val(struct.secs);
      }, events: {
         'click .movePlayerUpButton': function(ev) {
            ev.preventDefault();
            var players = this.options.game.get('players');
            var keyToMove = null;
            for (var i = 0; i < players.length; ++i) {
               if (players[i].guid == this.model.guid) {
                  keyToMove = i;
                  break;
               }
            }
            
            if (keyToMove === null) {
               console.error("Tried to move null player.");
               return;
            }

            if (keyToMove === 0) {
               return;
            }

            var temp = players[i - 1];
            players[i - 1] = players[i];
            players[i] = temp;
            
            this.options.game.set({players: players});
            if (this.options.game.get('public')) {
               this.options.game.save();
            }
            this.render();
         }
         , 'click .movePlayerDownButton': function(ev) {
            ev.preventDefault();
            var players = this.options.game.get('players');
            var keyToMove = null;
            for (var i = 0; i < players.length; ++i) {
               if (players[i].guid == this.model.guid) {
                  keyToMove = i;
                  break;
               }
            }
            
            if (keyToMove === null) {
               console.error("Tried to move null player.");
               return;
            }

            if (keyToMove === players.length - 1) {
               return;
            }

            var temp = players[i + 1];
            players[i + 1] = players[i];
            players[i] = temp;
            
            this.options.game.set({players: players});
            if (this.options.game.get('public')) {
               this.options.game.save();
            }
            this.render();
         }
         , 'click #removePlayerButton': function(ev) {
            ev.preventDefault();
            this.undelegateEvents();
            bootbox.confirm("Are you sure you want to remove this player? You cannot undo this action.",
             _.bind(function(result) {
               this.delegateEvents();
               if (!result)
               return;
               var players = this.options.game.get('players');
               var keyToRemove = null;
               for (var i = 0; i < players.length; ++i) {
                  if (players[i].guid == this.model.guid) {
                     keyToRemove = i;
                     break;
                  }
               }

               if (keyToRemove === null) {
                  console.error("Tried to remove null player.");
                  return;
               }

               players.splice(i, 1);
               this.options.game.set({players: players});
               if (this.options.game.get('public')) {
                  this.options.game.save();
               }
               this.$el.modal('hide');
            }, this))
         }
         , 'focus .playerTime input': function(ev) {
            if (this.updateTimeInterval !== null) {
               clearInterval(this.updateTimeInterval);
            }
            this.updateTimeInterval = null;
            $('.focusedInput').val('true');
         }
         , 'submit': function(ev) {
            ev.preventDefault();
            var data = this.form.serializeObject();
            var that = this;
            var gameTime = this.options.game.get('time_per_game');

            var players = this.options.game.get('players');
            var timeData;
            for (var i = 0; i < players.length; ++i) {
               if (players[i].guid == that.model.guid) {
                  players[i].name = data.name;
                  players[i].color = data.color;

                  if (data.focused === 'true') {
                     timeData = {
                        hours: parseInt(data.hours, 10)
                        , mins: parseInt(data.mins, 10)
                        , secs: parseInt(data.secs, 10)
                     };
                     if (this.options.game.get('count_up')) {
                        players[i].game_time_used = Custom.timeStructToSeconds(timeData);
                     } else {
                        players[i].game_time_used = gameTime - Custom.timeStructToSeconds(timeData);
                        
                        if (players[i].state === 'playing') {
                           players[i].date_turn_started = localToServer(new Date());
                        }
                     }
                  }
                  break;
               }
            };

            this.options.game.set({players: players});
            if (this.options.game.get('public')) {
               this.options.game.save();
            }
            this.$el.modal('hide');
         }
      }
   });
});
