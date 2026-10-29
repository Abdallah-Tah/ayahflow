/** Builds content/ramadan/ramadan.json: two narrations shown in Ramadan, sliced verbatim (nothing typed by hand).
 *   node scripts/build-ramadan.mjs                 (fetches from the public-domain dataset)
 *   HADITH_DIR=/path node scripts/build-ramadan.mjs (reads ara-<collection>.json full editions instead) */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slice, COLLECTIONS } from './build-adhkar.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATASET = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
async function hadith(ref) {
    const [c, n] = ref.split(':');
    if (process.env.HADITH_DIR) return JSON.parse(await readFile(path.join(process.env.HADITH_DIR, `ara-${c}.json`), 'utf8')).hadiths.find(h => String(h.hadithnumber) === n);
    const res = await fetch(`${DATASET}/ara-${c}/${n}.json`);
    if (!res.ok) throw new Error(`${ref}: HTTP ${res.status}`);
    return (await res.json()).hadiths[0];
}
const ITEMS = [
    // The odd nights of the last ten: when to seek Laylat al-Qadr.
    { id: 'qadr-nights', ref: 'bukhari:2017', start: 'تحروا ليلة القدر', end: 'من رمضان' },
    // What to say on it: taught to 'A'ishah.
    { id: 'qadr-dua', ref: 'tirmidhi:3513', start: 'اللهم انك عفو', end: 'فاعف عني' },
];
if (import.meta.url === `file://${process.argv[1]}`) {
    const out = { dataset: 'fawazahmed0/hadith-api@1', items: [] };
    for (const it of ITEMS) {
        const h = await hadith(it.ref), [c, n] = it.ref.split(':');
        out.items.push({ id: it.id, text: slice(h.text, it.start, it.end), source: { ref: it.ref, collection: COLLECTIONS[c], number: n, inBook: h.reference ?? null, grades: (h.grades ?? []).map(g => ({ by: g.name, grade: g.grade })) }, full: h.text });
    }
    await writeFile(path.join(root, 'content/ramadan/ramadan.json'), JSON.stringify(out, null, 1) + '\n');
    for (const i of out.items) console.log(i.id.padEnd(12), i.text);
}
