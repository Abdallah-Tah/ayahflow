/** Builds content/eid/eid.json: the narrations shown for Eid, Zakat al-Fitr and the fasts of Arafah, Tasu'a and Ashura,
 * sliced verbatim from the public-domain fawazahmed0/hadith-api dataset (nothing typed by hand).
 *   node scripts/build-eid.mjs                       (offline: re-slices the narrations saved in content/eid/eid.json)
 *   REFETCH=1 node scripts/build-eid.mjs             (fetches each narration again)
 *   HADITH_FILES=/dir node scripts/build-eid.mjs     (reads <collection>-<number>.json files saved from the dataset)
 * Muslim and Malik use the dataset's own sequential numbers; `inBook` gives the sunnah.com book and hadith.
 * `athar` marks a Companion's practice (mawquf), shown labelled as such. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slice, present, COLLECTIONS } from './build-adhkar.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATASET = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
const OUT = path.join(root, 'content/eid/eid.json');
let saved = [];
try { saved = JSON.parse(await readFile(OUT, 'utf8')).items; } catch { /* first build */ }
async function hadith(ref) {
    const [c, n] = ref.split(':');
    const kept = !process.env.REFETCH && saved.find(i => i.source.ref === ref);
    if (kept) return { text: kept.full, reference: kept.source.inBook, grades: kept.source.grades.map(g => ({ name: g.by, grade: g.grade })) };
    if (process.env.HADITH_FILES) return JSON.parse(await readFile(path.join(process.env.HADITH_FILES, `${c}-${n}.json`), 'utf8')).hadiths[0];
    const res = await fetch(`${DATASET}/ara-${c}/${n}.json`);
    if (!res.ok) throw new Error(`${ref}: HTTP ${res.status}`);
    return (await res.json()).hadiths[0];
}
export const ITEMS = [
    // The day of Eid.
    { id: 'our-eid', group: 'eid', ref: 'bukhari:952', start: 'يا ابا بكر ان لكل قوم', end: 'وهذا عيدنا' },
    { id: 'fitr-dates', group: 'fitr', ref: 'bukhari:953', start: 'كان رسول الله صلى الله عليه وسلم لا يغدو', end: 'ياكل تمرات' },
    { id: 'eat-adha', group: 'eid', ref: 'tirmidhi:542', start: 'كان النبي صلى الله عليه وسلم لا يخرج', end: 'حتى يصلي' },
    { id: 'other-route', group: 'eid', ref: 'bukhari:986', start: 'كان النبي صلى الله عليه وسلم اذا كان يوم عيد', end: 'خالف الطريق' },
    { id: 'ghusl', group: 'fitr', ref: 'malik:429', start: 'ان عبد الله بن عمر', end: 'الى المصلى', athar: true },
    // Greeting cards: the Prophet's words alone, without the address to Abu Bakr.
    { id: 'eid-greeting', group: 'card', ref: 'bukhari:952', start: 'ان لكل قوم عيدا', end: 'وهذا عيدنا' },
    // Zakat al-Fitr: the narrations only, no ruling on the amount.
    { id: 'zakat-fitr', group: 'zakat', ref: 'bukhari:1503', start: 'فرض رسول الله', end: 'خروج الناس الى الصلاة' },
    { id: 'zakat-purpose', group: 'zakat', ref: 'abudawud:1609', start: 'فرض رسول الله', end: 'صدقة من الصدقات' },
    // Fasts (for the optional reminders).
    { id: 'arafah', group: 'fast', ref: 'muslim:2746', start: 'صيام يوم عرفة', end: 'والسنة التي بعده' },
    { id: 'ashura', group: 'fast', ref: 'muslim:2746', start: 'صيام يوم عاشوراء', end: 'السنة التي قبله' },
    { id: 'tasua', group: 'fast', ref: 'muslim:2667', start: 'لئن بقيت', end: 'لاصومن التاسع' },
    { id: 'ten-days', group: 'fast', ref: 'tirmidhi:757', start: 'ما من ايام العمل الصالح', end: 'هذه الايام العشر' },
];
if (import.meta.url === `file://${process.argv[1]}`) {
    const out = { dataset: 'fawazahmed0/hadith-api@1', items: [] };
    for (const it of ITEMS) {
        const h = await hadith(it.ref), [c, n] = it.ref.split(':');
        out.items.push({ id: it.id, group: it.group, athar: !!it.athar, text: present(slice(h.text, it.start, it.end), it, it.id), source: { ref: it.ref, collection: COLLECTIONS[c], number: n, inBook: h.reference ?? null, grades: (h.grades ?? []).map(g => ({ by: g.name, grade: g.grade })) }, full: h.text });
    }
    await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
    for (const i of out.items) console.log(i.id.padEnd(14), i.text);
}
