/** Smart reminders, web side: turns settings into the configuration the native engines run while the app is closed.
 * Decisions are local; places never leave the device; a reminder is never counted as a recitation. */
import { RULES, ONCE_PER_DAY, MOMENTS, GENERAL_MOMENTS, entriesFor, quranPassages, type Moment, type DayWindows, type SmartEvent, type AdhkarEntry } from './adhkar.js';
import { prayerTimes, dayWindows, type Times } from './prayer.js';
import { chapter, verse } from './data.js';
import { QURANIC_DUAS } from './duas.js';
import { LOCK_DUAS } from './lock-duas.js';
import { dayKey, completedToday, PRAYERS, type AppState, type Detection, type PrayerName, type PrayerMethod } from './engine.js';
export interface SmartStatus { location: 'always' | 'whenInUse' | 'denied' | 'restricted' | 'prompt'; motion: 'granted' | 'denied' | 'restricted' | 'prompt' | 'unavailable'; monitoring: string[]; precise: boolean; backgroundRefresh?: 'on' | 'off' | 'restricted'; lowPower?: boolean; vehicleWatch?: boolean; configSaved?: boolean; tripWatch?: boolean; backgroundLocation?: boolean; home?: 'in' | 'out' | 'unknown' }
export interface SmartBridge {
    status(): Promise<SmartStatus>;
    currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }>;
    requestAlways(): Promise<SmartStatus>;
    requestMotion(): Promise<SmartStatus>;
    configure(config: NativeConfig): Promise<SmartStatus>;
    takeEvents(): Promise<{ event: Detection['event']; at: number; moments: Moment[]; detail?: string }[]>;
    /** Posts the notification a reminder for `event` would show, marked "Test", and records nothing: no cooldown, no
     * history, no detection log, no timed reminder cancelled. Resolves the moments it showed. */
    simulate(event: SmartEvent): Promise<Moment[]>;
    reset(): Promise<void>;
    openSettings(): Promise<void>;
    /** Registers the "I recited it" button on adhkar reminders, labelled in the app's language. */
    setDhikrAction(title: string): Promise<void>;
    notificationPermission(request: boolean): Promise<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'>;
    scheduleTimed(list: TimedReminder[]): Promise<void>;
    /** Replaces the pending istighfar reminders. */
    scheduleIstighfar(list: IstighfarReminder[]): Promise<void>;
    /** Replaces the pending dhikr rotation reminders. */
    scheduleRotation(list: RotationReminder[]): Promise<void>;
    /** Replaces the pending prayer check-in / tasbih reminders (src/worship.ts salahReminders). */
    scheduleSalah(list: { id: number; at: number; title: string; body: string; url: string }[]): Promise<void>;
    /** Replaces the pending reminders before prayers (beforeSchedule). */
    scheduleBefore(list: BeforeAlert[]): Promise<void>;
    /** One test notification `seconds` from now, with the same sound as the real one; `pending` is whether iOS kept it. */
    scheduleTest(n: TestNotification, seconds: number): Promise<{ at: number; pending: boolean; sound: string | null }>;
    /** iOS notification settings and where each sound file is; empty where the platform has no such check. */
    notificationCheck(sounds: string[]): Promise<NotificationCheck>;
    /** The sound file name the notification will ask for, or null for none (Android: the channel's). */
    soundFor(n: TestNotification): string | null;
    /** Replaces the pending Jumu'ah and voluntary-fast reminders (src/calendar.ts). */
    scheduleCalendar(list: { id: number; at: number; title: string; body: string; url: string }[]): Promise<void>;
    /** Compass heading while the Qibla screen is open: `onHeading` gets degrees from true north (magnetic when true north
     * is unknown) and the accuracy in degrees (negative = needs calibration). Resolves false where there is no compass.
     * Nothing is saved; stopHeading ends it. */
    startHeading(onHeading: (h: { heading: number; trueNorth: boolean; accuracy: number }) => void): Promise<boolean>;
    stopHeading(): Promise<void>;
    /** Fajr alarm: AlarmKit on iOS 26+ (`available`), with its authorization, the alarms still to ring and whether the
     * wake check is waiting; `available: false` elsewhere. */
    alarmStatus(): Promise<AlarmStatus>;
    alarmRequest(): Promise<AlarmAuthorization | 'unavailable'>;
    /** Replaces the planned Fajr alarms: AlarmKit when available, otherwise `fallback` as notifications. Resolves which. */
    scheduleAlarm(plan: AlarmPlan, fallback: { id: number; at: number; title: string; body: string }[]): Promise<'alarm' | 'notification'>;
    /** Rings the Fajr alarm once, `seconds` from now, with the saved plan's sound and wording (AlarmKit only). */
    alarmTest(seconds: number): Promise<boolean>;
    /** The user confirmed being awake: the wake-check ring is cancelled. */
    alarmAwake(): Promise<void>;
}
export type AlarmAuthorization = 'authorized' | 'denied' | 'notDetermined';
export interface AlarmStatus { available: boolean; authorization?: AlarmAuthorization; pending?: { id: string; at: number; kind: 'fajr' | 'snooze' | 'check' }[]; checkWaiting?: boolean }
/** Read by ios/App/App/FajrAlarm.swift (FajrAlarmPlan). */
export interface AlarmPlan { alarms: { uuid: string; at: number }[]; snoozes: number; snoozeMinutes: number; check: boolean; checkMinutes: number; title: string; checkTitle: string; stop: string; snooze: string; sound: string }
export interface TestNotification { id: number; kind: 'before' | 'athan'; title: string; body: string; reciter: string | null; customVersion: number | null; homeOnly?: boolean }
type Setting = 'on' | 'off' | 'unsupported';
export interface NotificationCheck { authorization?: 'granted' | 'provisional' | 'ephemeral' | 'denied' | 'prompt'; alert?: Setting; sound?: Setting; lockScreen?: Setting; files?: Record<string, 'library' | 'bundle' | 'missing'> }
export interface NativeConfig {
    location: boolean;
    vehicle: boolean;
    regions: { id: string; lat: number; lng: number; radius: number }[];
    rules: { event: SmartEvent; moments: Moment[]; cooldownMinutes: number; quietAfter?: { moment: Moment; minutes: number }; sameJourneyMinutes?: number }[];
    oncePerDay: Moment[];
    windows: { day: string; morning: [number, number] | null; evening: [number, number] | null }[];
    /** `general`: no narrated du'a of its own, so a grouped notification takes its text from another moment. */
    copy: Record<string, { title: string; body: string; general?: boolean }>;
    /** Put before the title of a test notification (Reminders › Test), so it never reads as a real detection. */
    testPrefix?: string;
    enabled: Moment[];
    completedDay: Partial<Record<Moment, string>>;
    timedIds: Partial<Record<Moment, Record<string, number>>>;
    /** Athan alerts marked homeOnly play the athan inside the Home region and a chime elsewhere; iOS watches Home for it. */
    athanHome: boolean;
    /** When each timed reminder is planned (moment → day → epoch ms): once it has been delivered, a place or vehicle
     * reminder later that day does not carry the same collection again. Only reminders actually scheduled. */
    timedAt: Partial<Record<Moment, Record<string, number>>>;
}
export interface TimedReminder { id: number; at: number; title: string; body: string; url: string; moment: Moment }
const CODE: Partial<Record<Moment, number>> = { morning: 1, evening: 2, sleep: 3 };
/** Stable id per moment and day, shared with the native engines so a grouped reminder can cancel the timed one. */
/** Days of adhkar and athan notifications planned ahead (refreshed whenever the app opens). Four days leaves room in
 * iOS's 64 pending notifications for istighfar (≤ 6) and rotation (≤ ROTATION_MAX) reminders. */
