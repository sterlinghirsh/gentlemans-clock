define(['jquery', 'underscore', 'backbone', 'custom'],
function($, _, Backbone, Custom) {
   return Backbone.Model.extend({
      urlRoot: '/api/games'
      , idAttribute: 'join_code'
      , initialize: function() {
         var that = this;

         this.bind('update', function(model) {
            if (model.error) {
               console.error(model.error);
            } else {
               that.set(model);
            }
         });
      }
      , getActivePlayerKey: function() {
         var players = this.get('players');
         var activePlayerKey = null;
         
         _.each(players, function(player, key) {
            if (player.state == 'playing') {
               activePlayerKey = key;
            }
         });

         return activePlayerKey;
      }
      , getPlayerGuidString: function() {
         var players = this.get('players');
         var str = '';
         for (var i = 0; i < players.length; ++i) {
            str += players[i].guid;
         }
         return str;
      }
      , getPlayerByGuid: function(guid) {
         var players = this.get('players');
         for (var i = 0; i < players.length; ++i) {
            if (players[i].guid === guid) {
               return players[i];
            }
         }
         return null;
      }
      , getPlayerPositionByGuid: function(guid) {
         var players = this.get('players');
         for (var i = 0; i < players.length; ++i) {
            if (players[i].guid === guid) {
               return {position: i, max: players.length - 1};
            }
         }
         return null;
      }
      , getPlayerTimeLeft: function(player, now) {
         if (_.isUndefined(now)) {
            now = new Date;
         }
         var gameTimeLeft = this.get('time_per_game') - player.game_time_used;
         var turnTimeLeft = this.get('time_per_turn') - player.turn_time_used;
         if (player.date_turn_started !== null) {
            // Used to Math.floor here.
            var timeDiff = (now - serverToLocal(player.date_turn_started)) / 1000;
            if (this.get('state') == 'active') {
               turnTimeLeft -= timeDiff;
            }
            turnTimeLeft = Math.min(this.get('time_per_turn'), turnTimeLeft);
            if (turnTimeLeft < 0) {
               gameTimeLeft += turnTimeLeft;
               turnTimeLeft = 0;
            }
         };
         return {gameTimeLeft: gameTimeLeft, turnTimeLeft: turnTimeLeft};
      }
      /**
       * Start the clock, optionally specifying a player to start.
       */
      , startClock: function(key) {
         var game = this;
         var players = this.get('players');
         var time_per_turn = this.get('time_per_turn');
         
         if (players.length == 0) {
            return this;
         }

         if (typeof key == 'undefined') {
            key = this.getActivePlayerKey();
         }

         if (key === null) {
            key = 0;
         } else if (key >= players.length) {
            key %= players.length;
         }

         _.each(players, function(player, tempKey) {
            if (key == tempKey) {
               if (player.state == 'waiting') {
                  player.state = 'playing';
                  player.date_turn_started = localToServer(new Date());
               } else if (player.state == 'playing') {
                  // Correct player is already set, we're probably recovering from pause.
                  player.date_turn_started = localToServer(new Date());
               }
            } else if (player.state == 'playing') {
               player.state = 'waiting';
               if (player.date_turn_started !== null) {
                  // This should roughtly match code in
                  // the put handler server side.
                  // Used to Math.floor here.
                  var timeDiff = (new Date() - 
                   serverToLocal(player.date_turn_started)) / 1000;

                  if (player.game_time_used === null) {
                     player.game_time_used = 0;
                  }
                  if (player.turn_time_used === null) {
                     player.turn_time_used = 0;
                  }
                  player.turn_time_used += timeDiff;
                  if (player.turn_time_used > time_per_turn) {
                     player.game_time_used += player.turn_time_used - time_per_turn;
                     player.turn_time_used = time_per_turn;
                  }
                  player.turn_time_used = 0;
                  player.date_turn_started = null;
               }
            }
         });

         this.set({
            state: 'active'
            , players: players
         });
         return this;
      }
      , pauseClock: function() {
         var game = this;
         var players = this.get('players');
         var time_per_turn = this.get('time_per_turn');
         
         if (players.length == 0) {
            return this;
         }

         var key = this.getActivePlayerKey() || 0;
         
         _.each(players, function(player, tempKey) {
            if (player.state == 'playing') {
               // Used to Math.floor here.
               var timeDiff = (new Date() - 
                serverToLocal(player.date_turn_started)) / 1000;

               if (player.game_time_used === null) {
                  player.game_time_used = 0;
               }
               if (player.turn_time_used === null) {
                  player.turn_time_used = 0;
               }
               player.turn_time_used += timeDiff;
               if (player.turn_time_used > time_per_turn) {
                  player.game_time_used += player.turn_time_used - time_per_turn;
                  player.turn_time_used = time_per_turn;
               }
               player.date_turn_started = null;
            }
         });
         
         this.set({
            state: 'paused'
            , players: players
         });
         return this;
      }
      , resetClock: function() {
         var players = this.get('players');
         _.each(players, function(player) {
            player.game_time_used = 0;
            player.turn_time_used = 0;
            player.date_turn_started = null;
            player.state = 'waiting';
         });
         this.set({
            state: 'paused'
            , players: players
         });
      }
      , startNextPlayer: function() {
         var key = this.getActivePlayerKey();
         if (key === null) {
            key = 0;
         } else {
            key = (key + 1) % this.get('players').length;
         }
         return this.startClock(key);
      }
      , startPrevPlayer: function() {
         var key = this.getActivePlayerKey();
         var numPlayers = this.get('players').length;
         if (key === null) {
            key = numPlayers - 1;
         } else {
            key = (numPlayers + key - 1) % numPlayers;
         }
         return this.startClock(key);
      }, addNewPlayer: function() {
         var players = this.get('players');
         var usedColors = [];
         for (i = 0; i < players.length; ++i) {
            usedColors.push(players[i].color);
         }
         var data = {
            name: "Player " + (players.length + 1),
            game_time_used: 0,
            turn_time_used: 0,
            state: 'waiting',
            color: Custom.getNextUnusedColor(usedColors),
            guid: Custom.makeid(40),
            date_turn_started: null
         };
         players.push(data);
         this.set('players', players);
         return data;
      }
   });
});
