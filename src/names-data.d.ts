/** Type of www/js/names-data.js, generated at build time from content/names/names.json (scripts/build-names.mjs). */
export interface NamesSource { ref: string; collection: string; number: string; inBook: { book: number; hadith: number } | null; grades: { by: string; grade: string }[]; text: string }
declare const NAMES_DATA: { dataset: string; list: NamesSource; about: NamesSource; names: { n: number; ar: string }[] };
export default NAMES_DATA;
