/** Prepares the athan audio from one pinned, openly licensed recording. Run deliberately (needs ffmpeg + afconvert):
 *   node scripts/prepare-athan.mjs
 * Source: Wikimedia Commons "Beautiful adhan.ogg" by Adam-synagda, CC0 1.0 (public domain dedication).
 * Outputs (committed): public/sounds/athan.m4a (full, in-app), public/sounds/athan-alert.caf (iOS notification,
 * ≤30 s as iOS requires), public/sounds/athan.mp3 (Android notification channel, full).
 * LISTEN before release: confirm it is a complete, correct athan and not the Fajr wording (see content/athan/source.json). */
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = JSON.parse(await readFile(path.join(root, 'content/athan/source.json'), 'utf8'));
const dir = await mkdtemp(path.join(tmpdir(), 'ayahflow-athan-'));
const res = await fetch(source.download, { headers: { 'User-Agent': 'AyahFlow-build/0.1 (prepare-athan)' } });
if (!res.ok) throw new Error(`download: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const hash = createHash('sha256').update(buf).digest('hex');
if (hash !== source.sha256) throw new Error(`sha256 ${hash} != pinned ${source.sha256}; review the new upload before updating the pin`);
const src = path.join(dir, 'source.ogg');
await writeFile(src, buf);
const ff = (...args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', src, ...args], { stdio: 'inherit' });
ff('-ac', '1', '-c:a', 'aac', '-b:a', '64k', path.join(root, 'public/sounds/athan.m4a'));
ff('-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', path.join(root, 'public/sounds/athan.mp3'));
const clip = path.join(dir, 'alert.wav');
ff('-ac', '1', '-ar', '22050', '-t', String(source.alertSeconds), '-af', `afade=t=out:st=${source.alertSeconds - 2.5}:d=2.5`, clip);
execFileSync('afconvert', ['-f', 'caff', '-d', 'ima4', clip, path.join(root, 'public/sounds/athan-alert.caf')], { stdio: 'inherit' });
console.log('Athan audio prepared from', source.title, `(${source.licence})`);
