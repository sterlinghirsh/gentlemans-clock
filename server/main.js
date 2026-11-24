// Gentleman's Clock realtime server: socket.io on /ws (create, read, update, time), GET /health.
// Env: HOST, PORT, DATA_DIR (games.json snapshot), ALLOWED_ORIGINS (comma list; empty allows any),
// BUILD_ID, STATIC_ROOT (local dev only: serve the built client from this folder).
var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var socketio = require('socket.io');
var validate = require('./validate');
var GameStore = require('./store').GameStore;

process.on('uncaughtException', function(err) { console.error('uncaughtException:', err); });
process.on('unhandledRejection', function(err) { console.error('unhandledRejection:', err); });

var HOST = process.env.HOST || '127.0.0.1';
var PORT = Number(process.env.PORT) || 3000;
var BUILD_ID = process.env.BUILD_ID || 'dev';
var WS_PATH = '/ws';
var ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
var STATIC_ROOT = process.env.STATIC_ROOT || '';

// No Origin (curl, bots) passes; with a list, a browser Origin must be on it.
function originOk(origin) {
   if (!origin || ALLOWED.length === 0) { return true; }
   return ALLOWED.indexOf(origin) >= 0;
}

var store = new GameStore({ dataDir: process.env.DATA_DIR || null });
console.log('loaded', store.load(), 'games');
setInterval(function() { store.expire(); }, 10 * 60 * 1000).unref();
function shutdown() { store.saveNow(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
   '.svg': 'image/svg+xml', '.woff': 'font/woff', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
   '.otf': 'font/otf', '.txt': 'text/plain', '.woff2': 'font/woff2', '.json': 'application/json' };

function serveStatic(req, res, pathname) {
   var root = path.resolve(STATIC_ROOT);
   var file = path.resolve(root, '.' + decodeURIComponent(pathname));
   if (file !== root && file.indexOf(root + path.sep) !== 0) { res.writeHead(404); return res.end(); }
   if (pathname.endsWith('/')) { file = path.join(file, 'index.html'); }
   fs.readFile(file, function(err, body) {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
   });
}

var server = http.createServer(function(req, res) {
   var url = new URL(req.url, 'http://x');
   if (url.pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
      var headers = { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' };
      var origin = req.headers.origin;
      if (origin && originOk(origin)) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }
      res.writeHead(200, headers);
      return res.end(req.method === 'HEAD' ? undefined : 'ok ' + BUILD_ID + '\n');
   }
   if (url.pathname === WS_PATH || url.pathname.indexOf(WS_PATH + '/') === 0) { return; } // socket.io's
   if (STATIC_ROOT && req.method === 'GET') { return serveStatic(req, res, url.pathname); }
   res.writeHead(404, { 'Content-Type': 'text/plain' });
   res.end('not found\n');
});

var io = new socketio.Server(server, {
   path: WS_PATH,
   addTrailingSlash: false,
   serveClient: false,
   maxHttpBufferSize: 64 * 1024,
   cors: { origin: function(origin, cb) { cb(null, originOk(origin)); } },
   allowRequest: function(req, cb) { cb(null, originOk(req.headers.origin)); }
});

// The deploy's socket check opens /ws?probe=1 as a plain WebSocket: 403 for a foreign Origin, otherwise accept and
// close at once. Every other upgrade goes to socket.io.
var ioUpgrade = server.listeners('upgrade').slice();
server.removeAllListeners('upgrade');
server.on('upgrade', function(req, socket, head) {
   var url = new URL(req.url, 'http://x');
   if (url.pathname === WS_PATH && url.searchParams.get('probe') === '1') {
      if (!originOk(req.headers.origin)) {
         socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
         return;
      }
      var key = req.headers['sec-websocket-key'] || '';
      var accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
         'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
      socket.end(Buffer.from([0x88, 0x02, 0x03, 0xe8])); // close, 1000
      return;
   }
   ioUpgrade.forEach(function(fn) { fn.call(server, req, socket, head); });
});

function applyTurnLogic(game, gameData) {
   // Kept from the 2013 server: the server stamps turn starts and resets turn time at a turn's end.
   gameData.players = gameData.players.map(function(player, playerKey) {
      var dbPlayer = game.players[playerKey];
      if (typeof dbPlayer == 'undefined') {
         player.state = 'waiting';
         player.date_turn_started = null;
         player.game_time_used = 0;
         player.turn_time_used = 0;
      } else if (player.game_time_used == 0 && player.turn_time_used == 0 &&
       player.date_turn_started === null && player.state == 'waiting' && gameData.state == 'paused') {
         // Resetting the player: nothing fancy.
      } else if (player.date_turn_started !== null && player.state == 'playing' &&
       dbPlayer.date_turn_started === null && dbPlayer.state == 'waiting') {
         player.date_turn_started = new Date();
      } else if (dbPlayer.date_turn_started !== null && dbPlayer.state == 'playing' && player.state == 'waiting') {
         player.turn_time_used = 0;
         player.date_turn_started = null;
      }
      return player;
   });
   if (gameData.players.length === 0) { gameData.state = 'paused'; }
   return gameData;
}

io.on('connection', function(socket) {
   // The client's clock skew: it sends nothing and gets the server's Date.now().
   socket.on('time', function(req, respond) {
      if (typeof req === 'function') { respond = req; }
      if (typeof respond === 'function') { respond(null, Date.now()); }
   });

   socket.on('create', validate.safeHandler('create', function(req, respond) {
      var parsed = validate.gameData(req.model);
      if (parsed.error) { return respond({error: parsed.error}); }
      var game = store.create(parsed.data);
      if (game === null) { return respond({error: 'Server is full, try again later.'}); }
      socket.join(game.join_code);
      respond(null, game);
   }));

   socket.on('read', validate.safeHandler('read', function(req, respond) {
      var code = validate.joinCode(req.model.join_code);
      if (code === null) { return respond({error: 'Invalid join code.'}); }
      var game = store.get(code);
      if (game === null) { return respond({error: 'Game not found.'}, null); }
      socket.join(code);
      respond(null, game);
   }));

   socket.on('update', validate.safeHandler('update', function(req, respond) {
      var code = validate.joinCode(req.model.join_code);
      if (code === null) { return respond({error: 'Invalid join code.'}); }
      var parsed = validate.gameData(req.model);
      if (parsed.error) { return respond({error: parsed.error}); }
      var game = store.get(code);
      // An update never creates a game (the client creates first).
      if (game === null) { return respond({error: 'Game not found.'}, null); }
      socket.join(code);
      game = store.update(code, applyTurnLogic(game, parsed.data));
      respond(null, game);
      socket.broadcast.to(code).emit('update', game);
   }));
});

server.listen(PORT, HOST, function() {
   console.log('gentlemans-clock', BUILD_ID, 'listening on', HOST + ':' + PORT,
      ALLOWED.length ? 'origins ' + ALLOWED.join(' ') : 'any origin');
});
