// Bundles server/main.js and its dependencies into one file, <out>/main.cjs (the droplet never runs npm install).
import { build } from 'esbuild';

const i = process.argv.indexOf('--out');
const out = i > 0 ? process.argv[i + 1] : '.tmp/server';
await build({
   entryPoints: ['server/main.js'], bundle: true, platform: 'node', target: 'node24', format: 'cjs',
   outfile: `${out}/main.cjs`, sourcemap: true, logLevel: 'warning',
   // Optional native speedups socket.io's ws tries to load; it falls back without them.
   external: ['bufferutil', 'utf-8-validate'],
});
console.log(`server: ${out}/main.cjs`);
