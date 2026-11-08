/** The Mushaf page turn: a sheet peels from its free edge, folds over and shows its blank paper back.
 * Drawing only. The page and its place are decided by the app, the text on the sheet is the same text the page shows
 * (the back stays blank, so no Quran text is ever mirrored), and the sheet is hidden from assistive technology.
 *
 * A printed Mushaf is bound on the right: the next page comes by lifting the left edge over to the right, and the
 * previous page falls back the other way. That holds in every interface language. */
export type Point = readonly [number, number];
export type TurnDirection = 'next' | 'prev';

/** Keeps the crease near upright, and exactly upright at both ends, so a finished turn clears the whole page. */
const MAX_TILT = 0.35;
export function clampTilt(width: number, anchorY: number, tipX: number, tipY: number): number {
    const room = Math.max(0, Math.min(tipX, width * 2 - tipX)) * MAX_TILT;
    return anchorY + Math.max(-room, Math.min(room, tipY - anchorY));
}

/** The free edge's position for a finger moved by dx: 0 is the page lying flat, width * 2 is the page fully turned. */
const DRAG_GAIN = 1.6;
export function tipFromDrag(direction: TurnDirection, width: number, dx: number): number {
    const tip = direction === 'next' ? dx * DRAG_GAIN : width * 2 + dx * DRAG_GAIN;
    return Math.max(0, Math.min(width * 2, tip));
}

/** What a one-finger drag on the page is so far: a page turn, a scroll, or not clear yet. On a page that scrolls, a drag
 * that moved up or down first is a scroll, and stays one when the finger drifts sideways later (the caller drops it).
 * `scrolled`: the page has already scrolled under this finger. iOS WebKit can hold touchmove back while it scrolls, so
 * the first move the page sees may already be far to the side; the scroll itself is then the evidence. */
export function dragIntent(dx: number, dy: number, scrolls: boolean, scrolled = false): 'turn' | 'scroll' | 'wait' {
    if (scrolled) return 'scroll';
    if (scrolls && Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) return 'scroll';
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return 'wait';
    return 'turn';
}

/** A released finger completes the turn when it travelled far enough or flicked that way; flicking back cancels it. */
export function releaseCompletes(direction: TurnDirection, width: number, dx: number, velocity: number): boolean {
    const along = direction === 'next' ? dx : -dx, speed = direction === 'next' ? velocity : -velocity;
    if (speed < -0.15) return false;
    return along > Math.min(60, width * 0.18) || (along > 16 && speed > 0.4);
}

/** The part of a polygon on the positive side of a line through `origin` with normal `normal`. */
function clipPolygon(points: readonly Point[], origin: Point, normal: Point): Point[] {
    const side = (p: Point) => (p[0] - origin[0]) * normal[0] + (p[1] - origin[1]) * normal[1];
    const out: Point[] = [];
    points.forEach((a, i) => {
        const b = points[(i + 1) % points.length]!, da = side(a), db = side(b);
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    });
    return out;
}

export interface CurlShape {
    /** The part of the sheet still lying flat, on the spine's side of the crease. */
    flat: Point[];
    /** The page uncovered under the lifted part. */
    revealed: Point[];
    /** The lifted part, folded over the crease. Its paper back is what shows. */
    flap: Point[];
    /** CSS gradient angle along the crease's normal, pointing towards the spine. */
    angle: number;
    /** Maps a distance from the crease, spine side positive, to a percentage on that gradient. */
    at: (distance: number) => number;
    /** How far the flap reaches from the crease. */
    reach: number;
}

/** Folds a width x height sheet so that its free-edge point `anchor` lands on `tip`: the crease is the line halfway
 * between them, and everything on the free side of it is reflected across it, as paper does. */
export function curlShape(width: number, height: number, anchor: Point, tip: Point): CurlShape {
    const page: Point[] = [[0, 0], [width, 0], [width, height], [0, height]];
    const dx = tip[0] - anchor[0], dy = tip[1] - anchor[1], length = Math.hypot(dx, dy);
    if (length < 0.001) return { flat: page, revealed: [], flap: [], angle: 90, at: () => 0, reach: 0 };
    const normal: Point = [dx / length, dy / length], crease: Point = [anchor[0] + dx / 2, anchor[1] + dy / 2];
    const flat = clipPolygon(page, crease, normal);
    const revealed = clipPolygon(page, crease, [-normal[0], -normal[1]]);
    const flap = revealed.map(([x, y]): Point => {
        const d = 2 * ((x - crease[0]) * normal[0] + (y - crease[1]) * normal[1]);
        return [x - d * normal[0], y - d * normal[1]];
    });
    const angle = Math.atan2(normal[0], -normal[1]) * 180 / Math.PI;
    const span = Math.abs(width * normal[0]) + Math.abs(height * normal[1]);
    const middle = (crease[0] - width / 2) * normal[0] + (crease[1] - height / 2) * normal[1];
    return { flat, revealed, flap, angle, at: distance => 50 + (middle + distance) / span * 100, reach: length / 2 };
}

