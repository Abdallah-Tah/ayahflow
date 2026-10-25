/** Daily worship, pure: the Ayah of the Moment rotation, short recitation suggestions, prayer progress and the gentle
 * check-in reminders. No DOM, storage or native calls. Quran text is always read from the Tanzil corpus (data.ts). */
import { SURAH_DATA, chapter, verse } from './data.js';
import { dayKey, rng, shuffle, salahStatus, tasbihOn, PRAYERS, type AppState, type PrayerName, type SalahStatus } from './engine.js';
import { counter, TASBIH_VARIANTS } from './adhkar.js';
import { timesFor, SALAH_MAX } from './smart.js';
export { SALAH_MAX };

// ---- Ayah of the Moment --------------------------------------------------------------------------
/** A new ayah every half hour of local time (slots start at :00 and :30). */
export const SLOT_MINUTES = 30;
/** Ayahs shown whole on one card: long ones and stand-alone opening letters (e.g. الٓمٓ) are left out. */
export const MOMENT_MIN_LETTERS = 12, MOMENT_MAX_LETTERS = 260;
const letters = (s: string) => s.replace(/[^ء-يٱ]/g, '').length;
let pool: (readonly [number, number])[] | null = null;
/** Every eligible ayah once, in a fixed shuffled order, so consecutive slots never repeat until the pool is used up
 * (about 100 days). The order is the same on every device, so the app and the widget agree. */
export function momentPool(): readonly (readonly [number, number])[] {
    if (!pool) {
        const all = SURAH_DATA.flatMap(s => s.verses.flatMap((v, i) => { const n = letters(v); return n >= MOMENT_MIN_LETTERS && n <= MOMENT_MAX_LETTERS ? [[s.id, i + 1] as const] : []; }));
        pool = shuffle(all, rng(0x41594148));
    }
    return pool;
}
/** Local half-hour slot number of a time: whole local days since 2000-01-01 × 48 + half hours since local midnight. */
export function slotOf(at: number): number {
    const d = new Date(at), days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2000, 0, 1)) / 86400000);
    return days * (1440 / SLOT_MINUTES) + Math.floor((d.getHours() * 60 + d.getMinutes()) / SLOT_MINUTES);
}
/** When a slot starts and ends (local time). */
export function slotRange(slot: number): [number, number] {
    const perDay = 1440 / SLOT_MINUTES, day = Math.floor(slot / perDay), within = slot - day * perDay;
    const base = new Date(2000, 0, 1 + day), start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, within * SLOT_MINUTES).getTime();
    return [start, start + SLOT_MINUTES * 60000];
}
export function ayahOfMoment(slot: number): { surah: number; ayah: number } {
    const p = momentPool(), [surah, ayah] = p[((slot % p.length) + p.length) % p.length]!;
    return { surah, ayah };
}
/** The next `count` slots from `now`, with their text, for the widget timeline (the text is the corpus string as is). */
export function upcomingMoments(now = Date.now(), count = 48): { at: number; surah: number; ayah: number; ref: string; text: string; name: string; nameAr: string }[] {
    const first = slotOf(now);
    return Array.from({ length: count }, (_, i) => { const slot = first + i, a = ayahOfMoment(slot), c = chapter(a.surah); return { at: slotRange(slot)[0], ...a, ref: `${a.surah}:${a.ayah}`, text: verse(a.surah, a.ayah), name: c.name, nameAr: c.ar }; });
}

// ---- Short recitations for Salah -----------------------------------------------------------------
/** Complete passages from longer surahs, by reference only (the Arabic comes from the corpus). Each ends where its
 * sentence ends: 23:1–11 (not 1–5, as 23:6 continues 23:5) and 76:1–6 (76:6 continues 76:5). Optional suggestions for
 * one's own recitation; no passage is prescribed for any prayer. Selection awaits scholar review. */
export const RECITATIONS: readonly { id: string; surah: number; from: number; to: number }[] = [
    { id: 'mulk', surah: 67, from: 1, to: 5 },
    { id: 'rahman', surah: 55, from: 1, to: 13 },
    { id: 'muminun', surah: 23, from: 1, to: 11 },
    { id: 'hashr', surah: 59, from: 21, to: 24 },
    { id: 'insan', surah: 76, from: 1, to: 6 },
    { id: 'baqarah-start', surah: 2, from: 1, to: 5 },
    { id: 'kursi', surah: 2, from: 255, to: 255 },
    { id: 'baqarah-end', surah: 2, from: 285, to: 286 },
    { id: 'imran-190', surah: 3, from: 190, to: 194 },
    { id: 'nur-35', surah: 24, from: 35, to: 35 },
    { id: 'naba', surah: 78, from: 1, to: 16 },
    { id: 'fajr-27', surah: 89, from: 27, to: 30 },
];
export const RECITATIONS_REVIEW = 'awaiting-scholar-review';
export function recitation(id: string): { id: string; surah: number; from: number; to: number; ayahs: { n: number; text: string }[] } {
    const r = RECITATIONS.find(x => x.id === id);
    if (!r) throw new Error('Unknown recitation');
    return { ...r, ayahs: Array.from({ length: r.to - r.from + 1 }, (_, i) => ({ n: r.from + i, text: verse(r.surah, r.from + i) })) };
}

