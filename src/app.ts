import { SURAH_DATA, LESSONS, chapter, verse, audioUrl, juzOf, pageOf, pageAyahs, PAGE_COUNT, JUZ_STARTS, QURAN_SOURCE, translation, TRANSLATION_SOURCE, type RuleId } from './data.js';
import { COUNTERS, ROTATION, ROTATION_GROUPS, LIBRARY, LIBRARY_CATEGORIES, TASBIH_VARIANTS, counter, counterPosition, type DhikrCounter, type LibraryDhikr, MOMENTS, GENERAL_MOMENTS, PRAYER_SETS, entriesFor, quranPassages, sourceUrl, parseMomentUrl, currentMoment, momentUrl, type Moment, type AdhkarEntry, type HadithSource, type SmartEvent, type DayWindows } from './adhkar.js';
import { nativeConfig, backgroundBlocked, timedReminders, windowsFor, sleepWindow, momentDone, momentPreview, mergeDetections, prayerPlace, nextPrayer, athanSchedule, widgetData, timesFor, prayerDayView, suggestedMethod, ayahOfDay, ayahRef, istighfarReminders, rotationReminders, rotationMax, beforeSchedule, athanHomeOnly, TEST_BEFORE_ID, TEST_ATHAN_ID, type TestNotification, type SmartStatus, type StepReading, type WidgetDaily, type AlarmStatus } from './smart.js';
import { setHighlight, setNote, reviewHighlight, highlightReviewQueue, HIGHLIGHT_COLORS, NOTE_MAX, READER_SCALE, FAJR_OFFSETS, FAJR_SNOOZES, FAJR_SNOOZE_MINUTES, type HighlightColor } from './engine.js';
import { initialState, validateState, dayKey, streak, planSession, questionFor, applyAnswer, dueItems, weakItems, completedAccuracy, retention, locateGuess, identicalAyahs, ayahWords, recitedWordIndices, surahRecallQueue, sessionRecap, exportable, completeDhikr, completedToday, setCount, countOn, addCounter, removeCounter, setSalah, salahStatus, setTasbih, tasbihOn, toggleFavorite, markRecent, setTarget, noteQuranOpen, lifetimeCount, CHECK_IN_AFTER, BEFORE_MINUTES, type SalahStatus, MAX_CUSTOM_COUNTERS, ROTATION_INTERVALS, MAX_COUNT, type CustomCounter, PRAYER_METHODS, PRAYERS, type PrayerName, type PlaceKind, type PrayerMethod, type AppState, type Mode, type Locale, type Theme, type ArabicSize, type ReadingLayout, type QueueItem, type Session, type Question } from './engine.js';
import { tr, formatNumber, beforeCopy } from './i18n.js';
import { icon, archArt, ayahMarker, medallion, starEmblem } from './icons.js';
import { initializeBridge, loadState, saveState, listRecordings, putRecording, deleteRecording, clearLocalData, exportProgress, shareAudio, shareText, smartBridge, onDeepLink, scheduleAthan, setWidgetData, nativeAthan, setReminder, isNative, isTemporary, haptic, type Recording } from './storage.js';
import { playAudio, stopAudio, startRecording, stopRecording, recordingActive, type Clip } from './audio.js';
import { ATHAN_RECORDINGS, ONLINE_RECORDINGS, ONLINE_PROVIDER, MAX_IMPORT_BYTES, recording, online, bundledUrl, makeAlert, toBase64, fromBase64 } from './athan.js';
import { placeCard, setPlaceRadius } from './places.js';
import { calendarReminders, upcomingFasts, type FastReason } from './calendar.js';
import { qiblaBearing, kaabaDistanceKm, qiblaTurn, QIBLA_ALIGNED } from './qibla.js';
import { fajrAlarmPlan, fallbackPlan, ALARM_CHECK_MINUTES } from './alarm.js';
import { hifzRange, hifzQueue, hiddenWord, HIFZ_REPEATS, HIFZ_LEVELS, HIFZ_MAX_AYAHS } from './hifz.js';
import { RAMADAN_TEXT, ramadanToday, daysToRamadan } from './ramadan.js';
import { NAMES, NAMES_LIST, NAMES_ABOUT, NAMES_QURAN, nameOfDay } from './names.js';
import { khatmToday, startKhatm, endKhatm, setKhatmPage, turnedPage, KHATM_DAYS } from './khatm.js';
import { pageBody, easyBody, readerTitle, readingStyles, pageFor, clampPage, toEndOfJuz } from './mushaf.js';
import { slotOf, slotRange, ayahOfMoment, upcomingMoments, RECITATIONS, recitation, daySummary, salahStreak, salahWeek, salahInsights, anyTasbihDone, salahReminders, salahDay } from './worship.js';
import { voiceManifest, startFollowing, stopFollowing, releaseFollowing, followingActive, type FollowEvent } from './voice.js';
type View = 'today' | 'practice' | 'quran' | 'reader' | 'session' | 'result' | 'tajweed' | 'lesson' | 'recite' | 'progress' | 'settings' | 'adhkar' | 'moment' | 'reminders' | 'prayer' | 'counter' | 'steps' | 'rotation' | 'tasbih' | 'verses' | 'recitations' | 'review' | 'wake' | 'khatm' | 'names' | 'hifz';
let state: AppState = initialState();
let view: View = 'today';
let selectedOption: string | null = null;
let revealed = false;
let readerSurah = 112;
/** Page shown in the page layout (0 until opened), the chooser state, and the verse whose menu is open. */
let readerPage = 0, mushafOpen = false, menuVerse: string | null = null;
/** What a verse queue is playing, for the audio banner ("7:24 · to the end of Juz' 8"). */
let queueLabel = '';
let lessonId: RuleId = 'ikhfa';
let reciteSurah = 112;
let reciteAyah = 1;
let libraryFilter = 'all';
let libraryJuz = 0;
let momentIds: Moment[] = ['morning'];
let counterId = COUNTERS[0]!.id;
/** The add-your-own form is open on the counter screen. */
let addingCounter = false;
/** Taps not yet saved (saved together shortly after the last tap); `at` fixes the day they belong to. */
const pendingCounts: Record<string, { n: number; at: number }> = {};
let countTimer: ReturnType<typeof setTimeout> | null = null;
let stepReading: StepReading | null = null;
let stepsAt = 0;
/** Why the last step reading failed, shown on the Steps screen instead of a silent blank. */
let stepError: string | null = null;
/** Last drawn heart level, so a tap can animate the red rising from there. */
let heartShown: { id: string; p: number } | null = null;
let heartBeat = false;
/** Remaining taps per dhikr on screen; a count is not evidence until the user completes it. */
const counters: Record<string, number> = {};
let smartStatus: SmartStatus | null = null;
let notificationState: string | null = null;
/** Which athan is previewing in the app (reciter id), if any. */
let previewing: string | null = null;
let previewUrl = '';
/** A reminder the user tried to turn on while iOS had not granted "Always" location; enabled once it is granted. */
let pendingSmart: { location: boolean; vehicle: boolean } = { location: false, vehicle: false };
/** Browser preview only: an imported recording lasts until the page closes. */
let webCustomUrl: string | null = null;
let libraryQuery = '';
let savedClips: Recording[] = [];
let unsavedClip: Recording | null = null;
let locateSurah: number | null = null;
let locateAyah: number | null = null;
let wordsShown = 0;
let voiceAvailable = false;
/** Live voice-following position. Display only: never saved, never counted as evidence. */
let follow: { status: 'off' | 'loading' | 'listening'; surah: number | null; ayah: number | null; word: number; total: number; matched: number[]; done: Set<string>; outside: string | null } = { status: 'off', surah: null, ayah: null, word: -1, total: 0, matched: [], done: new Set(), outside: null };
const followOff = () => { follow = { status: 'off', surah: null, ayah: null, word: -1, total: 0, matched: [], done: new Set(), outside: null }; };
const CONTENT_VERSION = 'tanzil-uthmani-1.1';
let lastResult: {
    sessionId: string;
    count: number;
    correct: number;
    self: number;
} | null = null;
let busy = false;
let audioState = 'stopped';
let ownAudio = false;
let recordTimer: ReturnType<typeof setInterval> | null = null;
let recordStart = 0;
function newId(): string { if (crypto.randomUUID)
    return crypto.randomUUID(); const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6]! & 15) | 64; b[8] = (b[8]! & 63) | 128; const hex = [...b].map(v => v.toString(16).padStart(2, '0')).join(''); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }
const root = document.querySelector<HTMLDivElement>('#app')!;
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(): void { const resolved = state.theme === 'system' ? (colorScheme.matches ? 'dark' : 'light') : state.theme; document.documentElement.dataset.theme = resolved; document.documentElement.dataset.arabic = state.arabicSize; document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#101411' : '#f7f5ee'); }
colorScheme.addEventListener('change', () => { if (state.theme === 'system') applyTheme(); });
const t = (key: string) => tr(isTemporary() && key === 'savedToast' ? 'temporarySaved' : isTemporary() && key === 'saveRecording' ? 'keepInSession' : key, state.locale), num = (n: number) => formatNumber(n, state.locale);
const escapeHtml = (text: unknown): string => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ic = (name: string, size = 22) => icon(name, size);
const actionButton = (key: string, label: string, cls = 'button secondary', extra = '') => `<button class="${cls}" data-action="${key}" ${extra}>${label}</button>`;
const primary = (key: string, label: string, extra = '') => actionButton(key, `${label}<span class="arrow-icon">${ic('arrow', 18)}</span>`, 'button primary full', extra);
const backButton = () => `<button class="icon-button" data-action="back" aria-label="${t('back')}"><span class="arrow-icon">${ic('back')}</span></button>`;
const miniNotice = (key: string, ico = 'info') => `<div class="notice">${ic(ico, 18)}<p>${t(key)}</p></div>`;
const ref = (s: number, a: number) => `<bdi>${s}:${a}</bdi>`;
const mushafDigits = new Intl.NumberFormat('ar-u-nu-arab');
const marker = (a: number) => ayahMarker(`${t('ayah')} ${num(a)}`, mushafDigits.format(a));
const chevronEnd = () => `<span class="gold arrow-icon">${ic('chevron', 17)}</span>`;
function toast(message: string): void { const target = document.querySelector<HTMLDivElement>('#toast')!; target.textContent = message; target.classList.add('show'); setTimeout(() => target.classList.remove('show'), 4500); }
function confirmAction(message: string): Promise<boolean> { const dialog = document.querySelector<HTMLDialogElement>('#confirm-dialog')!; document.querySelector('#dialog-heading')!.textContent = t('confirm'); document.querySelector('#dialog-message')!.textContent = message; const no = document.querySelector<HTMLButtonElement>('#dialog-cancel')!, yes = document.querySelector<HTMLButtonElement>('#dialog-confirm')!; no.textContent = t('cancel'); yes.textContent = t('confirm'); return new Promise(resolve => { let settled = false; const finish = (result: boolean) => { if (settled)
    return; settled = true; dialog.close(); resolve(result); }; no.onclick = () => finish(false); yes.onclick = () => finish(true); dialog.oncancel = e => { e.preventDefault(); finish(false); }; dialog.showModal(); no.focus(); }); }
async function commit(next: AppState): Promise<void> { try {
    await saveState(next);
    state = next;
}
catch (e) {
    toast(t('storageError'));
    throw e;
} }
function wave(): string { return `<span class="wave" aria-hidden="true">${[8, 13, 20, 12, 26, 32, 20, 37, 24, 16, 29, 19, 12, 7].map((h, i) => `<i style="--h:${h}px;--delay:${i * .067}s"></i>`).join('')}</span>`; }
function nav(): string { const active = ['reader', 'practice', 'lesson', 'tajweed', 'recite', 'verses', 'recitations', 'result', 'review', 'khatm', 'hifz'].includes(view) ? 'quran' : view === 'moment' || view === 'reminders' || view === 'counter' || view === 'rotation' || view === 'names' ? 'adhkar' : view === 'prayer' || view === 'tasbih' || view === 'wake' ? 'prayer' : view === 'steps' ? 'today' : view; return `<nav class="bottom-nav" aria-label="Main">${[['today', 'home', 'home'], ['adhkar', 'tasbih', 'adhkar'], ['quran', 'book', 'quran'], ['prayer', 'mosque', 'prayers'], ['progress', 'chart', 'progress']].map(([v, i, l]) => `<button class="nav-item ${active === v ? 'selected' : ''}" data-action="nav" data-view="${v}" ${active === v ? 'aria-current="page"' : ''}>${ic(i!)}<span>${t(l!)}</span></button>`).join('')}</nav>`; }
function header(): string {
    if (view === 'session' && state.session) {
        const s = state.session;
        return `<header class="app-header">${actionButton('pause', ic('close'), 'icon-button', `aria-label="${t('pause')}"`)}<span class="header-detail">${t('question')} ${num(s.index + 1)} ${t('of')} ${num(s.queue.length)}</span><span class="top-meta">${ic('leaf', 16)} ${num(state.xp)}</span></header>`;
    }
    if (['reader', 'lesson', 'recite', 'tajweed', 'practice', 'settings', 'moment', 'reminders', 'counter', 'steps', 'rotation', 'tasbih', 'verses', 'recitations', 'review', 'wake', 'khatm', 'names', 'hifz'].includes(view))
        return `<header class="app-header">${backButton()}<span class="header-wordmark">Ayah<span class="gold">Flow</span></span><span style="width:44px"></span></header>`;
    return `<header class="app-header"><button class="brand" data-action="nav" data-view="today" aria-label="AyahFlow ${t('today')}"><img src="./assets/icon.svg" alt=""><span>Ayah<span>Flow</span></span></button><div class="row gap8"><span class="top-meta" title="${t('fullDays')}" aria-label="${t('fullDays')}: ${num(salahStreak(state))}">${ic('leaf', 15)} ${num(salahStreak(state))}</span><button class="icon-button" data-action="nav" data-view="settings" aria-label="${t('settings')}">${ic('gear', 21)}</button></div></header>`;
}
function weekMarkup(): string { const today = new Date(); const monday = new Date(today); const day = monday.getDay(); monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1)); return `<div class="week-days">${Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); const key = dayKey(d.getTime()); const active = !!state.days[key]; return `<div class="day-item"><span class="day-dot ${active ? 'done' : ''} ${key === dayKey() ? 'current' : ''}" aria-label="${escapeHtml(d.toLocaleDateString(state.locale))}: ${num(state.days[key] ?? 0)}">${active ? ic('check', 13) : ''}</span><span>${escapeHtml(d.toLocaleDateString(state.locale, { weekday: 'narrow' }))}</span></div>`; }).join('')}</div>`; }
function practiceView(): string { return `<p class="eyebrow mt12">${t('practice')}</p><h1 class="page-title">${t('choosePractice')}<br><span class="gold">${t('oneStep')}</span></h1><p class="page-sub">${t('rangeNote')}</p><div class="stack">${(['next', 'previous', 'listen', 'recall', 'locate'] as const).map((m, i) => `<button class="mode-card" data-action="start-mode" data-mode="${m}"><span class="round-icon">${ic(['book', 'loop', 'headphones', 'eye', 'pin'][i]!, 21)}</span><span class="grow"><h3>${t(m)}</h3><p>${t(m + 'Desc')}</p></span><span class="muted arrow-icon">${ic('chevron', 16)}</span></button>`).join('')}</div>${prayerSection()}<section class="section"><div class="row between"><h2 class="section-title">${t('range')}</h2><span class="pill">${num(state.selectedSurahs.length)} ${t('selectedSurahsCount')}</span></div><div class="preset-row">${(['short', 'juz30', 'prayer'] as const).map(p => `<button class="range-chip" data-action="range-preset" data-preset="${p}">${t(p === 'short' ? 'presetShort' : p === 'juz30' ? 'presetJuz30' : 'presetPrayer')}</button>`).join('')}</div><div class="chip-wrap mt12">${state.selectedSurahs.map(id => chapter(id)).map(x => `<button class="range-chip selected" data-action="range" data-surah="${x.id}" aria-pressed="true" aria-label="${t('removePlace')} ${escapeHtml(x.name)}"><span>${state.locale === 'ar' ? x.ar : escapeHtml(x.name)}</span>${ic('close', 13)}</button>`).join('')}</div><label class="select-row mt12">${ic('book', 17)}<select id="range-add" aria-label="${t('addSurah')}"><option value="">${t('addSurah')}</option>${SURAH_DATA.filter(x => !state.selectedSurahs.includes(x.id)).map(x => `<option value="${x.id}">${num(x.id)} · ${escapeHtml(state.locale === 'ar' ? x.ar : x.name)}</option>`).join('')}</select></label></section><section class="section"><button class="feature-wide row" data-action="nav" data-view="tajweed">${ic('wave', 23)}<span class="grow">${t('lessons')}</span>${ic('chevron', 16)}</button></section>`; }
function surahRows(): string { let surahs = SURAH_DATA.filter(s => `${s.name} ${s.en} ${s.ar} ${s.id}`.toLowerCase().includes(libraryQuery.toLowerCase()) && (!libraryJuz || (juzOf(s.id, 1) <= libraryJuz && libraryJuz <= juzOf(s.id, s.count)))); if (libraryFilter === 'bookmarks')
    surahs = surahs.filter(s => state.bookmarks.some(k => k.startsWith(`${s.id}:`))); if (!surahs.length)
    return `<p class="empty">${t(libraryFilter === 'bookmarks' ? 'noBookmarks' : 'noResults')}</p>`; return surahs.map(s => `<button class="surah-row" data-action="read-surah" data-surah="${s.id}"><span class="surah-number">${num(s.id)}</span><span class="grow"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.en)} · ${num(s.count)} ${t('ayahs')} · ${t(s.type)}</p></span><span class="arabic" lang="ar">${s.ar}</span></button>`).join(''); }
/** Verses, recitations and the memorization tools (kept, outside the main tabs). */
function quranMore(): string {
    return `<div class="tile-row section"><button class="mini-tile" data-action="nav" data-view="verses"><span class="gold">${ic('bookmark', 20)}</span><span class="grow"><strong>${t('dailyVerse')}</strong><span class="tiny muted">${t('savedVerses')} · ${num(state.bookmarks.length)}</span></span></button><button class="mini-tile" data-action="nav" data-view="recitations"><span class="gold">${ic('book', 20)}</span><span class="grow"><strong>${t('shortRecitations')}</strong><span class="tiny muted">${t('shortRecitationsSub')}</span></span></button></div>
<section class="section"><h2 class="section-title mb16">${t('memorization')}</h2><button class="feature-wide row" data-action="nav" data-view="practice"><span class="gold">${ic('layers', 23)}</span><span class="grow"><h3>${t('memorize')}</h3><p>${t('memorizeSub')}</p></span>${chevronEnd()}</button>${state.session ? `<button class="feature-wide row" data-action="resume"><span class="gold">${ic('play', 20)}</span><span class="grow"><h3>${t('resume')}</h3></span>${chevronEnd()}</button>` : ''}<button class="feature-wide row" data-action="nav" data-view="tajweed"><span class="gold">${ic('wave', 23)}</span><span class="grow"><h3>${t('tajweed')}</h3><p>${t('tajweedDraftShort')}</p></span>${chevronEnd()}</button><button class="feature-wide row" data-action="nav" data-view="recite"><span class="gold">${ic('mic', 23)}</span><span class="grow"><h3>${t('recite')}</h3><p>${t('reciteSub')}</p></span>${chevronEnd()}</button></section>`;
}
function quranView(): string { return `<p class="eyebrow mt12">${t('quran')}</p><h1 class="page-title">${t('readerTitle')}</h1><p class="page-sub">${t('readerSub')}</p><button class="feature-wide row mb16" data-action="read-last"><span class="gold">${ic('bookmark', 23)}</span><span class="grow"><span class="tiny muted">${t('lastRead')}</span><h3>${escapeHtml(chapter(state.readPosition.surah).name)} · ${num(state.readPosition.ayah)}</h3></span>${ic('chevron', 16)}</button>${khatmEntry()}${hifzEntry()}${reviewEntry()}<label class="search-box">${ic('search', 18)}<input id="surah-search" placeholder="${t('search')}" aria-label="${t('search')}" value="${escapeHtml(libraryQuery)}"></label><div class="segment"><button data-action="library-filter" data-filter="all" class="${libraryFilter === 'all' ? 'active' : ''}">${t('all')}</button><button data-action="library-filter" data-filter="bookmarks" class="${libraryFilter === 'bookmarks' ? 'active' : ''}">${t('bookmarks')} · ${num(state.bookmarks.length)}</button></div><label class="select-row">${ic('layers', 17)}<select id="juz-filter" aria-label="${t('juz')}"><option value="0">${t('allJuz')}</option>${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${libraryJuz === i + 1 ? 'selected' : ''}>${t('juz')} ${num(i + 1)}</option>`).join('')}</select></label><div id="surah-list">${surahRows()}</div>${quranMore()}<p class="gentle">${t('offline')} · <a href="${QURAN_SOURCE.url}" target="_blank" rel="noopener noreferrer">${t('quranSource')}</a></p>`; }
/** Word spans for highlighting. Joined with single spaces they reproduce the source string exactly. */
const wordSpans = (text: string) => ayahWords(text).map((w, i) => `<span class="w" data-w="${i}">${escapeHtml(w)}</span>`).join(' ');
function followWhere(): string {
    if (follow.status === 'loading') return t('followNote');
    if (follow.surah && follow.ayah) return `${t('following')}: ${escapeHtml(chapter(follow.surah).name)} · ${ref(follow.surah, follow.ayah)}`;
    if (follow.outside) return `${t('followOutside')} · <bdi>${follow.outside}</bdi>`;
    return t('followNote');
}
function followBar(): string { return view === 'reader' && follow.status !== 'off' ? `<div class="follow-bar" role="status" aria-live="polite"><span class="live-dot ${follow.status}" aria-hidden="true"></span><div class="grow"><strong class="small">${t(follow.status === 'loading' ? 'followLoading' : 'followListening')}</strong><p id="follow-where">${followWhere()}</p></div><button class="button secondary" data-action="follow-stop">${ic('stop', 16)} ${t('followStop')}</button></div>` : ''; }
/** Applies the live position to the rendered reader without re-rendering (keeps scroll and focus). */
function applyFollow(scroll = false): void {
    root.querySelectorAll('.following, .recited, .words-live').forEach(el => el.classList.remove('following', 'recited', 'words-live'));
    root.querySelectorAll('.w-now, .w-done').forEach(el => el.classList.remove('w-now', 'w-done'));
    const where = root.querySelector('#follow-where');
    if (where) where.innerHTML = followWhere();
    if (view !== 'reader' || follow.status !== 'listening')
        return;
    for (const k of follow.done) { const [s, a] = k.split(':').map(Number); if (s === readerSurah) root.querySelector(`#ayah-${a}`)?.classList.add('recited'); }
    if (follow.surah !== readerSurah || !follow.ayah)
        return;
    const el = root.querySelector<HTMLElement>(`#ayah-${follow.ayah}`);
    if (!el)
        return;
    el.classList.add('following');
    const map = recitedWordIndices(verse(follow.surah, follow.ayah));
    if (follow.total === map.length) { // Only when the recogniser's words line up with the displayed words.
        const spans = el.querySelectorAll<HTMLElement>('.w');
        el.classList.add('words-live');
        follow.matched.forEach(i => spans[map[i] ?? -1]?.classList.add('w-done'));
        if (follow.word >= 0) spans[map[follow.word] ?? -1]?.classList.add('w-now');
    }
    if (scroll)
        el.scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'center' });
}
function onFollow(e: FollowEvent): void {
    if (e.type === 'loading' || e.type === 'listening') { follow.status = e.type; render(); return; }
    if (e.type === 'stopped') { followOff(); render(); return; }
    if (e.type === 'error') { followOff(); render(); toast(t(e.reason === 'mic' ? 'micError' : 'followError')); return; }
    const known = SURAH_DATA.some(x => x.id === e.surah) && e.ayah >= 1 && e.ayah <= chapter(e.surah).count;
    if (!known) { follow.outside = `${e.surah}:${e.ayah}`; follow.surah = follow.ayah = null; applyFollow(); return; }
    follow.outside = null;
    if (e.type === 'verse') { // Emitted once an ayah has been heard; the live cursor comes from word events.
        follow.done.add(`${e.surah}:${e.ayah}`);
        if (follow.ayah !== null) { applyFollow(); return; }
    }
    const moved = follow.surah !== e.surah || follow.ayah !== e.ayah;
    follow.surah = e.surah; follow.ayah = e.ayah;
    follow.word = e.type === 'word' ? e.word : -1; follow.total = e.type === 'word' ? e.total : 0; follow.matched = e.type === 'word' ? e.matched : [];
    if (readerSurah !== e.surah) { readerSurah = e.surah; render(); }
    applyFollow(moved);
}
const hlClass = (s: number, a: number) => { const h = state.highlights.find(x => x.key === `${s}:${a}`); return h ? ` hl hl-${h.color}` : ''; };
/** Reader chrome (top bar and page footer) can be hidden with one tap on the page; the space stays reserved, so the
 * text never moves or sits under a control. `pageTurn` animates the next render of a page. */
