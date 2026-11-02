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
export const COLLECTIONS = { bukhari: 'Sahih al-Bukhari', muslim: 'Sahih Muslim', abudawud: 'Sunan Abi Dawud', tirmidhi: "Jami' at-Tirmidhi", nasai: "Sunan an-Nasa'i", ibnmajah: 'Sunan Ibn Majah', malik: 'Muwatta Malik' };
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
/** Display orthography. Encoding only: no letter, word or vowel is added or removed. A dotless yā' that carries a vowel
 * mark is a yā' (شَىْءٌ → شَيْءٌ, عَلَىَّ → عَلَيَّ), and the marks this edition types after the alif of lām-alif belong on
 * the lām (لاَ → لَا, إِلاَّ → إِلَّا). */
export const orthography = (s) => s.replace(/ى(?=[\u064B-\u0652])/g, 'ي').replace(/لا([\u064B-\u0652]+)/g, 'ل$1ا');
/** A displayed text without its reading aids (display orthography applied; «،» pauses, ﴿ ﴾, ayah-end signs ۝ with their
 * number, the edition's «*» ayah separator and its «.» sentence stops removed). */
export const bare = (s) => orthography(s).replace(/ ?۝[٠-٩]+/g, '').replace(/[،﴿﴾*.\u200E\u200F]/g, '').replace(/\s+/g, ' ').trim();
const arabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
/** Whether `text` is the narration `src` as displayed: the same letters and marks in the same order. */
export const inSource = (src, text) => bare(src).includes(bare(text));
/** End index (after trailing marks) of plain-letter `marker` in `text`, searching the key from `from`. */
function markerEnd(text, marker, from, id) {
    const { key, map } = keyed(text), k = plainKey(marker), i = key.indexOf(k, from);
    if (i < 0) throw new Error(`${id}: marker not found: ${marker}`);
    let to = map[i + k.length - 1] + 1;
    while (to < text.length && DROP.test(text[to])) to++;
    return { start: map[i], to, next: i + k.length };
}
/** What the app shows: the verbatim slice with the display orthography, a «،» reading pause after each listed phrase
 * (found in order; pauses are reading aids, not part of the narration) and, where the narration quotes the Quran,
 * ornate brackets ﴿ ﴾ around the quotation (as Hisn al-Muslim prints it). The Quran quotation itself gets no pause.
 * Tests check that removing «،» and ﴿ ﴾ gives back the orthography of the source. */
