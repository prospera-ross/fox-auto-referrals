import { build } from 'esbuild';
await build({ entryPoints: ['./src/index.ts'], outfile: 'dist/worker.js', tsconfig: './tsconfig.json',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
console.log('Worker bundled to dist/worker.js. Pages serves public/ directly.');
