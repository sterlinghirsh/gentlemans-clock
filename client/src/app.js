// Gentleman's Clock: the page. Views are plain sections switched by the URL hash (the 2013 links, #game/<code>,
// still work). The clock renders only when a visible digit changes (model.msToNextChange): no animation loop, no
// interval, and nothing at all while the page is hidden.
import * as M from './model.js';
import * as net from './net.js';
import { loadPrefs, savePrefs, wakeLock, unlockAudio, chime, buzz, canVibrate, canWakeLock } from './device.js';

const LOCAL_KEY = 'localGame';
const $ = (id) => document.getElementById(id);
const views = ['home', 'newGame', 'joinError', 'game'];

let game = null;          // the game on screen
let view = 'home';
let prefs = loadPrefs();
let tickTimer = 0;
let structureKey = '';
let lastActive = null;    // guid of the player whose turn it was at the last render
let editing = null;       // guid in the player sheet
let editStart = null;     // the time fields as first shown
let ignoreHash = false;

const skew = () => (game && game.public ? net.skew : 0);
const seatKey = () => (game && game.public ? game.join_code : 'local');
const mySeat = () => prefs.seats[seatKey()] || null;

const lock = wakeLock(() => view === 'game' && !!game && game.state === 'active' && prefs.wakeLock);

// ---------- views and routing

function show(name) {
  view = name;
  for (const v of views) { $(v).hidden = v !== name; }
  document.body.dataset.view = name;
  if (name !== 'game') { clearTimeout(tickTimer); }
  lock.sync();
}

function loadLocal() {
  try { return M.normalizeGame(localStorage.getItem(LOCAL_KEY)); } catch { return null; }
}

function saveLocal() {
  if (!game || game.public) { return; }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(game)); } catch { /* storage full or private mode */ }
}

async function route() {
  if (ignoreHash) { ignoreHash = false; return; }
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (h === 'new' || h === 'startGame') { closeSheets(); show('newGame'); return; }
  if (h === 'joinError') { show('joinError'); return; }
  const m = h.match(/^game\/(.+)$/);
  if (!m) {
    closeSheets();
    if (game && game.public) { net.disconnect(); }
    game = null;
    $('resume').hidden = !loadLocal();
    show('home');
    return;
  }
  if (m[1] === 'new') {
    if (!game || game.public) {
      net.disconnect();
      game = loadLocal();
      if (!game) { location.replace('#new'); return; }
    }
    enterGame();
    return;
  }
  const code = M.joinCode(m[1]);
  if (!code) { show('joinError'); return; }
  if (game && game.public && game.join_code === code) { enterGame(); return; }
  await joinPublic(code);
}

async function joinPublic(code) {
  connectNet();
  try {
    const g = await net.send('read', { join_code: code });
    game = g;
    lastActive = activeGuid();
    enterGame();
  } catch (e) {
    net.disconnect();
    game = null;
    $('joinErrorText').textContent = e.message === 'Game not found.'
      ? 'No game has that code. It may be mistyped, or the game ended after a day without moves.'
      : 'The game server didn’t answer. Check the connection and try again.';
    location.replace('#joinError');
  }
}

function connectNet() {
  net.connect({
    onUpdate: (g) => { if (game && game.public && g.join_code === game.join_code) { applyGame(g, 'remote'); } },
    onReconnect: () => { if (game && game.public) { resync(); } },
    onStatus: (s) => { $('netStatus').textContent = s === 'offline' ? 'Reconnecting…' : ''; },
  });
}

async function resync() {
  try { applyGame(await net.send('read', { join_code: game.join_code }), 'remote'); } catch { /* next reconnect */ }
}

function enterGame() {
  structureKey = '';
  lastActive = activeGuid();
  show('game');
  renderAll();
}

// ---------- applying changes

function activeGuid(g = game) {
  const p = g && M.activePlayer(g);
  return p ? p.guid : null;
}

// A new game state from the server or another phone.
function applyGame(g, source) {
  game = g;
  renderAll(source);
}

// This phone changed the game: show it at once, then save it (locally, or to the server, whose answer wins).
function commit() {
  game.date_updated = new Date().toISOString();
  renderAll('local');
  if (!game.public) { saveLocal(); return; }
  const sent = game;
  net.send('update', sent).then((g) => {
    if (game === sent || (game && game.join_code === g.join_code)) { applyGame(g, 'server'); }
  }, (e) => toast(e.message));
}

const now = () => Date.now();

// ---------- the turn cue

