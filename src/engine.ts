import { SURAH_DATA, chapter, verse } from './data.js';
import { MOMENTS, ADHKAR_ENTRIES, COUNTERS, ROTATION, LIBRARY, TASBIH_VARIANTS, type Moment, type SmartEvent } from './adhkar.js';
export type Mode = 'next' | 'previous' | 'listen' | 'recall' | 'locate';
export const MODES: readonly Mode[] = ['next', 'previous', 'listen', 'recall', 'locate'];
export type Locale = 'en' | 'fr' | 'ar';
export type Theme = 'system' | 'light' | 'dark';
export type ArabicSize = 's' | 'm' | 'l' | 'xl';
export type ReadingLayout = 'cards' | 'flow' | 'page';
/** Reader surface: Classic (warm paper), Night (charcoal green) or Auto (follows the app theme). */
export type ReadingTheme = 'auto' | 'classic' | 'night';
/** Easy Reading and verse-by-verse text size steps (Mushaf pages size the text to fit the page). */
export const READER_SCALE = [0.85, 0.95, 1.05, 1.2, 1.35, 1.55, 1.8] as const;
/** Current save schema. v1 → v2 added theme; v2 → v3 added arabicSize and readingLayout; v3 → v4 added voiceFollowConsent;
 * v4 → v5 added places, smart reminder settings, adhkar completions and the detection log; v5 → v6 added athan settings;
 * v6 → v7 added the athan reciter (and a separate Fajr reciter) and an imported recording;
 * v7 → v8 added athan recordings downloaded on request (AlAdhan); v8 → v9 added dhikr counts and the step-tracker setting;
 * v9 → v10 added the user's own counters; v10 → v11 added istighfar reminders (off by default);
 * v11 → v12 added dhikr rotation reminders (off by default); v12 → v13 added worship tracking (`worship`: prayers the
 * user confirmed, post-prayer tasbih, favourites, personal targets, lifetime totals and Quran reading days);
 * v13 → v14 added the reminder before each prayer (`athan.before`, off by default); v14 → v15 added the soft beep away
 * from Home (`athan.awayChime`, off); v15 → v16 added the page layout, verse highlights and the user's verse notes;
 * v16 → v17 added the reading theme (`readingTheme`, auto) and the reader text size (`readerSize`, step 3 of 7). */
export const STATE_VERSION = 17;
import ATHAN_DATA from './athan-data.js';
/** Bundled athan recordings (content/athan/sources.json) plus the user's own imported file. */
export const ATHAN_RECITERS: readonly string[] = ATHAN_DATA.recordings.map(r => r.id);
/** Online recordings, selectable once downloaded, as 'online-<id>'. */
export const ONLINE_ATHAN: readonly string[] = ATHAN_DATA.online.recordings.map(r => r.id);
export const FAJR_ONLY: readonly string[] = ATHAN_DATA.online.recordings.filter(r => r.fajrOnly).map(r => `online-${r.id}`);
export const isReciter = (id: unknown): id is string => id === 'custom' || ATHAN_RECITERS.includes(id as string) || (typeof id === 'string' && id.startsWith('online-') && ONLINE_ATHAN.includes(id.slice(7)));
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = typeof PRAYERS[number];
/** Athan alerts at prayer times (off until the user turns them on). */
/** An athan file the user imported; stored on this device only (never exported). `version` changes on every import. */
export interface CustomAthan { name: string; ext: string; version: number }
/** Minutes ahead the reminder before a prayer can be set to. */
export const BEFORE_MINUTES = [5, 10, 15, 30] as const;
export type BeforeMinutes = typeof BEFORE_MINUTES[number];
/** A gentle notification shortly before each chosen prayer (never the athan itself). Off until the user turns it on. */
export interface BeforePrayer { enabled: boolean; minutes: BeforeMinutes }
export const defaultBefore = (): BeforePrayer => ({ enabled: false, minutes: 15 });
/** `awayChime`: with the athan sound chosen, alerts play the athan only while the phone is inside the saved Home area and a
 * soft chime anywhere else (or when the location is unknown). Off until the user turns it on. */
export interface AthanSettings { enabled: boolean; prayers: Record<PrayerName, boolean>; sound: 'athan' | 'chime'; reciter: string; fajrReciter: string; custom: CustomAthan | null; downloads: string[]; before: BeforePrayer; awayChime: boolean }
export const defaultAthan = (): AthanSettings => ({ enabled: false, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, sound: 'athan', reciter: ATHAN_RECITERS[0]!, fajrReciter: ATHAN_RECITERS[0]!, custom: null, downloads: [], before: defaultBefore(), awayChime: false });
export const PRAYER_METHODS = ['MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai', 'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore', 'Tehran', 'Turkey'] as const;
export type PrayerMethod = typeof PRAYER_METHODS[number];
/** A saved place. Stored on this device only and excluded from progress exports. */
export interface Place { lat: number; lng: number; radius: number }
export type PlaceKind = 'home' | 'work' | 'mosque';
export interface SmartSettings {
    /** Geofence reminders (needs "Always" location). */
    location: boolean;
    /** Vehicle reminders (needs motion / activity recognition). */
    vehicle: boolean;
    /** Morning, evening and sleep reminders by time. */
    timed: boolean;
    method: PrayerMethod;
    hanafi: boolean;
    span: 'narrow' | 'broad';
    sleepTime: string | null;
    moments: Moment[];
}
/** Explicit evidence: the user said they recited this dhikr. Reminders never create these. */
export interface AdhkarCompletion { id: string; entry: string; moment: Moment; at: number; day: string }
/** What the device detected, without coordinates. */
export interface Detection { event: SmartEvent | 'WAKE' | 'LEFT_CHECK' | 'TRIP_START' | 'TRIP_END' | 'WATCH_OFF' | 'WATCH_ON'; at: number; detail?: string }
export const defaultSmart = (): SmartSettings => ({ location: false, vehicle: false, timed: false, method: 'MuslimWorldLeague', hanafi: false, span: 'broad', sleepTime: null, moments: [...MOMENTS] });
/** A dhikr count the user tapped on one local day (self-reported, like a tasbih). Steps are never stored: they are read
 * live from the device pedometer. */
