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
