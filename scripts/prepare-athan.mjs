/** Prepares the athan recordings listed in content/athan/sources.json. Run deliberately (needs ffmpeg + afconvert):
 *   node scripts/prepare-athan.mjs
 * Each source is downloaded from Wikimedia Commons, checked against its pinned SHA-256, loudness-normalised, and written as
 *   public/sounds/athan-<id>.mp3        full recording (in-app playback; Android notification channel)
 *   public/sounds/athan-<id>-alert.caf  ≤30 s iOS notification sound, starting where the athan begins
 * LISTEN before release: see reviewNotes in content/athan/sources.json. */
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { alertSeconds, recordings } = JSON.parse(await readFile(path.join(root, 'content/athan/sources.json'), 'utf8'));
const dir = await mkdtemp(path.join(tmpdir(), 'ayahflow-athan-'));
const TARGET = 'I=-16:TP=-1.5:LRA=11';
// Two-pass linear loudness normalisation (measure, then apply one fixed gain): no pumping on long, reverberant phrases.
for (const r of recordings) {
    const res = await fetch(r.download, { headers: { 'User-Agent': 'AyahFlow-build/0.1 (prepare-athan)' } });
    if (!res.ok) throw new Error(`${r.id}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer()), hash = createHash('sha256').update(buf).digest('hex');
    if (hash !== r.sha256) throw new Error(`${r.id}: sha256 ${hash} != pinned ${r.sha256}; review the new upload before updating the pin`);
    const src = path.join(dir, `${r.id}${path.extname(new URL(r.download).pathname)}`);
    await writeFile(src, buf);
    // Skip any lead-in silence so the short iOS alert starts with the athan itself.
    const probe = execFileSync('ffmpeg', ['-nostdin', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.4', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    const lead = /silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)/.exec(probe);
    const start = lead && Number(lead[1]) <= 0.05 ? Math.max(0, Number(lead[2]) - 0.25) : 0;
    const ff = (...args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', src, ...args], { stdio: 'inherit' });
    const report = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', src, '-af', `loudnorm=${TARGET}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const measured = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(report)[0]);
    const NORM = `loudnorm=${TARGET}:linear=true:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}`;
    ff('-ac', '1', '-af', NORM, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', path.join(root, `public/sounds/athan-${r.id}.mp3`));
    const wav = path.join(dir, `${r.id}-alert.wav`);
    ff('-ss', String(start), '-t', String(alertSeconds), '-ac', '1', '-ar', '44100', '-af', `${NORM},afade=t=in:d=0.15,afade=t=out:st=${alertSeconds - 2.5}:d=2.5`, wav);
    // 16-bit linear PCM: iOS notification sounds accept PCM, IMA4, µ-law or a-law (not AAC); PCM keeps the voice clear.
    execFileSync('afconvert', ['-f', 'caff', '-d', 'LEI16@44100', wav, path.join(root, `public/sounds/athan-${r.id}-alert.caf`)], { stdio: 'inherit' });
    console.log(`${r.id.padEnd(11)} ${r.licence.padEnd(13)} alert from ${start.toFixed(2)} s`);
}
