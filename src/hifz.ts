/** Memorisation practice: listen to a short range with each ayah repeated, then recite it with words hidden and tap to
 * check. Pure helpers, so tested in Node. Nothing is scored or saved: this is the user's own practice, not evidence. */
import { chapter } from './data.js';
export const HIFZ_REPEATS = [1, 3, 5, 10] as const, HIFZ_LEVELS = [0, 1, 2, 3] as const, HIFZ_MAX_AYAHS = 20;
/** A valid range inside one surah (never crossing into the next), at most HIFZ_MAX_AYAHS long. */
export function hifzRange(surah: number, from: number, to: number): { surah: number; from: number; to: number } {
    const n = chapter(surah).count, a = Math.min(Math.max(1, Math.floor(from) || 1), n), b = Math.min(Math.max(a, Math.floor(to) || a), n, a + HIFZ_MAX_AYAHS - 1);
    return { surah, from: a, to: b };
}
/** Each ayah `repeat` times in order, then the whole range once more to join them (when longer than one ayah). */
export function hifzQueue(surah: number, from: number, to: number, repeat: number): [number, number][] {
    const out: [number, number][] = [];
    for (let a = from; a <= to; a++) for (let i = 0; i < repeat; i++) out.push([surah, a]);
    if (to > from) for (let a = from; a <= to; a++) out.push([surah, a]);
    return out;
}
/** Which words are hidden: 0 none, 1 every third, 2 every other, 3 all. The text itself is never changed. */
export function hiddenWord(index: number, level: number): boolean {
    return level >= 3 || (level === 2 && index % 2 === 1) || (level === 1 && index % 3 === 2);
}
