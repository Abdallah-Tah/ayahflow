import { build } from 'esbuild';
await build({ entryPoints: ['native/bridge.mjs'], outfile: 'www/native-bridge.js', bundle: true, format: 'esm', target: 'es2022', minify: true });
console.log('Native adapter bundled. Run cap add on first setup, then cap sync.');
