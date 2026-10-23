/** Offline prayer times (adhan-js, MIT) and the morning/evening reminder windows derived from them.
 * Scholars differ on the exact windows for morning and evening adhkar, so the span is a user setting. */
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from './adhan.js';
import type { DayWindows } from './adhkar.js';
import type { PrayerMethod as Method } from './engine.js';
export { PRAYER_METHODS as METHODS } from './engine.js';
export type { PrayerMethod as Method } from './engine.js';
/** 'narrow': Fajr→sunrise and Asr→Maghrib. 'broad': Fajr→Dhuhr and Asr→Isha. */
export type WindowSpan = 'narrow' | 'broad';
export interface Times { fajr: number; sunrise: number; dhuhr: number; asr: number; maghrib: number; isha: number }
export function prayerTimes(lat: number, lng: number, date: Date, method: Method, hanafi = false): Times {
    const params = CalculationMethod[method]();
    params.madhab = hanafi ? Madhab.Hanafi : Madhab.Shafi;
    const p = new PrayerTimes(new Coordinates(lat, lng), date, params);
    return { fajr: +p.fajr, sunrise: +p.sunrise, dhuhr: +p.dhuhr, asr: +p.asr, maghrib: +p.maghrib, isha: +p.isha };
}
export function dayWindows(day: string, t: Times | null, span: WindowSpan): DayWindows {
    if (!t) return { day, morning: null, evening: null };
    return { day, morning: [t.fajr, span === 'narrow' ? t.sunrise : t.dhuhr], evening: [t.asr, span === 'narrow' ? t.maghrib : t.isha] };
}