let chromeHidden = false, pageTurn: 'next' | 'prev' | null = null;
/** The page to show: the one holding the saved place in the open surah, else the surah's first page. */
function currentPage(): number { return pageFor(state, readerSurah, readerPage); }
/** Turns to a page and keeps the place (the page's first ayah), so the reader reopens there. */
async function goToPage(n: number): Promise<void> {
    const page = clampPage(n);
    if (page === readerPage) return;
    const [s, a] = pageAyahs(page)[0]!;
    pageTurn = page > readerPage ? 'next' : 'prev';
    const before = readerPage;
    readerPage = page; readerSurah = s; menuVerse = null;
    await commit({ ...turnedPage(state, before, page), readPosition: { surah: s, ayah: a } });
    render();
}
/** Opens a verse in the current layout: its page in Mushaf pages, else its surah scrolled to it. */
async function openAt(s: number, a: number): Promise<void> {
    verse(s, a);
    if (state.readingLayout === 'page') { readerSurah = s; await goToPage(pageOf(s, a)); return; }
    readerSurah = s;
    await commit({ ...state, readPosition: { surah: s, ayah: a } });
    if (view !== 'reader') await navigate('reader'); else render();
    document.querySelector(`#ayah-${a}`)?.scrollIntoView({ block: 'center' });
}
/** Mushaf pages: the largest text size (within reading limits) at which the whole page fits the surface. */
function fitPage(): void {
    const surface = document.querySelector<HTMLElement>('.r-page .r-surface'), page = surface?.querySelector<HTMLElement>('.q-page');
    if (!surface || !page) return;
    const cs = getComputedStyle(surface), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    // Leave room for marks below the last line (kasra, tanween) so nothing is clipped.
    const room = surface.clientHeight - pad - 6, width = surface.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let lo = 11, hi = Math.min(34, Math.max(18, width / 13));
    for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; page.style.setProperty('--q-size', `${mid}px`); if (page.scrollHeight <= room - mid * 0.25) lo = mid; else hi = mid; }
    page.style.setProperty('--q-size', `${lo}px`);
    const over = page.scrollHeight > room + 6;
    surface.classList.toggle('r-overflow', over);
    page.classList.add('fitted');
}
let fitTimer: ReturnType<typeof setTimeout> | undefined;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitPage, 120); });
/** Plays verses one after another until the list ends or the user stops it. */
function playQueue(list: [number, number][], label: string): void {
    const step = (i: number) => {
        const item = list[i];
        if (!item) { queueLabel = ''; return; }
        queueLabel = `${item[0]}:${item[1]} · ${label}`;
        void playAudio(audioUrl(item[0], item[1]), 1, false, () => step(i + 1)).catch(() => { queueLabel = ''; });
    };
    step(0);
}
/** A sheet dialog that sits at the bottom of the screen and keeps the page visible above it. */
function sheetDialog(id: string): HTMLDialogElement {
    let d = document.querySelector<HTMLDialogElement>(`#${id}`);
    if (!d) { d = document.createElement('dialog'); d.id = id; d.className = 'r-sheet'; document.body.append(d); }
    d.dataset.readingTheme = readingThemeResolved();
    return d;
}
const readingThemeResolved = () => state.readingTheme !== 'auto' ? state.readingTheme : document.documentElement.dataset.theme === 'light' ? 'classic' : 'night';
/** The verse sheet: five primary actions, highlight colours, and the rest under More. */
function openVerseMenu(s: number, a: number, mode: 'menu' | 'more' | 'note' | 'translation' = 'menu'): void {
    const d = sheetDialog('verse-sheet');
    const key = `${s}:${a}`, c = chapter(s), juz = juzOf(s, a), hl = state.highlights.find(h => h.key === key)?.color ?? null;
    const note = state.notes.find(n => n.key === key)?.text ?? '', saved = state.bookmarks.includes(key);
    const prim = (act: string, icon: string, label: string, on = false, extra = '') => `<button class="vs-act${on ? ' on' : ''}" data-verse="${act}" ${extra}><span class="vs-ico">${ic(icon, 20)}</span><span class="vs-lbl">${label}</span></button>`;
    const row = (act: string, icon: string, label: string, sub = '', extra = '') => `<button class="vs-row" data-verse="${act}" ${extra}>${ic(icon, 18)}<span class="grow">${label}</span>${sub ? `<span class="vs-sub">${sub}</span>` : ''}</button>`;
    const head = `<div class="vs-grab" aria-hidden="true"></div><div class="vs-head"><div class="grow"><h2>${escapeHtml(c.name)} <bdi>${s}:${a}</bdi></h2><p>${t('pageN').replace('{n}', num(pageOf(s, a)))} · ${t('juzN').replace('{n}', num(juz))}</p></div><button class="r-btn" data-verse="close" aria-label="${t('close')}">${ic('close', 18)}</button></div><p class="vs-preview" lang="ar" dir="rtl">${escapeHtml(verse(s, a))}</p>`;
    let body: string;
    if (mode === 'note') body = `<label class="vs-label" for="note-text">${t(note ? 'editNote' : 'addNote')}</label><textarea id="note-text" class="note-input" maxlength="${NOTE_MAX}" rows="4" dir="auto">${escapeHtml(note)}</textarea><p class="vs-fine">${t('noteLocal')}</p><div class="vs-buttons">${note ? `<button class="vs-pill" data-verse="note-delete">${ic('trash', 15)} ${t('delete')}</button>` : '<span></span>'}<span class="row gap8"><button class="vs-pill" data-verse="menu">${t('cancel')}</button><button class="vs-pill primary" data-verse="note-save">${t('saveNote')}</button></span></div>`;
    else if (mode === 'translation') body = `<p class="vs-tr" lang="en" dir="ltr">${escapeHtml(translation(s, a))}</p><p class="vs-fine">${escapeHtml(TRANSLATION_SOURCE.name)} · ${t('translationCredit')}</p><p class="vs-fine">${t('tafsirUnavailable')}</p><div class="vs-buttons"><span></span><button class="vs-pill" data-verse="menu">${t('back')}</button></div>`;
    else body = `<div class="vs-primary">${prim('play', 'play', t('play'))}${prim('repeat', 'loop', t('repeatShort'))}${prim('bookmark', 'bookmark', t('bookmarkShort'), saved, `aria-pressed="${saved}"`)}${prim('highlight', 'marker', t('highlight'), !!hl, `aria-pressed="${!!hl}"`)}${prim(mode === 'more' ? 'menu' : 'more', 'more', t('moreShort'), mode === 'more', `aria-expanded="${mode === 'more'}"`)}</div>
<div class="vs-colours" role="group" aria-label="${t('highlightColour')}">${HIGHLIGHT_COLORS.map(col => `<button class="swatch hl-${col}${hl === col ? ' active' : ''}" data-verse="colour" data-colour="${col}" aria-label="${t('hl_' + col)}" aria-pressed="${hl === col}"></button>`).join('')}</div>
${mode === 'more' ? `<div class="vs-list">${row('translation', 'globe', t('translationTafsir'))}${row('note', 'note', t(note ? 'editNote' : 'addNote'), note ? escapeHtml(note.length > 28 ? note.slice(0, 27) + '…' : note) : '')}${row('copy', 'copy', t('copy'))}${row('share', 'share', t('shareVerseMenu'))}${row('play-juz', 'play', t('playToJuzEnd'), t('juzN').replace('{n}', num(juz)))}</div>` : ''}`;
    d.innerHTML = head + body;
    const done = () => { if (d.open) d.close(); menuVerse = null; const y = window.scrollY; render(); window.scrollTo(0, y); };
    d.onclick = async e => {
        const b = (e.target as Element).closest<HTMLButtonElement>('[data-verse]');
        if (!b) { if (e.target === d) done(); return; }
        const act = b.dataset.verse!;
        if (act === 'close') return done();
        if (act === 'menu' || act === 'more' || act === 'note' || act === 'translation') return openVerseMenu(s, a, act);
        if (act === 'play' || act === 'play-juz' || act === 'repeat') {
            if (!state.audioConsent) { toast(t('audioDisabled')); return; }
            if (recordingActive() || followingActive()) return;
            if (act === 'play-juz') playQueue(toEndOfJuz(s, a), t('toJuzEnd').replace('{n}', num(juz)));
            else { queueLabel = `${s}:${a}${act === 'repeat' ? ` · ${t('repeatVerse')}` : ''}`; void playAudio(audioUrl(s, a), 1, act === 'repeat').catch(() => { }); }
            return done();
        }
        if (act === 'highlight' || act === 'colour') {
            const col = act === 'colour' ? b.dataset.colour as HighlightColor : hl ? null : 'gold';
            await commit(setHighlight(state, s, a, act === 'colour' && hl === col ? null : col, Date.now()));
            return done();
        }
        if (act === 'note-save' || act === 'note-delete') {
            const text = act === 'note-delete' ? '' : d.querySelector<HTMLTextAreaElement>('#note-text')!.value;
            try { await commit(setNote(state, s, a, text, Date.now())); toast(t(text.trim() ? 'noteSaved' : 'noteDeleted')); } catch { toast(t('error')); return; }
            return done();
        }
        if (act === 'copy' || act === 'share') {
            const text = `${verse(s, a)}\n${c.name} ${s}:${a}`;
            if (act === 'copy') await navigator.clipboard.writeText(text).then(() => toast(t('copied')), () => toast(t('error')));
            else { const r = await shareText(`${c.name} ${s}:${a}`, text).catch(() => null); if (r === 'copied') toast(t('copied')); }
            return done();
        }
        if (act === 'bookmark') { await commit({ ...state, bookmarks: saved ? state.bookmarks.filter(x => x !== key) : [...state.bookmarks, key], readPosition: { surah: s, ayah: a } }); return done(); }
    };
    d.oncancel = e => { e.preventDefault(); done(); };
    if (!d.open) d.showModal();
    (d.querySelector<HTMLElement>(mode === 'note' ? '#note-text' : '.vs-act'))?.focus();
}
/** Runs an app action from inside a reader sheet, then refreshes the sheet if it should stay open. */
function sheetActions(d: HTMLDialogElement, reopen: () => void, stay: string[]): void {
    d.onclick = async e => {
        const b = (e.target as Element).closest<HTMLElement>('[data-action]');
        if (!b) { if (e.target === d) d.close(); return; }
        const keep = stay.includes(b.dataset.action!);
        if (!keep) d.close();
        try { await handleAction(b); } catch { toast(t('error')); }
        if (keep && d.open) reopen();
    };
    d.oncancel = e => { e.preventDefault(); d.close(); };
}
/** Reading settings: layout, theme, text size, translation, and the way to the reading-style chooser. */
function openReaderSettings(): void {
    const d = sheetDialog('reader-settings'), layout = state.readingLayout, page = layout === 'page';
    const seg = (act: string, attr: string, items: [string, string][], current: string) => `<div class="r-seg" role="group">${items.map(([v, label]) => `<button data-action="${act}" data-${attr}="${v}" class="${current === v ? 'on' : ''}" aria-pressed="${current === v}">${label}</button>`).join('')}</div>`;
    const size = `<div class="r-size"><button class="r-btn" data-action="reader-size" data-step="-1" aria-label="${t('smallerText')}" ${page || state.readerSize <= 0 ? 'disabled' : ''}><span lang="ar" class="r-aa small">أ</span></button><span class="r-size-bar" aria-hidden="true">${READER_SCALE.map((_, i) => `<i class="${i <= state.readerSize ? 'on' : ''}"></i>`).join('')}</span><button class="r-btn" data-action="reader-size" data-step="1" aria-label="${t('largerText')}" ${page || state.readerSize >= READER_SCALE.length - 1 ? 'disabled' : ''}><span lang="ar" class="r-aa">أ</span></button></div>${page ? `<p class="vs-fine">${t('pagesFitNote')}</p>` : ''}`;
    const tr = !page ? `<label class="r-switch"><span>${t('showTranslation')}<small>${escapeHtml(TRANSLATION_SOURCE.name)}</small></span><input type="checkbox" data-action="toggle-translation" ${state.worship.prefs.translation ? 'checked' : ''}></label>` : '';
    const s = chapter(readerSurah);
    const practice = [voiceAvailable && follow.status === 'off' && !page ? `<button class="vs-row" data-action="follow">${ic('mic', 18)}<span class="grow">${t('follow')}</span><span class="vs-sub">${t('experimental')}</span></button>` : '', s.count <= 15 ? `<button class="vs-row" data-action="recite-surah" data-surah="${s.id}">${ic('eye', 18)}<span class="grow">${t('reciteSurah')}</span></button>` : ''].join('');
    d.innerHTML = `<div class="vs-grab" aria-hidden="true"></div><div class="vs-head"><div class="grow"><h2>${t('readingSettings')}</h2></div><button class="r-btn" data-action="sheet-close" aria-label="${t('close')}">${ic('close', 18)}</button></div>
<p class="vs-label">${t('readingMode')}</p>${seg('layout', 'layout', [['page', t('modeMushaf')], ['flow', t('modeEasy')], ['cards', t('modeCards')]], layout)}
<p class="vs-label">${t('readingThemeLabel')}</p>${seg('reader-theme', 'theme', [['auto', t('themeAuto')], ['classic', t('themeClassic')], ['night', t('themeNight')]], state.readingTheme)}
<p class="vs-label">${t('textSize')}</p>${size}${tr}
<div class="vs-list mt12"><button class="vs-row" data-action="mushaf-open">${ic('book', 18)}<span class="grow">${t('readingStylesLink')}</span>${ic('chevron', 15)}</button>${practice}</div>
<p class="vs-fine center"><a href="${QURAN_SOURCE.url}" target="_blank" rel="noopener noreferrer">${t('quranSource')}</a></p>`;
    sheetActions(d, openReaderSettings, ['layout', 'reader-theme', 'reader-size', 'toggle-translation']);
    if (!d.open) d.showModal();
}
/** Go to: a page number, a juz', or a surah. */
function openReaderJump(): void {
    const d = sheetDialog('reader-jump'), here = state.readingLayout === 'page' ? readerPage : pageOf(state.readPosition.surah, state.readPosition.ayah);
    d.innerHTML = `<div class="vs-grab" aria-hidden="true"></div><div class="vs-head"><div class="grow"><h2>${t('jumpTo')}</h2></div><button class="r-btn" data-action="sheet-close" aria-label="${t('close')}">${ic('close', 18)}</button></div>
<form class="r-jump" data-action="noop"><label class="vs-label" for="jump-page">${t('pageLabel')}</label><span class="row gap8"><input id="jump-page" type="number" inputmode="numeric" min="1" max="${PAGE_COUNT}" value="${here}" aria-describedby="jump-range"><button class="vs-pill primary" type="button" data-action="jump-page">${t('go')}</button></span><span class="vs-fine" id="jump-range">${num(1)}–${num(PAGE_COUNT)}</span></form>
<p class="vs-label">${t('juz')}</p><div class="r-juz">${JUZ_STARTS.map(([js, ja], i) => `<button data-action="jump-to" data-surah="${js}" data-ayah="${ja}" class="${juzOf(state.readPosition.surah, state.readPosition.ayah) === i + 1 ? 'on' : ''}">${num(i + 1)}</button>`).join('')}</div>
<label class="vs-label" for="jump-surah">${t('surah')}</label><select id="jump-surah" class="r-select" data-action-change="jump-surah">${SURAH_DATA.map(x => `<option value="${x.id}" ${x.id === readerSurah ? 'selected' : ''}>${num(x.id)}. ${escapeHtml(x.name)} · ${x.ar}</option>`).join('')}</select>
<div class="vs-buttons"><button class="vs-pill" data-action="nav" data-view="quran">${ic('search', 15)} ${t('searchSurahs')}</button><button class="vs-pill primary" data-action="jump-surah">${t('openSurah')}</button></div>`;
    sheetActions(d, openReaderJump, []);
    if (!d.open) d.showModal();
    d.querySelector<HTMLInputElement>('#jump-page')?.select();
}
function readerView(): string {
    const layout = state.readingLayout, s = chapter(readerSurah);
    if (layout === 'page') readerPage = currentPage();
    const meta = readerTitle(state, layout, readerPage, readerSurah);
    const markKey = layout === 'page' ? pageAyahs(readerPage)[0]!.join(':') : `${state.readPosition.surah === s.id ? state.readPosition.surah : s.id}:${state.readPosition.surah === s.id ? state.readPosition.ayah : 1}`;
    const marked = layout === 'page' ? pageAyahs(readerPage).some(([x, y]) => state.bookmarks.includes(`${x}:${y}`)) : state.bookmarks.includes(markKey);
    const bar = `<header class="r-bar">${mushafOpen ? `<button class="r-btn" data-action="mushaf-open" aria-label="${t('backToPage')}">${ic('back', 20)}</button>` : `<button class="r-btn" data-action="back" aria-label="${t('back')}">${ic('back', 20)}</button>`}<button class="r-title" data-action="reader-jump" aria-label="${t('jumpTo')}: ${escapeHtml(meta.title)}, ${escapeHtml(meta.sub)}"><strong dir="auto">${escapeHtml(mushafOpen ? t('readingStylesLink') : meta.title)}</strong>${mushafOpen ? '' : `<span dir="auto">${escapeHtml(meta.sub)}</span>`}</button><span class="r-tools">${mushafOpen ? '<span class="r-btn-space"></span>' : `<button class="r-btn" data-action="reader-jump" aria-label="${t('jumpTo')}">${ic('search', 19)}</button><button class="r-btn${marked ? ' on' : ''}" data-action="reader-bookmark" data-key="${markKey}" aria-pressed="${marked}" aria-label="${t(layout === 'page' ? 'bookmarkPage' : 'bookmark')}">${ic(marked ? 'bookmarkFill' : 'bookmark', 19)}</button><button class="r-btn" data-action="reader-settings" aria-label="${t('readingSettings')}">${ic('type', 19)}</button>`}</span></header>`;
    const shell = (cls: string, inner: string) => `<div class="reader ${cls}${chromeHidden ? ' chrome-off' : ''}" data-reading-theme="${readingThemeResolved()}" style="--r-scale:${READER_SCALE[state.readerSize] ?? 1}">${inner}</div>`;
    if (mushafOpen) return shell('r-styles', `${bar}<div class="r-surface">${readingStyles(state)}</div>`);
    if (layout === 'page') {
        const turn = (to: number, key: string, icon: string) => `<button class="r-btn" data-action="page-go" data-page="${to}" aria-label="${t(key)}" ${to < 1 || to > PAGE_COUNT ? 'disabled' : ''}>${ic(icon, 18)}</button>`;
        const turnCls = pageTurn && !state.reducedMotion ? ` turn-${pageTurn}` : '';
        pageTurn = null;
        // Mushaf order: the next page is on the left, whatever the interface language.
        return shell('r-page', `${bar}<div class="r-surface${turnCls}" aria-label="${t('pageN').replace('{n}', num(readerPage))}">${pageBody(state, readerPage, menuVerse)}</div><footer class="r-foot" dir="ltr">${turn(readerPage + 1, 'nextPage', 'prev')}<div class="r-pageno"><span>${num(readerPage)}</span><span class="r-progress" role="progressbar" aria-label="${t('pageN').replace('{n}', num(readerPage))}" aria-valuemin="1" aria-valuemax="${PAGE_COUNT}" aria-valuenow="${readerPage}"><i style="width:${(readerPage / PAGE_COUNT * 100).toFixed(2)}%"></i></span></div>${turn(readerPage - 1, 'prevPage', 'next')}</footer>`);
    }
    const body = layout === 'flow' ? easyBody(state, s.id, menuVerse, state.worship.prefs.translation, wordSpans) : `<div class="r-cards">${s.verses.map((text, i) => { const a = i + 1, k = `${s.id}:${a}`, saved = state.bookmarks.includes(k); return `<article class="ayah-card" id="ayah-${a}"><div class="row between"><span class="ayah-meta">${ref(s.id, a)}</span><div class="ayah-tools"><button class="icon-button" data-action="play-verse" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('play')} ${s.id}:${a}">${ic('play')}</button><button class="icon-button ${saved ? 'active' : ''}" data-action="bookmark" data-surah="${s.id}" data-ayah="${a}" aria-label="${t(saved ? 'removeBookmark' : 'bookmark')} ${s.id}:${a}" aria-pressed="${saved}">${ic('bookmark')}</button><button class="icon-button" data-action="record-ayah" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('recite')} ${s.id}:${a}">${ic('mic')}</button><button class="icon-button" data-action="report" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('reportIssue')} ${s.id}:${a}">${ic('flag')}</button><button class="icon-button" data-action="verse-menu" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('verseMenu')} ${s.id}:${a}">${ic('more')}</button></div></div><p class="arabic ayah-text" lang="ar" dir="rtl"><span class="ayah-src${hlClass(s.id, a)}">${wordSpans(text)}</span> ${marker(a)}</p><a class="text-link" href="https://quran.com/${s.id}/${a}" target="_blank" rel="noopener noreferrer">${t('translation')} ${ic('arrow', 12)}</a></article>`; }).join('')}</div>`;
    const surahTurn = (to: number, key: string, icon: string) => to >= 1 && to <= 114 ? `<button class="r-btn" data-action="read-surah" data-surah="${to}" aria-label="${t(key)}">${ic(icon, 18)}</button>` : '<span class="r-btn-space"></span>';
    return shell(`r-${layout}`, `${bar}<div class="r-surface">${body}</div><footer class="r-foot" dir="ltr">${surahTurn(s.id + 1, 'nextSurah', 'prev')}<div class="r-pageno"><span>${num(s.id)} / ${num(114)}</span><span class="r-progress"><i style="width:${(s.id / 114 * 100).toFixed(2)}%"></i></span></div>${surahTurn(s.id - 1, 'prevSurah', 'next')}</footer>`);
}
function currentQuestion() { const s = state.session!; return questionFor(s.queue[s.index]!, s.seed + s.index * 107); }
function recallBody(q: Question, s: Session): string {
    if (revealed || s.answered)
        return `<div class="question-ayah"><p class="arabic" lang="ar" dir="rtl">${escapeHtml(q.answerText)}</p></div>${!s.answered ? `<div class="self-check">${actionButton('self-answer', t('again'), 'button secondary', 'data-correct="false"')}${actionButton('self-answer', t('remembered'), 'button primary', 'data-correct="true"')}</div>` : ''}`;
    const words = ayahWords(q.answerText);
    const partial = wordsShown
        ? `<p class="arabic partial-ayah" lang="ar" dir="rtl">${words.slice(0, wordsShown).map(w => `<span class="word-in">${escapeHtml(w)}</span>`).join(' ')} ${words.slice(wordsShown).map(() => '<span class="word-blank"></span>').join(' ')}</p>`
        : `<div class="hidden-lines"><span></span><span></span><span></span></div>`;
    return `<div class="hidden-card"><span class="gold">${ic('eye', 27)}</span>${partial}<p class="small muted">${wordsShown ? `${num(wordsShown)} / ${num(words.length)} ${t('wordsShown')} · ` : ''}${t('selfAssessed')}</p></div><div class="stack">${actionButton('next-word', ic('words', 18) + t('nextWord'), 'button secondary full')}${primary('reveal', t('reveal'))}</div>`;
}
function locateBody(s: Session): string {
    if (s.answered)
        return '';
    const pool = [...new Set([...state.selectedSurahs, s.queue[s.index]!.surah])].sort((a, b) => a - b).map(chapter);
    const surahs = `<p class="picker-label">${t('pickSurah')}</p><div class="range-grid">${pool.map(x => `<button class="range-chip ${locateSurah === x.id ? 'selected' : ''}" data-action="locate-surah" data-surah="${x.id}" aria-pressed="${locateSurah === x.id}"><span>${state.locale === 'ar' ? x.ar : escapeHtml(x.name)}</span><span class="chip-num">${num(x.id)}</span></button>`).join('')}</div>`;
    const ayahs = locateSurah ? `<p class="picker-label">${t('pickAyah')} · ${escapeHtml(state.locale === 'ar' ? chapter(locateSurah).ar : chapter(locateSurah).name)}</p><div class="ayah-picker">${chapter(locateSurah).verses.map((_, i) => `<button class="ayah-pick ${locateAyah === i + 1 ? 'selected' : ''}" data-action="locate-ayah" data-ayah="${i + 1}" aria-pressed="${locateAyah === i + 1}" aria-label="${t('ayah')} ${num(i + 1)}">${medallion(num(i + 1))}</button>`).join('')}</div>` : '';
    return `${surahs}${ayahs}<div class="question-actions">${primary('locate-confirm', t('confirmPlace'), locateSurah && locateAyah ? '' : 'disabled')}</div>`;
}
function locateFeedback(q: Question, s: Session): string {
    const [gs, ga] = (s.lastChoice ?? '').split(':').map(Number);
    const guess = gs && ga ? locateGuess(q.item, gs, ga) : null;
    const closeness = guess?.correct ? t('exactPlace') : guess?.distance != null ? `${num(guess.distance)} ${t(guess.distance === 1 ? 'ayahAway' : 'ayahsAway')}` : t('otherSurah');
    const others = identicalAyahs(q.item.surah, q.item.ayah).filter(k => k !== `${q.item.surah}:${q.item.ayah}`);
    return `<p class="closeness">${closeness}</p>${guess && !guess.correct ? `<p class="mt12">${t('yourChoice')}: ${escapeHtml(chapter(gs!).name)} · ${ref(gs!, ga!)}</p>` : ''}<p class="gold">${t('rightPlace')}: ${escapeHtml(q.surahName)} · ${ref(q.item.surah, q.item.ayah)}</p>${others.length ? `<p class="tiny mt12">${t('alsoAt')} ${others.map(k => `<bdi>${k}</bdi>`).join(', ')}.</p>` : ''}`;
}
function sessionView(): string {
    if (!state.session)
        return homeView();
    const s = state.session, q = currentQuestion(), m = q.item.mode;
    const self = m === 'recall', locate = m === 'locate';
    const title = m === 'next' ? 'whichNext' : m === 'previous' ? 'whichPrevious' : m === 'listen' ? 'whichSurah' : locate ? 'whereIs' : 'recallPrompt';
    const sub = m === 'listen' ? t('listenDesc') : locate ? t('locateDesc') : `${escapeHtml(q.surahName)} · ${t('ayah')} ${num(q.item.ayah)}`;
    const choices = `<div class="options">${q.options.map((o, i) => { const cls = s.answered ? (o.id === q.correctId ? 'answer-correct' : o.id === s.lastChoice ? 'answer-wrong' : '') : (o.id === selectedOption ? 'selected' : ''); return `<button class="option ${cls}" data-action="select-option" data-id="${o.id}" aria-pressed="${selectedOption === o.id}" ${s.answered ? 'disabled' : ''}><span class="option-letter">${'ABCD'[i]}</span><span class="${m === 'listen' ? 'grow' : 'arabic'}" ${m !== 'listen' ? 'lang="ar" dir="rtl"' : ''}>${escapeHtml(o.text)}</span>${s.answered && o.id === q.correctId ? ic('check', 18) : ''}</button>`; }).join('')}</div>${!s.answered ? `<div class="question-actions">${primary('check', t('check'), !selectedOption ? 'disabled' : '')}</div>` : ''}`;
    const body = self ? recallBody(q, s) : locate ? locateBody(s) : choices;
    const prompt = self ? '' : `<div class="play-region">${wave()}<button class="play-circle" data-action="play-verse" data-surah="${q.item.surah}" data-ayah="${q.item.ayah}" aria-label="${t('play')}">${ic('play')}</button>${wave()}</div>${m !== 'listen' ? `<div class="question-ayah"><p class="arabic" lang="ar" dir="rtl">${escapeHtml(q.text)}</p>${locate ? '' : `<p class="verse-key">${ref(q.item.surah, q.item.ayah)}</p>`}</div>` : ''}`;
    const detail = locate ? locateFeedback(q, s) : m === 'listen' ? `<p class="gold mt12">${escapeHtml(q.surahName)} · ${ref(q.item.surah, q.item.ayah)}</p>` : !self ? `<p class="arabic" lang="ar">${escapeHtml(q.answerText)}</p><p class="tiny">${ref(q.item.surah, q.answerAyah)}</p>` : '';
    const feedback = s.answered ? `<section class="feedback ${s.lastCorrect ? '' : 'wrong'}" role="status"><h3>${ic(s.lastCorrect ? 'check' : 'loop', 20)} ${t(s.lastCorrect ? 'correct' : 'incorrect')}</h3><p>${t(s.lastCorrect ? 'correctSub' : 'incorrectSub')}</p>${detail}${self ? `<p class="tiny mt12">${t('selfAssessed')}</p>` : ''}<div class="mt20">${primary('next-question', t(s.index === s.queue.length - 1 ? 'finish' : 'continue'))}</div></section>` : '';
    return `<div class="question-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.queue.length}" aria-valuenow="${s.index + (s.answered ? 1 : 0)}"><span style="width:${(s.index + (s.answered ? 1 : 0)) / s.queue.length * 100}%"></span></div><p class="eyebrow center">${t(q.item.reason === 'due' ? 'reviewDue' : q.item.reason === 'practice' ? 'extraPractice' : 'freshStep')}</p><h1 class="question-title">${t(title)}</h1><p class="question-sub">${sub}</p>${prompt}${body}${feedback}`;
}
function resultView(): string {
    const r = lastResult;
    if (!r)
        return homeView();
    const recap = sessionRecap(state, r.sessionId), missed = recap.filter(x => !x.correct);
    const rows = recap.map(x => `<li class="recap-row ${x.correct ? '' : 'missed'}"><span class="ayah-end small-marker" aria-hidden="true">${medallion(num(x.ayah))}</span><span class="grow"><strong>${escapeHtml(chapter(x.surah).name)} · ${ref(x.surah, x.ayah)}</strong><span class="recap-mode">${t(x.mode)}${x.mode === 'recall' ? ` · ${t('selfCheck')}` : ''}</span></span><span class="recap-status">${x.correct ? `${ic('check', 15)} ${t(x.mode === 'recall' ? 'recallYes' : 'correctLabel')}` : t(x.mode === 'recall' ? 'recallNo' : 'missedLabel')}</span></li>`).join('');
    return `<div class="center"><div class="result-emblem">${starEmblem()}${ic('leaf', 40)}</div><p class="eyebrow">${t('personalPlan')}</p><h1 class="page-title">${t('sessionDone')}</h1><p class="page-sub">${t('doneSub')}</p><div class="result-grid"><div class="metric"><p class="value">${num(r.count)}</p><p class="label">${t('reviewed')}</p></div><div class="metric"><p class="value">${num(r.correct)}</p><p class="label">${t('correctCount')}</p></div></div>${r.self ? miniNotice('selfAssessed') : ''}</div>${recap.length ? `<section class="section"><h2 class="section-title mb16">${t('recapTitle')}</h2><ul class="recap">${rows}</ul>${missed.length ? `<div class="mt20">${actionButton('practice-missed', ic('loop', 18) + t('practiceMissed'), 'button secondary full')}</div>` : ''}</section>` : ''}<section class="week-card mt28">${weekMarkup()}</section><div class="mt28">${primary('nav', t('backToday'), 'data-view="today"')}</div><p class="gentle">${t('gentle')}</p>`;
}
function tajweedView(): string { return `<p class="eyebrow mt12">${t('tajweed')}</p><h1 class="page-title">${t('lessons')}</h1><p class="page-sub">${t('lessonsSub')}</p><div class="notice warning mb16">${ic('info', 18)}<p>${t('editorial')}</p></div><div class="stack">${LESSONS.map((l, i) => `<button class="lesson-card" data-action="open-lesson" data-id="${l.id}"><div class="row between"><div class="row"><span class="rule-orb ${l.id}"></span><span class="eyebrow">0${i + 1}</span></div>${state.lessonChecks.includes(l.id) ? `<span class="pill success">${ic('check', 12)} ${t('checked')}</span>` : ''}</div><div class="row between mt12"><h3>${l.name}</h3><span class="arabic" lang="ar">${l.ar}</span></div><p class="small muted mt12">${escapeHtml(chapter(l.surah).name)} · ${ref(l.surah, l.ayah)}</p></button>`).join('')}</div><p class="gentle">${t('lessonKnowledge')}</p>`; }
function lessonView(): string { const l = LESSONS.find(l => l.id === lessonId)!; const text = verse(l.surah, l.ayah); const highlighted = escapeHtml(text).replace(escapeHtml(l.highlight), `<mark>${escapeHtml(l.highlight)}</mark>`); const done = state.lessonChecks.includes(l.id); return `<p class="eyebrow mt12">${t('tajweed')}</p><h1 class="page-title">${l.name} <span class="arabic gold" lang="ar">${l.ar}</span></h1><p class="page-sub">${t('lessonsSub')}</p><div class="lesson-example ${l.id}"><p class="eyebrow center">${t('example')}</p><p class="arabic" lang="ar" dir="rtl">${highlighted}</p><p class="center small muted">${escapeHtml(chapter(l.surah).name)} · ${ref(l.surah, l.ayah)}</p><p class="center tiny muted mt12">${t('focus')}</p></div><div class="control-row"><button class="mini-control" data-action="play-verse" data-surah="${l.surah}" data-ayah="${l.ayah}"><span>${ic('play', 19)}</span>${t('play')}</button><button class="mini-control" data-action="play-verse" data-surah="${l.surah}" data-ayah="${l.ayah}" data-speed="0.85"><span>0.85×</span>0.85×</button><button class="mini-control" data-action="play-verse" data-surah="${l.surah}" data-ayah="${l.ayah}" data-loop="true"><span>${ic('loop', 19)}</span>${t('repeatAudio')}</button></div><section class="rule-detail"><h2>${l.name}</h2><p>${escapeHtml(l.description[state.locale])}</p></section><div class="notice">${ic('info', 18)}<div><strong>${t('tip')}</strong><p>${escapeHtml(l.tip[state.locale])}</p></div></div><section class="section"><h2 class="section-title">${t('knowledgeCheck')}</h2><p class="small muted mt12">${escapeHtml(l.question[state.locale])}</p>${l.choices[state.locale].map((c, i) => `<button class="knowledge-choice ${done && i === l.answer ? 'checked' : ''}" data-action="lesson-answer" data-choice="${i}">${escapeHtml(c)} ${done && i === l.answer ? ic('check', 15) : ''}</button>`).join('')}</section><div class="mt28">${primary('record-ayah', t('practiceVoice'), `data-surah="${l.surah}" data-ayah="${l.ayah}"`)}</div><p class="gentle">${t('editorial')}<br>${t('lessonKnowledge')}</p><a class="text-link" href="${l.source}" target="_blank" rel="noopener noreferrer">${t('source')} ${ic('arrow', 12)}</a>`; }
function clipCard(clip: Recording, unsaved = false): string { return `<div class="audio-row"><div class="row between"><span><strong>${unsaved ? t('yourRecording') : escapeHtml(chapter(clip.surah).name)}</strong><p class="tiny muted">${ref(clip.surah, clip.ayah)} · ${Math.round(clip.duration)}s${unsaved ? '' : ` · ${new Date(clip.createdAt).toLocaleDateString(state.locale)}`}</p></span>${actionButton('play-recording', ic('play'), 'icon-button', `data-id="${clip.id}" aria-label="${t('play')}"`)}</div><div class="row between mt12">${wave()}<div class="row gap8">${unsaved ? actionButton('save-recording', ic('download', 17), 'icon-button', `aria-label="${t('saveRecording')}"`) : actionButton('share-recording', ic('share', 17), 'icon-button', `data-id="${clip.id}" aria-label="${t('share')}"`)}${actionButton('delete-recording', ic('trash', 17), 'icon-button', `data-id="${clip.id}" aria-label="${t('delete')}"`)}</div></div>${unsaved ? `<p class="tiny muted mt12">${t('saveRecording')}</p>` : ''}</div>`; }
function reciteView(): string { return `<p class="eyebrow mt12">${t('recite')}</p><h1 class="page-title">${t('studio')}</h1><p class="page-sub">${t('studioSub')}</p><div class="record-selector"><select id="recite-surah" aria-label="${t('surah')}" ${recordingActive() ? 'disabled' : ''}>${SURAH_DATA.map(s => `<option value="${s.id}" ${s.id === reciteSurah ? 'selected' : ''}>${escapeHtml(state.locale === 'ar' ? s.ar : s.name)}</option>`).join('')}</select><select id="recite-ayah" aria-label="${t('ayah')}" ${recordingActive() ? 'disabled' : ''}>${chapter(reciteSurah).verses.map((_, i) => `<option value="${i + 1}" ${i + 1 === reciteAyah ? 'selected' : ''}>${t('ayah')} ${num(i + 1)}</option>`).join('')}</select></div><div class="question-ayah"><p class="arabic center" lang="ar">${escapeHtml(verse(reciteSurah, reciteAyah))}</p><p class="verse-key">${ref(reciteSurah, reciteAyah)}</p></div><div class="audio-row row"><span class="gold">${ic('headphones', 21)}</span><div class="grow"><strong>${t('reference')}</strong><p class="tiny muted">${t('audioProvider')}</p></div>${actionButton('play-verse', ic('play'), 'icon-button', `data-surah="${reciteSurah}" data-ayah="${reciteAyah}" aria-label="${t('play')}"`)}</div><div class="record-control"><button class="record-button ${recordingActive() ? 'live' : ''}" data-action="record" aria-label="${t(recordingActive() ? 'stop' : 'record')}">${ic(recordingActive() ? 'stop' : 'mic', 36)}</button><p class="small">${t(recordingActive() ? 'recording' : 'record')}</p><p class="record-timer" id="record-timer">${recordingActive() ? '00:00' : '90s max'}</p></div>${unsavedClip ? clipCard(unsavedClip, true) : ''}<div class="notice">${ic('shield', 20)}<div><strong>${t('noScore')}</strong><p>${t('noScoreSub')}</p></div></div><p class="gentle">${t('privateRecording')}</p><section class="section"><div class="row between"><h2 class="section-title">${t('savedRecordings')}</h2><span class="pill">${num(savedClips.length)}</span></div>${savedClips.length ? savedClips.sort((a, b) => b.createdAt - a.createdAt).map(r => clipCard(r)).join('') : `<p class="empty">${t('noRecordings')}</p>`}</section>`; }
function progressView(): string { const accuracy = completedAccuracy(state), cards = Object.values(state.cards), retainedCards = cards.filter(c => retention(c) === 'retained'), weak = weakItems(state); return `<p class="eyebrow mt12">${t('deviceOnly')}</p><h1 class="page-title">${t('progressTitle')}</h1><p class="page-sub">${t('progressSubWorship')}</p>${worshipProgress()}<div class="progress-cards"><div class="metric"><div class="progress-ring" style="--percent:${accuracy ?? 0}%"><span>${accuracy === null ? '—' : num(accuracy) + '%'}</span></div><div class="grow"><h2 class="section-title">${t('quizAccuracy')}</h2><p class="label">${accuracy === null ? t('notYet') : `${num(state.attempts.filter(a => a.mode !== 'recall').length)} ${t('reviewed')}`}</p></div></div><div class="metric"><p class="value">${num(streak(state.days))}</p><p class="label">${t('dayStreak')}</p></div><div class="metric"><p class="value">${num(retainedCards.length)}</p><p class="label">${t('retained')}</p></div></div><div class="mt20">${miniNotice('retentionNote')}</div><section class="section week-card"><h2 class="section-title">${t('week')}</h2>${weekMarkup()}</section><section class="section"><h2 class="section-title mb16">${t('needsPractice')}</h2><div class="stack">${weak.length ? weak.map(c => `<button class="weak-row" data-action="practice-weak" data-key="${c.key}"><span class="gold">${ic('loop', 22)}</span><span class="grow"><h3>${escapeHtml(chapter(c.surah).name)} · ${ref(c.surah, c.ayah)}</h3><p>${t(c.mode)} · ${num(c.lapses)} ${t('missedChecks')}</p></span>${ic('chevron', 16)}</button>`).join('') : `<p class="empty">${t('noWeakness')}</p>`}</div></section><section class="section"><h2 class="section-title mb16">${t('surahProgress')}</h2>${SURAH_DATA.filter(s => state.selectedSurahs.includes(s.id)).map(s => { const seen = new Set(cards.filter(c => c.surah === s.id).map(c => c.ayah)).size; return `<div class="mini-stats"><div class="row between"><span class="small">${escapeHtml(s.name)}</span><span class="tiny muted">${num(seen)} / ${num(s.count)} ${t('ayahs')}</span></div><div class="bar-track mt12"><span style="width:${seen / s.count * 100}%"></span></div></div>`; }).join('')}</section><section class="section"><div class="mini-stats row between"><span class="small">${t('selfChecks')}</span><span class="gold">${num(state.recallSelfChecks)}</span></div><div class="mini-stats row between"><span class="small">${t('teacherVerified')}</span><span class="tiny muted">${t('unavailable')}</span></div></section>`; }
function settingsView(): string { return `<h1 class="page-title">${t('settings')}</h1><section class="settings-section"><h2>${t('language')}</h2><div class="segment">${(['en', 'fr', 'ar'] as const).map((l, i) => `<button class="${state.locale === l ? 'active' : ''}" data-action="language" data-locale="${l}" lang="${l}">${['English', 'Français', 'العربية'][i]}</button>`).join('')}</div></section><section class="settings-section"><h2>${t('appearance')}</h2><div class="segment" role="group" aria-label="${t('appearance')}">${(['system', 'light', 'dark'] as const).map(theme => `<button data-action="theme" data-theme="${theme}" class="${state.theme === theme ? 'active' : ''}" aria-pressed="${state.theme === theme}">${t(theme)}</button>`).join('')}</div></section><section class="settings-section"><h2>${t('arabicSize')}</h2><div class="segment" role="group" aria-label="${t('arabicSize')}">${(['s', 'm', 'l', 'xl'] as const).map((z, i) => `<button data-action="arabic-size" data-size="${z}" class="${state.arabicSize === z ? 'active' : ''}" aria-pressed="${state.arabicSize === z}" aria-label="${t(['sizeS', 'sizeM', 'sizeL', 'sizeXL'][i]!)}"><span class="size-glyph size-${z}" lang="ar">ع</span></button>`).join('')}</div><p class="arabic size-preview" lang="ar" dir="rtl">${escapeHtml(verse(112, 1))} ${marker(1)}</p><h2 class="mt28">${t('layout')}</h2><div class="segment" role="group" aria-label="${t('layout')}">${(['cards', 'flow'] as const).map(l => `<button data-action="layout" data-layout="${l}" class="${state.readingLayout === l ? 'active' : ''}" aria-pressed="${state.readingLayout === l}">${t(l === 'cards' ? 'layoutCards' : 'layoutFlow')}</button>`).join('')}</div></section><section class="settings-section"><h2>${t('dailyGoal')}</h2><div class="segment">${[3, 7, 10].map(g => `<button data-action="goal" data-goal="${g}" class="${state.goal === g ? 'active' : ''}">${num(g)} ${t('minutes')}</button>`).join('')}</div><p class="tiny muted">${t('goalNote')}</p><label class="setting-row"><span><strong>${t('motion')}</strong></span><input type="checkbox" id="motion-toggle" ${state.reducedMotion ? 'checked' : ''} aria-label="${t('motion')}"></label><label class="setting-row"><span><strong>${t('onlineAudio')}</strong><p>${t('onlineAudioNote')}</p></span><input type="checkbox" id="audio-toggle" ${state.audioConsent ? 'checked' : ''} aria-label="${t('onlineAudio')}"></label>${voiceAvailable ? `<label class="setting-row"><span><strong>${t('voiceSetting')}</strong><p>${t('voiceSettingNote')}</p></span><input type="checkbox" id="voice-toggle" ${state.voiceFollowConsent ? 'checked' : ''} aria-label="${t('voiceSetting')}"></label>` : ''}</section><section class="settings-section"><h2>${t('reminder')}</h2><p class="tiny muted mb16">${t('reminderNote')}</p><div class="row"><input id="reminder-time" type="time" value="${state.reminder ?? '20:00'}" aria-label="${t('reminder')}">${actionButton('reminder', t('setReminder'), 'button secondary grow')}</div>${state.reminder ? actionButton('remove-reminder', t('removeReminder'), 'text-button') : ''}</section><section class="settings-section"><h2>${t('dataPrivacy')}</h2>${isTemporary() ? miniNotice('temporaryNote') : ''}<p class="small muted mb16">${t('privacyNote')}</p><div class="stack">${actionButton('export', ic('download', 18) + t('export'), 'button secondary full')}${actionButton('import', ic('upload', 18) + t('import'), 'button subtle full')}</div><p class="tiny muted mt12">${t('exportNote')}</p><div class="mt20">${actionButton('reset', ic('trash', 18) + t('reset'), 'button danger full')}</div></section><section class="settings-section"><button class="feature-wide row" data-action="nav" data-view="reminders"><span class="gold">${ic('radar', 22)}</span><span class="grow"><h3>${t('autoReminders')}</h3><p>${t('autoSub')}</p></span>${chevronEnd()}</button></section><section class="settings-section"><h2>${t('about')}</h2><p class="small muted">${t('aboutText')}</p><p class="small muted mt12">${t('editorial')}</p><a class="text-link" href="https://tanzil.net" target="_blank" rel="noopener noreferrer">${t('quranSource')}</a><br><a class="text-link" href="https://alquran.cloud/terms-and-conditions" target="_blank" rel="noopener noreferrer">Islamic Network · ${t('onlineAudio')}</a></section>`; }
// ---- Adhkar ------------------------------------------------------------------------------------
const MOMENT_ICON: Record<Moment, string> = { morning: 'sun', evening: 'moon', leave_home: 'door', enter_home: 'home', vehicle: 'car', travel: 'pin', work_arrive: 'briefcase', work_leave: 'briefcase', mosque_enter: 'mosque', mosque_leave: 'mosque', after_prayer: 'spark', sleep: 'moon', wake: 'sun' };
const DAILY: Moment[] = ['morning', 'evening', 'after_prayer', 'sleep', 'wake'];
const OUT: Moment[] = ['leave_home', 'enter_home', 'vehicle', 'travel', 'mosque_enter', 'mosque_leave', 'work_arrive', 'work_leave'];
/** Today's windows. Without a saved place prayer times are unknown, so approximate clock windows are used. */
function todayWindows(now = Date.now()): DayWindows {
    if (prayerPlace(state)) return windowsFor(state, new Date(now));
    const d = new Date(now), at = (h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime();
    return { day: dayKey(now), morning: [at(4), at(11)], evening: [at(15), at(20)] };
}
function momentProgress(m: Moment): [number, number] { const e = entriesFor(m); const done = completedToday(state, m); return [e.filter(x => done.has(x.id)).length, e.length]; }
function nowCard(): string {
    const now = Date.now(), m = currentMoment(todayWindows(now), now, sleepWindow(state, new Date(now)));
    if (!m) return '';
    const [done, total] = momentProgress(m), finished = done === total;
    return `<button class="now-card ${finished ? 'finished' : ''}" data-action="moment" data-moments="${m}"><span class="now-orb">${ic(MOMENT_ICON[m], 24)}</span><span class="grow"><span class="eyebrow">${t('nowFor')}</span><h2>${t('m_' + m)}</h2><span class="now-meter"><span style="width:${total ? done / total * 100 : 0}%"></span></span><span class="tiny muted">${finished ? t('momentDone') : `${num(done)} ${t('of')} ${num(total)}`}</span></span><span class="gold arrow-icon">${ic('chevron', 18)}</span></button>`;
}
function prayerSection(): string {
    return `<section class="section"><h2 class="section-title">${t('prayerSurahs')}</h2><p class="small muted mt12 mb16">${t('prayerSurahsSub')}</p><div class="stack">${PRAYER_SETS.map(p => `<article class="prayer-card"><div class="row between wrap"><div class="row gap8 wrap">${p.surahs.map(id => `<button class="surah-tag" data-action="read-surah" data-surah="${id}"><span class="arabic" lang="ar">${chapter(id).ar}</span><span class="tiny">${escapeHtml(chapter(id).name)}</span></button>`).join('')}</div></div><p class="small mt12">${escapeHtml(p.context[state.locale])}</p>${sourceLine(p.source, p.also)}<button class="text-button" data-action="prayer-practice" data-set="${p.id}">${ic('layers', 14)} ${t('practiseThese')}</button></article>`).join('')}</div><p class="gentle">${t('adhkarReview')}</p></section>`;
}
function sourceLine(src: HadithSource, also: HadithSource[] = [], note?: string): string {
    const grade = src.grades.find(g => g.by === 'Al-Albani') ?? src.grades[0];
    // The dataset numbers Sahih Muslim differently from the common (Abd al-Baqi) numbering, so Muslim is cited by its
    // in-book reference, the one sunnah.com shows and links.
    const link = (x: HadithSource) => `<a href="${sourceUrl(x)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.collection)} ${x.ref.startsWith('muslim:') && x.inBook ? `· ${t('book')} ${num(x.inBook.book)}, ${t('hadith')} ${num(x.inBook.hadith)}` : escapeHtml(x.number)}${ic('link', 11)}</a>`;
    return `<p class="source-line">${ic('book', 13)}<span>${link(src)}${grade ? ` · ${escapeHtml(grade.by)}: ${escapeHtml(grade.grade)}` : ''}${also.length ? ` · ${t('alsoIn')} ${also.map(link).join(', ')}` : ''}${note === 'muallaq' ? `<br>${t('muallaq')}` : ''}</span></p>`;
}
function entryCard(e: AdhkarEntry, m: Moment): string {
    const done = completedToday(state, m).has(e.id), key = `${m}:${e.id}`, left = counters[key] ?? e.repeat;
    const body = e.kind === 'quran'
        ? quranPassages(e).map(p => `<p class="arabic dhikr-text" lang="ar" dir="rtl">${p.ayahs.map(a => `${escapeHtml(a.text)} ${marker(a.n)}`).join(' ')}</p><p class="tiny muted">${t('quranLabel')} · ${escapeHtml(chapter(p.surah).name)} <bdi>${p.surah}:${p.ayahs[0]!.n}${p.ayahs.length > 1 ? `–${p.ayahs.at(-1)!.n}` : ''}</bdi></p>`).join('')
        : `<p class="arabic dhikr-text" lang="ar" dir="rtl">${escapeHtml(e.text!)}</p>${e.quranRef ? `<p class="tiny muted">${t('quranLabel')} <bdi>${e.quranRef.replace('-', '–')}</bdi></p>` : ''}`;
    const action = done ? `<span class="pill success">${ic('check', 12)} ${t('recitedToday')}</span>`
        : e.repeat > 1 ? `<button class="counter" data-action="dhikr-count" data-entry="${e.id}" data-moment="${m}" style="--p:${(e.repeat - left) / e.repeat * 100}%" aria-label="${t('tapToCount')}: ${num(left)}"><span>${num(left)}</span></button><span class="tiny muted">${t('tapToCount')} · ×${num(e.repeat)}</span>`
        : actionButton('dhikr-done', `${ic('check', 16)} ${t('markDone')}`, 'button secondary', `data-entry="${e.id}" data-moment="${m}"`);
    return `<article class="dhikr-card ${done ? 'done' : ''}"><div class="row between"><h3>${escapeHtml(e.title[state.locale])}</h3>${e.repeat > 1 ? `<span class="pill gold">×${num(e.repeat)}</span>` : ''}</div>${e.kind === 'guidance' ? `<p class="tiny gold mt12">${t('guidanceLabel')}</p>` : ''}${body}${sourceLine(e.source, e.also, e.note)}<div class="dhikr-action">${action}</div></article>`;
}
function momentTile(m: Moment): string {
    const general = GENERAL_MOMENTS.includes(m), [done, total] = momentProgress(m);
    return `<button class="moment-tile ${!general && done === total ? 'finished' : ''}" data-action="moment" data-moments="${m}"><span class="gold">${ic(MOMENT_ICON[m], 22)}</span><span class="moment-name">${t('m_' + m)}</span><span class="tiny muted">${general ? '—' : done === total ? t('momentDone') : `${num(done)} ${t('of')} ${num(total)}`}</span></button>`;
}
function momentView(): string {
    const ms = momentIds.length ? momentIds : ['morning' as Moment];
    return `<p class="eyebrow mt12">${t('adhkar')}</p><h1 class="page-title">${ms.map(m => t('m_' + m)).join(' · ')}</h1>${ms.map(m => {
        const list = entriesFor(m);
        const intro = GENERAL_MOMENTS.includes(m) ? `<div class="notice">${ic('info', 18)}<p>${t('generalReminder')}</p></div>` : m === 'vehicle' || m === 'travel' ? `<div class="notice warning">${ic('car', 18)}<p>${t('drivingSafety')}</p></div>` : '';
        return `<section class="section moment-section">${ms.length > 1 ? `<h2 class="section-title mb16">${ic(MOMENT_ICON[m], 20)} ${t('m_' + m)}</h2>` : ''}${intro}<div class="stack mt12">${list.map(e => entryCard(e, m)).join('')}</div>${GENERAL_MOMENTS.includes(m) ? `<button class="feature-wide row" data-action="moment" data-moments="${currentMoment(todayWindows(), Date.now(), null) ?? 'morning'}"><span class="gold">${ic('tasbih', 22)}</span><span class="grow"><h3>${t('m_' + (currentMoment(todayWindows(), Date.now(), null) ?? 'morning'))}</h3></span>${chevronEnd()}</button>` : ''}</section>`;
    }).join('')}<p class="gentle">${t('adhkarReview')}</p>`;
}
const permLabel = (v: string | null | undefined) => t('perm_' + (v === 'prompt-with-rationale' ? 'prompt' : v ?? 'prompt'));
function remindersView(): string {
    const bridge = smartBridge();
    const head = `<p class="eyebrow mt12">${t('adhkar')}</p><h1 class="page-title">${t('autoReminders')}</h1><p class="page-sub">${t('autoSub')}</p>`;
    const limits = `<section class="settings-section"><h2>${t('limitsTitle')}</h2><div class="notice">${ic('info', 18)}<p>${t('limitsNote')}</p></div></section>`;
    const shortcuts = `<section class="settings-section"><h2>${t('shortcutsTitle')}</h2><p class="small muted mb16">${t('shortcutsNote')}</p><div class="stack">${(['vehicle', 'leave_home', 'enter_home', 'morning', 'evening', 'mosque_enter'] as Moment[]).map(m => `<div class="link-row"><span class="gold">${ic(MOMENT_ICON[m], 18)}</span><span class="grow"><strong class="small">${t('m_' + m)}</strong><code>${momentUrl([m])}</code></span>${actionButton('copy-link', ic('copy', 16), 'icon-button', `data-url="${momentUrl([m])}" aria-label="${t('copyLink')}"`)}</div>`).join('')}</div></section>`;
    if (!bridge) return `${head}<div class="notice">${ic('info', 18)}<p>${t('nativeOnlyAuto')}</p></div>${shortcuts}${limits}`;
    const st = smartStatus;
    const chips = `<div class="perm-row"><span class="perm ${st?.location === 'always' ? 'ok' : ''}">${ic('pin', 13)} ${t('permLocation')}: ${permLabel(st?.location)}</span><span class="perm ${st?.motion === 'granted' ? 'ok' : ''}">${ic('car', 13)} ${t('permMotion')}: ${permLabel(st?.motion)}</span><span class="perm ${notificationState === 'granted' ? 'ok' : ''}">${ic('bell', 13)} ${t('permNotifications')}: ${permLabel(notificationState)}</span></div>${actionButton('open-settings', `${ic('gear', 15)} ${t('openSettings')}`, 'text-button')}`;
    const places = (['home', 'work', 'mosque'] as PlaceKind[]).map(k => placeCard(k, state.places[k], state.locale)).join('');
    const toggle = (id: string, on: boolean, label: string, note: string) => `<label class="setting-row"><span><strong>${label}</strong><p>${note}</p></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${label}"></label>`;
    const timed = state.smart.timed ? `<div class="sub-settings">${prayerPlace(state) ? '' : `<p class="tiny warning-text mb16">${t('timedNoPlace')}</p>`}<label class="select-row">${ic('clock', 16)}<span class="grow small">${t('sleepTime')}</span><input id="smart-sleep" type="time" value="${state.smart.sleepTime ?? ''}" aria-label="${t('sleepTime')}"></label></div>` : '';
    const prayer = `<section class="settings-section"><h2>${t('windowSpan')}</h2><div class="segment" role="group">${(['broad', 'narrow'] as const).map(x => `<button data-action="smart-span" data-span="${x}" class="${state.smart.span === x ? 'active' : ''}">${t(x === 'broad' ? 'spanBroad' : 'spanNarrow')}</button>`).join('')}</div><p class="tiny muted">${t('spanNote')}</p><label class="select-row mt12">${ic('globe', 16)}<span class="grow small">${t('prayerMethod')}</span><select id="smart-method" aria-label="${t('prayerMethod')}">${methodOptions()}</select></label>${toggle('smart-hanafi', state.smart.hanafi, t('hanafiAsr'), '')}</section>`;
    const which = `<section class="settings-section"><h2>${t('whichMoments')}</h2><div class="chip-wrap">${MOMENTS.map(m => `<button class="range-chip ${state.smart.moments.includes(m) ? 'selected' : ''}" data-action="smart-moment" data-moment="${m}" aria-pressed="${state.smart.moments.includes(m)}">${ic(MOMENT_ICON[m], 14)} ${t('m_' + m)}</button>`).join('')}</div></section>`;
    const tests = `<section class="settings-section"><h2>${t('testReminder')}</h2><div class="chip-wrap">${(['EXIT_HOME', 'ENTER_HOME', 'ENTER_VEHICLE', 'ENTER_MOSQUE'] as SmartEvent[]).map(e => `<button class="range-chip" data-action="smart-test" data-event="${e}">${t('ev_' + e)}</button>`).join('')}</div></section>`;
    const det = `<section class="settings-section"><div class="row between"><h2>${t('recentDetections')}</h2>${state.detections.length ? actionButton('detections-clear', t('clearHistory'), 'text-button') : ''}</div>${state.detections.length ? `<div class="stack">${[...state.detections].reverse().slice(0, 12).map(d => `<div class="detection"><span class="gold">${ic('radar', 15)}</span><span class="grow small">${t('ev_' + d.event)}${d.detail ? `<span class="tiny muted detection-detail">${escapeHtml(d.detail)}</span>` : ''}</span><span class="tiny muted">${escapeHtml(new Date(d.at).toLocaleString(state.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</span></div>`).join('')}</div>` : `<p class="empty">${t('noDetections')}</p>`}</section>`;
    const diag = (() => {
        const st2 = smartStatus, rows: string[] = [], warn: string[] = [];
        const anyOn = state.smart.location || state.smart.vehicle || state.smart.timed;
        if (!anyOn) warn.push(t('diagNoneOn'));
        if ((state.smart.location || state.smart.vehicle) && st2 && st2.location !== 'always') warn.push(t('diagNotAlways'));
        if (st2?.backgroundRefresh && st2.backgroundRefresh !== 'on') warn.push(t('diagBackgroundRefreshOff'));
        if (st2?.lowPower) warn.push(t('diagLowPower'));
        if (st2?.backgroundRefresh) rows.push(`<div class="diag-row"><span>${t('diagBackgroundRefresh')}</span><span class="${st2.backgroundRefresh === 'on' ? 'ok' : 'bad'}">${t(st2.backgroundRefresh === 'on' ? 'diagOn' : 'diagOff')}</span></div>`);
        rows.push(`<div class="diag-row"><span>${t('diagPlaces')}</span><span class="${st2?.monitoring?.length ? 'ok' : ''}">${st2?.monitoring?.length ? st2.monitoring.map(m => t('place_' + m)).join(', ') : t('diagNone')}</span></div>`);
        if (st2?.vehicleWatch !== undefined) rows.push(`<div class="diag-row"><span>${t('diagVehicle')}</span><span class="${st2.vehicleWatch ? 'ok' : ''}">${t(st2.vehicleWatch ? 'diagOn' : 'diagOff')}</span></div>`);
        if (st2?.configSaved !== undefined) rows.push(`<div class="diag-row"><span>${t('diagSaved')}</span><span class="${st2.configSaved ? 'ok' : 'bad'}">${t(st2.configSaved ? 'diagOn' : 'diagOff')}</span></div>`);
        return `<section class="settings-section"><h2>${t('diagnostics')}</h2>${warn.map(w => `<div class="notice warning mb16">${ic('info', 18)}<p>${w}</p></div>`).join('')}<div class="diag">${rows.join('')}</div></section>`;
    })();
    const needAlwaysCard = (pendingSmart.location || pendingSmart.vehicle) && smartStatus && smartStatus.location !== 'always' ? `<div class="always-card"><h3>${ic('pin', 18)} ${t('alwaysTitle')}</h3><p class="small">${t('alwaysSteps')}</p>${actionButton('open-settings', `${ic('gear', 15)} ${t('openSettings')}`, 'button primary full')}</div>` : '';
    return `${head}${chips}${diag}<section class="settings-section"><h2>${t('places')}</h2><p class="small muted mb16">${t('placesNote')}</p><div class="stack">${places}</div></section><section class="settings-section">${toggle('smart-location', state.smart.location, t('locationReminders'), t('locationRemindersNote'))}${needAlwaysCard}${toggle('smart-vehicle', state.smart.vehicle, t('vehicleReminders'), t('vehicleRemindersNote'))}${toggle('smart-timed', state.smart.timed, t('timedReminders'), t('timedRemindersNote'))}${timed}</section>${prayer}${which}${tests}${det}${shortcuts}${limits}`;
}
const copyFor = (m: Moment) => ({ title: t('m_' + m), body: momentPreview(m) ?? t('generalReminder') });
/** Pushes settings to the native engines, refreshes timed reminders and imports what was detected while closed. */
async function syncSmart(): Promise<void> {
    const bridge = smartBridge();
    if (!bridge) return;
    void syncSalah();
    try {
        const events = await bridge.takeEvents();
        if (events.length) await commit({ ...state, detections: mergeDetections(state.detections, events) });
        smartStatus = await bridge.configure(nativeConfig(state, copyFor));
        if ((pendingSmart.location || pendingSmart.vehicle) && smartStatus.location === 'always') {
            const enable = { ...pendingSmart };
            pendingSmart = { location: false, vehicle: false };
            if (enable.vehicle && smartStatus.motion !== 'granted') smartStatus = await bridge.requestMotion();
            await commit({ ...state, smart: { ...state.smart, location: state.smart.location || (enable.location && !!(state.places.home || state.places.work || state.places.mosque)), vehicle: state.smart.vehicle || (enable.vehicle && smartStatus.motion === 'granted') } });
            smartStatus = await bridge.configure(nativeConfig(state, copyFor));
            toast(t('enabledAfterSettings'));
        }
        void bridge.setDhikrAction(t('recitedIt'));
        notificationState = await bridge.notificationPermission(false);
        if (notificationState === 'granted') {
            await bridge.scheduleTimed(timedReminders(state, copyFor));
            await scheduleAthan(athanSchedule(state, (p, at) => ({ title: `${t('p_' + p)} · ${clock(at)}`, body: t('athanBody') })));
            await bridge.scheduleBefore(beforeSchedule(state, (p, m) => beforeCopy(p, m, state.locale)));
            await syncIstighfar();
            await syncRotation();
            await syncCalendar();
        }
        await syncFajrAlarm().catch(e => { console.error('AyahFlow Fajr alarm sync failed', e instanceof Error ? e.message : e); if (state.fajrAlarm.enabled) toast(t('alarmSyncFailed')); });
        await pushWidget();
    }
    catch (e) { console.error('AyahFlow reminders sync failed', e instanceof Error ? e.message : e); if (state.smart.location || state.smart.vehicle || state.smart.timed || state.athan.enabled) toast(t('reminderSyncFailed')); }
}
/** Today's counts, adhkar progress and the latest step reading (only while the step tracker is on) for the widget. */
function widgetDaily(): WidgetDaily {
    const today = stepReading?.days.find(x => x.day === dayKey())?.steps;
    return {
        day: dayKey(),
        counters: counterDefs().map(c => ({ id: c.id, label: c.name, n: count(c.id), total: c.total, atLeast: !!c.atLeast, perPrayer: !!c.perPrayer })),
        adhkar: (['morning', 'evening', 'sleep'] as const).map(m => { const [done, total] = momentProgress(m); return { key: m, label: t('m_' + m), done, total }; }),
        steps: state.health.steps && today !== undefined ? { today, goal: state.health.stepGoal, at: stepsAt } : null,
    };
}
function widgetWorship(now = Date.now()) {
    const days = [-1, 0, 1].map(i => { const d = new Date(now); d.setDate(d.getDate() + i); return dayKey(d.getTime()); });
    return { salah: days.map(day => ({ day, kept: PRAYERS.filter(p => { const s = salahStatus(state, day, p); return s === 'done' || s === 'madeUp'; }) })), moments: upcomingMoments(now, 48) };
}
/** The last widget write failure (the native OSStatus), shown on the prayer page until a write succeeds. */
let widgetError: string | null = null;
async function pushWidget(): Promise<void> {
    if (!isNative()) return;
    try {
        await setWidgetData(widgetData(state, t, Date.now(), { athan: state.athan.enabled ? (state.athan.sound === 'chime' ? t('soundChime') : reciterName(state.athan.reciter)) : t('athanOffShort'), athanOn: state.athan.enabled ? '1' : '0' }, widgetDaily(), widgetWorship()));
        widgetError = null;
    }
    catch (e) {
        const err = e as { code?: string; message?: string };
        widgetError = err?.code ?? 'error';
        console.error('AyahFlow widget update failed', err?.message ?? e);
    }
}
/** Re-plans istighfar reminders, e.g. after the count changes, so the count they show stays right and they stop at the target. */
/** The chosen rotation phrases, built-in (with their source) and the user's own. */
function rotationPhrases(): { id: string; text: string; note: string }[] {
    return state.rotation.phrases.flatMap(id => {
        const r = ROTATION.find(x => x.id === id);
        if (r) return [{ id, text: r.text, note: `${r.source.collection} ${r.source.number}` }];
        const mine = state.myCounters.find(x => x.id === id);
        return mine ? [{ id, text: mine.text, note: t('addedByYou') }] : [];
    });
}
async function syncRotation(): Promise<void> {
    const bridge = smartBridge();
    if (bridge) await bridge.scheduleRotation(rotationReminders(state, rotationPhrases(), t('rotationTitle')));
}
const rotationLabel = (every: number) => every < 60 ? `${num(every)} ${t('minuteShort')}` : `${num(every / 60)} ${t('hourShort')}`;
function rotationView(): string {
    const r = state.rotation, chosen = new Set(r.phrases), next = rotationReminders(state, rotationPhrases(), '', Date.now()).slice(0, 3);
    const row = (id: string, text: string, note: string, arabic: boolean) => `<label class="phrase-row ${chosen.has(id) ? 'on' : ''}"><input type="checkbox" id="rot-p-${id}" ${chosen.has(id) ? 'checked' : ''} aria-label="${escapeHtml(text)}"><span class="grow"><span class="${arabic ? 'arabic' : ''} phrase-text" ${arabic ? 'lang="ar" dir="rtl"' : 'dir="auto"'}>${escapeHtml(text)}</span><span class="tiny muted">${escapeHtml(note)}</span></span></label>`;
    const groups = ROTATION_GROUPS.map(g => `<h3 class="small gold mt20 mb8">${t('rot_' + g.key)}</h3>${g.ids.map(id => { const p = ROTATION.find(x => x.id === id)!; return row(id, p.text, `${p.source.collection} ${p.source.number}`, true); }).join('')}`).join('');
    const own = state.myCounters.length ? `<h3 class="small gold mt20 mb8">${t('addedByYou')}</h3>${state.myCounters.map(c => row(c.id, c.text, c.title || t('addedByYou'), false)).join('')}` : '';
    const preview = r.enabled && next.length ? `<div class="notice mt12">${ic('bell', 18)}<p>${t('rotationNext')}<br>${next.map(n => `<bdi>${clock(n.at)}</bdi> · <span lang="ar" dir="auto">${escapeHtml(n.body.split('\n')[0]!)}</span>`).join('<br>')}</p></div>` : '';
    return `<p class="eyebrow mt12">${t('adhkar')}</p><h1 class="page-title">${t('rotationTitle')}</h1><p class="page-sub">${t('rotationIntro')}</p>
${isNative() ? '' : miniNotice('rotationWeb')}
<section class="settings-section"><label class="setting-row"><span><strong>${t('rotationOn')}</strong><p>${t('rotationOnSub')}</p></span><input type="checkbox" id="rot-enabled" ${r.enabled ? 'checked' : ''} aria-label="${t('rotationOn')}"></label>
<h2 class="mt20">${t('rotationEvery')}</h2><div class="segment" role="group">${ROTATION_INTERVALS.map(n => `<button data-action="rot-every" data-every="${n}" class="${r.every === n ? 'active' : ''}" aria-pressed="${r.every === n}">${rotationLabel(n)}</button>`).join('')}</div>
<h2 class="mt20">${t('rotationHours')}</h2><div class="row gap8"><label class="select-row grow">${t('rotationFrom')} <input type="time" id="rot-from" value="${r.from}"></label><label class="select-row grow">${t('rotationTo')} <input type="time" id="rot-to" value="${r.to}"></label></div>${preview}</section>
<section class="section"><div class="row between"><h2 class="section-title">${t('rotationPhrases')}</h2><span class="tiny muted">${num(chosen.size)}</span></div>${groups}${own}
<button class="text-button mt12" data-action="nav" data-view="counter">${ic('tasbih', 14)} ${t('addCounter')}</button></section>
<p class="gentle">${t('rotationLimit').replace('{n}', num(rotationMax(state)))}</p>`;
}
async function syncIstighfar(): Promise<void> {
    const bridge = smartBridge(), c = counter('istighfar');
    if (!bridge) return;
    const phrase = c.steps[0]!.text;
    await bridge.scheduleIstighfar(istighfarReminders(state, count(c.id), c.total, n => ({ title: c.title[state.locale], body: n === null ? `${t('istighfarGoal')} ${num(c.total)}\n${phrase}` : `${num(n)} ${t('of')} ${num(c.total)} ${t('istighfarToday')}\n${phrase}` })));
}
const platform = (): string => (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() ?? 'web';
/** Each reminder asks for its permission only when the user turns it on, and stays off if it is refused. */
async function changeSmart(el: HTMLInputElement): Promise<void> {
    const bridge = smartBridge();
    const smart = { ...state.smart };
    if (el.id === 'smart-method') smart.method = el.value as PrayerMethod;
    if (el.id === 'smart-hanafi') smart.hanafi = el.checked;
    if (el.id === 'smart-sleep') smart.sleepTime = /^\d\d:\d\d$/.test(el.value) ? el.value : null;
    if (bridge && el.checked && ['smart-location', 'smart-vehicle', 'smart-timed'].includes(el.id) && await bridge.notificationPermission(true) !== 'granted') {
        toast(t('needNotifications'));
        el.checked = false;
        return;
    }
    if (el.id === 'smart-timed') smart.timed = el.checked;
    if (el.id === 'smart-location') {
        if (el.checked && !(state.places.home || state.places.work || state.places.mosque)) { toast(t('needHome')); el.checked = false; return; }
        if (el.checked && bridge) { smartStatus = await bridge.requestAlways(); if (smartStatus.location !== 'always') { pendingSmart.location = true; el.checked = false; render(); return; } }
        smart.location = el.checked;
    }
    if (el.id === 'smart-vehicle') {
        if (el.checked && bridge) {
            smartStatus = await bridge.requestMotion();
            if (smartStatus.motion !== 'granted') { toast(t('needMotion')); el.checked = false; render(); return; }
            // iOS checks motion when significant location changes wake the app, which needs "Always" location.
            if (platform() === 'ios' && smartStatus.location !== 'always') { smartStatus = await bridge.requestAlways(); if (smartStatus.location !== 'always') { pendingSmart.vehicle = true; el.checked = false; render(); return; } }
        }
        smart.vehicle = el.checked;
    }
    await commit({ ...state, smart });
    await syncSmart();
}
// ---- Prayer times and athan ----------------------------------------------------------------------
const clock = (at: number) => new Date(at).toLocaleTimeString(state.locale === 'ar' ? 'ar' : state.locale, { hour: '2-digit', minute: '2-digit' });
function countdown(at: number, now = Date.now()): string {
    const m = Math.max(0, Math.round((at - now) / 60000)), h = Math.floor(m / 60);
    return `${t('inTime')} ${h ? `${num(h)} ${t('hourShort')} ` : ''}${num(m % 60)} ${t('minuteShort')}`;
}
function hijri(date = new Date()): string {
    try { return new Intl.DateTimeFormat(`${state.locale === 'ar' ? 'ar' : state.locale}-u-ca-islamic-umalqura`, { day: 'numeric', month: 'long', year: 'numeric' }).format(date); }
    catch { return ''; }
}
function dateLine(): string {
    const now = new Date();
    return `<p class="date-line"><span>${escapeHtml(now.toLocaleDateString(state.locale, { weekday: 'long', day: 'numeric', month: 'long' }))}</span><span class="date-dot" aria-hidden="true"></span><span class="gold" title="${t('hijriNote')}">${escapeHtml(hijri(now))}</span></p>`;
}
function bannerTitle(): string { return audioState === 'loading' ? t('loadingAudio') : previewing ? t('athan') : t(ownAudio ? 'yourRecording' : 'reference'); }
function bannerSub(): string { return previewing ? reciterName(previewing) : ownAudio ? t('privateRecording') : queueLabel ? `${queueLabel} · ${t('audioProvider')}` : t('audioProvider'); }
const reciterName = (id: string) => id === 'custom' ? state.athan.custom?.name ?? t('kindOwn') : id.startsWith('online-') ? online(id.slice(7))?.name[state.locale] ?? id : recording(id)?.name[state.locale] ?? id;
/** Download in progress (online id), so its button shows progress. */
let downloadingAthan: string | null = null;
function onlineCard(r: typeof ONLINE_RECORDINGS[number]): string {
    const id = `online-${r.id}`, have = state.athan.downloads.includes(r.id), playing = previewing === id && audioState === 'playing';
    const active = r.fajrOnly ? state.athan.fajrReciter === id : state.athan.reciter === id;
    const meta = `${num(Math.round(r.seconds / 60 * 10) / 10)} ${t('minuteShort')} · ${num(Math.round(r.bytes / 100000) / 10)} ${t('megabytes')}${r.fajrOnly ? ` · ${t('fajrOnlyTag')}` : ''}`;
    const action = !have ? (downloadingAthan === r.id ? `<span class="pill gold">${t('downloading')}</span>` : actionButton('athan-download', `${ic('download', 15)} ${t('download')}`, 'button subtle', `data-online="${r.id}" ${smartBridge() ? '' : 'disabled'}`))
        : active ? `<span class="pill success">${ic('check', 12)} ${t('selected')}</span>` : actionButton('athan-reciter', t(r.fajrOnly ? 'useForFajr' : 'choose'), 'button subtle', `data-reciter="${id}" ${r.fajrOnly ? 'data-fajr="1"' : ''}`);
    return `<div class="reciter ${active ? 'selected' : ''}"><button class="reciter-play" data-action="athan-preview" data-reciter="${id}" aria-label="${t(playing ? 'stopAthan' : 'listenAthan')}: ${escapeHtml(r.name[state.locale])}">${ic(playing ? 'stop' : 'play', 16)}</button><div class="grow"><strong>${escapeHtml(r.name[state.locale])}</strong><p class="tiny muted">${meta}</p><p class="tiny reciter-credit">${have ? `${ic('check', 11)} ${t('onDevice')} · ${actionButton('athan-remove-online', t('removeOwn'), 'link-button', `data-online="${r.id}"`)}` : t('streamNote')}</p></div>${action}</div>`;
}
function reciterCard(id: string): string {
    const r = recording(id), active = state.athan.reciter === id, playing = previewing === id && audioState === 'playing';
    const credit = r ? `<a href="${r.page}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.author.split(' (')[0]!)} · ${escapeHtml(r.licence)}${ic('link', 11)}</a>` : `<span>${escapeHtml(state.athan.custom?.name ?? '')}</span>`;
    return `<div class="reciter ${active ? 'selected' : ''}"><button class="reciter-play" data-action="athan-preview" data-reciter="${id}" aria-label="${t(playing ? 'stopAthan' : 'listenAthan')}: ${escapeHtml(reciterName(id))}">${ic(playing ? 'stop' : 'play', 16)}</button><div class="grow"><strong>${escapeHtml(reciterName(id))}</strong><p class="tiny muted">${t(id === 'custom' ? 'kindOwn' : r!.kind === 'field' ? 'kindField' : 'kindStudio')}</p><p class="tiny reciter-credit">${credit}</p></div>${active ? `<span class="pill success">${ic('check', 12)} ${t('selected')}</span>` : actionButton('athan-reciter', t('choose'), 'button subtle', `data-reciter="${id}"`)}</div>`;
}
function prayerStrip(): string {
    const next = nextPrayer(state);
    if (!next) return '';
    return `<button class="prayer-strip" data-action="nav" data-view="prayer"><span class="gold">${ic('mosque', 20)}</span><span class="grow"><span class="tiny muted">${t('nextPrayer')}</span><strong>${t('p_' + next.prayer)} · ${clock(next.at)}</strong></span><span class="small gold" data-countdown="${next.at}">${countdown(next.at)}</span>${state.athan.enabled ? ic('bell', 15) : ''}</button>`;
}
/** Readable method names (they name the authority, so they are not translated). */
const METHOD_LABEL: Record<PrayerMethod, string> = { MuslimWorldLeague: 'Muslim World League', Egyptian: 'Egyptian General Authority of Survey', Karachi: 'University of Islamic Sciences, Karachi', UmmAlQura: 'Umm al-Qura, Makkah', Dubai: 'Dubai (UAE)', MoonsightingCommittee: 'Moonsighting Committee', NorthAmerica: 'ISNA (North America)', Kuwait: 'Kuwait', Qatar: 'Qatar', Singapore: 'MUIS (Singapore)', Tehran: 'Institute of Geophysics, Tehran', Turkey: 'Diyanet (Turkey)' };
const methodOptions = () => PRAYER_METHODS.map(m => `<option value="${m}" ${state.smart.method === m ? 'selected' : ''}>${METHOD_LABEL[m]}</option>`).join('');
/** Method and Asr choice beside the times they change, with today's Asr both ways and a regional suggestion. */
function calculationSection(): string {
    const day = new Date();
    const asr = (hanafi: boolean) => { const t = timesFor({ ...state, smart: { ...state.smart, hanafi } }, day); return t ? clock(t.asr) : '—'; };
    return `<section class="settings-section"><h2>${t('calculation')}</h2><label class="select-row">${ic('globe', 16)}<select id="smart-method" aria-label="${t('prayerMethod')}">${methodOptions()}</select></label>
<label class="setting-row"><span><strong>${t('hanafiAsr')}</strong><p>${t('asrBothWays').replace('{standard}', asr(false)).replace('{hanafi}', asr(true))}</p></span><input type="checkbox" id="smart-hanafi" ${state.smart.hanafi ? 'checked' : ''} aria-label="${t('hanafiAsr')}"></label><p class="tiny muted mt12">${t('methodCheckMosque')}</p></section>`;
}
/** Shown first on the prayer screen when the settings differ from what mosques around the saved place usually use:
 * the times both ways and one button to switch. Dismissing it keeps the user's choice for this session. */
let timesHintDismissed = false;
function timesHint(): string {
    const hint = suggestedMethod(prayerPlace(state));
    if (timesHintDismissed || !hint || (hint.method === state.smart.method && !state.smart.hanafi)) return '';
    const usual = timesFor({ ...state, smart: { ...state.smart, method: hint.method, hanafi: false } }, new Date());
    if (!usual) return '';
    const now = [METHOD_LABEL[state.smart.method], state.smart.hanafi ? t('hanafiAsr') : ''].filter(Boolean).join(' + ');
    return `<div class="always-card"><h3>${ic('clock', 18)} ${t('timesHintTitle')}</h3><p class="small">${t('timesHintBody').replace('{now}', now).replace('{region}', t('region_' + hint.region)).replace('{method}', METHOD_LABEL[hint.method])}</p><p class="small gold"><bdi>${t('p_fajr')} ${clock(usual.fajr)} · ${t('p_asr')} ${clock(usual.asr)} · ${t('p_isha')} ${clock(usual.isha)}</bdi></p>${actionButton('fix-times', `${ic('check', 15)} ${t('useMethod').replace('{method}', METHOD_LABEL[hint.method])}`, 'button primary full', `data-method="${hint.method}"`)}${actionButton('keep-times', t('keepMySettings'), 'text-button')}</div>`;
}
function prayerView(): string {
    const now = Date.now(), times = timesFor(state, new Date(now)), next = nextPrayer(state, now);
    const head = `<p class="page-sub">${t('prayerTimesSub')}</p>`;
    if (!times) return `${head}<div class="notice warning">${ic('pin', 18)}<p>${t('noPlacePrayer')}</p></div><div class="mt20">${primary('nav', t('savePlaces'), 'data-view="reminders"')}</div>`;
    const bellsOn = state.athan.enabled || state.athan.before.enabled;
    const rows: [string, number][] = [['fajr', times.fajr], ['sunrise', times.sunrise], ['dhuhr', times.dhuhr], ['asr', times.asr], ['maghrib', times.maghrib], ['isha', times.isha]];
    const list = rows.map(([k, at]) => { const isNext = !!next && next.prayer === k && next.at === at, prayer = (PRAYERS as readonly string[]).includes(k); return `<div class="prayer-row ${isNext ? 'next' : ''} ${at < now ? 'past' : ''}"><span class="grow"><strong>${t('p_' + k)}</strong>${isNext ? `<span class="tiny gold" data-countdown="${at}">${countdown(at, now)}</span>` : ''}</span><span class="prayer-time">${clock(at)}</span>${prayer ? `<button class="icon-button ${bellsOn && state.athan.prayers[k as PrayerName] ? 'active' : ''}" data-action="athan-prayer" data-prayer="${k}" aria-pressed="${state.athan.prayers[k as PrayerName]}" aria-label="${t('athan')} · ${t('p_' + k)}" ${bellsOn ? '' : 'disabled'}>${ic('bell', 17)}</button>` : '<span class="bell-spacer"></span>'}</div>`; }).join('');
    const tomorrow = next && dayKey(next.at) !== dayKey(now) ? `<p class="tiny muted mt12">${t('nextPrayer')}: ${t('p_' + next.prayer)} · ${clock(next.at)}</p>` : '';
    const reciters = [...ATHAN_RECORDINGS.map(r => r.id), ...ONLINE_RECORDINGS.filter(r => !r.fajrOnly && state.athan.downloads.includes(r.id)).map(r => `online-${r.id}`), ...(state.athan.custom ? ['custom'] : [])];
    const fajrChoices = [...reciters, ...ONLINE_RECORDINGS.filter(r => r.fajrOnly && state.athan.downloads.includes(r.id)).map(r => `online-${r.id}`)];
    const own = `<div class="own-athan"><label class="button secondary full" for="athan-file">${ic('upload', 16)} ${t(state.athan.custom ? 'replaceOwn' : 'useOwn')}</label><input type="file" id="athan-file" accept="audio/*" hidden>${state.athan.custom ? actionButton('athan-remove-own', t('removeOwn'), 'text-button danger-text') : ''}<p class="tiny muted mt12">${t('ownNote')}</p></div>`;
    const athan = `<section class="settings-section"><label class="setting-row"><span><strong>${t('athanToggle')}</strong><p>${t('athanToggleNote')}</p></span><input type="checkbox" id="athan-enabled" ${state.athan.enabled ? 'checked' : ''} aria-label="${t('athanToggle')}"></label><h2 class="mt20">${t('athanSound')}</h2><div class="segment" role="group">${(['athan', 'chime'] as const).map(x => `<button data-action="athan-sound" data-sound="${x}" class="${state.athan.sound === x ? 'active' : ''}">${t(x === 'athan' ? 'soundAthan' : 'soundChime')}</button>`).join('')}</div>${awaySection()}</section>${beforeSection()}<section class="settings-section"><h2>${t('reciter')}</h2><p class="picker-label">${t('onDevice')}</p><div class="stack">${[...ATHAN_RECORDINGS.map(r => r.id), ...(state.athan.custom ? ['custom'] : [])].map(reciterCard).join('')}</div>${own}<p class="picker-label mt20">${t('moreReciters')}</p><p class="tiny muted mb16">${t('moreRecitersNote')} <a href="${ONLINE_PROVIDER.page}" target="_blank" rel="noopener noreferrer">${escapeHtml(ONLINE_PROVIDER.provider)}${ic('link', 11)}</a>${smartBridge() ? '' : `<br>${t('appOnlyDownload')}`}</p><div class="stack">${ONLINE_RECORDINGS.map(onlineCard).join('')}</div><label class="select-row mt20">${ic('sun', 16)}<span class="grow small">${t('fajrReciter')}</span><select id="athan-fajr" aria-label="${t('fajrReciter')}">${fajrChoices.map(id => `<option value="${id}" ${state.athan.fajrReciter === id ? 'selected' : ''}>${escapeHtml(reciterName(id))}</option>`).join('')}</select></label><div class="notice warning mt12">${ic('info', 18)}<p>${t('reciterReview')}</p></div></section>`;
    return `${head}${timesHint()}<div class="prayer-list">${list}</div>${tomorrow}${fajrAlarmSection(times)}${calculationSection()}${athan}${calendarSection()}<section class="settings-section">${widgetError ? `<div class="notice warning" role="status">${ic('info', 18)}<p>${t('widgetSaveFailed').replace('{code}', escapeHtml(widgetError))}</p></div>` : ''}${smartBridge() ? `<div class="notice">${ic('info', 18)}<p>${t('widgetTip')}</p></div>` : ''}<button class="feature-wide row" data-action="nav" data-view="reminders"><span class="gold">${ic('globe', 22)}</span><span class="grow"><h3>${t('calcSettings')}</h3><p>${escapeHtml(state.smart.method.replace(/([a-z])([A-Z])/g, '$1 $2'))}${state.smart.hanafi ? ` · ${t('hanafiAsr')}` : ''}</p></span>${chevronEnd()}</button></section>`;
}
/** The last notification test: what was checked and what iOS reported, shown until the next test or reload. */
/** Athan at Home only: the switch and, when on, what is missing or where iOS last saw the phone. iPhone only: Android
 * takes an alert's sound from its notification channel, which cannot change once the alert is planned. */
function awaySection(): string {
    if (state.athan.sound !== 'athan' || platform() === 'android') return '';
    const on = state.athan.awayChime, home = smartStatus?.home ?? 'unknown';
    const warn = (key: string, button = '') => `<div class="notice warning mt12">${ic('info', 18)}<p>${t(key)}</p></div>${button}`;
    const detail = !on ? '' : !state.places.home ? warn('awayNeedHome', actionButton('nav', `${ic('pin', 15)} ${t('awayOpenPlaces')}`, 'button subtle mt12', 'data-view="reminders"'))
        : smartStatus && smartStatus.location !== 'always' ? warn('awayNeedAlways', actionButton('open-settings', `${ic('gear', 15)} ${t('openSettings')}`, 'button subtle mt12'))
        : `<p class="small mt12">${t('awayNow')}: <strong>${t(home === 'in' ? 'awayAtHome' : home === 'out' ? 'awayAway' : 'awayUnknown')}</strong></p><p class="tiny muted">${t('awayDelay')}</p>`;
    return `<label class="setting-row mt12"><span><strong>${t('awayToggle')}</strong><p>${t('awayNote')}</p></span><input type="checkbox" id="athan-away" ${on ? 'checked' : ''} aria-label="${t('awayToggle')}"></label>${detail}`;
}
let testReport: { kind: 'before' | 'athan'; rows: [string, string, boolean | null][]; notes: string[]; ok: boolean } | null = null;
/** Reminder before prayer: the switch, how long before, the next one planned, and the two sound tests. */
function beforeSection(): string {
    const b = state.athan.before, next = beforeSchedule(state, (p, m) => beforeCopy(p, m, state.locale))[0];
    const lead = b.enabled ? `<p class="picker-label mt12">${t('beforeLead')}</p><div class="segment" role="group" aria-label="${t('beforeLead')}">${BEFORE_MINUTES.map(m => `<button data-action="before-minutes" data-min="${m}" class="${b.minutes === m ? 'active' : ''}" aria-pressed="${b.minutes === m}">${num(m)} ${t('minuteShort')}</button>`).join('')}</div>${next ? `<p class="small">${t('beforeNext')}: <strong><bdi>${t('p_' + next.prayer)} · ${clock(next.at)}</bdi></strong></p>` : ''}<p class="tiny muted mt12">${t('beforeLimit')}</p>` : '';
    const report = testReport ? `<div class="test-report mt12" role="status">${testReport.notes.map(n => `<div class="notice ${testReport!.ok ? '' : 'warning'} mb16">${ic(testReport!.ok ? 'bell' : 'info', 18)}<p>${escapeHtml(n)}</p></div>`).join('')}<div class="diag">${testReport.rows.map(([k, v, ok]) => `<div class="diag-row"><span>${escapeHtml(k)}</span><span class="${ok === true ? 'ok' : ok === false ? 'bad' : ''}"><bdi>${escapeHtml(v)}</bdi></span></div>`).join('')}</div></div>` : '';
    const tests = smartBridge() ? `<h3 class="small gold mt20 mb8">${t('testTitle')}</h3><p class="tiny muted mb16">${t('testNote')}</p><div class="test-buttons">${actionButton('test-before', `${ic('bell', 16)}<span>${t('testBefore').replace('{n}', num(b.minutes))}</span>`, 'button secondary')}${actionButton('test-athan', `${ic('play', 16)}<span>${t('testAthan')}</span>`, 'button secondary')}</div>${report}` : `<div class="mt12">${miniNotice('nativeOnlyReminders')}</div>`;
    return `<section class="settings-section" id="before-prayer"><h2>${t('beforeSection')}</h2><label class="setting-row"><span><strong>${t('beforeToggle')}</strong><p>${t('beforeNote')}</p></span><input type="checkbox" id="before-enabled" ${b.enabled ? 'checked' : ''} aria-label="${t('beforeToggle')}"></label>${lead}${tests}</section>`;
}
/** Schedules one test notification ~15 s ahead with the real sound and reports permission, sound settings, the sound
 * file and whether iOS kept it. It never claims the sound played: only the person holding the phone can tell. */
async function runNotificationTest(kind: 'before' | 'athan'): Promise<void> {
    const bridge = smartBridge();
    if (!bridge) return;
    const a = state.athan, next = nextPrayer(state)?.prayer ?? 'asr';
    const n: TestNotification = kind === 'before'
        ? { id: TEST_BEFORE_ID, kind, title: beforeCopy(next, a.before.minutes, state.locale).title, body: t('testBeforeBody'), reciter: null, customVersion: null }
        : { id: TEST_ATHAN_ID, kind, title: `${t('athan')} · ${a.sound === 'chime' ? t('soundChime') : reciterName(a.reciter)}`, body: t('testAthanBody'), reciter: a.sound === 'chime' ? null : a.reciter, customVersion: a.custom?.version ?? null, homeOnly: athanHomeOnly(state) };
    const rows: [string, string, boolean | null][] = [], notes: string[] = [];
    let ok = true;
    const permission = await bridge.notificationPermission(true).catch(() => 'denied' as const);
    notificationState = permission;
    rows.push([t('diagPermission'), permLabel(permission), permission === 'granted']);
    const sound = bridge.soundFor(n), check = await bridge.notificationCheck(sound ? [sound] : []);
    if (check.sound) rows.push([t('diagSounds'), t(check.sound === 'on' ? 'diagOn' : 'diagOff'), check.sound === 'on']);
    if (check.sound === 'off') { ok = false; notes.push(t('diagSoundsOff')); }
    const where = sound ? check.files?.[sound] : undefined;
    rows.push([t('diagSoundFile'), sound ? `${sound} · ${t(where === undefined ? 'diagUnknown' : where === 'missing' ? 'diagMissing' : 'diagFound')}` : t('diagSystemDefault'), where === undefined ? null : where !== 'missing']);
    if (permission !== 'granted') { notes.push(t('diagPermOff')); testReport = { kind, rows, notes, ok: false }; return; }
    try {
        const r = await bridge.scheduleTest(n, 15);
        rows.push([t('diagPending'), t(r.pending ? 'diagYes' : 'diagNo'), r.pending]);
        if (r.pending) notes.unshift(t('testScheduled').replace('{time}', new Date(r.at).toLocaleTimeString(state.locale === 'ar' ? 'ar' : state.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })));
        else { ok = false; notes.push(t('diagNotPending')); }
    }
    catch (e) { ok = false; notes.push(`${t('testFailed')} ${e instanceof Error ? e.message : ''}`.trim()); }
    testReport = { kind, rows, notes, ok };
}
/** Keeps countdowns current while a page shows them, without re-rendering. */
let lastSlot = slotOf(Date.now());
setInterval(() => {
    document.querySelectorAll<HTMLElement>('[data-countdown]').forEach(el => { el.textContent = countdown(Number(el.dataset.countdown)); });
    // A new half hour brings a new ayah on Home, unless the user is reading the current one or has a dialog open.
    const slot = slotOf(Date.now());
    if (slot !== lastSlot && view === 'today' && !ayahBrowse && !(ayahPin && Date.now() < ayahPin.until) && !document.querySelector('dialog[open]')) { lastSlot = slot; const y = window.scrollY; render(); window.scrollTo(0, y); }
}, 30000);
// ---- Counters and steps ------------------------------------------------------------------------
/** Today's count for a counter, including taps not saved yet. */
function count(id: string): number { const p = pendingCounts[id]; return p && dayKey(p.at) === dayKey() ? p.n : countOn(state, id); }
/** Built-in counters (sourced) and the user's own (shown as theirs, unchecked), in one shape for the screens. */
interface CounterDef { id: string; name: string; steps: readonly { text: string; count: number }[]; total: number; atLeast?: boolean; perPrayer?: boolean; builtIn: DhikrCounter | null; library: LibraryDhikr | null; custom: CustomCounter | null; kind: 'sunnah' | 'personal' | 'own'; sourced: number }
/** Built-in counters, the library and the user's own, in one shape. A personal target replaces the number counted
 * towards, while the sourced or suggested number stays shown beside it. */
function counterDefs(): CounterDef[] {
    const goal = state.worship.targets;
    return [...COUNTERS.map(c => { const total = c.steps.length === 1 ? goal[c.id] ?? c.total : c.total; return { id: c.id, name: c.title[state.locale], steps: c.steps.length === 1 ? [{ text: c.steps[0]!.text, count: total }] : c.steps, total, atLeast: c.atLeast && total === c.total, perPrayer: c.perPrayer, builtIn: c, library: null, custom: null, kind: 'sunnah' as const, sourced: c.total }; }),
        ...LIBRARY.map(l => { const total = goal[l.id] ?? l.target; return { id: l.id, name: l.title[state.locale], steps: [{ text: l.text, count: total }], total, builtIn: null, library: l, custom: null, kind: l.targetKind, sourced: l.target }; }),
        ...state.myCounters.map(m => ({ id: m.id, name: m.title || m.text, steps: [{ text: m.text, count: m.target }], total: m.target, builtIn: null, library: null, custom: m, kind: 'own' as const, sourced: m.target }))];
}
const counterDef = (id: string): CounterDef => counterDefs().find(c => c.id === id) ?? counterDefs()[0]!;
const target = (c: { atLeast?: boolean; total: number }) => c.atLeast ? `${num(c.total)}+` : num(c.total);
/** Saves pending taps. A failed save keeps them pending (and says so) rather than showing them as saved. */
async function flushCounts(): Promise<void> {
    if (countTimer) { clearTimeout(countTimer); countTimer = null; }
    const ids = Object.keys(pendingCounts);
    if (!ids.length) return;
    let next = state;
    for (const id of ids) next = setCount(next, id, pendingCounts[id]!.n, pendingCounts[id]!.at);
    const saved = ids.map(id => [id, pendingCounts[id]!] as const);
    try { if (next !== state) await commit(next); } catch { return; }
    for (const [id, p] of saved) if (pendingCounts[id] === p) delete pendingCounts[id];
    void pushWidget();
    if (state.istighfarReminder && saved.some(([id]) => id === 'istighfar')) void syncIstighfar().catch(() => { });
}
function ring(p: number, inner: string, cls = ''): string { return `<span class="ring ${cls}" style="--p:${Math.max(0, Math.min(100, p))}%">${inner}</span>`; }
function counterTile(c: CounterDef): string {
    const n = count(c.id), done = !c.perPrayer && n >= c.total;
    return `<button class="moment-tile ${done ? 'finished' : ''}" data-action="counter" data-counter="${c.id}"><span class="gold">${ic('tasbih', 22)}</span><span class="moment-name" dir="auto">${escapeHtml(c.name)}</span>${c.custom ? `<span class="tiny gold">${t('addedByYou')}</span>` : ''}<span class="tiny muted">${c.perPrayer ? `${num(Math.floor(n / c.total))} ${t('rounds')}` : `${num(n)} / ${target(c)}`}</span></button>`;
}
/** A ring of tasbih beads: one per count up to 33; longer targets fill the same beads proportionally. */
function beads(done: number, total: number): string {
    const n = Math.min(total, 33), on = total <= 33 ? done : Math.floor(done / total * n), step = 360 / Math.max(n, 1);
    return `<svg class="beads" viewBox="0 0 200 200" aria-hidden="true">${Array.from({ length: n }, (_, i) => { const a = (i * step - 90) * Math.PI / 180; return `<circle class="bead ${i < on ? 'on' : i === on ? 'current' : ''}" cx="${(100 + 88 * Math.cos(a)).toFixed(2)}" cy="${(100 + 88 * Math.sin(a)).toFixed(2)}" r="${n > 20 ? 5 : 6.5}"/>`; }).join('')}</svg>`;
}
/** Istighfar heart (an anatomical heart drawn for AyahFlow): charcoal, filling with red from the bottom as the count
 * nears the target. A visual only, not a measure of anything. */
function heart(id: string, p: number): string {
    const level = (q: number) => 100 * Math.max(0, Math.min(1, q)), h = level(p);
    const from = heartShown?.id === id && !state.reducedMotion ? level(heartShown.p) : h, beat = heartBeat && !state.reducedMotion;
    heartShown = { id, p }; heartBeat = false;
    const rise = from !== h ? `<animate attributeName="y" from="${(100 - from).toFixed(2)}" to="${(100 - h).toFixed(2)}" dur=".45s" calcMode="spline" keySplines=".2 .8 .2 1" fill="freeze"/><animate attributeName="height" from="${from.toFixed(2)}" to="${h.toFixed(2)}" dur=".45s" calcMode="spline" keySplines=".2 .8 .2 1" fill="freeze"/>` : '';
    return `<svg class="heart ${p >= 1 ? 'full' : ''} ${beat ? 'beat' : ''}" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="heart-fill"><rect x="0" y="${(100 - h).toFixed(2)}" width="100" height="${h.toFixed(2)}">${rise}</rect></clipPath></defs><g>${heartArt(HEART_DARK)}</g><g clip-path="url(#heart-fill)">${heartArt(HEART_RED)}</g></svg>`;
}
type HeartPalette = { body: string; shade: string; vessel: string; aorta: string; pulmonary: string; vein: string; shine: string };
const HEART_DARK: HeartPalette = { body: '#2d2725', shade: '#221d1b', vessel: '#3b3330', aorta: '#3a3230', pulmonary: '#453c38', vein: '#463d39', shine: '#564b46' };
const HEART_RED: HeartPalette = { body: '#be1b33', shade: '#9c0820', vessel: '#d8465f', aorta: '#e95b70', pulmonary: '#f2a8b6', vein: '#f3afbd', shine: '#fad6de' };
function heartArt(c: HeartPalette): string {
    return `<path d="M25 37V14a5 5 0 0 1 10 0v26Z" fill="${c.vein}"/><path d="M28 15v17" stroke="${c.shine}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
<path d="M46 14 41 6M54 12l1-8M62 15l5-7" stroke="${c.aorta}" stroke-width="6" stroke-linecap="round"/><path d="M46 14 41 6M54 12l1-8M62 15l5-7" stroke="${c.pulmonary}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
<path d="M17 52c-4 14 0 28 12 37 13 9 31 10 42 4 6-4 9-13 9-25 0-12-3-22-9-27-12-9-38-8-54 11Z" fill="${c.shade}"/>
<path d="M27 49c-1 12 3 25 13 32 11 7 25 9 34 6 5-5 6-12 6-19 0-12-3-22-9-27-12-8-30-6-44 8Z" fill="${c.body}"/>
<path d="M34 41c-3-11 2-24 14-28 11-4 22 1 25 10 2 6 0 12-5 16-6 6-17 8-34 2Z" fill="${c.aorta}"/><path d="M38 33c1-8 7-14 15-15" stroke="${c.shine}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".75"/>
<path d="M50 33c0-8 7-13 15-12 7 1 11 7 10 14l9-2c3-1 4 3 1 4l-10 3 9 1c3 0 3 4 0 4l-10-1c-1 5-4 9-9 10-8 2-14-2-15-8-1-4 2-7 0-13Z" fill="${c.pulmonary}"/><path d="M63 25c4 0 7 3 7 7" stroke="${c.shine}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
<path d="M35 45c1 4-1 7-4 10-5 5-8 10-8 18M31 55c3 1 5 0 7-2M27 64c3 0 6 2 7 5M23 72c3 2 5 6 4 10" stroke="${c.vessel}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
<path d="M60 52c4-1 7 1 9-2 2-2 4-3 6-1M61 52c0 6 4 10 3 16-1 5-5 8-6 13M62 61c-3 1-5 4-5 7M64 68c3 1 5 4 6 7M60 79c3 1 6 0 8 3" stroke="${c.vessel}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
}
/** This counter's last 7 days, from the counts the user saved (no estimates). */
function counterWeek(c: CounterDef): string {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d.getTime()); return { k, label: d.toLocaleDateString(state.locale, { weekday: 'narrow' }), n: k === dayKey() ? count(c.id) : countOn(state, c.id, k) }; });
    const top = Math.max(c.total, ...days.map(d => d.n));
    return `<section class="section"><h2 class="section-title mb16">${t('stepsWeek')}</h2><div class="step-bars short">${days.map(d => `<div class="step-bar ${d.k === dayKey() ? 'current' : ''} ${!c.perPrayer && d.n >= c.total ? 'met' : ''}"><span class="tiny muted">${d.n ? num(d.n) : '—'}</span><i style="height:${d.n / top * 72}%"></i><span class="tiny">${escapeHtml(d.label)}</span></div>`).join('')}</div></section>`;
}
function counterForm(): string {
    return `<section class="section counter-form"><h2 class="section-title mb16">${t('addCounter')}</h2>
<label class="field"><span>${t('myText')}</span><textarea id="my-text" dir="auto" maxlength="300" rows="3" placeholder="${t('myTextPlaceholder')}"></textarea></label>
<label class="field"><span>${t('myTitle')}</span><input id="my-title" dir="auto" maxlength="60"></label>
<label class="field"><span>${t('myTarget')}</span><input id="my-target" type="number" inputmode="numeric" min="1" max="10000" value="100"></label>
<div class="chip-wrap">${[33, 100, 300, 1000].map(n => `<button class="range-chip" data-action="my-target-preset" data-n="${n}">${num(n)}</button>`).join('')}</div>
<div class="notice mt20">${ic('info', 18)}<p>${t('addedByYouNote')}</p></div>
<div class="row gap8 mt20">${actionButton('counter-save', `${ic('check', 16)} ${t('saveCounter')}`, 'button primary')}${actionButton('counter-cancel', t('cancel'))}</div></section>`;
}
function counterView(): string {
    const all = counterDefs(), c = counterDef(counterId);
    const near = [...new Set([c.id, ...state.worship.favorites, ...state.worship.recent])].filter(id => all.some(x => x.id === id)).slice(0, 8);
    const chips = `<div class="chip-wrap">${near.map(id => { const x = counterDef(id); return `<button class="range-chip ${x.id === counterId && !addingCounter ? 'selected' : ''}" data-action="counter" data-counter="${x.id}" aria-pressed="${x.id === counterId && !addingCounter}" dir="auto">${escapeHtml(x.name.length > 28 ? x.name.slice(0, 27) + '…' : x.name)}</button>`; }).join('')}<button class="range-chip" data-action="nav" data-view="adhkar">${t('allAdhkar')}</button>${state.myCounters.length < MAX_CUSTOM_COUNTERS ? `<button class="range-chip add-chip ${addingCounter ? 'selected' : ''}" data-action="counter-add">+ ${t('addCounter')}</button>` : ''}</div>`;
    if (addingCounter) return `<p class="eyebrow mt12">${t('counters')}</p><h1 class="page-title">${t('addCounter')}</h1>${chips}${counterForm()}`;
    const n = count(c.id), pos = counterPosition(c, n), step = c.steps[pos.step]!;
    const roundDone = n > 0 && pos.inRound === 0, long = step.text.length > 40, src = c.builtIn, lib = c.library, fav = state.worship.favorites.includes(c.id);
    const list = c.steps.length > 1 ? `<ol class="count-steps">${c.steps.map((x, i) => `<li class="${i < pos.step || roundDone ? 'done' : i === pos.step ? 'current' : ''}"><span class="arabic" lang="ar" dir="rtl">${escapeHtml(x.text)}</span><span class="pill">×${num(x.count)}</span></li>`).join('')}</ol>` : '';
    const wording = src ? src.steps.filter(x => x.source.ref !== src.source.ref).map(x => x.source).filter((x, i, a) => a.findIndex(y => y.ref === x.ref) === i) : [];
    const phrase = c.custom ? `<span class="tap-phrase custom ${long ? 'long' : ''}" dir="auto">${escapeHtml(step.text)}</span>` : `<span class="arabic tap-phrase ${long ? 'long' : ''}" lang="ar" dir="rtl">${escapeHtml(step.text)}</span>`;
    const countLine = c.custom ? `${t('yourTarget')}: ${num(c.total)}` : c.kind === 'sunnah' ? `${t('sunnahCount')}: ${c.atLeast ? t('moreThan') + ' ' : ''}${num(c.sourced)}${c.total !== c.sourced ? ` · ${t('yourTarget')}: ${num(c.total)}` : ''}` : `${t('personalGoal')}: ${num(c.total)}${c.total !== c.sourced ? ` (${t('suggested')} ${num(c.sourced)})` : ''}`;
    const about = lib
        ? `<div class="notice mt20">${ic('info', 18)}<p>${escapeHtml(lib.about[state.locale])}</p></div>${lib.wording === 'common' ? `<p class="tiny gold mt12">${t('commonWording')}</p><p class="tiny muted">${t('virtueHadith')}:</p><p class="arabic dhikr-text small-ar" lang="ar" dir="rtl">${escapeHtml(lib.virtue ?? '')}</p>` : ''}${lib.quranRef ? `<p class="tiny muted">${t('quranLabel')} <bdi>${lib.quranRef.replace('-', '–')}</bdi></p>` : ''}${sourceLine(lib.source, lib.also)}`
        : src ? `<div class="notice mt20">${ic('info', 18)}<p>${c.perPrayer ? t('perPrayerNote') : `${t('dailyTargetNote')} ${c.atLeast ? t('moreThan') + ' ' : ''}${num(c.sourced)}`}</p></div>${sourceLine(src.source, src.also)}${wording.length ? `<p class="tiny muted">${t('wordingFrom')}</p>${wording.map(x => sourceLine(x)).join('')}` : ''}`
        : `<div class="notice mt20">${ic('info', 18)}<p>${t('addedByYouNote')} ${t('yourTarget')}: ${num(c.total)}.</p></div>${actionButton('counter-remove', `${ic('trash', 15)} ${t('removeCounter')}`, 'text-button danger-text')}`;
    const targets = !c.custom && c.steps.length === 1 && !c.perPrayer ? `<section class="settings-section"><h2>${t('yourTarget')}</h2><div class="chip-wrap">${[...new Set([c.sourced, 33, 100, 300, 1000])].map(v => `<button class="range-chip ${c.total === v ? 'selected' : ''}" data-action="target-preset" data-n="${v}" aria-pressed="${c.total === v}">${num(v)}${v === c.sourced ? ` · ${t(c.kind === 'sunnah' ? 'sunnahShort' : 'suggested')}` : ''}</button>`).join('')}</div><label class="field target-field mt12"><span>${t('anyNumber')}</span><input id="target-input" type="number" inputmode="numeric" min="1" max="10000" value="${c.total}"></label></section>` : '';
    return `<p class="eyebrow mt12">${t('counters')}${c.custom ? ` · ${t('addedByYou')}` : ''}</p><div class="row between"><h1 class="page-title" dir="auto">${escapeHtml(c.custom?.title || (c.custom ? t('myCounter') : c.name))}</h1><button class="icon-button fav" data-action="fav-toggle" data-counter="${c.id}" aria-pressed="${fav}" aria-label="${t(fav ? 'unfavorite' : 'favorite')}">${ic(fav ? 'starFill' : 'star', 20)}</button></div>${chips}
<section class="tap-zone ${celebrate === c.id ? 'celebrate' : ''}"><div class="count-meta"><span class="pill ${roundDone ? 'success' : 'gold'}">${roundDone ? `${ic('check', 12)} ${t('roundDone')}` : c.steps.length > 1 ? `${num(pos.step + 1)} / ${num(c.steps.length)}` : `${t('round')} ${num(pos.rounds + 1)}`}</span><span class="tiny muted" aria-live="polite">${t('todayCount')} <strong class="gold">${num(n)}</strong>${pos.rounds ? ` · ${num(pos.rounds)} ${t('rounds')}` : ''}</span></div>
<button class="tap-counter" data-action="count-tap" aria-label="${t('tapToCount')}: ${num(pos.inStep)} / ${num(step.count)}">${beads(pos.inStep, step.count)}${c.id.startsWith('istighfar') || c.custom ? heart(c.id, roundDone ? 1 : pos.inRound / c.total) : ''}<span class="tap-inner">${phrase}<span class="tap-number">${num(pos.inStep)}</span><small class="tap-of">${t('of')} ${num(step.count)}</small></span></button>
<p class="tiny muted">${t('tapAnywhere')} · ${countLine}</p>
<div class="row gap8">${actionButton('count-undo', ic('back', 18), 'icon-button', `aria-label="${t('undo')}" ${n ? '' : 'disabled'}`)}${actionButton('count-reset', ic('loop', 18), 'icon-button', `aria-label="${t('resetCount')}" ${n ? '' : 'disabled'}`)}${actionButton('dhikr-copy', ic('copy', 18), 'icon-button', `aria-label="${t('copy')}"`)}${actionButton('dhikr-share', ic('share', 18), 'icon-button', `aria-label="${t('share')}"`)}</div></section>
<div class="progress-cards"><div class="metric"><p class="value">${num(n)}</p><p class="label">${t('today')}</p></div><div class="metric"><p class="value">${num(lifetimeCount(state, c.id) - countOn(state, c.id) + n)}</p><p class="label">${t('lifetime')}</p></div></div>
${counterWeek(c)}
${c.id === 'istighfar' && isNative() ? `<label class="setting-row"><span><strong>${t('istighfarRemind')}</strong><p>${t('istighfarRemindSub')}</p></span><input type="checkbox" id="istighfar-remind" ${state.istighfarReminder ? 'checked' : ''} aria-label="${t('istighfarRemind')}"></label>` : ''}
${list}${about}${targets}${feedbackSettings()}<p class="gentle">${t('ownCount')}</p>`;
}
function feedbackSettings(): string {
    const p = state.worship.prefs;
    return `<section class="settings-section"><h2>${t('tapFeedback')}</h2><label class="setting-row"><span><strong>${t('haptics')}</strong></span><input type="checkbox" id="pref-haptics" ${p.haptics ? 'checked' : ''} aria-label="${t('haptics')}"></label><label class="setting-row"><span><strong>${t('tapSound')}</strong></span><input type="checkbox" id="pref-sounds" ${p.sounds ? 'checked' : ''} aria-label="${t('tapSound')}"></label></section>`;
}
/** Steps per day for the last 7 local days, oldest first (null where the device has no figure). */
function stepDays(): { day: string; label: string; steps: number | null }[] {
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d.getTime()); return { day: k, label: d.toLocaleDateString(state.locale, { weekday: 'narrow' }), steps: stepReading?.days.find(x => x.day === k)?.steps ?? null }; });
}
async function refreshSteps(force = false): Promise<void> {
    const bridge = smartBridge();
    if (!bridge || !state.health.steps || (!force && Date.now() - stepsAt < 20000)) return;
    stepsAt = Date.now();
    try { stepReading = await bridge.steps(7); stepError = null; } catch (e) { stepReading = null; stepError = e instanceof Error ? e.message : String(e); console.error('AyahFlow steps failed', stepError); }
    void pushWidget();
    if (view === 'today' || view === 'steps') { const y = window.scrollY; render(); window.scrollTo(0, y); }
}
/** Today's ayah (the same one the widgets show), with a link to read it in its surah. */
function ayahCard(): string {
    const a = ayahOfDay(dayKey()), c = chapter(a.surah);
    return `<section class="ayah-day"><div class="row between"><span class="eyebrow">${t('ayahOfDay')}</span><span class="tiny muted">${escapeHtml(state.locale === 'ar' ? c.ar : c.name)} <bdi>${ayahRef(a)}</bdi></span></div><p class="arabic ayah-day-text" lang="ar" dir="rtl">${Array.from({ length: a.to - a.ayah + 1 }, (_, k) => `${escapeHtml(verse(a.surah, a.ayah + k))} ${marker(a.ayah + k)}`).join(' ')}</p>${actionButton('read-ayah', `${ic('book', 15)} ${t('readInContext')}`, 'text-button', `data-surah="${a.surah}" data-ayah="${a.ayah}"`)}</section>`;
}
function dailyPulse(): string {
    const c = counter('istighfar'), n = count(c.id);
    const istighfar = `<button class="pulse-card" data-action="counter" data-counter="${c.id}">${ring(n / c.total * 100, ic('tasbih', 20))}<span class="grow"><span class="eyebrow">${escapeHtml(c.title[state.locale])}</span><strong>${num(n)} <span class="tiny muted">/ ${target(c)}</span></strong></span></button>`;
    if (!isNative()) return `<div class="pulse-grid single">${istighfar}</div>`;
    const today = stepReading?.days.find(x => x.day === dayKey())?.steps ?? null;
    const steps = !state.health.steps
        ? `<button class="pulse-card" data-action="steps-enable">${ring(0, ic('steps', 20))}<span class="grow"><span class="eyebrow">${t('steps')}</span><strong class="small">${t('stepsEnable')}</strong></span></button>`
        : `<button class="pulse-card" data-action="nav" data-view="steps">${ring((today ?? 0) / state.health.stepGoal * 100, ic('steps', 20), (today ?? 0) >= state.health.stepGoal ? 'met' : '')}<span class="grow"><span class="eyebrow">${t('steps')}</span><strong>${today === null ? '—' : num(today)} <span class="tiny muted">/ ${num(state.health.stepGoal)}</span></strong></span></button>`;
    return `<div class="pulse-grid">${istighfar}${steps}</div>`;
}
function stepsView(): string {
    const r = stepReading, days = stepDays(), today = days.at(-1)!.steps, goal = state.health.stepGoal;
    const top = Math.max(goal, ...days.map(d => d.steps ?? 0)) * 1.1;
    const notice = !isNative() ? miniNotice('stepsWeb') : !state.health.steps ? '' : stepError ? `<div class="notice warning">${ic('info', 18)}<p>${t('stepsFailed')} <span class="tiny">(${escapeHtml(stepError)})</span></p></div>` : !r ? miniNotice('stepsReading') : r?.permission === 'denied' ? `<div class="notice warning">${ic('info', 18)}<p>${t('stepsDenied')}</p></div>${actionButton('open-settings', t('openSettings'), 'button secondary full')}` : r && !r.available ? miniNotice('stepsUnavailable') : '';
    const bars = `<div class="step-bars" role="img" aria-label="${t('stepsWeek')}">${days.map(d => `<div class="step-bar ${d.day === dayKey() ? 'current' : ''} ${(d.steps ?? 0) >= goal ? 'met' : ''}"><span class="tiny muted">${d.steps === null ? '—' : d.steps >= 1000 ? `${formatNumber(Math.round(d.steps / 100) / 10, state.locale)}k` : num(d.steps)}</span><i style="height:${(d.steps ?? 0) / top * 72}%"></i><span class="tiny">${escapeHtml(d.label)}</span></div>`).join('')}<span class="goal-line" style="bottom:calc(${goal / top * 72}% + 21px)"></span></div>`;
    return `<p class="eyebrow mt12">${t('today')}</p><h1 class="page-title">${t('steps')}</h1><p class="page-sub">${t('stepsSub')}</p>${notice}
${state.health.steps ? `<section class="tap-zone">${ring((today ?? 0) / goal * 100, `<span class="tap-number">${today === null ? '—' : num(today)}<small>${t('of')} ${num(goal)}</small></span>`, `big ${(today ?? 0) >= goal ? 'met' : ''}`)}${(today ?? 0) >= goal ? `<span class="pill success">${ic('check', 12)} ${t('goalReached')}</span>` : ''}</section>
<section class="section"><h2 class="section-title mb16">${t('stepsWeek')}</h2>${bars}${r?.approximate ? `<p class="tiny muted mt12">${t('stepsApprox')}</p>` : ''}</section>
<section class="settings-section"><h2>${t('stepsGoal')}</h2><div class="segment">${[5000, 8000, 10000, 12000].map(g => `<button data-action="step-goal" data-goal="${g}" class="${goal === g ? 'active' : ''}" aria-pressed="${goal === g}">${num(g)}</button>`).join('')}</div></section>
${actionButton('steps-disable', t('stepsOff'), 'text-button')}` : isNative() ? primary('steps-enable', t('stepsEnable')) : ''}<p class="gentle">${t('stepsPrivacy')}</p>`;
}
// ---- Worship: home widgets, prayer tracker, guided tasbih, verses ---------------------------------
/** The ayah of the moment stays put while the user reads it (for 10 minutes after their last touch of the card). */
let ayahPin: { slot: number; until: number } | null = null;
/** An ayah next to the ayah of the moment, opened with the previous/next buttons (never crosses a surah boundary). */
let ayahBrowse: { surah: number; ayah: number } | null = null;
let prayerTab: 'today' | 'history' | 'times' | 'qibla' = 'today';
let historyMonth = 0;
let historyDay: string | null = null;
let tasbihPrayer: PrayerName = 'fajr';
let tasbihDay = dayKey();
let tasbihPaused = false;
/** The prayer just confirmed, so the tracker can offer its tasbih. */
let justPrayed: { prayer: PrayerName; day: string } | null = null;
let recitationId: string | null = null;
let adhkarFilter = 'all';
/** A tap that just finished a round or a sequence (for a short completion glow). */
let celebrate: string | null = null;
const pendingTasbih: Record<string, { day: string; prayer: PrayerName; id: string; n: number }> = {};
let tasbihTimer: ReturnType<typeof setTimeout> | null = null;
const shownSlot = (now = Date.now()) => ayahPin && now < ayahPin.until ? ayahPin.slot : slotOf(now);
const pinAyah = () => { ayahPin = { slot: shownSlot(), until: Date.now() + 10 * 60000 }; };
/** Feedback for a tap, as the user chose (haptics on by default, sound off). */
let tickAudio: AudioContext | null = null;
function feedback(strong = false): void {
    const p = state.worship.prefs;
    if (p.haptics && !state.reducedMotion) { haptic(); if (strong) setTimeout(haptic, 120); }
    if (p.sounds) {
        try {
            tickAudio ??= new AudioContext();
            const o = tickAudio.createOscillator(), g = tickAudio.createGain(), at = tickAudio.currentTime;
            o.frequency.value = strong ? 880 : 620; g.gain.setValueAtTime(0.08, at); g.gain.exponentialRampToValueAtTime(0.0001, at + (strong ? .35 : .08));
            o.connect(g).connect(tickAudio.destination); o.start(at); o.stop(at + (strong ? .36 : .09));
        } catch { /* no audio output: silent */ }
    }
}
const statusIcon = (s: SalahStatus | null) => s === 'done' ? ic('check', 15) : s === 'madeUp' ? ic('loop', 14) : s === 'missed' ? ic('minus', 15) : '';
const statusLabel = (s: SalahStatus | null) => t(s === 'done' ? 'st_done' : s === 'madeUp' ? 'st_madeUp' : s === 'missed' ? 'st_missed' : 'st_open');
/** Times of a day at the saved place (null without one: the tracker still works, without times). */
const dayTimes = (day: string) => { const [y, m, d] = day.split('-').map(Number); return timesFor(state, new Date(y!, m! - 1, d!, 12)); };
/** A prayer can be confirmed once its time has come (any time on past days, or always without a saved place). */
function canConfirm(day: string, prayer: PrayerName, now = Date.now()): boolean {
    if (day < dayKey(now)) return true;
    if (day > dayKey(now)) return false;
    const times = dayTimes(day);
    return !times || times[prayer] <= now;
}
/** Widget 1: next prayer, live countdown, the day's five prayers with what the user confirmed. */
function nextPrayerWidget(): string {
    const now = Date.now(), day = prayerDayView(state, now);
    if (!day) return `<button class="prayer-day empty" data-action="nav" data-view="reminders"><span class="now-orb">${ic('mosque', 22)}</span><span class="grow small">${t('setupPrayer')}</span>${chevronEnd()}</button>`;
    const { times, next, tomorrow } = day, shown = day.day;
    const stops = PRAYERS.map(p => times[p]);
    const pos = (at: number) => { if (at <= stops[0]!) return 10; if (at >= stops[4]!) return 90; const i = stops.findIndex((x, k) => at >= x && at < stops[k + 1]!); return 10 + 20 * (i + (at - stops[i]!) / (stops[i + 1]! - stops[i]!)); };
    const status = state.athan.enabled ? `${ic('bell', 13)} ${escapeHtml(state.athan.sound === 'chime' ? t('soundChime') : reciterName(next.prayer === 'fajr' ? state.athan.fajrReciter : state.athan.reciter))}` : `${ic('bell', 13)} ${t('athanOffShort')}`;
    return `<section class="prayer-day widget" aria-labelledby="w-next"><div class="row between"><span class="eyebrow" id="w-next">${t('nextPrayer')}${tomorrow ? ` · ${t('tomorrow')}` : ''}</span><span class="athan-chip ${state.athan.enabled ? 'on' : ''}">${status}</span></div><div class="prayer-day-main"><span class="grow"><strong class="prayer-day-name">${t('p_' + next.prayer)}</strong><span class="small gold" data-countdown="${next.at}" aria-live="off">${countdown(next.at, now)}</span></span><span class="prayer-day-time">${clock(next.at)}</span></div><div class="day-line" aria-hidden="true"><span class="day-fill" style="width:${pos(now) - 10}%"></span>${PRAYERS.map(p => `<span class="day-mark ${times[p] <= now ? 'past' : ''} ${next.at === times[p] ? 'next' : ''}" style="inset-inline-start:${pos(times[p])}%"></span>`).join('')}<span class="day-now" style="inset-inline-start:${pos(now)}%"></span></div><div class="day-labels">${PRAYERS.map(p => { const s = salahStatus(state, shown, p); return `<span class="${next.at === times[p] ? 'next' : ''} ${times[p] <= now ? 'past' : ''} ${s ? 'st-' + s : ''}"><b>${t('p_' + p)}</b>${clock(times[p])}${s ? `<i class="st-dot" aria-label="${statusLabel(s)}">${statusIcon(s)}</i>` : ''}</span>`; }).join('')}</div><button class="text-button widget-link" data-action="nav" data-view="prayer">${ic('clock', 14)} ${t('allPrayers')} ${chevronEnd()}</button></section>`;
}
/** Widget 2: one-tap confirmation of today's prayers and the day's progress. */
function trackerWidget(day = salahDay(state), full = false): string {
    const s = daySummary(state, day), kept = s.done + s.madeUp, times = dayTimes(day), now = Date.now();
    const chips = PRAYERS.map(p => {
        const st = s.statuses[p], ok = canConfirm(day, p, now), label = `${t('p_' + p)}: ${statusLabel(st)}`;
        return `<button class="salah-chip ${st ? 'st-' + st : ''}" data-action="salah-tap" data-prayer="${p}" data-day="${day}" aria-label="${label}${!ok ? ` · ${t('notYetTime')}` : ''}" ${ok || st ? '' : 'disabled'}><span class="salah-mark" aria-hidden="true">${st ? statusIcon(st) : ''}</span><span class="salah-name">${t('p_' + p)}</span><span class="tiny muted">${st ? statusLabel(st) : times ? clock(times[p]) : t('tapToConfirm')}</span></button>`;
    }).join('');
    const after = justPrayed && justPrayed.day === day && day === salahDay(state) && salahStatus(state, day, justPrayed.prayer) === 'done' && !anyTasbihDone(state, day, justPrayed.prayer)
        ? `<button class="feature-wide row tasbih-offer" data-action="tasbih-start" data-prayer="${justPrayed.prayer}" data-day="${day}"><span class="gold">${ic('tasbih', 22)}</span><span class="grow"><h3>${t('tasbihAfter').replace('{prayer}', t('p_' + justPrayed.prayer))}</h3><p>${t('tasbihAfterSub')}</p></span>${chevronEnd()}</button>` : '';
    return `<section class="widget tracker" aria-labelledby="w-track-${day}"><div class="row between"><span class="eyebrow" id="w-track-${day}">${day === dayKey() ? t('todaysPrayers') : escapeHtml(new Date(`${day}T12:00:00`).toLocaleDateString(state.locale, { weekday: 'long', day: 'numeric', month: 'long' }))}</span><span class="tiny ${kept === 5 ? 'success-text' : 'muted'}" aria-live="polite">${t('ofFive').replace('{n}', num(kept)).replace('{total}', num(5))}</span></div><div class="meter" aria-hidden="true"><span style="width:${kept / 5 * 100}%"></span></div><div class="salah-row">${chips}</div>${after}${full ? `<p class="tiny muted mt12">${t('trackerNote')}</p>` : ''}</section>`;
}
/** The dhikr shown on Home: the first favourite, else the last one used, else glorification. */
function quickDhikrId(): string {
    const ids = new Set(counterDefs().map(c => c.id));
    return [...state.worship.favorites, ...state.worship.recent, 'subhanallah-wabihamdihi'].find(id => ids.has(id) && !counterDef(id).perPrayer) ?? counterDefs()[0]!.id;
}
/** Widget 3: one dhikr with a large tap target, its count and target, and the way to the others. */
function quickDhikrWidget(): string {
    const c = counterDef(quickDhikrId()), n = count(c.id), pos = counterPosition(c, n), step = c.steps[pos.step]!, done = n >= c.total;
    const others = [...new Set([...state.worship.favorites, ...state.worship.recent])].filter(id => id !== c.id && counterDefs().some(x => x.id === id && !x.perPrayer)).slice(0, 3);
    const phrase = c.custom ? `<p class="quick-text" dir="auto">${escapeHtml(step.text)}</p>` : `<p class="arabic quick-text" lang="ar" dir="rtl">${escapeHtml(step.text)}</p>`;
    return `<section class="widget quick ${celebrate === c.id ? 'celebrate' : ''}" aria-labelledby="w-quick"><div class="row between"><span class="eyebrow" id="w-quick">${t('quickDhikr')}</span><button class="text-button" data-action="counter" data-counter="${c.id}">${escapeHtml(c.name.length > 26 ? c.name.slice(0, 25) + '…' : c.name)} ${chevronEnd()}</button></div><div class="quick-body">${phrase}<button class="quick-tap ${done ? 'met' : ''}" data-action="quick-tap" data-counter="${c.id}" style="--p:${Math.min(100, n / c.total * 100)}%" aria-label="${t('tapToCount')}: ${num(n)} ${t('of')} ${num(c.total)}"><span class="quick-num">${num(n)}</span><small>${t('of')} ${num(c.total)}</small></button></div><div class="row between wrap quick-foot">${c.custom ? `<span class="tiny gold">${t('addedByYou')}</span>` : `<span class="tiny muted">${c.kind === 'sunnah' ? t('sunnahCount') : t('personalGoal')}</span>`}<span class="chip-wrap">${others.map(id => `<button class="range-chip" data-action="counter" data-counter="${id}" dir="auto">${escapeHtml(counterDef(id).name.slice(0, 18))}</button>`).join('')}<button class="range-chip" data-action="nav" data-view="adhkar">${t('allAdhkar')}</button></span></div></section>`;
}
const verseText = (s: number, a: number) => `${verse(s, a)} ${'۝'}${mushafDigits.format(a)}`;
/** Widget 4: the Ayah of the Moment, with translation, audio, save, copy and share. */
function ayahWidget(): string {
    const now = Date.now(), slot = shownSlot(now), base = ayahOfMoment(slot), a = ayahBrowse ?? base, c = chapter(a.surah), saved = state.bookmarks.includes(`${a.surah}:${a.ayah}`);
    const ends = slotRange(slot)[1], left = Math.max(1, Math.round((ends - now) / 60000)), browsing = !!ayahBrowse && (ayahBrowse.surah !== base.surah || ayahBrowse.ayah !== base.ayah);
    const tr = state.worship.prefs.translation ? `<p class="ayah-translation" lang="en" dir="ltr">${escapeHtml(translation(a.surah, a.ayah))}<span class="tiny muted"> — ${escapeHtml(TRANSLATION_SOURCE.name)}</span></p>` : '';
    const btn = (action: string, icon: string, label: string, extra = '') => `<button class="icon-button" data-action="${action}" data-surah="${a.surah}" data-ayah="${a.ayah}" aria-label="${label}" ${extra}>${icon === 'prev' || icon === 'next' ? `<span class="arrow-icon">${ic(icon, 18)}</span>` : ic(icon, 18)}</button>`;
    return `<section class="widget ayah-moment" aria-labelledby="w-ayah"><div class="row between"><span class="eyebrow" id="w-ayah">${browsing ? t('readingNearby') : t('ayahMoment')}</span><span class="tiny muted">${browsing ? `<button class="text-button" data-action="moment-now">${t('backToMoment')}</button>` : ayahPin && now < ayahPin.until ? t('heldWhileReading') : t('nextIn').replace('{m}', num(left))}</span></div>
<p class="arabic ayah-moment-text" lang="ar" dir="rtl">${escapeHtml(verse(a.surah, a.ayah))} ${marker(a.ayah)}</p>${tr}
<div class="row between ayah-moment-foot"><button class="text-button ayah-ref" data-action="read-ayah" data-surah="${a.surah}" data-ayah="${a.ayah}"><span class="arabic" lang="ar">${c.ar}</span> <span class="tiny muted">${escapeHtml(c.name)} <bdi>${a.surah}:${a.ayah}</bdi></span></button><span class="row gap4">${btn('moment-prev', 'prev', t('previousAyah'), a.ayah > 1 ? '' : 'disabled')}${btn('moment-next', 'next', t('nextAyah'), a.ayah < c.count ? '' : 'disabled')}</span></div>
<div class="ayah-actions">${btn('play-verse', 'play', t('listen'))}${btn('toggle-translation', 'globe', t(state.worship.prefs.translation ? 'hideTranslation' : 'showTranslation'), `aria-pressed="${state.worship.prefs.translation}"`)}${btn('save-verse', saved ? 'starFill' : 'star', t(saved ? 'unsaveVerse' : 'saveVerse'), `aria-pressed="${saved}"`)}${btn('copy-verse', 'copy', t('copy'))}${btn('share-verse', 'share', t('share'))}</div></section>`;
}
/** Shown on Home and Adhkar while place or vehicle reminders are on but iPhone has taken away Always location: they
 * would otherwise stop without a word. */
function watchCard(): string {
    return isNative() && backgroundBlocked(state, smartStatus) ? `<div class="always-card" role="status"><h3>${ic('pin', 18)} ${t('watchOffTitle')}</h3><p class="small">${t('watchOffSteps')}</p>${actionButton('open-settings', `${ic('gear', 15)} ${t('openSettings')}`, 'button primary full')}</div>` : '';
}
/** Re-renders in place (same scroll position) after a small change on the current screen. */
function keepScroll(): void { const y = window.scrollY; render(); window.scrollTo(0, y); }
/** Fridays only: Surah Al-Kahf opens in the reader at its first verse. */
function fridayCard(): string {
    return new Date().getDay() === 5 ? `<button class="feature-wide row mb16" data-action="open-verse" data-surah="18" data-ayah="1"><span class="gold">${ic('book', 22)}</span><span class="grow"><span class="tiny muted">${t('jumuahToday')}</span><h3>${t('jumuahCard')}</h3></span>${ic('chevron', 16)}</button>` : '';
}
// ---- The 99 Names --------------------------------------------------------------------------------
const gradeList = (s: { grades: { by: string; grade: string }[] }) => `<bdi dir="ltr">${s.grades.map(g => `${escapeHtml(g.by)}: ${escapeHtml(g.grade)}`).join('; ')}</bdi>`;
const sourceLink = (s: { collection: string; number: string; inBook: { book: number; hadith: number } | null; ref: string }) => `<a dir="ltr" href="${sourceUrl({ ...s, grades: [] })}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.collection)} ${s.number}${ic('link', 11)}</a>`;
function namesEntry(): string {
    const today = nameOfDay();
    return `<button class="feature-wide row mb16" data-action="nav" data-view="names"><span class="gold">${ic('spark', 22)}</span><span class="grow"><span class="tiny muted">${t('nameOfDay')}</span><h3 class="arabic name-today" lang="ar" dir="rtl">${escapeHtml(today.ar)}</h3><span class="tiny muted">${t('namesTitle')}</span></span>${ic('chevron', 16)}</button>`;
}
function namesView(): string {
    const today = nameOfDay();
    const quran = NAMES_QURAN.map(([s, a, b]) => `<p class="arabic names-ayah" lang="ar" dir="rtl">${Array.from({ length: b - a + 1 }, (_, i) => `${escapeHtml(verse(s, a + i))} ${marker(a + i)}`).join(' ')}</p><p class="tiny muted mb16">${escapeHtml(state.locale === 'ar' ? chapter(s).ar : chapter(s).name)} <bdi dir="ltr">${s}:${a}${b > a ? `–${b}` : ''}</bdi></p>`).join('');
    const grid = NAMES.map(x => `<li class="name-cell ${x.n === today.n ? 'today' : ''}" ${x.n === today.n ? 'aria-current="date"' : ''}><span class="tiny muted">${num(x.n)}</span><span class="arabic" lang="ar" dir="rtl">${escapeHtml(x.ar)}</span></li>`).join('');
    return `<p class="eyebrow mt12">${t('adhkar')}</p><h1 class="page-title">${t('namesTitle')}</h1><section class="settings-section"><p class="arabic names-about" lang="ar" dir="rtl">${escapeHtml(NAMES_ABOUT.text)}</p><p class="tiny muted">${sourceLink(NAMES_ABOUT)} · ${gradeList(NAMES_ABOUT)}</p><div class="notice mt12">${ic('info', 18)}<p>${t('namesListNote').replace('{source}', sourceLink(NAMES_LIST)).replace('{grades}', gradeList(NAMES_LIST))}</p></div></section><ol class="names-grid" lang="ar">${grid}</ol><section class="settings-section"><h2>${t('namesQuran')}</h2>${quran}</section><p class="tiny muted">${t('namesNoMeanings')}</p>`;
}
// ---- Home shortcuts ----------------------------------------------------------------------------------
function qiblaTile(): string {
    const p = prayerPlace(state);
    if (!p) return '';
    return `<button class="feature-wide row mt12" data-action="open-qibla"><span class="gold">${ic('compass', 22)}</span><span class="grow"><h3>${t('ptab_qibla')}</h3><span class="tiny muted">${t('qiblaTileSub').replace('{deg}', num(Math.round(qiblaBearing(p.lat, p.lng))))}</span></span>${chevronEnd()}</button>`;
}
/** "I recited it" from a reminder: the user's own confirmation of the dhikr the notification showed (the first entry of
 * the first moment that has one), recorded once per dhikr, moment and day like the in-app button. */
async function recitedFromNotification(ms: Moment[]): Promise<void> {
    const m = ms.find(x => entriesFor(x).length), e = m && entriesFor(m)[0];
    if (!m || !e) return;
    await commit(completeDhikr(state, e.id, m, Date.now(), `${m}:${e.id}:${dayKey()}`));
    toast(t('recitedFromNotification'));
    void syncSmart();
}
// ---- Memorisation (hifz) --------------------------------------------------------------------------
/** The chosen range and settings; kept for the session only (nothing about practice is saved). */
let hifz: { surah: number; from: number; to: number; repeat: number; level: number } | null = null;
const hifzNow = () => hifz ??= { ...hifzRange(state.readPosition.surah, state.readPosition.ayah, state.readPosition.ayah + 2), repeat: 3, level: 0 };
function hifzEntry(): string {
    return `<button class="feature-wide row mb16" data-action="nav" data-view="hifz"><span class="gold">${ic('loop', 22)}</span><span class="grow"><span class="tiny muted">${t('hifzShort')}</span><h3>${t('hifzTitle')}</h3></span>${ic('chevron', 16)}</button>`;
}
function hifzView(): string {
    const h = hifzNow(), c = chapter(h.surah), name = (s: typeof c) => escapeHtml(state.locale === 'ar' ? s.ar : s.name);
    const seg = (action: string, values: readonly number[], current: number, label: (n: number) => string) => `<div class="segment wrap" role="group">${values.map(v => `<button data-action="${action}" data-v="${v}" class="${current === v ? 'active' : ''}" aria-pressed="${current === v}">${label(v)}</button>`).join('')}</div>`;
    const pick = `<label class="select-row">${ic('book', 16)}<span class="grow small">${t('surah')}</span><select id="hifz-surah" aria-label="${t('surah')}">${SURAH_DATA.map(s => `<option value="${s.id}" ${s.id === h.surah ? 'selected' : ''}>${s.id}. ${name(s)}</option>`).join('')}</select></label><div class="row mt12 hifz-range"><label class="grow small">${t('hifzFrom')}<input id="hifz-from" type="number" inputmode="numeric" min="1" max="${c.count}" value="${h.from}"></label><label class="grow small">${t('hifzTo')}<input id="hifz-to" type="number" inputmode="numeric" min="1" max="${c.count}" value="${h.to}"></label></div><p class="tiny muted mt8">${t('hifzMax').replace('{n}', num(HIFZ_MAX_AYAHS))}</p>`;
    const listen = state.audioConsent ? `${seg('hifz-repeat', HIFZ_REPEATS, h.repeat, n => `×${num(n)}`)}<div class="row gap8">${actionButton('hifz-play', `${ic('play', 16)} ${t('hifzPlay')}`, 'button primary grow')}${actionButton('stop-audio', `${ic('close', 16)} ${t('stopAthan')}`, 'button secondary')}</div><p class="tiny muted mt8">${t('hifzPlayNote')}</p>` : `<div class="notice">${ic('info', 18)}<p>${t('hifzNeedAudio')}</p></div>${actionButton('nav', `${ic('gear', 15)} ${t('settings')}`, 'button subtle mt12', 'data-view="settings"')}`;
    const ayahs = Array.from({ length: h.to - h.from + 1 }, (_, i) => h.from + i).map(a => `<p class="arabic hifz-ayah" lang="ar" dir="rtl">${ayahWords(verse(h.surah, a)).map((w, i) => hiddenWord(i, h.level) ? `<button class="hz-word hidden" data-action="hifz-reveal" aria-pressed="false" aria-label="${t('hifzReveal')}"><span>${escapeHtml(w)}</span></button>` : `<span class="hz-word">${escapeHtml(w)}</span>`).join(' ')} ${marker(a)}</p>`).join('');
    const levels = ['hifzShowAll', 'hifzHideSome', 'hifzHideHalf', 'hifzHideAll'];
    return `<p class="eyebrow mt12">${t('quran')}</p><h1 class="page-title">${t('hifzTitle')}</h1><p class="page-sub">${t('hifzSub')}</p><section class="settings-section"><h2>${t('hifzWhat')}</h2>${pick}</section><section class="settings-section"><h2>${t('hifzListen')}</h2>${listen}</section><section class="settings-section"><h2>${t('hifzTest')}</h2>${seg('hifz-level', HIFZ_LEVELS, h.level, n => t(levels[n]!))}<p class="small muted mb8">${name(c)} <bdi dir="ltr">${h.surah}:${h.from}${h.to > h.from ? `–${h.to}` : ''}</bdi></p>${ayahs}<p class="tiny muted mt12">${t('hifzHonest')}</p></section>`;
}
function setHifzRange(): void {
    const h = hifzNow(), surah = Number(document.querySelector<HTMLSelectElement>('#hifz-surah')?.value ?? h.surah), same = surah === h.surah;
    const from = same ? Number(document.querySelector<HTMLInputElement>('#hifz-from')?.value) : 1, to = same ? Number(document.querySelector<HTMLInputElement>('#hifz-to')?.value) : 3;
    hifz = { ...h, ...hifzRange(surah, from, to) };
    keepScroll();
}
// ---- Ramadan ----------------------------------------------------------------------------------------
const narration = (id: 'qadr-nights' | 'qadr-dua') => { const x = RAMADAN_TEXT.find(r => r.id === id)!; return `<p class="arabic ramadan-text" lang="ar" dir="rtl">${escapeHtml(x.text)}</p><p class="tiny muted"><a dir="ltr" href="${sourceUrl(x.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.source.collection)} ${x.source.number}${ic('link', 11)}</a>${x.source.grades.length ? ` · <bdi dir="ltr">${x.source.grades.map(g => `${escapeHtml(g.by)}: ${escapeHtml(g.grade)}`).join('; ')}</bdi>` : ''}</p>`; };
function ramadanCard(): string {
    const now = Date.now(), r = ramadanToday(state, now);
    if (!r) { const soon = daysToRamadan(now); return soon === null ? '' : `<div class="notice mb16">${ic('moon', 18)}<p>${t('ramadanSoon').replace('{n}', num(soon))}</p></div>`; }
    const row = (label: string, at: number | null) => at === null ? '' : `<div class="diag-row"><span>${label}</span><span class="${at > now ? 'ok' : 'muted'}">${clock(at)}${at > now ? ` <span class="tiny" data-countdown="${at}">${countdown(at, now)}</span>` : ''}</span></div>`;
    const times = r.suhoorEnds === null ? `<p class="small muted">${t('ramadanNoPlace')}</p>` : `<div class="diag">${row(t('suhoorEnds'), r.suhoorEnds)}${row(t('iftarAt'), r.iftar)}</div>`;
    const nights = r.oddNight ? `<div class="notice mt12">${ic('star', 18)}<p>${t('ramadanOddNight').replace('{n}', num(r.oddNight))}</p></div>${narration('qadr-nights')}<h3 class="small gold mt12 mb8">${t('ramadanQadrDua')}</h3>${narration('qadr-dua')}` : r.lastTen ? `<p class="small muted mt12">${t('ramadanLastTen')}</p>${narration('qadr-nights')}` : '';
    const plan = state.khatm ? '' : actionButton('khatm-ramadan', `${ic('book', 16)} ${t('ramadanKhatm')}`, 'button secondary full mt12');
    const remind = state.calendar.suhoor || state.calendar.iftar ? '' : actionButton('ramadan-reminders', t('ramadanRemind'), 'text-button mt8');
    return `<section class="today-card ramadan-card mb16"><p class="tiny gold">${t('ramadanDay').replace('{d}', num(r.day))}</p>${times}${nights}${plan}${remind}<p class="tiny muted mt8">${t('fastingHijriNote')}</p></section>`;
}
// ---- Quran completion plan (khatm) ---------------------------------------------------------------
/** Choices on the setup screen before a plan starts (not saved until Start). */
let khatmDays: number = 30, khatmFromHere = false;
const pageSurah = (p: number) => { const c = chapter(pageAyahs(p)[0]![0]); return `<bdi>${escapeHtml(state.locale === 'ar' ? c.ar : c.name)}</bdi>`; };
const khatmStatus = (k: ReturnType<typeof khatmToday>) => k.finished ? t('khatmFinished') : k.behind ? t('khatmBehind').replace('{n}', num(k.behind)) : k.ahead ? t('khatmAhead').replace('{n}', num(k.ahead)) : k.reached >= k.to ? t('khatmTodayDone') : t('khatmOnTrack');
function khatmCard(): string {
    if (!state.khatm) return '';
    const k = khatmToday(state.khatm);
    if (k.finished) return '';
    return `<button class="feature-wide row mb16" data-action="nav" data-view="khatm"><span class="gold">${ic('book', 22)}</span><span class="grow"><span class="tiny muted">${t('khatmTitle')} · ${t('khatmDayOf').replace('{d}', num(k.day)).replace('{n}', num(state.khatm.days))}</span><h3>${t('khatmTodayPages').replace('{a}', num(k.from)).replace('{b}', num(k.to))}</h3><span class="tiny muted">${khatmStatus(k)}</span></span>${ic('chevron', 16)}</button>`;
}
function khatmEntry(): string {
    if (!state.khatm) return `<button class="feature-wide row mb16" data-action="nav" data-view="khatm"><span class="gold">${ic('book', 22)}</span><span class="grow"><span class="tiny muted">${t('khatmTitle')}</span><h3>${t('khatmPlanIt')}</h3></span>${ic('chevron', 16)}</button>`;
    const k = khatmToday(state.khatm);
    return `<button class="feature-wide row mb16" data-action="nav" data-view="khatm"><span class="gold">${ic('book', 22)}</span><span class="grow"><span class="tiny muted">${t('khatmTitle')} · ${t('khatmDayOf').replace('{d}', num(k.day)).replace('{n}', num(state.khatm.days))}</span><h3>${k.finished ? t('khatmFinished') : t('khatmTodayPages').replace('{a}', num(k.from)).replace('{b}', num(k.to))}</h3><span class="tiny muted">${t('khatmReachedOf').replace('{a}', num(k.done)).replace('{n}', num(k.total))}</span></span>${ic('chevron', 16)}</button>`;
}
function khatmView(): string {
    const head = `<p class="eyebrow mt12">${t('quran')}</p><h1 class="page-title">${t('khatmTitle')}</h1>`, here = pageOf(state.readPosition.surah, state.readPosition.ayah);
    if (!state.khatm) {
        const from = khatmFromHere ? here : 1, pages = PAGE_COUNT - from + 1, perDay = Math.ceil(pages / khatmDays);
        return `${head}<p class="page-sub">${t('khatmSub')}</p><section class="settings-section"><h2>${t('khatmFinishIn')}</h2><div class="segment wrap" role="group">${KHATM_DAYS.map(d => `<button data-action="khatm-days" data-v="${d}" class="${khatmDays === d ? 'active' : ''}" aria-pressed="${khatmDays === d}">${t(d <= 10 ? 'khatmNDaysFew' : 'khatmNDays').replace('{n}', num(d))}</button>`).join('')}</div><h2 class="mt20">${t('khatmStartAt')}</h2><div class="segment" role="group"><button data-action="khatm-from" data-v="start" class="${khatmFromHere ? '' : 'active'}" aria-pressed="${!khatmFromHere}">${t('khatmFromStart')}</button><button data-action="khatm-from" data-v="here" class="${khatmFromHere ? 'active' : ''}" aria-pressed="${khatmFromHere}" ${here === 1 ? 'disabled' : ''}>${t('khatmFromHere').replace('{p}', num(here))}</button></div><p class="small muted">${t('khatmPreview').replace('{n}', num(pages)).replace('{d}', num(khatmDays)).replace('{p}', num(perDay))}</p>${primary('khatm-start', t('khatmStart'))}<p class="tiny muted mt12">${t('khatmHonest')}</p></section>`;
    }
    const plan = state.khatm, k = khatmToday(plan), endDate = escapeHtml(new Date(`${k.endDay}T12:00:00`).toLocaleDateString(state.locale, { weekday: 'short', day: 'numeric', month: 'long' }));
    const meter = `<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${k.total}" aria-valuenow="${k.done}" aria-label="${t('khatmTitle')}"><span style="width:${Math.round(k.done / k.total * 100)}%"></span></div>`;
    const today = k.finished ? `<div class="notice">${ic('check', 18)}<p>${t('khatmFinishedNote').replace('{a}', num(plan.from)).replace('{b}', num(PAGE_COUNT))}</p></div>${primary('khatm-new', t('khatmNew'))}`
        : `<div class="diag"><div class="diag-row"><span>${t('khatmToday')}</span><span class="ok">${t('khatmTodayPages').replace('{a}', num(k.from)).replace('{b}', num(k.to))}</span></div><div class="diag-row"><span>${t('khatmFromTo')}</span><span>${pageSurah(k.from)} – ${pageSurah(k.to)}</span></div><div class="diag-row"><span>${t('khatmReached')}</span><span>${k.reached >= plan.from ? t('khatmPageN').replace('{p}', num(k.reached)) : t('khatmNotYet')}</span></div></div><p class="small ${k.behind ? 'gold' : 'muted'} mt12">${khatmStatus(k)}</p>${primary('khatm-open', t('khatmContinue').replace('{p}', num(k.nextPage)))}`;
    return `${head}<p class="page-sub">${t('khatmDayOf').replace('{d}', num(k.day)).replace('{n}', num(plan.days))} · ${t('khatmEnds').replace('{date}', endDate)}</p>${meter}<p class="tiny muted">${t('khatmReachedOf').replace('{a}', num(k.done)).replace('{n}', num(k.total))}</p><section class="settings-section">${today}</section><section class="settings-section"><h2>${t('khatmCorrect')}</h2><p class="tiny muted mb8">${t('khatmCorrectNote')}</p><div class="row"><input id="khatm-page" type="number" inputmode="numeric" min="${plan.from - 1}" max="${PAGE_COUNT}" value="${k.reached}" aria-label="${t('khatmCorrect')}">${actionButton('khatm-set', t('saveNote'), 'button secondary grow')}</div><p class="tiny muted mt12">${t('khatmHonest')}</p><div class="mt20">${actionButton('khatm-end', t('khatmEnd'), 'button subtle full')}</div></section>`;
}
// ---- Highlight review ---------------------------------------------------------------------------
/** Verses whose text the user chose to show today (recall first, then look); not saved. */
const reviewShown = new Set<string>();
function reviewEntry(): string {
    if (!state.highlights.length) return '';
    const q = highlightReviewQueue(state, dayKey()), done = q.filter(x => x.today).length;
    return `<button class="feature-wide row mb16" data-action="nav" data-view="review"><span class="gold">${ic('layers', 22)}</span><span class="grow"><span class="tiny muted">${t('reviewSelfShort')}</span><h3>${t('reviewTitle')}</h3><span class="tiny muted">${t('reviewProgress').replace('{a}', num(done)).replace('{n}', num(q.length))}</span></span>${ic('chevron', 16)}</button>`;
}
function reviewView(): string {
    const head = `<p class="eyebrow mt12">${t('quran')}</p><h1 class="page-title">${t('reviewTitle')}</h1><p class="page-sub">${t('reviewSub')}</p>`;
    const q = highlightReviewQueue(state, dayKey());
    if (!q.length) return `${head}<p class="empty">${t('reviewEmpty')}</p>`;
    const cards = q.map(({ key, surah, ayah, today }) => {
        const c = chapter(surah), color = state.highlights.find(h => h.key === key)?.color ?? 'gold', note = state.notes.find(n => n.key === key)?.text, open = today !== null || reviewShown.has(key);
        const answer = (r: 'remembered' | 'revisit') => `<button class="button ${today === r ? 'primary' : 'secondary'}" data-action="review-answer" data-key="${key}" data-result="${r}" aria-pressed="${today === r}">${t(r === 'remembered' ? 'reviewRemembered' : 'reviewRevisit')}</button>`;
        return `<article class="review-card" data-hl="${color}"><div class="row between"><h3>${escapeHtml(c.name)} <bdi>${surah}:${ayah}</bdi></h3>${actionButton('open-verse', t('openInReader'), 'text-button', `data-surah="${surah}" data-ayah="${ayah}"`)}</div>${note ? `<p class="small review-note">${escapeHtml(note)}</p>` : ''}${open ? `<p class="arabic review-ayah" lang="ar" dir="rtl">${escapeHtml(verse(surah, ayah))}</p><div class="review-actions">${answer('remembered')}${answer('revisit')}</div>` : `<p class="tiny muted">${t('reviewTry')}</p>${actionButton('review-show', t('reviewShow'), 'button secondary full', `data-key="${key}"`)}`}</article>`;
    }).join('');
    return `${head}<div class="stack">${cards}</div><p class="gentle">${t('reviewHonest')}</p>`;
}
// ---- Qibla --------------------------------------------------------------------------------------
/** A one-off "where I am now" for the Qibla screen; never saved. */
let qiblaFrom: { lat: number; lng: number } | null = null;
let heading: { heading: number; trueNorth: boolean; accuracy: number } | null = null, compassOn = false, compassMissing = false;
function qiblaView(): string {
    const saved = prayerPlace(state), from = qiblaFrom ?? saved, native = !!smartBridge();
    if (!from) return `<div class="notice warning">${ic('pin', 18)}<p>${t('qiblaNoPlace')}</p></div><div class="stack mt20">${native ? actionButton('qibla-here', `${ic('pin', 15)} ${t('qiblaHere')}`, 'button primary full') : ''}${actionButton('nav', t('savePlaces'), 'button secondary full', 'data-view="reminders"')}</div>`;
    const b = qiblaBearing(from.lat, from.lng), km = Math.round(kaabaDistanceKm(from.lat, from.lng));
    const ticks = Array.from({ length: 72 }, (_, i) => `<line x1="150" y1="${i % 6 ? 16 : 12}" x2="150" y2="24" transform="rotate(${i * 5} 150 150)" class="${i % 6 ? 'qb-tick' : 'qb-tick major'}"/>`).join('');
    const label = qiblaFrom ? t('qiblaFromHere') : t(state.places.home ? 'place_home' : state.places.work ? 'place_work' : 'place_mosque');
    const dial = `<svg class="qibla-dial" viewBox="0 0 300 300" role="img" aria-label="${t('qiblaBearing').replace('{n}', num(Math.round(b)))}"><g id="qibla-dial" data-bearing="${b}"><circle cx="150" cy="150" r="138" class="qb-ring"/>${ticks}<text x="150" y="46" class="qb-n">N</text><g transform="rotate(${b} 150 150)"><line x1="150" y1="150" x2="150" y2="64" class="qb-needle"/><rect x="138" y="34" width="24" height="24" rx="3" class="qb-kaaba"/><rect x="138" y="41" width="24" height="4" class="qb-band"/></g></g><path d="M150 0 l10 18 h-20z" class="qb-phone"/><circle cx="150" cy="150" r="6" class="qb-hub"/></svg>`;
    return `<section class="qibla"><p class="page-sub">${t('qiblaSub')}</p>${dial}<p class="qibla-turn" id="qibla-turn" role="status" aria-live="polite"></p><div class="diag mt12"><div class="diag-row"><span>${t('qiblaDirection')}</span><span>${t('qiblaBearing').replace('{n}°', `<bdi>${num(Math.round(b))}°</bdi>`)}</span></div><div class="diag-row"><span>${t('qiblaFrom')}</span><span>${escapeHtml(label)}</span></div><div class="diag-row"><span>${t('qiblaDistance')}</span><span><bdi>${num(km)} km</bdi></span></div></div>${native ? `<div class="mt12">${qiblaFrom ? (saved ? actionButton('qibla-saved', t('qiblaUseSaved'), 'button secondary full') : '') : actionButton('qibla-here', `${ic('pin', 15)} ${t('qiblaHere')}`, 'button secondary full')}</div>` : ''}<p class="tiny muted mt12">${t('qiblaNote')}</p></section>`;
}
/** Turns the dial and updates the guidance without a full render (heading events arrive many times a second). */
function paintQibla(): void {
    const dial = document.querySelector<SVGGElement>('#qibla-dial'), out = document.querySelector('#qibla-turn');
    if (!dial || !out) return;
    const b = Number(dial.dataset.bearing);
    if (!heading) { dial.removeAttribute('transform'); out.textContent = t(compassMissing ? 'qiblaNoCompass' : smartBridge() ? 'qiblaWaiting' : 'qiblaNoLive'); dial.closest('.qibla')?.classList.remove('aligned'); return; }
    dial.setAttribute('transform', `rotate(${-heading.heading} 150 150)`);
    const turn = qiblaTurn(heading.heading, b), rough = heading.accuracy < 0 || heading.accuracy > 25, aligned = !rough && Math.abs(turn) <= QIBLA_ALIGNED;
    out.textContent = rough ? t('qiblaCalibrate') : aligned ? t('qiblaFacing') : t(turn > 0 ? 'qiblaRight' : 'qiblaLeft').replace('{n}', num(Math.round(Math.abs(turn))));
    document.querySelector('.qibla')?.classList.toggle('aligned', aligned);
}
/** The compass runs only while the Qibla tab is on screen and the app is in front. */
function syncCompass(): void {
    const want = view === 'prayer' && prayerTab === 'qibla' && !document.hidden, bridge = smartBridge();
    if (want) paintQibla();
    if (!bridge || want === compassOn) return;
    compassOn = want;
    if (!want) { heading = null; void bridge.stopHeading(); return; }
    void bridge.startHeading(h => { heading = h; paintQibla(); }).then(ok => { if (!ok) { compassMissing = true; compassOn = false; paintQibla(); } }).catch(() => { compassMissing = true; compassOn = false; paintQibla(); });
}
document.addEventListener('visibilitychange', syncCompass);
// ---- Fajr wake-up alarm ---------------------------------------------------------------------------
/** Last status from the device (AlarmKit availability, permission, alarms still to ring, wake check waiting). */
let alarmInfo: AlarmStatus | null = null;
const offsetLabel = (n: number) => n === 0 ? t('alarmAtFajr') : t(n < 0 ? 'alarmBefore' : 'alarmAfter').replace('{n}', num(Math.abs(n)));
function fajrAlarmSection(times: { fajr: number; sunrise: number }): string {
    if (!smartBridge()) return '';
    const f = state.fajrAlarm, next = fajrAlarmPlan(state)[0];
    const seg = (action: string, values: readonly number[], current: number, label: (n: number) => string) => `<div class="segment wrap" role="group">${values.map(v => `<button data-action="${action}" data-v="${v}" class="${current === v ? 'active' : ''}" aria-pressed="${current === v}">${label(v)}</button>`).join('')}</div>`;
    const denied = f.enabled && alarmInfo?.available && alarmInfo.authorization === 'denied' ? `<div class="notice warning mt12">${ic('info', 18)}<p>${t('alarmDenied')}</p></div>${actionButton('open-settings', `${ic('gear', 15)} ${t('openSettings')}`, 'button subtle mt12')}` : '';
    const fallback = f.enabled && alarmInfo && !alarmInfo.available ? `<div class="notice mt12">${ic('info', 18)}<p>${t('alarmFallback')}</p></div>` : '';
    const nextLine = f.enabled && next ? `<div class="diag mt12"><div class="diag-row"><span>${t('alarmNext')}</span><span class="ok">${escapeHtml(new Date(next.at).toLocaleDateString(state.locale, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${clock(next.at)}</span></div>${next.at < next.fajr + f.offset * 60000 ? `<p class="tiny muted mt8">${t('alarmClamped')}</p>` : ''}</div>` : '';
    const settings = f.enabled ? `<h3 class="small gold mt20 mb8">${t('alarmWhen')}</h3>${seg('alarm-offset', FAJR_OFFSETS, f.offset, offsetLabel)}<p class="tiny muted mt8">${t('p_fajr')} ${clock(times.fajr)} · ${t('p_sunrise')} ${clock(times.sunrise)}</p><h3 class="small gold mt20 mb8">${t('alarmSnoozes')}</h3>${seg('alarm-snoozes', FAJR_SNOOZES, f.snoozes, n => n === 0 ? t('alarmNoSnooze') : num(n))}${f.snoozes ? `<h3 class="small gold mt20 mb8">${t('alarmSnoozeLength')}</h3>${seg('alarm-snooze-min', FAJR_SNOOZE_MINUTES, f.snoozeMinutes, n => t('minutesShort').replace('{n}', num(n)))}` : ''}<label class="setting-row mt20"><span><strong>${t('alarmCheck')}</strong><p>${t('alarmCheckNote').replace('{n}', num(ALARM_CHECK_MINUTES))}</p></span><input type="checkbox" id="fajr-check" ${f.check ? 'checked' : ''} aria-label="${t('alarmCheck')}"></label>` : '';
    return `<section class="settings-section" id="fajr-alarm"><h2>${ic('sun', 18)} ${t('alarmSection')}</h2><label class="setting-row"><span><strong>${t('alarmToggle')}</strong><p>${t('alarmToggleNote')}</p></span><input type="checkbox" id="fajr-alarm-on" ${f.enabled ? 'checked' : ''} aria-label="${t('alarmToggle')}"></label>${denied}${fallback}${nextLine}${settings}</section>`;
}
async function syncFajrAlarm(): Promise<void> {
    const bridge = smartBridge();
    if (!bridge) return;
    const plan = fajrAlarmPlan(state), f = state.fajrAlarm;
    await bridge.scheduleAlarm({ alarms: plan.map(p => ({ uuid: p.uuid, at: p.at })), snoozes: f.snoozes, snoozeMinutes: f.snoozeMinutes, check: f.check, checkMinutes: ALARM_CHECK_MINUTES, title: t('alarmTitle'), checkTitle: t('alarmCheckTitle'), stop: t('alarmStop'), snooze: t('alarmSnooze') },
        fallbackPlan(plan).map(p => ({ id: p.id, at: p.at, title: t('alarmTitle'), body: t('alarmBody') })));
    alarmInfo = await bridge.alarmStatus();
}
async function setFajrAlarm(next: Partial<AppState['fajrAlarm']>): Promise<void> {
    await commit({ ...state, fajrAlarm: { ...state.fajrAlarm, ...next } });
    try { await syncFajrAlarm(); } catch { toast(t('alarmSyncFailed')); }
    keepScroll();
}
/** After the alarm: the du'a on waking, then a press-and-hold to confirm being awake (cancels the wake-check ring). */
function wakeView(): string {
    const list = entriesFor('wake');
    return `<p class="eyebrow">${t('alarmSection')}</p><h1 class="page-title">${t('wakeTitle')}</h1><p class="page-sub">${t('wakeSub')}</p><div class="stack mt20">${list.map(e => entryCard(e, 'wake')).join('')}</div><button class="button primary full hold-button mt20" id="wake-hold" aria-describedby="wake-hold-note"><span class="hold-fill" aria-hidden="true"></span><span class="hold-label">${t('wakeHold')}</span></button><p class="tiny muted mt8" id="wake-hold-note">${t('wakeHoldNote')}</p>`;
}
const WAKE_HOLD_MS = 1500;
let wakeTimer: number | null = null;
function wakeHoldStart(e: Event): void {
    const b = (e.target as HTMLElement | null)?.closest<HTMLElement>('#wake-hold');
    if (!b || wakeTimer !== null || (e instanceof KeyboardEvent && e.key !== ' ' && e.key !== 'Enter') || (e instanceof KeyboardEvent && e.repeat)) return;
    e.preventDefault();
    b.classList.add('holding');
    wakeTimer = window.setTimeout(() => { wakeTimer = null; b.classList.remove('holding'); void wakeConfirmed(); }, WAKE_HOLD_MS);
}
function wakeHoldEnd(): void {
    if (wakeTimer === null) return;
    clearTimeout(wakeTimer); wakeTimer = null;
    document.querySelector('#wake-hold')?.classList.remove('holding');
}
async function wakeConfirmed(): Promise<void> {
    await smartBridge()?.alarmAwake();
    if (alarmInfo) alarmInfo = { ...alarmInfo, checkWaiting: false };
    haptic();
    toast(t('wakeDone'));
    prayerTab = 'today';
    await navigate('prayer');
}
document.addEventListener('pointerdown', wakeHoldStart);
document.addEventListener('keydown', wakeHoldStart);
for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'keyup'] as const) document.addEventListener(ev, wakeHoldEnd, true);
// ---- Jumu'ah and voluntary fasts ----------------------------------------------------------------
const fastWhy = (r: FastReason[]) => r.map(x => t(x === 'monday' ? 'fastMonday' : x === 'thursday' ? 'fastThursday' : 'fastWhite')).join(' · ');
function calendarSection(): string {
    const fasts = upcomingFasts(Date.now(), 8).slice(0, 4), native = !!smartBridge();
    const toggle = (id: string, on: boolean, label: string, note: string) => `<label class="setting-row"><span><strong>${label}</strong><p>${note}</p></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${label}"></label>`;
    const rows = fasts.map(f => `<div class="diag-row"><span>${escapeHtml(f.date.toLocaleDateString(state.locale, { weekday: 'long', day: 'numeric', month: 'short' }))}<span class="tiny muted detection-detail">${escapeHtml(hijri(f.date))}</span></span><span>${fastWhy(f.reasons)}</span></div>`).join('');
    return `<section class="settings-section" id="calendar-reminders"><h2>${t('calendarSection')}</h2>${native ? `${toggle('jumuah-remind', state.calendar.jumuah, t('jumuahToggle'), t('jumuahNote'))}${toggle('fasting-remind', state.calendar.fasting, t('fastingToggle'), t('fastingNote'))}${toggle('suhoor-remind', state.calendar.suhoor, t('suhoorToggle'), t('suhoorNote'))}${toggle('iftar-remind', state.calendar.iftar, t('iftarToggle'), t('iftarNote'))}` : ''}<h3 class="small gold mt20 mb8">${t('nextFasts')}</h3>${rows ? `<div class="diag">${rows}</div>` : `<p class="small muted">${t('noFastsSoon')}</p>`}<p class="tiny muted mt12">${t('fastingHijriNote')}</p></section>`;
}
async function syncCalendar(): Promise<void> {
    const bridge = smartBridge();
    if (!bridge) return;
    await bridge.scheduleCalendar(calendarReminders(state, { jumuah: { title: t('jumuahTitle'), body: t('jumuahBody') }, fast: r => ({ title: t('fastTitle').replace('{why}', fastWhy(r)), body: t('fastBody') }), suhoor: f => ({ title: t('suhoorTitle'), body: t('suhoorBody').replace('{time}', clock(f)) }), iftar: m => ({ title: t('iftarTitle'), body: t('iftarBody').replace('{time}', clock(m)) }) }));
}
function homeView(): string {
    return `${dateLine()}${watchCard()}${fridayCard()}${ramadanCard()}${khatmCard()}${nextPrayerWidget()}${trackerWidget()}${quickDhikrWidget()}${ayahWidget()}
<div class="tile-row"><button class="mini-tile" data-action="nav" data-view="verses"><span class="gold">${ic('bookmark', 20)}</span><span class="grow"><strong>${t('dailyVerse')}</strong><span class="tiny muted">${t('dailyVerseSub')}</span></span></button><button class="mini-tile" data-action="nav" data-view="recitations"><span class="gold">${ic('book', 20)}</span><span class="grow"><strong>${t('shortRecitations')}</strong><span class="tiny muted">${t('shortRecitationsSub')}</span></span></button></div>
${qiblaTile()}${nowCard()}${isNative() ? dailyPulse() : ''}<p class="gentle">${t('gentleHome')}</p>`;
}
/** Status choices for one prayer: completed, missed (only the user says so), made up later, or not confirmed. */
function chooseStatus(prayer: PrayerName, day: string, current: SalahStatus | null): Promise<SalahStatus | null | undefined> {
    let dialog = document.querySelector<HTMLDialogElement>('#status-sheet');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'status-sheet'; dialog.className = 'sheet'; document.body.append(dialog); }
    const options: [SalahStatus | null, string, string][] = [['done', 'st_done', 'check'], ...(current === 'missed' || current === 'madeUp' ? [['madeUp', 'st_madeUp', 'loop'] as [SalahStatus, string, string]] : []), ['missed', 'st_missed', 'minus'], [null, 'st_clear', 'close']];
    dialog.innerHTML = `<h2>${t('p_' + prayer)}</h2><p class="small muted">${escapeHtml(new Date(`${day}T12:00:00`).toLocaleDateString(state.locale, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${statusLabel(current)}</p><div class="sheet-options">${options.map(([s, key, icon]) => `<button class="sheet-option ${s === current ? 'active' : ''}" data-status="${s ?? ''}" ${s === current ? 'aria-current="true"' : ''}>${ic(icon, 18)} ${t(key)}</button>`).join('')}</div><p class="tiny muted">${t('statusNote')}</p><button class="button secondary full" data-status="cancel">${t('cancel')}</button>`;
    return new Promise(resolve => {
        const d = dialog!;
        d.onclick = e => { const b = (e.target as Element).closest<HTMLButtonElement>('[data-status]'); if (!b) { if (e.target === d) { d.close(); resolve(undefined); } return; } d.close(); const v = b.dataset.status!; resolve(v === 'cancel' ? undefined : v === '' ? null : v as SalahStatus); };
        d.oncancel = e => { e.preventDefault(); d.close(); resolve(undefined); };
        d.showModal(); d.querySelector<HTMLButtonElement>('.sheet-option')?.focus();
    });
}
/** Saves a status and refreshes reminders and widgets. */
async function saveSalah(day: string, prayer: PrayerName, status: SalahStatus | null): Promise<void> {
    await commit(setSalah(state, day, prayer, status, Date.now()));
    justPrayed = status === 'done' ? { prayer, day } : justPrayed?.prayer === prayer ? null : justPrayed;
    void syncSalah();
    void pushWidget();
}
async function syncSalah(): Promise<void> {
    const bridge = smartBridge();
    if (!bridge) return;
    try { await bridge.scheduleSalah(salahReminders(state, (p, kind) => ({ title: t(kind === 'tasbih' ? 'nudgeTasbihTitle' : 'checkInTitle').replace('{prayer}', t('p_' + p)), body: t(kind === 'tasbih' ? 'nudgeTasbihBody' : 'checkInBody') }))); }
    catch { toast(t('reminderSyncFailed')); }
}
/** One month of the history calendar: how many of the five each day were confirmed. */
function historyCalendar(): string {
    const now = new Date(), first = new Date(now.getFullYear(), now.getMonth() + historyMonth, 1), days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7, today = dayKey();
    const cells = Array.from({ length: lead }, () => '<span></span>').join('') + Array.from({ length: days }, (_, i) => {
        const day = dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1, 12).getTime()), s = daySummary(state, day), kept = s.done + s.madeUp, future = day > today;
        return `<button class="cal-day ${day === today ? 'today' : ''} ${day === historyDay ? 'selected' : ''} ${kept === 5 ? 'full' : kept ? 'some' : ''}" data-action="history-day" data-day="${day}" ${future ? 'disabled' : ''} aria-label="${escapeHtml(new Date(`${day}T12:00:00`).toLocaleDateString(state.locale, { day: 'numeric', month: 'long' }))}: ${t('ofFive').replace('{n}', num(kept)).replace('{total}', num(5))}"><span>${num(i + 1)}</span><i style="--k:${kept / 5}"></i></button>`;
    }).join('');
    const week = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(state.locale, { weekday: 'narrow' }));
    return `<section class="section widget"><div class="row between"><button class="icon-button" data-action="history-month" data-step="-1" aria-label="${t('previousMonth')}"><span class="arrow-icon">${ic('prev', 18)}</span></button><h2 class="section-title">${escapeHtml(first.toLocaleDateString(state.locale, { month: 'long', year: 'numeric' }))}</h2><button class="icon-button" data-action="history-month" data-step="1" aria-label="${t('nextMonth')}" ${historyMonth >= 0 ? 'disabled' : ''}><span class="arrow-icon">${ic('next', 18)}</span></button></div><div class="cal-grid" role="group">${week.map(w => `<span class="cal-head">${escapeHtml(w)}</span>`).join('')}${cells}</div><p class="tiny muted mt12">${t('calendarNote')}</p></section>${historyDay ? trackerWidget(historyDay, true) : ''}`;
}
function insightsSection(): string {
    const week = salahWeek(state), streakDays = salahStreak(state), ins = salahInsights(state), top = Math.max(5, ...week.map(d => d.kept));
    const bars = `<div class="step-bars short">${week.map(d => `<div class="step-bar ${d.day === dayKey() ? 'current' : ''} ${d.kept === 5 ? 'met' : ''}"><span class="tiny muted">${d.kept ? num(d.kept) : '—'}</span><i style="height:${d.kept / top * 72}%"></i><span class="tiny">${escapeHtml(new Date(`${d.day}T12:00:00`).toLocaleDateString(state.locale, { weekday: 'narrow' }))}</span></div>`).join('')}</div>`;
    const lines = [streakDays ? t('salahStreak').replace('{n}', num(streakDays)) : t('salahStreakNone'), ins.best && ins.confirmed >= 10 ? t('bestPrayer').replace('{prayer}', t('p_' + ins.best)).replace('{n}', num(ins.perPrayer[ins.best])).replaceAll('{days}', num(30)) : '', ins.recordedDays ? t('recordedDays').replace('{n}', num(ins.confirmed)).replace('{d}', num(ins.recordedDays)).replace('{days}', num(30)) : ''].filter(Boolean);
    return `<section class="section"><h2 class="section-title mb16">${t('thisWeek')}</h2>${bars}<ul class="insights">${lines.map(l => `<li>${ic('leaf', 14)} ${l}</li>`).join('')}</ul></section>`;
}
function salahSettings(): string {
    const p = state.worship.prefs, toggle = (id: string, on: boolean, label: string, note: string) => `<label class="setting-row"><span><strong>${label}</strong><p>${note}</p></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${label}"></label>`;
    return `<section class="settings-section"><h2>${t('salahReminders')}</h2>${isNative() ? '' : miniNotice('nativeOnlyReminders')}${toggle('pref-checkin', p.checkIn, t('checkInToggle'), t('checkInNote'))}${p.checkIn ? `<div class="segment compact" role="group" aria-label="${t('checkInAfterLabel')}">${CHECK_IN_AFTER.map(m => `<button data-action="checkin-after" data-min="${m}" class="${p.checkInAfter === m ? 'active' : ''}" aria-pressed="${p.checkInAfter === m}">${num(m)} ${t('minuteShort')}</button>`).join('')}</div>` : ''}${toggle('pref-tasbih-nudge', p.tasbihNudge, t('tasbihNudgeToggle'), t('tasbihNudgeNote'))}</section>`;
}
function prayerTabs(): string {
    return `<div class="segment" role="tablist">${(['today', 'history', 'times', 'qibla'] as const).map(x => `<button role="tab" data-action="prayer-tab" data-tab="${x}" class="${prayerTab === x ? 'active' : ''}" aria-selected="${prayerTab === x}">${t('ptab_' + x)}</button>`).join('')}</div>`;
}
function prayersView(): string {
    const head = `<p class="eyebrow mt12">${t('prayers')}</p><h1 class="page-title">${t('salahTitle')}</h1>${prayerTabs()}`;
    if (prayerTab === 'times') return `${head}${prayerView()}`;
    if (prayerTab === 'qibla') return `${head}${qiblaView()}`;
    if (prayerTab === 'history') return `${head}${historyCalendar()}${insightsSection()}`;
    return `${head}${prayerPlace(state) ? nextPrayerWidget() : ''}${trackerWidget(salahDay(state), true)}${tasbihTiles()}${insightsSection()}${salahSettings()}<p class="gentle">${t('salahPrivate')}</p>`;
}
function tasbihTiles(): string {
    const day = salahDay(state), id = state.worship.prefs.tasbihVariant;
    return `<section class="section"><h2 class="section-title mb16">${t('guidedTasbih')}</h2><div class="tasbih-tiles">${PRAYERS.map(p => { const n = tasbihCount(day, p, id), total = counter(id).total; return `<button class="tasbih-tile ${n >= total ? 'finished' : ''}" data-action="tasbih-start" data-prayer="${p}" data-day="${day}">${ring(n / total * 100, n >= total ? ic('check', 16) : `<span class="tiny">${num(n)}</span>`)}<span class="tiny">${t('p_' + p)}</span></button>`; }).join('')}</div></section>`;
}
// Guided tasbih ------------------------------------------------------------------------------------
const tasbihKey = (day: string, prayer: PrayerName, id: string) => `${day}/${prayer}/${id}`;
function tasbihCount(day: string, prayer: PrayerName, id: string): number { return pendingTasbih[tasbihKey(day, prayer, id)]?.n ?? tasbihOn(state, day, prayer, id); }
async function flushTasbih(): Promise<void> {
    if (tasbihTimer) { clearTimeout(tasbihTimer); tasbihTimer = null; }
    const keys = Object.keys(pendingTasbih);
    if (!keys.length) return;
    let next = state;
    for (const k of keys) { const p = pendingTasbih[k]!; next = setTasbih(next, p.day, p.prayer, p.id, p.n); }
    const saved = keys.map(k => [k, pendingTasbih[k]!] as const);
    try { if (next !== state) await commit(next); } catch { return; }
    for (const [k, p] of saved) if (pendingTasbih[k] === p) delete pendingTasbih[k];
    void syncSalah();
}
function tasbihView(): string {
    const id = state.worship.prefs.tasbihVariant, c = counter(id), n = tasbihCount(tasbihDay, tasbihPrayer, id), done = n >= c.total;
    const pos = counterPosition(c, Math.min(n, c.total - 1)), step = c.steps[pos.step]!, inStep = done ? step.count : pos.inStep;
    const variants = `<div class="chip-wrap">${TASBIH_VARIANTS.map(v => `<button class="range-chip ${v === id ? 'selected' : ''}" data-action="tasbih-variant" data-id="${v}" aria-pressed="${v === id}">${escapeHtml(counter(v).steps.map(s => num(s.count)).join(' · '))}</button>`).join('')}</div>`;
    const prayers = `<div class="segment compact" role="group" aria-label="${t('prayers')}">${PRAYERS.map(p => `<button data-action="tasbih-prayer" data-prayer="${p}" class="${p === tasbihPrayer ? 'active' : ''}" aria-pressed="${p === tasbihPrayer}">${t('p_' + p)}${tasbihCount(tasbihDay, p, id) >= c.total ? ` ${ic('check', 11)}` : ''}</button>`).join('')}</div>`;
    const list = `<ol class="count-steps">${c.steps.map((x, i) => `<li class="${done || i < pos.step ? 'done' : i === pos.step ? 'current' : ''}"><span class="arabic" lang="ar" dir="rtl">${escapeHtml(x.text)}</span><span class="pill">×${num(x.count)}</span></li>`).join('')}</ol>`;
    const wording = c.steps.map(x => x.source).filter((x, i, a) => x.ref !== c.source.ref && a.findIndex(y => y.ref === x.ref) === i);
    return `<p class="eyebrow mt12">${t('guidedTasbih')}${tasbihDay !== dayKey() ? ` · ${escapeHtml(new Date(`${tasbihDay}T12:00:00`).toLocaleDateString(state.locale, { day: 'numeric', month: 'short' }))}` : ''}</p><h1 class="page-title">${t('tasbihAfter').replace('{prayer}', t('p_' + tasbihPrayer))}</h1>${prayers}
<section class="tap-zone ${celebrate === 'tasbih' ? 'celebrate' : ''}"><div class="count-meta"><span class="pill ${done ? 'success' : 'gold'}">${done ? `${ic('check', 12)} ${t('tasbihComplete')}` : `${num(pos.step + 1)} / ${num(c.steps.length)}`}</span><span class="tiny muted" aria-live="polite">${t('total')} <strong class="gold">${num(Math.min(n, c.total))}</strong> / ${num(c.total)}</span></div>
<button class="tap-counter" data-action="tasbih-tap" ${done || tasbihPaused ? 'disabled' : ''} aria-label="${escapeHtml(step.text)}: ${num(inStep)} ${t('of')} ${num(step.count)}">${beads(inStep, step.count)}<span class="tap-inner"><span class="arabic tap-phrase ${step.text.length > 40 ? 'long' : ''}" lang="ar" dir="rtl">${escapeHtml(step.text)}</span><span class="tap-number">${num(inStep)}</span><small class="tap-of">${t('of')} ${num(step.count)}</small></span></button>
<p class="tiny muted">${tasbihPaused ? t('pausedNote') : done ? t('tasbihDoneNote') : t('tapAnywhere')}</p>
<div class="row gap8">${actionButton('tasbih-undo', ic('back', 18), 'icon-button', `aria-label="${t('undo')}" ${n && !tasbihPaused ? '' : 'disabled'}`)}${actionButton('tasbih-pause', ic(tasbihPaused ? 'play' : 'pause', 18), 'icon-button', `aria-label="${t(tasbihPaused ? 'resume' : 'pause')}" aria-pressed="${tasbihPaused}" ${done ? 'disabled' : ''}`)}${actionButton('tasbih-reset', ic('loop', 18), 'icon-button', `aria-label="${t('resetCount')}" ${n ? '' : 'disabled'}`)}</div></section>
${list}<section class="section"><h2 class="section-title mb16">${t('tasbihVariants')}</h2>${variants}<p class="tiny muted mt12">${t('variantsNote')}</p></section>${sourceLine(c.source, c.also)}${wording.length ? `<p class="tiny muted">${t('wordingFrom')}</p>${wording.map(x => sourceLine(x)).join('')}` : ''}<p class="gentle">${t('ownCount')}</p>`;
}
// Verses -------------------------------------------------------------------------------------------
function verseBlock(s: number, a: number, extra = ''): string {
    const c = chapter(s);
    return `<article class="verse-card"><p class="arabic dhikr-text" lang="ar" dir="rtl">${escapeHtml(verse(s, a))} ${marker(a)}</p>${state.worship.prefs.translation ? `<p class="ayah-translation" lang="en" dir="ltr">${escapeHtml(translation(s, a))}</p>` : ''}<div class="row between"><button class="text-button" data-action="read-ayah" data-surah="${s}" data-ayah="${a}"><span class="arabic" lang="ar">${c.ar}</span> <span class="tiny muted">${escapeHtml(c.name)} <bdi>${s}:${a}</bdi></span></button><span class="row gap4">${extra}<button class="icon-button" data-action="play-verse" data-surah="${s}" data-ayah="${a}" aria-label="${t('listen')}">${ic('play', 16)}</button><button class="icon-button" data-action="share-verse" data-surah="${s}" data-ayah="${a}" aria-label="${t('share')}">${ic('share', 16)}</button></span></div></article>`;
}
function versesView(): string {
    const a = ayahOfDay(dayKey()), c = chapter(a.surah);
    const daily = Array.from({ length: a.to - a.ayah + 1 }, (_, k) => verseBlock(a.surah, a.ayah + k)).join('');
    const saved = state.bookmarks.map(k => k.split(':').map(Number) as [number, number]);
    return `<p class="eyebrow mt12">${t('quran')}</p><h1 class="page-title">${t('dailyVerse')}</h1><p class="page-sub">${t('dailyVerseNote')}</p><p class="tiny gold mb16">${escapeHtml(c.name)} <bdi>${ayahRef(a)}</bdi></p>${daily}
<section class="section"><h2 class="section-title mb16">${t('savedVerses')}</h2>${saved.length ? saved.map(([s, n]) => verseBlock(s, n, `<button class="icon-button" data-action="save-verse" data-surah="${s}" data-ayah="${n}" aria-label="${t('unsaveVerse')}">${ic('starFill', 16)}</button>`)).join('') : `<p class="empty">${t('noSavedVerses')}</p>`}</section><p class="gentle">${t('translationCredit')} · <a href="${TRANSLATION_SOURCE.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(TRANSLATION_SOURCE.source)}</a></p>`;
}
function recitationsView(): string {
    const list = RECITATIONS.map(r => { const c = chapter(r.surah); return `<button class="mode-card ${r.id === recitationId ? 'selected' : ''}" data-action="recitation" data-id="${r.id}" aria-expanded="${r.id === recitationId}"><span class="round-icon arabic" lang="ar">${c.ar.replace(/^سُورَةُ /, '').slice(0, 6)}</span><span class="grow"><h3>${escapeHtml(c.name)} <bdi class="tiny muted">${r.surah}:${r.from}${r.to > r.from ? `–${r.to}` : ''}</bdi></h3><p>${t('rec_' + r.id)}</p></span><span class="muted arrow-icon">${ic('chevron', 16)}</span></button>${r.id === recitationId ? `<div class="recitation-text">${recitation(r.id).ayahs.map(x => `<p class="arabic dhikr-text" lang="ar" dir="rtl">${escapeHtml(x.text)} ${marker(x.n)}</p>${state.worship.prefs.translation ? `<p class="ayah-translation" lang="en" dir="ltr">${escapeHtml(translation(r.surah, x.n))}</p>` : ''}`).join('')}<div class="row gap8 mt12">${actionButton('play-verse', `${ic('play', 15)} ${t('listenFirst')}`, 'button subtle', `data-surah="${r.surah}" data-ayah="${r.from}"`)}${actionButton('read-ayah', `${ic('book', 15)} ${t('readInContext')}`, 'button subtle', `data-surah="${r.surah}" data-ayah="${r.from}"`)}</div></div>` : ''}`; }).join('');
    return `<p class="eyebrow mt12">${t('quran')}</p><h1 class="page-title">${t('shortRecitations')}</h1><p class="page-sub">${t('recitationsSub')}</p><div class="notice mb16">${ic('info', 18)}<p>${t('recitationsNote')}</p></div><div class="stack">${list}</div><p class="gentle">${t('recitationsReview')}</p>`;
}
// Progress -----------------------------------------------------------------------------------------
function worshipProgress(): string {
    const today = dayKey(), s = daySummary(state, today), weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dayKey(d.getTime()); });
    const ids = counterDefs().map(c => c.id);
    const dayTotal = (day: string) => state.counts.filter(c => c.day === day).reduce((n, c) => n + c.n, 0) + state.worship.tasbih.filter(r => r.day === day).reduce((n, r) => n + r.n, 0);
    const todayDhikr = ids.reduce((n, id) => n + count(id), 0) + state.worship.tasbih.filter(r => r.day === today).reduce((n, r) => n + r.n, 0);
    const weekDhikr = todayDhikr + weekDays.slice(1).reduce((n, d) => n + dayTotal(d), 0);
    const lifetime = ids.reduce((n, id) => n + lifetimeCount(state, id), 0) + state.worship.tasbih.reduce((n, r) => n + r.n, 0);
    const top = ids.map(id => [id, lifetimeCount(state, id)] as const).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const quranWeek = weekDays.filter(d => state.worship.quran[d]?.length).length, surahsWeek = new Set(weekDays.flatMap(d => state.worship.quran[d] ?? [])).size;
    const metric = (v: string, l: string) => `<div class="metric"><p class="value">${v}</p><p class="label">${l}</p></div>`;
    return `<section class="section"><h2 class="section-title mb16">${t('prayers')}</h2><div class="progress-cards">${metric(`${num(s.done + s.madeUp)}<span class="tiny muted"> / 5</span>`, t('confirmedToday'))}${metric(num(salahStreak(state)), t('fullDays'))}${metric(num(salahWeek(state).reduce((n, d) => n + d.kept, 0)), t('confirmedWeek'))}</div></section>${insightsSection()}
<section class="section"><h2 class="section-title mb16">${t('dhikrHistory')}</h2><div class="progress-cards">${metric(num(todayDhikr), t('today'))}${metric(num(weekDhikr), t('last7Days'))}${metric(num(lifetime), t('lifetime'))}</div>${top.length ? `<div class="stack mt12">${top.map(([id, n]) => `<button class="mini-stats row between" data-action="counter" data-counter="${id}"><span class="small" dir="auto">${escapeHtml(counterDef(id).name)}</span><span class="gold">${num(n)}</span></button>`).join('')}</div>` : `<p class="empty">${t('noDhikrYet')}</p>`}</section>
<section class="section"><h2 class="section-title mb16">${t('quranActivity')}</h2><div class="progress-cards">${metric(num(quranWeek), t('readingDays'))}${metric(num(surahsWeek), t('surahsOpened'))}${metric(num(state.bookmarks.length), t('savedVerses'))}</div><p class="tiny muted mt12">${t('quranActivityNote')}</p></section><p class="gentle">${t('progressPrivate')}</p>
<h2 class="section-title section">${t('memorization')}</h2>`;
}
// Adhkar library -----------------------------------------------------------------------------------
function libraryCard(c: CounterDef): string {
    const n = count(c.id), fav = state.worship.favorites.includes(c.id), done = !c.perPrayer && n >= c.total, lib = c.library;
    const text = c.steps[0]!.text;
    return `<article class="lib-card ${done ? 'done' : ''}"><button class="lib-open" data-action="counter" data-counter="${c.id}"><span class="row between"><strong dir="auto">${escapeHtml(c.name)}</strong>${ring(c.perPrayer ? 0 : n / c.total * 100, done ? ic('check', 13) : '', 'tiny-ring')}</span><span class="${c.custom ? '' : 'arabic '}lib-text" ${c.custom ? 'dir="auto"' : 'lang="ar" dir="rtl"'}>${escapeHtml(text.length > 90 ? text.slice(0, text.lastIndexOf(' ', 88)) + ' …' : text)}</span><span class="tiny muted">${c.perPrayer ? t('perPrayerShort') : `${num(n)} / ${target(c)}`} · ${c.custom ? `<span class="gold">${t('addedByYou')}</span>` : c.kind === 'sunnah' ? t('sunnahCount') : t('personalGoal')}${lib?.quranRef ? ` · ${t('quranLabel')} <bdi>${lib.quranRef}</bdi>` : ''}</span></button><button class="icon-button fav" data-action="fav-toggle" data-counter="${c.id}" aria-pressed="${fav}" aria-label="${t(fav ? 'unfavorite' : 'favorite')}: ${escapeHtml(c.name)}">${ic(fav ? 'starFill' : 'star', 18)}</button></article>`;
}
function adhkarView(): string {
    const on = state.smart.location || state.smart.vehicle || state.smart.timed, all = counterDefs().filter(c => !c.perPrayer);
    const filters: [string, string][] = [['all', t('all')], ['favorites', `${t('favorites')} · ${num(state.worship.favorites.length)}`], ...LIBRARY_CATEGORIES.map(k => [k, t('cat_' + k)] as [string, string]), ['own', t('yourOwn')]];
    const shown = adhkarFilter === 'favorites' ? state.worship.favorites.map(counterDef).filter(c => !c.perPrayer) : adhkarFilter === 'own' ? all.filter(c => c.custom) : adhkarFilter === 'all' ? [...all.filter(c => c.library), ...all.filter(c => c.builtIn), ...all.filter(c => c.custom)] : all.filter(c => c.library?.category === adhkarFilter || (!c.library && !c.custom && adhkarFilter === 'istighfar'));
    const recent = state.worship.recent.filter(id => all.some(c => c.id === id)).slice(0, 4);
    return `<p class="eyebrow mt12">${t('adhkar')}</p><h1 class="page-title">${t('adhkarTitle')}</h1>${watchCard()}${nowCard()}${namesEntry()}
<button class="feature-wide row" data-action="tasbih-start" data-prayer="${currentPrayer()}" data-day="${dayKey()}"><span class="gold">${ic('tasbih', 24)}</span><span class="grow"><h3>${t('guidedTasbih')}</h3><p>${t('guidedTasbihSub')}</p></span>${chevronEnd()}</button>
${recent.length ? `<section class="section"><h2 class="section-title mb16">${t('recent')}</h2><div class="chip-wrap">${recent.map(id => `<button class="range-chip" data-action="counter" data-counter="${id}" dir="auto">${escapeHtml(counterDef(id).name)}</button>`).join('')}</div></section>` : ''}
<section class="section"><div class="row between"><h2 class="section-title">${t('library')}</h2><button class="text-button" data-action="counter-add">+ ${t('addCounter')}</button></div><div class="chip-wrap filter-row mt12" role="group" aria-label="${t('library')}">${filters.map(([k, l]) => `<button class="range-chip ${adhkarFilter === k ? 'selected' : ''}" data-action="adhkar-filter" data-filter="${k}" aria-pressed="${adhkarFilter === k}">${l}</button>`).join('')}</div><div class="stack mt12">${shown.length ? shown.map(libraryCard).join('') : `<p class="empty">${t(adhkarFilter === 'favorites' ? 'noFavorites' : 'noOwnYet')}</p>`}</div></section>
<section class="section"><h2 class="section-title mb16">${t('dailyMoments')}</h2><div class="moment-grid">${DAILY.map(momentTile).join('')}</div></section><section class="section"><h2 class="section-title mb16">${t('dailyDuas')}</h2><div class="moment-grid">${OUT.map(momentTile).join('')}</div></section>
<button class="feature-wide row section" data-action="nav" data-view="rotation"><span class="gold">${ic('bell', 24)}</span><span class="grow"><h3>${t('rotationTitle')}</h3><p>${state.rotation.enabled ? `${t('rotationEvery')} ${rotationLabel(state.rotation.every)} · ${state.rotation.from}–${state.rotation.to}` : t('rotationSub')}</p></span>${chevronEnd()}</button><button class="feature-wide row" data-action="nav" data-view="reminders"><span class="gold">${ic('radar', 24)}</span><span class="grow"><h3>${t('autoReminders')}</h3><p>${on ? `${[state.smart.location && t('locationReminders'), state.smart.vehicle && t('vehicleReminders'), state.smart.timed && t('timedReminders')].filter(Boolean).join(' · ')}` : t('autoSub')}</p></span>${chevronEnd()}</button><p class="gentle">${t('adhkarReview')}</p>`;
}
/** The obligatory prayer whose time it is now (the last one that began), for the tasbih shortcut. */
function currentPrayer(now = Date.now()): PrayerName {
    const times = dayTimes(dayKey(now));
    if (!times) return 'fajr';
    return [...PRAYERS].reverse().find(p => times[p] <= now) ?? 'isha';
}

