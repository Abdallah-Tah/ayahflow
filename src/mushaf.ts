/** Page reading (Madani page boundaries from Tanzil's metadata) and the Mushaf editions the app can or cannot offer.
 * Pure, so the markup is tested in Node. The Arabic is the Tanzil text, unchanged; only the page it sits on comes from
 * the metadata. The printed line layout of a KFGQPC Mushaf is not reproduced (see MUSHAF_EDITIONS). */
import { tr, formatNumber } from './i18n.js';
import { icon, ayahMarker, surahFrame } from './icons.js';
import { chapter, verse, juzOf, pageOf, pageAyahs, JUZ_STARTS, PAGE_COUNT } from './data.js';
import type { AppState, Locale } from './engine.js';

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const arabicDigits = new Intl.NumberFormat('ar-u-nu-arab');

/** One Mushaf edition: available ones are built from data shipped with the app; the rest say why they are not. */
export interface MushafEdition { id: string; script: 'uthmani' | 'tajweed' | 'indopak'; available: boolean; name: [string, string, string]; note: [string, string, string] }
export const MUSHAF_EDITIONS: readonly MushafEdition[] = [
    { id: 'tanzil-madani', script: 'uthmani', available: true,
        name: ['Uthmani text · Madani pages', 'Texte uthmani · pages de Médine', 'الرسم العثماني · صفحات المصحف المدني'],
        note: ['Tanzil Uthmani text (CC BY 3.0) on the 604 pages of the Madani Mushaf, from Tanzil’s page metadata. The words of each page match the printed Mushaf; lines are set by your screen, not as printed.', 'Texte uthmani de Tanzil (CC BY 3.0) sur les 604 pages du Mushaf de Médine, d’après les métadonnées de Tanzil. Les mots de chaque page correspondent au Mushaf imprimé ; les lignes suivent votre écran.', 'نص تنزيل بالرسم العثماني (CC BY 3.0) على صفحات المصحف المدني الـ٦٠٤ وفق بيانات تنزيل. كلمات كل صفحة تطابق المصحف المطبوع، أما الأسطر فتتبع شاشتك.'] },
    { id: 'kfgqpc-hafs', script: 'uthmani', available: false,
        name: ['King Fahd Complex Hafs editions (1405, 1421, 1440 AH)', 'Éditions Hafs du Complexe du Roi Fahd (1405, 1421, 1440 H)', 'طبعات حفص من مجمع الملك فهد (١٤٠٥، ١٤٢١، ١٤٤٠ هـ)'],
        note: ['Not available: their page fonts and line layout belong to the King Fahd Complex, and no licence to include them in this app has been granted.', 'Indisponible : leurs polices de page et leur mise en lignes appartiennent au Complexe du Roi Fahd, sans licence accordée pour cette app.', 'غير متاحة: خطوط الصفحات وتوزيع الأسطر ملك لمجمع الملك فهد، ولم يُمنح ترخيص لإدراجها في هذا التطبيق.'] },
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

/** One page: header (surah, page and juz'), the ayahs with surah banners where a surah starts, and page turning.
 * Each ayah is a button that opens the verse menu; highlights and notes are the user's own marks. */
export function pageView(state: AppState, page: number, selected: string | null = null): string {
    const t = (k: string) => tr(k, state.locale), num = (n: number) => formatNumber(n, state.locale);
    const ayahs = pageAyahs(page), [fs, fa] = ayahs[0]!;
    const colour = new Map(state.highlights.map(h => [h.key, h.color])), noted = new Set(state.notes.map(n => n.key));
    const names = [...new Set(ayahs.map(([s]) => s))].map(s => esc(state.locale === 'ar' ? chapter(s).ar : chapter(s).name)).join(' · ');
    const groups: [number, number[]][] = [];
    for (const [s, a] of ayahs) { const g = groups[groups.length - 1]; if (g && g[0] === s) g[1].push(a); else groups.push([s, [a]]); }
    const body = groups.map(([s, list]) => {
        const c = chapter(s), banner = list[0] === 1 ? `<div class="cartouche page-banner">${surahFrame()}<p class="arabic" lang="ar">${esc(c.ar)}</p></div>${c.bismillah ? `<p class="arabic basmala" lang="ar" dir="rtl">${esc(c.bismillah)}</p>` : ''}` : '';
        const text = list.map(a => {
            const key = `${s}:${a}`, hl = colour.get(key);
            return `<span class="page-ayah${hl ? ` hl hl-${hl}` : ''}${selected === key ? ' selected' : ''}" id="v-${s}-${a}" data-action="verse-menu" data-surah="${s}" data-ayah="${a}" role="button" tabindex="0" aria-label="${esc(c.name)} ${s}:${a}${hl ? ` · ${t('highlighted')}` : ''}${noted.has(key) ? ` · ${t('hasNote')}` : ''}">${esc(verse(s, a))}${noted.has(key) ? `<span class="note-dot" aria-hidden="true"></span>` : ''}</span> ${ayahMarker(`${t('ayah')} ${num(a)}`, arabicDigits.format(a))}`;
        }).join(' ');
        return `${banner}<p class="arabic page-text" lang="ar" dir="rtl">${text}</p>`;
    }).join('');
    const turn = (to: number, key: string, ico: string) => `<button class="icon-button page-turn" data-action="page-go" data-page="${to}" aria-label="${t(key)}" ${to < 1 || to > PAGE_COUNT ? 'disabled' : ''}>${icon(ico, 20)}</button>`;
    // Mushaf order: the next page is on the left, whatever the interface language.
    return `<div class="page-head" dir="ltr">${turn(page + 1, 'nextPage', 'prev')}<div class="page-title"><strong dir="auto">${names}</strong><span class="tiny muted" dir="auto">${t('pageN').replace('{n}', num(page))} · ${t('juzN').replace('{n}', num(juzOf(fs, fa)))}</span></div>${turn(page - 1, 'prevPage', 'next')}</div>
<div class="mushaf-page page-mode" data-page="${page}" aria-label="${t('pageN').replace('{n}', num(page))}">${body}<p class="page-number" aria-hidden="true">${arabicDigits.format(page)}</p></div>
<p class="tiny muted center mt12">${t('pageHint')}</p>`;
}

/** The chooser: script tabs and edition cards with a live preview from the shipped text (never an image of another app). */
export function mushafChooser(locale: Locale, tab: MushafEdition['script']): string {
    const t = (k: string) => tr(k, locale), l = L(locale);
    const tabs = `<div class="segment" role="tablist">${(['uthmani', 'tajweed', 'indopak'] as const).map(x => `<button role="tab" data-action="mushaf-tab" data-tab="${x}" class="${tab === x ? 'active' : ''}" aria-selected="${tab === x}">${t('script_' + x)}</button>`).join('')}</div>`;
    const preview = `<div class="mushaf-preview" aria-hidden="true">${[112, 113].map(s => `<div class="cartouche">${surahFrame()}<p class="arabic" lang="ar">${esc(chapter(s).ar)}</p></div><p class="arabic" lang="ar" dir="rtl">${chapter(s).verses.map((v, i) => `${esc(v)} ${ayahMarker('', arabicDigits.format(i + 1))}`).join(' ')}</p>`).join('')}</div>`;
    const cards = MUSHAF_EDITIONS.filter(e => e.script === tab).map(e => `<article class="mushaf-card ${e.available ? 'selected' : 'unavailable'}"><div class="grow"><span class="pill ${e.available ? 'gold' : ''}">${t(e.available ? 'inUse' : 'unavailable')}</span><h3 class="mt12">${esc(e.name[l])}</h3><p class="small muted">${esc(e.note[l])}</p></div>${e.available ? preview : ''}</article>`).join('');
    return `${tabs}<div class="stack">${cards}</div>`;
}
