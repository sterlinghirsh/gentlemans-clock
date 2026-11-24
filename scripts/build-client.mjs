// Builds the static client into dist/: index.html (with the realtime origin and build id), css/, img/, font/,
// js/main-built.js (r.js). Env: REALTIME_ORIGIN (the socket server; empty means the page's own origin),
// BUILD_ID (cache-busting query on the js and css).
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const out = 'dist';
const origin = process.env.REALTIME_ORIGIN || '';
const build = process.env.BUILD_ID || 'dev';
if (origin && !/^https?:\/\/[A-Za-z0-9.:-]+$/.test(origin)) { throw new Error(`bad REALTIME_ORIGIN ${origin}`); }
if (!/^[A-Za-z0-9._-]+$/.test(build)) { throw new Error(`bad BUILD_ID ${build}`); }

rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/js`, { recursive: true });
const rjs = createRequire(import.meta.url).resolve('requirejs/bin/r.js');
execFileSync(process.execPath, [rjs, '-o', 'static/js/build.js', 'baseUrl=static/js', `out=${out}/js/main-built.js`],
   { stdio: ['ignore', 'ignore', 'inherit'] });
cpSync('static/css/all.css', `${out}/css/all.css`);
cpSync('static/img', `${out}/img`, { recursive: true });
cpSync('static/font', `${out}/font`, { recursive: true });
const html = readFileSync('client/index.html', 'utf8')
   .replaceAll('%BUILD_ID%', build)
   .replace('%GC_SERVER%', origin ? JSON.stringify(origin) : 'null');
writeFileSync(`${out}/index.html`, html);
console.log(`client: ${out}/ (server ${origin || 'same origin'}, build ${build})`);
