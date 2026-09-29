import { SURAH_DATA, LESSONS, chapter, verse, audioUrl, type RuleId } from './data.js';
import { initialState, validateState, dayKey, streak, planSession, questionFor, applyAnswer, dueItems, weakItems, completedAccuracy, retention, type AppState, type Mode, type Locale, type QueueItem, type Session } from './engine.js';
import { tr, formatNumber } from './i18n.js';
import { icon, archArt } from './icons.js';
import { initializeBridge, loadState, saveState, listRecordings, putRecording, deleteRecording, clearLocalData, exportProgress, shareAudio, setReminder, isNative, isTemporary, haptic, type Recording } from './storage.js';
import { playAudio, stopAudio, startRecording, stopRecording, recordingActive, type Clip } from './audio.js';
type View = 'today' | 'practice' | 'quran' | 'reader' | 'session' | 'result' | 'tajweed' | 'lesson' | 'recite' | 'progress' | 'settings';
let state: AppState = initialState();
let view: View = 'today';
let selectedOption: string | null = null;
let revealed = false;
let readerSurah = 112;
let lessonId: RuleId = 'ikhfa';
let reciteSurah = 112;
let reciteAyah = 1;
let libraryFilter = 'all';
let libraryQuery = '';
let savedClips: Recording[] = [];
let unsavedClip: Recording | null = null;
let lastResult: {
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
const t = (key: string) => tr(isTemporary() && key === 'savedToast' ? 'temporarySaved' : isTemporary() && key === 'saveRecording' ? 'keepInSession' : key, state.locale), num = (n: number) => formatNumber(n, state.locale);
const escapeHtml = (text: unknown): string => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ic = (name: string, size = 22) => icon(name, size);
const actionButton = (key: string, label: string, cls = 'button secondary', extra = '') => `<button class="${cls}" data-action="${key}" ${extra}>${label}</button>`;
const primary = (key: string, label: string, extra = '') => actionButton(key, `${label}<span class="arrow-icon">${ic('arrow', 18)}</span>`, 'button primary full', extra);
const backButton = () => `<button class="icon-button" data-action="back" aria-label="${t('back')}"><span class="arrow-icon">${ic('back')}</span></button>`;
const miniNotice = (key: string, ico = 'info') => `<div class="notice">${ic(ico, 18)}<p>${t(key)}</p></div>`;
const ref = (s: number, a: number) => `<bdi>${s}:${a}</bdi>`;
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
function nav(): string { const active = view === 'reader' ? 'quran' : view === 'lesson' || view === 'tajweed' || view === 'recite' ? 'practice' : view; return `<nav class="bottom-nav" aria-label="Main">${[['today', 'home'], ['practice', 'layers'], ['quran', 'book'], ['progress', 'chart']].map(([v, i]) => `<button class="nav-item ${active === v ? 'selected' : ''}" data-action="nav" data-view="${v}" ${active === v ? 'aria-current="page"' : ''}>${ic(i!)}<span>${t(v!)}</span></button>`).join('')}</nav>`; }
function header(): string {
    if (view === 'session' && state.session) {
        const s = state.session;
        return `<header class="app-header">${actionButton('pause', ic('close'), 'icon-button', `aria-label="${t('pause')}"`)}<span class="header-detail">${t('question')} ${num(s.index + 1)} ${t('of')} ${num(s.queue.length)}</span><span class="top-meta">${ic('leaf', 16)} ${num(state.xp)}</span></header>`;
    }
    if (['reader', 'lesson', 'recite', 'tajweed', 'settings'].includes(view))
        return `<header class="app-header">${backButton()}<span class="header-wordmark">Ayah<span class="gold">Flow</span></span><span style="width:44px"></span></header>`;
    return `<header class="app-header"><button class="brand" data-action="nav" data-view="today" aria-label="AyahFlow ${t('today')}"><img src="./assets/icon.svg" alt=""><span>Ayah<span>Flow</span></span></button><div class="row gap8"><span class="top-meta">${ic('leaf', 15)} ${num(streak(state.days))}</span><button class="icon-button" data-action="nav" data-view="settings" aria-label="${t('settings')}">${ic('gear', 21)}</button></div></header>`;
}
function weekMarkup(): string { const today = new Date(); const monday = new Date(today); const day = monday.getDay(); monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1)); return `<div class="week-days">${Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); const key = dayKey(d.getTime()); const active = !!state.days[key]; return `<div class="day-item"><span class="day-dot ${active ? 'done' : ''} ${key === dayKey() ? 'current' : ''}" aria-label="${escapeHtml(d.toLocaleDateString(state.locale))}: ${num(state.days[key] ?? 0)}">${active ? ic('check', 13) : ''}</span><span>${escapeHtml(d.toLocaleDateString(state.locale, { weekday: 'narrow' }))}</span></div>`; }).join('')}</div>`; }
function homeView(): string {
    const due = dueItems(state).length;
    const estimated = planSession(state, 'mixed', Date.now(), 2026);
    const newCount = estimated.filter(v => v.reason === 'new').length;
    return `<section class="hero"><p class="eyebrow">${t('personalPlan')}</p><h1>${t('greeting')}<br><em>${t('heroLine')}</em></h1><p>${t('heroSub')}</p>${archArt()}</section>
<section class="today-card"><div class="row between"><div class="row"><span class="round-icon">${ic('sun', 24)}</span><h2>${t('daily')}</h2></div><span class="gold">${ic('spark', 18)}</span></div><p class="description">${t('adaptive')}</p><div class="plan-tags"><span class="pill">${ic('clock', 13)} ${num(state.goal)} ${t('minutes')} · ${t('estimated')}</span><span class="pill">${num(due)} ${t('due')}</span><span class="pill">${num(newCount)} ${t('newCards')}</span></div>${primary(state.session ? 'resume' : 'daily', state.session ? t('resume') : t('start'))}</section>
<section class="section"><div class="row between"><h2 class="section-title">${t('yourPath')}</h2>${actionButton('nav', t('all') + ' ' + ic('chevron', 13), 'text-button', 'data-view="practice"')}</div><div class="feature-grid"><button class="feature-card" data-action="start-mode" data-mode="next">${ic('book', 25)}<h3>${t('memorize')}</h3><p>${t('memorizeSub')}</p></button><button class="feature-card" data-action="nav" data-view="tajweed">${ic('wave', 25)}<h3>${t('tajweed')}</h3><p>${t('tajweedSub')}</p></button></div><button class="feature-wide row" data-action="nav" data-view="recite"><span class="gold">${ic('mic', 25)}</span><span class="grow"><h3>${t('recite')}</h3><p>${t('reciteSub')}</p></span><span class="gold arrow-icon">${ic('chevron', 17)}</span></button></section>
<section class="section week-card"><div class="row between" style="margin-bottom:0"><div><span class="small">${num(streak(state.days))} ${t('dayStreak')}</span><p class="tiny muted">${t('week')}</p></div><div class="small gold">${num(state.xp)} <span class="tiny">${t('practicePoints')}</span></div></div>${weekMarkup()}</section><p class="gentle">${t('gentle')}</p>`;
}
function practiceView(): string { return `<p class="eyebrow mt12">${t('practice')}</p><h1 class="page-title">${t('choosePractice')}<br><span class="gold">${t('oneStep')}</span></h1><p class="page-sub">${t('rangeNote')}</p><div class="stack">${(['next', 'previous', 'listen', 'recall'] as const).map((m, i) => `<button class="mode-card" data-action="start-mode" data-mode="${m}"><span class="round-icon">${ic(['book', 'loop', 'headphones', 'eye'][i]!, 21)}</span><span class="grow"><h3>${t(m)}</h3><p>${t(m + 'Desc')}</p></span><span class="muted arrow-icon">${ic('chevron', 16)}</span></button>`).join('')}</div><section class="section"><h2 class="section-title mb16">${t('range')}</h2><div class="range-grid">${SURAH_DATA.map(s => `<button class="range-chip ${state.selectedSurahs.includes(s.id) ? 'selected' : ''}" data-action="range" data-surah="${s.id}" aria-pressed="${state.selectedSurahs.includes(s.id)}"><span>${state.locale === 'ar' ? s.ar : escapeHtml(s.name)}</span>${ic(state.selectedSurahs.includes(s.id) ? 'check' : 'book', 14)}</button>`).join('')}</div></section><section class="section"><button class="feature-wide row" data-action="nav" data-view="tajweed">${ic('wave', 23)}<span class="grow">${t('lessons')}</span>${ic('chevron', 16)}</button></section>`; }
function surahRows(): string { let surahs = SURAH_DATA.filter(s => `${s.name} ${s.ar} ${s.id}`.toLowerCase().includes(libraryQuery.toLowerCase())); if (libraryFilter === 'bookmarks')
    surahs = surahs.filter(s => state.bookmarks.some(k => k.startsWith(`${s.id}:`))); if (!surahs.length)
    return `<p class="empty">${t(libraryFilter === 'bookmarks' ? 'noBookmarks' : 'noResults')}</p>`; return surahs.map(s => `<button class="surah-row" data-action="read-surah" data-surah="${s.id}"><span class="surah-number">${num(s.id)}</span><span class="grow"><h3>${escapeHtml(s.name)}</h3><p>${num(s.count)} ${t('ayahs')} · ${t('juz')} ${num(s.juz)} · ${ic('download', 10)}</p></span><span class="arabic" lang="ar">${s.ar}</span></button>`).join(''); }