function turnChanged(source) {
  const guid = activeGuid();
  if (guid === lastActive) { return; }
  lastActive = guid;
  if (!guid || view !== 'game') { return; }
  const seat = mySeat();
  const mine = seat ? guid === seat : source === 'remote';
  if (!mine) { return; }
  if (seat) {
    const t = $('takeover');
    t.dataset.c = M.activePlayer(game).color;
    t.classList.add('on');
    setTimeout(() => t.classList.remove('on'), 1100);
  }
  if (prefs.sound) { chime(); }
  if (prefs.vibrate) { buzz([90, 60, 90]); }
}

// ---------- rendering

function renderAll(source) {
  if (view !== 'game' || !game) { return; }
  buildStructure();
  renderState();
  renderTimes();
  turnChanged(source);
  schedule();
  lock.sync();
}

function buildStructure() {
  const key = JSON.stringify([game.count_up, game.players.map((p) => [p.guid, p.name, p.color])]);
  if (key === structureKey) { return; }
  structureKey = key;
  const layers = $('layers');
  const roster = $('roster');
  layers.textContent = '';
  roster.textContent = '';
  for (const p of game.players) {
    const layer = el('span', 'layer');
    layer.dataset.c = p.color;
    layer.dataset.guid = p.guid;
    layer.append(el('span', 'wash'), el('span', 'wash-strong'), el('span', 'who', p.name),
      el('span', 'big'), el('span', 'sub'));
    layers.append(layer);

    const li = el('li');
    const b = el('button', 'prow');
    b.type = 'button';
    b.dataset.guid = p.guid;
    b.dataset.c = p.color;
    b.append(el('span', 'dot'), el('span', 'pname', p.name), el('span', 'ptime'));
    b.setAttribute('aria-label', `${p.name}: edit`);
    li.append(b);
    roster.append(li);
  }
  if (game.players.length === 0) {
    const empty = el('span', 'layer empty');
    empty.append(el('span', 'who', 'No players'), el('span', 'sub', 'Add one from the menu'));
    layers.append(empty);
  }
  renderSeat();
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) { e.className = cls; }
  if (text !== undefined) { e.textContent = text; }
  return e;
}

function setText(node, text) { if (node.textContent !== text) { node.textContent = text; } }
function setClass(node, cls, on) { if (node.classList.contains(cls) !== on) { node.classList.toggle(cls, on); } }

function renderState() {
  const active = M.activeIndex(game);
  const shownIdx = active === null ? 0 : active;
  const shown = game.players[shownIdx];
  const running = game.state === 'active';
  const seat = mySeat();
  document.body.dataset.active = active === null ? '' : game.players[active].guid;
  document.body.dataset.state = game.state;

  $('layers').querySelectorAll('.layer').forEach((l, i) => {
    setClass(l, 'on', i === shownIdx);
    setClass(l, 'mine', !!seat && i === active && game.players[i].guid === seat);
  });
  $('roster').querySelectorAll('.prow').forEach((b, i) => {
    setClass(b, 'on', i === active);
    if (i === active) { b.setAttribute('aria-current', 'true'); } else { b.removeAttribute('aria-current'); }
  });

  setClass($('game'), 'running', running);
  setText($('playLabel'), running ? 'Pause' : active === null ? 'Start' : 'Resume');
  const hint = !shown ? '' : running
    ? (seat ? (shown.guid === seat ? 'Your turn · tap anywhere when done' : `Waiting for ${shown.name}`) : 'Tap anywhere when the turn is done')
    : active === null ? `Tap to start · ${shown.name} first` : 'Paused · tap to resume';
  setText($('stageHint'), hint);
  $('stage').setAttribute('aria-label', !shown ? 'No players' : running ? `${shown.name}’s turn. Next player` : 'Start the clock');
  $('prevBtn').disabled = game.players.length < 2;
  $('nextBtn').disabled = game.players.length === 0;
  $('playBtn').disabled = game.players.length === 0;
  setText($('shareChip'), game.public ? game.join_code.toUpperCase() : 'This phone');
  setClass($('shareChip'), 'public', !!game.public);
}

function renderTimes() {
  const t = now();
  const s = skew();
  const layers = $('layers').children;
  const rows = $('roster').children;
  game.players.forEach((p, i) => {
    const d = M.display(game, p, t, s);
    const layer = layers[i];
    if (layer && layer.classList.contains('on')) {
      setText(layer.children[3], d.game);
      const sub = d.out ? 'Out of time'
        : game.count_up ? `This turn ${d.turn}`
        : p.state === 'playing' ? `Turn ${d.turn}` : `Turn ${M.formatTime(game.time_per_turn)}`;
      setText(layer.children[4], sub);
      setClass(layer, 'out', d.out);
      setClass(layer, 'tenths', d.game.includes('.') || d.turn.includes('.'));
    }
    const row = rows[i] && rows[i].firstChild;
    if (row) { setText(row.children[2], d.game); setClass(row, 'out', d.out); }
  });
}

