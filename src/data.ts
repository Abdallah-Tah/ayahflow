/** Full Quran corpus: Tanzil Quran Text (Uthmani, Version 1.1), CC BY 3.0, https://tanzil.net.
 * Generated verbatim by scripts/import-quran.mjs from the pinned files in content/tanzil/ (never edited by hand).
 * Preserve the Arabic strings; ayah numbers and the basmala heading are metadata, not part of the ayah text.
 * Editorial cross-check != certification. See docs/CONTENT-PROVENANCE.md.
 * No generated distractor text or synthetic recitation is permitted.
 */
import QURAN from './quran-data.js';
import TRANSLATION from './translation-data.js';
export interface Surah {
    id: number;
    /** Tanzil transliteration, as published. */
    name: string;
    ar: string;
    /** Tanzil English meaning of the name. */
    en: string;
    type: 'meccan' | 'medinan';
    count: number;
    /** Juz in which the surah begins. */
    juz: number;
    firstGlobal: number;
    /** Tanzil's separate basmala heading, or null (Al-Fatihah, where it is ayah 1, and At-Tawbah). */
    bismillah: string | null;
    verses: readonly string[];
    source: string;
}
export const QURAN_SOURCE = { name: QURAN.source, licence: QURAN.licence, url: QURAN.url, sha256: QURAN.sha256 } as const;
/** First ayah of each juz, [surah, ayah]. */
export const JUZ_STARTS: readonly (readonly [number, number])[] = QURAN.juz;
/** First ayah of each ruku' (the traditional thematic sections in Tanzil's metadata), [surah, ayah]. */
export const RUKU_STARTS: readonly (readonly [number, number])[] = QURAN.ruku;
/** First ayah of each Madani Mushaf page, [surah, ayah] (Tanzil quran-data.xml: page boundaries only, not the printed line layout). */
export const PAGE_STARTS: readonly (readonly [number, number])[] = QURAN.pages;
export const PAGE_COUNT = PAGE_STARTS.length;
const before = (s: number, a: number, [ps, pa]: readonly [number, number]) => ps < s || (ps === s && pa <= a);
/** The page (1–604) an ayah is on. */
export function pageOf(surah: number, ayah: number): number { let lo = 0, hi = PAGE_STARTS.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (before(surah, ayah, PAGE_STARTS[mid]!)) lo = mid; else hi = mid - 1; } return lo + 1; }
/** Every ayah on a page in order, [surah, ayah]; a page can hold the end of one surah and the start of the next. */
export function pageAyahs(page: number): [number, number][] {
    if (!Number.isInteger(page) || page < 1 || page > PAGE_COUNT) throw new Error(`Unknown page ${page}`);
    const [s0, a0] = PAGE_STARTS[page - 1]!, next = PAGE_STARTS[page], out: [number, number][] = [];
    for (let s = s0, a = a0; s <= 114;) {
        if (next && s === next[0] && a === next[1]) break;
        out.push([s, a]);
        if (a < QURAN.surahs[s - 1]!.verses.length) a++; else { s++; a = 1; }
    }
    return out;
}
export function juzOf(surah: number, ayah: number): number { let j = 1; JUZ_STARTS.forEach(([s, a], i) => { if (s < surah || (s === surah && a <= ayah)) j = i + 1; }); return j; }
let global = 1;
export const SURAH_DATA: readonly Surah[] = QURAN.surahs.map(s => { const surah: Surah = { id: s.id, name: s.name, ar: s.ar, en: s.en, type: s.type, count: s.verses.length, juz: 0, firstGlobal: global, bismillah: s.bismillah, verses: s.verses, source: `https://tanzil.net/#${s.id}:1` }; global += s.verses.length; return surah; });
for (const s of SURAH_DATA as Surah[]) s.juz = juzOf(s.id, 1);
export const AYAH_TOTAL = global - 1;
export function chapter(id: number): Surah { const result = Number.isInteger(id) ? SURAH_DATA[id - 1] : undefined; if (!result)
    throw new Error('Unknown surah'); return result; }
export function verse(surah: number, ayah: number): string { const text = Number.isInteger(ayah) && ayah >= 1 ? chapter(surah).verses[ayah - 1] : undefined; if (!text)
    throw new Error('Ayah outside chapter'); return text; }
