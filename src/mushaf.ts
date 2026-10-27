/** The Quran reader's design system: Mushaf pages (the 604 Madani page boundaries from Tanzil's metadata), Easy
 * Reading, surah headings, the reader header text and the reading-style chooser. Pure, so the markup is tested in
 * Node. The Arabic is the Tanzil text, unchanged. Lines are set by the screen: the printed fifteen-line layout of a
 * King Fahd Complex Mushaf needs licensed line data and its matching fonts, which this app does not have (see
 * MUSHAF_EDITIONS and docs/CONTENT-PROVENANCE.md), so nothing here claims to be the printed page. */
import { tr, formatNumber } from './i18n.js';
import { ayahMarker, surahBanner } from './icons.js';
import { chapter, verse, juzOf, pageOf, pageAyahs, translation, JUZ_STARTS, PAGE_COUNT, TRANSLATION_SOURCE } from './data.js';
import type { AppState, Locale, ReadingLayout } from './engine.js';

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const arabicDigits = new Intl.NumberFormat('ar-u-nu-arab');

/** One Mushaf edition: available ones are built from data shipped with the app; the rest say why they are not. */
export interface MushafEdition { id: string; script: 'uthmani' | 'tajweed' | 'indopak'; available: boolean; name: [string, string, string]; note: [string, string, string] }
export const MUSHAF_EDITIONS: readonly MushafEdition[] = [
    { id: 'tanzil-madani', script: 'uthmani', available: true,
        name: ['Uthmani text · Madani pages', 'Texte uthmani · pages de Médine', 'الرسم العثماني · صفحات المصحف المدني'],
        note: ['Tanzil Uthmani text (CC BY 3.0) on the 604 pages of the Madani Mushaf, from Tanzil’s page metadata. The verses of each page match the printed Mushaf; lines are set by your screen, not as printed.', 'Texte uthmani de Tanzil (CC BY 3.0) sur les 604 pages du Mushaf de Médine, d’après les métadonnées de Tanzil. Les versets de chaque page correspondent au Mushaf imprimé ; les lignes suivent votre écran.', 'نص تنزيل بالرسم العثماني (CC BY 3.0) على صفحات المصحف المدني الـ٦٠٤ وفق بيانات تنزيل. آيات كل صفحة تطابق المصحف المطبوع، أما الأسطر فتتبع شاشتك.'] },
    { id: 'kfgqpc-hafs', script: 'uthmani', available: false,
        name: ['King Fahd Complex Hafs editions (1405, 1421, 1440 AH)', 'Éditions Hafs du Complexe du Roi Fahd (1405, 1421, 1440 H)', 'طبعات حفص من مجمع الملك فهد (١٤٠٥، ١٤٢١، ١٤٤٠ هـ)'],
        note: ['Not included yet: the printed fifteen-line pages need the page fonts and per-word glyph data from Quran Foundation, whose terms require a developer account and credit (and, for the glyph data, API access with storage limits). See the project’s content notes.', 'Pas encore inclus : les pages imprimées de quinze lignes nécessitent les polices de page et les données de glyphes de Quran Foundation, dont les conditions exigent un compte développeur et une mention (et, pour les glyphes, un accès API avec limites de stockage).', 'غير مضمّنة بعد: الصفحات المطبوعة ذات الخمسة عشر سطرًا تحتاج خطوط الصفحات وبيانات الحروف لكل كلمة من Quran Foundation، وشروطها تتطلب حساب مطوّر وإشارة إلى المصدر (وللحروف وصولًا عبر الواجهة البرمجية بحدود تخزين).'] },
    { id: 'tajweed', script: 'tajweed', available: false,
        name: ['Colour-coded tajweed', 'Tajwid en couleurs', 'المصحف الملوّن بأحكام التجويد'],
        note: ['Not available: no licensed, source-referenced tajweed colouring has been added. Colours are never guessed.', 'Indisponible : aucune coloration de tajwid sous licence et sourcée n’a été ajoutée. Les couleurs ne sont jamais devinées.', 'غير متاح: لم تُضف بيانات تلوين للتجويد مرخّصة وموثّقة المصدر، ولا تُخمَّن الألوان أبدًا.'] },
    { id: 'indopak', script: 'indopak', available: false,
        name: ['IndoPak script', 'Écriture indo-pakistanaise', 'الخط الهندي الباكستاني'],
        note: ['Not available: needs a separately licensed IndoPak text and font.', 'Indisponible : nécessite un texte et une police indo-pakistanais sous licence.', 'غير متاح: يتطلب نصًا وخطًا هنديًا مرخّصين.'] },
];
const L = (locale: Locale) => locale === 'en' ? 0 : locale === 'fr' ? 1 : 2;

