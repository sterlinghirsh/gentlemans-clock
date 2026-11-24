// Starts the real server (no database) and talks to it as the deploy and two browsers would.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = 'https://sterlinghirsh.com';
const call = (s, ev, req) => new Promise((resolve) => s.emit(ev, req, (e, g) => resolve([e, g])));
const alive = () => fetch(`${BASE}/health`).then((r) => r.ok, () => false);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-server-'));
const client = () => io(BASE, { path: '/ws', addTrailingSlash: false, extraHeaders: { Origin: PAGE }, transports: ['websocket'] });

async function startServer() {
   const child = spawn(process.execPath, ['server/main.js'], {
      env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, BUILD_ID: 'test123',
         ALLOWED_ORIGINS: `${PAGE},https://other.example` }, stdio: 'ignore' });
   child.exited = new Promise((r) => child.on('exit', r));
   for (let i = 0; i < 50 && !(await alive()); ++i) { await new Promise((r) => setTimeout(r, 100)); }
   return child;
}
const connected = (s) => new Promise((r) => s.connected ? r() : s.on('connect', r));

// A raw upgrade like the deploy's curl: returns the status code.
function wsStatus(origin) {
   return new Promise((resolve) => {
      const sock = net.connect(PORT, '127.0.0.1', () => sock.write(`GET /ws?probe=1 HTTP/1.1\r\nHost: x\r\n` +
         `Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\n` +
         `Sec-WebSocket-Key: Z2FtZS1kZXBsb3kgcHJvYmU=\r\nOrigin: ${origin}\r\n\r\n`));
      let buf = '';
      sock.on('data', (d) => { buf += d; });
      sock.on('close', () => resolve(Number(buf.split(' ')[1])));
   });
}

test('server: health, probe, origins, two clients, malformed input, restart', async (t) => {
   let child = await startServer();
   t.after(() => child.kill());

   const h = await fetch(`${BASE}/health`);
   assert.strictEqual(await h.text(), 'ok test123\n');
   assert.strictEqual(h.headers.get('cache-control'), 'no-store');
   assert.strictEqual((await fetch(`${BASE}/viewStats`)).status, 404, '/viewStats is gone');

   assert.strictEqual(await wsStatus(PAGE), 101);
   assert.strictEqual(await wsStatus('https://origin-check.invalid'), 403);

   // A foreign page can't open the socket.
   const evil = io(BASE, { path: '/ws', addTrailingSlash: false, extraHeaders: { Origin: 'https://evil.example' },
      transports: ['websocket'], reconnection: false });
   await new Promise((r) => evil.on('connect_error', r));
   evil.close();

   const a = client(), b = client();
   t.after(() => { a.close(); b.close(); });
   await Promise.all([connected(a), connected(b)]);

   const [te, now] = await new Promise((r) => a.emit('time', (e, n) => r([e, n])));
   assert.strictEqual(te, null);
   assert.ok(Math.abs(now - Date.now()) < 5000);

   // Each of these used to throw inside the handler and kill the process.
   for (const ev of ['read', 'update', 'create']) {
      for (const req of [undefined, null, 5, {}, { model: null }, { model: { join_code: 5, players: 'x' } }]) {
         const [err] = await call(a, ev, req);
         assert.ok(err, `${ev} ${JSON.stringify(req)} should return an error`);
      }
      a.emit(ev, { model: {} });
      a.emit(ev);
   }
   assert.ok(await alive(), 'server still running');
   const [nf] = await call(a, 'update', { model: { join_code: 'zzzzz', players: [] } });
   assert.deepStrictEqual(nf, { error: 'Game not found.' });

   // A creates, B joins by code (any case), A's update reaches B.
   const [e1, game] = await call(a, 'create', { model: { public: true, players: [{ name: 'Alice', guid: 'g1', color: 'red' }] } });
   assert.strictEqual(e1, null);
   const [e2, read] = await call(b, 'read', { model: { join_code: game.join_code.toUpperCase() } });
   assert.strictEqual(e2, null);
   assert.strictEqual(read.players[0].name, 'Alice');
   const got = new Promise((r) => b.once('update', r));
   const [e3] = await call(a, 'update', { model: { ...game, state: 'active',
      players: [...game.players, { name: '<b>Bob</b>', guid: 'g2', color: 'blue' }] } });
   assert.strictEqual(e3, null);
   const upd = await got;
   assert.strictEqual(upd.join_code, game.join_code);
   assert.deepStrictEqual(upd.players.map((p) => p.name), ['Alice', '<b>Bob</b>']);

   // A restart keeps the game.
   a.close(); b.close();
   child.kill('SIGTERM');
   await child.exited;
   child = await startServer();
   const c = client();
   t.after(() => c.close());
   await connected(c);
   const [e4, again] = await call(c, 'read', { model: { join_code: game.join_code } });
   assert.strictEqual(e4, null);
   assert.strictEqual(again.players.length, 2);
});