export const PLAN_DAYS = 4;
/** Athan alerts pending at once: five a day, PLAN_DAYS days. */
export const ATHAN_MAX = PLAN_DAYS * 5;
/** Prayer check-in / tasbih reminders pending at once (src/worship.ts salahReminders). */
export const SALAH_MAX = 6;
/** Reminders before a prayer pending at once: the next two days. */
export const BEFORE_MAX = 10;
/** Kept free in iOS's 64: the daily practice reminder (id 701) and the two test notifications. */
const RESERVED = 3;
/** Rotation reminders get what is left of the 64 once every athan, timed adhkar, istighfar and prayer reminder has its
 * place, so iOS (which keeps only the soonest 64) never drops an athan for them. */
export const ROTATION_MAX = 64 - ATHAN_MAX - PLAN_DAYS * 3 - 6 - SALAH_MAX - RESERVED;
/** Jumu'ah and fast reminders pending at once (src/calendar.ts): the next Friday and the next three fasting evenings. */
export const FAST_MAX = 3;
/** Islamic-occasion reminders pending at once (src/calendar.ts): the next three switched on. */
export const OCCASION_MAX = 3;
/** Fajr alarm notifications when AlarmKit is unavailable (alarm.ts): the next two mornings. */
export const ALARM_FALLBACK_DAYS = 2;
/** Ramadan suhoor and iftar reminders: each for the next three days of Ramadan (calendar.ts). */
export const RAMADAN_DAYS = 3;
export function calendarCount(state: AppState): number { return (state.calendar.jumuah ? 1 : 0) + (state.calendar.fasting ? FAST_MAX : 0) + (state.fajrAlarm.enabled ? ALARM_FALLBACK_DAYS : 0) + (state.calendar.suhoor ? RAMADAN_DAYS : 0) + (state.calendar.iftar ? RAMADAN_DAYS : 0) + (Object.values(state.calendar.occasions).some(Boolean) ? OCCASION_MAX : 0); }
/** The rotation budget for these settings: smaller while the reminders before prayers or the calendar reminders are on. */
export function rotationMax(state: AppState): number { return ROTATION_MAX - (state.athan.before.enabled ? BEFORE_MAX : 0) - calendarCount(state); }
export interface RotationReminder { id: number; at: number; title: string; body: string; url: string; phrase: string }
/** Reminders every `every` minutes between `from` and `to` (today and tomorrow, at most ROTATION_MAX), each with the
 * next chosen phrase. A slot's phrase depends only on its time, so re-planning never reshuffles them. Ids 12×10⁶ + n. */