/** The page to open: where the user last read. */
export function startPage(state: AppState): number { return pageOf(state.readPosition.surah, state.readPosition.ayah); }
/** The page to show for the open surah. The saved place decides: page turns save the page's first ayah, and links,
 * bookmarks and the surah list save the verse they open. The current page is kept while it holds that place. */
export function pageFor(state: AppState, surah: number, current: number): number {
    const rp = state.readPosition, on = current ? pageAyahs(current) : [];
    if (on.some(([x, y]) => x === rp.surah && y === rp.ayah) && on.some(([x]) => x === surah)) return current;
    return rp.surah === surah ? startPage(state) : pageOf(surah, 1);
}
/** Clamped to 1–604. */
export const clampPage = (n: number) => Math.min(PAGE_COUNT, Math.max(1, Math.round(n) || 1));

/** From a verse to the last verse of its juz', for "play to the end of the juz'". */
export function toEndOfJuz(surah: number, ayah: number): [number, number][] {
    verse(surah, ayah);
    const j = juzOf(surah, ayah), next = JUZ_STARTS[j], out: [number, number][] = [];
    for (let s = surah, a = ayah; s <= 114;) {
        if (next && s === next[0] && a === next[1]) break;
        out.push([s, a]);
        if (a < chapter(s).count) a++; else { s++; a = 1; }
    }
    return out;
}

/** Words the chooser and reader chrome need, kept here with the module ([en, fr, ar]). */
const W: Record<string, [string, string, string]> = {
    styleTitle: ['Reading style', 'Style de lecture', 'طريقة القراءة'],
    styleSub: ['Pick how the Quran is laid out. Your place, bookmarks, highlights and notes stay the same.', 'Choisissez la mise en page. Votre position, vos signets, surlignages et notes restent les mêmes.', 'اختر طريقة عرض المصحف. يبقى موضعك وعلاماتك وتظليلك وملاحظاتك كما هي.'],
    mushaf: ['Mushaf pages', 'Pages du Mushaf', 'صفحات المصحف'],
    mushafSub: ['One Madani page at a time, sized to fit your screen.', 'Une page de Médine à la fois, ajustée à votre écran.', 'صفحة مدنية واحدة في كل مرة، بحجم يناسب شاشتك.'],
    easy: ['Easy reading', 'Lecture facile', 'القراءة الميسّرة'],
    easySub: ['Continuous text at the size you choose, with optional translation.', 'Texte continu à la taille choisie, traduction en option.', 'نص متصل بالحجم الذي تختاره، مع ترجمة اختيارية.'],
    cards: ['Verse by verse', 'Verset par verset', 'آية آية'],
    cardsSub: ['Each verse with listen, record and practice tools.', 'Chaque verset avec écoute, enregistrement et entraînement.', 'كل آية مع أدوات الاستماع والتسجيل والتدريب.'],
    f604: ['604 Madani page boundaries', 'Les 604 pages de Médine', 'حدود صفحات المصحف المدني الـ٦٠٤'],
    fLines: ['Lines set for your screen, not the printed 15-line layout', 'Lignes adaptées à l’écran, pas la mise en page imprimée de 15 lignes', 'أسطر تناسب شاشتك، لا تخطيط الأسطر الخمسة عشر المطبوع'],
    fOffline: ['Works offline', 'Fonctionne hors ligne', 'يعمل دون اتصال'],
    fSize: ['Adjustable Arabic size', 'Taille de l’arabe réglable', 'حجم عربي قابل للتعديل'],
    fTr: ['Optional translation', 'Traduction en option', 'ترجمة اختيارية'],
    fTools: ['Listen, record and practise', 'Écouter, enregistrer, s’exercer', 'استماع وتسجيل وتدريب'],
    selected: ['Selected', 'Sélectionné', 'محدّد'],
    theme: ['Reading theme', 'Thème de lecture', 'مظهر القراءة'],
    auto: ['Automatic', 'Automatique', 'تلقائي'], autoSub: ['Follows the app', 'Suit l’app', 'يتبع التطبيق'],
    classic: ['Classic', 'Classique', 'كلاسيكي'], classicSub: ['Warm paper', 'Papier chaud', 'ورق دافئ'],
    night: ['Night', 'Nuit', 'ليلي'], nightSub: ['For low light', 'Pour la pénombre', 'للإضاءة الخافتة'],
    edition: ['Text and font', 'Texte et police', 'النص والخط'],
    editionBody: ['Tanzil Uthmani text 1.1 (CC BY 3.0), unchanged · page boundaries from Tanzil’s metadata · AyahFlow Quran font, adapted from Scheherazade New (SIL Open Font License). All in the app, no download.', 'Texte uthmani Tanzil 1.1 (CC BY 3.0), inchangé · limites de pages d’après les métadonnées Tanzil · police AyahFlow Quran, adaptée de Scheherazade New (SIL Open Font License). Tout est dans l’app.', 'نص تنزيل العثماني ١٫١ (CC BY 3.0) دون تغيير · حدود الصفحات من بيانات تنزيل · خط AyahFlow Quran المعدّل من Scheherazade New (رخصة SIL المفتوحة). كل ذلك داخل التطبيق دون تنزيل.'],
    others: ['Other editions', 'Autres éditions', 'طبعات أخرى'],
    othersSub: ['Not in the app yet, and why', 'Pas encore dans l’app, et pourquoi', 'غير موجودة في التطبيق بعد، وسبب ذلك'],
};
const w = (k: string, locale: Locale) => W[k]![L(locale)];
const sameKey = (s: number, a: number) => `${s}:${a}`;