export interface CounterCount { id: string; day: string; n: number }
export interface HealthSettings { steps: boolean; stepGoal: number }
export const defaultHealth = (): HealthSettings => ({ steps: false, stepGoal: 8000 });
export const MAX_COUNT = 100000;
/** Daily counts kept (older days are folded into Worship.archive). */
export const MAX_COUNTS = 3000;
/** A counter the user added: their own words and target. Shown as "added by you"; the app never checks or edits the text. */
export interface CustomCounter { id: string; title: string; text: string; target: number }
export const MAX_CUSTOM_COUNTERS = 30;
/** Reminders through the waking hours, each showing the next chosen phrase in turn. */
export interface DhikrRotation { enabled: boolean; every: 30 | 60 | 120 | 180; from: string; to: string; phrases: string[] }
export const ROTATION_INTERVALS = [30, 60, 120, 180] as const;
export const defaultRotation = (): DhikrRotation => ({ enabled: false, every: 60, from: '08:00', to: '22:00', phrases: ROTATION.map(r => r.id) });
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validCustomCounter(c: unknown): c is CustomCounter {
    const x = c as CustomCounter;
    return !!x && typeof x === 'object' && typeof x.id === 'string' && /^my-[a-z0-9]{1,24}$/.test(x.id) && typeof x.title === 'string' && x.title.length <= 60
        && typeof x.text === 'string' && x.text.trim().length > 0 && x.text.length <= 300 && Number.isSafeInteger(x.target) && x.target >= 1 && x.target <= 10000;
}
const counterIds = (state: { myCounters?: CustomCounter[] }) => new Set([...COUNTERS.map(c => c.id), ...LIBRARY.map(c => c.id), ...(state.myCounters ?? []).map(c => c.id)]);
// ---- Worship tracking (v13) ---------------------------------------------------------------------------
/** What the user said about one prayer on one day. A prayer with no record is simply not confirmed: the app never
 * marks a prayer missed by itself, and a record is the user's own note, not a judgement of the prayer's validity. */
export type SalahStatus = 'done' | 'missed' | 'madeUp';
export interface SalahRecord { day: string; prayer: PrayerName; status: SalahStatus; at: number; madeUpAt?: number }
/** Post-prayer tasbih progress, kept per day, prayer and variant (variants are never mixed). */
export interface TasbihCount { day: string; prayer: PrayerName; id: string; n: number }
export interface WorshipPrefs { haptics: boolean; sounds: boolean; translation: boolean; checkIn: boolean; checkInAfter: 20 | 30 | 45 | 60; tasbihNudge: boolean; tasbihVariant: string }
export interface Worship {
    salah: SalahRecord[];
    tasbih: TasbihCount[];
    favorites: string[];
    /** Counters used most recently first. */
    recent: string[];
    /** The user's own goal for a built-in counter (the sourced count is still shown beside it). */
    targets: Record<string, number>;
    /** Totals of daily counts too old to keep, so lifetime totals do not shrink. */
    archive: Record<string, number>;
    /** Surahs opened in the reader per local day (opening, not a claim the surah was read). */
    quran: Record<string, number[]>;
    prefs: WorshipPrefs;
}
export const CHECK_IN_AFTER = [20, 30, 45, 60] as const;
export const MAX_SALAH = 5 * 800, MAX_TASBIH = 5 * 3 * 90, MAX_QURAN_DAYS = 800;
export const defaultWorship = (): Worship => ({ salah: [], tasbih: [], favorites: [], recent: [], targets: {}, archive: {}, quran: {}, prefs: { haptics: true, sounds: false, translation: true, checkIn: false, checkInAfter: 45, tasbihNudge: false, tasbihVariant: TASBIH_VARIANTS[0]! } });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function validWorship(w: unknown, ids: Set<string>): w is Worship {
    const x = w as Worship;
    if (!x || typeof x !== 'object') return false;
    const p = x.prefs;
    if (!p || ![p.haptics, p.sounds, p.translation, p.checkIn, p.tasbihNudge].every(v => typeof v === 'boolean') || !(CHECK_IN_AFTER as readonly number[]).includes(p.checkInAfter) || !TASBIH_VARIANTS.includes(p.tasbihVariant)) return false;
    if (!Array.isArray(x.salah) || x.salah.length > MAX_SALAH || x.salah.some(r => !r || !DAY.test(r.day) || !(PRAYERS as readonly string[]).includes(r.prayer) || !['done', 'missed', 'madeUp'].includes(r.status) || !Number.isFinite(r.at) || !(r.madeUpAt === undefined || (Number.isFinite(r.madeUpAt) && r.status === 'madeUp'))) || new Set(x.salah.map(r => `${r.day}/${r.prayer}`)).size !== x.salah.length) return false;
    if (!Array.isArray(x.tasbih) || x.tasbih.length > MAX_TASBIH || x.tasbih.some(r => !r || !DAY.test(r.day) || !(PRAYERS as readonly string[]).includes(r.prayer) || !TASBIH_VARIANTS.includes(r.id) || !Number.isSafeInteger(r.n) || r.n < 0 || r.n > MAX_COUNT) || new Set(x.tasbih.map(r => `${r.day}/${r.prayer}/${r.id}`)).size !== x.tasbih.length) return false;
    const list = (a: unknown) => Array.isArray(a) && a.length <= 200 && a.every(v => typeof v === 'string' && ids.has(v)) && new Set(a).size === a.length;
    if (!list(x.favorites) || !list(x.recent)) return false;
    const record = (r: unknown, ok: (k: string, v: unknown) => boolean) => !!r && typeof r === 'object' && !Array.isArray(r) && Object.entries(r).every(([k, v]) => ok(k, v));
    if (!record(x.targets, (k, v) => ids.has(k) && Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) <= 10000)) return false;
    if (!record(x.archive, (k, v) => ids.has(k) && Number.isSafeInteger(v) && (v as number) >= 0)) return false;
    return record(x.quran, (k, v) => DAY.test(k) && Array.isArray(v) && v.length <= 114 && v.every(n => Number.isInteger(n) && n >= 1 && n <= 114)) && Object.keys(x.quran).length <= MAX_QURAN_DAYS;
}
/** Set (or with null clear) what the user says about one prayer. Idempotent: the same status twice changes nothing.
 * 'madeUp' is only reachable from 'missed' (a prayer the user recorded as missed and later made up); clearing a
 * made-up prayer goes back to 'missed'. Future days are rejected. */
