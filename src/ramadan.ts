/** Ramadan: the day of the month, suhoor and iftar from the prayer times, the odd nights of the last ten, and the days
 * until it begins. Pure, so tested in Node. Dates are Umm al-Qura (calendar.ts); local sighting may differ by a day. */
import RAMADAN_DATA from './ramadan-data.js';
import { type AppState } from './engine.js';
import { timesFor } from './smart.js';
import { ramadanDay } from './calendar.js';
export const RAMADAN_TEXT = RAMADAN_DATA.items;
export interface RamadanToday { day: number; suhoorEnds: number | null; iftar: number | null; lastTen: boolean; oddNight: number | null; tonight: number }
/** Today in Ramadan, or null. `tonight` is the night that begins at this evening's Maghrib (the next Hijri day); it is an
 * odd night of the last ten when it is the 21st, 23rd, 25th, 27th or 29th. */
export function ramadanToday(state: AppState, now = Date.now()): RamadanToday | null {
    const date = new Date(now), day = ramadanDay(date);
    if (day === null) return null;
    const t = timesFor(state, date), tonight = day + 1;
    return { day, suhoorEnds: t?.fajr ?? null, iftar: t?.maghrib ?? null, lastTen: tonight >= 21, oddNight: tonight >= 21 && tonight % 2 === 1 && tonight <= 29 ? tonight : null, tonight };
}
/** Days until 1 Ramadan, when it is within `within` days; null otherwise (and during Ramadan). */
export function daysToRamadan(now = Date.now(), within = 30): number | null {
    for (let i = 1; i <= within; i++) {
        const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
        if (ramadanDay(d) === 1) return ramadanDay(new Date(now)) === null ? i : null;
    }
    return null;
}
