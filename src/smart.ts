/** Smart reminders, web side: turns settings into the configuration the native engines run while the app is closed.
 * Decisions are local; places never leave the device; a reminder is never counted as a recitation. */
import { RULES, ONCE_PER_DAY, MOMENTS, GENERAL_MOMENTS, entriesFor, quranPassages, type Moment, type DayWindows, type SmartEvent } from './adhkar.js';
import { prayerTimes, dayWindows, type Times } from './prayer.js';
import { chapter, verse } from './data.js';
import { QURANIC_DUAS } from './duas.js';
import { dayKey, completedToday, PRAYERS, type AppState, type Detection, type PrayerName, type PrayerMethod } from './engine.js';
export interface SmartStatus { location: 'always' | 'whenInUse' | 'denied' | 'restricted' | 'prompt'; motion: 'granted' | 'denied' | 'restricted' | 'prompt' | 'unavailable'; monitoring: string[]; precise: boolean; backgroundRefresh?: 'on' | 'off' | 'restricted'; lowPower?: boolean; vehicleWatch?: boolean; configSaved?: boolean; tripWatch?: boolean; backgroundLocation?: boolean }
export interface SmartBridge {
    status(): Promise<SmartStatus>;
    currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }>;
    requestAlways(): Promise<SmartStatus>;
    requestMotion(): Promise<SmartStatus>;
    configure(config: NativeConfig): Promise<SmartStatus>;
    takeEvents(): Promise<{ event: Detection['event']; at: number; moments: Moment[]; detail?: string }[]>;
    simulate(event: SmartEvent): Promise<Moment[]>;
    reset(): Promise<void>;
    openSettings(): Promise<void>;
    notificationPermission(request: boolean): Promise<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'>;
    scheduleTimed(list: TimedReminder[]): Promise<void>;
    /** Replaces the pending istighfar reminders. */
    scheduleIstighfar(list: IstighfarReminder[]): Promise<void>;
    /** Replaces the pending dhikr rotation reminders. */
    scheduleRotation(list: RotationReminder[]): Promise<void>;
    /** Replaces the pending prayer check-in / tasbih reminders (src/worship.ts salahReminders). */
    scheduleSalah(list: { id: number; at: number; title: string; body: string; url: string }[]): Promise<void>;
    /** Steps per local day from the device pedometer, read live and never saved by the app. */
    steps(days: number): Promise<StepReading>;
}
/** iOS: CMPedometer (up to 7 days of history, kept by the system). Android: the step-counter sensor, sampled when the app
 * reads it, so a day only counts from the first reading and steps since the last reading are given to today (approximate). */
export interface StepReading { available: boolean; permission: 'granted' | 'denied' | 'prompt' | 'unavailable'; approximate: boolean; days: { day: string; steps: number }[] }
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
/** Days of adhkar and athan notifications planned ahead (refreshed whenever the app opens). Four days leaves room in
 * iOS's 64 pending notifications for istighfar (≤ 6) and rotation (≤ ROTATION_MAX) reminders. */
export const PLAN_DAYS = 4;
/** Prayer check-in / tasbih reminders pending at once (src/worship.ts salahReminders). */
export const SALAH_MAX = 6;
export const ROTATION_MAX = 64 - PLAN_DAYS * 5 - PLAN_DAYS * 3 - 6 - SALAH_MAX;
export interface RotationReminder { id: number; at: number; title: string; body: string; url: string; phrase: string }
/** Reminders every `every` minutes between `from` and `to` (today and tomorrow, at most ROTATION_MAX), each with the
 * next chosen phrase. A slot's phrase depends only on its time, so re-planning never reshuffles them. Ids 12×10⁶ + n. */
