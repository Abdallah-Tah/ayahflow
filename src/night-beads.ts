/** Night beads: a full-screen tasbih look. A strand of beads on a cord slides one bead per tap under a sky that can follow
 * the prayer times. Everything is drawn in code for AyahFlow; no image or artwork is bundled.
 *
 * This module only draws. It never changes a count: the position it shows always comes from the count the app gives it. */
import { NIGHT_DESIGNS, NIGHT_SHAPES, type NightDesign, type NightShape } from './engine.js';
import type { Times } from './prayer.js';

export type SkyName = 'fajr' | 'day' | 'sunset' | 'night';

/* ---- Pure rules (tested) ------------------------------------------------------------------------------- */

/** Latin spellings of the two istighfar phrases, a reading aid only. Matched against the exact source Arabic, so any other
 * text simply shows none. Awaiting review by someone qualified (docs/ARABIC-AUDIT.md). */
const PHONETICS: Readonly<Record<string, string>> = {
    'أَسْتَغْفِرُ اللَّهَ': 'Astaghfirullah',
    'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ': 'Astaghfirullah wa atubu ilayh'
};
export function phoneticFor(text: string): string | null { return PHONETICS[text] ?? null; }

/** Beads in one trip round the strand. A short target repeats until the strand is long enough that only one minaret can be
 * on screen at a time, so it never jumps from one side to the other. */
const MIN_CYCLE = 15;
export function cycleFor(total: number): number { const t = Math.max(1, Math.floor(total)); return t >= MIN_CYCLE ? t : t * Math.ceil(MIN_CYCLE / t); }
/** A short, lighter divider follows every full 33 beads with another full 33 still to come, so a strand of 100 has two, as on a real tasbih. */
export function markersFor(cycle: number): number[] { const out: number[] = []; for (let b = 33; b + 33 <= cycle; b += 33) out.push(b); return out; }
/** Beads from the middle of the strand to bead `at` of the cycle, whichever way round is shorter: positive means already past. */
export function nearest(position: number, at: number, cycle: number): number { return (((position - at + cycle / 2) % cycle) + cycle) % cycle - cycle / 2; }
/** Which sky Auto shows: from the prayer times for the saved place, or from the phone's clock when there is none. */
export function autoSkyAt(now: number, times: Times | null): SkyName {
    if (times && [times.fajr, times.sunrise, times.maghrib].every(Number.isFinite)) {
        if (now < times.fajr) return 'night';
        if (now < times.sunrise) return 'fajr';
        if (now < times.maghrib - 45 * 60000) return 'day';
        if (now < times.maghrib + 20 * 60000) return 'sunset';
        return 'night';
    }
    const h = new Date(now).getHours();
    return h >= 4 && h < 6 ? 'fajr' : h >= 6 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'sunset' : 'night';
}
/** The next or previous item of a list of choices, wrapping round. */
export function stepChoice<T>(list: readonly T[], current: T, by: number): T { const i = Math.max(0, list.indexOf(current)); return list[(i + by + list.length) % list.length]!; }

/* ---- Materials ------------------------------------------------------------------------------------------ */

const R = 33, RS = 3;
type Stop = readonly [string, number];
type Fx = 'amber' | 'cracks' | 'wisps' | 'cloud' | 'bubbles' | 'silk' | 'lustre' | 'matrix' | 'grain' | 'ebony';
type Metal = readonly [string, string, string, string];
interface Design { stops: readonly Stop[]; light: Stop; rim: string; fx: Fx; gloss: number; metal: keyof typeof METALS; tass: readonly [string, string, string] }
const METALS = {
    gold: ['#5e4215', '#f9e7ae', '#b98d3c', '#fff6d6'],
    silver: ['#545b60', '#f4f7f8', '#a3acb2', '#ffffff'],
    bronze: ['#452c14', '#dbb57c', '#8a6232', '#f2d7a8'],
    rose: ['#70423c', '#f9d9cf', '#be897b', '#fff0ea'],
    champagne: ['#6f6040', '#f6ecd0', '#c1ad7f', '#fffaea']
} as const satisfies Record<string, Metal>;
/** Each design has its own colours: bead (centre to edge, with opacity), light through it, inner marks, metal and tassel. */
const DESIGNS: Record<NightDesign, Design> = {
    amber: { stops: [['#ffbe55', 1], ['#e8861a', 1], ['#a84a0c', 1], ['#4a1c05', 1]], light: ['#ffd479', .92], rim: '#3f1a04', fx: 'amber', gloss: .8, metal: 'gold', tass: ['#8a6424', '#f2d68d', '#fff0c2'] },
    crystal: { stops: [['#ffffff', .42], ['#e6f0f4', .16], ['#c7d8df', .14], ['#92a9b3', .46]], light: ['#ffffff', .22], rim: '#5e7680', fx: 'cracks', gloss: 1, metal: 'silver', tass: ['#7f8a90', '#e9eef0', '#ffffff'] },
    smoky: { stops: [['#d9cfc2', .55], ['#8a7a68', .42], ['#54483b', .5], ['#2a231c', .8]], light: ['#e8d8c0', .2], rim: '#1c1712', fx: 'wisps', gloss: .9, metal: 'bronze', tass: ['#4f3f2c', '#b9a079', '#dcc8a3'] },
    rose: { stops: [['#ffe9ee', .75], ['#f4bccb', .48], ['#d88ea4', .46], ['#9c5a70', .7]], light: ['#fff0f3', .3], rim: '#7c4258', fx: 'cloud', gloss: .9, metal: 'rose', tass: ['#a4687c', '#f6cfd9', '#ffeef2'] },
    emerald: { stops: [['#c3f5d7', .7], ['#37ab74', .56], ['#146c49', .62], ['#07382a', .86]], light: ['#a8f5c9', .4], rim: '#04261c', fx: 'bubbles', gloss: 1, metal: 'gold', tass: ['#14503a', '#5cc592', '#b7f0d0'] },
    sapphire: { stops: [['#b6d0ff', 1], ['#3f6fc4', 1], ['#1c3d86', 1], ['#0a1b46', 1]], light: ['#7ea8ff', .55], rim: '#050e2b', fx: 'silk', gloss: 1, metal: 'silver', tass: ['#162c5e', '#6c93dd', '#b5cdf7'] },
    pearl: { stops: [['#fffef8', 1], ['#f1eadc', 1], ['#d4cab6', 1], ['#958b79', 1]], light: ['#ffffff', .25], rim: '#6f6656', fx: 'lustre', gloss: .75, metal: 'champagne', tass: ['#a89a78', '#f5ecd2', '#fffbe9'] },
    turquoise: { stops: [['#c0f3ea', 1], ['#4cbcae', 1], ['#23887f', 1], ['#0d4844', 1]], light: ['#b7f5ea', .25], rim: '#07302d', fx: 'matrix', gloss: .55, metal: 'silver', tass: ['#14605a', '#6fd6c8', '#c5f4ec'] },
    olive: { stops: [['#dcbf94', 1], ['#a97e4e', 1], ['#70492a', 1], ['#35200d', 1]], light: ['#f0d4a4', .12], rim: '#23140a', fx: 'grain', gloss: .4, metal: 'bronze', tass: ['#54391f', '#c29c66', '#e6cb9c'] },
    ebony: { stops: [['#716a63', 1], ['#35302d', 1], ['#1a1816', 1], ['#050404', 1]], light: ['#a39a8e', .07], rim: '#000000', fx: 'ebony', gloss: .7, metal: 'silver', tass: ['#141312', '#5a5550', '#9b948c'] }
};
/** Local x runs along the cord; step is the distance between beads, so each shape sits tight against its collars. */
interface Shape { sx: number; sy: number; step: number; path: 'circle' | 'barrel' | 'facets'; ridges?: boolean }
const SHAPES: Record<NightShape, Shape> = {
    round: { sx: 1, sy: 1, step: 80, path: 'circle' },
    olive: { sx: 1, sy: .74, step: 80, path: 'circle' },
    barrel: { sx: 1, sy: .76, step: 80, path: 'barrel' },
    disc: { sx: .58, sy: 1, step: 54, path: 'circle' },
    faceted: { sx: 1, sy: 1, step: 80, path: 'facets' },
    ridged: { sx: 1, sy: .92, step: 80, path: 'circle', ridges: true }
};
if (Object.keys(DESIGNS).length !== NIGHT_DESIGNS.length || Object.keys(SHAPES).length !== NIGHT_SHAPES.length) throw new Error('Night beads: a choice has no drawing');

