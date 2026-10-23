/** Smart reminders, web side: turns settings into the configuration the native engines run while the app is closed.
 * Decisions are local; places never leave the device; a reminder is never counted as a recitation. */
import { RULES, ONCE_PER_DAY, MOMENTS, GENERAL_MOMENTS, entriesFor, quranPassages, type Moment, type DayWindows, type SmartEvent } from './adhkar.js';
import { prayerTimes, dayWindows, type Times } from './prayer.js';
import { dayKey, completedToday, type AppState, type Detection } from './engine.js';
export interface SmartStatus { location: 'always' | 'whenInUse' | 'denied' | 'restricted' | 'prompt'; motion: 'granted' | 'denied' | 'restricted' | 'prompt' | 'unavailable'; monitoring: string[]; precise: boolean }
export interface SmartBridge {
    status(): Promise<SmartStatus>;
    currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }>;
    requestAlways(): Promise<SmartStatus>;
    requestMotion(): Promise<SmartStatus>;
    configure(config: NativeConfig): Promise<SmartStatus>;
    takeEvents(): Promise<{ event: SmartEvent; at: number; moments: Moment[] }[]>;
    simulate(event: SmartEvent): Promise<Moment[]>;
    reset(): Promise<void>;
    openSettings(): Promise<void>;
    notificationPermission(request: boolean): Promise<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'>;
    scheduleTimed(list: TimedReminder[]): Promise<void>;
}
export interface NativeConfig {
    location: boolean;
    vehicle: boolean;
    regions: { id: string; lat: number; lng: number; radius: number }[];
    rules: { event: SmartEvent; moments: Moment[]; cooldownMinutes: number }[];
    oncePerDay: Moment[];
    windows: { day: string; morning: [number, number] | null; evening: [number, number] | null }[];
    copy: Record<string, { title: string; body: string }>;
    enabled: Moment[];
    completedDay: Partial<Record<Moment, string>>;
    timedIds: Partial<Record<Moment, Record<string, number>>>;
}
export interface TimedReminder { id: number; at: number; title: string; body: string; url: string; moment: Moment }
const CODE: Partial<Record<Moment, number>> = { morning: 1, evening: 2, sleep: 3 };
/** Stable id per moment and day, shared with the native engines so a grouped reminder can cancel the timed one. */
export function timedId(moment: Moment, day: string): number { return CODE[moment]! * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
/** Where prayer times are calculated: Home, else Work, else Mosque. */
export function prayerPlace(state: AppState): { lat: number; lng: number } | null { return state.places.home ?? state.places.work ?? state.places.mosque; }
export function timesFor(state: AppState, date: Date): Times | null {
    const p = prayerPlace(state);
    return p ? prayerTimes(p.lat, p.lng, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12), state.smart.method, state.smart.hanafi) : null;
}
export function windowsFor(state: AppState, date: Date): DayWindows { return dayWindows(dayKey(date.getTime()), timesFor(state, date), state.smart.span); }
/** Sleep window: from the chosen sleep time until 03:00. */
export function sleepWindow(state: AppState, date: Date): [number, number] | null {
    if (!state.smart.sleepTime) return null;
    const [h, m] = state.smart.sleepTime.split(':').map(Number);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).getTime();
    return [start, new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 3).getTime()];
}
/** A moment is done for today once every entry in it was confirmed. */
export function momentDone(state: AppState, moment: Moment, at = Date.now()): boolean { const e = entriesFor(moment); return e.length > 0 && e.every(x => completedToday(state, moment, at).has(x.id)); }
/** Moments the user wants and the granted features allow. */
export function enabledMoments(state: AppState): Moment[] {
    const placeMoments: Moment[] = ['leave_home', 'enter_home', 'work_arrive', 'work_leave', 'mosque_enter', 'mosque_leave'];
    return state.smart.moments.filter(m => (state.smart.location || !placeMoments.includes(m)) && (state.smart.vehicle || m !== 'vehicle') && (state.smart.timed || !(['morning', 'evening', 'sleep'] as Moment[]).includes(m) || state.smart.location || state.smart.vehicle));
}
export function nativeConfig(state: AppState, copy: (m: Moment) => { title: string; body: string }, now = Date.now()): NativeConfig {
    const days = Array.from({ length: 8 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d; });
    const regions = (['home', 'work', 'mosque'] as const).flatMap(id => { const p = state.places[id]; return p ? [{ id, lat: p.lat, lng: p.lng, radius: p.radius }] : []; });
    const completedDay: Partial<Record<Moment, string>> = {};
    for (const m of ONCE_PER_DAY) if (momentDone(state, m, now)) completedDay[m] = dayKey(now);
    const timedIds: Partial<Record<Moment, Record<string, number>>> = {};
    for (const m of ['morning', 'evening', 'sleep'] as Moment[]) timedIds[m] = Object.fromEntries(days.map(d => [dayKey(d.getTime()), timedId(m, dayKey(d.getTime()))]));
    return {
        location: state.smart.location, vehicle: state.smart.vehicle, regions,
        rules: RULES.map(r => ({ event: r.event, moments: [...r.moments], cooldownMinutes: r.cooldownMinutes })),
        oncePerDay: [...ONCE_PER_DAY],
        windows: days.map(d => { const w = windowsFor(state, d); return { day: w.day, morning: w.morning, evening: w.evening }; }),
        copy: Object.fromEntries(MOMENTS.map(m => [m, copy(m)])),
        enabled: enabledMoments(state), completedDay, timedIds,
    };
}
/** Morning (Fajr + 20 min), evening (Asr + 20 min) and sleep reminders for the next week. Without a saved place,
 * prayer times cannot be calculated, so morning and evening fall back to 07:00 and 17:00. */
export function timedReminders(state: AppState, copy: (m: Moment) => { title: string; body: string }, now = Date.now()): TimedReminder[] {
    if (!state.smart.timed) return [];
    const out: TimedReminder[] = [], enabled = new Set(state.smart.moments);
    for (let i = 0; i < 7; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const day = dayKey(d.getTime()), t = timesFor(state, d);
        const at = (h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
        const plan: [Moment, number | null][] = [['morning', t ? t.fajr + 20 * 60000 : at(7, 0)], ['evening', t ? t.asr + 20 * 60000 : at(17, 0)], ['sleep', sleepWindow(state, d)?.[0] ?? null]];
        for (const [m, when] of plan) {
            if (when === null || when <= now || !enabled.has(m) || (i === 0 && momentDone(state, m, now))) continue;
            out.push({ id: timedId(m, day), at: when, ...copy(m), url: `ayahflow://moment/${m}`, moment: m });
        }
    }
    return out;
}
/** First text of a moment, used as the notification body (Arabic, verbatim). */
export function momentPreview(m: Moment): string | null {
    if (GENERAL_MOMENTS.includes(m)) return null;
    const e = entriesFor(m)[0]!;
    const text = e.text ?? quranPassages(e)[0]!.ayahs[0]!.text;
    return text.length > 140 ? text.slice(0, text.lastIndexOf(' ', 140)) + ' …' : text;
}
export function mergeDetections(existing: Detection[], events: { event: SmartEvent; at: number }[]): Detection[] {
    const seen = new Set(existing.map(d => `${d.event}@${d.at}`));
    return [...existing, ...events.filter(e => !seen.has(`${e.event}@${e.at}`)).map(e => ({ event: e.event, at: e.at }))].sort((a, b) => a.at - b.at).slice(-50);
}