/** The surah heading: the frame with the name in the middle and its transliteration under it. */
export function surahHead(s: number, locale: Locale): string {
    const c = chapter(s);
    return `<div class="q-surah" role="heading" aria-level="2" aria-label="${esc(c.name)}"><div class="q-banner">${surahBanner()}<span class="q-surah-name" lang="ar">سورة ${esc(c.ar)}</span></div><span class="q-surah-latin" aria-hidden="true">${esc(c.name)}</span></div>${c.bismillah ? `<p class="q-basmala" lang="ar" dir="rtl">${esc(c.bismillah)}</p>` : ''}`;
}
/** Text for the reader's top bar: surah name(s) and page/juz' (pages) or juz' (easy reading). */
export function readerTitle(state: AppState, layout: ReadingLayout, page: number, surah: number): { title: string; sub: string } {
    const t = (k: string) => tr(k, state.locale), num = (n: number) => formatNumber(n, state.locale), name = (s: number) => state.locale === 'ar' ? chapter(s).ar : chapter(s).name;
    if (layout === 'page') {
        const ayahs = pageAyahs(page), [fs, fa] = ayahs[0]!;
        return { title: [...new Set(ayahs.map(([x]) => x))].map(name).join(' · '), sub: `${t('pageN').replace('{n}', num(page))} · ${t('juzN').replace('{n}', num(juzOf(fs, fa)))}` };
    }
    const c = chapter(surah), j1 = juzOf(surah, 1), j2 = juzOf(surah, c.count);
    return { title: name(surah), sub: `${t('juzN').replace('{n}', j1 === j2 ? num(j1) : `${num(j1)}–${num(j2)}`)} · ${num(c.count)} ${t('ayahs')}` };
}
/** One verse as an interactive span (verse menu), with the user's highlight, note mark and the verse-end medallion. */
function verseSpan(state: AppState, s: number, a: number, selected: string | null, inner: string, id: string): string {
    const key = sameKey(s, a), hl = state.highlights.find(h => h.key === key)?.color, note = state.notes.some(n => n.key === key);
    const t = (k: string) => tr(k, state.locale), num = (n: number) => formatNumber(n, state.locale);
    // The last word and the medallion never break apart: a marker alone on a line looks like a missing verse end.
    const cut = inner.lastIndexOf(' <span class="w"') >= 0 ? inner.lastIndexOf(' <span class="w"') : inner.lastIndexOf(' ');
    const head = cut >= 0 ? inner.slice(0, cut + 1) : '', tail = cut >= 0 ? inner.slice(cut + 1) : inner;
    return `<span class="q-v${hl ? ` hl hl-${hl}` : ''}${selected === key ? ' selected' : ''}" id="${id}" data-action="verse-menu" data-surah="${s}" data-ayah="${a}" role="button" tabindex="0" aria-label="${esc(chapter(s).name)} ${s}:${a}${hl ? ` · ${t('highlighted')}` : ''}${note ? ` · ${t('hasNote')}` : ''}">${head}<span class="q-tail">${tail}${note ? '<span class="note-dot" aria-hidden="true"></span>' : ''}\u00a0${ayahMarker(`${t('ayah')} ${num(a)}`, arabicDigits.format(a))}</span></span>`;
}
/** A Mushaf page: the verses of one Madani page, a heading where a surah begins, one justified block per surah. The app
 * sizes the text so the page fits the screen without scrolling. */
