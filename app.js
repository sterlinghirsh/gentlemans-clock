var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');
var cons = require('consolidate');

var mongolaburi = process.env.MONGOLAB_URI || 'mongodb://localhost/gameclock';
mongoose.connect(mongolaburi);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var maxPlayerLength = 12;

// This will be keyed on game id.
var pendingResponses = {};

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

var validColors = ['red', 'green', 'blue', 'black', 'white', 'yellow', 'pink', 'tan', 'gray'];

db.once('open', function callback() {
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
   app.use(express.compress());
   app.use(express.methodOverride());
   app.use(express.bodyParser());
   app.use(express.logger());

   io.sockets.on('connection', function(socket) {
      var createGame = function(req, respond) {
         var newGame = new Game(req.model);
         newGame.date_created = newGame.date_updated = Date.now();
         newGame.join_code = makeid(5);
         // TODO: Check to make sure we don't have any games with that join_code.
         newGame.save(function (err) {
            //if (err) throw err;
            socket.join(newGame.join_code);
            respond(err, newGame);
         });
      };

      socket.on('create', createGame);

      socket.on('read', function(req, respond) {
         var join_code = req.model.join_code.toLowerCase();
         if (join_code.length != 5) {
            respond({error: "Invalid join code."});
            return;
         }

         Game.findOne({join_code: join_code}, function(err, game) {
            if (game === null) {
               //res.status(404).send();
               respond({error: "Game not found."}, null);
               return;
            }
            if (err) {
               respond({error: "Server error."}, null);
               throw err;
            }
            socket.join(join_code);
            respond(null, game);
         });
      });

      socket.on('update', function(req, respond) {
         var join_code = req.model.join_code.toLowerCase();
         Game.findOne({join_code: join_code}, function(err, game) {
            var resettingGame = false;
            var gameData = req.model;
            socket.join(join_code);
            // TODO: Combine this with the newgame function.
            if (game === null) {
               return createGame(req, respond);
            }

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
            game.save(function (err) {
               respond(err, game);
               socket.broadcast.to(join_code).emit('update', game);
            });
         });
      });
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
      res.sendfile(__dirname + '/static/js/main-built.js');
   });
   app.get('/css', function (req, res) {
      res.sendfile(__dirname + '/static/css/all.css');
   });

   // Restful API
   // TODO: Remove this or figure out a better way.
   // We mostly want to use the socket.io api.
   /*
   app.get('/api/games', function(req, res) {
      Game.find(function(err, games) {
         if (err) throw err;
         res.json(games);
      });
   });
   
   app.get('/api/games/:join_code', function(req, res) {
      Game.findOne({join_code: req.params.join_code.toLowerCase()}, function(err, game) {
         if (game === null) {
            res.status(404).send();
            return;
         }
         if (err) throw err;
         res.json(game);
      });
   });

   app.get('/api/games/:join_code/long_polling/:date', function(req, res) {
      Game.findOne({join_code: req.params.join_code.toLowerCase()}, function(err, game) {
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
      newGame.join_code = makeid(5);
      // TODO: Check to make sure we don't have any games with that join_code.
      newGame.save(function (err) {
         if (err) throw err;
         res.json(newGame);
      });
   });
   
   app.put('/api/games/:join_code', function(req, res) {
      Game.findOne({join_code: req.params.join_code.toLowerCase()}, function(err, game) {
         var resettingGame = false;
         var gameData = req.body;

         gameData.date_updated = Date.now();
         gameData.date_created = game.date_created;

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
               var timeDiff = (new Date() -
                dbPlayer.date_turn_started) / 1000;
               player.turn_time_used = dbPlayer.turn_time_used || 0;
               player.game_time_used = dbPlayer.game_time_used || 0;
               player.turn_time_used += timeDiff;
               if (player.turn_time_used > gameData.time_per_turn) {
                  player.game_time_used += player.turn_time_used - gameData.time_per_turn;
                  player.turn_time_used = gameData.time_per_turn;
               }

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
   */

   app.get('/viewStats', function(req, res) {
      Game.find({join_code: {'$ne': null}}, 'join_code date_created date_updated', 
       { sort: { date_created: -1 }}, function(err, results) {
         if (err) {
            throw err;
         }

         var cleanResults = _.map(results, function(result) {
            return {
               join_code: result.join_code
               , age: displayTime(((new Date) - result.date_created) / 1000)
               , use_length: displayTime((result.date_updated - result.date_created) / 1000)
            };
         });

         res.json({
            count: cleanResults.length
            , games: cleanResults
         });
      });
   });

   // Danger!
   /*
   app.delete('/api/games', function(req, res) {
      Game.find().remove();
      res.send();
   });
   */

   app.use("/static", express.static(__dirname + "/static"));
   app.use("/font", express.static(__dirname + "/static/font"));

   var port = process.env.PORT || 3000;
   server.listen(port);
   
   io.configure(function() {
//      io.set('transports', ['xhr-polling']);
      io.set('polling duration', 10);
   });

});