const views: Record<View, () => string> = { hifz: hifzView, names: namesView, khatm: khatmView, wake: wakeView, review: reviewView, today: homeView, practice: practiceView, quran: quranView, reader: readerView, session: sessionView, result: resultView, tajweed: tajweedView, lesson: lessonView, recite: reciteView, progress: progressView, settings: settingsView, adhkar: adhkarView, moment: momentView, reminders: remindersView, prayer: prayersView, counter: counterView, steps: stepsView, rotation: rotationView, tasbih: tasbihView, verses: versesView, recitations: recitationsView };
/** The view last drawn: redrawing the same screen (a tap, a toggle) skips the enter animation so it does not flicker. */
let drawnView: View | null = null;
function render(): void { const same = drawnView === view; drawnView = view; applyTheme(); document.documentElement.lang = state.locale; document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr'; document.body.classList.toggle('reduced-motion', state.reducedMotion); document.body.classList.toggle('audio-playing', audioState === 'playing'); const reading = view === 'reader'; document.body.classList.toggle('reading', reading); root.innerHTML = `<div class="app-shell${reading ? ' reading-shell' : ''}">${reading ? '' : header()}${isTemporary() ? `<div class="temporary-banner">${ic('info', 13)} ${t('temporary')}</div>` : ''}<main class="main ${view === 'session' ? 'focus-screen' : ''} ${reading ? 'reader-main' : ''} ${same ? 'still' : ''}" id="main" tabindex="-1">${views[view]()}</main>${reading ? '' : nav()}<div class="sticky-audio" id="audio-banner" ${audioState === 'stopped' ? 'hidden' : ''}><span class="gold">${ic('wave', 20)}</span><div class="grow"><strong class="small">${bannerTitle()}</strong><p>${bannerSub()}</p></div><button class="icon-button" data-action="stop-audio" aria-label="${t('stopAudio')}">${ic('stop', 18)}</button></div>${followBar()}</div>`; if (view === 'reader') { applyFollow(); if (state.readingLayout === 'page' && !mushafOpen) { fitPage(); void document.fonts?.ready.then(fitPage); } } syncCompass(); }
async function navigate(target: View, updateHistory = true): Promise<void> { if (!Object.hasOwn(views, target))
    target = 'today'; if (recordingActive())
    await finishRecording(); if (followingActive() || target !== 'reader') { await stopFollowing(); followOff(); } if (target !== 'reader') releaseFollowing(); stopAudio(); view = target; if (updateHistory && location.href !== 'about:blank' && location.hash !== `#${target}`)
    history.pushState(null, '', `#${target}`); if (target !== 'counter') void flushCounts(); if (target !== 'tasbih') void flushTasbih(); if (target === 'reader') void commit(noteQuranOpen(state, readerSurah, Date.now())).catch(() => { }); if (target !== 'today') { ayahBrowse = null; ayahPin = null; } render(); if (target === 'today' || target === 'steps') void refreshSteps(); if (target === 'reminders') void syncSmart().then(() => { if (view === 'reminders') { const y = window.scrollY; render(); window.scrollTo(0, y); } }); window.scrollTo(0, 0); document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }); }
