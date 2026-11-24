// The new client's game logic (client/src/model.js): the 2013 rules, the render scheduler, saved-game loading.
const test = require('node:test');
const assert = require('node:assert');
const load = () => import('../client/src/model.js');

const T0 = Date.parse('2026-11-24T12:00:00Z');

test('new game: two players, paused, distinct colours', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 900 }, T0);
  assert.equal(g.players.length, 2);
  assert.equal(g.state, 'paused');
  assert.notEqual(g.players[0].color, g.players[1].color);
  assert.equal(M.activeIndex(g), null);
});

test('countdown: turn time runs first, then game time', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 60 }, T0);
  M.startClock(g, 0, T0);
  const p = g.players[0];
  assert.deepEqual(M.timeLeft(g, p, T0 + 3000), { gameTimeLeft: 60, turnTimeLeft: 2 });
  assert.deepEqual(M.timeLeft(g, p, T0 + 8000), { gameTimeLeft: 57, turnTimeLeft: 0 });
  // Passing the turn banks the overrun and resets the turn.
  M.nextPlayer(g, T0 + 8000);
  assert.equal(p.state, 'waiting');
  assert.equal(p.game_time_used, 3);
  assert.equal(p.turn_time_used, 0);
  assert.equal(g.players[1].state, 'playing');
  assert.deepEqual(M.timeLeft(g, p, T0 + 20000), { gameTimeLeft: 57, turnTimeLeft: 5 });
});

test('pause and resume keep the time spent', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 60 }, T0);
  M.startClock(g, 0, T0);
  M.pauseClock(g, T0 + 7000);
  const p = g.players[0];
  assert.equal(g.state, 'paused');
  assert.deepEqual(M.timeLeft(g, p, T0 + 99000), { gameTimeLeft: 58, turnTimeLeft: 0 });
  // The turn's 5 s were used; resuming runs game time at once.
  M.startClock(g, undefined, T0 + 100000);
  assert.equal(M.activeIndex(g), 0);
  assert.deepEqual(M.timeLeft(g, p, T0 + 101000), { gameTimeLeft: 57, turnTimeLeft: 0 });
});

test('count up adds every turn into the game total', async () => {
  const M = await load();
  const g = M.newGame({ countUp: true }, T0);
  M.startClock(g, 0, T0);
  M.nextPlayer(g, T0 + 4000);
  M.nextPlayer(g, T0 + 5000);
  const p = g.players[0];
  assert.equal(p.game_time_used, 4);
  assert.deepEqual(M.timeLeft(g, p, T0 + 7500), { gameTimeLeft: 6.5, turnTimeLeft: 2.5 });
});

test('next and back wrap around any number of players', async () => {
  const M = await load();
  const g = M.newGame({}, T0);
  M.addPlayer(g); M.addPlayer(g);
  assert.equal(g.players.length, 4);
  M.prevPlayer(g, T0);
  assert.equal(M.activeIndex(g), 3);
  M.nextPlayer(g, T0);
  assert.equal(M.activeIndex(g), 0);
  M.prevPlayer(g, T0);
  assert.equal(M.activeIndex(g), 3);
});

test('skew: turn starts are stamped in server time', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 60 }, T0);
  M.startClock(g, 0, T0, 2000); // local clock 2 s ahead
  assert.equal(g.players[0].date_turn_started, new Date(T0 - 2000).toISOString());
  assert.equal(M.timeLeft(g, g.players[0], T0 + 1000, 2000).turnTimeLeft, 4);
});

test('reset, move, remove, set time', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 60 }, T0);
  const [a, b] = g.players;
  M.startClock(g, 0, T0);
  M.nextPlayer(g, T0 + 20000);
  M.resetClock(g);
  assert.ok(g.players.every((p) => p.game_time_used === 0 && p.state === 'waiting'));
  assert.ok(M.movePlayer(g, b.guid, -1));
  assert.equal(g.players[0], b);
  assert.ok(!M.movePlayer(g, b.guid, -1));
  M.setPlayerTime(g, a.guid, 30, T0);
  assert.equal(M.timeLeft(g, a, T0).gameTimeLeft, 30);
  M.removePlayer(g, a.guid);
  assert.deepEqual(g.players, [b]);
});

test('format: m:ss, h:mm:ss, tenths', async () => {
  const M = await load();
  assert.equal(M.formatTime(900), '15:00');
  assert.equal(M.formatTime(59.99), '0:59');
  assert.equal(M.formatTime(3725), '1:02:05');
  assert.equal(M.formatTime(9.46, true), '0:09.4');
  assert.equal(M.formatTime(-3), '0:00');
});

