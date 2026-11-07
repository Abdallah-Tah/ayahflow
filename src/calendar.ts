/** Jumu'ah and voluntary-fast reminders. Pure, so the dates are tested in Node.
 * Hijri dates use the Umm al-Qura calendar built into the system (Intl, `islamic-umalqura`); local moon sighting may
 * differ by a day, and the app says so wherever a Hijri date is shown. Nothing here uses the network. */
import { dayKey, type AppState } from './engine.js';
import { timesFor, sleepWindow, FAST_MAX, RAMADAN_DAYS, OCCASION_MAX } from './smart.js';

export interface HijriDate { day: number; month: number; year: number }
const hijriFormat = new Map<string, Intl.DateTimeFormat>();
/** The user's correction to the Umm al-Qura date (Settings: -1, 0 or +1 day, to match local moon sighting). Every Hijri
 * date in the app goes through hijriDate or hijriBase, so holidays, Ramadan and reminders all follow it. */
let hijriShift = 0;
export function setHijriOffset(days: number): void { hijriShift = days === -1 || days === 1 ? days : 0; }
/** The local day whose Umm al-Qura date is shown for `date` (at noon, away from midnight). */
export function hijriBase(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + hijriShift, 12); }
/** The Hijri date of a local day: Umm al-Qura with the user's correction, or null where Intl lacks the calendar. */
export function hijriDate(date: Date): HijriDate | null {
    try {
        const f = hijriFormat.get('n') ?? new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
        hijriFormat.set('n', f);
        const parts = f.formatToParts(hijriBase(date));
        const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
        const d = { day: get('day'), month: get('month'), year: get('year') };
        return Number.isInteger(d.day) && Number.isInteger(d.month) && d.month >= 1 && d.month <= 12 ? d : null;
    } catch { return null; }
}

export type FastReason = 'monday' | 'thursday' | 'white';
/** Days a voluntary fast is never suggested: all of Ramadan (already obligatory), Eid al-Fitr (1 Shawwal), Eid al-Adha
 * (10 Dhu al-Hijjah) and the days of Tashreeq (11–13 Dhu al-Hijjah). */
export function fastingExcluded(h: HijriDate): boolean {
    return h.month === 9 || (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13);
}
/** Why a day is a common voluntary fast: Monday, Thursday, or the 13th–15th of the Hijri month ("white days"). Empty
 * when it is none of them, when it is excluded above, or when the Hijri date is unknown (white days need it). */
export function fastingReasons(date: Date): FastReason[] {
    const h = hijriDate(date);
    if (h && fastingExcluded(h)) return [];
    const out: FastReason[] = [];
    if (date.getDay() === 1) out.push('monday');
    if (date.getDay() === 4) out.push('thursday');
    if (h && h.day >= 13 && h.day <= 15) out.push('white');
    return out;
}
/** Voluntary-fast days in the next `days` local days, starting tomorrow (today's fast has already begun or not). */
export function upcomingFasts(now: number, days: number): { day: string; date: Date; reasons: FastReason[]; hijri: HijriDate | null }[] {
    const out = [];
    for (let i = 1; i <= days; i++) {
        const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
        const reasons = fastingReasons(d);
        if (reasons.length) out.push({ day: dayKey(d.getTime()), date: d, reasons, hijri: hijriDate(d) });
    }
    return out;
}

/** Day of Ramadan (1–30) on a local date, or null outside Ramadan or where the Hijri date is unknown. */
export function ramadanDay(date: Date): number | null { const h = hijriDate(date); return h && h.month === 9 ? h.day : null; }
/** Ids 24 × 10⁶ + yymmdd (Jumu'ah, of the Friday), 25 × 10⁶ + yymmdd (fast, of the fasting day), 27 (suhoor) and 28
 * (iftar): clear of adhkar (1–3), athan (4–8), istighfar (9–11), rotation (12), check-ins (13–17), before-prayer (18–22),
 * tests (23) and the Fajr alarm fallback (26); 29 × 10⁶ + yymmdd for an Islamic occasion (of the occasion's day). */