/* ---- Sprites ---------------------------------------------------------------------------------------------- */

type G = CanvasRenderingContext2D;
interface Sprite { c: HTMLCanvasElement; g: G; w: number; h: number }
const mk = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
function sprite(w: number, h: number): Sprite { const c = document.createElement('canvas'); c.width = w * RS; c.height = h * RS; const g = c.getContext('2d')!; g.scale(RS, RS); return { c, g, w, h }; }
function rgba(hex: string, a: number): string { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
/** Rounded rectangle path; canvas roundRect itself needs iOS 16, and the app supports 15. */
function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
    const q = Math.min(r, w / 2, h / 2);
    g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q); g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
}
function marks(g: G, fx: Fx, rnd: () => number): void {
    if (fx === 'amber') {
        for (let i = 0; i < 4; i++) { // trapped twigs
            let x = (rnd() - .5) * R * 1.3, y = (rnd() - .5) * R * 1.3, ang = rnd() * 6.28;
            g.strokeStyle = `rgba(70,28,6,${.14 + rnd() * .2})`; g.lineWidth = .3 + rnd() * .4; g.lineCap = 'round';
            for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(x, y); const l = 3 + rnd() * 9; ang += (rnd() - .5) * 1.6; x += Math.cos(ang) * l; y += Math.sin(ang) * l; g.lineTo(x, y); g.stroke(); }
        }
        for (let i = 0; i < 95; i++) { // specks
            const a = rnd() * 6.28, d = Math.pow(rnd(), .7) * R * .92, s = .2 + rnd() * rnd() * .75;
            g.fillStyle = rnd() < .7 ? `rgba(62,24,4,${.25 + rnd() * .5})` : `rgba(255,232,170,${.3 + rnd() * .5})`;
            g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, s, 0, 7); g.fill();
        }
    } else if (fx === 'cracks') {
        for (let i = 0; i < 6; i++) {
            const x = (rnd() - .5) * R, y = (rnd() - .5) * R;
            g.strokeStyle = `rgba(255,255,255,${.18 + rnd() * .3})`; g.lineWidth = .35 + rnd() * .5;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - .5) * 18, y + (rnd() - .5) * 18, x + (rnd() - .5) * 26, y + (rnd() - .5) * 26); g.stroke();
        }
    } else if (fx === 'wisps') {
        for (let i = 0; i < 9; i++) {
            g.strokeStyle = `rgba(28,22,16,${.1 + rnd() * .16})`; g.lineWidth = 2 + rnd() * 5; g.lineCap = 'round';
            const x = -R + rnd() * R, y = (rnd() - .5) * R * 1.6;
            g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 16, y - 12 + rnd() * 24, x + 30, y - 12 + rnd() * 24, x + 44, y - 8 + rnd() * 16); g.stroke();
        }
    } else if (fx === 'cloud') {
        for (let i = 0; i < 12; i++) {
            const x = (rnd() - .5) * R * 1.5, y = (rnd() - .5) * R * 1.5, r = 6 + rnd() * 13, c = g.createRadialGradient(x, y, 0, x, y, r);
            c.addColorStop(0, 'rgba(255,255,255,.16)'); c.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
    } else if (fx === 'bubbles') {
        for (let i = 0; i < 20; i++) {
            const br = .5 + rnd() * rnd() * 2.2, x = (rnd() - .5) * R * 1.6, y = (rnd() - .5) * R * 1.6;
            g.strokeStyle = `rgba(210,255,230,${.25 + rnd() * .4})`; g.lineWidth = .4;
            g.beginPath(); g.arc(x, y, br, 0, 7); g.stroke();
        }
    } else if (fx === 'silk') {
        for (let i = 0; i < 3; i++) {
            g.save(); g.rotate(i * 2.094); g.strokeStyle = 'rgba(190,215,255,.03)'; g.lineWidth = .5;
            for (let j = -R; j < R; j += 2.4) { g.beginPath(); g.moveTo(j, -R); g.lineTo(j, R); g.stroke(); }
            g.restore();
        }
    } else if (fx === 'lustre') {
        const b = g.createLinearGradient(-R, -R, R, R);
        b.addColorStop(.2, 'rgba(255,190,205,.14)'); b.addColorStop(.5, 'rgba(190,225,255,.14)'); b.addColorStop(.8, 'rgba(255,235,190,.16)');
        g.fillStyle = b; g.fillRect(-R, -R, R * 2, R * 2);
    } else if (fx === 'matrix') {
        for (let i = 0; i < 8; i++) {
            let x = (rnd() - .5) * R * 1.8, y = (rnd() - .5) * R * 1.8, a = rnd() * 6.28;
            g.strokeStyle = `rgba(66,44,24,${.25 + rnd() * .35})`; g.lineWidth = .4 + rnd() * .6; g.beginPath(); g.moveTo(x, y);
            for (let j = 0; j < 6; j++) { a += (rnd() - .5) * 1.5; x += Math.cos(a) * 5; y += Math.sin(a) * 5; g.lineTo(x, y); }
            g.stroke();
        }
    } else if (fx === 'grain') {
        const ox = (rnd() - .5) * 12, oy = -R * 1.4 + rnd() * 10;
        for (let i = 0; i < 20; i++) {
            g.strokeStyle = `rgba(46,26,10,${.08 + rnd() * .2})`; g.lineWidth = .4 + rnd() * .9;
            g.beginPath(); g.ellipse(ox, oy, 14 + i * 5.5, 8 + i * 4.2, .1, 0, 7); g.stroke();
        }
    } else {
        for (let i = -R; i < R; i += 1.7) { g.strokeStyle = `rgba(160,150,140,${.03 + rnd() * .07})`; g.lineWidth = .4; g.beginPath(); g.moveTo(-R, i); g.bezierCurveTo(-8, i + 3, 8, i - 3, R, i + rnd() * 2); g.stroke(); }
    }
}
function outline(g: G, kind: Shape['path']): void {
    g.beginPath();
    if (kind === 'barrel') rr(g, -R, -R, R * 2, R * 2, R * .5);
    else if (kind === 'facets') { for (let n = 0; n < 12; n++) { const t = (n + .5) / 12 * 6.2832; if (n) g.lineTo(Math.cos(t) * R, Math.sin(t) * R); else g.moveTo(Math.cos(t) * R, Math.sin(t) * R); } g.closePath(); }
    else g.arc(0, 0, R, 0, 7);
}
function makeBead(D: Design, SH: Shape, seed: number): Sprite {
    const P = 12, S = sprite((R + P) * 2, (R + P) * 2), g = S.g, rnd = mk(seed), solid = D.stops[1]![1] === 1, ext = R * 1.42;
    g.translate(R + P, R + P);
    g.save(); g.shadowColor = `rgba(0,0,0,${solid ? .5 : .22})`; g.shadowBlur = 11; g.shadowOffsetY = 6;
    g.fillStyle = rgba(D.stops[2]![0], solid ? 1 : .4); g.save(); g.scale(SH.sx, SH.sy); outline(g, SH.path); g.restore(); g.fill(); g.restore();
    g.save(); g.scale(SH.sx, SH.sy); outline(g, SH.path); g.clip();
    g.clearRect(-ext, -ext, ext * 2, ext * 2);
    const body = g.createRadialGradient(-R * .3, -R * .35, 0, 0, 0, R * 1.16);
    [0, .32, .68, 1].forEach((o, n) => body.addColorStop(o, rgba(D.stops[n]![0], D.stops[n]![1])));
    g.fillStyle = body; g.fillRect(-ext, -ext, ext * 2, ext * 2);
    // Light passing through and pooling opposite the highlight
    const pool = g.createRadialGradient(R * .3, R * .42, 0, R * .3, R * .42, R * .9);
    pool.addColorStop(0, rgba(D.light[0], D.light[1])); pool.addColorStop(1, rgba(D.light[0], 0));
    g.fillStyle = pool; g.fillRect(-ext, -ext, ext * 2, ext * 2);
    marks(g, D.fx, rnd);
    if (SH.path === 'facets') { // cut faces, each catching the light differently
        const ring = (rad: number, off: number, n: number) => Array.from({ length: n }, (_, k) => { const t = (k + off) / n * 6.2832; return [Math.cos(t) * rad, Math.sin(t) * rad] as const; });
        const outer = ring(R, .5, 12), inner = ring(R * .62, 0, 12), table = ring(R * .34, .5, 6);
        for (let i = 0; i < 12; i++) {
            const a0 = outer[i]!, a1 = outer[(i + 1) % 12]!, b0 = inner[(i + 1) % 12]!, b1 = inner[(i + 2) % 12]!, lit = rnd() > .5;
            g.fillStyle = lit ? `rgba(255,255,255,${.05 + rnd() * .16})` : rgba(D.rim, .08 + rnd() * .22);
            g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(b1[0], b1[1]); g.lineTo(b0[0], b0[1]); g.closePath(); g.fill();
            g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = .5; g.stroke();
        }
        for (let i = 0; i < 6; i++) {
            const i0 = inner[i * 2]!, t0 = table[i]!, t1 = table[(i + 1) % 6]!, i1 = inner[(i * 2 + 2) % 12]!;
            g.fillStyle = rnd() > .5 ? `rgba(255,255,255,${.06 + rnd() * .14})` : rgba(D.rim, .06 + rnd() * .14);
            g.beginPath(); g.moveTo(i0[0], i0[1]); g.lineTo(i1[0], i1[1]); g.lineTo(t1[0], t1[1]); g.lineTo(t0[0], t0[1]); g.closePath(); g.fill();
            g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = .4; g.stroke();
        }
    }
    if (SH.ridges) { // lobes running from one end of the bead to the other
        for (let i = -3; i <= 3; i++) {
            const ry = Math.abs(i) / 3.4 * R, up = i < 0;
            g.strokeStyle = rgba(D.rim, .42); g.lineWidth = 1.1;
            g.beginPath(); if (i === 0) { g.moveTo(-R, 0); g.lineTo(R, 0); } else g.ellipse(0, 0, R, ry, 0, up ? 3.1416 : 0, up ? 6.2832 : 3.1416); g.stroke();
            g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = .8;
            g.beginPath(); g.ellipse(0, 0, R, Math.max(.5, ry - 2.2), 0, up ? 3.1416 : 0, up ? 6.2832 : 3.1416); g.stroke();
        }
    }
    // Darker edge, as a rounded form has
    const rim = g.createRadialGradient(0, 0, R * .68, 0, 0, SH.path === 'barrel' ? ext : R);
    rim.addColorStop(0, rgba(D.rim, 0)); rim.addColorStop(1, rgba(D.rim, solid ? .72 : .62));
    g.fillStyle = rim; g.fillRect(-ext, -ext, ext * 2, ext * 2);
    // Bright crescent where light leaves the lower edge
    g.strokeStyle = rgba(D.stops[0]![0], .5 * D.gloss); g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, R - 2.4, .35, 1.25); g.stroke();
    g.restore();
    // Reflected window, high on the bead
    g.save(); g.scale(SH.sx, SH.sy); g.translate(-R * .36, -R * .46); g.rotate(-.62);
    const sp = g.createLinearGradient(0, -R * .2, 0, R * .2);
    sp.addColorStop(0, `rgba(255,255,255,${.85 * D.gloss})`); sp.addColorStop(1, `rgba(255,255,255,${.08 * D.gloss})`);
    g.fillStyle = sp; g.beginPath(); g.ellipse(0, 0, R * .32, R * .17, 0, 0, 7); g.fill(); g.restore();
    return S;
}
function metalAcross(g: G, M: Metal, x0: number, x1: number): CanvasGradient {
    const m = g.createLinearGradient(x0, 0, x1, 0);
    m.addColorStop(0, M[0]); m.addColorStop(.28, M[1]); m.addColorStop(.46, M[3]); m.addColorStop(.62, M[2]); m.addColorStop(.86, M[1]); m.addColorStop(1, M[0]);
    return m;
}
function makeCollar(D: Design): Sprite { // the metal barrel seated tight between beads: local x runs along the cord
    const M = METALS[D.metal], S = sprite(20, 40), g = S.g;
    g.translate(10, 20);
    const m = g.createLinearGradient(0, -17, 0, 17);
    m.addColorStop(0, M[0]); m.addColorStop(.22, M[1]); m.addColorStop(.38, M[3]); m.addColorStop(.58, M[2]); m.addColorStop(.82, M[1]); m.addColorStop(1, M[0]);
    g.fillStyle = m;
    for (const r of [[-7, 2.6, 16], [-4.2, 2.1, 13.5], [-1.8, 3.6, 14.5], [2.1, 2.1, 13.5], [4.4, 2.6, 16]] as const) { g.beginPath(); rr(g, r[0], -r[2], r[1], r[2] * 2, 1); g.fill(); }
    g.fillStyle = rgba(M[3], .9);
    for (let y = -11; y <= 11; y += 3.7) { g.beginPath(); g.arc(0, y, .8, 0, 7); g.fill(); }
    return S;
}
function mix(hex: string, to: string, t: number): string {
    const a = parseInt(hex.slice(1), 16), c = parseInt(to.slice(1), 16);
    return '#' + [16, 8, 0].map(sh => { const x = (a >> sh) & 255, y = (c >> sh) & 255, v = Math.round(x + (y - x) * t); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
}
/** A lighter shade of a design's material, for the divider and the bead beside it. */
function lighter(D: Design): Design {
    return { ...D, stops: D.stops.map((st, n) => [mix(st[0], D.stops[0]![0], n === 3 ? .42 : .58), Math.min(1, st[1] + (st[1] < 1 ? .12 : 0))] as const) };
}
function makeMarker(D: Design): Sprite { // the divider after every 33 beads: a short barrel bead crossing the cord
    const S = sprite(44, 90), g = S.g, L = lighter(D), rnd = mk(911), W = 13, H = 33, solid = D.stops[1]![1] === 1, a = solid ? 1 : .86;
    g.translate(22, 45);
    const pill = () => { g.beginPath(); rr(g, -W, -H, W * 2, H * 2, W * .95); };
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 8; g.shadowOffsetX = 2; g.shadowOffsetY = 4;
    g.fillStyle = rgba(L.stops[1]![0], a); pill(); g.fill(); g.restore();
    g.save(); pill(); g.clip();
    const body = g.createLinearGradient(-W, 0, W, 0);
    body.addColorStop(0, rgba(D.stops[2]![0], a)); body.addColorStop(.3, rgba(L.stops[0]![0], a)); body.addColorStop(.55, rgba(L.stops[1]![0], a)); body.addColorStop(1, rgba(D.stops[3]![0], a));
    g.fillStyle = body; g.fillRect(-W, -H, W * 2, H * 2);
    if (D.fx === 'grain' || D.fx === 'ebony' || D.fx === 'amber') {
        for (let i = 0; i < 16; i++) { const x = -W + rnd() * W * 2; g.strokeStyle = rgba(D.rim, .1 + rnd() * .16); g.lineWidth = .35 + rnd() * .5; g.beginPath(); g.moveTo(x, -H); g.bezierCurveTo(x + rnd() * 2, -10, x - rnd() * 2, 10, x + (rnd() - .5) * 2, H); g.stroke(); }
    }
    const ends = g.createLinearGradient(0, -H, 0, H);
    ends.addColorStop(0, rgba(D.rim, .55)); ends.addColorStop(.16, rgba(D.rim, 0)); ends.addColorStop(.84, rgba(D.rim, 0)); ends.addColorStop(1, rgba(D.rim, .62));
    g.fillStyle = ends; g.fillRect(-W, -H, W * 2, H * 2);
    g.fillStyle = `rgba(255,255,255,${.55 * D.gloss})`; g.beginPath(); rr(g, -W * .52, -H * .68, W * .3, H * .9, W * .15); g.fill();
    g.restore();
    return S;
}
function makeImam(D: Design, seed: number): Sprite { // a minaret hanging from the cord: origin is where it meets the cord
    const W = 96, H = 230, S = sprite(W, H), g = S.g, M = METALS[D.metal], rnd = mk(seed), solid = D.stops[1]![1] === 1;
    g.translate(W / 2, 26);
    g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    // Minaret, top to bottom: crescent, spire, upper balcony, slim shaft, lower balcony, tall shaft.
    const metalBand = (y: number, h: number, hw: number) => { g.fillStyle = metalAcross(g, M, -hw, hw); g.beginPath(); rr(g, -hw, y, hw * 2, h, Math.min(h / 2, 2)); g.fill(); };
    const corbel = (y0: number, y1: number, w0: number, w1: number) => { g.fillStyle = metalAcross(g, M, -w0, w0); g.beginPath(); g.moveTo(-w0, y0); g.quadraticCurveTo(-w1 - 1, y0 + (y1 - y0) * .6, -w1, y1); g.lineTo(w1, y1); g.quadraticCurveTo(w1 + 1, y0 + (y1 - y0) * .6, w0, y0); g.fill(); };
    const railing = (y: number, hw: number) => { g.fillStyle = rgba(M[0], .85); for (let rx = -hw + 2; rx <= hw - 2; rx += 3.1) g.fillRect(rx - .45, y, .9, 3.2); metalBand(y - 1, 1.5, hw); };
    const col = (n: number, a: number) => rgba(D.stops[n]![0], solid ? a : D.stops[n]![1] * a);
    const shaft = (y0: number, y1: number, w0: number, w1: number, arches: readonly (readonly [number, number, number, number])[]) => {
        g.save(); g.beginPath(); g.moveTo(-w0, y0); g.lineTo(w0, y0); g.lineTo(w1, y1); g.lineTo(-w1, y1); g.closePath(); g.clip();
        const X = Math.max(w0, w1) + 1, cuts = [-1, -.6, -.2, .22, .6, 1], tones = [3, 2, 0, 1, 2];
        tones.forEach((t, n) => {
            const v = g.createLinearGradient(0, y0, 0, y1);
            v.addColorStop(0, col(t, 1)); v.addColorStop(1, col(Math.min(t + 1, 3), 1));
            g.fillStyle = v; g.fillRect(cuts[n]! * X, y0, (cuts[n + 1]! - cuts[n]!) * X + .4, y1 - y0);
        });
        g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = .6;
        for (const c of cuts.slice(1, -1)) { g.beginPath(); g.moveTo(c * w0, y0); g.lineTo(c * w1, y1); g.stroke(); }
        const pl = g.createRadialGradient(3, (y0 + y1) / 2, 0, 3, (y0 + y1) / 2, (y1 - y0) * .7);
        pl.addColorStop(0, rgba(D.light[0], Math.min(1, D.light[1] + .1))); pl.addColorStop(1, rgba(D.light[0], 0));
        g.fillStyle = pl; g.fillRect(-X, y0, X * 2, y1 - y0);
        g.save(); g.translate(0, (y0 + y1) / 2); g.scale(.36, .6); marks(g, D.fx, rnd); g.restore();
        const sd = g.createLinearGradient(-X, 0, X, 0);
        sd.addColorStop(0, rgba(D.rim, .68)); sd.addColorStop(.26, rgba(D.rim, 0)); sd.addColorStop(.74, rgba(D.rim, 0)); sd.addColorStop(1, rgba(D.rim, .72));
        g.fillStyle = sd; g.fillRect(-X, y0, X * 2, y1 - y0);
        for (const [ax, ay, aw, ah] of arches) { // arched windows, lit from inside
            const arch = (grow: number) => { g.beginPath(); g.moveTo(ax - aw - grow, ay + ah + grow); g.lineTo(ax - aw - grow, ay + aw); g.quadraticCurveTo(ax - aw - grow, ay - grow, ax, ay - aw * .6 - grow); g.quadraticCurveTo(ax + aw + grow, ay - grow, ax + aw + grow, ay + aw); g.lineTo(ax + aw + grow, ay + ah + grow); g.closePath(); };
            arch(.7); g.fillStyle = M[2]; g.fill();
            arch(0); const wl = g.createLinearGradient(0, ay, 0, ay + ah); wl.addColorStop(0, '#fff3c9'); wl.addColorStop(1, '#f2b655'); g.fillStyle = wl; g.fill();
        }
        g.fillStyle = `rgba(255,255,255,${.5 * D.gloss})`;
        g.beginPath(); g.moveTo(-w0 * .62, y0 + 1); g.lineTo(-w0 * .34, y0 + 1); g.lineTo(-w1 * .34, y1 - 2); g.lineTo(-w1 * .62, y1 - 2); g.fill();
        g.restore();
    };
    // Crescent and rod, above the cord
    g.fillStyle = metalAcross(g, M, -2, 2); g.fillRect(-.9, -7, 1.8, 13);
    const ballTop = g.createRadialGradient(-.7, -7.5, .1, 0, -7, 2.6); ballTop.addColorStop(0, M[3]); ballTop.addColorStop(1, M[0]);
    g.fillStyle = ballTop; g.beginPath(); g.arc(0, -7, 2.4, 0, 7); g.fill();
    const cres = document.createElement('canvas'); cres.width = cres.height = 20 * RS;
    const cg = cres.getContext('2d')!; cg.scale(RS, RS);
    cg.fillStyle = M[1]; cg.beginPath(); cg.arc(10, 10, 6.4, 0, 7); cg.fill();
    cg.globalCompositeOperation = 'destination-out'; cg.beginPath(); cg.arc(10, 7.2, 5.2, 0, 7); cg.fill();
    g.drawImage(cres, -10, -24, 20, 20);
    // Spire
    g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
    g.fillStyle = metalAcross(g, M, -10, 10);
    g.beginPath(); g.moveTo(0, 2); g.bezierCurveTo(1.6, 10, 7, 16, 10, 24); g.lineTo(-10, 24); g.bezierCurveTo(-7, 16, -1.6, 10, 0, 2); g.fill(); g.restore();
    g.strokeStyle = rgba(M[0], .55); g.lineWidth = .6;
    for (const c of [-.5, 0, .5]) { g.beginPath(); g.moveTo(0, 5); g.quadraticCurveTo(c * 4, 15, c * 10, 24); g.stroke(); }
    // Upper balcony
    metalBand(23.5, 2.2, 11);
    railing(26, 14); metalBand(29, 2.4, 15); corbel(31.4, 35.5, 14, 8.6);
    shaft(35.5, 51, 8.6, 9.4, [[0, 39.5, 2, 8]]);
    // Lower balcony
    railing(51.5, 14.5); metalBand(54.5, 2.4, 16); corbel(56.9, 61, 15, 10);
    shaft(61, 92, 10, 12.5, [[0, 66, 2.4, 11], [-6.6, 72, 1.3, 7], [6.6, 72, 1.3, 7]]);
    metalBand(91.5, 3, 15);
    // Metal neck, ball and cup
    g.fillStyle = metalAcross(g, M, -15, 15); g.beginPath(); rr(g, -14, 94, 28, 5, 2.5); g.fill();
    g.fillStyle = metalAcross(g, M, -11, 11); g.beginPath(); g.moveTo(-11, 99); g.quadraticCurveTo(-5, 104, -3.8, 111); g.lineTo(3.8, 111); g.quadraticCurveTo(5, 104, 11, 99); g.fill();
    const ball = g.createRadialGradient(-2.4, 113.5, .5, 0, 116, 7.2);
    ball.addColorStop(0, M[3]); ball.addColorStop(.45, M[1]); ball.addColorStop(1, M[0]);
    g.fillStyle = ball; g.beginPath(); g.arc(0, 116, 6.8, 0, 7); g.fill();
    g.fillStyle = metalAcross(g, M, -12, 12); g.beginPath(); g.moveTo(-3.6, 121); g.quadraticCurveTo(-5, 127, -11, 133); g.lineTo(11, 133); g.quadraticCurveTo(5, 127, 3.6, 121); g.fill();
    g.fillStyle = metalAcross(g, M, -13, 13); g.beginPath(); rr(g, -12.5, 132, 25, 4, 2); g.fill();
    // Tassel: hundreds of single threads, fanning out from the binding
    const T = D.tass, base = g.createLinearGradient(-30, 0, 30, 0);
    base.addColorStop(0, T[0]); base.addColorStop(.5, T[1]); base.addColorStop(1, T[0]);
    g.fillStyle = base; g.beginPath(); g.moveTo(-11, 136); g.bezierCurveTo(-13, 158, -24, 176, -30, 198); g.lineTo(30, 198); g.bezierCurveTo(24, 176, 13, 158, 11, 136); g.fill();
    g.shadowColor = 'transparent'; // a blurred shadow on each of 300 threads costs far more than it shows
    for (let i = 0; i < 300; i++) {
        const u = rnd() * 2 - 1, x0 = u * 11, x1 = u * 31 + (rnd() - .5) * 2.4, end = 192 + rnd() * 10, tone = rnd();
        g.strokeStyle = tone < .45 ? T[0] : tone < .85 ? T[1] : T[2];
        g.globalAlpha = .4 + rnd() * .6; g.lineWidth = .35 + rnd() * .45;
        g.beginPath(); g.moveTo(x0, 137); g.bezierCurveTo(x0 * 1.1, 158, x1 * .74, 174, x1, end); g.stroke();
    }
    g.globalAlpha = 1;
    const edge = g.createLinearGradient(-30, 0, 30, 0);
    edge.addColorStop(0, 'rgba(0,0,0,.4)'); edge.addColorStop(.28, 'rgba(0,0,0,0)'); edge.addColorStop(.7, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.45)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = edge; g.fillRect(-32, 136, 64, 68);
    const under = g.createLinearGradient(0, 136, 0, 150); under.addColorStop(0, 'rgba(0,0,0,.45)'); under.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = under; g.fillRect(-32, 136, 64, 14);
    g.globalCompositeOperation = 'source-over';
    g.restore();
    return S;
}
interface Art { beads: readonly Sprite[]; collar: Sprite; marker: Sprite; pale: Sprite; imam: Sprite }
const cache = new Map<string, Art>();
function art(design: NightDesign, shape: NightShape): Art {
    const key = `${design}-${shape}`, have = cache.get(key);
    if (have) return have;
    if (cache.size >= 6) cache.clear(); // sprites are large; stepping through every design should not keep them all
    const D = DESIGNS[design], SH = SHAPES[shape];
    const made = { beads: [makeBead(D, SH, 11), makeBead(D, SH, 2203), makeBead(D, SH, 40127)], collar: makeCollar(D), marker: makeMarker(D), pale: makeBead(lighter(D), SH, 3301), imam: makeImam(D, 7717) };
    cache.set(key, made);
    return made;
}

/* ---- Sky --------------------------------------------------------------------------------------------------- */

interface Sky { stops: readonly [string, string, string, string]; stars: number; band: number; moon?: true; sun?: readonly [number, number, number, string]; light: readonly [number, number, number]; shade: readonly [number, number, number] }
const SKIES: Record<SkyName, Sky> = {
    fajr: { stops: ['#0b111c', '#1d2a38', '#4b4f58', '#a98463'], stars: 130, band: .05, moon: true, light: [214, 176, 150], shade: [38, 42, 54] },
    day: { stops: ['#2c5270', '#527d98', '#9bb5b8', '#c9c7ae'], stars: 0, band: 0, sun: [.87, .385, 19, 'rgba(255,240,200,.95)'], light: [255, 252, 240], shade: [120, 146, 160] },
    sunset: { stops: ['#17192a', '#483447', '#a65a3f', '#c98a4e'], stars: 40, band: 0, sun: [.2, .77, 25, 'rgba(255,190,110,.95)'], light: [250, 176, 118], shade: [62, 42, 56] },
    night: { stops: ['#070a09', '#111613', '#1d211d', '#242a2c'], stars: 300, band: .13, moon: true, light: [176, 184, 194], shade: [24, 28, 32] }
};
/** From a fixed seed: a sea of billowing cloud below, stars and the moon or sun above. Uses gradients, as canvas filters do not run on iOS. */
function paintSky(g: G, name: SkyName, w: number, h: number, d: number): void {
    const S = SKIES[name], rnd = mk(7);
    g.setTransform(d, 0, 0, d, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, S.stops[0]); bg.addColorStop(.55, S.stops[1]); bg.addColorStop(.82, S.stops[2]); bg.addColorStop(1, S.stops[3]);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w * .5, h * .3); g.rotate(-.5);
    const band = g.createRadialGradient(0, 0, 0, 0, 0, w * .95);
    band.addColorStop(0, `rgba(217,187,121,${S.band})`); band.addColorStop(1, 'rgba(217,187,121,0)');
    g.scale(1, .3); g.fillStyle = band; g.beginPath(); g.arc(0, 0, w * .95, 0, 7); g.fill(); g.restore();
    for (let i = 0; i < S.stars; i++) {
        const sx = rnd() * w, sy = Math.pow(rnd(), 1.3) * h * .72, a = .15 + rnd() * .7, rad = rnd() < .08 ? 1.25 : .3 + rnd() * .5;
        g.fillStyle = rnd() < .3 ? `rgba(239,220,173,${a})` : `rgba(243,240,231,${a})`;
        g.beginPath(); g.arc(sx, sy, rad, 0, 7); g.fill();
    }
    if (S.sun) {
        const sunX = w * S.sun[0], sunY = h * S.sun[1], halo = g.createRadialGradient(sunX, sunY, S.sun[2] * .6, sunX, sunY, S.sun[2] * 5);
        halo.addColorStop(0, S.sun[3].replace('.95', '.5')); halo.addColorStop(1, S.sun[3].replace('.95', '0'));
        g.fillStyle = halo; g.fillRect(0, 0, w, h);
        g.fillStyle = S.sun[3]; g.beginPath(); g.arc(sunX, sunY, S.sun[2], 0, 7); g.fill();
    }
    if (S.moon) {
        const mc = document.createElement('canvas'); mc.width = mc.height = 90 * d;
        const m = mc.getContext('2d')!; m.scale(d, d);
        m.fillStyle = '#f6ecd0'; m.beginPath(); m.arc(45, 45, 21, 0, 7); m.fill();
        m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(53.5, 40.5, 18, 0, 7); m.fill();
        g.save(); g.shadowColor = 'rgba(239,220,173,.8)'; g.shadowBlur = 16;
        g.drawImage(mc, w * .17 - 45, h * .735 - 45, 90, 90); g.restore();
    }
    // Billows: back rows are small and hazy, front rows larger with lit tops and shaded bases.
    const top = h * .79, billows = Array.from({ length: 300 }, () => ({ x: rnd() * w * 1.2 - w * .1, t: Math.pow(rnd(), 1.4) })).sort((p, q) => p.t - q.t);
    const light = `rgba(${S.light.join(',')},`, shade = `rgba(${S.shade.join(',')},`;
    for (const b of billows) {
        const cy = top + b.t * (h - top + 26), rr2 = 9 + b.t * 40 + rnd() * 10;
        g.save(); g.translate(b.x, cy); g.scale(1.25, .6);
        const sg = g.createRadialGradient(0, rr2 * .3, 0, 0, rr2 * .3, rr2 * 1.1);
        sg.addColorStop(0, shade + '.85)'); sg.addColorStop(1, shade + '0)');
        g.fillStyle = sg; g.beginPath(); g.arc(0, rr2 * .3, rr2 * 1.1, 0, 7); g.fill();
        const lg = g.createRadialGradient(-rr2 * .15, -rr2 * .45, 0, 0, -rr2 * .15, rr2 * .85);
        lg.addColorStop(0, `${light}${.2 + rnd() * .34})`); lg.addColorStop(1, light + '0)');
        g.fillStyle = lg; g.beginPath(); g.arc(0, -rr2 * .15, rr2 * .85, 0, 7); g.fill();
        g.restore();
    }
}

/* ---- The strand, on screen ---------------------------------------------------------------------------------- */

/** The strand follows a tight curve, pulled to a point by the weight of the minaret. Curve coordinates: its lowest point is at (171, 451). */
const MID_X = 171, MID_Y = 451, GAP_BELOW_RING = 40, TASSEL_BELOW_CORD = 204;
const curve = (x: number) => MID_Y - 95 * Math.pow(Math.abs(x - MID_X) / MID_X, 1.6);
const table: { s: number; x: number; y: number }[] = [];
let LEN = 0;
{ let px = -130, py = curve(-130); for (let x = -128; x <= 472; x += 2) { const y = curve(x); LEN += Math.hypot(x - px, y - py); table.push({ s: LEN, x, y }); px = x; py = y; } }
function at(s: number): { x: number; y: number; a: number } {
    let lo = 0, hi = table.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (table[m]!.s < s) lo = m + 1; else hi = m; }
    const p = table[lo]!, q = table[Math.min(lo + 1, table.length - 1)]!, r = table[Math.max(lo - 1, 0)]!;
    return { x: p.x, y: p.y, a: Math.atan2(q.y - r.y, q.x - r.x) };
}

