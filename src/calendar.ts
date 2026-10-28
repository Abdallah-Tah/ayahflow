/** Jumu'ah and voluntary-fast reminders. Pure, so the dates are tested in Node.
 * Hijri dates use the Umm al-Qura calendar built into the system (Intl, `islamic-umalqura`); local moon sighting may
 * differ by a day, and the app says so wherever a Hijri date is shown. Nothing here uses the network. */
import { dayKey, type AppState } from './engine.js';
import { timesFor, sleepWindow, FAST_MAX } from './smart.js';

export interface HijriDate { day: number; month: number; year: number }
const hijriFormat = new Map<string, Intl.DateTimeFormat>();
/** The Umm al-Qura date of a local day (taken at noon, away from midnight), or null where Intl lacks the calendar. */
export function hijriDate(date: Date): HijriDate | null {
    try {
        const f = hijriFormat.get('n') ?? new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
        hijriFormat.set('n', f);
        const parts = f.formatToParts(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
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

/** Ids 24 × 10⁶ + yymmdd (Jumu'ah, of the Friday) and 25 × 10⁶ + yymmdd (fast, of the fasting day): clear of adhkar
 * (1–3), athan (4–8), istighfar (9–11), rotation (12), check-ins (13–17), before-prayer (18–22) and tests (23). */
export const JUMUAH_CODE = 24, FAST_CODE = 25;
const idFor = (code: number, day: string) => code * 1000000 + Number(day.slice(2).replace(/-/g, ''));
export interface CalendarReminder { id: number; at: number; kind: 'jumuah' | 'fast'; day: string; title: string; body: string; url: string }
export interface CalendarCopy {
    jumuah: { title: string; body: string };
    fast: (reasons: FastReason[], hijri: HijriDate | null) => { title: string; body: string };
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
    return out.sort((a, b) => a.at - b.at);
}
