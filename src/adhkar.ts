/** Adhkar library and the on-device reminder rules engine. Pure: no DOM, storage or native calls.
 * Content is generated from content/adhkar/ (verbatim hadith slices + Quran references), reviewStatus
 * 'awaiting-scholar-review'. A delivered reminder is never evidence of recitation: only explicit
 * completions (see AdhkarCompletion in engine.ts) count. */
import ADHKAR, { type AdhkarEntry, type PrayerSet, type HadithSource, type DhikrCounter, type RotationPhrase, type LibraryDhikr } from './adhkar-data.js';
import { chapter, verse } from './data.js';
export type { AdhkarEntry, PrayerSet, HadithSource, DhikrCounter, RotationPhrase, LibraryDhikr };
export const ADHKAR_REVIEW = ADHKAR.reviewStatus;
export const ADHKAR_DATASET = ADHKAR.dataset;
export const MOMENTS = ['morning', 'evening', 'leave_home', 'enter_home', 'vehicle', 'travel', 'work_arrive', 'work_leave', 'mosque_enter', 'mosque_leave', 'after_prayer', 'sleep', 'wake'] as const;
export type Moment = typeof MOMENTS[number];
/** Moments without a narrated supplication of their own: shown as general reminders, never as sunnah claims. */
export const GENERAL_MOMENTS: readonly Moment[] = [];
export const ADHKAR_ENTRIES: readonly AdhkarEntry[] = ADHKAR.adhkar;
export const PRAYER_SETS: readonly PrayerSet[] = ADHKAR.prayer;
export const COUNTERS: readonly DhikrCounter[] = ADHKAR.counters;
export const ROTATION: readonly RotationPhrase[] = ADHKAR.rotation;
export const LIBRARY: readonly LibraryDhikr[] = ADHKAR.library;
export const LIBRARY_CATEGORIES = ['salawat', 'tahlil', 'tasbih', 'istighfar', 'quranic', 'daily'] as const;
/** Guided tasbih after the obligatory prayers: separate variants, each counted on its own (never mixed). */
export const TASBIH_VARIANTS: readonly string[] = ADHKAR.counters.filter(c => c.perPrayer).map(c => c.id);
/** How the rotation phrases are grouped on the settings screen. */
export const ROTATION_GROUPS: readonly { key: string; ids: string[] }[] = [
    { key: 'tahlil', ids: ['tahlil-takbir', 'tahlil-wahdahu', 'tahlil-la-sharik', 'tahlil-mulk', 'tahlil-hawqala'] },
    { key: 'fourWords', ids: ['subhanallah', 'alhamdulillah', 'la-ilaha-illallah', 'allahu-akbar'] },
    { key: 'istighfarGroup', ids: ['astaghfirullah', 'astaghfirullah-tawbah'] },
    { key: 'tasbihGroup', ids: ['subhanallah-wabihamdihi'] },
];
export function counter(id: string): DhikrCounter { const c = COUNTERS.find(x => x.id === id); if (!c) throw new Error('Unknown counter'); return c; }
/** Where a running count stands: the phrase being said now, how many of it are done, and completed rounds.
 * A round is one pass through all steps (e.g. 33 + 33 + 33 + 1); counting past the target simply starts a new round. */
export function counterPosition(c: { steps: readonly { count: number }[]; total: number }, n: number): { step: number; inStep: number; rounds: number; inRound: number } {
    const rounds = Math.floor(n / c.total), inRound = n % c.total;
    let left = inRound, step = 0;
    while (step < c.steps.length - 1 && left >= c.steps[step]!.count) { left -= c.steps[step]!.count; step++; }
    return { step, inStep: left, rounds, inRound };
}
export function entriesFor(moment: Moment): AdhkarEntry[] { return ADHKAR_ENTRIES.filter(e => e.moments.includes(moment)); }
export function entry(id: string): AdhkarEntry { const e = ADHKAR_ENTRIES.find(x => x.id === id); if (!e) throw new Error('Unknown dhikr'); return e; }
/** Quran passages of a Quran-based dhikr, read from the corpus (never stored twice). */
export function quranPassages(e: AdhkarEntry): { surah: number; ayahs: { n: number; text: string }[] }[] {
    return (e.quran ?? []).map(q => { const to = q.to ?? chapter(q.surah).count; return { surah: q.surah, ayahs: Array.from({ length: to - q.from + 1 }, (_, i) => ({ n: q.from + i, text: verse(q.surah, q.from + i) })) }; });
}
/** sunnah.com in-book link (verified to match the dataset's book/hadith reference). */
export function sourceUrl(s: HadithSource): string { const c = s.ref.split(':')[0]; return s.inBook ? `https://sunnah.com/${c}/${s.inBook.book}/${s.inBook.hadith}` : `https://sunnah.com/${c}:${s.number}`; }

