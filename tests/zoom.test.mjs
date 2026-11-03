// The app never zooms like a web page, on a double tap or a pinch, as in a native app: three independent layers.
// Larger text comes from the app's own text-size settings, and iOS's Accessibility → Zoom still works system-wide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Viewport limits the scale to 1 and turns off user scaling (WKWebView honours both)', () => {
    const viewport = /<meta name="viewport" content="([^"]+)"/.exec(read('public/index.html'))[1];
    for (const part of ['width=device-width', 'initial-scale=1', 'maximum-scale=1', 'user-scalable=no', 'viewport-fit=cover']) assert.ok(viewport.split(',').includes(part), part);
});

test('CSS keeps touch-action: manipulation on the whole document', () => {
    assert.match(read('public/style.css'), /html,body\{overflow-x:clip;touch-action:manipulation\}/);
});

test('The native web view cannot zoom: scale locked to 1, pinch off, re-applied on appear and on becoming active', () => {
    const swift = read('ios/App/App/SceneDelegate.swift');
    assert.match(swift, /rootViewController = AyahFlowBridgeViewController\(\)/);
    for (const line of ['scroll.minimumZoomScale = 1', 'scroll.maximumZoomScale = 1', 'scroll.pinchGestureRecognizer?.isEnabled = false', 'scroll.setZoomScale(1, animated: false)']) assert.ok(swift.includes(line), line);
    assert.match(swift, /override func capacitorDidLoad\(\)[\s\S]*?lockZoom\(\)[\s\S]*?didBecomeActiveNotification/);
    assert.match(swift, /override func viewDidAppear[\s\S]*?lockZoom\(\)/);
});
