var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');

mongoose.connect('mongodb://localhost/gameclock');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
var app = express();

db.once('open', function callback() {
   var gameSchema = mongoose.Schema({
      name: { type: String, trim: true, required: true }
      , password: { type: String, trim: true }
      , current_turn: { type: Number, min: 1, default: 1 }
      , time_per_game: { type: Number, min: 0, default: 300 }
      , time_per_turn: { type: Number, min: -1, default: 2 }
      , date_created: { type: Date, default: Date.now }
      , state: { type: String, enum: ['paused', 'active', 'finished', 'canceled'], default: 'paused' }
      , players: [{
         name: { type: String, trim: true, required: true }
         , game_time_used: { type: Number, default: 0 }
         , turn_time_used: { type: Number, default: 0 }
         , date_turn_started: { type: Date, default: null }
         , state: { type: String, enum: ['waiting', 'playing', 'won', 'lost', 'drew'], default: 'waiting' }
      }]
   });

   var Game = mongoose.model('Game', gameSchema);
   app.use(express.compress());
   app.use(express.methodOverride());
   app.use(express.bodyParser());

   app.get('/', function (req, res) {
      res.sendfile(__dirname + '/static/index.html');
   });

   app.get('/api/games', function(req, res) {
      Game.find(function(err, games) {
         if (err) throw err;
         res.json(games);
      });
   });
   
   app.get('/api/games/:id', function(req, res) {
      Game.findById(req.params.id, function(err, game) {
         if (err) throw err;
         res.json(game);
      });
   });

   app.post('/api/games', function(req, res) {
      var newGame = new Game(req.body);
      newGame.save(function (err) {
         if (err) throw err;

         res.json(newGame);
      });
   });
   
   app.put('/api/games/:id', function(req, res) {
      Game.findById(req.params.id, function (err, game) {
         var gameData = req.body;

         gameData.current_turn = game.current_turn;

         gameData.players = _.map(gameData.players, function(player, playerKey) {
            var dbPlayer = game.players[playerKey];
            if (typeof dbPlayer == 'undefined') {
               player.state = 'waiting';
               player.date_turn_started = null;
               player.game_time_used = 0;
               player.turn_time_used = 0;
            } else if (player.date_turn_started !== null &&
             player.state == 'playing' && 
             dbPlayer.date_turn_started === null &&
             dbPlayer.state == 'waiting') {
               player.date_turn_started = new Date();
            } else if (dbPlayer.date_turn_started !== null &&
             dbPlayer.state == 'playing' &&
             player.state == 'waiting') {
               // Player just finished a turn.
               // Reuse this logic for pausing the timer.
               var timeDiff = Math.floor((new Date() -
                dbPlayer.date_turn_started) / 1000);
               player.turn_time_used = dbPlayer.turn_time_used || 0;
               player.game_time_used = dbPlayer.game_time_used || 0;
               player.turn_time_used += timeDiff;
               if (player.turn_time_used > game.time_per_turn) {
                  player.game_time_used += player.turn_time_used - game.time_per_turn;
                  player.turn_time_used = game.time_per_turn;
               }

               // Don't do this on pause.
               if (playerKey === gameData.players.length - 1) {
                  ++gameData.current_turn;
               }
               player.turn_time_used = 0;
               player.date_turn_started = null;
            }
            return player;
         });
         game.set(gameData);
         game.save(function (err) {
            if (err) throw err;

            res.json(game);
         });
      })
   });

   // Danger!
   app.delete('/api/games', function(req, res) {
      Game.find().remove();
      res.send();
   });

   app.use("/static", express.static(__dirname + "/static"));

   app.listen(3000);
});

