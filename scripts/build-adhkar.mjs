/** Builds content/adhkar/adhkar.json from content/adhkar/spec.json. Run deliberately when the spec changes:
 *   node scripts/build-adhkar.mjs            (fetches each cited hadith from the public-domain dataset)
 *   HADITH_DIR=/path node scripts/build-adhkar.mjs   (reads ara-<collection>.json full editions instead)
 * No supplication text is typed by hand: the spec gives a cited hadith plus short start/end markers, and the
 * text is sliced verbatim from that hadith. A marker that is not found fails the build. The cited hadiths are
 * saved to content/adhkar/sources.json so tests re-verify every entry offline. Quran entries are references only;
 * their text comes from the Tanzil corpus at runtime. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATASET = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
export const COLLECTIONS = { bukhari: 'Sahih al-Bukhari', muslim: 'Sahih Muslim', abudawud: 'Sunan Abi Dawud', tirmidhi: "Jami' at-Tirmidhi", nasai: "Sunan an-Nasa'i", ibnmajah: 'Sunan Ibn Majah' };
const DROP = /[ً-ٰٟۖ-ۭـ‎‏]/;
/** Comparison key with a map back to original indices (same normalisation as engine.comparable, letters only). */
export function keyed(text) {
    let key = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
        let c = text[i].normalize('NFC');
        if (DROP.test(c)) continue;
        if ('ٱأإآ'.includes(c)) c = 'ا';
        else if (c === 'ى') c = 'ي';
        else if (!/[ء-ي]/.test(c)) c = ' ';
        if (c === ' ' && (key === '' || key.endsWith(' '))) continue;
        key += c;
        map.push(i);
    }
    return { key, map };
}
export const plainKey = (s) => keyed(s).key.trim();
/** Verbatim slice of `text` from the start marker through the end marker (with the end word's trailing marks). */
export function slice(text, start, end) {
    const { key, map } = keyed(text);
    const s = key.indexOf(plainKey(start));
    if (s < 0) throw new Error(`start marker not found: ${start}`);
    const e = key.indexOf(plainKey(end), s);
    if (e < 0) throw new Error(`end marker not found after start: ${end}`);
    let to = map[e + plainKey(end).length - 1] + 1;
    while (to < text.length && DROP.test(text[to]) && !/[‎‏]/.test(text[to])) to++;
    return text.slice(map[s], to);
}
async function hadith(ref, cache) {
    const [collection, number] = ref.split(':');
    if (process.env.HADITH_DIR) {
        cache[collection] ??= JSON.parse(await readFile(path.join(process.env.HADITH_DIR, `ara-${collection}.json`), 'utf8'));
        const h = cache[collection].hadiths.find(x => String(x.hadithnumber) === number);
        if (!h) throw new Error(`${ref} not in ${collection} edition`);
        return h;
    }
    const res = await fetch(`${DATASET}/ara-${collection}/${number}.json`);
    if (!res.ok) throw new Error(`${ref}: HTTP ${res.status}`);
    return (await res.json()).hadiths[0];
}
const source = (ref, h) => ({ ref, collection: COLLECTIONS[ref.split(':')[0]], number: ref.split(':')[1], inBook: h.reference ?? null, grades: (h.grades ?? []).map(g => ({ by: g.name, grade: g.grade })) });
if (import.meta.url === `file://${process.argv[1]}`) {
    const spec = JSON.parse(await readFile(path.join(root, 'content/adhkar/spec.json'), 'utf8'));
    const cache = {}, sources = {};
    const get = async (ref) => { const h = await hadith(ref, cache); sources[ref] = { text: h.text, inBook: h.reference ?? null, grades: h.grades ?? [] }; return h; };
    const adhkar = [];
    for (const a of spec.adhkar) {
        const h = await get(a.source);
        const also = [];
        for (const ref of a.also ?? []) also.push(source(ref, await get(ref)));
        const entry = { id: a.id, moments: a.moments, kind: a.kind, repeat: a.repeat, title: a.title, source: source(a.source, h), also, ...(a.note ? { note: a.note } : {}), ...(a.quranRef ? { quranRef: a.quranRef } : {}) };
        if (a.kind === 'quran') entry.quran = Array.isArray(a.quran[0]) ? a.quran.map(([s, from, to]) => ({ surah: s, from: from ?? 1, to: to ?? null })) : [{ surah: a.quran[0], from: a.quran[1], to: a.quran[2] }];
        else entry.text = slice(h.text, a.start, a.end);
        adhkar.push(entry);
    }
    const prayer = [];
    for (const p of spec.prayer) {
        const h = await get(p.source);
        for (const ev of p.evidence) if (!plainKey(h.text).includes(plainKey(ev))) throw new Error(`${p.id}: evidence "${ev}" not in ${p.source}`);
        const also = [];
        for (const ref of p.also ?? []) also.push(source(ref, await get(ref)));
        prayer.push({ id: p.id, surahs: p.surahs, context: p.context, evidence: p.evidence, source: source(p.source, h), also });
    }
    await writeFile(path.join(root, 'content/adhkar/sources.json'), JSON.stringify({ dataset: spec.dataset, url: DATASET, hadiths: sources }, null, 1) + '\n');
    await writeFile(path.join(root, 'content/adhkar/adhkar.json'), JSON.stringify({ dataset: spec.dataset, reviewStatus: 'awaiting-scholar-review', adhkar, prayer }, null, 1) + '\n');
    console.log(`Built ${adhkar.length} adhkar and ${prayer.length} prayer-surah entries from ${Object.keys(sources).length} cited hadiths.`);
    for (const a of adhkar) if (a.text) console.log(`${a.id.padEnd(18)} ${a.text}`);
}