export function pageBody(state: AppState, page: number, selected: string | null = null): string {
    const groups: [number, number[]][] = [];
    for (const [s, a] of pageAyahs(page)) { const g = groups[groups.length - 1]; if (g && g[0] === s) g[1].push(a); else groups.push([s, [a]]); }
    const blocks = groups.map(([s, list]) => `${list[0] === 1 ? surahHead(s, state.locale) : ''}<p class="q-text" lang="ar" dir="rtl">${list.map(a => verseSpan(state, s, a, selected, esc(verse(s, a)), `v-${s}-${a}`)).join(' ')}</p>`).join('');
    const opening = page <= 2 ? ' q-opening' : '';
    return `<div class="q-page${opening}" data-page="${page}">${blocks}</div>`;
}
/** Easy reading: the whole surah at the chosen size; with translation, verse by verse with Pickthall under each.
 * `words` renders a verse's text (the app passes its word spans so voice following can mark words). */
export function easyBody(state: AppState, surah: number, selected: string | null, showTranslation: boolean, words: (text: string) => string = esc): string {
    const c = chapter(surah);
    const verses = c.verses.map((text, i) => verseSpan(state, surah, i + 1, selected, words(text), `ayah-${i + 1}`));
    const body = showTranslation
        ? verses.map((v, i) => `<div class="e-verse"><p class="q-text e-ar" lang="ar" dir="rtl">${v}</p><p class="e-tr" lang="en" dir="ltr"><span class="e-n">${i + 1}</span>${esc(translation(surah, i + 1))}</p></div>`).join('') + `<p class="e-credit">${esc(TRANSLATION_SOURCE.name)}</p>`
        : `<p class="q-text e-flow" lang="ar" dir="rtl">${verses.join(' ')}</p>`;
    return `<article class="e-surah">${surahHead(surah, state.locale)}${body}</article>`;
}
/** A small live preview from the shipped text (never a picture of a printed page). */
function preview(state: AppState, kind: 'page' | 'easy' | 'cards'): string {
    const v = (a: number) => `${esc(verse(7, a))} ${ayahMarker('', arabicDigits.format(a))}`;
    if (kind === 'page') return `<div class="s-prev s-prev-page" aria-hidden="true"><p class="q-text">${[23, 24, 25].map(v).join(' ')}</p></div>`;
    if (kind === 'easy') return `<div class="s-prev s-prev-easy" aria-hidden="true"><p class="q-text">${v(23)}</p><p class="e-tr">${esc(translation(7, 23))}</p></div>`;
    return `<div class="s-prev s-prev-cards" aria-hidden="true"><span class="s-ref">7:23</span><p class="q-text">${v(23)}</p></div>`;
}
/** The reading-style chooser: the three layouts with live previews and honest features, the reading theme, the
 * edition in use, and editions not in the app yet in a secondary section. */
export function readingStyles(state: AppState): string {
    const l = state.locale, x = (k: string) => esc(w(k, l));
    const style = (layout: ReadingLayout, key: string, kind: 'page' | 'easy' | 'cards', feats: string[]) => {
        const on = state.readingLayout === layout;
        return `<button class="s-card${on ? ' on' : ''}" data-action="layout" data-layout="${layout}" aria-pressed="${on}"><span class="s-head"><span class="s-radio" aria-hidden="true"></span><span class="s-name">${x(key)}</span>${on ? `<span class="s-badge">${x('selected')}</span>` : ''}</span><span class="s-sub">${x(key + 'Sub')}</span>${preview(state, kind)}<span class="s-feats">${feats.map(f => `<span>${x(f)}</span>`).join('')}</span></button>`;
    };
    const theme = (id: 'auto' | 'classic' | 'night') => { const on = state.readingTheme === id; return `<button class="t-card t-${id}${on ? ' on' : ''}" data-action="reader-theme" data-theme="${id}" aria-pressed="${on}"><span class="t-swatch" aria-hidden="true"><span lang="ar">رَبَّنَا</span></span><span class="t-name">${x(id)}</span><span class="t-sub">${x(id + 'Sub')}</span></button>`; };
    const others = MUSHAF_EDITIONS.filter(e => !e.available).map(e => `<li><strong>${esc(e.name[L(l)])}</strong><span>${esc(e.note[L(l)])}</span></li>`).join('');
    return `<section class="styles"><h2 class="s-title">${x('styleTitle')}</h2><p class="s-lead">${x('styleSub')}</p>
<div class="s-list">${style('page', 'mushaf', 'page', ['f604', 'fLines', 'fOffline'])}${style('flow', 'easy', 'easy', ['fSize', 'fTr', 'fOffline'])}${style('cards', 'cards', 'cards', ['fTools', 'fSize'])}</div>
<h3 class="s-sec">${x('theme')}</h3><div class="t-list">${theme('auto')}${theme('classic')}${theme('night')}</div>
<h3 class="s-sec">${x('edition')}</h3><p class="s-note">${x('editionBody')}</p>
<details class="s-others"><summary><span>${x('others')}</span><span class="s-sub">${x('othersSub')}</span></summary><ul>${others}</ul></details></section>`;
}
