import { SURAH_DATA, chapter, verse } from './data.js';
import { MOMENTS, ADHKAR_ENTRIES, type Moment, type SmartEvent } from './adhkar.js';
export type Mode = 'next' | 'previous' | 'listen' | 'recall' | 'locate';
export const MODES: readonly Mode[] = ['next', 'previous', 'listen', 'recall', 'locate'];
export type Locale = 'en' | 'fr' | 'ar';
export type Theme = 'system' | 'light' | 'dark';
export type ArabicSize = 's' | 'm' | 'l' | 'xl';
export type ReadingLayout = 'cards' | 'flow';
/** Current save schema. v1 → v2 added theme; v2 → v3 added arabicSize and readingLayout; v3 → v4 added voiceFollowConsent;
 * v4 → v5 added places, smart reminder settings, adhkar completions and the detection log; v5 → v6 added athan settings;
 * v6 → v7 added the athan reciter (and a separate Fajr reciter) and an imported recording;
 * v7 → v8 added athan recordings downloaded on request (AlAdhan). */
export const STATE_VERSION = 8;
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
export interface AthanSettings { enabled: boolean; prayers: Record<PrayerName, boolean>; sound: 'athan' | 'chime'; reciter: string; fajrReciter: string; custom: CustomAthan | null; downloads: string[] }
export const defaultAthan = (): AthanSettings => ({ enabled: false, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, sound: 'athan', reciter: ATHAN_RECITERS[0]!, fajrReciter: ATHAN_RECITERS[0]!, custom: null, downloads: [] });
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
export interface Detection { event: SmartEvent | 'WAKE' | 'LEFT_CHECK' | 'TRIP_START' | 'TRIP_END'; at: number; detail?: string }
export const defaultSmart = (): SmartSettings => ({ location: false, vehicle: false, timed: false, method: 'MuslimWorldLeague', hanafi: false, span: 'broad', sleepTime: null, moments: [...MOMENTS] });
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
export interface AppState {
    version: 8;
    locale: Locale;
    theme: Theme;
    arabicSize: ArabicSize;
    readingLayout: ReadingLayout;
    /** Explicit opt-in to on-device voice following. Consent only: no recognition output is ever stored. */
    voiceFollowConsent: boolean;
    places: Record<PlaceKind, Place | null>;
    smart: SmartSettings;
    adhkarLog: AdhkarCompletion[];
    detections: Detection[];
    athan: AthanSettings;
    goal: 3 | 7 | 10;
    selectedSurahs: number[];
    cards: Record<string, ReviewCard>;
    attempts: Attempt[];
    days: Record<string, number>;
    xp: number;
    bookmarks: string[];
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
export function initialState(): AppState { return { version: 8, athan: defaultAthan(), locale: 'en', theme: 'system', arabicSize: 'm', readingLayout: 'cards', voiceFollowConsent: false, places: { home: null, work: null, mosque: null }, smart: defaultSmart(), adhkarLog: [], detections: [], goal: 7, selectedSurahs: [112, 113, 114], cards: {}, attempts: [], days: {}, xp: 0, bookmarks: [], readPosition: { surah: 112, ayah: 1 }, lessonChecks: [], lessonHistory: [], session: null, audioConsent: false, reducedMotion: false, reminder: null, completedSessions: 0, recallSelfChecks: 0 }; }
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
    const s = raw as Omit<AppState, 'version' | 'theme' | 'arabicSize' | 'readingLayout' | 'voiceFollowConsent' | 'places' | 'smart' | 'adhkarLog' | 'detections' | 'athan'> & { version: number; athan?: AthanSettings; theme?: Theme; arabicSize?: ArabicSize; readingLayout?: ReadingLayout; voiceFollowConsent?: boolean; places?: AppState['places']; smart?: SmartSettings; adhkarLog?: AdhkarCompletion[]; detections?: Detection[] };
    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(s.version) || !['en', 'fr', 'ar'].includes(s.locale) || ![3, 7, 10].includes(s.goal))
        throw new Error('Unsupported save format');
    if (s.version >= 2 && !['system', 'light', 'dark'].includes(s.theme!))
        throw new Error('Invalid theme');
    if (s.version >= 3 && (!['s', 'm', 'l', 'xl'].includes(s.arabicSize!) || !['cards', 'flow'].includes(s.readingLayout!)))
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
    return structuredClone({ ...s, version: 8, athan: s.version < 6 ? defaultAthan() : s.version < 7 ? { ...s.athan!, reciter: ATHAN_RECITERS[0]!, fajrReciter: ATHAN_RECITERS[0]!, custom: null, downloads: [] } : s.version < 8 ? { ...s.athan!, downloads: [] } : s.athan!, places: s.version < 5 ? { home: null, work: null, mosque: null } : s.places!, smart: s.version < 5 ? defaultSmart() : s.smart!, adhkarLog: s.version < 5 ? [] : s.adhkarLog!, detections: s.version < 5 ? [] : s.detections!, voiceFollowConsent: s.version < 4 ? false : s.voiceFollowConsent!, theme: s.version === 1 ? 'system' : s.theme!, arabicSize: s.version < 3 ? 'm' : s.arabicSize!, readingLayout: s.version < 3 ? 'cards' : s.readingLayout! });
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