const polygon = (points: readonly Point[]) => points.length ? `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` : 'polygon(0 0)';
const pct = (n: number) => `${n.toFixed(2)}%`;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

export interface Leaf {
    readonly direction: TurnDirection;
    /** Follows a finger moved by dx, dy from where it started. */
    drag(dx: number, dy: number): void;
    /** Plays to the end of the turn, or back to the start, then removes itself. */
    play(end: 'done' | 'back', hand?: boolean): void;
    /** Moves onto a redrawn reader, so a render under the turn does not interrupt it. */
    adopt(surface: HTMLElement | null): void;
    /** Removes the sheet straight away. */
    remove(): void;
}

/** Stacks copies of the two pages over the real one. `fresh` is the page the turn leads to; `fit` sizes its text. */
export function mountLeaf(surface: HTMLElement, fresh: HTMLElement, direction: TurnDirection, grabY: number | null, fit: (el: HTMLElement) => void, onGone: () => void): Leaf {
    const host = document.createElement('div');
    host.className = 'r-leaf';
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    const place = (real: HTMLElement) => { host.style.cssText = `top:${real.offsetTop}px;left:${real.offsetLeft}px;width:${real.offsetWidth}px;height:${real.offsetHeight}px`; };
    place(surface);
    const old = surface.cloneNode(true) as HTMLElement;
    old.classList.remove('turn-next', 'turn-prev');
    fresh.classList.add('r-surface');
    const under = direction === 'next' ? fresh : old, sheet = direction === 'next' ? old : fresh;
    const layer = (cls: string) => { const el = document.createElement('div'); el.className = cls; return el; };
    const underShade = layer('r-leaf-shade'), flatShade = layer('r-leaf-shade'), flap = layer('r-leaf-flap');
    host.append(under, underShade, sheet, flatShade, flap);
    surface.after(host);
    fit(fresh);
    old.scrollTop = surface.scrollTop;
    for (const el of host.querySelectorAll('[id]')) el.removeAttribute('id');

    const width = host.offsetWidth, height = host.offsetHeight, full = width * 2;
    const anchorY = grabY === null ? height * 0.82 : Math.max(0, Math.min(height, grabY));
    const start = direction === 'next' ? 0 : full, end = direction === 'next' ? full : 0;
    let tipX = start, tipY = anchorY, frame = 0, timer: ReturnType<typeof setTimeout> | undefined, gone = false;

    const draw = () => {
        const y = clampTilt(width, anchorY, tipX, tipY), s = curlShape(width, height, [0, anchorY], [tipX, y]);
        sheet.style.clipPath = polygon(s.flat);
        const edge = (n: number) => pct(s.at(n)), r = s.reach;
        underShade.style.clipPath = polygon(s.revealed);
        underShade.style.background = `linear-gradient(${s.angle}deg,transparent ${edge(-Math.min(70, r + 14))},var(--leaf-under) ${edge(0)})`;
        flatShade.style.clipPath = polygon(s.flat);
        flatShade.style.background = `linear-gradient(${s.angle}deg,var(--leaf-cast) ${edge(r)},transparent ${edge(r + Math.min(34, r * 0.5 + 6))})`;
        flap.style.clipPath = polygon(s.flap);
        // A sliver of paper at the very start or end of a turn would otherwise flash as a bright line.
        flap.style.opacity = String(Math.min(1, r / 18));
        flap.style.backgroundImage = `linear-gradient(${s.angle}deg,var(--leaf-crease) ${edge(0)},var(--leaf-lit) ${edge(r * 0.22)},var(--leaf-plain) ${edge(r * 0.6)},var(--leaf-edge) ${edge(r)})`;
    };
    const remove = () => {
        if (gone) return;
        gone = true;
        cancelAnimationFrame(frame); clearTimeout(timer);
        host.remove();
        onGone();
    };
    draw();
    return {
        direction,
        drag(dx, dy) { cancelAnimationFrame(frame); tipX = tipFromDrag(direction, width, dx); tipY = anchorY + dy * 0.5; draw(); },
        play(to, hand = false) {
            cancelAnimationFrame(frame); clearTimeout(timer);
            const from = tipX, fromY = tipY, target = to === 'done' ? end : start, share = Math.abs(target - from) / full;
            const duration = hand ? 170 + 320 * share : 620, ease = hand ? easeOut : easeInOut, arc = hand ? 0 : height * 0.1, began = performance.now();
            const step = (now: number) => {
                const t = Math.min(1, (now - began) / duration), e = ease(t);
                tipX = from + (target - from) * e;
                tipY = fromY + (anchorY - fromY) * e - arc * Math.sin(Math.PI * e);
                draw();
                if (t < 1) frame = requestAnimationFrame(step); else remove();
            };
            frame = requestAnimationFrame(step);
            // Animation frames stop in the background; the sheet must not stay over the page when the app returns.
            timer = setTimeout(remove, duration + 400);
        },
        adopt(real) {
            if (!real) { remove(); return; }
            if (host.previousElementSibling !== real) real.after(host);
            place(real);
        },
        remove,
    };
}
