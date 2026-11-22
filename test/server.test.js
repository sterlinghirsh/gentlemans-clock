// Starts the real server against an in-memory MongoDB and sends the messages that used to crash it.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const PORT = 3999;
const call = (s, ev, req) => new Promise((resolve) => s.emit(ev, req, (e, g) => resolve([e, g])));
const alive = () => fetch(`http://localhost:${PORT}/viewStats`).then((r) => r.ok, () => false);

test('malformed socket messages do not crash the server (regression)', async (t) => {
   const { MongoMemoryServer } = require('mongodb-memory-server');
   const mongo = await MongoMemoryServer.create();
   const child = spawn(process.execPath, ['app.js'], {
      env: { ...process.env, PORT: String(PORT), MONGOLAB_URI: mongo.getUri() + 'gameclock', },
      stdio: 'ignore' });
   let exited = false; child.on('exit', () => { exited = true; });
   const s = io(`http://localhost:${PORT}`);
   t.after(async () => { s.close(); child.kill(); await mongo.stop(); });
   for (let i = 0; i < 50 && !(await alive()); ++i) { await new Promise((r) => setTimeout(r, 200)); }
   await new Promise((r) => s.on('connect', r));

   // Each of these used to throw inside the handler and kill the process.
   for (const ev of ['read', 'update', 'create']) {
      for (const req of [undefined, null, 5, {}, { model: null }, { model: {} }, { model: { join_code: 5 } },
         { model: { join_code: 'abcde', players: 'x' } }]) {
         if (ev === 'create' && req && req.model && !Array.isArray(req.model.players) && req.model.players === undefined) { continue; } // a bare model is a valid empty game
         const [err] = await call(s, ev, req);
         assert.ok(err, `${ev} ${JSON.stringify(req)} should return an error`);
      }
      s.emit(ev, { model: {} });            // no callback at all
      s.emit(ev);
   }
   assert.ok(await alive() && !exited, 'server still running');

   // Unknown code on update is an error, not a new game.
   const [err] = await call(s, 'update', { model: { join_code: 'zzzzz', players: [] } });
   assert.deepStrictEqual(err, { error: 'Game not found.' });

   // Normal flow still works.
   const [e1, game] = await call(s, 'create', { model: { players: [{ name: 'A', guid: 'g1' + Date.now(), color: 'red' }] } });
   assert.strictEqual(e1, null);
   const [e2, read] = await call(s, 'read', { model: { join_code: game.join_code.toUpperCase() } });
   assert.strictEqual(e2, null);
   assert.strictEqual(read.players.length, 1);
});
