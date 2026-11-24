const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { GameStore, DAY } = require('../server/store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gc-store-'));

test('create gives unique 5-letter codes; get and update', () => {
   const s = new GameStore();
   const codes = new Set();
   for (let i = 0; i < 200; ++i) { codes.add(s.create({ players: [] }).join_code); }
   assert.strictEqual(codes.size, 200);
   const g = s.create({ state: 'paused', players: [] });
   assert.match(g.join_code, /^[a-z]{5}$/);
   assert.strictEqual(s.get(g.join_code), g);
   s.update(g.join_code, { state: 'active', join_code: 'hacked' });
   assert.strictEqual(s.get(g.join_code).state, 'active');
   assert.strictEqual(s.get(g.join_code).join_code, g.join_code);
   assert.strictEqual(s.update('nopee', {}), null);
});

test('games idle for a day expire; activity keeps them', () => {
   let t = 1e12;
   const s = new GameStore({ now: () => t });
   const a = s.create({ players: [] }), b = s.create({ players: [] });
   t += DAY - 1000;
   s.update(b.join_code, { state: 'active' });
   t += 2000;
   assert.strictEqual(s.get(a.join_code), null, 'idle game gone');
   assert.ok(s.get(b.join_code), 'touched game kept');
   t += DAY + 1;
   assert.strictEqual(s.expire(), 1);
   assert.strictEqual(s.games.size, 0);
});

test('full store refuses new games', () => {
   const s = new GameStore({ maxGames: 2 });
   s.create({}); s.create({});
   assert.strictEqual(s.create({}), null);
});

test('snapshot survives a restart, dates revived, expired dropped, bad file ignored', () => {
   const dir = tmp();
   let t = Date.now();
   const s = new GameStore({ dataDir: dir, now: () => t });
   const g = s.create({ players: [{ name: 'A', guid: 'g1', date_turn_started: new Date(t) }] });
   const old = s.create({ players: [] });
   old.date_updated = new Date(t - DAY - 1);
   s.saveNow();
   const s2 = new GameStore({ dataDir: dir, now: () => t });
   assert.strictEqual(s2.load(), 1);
   const g2 = s2.get(g.join_code);
   assert.ok(g2.date_updated instanceof Date);
   assert.ok(g2.players[0].date_turn_started instanceof Date);
   assert.strictEqual(g2.players[0].name, 'A');
   fs.writeFileSync(path.join(dir, 'games.json'), '{not json');
   assert.strictEqual(new GameStore({ dataDir: dir }).load(), 0);
   assert.strictEqual(new GameStore({ dataDir: path.join(dir, 'none') }).load(), 0);
});