export function rotationReminders(state: AppState, phrases: { id: string; text: string; note: string }[], title: string, now = Date.now()): RotationReminder[] {
    const r = state.rotation;
    if (!r.enabled || !phrases.length) return [];
    const out: RotationReminder[] = [], step = r.every * 60000;
    const [fh, fm] = r.from.split(':').map(Number), [th, tm] = r.to.split(':').map(Number);
    for (let i = 0; i < 2 && out.length < ROTATION_MAX; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), fh, fm).getTime(), end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), th, tm).getTime();
        for (let at = start; at <= end && out.length < ROTATION_MAX; at += step) {
            if (at <= now) continue;
            const p = phrases[Math.floor((at - start) / step + i * 97) % phrases.length]!;
            out.push({ id: 12000000 + out.length, at, title, body: `${p.text}\n${p.note}`, url: 'ayahflow://rotation', phrase: p.id });
        }
    }
    return out;
}
/** Istighfar reminders: three slots a day (ids 9–11 × 10⁶ + yymmdd), kept apart from adhkar (1–3) and athan (4–8). */
export const ISTIGHFAR_SLOTS = ['lateMorning', 'afternoon', 'evening'] as const;
export type IstighfarSlot = typeof ISTIGHFAR_SLOTS[number];
export function istighfarId(slot: IstighfarSlot, day: string): number { return (9 + ISTIGHFAR_SLOTS.indexOf(slot)) * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
export interface IstighfarReminder { id: number; at: number; title: string; body: string; url: string }
/** Late morning (75 min before Dhuhr), afternoon (between Dhuhr and Asr) and evening (45 min after Maghrib), or 11:00,
 * 14:30 and 19:30 without a saved place. Only today and tomorrow are scheduled (iOS keeps at most 64 pending
 * notifications); none after the sleep time, and none left today once today's count reaches the target. */
export function istighfarReminders(state: AppState, today: number, target: number, copy: (count: number | null) => { title: string; body: string }, now = Date.now()): IstighfarReminder[] {
    if (!state.istighfarReminder) return [];
    const out: IstighfarReminder[] = [];
    for (let i = 0; i < 2; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        if (i === 0 && today >= target) continue;
        const day = dayKey(d.getTime()), t = timesFor(state, d), sleep = sleepWindow(state, d)?.[0] ?? null;
        const at = (h: number, min: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min).getTime();
        const when: Record<IstighfarSlot, number> = t
            ? { lateMorning: t.dhuhr - 75 * 60000, afternoon: Math.round((t.dhuhr + t.asr) / 2), evening: t.maghrib + 45 * 60000 }
            : { lateMorning: at(11, 0), afternoon: at(14, 30), evening: at(19, 30) };
        for (const slot of ISTIGHFAR_SLOTS) {
            const time = when[slot];
            if (time <= now || (sleep !== null && time >= sleep)) continue;
            out.push({ id: istighfarId(slot, day), at: time, ...copy(i === 0 ? today : null), url: 'ayahflow://counter/istighfar' });
        }
    }
    return out;
}
export function timedId(moment: Moment, day: string): number { return CODE[moment]! * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
// ---- Ayah of the day (a Quranic du'a) ----------------------------------------------------------
/** Longest du'a (in letters, marks ignored) that stays legible whole on the Lock Screen: the text is never cut, so
 * longer ones (2:286, 60:4, 46:15…) are left out of the daily pick rather than shown in part. */
export const DUA_MAX_LETTERS = 100;
const letters = (s: string) => s.replace(/[^\u0621-\u064A\u0671]/g, '').length;
let duaPool: (readonly [number, number, number])[] | null = null;
const dailyDuas = () => duaPool ??= QURANIC_DUAS.filter(([s, a, b]) => { let n = 0; for (let i = a; i <= b; i++) n += letters(verse(s, i)); return n <= DUA_MAX_LETTERS; });
/** One Quranic du'a per local day, the same on every device: a fixed hash of the date picks from the du'as that fit. */
export function ayahOfDay(day: string): { surah: number; ayah: number; to: number } {
    let h = 2166136261;
    for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
    const pool = dailyDuas(), [surah, ayah, to] = pool[(h >>> 0) % pool.length]!;
    return { surah, ayah, to };
}
/** "2:201" or "20:25–28". */
export const ayahRef = (a: { surah: number; ayah: number; to: number }) => `${a.surah}:${a.ayah}${a.to > a.ayah ? `–${a.to}` : ''}`;
/** The next `days` du'as with their text (each ayah verbatim, joined by a space), for the widget, so it changes at midnight
 * without the app. */
export function dailyAyahs(now = Date.now(), days = 14): { day: string; surah: number; ayah: number; to: number; ref: string; text: string; name: string; nameAr: string }[] {
    return Array.from({ length: days }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const day = dayKey(d.getTime()), a = ayahOfDay(day), c = chapter(a.surah);
        const text = Array.from({ length: a.to - a.ayah + 1 }, (_, k) => verse(a.surah, a.ayah + k)).join(' ');
        return { day, ...a, ref: ayahRef(a), text, name: c.name, nameAr: c.ar };
    });
}
/** The calculation method most mosques use in a region, from rough country boxes (no network, no place names). A hint
 * only: local mosques may follow another method. Smaller regions are checked before larger ones that overlap them. */
const METHOD_REGIONS: { region: string; method: PrayerMethod; lat: [number, number]; lng: [number, number] }[] = [
    { region: 'qatar', method: 'Qatar', lat: [24.4, 26.2], lng: [50.7, 51.7] },
    { region: 'uae', method: 'Dubai', lat: [22.5, 26.1], lng: [51.5, 56.4] },
    { region: 'kuwait', method: 'Kuwait', lat: [28.5, 30.1], lng: [46.5, 48.5] },
    { region: 'saudi', method: 'UmmAlQura', lat: [16, 32.2], lng: [34.5, 55.7] },
    { region: 'egypt', method: 'Egyptian', lat: [22, 31.7], lng: [24.7, 34.9] },
    { region: 'turkey', method: 'Turkey', lat: [35.8, 42.1], lng: [26, 44.8] },
    { region: 'iran', method: 'Tehran', lat: [25, 39.8], lng: [44, 63.3] },
    { region: 'southAsia', method: 'Karachi', lat: [5, 37], lng: [60.9, 92.7] },
    { region: 'southeastAsia', method: 'Singapore', lat: [-11, 7.5], lng: [95, 141] },
    { region: 'northAmerica', method: 'NorthAmerica', lat: [14, 72], lng: [-170, -50] },
    { region: 'europe', method: 'MuslimWorldLeague', lat: [35, 71], lng: [-11, 40] },
];
export function suggestedMethod(p: { lat: number; lng: number } | null): { region: string; method: PrayerMethod } | null {
    if (!p) return null;
    const r = METHOD_REGIONS.find(x => p.lat >= x.lat[0] && p.lat <= x.lat[1] && p.lng >= x.lng[0] && p.lng <= x.lng[1]);
    return r ? { region: r.region, method: r.method } : null;
}
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
    for (let i = 0; i < PLAN_DAYS; i++) {
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
/** Notification text for a moment: the first dhikr's own words (verbatim, shortened only past 600 characters at a word),
 * then its repeat count and source, so the reminder can be read and said straight from the notification. */
export function momentPreview(m: Moment): string | null {
    if (GENERAL_MOMENTS.includes(m)) return null;
    const e = entriesFor(m)[0]!;
    const passage = e.kind === 'quran' ? quranPassages(e)[0]! : null;
    const text = e.text ?? passage!.ayahs.map(a => a.text).join(' ');
    const body = text.length > 600 ? text.slice(0, text.lastIndexOf(' ', 600)) + ' …' : text;
    const ref = passage ? `Quran ${passage.surah}:${passage.ayahs[0]!.n}${passage.ayahs.length > 1 ? `–${passage.ayahs.at(-1)!.n}` : ''}` : `${e.source.collection} ${e.source.number}`;
    return `${body}\n${e.repeat > 1 ? `×${e.repeat} · ` : ''}${ref}`;
}
export function mergeDetections(existing: Detection[], events: { event: Detection['event']; at: number; detail?: string }[]): Detection[] {
    const seen = new Set(existing.map(d => `${d.event}@${d.at}`));
    return [...existing, ...events.filter(e => !seen.has(`${e.event}@${e.at}`)).map(e => ({ event: e.event, at: e.at, ...(e.detail ? { detail: e.detail.slice(0, 160) } : {}) }))].sort((a, b) => a.at - b.at).slice(-50);
}

// ---- Athan and widget ---------------------------------------------------------------------------
const PRAYER_CODE: Record<PrayerName, number> = { fajr: 4, dhuhr: 5, asr: 6, maghrib: 7, isha: 8 };
/** Stable athan notification id per prayer and day (codes 4-8; adhkar reminders use 1-3). */
export function athanId(prayer: PrayerName, day: string): number { return PRAYER_CODE[prayer] * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
/** `day` is the local day the prayer belongs to (an Isha after midnight belongs to the day before). */
export interface PrayerAt { prayer: PrayerName; at: number; day: string }
/** Prayer times from the saved place for `days` days starting today, in order, led by any of yesterday's that are
 * still to come (at high latitudes in summer, Isha can fall after midnight). Empty without a saved place. */
export function prayersFrom(state: AppState, now = Date.now(), days = 7): PrayerAt[] {
    const out: PrayerAt[] = [];
    for (let i = -1; i < days; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const t = timesFor(state, d);
        if (t) for (const p of PRAYERS) if (i >= 0 || t[p] > now) out.push({ prayer: p, at: t[p], day: dayKey(d.getTime()) });
    }
    return out;
}
export function nextPrayer(state: AppState, now = Date.now()): PrayerAt | null { return prayersFrom(state, now, 2).find(p => p.at > now) ?? null; }
/** The day the Today card shows: the day of the next prayer, so the big time and the timeline always agree. After Isha
 * that is tomorrow's schedule (as the usual prayer apps do), flagged so the card can say so. */
export function prayerDayView(state: AppState, now = Date.now()): { next: PrayerAt; times: Times; tomorrow: boolean; day: string } | null {
    const next = nextPrayer(state, now);
    if (!next) return null;
    // The same day offsets prayersFrom uses, so this holds even when the place's time zone differs from the device's.
    for (let i = -1; i < 2; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const times = timesFor(state, d);
        if (times && PRAYERS.some(p => times[p] === next.at)) return { next, times, tomorrow: i > 0, day: dayKey(d.getTime()) };
    }
    return null;
}
/** `reciter` is a bundled recording id or 'custom'; null means the gentle system alert. */
export interface AthanAlert { id: number; at: number; prayer: PrayerName; title: string; body: string; reciter: string | null; customVersion: number | null }
/** Athan alerts for the next week (35 at most, within iOS's 64 pending notifications together with adhkar reminders). */
export function athanSchedule(state: AppState, label: (p: PrayerName, at: number) => { title: string; body: string }, now = Date.now()): AthanAlert[] {
    if (!state.athan.enabled) return [];
    return prayersFrom(state, now, PLAN_DAYS).filter(p => p.at > now && state.athan.prayers[p.prayer]).map(p => ({ id: athanId(p.prayer, dayKey(p.at)), at: p.at, prayer: p.prayer, ...label(p.prayer, p.at), reciter: state.athan.sound === 'chime' ? null : p.prayer === 'fajr' ? state.athan.fajrReciter : state.athan.reciter, customVersion: state.athan.custom?.version ?? null }));
}
/** What the home-screen widgets show. Computed here so the app stays the single source of prayer times. */
/** Today's dhikr counts, adhkar progress and (only when the step tracker is on) the latest step reading, for the widget. */
export interface WidgetDaily { day: string; counters: { id: string; label: string; n: number; total: number; atLeast: boolean; perPrayer: boolean }[]; adhkar: { key: Moment; label: string; done: number; total: number }[]; steps: { today: number; goal: number; at: number } | null }
export interface WidgetData { v: 1; updatedAt: number; rtl: boolean; locale: string; prayers: { key: PrayerName; label: string; at: number; day: string }[]; windows: { morning: [number, number] | null; evening: [number, number] | null }[]; labels: Record<string, string>; daily: WidgetDaily | null; ayahs: ReturnType<typeof dailyAyahs>; worship?: WidgetWorship }
/** Prayers the user confirmed (today and yesterday, so midnight does not blank them) and the Ayah of the Moment for the
 * next half-hour slots, so the widget can follow without the app (within the system's refresh limits). */
export interface WidgetWorship { salah: { day: string; kept: PrayerName[] }[]; moments: { at: number; surah: number; ayah: number; ref: string; text: string; name: string; nameAr: string }[] }
export function widgetData(state: AppState, label: (key: string) => string, now = Date.now(), extra: Record<string, string> = {}, daily: WidgetDaily | null = null, worship?: WidgetWorship): WidgetData {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d; });
    return {
        v: 1, updatedAt: now, rtl: state.locale === 'ar', locale: state.locale,
        prayers: prayersFrom(state, now).map(p => ({ key: p.prayer, label: label('p_' + p.prayer), at: p.at, day: p.day })),
        windows: days.map(d => { const w = windowsFor(state, d); return { morning: w.morning, evening: w.evening }; }),
        labels: { next: label('nextPrayer'), noPlace: label('widgetNoPlace'), stale: label('widgetStale'), morning: label('m_morning'), evening: label('m_evening'), today: label('prayerTimes'), app: 'AyahFlow', prayerTab: label('widgetPrayer'), dhikrTab: label('widgetDhikr'), stepsTab: label('steps'), rounds: label('rounds'), stepsOff: label('widgetStepsOff'), toGo: label('toGo'), goalReached: label('goalReached'), updated: label('widgetUpdated'), ayahTab: label('ayahOfDay'), surahRef: label('surahRef'), ayahEmpty: label('ayahWidgetEmpty'), momentTab: label('ayahMoment'), prayed: label('widgetPrayed'), readAyah: label('readInContext'), ...extra },
        daily,
        ayahs: dailyAyahs(now),
        ...(worship ? { worship } : {}),
    };
}
