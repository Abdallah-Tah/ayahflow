/** The 99 Names. The list is the one narrated in Jami' at-Tirmidhi 3507, verbatim (content/names/names.json); its
 * hadith scholars grade that listing weak, while the statement that Allah has ninety-nine names is authentic (3506), and
 * the app says both. No meanings or explanations are written here: those need a reviewed, sourced commentary. */
import NAMES_DATA, { type NamesSource } from './names-data.js';
import { dayKey } from './engine.js';
export type { NamesSource };
export const NAMES: readonly { n: number; ar: string }[] = NAMES_DATA.names;
export const NAMES_LIST: NamesSource = NAMES_DATA.list;
export const NAMES_ABOUT: NamesSource = NAMES_DATA.about;
/** Ayahs about Allah's names, read from the Tanzil corpus: [surah, from, to]. */
export const NAMES_QURAN: readonly [number, number, number][] = [[7, 180, 180], [17, 110, 110], [20, 8, 8], [59, 22, 24]];
/** One name a day, in order, the same for everyone on a given local date. */
export function nameOfDay(day = dayKey()): { n: number; ar: string } {
    const days = Math.round(new Date(`${day}T12:00:00Z`).getTime() / 86400000);
    return NAMES[((days % NAMES.length) + NAMES.length) % NAMES.length]!;
}