async function launch(mode: Mode | 'mixed', kind: 'daily' | 'practice' = 'practice', only?: QueueItem[]): Promise<void> { if (state.session) {
    await navigate('session');
    toast(t('resume'));
    return;
} if (mode === 'listen' && !state.audioConsent) {
    toast(t('audioDisabled'));
    await navigate('settings');
    return;
} const seed = crypto.getRandomValues(new Uint32Array(1))[0]!; const now = Date.now(); const queue = only ? (state.audioConsent ? only : only.filter(x => x.mode !== 'listen')) : planSession(state, mode, now, seed); if (only && !queue.length) {
    toast(t('audioDisabled'));
    return;
} if (!queue.length)
    return; const session: Session = { id: newId(), seed, queue, index: 0, answered: false, lastCorrect: false, lastChoice: null, correct: 0, startedAt: now, kind }; await commit({ ...state, session }); selectedOption = null; revealed = false; wordsShown = 0; locateSurah = locateAyah = null; await navigate('session'); }
async function answer(correct: boolean, choice: string | null): Promise<void> { const s = state.session; if (!s || s.answered)
    return; const item = s.queue[s.index]!; const next = applyAnswer(state, item, correct, Date.now(), `${s.id}:${s.index}`); await commit({ ...next, session: { ...s, answered: true, lastCorrect: correct, lastChoice: choice, correct: s.correct + (correct ? 1 : 0) } }); if (correct && !state.reducedMotion)
    haptic(); render(); document.querySelector('.feedback')?.scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'nearest' }); }
