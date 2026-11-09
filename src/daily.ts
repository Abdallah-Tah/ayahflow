/** Today's Quran plan: continue reading, the memorisation session, due reviews and difficult verses, and what the learner
 * has really done today. Pure, so tested in Node. It schedules nothing of its own: reviews come from the review engine
 * (engine.ts dueItems / weakItems / planSession), reading from the reading position and the khatm plan, and progress
 * only from saved records (review attempts, Quran opened, the khatm page). No score, streak or activity is invented. */
import { dayKey, dueItems, weakItems, keyFor, type AppState, type HifzSession, type QueueItem } from './engine.js';
import { khatmToday, type KhatmToday } from './khatm.js';
import { hifzRange } from './hifz.js';

/** Event ids of self-assessed recall answered in a memorisation session start with this, so the plan can tell them apart. */
export const HIFZ_EVENT = 'hifz';
/** One answer per verse per session: saving it twice (a double tap, a retry after a failed write) records it once. */
export const hifzEventId = (session: HifzSession, ayah: number) => `${HIFZ_EVENT}:${session.id}:${ayah}`;

export interface DailyPlan {
    /** Today is one of the learner's days off: nothing is asked of them (everything stays available). */
    rest: boolean;
    minutes: AppState['goal'];
    read: { surah: number; ayah: number; khatm: KhatmToday | null; opened: boolean };
    memorise: { session: HifzSession | null; recitedToday: number };
    /** Reviews due now from the review engine (the chosen surahs), plus memorised verses due outside them. */
    review: { due: number; answeredToday: number; memorisedDue: QueueItem[] };
    /** Verses the learner missed and has not yet retained (engine weakItems), as they were asked. */
    difficult: QueueItem[];
}

/** Self-assessed recall cards from memorisation that are due, in surahs the daily review does not already cover. */
export function memorisedDue(state: AppState, now = Date.now()): QueueItem[] {
    return Object.values(state.cards).filter(c => c.mode === 'recall' && c.dueAt <= now && !state.selectedSurahs.includes(c.surah))
        .sort((a, b) => b.lapses - a.lapses || a.dueAt - b.dueAt).slice(0, 15)
        .map(c => ({ key: c.key, mode: c.mode, surah: c.surah, ayah: c.ayah, reason: 'due' as const }));
}

export function difficultItems(state: AppState): QueueItem[] {
    return weakItems(state).map(c => ({ key: c.key, mode: c.mode, surah: c.surah, ayah: c.ayah, reason: 'due' as const }));
}

export function dailyPlan(state: AppState, now = Date.now()): DailyPlan {
    const today = dayKey(now), attempts = state.attempts.filter(a => a.day === today);
    const hifzToday = new Set(attempts.filter(a => a.id.startsWith(`${HIFZ_EVENT}:`)).map(a => a.cardKey));
    const k = state.khatm ? khatmToday(state.khatm, today) : null;
    return {
        rest: state.daysOff.includes(new Date(now).getDay()),
        minutes: state.goal,
        read: { ...state.readPosition, khatm: k && !k.finished ? k : null, opened: (state.worship.quran[today]?.length ?? 0) > 0 },
        memorise: { session: state.hifz, recitedToday: hifzToday.size },
        review: { due: dueItems(state, now).length, answeredToday: attempts.filter(a => !a.id.startsWith(`${HIFZ_EVENT}:`)).length, memorisedDue: memorisedDue(state, now) },
        difficult: difficultItems(state),
    };
}

/** A new memorisation session: the range clamped inside one surah, starting at its first verse. */
export function newHifz(id: string, surah: number, from: number, to: number, repeat: number, level: number, now: number): HifzSession {
    const r = hifzRange(surah, from, to);
    return { id, ...r, repeat, level, at: r.from, done: false, updatedAt: now };
}

/** After the learner assessed verse `ayah` of the session: move to the next verse, or finish at the last. Pure. */
export function hifzAdvance(session: HifzSession, ayah: number, now: number): HifzSession {
    if (ayah < session.from || ayah > session.to) return session;
    return ayah >= session.to ? { ...session, at: session.to, done: true, updatedAt: now } : { ...session, at: Math.max(session.at, ayah + 1), updatedAt: now };
}

/** The review-engine item for self-assessed recall of one memorised verse. */
export const hifzItem = (surah: number, ayah: number): QueueItem => ({ key: keyFor('recall', surah, ayah), mode: 'recall', surah, ayah, reason: 'practice' });

/** Toggles a weekday off (0 Sunday … 6 Saturday). At least one day always stays on. */
export function toggleDayOff(state: AppState, day: number): AppState {
    if (!Number.isInteger(day) || day < 0 || day > 6) return state;
    const off = state.daysOff.includes(day) ? state.daysOff.filter(d => d !== day) : [...state.daysOff, day].sort();
    return off.length > 6 ? state : { ...state, daysOff: off };
}
