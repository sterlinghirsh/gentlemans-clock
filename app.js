var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');
var cons = require('consolidate');

var mongolaburi = process.env.MONGOLAB_URI || 'mongodb://localhost/gameclock';
mongoose.connect(mongolaburi);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
var app = express();

// This will be keyed on game id.
var pendingResponses = {};

db.once('open', function callback() {
   var gameSchema = mongoose.Schema({
      name: { type: String, trim: true, required: true }
      , password: { type: String, trim: true }
      , current_turn: { type: Number, min: 1, default: 1 }
      , time_per_game: { type: Number, min: 0, default: 300 }
      , time_per_turn: { type: Number, min: -1, default: 2 }
      , date_created: { type: Date, default: Date.now }
      , date_updated: { type: Date, default: Date.now }
      , state: { type: String, enum: ['paused', 'active', 'finished', 'canceled'], default: 'paused' }
      , count_up: { type: Boolean, default: false }
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
   app.use(express.logger());

   app.set('view engine', 'html');
   app.set('views', __dirname + '/views');

   app.engine('html', cons.underscore);

   app.get('/', function (req, res) {
      res.render('index.html');
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

   app.get('/api/games/:id/long_polling/:date', function(req, res) {
      Game.findById(req.params.id, function (err, game) {
         if (err) throw err;
         if (game.date_updated > new Date(req.params.date)) {
            // No long poll, return immediately.
            res.json(game);
         } else {
            // Save request for long polling.
            if (_.isUndefined(pendingResponses[game.id])) {
               pendingResponses[game.id] = [
                  {date: new Date, res: res}
               ];
            } else {
               pendingResponses[game.id].push({date: new Date, res: res});
            }
         }
      });
   });

   app.post('/api/games', function(req, res) {
      var newGame = new Game(req.body);
      newGame.date_created = newGame.date_updated = Date.now();
      newGame.save(function (err) {
         if (err) throw err;
         res.json(newGame);
      });
   });
   
   app.put('/api/games/:id', function(req, res) {
      Game.findById(req.params.id, function (err, game) {
         var gameData = req.body;

         gameData.current_turn = game.current_turn;
         gameData.date_updated = Date.now();
         gameData.date_created = game.date_created;

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
            // Push to all pending responses for that game.

            if (!_.isUndefined(pendingResponses[game.id])) {
               pendingResponses[game.id].forEach(function(responseInfo) {
                  responseInfo.res.json(game);
               });
               delete pendingResponses[game.id];
            }
         });
      })
   });

   // Periodically send updates to clients waiting for more than 15 sec.
   setInterval(function() {
      _.each(pendingResponses, function(responses, gameid) {
         if (responses.length > 0) {
            Game.findById(gameid, function(err, game) {
               if (err) throw err;
               responses.forEach(function(responseInfo, index) {
                  var timeDiff = Date.now() - responseInfo.date;
                  if (timeDiff >= 15000) {
                     responseInfo.res.json(game);
                     responses.splice(index, 1);
                  }
               });
            });
         }
      });
   }, 3000);

   // Danger!
   app.delete('/api/games', function(req, res) {
      Game.find().remove();
      res.send();
   });

   app.use("/static", express.static(__dirname + "/static"));

   var port = process.env.PORT || 3000;
   app.listen(port);
});