export function rotationReminders(state: AppState, phrases: { id: string; text: string; note: string }[], title: string, now = Date.now()): RotationReminder[] {
    const r = state.rotation;
    if (!r.enabled || !phrases.length) return [];
    const out: RotationReminder[] = [], step = r.every * 60000, max = rotationMax(state);
    const [fh, fm] = r.from.split(':').map(Number), [th, tm] = r.to.split(':').map(Number);
    for (let i = 0; i < 2 && out.length < max; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), fh, fm).getTime(), end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), th, tm).getTime();
        for (let at = start; at <= end && out.length < max; at += step) {
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
/** Longest du'a (in letters, marks ignored) considered for the daily pick; long ones (2:286, 60:4, 46:15…) are left out
 * rather than shown in part. */
export const DUA_MAX_LETTERS = 100;
const letters = (s: string) => s.replace(/[^\u0621-\u064A\u0671]/g, '').length;
/** "2:250" or "20:25-28": the key the Lock Screen measurement (src/lock-duas.ts) uses. */
export const duaKey = ([s, a, b]: readonly [number, number, number]) => `${s}:${a}${b > a ? `-${b}` : ''}`;
const duaText = ([s, a, b]: readonly [number, number, number]) => Array.from({ length: b - a + 1 }, (_, k) => verse(s, a + k)).join(' ');
/** FNV-1a of the measured du'as' text, so a corpus or list change without re-measuring fails the tests. */
export function duaTextHash(keys: readonly string[]): string {
    let h = 2166136261;
    const text = keys.map(k => { const d = QURANIC_DUAS.find(x => duaKey(x) === k); if (!d) throw Error(`Unknown du'a ${k}`); return duaText(d); }).join('\n');
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16);
}
let duaPool: (readonly [number, number, number])[] | null = null;
/** Only du'as measured to fit the Lock Screen rectangle whole (scripts/measure-lock-duas.mjs): a letter count alone let
 * 2:250 through, and on an iPhone 16 Pro it showed only its reference. */
