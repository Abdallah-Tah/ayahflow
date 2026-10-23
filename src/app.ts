import { SURAH_DATA, LESSONS, chapter, verse, audioUrl, juzOf, QURAN_SOURCE, type RuleId } from './data.js';
import { COUNTERS, counter, counterPosition, MOMENTS, GENERAL_MOMENTS, PRAYER_SETS, entriesFor, quranPassages, sourceUrl, parseMomentUrl, currentMoment, momentUrl, type Moment, type AdhkarEntry, type HadithSource, type SmartEvent, type DayWindows } from './adhkar.js';
import { nativeConfig, timedReminders, windowsFor, sleepWindow, momentDone, momentPreview, mergeDetections, prayerPlace, nextPrayer, athanSchedule, widgetData, timesFor, type SmartStatus, type StepReading, type WidgetDaily } from './smart.js';
import { initialState, validateState, dayKey, streak, planSession, questionFor, applyAnswer, dueItems, weakItems, completedAccuracy, retention, locateGuess, identicalAyahs, ayahWords, recitedWordIndices, surahRecallQueue, sessionRecap, exportable, completeDhikr, completedToday, setCount, countOn, MAX_COUNT, PRAYER_METHODS, PRAYERS, type PrayerName, type PlaceKind, type PrayerMethod, type AppState, type Mode, type Locale, type Theme, type ArabicSize, type ReadingLayout, type QueueItem, type Session, type Question } from './engine.js';
import { tr, formatNumber } from './i18n.js';
import { icon, archArt, ayahMarker, medallion, surahFrame, starEmblem } from './icons.js';
import { initializeBridge, loadState, saveState, listRecordings, putRecording, deleteRecording, clearLocalData, exportProgress, shareAudio, shareText, smartBridge, onDeepLink, scheduleAthan, setWidgetData, nativeAthan, setReminder, isNative, isTemporary, haptic, type Recording } from './storage.js';
import { playAudio, stopAudio, startRecording, stopRecording, recordingActive, type Clip } from './audio.js';
import { ATHAN_RECORDINGS, ONLINE_RECORDINGS, ONLINE_PROVIDER, MAX_IMPORT_BYTES, recording, online, bundledUrl, makeAlert, toBase64, fromBase64 } from './athan.js';
import { voiceManifest, startFollowing, stopFollowing, releaseFollowing, followingActive, type FollowEvent } from './voice.js';
type View = 'today' | 'practice' | 'quran' | 'reader' | 'session' | 'result' | 'tajweed' | 'lesson' | 'recite' | 'progress' | 'settings' | 'adhkar' | 'moment' | 'reminders' | 'prayer' | 'counter' | 'steps';
let state: AppState = initialState();
let view: View = 'today';
let selectedOption: string | null = null;
let revealed = false;
let readerSurah = 112;
let lessonId: RuleId = 'ikhfa';
let reciteSurah = 112;
let reciteAyah = 1;
let libraryFilter = 'all';
let libraryJuz = 0;
let momentIds: Moment[] = ['morning'];
let counterId = COUNTERS[0]!.id;
/** Taps not yet saved (saved together shortly after the last tap); `at` fixes the day they belong to. */
const pendingCounts: Record<string, { n: number; at: number }> = {};
let countTimer: ReturnType<typeof setTimeout> | null = null;
let stepReading: StepReading | null = null;
let stepsAt = 0;
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
function nav(): string { const active = view === 'reader' ? 'quran' : view === 'lesson' || view === 'tajweed' || view === 'recite' ? 'practice' : view === 'moment' || view === 'reminders' || view === 'counter' ? 'adhkar' : view === 'prayer' || view === 'steps' ? 'today' : view; return `<nav class="bottom-nav" aria-label="Main">${[['today', 'home'], ['adhkar', 'tasbih'], ['quran', 'book'], ['practice', 'layers'], ['progress', 'chart']].map(([v, i]) => `<button class="nav-item ${active === v ? 'selected' : ''}" data-action="nav" data-view="${v}" ${active === v ? 'aria-current="page"' : ''}>${ic(i!)}<span>${t(v!)}</span></button>`).join('')}</nav>`; }
function header(): string {
    if (view === 'session' && state.session) {
        const s = state.session;
        return `<header class="app-header">${actionButton('pause', ic('close'), 'icon-button', `aria-label="${t('pause')}"`)}<span class="header-detail">${t('question')} ${num(s.index + 1)} ${t('of')} ${num(s.queue.length)}</span><span class="top-meta">${ic('leaf', 16)} ${num(state.xp)}</span></header>`;
    }
    if (['reader', 'lesson', 'recite', 'tajweed', 'settings', 'moment', 'reminders', 'prayer', 'counter', 'steps'].includes(view))
        return `<header class="app-header">${backButton()}<span class="header-wordmark">Ayah<span class="gold">Flow</span></span><span style="width:44px"></span></header>`;
    return `<header class="app-header"><button class="brand" data-action="nav" data-view="today" aria-label="AyahFlow ${t('today')}"><img src="./assets/icon.svg" alt=""><span>Ayah<span>Flow</span></span></button><div class="row gap8"><span class="top-meta">${ic('leaf', 15)} ${num(streak(state.days))}</span><button class="icon-button" data-action="nav" data-view="settings" aria-label="${t('settings')}">${ic('gear', 21)}</button></div></header>`;
}
function weekMarkup(): string { const today = new Date(); const monday = new Date(today); const day = monday.getDay(); monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1)); return `<div class="week-days">${Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); const key = dayKey(d.getTime()); const active = !!state.days[key]; return `<div class="day-item"><span class="day-dot ${active ? 'done' : ''} ${key === dayKey() ? 'current' : ''}" aria-label="${escapeHtml(d.toLocaleDateString(state.locale))}: ${num(state.days[key] ?? 0)}">${active ? ic('check', 13) : ''}</span><span>${escapeHtml(d.toLocaleDateString(state.locale, { weekday: 'narrow' }))}</span></div>`; }).join('')}</div>`; }
function homeView(): string {
    const due = dueItems(state).length;
    const estimated = planSession(state, 'mixed', Date.now(), 2026);
    const newCount = estimated.filter(v => v.reason === 'new').length;
    return `${dateLine()}<section class="hero"><p class="eyebrow">${t('personalPlan')}</p><h1>${t('greeting')}<br><em>${t('heroLine')}</em></h1><p>${t('heroSub')}</p>${archArt()}</section>
<section class="today-card"><div class="row between"><div class="row"><span class="round-icon">${ic('sun', 24)}</span><h2>${t('daily')}</h2></div><span class="gold">${ic('spark', 18)}</span></div><p class="description">${t('adaptive')}</p><div class="plan-tags"><span class="pill">${ic('clock', 13)} ${num(state.goal)} ${t('minutes')} · ${t('estimated')}</span><span class="pill">${num(due)} ${t('due')}</span><span class="pill">${num(newCount)} ${t('newCards')}</span></div>${primary(state.session ? 'resume' : 'daily', state.session ? t('resume') : t('start'))}</section>${prayerDay()}${nowCard()}${dailyPulse()}
<section class="section"><div class="row between"><h2 class="section-title">${t('yourPath')}</h2>${actionButton('nav', t('all') + ' ' + ic('chevron', 13), 'text-button', 'data-view="practice"')}</div><div class="feature-grid"><button class="feature-card" data-action="start-mode" data-mode="next">${ic('book', 25)}<h3>${t('memorize')}</h3><p>${t('memorizeSub')}</p></button><button class="feature-card" data-action="nav" data-view="tajweed">${ic('wave', 25)}<h3>${t('tajweed')}</h3><p>${t('tajweedSub')}</p></button></div><button class="feature-wide row" data-action="nav" data-view="recite"><span class="gold">${ic('mic', 25)}</span><span class="grow"><h3>${t('recite')}</h3><p>${t('reciteSub')}</p></span><span class="gold arrow-icon">${ic('chevron', 17)}</span></button><button class="feature-wide row" data-action="start-mode" data-mode="locate"><span class="gold">${ic('pin', 25)}</span><span class="grow"><h3>${t('locate')}</h3><p>${t('locateDesc')}</p></span>${chevronEnd()}</button></section>
<section class="section week-card"><div class="row between" style="margin-bottom:0"><div><span class="small">${num(streak(state.days))} ${t('dayStreak')}</span><p class="tiny muted">${t('week')}</p></div><div class="small gold">${num(state.xp)} <span class="tiny">${t('practicePoints')}</span></div></div>${weekMarkup()}</section><p class="gentle">${t('gentle')}</p>`;
}
function practiceView(): string { return `<p class="eyebrow mt12">${t('practice')}</p><h1 class="page-title">${t('choosePractice')}<br><span class="gold">${t('oneStep')}</span></h1><p class="page-sub">${t('rangeNote')}</p><div class="stack">${(['next', 'previous', 'listen', 'recall', 'locate'] as const).map((m, i) => `<button class="mode-card" data-action="start-mode" data-mode="${m}"><span class="round-icon">${ic(['book', 'loop', 'headphones', 'eye', 'pin'][i]!, 21)}</span><span class="grow"><h3>${t(m)}</h3><p>${t(m + 'Desc')}</p></span><span class="muted arrow-icon">${ic('chevron', 16)}</span></button>`).join('')}</div>${prayerSection()}<section class="section"><div class="row between"><h2 class="section-title">${t('range')}</h2><span class="pill">${num(state.selectedSurahs.length)} ${t('selectedSurahsCount')}</span></div><div class="preset-row">${(['short', 'juz30', 'prayer'] as const).map(p => `<button class="range-chip" data-action="range-preset" data-preset="${p}">${t(p === 'short' ? 'presetShort' : p === 'juz30' ? 'presetJuz30' : 'presetPrayer')}</button>`).join('')}</div><div class="chip-wrap mt12">${state.selectedSurahs.map(id => chapter(id)).map(x => `<button class="range-chip selected" data-action="range" data-surah="${x.id}" aria-pressed="true" aria-label="${t('removePlace')} ${escapeHtml(x.name)}"><span>${state.locale === 'ar' ? x.ar : escapeHtml(x.name)}</span>${ic('close', 13)}</button>`).join('')}</div><label class="select-row mt12">${ic('book', 17)}<select id="range-add" aria-label="${t('addSurah')}"><option value="">${t('addSurah')}</option>${SURAH_DATA.filter(x => !state.selectedSurahs.includes(x.id)).map(x => `<option value="${x.id}">${num(x.id)} · ${escapeHtml(state.locale === 'ar' ? x.ar : x.name)}</option>`).join('')}</select></label></section><section class="section"><button class="feature-wide row" data-action="nav" data-view="tajweed">${ic('wave', 23)}<span class="grow">${t('lessons')}</span>${ic('chevron', 16)}</button></section>`; }
function surahRows(): string { let surahs = SURAH_DATA.filter(s => `${s.name} ${s.en} ${s.ar} ${s.id}`.toLowerCase().includes(libraryQuery.toLowerCase()) && (!libraryJuz || (juzOf(s.id, 1) <= libraryJuz && libraryJuz <= juzOf(s.id, s.count)))); if (libraryFilter === 'bookmarks')
    surahs = surahs.filter(s => state.bookmarks.some(k => k.startsWith(`${s.id}:`))); if (!surahs.length)
    return `<p class="empty">${t(libraryFilter === 'bookmarks' ? 'noBookmarks' : 'noResults')}</p>`; return surahs.map(s => `<button class="surah-row" data-action="read-surah" data-surah="${s.id}"><span class="surah-number">${num(s.id)}</span><span class="grow"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.en)} · ${num(s.count)} ${t('ayahs')} · ${t(s.type)}</p></span><span class="arabic" lang="ar">${s.ar}</span></button>`).join(''); }