// ---- Rules engine -------------------------------------------------------------------------------
export type SmartEvent = 'EXIT_HOME' | 'ENTER_HOME' | 'ENTER_WORK' | 'EXIT_WORK' | 'ENTER_MOSQUE' | 'EXIT_MOSQUE' | 'ENTER_VEHICLE' | 'MORNING' | 'EVENING' | 'SLEEP';
/** `quietAfter`: the event is taken as a boundary bounce (location jitter at the edge of a saved place) and stays quiet
 * when the opposite reminder was sent less than `minutes` ago, so "Leaving home" is not followed by "Entering home". */
/** `sameJourneyMinutes`: evidence of the same event this soon after the previous evidence (not the previous reminder)
 * belongs to the same journey and stays quiet, so a long drive, which iOS reports again at each significant location
 * change, gets one riding reminder. A gap that long without evidence starts a new journey. */
export interface Rule { event: SmartEvent; moments: Moment[]; cooldownMinutes: number; quietAfter?: { moment: Moment; minutes: number }; sameJourneyMinutes?: number }
/** Minutes after leaving or entering a saved place during which the opposite crossing is taken as location jitter. */
export const BOUNCE_MINUTES = 5;
/** Minutes without vehicle evidence after which the next evidence is a new journey (a stop for fuel or prayer is not). */
export const JOURNEY_GAP_MINUTES = 30;
/** Event → reminder. Cooldowns stop repeated alerts when a boundary is crossed several times. */
export const RULES: readonly Rule[] = [
    { event: 'EXIT_HOME', moments: ['leave_home'], cooldownMinutes: 45, quietAfter: { moment: 'enter_home', minutes: BOUNCE_MINUTES } },
    { event: 'ENTER_HOME', moments: ['enter_home'], cooldownMinutes: 30, quietAfter: { moment: 'leave_home', minutes: BOUNCE_MINUTES } },
    { event: 'ENTER_WORK', moments: ['work_arrive'], cooldownMinutes: 240 },
    { event: 'EXIT_WORK', moments: ['work_leave'], cooldownMinutes: 240 },
    { event: 'ENTER_MOSQUE', moments: ['mosque_enter'], cooldownMinutes: 30, quietAfter: { moment: 'mosque_leave', minutes: BOUNCE_MINUTES } },
    { event: 'EXIT_MOSQUE', moments: ['mosque_leave'], cooldownMinutes: 30, quietAfter: { moment: 'mosque_enter', minutes: BOUNCE_MINUTES } },
    { event: 'ENTER_VEHICLE', moments: ['vehicle'], cooldownMinutes: 30, sameJourneyMinutes: JOURNEY_GAP_MINUTES },
    { event: 'MORNING', moments: ['morning'], cooldownMinutes: 0 },
    { event: 'EVENING', moments: ['evening'], cooldownMinutes: 0 },
    { event: 'SLEEP', moments: ['sleep'], cooldownMinutes: 0 },
];
/** At most one reminder per local day, regardless of how it was triggered. */
export const ONCE_PER_DAY: readonly Moment[] = ['morning', 'evening', 'sleep'];
/** Time windows for one local day (epoch ms). Morning and evening are reminders, not rulings. */
export interface DayWindows { day: string; morning: [number, number] | null; evening: [number, number] | null }
/** `seen`: when each event was last detected, reminder or not (history kept by earlier builds has none). */
export interface ReminderHistory { last: Partial<Record<Moment, number>>; lastDay: Partial<Record<Moment, string>>; completedDay: Partial<Record<Moment, string>>; seen?: Partial<Record<SmartEvent, number>> }
export const emptyHistory = (): ReminderHistory => ({ last: {}, lastDay: {}, completedDay: {}, seen: {} });
export interface Decision { moments: Moment[]; url: string }
const inWindow = (w: [number, number] | null, at: number) => !!w && at >= w[0] && at < w[1];
/** Decide what (if anything) to remind for an event. Deterministic; the native plugins implement the same steps.
 * `timedAt`: today's timed reminder times; a collection whose timed reminder has already been delivered is not sent
 * again with a place or vehicle reminder. */
