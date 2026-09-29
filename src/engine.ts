import { SURAH_DATA, chapter, verse } from './data.js';
export type Mode = 'next' | 'previous' | 'listen' | 'recall';
export type Locale = 'en' | 'fr' | 'ar';
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
    version: 1;
    locale: Locale;
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
export function initialState(): AppState { return { version: 1, locale: 'en', goal: 7, selectedSurahs: [112, 113, 114], cards: {}, attempts: [], days: {}, xp: 0, bookmarks: [], readPosition: { surah: 112, ayah: 1 }, lessonChecks: [], lessonHistory: [], session: null, audioConsent: false, reducedMotion: false, reminder: null, completedSessions: 0, recallSelfChecks: 0 }; }
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
    else {
        const seen = new Set([comparable(answer)]);
        const candidates = shuffle([...s.verses.map((text, i) => ({ id: `${s.id}:${i + 1}`, text })), ...SURAH_DATA.filter(v => v.id !== s.id).flatMap(v => v.verses.map((text, i) => ({ id: `${v.id}:${i + 1}`, text })))], random);
        const wrong = candidates.filter(v => { const k = comparable(v.text); if (seen.has(k))
            return false; seen.add(k); return true; }).slice(0, 3);
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
    const s = raw as AppState;
    if (s.version !== 1 || !['en', 'fr', 'ar'].includes(s.locale) || ![3, 7, 10].includes(s.goal))
        throw new Error('Unsupported save format');
    if (!Array.isArray(s.selectedSurahs) || s.selectedSurahs.length === 0 || s.selectedSurahs.some(x => !SURAH_DATA.some(y => y.id === x)))
        throw new Error('Invalid practice range');
    if (!Number.isSafeInteger(s.xp) || s.xp < 0 || !Number.isSafeInteger(s.completedSessions) || s.completedSessions < 0 || !Number.isSafeInteger(s.recallSelfChecks) || s.recallSelfChecks < 0)
        throw new Error('Invalid progress');
    if (!s.cards || typeof s.cards !== 'object' || Array.isArray(s.cards) || !s.days || typeof s.days !== 'object')
        throw new Error('Invalid review state');
    for (const [k, c] of Object.entries(s.cards)) {
        if (!c || !['next', 'previous', 'listen', 'recall'].includes(c.mode) || !eligible(c.mode, c.surah, c.ayah) || k !== keyFor(c.mode, c.surah, c.ayah) || c.key !== k)
            throw new Error('Invalid review card');
        if (![c.attempts, c.successes, c.lapses, c.intervalDays, c.dueAt, c.lastAt, c.firstSuccessAt].every(x => Number.isFinite(x) && x >= 0) || !Array.isArray(c.successDays) || c.successDays.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d)))
            throw new Error('Invalid review metadata');
    }
    if (!Array.isArray(s.attempts) || s.attempts.length > 5000 || s.attempts.some(a => !a || typeof a.id !== 'string' || !Number.isFinite(a.at) || typeof a.correct !== 'boolean' || !['next', 'previous', 'listen', 'recall'].includes(a.mode)))
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
            if (!i || !['next', 'previous', 'listen', 'recall'].includes(i.mode) || !eligible(i.mode, i.surah, i.ayah) || i.key !== keyFor(i.mode, i.surah, i.ayah) || !['due', 'new', 'practice'].includes(i.reason))
                throw new Error('Invalid session item');
        }
    }
    return structuredClone(s);
}
