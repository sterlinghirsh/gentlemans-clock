// Games in memory, snapshotted to <dataDir>/games.json so a restart keeps open games.
// A game idle (no create or update) for longer than idleMs is dropped.
var fs = require('fs');
var path = require('path');

var DAY = 24 * 60 * 60 * 1000;

function makeid(size) {
   var text = '';
   var possible = 'abcdefghijklmnopqrstuvwxyz';
   for (var i = 0; i < size; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
   }
   return text;
}

function reviveDate(v) {
   if (v === null || v === undefined) { return null; }
   var d = new Date(v);
   return isNaN(d.getTime()) ? null : d;
}

function revive(g) {
   g.date_created = reviveDate(g.date_created) || new Date();
   g.date_updated = reviveDate(g.date_updated) || new Date();
   g.players = (g.players || []).map(function(p) {
      p.date_turn_started = reviveDate(p.date_turn_started);
      return p;
   });
   return g;
}

// opts: { dataDir, idleMs, maxGames, now, saveDelayMs }
function GameStore(opts) {
   opts = opts || {};
   this.games = new Map();
   this.dataDir = opts.dataDir || null;
   this.file = this.dataDir ? path.join(this.dataDir, 'games.json') : null;
   this.idleMs = opts.idleMs || DAY;
   this.maxGames = opts.maxGames || 5000;
   this.now = opts.now || Date.now;
   this.saveDelayMs = opts.saveDelayMs === undefined ? 1000 : opts.saveDelayMs;
   this.saveTimer = null;
}

GameStore.prototype.load = function() {
   if (!this.file) { return 0; }
   var raw;
   try { raw = fs.readFileSync(this.file, 'utf8'); } catch (e) {
      if (e.code !== 'ENOENT') { console.error('store: cannot read', this.file, e.message); }
      return 0;
   }
   try {
      var list = JSON.parse(raw);
      for (var i = 0; i < list.length; ++i) {
         if (list[i] && typeof list[i].join_code === 'string') {
            this.games.set(list[i].join_code, revive(list[i]));
         }
      }
   } catch (e) {
      console.error('store: bad snapshot, starting empty:', e.message);
   }
   this.expire();
   return this.games.size;
};

// data: validated game fields. Returns the game, or null when the store is full.
GameStore.prototype.create = function(data) {
   this.expire();
   if (this.games.size >= this.maxGames) { return null; }
   var code;
   do { code = makeid(5); } while (this.games.has(code));
   var now = new Date(this.now());
   var game = Object.assign({}, data, { join_code: code, date_created: now, date_updated: now });
   this.games.set(code, game);
   this.changed();
   return game;
};

GameStore.prototype.get = function(code) {
   var g = this.games.get(code);
   if (!g) { return null; }
   if (this.now() - g.date_updated.getTime() > this.idleMs) {
      this.games.delete(code);
      this.changed();
      return null;
   }
   return g;
};

GameStore.prototype.update = function(code, fields) {
   var g = this.get(code);
   if (!g) { return null; }
   Object.assign(g, fields, { join_code: code, date_updated: new Date(this.now()) });
   this.changed();
   return g;
};

GameStore.prototype.expire = function() {
   var cutoff = this.now() - this.idleMs;
   var dropped = 0;
   for (var entry of this.games) {
      if (entry[1].date_updated.getTime() < cutoff) { this.games.delete(entry[0]); ++dropped; }
   }
   if (dropped) { this.changed(); }
   return dropped;
};

GameStore.prototype.changed = function() {
   if (!this.file || this.saveTimer) { return; }
   var that = this;
   this.saveTimer = setTimeout(function() { that.saveTimer = null; that.saveNow(); }, this.saveDelayMs);
   if (this.saveTimer.unref) { this.saveTimer.unref(); }
};

// Atomic write: a crash mid-save leaves the previous snapshot.
GameStore.prototype.saveNow = function() {
   if (!this.file) { return; }
   if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
   var tmp = this.file + '.tmp';
   try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(Array.from(this.games.values())));
      fs.renameSync(tmp, this.file);
   } catch (e) {
      console.error('store: snapshot failed:', e.message);
   }
};

module.exports = { GameStore: GameStore, DAY: DAY };