function quranView(): string { return `<p class="eyebrow mt12">${t('starter')}</p><h1 class="page-title">${t('readerTitle')}</h1><p class="page-sub">${t('readerSub')}</p><button class="feature-wide row mb16" data-action="read-last"><span class="gold">${ic('bookmark', 23)}</span><span class="grow"><span class="tiny muted">${t('lastRead')}</span><h3>${escapeHtml(chapter(state.readPosition.surah).name)} · ${num(state.readPosition.ayah)}</h3></span>${ic('chevron', 16)}</button><label class="search-box">${ic('search', 18)}<input id="surah-search" placeholder="${t('search')}" aria-label="${t('search')}" value="${escapeHtml(libraryQuery)}"></label><div class="segment"><button data-action="library-filter" data-filter="all" class="${libraryFilter === 'all' ? 'active' : ''}">${t('all')}</button><button data-action="library-filter" data-filter="bookmarks" class="${libraryFilter === 'bookmarks' ? 'active' : ''}">${t('bookmarks')} · ${num(state.bookmarks.length)}</button></div><div id="surah-list">${surahRows()}</div><p class="gentle">${t('offline')} · ${t('source')}: Quran.com</p>`; }
function readerView(): string { const s = chapter(readerSurah); return `<div class="reader-heading"><p class="eyebrow">${t('surah')} ${num(s.id)} · ${num(s.count)} ${t('ayahs')}</p><p class="arabic center" lang="ar">${s.ar}</p><h1>${escapeHtml(s.name)}</h1></div><div class="notice mb16">${ic('book', 18)}<p>${t('translation')}</p></div>${s.verses.map((text, i) => { const a = i + 1, k = `${s.id}:${a}`, saved = state.bookmarks.includes(k); return `<article class="ayah-card" id="ayah-${a}"><div class="row between"><span class="ayah-meta">${ref(s.id, a)}</span><div class="ayah-tools"><button class="icon-button" data-action="play-verse" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('play')} ${ref(s.id, a).replace(/<[^>]*>/g, '')}">${ic('play')}</button><button class="icon-button ${saved ? 'active' : ''}" data-action="bookmark" data-surah="${s.id}" data-ayah="${a}" aria-label="${t(saved ? 'removeBookmark' : 'bookmark')} ${s.id}:${a}" aria-pressed="${saved}">${ic('bookmark')}</button><button class="icon-button" data-action="record-ayah" data-surah="${s.id}" data-ayah="${a}" aria-label="${t('recite')} ${s.id}:${a}">${ic('mic')}</button></div></div><p class="arabic ayah-text" lang="ar" dir="rtl">${escapeHtml(text)}</p><a class="text-link" href="https://quran.com/${s.id}/${a}" target="_blank" rel="noopener noreferrer">${t('translation')} ${ic('arrow', 12)}</a></article>`; }).join('')}<p class="gentle">${t('source')}: <a href="${s.source}" target="_blank" rel="noopener noreferrer">Quran.com</a></p>`; }
function currentQuestion() { const s = state.session!; return questionFor(s.queue[s.index]!, s.seed + s.index * 107); }
function sessionView(): string {
    if (!state.session)
        return homeView();
    const s = state.session, q = currentQuestion(), m = q.item.mode;
    const self = m === 'recall';
    const title = m === 'next' ? 'whichNext' : m === 'previous' ? 'whichPrevious' : m === 'listen' ? 'whichSurah' : 'recallPrompt';
    const options = self ? `${!revealed && !s.answered ? `<div class="hidden-card"><span class="gold">${ic('eye', 27)}</span><div class="hidden-lines"><span></span><span></span><span></span></div><p class="small muted">${t('selfAssessed')}</p></div>${primary('reveal', t('reveal'))}` : `<div class="question-ayah"><p class="arabic" lang="ar">${escapeHtml(q.answerText)}</p></div>${!s.answered ? `<div class="self-check">${actionButton('self-answer', t('again'), 'button secondary', 'data-correct="false"')}${actionButton('self-answer', t('remembered'), 'button primary', 'data-correct="true"')}</div>` : ''}`}` : `<div class="options">${q.options.map((o, i) => { const cls = s.answered ? (o.id === q.correctId ? 'answer-correct' : o.id === s.lastChoice ? 'answer-wrong' : '') : (o.id === selectedOption ? 'selected' : ''); return `<button class="option ${cls}" data-action="select-option" data-id="${o.id}" aria-pressed="${selectedOption === o.id}" ${s.answered ? 'disabled' : ''}><span class="option-letter">${'ABCD'[i]}</span><span class="${m === 'listen' ? 'grow' : 'arabic'}" ${m !== 'listen' ? 'lang="ar" dir="rtl"' : ''}>${escapeHtml(o.text)}</span>${s.answered && o.id === q.correctId ? ic('check', 18) : ''}</button>`; }).join('')}</div>${!s.answered ? `<div class="question-actions">${primary('check', t('check'), !selectedOption ? 'disabled' : '')}</div>` : ''}`;
    return `<div class="question-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.queue.length}" aria-valuenow="${s.index + (s.answered ? 1 : 0)}"><span style="width:${(s.index + (s.answered ? 1 : 0)) / s.queue.length * 100}%"></span></div><p class="eyebrow center">${t(q.item.reason === 'due' ? 'reviewDue' : q.item.reason === 'practice' ? 'extraPractice' : 'freshStep')}</p><h1 class="question-title">${t(title)}</h1><p class="question-sub">${m === 'listen' ? t('listenDesc') : `${escapeHtml(q.surahName)} · ${t('ayah')} ${num(q.item.ayah)}`}</p>${!self ? `<div class="play-region">${wave()}<button class="play-circle" data-action="play-verse" data-surah="${q.item.surah}" data-ayah="${q.item.ayah}" aria-label="${t('play')}">${ic('play')}</button>${wave()}</div>${m !== 'listen' ? `<div class="question-ayah"><p class="arabic" lang="ar" dir="rtl">${escapeHtml(q.text)}</p><p class="verse-key">${ref(q.item.surah, q.item.ayah)}</p></div>` : ''}` : ''}${options}${s.answered ? `<section class="feedback ${s.lastCorrect ? '' : 'wrong'}" role="status"><h3>${t(s.lastCorrect ? 'correct' : 'incorrect')}</h3><p>${t(s.lastCorrect ? 'correctSub' : 'incorrectSub')}</p>${m === 'listen' ? `<p class="gold mt12">${escapeHtml(q.surahName)} · ${ref(q.item.surah, q.item.ayah)}</p>` : !self ? `<p class="arabic" lang="ar">${escapeHtml(q.answerText)}</p><p class="tiny">${ref(q.item.surah, q.answerAyah)}</p>` : ''}${self ? `<p class="tiny mt12">${t('selfAssessed')}</p>` : ''}<div class="mt20">${primary('next-question', t(s.index === s.queue.length - 1 ? 'finish' : 'continue'))}</div></section>` : ''}`;
}
function resultView(): string { const r = lastResult; if (!r)
    return homeView(); return `<div class="center"><div class="result-emblem">${ic('leaf', 44)}</div><p class="eyebrow">${t('personalPlan')}</p><h1 class="page-title">${t('sessionDone')}</h1><p class="page-sub">${t('doneSub')}</p><div class="result-grid"><div class="metric"><p class="value">${num(r.count)}</p><p class="label">${t('reviewed')}</p></div><div class="metric"><p class="value">${num(r.correct)}</p><p class="label">${t('correctCount')}</p></div></div>${r.self ? miniNotice('selfAssessed') : ''}<section class="week-card mt20">${weekMarkup()}</section><div class="mt28">${primary('nav', t('backToday'), 'data-view="today"')}</div><p class="gentle">${t('gentle')}</p></div>`; }
