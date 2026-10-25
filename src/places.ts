/** The saved-place cards on the automatic reminders page (Home, Work, Mosque). Pure, so the markup is tested in Node. */
import { tr, formatNumber } from './i18n.js';
import { icon } from './icons.js';
import type { AppState, Locale, Place, PlaceKind } from './engine.js';
/** Areas the user can pick; the native engines clamp to at least 100 m (iOS region monitoring). */
export const PLACE_RADII = [100, 150, 200, 300, 500] as const;
const ICON: Record<PlaceKind, string> = { home: 'home', work: 'briefcase', mosque: 'mosque' };
/** The state with one place's area changed, or the same state for an unknown place or an area not offered. */
export function setPlaceRadius(state: AppState, kind: PlaceKind, radius: number): AppState {
    const p = state.places[kind];
    if (!p || !(PLACE_RADII as readonly number[]).includes(radius) || p.radius === radius) return state;
    return { ...state, places: { ...state.places, [kind]: { ...p, radius } } };
}
/** One card: name and current area, then the area choices (each its own button, wrapping), then the actions. */
export function placeCard(kind: PlaceKind, place: Place | null, locale: Locale): string {
    const t = (k: string) => tr(k, locale), num = (n: number) => formatNumber(n, locale);
    const radii = place ? `<div class="radius-chips" role="group" aria-label="${t('radius')} · ${t('place_' + kind)}">${PLACE_RADII.map(r => `<button class="radius-chip ${place.radius === r ? 'active' : ''}" data-action="place-radius" data-place="${kind}" data-radius="${r}" aria-pressed="${place.radius === r}"><bdi>${num(r)} m</bdi></button>`).join('')}</div>` : '';
    const remove = place ? `<button class="text-button danger-text" data-action="place-remove" data-place="${kind}">${t('removePlace')}</button>` : '';
    return `<div class="place-card"><div class="place-head"><span class="round-icon">${icon(ICON[kind], 20)}</span><div class="grow"><strong>${t('place_' + kind)}</strong><p class="tiny muted">${place ? `${t('radius')} · <bdi>${num(place.radius)} m</bdi>` : t('notSet')}</p></div></div>${radii}<div class="place-actions"><button class="button subtle place-set" data-action="place-set" data-place="${kind}">${icon('pin', 15)}<span>${t(place ? 'updateHere' : 'setHere')}</span></button>${remove}</div></div>`;
}
