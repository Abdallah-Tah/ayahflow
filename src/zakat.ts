/** Zakat calculator: arithmetic only, on prices the user types (no network, nothing saved). The nisab is twenty dinars
 * of gold or five awaq (two hundred dirhams) of silver (the narrations are quoted on the screen); 85 g and 595 g are
 * the common modern conversions of those weights, not hadith text, and scholars differ on them and on which metal to
 * use. 2.5% is five in two hundred. The app gives no ruling: it does not decide whether zakat is due. */
export const GOLD_NISAB_G = 85, SILVER_NISAB_G = 595, RATE = 0.025;
export interface ZakatInput { wealth: number; goldPerGram: number | null; silverPerGram: number | null }
export interface ZakatLine { metal: 'gold' | 'silver'; nisab: number; reaches: boolean }
export interface ZakatResult { lines: ZakatLine[]; share: number | null }
const ok = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;
/** The nisab value for each metal whose price is given, whether the amount reaches it, and 2.5% of the amount. */
export function zakatFigures(i: ZakatInput): ZakatResult {
    const lines: ZakatLine[] = [];
    if (ok(i.goldPerGram)) lines.push({ metal: 'gold', nisab: round2(GOLD_NISAB_G * i.goldPerGram), reaches: ok(i.wealth) && i.wealth >= GOLD_NISAB_G * i.goldPerGram });
    if (ok(i.silverPerGram)) lines.push({ metal: 'silver', nisab: round2(SILVER_NISAB_G * i.silverPerGram), reaches: ok(i.wealth) && i.wealth >= SILVER_NISAB_G * i.silverPerGram });
    return { lines, share: ok(i.wealth) ? round2(i.wealth * RATE) : null };
}
const round2 = (n: number) => Math.round(n * 100) / 100;
/** A typed amount: digits with one decimal separator (dot or comma), Arabic-Indic digits accepted; anything else is null. */
export function parseAmount(s: string): number | null {
    const t = s.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\s  ']/g, '').replace(/٫/g, '.').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}