// ---- Prayer progress -----------------------------------------------------------------------------
/** Prayers counted as confirmed: prayed on time ('done') or made up later ('madeUp'). */
const kept = (s: SalahStatus | null) => s === 'done' || s === 'madeUp';
export function daySummary(state: AppState, day: string): { done: number; missed: number; madeUp: number; open: number; statuses: Record<PrayerName, SalahStatus | null> } {
    const statuses = Object.fromEntries(PRAYERS.map(p => [p, salahStatus(state, day, p)])) as Record<PrayerName, SalahStatus | null>;
    const v = Object.values(statuses);
    return { done: v.filter(x => x === 'done').length, missed: v.filter(x => x === 'missed').length, madeUp: v.filter(x => x === 'madeUp').length, open: v.filter(x => x === null).length, statuses };
}
const back = (now: number, i: number) => { const d = new Date(now); d.setDate(d.getDate() - i); return dayKey(d.getTime()); };
/** Days in a row with all five prayers confirmed, ending today (or yesterday while today is still open). */
export function salahStreak(state: AppState, now = Date.now()): number {
    const full = (day: string) => PRAYERS.every(p => kept(salahStatus(state, day, p)));
    let i = full(dayKey(now)) ? 0 : 1, n = 0;
    while (i < 3660 && full(back(now, i))) { n++; i++; }
    return n;
}
/** Last 7 local days, oldest first, with what was confirmed each day. */
export function salahWeek(state: AppState, now = Date.now()): { day: string; kept: number; missed: number }[] {
    return Array.from({ length: 7 }, (_, i) => { const day = back(now, 6 - i), s = daySummary(state, day); return { day, kept: s.done + s.madeUp, missed: s.missed }; });
}
/** Encouraging, private figures over the last `days` days: confirmations per prayer and the share of the five that
 * were confirmed. Unconfirmed prayers are only "not recorded", never counted as missed. */
export function salahInsights(state: AppState, now = Date.now(), days = 30): { perPrayer: Record<PrayerName, number>; confirmed: number; possible: number; best: PrayerName | null; recordedDays: number } {
    const perPrayer = Object.fromEntries(PRAYERS.map(p => [p, 0])) as Record<PrayerName, number>;
    let confirmed = 0, recordedDays = 0;
    for (let i = 0; i < days; i++) {
        const day = back(now, i);
        let any = false;
        for (const p of PRAYERS) { const s = salahStatus(state, day, p); if (s) any = true; if (kept(s)) { perPrayer[p]++; confirmed++; } }
        if (any) recordedDays++;
    }
    const best = confirmed ? PRAYERS.reduce((a, b) => perPrayer[b] > perPrayer[a] ? b : a) : null;
    return { perPrayer, confirmed, possible: days * 5, best, recordedDays };
}
/** Whether the post-prayer tasbih of a prayer is complete in the given variant. */
export function tasbihDone(state: AppState, day: string, prayer: PrayerName, id = state.worship.prefs.tasbihVariant): boolean { return tasbihOn(state, day, prayer, id) >= counter(id).total; }
export function anyTasbihDone(state: AppState, day: string, prayer: PrayerName): boolean { return TASBIH_VARIANTS.some(id => tasbihDone(state, day, prayer, id)); }

// ---- Gentle check-in reminders -------------------------------------------------------------------
/** Ids 13–17 × 10⁶ + yymmdd (one per prayer and day), clear of adhkar (1–3), athan (4–8), istighfar (9–11) and
 * rotation (12). At most SALAH_MAX are pending, within iOS's 64. */
export function salahReminderId(prayer: PrayerName, day: string): number { return (13 + PRAYERS.indexOf(prayer)) * 1000000 + Number(day.slice(2).replace(/-/g, '')); }
export interface SalahReminder { id: number; at: number; prayer: PrayerName; kind: 'checkIn' | 'tasbih'; title: string; body: string; url: string }
/** At most one reminder per prayer: if it is not confirmed, a check-in `checkInAfter` minutes after its time (only
 * while the next prayer has not begun); if it was confirmed recently and the tasbih is not finished, a tasbih nudge.
 * Nothing for prayers already confirmed and finished, and nothing that suggests a prayer was missed. */
export function salahReminders(state: AppState, copy: (prayer: PrayerName, kind: 'checkIn' | 'tasbih') => { title: string; body: string }, now = Date.now()): SalahReminder[] {
    const p = state.worship.prefs;
    if (!p.checkIn && !p.tasbihNudge) return [];
    const out: SalahReminder[] = [];
    for (let i = 0; i < 2 && out.length < SALAH_MAX; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        const t = timesFor(state, d), day = dayKey(d.getTime());
        if (!t) return [];
        PRAYERS.forEach((prayer, k) => {
            if (out.length >= SALAH_MAX) return;
            const status = salahStatus(state, day, prayer), ends = k < 4 ? t[PRAYERS[k + 1]!] : t.isha + 3 * 3600000;
            let at: number | null = null, kind: 'checkIn' | 'tasbih' = 'checkIn';
            if (status === null && p.checkIn) at = Math.min(t[prayer] + p.checkInAfter * 60000, ends - 10 * 60000);
            else if (status === 'done' && p.tasbihNudge && !anyTasbihDone(state, day, prayer)) {
                const confirmedAt = state.worship.salah.find(r => r.day === day && r.prayer === prayer)!.at;
                if (now - confirmedAt < 30 * 60000) { at = confirmedAt + 10 * 60000; kind = 'tasbih'; }
            }
            if (at === null || at <= now || at <= t[prayer]) return;
            out.push({ id: salahReminderId(prayer, day), at, prayer, kind, ...copy(prayer, kind), url: kind === 'tasbih' ? `ayahflow://tasbih/${prayer}` : `ayahflow://salah/${prayer}` });
        });
    }
    return out;
}
