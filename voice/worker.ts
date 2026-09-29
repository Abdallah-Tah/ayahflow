/** On-device recognition worker for voice following. Bundled by scripts/build.mjs into www/voice/worker.js
 * only when the model has been fetched (npm run voice:fetch). Loads local files only; no network.
 * Emits positions (surah, ayah, word index) — never transcripts, scores or audio. */
import * as ort from 'onnxruntime-web/wasm';
import { ZipformerSession } from '@tilawa/core';

export type VoiceInbound = { type: 'init'; model: string; corpus: string } | { type: 'audio'; samples: Float32Array } | { type: 'stop' } | { type: 'reset' };
export type VoiceOutbound = { type: 'ready' } | { type: 'error'; message: string } | { type: 'verse'; surah: number; ayah: number } | { type: 'word'; surah: number; ayah: number; word: number; total: number; matched: number[] };

let session: ZipformerSession | null = null;
const post = (msg: VoiceOutbound) => (self as unknown as Worker).postMessage(msg);

async function load(url: string): Promise<Response> { const res = await fetch(url); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res; }

async function init(model: string, corpus: string): Promise<void> {
    if (session) { post({ type: 'ready' }); return; }
    ort.env.wasm.numThreads = 1; // No COOP/COEP in a Capacitor WebView; threaded init would hang.
    ort.env.wasm.simd = true;
    // Only the .wasm is served; the JS loader is already bundled into this worker (no .mjs fetch, no MIME surprises).
    ort.env.wasm.wasmPaths = { wasm: new URL('./ort-wasm-simd-threaded.wasm', self.location.href).href };
    const [modelBytes, corpusJson] = await Promise.all([load(model).then(r => r.arrayBuffer()), load(corpus).then(r => r.json() as Promise<unknown>)]);
    session = await ZipformerSession.create({ ort, model: modelBytes, corpus: corpusJson, executionProviders: ['wasm'] });
    post({ type: 'ready' });
}

function forward(messages: readonly { type: string }[]): void {
    for (const m of messages) {
        if (m.type === 'verse_match') { const v = m as unknown as { surah: number; ayah: number }; post({ type: 'verse', surah: v.surah, ayah: v.ayah }); }
        else if (m.type === 'word_progress') { const w = m as unknown as { surah: number; ayah: number; word_index: number; total_words: number; matched_indices: number[] }; post({ type: 'word', surah: w.surah, ayah: w.ayah, word: w.word_index, total: w.total_words, matched: [...w.matched_indices] }); }
    }
}

async function handle(msg: VoiceInbound): Promise<void> {
    if (msg.type === 'init') await init(msg.model, msg.corpus);
    else if (msg.type === 'audio') { if (session) forward(await session.feed(msg.samples)); }
    else if (msg.type === 'stop') { if (session) { forward(await session.stop()); session.reset(); } }
    else if (msg.type === 'reset') session?.reset();
}

// Stateful ONNX inference: feed/stop/reset must never overlap.
let queue = Promise.resolve();
self.onmessage = (e: MessageEvent<VoiceInbound>) => { queue = queue.then(() => handle(e.data)).catch(err => post({ type: 'error', message: err instanceof Error ? err.message : String(err) })); };