export function decide(event: SmartEvent, at: number, windows: DayWindows, history: ReminderHistory, enabled: ReadonlySet<Moment>, timedAt: Partial<Record<Moment, number>> = {}): { decision: Decision | null; history: ReminderHistory } {
    const rule = RULES.find(r => r.event === event);
    if (!rule) throw new Error('Unknown event');
    const blocked = (m: Moment, cooldown: number) => {
        if (!enabled.has(m))
            return true;
        if (ONCE_PER_DAY.includes(m))
            return history.lastDay[m] === windows.day || history.completedDay[m] === windows.day || (timedAt[m] !== undefined && timedAt[m]! <= at);
        const last = history.last[m];
        return last !== undefined && at - last < cooldown * 60000 && at >= last;
    };
    const q = rule.quietAfter, bounce = q && history.last[q.moment] !== undefined && at >= history.last[q.moment]! && at - history.last[q.moment]! < q.minutes * 60000;
    const prev = history.seen?.[event], sameJourney = rule.sameJourneyMinutes !== undefined && prev !== undefined && at >= prev && at - prev < rule.sameJourneyMinutes * 60000;
    // The evidence is noted whether or not a reminder follows, so the journey stays one journey while it lasts.
    const seen = rule.sameJourneyMinutes !== undefined ? { ...history.seen, [event]: Math.max(at, prev ?? at) } : history.seen;
    const moments = bounce || sameJourney ? [] : rule.moments.filter(m => !blocked(m, rule.cooldownMinutes));
    // Grouping: a location or vehicle event inside an open morning/evening window carries that collection too,
    // so the user gets one reminder, not two. Morning remains available even if the user never leaves home.
    if (!['MORNING', 'EVENING', 'SLEEP'].includes(event) && moments.length) {
        if (inWindow(windows.morning, at) && !blocked('morning', 0)) moments.push('morning');
        if (inWindow(windows.evening, at) && !blocked('evening', 0)) moments.push('evening');
    }
    if (!moments.length)
        return { decision: null, history: seen === history.seen ? history : { ...history, seen } };
    const next: ReminderHistory = { last: { ...history.last }, lastDay: { ...history.lastDay }, completedDay: { ...history.completedDay }, ...(seen ? { seen } : {}) };
    for (const m of moments) { next.last[m] = at; next.lastDay[m] = windows.day; }
    return { decision: { moments, url: momentUrl(moments) }, history: next };
}
export function momentUrl(moments: readonly Moment[]): string { return `ayahflow://moment/${moments.join('+')}`; }
/** Parses ayahflow://moment/a+b (from a notification, a Shortcut or a widget). Unknown moments are dropped. */
export function parseMomentUrl(url: string): Moment[] {
    const m = /^ayahflow:\/\/moment\/([a-z_+]+)\/?$/.exec(url.trim());
    return m ? [...new Set(m[1]!.split('+'))].filter((x): x is Moment => (MOMENTS as readonly string[]).includes(x)) : [];
}
/** The collection suggested on the Today screen for the current time, if any. */
export function currentMoment(windows: DayWindows, at: number, sleepAt: [number, number] | null): Moment | null {
    if (inWindow(windows.morning, at)) return 'morning';
    if (inWindow(windows.evening, at)) return 'evening';
    if (inWindow(sleepAt, at)) return 'sleep';
    return null;
}
