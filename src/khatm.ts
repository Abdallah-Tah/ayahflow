/** Quran completion plan (khatm): pages of the Madinah Mushaf split over a chosen number of days. Pure, so tested in Node.
 * Progress is the last page the user finished: a forward page turn in the Mushaf reader from the next unread page, or
 * the page they set themselves. Turning a page is not proof of reading; the app says "reached", never "read". */
import { dayKey, PAGE_TOTAL, KHATM_DAYS, type AppState, type Khatm } from './engine.js';
export { KHATM_DAYS };

const dayIndex = (start: string, day: string) => Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000);
/** The last page due by the end of plan day `i` (0-based): an even share of the pages, rounded. */
export function dueBy(k: Khatm, i: number): number {
    const total = PAGE_TOTAL - k.from + 1;
    return i < 0 ? k.from - 1 : k.from - 1 + Math.round(total * Math.min(i + 1, k.days) / k.days);
}
export interface KhatmToday { day: number; daysLeft: number; from: number; to: number; reached: number; nextPage: number; total: number; done: number; behind: number; ahead: number; finished: boolean; endDay: string; overdue: boolean }
/** Today's portion and where the user stands. After the last day, everything left is due today. */
export function khatmToday(k: Khatm, day = dayKey()): KhatmToday {
    const i = Math.max(0, dayIndex(k.start, day)), overdue = i >= k.days;
    const from = dueBy(k, Math.min(i, k.days - 1) - 1) + 1, to = overdue ? PAGE_TOTAL : dueBy(k, i);
    const end = new Date(`${k.start}T12:00:00`); end.setDate(end.getDate() + k.days - 1);
    const total = PAGE_TOTAL - k.from + 1, done = Math.max(0, k.page - k.from + 1);
    return { day: Math.min(i, k.days - 1) + 1, daysLeft: Math.max(0, k.days - i), from: overdue ? Math.min(k.page + 1, PAGE_TOTAL) : from, to, reached: k.page, nextPage: Math.min(k.page + 1, PAGE_TOTAL), total, done, behind: Math.max(0, dueBy(k, i - 1) - k.page), ahead: Math.max(0, k.page - to), finished: k.page >= PAGE_TOTAL, endDay: dayKey(end.getTime()), overdue };
}
/** A new plan of `days` days from today, starting at page `from` (1, or where the user is). */
export function startKhatm(state: AppState, days: number, from: number, day = dayKey()): AppState {
    if (!(KHATM_DAYS as readonly number[]).includes(days) || !Number.isInteger(from) || from < 1 || from > PAGE_TOTAL) throw new Error('Invalid plan');
    return { ...state, khatm: { start: day, days, from, page: from - 1 } };
}
export const endKhatm = (state: AppState): AppState => ({ ...state, khatm: null });
/** Sets the last finished page (the user's own correction), within the plan. */
export function setKhatmPage(state: AppState, page: number): AppState {
    const k = state.khatm;
    if (!k || !Number.isInteger(page)) return state;
    const p = Math.max(k.from - 1, Math.min(PAGE_TOTAL, page));
    return p === k.page ? state : { ...state, khatm: { ...k, page: p } };
}
/** A forward turn from `fromPage` to the page after it finishes `fromPage`, but only when it was the next page of the
 * plan: jumping around the Mushaf (a bookmark, Al-Kahf on Friday) never moves the plan. */
export function turnedPage(state: AppState, fromPage: number, toPage: number): AppState {
    const k = state.khatm;
    return k && toPage === fromPage + 1 && fromPage === k.page + 1 ? setKhatmPage(state, fromPage) : state;
}