function quranView(): string { return `<p class="eyebrow mt12">${t('starter')}</p><h1 class="page-title">${t('readerTitle')}</h1><p class="page-sub">${t('readerSub')}</p><button class="feature-wide row mb16" data-action="read-last"><span class="gold">${ic('bookmark', 23)}</span><span class="grow"><span class="tiny muted">${t('lastRead')}</span><h3>${escapeHtml(chapter(state.readPosition.surah).name)} · ${num(state.readPosition.ayah)}</h3></span>${ic('chevron', 16)}</button><label class="search-box">${ic('search', 18)}<input id="surah-search" placeholder="${t('search')}" aria-label="${t('search')}" value="${escapeHtml(libraryQuery)}"></label><div class="segment"><button data-action="library-filter" data-filter="all" class="${libraryFilter === 'all' ? 'active' : ''}">${t('all')}</button><button data-action="library-filter" data-filter="bookmarks" class="${libraryFilter === 'bookmarks' ? 'active' : ''}">${t('bookmarks')} · ${num(state.bookmarks.length)}</button></div><label class="select-row">${ic('layers', 17)}<select id="juz-filter" aria-label="${t('juz')}"><option value="0">${t('allJuz')}</option>${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${libraryJuz === i + 1 ? 'selected' : ''}>${t('juz')} ${num(i + 1)}</option>`).join('')}</select></label><div id="surah-list">${surahRows()}</div><p class="gentle">${t('offline')} · <a href="${QURAN_SOURCE.url}" target="_blank" rel="noopener noreferrer">${t('quranSource')}</a></p>`; }
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
function readerView(): string {
    const s = chapter(readerSurah);
    const head = `<div class="reader-heading"><p class="eyebrow">${t('surah')} ${num(s.id)} · ${num(s.count)} ${t('ayahs')}</p><div class="cartouche">${surahFrame()}<p class="arabic" lang="ar">${s.ar}</p></div><h1>${escapeHtml(s.name)}</h1><p class="small muted">${escapeHtml(s.en)} · ${t(s.type)}</p>${s.bismillah ? `<p class="arabic basmala" lang="ar" dir="rtl">${escapeHtml(s.bismillah)}</p>` : ''}</div>`;
    const layout = `<div class="segment" role="group" aria-label="${t('layout')}">${(['cards', 'flow'] as const).map(l => `<button data-action="layout" data-layout="${l}" class="${state.readingLayout === l ? 'active' : ''}" aria-pressed="${state.readingLayout === l}">${ic(l === 'cards' ? 'layers' : 'flow', 15)} ${t(l === 'cards' ? 'layoutCards' : 'layoutFlow')}</button>`).join('')}</div>`;
    const recite = s.count <= 15 ? `<button class="feature-wide row mb16" data-action="recite-surah" data-surah="${s.id}"><span class="gold">${ic('eye', 23)}</span><span class="grow"><h3>${t('reciteSurah')}</h3><p>${t('reciteSurahSub')}</p></span>${chevronEnd()}</button>` : '';
    const body = state.readingLayout === 'flow'
        ? `<div class="mushaf-page"><p class="arabic flow-text" lang="ar" dir="rtl">${s.verses.map((text, i) => `<span class="flow-ayah" id="ayah-${i + 1}">${wordSpans(text)}</span> ${marker(i + 1)}`).join(' ')}</p></div>`
        : s.verses.map((text, i) => { const a = i + 1, k = `${s.id}:${a}`, saved = state.bookmarks.includes(k); return `<article class="ayah-card" id="ayah-${a}"><div class="row between"><span class="ayah-meta">${ref(s.id, a)}</span><div class="ayah-tools"><button class="icon-button" data-action="play-verse" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('play')} ${s.id}:${a}">${ic('play')}</button><button class="icon-button ${saved ? 'active' : ''}" data-action="bookmark" data-surah="${s.id}" data-ayah="${a}" aria-label="${t(saved ? 'removeBookmark' : 'bookmark')} ${s.id}:${a}" aria-pressed="${saved}">${ic('bookmark')}</button><button class="icon-button" data-action="record-ayah" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('recite')} ${s.id}:${a}">${ic('mic')}</button><button class="icon-button" data-action="report" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('reportIssue')} ${s.id}:${a}">${ic('flag')}</button></div></div><p class="arabic ayah-text" lang="ar" dir="rtl"><span class="ayah-src">${wordSpans(text)}</span> ${marker(a)}</p><a class="text-link" href="https://quran.com/${s.id}/${a}" target="_blank" rel="noopener noreferrer">${t('translation')} ${ic('arrow', 12)}</a></article>`; }).join('');
    const listen = voiceAvailable && follow.status === 'off' ? `<button class="feature-wide row mb16" data-action="follow"><span class="gold">${ic('mic', 23)}</span><span class="grow"><h3>${t('follow')}</h3><p>${t('followSub')}</p></span><span class="pill gold">${t('experimental')}</span></button>` : '';
    return `${head}${layout}${listen}${recite}<div class="notice mb16">${ic('book', 18)}<p>${t('translation')}</p></div>${body}<p class="gentle"><a href="${s.source}" target="_blank" rel="noopener noreferrer">${t('quranSource')}</a></p>`;
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
function progressView(): string { const accuracy = completedAccuracy(state), cards = Object.values(state.cards), retainedCards = cards.filter(c => retention(c) === 'retained'), weak = weakItems(state); return `<p class="eyebrow mt12">${t('deviceOnly')}</p><h1 class="page-title">${t('progressTitle')}</h1><p class="page-sub">${t('progressSub')}</p><div class="progress-cards"><div class="metric"><div class="progress-ring" style="--percent:${accuracy ?? 0}%"><span>${accuracy === null ? '—' : num(accuracy) + '%'}</span></div><div class="grow"><h2 class="section-title">${t('quizAccuracy')}</h2><p class="label">${accuracy === null ? t('notYet') : `${num(state.attempts.filter(a => a.mode !== 'recall').length)} ${t('reviewed')}`}</p></div></div><div class="metric"><p class="value">${num(streak(state.days))}</p><p class="label">${t('dayStreak')}</p></div><div class="metric"><p class="value">${num(retainedCards.length)}</p><p class="label">${t('retained')}</p></div></div><div class="mt20">${miniNotice('retentionNote')}</div><section class="section week-card"><h2 class="section-title">${t('week')}</h2>${weekMarkup()}</section><section class="section"><h2 class="section-title mb16">${t('needsPractice')}</h2><div class="stack">${weak.length ? weak.map(c => `<button class="weak-row" data-action="practice-weak" data-key="${c.key}"><span class="gold">${ic('loop', 22)}</span><span class="grow"><h3>${escapeHtml(chapter(c.surah).name)} · ${ref(c.surah, c.ayah)}</h3><p>${t(c.mode)} · ${num(c.lapses)} ${t('missedChecks')}</p></span>${ic('chevron', 16)}</button>`).join('') : `<p class="empty">${t('noWeakness')}</p>`}</div></section><section class="section"><h2 class="section-title mb16">${t('surahProgress')}</h2>${SURAH_DATA.filter(s => state.selectedSurahs.includes(s.id)).map(s => { const seen = new Set(cards.filter(c => c.surah === s.id).map(c => c.ayah)).size; return `<div class="mini-stats"><div class="row between"><span class="small">${escapeHtml(s.name)}</span><span class="tiny muted">${num(seen)} / ${num(s.count)} ${t('ayahs')}</span></div><div class="bar-track mt12"><span style="width:${seen / s.count * 100}%"></span></div></div>`; }).join('')}</section><section class="section"><div class="mini-stats row between"><span class="small">${t('selfChecks')}</span><span class="gold">${num(state.recallSelfChecks)}</span></div><div class="mini-stats row between"><span class="small">${t('teacherVerified')}</span><span class="tiny muted">${t('unavailable')}</span></div></section>`; }
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
    const link = (x: HadithSource) => `<a href="${sourceUrl(x)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.collection)} ${escapeHtml(x.number)}${ic('link', 11)}</a>`;
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
function adhkarView(): string {
    const on = state.smart.location || state.smart.vehicle || state.smart.timed;
    return `<p class="eyebrow mt12">${t('adhkar')}</p><h1 class="page-title">${t('adhkarTitle')}</h1><p class="page-sub">${t('adhkarSub')}</p>${nowCard()}<section class="section"><h2 class="section-title mb16">${t('counters')}</h2><div class="moment-grid">${COUNTERS.map(counterTile).join('')}</div></section><section class="section"><h2 class="section-title mb16">${t('dailyMoments')}</h2><div class="moment-grid">${DAILY.map(momentTile).join('')}</div></section><section class="section"><h2 class="section-title mb16">${t('outMoments')}</h2><div class="moment-grid">${OUT.map(momentTile).join('')}</div></section><button class="feature-wide row section" data-action="nav" data-view="reminders"><span class="gold">${ic('radar', 24)}</span><span class="grow"><h3>${t('autoReminders')}</h3><p>${on ? `${[state.smart.location && t('locationReminders'), state.smart.vehicle && t('vehicleReminders'), state.smart.timed && t('timedReminders')].filter(Boolean).join(' · ')}` : t('autoSub')}</p></span>${chevronEnd()}</button><p class="gentle">${t('adhkarReview')}</p>`;
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
    const places = (['home', 'work', 'mosque'] as PlaceKind[]).map(k => { const p = state.places[k]; return `<div class="place-row"><span class="round-icon">${ic(k === 'home' ? 'home' : k === 'work' ? 'briefcase' : 'mosque', 20)}</span><div class="grow"><strong>${t('place_' + k)}</strong><p class="tiny muted">${p ? `${t('radius')} · ${num(p.radius)} m` : t('notSet')}</p>${p ? `<div class="segment compact mt12" role="group" aria-label="${t('radius')}">${[100, 150, 200, 300, 500].map(r => `<button data-action="place-radius" data-place="${k}" data-radius="${r}" class="${p.radius === r ? 'active' : ''}">${num(r)} m</button>`).join('')}</div>` : ''}</div><div class="place-actions">${actionButton('place-set', `${ic('pin', 15)} ${t(p ? 'updateHere' : 'setHere')}`, 'button subtle', `data-place="${k}"`)}${p ? actionButton('place-remove', t('removePlace'), 'text-button danger-text', `data-place="${k}"`) : ''}</div></div>`; }).join('');
    const toggle = (id: string, on: boolean, label: string, note: string) => `<label class="setting-row"><span><strong>${label}</strong><p>${note}</p></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${label}"></label>`;
    const timed = state.smart.timed ? `<div class="sub-settings">${prayerPlace(state) ? '' : `<p class="tiny warning-text mb16">${t('timedNoPlace')}</p>`}<label class="select-row">${ic('clock', 16)}<span class="grow small">${t('sleepTime')}</span><input id="smart-sleep" type="time" value="${state.smart.sleepTime ?? ''}" aria-label="${t('sleepTime')}"></label></div>` : '';
    const prayer = `<section class="settings-section"><h2>${t('windowSpan')}</h2><div class="segment" role="group">${(['broad', 'narrow'] as const).map(x => `<button data-action="smart-span" data-span="${x}" class="${state.smart.span === x ? 'active' : ''}">${t(x === 'broad' ? 'spanBroad' : 'spanNarrow')}</button>`).join('')}</div><p class="tiny muted">${t('spanNote')}</p><label class="select-row mt12">${ic('globe', 16)}<span class="grow small">${t('prayerMethod')}</span><select id="smart-method" aria-label="${t('prayerMethod')}">${PRAYER_METHODS.map(m => `<option value="${m}" ${state.smart.method === m ? 'selected' : ''}>${m.replace(/([a-z])([A-Z])/g, '$1 $2')}</option>`).join('')}</select></label>${toggle('smart-hanafi', state.smart.hanafi, t('hanafiAsr'), '')}</section>`;
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
    return `${head}${needAlwaysCard}${chips}${diag}<section class="settings-section"><h2>${t('places')}</h2><p class="small muted mb16">${t('placesNote')}</p><div class="stack">${places}</div></section><section class="settings-section">${toggle('smart-location', state.smart.location, t('locationReminders'), t('locationRemindersNote'))}${toggle('smart-vehicle', state.smart.vehicle, t('vehicleReminders'), t('vehicleRemindersNote'))}${toggle('smart-timed', state.smart.timed, t('timedReminders'), t('timedRemindersNote'))}${timed}</section>${prayer}${which}${tests}${det}${shortcuts}${limits}`;
}
const copyFor = (m: Moment) => ({ title: t('m_' + m), body: momentPreview(m) ?? t('generalReminder') });
/** Pushes settings to the native engines, refreshes timed reminders and imports what was detected while closed. */
async function syncSmart(): Promise<void> {
    const bridge = smartBridge();
    if (!bridge) return;
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
        notificationState = await bridge.notificationPermission(false);
        if (notificationState === 'granted') {
            await bridge.scheduleTimed(timedReminders(state, copyFor));
            await scheduleAthan(athanSchedule(state, (p, at) => ({ title: `${t('p_' + p)} · ${clock(at)}`, body: t('athanBody') })));
        }
        await pushWidget();
    }
    catch (e) { console.error('AyahFlow reminders sync failed', e instanceof Error ? e.message : e); if (state.smart.location || state.smart.vehicle || state.smart.timed || state.athan.enabled) toast(t('reminderSyncFailed')); }
}
/** Today's counts, adhkar progress and the latest step reading (only while the step tracker is on) for the widget. */
function widgetDaily(): WidgetDaily {
    const today = stepReading?.days.find(x => x.day === dayKey())?.steps;
    return {
        day: dayKey(),
        counters: COUNTERS.map(c => ({ id: c.id, label: c.title[state.locale], n: count(c.id), total: c.total, atLeast: !!c.atLeast, perPrayer: !!c.perPrayer })),
        adhkar: (['morning', 'evening', 'sleep'] as const).map(m => { const [done, total] = momentProgress(m); return { key: m, label: t('m_' + m), done, total }; }),
        steps: state.health.steps && today !== undefined ? { today, goal: state.health.stepGoal, at: stepsAt } : null,
    };
}
async function pushWidget(): Promise<void> {
    if (!isNative()) return;
    await setWidgetData(widgetData(state, t, Date.now(), { athan: state.athan.enabled ? (state.athan.sound === 'chime' ? t('soundChime') : reciterName(state.athan.reciter)) : t('athanOffShort'), athanOn: state.athan.enabled ? '1' : '0' }, widgetDaily())).catch(() => { });
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
function bannerSub(): string { return previewing ? reciterName(previewing) : t(ownAudio ? 'privateRecording' : 'audioProvider'); }
const reciterName = (id: string) => id === 'custom' ? state.athan.custom?.name ?? t('kindOwn') : id.startsWith('online-') ? online(id.slice(7))?.name[state.locale] ?? id : recording(id)?.name[state.locale] ?? id;
/** Download in progress (online id), so its button shows progress. */
let downloadingAthan: string | null = null;
/** Today's prayers on one line at their real times, with "now" and the next prayer called out. */
function prayerDay(): string {
    const now = Date.now(), times = timesFor(state, new Date(now)), next = nextPrayer(state, now);
    if (!times || !next) return `<button class="prayer-day empty" data-action="nav" data-view="reminders"><span class="now-orb">${ic('mosque', 22)}</span><span class="grow small">${t('setupPrayer')}</span>${chevronEnd()}</button>`;
    // Evenly spaced stops (one per label column, centres at 10/30/50/70/90 %); "now" sits proportionally inside its gap.
    const stops = PRAYERS.map(p => times[p]);
    const pos = (at: number) => { if (at <= stops[0]!) return 10; if (at >= stops[4]!) return 90; const i = stops.findIndex((x, k) => at >= x && at < stops[k + 1]!); return 10 + 20 * (i + (at - stops[i]!) / (stops[i + 1]! - stops[i]!)); };
    const status = state.athan.enabled ? `${ic('bell', 13)} ${escapeHtml(state.athan.sound === 'chime' ? t('soundChime') : reciterName(next.prayer === 'fajr' ? state.athan.fajrReciter : state.athan.reciter))}` : `${ic('bell', 13)} ${t('athanOffShort')}`;
    return `<button class="prayer-day" data-action="nav" data-view="prayer"><div class="row between"><span class="eyebrow">${t('nextPrayer')}</span><span class="athan-chip ${state.athan.enabled ? 'on' : ''}">${status}</span></div><div class="prayer-day-main"><span class="grow"><strong class="prayer-day-name">${t('p_' + next.prayer)}</strong><span class="small gold" data-countdown="${next.at}">${countdown(next.at, now)}</span></span><span class="prayer-day-time">${clock(next.at)}</span></div><div class="day-line" aria-hidden="true"><span class="day-fill" style="width:${pos(now) - 10}%"></span>${PRAYERS.map(p => `<span class="day-mark ${times[p] <= now ? 'past' : ''} ${next.at === times[p] ? 'next' : ''}" style="inset-inline-start:${pos(times[p])}%"></span>`).join('')}<span class="day-now" style="inset-inline-start:${pos(now)}%"></span></div><div class="day-labels">${PRAYERS.map(p => `<span class="${next.at === times[p] ? 'next' : ''} ${times[p] <= now ? 'past' : ''}"><b>${t('p_' + p)}</b>${clock(times[p])}</span>`).join('')}</div></button>`;
}
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
function prayerView(): string {
    const now = Date.now(), times = timesFor(state, new Date(now)), next = nextPrayer(state, now);
    const head = `<p class="eyebrow mt12">${t('athan')}</p><h1 class="page-title">${t('prayerTimes')}</h1><p class="page-sub">${t('prayerTimesSub')}</p>`;
    if (!times) return `${head}<div class="notice warning">${ic('pin', 18)}<p>${t('noPlacePrayer')}</p></div><div class="mt20">${primary('nav', t('savePlaces'), 'data-view="reminders"')}</div>`;
    const rows: [string, number][] = [['fajr', times.fajr], ['sunrise', times.sunrise], ['dhuhr', times.dhuhr], ['asr', times.asr], ['maghrib', times.maghrib], ['isha', times.isha]];
    const list = rows.map(([k, at]) => { const isNext = !!next && next.prayer === k && next.at === at, prayer = (PRAYERS as readonly string[]).includes(k); return `<div class="prayer-row ${isNext ? 'next' : ''} ${at < now ? 'past' : ''}"><span class="grow"><strong>${t('p_' + k)}</strong>${isNext ? `<span class="tiny gold" data-countdown="${at}">${countdown(at, now)}</span>` : ''}</span><span class="prayer-time">${clock(at)}</span>${prayer ? `<button class="icon-button ${state.athan.enabled && state.athan.prayers[k as PrayerName] ? 'active' : ''}" data-action="athan-prayer" data-prayer="${k}" aria-pressed="${state.athan.prayers[k as PrayerName]}" aria-label="${t('athan')} · ${t('p_' + k)}" ${state.athan.enabled ? '' : 'disabled'}>${ic('bell', 17)}</button>` : '<span class="bell-spacer"></span>'}</div>`; }).join('');
    const tomorrow = next && dayKey(next.at) !== dayKey(now) ? `<p class="tiny muted mt12">${t('nextPrayer')}: ${t('p_' + next.prayer)} · ${clock(next.at)}</p>` : '';
    const reciters = [...ATHAN_RECORDINGS.map(r => r.id), ...ONLINE_RECORDINGS.filter(r => !r.fajrOnly && state.athan.downloads.includes(r.id)).map(r => `online-${r.id}`), ...(state.athan.custom ? ['custom'] : [])];
    const fajrChoices = [...reciters, ...ONLINE_RECORDINGS.filter(r => r.fajrOnly && state.athan.downloads.includes(r.id)).map(r => `online-${r.id}`)];
    const own = `<div class="own-athan"><label class="button secondary full" for="athan-file">${ic('upload', 16)} ${t(state.athan.custom ? 'replaceOwn' : 'useOwn')}</label><input type="file" id="athan-file" accept="audio/*" hidden>${state.athan.custom ? actionButton('athan-remove-own', t('removeOwn'), 'text-button danger-text') : ''}<p class="tiny muted mt12">${t('ownNote')}</p></div>`;
    const athan = `<section class="settings-section"><label class="setting-row"><span><strong>${t('athanToggle')}</strong><p>${t('athanToggleNote')}</p></span><input type="checkbox" id="athan-enabled" ${state.athan.enabled ? 'checked' : ''} aria-label="${t('athanToggle')}"></label><h2 class="mt20">${t('athanSound')}</h2><div class="segment" role="group">${(['athan', 'chime'] as const).map(x => `<button data-action="athan-sound" data-sound="${x}" class="${state.athan.sound === x ? 'active' : ''}">${t(x === 'athan' ? 'soundAthan' : 'soundChime')}</button>`).join('')}</div></section><section class="settings-section"><h2>${t('reciter')}</h2><p class="picker-label">${t('onDevice')}</p><div class="stack">${[...ATHAN_RECORDINGS.map(r => r.id), ...(state.athan.custom ? ['custom'] : [])].map(reciterCard).join('')}</div>${own}<p class="picker-label mt20">${t('moreReciters')}</p><p class="tiny muted mb16">${t('moreRecitersNote')} <a href="${ONLINE_PROVIDER.page}" target="_blank" rel="noopener noreferrer">${escapeHtml(ONLINE_PROVIDER.provider)}${ic('link', 11)}</a>${smartBridge() ? '' : `<br>${t('appOnlyDownload')}`}</p><div class="stack">${ONLINE_RECORDINGS.map(onlineCard).join('')}</div><label class="select-row mt20">${ic('sun', 16)}<span class="grow small">${t('fajrReciter')}</span><select id="athan-fajr" aria-label="${t('fajrReciter')}">${fajrChoices.map(id => `<option value="${id}" ${state.athan.fajrReciter === id ? 'selected' : ''}>${escapeHtml(reciterName(id))}</option>`).join('')}</select></label><div class="notice warning mt12">${ic('info', 18)}<p>${t('reciterReview')}</p></div></section>`;
    return `${head}<div class="prayer-list">${list}</div>${tomorrow}${athan}<section class="settings-section">${smartBridge() ? `<div class="notice">${ic('info', 18)}<p>${t('widgetTip')}</p></div>` : ''}<button class="feature-wide row" data-action="nav" data-view="reminders"><span class="gold">${ic('globe', 22)}</span><span class="grow"><h3>${t('calcSettings')}</h3><p>${escapeHtml(state.smart.method.replace(/([a-z])([A-Z])/g, '$1 $2'))}${state.smart.hanafi ? ` · ${t('hanafiAsr')}` : ''}</p></span>${chevronEnd()}</button></section>`;
}
/** Keeps countdowns current while a page shows them, without re-rendering. */
setInterval(() => { document.querySelectorAll<HTMLElement>('[data-countdown]').forEach(el => { el.textContent = countdown(Number(el.dataset.countdown)); }); }, 30000);
// ---- Counters and steps ------------------------------------------------------------------------
/** Today's count for a counter, including taps not saved yet. */
function count(id: string): number { const p = pendingCounts[id]; return p && dayKey(p.at) === dayKey() ? p.n : countOn(state, id); }
const target = (c: typeof COUNTERS[number]) => c.atLeast ? `${num(c.total)}+` : num(c.total);
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
}
function ring(p: number, inner: string, cls = ''): string { return `<span class="ring ${cls}" style="--p:${Math.max(0, Math.min(100, p))}%">${inner}</span>`; }
function counterTile(c: typeof COUNTERS[number]): string {
    const n = count(c.id), done = !c.perPrayer && n >= c.total;
    return `<button class="moment-tile ${done ? 'finished' : ''}" data-action="counter" data-counter="${c.id}"><span class="gold">${ic('tasbih', 22)}</span><span class="moment-name">${escapeHtml(c.title[state.locale])}</span><span class="tiny muted">${c.perPrayer ? `${num(Math.floor(n / c.total))} ${t('rounds')}` : `${num(n)} / ${target(c)}`}</span></button>`;
}
/** A ring of tasbih beads: one per count up to 33; longer targets fill the same beads proportionally. */
function beads(done: number, total: number): string {
    const n = Math.min(total, 33), on = total <= 33 ? done : Math.floor(done / total * n), step = 360 / Math.max(n, 1);
    return `<svg class="beads" viewBox="0 0 200 200" aria-hidden="true">${Array.from({ length: n }, (_, i) => { const a = (i * step - 90) * Math.PI / 180; return `<circle class="bead ${i < on ? 'on' : i === on ? 'current' : ''}" cx="${(100 + 88 * Math.cos(a)).toFixed(2)}" cy="${(100 + 88 * Math.sin(a)).toFixed(2)}" r="${n > 20 ? 5 : 6.5}"/>`; }).join('')}</svg>`;
}
/** Istighfar heart: dark, filling with red from the bottom as the count nears the target. A visual only. */
function heart(p: number): string {
    const h = 92 * Math.max(0, Math.min(1, p));
    return `<svg class="heart ${p >= 1 ? 'full' : ''}" viewBox="0 0 100 92" aria-hidden="true"><defs><clipPath id="heart-fill"><rect x="0" y="${(92 - h).toFixed(2)}" width="100" height="${h.toFixed(2)}"/></clipPath><linearGradient id="heart-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2475b"/><stop offset="1" stop-color="#8e1a2b"/></linearGradient></defs><path class="heart-base" d="${HEART}"/><path d="${HEART}" fill="url(#heart-red)" clip-path="url(#heart-fill)"/></svg>`;
}
const HEART = 'M50 88C22 68 4 52 4 30 4 15 15 4 29 4c9 0 16 5 21 12C55 9 62 4 71 4c14 0 25 11 25 26 0 22-18 38-46 58Z';
/** This counter's last 7 days, from the counts the user saved (no estimates). */
function counterWeek(c: typeof COUNTERS[number]): string {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d.getTime()); return { k, label: d.toLocaleDateString(state.locale, { weekday: 'narrow' }), n: k === dayKey() ? count(c.id) : countOn(state, c.id, k) }; });
    const top = Math.max(c.total, ...days.map(d => d.n));
    return `<section class="section"><h2 class="section-title mb16">${t('stepsWeek')}</h2><div class="step-bars short">${days.map(d => `<div class="step-bar ${d.k === dayKey() ? 'current' : ''} ${!c.perPrayer && d.n >= c.total ? 'met' : ''}"><span class="tiny muted">${d.n ? num(d.n) : '—'}</span><i style="height:${d.n / top * 72}%"></i><span class="tiny">${escapeHtml(d.label)}</span></div>`).join('')}</div></section>`;
}
function counterView(): string {
    const c = counter(counterId), n = count(c.id), pos = counterPosition(c, n), step = c.steps[pos.step]!;
    const roundDone = n > 0 && pos.inRound === 0, long = step.text.length > 40;
    const chips = `<div class="chip-wrap">${COUNTERS.map(x => `<button class="range-chip ${x.id === c.id ? 'selected' : ''}" data-action="counter" data-counter="${x.id}" aria-pressed="${x.id === c.id}">${escapeHtml(x.title[state.locale])}</button>`).join('')}</div>`;
    const list = c.steps.length > 1 ? `<ol class="count-steps">${c.steps.map((x, i) => `<li class="${i < pos.step || roundDone ? 'done' : i === pos.step ? 'current' : ''}"><span class="arabic" lang="ar" dir="rtl">${escapeHtml(x.text)}</span><span class="pill">×${num(x.count)}</span></li>`).join('')}</ol>` : '';
    const wording = c.steps.filter(x => x.source.ref !== c.source.ref).map(x => x.source).filter((x, i, a) => a.findIndex(y => y.ref === x.ref) === i);
    return `<p class="eyebrow mt12">${t('counters')}</p><h1 class="page-title">${escapeHtml(c.title[state.locale])}</h1>${chips}
<section class="tap-zone"><div class="count-meta"><span class="pill ${roundDone ? 'success' : 'gold'}">${roundDone ? `${ic('check', 12)} ${t('roundDone')}` : c.steps.length > 1 ? `${num(pos.step + 1)} / ${num(c.steps.length)}` : `${t('round')} ${num(pos.rounds + 1)}`}</span><span class="tiny muted" aria-live="polite">${t('todayCount')} <strong class="gold">${num(n)}</strong>${pos.rounds ? ` · ${num(pos.rounds)} ${t('rounds')}` : ''}</span></div>
<button class="tap-counter" data-action="count-tap" aria-label="${t('tapToCount')}: ${num(pos.inStep)} / ${num(step.count)}">${beads(pos.inStep, step.count)}${c.id.startsWith('istighfar') ? heart(roundDone ? 1 : pos.inRound / c.total) : ''}<span class="tap-inner"><span class="arabic tap-phrase ${long ? 'long' : ''}" lang="ar" dir="rtl">${escapeHtml(step.text)}</span><span class="tap-number">${num(pos.inStep)}</span><small class="tap-of">${t('of')} ${num(step.count)}</small></span></button>
<p class="tiny muted">${t('tapAnywhere')}</p>
<div class="row gap8">${actionButton('count-undo', ic('back', 18), 'icon-button', `aria-label="${t('undo')}" ${n ? '' : 'disabled'}`)}${actionButton('count-reset', ic('loop', 18), 'icon-button', `aria-label="${t('resetCount')}" ${n ? '' : 'disabled'}`)}</div></section>
${counterWeek(c)}
${list}<div class="notice mt20">${ic('info', 18)}<p>${c.perPrayer ? t('perPrayerNote') : `${t('dailyTargetNote')} ${c.atLeast ? t('moreThan') + ' ' : ''}${num(c.total)}`}</p></div>${sourceLine(c.source, c.also)}${wording.length ? `<p class="tiny muted">${t('wordingFrom')}</p>${wording.map(x => sourceLine(x)).join('')}` : ''}<p class="gentle">${t('ownCount')}</p>`;
}
/** Steps per day for the last 7 local days, oldest first (null where the device has no figure). */
function stepDays(): { day: string; label: string; steps: number | null }[] {
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d.getTime()); return { day: k, label: d.toLocaleDateString(state.locale, { weekday: 'narrow' }), steps: stepReading?.days.find(x => x.day === k)?.steps ?? null }; });
}
async function refreshSteps(force = false): Promise<void> {
    const bridge = smartBridge();
    if (!bridge || !state.health.steps || (!force && Date.now() - stepsAt < 20000)) return;
    stepsAt = Date.now();
    try { stepReading = await bridge.steps(7); } catch { stepReading = null; }
    void pushWidget();
    if (view === 'today' || view === 'steps') { const y = window.scrollY; render(); window.scrollTo(0, y); }
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
    const notice = !isNative() ? miniNotice('stepsWeb') : !state.health.steps ? '' : r?.permission === 'denied' ? `<div class="notice warning">${ic('info', 18)}<p>${t('stepsDenied')}</p></div>${actionButton('open-settings', t('openSettings'), 'button secondary full')}` : r && !r.available ? miniNotice('stepsUnavailable') : '';
    const bars = `<div class="step-bars" role="img" aria-label="${t('stepsWeek')}">${days.map(d => `<div class="step-bar ${d.day === dayKey() ? 'current' : ''} ${(d.steps ?? 0) >= goal ? 'met' : ''}"><span class="tiny muted">${d.steps === null ? '—' : d.steps >= 1000 ? `${formatNumber(Math.round(d.steps / 100) / 10, state.locale)}k` : num(d.steps)}</span><i style="height:${(d.steps ?? 0) / top * 72}%"></i><span class="tiny">${escapeHtml(d.label)}</span></div>`).join('')}<span class="goal-line" style="bottom:calc(${goal / top * 72}% + 21px)"></span></div>`;
    return `<p class="eyebrow mt12">${t('today')}</p><h1 class="page-title">${t('steps')}</h1><p class="page-sub">${t('stepsSub')}</p>${notice}
${state.health.steps ? `<section class="tap-zone">${ring((today ?? 0) / goal * 100, `<span class="tap-number">${today === null ? '—' : num(today)}<small>${t('of')} ${num(goal)}</small></span>`, `big ${(today ?? 0) >= goal ? 'met' : ''}`)}${(today ?? 0) >= goal ? `<span class="pill success">${ic('check', 12)} ${t('goalReached')}</span>` : ''}</section>
<section class="section"><h2 class="section-title mb16">${t('stepsWeek')}</h2>${bars}${r?.approximate ? `<p class="tiny muted mt12">${t('stepsApprox')}</p>` : ''}</section>
<section class="settings-section"><h2>${t('stepsGoal')}</h2><div class="segment">${[5000, 8000, 10000, 12000].map(g => `<button data-action="step-goal" data-goal="${g}" class="${goal === g ? 'active' : ''}" aria-pressed="${goal === g}">${num(g)}</button>`).join('')}</div></section>
${actionButton('steps-disable', t('stepsOff'), 'text-button')}` : isNative() ? primary('steps-enable', t('stepsEnable')) : ''}<p class="gentle">${t('stepsPrivacy')}</p>`;
}
const views: Record<View, () => string> = { today: homeView, practice: practiceView, quran: quranView, reader: readerView, session: sessionView, result: resultView, tajweed: tajweedView, lesson: lessonView, recite: reciteView, progress: progressView, settings: settingsView, adhkar: adhkarView, moment: momentView, reminders: remindersView, prayer: prayerView, counter: counterView, steps: stepsView };
function render(): void { applyTheme(); document.documentElement.lang = state.locale; document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr'; document.body.classList.toggle('reduced-motion', state.reducedMotion); document.body.classList.toggle('audio-playing', audioState === 'playing'); root.innerHTML = `<div class="app-shell">${header()}${isTemporary() ? `<div class="temporary-banner">${ic('info', 13)} ${t('temporary')}</div>` : ''}<main class="main ${view === 'session' ? 'focus-screen' : ''}" id="main" tabindex="-1">${views[view]()}</main>${nav()}<div class="sticky-audio" id="audio-banner" ${audioState === 'stopped' ? 'hidden' : ''}><span class="gold">${ic('wave', 20)}</span><div class="grow"><strong class="small">${bannerTitle()}</strong><p>${bannerSub()}</p></div><button class="icon-button" data-action="stop-audio" aria-label="${t('stopAudio')}">${ic('stop', 18)}</button></div>${followBar()}</div>`; if (view === 'reader') applyFollow(); }
async function navigate(target: View, updateHistory = true): Promise<void> { if (!Object.hasOwn(views, target))
    target = 'today'; if (recordingActive())
    await finishRecording(); if (followingActive() || target !== 'reader') { await stopFollowing(); followOff(); } if (target !== 'reader') releaseFollowing(); stopAudio(); view = target; if (updateHistory && location.href !== 'about:blank' && location.hash !== `#${target}`)
    history.pushState(null, '', `#${target}`); if (target !== 'counter') void flushCounts(); render(); if (target === 'today' || target === 'steps') void refreshSteps(); if (target === 'reminders') void syncSmart().then(() => { if (view === 'reminders') { const y = window.scrollY; render(); window.scrollTo(0, y); } }); window.scrollTo(0, 0); document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }); }
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
            await navigate(view === 'reader' ? 'quran' : view === 'lesson' ? 'tajweed' : view === 'settings' ? 'today' : view === 'moment' || view === 'reminders' ? 'adhkar' : view === 'prayer' ? 'today' : 'practice');
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
        case 'read-surah':
            readerSurah = Number(d.surah);
            await commit({ ...state, readPosition: { surah: readerSurah, ayah: 1 } });
            await navigate('reader');
            break;
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
            void playAudio(audioUrl(Number(d.surah), Number(d.ayah)), Number(d.speed ?? 1), d.loop === 'true').catch(() => { });
            break;
        case 'stop-audio':
            stopAudio();
            break;
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
            if (!COUNTERS.some(c => c.id === d.counter)) return;
            await flushCounts();
            counterId = d.counter!;
            if (view === 'counter') { render(); break; }
            await navigate('counter');
            break;
        case 'count-tap':
        case 'count-undo': {
            const n = Math.max(0, Math.min(MAX_COUNT, count(counterId) + (d.action === 'count-tap' ? 1 : -1)));
            pendingCounts[counterId] = { n, at: Date.now() };
            if (!state.reducedMotion) haptic();
            render();
            document.querySelector<HTMLElement>(`[data-action="${d.action}"]`)?.focus();
            if (countTimer) clearTimeout(countTimer);
            countTimer = setTimeout(() => { void flushCounts().then(() => { if (view === 'counter') render(); }); }, 800);
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
            await refreshSteps(true);
            render();
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
                await commit({ ...state, places: { ...state.places, [kind]: { lat: pos.lat, lng: pos.lng, radius: state.places[kind]?.radius ?? 150 } } });
                toast(t('placeSaved'));
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
            const kind = d.place as PlaceKind, p = state.places[kind];
            if (!p)
                return;
            await commit({ ...state, places: { ...state.places, [kind]: { ...p, radius: Number(d.radius) } } });
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
            const y = window.scrollY;
            await commit({ ...state, readingLayout: d.layout as ReadingLayout });
            render();
            window.scrollTo(0, y);
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
root.addEventListener('change', async (e) => { const el = e.target as HTMLInputElement; if (!['audio-toggle', 'motion-toggle', 'voice-toggle', 'recite-surah', 'recite-ayah', 'juz-filter', 'range-add', 'smart-location', 'smart-vehicle', 'smart-timed', 'smart-hanafi', 'smart-method', 'smart-sleep', 'athan-enabled', 'athan-fajr', 'athan-file'].includes(el.id))
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
function background(): void { void flushCounts(); stopAudio(); if (recordingActive())
    void finishRecording(); if (followingActive()) {
    void stopFollowing();
    followOff();
    render();
} }
document.addEventListener('visibilitychange', () => { if (document.hidden)
    background();
else
    { void syncSmart().then(() => { if (['reminders', 'adhkar', 'today'].includes(view)) render(); }); void refreshSteps(true); } });
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
    onDeepLink(url => { if (/^ayahflow:\/\/prayer\/?$/.test(url)) { void navigate('prayer'); return; } if (/^ayahflow:\/\/steps\/?$/.test(url)) { void navigate('steps'); return; } if (/^ayahflow:\/\/adhkar\/?$/.test(url)) { void navigate('adhkar'); return; } const counterLink = /^ayahflow:\/\/counter\/([a-z-]+)\/?$/.exec(url); if (counterLink && COUNTERS.some(c => c.id === counterLink[1])) { counterId = counterLink[1]!; void navigate('counter'); return; } const ms = parseMomentUrl(url); if (ms.length) { momentIds = ms; void navigate('moment'); } });
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
