/** Fajr wake-up alarm: which days and times to ring. Pure, so the plan is tested in Node.
 * iOS 26+ rings it with AlarmKit (sounds through Silent and Focus, full-screen on the Lock Screen); elsewhere it falls
 * back to an ordinary notification, and the app says so. Nothing here uses the network. */
import { dayKey, type AppState } from './engine.js';
import { timesFor, ALARM_FALLBACK_DAYS } from './smart.js';

/** Alarms planned ahead with AlarmKit (rescheduled whenever the app syncs, as Fajr moves a little each day). */
export const ALARM_DAYS = 7;
/** Wake check: minutes after Stop before the follow-up ring (cancelled once the user confirms in the app). */
export const ALARM_CHECK_MINUTES = 5;
/** Never later than this before sunrise, whatever the offset: Fajr ends at sunrise. */
export const ALARM_SUNRISE_MARGIN = 15;
/** Fallback notification ids: 26 × 10⁶ + yymmdd, clear of every other reminder (calendar.ts uses 24 and 25). */
export const ALARM_CODE = 26;
export interface FajrAlarmTime { day: string; at: number; fajr: number; sunrise: number; id: number; uuid: string }
const yymmdd = (day: string) => day.slice(2).replace(/-/g, '');
/** AlarmKit identifies alarms by UUID: one stable UUID per day, so planning again replaces rather than duplicates. */
export const alarmUuid = (day: string) => `FA0A0000-0000-4000-8000-000000${yymmdd(day)}`;
export const alarmDayOf = (uuid: string): string | null => { const m = /^FA0A0000-0000-4000-8000-000000(\d{2})(\d{2})(\d{2})$/i.exec(uuid); return m ? `20${m[1]}-${m[2]}-${m[3]}` : null; };
/** Fajr + offset for the next `days` local days (today included while still ahead), clamped to end
 * ALARM_SUNRISE_MARGIN minutes before sunrise. Empty when the alarm is off or no place is saved for prayer times. */
export function fajrAlarmPlan(state: AppState, now = Date.now(), days = ALARM_DAYS): FajrAlarmTime[] {
    if (!state.fajrAlarm.enabled) return [];
    const out: FajrAlarmTime[] = [];
    for (let i = 0; i <= days && out.length < days; i++) {
        const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
        const t = timesFor(state, d);
        if (!t) return [];
        const at = Math.min(t.fajr + state.fajrAlarm.offset * 60000, t.sunrise - ALARM_SUNRISE_MARGIN * 60000);
        if (at <= now) continue;
        const day = dayKey(d.getTime());
        out.push({ day, at, fajr: t.fajr, sunrise: t.sunrise, id: ALARM_CODE * 1000000 + Number(yymmdd(day)), uuid: alarmUuid(day) });
    }
    return out;
}
/** Without AlarmKit only the next ALARM_FALLBACK_DAYS go out as notifications (iOS keeps 64 pending in all). */
export const fallbackPlan = (plan: FajrAlarmTime[]) => plan.slice(0, ALARM_FALLBACK_DAYS);