export function setSalah(state: AppState, day: string, prayer: PrayerName, status: SalahStatus | null, at: number): AppState {
    if (!DAY.test(day) || !(PRAYERS as readonly string[]).includes(prayer) || !Number.isFinite(at) || day > dayKey(at)) throw new Error('Invalid prayer record');
    const w = state.worship, old = w.salah.find(r => r.day === day && r.prayer === prayer);
    if ((old?.status ?? null) === status) return state;
    if (status === 'madeUp' && old?.status !== 'missed') throw new Error('Only a missed prayer can be made up');
    let next: SalahRecord | null;
    if (status === null) next = old?.status === 'madeUp' ? { day, prayer, status: 'missed', at: old.at } : null;
    else if (status === 'madeUp') next = { day, prayer, status, at: old!.at, madeUpAt: at };
    else next = { day, prayer, status, at };
    const rest = w.salah.filter(r => r !== old);
    const salah = (next ? [...rest, next] : rest).sort((a, b) => a.day.localeCompare(b.day) || PRAYERS.indexOf(a.prayer) - PRAYERS.indexOf(b.prayer)).slice(-MAX_SALAH);
    return { ...state, worship: { ...w, salah } };
}
export function salahStatus(state: AppState, day: string, prayer: PrayerName): SalahStatus | null { return state.worship.salah.find(r => r.day === day && r.prayer === prayer)?.status ?? null; }
/** Set (not add) the tasbih count of one prayer and variant. */
export function setTasbih(state: AppState, day: string, prayer: PrayerName, id: string, n: number): AppState {
    if (!DAY.test(day) || !(PRAYERS as readonly string[]).includes(prayer) || !TASBIH_VARIANTS.includes(id) || !Number.isSafeInteger(n) || n < 0 || n > MAX_COUNT) throw new Error('Invalid tasbih count');
    const w = state.worship, old = w.tasbih.find(r => r.day === day && r.prayer === prayer && r.id === id);
    if ((old?.n ?? 0) === n) return state;
    const rest = w.tasbih.filter(r => r !== old);
    return { ...state, worship: { ...w, tasbih: (n ? [...rest, { day, prayer, id, n }] : rest).sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_TASBIH) } };
}
export function tasbihOn(state: AppState, day: string, prayer: PrayerName, id: string): number { return state.worship.tasbih.find(r => r.day === day && r.prayer === prayer && r.id === id)?.n ?? 0; }
export function toggleFavorite(state: AppState, id: string): AppState {
    if (!counterIds(state).has(id)) throw new Error('Unknown counter');
    const f = state.worship.favorites;
    return { ...state, worship: { ...state.worship, favorites: f.includes(id) ? f.filter(x => x !== id) : [...f, id] } };
}
export function markRecent(state: AppState, id: string): AppState {
    if (!counterIds(state).has(id)) throw new Error('Unknown counter');
    if (state.worship.recent[0] === id) return state;
    return { ...state, worship: { ...state.worship, recent: [id, ...state.worship.recent.filter(x => x !== id)].slice(0, 8) } };
}
/** The user's goal for a built-in counter; null resets it to the sourced or suggested number. */
export function setTarget(state: AppState, id: string, n: number | null): AppState {
    if (!counterIds(state).has(id) || state.myCounters.some(c => c.id === id) || !(n === null || (Number.isSafeInteger(n) && n >= 1 && n <= 10000))) throw new Error('Invalid target');
    const targets = { ...state.worship.targets };
    if (n === null) delete targets[id]; else targets[id] = n;
    return { ...state, worship: { ...state.worship, targets } };
}
/** Record that a surah was opened in the reader today (once per surah per day). */
export function noteQuranOpen(state: AppState, surah: number, at: number): AppState {
    chapter(surah);
    const day = dayKey(at), list = state.worship.quran[day] ?? [];
    if (list.includes(surah)) return state;
    const quran = { ...state.worship.quran, [day]: [...list, surah] };
    for (const k of Object.keys(quran).sort().slice(0, Math.max(0, Object.keys(quran).length - MAX_QURAN_DAYS))) delete quran[k];
    return { ...state, worship: { ...state.worship, quran } };
}
/** Lifetime total of a counter: kept daily counts plus the archived total of older days. */
export function lifetimeCount(state: AppState, id: string): number { return (state.worship.archive[id] ?? 0) + state.counts.filter(c => c.id === id).reduce((n, c) => n + c.n, 0); }
export interface ReviewCard {
    key: string;
    mode: Mode;
    surah: number;
    ayah: number;
    attempts: number;
    successes: number;
    lapses: number;
    intervalDays: number;
    dueAt: number;
    lastAt: number;
    firstSuccessAt: number;
    successDays: string[];
    evidence: 'quiz' | 'self-assessed';
}
export interface Attempt {
    id: string;
    cardKey: string;
    at: number;
    day: string;
    correct: boolean;
    mode: Mode;
}
export interface QueueItem {
    key: string;
    mode: Mode;
    surah: number;
    ayah: number;
    reason: 'due' | 'new' | 'practice';
}
export interface Session {
    id: string;
    seed: number;
    queue: QueueItem[];
    index: number;
    answered: boolean;
    lastCorrect: boolean;
    lastChoice: string | null;
    correct: number;
    startedAt: number;
    kind: 'daily' | 'practice';
}
export const HIGHLIGHT_COLORS = ['gold', 'green', 'blue', 'rose', 'violet'] as const;
export type HighlightColor = typeof HIGHLIGHT_COLORS[number];
export interface Highlight { key: string; color: HighlightColor; at: number }
export interface VerseNote { key: string; text: string; at: number }
export const NOTE_MAX = 2000;
export interface AppState {
    version: 17;
    locale: Locale;
    theme: Theme;
    arabicSize: ArabicSize;
    readingLayout: ReadingLayout;
    readingTheme: ReadingTheme;
    /** Index into READER_SCALE. */
    readerSize: number;
    /** Explicit opt-in to on-device voice following. Consent only: no recognition output is ever stored. */
    voiceFollowConsent: boolean;
    places: Record<PlaceKind, Place | null>;
    smart: SmartSettings;
    adhkarLog: AdhkarCompletion[];
    detections: Detection[];
    athan: AthanSettings;
    counts: CounterCount[];
    health: HealthSettings;
    myCounters: CustomCounter[];
    worship: Worship;
    /** A few istighfar reminders a day until the target is reached. */
    istighfarReminder: boolean;
    rotation: DhikrRotation;
    goal: 3 | 7 | 10;
    selectedSurahs: number[];
    cards: Record<string, ReviewCard>;
    attempts: Attempt[];
    days: Record<string, number>;
    xp: number;
    bookmarks: string[];
    /** Verses the user coloured in the reader, by "surah:ayah". The user's own marks; exported and deleted with the rest. */
    highlights: Highlight[];
    /** The user's own notes on verses, by "surah:ayah" (plain text, never sent anywhere). */
    notes: VerseNote[];
    readPosition: {
        surah: number;
        ayah: number;
    };
    lessonChecks: string[];
    lessonHistory: {
        id: string;
        at: number;
        correct: boolean;
    }[];
    session: Session | null;
    audioConsent: boolean;
    reducedMotion: boolean;
    reminder: string | null;
    completedSessions: number;
    recallSelfChecks: number;
}
export function initialState(): AppState { return { version: 17, readingTheme: 'auto', readerSize: 2, highlights: [], notes: [], worship: defaultWorship(), rotation: defaultRotation(), athan: defaultAthan(), counts: [], health: defaultHealth(), myCounters: [], istighfarReminder: false, locale: 'en', theme: 'system', arabicSize: 'm', readingLayout: 'cards', voiceFollowConsent: false, places: { home: null, work: null, mosque: null }, smart: defaultSmart(), adhkarLog: [], detections: [], goal: 7, selectedSurahs: [112, 113, 114], cards: {}, attempts: [], days: {}, xp: 0, bookmarks: [], readPosition: { surah: 112, ayah: 1 }, lessonChecks: [], lessonHistory: [], session: null, audioConsent: false, reducedMotion: false, reminder: null, completedSessions: 0, recallSelfChecks: 0 }; }
export function dayKey(time = Date.now()): string { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function calendarDistance(a: string, b: string): number { return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000); }
export function streak(days: Record<string, number>, now = Date.now()): number { let cursor = new Date(now); if (!days[dayKey(now)])
    cursor.setDate(cursor.getDate() - 1); let n = 0; while (days[dayKey(cursor.getTime())]) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
} return n; }
export function rng(seed: number): () => number { let x = seed >>> 0; return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffle<T>(values: readonly T[], random: () => number): T[] { const a = [...values]; for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
} return a; }
/** Comparison key ONLY. Display and source data are never normalized. */
export function comparable(text: string): string { return text.normalize('NFC').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/\s+/g, ' ').trim(); }
export function keyFor(mode: Mode, surah: number, ayah: number): string { return `${mode}:${surah}:${ayah}`; }
export function eligible(mode: Mode, surah: number, ayah: number): boolean { const s = chapter(surah); return Number.isInteger(ayah) && ayah >= 1 && ayah <= s.count && (mode !== 'next' || ayah < s.count) && (mode !== 'previous' || ayah > 1); }
export function allItems(mode: Mode, surahs: readonly number[]): QueueItem[] { return surahs.flatMap(id => chapter(id).verses.flatMap((_, i) => eligible(mode, id, i + 1) ? [{ key: keyFor(mode, id, i + 1), mode, surah: id, ayah: i + 1, reason: 'new' as const }] : [])); }
export function planSession(state: AppState, mode: Mode | 'mixed', now: number, seed: number): QueueItem[] {
    const modes: Mode[] = mode === 'mixed' ? ['next', 'previous', 'recall'] : [mode];
    const pool = modes.flatMap(m => allItems(m, state.selectedSurahs));
    const random = rng(seed);
    const ordered = shuffle(pool, random);
    const due = ordered.filter(x => state.cards[x.key] && state.cards[x.key]!.dueAt <= now).sort((a, b) => state.cards[b.key]!.lapses - state.cards[a.key]!.lapses || state.cards[a.key]!.dueAt - state.cards[b.key]!.dueAt);
    const unseen = ordered.filter(x => !state.cards[x.key]);
    const rest = ordered.filter(x => state.cards[x.key] && state.cards[x.key]!.dueAt > now);
    const size = state.goal === 3 ? 5 : state.goal === 7 ? 10 : 15;
    const result = [...due.map(x => ({ ...x, reason: 'due' as const })), ...unseen, ...rest.map(x => ({ ...x, reason: 'practice' as const }))];
    return result.slice(0, size);
}
export interface Question {
    item: QueueItem;
    text: string;
    answerText: string;
    options: {
        id: string;
        text: string;
    }[];
    correctId: string;
    answerAyah: number;
    surahName: string;
}
export function questionFor(item: QueueItem, seed: number): Question {
    if (!eligible(item.mode, item.surah, item.ayah))
        throw new Error('Invalid question boundary');
    const s = chapter(item.surah);
    const target = item.mode === 'next' ? item.ayah + 1 : item.mode === 'previous' ? item.ayah - 1 : item.ayah;
    const answer = verse(s.id, target);
    const correctId = item.mode === 'listen' ? String(s.id) : `${s.id}:${target}`;
    const random = rng(seed);
    let options: {
        id: string;
        text: string;
    }[];
    if (item.mode === 'listen') {
        options = [{ id: correctId, text: s.name }, ...shuffle(SURAH_DATA.filter(v => v.id !== s.id), random).slice(0, 3).map(v => ({ id: String(v.id), text: v.name }))];
    }
    else if (item.mode === 'locate') {
        options = [];
    }
    else {
        // Distractors come from the same surah first, then neighbouring surahs: real, nearby text that is hard to rule out.
        const seen = new Set([ayahKey(s.id, target)]);
        const wrong: { id: string; text: string }[] = [];
        for (let d = 0; d < SURAH_DATA.length && wrong.length < 3; d++) {
            for (const id of d === 0 ? [s.id] : [s.id - d, s.id + d]) {
                const other = SURAH_DATA[id - 1];
                if (!other)
                    continue;
                for (const a of shuffle(other.verses.map((_, i) => i + 1), random)) {
                    const k = ayahKey(other.id, a);
                    if (seen.has(k))
                        continue;
                    seen.add(k);
                    wrong.push({ id: `${other.id}:${a}`, text: other.verses[a - 1]! });
                    if (wrong.length === 3)
                        break;
                }
                if (wrong.length === 3)
                    break;
            }
        }
        options = [{ id: correctId, text: answer }, ...wrong];
    }
    return { item, text: verse(s.id, item.ayah), answerText: answer, options: shuffle(options, random), correctId, answerAyah: target, surahName: s.name };
}
export function applyAnswer(state: AppState, item: QueueItem, correct: boolean, at: number, eventId: string): AppState {
    if (state.attempts.some(a => a.id === eventId))
        return state;
    if (!eligible(item.mode, item.surah, item.ayah) || item.key !== keyFor(item.mode, item.surah, item.ayah) || !Number.isFinite(at) || at < 0 || !eventId)
        throw new Error('Invalid review');
    const old = state.cards[item.key];
    if (old && at < old.lastAt)
        throw new Error('Clock moved backwards');
    const today = dayKey(at), distinct = !old?.successDays.includes(today), oldInterval = old?.intervalDays ?? 0;
    let interval = correct ? (oldInterval === 0 ? 1 : distinct ? Math.min(90, Math.max(1, Math.round(oldInterval * 2.2))) : oldInterval) : 0;
    const successes = correct ? [...(old?.successDays ?? []), ...(distinct ? [today] : [])] : [];
    const card: ReviewCard = { key: item.key, mode: item.mode, surah: item.surah, ayah: item.ayah, attempts: (old?.attempts ?? 0) + 1, successes: (old?.successes ?? 0) + (correct ? 1 : 0), lapses: (old?.lapses ?? 0) + (correct ? 0 : 1), intervalDays: interval, dueAt: at + (correct ? interval * 86400000 : 10 * 60000), lastAt: at, firstSuccessAt: correct ? (old?.firstSuccessAt || at) : 0, successDays: successes, evidence: item.mode === 'recall' ? 'self-assessed' : 'quiz' };
    return { ...state, cards: { ...state.cards, [item.key]: card }, xp: state.xp + (correct ? 10 : 2), recallSelfChecks: state.recallSelfChecks + (item.mode === 'recall' ? 1 : 0), attempts: [...state.attempts, { id: eventId, cardKey: item.key, at, day: today, correct, mode: item.mode }].slice(-5000), days: { ...state.days, [today]: (state.days[today] ?? 0) + 1 } };
}
export function retention(card: ReviewCard): 'new' | 'learning' | 'retained' { return card.attempts === 0 ? 'new' : card.successDays.length >= 3 && calendarDistance(card.successDays.at(-1)!, card.successDays[0]!) >= 7 ? 'retained' : 'learning'; }
export function dueItems(state: AppState, now = Date.now()): ReviewCard[] { return Object.values(state.cards).filter(c => c.dueAt <= now && state.selectedSurahs.includes(c.surah)); }
export function weakItems(state: AppState): ReviewCard[] { return Object.values(state.cards).filter(c => c.lapses > 0 && retention(c) !== 'retained').sort((a, b) => b.lapses - a.lapses || a.lastAt - b.lastAt).slice(0, 6); }
export function completedAccuracy(state: AppState): number | null { const a = state.attempts.filter(v => v.mode !== 'recall'); return a.length ? Math.round(a.filter(v => v.correct).length / a.length * 100) : null; }
/** Reject malformed/unknown data instead of silently awarding imported mastery. */
export function validateState(raw: unknown): AppState {
    if (!raw || typeof raw !== 'object')
        throw new Error('Invalid save');
    const s = raw as Omit<AppState, 'readingTheme' | 'readerSize' | 'highlights' | 'notes' | 'version' | 'theme' | 'arabicSize' | 'readingLayout' | 'voiceFollowConsent' | 'places' | 'smart' | 'adhkarLog' | 'detections' | 'athan' | 'counts' | 'health' | 'myCounters' | 'istighfarReminder' | 'rotation' | 'worship'> & { version: number; readingTheme?: ReadingTheme; readerSize?: number; highlights?: Highlight[]; notes?: VerseNote[]; worship?: Worship; rotation?: DhikrRotation; istighfarReminder?: boolean; counts?: CounterCount[]; health?: HealthSettings; myCounters?: CustomCounter[]; athan?: AthanSettings; theme?: Theme; arabicSize?: ArabicSize; readingLayout?: ReadingLayout; voiceFollowConsent?: boolean; places?: AppState['places']; smart?: SmartSettings; adhkarLog?: AdhkarCompletion[]; detections?: Detection[] };
    if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].includes(s.version) || !['en', 'fr', 'ar'].includes(s.locale) || ![3, 7, 10].includes(s.goal))
        throw new Error('Unsupported save format');
    if (s.version >= 2 && !['system', 'light', 'dark'].includes(s.theme!))
        throw new Error('Invalid theme');
    if (s.version >= 3 && (!['s', 'm', 'l', 'xl'].includes(s.arabicSize!) || !(s.version >= 16 ? ['cards', 'flow', 'page'] : ['cards', 'flow']).includes(s.readingLayout!)))
        throw new Error('Invalid reading settings');
    if (s.version >= 4 && typeof s.voiceFollowConsent !== 'boolean')
        throw new Error('Invalid voice setting');
    if (s.version >= 5) {
        const p = s.places;
        if (!p || typeof p !== 'object' || (['home', 'work', 'mosque'] as const).some(k => !(p[k] === null || validPlace(p[k]))) || Object.keys(p).length !== 3)
            throw new Error('Invalid places');
        const m = s.smart;
        if (!m || ![m.location, m.vehicle, m.timed, m.hanafi].every(v => typeof v === 'boolean') || !PRAYER_METHODS.includes(m.method) || !['narrow', 'broad'].includes(m.span) || !(m.sleepTime === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(m.sleepTime)) || !Array.isArray(m.moments) || m.moments.some(x => !(MOMENTS as readonly string[]).includes(x)))
            throw new Error('Invalid smart reminder settings');
        if (!Array.isArray(s.adhkarLog) || s.adhkarLog.length > 5000 || s.adhkarLog.some(c => !c || typeof c.id !== 'string' || !ADHKAR_ENTRIES.some(e => e.id === c.entry) || !(MOMENTS as readonly string[]).includes(c.moment) || !Number.isFinite(c.at) || !/^\d{4}-\d{2}-\d{2}$/.test(c.day)))
            throw new Error('Invalid adhkar log');
        if (!Array.isArray(s.detections) || s.detections.length > 50 || s.detections.some(d => !d || typeof d.event !== 'string' || !Number.isFinite(d.at) || !(d.detail === undefined || (typeof d.detail === 'string' && d.detail.length <= 160))))
            throw new Error('Invalid detections');
    }
    if (s.version >= 6) {
        const a = s.athan;
        if (!a || typeof a.enabled !== 'boolean' || !['athan', 'chime'].includes(a.sound) || !a.prayers || Object.keys(a.prayers).length !== 5 || PRAYERS.some(p => typeof a.prayers[p] !== 'boolean'))
            throw new Error('Invalid athan settings');
    }
    if (s.version >= 7) {
        const a = s.athan!, c = a.custom;
        if (!isReciter(a.reciter) || !isReciter(a.fajrReciter) || !(c === null || (c && typeof c.name === 'string' && c.name.length <= 120 && /^[a-z0-9]{1,5}$/.test(c.ext) && Number.isSafeInteger(c.version))) || ((a.reciter === 'custom' || a.fajrReciter === 'custom') && !c))
            throw new Error('Invalid athan reciter');
    }
    if (s.version >= 8) {
        const a = s.athan!, d = a.downloads;
        const usable = (id: string) => !id.startsWith('online-') || d.includes(id.slice(7));
        if (!Array.isArray(d) || d.some(x => !ONLINE_ATHAN.includes(x)) || new Set(d).size !== d.length || !usable(a.reciter) || !usable(a.fajrReciter) || FAJR_ONLY.includes(a.reciter))
            throw new Error('Invalid athan downloads');
    }
    if (s.version >= 14) {
        const b = s.athan!.before;
        if (!b || typeof b !== 'object' || typeof b.enabled !== 'boolean' || !(BEFORE_MINUTES as readonly number[]).includes(b.minutes) || Object.keys(b).length !== 2)
            throw new Error('Invalid reminder before prayer');
    }
    if (s.version >= 15 && typeof s.athan!.awayChime !== 'boolean') throw new Error('Invalid athan away setting');
    if (s.version >= 12) {
        const r = s.rotation, mine = new Set((s.myCounters ?? []).map(c => c.id));
        if (!r || typeof r.enabled !== 'boolean' || !(ROTATION_INTERVALS as readonly number[]).includes(r.every) || !HHMM.test(r.from) || !HHMM.test(r.to) || r.from >= r.to
            || !Array.isArray(r.phrases) || r.phrases.length > 100 || r.phrases.some(p => typeof p !== 'string' || !(ROTATION.some(x => x.id === p) || mine.has(p))) || new Set(r.phrases).size !== r.phrases.length)
            throw new Error('Invalid dhikr rotation settings');
    }
    if (s.version >= 13 && !validWorship(s.worship, counterIds(s)))
        throw new Error('Invalid worship data');
    if (s.version >= 11 && typeof s.istighfarReminder !== 'boolean')
        throw new Error('Invalid istighfar reminder setting');
    if (s.version >= 10) {
        const m = s.myCounters;
        if (!Array.isArray(m) || m.length > MAX_CUSTOM_COUNTERS || !m.every(validCustomCounter) || new Set(m.map(x => x.id)).size !== m.length)
            throw new Error('Invalid custom counters');
    }
    if (s.version >= 9) {
        const c = s.counts, h = s.health, ids = counterIds(s);
        if (!Array.isArray(c) || c.length > MAX_COUNTS || c.some(x => !x || !ids.has(x.id) || !/^\d{4}-\d{2}-\d{2}$/.test(x.day) || !Number.isSafeInteger(x.n) || x.n < 0 || x.n > MAX_COUNT) || new Set(c.map(x => `${x.id}@${x.day}`)).size !== c.length)
            throw new Error('Invalid dhikr counts');
        if (!h || typeof h.steps !== 'boolean' || !Number.isSafeInteger(h.stepGoal) || h.stepGoal < 1000 || h.stepGoal > 50000)
            throw new Error('Invalid step settings');
    }
    if (!Array.isArray(s.selectedSurahs) || s.selectedSurahs.length === 0 || s.selectedSurahs.some(x => !SURAH_DATA.some(y => y.id === x)))
        throw new Error('Invalid practice range');
    if (!Number.isSafeInteger(s.xp) || s.xp < 0 || !Number.isSafeInteger(s.completedSessions) || s.completedSessions < 0 || !Number.isSafeInteger(s.recallSelfChecks) || s.recallSelfChecks < 0)
        throw new Error('Invalid progress');
    if (!s.cards || typeof s.cards !== 'object' || Array.isArray(s.cards) || !s.days || typeof s.days !== 'object')
        throw new Error('Invalid review state');
    for (const [k, c] of Object.entries(s.cards)) {
        if (!c || !MODES.includes(c.mode) || !eligible(c.mode, c.surah, c.ayah) || k !== keyFor(c.mode, c.surah, c.ayah) || c.key !== k)
            throw new Error('Invalid review card');
        if (![c.attempts, c.successes, c.lapses, c.intervalDays, c.dueAt, c.lastAt, c.firstSuccessAt].every(x => Number.isFinite(x) && x >= 0) || !Array.isArray(c.successDays) || c.successDays.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d)))
            throw new Error('Invalid review metadata');
    }
    if (!Array.isArray(s.attempts) || s.attempts.length > 5000 || s.attempts.some(a => !a || typeof a.id !== 'string' || !Number.isFinite(a.at) || typeof a.correct !== 'boolean' || !MODES.includes(a.mode)))
        throw new Error('Invalid evidence');
    if (Object.entries(s.days).some(([d, n]) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isSafeInteger(n) || n < 0))
        throw new Error('Invalid activity');
    if (!Array.isArray(s.bookmarks) || s.bookmarks.some(k => typeof k !== 'string' || !/^\d+:\d+$/.test(k)))
        throw new Error('Invalid bookmarks');
    s.bookmarks.forEach(k => { const [a, b] = k.split(':').map(Number); verse(a!, b!); });
    if (s.version >= 17 && (!['auto', 'classic', 'night'].includes(s.readingTheme!) || !Number.isInteger(s.readerSize) || s.readerSize! < 0 || s.readerSize! >= READER_SCALE.length))
        throw new Error('Invalid reading settings');
    if (s.version >= 16) {
        const known = (k: unknown) => { if (typeof k !== 'string' || !/^\d+:\d+$/.test(k)) return false; const [a, b] = k.split(':').map(Number); try { verse(a!, b!); return true; } catch { return false; } };
        if (!Array.isArray(s.highlights) || s.highlights.length > 6236 || new Set(s.highlights.map(h => h?.key)).size !== s.highlights.length || s.highlights.some(h => !h || !known(h.key) || !HIGHLIGHT_COLORS.includes(h.color) || !Number.isFinite(h.at) || Object.keys(h).length !== 3))
            throw new Error('Invalid highlights');
        if (!Array.isArray(s.notes) || s.notes.length > 6236 || new Set(s.notes.map(n => n?.key)).size !== s.notes.length || s.notes.some(n => !n || !known(n.key) || typeof n.text !== 'string' || !n.text.trim() || n.text.length > NOTE_MAX || !Number.isFinite(n.at) || Object.keys(n).length !== 3))
            throw new Error('Invalid notes');
    }
    if (!s.readPosition)
        throw new Error('Invalid reading position');
    verse(s.readPosition.surah, s.readPosition.ayah);
    if (!Array.isArray(s.lessonChecks) || s.lessonChecks.some(v => !['ikhfa', 'ghunnah', 'qalqalah', 'madd'].includes(v)) || !Array.isArray(s.lessonHistory) || s.lessonHistory.some(v => !v || !['ikhfa', 'ghunnah', 'qalqalah', 'madd'].includes(v.id) || !Number.isFinite(v.at) || typeof v.correct !== 'boolean'))
        throw new Error('Invalid lesson data');
    if (typeof s.audioConsent !== 'boolean' || typeof s.reducedMotion !== 'boolean' || !(s.reminder === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(s.reminder)))
        throw new Error('Invalid settings');
    if (s.session !== null) {
        const q = s.session;
        if (!q || typeof q.id !== 'string' || !Number.isFinite(q.seed) || !Number.isFinite(q.startedAt) || !['daily', 'practice'].includes(q.kind) || !Number.isSafeInteger(q.correct) || q.correct < 0 || typeof q.answered !== 'boolean' || typeof q.lastCorrect !== 'boolean' || !(q.lastChoice === null || typeof q.lastChoice === 'string') || !Array.isArray(q.queue) || q.queue.length < 1 || q.queue.length > 15 || !Number.isInteger(q.index) || q.index < 0 || q.index >= q.queue.length)
            throw new Error('Invalid session');
        for (const i of q.queue) {
            if (!i || !MODES.includes(i.mode) || !eligible(i.mode, i.surah, i.ayah) || i.key !== keyFor(i.mode, i.surah, i.ayah) || !['due', 'new', 'practice'].includes(i.reason))
                throw new Error('Invalid session item');
        }
    }
    return structuredClone({ ...s, version: 17, readingTheme: s.version < 17 ? 'auto' : s.readingTheme!, readerSize: s.version < 17 ? 2 : s.readerSize!, highlights: s.version < 16 ? [] : s.highlights!, notes: s.version < 16 ? [] : s.notes!, worship: s.version < 13 ? defaultWorship() : s.worship!, rotation: s.version < 12 ? defaultRotation() : s.rotation!, istighfarReminder: s.version < 11 ? false : s.istighfarReminder!, myCounters: s.version < 10 ? [] : s.myCounters!, counts: s.version < 9 ? [] : s.counts!, health: s.version < 9 ? defaultHealth() : s.health!, athan: s.version < 6 ? defaultAthan() : { ...(s.version < 7 ? { ...s.athan!, reciter: ATHAN_RECITERS[0]!, fajrReciter: ATHAN_RECITERS[0]!, custom: null, downloads: [], before: defaultBefore() } : s.version < 8 ? { ...s.athan!, downloads: [], before: defaultBefore() } : s.version < 14 ? { ...s.athan!, before: defaultBefore() } : s.athan!), awayChime: s.version < 15 ? false : s.athan!.awayChime }, places: s.version < 5 ? { home: null, work: null, mosque: null } : s.places!, smart: s.version < 5 ? defaultSmart() : s.smart!, adhkarLog: s.version < 5 ? [] : s.adhkarLog!, detections: s.version < 5 ? [] : s.detections!, voiceFollowConsent: s.version < 4 ? false : s.voiceFollowConsent!, theme: s.version === 1 ? 'system' : s.theme!, arabicSize: s.version < 3 ? 'm' : s.arabicSize!, readingLayout: s.version < 3 ? 'cards' : s.readingLayout! });
}