export const JUMUAH_CODE = 24, FAST_CODE = 25, SUHOOR_CODE = 27, IFTAR_CODE = 28, OCCASION_CODE = 29;
/** Suhoor reminder this long before Fajr (when eating must stop); iftar reminder this long before Maghrib. */
export const SUHOOR_BEFORE = 45, IFTAR_BEFORE = 10;
const idFor = (code: number, day: string) => code * 1000000 + Number(day.slice(2).replace(/-/g, ''));
export interface CalendarReminder { id: number; at: number; kind: 'jumuah' | 'fast' | 'suhoor' | 'iftar' | 'occasion'; day: string; title: string; body: string; url: string }
export interface CalendarCopy {
    jumuah: { title: string; body: string };
    fast: (reasons: FastReason[], hijri: HijriDate | null) => { title: string; body: string };
    suhoor?: (fajr: number) => { title: string; body: string };
    iftar?: (maghrib: number) => { title: string; body: string };
    occasion?: (kind: OccasionKind) => { title: string; body: string };
}
/** Friday: 90 minutes before Dhuhr (10:30 without a saved place), opening Al-Kahf. Fast: the evening before at 20:30,
 * or 30 minutes before the sleep time when that is earlier. Nothing already past is planned. */
export function calendarReminders(state: AppState, copy: CalendarCopy, now = Date.now()): CalendarReminder[] {
    const out: CalendarReminder[] = [];
    if (state.calendar.jumuah) {
        for (let i = 0; i < 8; i++) {
            const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
            if (d.getDay() !== 5) continue;
            const t = timesFor(state, d), at = t ? t.dhuhr - 90 * 60000 : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 30).getTime();
            if (at <= now) continue;
            const day = dayKey(d.getTime());
            out.push({ id: idFor(JUMUAH_CODE, day), at, kind: 'jumuah', day, ...copy.jumuah, url: 'ayahflow://ayah/18:1' });
            break;
        }
    }
    if (state.calendar.fasting) {
        for (const f of upcomingFasts(now, 8)) {
            const eve = new Date(f.date); eve.setDate(eve.getDate() - 1);
            const sleep = sleepWindow(state, eve)?.[0] ?? null, usual = new Date(eve.getFullYear(), eve.getMonth(), eve.getDate(), 20, 30).getTime();
            const at = sleep !== null && sleep - 30 * 60000 < usual ? sleep - 30 * 60000 : usual;
            if (at <= now) continue;
            out.push({ id: idFor(FAST_CODE, f.day), at, kind: 'fast', day: f.day, ...copy.fast(f.reasons, f.hijri), url: 'ayahflow://prayer' });
            if (out.filter(r => r.kind === 'fast').length >= FAST_MAX) break;
        }
    }
    // Ramadan: the next RAMADAN_DAYS days that are in Ramadan (Umm al-Qura), suhoor before Fajr and iftar before Maghrib.
    if ((state.calendar.suhoor && copy.suhoor) || (state.calendar.iftar && copy.iftar)) {
        let days = 0;
        for (let i = 0; i < 8 && days < RAMADAN_DAYS; i++) {
            const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
            const t = timesFor(state, d);
            if (!t || ramadanDay(d) === null) continue;
            const day = dayKey(d.getTime());
            if (state.calendar.suhoor && copy.suhoor && t.fajr - SUHOOR_BEFORE * 60000 > now) out.push({ id: idFor(SUHOOR_CODE, day), at: t.fajr - SUHOOR_BEFORE * 60000, kind: 'suhoor', day, ...copy.suhoor(t.fajr), url: 'ayahflow://home' });
            if (state.calendar.iftar && copy.iftar && t.maghrib - IFTAR_BEFORE * 60000 > now) out.push({ id: idFor(IFTAR_CODE, day), at: t.maghrib - IFTAR_BEFORE * 60000, kind: 'iftar', day, ...copy.iftar(t.maghrib), url: 'ayahflow://home' });
            days++;
        }
    }
    // Islamic occasions, each the evening before (as the fasts): the OCCASION_MAX soonest of those switched on.
    const on = state.calendar.occasions, kinds = OCCASION_SWITCH.filter(([, k]) => on[k]).map(([kind]) => kind);
    if (kinds.length && copy.occasion) {
        let n = 0;
        for (const o of islamicOccasions(now, 60)) {
            if (!kinds.includes(o.kind) || n >= OCCASION_MAX) continue;
            const eve = new Date(o.at); eve.setDate(eve.getDate() - 1);
            const sleep = sleepWindow(state, eve)?.[0] ?? null, usual = new Date(eve.getFullYear(), eve.getMonth(), eve.getDate(), 20, 30).getTime();
            const at = sleep !== null && sleep - 30 * 60000 < usual ? sleep - 30 * 60000 : usual;
            if (at <= now) continue;
            out.push({ id: idFor(OCCASION_CODE, o.day), at, kind: 'occasion', day: o.day, ...copy.occasion(o.kind), url: o.kind === 'eid-fitr' || o.kind === 'eid-adha' ? 'ayahflow://eid' : 'ayahflow://occasions' });
            n++;
        }
    }
    return out.sort((a, b) => a.at - b.at);
}
/** Which switch plans which occasion: Arafah; Tasu'a and Ashura; the first of Dhul Hijjah; the eve of each Eid. */
export const OCCASION_SWITCH: readonly [OccasionKind, keyof AppState['calendar']['occasions']][] = [['arafah', 'arafah'], ['tasua', 'ashura'], ['ashura', 'ashura'], ['dhul-hijjah-ten', 'dhulHijjah'], ['eid-fitr', 'eidEve'], ['eid-adha', 'eidEve']];

