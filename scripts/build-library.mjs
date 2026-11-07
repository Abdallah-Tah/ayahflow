/** Builds content/hadith/library.json: an-Nawawi's Forty and the Forty Hadith Qudsi, Arabic only, verbatim from the
 * public-domain fawazahmed0/hadith-api dataset (editions ara-nawawi and ara-qudsi). The dataset gives no grades and no
 * topics for these; the app shows the text with its number and a link to the same hadith on sunnah.com, labelled not
 * reviewed by a scholar. The dataset's English translations are not used: their origin cannot be traced.
 *   HADITH_FILES=/dir node scripts/build-library.mjs   (reads ara-nawawi.json and ara-qudsi.json saved from the dataset)
 *   node scripts/build-library.mjs                      (offline: re-checks content/hadith/library.json) */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'content/hadith/library.json');
const COLLECTIONS = [{ id: 'nawawi', edition: 'ara-nawawi', name: 'Forty Hadith of an-Nawawi', web: 'nawawi40' }, { id: 'qudsi', edition: 'ara-qudsi', name: 'Forty Hadith Qudsi', web: 'qudsi40' }];
if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.HADITH_FILES) { const d = JSON.parse(await readFile(OUT, 'utf8')); console.log('ok', d.collections.map(c => `${c.id} ${c.items.length}`).join(', ')); process.exit(0); }
    const out = { dataset: 'fawazahmed0/hadith-api@1', licence: 'Unlicense (public domain dedication)', reviewed: false, collections: [] };
    for (const c of COLLECTIONS) {
        const raw = await readFile(path.join(process.env.HADITH_FILES, `${c.edition}.json`));
        const d = JSON.parse(raw.toString('utf8'));
        out.collections.push({ id: c.id, name: c.name, edition: c.edition, sha256: createHash('sha256').update(raw).digest('hex'), url: `https://sunnah.com/${c.web}`,
            items: d.hadiths.map(h => ({ n: h.hadithnumber, text: h.text.trim(), grades: (h.grades ?? []).map(g => ({ by: g.name, grade: g.grade })) })) });
    }
    await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
    console.log(out.collections.map(c => `${c.id} ${c.items.length} ${c.sha256.slice(0, 12)}`).join(', '));
}
