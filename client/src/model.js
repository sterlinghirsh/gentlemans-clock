// Game logic, kept to the 2013 client's rules and data shape (the server and saved games depend on both).
// Pure functions: every one takes `now` (local ms) and `skew` (local minus server ms) instead of reading clocks.
// A game: {state, time_per_turn, time_per_game, count_up, public, join_code, players, date_created, date_updated}.
// A player: {name, guid, color, state 'waiting'|'playing', game_time_used, turn_time_used, date_turn_started}.
// Times are seconds; date_turn_started is a server-clock date (ISO string) or null.

export const COLORS = ['red', 'green', 'blue', 'black', 'white', 'yellow', 'pink', 'tan', 'gray'];
export const MAX_PLAYERS = 12;
export const MAX_NAME = 12;

const serverToLocal = (d, skew) => new Date(d).getTime() + skew;
const localToServer = (ms, skew) => new Date(ms - skew).toISOString();

export function clone(game) { return JSON.parse(JSON.stringify(game)); }

export function makeId(size, alpha) {
  const chars = alpha ? 'abcdefghijklmnopqrstuvwxyz'
    : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  let s = '';
  for (let i = 0; i < size; ++i) { s += chars[Math.floor(Math.random() * chars.length)]; }
  return s;
}

export function nextColor(used) {
  const free = COLORS.filter((c) => !used.includes(c));
  return free.length ? free[0] : COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function newGame({ countUp = false, perTurn = 5, perGame = 900 } = {}, now = Date.now()) {
  const game = {
    state: 'paused', time_per_turn: perTurn, time_per_game: perGame, count_up: countUp, public: false,
    players: [], join_code: null, date_created: new Date(now).toISOString(), date_updated: new Date(now).toISOString(),
  };
  addPlayer(game); addPlayer(game);
  return game;
}

export function addPlayer(game) {
  if (game.players.length >= MAX_PLAYERS) { return null; }
  const p = {
    name: 'Player ' + (game.players.length + 1), game_time_used: 0, turn_time_used: 0, state: 'waiting',
    color: nextColor(game.players.map((x) => x.color)), guid: makeId(40), date_turn_started: null,
  };
  game.players.push(p);
  return p;
}

export function activeIndex(game) {
  let k = null;
  game.players.forEach((p, i) => { if (p.state === 'playing') { k = i; } });
  return k;
}

export function activePlayer(game) {
  const k = activeIndex(game);
  return k === null ? null : game.players[k];
}

// {gameTimeLeft, turnTimeLeft} in seconds: time left counting down, time used counting up.
export function timeLeft(game, player, now, skew = 0) {
  let g, t;
  if (game.count_up) { g = player.game_time_used; t = player.turn_time_used; }
  else { g = game.time_per_game - player.game_time_used; t = game.time_per_turn - player.turn_time_used; }
  if (player.date_turn_started !== null && player.date_turn_started !== undefined) {
    const diff = (now - serverToLocal(player.date_turn_started, skew)) / 1000;
    if (game.state === 'active') { t += game.count_up ? diff : -diff; }
    if (game.count_up) { g += t; }
    else {
      t = Math.min(game.time_per_turn, t);
      if (t < 0) { g += t; t = 0; }
    }
  }
  return { gameTimeLeft: g, turnTimeLeft: t };
}

// Fold the running turn of player p into its used times (the 2013 startClock/pauseClock arithmetic).
function settle(game, p, now, skew, endTurn) {
  if (p.date_turn_started === null) { return; }
  const diff = (now - serverToLocal(p.date_turn_started, skew)) / 1000;
  p.game_time_used = p.game_time_used || 0;
  p.turn_time_used = (p.turn_time_used || 0) + diff;
  if (game.count_up) {
    if (endTurn) { p.game_time_used += p.turn_time_used; }
  } else if (p.turn_time_used > game.time_per_turn) {
    p.game_time_used += p.turn_time_used - game.time_per_turn;
    p.turn_time_used = game.time_per_turn;
  }
  if (endTurn) { p.turn_time_used = 0; }
  p.date_turn_started = null;
}

// Start (or resume) the clock with player `key` (default: whoever is playing, else the first).
export function startClock(game, key, now, skew = 0) {
  const n = game.players.length;
  if (n === 0) { return game; }
  if (key === undefined || key === null) { key = activeIndex(game); }
  if (key === null) { key = 0; } else { key %= n; }
  game.players.forEach((p, i) => {
    if (i === key) {
      if (p.state === 'waiting') { p.state = 'playing'; }
      p.date_turn_started = localToServer(now, skew);
    } else if (p.state === 'playing') {
      p.state = 'waiting';
      settle(game, p, now, skew, true);
    }
  });
  game.state = 'active';
  return game;
}

export function pauseClock(game, now, skew = 0) {
  if (game.players.length === 0) { return game; }
  for (const p of game.players) {
    if (p.state === 'playing') { settle(game, p, now, skew, false); }
  }
  game.state = 'paused';
  return game;
}

export function resetClock(game) {
  for (const p of game.players) {
    p.game_time_used = 0; p.turn_time_used = 0; p.date_turn_started = null; p.state = 'waiting';
  }
  game.state = 'paused';
  return game;
}

export function nextPlayer(game, now, skew = 0) {
  const k = activeIndex(game);
  return startClock(game, k === null ? 0 : (k + 1) % game.players.length, now, skew);
}

export function prevPlayer(game, now, skew = 0) {
  const n = game.players.length;
  const k = activeIndex(game);
  return startClock(game, k === null ? n - 1 : (n + k - 1) % n, now, skew);
}

export function movePlayer(game, guid, delta) {
  const i = game.players.findIndex((p) => p.guid === guid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= game.players.length) { return false; }
  [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
  return true;
}

export function removePlayer(game, guid) {
  const i = game.players.findIndex((p) => p.guid === guid);
  if (i < 0) { return false; }
  game.players.splice(i, 1);
  if (game.players.length === 0) { game.state = 'paused'; }
  return true;
}

// Set a player's game time shown (left, or used when counting up), as the 2013 edit form did.
export function setPlayerTime(game, guid, seconds, now, skew = 0) {
  const p = game.players.find((x) => x.guid === guid);
  if (!p) { return; }
  if (game.count_up) { p.game_time_used = seconds; }
  else {
    p.game_time_used = game.time_per_game - seconds;
    if (p.state === 'playing') { p.date_turn_started = localToServer(now, skew); }
  }
}

// --- display

// A running game-time countdown below this shows tenths (the turn time never does: it's a delay, not the clock
// that loses the game, and tenths there would wake the page 10x as often).
export const TENTHS_BELOW = 10;

// "m:ss", "h:mm:ss", or "s.t"-style "0:09.4" with tenths.
export function formatTime(seconds, tenths = false) {
  let s = Math.max(0, seconds);
  if (tenths) { s = Math.floor(s * 10 + 1e-6) / 10; } else { s = Math.floor(s + 1e-6); }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  const sec = s - h * 3600 - m * 60;
  const ss = tenths ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// What a player's clock shows now: strings, and which values are ticking.
export function display(game, player, now, skew = 0) {
  const { gameTimeLeft: g, turnTimeLeft: t } = timeLeft(game, player, now, skew);
  const running = game.state === 'active' && player.state === 'playing' && player.date_turn_started != null;
  const down = !game.count_up;
  // Counting down, the turn time runs first and the game time once it's spent.
  const gameRuns = running && (game.count_up || t <= 0);
  const gTenths = down && gameRuns && g < TENTHS_BELOW;
  return {
    game: formatTime(g, gTenths), turn: formatTime(t), gameSeconds: g, turnSeconds: t,
    running, out: down && g <= 0 && t <= 0,
  };
}

// Milliseconds until any visible digit of the game changes; Infinity when nothing runs.
// The render loop sleeps exactly this long: no animation frames, no 1 s polling.
export function msToNextChange(game, now, skew = 0) {
  if (game.state !== 'active') { return Infinity; }
  const p = activePlayer(game);
  if (!p || p.date_turn_started == null) { return Infinity; }
  const d = display(game, p, now, skew);
  if (d.out) { return Infinity; }
  const waits = [];
  const add = (v, up, tenths) => {
    const step = tenths ? 0.1 : 1;
    const x = v / step;
    let frac = up ? Math.ceil(x) - x : x - Math.floor(x);
    if (frac < 1e-6) { frac = 1; }
    waits.push(frac * step * 1000);
  };
  if (game.count_up) { add(d.turnSeconds, true, false); add(d.gameSeconds, true, false); }
  else if (d.turnSeconds > 0) {
    add(d.turnSeconds, false, false);
  } else {
    add(d.gameSeconds, false, d.gameSeconds < TENTHS_BELOW);
  }
  // A couple of ms past the boundary so floor() has crossed it.
  return Math.max(1, Math.ceil(Math.min(...waits)) + 2);
}

// --- saved games

// A saved local game (localStorage 'localGame', the 2013 format) checked and cleaned; null if unusable.
export function normalizeGame(raw) {
  let g = raw;
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch { return null; } }
  if (!g || typeof g !== 'object' || !Array.isArray(g.players)) { return null; }
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const players = [];
  for (const p of g.players.slice(0, MAX_PLAYERS)) {
    if (!p || typeof p !== 'object') { continue; }
    const dts = p.date_turn_started ? new Date(p.date_turn_started) : null;
    players.push({
      name: String(p.name || 'Player').slice(0, MAX_NAME) || 'Player',
      guid: typeof p.guid === 'string' && /^[A-Za-z0-9]{1,64}$/.test(p.guid) ? p.guid : makeId(40),
      color: COLORS.includes(p.color) ? p.color : 'red',
      state: p.state === 'playing' ? 'playing' : 'waiting',
      game_time_used: num(p.game_time_used, 0), turn_time_used: num(p.turn_time_used, 0),
      date_turn_started: dts && !isNaN(dts) ? dts.toISOString() : null,
    });
  }
  return {
    state: g.state === 'active' ? 'active' : 'paused',
    time_per_turn: num(g.time_per_turn, 5), time_per_game: num(g.time_per_game, 900),
    count_up: g.count_up === true, public: false, join_code: null, players,
    date_created: g.date_created || null, date_updated: g.date_updated || null,
  };
}

export function joinCode(v) {
  if (typeof v !== 'string') { return null; }
  v = v.trim().toLowerCase();
  return /^[a-z]{5}$/.test(v) ? v : null;
}
