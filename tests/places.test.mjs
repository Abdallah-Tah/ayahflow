// The saved-place cards on the automatic reminders page: separate area buttons that wrap instead of overlapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../www/js/engine.js';
import { placeCard, setPlaceRadius, PLACE_RADII } from '../www/js/places.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Places: each area is its own button, the chosen one marked, invalid areas ignored, actions on their own row', () => {
    const s = { ...initialState(), places: { home: { lat: 1, lng: 2, radius: 150 }, work: null, mosque: null } };
    assert.equal(setPlaceRadius(s, 'home', 300).places.home.radius, 300);
    assert.equal(setPlaceRadius(s, 'home', 300).places.home.lat, 1);
    for (const bad of [250, NaN, 0, 5000]) assert.equal(setPlaceRadius(s, 'home', bad), s);
    assert.equal(setPlaceRadius(s, 'work', 200), s, 'no place, no change');
    assert.equal(setPlaceRadius(s, 'home', 150), s);
    for (const locale of ['en', 'fr', 'ar']) {
        const html = placeCard('home', s.places.home, locale);
        const buttons = html.match(/<button class="radius-chip[^"]*"[^>]*>/g);
        assert.equal(buttons.length, PLACE_RADII.length, `${locale}: five buttons`);
        assert.equal(buttons.filter(b => b.includes('active')).length, 1);
        assert.ok(buttons.find(b => b.includes('active')).includes('data-radius="150"') && buttons.find(b => b.includes('active')).includes('aria-pressed="true"'));
        assert.ok(html.indexOf('radius-chips') < html.indexOf('place-actions'), 'areas above the actions');
        assert.match(html, /data-action="place-remove"/);
        assert.ok(!html.includes('place-row') && !html.includes('segment'));
    }
    assert.equal(placeCard('home', s.places.home, 'ar').match(/<bdi>[^<]+ m<\/bdi>/g).length, PLACE_RADII.length + 1, 'numbers isolated in RTL');
    const empty = placeCard('work', null, 'fr');
    assert.ok(!empty.includes('radius-chip') && !empty.includes('place-remove') && empty.includes('Utiliser ma position actuelle'));
    const css = read('public/style.css');
    assert.match(css, /\.radius-chips\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\);gap:8px\}/);
    assert.match(css, /@container \(max-width:300px\)\{\.radius-chips\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/);
    assert.match(css, /\.radius-chip\{min-height:44px/);
    assert.ok(!css.includes('.place-row .segment{flex-wrap:nowrap'), 'the overlapping one-line row is gone');
    assert.match(css, /\.main\{padding:8px 22px calc\(112px \+ var\(--safe-bottom\)\)/, 'content clears the tab bar');
});