function schedule() {
  clearTimeout(tickTimer);
  if (view !== 'game' || !game || document.visibilityState !== 'visible') { return; }
  const ms = M.msToNextChange(game, now(), skew());
  if (ms === Infinity) { return; }
  tickTimer = setTimeout(() => { renderTimes(); schedule(); }, ms);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { clearTimeout(tickTimer); return; }
  if (view === 'game' && game) {
    renderAll();
    if (game.public) { resync(); }
  }
});

// ---------- game controls

function startOrNext() {
  if (!game || game.players.length === 0) { return; }
  if (game.state === 'active') { M.nextPlayer(game, now(), skew()); } else { M.startClock(game, undefined, now(), skew()); }
  commit();
}

$('stage').addEventListener('click', startOrNext);
$('nextBtn').addEventListener('click', () => {
  if (!game || game.players.length === 0) { return; }
  M.nextPlayer(game, now(), skew());
  commit();
});
$('prevBtn').addEventListener('click', () => {
  if (!game || game.players.length < 2) { return; }
  M.prevPlayer(game, now(), skew());
  commit();
});
$('playBtn').addEventListener('click', () => {
  if (!game || game.players.length === 0) { return; }
  if (game.state === 'active') { M.pauseClock(game, now(), skew()); } else { M.startClock(game, undefined, now(), skew()); }
  commit();
});
$('roster').addEventListener('click', (e) => {
  const b = e.target.closest('.prow');
  if (b) { openPlayer(b.dataset.guid); }
});
$('menuBtn').addEventListener('click', openMenu);
$('shareChip').addEventListener('click', () => (game && game.public ? share() : openMenu()));

// Audio may start only after a tap; create (and park) the context on the first one.
document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });

// ---------- new game

const form = $('newGameForm');
function hms(prefix, root = form) {
  const v = (n) => Math.max(0, parseInt(root.querySelector(`[name=${prefix}${n}]`).value, 10) || 0);
  return v('h') * 3600 + v('m') * 60 + v('s');
}
function setHms(prefix, seconds, root = form) {
  const s = Math.max(0, Math.round(seconds));
  root.querySelector(`[name=${prefix}h]`).value = Math.floor(s / 3600);
  root.querySelector(`[name=${prefix}m]`).value = Math.floor((s % 3600) / 60);
  root.querySelector(`[name=${prefix}s]`).value = s % 60;
}
form.addEventListener('change', () => {
  form.classList.toggle('up', form.dir.value === 'up');
});
form.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
  setHms('turn_', +c.dataset.turn);
  setHms('game_', +c.dataset.game);
}));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  net.disconnect();
  game = M.newGame({ countUp: form.dir.value === 'up', perTurn: hms('turn_'), perGame: hms('game_') });
  saveLocal();
  if (location.hash === '#game/new') { enterGame(); } else { location.hash = '#game/new'; }
});

$('joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = M.joinCode($('joinCode').value);
  if (!code) { toast('Join codes are five letters.'); $('joinCode').focus(); return; }
  location.hash = '#game/' + code;
});

// ---------- menu

function openMenu() {
  if (!game) { return; }
  $('sharePublic').hidden = !game.public;
  $('sharePrivate').hidden = !!game.public;
  setText($('menuCode'), game.public ? game.join_code.toUpperCase() : '');
  $('addPlayerBtn').disabled = game.players.length >= M.MAX_PLAYERS;
  $('prefWake').checked = prefs.wakeLock;
  $('prefWake').disabled = !canWakeLock;
  $('prefSound').checked = prefs.sound;
  $('prefVibrate').checked = prefs.vibrate;
  $('prefVibrateRow').hidden = !canVibrate;
  renderSeat();
  openSheet($('menu'));
}

function renderSeat() {
  if (!game) { return; }
  const sel = $('seat');
  sel.textContent = '';
  sel.append(new Option('Nobody (shared phone)', ''));
  for (const p of game.players) { sel.append(new Option(p.name, p.guid)); }
  const seat = mySeat();
  sel.value = seat && game.players.some((p) => p.guid === seat) ? seat : '';
}

$('seat').addEventListener('change', (e) => {
  if (e.target.value) { prefs.seats[seatKey()] = e.target.value; } else { delete prefs.seats[seatKey()]; }
  savePrefs(prefs);
  lastActive = activeGuid();
  renderState();
});
for (const [id, key] of [['prefWake', 'wakeLock'], ['prefSound', 'sound'], ['prefVibrate', 'vibrate']]) {
  $(id).addEventListener('change', (e) => {
    prefs[key] = e.target.checked;
    savePrefs(prefs);
    lock.sync();
    if (key === 'sound' && prefs.sound) { chime(); }
    if (key === 'vibrate' && prefs.vibrate) { buzz(60); }
  });
}