/** For the "Jumu'ah and fasts" widget: Fridays, voluntary-fast days and the first of Ramadan in the next `days` days
 * (today included), at most `max`. The widget names the day itself; nothing here is a reminder. */
export interface UpcomingDay { at: number; day: string; kind: 'jumuah' | 'fast' | 'ramadan'; title: string; sub: string }
export type UpcomingItem = Omit<UpcomingDay, 'kind'> & { kind: UpcomingDay['kind'] | 'occasion'; occ?: OccasionKind; short?: string };
export function upcomingDays(copy: { jumuah: string; jumuahSub: string; fast: string; why: (r: FastReason[]) => string; ramadan: string; ramadanSub: string }, now = Date.now(), days = 14, max = 6): UpcomingDay[] {
    const out: UpcomingDay[] = [];
    for (let i = 0; i < days && out.length < max; i++) {
        const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
        const day = dayKey(d.getTime()), noon = new Date(d); noon.setHours(12);
        if (ramadanDay(noon) === 1) out.push({ at: d.getTime(), day, kind: 'ramadan', title: copy.ramadan, sub: copy.ramadanSub });
        if (d.getDay() === 5) out.push({ at: d.getTime(), day, kind: 'jumuah', title: copy.jumuah, sub: copy.jumuahSub });
        const r = fastingReasons(noon);
        if (r.length) out.push({ at: d.getTime(), day, kind: 'fast', title: copy.fast, sub: copy.why(r) });
    }
    return out.slice(0, max);
}

/** Occasions of the Hijri year on Umm al-Qura dates (local sighting may differ by a day; Ramadan may have 29 or 30
 * days). The Prophet's birthday (12 Rabi' al-Awwal) is not listed: whether to mark it is disputed among scholars, and
 * a date in this list would read as a recommendation; the calendar view says so. */
