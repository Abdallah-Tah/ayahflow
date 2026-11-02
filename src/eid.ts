/** Eid: the narrations shown on the day (verbatim, cited, graded where the dataset grades them; a Companion's practice
 * is labelled athar), Zakat al-Fitr quoted with no ruling, and which Eid a day is. Pure, so tested in Node. */
import EID_DATA, { type EidId } from './eid-data.js';
import { islamicOccasions, calendarSpan, type Occasion } from './calendar.js';
import { dayKey } from './engine.js';
export const EID_TEXT = EID_DATA.items;
export const eidText = (id: EidId) => EID_TEXT.find(x => x.id === id)!;
export type EidKind = 'eid-fitr' | 'eid-adha';
/** What the Eid view shows for each Eid, in order. The takbir is the Quran's command (2:185), shown from the corpus;
 * its wording is not shown because the narrations of it (athar in Ibn Abi Shaybah and al-Bayhaqi) are not in the
 * dataset this app quotes from. */
export function eidSections(kind: EidKind): { id: 'day' | 'sunnah' | 'zakat'; items: EidId[] }[] {
    const sunnah: EidId[] = kind === 'eid-fitr' ? ['fitr-dates', 'eat-adha', 'other-route', 'ghusl'] : ['eat-adha', 'other-route'];
    return [{ id: 'day', items: ['our-eid'] }, { id: 'sunnah', items: sunnah }, ...(kind === 'eid-fitr' ? [{ id: 'zakat' as const, items: ['zakat-fitr', 'zakat-purpose'] as EidId[] }] : [])];
}
/** The Eid to show: today's when it is Eid, else the next one (Umm al-Qura; local sighting may differ by a day). */
export function currentEid(now = Date.now()): { occasion: Occasion; kind: EidKind; today: boolean } | null {
    const today = dayKey(now);
    const o = islamicOccasions(now, 384).find(x => x.kind === 'eid-fitr' || x.kind === 'eid-adha');
    return o ? { occasion: o, kind: o.kind as EidKind, today: calendarSpan(o).includes(today) } : null;
}