test('display: tenths only on a running game-time countdown under 10 s', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 12 }, T0);
  M.startClock(g, 0, T0);
  const p = g.players[0];
  let d = M.display(g, p, T0 + 2500);
  assert.equal(d.turn, '0:02');
  assert.equal(d.game, '0:12');
  d = M.display(g, p, T0 + 8600); // turn spent, 8.4 s of game left
  assert.equal(d.game, '0:08.4');
  d = M.display(g, p, T0 + 30000);
  assert.ok(d.out);
});

test('msToNextChange sleeps to the next visible digit, never while paused', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 5, perGame: 60 }, T0);
  assert.equal(M.msToNextChange(g, T0), Infinity);
  M.startClock(g, 0, T0);
  // Turn 5.0 left at T0: shows 0:05 until 4.999.., so the next change is ~immediate (frac 0 counts as a full step).
  assert.ok(Math.abs(M.msToNextChange(g, T0 + 300) - 702) <= 1); // 4.7 s left, 0:04 until 4.0
  assert.ok(Math.abs(M.msToNextChange(g, T0 + 15250) - 752) <= 1); // game 49.75 left, whole seconds: next at 49.0
  assert.ok(Math.abs(M.msToNextChange(g, T0 + 56030) - 72) <= 1); // game 8.97 left, tenths: next at 8.9
  M.pauseClock(g, T0 + 56030);
  assert.equal(M.msToNextChange(g, T0 + 56030), Infinity);
  // Out of time: nothing more to draw.
  M.startClock(g, undefined, T0 + 60000);
  assert.equal(M.msToNextChange(g, T0 + 80000), Infinity);
});

test('msToNextChange counting up', async () => {
  const M = await load();
  const g = M.newGame({ countUp: true }, T0);
  M.startClock(g, 0, T0);
  assert.ok(Math.abs(M.msToNextChange(g, T0 + 400) - 602) <= 1);
});

test('stepping the scheduler shows every second exactly once', async () => {
  const M = await load();
  const g = M.newGame({ perTurn: 3, perGame: 5 }, T0);
  M.startClock(g, 0, T0);
  const p = g.players[0];
  let t = T0 + 1;
  const seen = [M.display(g, p, t)];
  let wakes = 0;
  for (;;) {
    const ms = M.msToNextChange(g, t);
    if (ms === Infinity) { break; }
    t += ms; wakes += 1;
    seen.push(M.display(g, p, t));
    assert.ok(wakes < 200);
  }
  const shown = seen.map((d) => `${d.turn}|${d.game}|${d.out}`);
  // Every wake changes something (no wasted renders).
  for (let i = 1; i < shown.length; ++i) { assert.notEqual(shown[i], shown[i - 1], `wake ${i} ${shown[i]}`); }
  // 3 whole turn seconds, then the game: whole seconds until under 10 (here at once), tenths to 0.
  assert.equal(shown.at(-1), '0:00|0:00.0|true');
  assert.ok(wakes >= 50 && wakes <= 55, `wakes ${wakes}`);
});

test('saved 2013 games load, junk does not', async () => {
  const M = await load();
  const old = JSON.stringify({
    state: 'active', time_per_turn: 5, time_per_game: 900, count_up: false, public: false, join_code: null,
    date_created: '2014-03-01T10:00:00.000Z', date_updated: '2014-03-01T10:05:00.000Z',
    players: [
      { name: 'Ann', game_time_used: 12.5, turn_time_used: 0, state: 'playing', color: 'blue',
        guid: 'abcDEF123', date_turn_started: '2014-03-01T10:04:00.000Z' },
      { name: 'Bob', game_time_used: 0, turn_time_used: 0, state: 'waiting', color: 'chartreuse',
        guid: 'x'.repeat(40), date_turn_started: null },
    ],
  });
  const g = M.normalizeGame(old);
  assert.equal(g.players.length, 2);
  assert.equal(g.players[0].name, 'Ann');
  assert.equal(g.players[0].date_turn_started, '2014-03-01T10:04:00.000Z');
  assert.equal(g.players[1].color, 'red');
  assert.equal(M.activeIndex(g), 0);
  assert.equal(M.normalizeGame('not json'), null);
  assert.equal(M.normalizeGame('{"players":5}'), null);
  assert.equal(M.normalizeGame(null), null);
});