async function startMic(): Promise<void> { try {
    if (unsavedClip) {
        if (!await confirmAction(t('delete') + ' · ' + t('yourRecording') + '?'))
            return;
        unsavedClip = null;
    }
    await startRecording();
    recordStart = Date.now();
    recordTimer = setInterval(() => { const el = document.querySelector('#record-timer'); if (el) {
        const sec = Math.floor((Date.now() - recordStart) / 1000);
        el.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    } }, 250);
    render();
}
catch {
    toast(t('micError'));
} }
async function finishRecording(): Promise<void> { if (!recordingActive())
    return; try {
    const clip: Clip = await stopRecording();
    unsavedClip = { ...clip, id: newId(), surah: reciteSurah, ayah: reciteAyah, createdAt: Date.now() };
}
catch {
    toast(t('micError'));
}
finally {
    if (recordTimer)
        clearInterval(recordTimer);
    recordTimer = null;
    if (view === 'recite')
        render();
} }
async function handleAction(el: HTMLElement): Promise<void> {
    const d = el.dataset;
    switch (d.action) {
        case 'nav':
            await navigate(d.view as View);
            break;
        case 'back':
            await navigate(view === 'reader' || view === 'verses' || view === 'recitations' || view === 'practice' || view === 'review' || view === 'khatm' || view === 'hifz' ? 'quran' : view === 'lesson' ? 'tajweed' : view === 'settings' || view === 'steps' ? 'today' : view === 'moment' || view === 'reminders' || view === 'counter' || view === 'rotation' || view === 'names' ? 'adhkar' : view === 'tasbih' || view === 'wake' ? 'prayer' : 'practice');
            break;
        case 'daily':
            await launch('mixed', 'daily');
            break;
        case 'resume':
            await navigate('session');
            break;
        case 'start-mode':
            await launch(d.mode as Mode);
            break;
        case 'range': {
            const id = Number(d.surah);
            const selected = state.selectedSurahs.includes(id);
            if (selected && state.selectedSurahs.length === 1) {
                toast(t('oneSurah'));
                return;
            }
            await commit({ ...state, selectedSurahs: selected ? state.selectedSurahs.filter(x => x !== id) : [...state.selectedSurahs, id] });
            render();
            break;
        }
        case 'khatm-days': { const v = Number(d.v); if ((KHATM_DAYS as readonly number[]).includes(v)) { khatmDays = v; keepScroll(); } break; }
        case 'khatm-from': khatmFromHere = d.v === 'here'; keepScroll(); break;
        case 'hifz-repeat':
        case 'hifz-level': {
            const v = Number(d.v), h = hifzNow();
            if (d.action === 'hifz-repeat' && (HIFZ_REPEATS as readonly number[]).includes(v)) hifz = { ...h, repeat: v };
            if (d.action === 'hifz-level' && (HIFZ_LEVELS as readonly number[]).includes(v)) hifz = { ...h, level: v };
            keepScroll();
            break;
        }
        case 'hifz-play': {
            if (!state.audioConsent) { toast(t('audioDisabled')); break; }
            const h = hifzNow();
            playQueue(hifzQueue(h.surah, h.from, h.to, h.repeat), t('hifzTitle'));
            break;
        }
        case 'hifz-reveal': {
            const shown = el.classList.toggle('hidden') === false;
            el.setAttribute('aria-pressed', String(shown));
            break;
        }
        case 'open-qibla':
            prayerTab = 'qibla'; await navigate('prayer');
            break;
        case 'khatm-ramadan':
            if (!state.khatm) { await commit(startKhatm(state, 30, 1)); toast(t('khatmStarted')); render(); }
            break;
        case 'ramadan-reminders':
            prayerTab = 'times'; await navigate('prayer'); document.querySelector('#calendar-reminders')?.scrollIntoView({ block: 'start' });
            break;
        case 'khatm-new':
            await commit(endKhatm(state)); render();
            break;
        case 'khatm-start':
            await commit(startKhatm(state, khatmDays, khatmFromHere ? pageOf(state.readPosition.surah, state.readPosition.ayah) : 1));
            toast(t('khatmStarted')); render();
            break;
        case 'khatm-open': {
            const k = state.khatm && khatmToday(state.khatm);
            if (!k) break;
            const [ps, pa] = pageAyahs(k.nextPage)[0]!;
            if (state.readingLayout === 'page') { readerSurah = ps; readerPage = 0; await commit({ ...state, readPosition: { surah: ps, ayah: pa } }); await navigate('reader'); }
            else await openAt(ps, pa);
            break;
        }
        case 'khatm-set': {
            const v = Number(document.querySelector<HTMLInputElement>('#khatm-page')?.value);
            if (!Number.isInteger(v) || !state.khatm) { toast(t('khatmBadPage')); break; }
            await commit(setKhatmPage(state, v)); toast(t('saved')); keepScroll();
            break;
        }
        case 'khatm-end':
            if (await confirmAction(t('khatmEndPrompt'))) { await commit(endKhatm(state)); render(); }
            break;
        case 'open-verse': {
            const vs = Number(d.surah), va = Number(d.ayah);
            try { verse(vs, va); } catch { break; }
            readerSurah = vs;
            await commit({ ...state, readPosition: { surah: vs, ayah: va } });
            await navigate('reader');
            break;
        }
        case 'review-show':
            if (d.key) reviewShown.add(d.key);
            keepScroll();
            break;
        case 'review-answer': {
            const [rs, ra] = (d.key ?? '').split(':').map(Number);
            if (d.result !== 'remembered' && d.result !== 'revisit') break;
            try { await commit(reviewHighlight(state, rs!, ra!, d.result, dayKey())); } catch { break; }
            keepScroll();
            break;
        }
        case 'qibla-here': {
            const bridge = smartBridge();
            if (!bridge) break;
            try { const p = await bridge.currentPosition(); qiblaFrom = { lat: p.lat, lng: p.lng }; } catch { toast(t('locationError')); }
            keepScroll();
            break;
        }
        case 'qibla-saved':
            qiblaFrom = null;
            keepScroll();
            break;
        case 'read-surah':
            readerSurah = Number(d.surah);
            await commit({ ...state, readPosition: { surah: readerSurah, ayah: 1 } });
            await navigate('reader');
            break;
        case 'read-ayah': {
            const s = Number(d.surah), n = Number(d.ayah);
            verse(s, n);
            readerSurah = s;
            await commit({ ...state, readPosition: { surah: s, ayah: n } });
            await navigate('reader');
            document.querySelector(`#ayah-${n}`)?.scrollIntoView({ block: 'center' });
            break;
        }
        case 'read-last':
            readerSurah = state.readPosition.surah;
            await navigate('reader');
            document.querySelector(`#ayah-${state.readPosition.ayah}`)?.scrollIntoView();
            break;
        case 'library-filter':
            libraryFilter = d.filter!;
            render();
            break;
        case 'bookmark': {
            const k = `${d.surah}:${d.ayah}`;
            await commit({ ...state, bookmarks: state.bookmarks.includes(k) ? state.bookmarks.filter(x => x !== k) : [...state.bookmarks, k], readPosition: { surah: Number(d.surah), ayah: Number(d.ayah) } });
            const y = window.scrollY;
            render();
            window.scrollTo(0, y);
            break;
        }
        case 'play-verse':
            if (!state.audioConsent) {
                toast(t('audioDisabled'));
                return;
            }
            if (recordingActive() || followingActive())
                return;
            if (view === 'today') pinAyah();
            void playAudio(audioUrl(Number(d.surah), Number(d.ayah)), Number(d.speed ?? 1), d.loop === 'true').catch(() => { });
            break;
        case 'stop-audio':
            stopAudio();
            queueLabel = '';
            break;
        case 'verse-menu': {
            const sN = Number(d.surah), aN = Number(d.ayah);
            verse(sN, aN);
            menuVerse = `${sN}:${aN}`;
            el.classList.add('selected');
            openVerseMenu(sN, aN);
            break;
        }
        case 'page-go':
            await goToPage(Number(d.page));
            break;
        case 'mushaf-open':
            mushafOpen = !mushafOpen;
            render();
            window.scrollTo(0, 0);
            break;
        case 'reader-settings':
            openReaderSettings();
            break;
        case 'reader-jump':
            openReaderJump();
            break;
        case 'sheet-close':
            el.closest('dialog')?.close();
            break;
        case 'noop':
            break;
        case 'reader-theme':
            await commit({ ...state, readingTheme: (['auto', 'classic', 'night'] as const).find(x => x === d.theme) ?? 'auto' });
            render();
            break;
        case 'reader-size': {
            const size = Math.min(READER_SCALE.length - 1, Math.max(0, state.readerSize + Number(d.step)));
            if (size !== state.readerSize) { const y = window.scrollY; await commit({ ...state, readerSize: size }); render(); window.scrollTo(0, y); }
            break;
        }
        case 'reader-bookmark': {
            const k = d.key!;
            const [bs, ba] = k.split(':').map(Number);
            verse(bs!, ba!);
            const onPage = state.readingLayout === 'page' ? pageAyahs(readerPage).map(([x, y]) => `${x}:${y}`) : [k];
            const has = state.bookmarks.some(x => onPage.includes(x));
            await commit({ ...state, bookmarks: has ? state.bookmarks.filter(x => !onPage.includes(x)) : [...state.bookmarks, k] });
            toast(t(has ? 'bookmarkRemoved' : 'bookmarkAdded'));
            render();
            break;
        }
        case 'jump-page': {
            const v = Number(el.closest('dialog')?.querySelector<HTMLInputElement>('#jump-page')?.value);
            if (!Number.isInteger(v) || v < 1 || v > PAGE_COUNT) { toast(t('pageRange').replace('{a}', num(1)).replace('{n}', num(PAGE_COUNT))); return; }
            el.closest('dialog')?.close();
            const [ps, pa] = pageAyahs(v)[0]!;
            await openAt(ps, pa);
            break;
        }
        case 'jump-to':
            await openAt(Number(d.surah), Number(d.ayah));
            break;
        case 'jump-surah': {
            const v = Number(el.closest('dialog')?.querySelector<HTMLSelectElement>('#jump-surah')?.value);
            el.closest('dialog')?.close();
            await openAt(v, 1);
            break;
        }
        case 'select-option':
            if (state.session?.answered)
                return;
            selectedOption = d.id!;
            render();
            break;
        case 'check':
            if (selectedOption)
                await answer(selectedOption === currentQuestion().correctId, selectedOption);
            break;
        case 'reveal':
            revealed = true;
            render();
            break;
        case 'next-word': {
            wordsShown += 1;
            if (wordsShown >= ayahWords(currentQuestion().answerText).length)
                revealed = true;
            render();
            break;
        }
        case 'locate-surah':
            locateSurah = Number(d.surah);
            locateAyah = null;
            render();
            document.querySelector('.ayah-picker')?.scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
            break;
        case 'locate-ayah':
            locateAyah = Number(d.ayah);
            render();
            break;
        case 'locate-confirm': {
            const s = state.session;
            if (!s || s.answered || !locateSurah || !locateAyah)
                return;
            await answer(locateGuess(currentQuestion().item, locateSurah, locateAyah).correct, `${locateSurah}:${locateAyah}`);
            break;
        }
        case 'practice-missed': {
            if (!lastResult)
                return;
            const seen = new Set<string>();
            const items = sessionRecap(state, lastResult.sessionId).filter(x => !x.correct && !seen.has(x.key) && seen.add(x.key)).map(x => ({ key: x.key, mode: x.mode, surah: x.surah, ayah: x.ayah, reason: 'due' as const }));
            await launch('mixed', 'practice', items);
            break;
        }
        case 'recite-surah':
            await launch('recall', 'practice', surahRecallQueue(state, Number(d.surah)));
            break;
        case 'report': {
            const sN = Number(d.surah), aN = Number(d.ayah);
            const body = `${t('reportTitle')}\n${chapter(sN).name} ${sN}:${aN}\n${verse(sN, aN)}\n${CONTENT_VERSION} · AyahFlow 0.1.0\n\n${t('reportAsk')}\n`;
            try {
                if (await shareText(t('reportTitle'), body) === 'copied')
                    toast(t('reportCopied'));
            }
            catch (e) {
                if (!(e instanceof DOMException && e.name === 'AbortError'))
                    throw e;
            }
            break;
        }
        case 'self-answer':
            await answer(d.correct === 'true', null);
            break;
        case 'pause':
            await navigate('today');
            break;
        case 'next-question': {
            const s = state.session;
            if (!s?.answered)
                return;
            stopAudio();
            if (s.index + 1 >= s.queue.length) {
                lastResult = { sessionId: s.id, count: s.queue.length, correct: s.correct, self: s.queue.filter(x => x.mode === 'recall').length };
                await commit({ ...state, session: null, completedSessions: state.completedSessions + 1 });
                await navigate('result');
            }
            else {
                await commit({ ...state, session: { ...s, index: s.index + 1, answered: false, lastCorrect: false, lastChoice: null } });
                selectedOption = null;
                revealed = false;
                wordsShown = 0;
                locateSurah = locateAyah = null;
                render();
                window.scrollTo(0, 0);
            }
            break;
        }
        case 'open-lesson':
            lessonId = d.id as RuleId;
            await navigate('lesson');
            break;
        case 'lesson-answer': {
            const lesson = LESSONS.find(l => l.id === lessonId)!;
            const correct = Number(d.choice) === lesson.answer;
            const seen = state.lessonChecks.includes(lessonId);
            await commit({ ...state, lessonChecks: correct && !seen ? [...state.lessonChecks, lessonId] : state.lessonChecks, lessonHistory: [...state.lessonHistory, { id: lessonId, at: Date.now(), correct }].slice(-500) });
            if (correct)
                render();
            toast(t(correct ? 'checked' : 'tryAgain'));
            break;
        }
        case 'record-ayah':
            reciteSurah = Number(d.surah);
            reciteAyah = Number(d.ayah);
            await navigate('recite');
            break;
        case 'record':
            if (recordingActive())
                await finishRecording();
            else
                await startMic();
            break;
        case 'save-recording':
            if (unsavedClip) {
                await putRecording(unsavedClip);
                savedClips = await listRecordings();
                unsavedClip = null;
                render();
                toast(t('savedToast'));
            }
            break;
        case 'delete-recording':
            if (!await confirmAction(t('delete') + ' · ' + t('yourRecording') + '?'))
                return;
            stopAudio();
            if (unsavedClip?.id === d.id)
                unsavedClip = null;
            else {
                await deleteRecording(d.id!);
                savedClips = await listRecordings();
            }
            render();
            break;
        case 'play-recording': {
            const r = unsavedClip?.id === d.id ? unsavedClip : savedClips.find(x => x.id === d.id);
            if (r && !recordingActive())
                void playAudio(r.blob).catch(() => { });
            break;
        }
        case 'share-recording': {
            const r = savedClips.find(x => x.id === d.id);
            if (r)
                try {
                    await shareAudio(r);
                }
                catch (e) {
                    if (!(e instanceof DOMException && e.name === 'AbortError'))
                        throw e;
                }
            break;
        }
        case 'language':
            await commit({ ...state, locale: d.locale as Locale });
            render();
            break;
        case 'follow': {
            if (followingActive())
                return;
            const consented = state.voiceFollowConsent || await confirmAction(t('followConsent'));
            if (!consented)
                return;
            stopAudio();
            follow.status = 'loading';
            // Not awaited: loading takes seconds and the Stop button must stay usable meanwhile.
            void startFollowing(onFollow).catch(() => { followOff(); render(); toast(t('followError')); });
            if (!state.voiceFollowConsent)
                await commit({ ...state, voiceFollowConsent: true });
            render();
            break;
        }
        case 'follow-stop':
            await stopFollowing();
            followOff();
            render();
            break;
        case 'moment': {
            const ms = parseMomentUrl(`ayahflow://moment/${d.moments ?? ''}`);
            if (!ms.length)
                return;
            momentIds = ms;
            await navigate('moment');
            break;
        }
        case 'counter':
            if (!counterDefs().some(c => c.id === d.counter)) return;
            await flushCounts();
            counterId = d.counter!;
            addingCounter = false;
            if (state.worship.recent[0] !== counterId) await commit(markRecent(state, counterId)).catch(() => { });
            if (view === 'counter') { render(); break; }
            await navigate('counter');
            break;
        case 'fix-times': {
            const method = d.method as PrayerMethod;
            if (!PRAYER_METHODS.includes(method)) return;
            await commit({ ...state, smart: { ...state.smart, method, hanafi: false } });
            await syncSmart();
            toast(t('methodChanged').replace('{method}', METHOD_LABEL[method]));
            render();
            break;
        }
        case 'keep-times':
            timesHintDismissed = true;
            render();
            break;
        case 'rot-every': {
            const every = Number(d.every) as 30 | 60 | 120 | 180;
            if (!(ROTATION_INTERVALS as readonly number[]).includes(every)) return;
            await commit({ ...state, rotation: { ...state.rotation, every } });
            try { await syncRotation(); } catch { toast(t('reminderSyncFailed')); }
            render();
            break;
        }
        case 'counter-add':
            await flushCounts();
            addingCounter = true;
            render();
            document.querySelector<HTMLTextAreaElement>('#my-text')?.focus();
            break;
        case 'counter-cancel':
            addingCounter = false;
            render();
            break;
        case 'my-target-preset': {
            const input = document.querySelector<HTMLInputElement>('#my-target');
            if (input) input.value = String(Number(d.n));
            break;
        }
        case 'counter-save': {
            const text = document.querySelector<HTMLTextAreaElement>('#my-text')?.value.trim() ?? '', title = document.querySelector<HTMLInputElement>('#my-title')?.value.trim() ?? '';
            const goal = Number(document.querySelector<HTMLInputElement>('#my-target')?.value);
            if (!text) { toast(t('myTextNeeded')); return; }
            if (!Number.isSafeInteger(goal) || goal < 1 || goal > 10000) { toast(t('myTargetRange')); return; }
            const id = `my-${Date.now().toString(36)}`;
            await commit(addCounter(state, { id, title, text, target: goal }));
            counterId = id;
            addingCounter = false;
            void pushWidget();
            render();
            break;
        }
        case 'counter-remove': {
            const mine = state.myCounters.find(x => x.id === counterId);
            if (!mine || !(await confirmAction(t('removeCounterConfirm')))) return;
            delete pendingCounts[mine.id];
            await commit(removeCounter(state, mine.id));
            counterId = COUNTERS[0]!.id;
            void pushWidget();
            render();
            break;
        }
        case 'quick-tap':
        case 'count-tap':
        case 'count-undo': {
            const id = d.action === 'quick-tap' ? d.counter! : counterId, c = counterDef(id);
            if (c.id !== id) return;
            const n = Math.max(0, Math.min(MAX_COUNT, count(id) + (d.action === 'count-undo' ? -1 : 1)));
            pendingCounts[id] = { n, at: Date.now() };
            heartBeat = d.action === 'count-tap';
            const finished = d.action !== 'count-undo' && n > 0 && (n % c.total === 0 || c.steps.length > 1 && counterPosition(c, n).inStep === 0);
            celebrate = finished && n % c.total === 0 && !state.reducedMotion ? id : null;
            feedback(finished);
            if (state.worship.recent[0] !== id) { state = markRecent(state, id); }
            const y = window.scrollY;
            render();
            if (view === 'today') window.scrollTo(0, y);
            celebrate = null;
            document.querySelector<HTMLElement>(`[data-action="${d.action}"]`)?.focus();
            if (countTimer) clearTimeout(countTimer);
            countTimer = setTimeout(() => { void flushCounts().then(() => { if (view === 'counter') render(); }); }, 800);
            break;
        }
        case 'salah-tap': {
            const prayer = d.prayer as PrayerName, day = d.day!;
            if (!PRAYERS.includes(prayer)) return;
            const current = salahStatus(state, day, prayer);
            // One tap confirms; tapping a recorded prayer opens the choices (to correct it, or record a make-up).
            const next = current === null && canConfirm(day, prayer) ? 'done' : await chooseStatus(prayer, day, current);
            if (next === undefined || next === current) return;
            await saveSalah(day, prayer, next);
            feedback(next === 'done');
            const y = window.scrollY; render(); window.scrollTo(0, y);
            if (next === 'done') toast(t('confirmedToast').replace('{prayer}', t('p_' + prayer)));
            break;
        }
        case 'tasbih-start': {
            const prayer = d.prayer as PrayerName;
            if (!PRAYERS.includes(prayer)) return;
            tasbihPrayer = prayer; tasbihDay = d.day && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : salahDay(state); tasbihPaused = false;
            await navigate('tasbih');
            break;
        }
        case 'tasbih-prayer':
            await flushTasbih();
            if (PRAYERS.includes(d.prayer as PrayerName)) { tasbihPrayer = d.prayer as PrayerName; tasbihPaused = false; }
            render();
            break;
        case 'tasbih-variant':
            if (!TASBIH_VARIANTS.includes(d.id!)) return;
            await flushTasbih();
            await commit({ ...state, worship: { ...state.worship, prefs: { ...state.worship.prefs, tasbihVariant: d.id! } } });
            render();
            break;
        case 'tasbih-pause':
            await flushTasbih();
            tasbihPaused = !tasbihPaused;
            render();
            break;
        case 'tasbih-tap':
        case 'tasbih-undo': {
            if (tasbihPaused) return;
            const id = state.worship.prefs.tasbihVariant, c = counter(id), before = tasbihCount(tasbihDay, tasbihPrayer, id);
            const n = Math.max(0, Math.min(c.total, before + (d.action === 'tasbih-tap' ? 1 : -1)));
            if (n === before) return;
            pendingTasbih[tasbihKey(tasbihDay, tasbihPrayer, id)] = { day: tasbihDay, prayer: tasbihPrayer, id, n };
            const stepDone = d.action === 'tasbih-tap' && (n === c.total || counterPosition(c, n).inStep === 0);
            feedback(stepDone);
            celebrate = n === c.total && d.action === 'tasbih-tap' && !state.reducedMotion ? 'tasbih' : null;
            render();
            celebrate = null;
            document.querySelector<HTMLElement>(n === c.total ? '[data-action="tasbih-reset"]' : `[data-action="${d.action}"]`)?.focus();
            if (tasbihTimer) clearTimeout(tasbihTimer);
            if (n === c.total) await flushTasbih(); else tasbihTimer = setTimeout(() => void flushTasbih(), 800);
            break;
        }
        case 'tasbih-reset': {
            if (!(await confirmAction(t('resetTasbihConfirm').replace('{prayer}', t('p_' + tasbihPrayer))))) return;
            const id = state.worship.prefs.tasbihVariant;
            pendingTasbih[tasbihKey(tasbihDay, tasbihPrayer, id)] = { day: tasbihDay, prayer: tasbihPrayer, id, n: 0 };
            await flushTasbih();
            tasbihPaused = false;
            render();
            break;
        }
        case 'prayer-tab':
            if (['today', 'history', 'times', 'qibla'].includes(d.tab!)) prayerTab = d.tab as typeof prayerTab;
            render();
            break;
        case 'history-month':
            historyMonth = Math.min(0, historyMonth + Number(d.step));
            historyDay = null;
            render();
            break;
        case 'history-day':
            historyDay = historyDay === d.day ? null : d.day!;
            render();
            document.querySelector(`#w-track-${historyDay}`)?.scrollIntoView({ block: 'nearest' });
            break;
        case 'checkin-after': {
            const m = Number(d.min);
            if (!(CHECK_IN_AFTER as readonly number[]).includes(m)) return;
            await commit({ ...state, worship: { ...state.worship, prefs: { ...state.worship.prefs, checkInAfter: m as typeof CHECK_IN_AFTER[number] } } });
            await syncSalah();
            render();
            break;
        }
        case 'fav-toggle': {
            const id = d.counter!;
            await commit(toggleFavorite(state, id));
            toast(t(state.worship.favorites.includes(id) ? 'favoriteAdded' : 'favoriteRemoved'));
            const y = window.scrollY; render(); window.scrollTo(0, y);
            break;
        }
        case 'adhkar-filter':
            adhkarFilter = d.filter!;
            render();
            break;
        case 'target-preset': {
            const n = Number(d.n), c = counterDef(counterId);
            await flushCounts();
            await commit(setTarget(state, c.id, n === c.sourced ? null : n));
            render();
            break;
        }
        case 'dhikr-copy':
        case 'dhikr-share': {
            const c = counterDef(counterId), src = c.library?.source ?? c.builtIn?.source;
            const text = `${c.steps.map(x => x.text).join('\n')}\n${c.custom ? t('addedByYou') : `${c.name}${src ? ` · ${src.collection} ${src.number}` : ''}${c.library?.quranRef ? ` · ${t('quranLabel')} ${c.library.quranRef}` : ''}`}`;
            if (d.action === 'dhikr-copy') { await navigator.clipboard.writeText(text).then(() => toast(t('copied')), () => toast(t('error'))); break; }
            const r = await shareText(c.name, text).catch(() => null);
            if (r === 'copied') toast(t('copied'));
            break;
        }
        case 'recitation':
            recitationId = recitationId === d.id ? null : d.id!;
            render();
            document.querySelector('.mode-card.selected')?.scrollIntoView({ block: 'nearest' });
            break;
        case 'moment-prev':
        case 'moment-next': {
            const s0 = Number(d.surah), a0 = Number(d.ayah) + (d.action === 'moment-next' ? 1 : -1);
            if (a0 < 1 || a0 > chapter(s0).count) return;
            pinAyah();
            ayahBrowse = { surah: s0, ayah: a0 };
            const y = window.scrollY; render(); window.scrollTo(0, y);
            break;
        }
        case 'moment-now':
            ayahBrowse = null; ayahPin = null;
            { const y = window.scrollY; render(); window.scrollTo(0, y); }
            break;
        case 'toggle-translation':
            pinAyah();
            await commit({ ...state, worship: { ...state.worship, prefs: { ...state.worship.prefs, translation: !state.worship.prefs.translation } } });
            { const y = window.scrollY; render(); window.scrollTo(0, y); }
            break;
        case 'save-verse': {
            const k = `${Number(d.surah)}:${Number(d.ayah)}`;
            verse(Number(d.surah), Number(d.ayah));
            if (view === 'today') pinAyah();
            const saved = state.bookmarks.includes(k);
            await commit({ ...state, bookmarks: saved ? state.bookmarks.filter(x => x !== k) : [...state.bookmarks, k] });
            toast(t(saved ? 'verseUnsaved' : 'verseSaved'));
            const y = window.scrollY; render(); window.scrollTo(0, y);
            break;
        }
        case 'copy-verse':
        case 'share-verse': {
            const sN = Number(d.surah), aN = Number(d.ayah), c = chapter(sN);
            if (view === 'today') pinAyah();
            const text = `${verse(sN, aN)}\n${state.worship.prefs.translation ? `${translation(sN, aN)} (${TRANSLATION_SOURCE.name})\n` : ''}${c.name} ${sN}:${aN}`;
            if (d.action === 'copy-verse') { await navigator.clipboard.writeText(text).then(() => toast(t('copied')), () => toast(t('error'))); break; }
            const r = await shareText(`${c.name} ${sN}:${aN}`, text).catch(() => null);
            if (r === 'copied') toast(t('copied'));
            break;
        }
        case 'count-reset':
            if (!(await confirmAction(t('resetCountConfirm')))) return;
            pendingCounts[counterId] = { n: 0, at: Date.now() };
            await flushCounts();
            render();
            break;
        case 'steps-enable': {
            const bridge = smartBridge();
            if (!bridge) { toast(t('stepsWeb')); return; }
            await bridge.requestMotion().catch(() => null);
            await commit({ ...state, health: { ...state.health, steps: true } });
            await navigate('steps');
            await refreshSteps(true);
            break;
        }
        case 'steps-disable':
            await commit({ ...state, health: { ...state.health, steps: false } });
            stepReading = null;
            void pushWidget();
            await navigate('today');
            break;
        case 'step-goal': {
            const g = Number(d.goal);
            if (![5000, 8000, 10000, 12000].includes(g)) return;
            await commit({ ...state, health: { ...state.health, stepGoal: g } });
            render();
            break;
        }
        case 'dhikr-count':
        case 'dhikr-done': {
            const m = d.moment as Moment, id = d.entry!, key = `${m}:${id}`;
            const entryDef = entriesFor(m).find(e => e.id === id);
            if (!entryDef)
                return;
            const left = d.action === 'dhikr-done' ? 0 : (counters[key] ?? entryDef.repeat) - 1;
            counters[key] = Math.max(0, left);
            if (!state.reducedMotion) haptic();
            if (left <= 0) {
                // One completion per dhikr, moment and day: re-tapping cannot inflate the record.
                await commit(completeDhikr(state, id, m, Date.now(), `${m}:${id}:${dayKey()}`));
                delete counters[key];
                void syncSmart();
            }
            const y = window.scrollY;
            render();
            window.scrollTo(0, y);
            break;
        }
        case 'range-preset': {
            const preset = d.preset;
            const ids = preset === 'juz30' ? SURAH_DATA.filter(x => x.id >= 78).map(x => x.id) : preset === 'prayer' ? [...new Set(PRAYER_SETS.flatMap(p => p.surahs))].sort((a, b) => a - b) : [112, 113, 114];
            await commit({ ...state, selectedSurahs: ids });
            render();
            break;
        }
        case 'prayer-practice': {
            const set = PRAYER_SETS.find(p => p.id === d.set);
            if (!set)
                return;
            await commit({ ...state, selectedSurahs: [...set.surahs] });
            toast(`${t('range')}: ${set.surahs.map(x => chapter(x).name).join(', ')}`);
            render();
            break;
        }
        case 'place-set': {
            const bridge = smartBridge(), kind = d.place as PlaceKind;
            if (!bridge)
                return;
            try {
                const pos = await bridge.currentPosition();
                // Saving Home also picks the calculation method usually used there, so athan times match local mosques.
                const hint = kind === 'home' ? suggestedMethod(pos) : null, method = hint?.method ?? state.smart.method;
                await commit({ ...state, places: { ...state.places, [kind]: { lat: pos.lat, lng: pos.lng, radius: state.places[kind]?.radius ?? 150 } }, smart: { ...state.smart, method } });
                toast(hint ? `${t('placeSaved')} ${t('methodChanged').replace('{method}', METHOD_LABEL[method])}` : t('placeSaved'));
            }
            catch { toast(t('locationError')); }
            await syncSmart();
            render();
            break;
        }
        case 'place-remove': {
            const kind = d.place as PlaceKind;
            const places = { ...state.places, [kind]: null };
            const any = places.home || places.work || places.mosque;
            await commit({ ...state, places, smart: { ...state.smart, location: state.smart.location && !!any } });
            await syncSmart();
            render();
            break;
        }
        case 'place-radius': {
            const next = setPlaceRadius(state, d.place as PlaceKind, Number(d.radius));
            if (next === state)
                return;
            await commit(next);
            await syncSmart();
            render();
            break;
        }
        case 'smart-span':
            await commit({ ...state, smart: { ...state.smart, span: d.span === 'narrow' ? 'narrow' : 'broad' } });
            await syncSmart();
            render();
            break;
        case 'smart-moment': {
            const m = d.moment as Moment, has = state.smart.moments.includes(m);
            await commit({ ...state, smart: { ...state.smart, moments: has ? state.smart.moments.filter(x => x !== m) : [...state.smart.moments, m] } });
            await syncSmart();
            render();
            break;
        }
        case 'smart-test': {
            const bridge = smartBridge();
            if (!bridge)
                return;
            await syncSmart();
            const ms = await bridge.simulate(d.event as SmartEvent);
            toast(t(ms.length ? 'testSent' : 'testNothing'));
            break;
        }
        case 'detections-clear':
            await commit({ ...state, detections: [] });
            render();
            break;
        case 'copy-link':
            try {
                await navigator.clipboard.writeText(d.url!);
                toast(t('copied'));
            }
            catch { toast(d.url!); }
            break;
        case 'alarm-offset':
        case 'alarm-snoozes':
        case 'alarm-snooze-min': {
            const v = Number(d.v), key = d.action === 'alarm-offset' ? 'offset' : d.action === 'alarm-snoozes' ? 'snoozes' : 'snoozeMinutes';
            const allowed: readonly number[] = key === 'offset' ? FAJR_OFFSETS : key === 'snoozes' ? FAJR_SNOOZES : FAJR_SNOOZE_MINUTES;
            if (allowed.includes(v)) await setFajrAlarm({ [key]: v });
            break;
        }
        case 'open-settings':
            await smartBridge()?.openSettings();
            break;
        case 'athan-prayer': {
            const p = d.prayer as PrayerName;
            await commit({ ...state, athan: { ...state.athan, prayers: { ...state.athan.prayers, [p]: !state.athan.prayers[p] } } });
            await syncSmart();
            render();
            break;
        }
        case 'before-minutes': {
            const m = Number(d.min);
            if (!(BEFORE_MINUTES as readonly number[]).includes(m) || m === state.athan.before.minutes)
                return;
            await commit({ ...state, athan: { ...state.athan, before: { ...state.athan.before, minutes: m as typeof BEFORE_MINUTES[number] } } });
            await syncSmart();
            render();
            break;
        }
        case 'test-before':
        case 'test-athan': {
            const y = window.scrollY;
            await runNotificationTest(d.action === 'test-before' ? 'before' : 'athan');
            render();
            window.scrollTo(0, y);
            break;
        }
        case 'athan-sound':
            await commit({ ...state, athan: { ...state.athan, sound: d.sound === 'chime' ? 'chime' : 'athan' } });
            await syncSmart();
            render();
            break;
        case 'athan-preview': {
            const id = d.reciter ?? state.athan.reciter;
            if (previewing === id && audioState === 'playing') { stopAudio(); previewing = null; render(); return; }
            if (recordingActive() || followingActive()) return;
            const url = id === 'custom' ? (nativeAthan() && state.athan.custom ? await nativeAthan()!.url(state.athan.custom.ext, state.athan.custom.version) : webCustomUrl)
                : id.startsWith('online-') ? (state.athan.downloads.includes(id.slice(7)) && nativeAthan() ? await nativeAthan()!.onlineUrl(id.slice(7)) : online(id.slice(7))?.url ?? null)
                : bundledUrl(id);
            if (!url) return;
            previewing = id;
            previewUrl = url;
            void playAudio(url).catch(() => { previewing = null; });
            setTimeout(render, 60);
            break;
        }
        case 'athan-reciter':
            await commit({ ...state, athan: d.fajr ? { ...state.athan, fajrReciter: d.reciter!, sound: 'athan' } : { ...state.athan, reciter: d.reciter!, sound: 'athan' } });
            await syncSmart();
            render();
            break;
        case 'athan-download': {
            const r = online(d.online ?? ''), native = nativeAthan();
            if (!r || !native || downloadingAthan) return;
            if (!await confirmAction(`${t('downloadConfirm')}\n${r.name[state.locale]} · ${num(Math.round(r.bytes / 100000) / 10)} ${t('megabytes')}`)) return;
            downloadingAthan = r.id;
            render();
            try {
                const bytes = fromBase64(await native.download(r));
                const { wav } = await makeAlert(bytes);
                await native.saveAlert(r.id, toBase64(wav), r.name.en);
                await commit({ ...state, athan: { ...state.athan, downloads: [...state.athan.downloads.filter(x => x !== r.id), r.id] } });
                await syncSmart();
                toast(t('downloaded'));
            }
            catch { toast(t('downloadFailed')); }
            finally { downloadingAthan = null; render(); }
            break;
        }
        case 'athan-remove-online': {
            const r = online(d.online ?? '');
            if (!r || !await confirmAction(`${t('removeOwn')} · ${r.name[state.locale]}?`)) return;
            stopAudio();
            await nativeAthan()?.removeOnline(r.id);
            const id = `online-${r.id}`, fallback = ATHAN_RECORDINGS[0]!.id;
            await commit({ ...state, athan: { ...state.athan, downloads: state.athan.downloads.filter(x => x !== r.id), reciter: state.athan.reciter === id ? fallback : state.athan.reciter, fajrReciter: state.athan.fajrReciter === id ? fallback : state.athan.fajrReciter } });
            await syncSmart();
            render();
            break;
        }
        case 'athan-remove-own': {
            if (!await confirmAction(`${t('removeOwn')} · ${state.athan.custom?.name ?? ''}?`)) return;
            stopAudio();
            await nativeAthan()?.remove();
            if (webCustomUrl) { URL.revokeObjectURL(webCustomUrl); webCustomUrl = null; }
            const fallback = ATHAN_RECORDINGS[0]!.id;
            await commit({ ...state, athan: { ...state.athan, custom: null, reciter: state.athan.reciter === 'custom' ? fallback : state.athan.reciter, fajrReciter: state.athan.fajrReciter === 'custom' ? fallback : state.athan.fajrReciter } });
            await syncSmart();
            render();
            break;
        }
        case 'arabic-size':
            await commit({ ...state, arabicSize: d.size as ArabicSize });
            render();
            break;
        case 'layout': {
            const next = (['cards', 'flow', 'page'] as const).find(x => x === d.layout) ?? 'page';
            if (next === state.readingLayout) { if (mushafOpen) { mushafOpen = false; render(); } break; }
            await commit({ ...state, readingLayout: next });
            mushafOpen = false;
            // Keep the place: the page holding the last-read verse, or that verse in its surah.
            readerSurah = state.readPosition.surah; readerPage = 0;
            render();
            window.scrollTo(0, 0);
            if (next !== 'page') document.querySelector(`#ayah-${state.readPosition.ayah}`)?.scrollIntoView({ block: 'center' });
            break;
        }
        case 'theme':
            await commit({ ...state, theme: d.theme as Theme });
            render();
            break;
        case 'goal':
            await commit({ ...state, goal: Number(d.goal) as 3 | 7 | 10 });
            render();
            break;
        case 'export':
            await exportProgress(exportable(state));
            break;
        case 'import':
            document.querySelector<HTMLInputElement>('#import-file')!.click();
            break;
        case 'reset':
            if (await confirmAction(t('resetPrompt'))) {
                stopAudio();
                await clearLocalData();
                state = initialState();
                savedClips = [];
                unsavedClip = null;
                await navigate('today');
            }
            break;
        case 'reminder': {
            const time = document.querySelector<HTMLInputElement>('#reminder-time')!.value;
            if (!time)
                return;
            try {
                await setReminder(time);
                await commit({ ...state, reminder: time });
                render();
                toast(t('savedToast'));
            }
            catch (e) {
                toast(e instanceof Error && e.message === 'nativeOnly' ? t('nativeOnly') : t('error'));
            }
            break;
        }
        case 'remove-reminder':
            await setReminder(null);
            await commit({ ...state, reminder: null });
            render();
            break;
        case 'practice-weak': {
            const c = state.cards[d.key!];
            if (c)
                await launch(c.mode, 'practice', [{ key: c.key, mode: c.mode, surah: c.surah, ayah: c.ayah, reason: 'due' }]);
            break;
        }
    }
}
/** Page layout: swipe to turn (right = next page, as in a printed Mushaf), arrow keys, and Enter/Space on a focused ayah. */
let swipeFrom: { x: number; y: number } | null = null;
root.addEventListener('touchstart', e => { const p = (e.target as Element).closest('.r-page .r-surface'); swipeFrom = p && e.touches.length === 1 ? { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY } : null; }, { passive: true });
root.addEventListener('touchend', e => {
    if (!swipeFrom || view !== 'reader' || state.readingLayout !== 'page') return;
    const t0 = e.changedTouches[0]!, dx = t0.clientX - swipeFrom.x, dy = t0.clientY - swipeFrom.y;
    swipeFrom = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50 && !busy) void goToPage(readerPage + (dx > 0 ? 1 : -1));
}, { passive: true });
document.addEventListener('keydown', e => {
    if (view !== 'reader' || state.readingLayout !== 'page' || mushafOpen || document.querySelector('dialog[open]')) return;
    const el = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && el.classList?.contains('q-v')) { e.preventDefault(); el.click(); return; }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); void goToPage(readerPage + (e.key === 'ArrowLeft' ? 1 : -1)); }
});
root.addEventListener('click', e => {
    const el = e.target as Element;
    if (view !== 'reader' || mushafOpen || el.closest('[data-action], a, button, input, select, textarea, summary')) return;
    const reader = el.closest('.reader');
    if (!reader || !el.closest('.r-surface')) return;
    chromeHidden = !chromeHidden;
    reader.classList.toggle('chrome-off', chromeHidden);
});
root.addEventListener('click', async (e) => { const target = (e.target as Element).closest<HTMLElement>('[data-action]'); if (!target || busy || (target as HTMLButtonElement).disabled)
    return; busy = true; try {
    await handleAction(target);
}
catch (error) {
    console.error('AyahFlow action failed', error instanceof Error ? error.message : 'Unknown error');
    toast(t('error'));
}
finally {
    busy = false;
} });
root.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el.id === 'surah-search') {
    libraryQuery = el.value;
    document.querySelector('#surah-list')!.innerHTML = surahRows();
} });
root.addEventListener('change', async (e) => { const el = e.target as HTMLInputElement; if (!['audio-toggle', 'motion-toggle', 'voice-toggle', 'recite-surah', 'recite-ayah', 'juz-filter', 'range-add', 'smart-location', 'smart-vehicle', 'smart-timed', 'smart-hanafi', 'smart-method', 'smart-sleep', 'athan-enabled', 'athan-away', 'before-enabled', 'athan-fajr', 'athan-file', 'istighfar-remind', 'rot-enabled', 'rot-from', 'rot-to', 'target-input'].includes(el.id) && !el.id.startsWith('rot-p-') && !el.id.startsWith('pref-'))
    return; try {
    if (el.id === 'audio-toggle') {
        if (!el.checked)
            stopAudio();
        await commit({ ...state, audioConsent: el.checked });
    }
    if (el.id === 'motion-toggle')
        await commit({ ...state, reducedMotion: el.checked });
    if (el.id === 'voice-toggle')
        await commit({ ...state, voiceFollowConsent: el.checked });
    if (el.id === 'juz-filter')
        libraryJuz = Number(el.value);
    if (el.id === 'range-add' && el.value)
        await commit({ ...state, selectedSurahs: [...state.selectedSurahs, Number(el.value)].sort((a, b) => a - b) });
    if (el.id.startsWith('smart-'))
        await changeSmart(el);
    if (el.id === 'athan-fajr') {
        await commit({ ...state, athan: { ...state.athan, fajrReciter: el.value } });
        await syncSmart();
    }
    if (el.id === 'athan-file') {
        const file = el.files?.[0];
        el.value = '';
        if (!file) return;
        if (file.size > MAX_IMPORT_BYTES) { toast(t('importTooLarge')); return; }
        toast(t('importing'));
        try {
            const bytes = await file.arrayBuffer();
            const { wav } = await makeAlert(bytes);
            const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1] ?? 'm4a').toLowerCase(), version = Date.now() % 1000000000, name = file.name.slice(0, 120);
            const native = nativeAthan();
            if (native) await native.save({ full: toBase64(bytes), ext, alert: toBase64(wav), version, name });
            else { if (webCustomUrl) URL.revokeObjectURL(webCustomUrl); webCustomUrl = URL.createObjectURL(file); toast(t('importWebOnly')); }
            await commit({ ...state, athan: { ...state.athan, custom: { name, ext, version }, reciter: 'custom', sound: 'athan' } });
            await syncSmart();
            if (native) toast(t('imported'));
        }
        catch { toast(t('importFailed')); }
    }
    if (el.id.startsWith('rot-')) {
        const r = { ...state.rotation };
        if (el.id === 'rot-enabled') {
            const bridge = smartBridge();
            if (el.checked && bridge && await bridge.notificationPermission(true) !== 'granted') { toast(t('needNotifications')); el.checked = false; return; }
            r.enabled = el.checked;
        }
        if (el.id === 'rot-from' || el.id === 'rot-to') {
            const from = el.id === 'rot-from' ? el.value : r.from, to = el.id === 'rot-to' ? el.value : r.to;
            if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to) || from >= to) { toast(t('rotationHoursInvalid')); render(); return; }
            r.from = from; r.to = to;
        }
        if (el.id.startsWith('rot-p-')) { const id = el.id.slice(6); r.phrases = el.checked ? [...r.phrases.filter(p => p !== id), id] : r.phrases.filter(p => p !== id); }
        await commit({ ...state, rotation: r });
        try { await syncRotation(); if (el.id === 'rot-enabled' && el.checked) toast(t('rotationEnabled')); } catch { toast(t('reminderSyncFailed')); }
        const y = window.scrollY; render(); window.scrollTo(0, y);
        return;
    }
    if (el.id === 'target-input') {
        const n = Number(el.value), c = counterDef(counterId);
        if (!Number.isSafeInteger(n) || n < 1 || n > 10000) { toast(t('targetInvalid')); render(); return; }
        await flushCounts();
        await commit(setTarget(state, c.id, n === c.sourced ? null : n));
    }
    if (el.id.startsWith('pref-')) {
        const keys: Record<string, 'haptics' | 'sounds' | 'checkIn' | 'tasbihNudge'> = { 'pref-haptics': 'haptics', 'pref-sounds': 'sounds', 'pref-checkin': 'checkIn', 'pref-tasbih-nudge': 'tasbihNudge' };
        const key = keys[el.id];
        if (!key) return;
        const bridge = smartBridge();
        if (el.checked && (key === 'checkIn' || key === 'tasbihNudge') && bridge && await bridge.notificationPermission(true) !== 'granted') { toast(t('needNotifications')); el.checked = false; return; }
        await commit({ ...state, worship: { ...state.worship, prefs: { ...state.worship.prefs, [key]: el.checked } } });
        if (key === 'checkIn' || key === 'tasbihNudge') await syncSalah();
        const y = window.scrollY; render(); window.scrollTo(0, y);
        return;
    }
    if (el.id === 'fajr-alarm-on') {
        const bridge = smartBridge();
        if (el.checked && bridge) {
            const info = alarmInfo = await bridge.alarmStatus();
            const allowed = info.available ? (info.authorization === 'authorized' || await bridge.alarmRequest() === 'authorized') : await bridge.notificationPermission(true) === 'granted';
            if (!allowed) { toast(t(info.available ? 'alarmDenied' : 'needNotifications')); el.checked = false; return; }
        }
        await setFajrAlarm({ enabled: el.checked });
        const next = fajrAlarmPlan(state)[0];
        if (el.checked && next) toast(t('alarmOn').replace('{time}', clock(next.at)));
        return;
    }
    if (el.id === 'fajr-check') { await setFajrAlarm({ check: el.checked }); return; }
    if (el.id === 'hifz-surah' || el.id === 'hifz-from' || el.id === 'hifz-to') { setHifzRange(); return; }
    if (el.id === 'jumuah-remind' || el.id === 'fasting-remind' || el.id === 'suhoor-remind' || el.id === 'iftar-remind') {
        const bridge = smartBridge();
        if (el.checked && bridge && await bridge.notificationPermission(true) !== 'granted') { toast(t('needNotifications')); el.checked = false; return; }
        await commit({ ...state, calendar: { ...state.calendar, [el.id === 'jumuah-remind' ? 'jumuah' : el.id === 'fasting-remind' ? 'fasting' : el.id === 'suhoor-remind' ? 'suhoor' : 'iftar']: el.checked } });
        try { await syncCalendar(); await syncRotation(); if (el.checked) toast(t('calendarOn')); } catch { toast(t('reminderSyncFailed')); }
        keepScroll();
        return;
    }
    if (el.id === 'istighfar-remind') {
        const bridge = smartBridge();
        if (el.checked && bridge && await bridge.notificationPermission(true) !== 'granted') { toast(t('needNotifications')); el.checked = false; return; }
        await commit({ ...state, istighfarReminder: el.checked });
        try { await syncIstighfar(); if (el.checked) toast(t('istighfarRemindOn')); } catch { toast(t('reminderSyncFailed')); }
    }
    if (el.id === 'before-enabled') {
        const bridge = smartBridge();
        if (el.checked && bridge && await bridge.notificationPermission(true) !== 'granted') { toast(t('needNotifications')); el.checked = false; return; }
        await commit({ ...state, athan: { ...state.athan, before: { ...state.athan.before, enabled: el.checked } } });
        await syncSmart();
        if (el.checked) toast(t('beforeOn').replace('{n}', num(state.athan.before.minutes)));
    }
    if (el.id === 'athan-away') {
        const bridge = smartBridge();
        // Home entry and exit need location set to Always; ask once here, and show what is missing if it is not given.
        if (el.checked && bridge && platform() === 'ios' && smartStatus?.location !== 'always') smartStatus = await bridge.requestAlways().catch(() => smartStatus);
        await commit({ ...state, athan: { ...state.athan, awayChime: el.checked } });
        await syncSmart();
    }
    if (el.id === 'athan-enabled') {
        const bridge = smartBridge();
        if (el.checked && bridge && await bridge.notificationPermission(true) !== 'granted') { toast(t('needNotifications')); el.checked = false; return; }
        await commit({ ...state, athan: { ...state.athan, enabled: el.checked } });
        await syncSmart();
    }
    if (el.id === 'recite-surah') {
        reciteSurah = Number(el.value);
        reciteAyah = 1;
        stopAudio();
    }
    if (el.id === 'recite-ayah') {
        reciteAyah = Number(el.value);
        stopAudio();
    }
    render();
}
catch {
    toast(t('storageError'));
} });
document.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async (e) => { const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file)
    return; try {
    if (file.size > 5000000)
        throw new Error('Backup too large');
    const restored = validateState(JSON.parse(await file.text()));
    if (await confirmAction(t('importPrompt'))) {
        await commit({ ...restored, reminder: null });
        if (isNative())
            await setReminder(null);
        await navigate('today');
        toast(t('savedToast'));
    }
}
catch {
    toast(t('error'));
}
finally {
    input.value = '';
} });
window.addEventListener('ayahflow:audio', e => { const detail = (e as CustomEvent<{
    status: string;
    url: string;
}>).detail; audioState = detail.status; ownAudio = detail.url.startsWith('blob:'); if (detail.status === 'playing' && previewing && detail.url === previewUrl && view === 'prayer') { const y = window.scrollY; render(); window.scrollTo(0, y); } if (['stopped', 'error'].includes(detail.status) && previewing && detail.url === previewUrl) { previewing = null; if (view === 'prayer') { const y = window.scrollY; render(); window.scrollTo(0, y); } } if (detail.status === 'error')
    toast(t('audioError')); document.body.classList.toggle('audio-playing', detail.status === 'playing'); const banner = document.querySelector<HTMLElement>('#audio-banner'); if (banner) {
    banner.hidden = ['stopped', 'error'].includes(detail.status);
    const strong = banner.querySelector('strong');
    if (strong)
        strong.textContent = bannerTitle();
    const sub = banner.querySelector('p');
    if (sub)
        sub.textContent = bannerSub();
} });
window.addEventListener('ayahflow:record-limit', () => void finishRecording());
window.addEventListener('ayahflow:record-error', () => { void finishRecording(); toast(t('micError')); });
function background(): void { void flushCounts(); void flushTasbih(); stopAudio(); if (recordingActive())
    void finishRecording(); if (followingActive()) {
    void stopFollowing();
    followOff();
    render();
} }
document.addEventListener('visibilitychange', () => { if (document.hidden)
    background();
else
    { void syncSmart().then(() => { if (alarmInfo?.checkWaiting && view !== 'wake') { void navigate('wake'); return; } if (['reminders', 'adhkar', 'today'].includes(view)) render(); }); void refreshSteps(true); } });
