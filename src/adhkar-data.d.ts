/** Type of www/js/adhkar-data.js, generated at build time from content/adhkar/adhkar.json (scripts/build-adhkar.mjs). */
export interface HadithSource { ref: string; collection: string; number: string; inBook: { book: number; hadith: number } | null; grades: { by: string; grade: string }[] }
export interface AdhkarEntry {
    id: string;
    moments: string[];
    kind: 'dua' | 'guidance' | 'quran';
    repeat: number;
    title: { en: string; fr: string; ar: string };
    /** Verbatim slice of the cited hadith (dua / guidance). */
    text?: string;
    /** Quran references; text is read from the Tanzil corpus. `to: null` means to the end of the surah. */
    quran?: { surah: number; from: number; to: number | null }[];
    source: HadithSource;
    also: HadithSource[];
    note?: 'muallaq';
    /** The dua quotes these Quran ayahs (shown as a reference; the wording is the narration's). */
    quranRef?: string;
}
export interface PrayerSet { id: string; surahs: number[]; context: { en: string; fr: string; ar: string }; evidence: string[]; source: HadithSource; also: HadithSource[] }
/** A counted dhikr. Each phrase is a verbatim slice of its own source; the counts are stated in `source` (`evidence`). */
export interface DhikrCounter { id: string; title: { en: string; fr: string; ar: string }; steps: { text: string; count: number; source: HadithSource }[]; total: number; evidence: string[]; source: HadithSource; also: HadithSource[]; atLeast?: true; perPrayer?: true }
declare const ADHKAR: { dataset: string; reviewStatus: 'awaiting-scholar-review'; adhkar: AdhkarEntry[]; prayer: PrayerSet[]; counters: DhikrCounter[] };
export default ADHKAR;
