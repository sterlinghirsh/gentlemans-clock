var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');
var cons = require('consolidate');
var validate = require('./validate');

// Last resort: log and keep serving rather than exit on a stray error.
process.on('uncaughtException', function(err) { console.error('uncaughtException:', err); });
process.on('unhandledRejection', function(err) { console.error('unhandledRejection:', err); });

var port = process.env.PORT || 3000;
var mongolaburi = process.env.MONGOLAB_URI || 'mongodb://localhost/gameclock';
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var maxPlayerLength = validate.maxPlayerLength;


function displayTime(timeInSeconds) {
   timeInSeconds = Math.max(0, timeInSeconds);
   var hours = Math.floor(timeInSeconds / 3600);
   timeInSeconds -= hours * 3600;
   var mins = Math.floor(timeInSeconds / 60);

   if (mins < 10 && hours > 0) {
      mins = "0" + mins;
   }
   var secs = Math.floor(timeInSeconds % 60);

   if (secs < 10) {
      secs = "0" + secs;
   }

   var timeString = mins + ":" + secs;

   if (hours > 0) {
      timeString = hours + ":" + timeString;
   }

   return timeString;
}

function makeid(size) {
   var text = "";
   var possible = "abcdefghijklmnopqrstuvwxyz";
   for (var i=0; i < size; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
   }

   return text;
}

var validColors = validate.validColors;

mongoose.connect(mongolaburi).then(function() {
   server.listen(port);
   console.log('listening on', port);
}, function(err) {
   console.error('connection error:', err.message);
   process.exit(1);
});

(function start() {
   var gameSchema = mongoose.Schema({
      join_code: { type: String, trim: true, required: true, unique: true }
      , time_per_game: { type: Number, min: 0, default: 300 }
      , time_per_turn: { type: Number, min: -1, default: 2 }
      , date_created: { type: Date, default: Date.now }
      , date_updated: { type: Date, default: Date.now }
      , state: { type: String, enum: ['paused', 'active', 'finished', 'canceled'], default: 'paused' }
      , count_up: { type: Boolean, default: false }
      , public: { type: Boolean, default: false }
      , players: [{
         name: { type: String, trim: true, required: true }
         , guid: {type: String, required: true, unique: true}
         , game_time_used: { type: Number, default: 0 }
         , turn_time_used: { type: Number, default: 0 }
         , date_turn_started: { type: Date, default: null }
         , state: { type: String, enum: ['waiting', 'playing', 'won', 'lost', 'drew'], default: 'waiting' }
         , color: { type: String, enum: validColors, default: 'red' }
      }]
   });

   var Game = mongoose.model('Game', gameSchema);

   io.sockets.on('connection', function(socket) {
      var createGame = function(req, respond) {
         var parsed = validate.gameData(req.model);
         if (parsed.error) { return respond({error: parsed.error}); }
         var newGame = new Game(parsed.data);
         newGame.date_created = newGame.date_updated = Date.now();
         newGame.join_code = makeid(5);
         // TODO: Check to make sure we don't have any games with that join_code.
         newGame.save().then(function () {
            socket.join(newGame.join_code);
            respond(null, newGame);
         }, function (err) {
            respond(err.message);
         });
      };

      socket.on('create', validate.safeHandler('create', createGame));

      socket.on('read', validate.safeHandler('read', function(req, respond) {
         var join_code = validate.joinCode(req.model.join_code);
         if (join_code === null) {
            respond({error: "Invalid join code."});
            return;
         }

         Game.findOne({join_code: join_code}).then(function(game) {
            if (game === null) {
               respond({error: "Game not found."}, null);
               return;
            }
            socket.join(join_code);
            respond(null, game);
         }, function(err) {
            console.error(err);
            respond({error: "Server error."}, null);
         });
      }));

      socket.on('update', validate.safeHandler('update', function(req, respond) {
         var join_code = validate.joinCode(req.model.join_code);
         if (join_code === null) {
            respond({error: "Invalid join code."});
            return;
         }
         var parsed = validate.gameData(req.model);
         if (parsed.error) { return respond({error: parsed.error}); }
         Game.findOne({join_code: join_code}).then(function(game) {
            var resettingGame = false;
            var gameData = parsed.data;
            // An update never creates a game (the client creates first).
            if (game === null) {
               return respond({error: "Game not found."}, null);
            }
            socket.join(join_code);

            // TODO: Clean up this goofy logic.
            gameData.players = _.map(gameData.players, function(player, playerKey) {
               var dbPlayer = game.players[playerKey];
               if (typeof dbPlayer == 'undefined') {
                  player.state = 'waiting';
                  player.date_turn_started = null;
                  player.game_time_used = 0;
                  player.turn_time_used = 0;
               } else if (player.game_time_used == 0 &&
                player.turn_time_used == 0 &&
                player.date_turn_started === null &&
                player.state == 'waiting' &&
                gameData.state == 'paused') {
                  // We're resetting the player, so don't do anything fancy.
                  resettingGame = true;
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
                  /*
                  var timeDiff = (new Date() -
                   dbPlayer.date_turn_started) / 1000;
                  player.turn_time_used = dbPlayer.turn_time_used || 0;
                  player.game_time_used = dbPlayer.game_time_used || 0;
                  player.turn_time_used += timeDiff;
                  if (player.turn_time_used > gameData.time_per_turn) {
                     player.game_time_used += player.turn_time_used - gameData.time_per_turn;
                     player.turn_time_used = gameData.time_per_turn;
                  }
                  */
                  player.turn_time_used = 0;
                  player.date_turn_started = null;
               }
               if (player.name.length > maxPlayerLength) {
                  player.name = player.name.substring(0, maxPlayerLength);
               }
               return player;
            });

            if (gameData.players.length === 0) {
               gameData.state = 'paused';
            }

            gameData.date_updated = Date.now();

            game.set(gameData);
            game.save().then(function () {
               respond(null, game);
               socket.broadcast.to(join_code).emit('update', game);
            }, function (err) {
               respond(err.message);
            });
         }, function(err) {
            console.error(err);
            respond({error: "Server error."}, null);
         });
      }));
   });

   // Setup HTML serving.
   app.set('view engine', 'html');
   app.set('views', __dirname + '/views');

   app.engine('html', cons.underscore);

   app.get('/', function (req, res) {
      res.render('index.html');
   });

   // Assets
   app.get('/js', function (req, res) {
      res.sendFile(__dirname + '/static/js/main-built.js');
   });
   app.get('/css', function (req, res) {
      res.sendFile(__dirname + '/static/css/all.css');
   });

   app.get('/viewStats', function(req, res) {
      Game.find({join_code: {'$ne': null}}, 'join_code date_created date_updated',
       { sort: { date_created: -1 }}).then(function(results) {
         var cleanResults = _.map(results, function(result) {
            return {
               join_code: result.join_code
               , age: displayTime(((new Date) - result.date_created) / 1000)
               , use_length: displayTime((result.date_updated - result.date_created) / 1000)
            };
         });
         res.json({ count: cleanResults.length, games: cleanResults });
      }, function(err) {
         console.error(err);
         res.status(500).json({error: 'Server error.'});
      });
   });

   app.use("/static", express.static(__dirname + "/static"));
   app.use("/font", express.static(__dirname + "/static/font"));

})();

