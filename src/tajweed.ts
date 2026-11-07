/** Tajweed colouring for reading: machine-made rule spans (cpfair/quran-tajweed, CC BY 4.0) carried over to the app's
 * Tanzil text by scripts/build-tajweed.py. Colouring only: it never judges the user's recitation, and it has not been
 * reviewed by a qualified teacher. The text is never changed; colours are spans around its own characters. */
export const TAJWEED_RULES = ['hamzat_wasl', 'lam_shamsiyyah', 'silent', 'madd_2', 'madd_246', 'madd_6', 'madd_munfasil', 'madd_muttasil', 'ghunnah',
    'ikhfa', 'ikhfa_shafawi', 'idghaam_ghunnah', 'idghaam_no_ghunnah', 'idghaam_shafawi', 'idghaam_mutajanisayn', 'idghaam_mutaqaribayn', 'iqlab', 'qalqalah'] as const;
/** Colour groups for the legend: rules a reader is usually taught together share a colour. */
export const TAJWEED_GROUPS: Record<string, readonly number[]> = {
    silent: [0, 1, 2], madd: [3, 4, 5], maddLong: [6, 7], ghunnah: [8], ikhfa: [9, 10], idgham: [11, 12, 13, 14, 15], iqlab: [16], qalqalah: [17],
};
export const groupOf = (rule: number): string => Object.entries(TAJWEED_GROUPS).find(([, r]) => r.includes(rule))?.[0] ?? 'silent';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The ayah's words as HTML, each word coloured where a span covers it. Spans are [start, end, rule] over the ayah's
 * characters (UTF-16 code units, which are single code points for this text); removing the tags gives the words back. */
export function tajweedWords(text: string, spans: readonly (readonly [number, number, number])[]): string[] {
    const rule: (number | null)[] = Array.from({ length: text.length }, () => null);
    for (const [s, e, r] of spans) for (let i = Math.max(0, s); i < Math.min(e, text.length); i++) rule[i] = r;
    const out: string[] = [];
    let at = 0;
    for (const word of text.split(' ')) {
        let html = '', i = 0;
        while (i < word.length) {
            const r = rule[at + i]; let j = i + 1;
            while (j < word.length && rule[at + j] === r) j++;
            const part = esc(word.slice(i, j));
            html += r === null || r === undefined ? part : `<i class="tj tj-${groupOf(r)}">${part}</i>`;
            i = j;
        }
        if (word.length) out.push(html);
        at += word.length + 1;
    }
    return out;
}
