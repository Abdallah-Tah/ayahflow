/** Type of www/js/quran-data.js, generated at build time by scripts/import-quran.mjs. */
declare const QURAN: {
    source: string;
    licence: string;
    url: string;
    sha256: string;
    notice: string;
    juz: [number, number][];
    /** First ayah of each of Tanzil's 556 ruku' sections, [surah, ayah]. */
    ruku: [number, number][];
    surahs: { id: number; ar: string; name: string; en: string; type: 'meccan' | 'medinan'; bismillah: string | null; verses: string[] }[];
};
export default QURAN;