/** Every ayah (as "surah:ayah") whose comparison key matches this one's, e.g. 109:3 and 109:5. */
let keyIndex: { keys: string[][]; byKey: Map<string, string[]> } | null = null;
/** Comparison keys for every ayah, built once on first use. */
function index(): NonNullable<typeof keyIndex> {
    if (!keyIndex) {
        const keys = SURAH_DATA.map(s => s.verses.map(comparable)), byKey = new Map<string, string[]>();
        keys.forEach((ks, si) => ks.forEach((k, ai) => { const list = byKey.get(k); const ref = `${si + 1}:${ai + 1}`; if (list) list.push(ref); else byKey.set(k, [ref]); }));
        keyIndex = { keys, byKey };
    }
    return keyIndex;
}
/** Comparison key of one ayah (cached). */
export function ayahKey(surah: number, ayah: number): string { verse(surah, ayah); return index().keys[surah - 1]![ayah - 1]!; }
export function identicalAyahs(surah: number, ayah: number): string[] { return [...index().byKey.get(ayahKey(surah, ayah))!]; }
/** Grade a "where is this ayah?" guess. Any textually identical ayah is accepted. Distance is feedback only, within one surah. */
export function locateGuess(item: QueueItem, surah: number, ayah: number): { correct: boolean; distance: number | null } {
    if (item.mode !== 'locate' || !eligible('locate', item.surah, item.ayah))
        throw new Error('Invalid locate question');
    verse(surah, ayah);
    const accepted = identicalAyahs(item.surah, item.ayah);
    if (accepted.includes(`${surah}:${ayah}`))
        return { correct: true, distance: 0 };
    const sameSurah = accepted.filter(k => k.startsWith(`${surah}:`)).map(k => Number(k.split(':')[1]));
    return { correct: false, distance: sameSurah.length ? Math.min(...sameSurah.map(a => Math.abs(a - ayah))) : null };
}
/** Display segments for progressive word reveal. Joining them with single spaces reproduces the source string exactly. */
export function ayahWords(text: string): string[] { return text.split(' ').filter(w => w.length > 0); }
/** Hidden-text recall of one whole surah, in order. Never crosses into another surah. */
export function surahRecallQueue(state: AppState, surah: number, now = Date.now()): QueueItem[] {
    return allItems('recall', [surah]).map(x => { const c = state.cards[x.key]; return { ...x, reason: !c ? 'new' as const : c.dueAt <= now ? 'due' as const : 'practice' as const }; });
}
/** The evidence recorded for one session, in answer order. Reads saved attempts; derives nothing new. */
export function sessionRecap(state: AppState, sessionId: string): { key: string; mode: Mode; surah: number; ayah: number; correct: boolean }[] {
    return state.attempts.filter(a => a.id.startsWith(`${sessionId}:`)).map(a => { const [mode, surah, ayah] = a.cardKey.split(':'); return { key: a.cardKey, mode: mode as Mode, surah: Number(surah), ayah: Number(ayah), correct: a.correct }; });
}
/** Indices into ayahWords(text) of recited words, skipping stand-alone pause marks (e.g. "ۚ" in 110:3).
 * Voice following reports word positions over recited words; this maps them onto the displayed tokens. */