function tajweedView(): string { return `<p class="eyebrow mt12">${t('tajweed')}</p><h1 class="page-title">${t('lessons')}</h1><p class="page-sub">${t('lessonsSub')}</p><div class="notice warning mb16">${ic('info', 18)}<p>${t('editorial')}</p></div><div class="stack">${LESSONS.map((l, i) => `<button class="lesson-card" data-action="open-lesson" data-id="${l.id}"><div class="row between"><div class="row"><span class="rule-orb ${l.id}"></span><span class="eyebrow">0${i + 1}</span></div>${state.lessonChecks.includes(l.id) ? `<span class="pill success">${ic('check', 12)} ${t('checked')}</span>` : ''}</div><div class="row between mt12"><h3>${l.name}</h3><span class="arabic" lang="ar">${l.ar}</span></div><p class="small muted mt12">${escapeHtml(chapter(l.surah).name)} · ${ref(l.surah, l.ayah)}</p></button>`).join('')}</div><p class="gentle">${t('lessonKnowledge')}</p>`; }
function lessonView(): string { const l = LESSONS.find(l => l.id === lessonId)!; const text = verse(l.surah, l.ayah); const highlighted = escapeHtml(text).replace(escapeHtml(l.highlight), `<mark>${escapeHtml(l.highlight)}</mark>`); const done = state.lessonChecks.includes(l.id); return `<p class="eyebrow mt12">${t('tajweed')}</p><h1 class="page-title">${l.name} <span class="arabic gold" lang="ar">${l.ar}</span></h1><p class="page-sub">${t('lessonsSub')}</p><div class="lesson-example ${l.id}"><p class="eyebrow center">${t('example')}</p><p class="arabic" lang="ar" dir="rtl">${highlighted}</p><p class="center small muted">${escapeHtml(chapter(l.surah).name)} · ${ref(l.surah, l.ayah)}</p><p class="center tiny muted mt12">${t('focus')}</p></div><div class="control-row"><button class="mini-control" data-action="play-verse" data-surah="${l.surah}" data-ayah="${l.ayah}"><span>${ic('play', 19)}</span>${t('play')}</button><button class="mini-control" data-action="play-verse" data-surah="${l.surah}" data-ayah="${l.ayah}" data-speed="0.85"><span>0.85×</span>0.85×</button><button class="mini-control" data-action="play-verse" data-surah="${l.surah}" data-ayah="${l.ayah}" data-loop="true"><span>${ic('loop', 19)}</span>${t('repeatAudio')}</button></div><section class="rule-detail"><h2>${l.name}</h2><p>${escapeHtml(l.description[state.locale])}</p></section><div class="notice">${ic('info', 18)}<div><strong>${t('tip')}</strong><p>${escapeHtml(l.tip[state.locale])}</p></div></div><section class="section"><h2 class="section-title">${t('knowledgeCheck')}</h2><p class="small muted mt12">${escapeHtml(l.question[state.locale])}</p>${l.choices[state.locale].map((c, i) => `<button class="knowledge-choice ${done && i === l.answer ? 'checked' : ''}" data-action="lesson-answer" data-choice="${i}">${escapeHtml(c)} ${done && i === l.answer ? ic('check', 15) : ''}</button>`).join('')}</section><div class="mt28">${primary('record-ayah', t('practiceVoice'), `data-surah="${l.surah}" data-ayah="${l.ayah}"`)}</div><p class="gentle">${t('editorial')}<br>${t('lessonKnowledge')}</p><a class="text-link" href="${l.source}" target="_blank" rel="noopener noreferrer">${t('source')} ${ic('arrow', 12)}</a>`; }
function clipCard(clip: Recording, unsaved = false): string { return `<div class="audio-row"><div class="row between"><span><strong>${unsaved ? t('yourRecording') : escapeHtml(chapter(clip.surah).name)}</strong><p class="tiny muted">${ref(clip.surah, clip.ayah)} · ${Math.round(clip.duration)}s${unsaved ? '' : ` · ${new Date(clip.createdAt).toLocaleDateString(state.locale)}`}</p></span>${actionButton('play-recording', ic('play'), 'icon-button', `data-id="${clip.id}" aria-label="${t('play')}"`)}</div><div class="row between mt12">${wave()}<div class="row gap8">${unsaved ? actionButton('save-recording', ic('download', 17), 'icon-button', `aria-label="${t('saveRecording')}"`) : actionButton('share-recording', ic('share', 17), 'icon-button', `data-id="${clip.id}" aria-label="${t('share')}"`)}${actionButton('delete-recording', ic('trash', 17), 'icon-button', `data-id="${clip.id}" aria-label="${t('delete')}"`)}</div></div>${unsaved ? `<p class="tiny muted mt12">${t('saveRecording')}</p>` : ''}</div>`; }
function reciteView(): string { return `<p class="eyebrow mt12">${t('recite')}</p><h1 class="page-title">${t('studio')}</h1><p class="page-sub">${t('studioSub')}</p><div class="record-selector"><select id="recite-surah" aria-label="${t('surah')}" ${recordingActive() ? 'disabled' : ''}>${SURAH_DATA.map(s => `<option value="${s.id}" ${s.id === reciteSurah ? 'selected' : ''}>${escapeHtml(state.locale === 'ar' ? s.ar : s.name)}</option>`).join('')}</select><select id="recite-ayah" aria-label="${t('ayah')}" ${recordingActive() ? 'disabled' : ''}>${chapter(reciteSurah).verses.map((_, i) => `<option value="${i + 1}" ${i + 1 === reciteAyah ? 'selected' : ''}>${t('ayah')} ${num(i + 1)}</option>`).join('')}</select></div><div class="question-ayah"><p class="arabic center" lang="ar">${escapeHtml(verse(reciteSurah, reciteAyah))}</p><p class="verse-key">${ref(reciteSurah, reciteAyah)}</p></div><div class="audio-row row"><span class="gold">${ic('headphones', 21)}</span><div class="grow"><strong>${t('reference')}</strong><p class="tiny muted">${t('audioProvider')}</p></div>${actionButton('play-verse', ic('play'), 'icon-button', `data-surah="${reciteSurah}" data-ayah="${reciteAyah}" aria-label="${t('play')}"`)}</div><div class="record-control"><button class="record-button ${recordingActive() ? 'live' : ''}" data-action="record" aria-label="${t(recordingActive() ? 'stop' : 'record')}">${ic(recordingActive() ? 'stop' : 'mic', 36)}</button><p class="small">${t(recordingActive() ? 'recording' : 'record')}</p><p class="record-timer" id="record-timer">${recordingActive() ? '00:00' : '90s max'}</p></div>${unsavedClip ? clipCard(unsavedClip, true) : ''}<div class="notice">${ic('shield', 20)}<div><strong>${t('noScore')}</strong><p>${t('noScoreSub')}</p></div></div><p class="gentle">${t('privateRecording')}</p><section class="section"><div class="row between"><h2 class="section-title">${t('savedRecordings')}</h2><span class="pill">${num(savedClips.length)}</span></div>${savedClips.length ? savedClips.sort((a, b) => b.createdAt - a.createdAt).map(r => clipCard(r)).join('') : `<p class="empty">${t('noRecordings')}</p>`}</section>`; }
function progressView(): string { const accuracy = completedAccuracy(state), cards = Object.values(state.cards), retainedCards = cards.filter(c => retention(c) === 'retained'), weak = weakItems(state); return `<p class="eyebrow mt12">${t('deviceOnly')}</p><h1 class="page-title">${t('progressTitle')}</h1><p class="page-sub">${t('progressSub')}</p><div class="progress-cards"><div class="metric"><div class="progress-ring" style="--percent:${accuracy ?? 0}%"><span>${accuracy === null ? '—' : num(accuracy) + '%'}</span></div><div class="grow"><h2 class="section-title">${t('quizAccuracy')}</h2><p class="label">${accuracy === null ? t('notYet') : `${num(state.attempts.filter(a => a.mode !== 'recall').length)} ${t('reviewed')}`}</p></div></div><div class="metric"><p class="value">${num(streak(state.days))}</p><p class="label">${t('dayStreak')}</p></div><div class="metric"><p class="value">${num(retainedCards.length)}</p><p class="label">${t('retained')}</p></div></div><div class="mt20">${miniNotice('retentionNote')}</div><section class="section week-card"><h2 class="section-title">${t('week')}</h2>${weekMarkup()}</section><section class="section"><h2 class="section-title mb16">${t('needsPractice')}</h2><div class="stack">${weak.length ? weak.map(c => `<button class="weak-row" data-action="practice-weak" data-key="${c.key}"><span class="gold">${ic('loop', 22)}</span><span class="grow"><h3>${escapeHtml(chapter(c.surah).name)} · ${ref(c.surah, c.ayah)}</h3><p>${t(c.mode)} · ${num(c.lapses)} ${t('missedChecks')}</p></span>${ic('chevron', 16)}</button>`).join('') : `<p class="empty">${t('noWeakness')}</p>`}</div></section><section class="section"><h2 class="section-title mb16">${t('surahProgress')}</h2>${SURAH_DATA.filter(s => state.selectedSurahs.includes(s.id)).map(s => { const seen = new Set(cards.filter(c => c.surah === s.id).map(c => c.ayah)).size; return `<div class="mini-stats"><div class="row between"><span class="small">${escapeHtml(s.name)}</span><span class="tiny muted">${num(seen)} / ${num(s.count)} ${t('ayahs')}</span></div><div class="bar-track mt12"><span style="width:${seen / s.count * 100}%"></span></div></div>`; }).join('')}</section><section class="section"><div class="mini-stats row between"><span class="small">${t('selfChecks')}</span><span class="gold">${num(state.recallSelfChecks)}</span></div><div class="mini-stats row between"><span class="small">${t('teacherVerified')}</span><span class="tiny muted">${t('unavailable')}</span></div></section>`; }
function settingsView(): string { return `<h1 class="page-title">${t('settings')}</h1><section class="settings-section"><h2>${t('language')}</h2><div class="segment">${(['en', 'fr', 'ar'] as const).map((l, i) => `<button class="${state.locale === l ? 'active' : ''}" data-action="language" data-locale="${l}" lang="${l}">${['English', 'Français', 'العربية'][i]}</button>`).join('')}</div></section><section class="settings-section"><h2>${t('dailyGoal')}</h2><div class="segment">${[3, 7, 10].map(g => `<button data-action="goal" data-goal="${g}" class="${state.goal === g ? 'active' : ''}">${num(g)} ${t('minutes')}</button>`).join('')}</div><p class="tiny muted">${t('goalNote')}</p><label class="setting-row"><span><strong>${t('motion')}</strong></span><input type="checkbox" id="motion-toggle" ${state.reducedMotion ? 'checked' : ''} aria-label="${t('motion')}"></label><label class="setting-row"><span><strong>${t('onlineAudio')}</strong><p>${t('onlineAudioNote')}</p></span><input type="checkbox" id="audio-toggle" ${state.audioConsent ? 'checked' : ''} aria-label="${t('onlineAudio')}"></label></section><section class="settings-section"><h2>${t('reminder')}</h2><p class="tiny muted mb16">${t('reminderNote')}</p><div class="row"><input id="reminder-time" type="time" value="${state.reminder ?? '20:00'}" aria-label="${t('reminder')}">${actionButton('reminder', t('setReminder'), 'button secondary grow')}</div>${state.reminder ? actionButton('remove-reminder', t('removeReminder'), 'text-button') : ''}</section><section class="settings-section"><h2>${t('dataPrivacy')}</h2>${isTemporary() ? miniNotice('temporaryNote') : ''}<p class="small muted mb16">${t('privacyNote')}</p><div class="stack">${actionButton('export', ic('download', 18) + t('export'), 'button secondary full')}${actionButton('import', ic('upload', 18) + t('import'), 'button subtle full')}</div><p class="tiny muted mt12">${t('exportNote')}</p><div class="mt20">${actionButton('reset', ic('trash', 18) + t('reset'), 'button danger full')}</div></section><section class="settings-section"><h2>${t('about')}</h2><p class="small muted">${t('aboutText')}</p><p class="small muted mt12">${t('editorial')}</p><a class="text-link" href="https://quran.com" target="_blank" rel="noopener noreferrer">Quran.com · ${t('source')}</a><br><a class="text-link" href="https://alquran.cloud/terms-and-conditions" target="_blank" rel="noopener noreferrer">Islamic Network · ${t('onlineAudio')}</a></section>`; }
const views: Record<View, () => string> = { today: homeView, practice: practiceView, quran: quranView, reader: readerView, session: sessionView, result: resultView, tajweed: tajweedView, lesson: lessonView, recite: reciteView, progress: progressView, settings: settingsView };
function render(): void { document.documentElement.lang = state.locale; document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr'; document.body.classList.toggle('reduced-motion', state.reducedMotion); document.body.classList.toggle('audio-playing', audioState === 'playing'); root.innerHTML = `<div class="app-shell">${header()}${isTemporary() ? `<div class="temporary-banner">${ic('info', 13)} ${t('temporary')}</div>` : ''}<main class="main ${view === 'session' ? 'focus-screen' : ''}" id="main" tabindex="-1">${views[view]()}</main>${nav()}<div class="sticky-audio" id="audio-banner" ${audioState === 'stopped' ? 'hidden' : ''}><span class="gold">${ic('wave', 20)}</span><div class="grow"><strong class="small">${t(audioState === 'loading' ? 'loadingAudio' : ownAudio ? 'yourRecording' : 'reference')}</strong><p>${t(ownAudio ? 'privateRecording' : 'audioProvider')}</p></div><button class="icon-button" data-action="stop-audio" aria-label="${t('stopAudio')}">${ic('stop', 18)}</button></div></div>`; }
async function navigate(target: View, updateHistory = true): Promise<void> { if (!Object.hasOwn(views, target))
    target = 'today'; if (recordingActive())
    await finishRecording(); stopAudio(); view = target; if (updateHistory && location.href !== 'about:blank' && location.hash !== `#${target}`)
    history.pushState(null, '', `#${target}`); render(); window.scrollTo(0, 0); document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }); }
