import { readFile, writeFile, rm, mkdir, cp, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
await rm('www', { recursive: true, force: true });
await mkdir('www', { recursive: true });
const local = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
let compiler = 'tsc';
try {
    await access(local);
    compiler = local;
}
catch { }
const result = spawnSync(compiler, [], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) {
    console.error('TypeScript build failed. Run npm install first.');
    process.exit(result.status ?? 1);
}
await cp('public', 'www', { recursive: true });
// Optional voice following. Shipped only when `npm run voice:fetch` has verified the NPL-1.2 model into vendor/.
// Without it the app hides the feature (no manifest). The single-file preview never includes it.
const { VOICE_DIR, VOICE_ASSETS } = await import('./fetch-voice-model.mjs');
const voiceReady = (await Promise.all(VOICE_ASSETS.map(a => access(path.join(VOICE_DIR, a.name)).then(() => true, () => false)))).every(Boolean);
if (voiceReady) {
    const { build: bundle } = await import('esbuild');
    await bundle({ entryPoints: ['voice/worker.ts'], outfile: 'www/voice/worker.js', bundle: true, format: 'esm', target: 'es2022', minify: true, logLevel: 'warning' });
    await cp('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'www/voice/ort-wasm-simd-threaded.wasm');
    await mkdir('www/voice/models', { recursive: true });
    for (const a of VOICE_ASSETS) await cp(path.join(VOICE_DIR, a.name), 'www/voice/models/' + a.name);
    await cp('licenses/NPL-1.2.txt', 'www/voice/models/LICENSE-NPL-1.2.txt');
    await writeFile('www/voice/manifest.json', JSON.stringify({ worker: 'worker.js', worklet: 'capture-worklet.js', model: 'models/' + VOICE_ASSETS[0].name, corpus: 'models/' + VOICE_ASSETS[1].name, licence: 'models/LICENSE-NPL-1.2.txt', sha256: Object.fromEntries(VOICE_ASSETS.map(a => [a.name, a.sha256])) }, null, 2));
    console.log('Voice following included (Tilawa / Quran-Lab model, NPL-1.2: no charge for the app or any feature it powers).');
}
else
    console.log('Voice following not included: run `npm run voice:fetch` to download the model.');
const data = await readFile('src/data.ts', 'utf8');
await writeFile('www/content-manifest.json', JSON.stringify({ version: 'starter-1', source: 'Quran.com Arabic chapter text', captured: '2026-09-28', chapters: [1, 103, 108, 109, 110, 112, 113, 114], ayahCount: 37, teacherReview: 'pending', sha256: createHash('sha256').update(data).digest('hex'), note: 'Checksum detects source-file changes; it is not religious or editorial certification.' }, null, 2));
const jsFiles = (await readdir('www/js')).filter(f => f.endsWith('.js'));
const assets = ['./', './index.html', './style.css', './assets/icon.svg', './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png', './manifest.webmanifest', './content-manifest.json', ...jsFiles.map(f => './js/' + f)];
const tag = createHash('sha256').update(await readFile('www/js/app.js')).update(await readFile('www/style.css')).update(data).digest('hex').slice(0, 12);
await writeFile('www/sw.js', `const CACHE='ayahflow-${tag}',ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('ayahflow-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||new Response('Offline: this resource is not cached.',{status:503}))));});\n`);
const style = await readFile('www/style.css', 'utf8'), icon = await readFile('www/assets/icon.svg', 'utf8'), iconURL = 'data:image/svg+xml;base64,' + Buffer.from(icon).toString('base64');
const imports = {};
for (const file of jsFiles) {
    let content = await readFile('www/js/' + file, 'utf8');
    content = content.replace(/from\s+(['"])\.\/([^'"]+)\.js\1/g, (_, q, name) => `from ${q}ayahflow/${name}${q}`);
    content = content.replaceAll('./assets/icon.svg', iconURL);
    imports['ayahflow/' + file.slice(0, -3)] = 'data:text/javascript;base64,' + Buffer.from(content).toString('base64');
}
let html = await readFile('www/index.html', 'utf8');
html = html.replace(/<link\s+rel="stylesheet"[^>]+>/, '<style>' + style + '</style>').replace(/<link\s+rel="manifest"[^>]+>/, '').replace(/<link\s+rel="apple-touch-icon"[^>]+>/, '').replaceAll('./assets/icon.svg', iconURL).replace(/<script\s+type="module"\s+src="\.\/js\/app\.js"><\/script>/, `<script type="importmap">${JSON.stringify({ imports })}</script><script type="module">import 'ayahflow/app';</script>`);
await writeFile('AyahFlow-preview.html', html);
console.log('Built www/ and AyahFlow-preview.html. Native bridge is bundled separately by native:prepare.');