const dailyDuas = () => duaPool ??= QURANIC_DUAS.filter(d => LOCK_DUAS.includes(duaKey(d)) && letters(duaText(d)) <= DUA_MAX_LETTERS);
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
        rules: RULES.map(r => ({ event: r.event, moments: [...r.moments], cooldownMinutes: r.cooldownMinutes, ...(r.quietAfter ? { quietAfter: { ...r.quietAfter } } : {}), ...(r.sameJourneyMinutes !== undefined ? { sameJourneyMinutes: r.sameJourneyMinutes } : {}) })),
        oncePerDay: [...ONCE_PER_DAY],
        windows: days.map(d => { const w = windowsFor(state, d); return { day: w.day, morning: w.morning, evening: w.evening }; }),
        copy: Object.fromEntries(MOMENTS.map(m => [m, GENERAL_MOMENTS.includes(m) ? { ...copy(m), general: true } : copy(m)])),
        enabled: enabledMoments(state), completedDay, timedIds, athanHome: athanHomeOnly(state), timedAt: timedPlan(state, now),
    };
}
/** Moment → day → time of the timed reminders timedReminders plans (the same rules, without the copy). */
export function timedPlan(state: AppState, now = Date.now()): Partial<Record<Moment, Record<string, number>>> {
    const out: Partial<Record<Moment, Record<string, number>>> = {};
    for (const r of timedReminders(state, () => ({ title: '', body: '' }), now)) (out[r.moment] ??= {})[dayKey(r.at)] = r.at;
    return out;
}
/** Today's timed moments a place or vehicle reminder already carried (the native engine cancelled the timed one then;
 * planning it again on the next app open would send the same adhkar twice). */
export function remindedToday(state: AppState, now = Date.now()): Set<Moment> {
    const day = dayKey(now);
    return new Set(state.detections.filter(d => dayKey(d.at) === day && d.at <= now).flatMap(d => d.moments ?? []));
}
/** Morning (Fajr + 20 min), evening (Asr + 20 min) and sleep reminders for the next week. Without a saved place,
 * prayer times cannot be calculated, so morning and evening fall back to 07:00 and 17:00. `afterPrayer` tells `copy`
 * the time came from that day's Fajr or Asr, so the title can say so (the two du'as of Abi Dawud 5068 look alike). */