export type OccasionKind = 'new-year' | 'tasua' | 'ashura' | 'ramadan-start' | 'last-ten' | 'ramadan-end' | 'eid-fitr' | 'dhul-hijjah-ten' | 'arafah' | 'eid-adha' | 'tashreeq';
export interface Occasion { kind: OccasionKind; day: string; at: number; days: number; hijri: HijriDate }
const FIXED: readonly [OccasionKind, number, number, number][] = [
    ['new-year', 1, 1, 1], ['tasua', 1, 9, 1], ['ashura', 1, 10, 1], ['ramadan-start', 9, 1, 1], ['last-ten', 9, 20, 1],
    ['eid-fitr', 10, 1, 1], ['dhul-hijjah-ten', 12, 1, 10], ['arafah', 12, 9, 1], ['eid-adha', 12, 10, 1], ['tashreeq', 12, 11, 3],
];
/** Occasions that have not ended, from today through the next `days` days, soonest first. `last-ten` is the 20th of
 * Ramadan: the first of the last ten nights begins at its Maghrib. `ramadan-end` is the last day before 1 Shawwal. */
export function islamicOccasions(now = Date.now(), days = 384): Occasion[] {
    const out: Occasion[] = [], dateAt = (i: number) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d; };
    for (let i = -12; i <= days; i++) {
        const d = dateAt(i), h = hijriDate(d);
        if (!h) continue;
        const add = (kind: OccasionKind, span: number) => { if (i + span - 1 >= 0) { const s = new Date(d); s.setHours(0, 0, 0, 0); out.push({ kind, day: dayKey(d.getTime()), at: s.getTime(), days: span, hijri: h }); } };
        for (const [kind, m, day, span] of FIXED) if (h.month === m && h.day === day) add(kind, span);
        if (h.month === 9 && hijriDate(dateAt(i + 1))?.month === 10) add('ramadan-end', 1);
    }
    return out;
}
/** The occasion covering a local day, if any (for the Eid view and the Today card). */
export function occasionOn(date: Date, kinds?: readonly OccasionKind[]): Occasion | null {
    const today = dayKey(date.getTime());
    return islamicOccasions(date.getTime(), 0).find(o => (!kinds || kinds.includes(o.kind)) && calendarSpan(o).includes(today)) ?? null;
}
export function calendarSpan(o: Occasion): string[] { return Array.from({ length: o.days }, (_, i) => { const d = new Date(o.at); d.setHours(12); d.setDate(d.getDate() + i); return dayKey(d.getTime()); }); }

/** The current or next Ramadan for the "Coming up" widget: local midnight of 1 Ramadan and of 1 Shawwal (Eid al-Fitr),
 * Umm al-Qura. The widget counts the days itself at each midnight, so the count stays right between app launches. */
export function ramadanSpan(now = Date.now()): { start: number; eid: number } | null {
    const mid = (i: number) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d; };
    for (let i = -30; i <= 384; i++) {
        if (ramadanDay(mid(i)) !== 1) continue;
        for (let j = i + 28; j <= i + 31; j++) {
            const h = hijriDate(mid(j));
            if (h?.month !== 10 || h.day !== 1) continue;
            if (j <= 0) break;
            const start = mid(i), eid = mid(j); start.setHours(0); eid.setHours(0);
            return { start: start.getTime(), eid: eid.getTime() };
        }
    }
    return null;
}
/** Occasions for the widget list (Eid, Arafah, Ashura...) in the next `days` days; the Ramadan start is the widget's
 * countdown, so it is not repeated here. */
export function upcomingOccasions(title: (k: OccasionKind) => string, sub: string, now = Date.now(), days = 14): UpcomingItem[] {
    return islamicOccasions(now, days).filter(o => o.kind !== 'ramadan-start').map(o => ({ at: Math.max(o.at, new Date(now).setHours(0, 0, 0, 0)), day: o.day, kind: 'occasion' as const, occ: o.kind, title: title(o.kind), sub }));
}
