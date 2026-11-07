/** Eid greeting cards, drawn on the device from cited text only (Sahih al-Bukhari 952, or Quran 10:58 from the corpus)
 * and shared through the share sheet. Nothing is uploaded. The text is never changed: it is only broken into lines at
 * spaces, and the lines joined by spaces give it back. */
export type CardText = 'eid-greeting' | 'quran-10-58';
export type CardStyle = 'night' | 'paper';
export const CARD_TEXTS: readonly CardText[] = ['eid-greeting', 'quran-10-58'];
export const CARD_STYLES: readonly CardStyle[] = ['night', 'paper'];
export const CARD_W = 1080, CARD_H = 1350, NOTE_MAX = 60;
const PALETTE: Record<CardStyle, { bg: string; edge: string; gold: string; text: string; muted: string }> = {
    night: { bg: '#101411', edge: '#4d4a35', gold: '#d9bb79', text: '#efeadb', muted: '#9a9a88' },
    paper: { bg: '#f7f2e4', edge: '#bbaa81', gold: '#8a6a2a', text: '#2a2a22', muted: '#6d6a5c' },
};
/** Greedy line breaking at spaces by measured width; a word wider than the line stays whole on its own line. */
export function wrapWords(text: string, measure: (s: string) => number, max: number): string[] {
    const lines: string[] = [];
    for (const word of text.split(' ')) {
        const last = lines[lines.length - 1];
        if (last !== undefined && measure(`${last} ${word}`) <= max) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
    }
    return lines;
}
export interface CardContent { text: string; reference: string; heading: string; note: string; style: CardStyle; font: string }
/** Draws the card; resolves with a PNG blob. */
export async function drawCard(c: CardContent): Promise<Blob> {
    const canvas = document.createElement('canvas'); canvas.width = CARD_W; canvas.height = CARD_H;
    const g = canvas.getContext('2d')!, p = PALETTE[c.style];
    await document.fonts?.load(`64px ${c.font}`, c.text).catch(() => undefined);
    g.fillStyle = p.bg; g.fillRect(0, 0, CARD_W, CARD_H);
    g.strokeStyle = p.edge; g.lineWidth = 3; g.strokeRect(48, 48, CARD_W - 96, CARD_H - 96);
    g.strokeStyle = p.gold; g.lineWidth = 1.5; g.strokeRect(64, 64, CARD_W - 128, CARD_H - 128);
    g.textAlign = 'center'; g.fillStyle = p.gold; g.font = '500 40px Georgia, serif'; g.fillText(c.heading, CARD_W / 2, 190);
    g.direction = 'rtl'; g.fillStyle = p.text;
    let size = 84, lines: string[] = [];
    for (; size >= 48; size -= 4) { g.font = `${size}px ${c.font}`; lines = wrapWords(c.text, s => g.measureText(s).width, CARD_W - 240); if (lines.length * size * 1.9 <= 760) break; }
    const lh = size * 1.9, top = CARD_H / 2 - (lines.length * lh) / 2 + lh * 0.7;
    lines.forEach((l, i) => g.fillText(l, CARD_W / 2, top + i * lh));
    g.direction = 'ltr'; g.fillStyle = p.muted; g.font = '32px Georgia, serif'; g.fillText(c.reference, CARD_W / 2, CARD_H - 250);
    if (c.note) { g.fillStyle = p.gold; g.font = 'italic 36px Georgia, serif'; g.direction = 'inherit'; g.fillText(c.note.slice(0, NOTE_MAX), CARD_W / 2, CARD_H - 170); }
    g.fillStyle = p.muted; g.font = '24px Georgia, serif'; g.direction = 'ltr'; g.fillText('AyahFlow', CARD_W / 2, CARD_H - 100);
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Card could not be drawn')), 'image/png'));
}