export function recitedWordIndices(text: string): number[] { return ayahWords(text).flatMap((w, i) => /[ء-يٮ-ۓۺ-ۿ]/.test(w) ? [i] : []); }
export function validPlace(p: unknown): p is Place { const q = p as Place; return !!q && typeof q === 'object' && Number.isFinite(q.lat) && Number.isFinite(q.lng) && Math.abs(q.lat) <= 90 && Math.abs(q.lng) <= 180 && Number.isFinite(q.radius) && q.radius >= 100 && q.radius <= 1000; }
/** Record an explicit completion. Idempotent per event id (one tap = one record, even if saved twice). */
export function completeDhikr(state: AppState, entryId: string, moment: Moment, at: number, eventId: string): AppState {
    if (state.adhkarLog.some(c => c.id === eventId))
        return state;
    const e = ADHKAR_ENTRIES.find(x => x.id === entryId);
    if (!e || !e.moments.includes(moment) || !Number.isFinite(at) || !eventId)
        throw new Error('Invalid completion');
    return { ...state, adhkarLog: [...state.adhkarLog, { id: eventId, entry: entryId, moment, at, day: dayKey(at) }].slice(-5000) };
}
/** Entries of a moment the user confirmed today. */
export function completedToday(state: AppState, moment: Moment, at = Date.now()): Set<string> { const d = dayKey(at); return new Set(state.adhkarLog.filter(c => c.moment === moment && c.day === d).map(c => c.entry)); }
/** A copy safe to export: saved place coordinates, detections and device-local audio files stay on the device. */
export function exportable(state: AppState): AppState { const a = state.athan, local = (id: string) => id === 'custom' || id.startsWith('online-'); return { ...state, places: { home: null, work: null, mosque: null }, detections: [], athan: { ...a, custom: null, downloads: [], reciter: local(a.reciter) ? ATHAN_RECITERS[0]! : a.reciter, fajrReciter: local(a.fajrReciter) ? ATHAN_RECITERS[0]! : a.fajrReciter } }; }
/** Set (not add) today's count for a counter. Setting the same value twice is a no-op, so a repeated save cannot inflate it. */
export function setCount(state: AppState, id: string, n: number, at: number): AppState {
    if (!counterIds(state).has(id) || !Number.isSafeInteger(n) || n < 0 || n > MAX_COUNT || !Number.isFinite(at))
        throw new Error('Invalid count');
    const day = dayKey(at), old = state.counts.find(c => c.id === id && c.day === day);
    if (old?.n === n || (!old && n === 0))
        return state;
    const rest = state.counts.filter(c => c !== old);
    const counts = [...rest, ...(n ? [{ id, day, n }] : [])].sort((a, b) => a.day.localeCompare(b.day));
    // Days beyond the limit leave the list, but their totals move to the archive so lifetime totals stay whole.
    const dropped = counts.slice(0, Math.max(0, counts.length - MAX_COUNTS));
    if (!dropped.length) return { ...state, counts };
    const archive = { ...state.worship.archive };
    for (const c of dropped) archive[c.id] = (archive[c.id] ?? 0) + c.n;
    return { ...state, counts: counts.slice(dropped.length), worship: { ...state.worship, archive } };
}
/** The count the user tapped for a counter on a day (0 if none). */
export function countOn(state: AppState, id: string, day = dayKey()): number { return state.counts.find(c => c.id === id && c.day === day)?.n ?? 0; }
/** Add the user's own counter. Idempotent per id, so saving the same form twice adds it once. */
export function addCounter(state: AppState, c: CustomCounter): AppState {
    if (state.myCounters.some(x => x.id === c.id))
        return state;
    const counter = { id: c.id, title: c.title.trim(), text: c.text.trim(), target: c.target };
    if (!validCustomCounter(counter) || state.myCounters.length >= MAX_CUSTOM_COUNTERS)
        throw new Error('Invalid counter');
    return { ...state, myCounters: [...state.myCounters, counter] };
}
/** Remove one of the user's counters together with its saved counts. Built-in counters cannot be removed. */
export function removeCounter(state: AppState, id: string): AppState {
    if (!state.myCounters.some(x => x.id === id))
        return state;
    const w = state.worship, archive = { ...w.archive };
    delete archive[id];
    return { ...state, myCounters: state.myCounters.filter(x => x.id !== id), counts: state.counts.filter(x => x.id !== id), rotation: { ...state.rotation, phrases: state.rotation.phrases.filter(p => p !== id) }, worship: { ...w, favorites: w.favorites.filter(x => x !== id), recent: w.recent.filter(x => x !== id), archive } };
}
/** Colours a verse, or clears it with null. Same colour again changes nothing, so a repeated tap is harmless. */
export function setHighlight(state: AppState, surah: number, ayah: number, color: HighlightColor | null, at: number): AppState {
    verse(surah, ayah);
    if (color !== null && !HIGHLIGHT_COLORS.includes(color)) throw new Error('Invalid colour');
    const key = `${surah}:${ayah}`, old = state.highlights.find(h => h.key === key);
    if ((old?.color ?? null) === color) return state;
    const rest = state.highlights.filter(h => h.key !== key);
    return { ...state, highlights: color === null ? rest : [...rest, { key, color, at }] };
}
/** Saves the user's note on a verse; blank text deletes it. The same text again changes nothing. */
export function setNote(state: AppState, surah: number, ayah: number, text: string, at: number): AppState {
    verse(surah, ayah);
    const key = `${surah}:${ayah}`, clean = text.trim();
    if (clean.length > NOTE_MAX) throw new Error('Note too long');
    const old = state.notes.find(n => n.key === key);
    if ((old?.text ?? '') === clean) return state;
    const rest = state.notes.filter(n => n.key !== key);
    return { ...state, notes: clean ? [...rest, { key, text: clean, at }] : rest };
}