export function present(text, { pauses = [], quote = null, quranRef = null, ayahEnds = [] } = {}, id = '') {
    // The edition ends a sentence of the narration with «‏.‏» (a period between direction marks): shown as a pause.
    let out = orthography(text).replace(/\s*[\u200E\u200F]*\.[\u200E\u200F]*\s+/g, '، '), from = 0;
    for (const p of pauses) {
        const m = markerEnd(out, p, from, id);
        if (m.to >= out.length || out[m.to] !== ' ') throw new Error(`${id}: a pause must fall between words: ${p}`);
        out = out.slice(0, m.to) + '،' + out.slice(m.to);
        from = m.next;
    }
    if (quote) {
        const a = markerEnd(out, quote[0], 0, id), b = markerEnd(out, quote[1], a.next - plainKey(quote[0]).length, id);
        if (out.slice(a.start, b.to).includes('،')) throw new Error(`${id}: no pause inside a Quran quotation`);
        // Inside the quotation one edition marks the end of an ayah with «*» (al-Bukhari's and Abu Dawud's), another not at
        // all (Muslim's: `ayahEnds` names the last word of each ayah but the last). Either way each ayah is shown ending
        // with the ayah-end sign ۝ and its number, as the reader shows them. Needs the quotation's reference.
        let q = out.slice(a.start, b.to);
        for (const w of [...ayahEnds].reverse()) { const e = markerEnd(q, w, 0, id).to; q = q.slice(0, e) + ' *' + q.slice(e); }
        if (quranRef) {
            const [, from, last] = /^\d+:(\d+)(?:-(\d+))?$/.exec(quranRef).map(Number), to = last || from, seps = q.split(' * ');
            if (seps.length !== to - from + 1) throw new Error(`${id}: ${quranRef} needs ${to - from} ayah separators`);
            q = seps.map((part, i) => `${part} ۝${arabicDigits(from + i)}`).join(' ');
        } else if (q.includes('*')) throw new Error(`${id}: a quotation with ayah separators needs quranRef`);
        out = out.slice(0, a.start) + '﴿' + q + '﴾' + out.slice(b.to);
    }
    return out;
}
async function hadith(ref, cache) {
    const [collection, number] = ref.split(':');
    if (process.env.HADITH_DIR) {
        cache[collection] ??= JSON.parse(await readFile(path.join(process.env.HADITH_DIR, `ara-${collection}.json`), 'utf8'));
        const h = cache[collection].hadiths.find(x => String(x.hadithnumber) === number);
        if (!h) throw new Error(`${ref} not in ${collection} edition`);
        return h;
    }
    if (!process.env.REFETCH && saved[ref]) return { text: saved[ref].text, reference: saved[ref].inBook, grades: saved[ref].grades };
    const res = await fetch(`${DATASET}/ara-${collection}/${number}.json`);
    if (!res.ok) throw new Error(`${ref}: HTTP ${res.status}`);
    return (await res.json()).hadiths[0];
}
let saved = {};
try { saved = JSON.parse(await readFile(path.join(root, 'content/adhkar/sources.json'), 'utf8')).hadiths; } catch { /* first build */ }
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
        else entry.text = present(slice(h.text, a.start, a.end), a, a.id);
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
    // Counters: each phrase is sliced from a cited hadith; the counts must be stated in `countSource` (checked by `evidence`).
    const counters = [];
    for (const c of spec.counters ?? []) {
        const h = await get(c.countSource);
        for (const ev of c.evidence) if (!plainKey(h.text).includes(plainKey(ev))) throw new Error(`${c.id}: evidence "${ev}" not in ${c.countSource}`);
        const steps = [];
        for (const s of c.steps) steps.push({ text: present(slice((await get(s.source)).text, s.start, s.end), s, c.id), count: s.count, source: source(s.source, await get(s.source)) });
        const also = [];
        for (const ref of c.also ?? []) also.push(source(ref, await get(ref)));
        counters.push({ id: c.id, title: c.title, steps, total: steps.reduce((n, s) => n + s.count, 0), evidence: c.evidence, source: source(c.countSource, h), also, ...(c.atLeast ? { atLeast: true } : {}), ...(c.perPrayer ? { perPrayer: true } : {}) });
    }
    // Library: counted adhkar with a target. Text is sliced verbatim from the cited hadith, except entries marked
    // `wording: 'common'`, whose wording is a widely used formula given in the spec and shown as such (the cited hadith is
    // then about the virtue, sliced as `virtue`). A `sunnah` target must be backed by `evidence` phrases in the source.
    const library = [];
    for (const l of spec.library ?? []) {
        const h = await get(l.source);
        for (const ev of l.evidence ?? []) if (!plainKey(h.text).includes(plainKey(ev))) throw new Error(`${l.id}: evidence "${ev}" not in ${l.source}`);
        if (l.targetKind === 'sunnah' && !l.evidence?.length) throw new Error(`${l.id}: a sunnah target needs evidence`);
        if (!!l.wording !== !!l.text || (l.wording && l.wording !== 'common')) throw new Error(`${l.id}: only 'common' wording may carry its own text`);
        const also = [];
        for (const ref of l.also ?? []) also.push(source(ref, await get(ref)));
        library.push({ id: l.id, category: l.category, title: l.title, about: l.about, text: l.text ?? present(slice(h.text, l.start, l.end), l, l.id), ...(l.wording ? { wording: l.wording } : {}), ...(l.virtue ? { virtue: orthography(slice(h.text, l.virtue.start, l.virtue.end)) } : {}), target: l.target, targetKind: l.targetKind, evidence: l.evidence ?? [], source: source(l.source, h), also, ...(l.quranRef ? { quranRef: l.quranRef } : {}) });
    }
    // Rotation: single phrases for interval reminders, each sliced verbatim from its cited hadith.
    const rotation = [];
    for (const r of spec.rotation ?? []) rotation.push({ id: r.id, text: present(slice((await get(r.source)).text, r.start, r.end), r, r.id), source: source(r.source, await get(r.source)) });
    await writeFile(path.join(root, 'content/adhkar/sources.json'), JSON.stringify({ dataset: spec.dataset, url: DATASET, hadiths: sources }, null, 1) + '\n');
    await writeFile(path.join(root, 'content/adhkar/adhkar.json'), JSON.stringify({ dataset: spec.dataset, reviewStatus: 'awaiting-scholar-review', adhkar, prayer, counters, rotation, library }, null, 1) + '\n');
    console.log(`Built ${adhkar.length} adhkar, ${prayer.length} prayer-surah entries and ${counters.length} counters from ${Object.keys(sources).length} cited hadiths.`);
    for (const a of adhkar) if (a.text) console.log(`${a.id.padEnd(18)} ${a.text}`);
    for (const r of rotation) console.log(`${r.id.padEnd(24)} ${r.text}`);
    for (const l of library) console.log(`${l.id.padEnd(24)} ${l.text}${l.virtue ? `  [virtue: ${l.virtue}]` : ''}`);
    for (const c of counters) for (const s of c.steps) console.log(`${c.id.padEnd(18)} ×${String(s.count).padEnd(4)} ${s.text}`);
}
