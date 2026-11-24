const test = require('node:test');
const assert = require('node:assert');
const v = require('../server/validate');

test('joinCode accepts 5 letters only', () => {
   assert.strictEqual(v.joinCode('ABCDE'), 'abcde');
   for (const bad of [undefined, null, 5, {}, [], 'abcd', 'abcdef', 'ab1de', '']) {
      assert.strictEqual(v.joinCode(bad), null);
   }
});

test('gameData whitelists fields and rejects bad players', () => {
   const ok = v.gameData({ state: 'bogus', evil: 1, _id: 'x', players: [{ name: 'a'.repeat(30), guid: 'g1', color: 'nope' }] });
   assert.strictEqual(ok.data.state, 'paused');
   assert.strictEqual(ok.data.evil, undefined);
   assert.strictEqual(ok.data.players[0].name.length, 12);
   assert.strictEqual(ok.data.players[0].color, 'red');
   for (const bad of [null, [], 'x', { players: 'x' }, { players: [null] }, { players: [{ name: 'a' }] },
      { players: Array(13).fill({ name: 'a', guid: 'g' }) }]) {
      assert.ok(v.gameData(bad).error, JSON.stringify(bad));
   }
});

test('safeHandler never throws and tolerates a missing callback', () => {
   const h = v.safeHandler('t', () => { throw new Error('boom'); });
   const origErr = console.error; console.error = () => {};
   try {
      let got;
      h({ model: {} }, (r) => { got = r; });
      assert.deepStrictEqual(got, { error: 'Server error.' });
      h({ model: {} });          // no callback
      h(undefined, (r) => { got = r; });
      assert.deepStrictEqual(got, { error: 'Invalid request.' });
   } finally { console.error = origErr; }
});
