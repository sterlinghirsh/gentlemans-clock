define(['jquery', 'underscore', 'backbone'],
function($, _, Backbone) {
   return Backbone.Model.extend({
      urlRoot: '/api/games'
      , idAttribute: '_id'
      , initialize: function() {
         console.log("toot");
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
      /**
       * Start the clock, optionally specifying a player to start.
       */
      , startClock: function(key) {
         var game = this;
         var players = this.get('players');
         
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
                  player.date_turn_started = new Date();
                  // TODO: Might have to add an offset here.
               }
            } else if (player.state == 'playing') {
               player.state = 'waiting';
               if (player.date_turn_started !== null) {
                  // TODO: might have to add an offset here.
                  // This should roughtly match code in
                  // the put handler server side.
                  var timeDiff = Math.floor((new Date() - 
                   new Date(player.date_turn_started)) / 1000);

                  if (player.game_time_used === null) {
                     player.game_time_used = 0;
                  }
                  if (player.turn_time_used === null) {
                     player.turn_time_used = 0;
                  }
                  player.turn_time_used += timeDiff;
                  if (player.turn_time_used > game.time_per_turn) {
                     player.game_time_used += player.turn_time_used - game.time_per_turn;
                     player.turn_time_used = player.time_per_turn;
                  }
                  player.turn_time_used = 0;
                  player.date_turn_started = null;
               }
            }
         });

         this.set({
            'state': 'active',
            'players': players
         });
         return this;
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
   });
});
