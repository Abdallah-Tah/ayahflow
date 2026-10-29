/** Builds content/names/names.json: the 99 Names as listed in Jami' at-Tirmidhi 3507, sliced verbatim (no name is typed
 * by hand), with Tirmidhi 3506 for the authentic statement that Allah has ninety-nine names. Run deliberately:
 *   node scripts/build-names.mjs                 (fetches the two hadiths from the public-domain dataset)
 *   HADITH_DIR=/path node scripts/build-names.mjs (reads ara-tirmidhi.json instead)
 * No per-name Quran reference: a matching word is often not the name (al-mu'izz also spells "goats" in 6:143). The app
 * shows the ayahs about Allah's names instead (src/names.ts). */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slice, plainKey } from './build-adhkar.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATASET = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
async function hadith(n) {
    if (process.env.HADITH_DIR) return JSON.parse(await readFile(path.join(process.env.HADITH_DIR, 'ara-tirmidhi.json'), 'utf8')).hadiths.find(h => h.hadithnumber === n);
    const res = await fetch(`${DATASET}/ara-tirmidhi/${n}.json`);
    if (!res.ok) throw new Error(`tirmidhi:${n}: HTTP ${res.status}`);
    return (await res.json()).hadiths[0];
}
/** Names of more than one word in the list. */
const PHRASES = [['مالك', 'الملك'], ['ذو', 'الجلال', 'والاكرام']];
export function splitNames(list) {
    const words = list.split(/\s+/).filter(Boolean), out = [];
    for (let i = 0; i < words.length; i++) {
        const p = PHRASES.find(ph => ph.every((w, j) => plainKey(words[i + j] ?? '') === w));
        if (p) { out.push(words.slice(i, i + p.length).join(' ')); i += p.length - 1; } else out.push(words[i]);
    }
    return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const list = await hadith(3507), about = await hadith(3506);
    // The narration reads "He is Allah, besides whom there is no god: ar-Rahman, ar-Rahim, ..." and then lists 98 names;
    // with the name Allah they are the ninety-nine.
    const words = slice(list.text, 'هو الله الذي لا اله الا هو الرحمن', 'الرشيد الصبور').split(/\s+/);
    if (words.slice(2, 7).map(plainKey).join(' ') !== 'الذي لا اله الا هو') throw new Error('unexpected wording before the names');
    const names = [words[1], ...splitNames(words.slice(7).join(' '))];
    if (names.length !== 99) throw new Error(`expected 99 names, got ${names.length}`);
    const grades = (h) => (h.grades ?? []).map(g => ({ by: g.name, grade: g.grade }));
    const out = {
        dataset: 'fawazahmed0/hadith-api@1',
        list: { ref: 'tirmidhi:3507', collection: "Jami' at-Tirmidhi", number: '3507', inBook: list.reference ?? null, grades: grades(list), text: list.text },
        about: { ref: 'tirmidhi:3506', collection: "Jami' at-Tirmidhi", number: '3506', inBook: about.reference ?? null, grades: grades(about), text: slice(about.text, 'ان لله تسعة وتسعين اسما', 'دخل الجنة') },
        names: names.map((ar, i) => ({ n: i + 1, ar })),
    };
    await writeFile(path.join(root, 'content/names/names.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(`99 names from ${out.list.ref}: ${names.join(' ')}`);
}