export function timedReminders(state: AppState, copy: (m: Moment, afterPrayer: boolean) => { title: string; body: string }, now = Date.now()): TimedReminder[] {
    if (!state.smart.timed) return [];
    const out: TimedReminder[] = [], enabled = new Set(state.smart.moments), reminded = remindedToday(state, now);
    for (let i = 0; i < PLAN_DAYS; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const day = dayKey(d.getTime()), t = timesFor(state, d);
        const at = (h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
        const plan: [Moment, number | null][] = [['morning', t ? t.fajr + 20 * 60000 : at(7, 0)], ['evening', t ? t.asr + 20 * 60000 : at(17, 0)], ['sleep', sleepWindow(state, d)?.[0] ?? null]];
        for (const [m, when] of plan) {
            if (when === null || when <= now || !enabled.has(m) || (i === 0 && (momentDone(state, m, now) || reminded.has(m)))) continue;
            out.push({ id: timedId(m, day), at: when, ...copy(m, !!t && m !== 'sleep'), url: `ayahflow://moment/${m}`, moment: m });
        }
    }
    return out;
}
/** Letters (marks ignored) of adhkar a reminder carries for one moment before leaving the rest to the app. The first
 * dhikr is always there whole; a dhikr is never cut short. */
export const PREVIEW_LETTERS = 160;
/** A dhikr's text as the app shows it: the narration slice, or the Quran passages with each ayah's end sign and number. */
function displayText(e: AdhkarEntry): string {
    if (e.text) return e.text;
    return quranPassages(e).map(p => p.ayahs.map(a => `${a.text} ۝${a.n.toLocaleString('ar-EG')}`).join(' ')).join('\n');
}
const sourceLine = (e: AdhkarEntry) => {
    const p = e.kind === 'quran' ? quranPassages(e)[0]! : null;
    return p ? `Quran ${p.surah}:${p.ayahs[0]!.n}${p.ayahs.length > 1 ? `–${p.ayahs.at(-1)!.n}` : ''}` : `${e.source.collection} ${e.source.number}${e.weak ? ' · Da\'if' : ''}`;
};
/** Notification text for a moment: its adhkar in order, each complete and verbatim with its count and source, while they
 * fit PREVIEW_LETTERS (the first always does), then `more(n)` for the n left to read in the app, which the tap opens.
 * Consecutive adhkar from one narration (the riding verse and its istighfar) share one source line. */
export function momentPreview(m: Moment, more: (left: number) => string = n => `+${n}`): string | null {
    if (GENERAL_MOMENTS.includes(m)) return null;
    const all = entriesFor(m), shown: AdhkarEntry[] = [];
    let used = 0;
    for (const e of all) {
        const n = letters(displayText(e));
        if (shown.length && used + n > PREVIEW_LETTERS) break;
        shown.push(e); used += n;
    }
    const lines = shown.flatMap((e, i) => {
        const next = shown[i + 1], meta = `${e.repeat > 1 ? `×${e.repeat} · ` : ''}${sourceLine(e)}`;
        return next && e.repeat === 1 && next.source.ref === e.source.ref && e.kind !== 'quran' ? [displayText(e)] : [displayText(e), meta];
    });
    if (shown.length < all.length) lines.push(more(all.length - shown.length));
    return lines.join('\n');
}
/** The body of one notification for moments detected together, as the native engines build it (SmartReminders.swift
 * post, SmartEngine.java post): each moment's text under its title when there are several, and a dhikr already shown for
 * an earlier moment is not repeated. */
export function groupedBody(moments: readonly Moment[], copy: NativeConfig['copy']): string {
    const own = moments.filter(m => copy[m] && !copy[m]!.general), use = own.length ? own : moments.slice(0, 1);
    if (use.length === 1) return copy[use[0]!]?.body ?? '';
    const seen = new Set<string>();
    return use.map(m => {
        const kept = (copy[m]!.body).split('\n').filter(l => { if (!/[\u064B-\u0652]/.test(l)) return true; if (seen.has(l)) return false; seen.add(l); return true; });
        return `${copy[m]!.title}\n${kept.join('\n')}`;
    }).join('\n\n');
}
/** Place or vehicle reminders are on but iPhone no longer lets AyahFlow use location in the background (for example
 * after "Change to Only While Using"): nothing can be detected until Location is set to Always again. */
export function backgroundBlocked(state: AppState, status: SmartStatus | null): boolean {
    return (state.smart.location || state.smart.vehicle) && !!status && status.location !== 'always';
}
/** How each automatic adhkar reminder stands, from the saved settings and what the phone reports, so the Reminders
 * screen can say plainly which ones work and why the others do not. `on` means set up and allowed, never that delivery
 * is guaranteed: iOS and Android may delay or drop background events. */
export type AutoState = 'on' | 'off' | 'setup' | 'permission' | 'paused' | 'unavailable';
export interface AutoStatus { moment: Moment; state: AutoState; reason: string }
export const AUTO_MOMENTS = ['vehicle', 'leave_home', 'enter_home', 'sleep'] as const satisfies readonly Moment[];
export function autoStatus(state: AppState, status: SmartStatus | null, notifications: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | null, native: boolean): AutoStatus[] {
    return AUTO_MOMENTS.map(moment => {
        const s = (st: AutoState, reason: string): AutoStatus => ({ moment, state: st, reason });
        if (!native) return s('unavailable', 'autoWebOnly');
        if (!state.smart.moments.includes(moment)) return s('off', 'autoMomentOff');
        if (moment === 'sleep') {
            if (!state.smart.timed) return s('off', 'autoTimedOff');
            if (!state.smart.sleepTime) return s('setup', 'autoNeedBedtime');
        } else if (moment === 'vehicle') {
            if (!state.smart.vehicle) return s('off', 'autoVehicleOff');
        } else {
            if (!state.smart.location) return s('off', 'autoPlacesOff');
            if (!state.places.home) return s('setup', 'autoNeedHome');
        }
        if (notifications !== 'granted') return s('permission', 'autoNeedNotifications');
        if (moment === 'sleep') return s('on', 'autoOnBedtime');
        if (!status) return s('unavailable', 'autoNoStatus');
        if (status.location !== 'always') return s('permission', 'autoNeedAlways');
        if (status.backgroundRefresh === 'off' || status.backgroundRefresh === 'restricted') return s('paused', 'autoBackgroundRefresh');
        if (moment === 'vehicle') {
            if (status.vehicleWatch === false) return s('unavailable', 'autoNoVehicleWatch');
            return s('on', status.motion === 'granted' ? 'autoOnVehicle' : 'autoOnSpeedOnly');
        }
        if (status.monitoring && !status.monitoring.includes('home')) return s('unavailable', 'autoNotWatchingHome');
        return s('on', 'autoOnPlace');
    });
}
export function mergeDetections(existing: Detection[], events: { event: Detection['event']; at: number; detail?: string; moments?: Moment[] }[]): Detection[] {
    const seen = new Set(existing.map(d => `${d.event}@${d.at}`));
    return [...existing, ...events.filter(e => !seen.has(`${e.event}@${e.at}`)).map(e => ({ event: e.event, at: e.at, ...(e.detail ? { detail: e.detail.slice(0, 160) } : {}), ...(e.moments?.length ? { moments: e.moments.filter(m => (MOMENTS as readonly string[]).includes(m)) } : {}) }))].sort((a, b) => a.at - b.at).slice(-50);
}

// ---- Athan and widget ---------------------------------------------------------------------------
const PRAYER_CODE: Record<PrayerName, number> = { fajr: 4, dhuhr: 5, asr: 6, maghrib: 7, isha: 8 };
/** Stable athan notification id per prayer and prayer day (codes 4-8; adhkar reminders use 1-3). Keyed on the day the
 * prayer belongs to, not the date it falls on: an Isha just after midnight and the next one just before would otherwise
 * share an id, and the second alert would replace the first. */
export function athanId(prayer: PrayerName, day: string): number { return PRAYER_CODE[prayer] * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
/** `day` is the local day the prayer belongs to (an Isha after midnight belongs to the day before). */
export interface PrayerAt { prayer: PrayerName; at: number; day: string }
/** Prayer times from the saved place for `days` days starting today, led by any of yesterday's that are still to come
 * (at high latitudes in summer, Isha can fall after midnight), in time order. Near the solstice some methods' high-latitude
 * rules put yesterday's Isha up to a few minutes after today's Fajr; both stay, in the order they occur. Empty without a
 * saved place. */
export function prayersFrom(state: AppState, now = Date.now(), days = 7): PrayerAt[] {
    const out: PrayerAt[] = [];
    for (let i = -1; i < days; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const t = timesFor(state, d);
        if (t) for (const p of PRAYERS) if (i >= 0 || t[p] > now) out.push({ prayer: p, at: t[p], day: dayKey(d.getTime()) });
    }
    return out.sort((a, b) => a.at - b.at || a.day.localeCompare(b.day));
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
        if (times && dayKey(d.getTime()) === next.day) return { next, times, tomorrow: i > 0, day: dayKey(d.getTime()) };
    }
    return null;
}
/** `reciter` is a bundled recording id or 'custom'; null means the gentle system alert. */
export interface AthanAlert { id: number; at: number; prayer: PrayerName; title: string; body: string; reciter: string | null; customVersion: number | null; homeOnly: boolean }
/** The athan plays only at Home (soft chime elsewhere): needs the athan sound, the switch and a saved Home. */
export function athanHomeOnly(state: AppState): boolean { const a = state.athan; return a.enabled && a.sound === 'athan' && a.awayChime && state.places.home !== null; }
/** Athan alerts for the next PLAN_DAYS days (ATHAN_MAX at most, the soonest, within iOS's 64 pending notifications). */
export function athanSchedule(state: AppState, label: (p: PrayerName, at: number) => { title: string; body: string }, now = Date.now()): AthanAlert[] {
    if (!state.athan.enabled) return [];
    return prayersFrom(state, now, PLAN_DAYS).filter(p => p.at > now && state.athan.prayers[p.prayer]).slice(0, ATHAN_MAX).map(p => ({ id: athanId(p.prayer, p.day), at: p.at, prayer: p.prayer, ...label(p.prayer, p.at), reciter: state.athan.sound === 'chime' ? null : p.prayer === 'fajr' ? state.athan.fajrReciter : state.athan.reciter, customVersion: state.athan.custom?.version ?? null, homeOnly: athanHomeOnly(state) }));
}
// ---- Reminder before a prayer -------------------------------------------------------------------
const BEFORE_CODE: Record<PrayerName, number> = { fajr: 18, dhuhr: 19, asr: 20, maghrib: 21, isha: 22 };
/** Ids 18–22 × 10⁶ + yymmdd of the prayer day, clear of adhkar (1–3), athan (4–8), istighfar (9–11), rotation (12) and
 * check-ins (13–17), so replacing these never touches an athan. */
export function beforeId(prayer: PrayerName, day: string): number { return BEFORE_CODE[prayer] * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
/** Test notifications from the prayer settings: one id each, replaced on every tap. */
export const TEST_BEFORE_ID = 23000001, TEST_ATHAN_ID = 23000002;
export interface BeforeAlert { id: number; at: number; prayer: PrayerName; day: string; title: string; body: string }
/** A gentle reminder `minutes` before each prayer chosen for notifications (sunrise is not a prayer, so never), for the
 * next two days (BEFORE_MAX at most). Independent of the athan switch, so either can be off. A reminder whose time has
 * already passed is left out rather than sent late. Times come from timesFor: the saved place, method and Asr setting. */
export function beforeSchedule(state: AppState, label: (p: PrayerName, minutes: number) => { title: string; body: string }, now = Date.now()): BeforeAlert[] {
    const b = state.athan.before;
    if (!b.enabled) return [];
    const lead = b.minutes * 60000;
    return prayersFrom(state, now, 2).filter(p => state.athan.prayers[p.prayer] && p.at - lead > now).slice(0, BEFORE_MAX)
        .map(p => ({ id: beforeId(p.prayer, p.day), at: p.at - lead, prayer: p.prayer, day: p.day, ...label(p.prayer, b.minutes) }));
}
/** What the home-screen widgets show. Computed here so the app stays the single source of prayer times. */
/** Today's dhikr counts and adhkar progress, for the widget (self-reported taps and confirmations only). */
export interface WidgetDaily { day: string; counters: { id: string; label: string; n: number; total: number; atLeast: boolean; perPrayer: boolean }[]; adhkar: { key: Moment; label: string; labelAr: string; firstAr?: string; done: number; total: number }[] }
export interface WidgetData { v: 1; updatedAt: number; rtl: boolean; locale: string; prayers: { key: PrayerName; label: string; at: number; day: string }[]; windows: { morning: [number, number] | null; evening: [number, number] | null }[]; labels: Record<string, string>; daily: WidgetDaily | null; ayahs: ReturnType<typeof dailyAyahs>; worship?: WidgetWorship; upcoming?: { at: number; day: string; kind: 'jumuah' | 'fast' | 'ramadan' | 'occasion'; title: string; sub: string; short?: string; lunar: boolean }[]; ramadan?: { start: number; eid: number } | null }
/** Prayers the user confirmed (today and yesterday, so midnight does not blank them) and the Ayah of the Moment for the
 * next half-hour slots, so the widget can follow without the app (within the system's refresh limits). */
export interface WidgetWorship { salah: { day: string; kept: PrayerName[] }[]; moments: { at: number; surah: number; ayah: number; ref: string; text: string; name: string; nameAr: string }[] }
export function widgetData(state: AppState, label: (key: string) => string, now = Date.now(), extra: Record<string, string> = {}, daily: WidgetDaily | null = null, worship?: WidgetWorship): WidgetData {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d; });
    return {
        v: 1, updatedAt: now, rtl: state.locale === 'ar', locale: state.locale,
        prayers: prayersFrom(state, now).map(p => ({ key: p.prayer, label: label('p_' + p.prayer), at: p.at, day: p.day })),
        windows: days.map(d => { const w = windowsFor(state, d); return { morning: w.morning, evening: w.evening }; }),
        labels: { next: label('nextPrayer'), noPlace: label('widgetNoPlace'), stale: label('widgetStale'), morning: label('m_morning'), evening: label('m_evening'), today: label('prayerTimes'), app: 'AyahFlow', prayerTab: label('widgetPrayer'), dhikrTab: label('widgetDhikr'), momentsTab: label('widgetMoments'), momentsTitle: label('widgetMomentsTitle'), quranTab: label('widgetQuran'), upcomingShort: label('widgetUpcomingShort'), dhikrTitle: label('widgetDhikrTitle'), upcomingTitle: label('widgetUpcomingTitle'), m_vehicle: label('m_vehicle'), m_leave_home: label('m_leave_home'), m_enter_home: label('m_enter_home'), m_sleep: label('m_sleep'), todaysAdhkar: label('widgetTodaysAdhkar'), rounds: label('rounds'), updated: label('widgetUpdated'), ayahTab: label('ayahOfDay'), surahRef: label('surahRef'), ayahEmpty: label('ayahWidgetEmpty'), momentTab: label('ayahMoment'), prayed: label('widgetPrayed'), readAyah: label('readInContext'), ...extra },
        daily,
        ayahs: dailyAyahs(now),
        ...(worship ? { worship } : {}),
    };
}