async function launch(mode: Mode | 'mixed', kind: 'daily' | 'practice' = 'practice', only?: QueueItem): Promise<void> { if (state.session) {
    await navigate('session');
    toast(t('resume'));
    return;
} if (mode === 'listen' && !state.audioConsent) {
    toast(t('audioDisabled'));
    await navigate('settings');
    return;
} const seed = crypto.getRandomValues(new Uint32Array(1))[0]!; const now = Date.now(); const queue = only ? [only] : planSession(state, mode, now, seed); if (!queue.length)
    return; const session: Session = { id: newId(), seed, queue, index: 0, answered: false, lastCorrect: false, lastChoice: null, correct: 0, startedAt: now, kind }; await commit({ ...state, session }); selectedOption = null; revealed = false; await navigate('session'); }
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
            await navigate(view === 'reader' ? 'quran' : view === 'lesson' ? 'tajweed' : view === 'settings' ? 'today' : 'practice');
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
            if (recordingActive())
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
                lastResult = { count: s.queue.length, correct: s.correct, self: s.queue.filter(x => x.mode === 'recall').length };
                await commit({ ...state, session: null, completedSessions: state.completedSessions + 1 });
                await navigate('result');
            }
            else {
                await commit({ ...state, session: { ...s, index: s.index + 1, answered: false, lastCorrect: false, lastChoice: null } });
                selectedOption = null;
                revealed = false;
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
        case 'goal':
            await commit({ ...state, goal: Number(d.goal) as 3 | 7 | 10 });
            render();
            break;
        case 'export':
            await exportProgress(state);
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
                await launch(c.mode, 'practice', { key: c.key, mode: c.mode, surah: c.surah, ayah: c.ayah, reason: 'due' });
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
root.addEventListener('change', async (e) => { const el = e.target as HTMLInputElement; if (!['audio-toggle', 'motion-toggle', 'recite-surah', 'recite-ayah'].includes(el.id))
    return; try {
    if (el.id === 'audio-toggle') {
        if (!el.checked)
            stopAudio();
        await commit({ ...state, audioConsent: el.checked });
    }
    if (el.id === 'motion-toggle')
        await commit({ ...state, reducedMotion: el.checked });
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
}>).detail; audioState = detail.status; ownAudio = detail.url.startsWith('blob:'); if (detail.status === 'error')
    toast(t('audioError')); document.body.classList.toggle('audio-playing', detail.status === 'playing'); const banner = document.querySelector<HTMLElement>('#audio-banner'); if (banner) {
    banner.hidden = ['stopped', 'error'].includes(detail.status);
    const strong = banner.querySelector('strong');
    if (strong)
        strong.textContent = t(detail.status === 'loading' ? 'loadingAudio' : ownAudio ? 'yourRecording' : 'reference');
    const sub = banner.querySelector('p');
    if (sub)
        sub.textContent = t(ownAudio ? 'privateRecording' : 'audioProvider');
} });
window.addEventListener('ayahflow:record-limit', () => void finishRecording());
window.addEventListener('ayahflow:record-error', () => { void finishRecording(); toast(t('micError')); });
function background(): void { stopAudio(); if (recordingActive())
    void finishRecording(); }
document.addEventListener('visibilitychange', () => { if (document.hidden)
    background(); });
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
    if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol) && !isNative())
        void navigator.serviceWorker.register('./sw.js').catch(() => { });
}
catch (error) {
    root.innerHTML = `<div class="app-shell"><main class="main"><h1 class="page-title">AyahFlow</h1><p class="notice">Your saved data or native bridge could not be opened. Nothing has been overwritten. Rebuild the native bridge or restore a valid backup.</p><p class="small muted mt20">${escapeHtml(error instanceof Error ? error.message : 'Storage unavailable')}</p><div class="stack mt20">${actionButton('import', t('import'), 'button secondary full')}${actionButton('reset', t('reset'), 'button danger full')}</div></main></div>`;
} }
void boot();
