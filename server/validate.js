// Input validation for socket messages. Pure functions, no I/O.
var validColors = ['red', 'green', 'blue', 'black', 'white', 'yellow', 'pink', 'tan', 'gray'];
var playerStates = ['waiting', 'playing', 'won', 'lost', 'drew'];
var gameStates = ['paused', 'active', 'finished', 'canceled'];
var maxPlayers = 12;
var maxPlayerLength = 12;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function num(v, min, max, dflt) {
   return (typeof v === 'number' && isFinite(v) && v >= min && v <= max) ? v : dflt;
}
function date(v) {
   if (v === null || v === undefined) { return null; }
   var d = new Date(v);
   return isNaN(d.getTime()) ? null : d;
}

// Returns a lower-cased 5-letter join code, or null.
function joinCode(v) {
   if (typeof v !== 'string') { return null; }
   v = v.trim().toLowerCase();
   return /^[a-z]{5}$/.test(v) ? v : null;
}

function player(p) {
   if (!isObj(p) || typeof p.name !== 'string' || typeof p.guid !== 'string') { return null; }
   var name = p.name.trim().substring(0, maxPlayerLength);
   var guid = p.guid.trim();
   if (name.length === 0 || !/^[A-Za-z0-9]{1,64}$/.test(guid)) { return null; }
   return {
      name: name
      , guid: guid
      , game_time_used: num(p.game_time_used, 0, 1e9, 0)
      , turn_time_used: num(p.turn_time_used, 0, 1e9, 0)
      , date_turn_started: date(p.date_turn_started)
      , state: playerStates.indexOf(p.state) >= 0 ? p.state : 'waiting'
      , color: validColors.indexOf(p.color) >= 0 ? p.color : 'red'
   };
}

// Whitelist the fields a client may set. Returns {data} or {error}.
function gameData(m) {
   if (!isObj(m)) { return { error: 'Invalid game.' }; }
   var players = [];
   if (m.players !== undefined) {
      if (!Array.isArray(m.players) || m.players.length > maxPlayers) { return { error: 'Invalid players.' }; }
      for (var i = 0; i < m.players.length; ++i) {
         var p = player(m.players[i]);
         if (p === null) { return { error: 'Invalid player.' }; }
         players.push(p);
      }
   }
   return { data: {
      time_per_game: num(m.time_per_game, 0, 1e7, 300)
      , time_per_turn: num(m.time_per_turn, -1, 1e7, 2)
      , state: gameStates.indexOf(m.state) >= 0 ? m.state : 'paused'
      , count_up: m.count_up === true
      , public: m.public === true
      , players: players
   }};
}

// Wrap a socket handler: the request and callback are checked, errors never escape.
function safeHandler(name, fn) {
   return function(req, respond) {
      if (typeof respond !== 'function') { respond = function() {}; }
      try {
         if (!isObj(req) || !isObj(req.model)) { return respond({error: 'Invalid request.'}); }
         fn.call(this, req, respond);
      } catch (ex) {
         console.error('Handler ' + name + ' failed:', ex);
         try { respond({error: 'Server error.'}); } catch (ignored) {}
      }
   };
}

module.exports = { joinCode: joinCode, gameData: gameData, safeHandler: safeHandler,
   validColors: validColors, maxPlayerLength: maxPlayerLength };