$('publicBtn').addEventListener('click', async () => {
  const btn = $('publicBtn');
  btn.disabled = true;
  connectNet();
  try {
    const local = M.clone(game);
    local.public = true;
    const g = await net.send('create', local);
    // Keep this phone's seat for the game's new identity.
    if (prefs.seats.local) { prefs.seats[g.join_code] = prefs.seats.local; savePrefs(prefs); }
    game = g;
    ignoreHash = true;
    location.replace('#game/' + g.join_code);
    renderAll('server');
    openMenu();
  } catch (e) {
    toast(e.message);
  } finally { btn.disabled = false; }
});

$('shareBtn').addEventListener('click', share);
async function share() {
  const url = location.href;
  try {
    if (navigator.share) { await navigator.share({ title: 'Gentleman’s Clock', text: `Join code ${game.join_code.toUpperCase()}`, url }); return; }
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch (e) {
    if (e && e.name !== 'AbortError') { toast(`Code ${game.join_code.toUpperCase()}`); }
  }
}

$('addPlayerBtn').addEventListener('click', () => {
  const p = M.addPlayer(game);
  if (!p) { return; }
  commit();
  closeSheet($('menu'));
  openPlayer(p.guid);
});

$('resetBtn').addEventListener('click', async () => {
  if (!(await ask('Reset the clock? Every player’s time goes back to the start.', 'Reset'))) { return; }
  M.resetClock(game);
  commit();
  closeSheet($('menu'));
});

$('quitBtn').addEventListener('click', async () => {
  const msg = game.public
    ? 'Leave this game? Others keep playing; you can rejoin with the code.'
    : 'Leave this game? It stays saved on this phone and you can resume it from the start screen.';
  if (!(await ask(msg, 'Leave'))) { return; }
  closeSheet($('menu'));
  location.hash = '#';
});

// ---------- player sheet

function openPlayer(guid) {
  const p = game && game.players.find((x) => x.guid === guid);
  if (!p) { return; }
  editing = guid;
  const f = $('playerForm');
  f.name.value = p.name;
  setText($('playerTitle'), p.name);
  const sw = $('swatches');
  sw.querySelectorAll('label').forEach((l) => l.remove());
  for (const c of M.COLORS) {
    const l = el('label', 'swatch');
    l.dataset.c = c;
    const r = el('input');
    r.type = 'radio'; r.name = 'color'; r.value = c; r.checked = c === p.color;
    r.setAttribute('aria-label', c);
    l.append(r);
    sw.append(l);
  }
  const d = M.timeLeft(game, p, now(), skew());
  setText($('playerTimeLabel'), game.count_up ? 'Game time used' : 'Game time left');
  setHms('', d.gameTimeLeft, f);
  editStart = hms('', f);
  const i = game.players.indexOf(p);
  $('moveUp').disabled = i === 0;
  $('moveDown').disabled = i === game.players.length - 1;
  openSheet($('playerSheet'));
}

$('playerSheet').addEventListener('close', () => {
  const sheet = $('playerSheet');
  const p = game && game.players.find((x) => x.guid === editing);
  if (sheet.returnValue === 'save' && p) {
    const f = $('playerForm');
    p.name = (f.name.value.trim() || p.name).slice(0, M.MAX_NAME);
    p.color = f.color.value || p.color;
    const t = hms('', f);
    if (t !== editStart) { M.setPlayerTime(game, p.guid, t, now(), skew()); }
    commit();
  }
  editing = null;
});

for (const [id, delta] of [['moveUp', -1], ['moveDown', 1]]) {
  $(id).addEventListener('click', () => {
    if (M.movePlayer(game, editing, delta)) { commit(); openPlayer(editing); }
  });
}

$('removePlayer').addEventListener('click', async () => {
  const p = game.players.find((x) => x.guid === editing);
  if (!p || !(await ask(`Remove ${p.name}? Their time can’t be brought back.`, 'Remove'))) { return; }
  M.removePlayer(game, p.guid);
  closeSheet($('playerSheet'));
  commit();
});

// ---------- sheets, confirm, toast

function openSheet(d) {
  if (!d.open) { d.returnValue = ''; d.showModal(); }
}
function closeSheet(d) { if (d.open) { d.close(); } }
function closeSheets() { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }

// Tap outside a sheet closes it.
document.querySelectorAll('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => {
  if (e.target === d) { d.close('cancel'); }
}));

function ask(text, ok) {
  const d = $('confirm');
  setText($('confirmText'), text);
  setText($('confirmYes'), ok);
  openSheet(d);
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'yes'), { once: true }));
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- start

if (!canVibrate) { document.documentElement.classList.add('no-vibrate'); }
window.addEventListener('hashchange', route);
route();