export interface NightFrame { key: string; count: number; total: number; design: NightDesign; shape: NightShape; skyNow: () => SkyName; still: boolean }
let frame: NightFrame | null = null, stage: HTMLElement | null = null;
let skyCanvas: HTMLCanvasElement | null = null, strandCanvas: HTMLCanvasElement | null = null;
let skyDrawn = '', cw = 0, ch = 0, dpr = 1, originY = 0;
/** The bead position shown right now, in beads. It eases towards the count; it never feeds back into one. */
let shown = 0, shownKey = '';
let raf = 0, swingAt = -1e9, skyTimer: ReturnType<typeof setInterval> | null = null, peekTimer: ReturnType<typeof setTimeout> | null = null, listening = false;
const reducedMotion = () => !!frame?.still || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

function drawStrand(now: number): boolean {
    const f = frame, c = strandCanvas;
    if (!f || !c) return false;
    const g = c.getContext('2d')!, A = art(f.design, f.shape), STEP = SHAPES[f.shape].step, LOOP = Math.ceil(LEN / STEP) * STEP, COUNT = LOOP / STEP, shift = shown * STEP, rotate = f.shape !== 'round';
    const cycle = cycleFor(f.total), mid = LEN / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
    g.translate(cw / 2 - MID_X, originY);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); table.forEach((p, i) => { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
    g.strokeStyle = '#3a2a12'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = 'rgba(226,196,136,.6)'; g.lineWidth = 1.1; g.stroke();
    // The minaret arrives when the round completes and leaves after it.
    const sImam = mid + nearest(shown, 0, cycle) * STEP, showImam = sImam > -60 && sImam < LEN + 60;
    const posOf = (base: number) => (((base + shift + mid) % LOOP) + LOOP) % LOOP;
    // A divider follows bead 33 or 66: when that bead is in the middle, the divider is the next gap along.
    const markerAt = markersFor(cycle).map(b => mid + nearest(shown, b, cycle) * STEP - STEP / 2);
    const isMarker = (pos: number) => markerAt.some(a => Math.abs(pos - a) < STEP / 3);
    const isPale = (pos: number) => markerAt.some(a => Math.abs(pos - (a - STEP / 2)) < STEP / 3);
    const put = (sp: Sprite, x: number, y: number, a: number) => { g.save(); g.translate(x, y); if (a) g.rotate(a); g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); g.restore(); };
    for (let i = 0; i < COUNT; i++) { const s = posOf(i * STEP + STEP / 2); if (s > LEN || isMarker(s)) continue; const q = at(s); put(A.collar, q.x, q.y, q.a); }
    for (let i = 0; i < COUNT; i++) {
        const s = posOf(i * STEP); if (s > LEN) continue;
        if (showImam && Math.abs(s - sImam) < STEP / 3) continue;
        const q = at(s); put(isPale(s) ? A.pale : A.beads[i % 3]!, q.x, q.y, rotate ? q.a : 0);
    }
    for (const a of markerAt) { if (a < 0 || a > LEN) continue; const q = at(a); put(A.marker, q.x, q.y, q.a); }
    if (showImam) {
        const q = at(Math.max(0, Math.min(LEN, sImam))), sp = A.imam, t = (now - swingAt) / 1000, swing = reducedMotion() || t > 2.4 ? 0 : .085 * Math.exp(-t * 1.5) * Math.sin(t * 6.4);
        g.save(); g.translate(q.x, q.y - 1); g.rotate(swing); g.drawImage(sp.c, -sp.w / 2, -26, sp.w, sp.h); g.restore();
    }
    return showImam;
}
function tween(to: number, ms: number, then?: () => void): void {
    cancelAnimationFrame(raf);
    if (reducedMotion()) { shown = to; drawStrand(performance.now()); then?.(); return; }
    const t0 = performance.now(), from = shown;
    let finished = false;
    const step = (now: number) => {
        const k = Math.min(1, Math.max(0, (now - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
        shown = from + (to - from) * e;
        const imam = drawStrand(now);
        if (k >= 1 && !finished) { finished = true; then?.(); }
        if (k < 1 || (imam && now - swingAt < 2400)) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    drawStrand(t0);
}
function fit(): void {
    if (!stage || !skyCanvas || !strandCanvas) return;
    const box = stage.getBoundingClientRect(), ring = stage.querySelector('.night-ring')?.getBoundingClientRect();
    const mid = ring ? ring.bottom - box.top + GAP_BELOW_RING : box.height * .62;
    stage.style.setProperty('--night-min', `${Math.ceil(mid + TASSEL_BELOW_CORD + 8)}px`); // long text pushes the ring down; keep the tassel on the stage
    const r = stage.getBoundingClientRect();
    originY = mid - MID_Y;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 3);
    if (r.width !== cw || r.height !== ch || nextDpr !== dpr) { cw = r.width; ch = r.height; dpr = nextDpr; strandCanvas.width = Math.round(cw * dpr); strandCanvas.height = Math.round(ch * dpr); skyDrawn = ''; }
}
function drawSky(): void {
    if (!frame || !skyCanvas) return;
    const name = frame.skyNow(), d = Math.min(dpr, 2), key = `${name}-${cw}-${ch}-${d}`;
    if (key === skyDrawn) return;
    skyDrawn = key;
    skyCanvas.width = Math.round(cw * d); skyCanvas.height = Math.round(ch * d);
    paintSky(skyCanvas.getContext('2d')!, name, cw, ch, d);
}
/** Draws the look into a freshly rendered stage. The two canvases are kept between renders, so each tap only redraws the strand. */
export function mountNightBeads(el: HTMLElement, next: NightFrame): void {
    if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; }
    frame = next; stage = el;
    skyCanvas ??= document.createElement('canvas'); strandCanvas ??= document.createElement('canvas');
    skyCanvas.className = strandCanvas.className = 'night-layer';
    skyCanvas.setAttribute('aria-hidden', 'true'); strandCanvas.setAttribute('aria-hidden', 'true');
    const holder = el.querySelector('.night-canvases')!;
    holder.append(skyCanvas, strandCanvas);
    fit(); drawSky();
    const sameCounter = shownKey === next.key, delta = next.count - shown;
    shownKey = next.key;
    if (sameCounter && Math.abs(delta) <= 4 && delta !== 0) { // a few beads at most: quick taps; anything bigger (a reset) is not a slide
        if (delta > 0) swingAt = performance.now();
        tween(next.count, 420);
    } else { cancelAnimationFrame(raf); shown = next.count; drawStrand(performance.now()); }
    if (!skyTimer) skyTimer = setInterval(() => { fit(); drawSky(); }, 60000);
    if (!listening) { listening = true; window.addEventListener('resize', () => { if (stage) { fit(); drawSky(); drawStrand(performance.now()); } }); }
}
export function unmountNightBeads(): void {
    cancelAnimationFrame(raf);
    if (skyTimer) { clearInterval(skyTimer); skyTimer = null; }
    if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; }
    frame = null; stage = null; shownKey = '';
}
/** Slides the strand to the minaret for a moment, then back. Only the picture moves: the count is not touched. */
export function peekMinaret(): void {
    if (!frame) return;
    const cycle = cycleFor(frame.total), to = Math.round(shown / cycle) * cycle;
    if (peekTimer) clearTimeout(peekTimer);
    swingAt = performance.now();
    tween(to, 900, () => { peekTimer = setTimeout(() => { peekTimer = null; if (frame) tween(frame.count, 900); }, 2600); });
}
