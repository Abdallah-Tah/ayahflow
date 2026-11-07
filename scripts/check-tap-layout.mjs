// Layout check for the dhikr counter circle: every built-in and library dhikr, at 320 and 375 pt, light and dark.
// Fails if text inside the circle leaves the area within the bead ring, or overlaps the count.
// Needs the dev server (`npm run dev`, port 4173) and Google Chrome. Usage: node scripts/check-tap-layout.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COUNTERS, LIBRARY } from '../www/js/adhkar.js';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.env.APP_URL || 'http://localhost:4173/';
const ids = [...COUNTERS.map(c => c.id), ...LIBRARY.map(l => l.id)];
const profile = mkdtempSync(path.join(tmpdir(), 'tap-layout-'));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) { try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page').webSocketDebuggerUrl; } catch { await sleep(200); } }
const sock = new WebSocket(ws); await new Promise(r => { sock.onopen = r; });
let id = 0; const pending = new Map();
sock.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

const failures = [];
for (const width of [320, 375]) for (const theme of ['dark', 'light']) {
    await cmd('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 2, mobile: true });
    await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await cmd('Page.navigate', { url: URL_ + '#counter' }); await sleep(2000);
    for (const c of ids) {
        const r = await ev(`(async () => {
            const b = document.createElement('button'); b.dataset.action = 'counter'; b.dataset.counter = ${JSON.stringify(c)}; (document.querySelector('#app') ?? document.body).append(b); b.click(); b.remove();
            await new Promise(r => setTimeout(r, 250));
            const circle = document.querySelector('.tap-counter'); if (!circle) return 'no counter';
            const cr = circle.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2, ring = cr.width / 2 - 16;
            const inside = r => [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].every(([x, y]) => Math.hypot(x - cx, y - cy) <= ring);
            const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
            const phrase = circle.querySelector('.tap-phrase'), num = circle.querySelector('.tap-number'), of = circle.querySelector('.tap-of');
            const out = [];
            if (phrase && !circle.querySelector('.heart')) {
                // Each rendered line of text, not the element box (centred lines are narrower than their box).
                const range = document.createRange(); range.selectNodeContents(phrase);
                const pr = phrase.getBoundingClientRect();
                if (![...range.getClientRects()].every(inside)) out.push('phrase leaves the bead ring');
                if (num && hit(pr, num.getBoundingClientRect())) out.push('phrase overlaps the count');
            }
            if (!phrase && !document.querySelector('.tap-text')) out.push('text missing');
            for (const e of [num, of]) if (e && !inside(e.getBoundingClientRect())) out.push(e.className + ' leaves the bead ring');
            return out.join('; ');
        })()`);
        if (r) failures.push(`${c} @${width} ${theme}: ${r}`);
    }
}
sock.close(); chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still closing */ }
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`tap layout ok: ${ids.length} dhikr × 320/375 pt × dark/light`);
