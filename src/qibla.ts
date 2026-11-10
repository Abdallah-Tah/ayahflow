/** Qibla direction: the initial great-circle bearing from a place to the Kaaba. Pure and offline. */
/** The Kaaba, Makkah (WGS 84). */
export const KAABA = { lat: 21.422487, lng: 39.826206 } as const;
const rad = (d: number) => d * Math.PI / 180, deg = (r: number) => r * 180 / Math.PI;
/** Degrees clockwise from true north, 0 ≤ b < 360. */
export function qiblaBearing(lat: number, lng: number): number {
    const φ1 = rad(lat), φ2 = rad(KAABA.lat), Δλ = rad(KAABA.lng - lng);
    const b = deg(Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)));
    return (b + 360) % 360;
}
/** Great-circle distance to the Kaaba in kilometres (mean Earth radius). */
export function kaabaDistanceKm(lat: number, lng: number): number {
    const φ1 = rad(lat), φ2 = rad(KAABA.lat), a = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(rad(KAABA.lng - lng) / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** How far to turn from the way the phone points to face the Qibla: −180 < turn ≤ 180, positive = clockwise (right). */
export function qiblaTurn(heading: number, bearing: number): number {
    const t = ((bearing - heading) % 360 + 540) % 360 - 180;
    return t === -180 ? 180 : t;
}
/** Close enough to say "facing the Qibla". */
export const QIBLA_ALIGNED = 5;
/** A heading worse than this (degrees, from the device) is not trusted for turn-by-turn guidance. */
export const QIBLA_ROUGH = 25;
/** A compass reading as the native bridge sends it: degrees clockwise from true north (or magnetic north when
 * `trueNorth` is false, i.e. iOS has no location to correct it), accuracy in degrees (negative = uncalibrated). */
export interface QiblaHeading { heading: number; trueNorth: boolean; accuracy: number }
/** What the Qibla screen may honestly say. `noLive`: no compass in this app (the web); `noCompass`: the device has none
 * or refused; `waiting`: asked, nothing yet. Only `turn` and `facing` come from a trusted heading. */
export type QiblaGuide =
    | { kind: 'turn' | 'facing'; turn: number; magnetic: boolean }
    | { kind: 'calibrate'; magnetic: boolean }
    | { kind: 'waiting' | 'noCompass' | 'noLive' };
export function qiblaGuide(h: QiblaHeading | null, bearing: number, live: boolean, missing: boolean): QiblaGuide {
    if (!h) return { kind: missing ? 'noCompass' : live ? 'waiting' : 'noLive' };
    const magnetic = !h.trueNorth;
    if (!Number.isFinite(h.heading) || h.heading < 0 || !Number.isFinite(h.accuracy) || h.accuracy < 0 || h.accuracy > QIBLA_ROUGH) return { kind: 'calibrate', magnetic };
    const turn = qiblaTurn(h.heading, bearing);
    return { kind: Math.abs(turn) <= QIBLA_ALIGNED ? 'facing' : 'turn', turn, magnetic };
}
/** The angle equal to `next` (mod 360) nearest to `prev`, so a dial animates 359° → 1° by 2°, not back round by 358°. */
export function nearestAngle(prev: number, next: number): number { return prev + qiblaTurn(prev, next); }
