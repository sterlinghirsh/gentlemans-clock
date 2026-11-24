// Builds the static client into dist/: index.html (with the realtime origin and build id), style.css, app.js
// (client/src bundled and minified by esbuild, socket.io-client inside), fonts/, icons/, manifest.json.
// Env: REALTIME_ORIGIN (the socket server; empty means the page's own origin), BUILD_ID (cache-busting query on
// the js and css).
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = 'dist';
const origin = process.env.REALTIME_ORIGIN || '';
const buildId = process.env.BUILD_ID || 'dev';
if (origin && !/^https?:\/\/[A-Za-z0-9.:-]+$/.test(origin)) { throw new Error(`bad REALTIME_ORIGIN ${origin}`); }
if (!/^[A-Za-z0-9._-]+$/.test(buildId)) { throw new Error(`bad BUILD_ID ${buildId}`); }

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await build({
  entryPoints: ['client/src/app.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'],
  outfile: `${out}/app.js`, legalComments: 'none', logLevel: 'warning',
});
cpSync('client/style.css', `${out}/style.css`);
cpSync('client/manifest.json', `${out}/manifest.json`);
cpSync('client/fonts', `${out}/fonts`, { recursive: true });
cpSync('client/icons', `${out}/icons`, { recursive: true });
const html = readFileSync('client/index.html', 'utf8')
  .replaceAll('%BUILD_ID%', buildId)
  .replace('%GC_SERVER%', origin ? JSON.stringify(origin) : 'null');
writeFileSync(`${out}/index.html`, html);
const kb = (f) => (statSync(`${out}/${f}`).size / 1024).toFixed(1);
console.log(`client: ${out}/ (server ${origin || 'same origin'}, build ${buildId}; app.js ${kb('app.js')} KB, style.css ${kb('style.css')} KB)`);