export function audioUrl(surah: number, ayah: number): string { verse(surah, ayah); return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${chapter(surah).firstGlobal + ayah - 1}.mp3`; }
export type RuleId = 'ikhfa' | 'ghunnah' | 'qalqalah' | 'madd';
export interface Lesson {
    id: RuleId;
    name: string;
    ar: string;
    surah: number;
    ayah: number;
    highlight: string;
    description: {
        en: string;
        fr: string;
        ar: string;
    };
    tip: {
        en: string;
        fr: string;
        ar: string;
    };
    question: {
        en: string;
        fr: string;
        ar: string;
    };
    choices: {
        en: string[];
        fr: string[];
        ar: string[];
    };
    answer: number;
    source: string;
    reviewStatus: 'editorial-draft';
}
export const LESSONS: readonly Lesson[] = [
    { id: 'ikhfa', name: 'Ikhfa', ar: 'الإخفاء', surah: 113, ayah: 2, highlight: 'مِن شَرِّ', description: { en: 'Here, noon saakinah is followed by sheen. Conceal the noon with nasal resonance while preparing for the next letter.', fr: 'Ici, le noun sans voyelle est suivi du chin. Dissimulez le noun avec une résonance nasale en préparant la lettre suivante.', ar: 'هنا جاءت الشين بعد النون الساكنة. تُخفى النون مع الغنة استعدادًا للحرف التالي.' }, tip: { en: 'Listen to the whole phrase. Practise at the reciter’s natural pace; do not use a slowed recording to measure counts.', fr: 'Écoutez toute la phrase. Pratiquez au rythme naturel ; ne mesurez pas les temps sur un enregistrement ralenti.', ar: 'استمع إلى العبارة كاملة وتمرّن بالسرعة الطبيعية. لا تقس زمن الغنة بالتسجيل البطيء.' }, question: { en: 'Which letter follows the noon here?', fr: 'Quelle lettre suit le noun ici ?', ar: 'ما الحرف الذي يلي النون هنا؟' }, choices: { en: ['Sheen (ش)', 'Baa (ب)', 'Meem (م)'], fr: ['Chin (ش)', 'Ba (ب)', 'Mim (م)'], ar: ['الشين', 'الباء', 'الميم'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' },
    { id: 'ghunnah', name: 'Ghunnah', ar: 'الغنة', surah: 114, ayah: 6, highlight: 'ٱلْجِنَّةِ', description: { en: 'The noon with shaddah carries a nasal sound. Listen for the ghunnah, conventionally taught as two counts at the recitation’s pace.', fr: 'Le noun avec chadda porte un son nasal. Écoutez la ghounna, enseignée sur deux temps au rythme de la récitation.', ar: 'النون المشددة فيها غنة تُعلَّم بمقدار حركتين بحسب سرعة القراءة.' }, tip: { en: 'Two counts are relative to the recitation, not two seconds. A qualified teacher can check your sound.', fr: 'Deux temps ne signifient pas deux secondes. Un enseignant qualifié peut vérifier votre son.', ar: 'الحركتان ليستا ثانيتين ثابتتين. اعرض صوتك على معلّم متقن.' }, question: { en: 'Which mark is on the noon?', fr: 'Quel signe porte le noun ?', ar: 'ما العلامة على النون؟' }, choices: { en: ['Shaddah', 'Sukoon', 'No mark'], fr: ['Chadda', 'Soukoun', 'Aucun signe'], ar: ['شدة', 'سكون', 'لا علامة'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' },
    { id: 'qalqalah', name: 'Qalqalah', ar: 'القلقلة', surah: 112, ayah: 1, highlight: 'أَحَدٌ', description: { en: 'When stopping at the end of this ayah, the daal becomes saakin. Give it a controlled release, without adding an extra vowel.', fr: 'À l’arrêt en fin de cette aya, le dal devient sans voyelle. Relâchez le son sans ajouter de voyelle.', ar: 'عند الوقف على نهاية الآية تسكن الدال. اقلقلها دون إضافة حركة.' }, tip: { en: 'This example is specifically for stopping. The instruction is not a general rule for continuing into the next ayah.', fr: 'Cet exemple concerne l’arrêt, et non la liaison avec l’aya suivante.', ar: 'هذا المثال خاص بالوقف، وليس حكمًا عامًا عند وصل الآية بما بعدها.' }, question: { en: 'In this example, when is the final daal saakin?', fr: 'Ici, quand le dal final devient-il sans voyelle ?', ar: 'متى تسكن الدال الأخيرة في هذا المثال؟' }, choices: { en: ['When stopping', 'Only when speeding up', 'Never'], fr: ['À l’arrêt', 'Seulement en accélérant', 'Jamais'], ar: ['عند الوقف', 'عند الإسراع فقط', 'أبدًا'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' },
    { id: 'madd', name: 'Natural Madd', ar: 'المد الطبيعي', surah: 113, ayah: 2, highlight: 'مَا', description: { en: 'The alif in this word lengthens the preceding fat-ha. This natural madd is taught as two counts at the recitation’s pace.', fr: 'L’alif allonge la fatha précédente. Ce madd naturel se lit sur deux temps au rythme de la récitation.', ar: 'الألف في هذه الكلمة تمد الفتحة قبلها. مقدار المد الطبيعي حركتان بحسب سرعة القراءة.' }, tip: { en: 'Not all madd rules have the same duration. This lesson covers natural madd only.', fr: 'Tous les types de madd n’ont pas la même durée. Cette leçon porte uniquement sur le madd naturel.', ar: 'ليست كل المدود بالمقدار نفسه. هذا الدرس للمد الطبيعي فقط.' }, question: { en: 'How many counts for this natural madd?', fr: 'Combien de temps pour ce madd naturel ?', ar: 'كم مقدار هذا المد الطبيعي؟' }, choices: { en: ['Two counts', 'Always six counts', 'No lengthening'], fr: ['Deux temps', 'Toujours six temps', 'Aucun allongement'], ar: ['حركتان', 'ست حركات دائمًا', 'لا مد'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' }
];
/** English translation of one ayah (Pickthall, 1930, via Tanzil.net), exactly as published. */
export const TRANSLATION_SOURCE = { id: TRANSLATION.id, name: TRANSLATION.name, translator: TRANSLATION.translator, source: TRANSLATION.source, url: TRANSLATION.url } as const;
export function translation(surah: number, ayah: number): string { verse(surah, ayah); return TRANSLATION.surahs[surah - 1]![ayah - 1]!; }
