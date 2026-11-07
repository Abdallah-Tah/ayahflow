/** Generates public/sounds/adhkar-chime.caf: a soft two-note chime (sine tones with a bell-like decay) for adhkar
 * reminders. Made here from formulas, so it carries no third-party rights. Requires ffmpeg.
 *   node scripts/make-chime.mjs */
import { spawnSync } from 'node:child_process';
// Two notes (A5 then E5), each with a quiet octave partial, decaying like a small bell.
const note = (f, at) => `if(gte(t,${at}),(0.55*sin(2*PI*${f}*(t-${at}))+0.18*sin(2*PI*${f * 2}*(t-${at})))*exp(-3.2*(t-${at})),0)`;
const expr = `0.85*(${note(880, 0)}+${note(659.25, 0.42)})`;
const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=2.2`, '-af', 'afade=t=out:st=1.8:d=0.4', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'caf', 'public/sounds/adhkar-chime.caf'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('Wrote public/sounds/adhkar-chime.caf');