window.addEventListener('pagehide', background);
window.addEventListener('ayahflow:background', background);
window.addEventListener('ayahflow:back', () => void navigate('today'));
window.addEventListener('popstate', () => { const target = location.hash.slice(1) as View; void navigate(Object.hasOwn(views, target) ? target : 'today', false); });
async function boot(): Promise<void> { try {
    await initializeBridge();
    state = await loadState();
    readerSurah = state.readPosition.surah;
    try {
        savedClips = await listRecordings();
    }
    catch {
        toast(t('storageError'));
    }
    const route = location.hash.slice(1) as View;
    view = Object.hasOwn(views, route) ? route : 'today';
    if (view === 'session' && !state.session)
        view = 'today';
    render();
    onDeepLink(url => { if (/^ayahflow:\/\/prayer\/?$/.test(url)) { prayerTab = 'times'; void navigate('prayer'); return; } if (/^ayahflow:\/\/wake\/?$/.test(url)) { void navigate('wake'); return; } const recited = /^(ayahflow:\/\/moment\/[a-z_+]+)\/?\?recited=1$/.exec(url); if (recited) { const rm = parseMomentUrl(recited[1]!); if (rm.length) { momentIds = rm; void recitedFromNotification(rm).then(() => navigate('moment')); } return; } const salahLink = /^ayahflow:\/\/(salah|tasbih)\/(fajr|dhuhr|asr|maghrib|isha)\/?$/.exec(url); if (salahLink) { if (salahLink[1] === 'tasbih') { tasbihPrayer = salahLink[2] as PrayerName; tasbihDay = salahDay(state); void navigate('tasbih'); } else { prayerTab = 'today'; void navigate('prayer'); } return; } if (/^ayahflow:\/\/(home|moment-ayah)\/?$/.test(url)) { void navigate('today'); return; } if (/^ayahflow:\/\/steps\/?$/.test(url)) { void navigate('steps'); return; } if (/^ayahflow:\/\/adhkar\/?$/.test(url)) { void navigate('adhkar'); return; } if (/^ayahflow:\/\/rotation\/?$/.test(url)) { void navigate('rotation'); return; } const ayahLink = /^ayahflow:\/\/ayah\/(\d{1,3}):(\d{1,3})\/?$/.exec(url); if (ayahLink) { const s = Number(ayahLink[1]), n = Number(ayahLink[2]); try { verse(s, n); } catch { return; } readerSurah = s; void commit({ ...state, readPosition: { surah: s, ayah: n } }).then(() => navigate('reader')).then(() => document.querySelector(`#ayah-${n}`)?.scrollIntoView({ block: 'center' })); return; } const counterLink = /^ayahflow:\/\/counter\/([a-z-]+)\/?$/.exec(url); if (counterLink && counterDefs().some(c => c.id === counterLink[1])) { counterId = counterLink[1]!; void navigate('counter'); return; } const ms = parseMomentUrl(url); if (ms.length) { momentIds = ms; void navigate('moment'); } });
    void syncSmart().then(() => { if (view === 'reminders') render(); });
    void refreshSteps(true);
    void voiceManifest().then(m => { voiceAvailable = Boolean(m); if (voiceAvailable && ['reader', 'settings'].includes(view)) render(); });
    if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol) && !isNative())
        void navigator.serviceWorker.register('./sw.js').catch(() => { });
}
catch (error) {
    root.innerHTML = `<div class="app-shell"><main class="main"><h1 class="page-title">AyahFlow</h1><p class="notice">Your saved data or native bridge could not be opened. Nothing has been overwritten. Rebuild the native bridge or restore a valid backup.</p><p class="small muted mt20">${escapeHtml(error instanceof Error ? error.message : 'Storage unavailable')}</p><div class="stack mt20">${actionButton('import', t('import'), 'button secondary full')}${actionButton('reset', t('reset'), 'button danger full')}</div></main></div>`;
} }
void boot();
