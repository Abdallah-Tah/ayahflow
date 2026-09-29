/** Voice following: on-device recognition of where the learner is reciting.
 * Microphone only after an explicit tap; every track stops on stop/background/navigation.
 * Audio chunks go to a local worker and are discarded; nothing is stored, uploaded or scored.
 * The model (Tilawa / Quran-Lab Zipformer, NPL-1.2) is present only in builds that fetched it. */
export type FollowEvent = { type: 'loading' } | { type: 'listening' } | { type: 'stopped' } | { type: 'error'; reason: 'mic' | 'model' } | { type: 'verse'; surah: number; ayah: number } | { type: 'word'; surah: number; ayah: number; word: number; total: number; matched: number[] };
type WorkerMessage = { type: 'ready' } | { type: 'error'; message: string } | Extract<FollowEvent, { type: 'verse' | 'word' }>;
interface VoiceManifest { worker: string; worklet: string; model: string; corpus: string }

let manifest: Promise<VoiceManifest | null> | null = null;
let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let stream: MediaStream | null = null;
let context: AudioContext | null = null;
let disconnect: (() => void) | null = null;
let listener: ((e: FollowEvent) => void) | null = null;
let active = false;
const CHUNK = 4800; // 300 ms at 16 kHz
const WORKLET_TIMEOUT_MS = 3000;

/** Linear resampler to 16 kHz with continuous phase across blocks (same maths as capture-worklet.js). */
function resampler(rate: number): (input: Float32Array, out: number[]) => void {
    const ratio = rate / 16000;
    let phase = 0, last = 0;
    return (input, out) => {
        if (ratio === 1) { for (let i = 0; i < input.length; i++) out.push(input[i]!); return; }
        let pos = phase;
        const n = input.length;
        while (pos < n) { const i0 = Math.floor(pos), frac = pos - i0; const s0 = i0 < 0 ? last : input[i0]!; const s1 = i0 + 1 < n ? input[i0 + 1]! : input[n - 1]!; out.push(s0 + (s1 - s0) * frac); pos += ratio; }
        phase = pos - n;
        last = input[n - 1]!;
    };
}
/** AudioWorklet capture, falling back to ScriptProcessor where a WebView's worklet fails or stalls. */
async function connectCapture(ctx: AudioContext, source: MediaStreamAudioSourceNode, workletUrl: string, onChunk: (samples: Float32Array) => void): Promise<() => void> {
    try {
        await Promise.race([ctx.audioWorklet.addModule(workletUrl), new Promise((_, reject) => setTimeout(() => reject(new Error('worklet timeout')), WORKLET_TIMEOUT_MS))]);
        const n = new AudioWorkletNode(ctx, 'ayahflow-capture');
        n.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(new Float32Array(e.data));
        source.connect(n);
        return () => { n.port.close(); n.disconnect(); };
    }
    catch {
        const sp = ctx.createScriptProcessor(4096, 1, 1), resample = resampler(ctx.sampleRate);
        let buffer: number[] = [];
        sp.onaudioprocess = e => { resample(e.inputBuffer.getChannelData(0), buffer); if (buffer.length >= CHUNK) { onChunk(new Float32Array(buffer)); buffer = []; } };
        source.connect(sp);
        sp.connect(ctx.destination); // Required for processing to run; the output buffer stays silent.
        return () => { sp.onaudioprocess = null; sp.disconnect(); };
    }
}

const base = () => new URL('./voice/', document.baseURI);
/** True only when this build ships the model; the single-file preview never does. */
export function voiceManifest(): Promise<VoiceManifest | null> {
    manifest ??= fetch(new URL('manifest.json', base()), { cache: 'no-cache' }).then(r => r.ok ? r.json() as Promise<VoiceManifest> : null).catch(() => null);
    return manifest;
}
export function followingActive(): boolean { return active; }

function ensureWorker(m: VoiceManifest): Promise<void> {
    if (worker && ready) return ready;
    worker = new Worker(new URL(m.worker, base()), { type: 'module' });
    let loaded = false;
    ready = new Promise((resolve, reject) => {
        worker!.onmessage = (e: MessageEvent<WorkerMessage>) => {
            const msg = e.data;
            if (msg.type === 'ready') { loaded = true; resolve(); }
            else if (msg.type === 'error') {
                if (!loaded) reject(new Error(msg.message)); // startFollowing reports it.
                else if (active) { const l = listener; void stopFollowing(); l?.({ type: 'error', reason: 'model' }); }
            }
            else if (active) listener?.(msg);
        };
        worker!.onerror = e => { if (!loaded) reject(new Error(e.message)); };
    });
    worker.postMessage({ type: 'init', model: new URL(m.model, base()).href, corpus: new URL(m.corpus, base()).href });
    return ready;
}

/** Call directly from the tap handler so the AudioContext and permission prompt keep the user gesture. */
export async function startFollowing(onEvent: (e: FollowEvent) => void): Promise<void> {
    if (active) return;
    listener = onEvent;
    active = true;
    // Create and resume the context before any await so iOS still counts it as part of the tap.
    try { context = new AudioContext({ sampleRate: 16000 }); } catch { context = new AudioContext(); }
    void context.resume().catch(() => { });
    const m = await voiceManifest();
    if (!m) { await stopFollowing(); throw new Error('unavailable'); }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    }
    catch { await stopFollowing(); onEvent({ type: 'error', reason: 'mic' }); return; }
    onEvent({ type: 'loading' });
    try { await ensureWorker(m); }
    catch { await stopFollowing(); releaseFollowing(); onEvent({ type: 'error', reason: 'model' }); return; }
    if (!active || !context || !stream) return; // Stopped while the model was loading.
    const ctx = context;
    const off = await connectCapture(ctx, ctx.createMediaStreamSource(stream), new URL(m.worklet, base()).href, samples => { if (active) worker?.postMessage({ type: 'audio', samples }, [samples.buffer]); });
    if (!active || context !== ctx) { off(); return; } // Stopped while capture was connecting.
    disconnect = off;
    await ctx.resume();
    onEvent({ type: 'listening' });
}

/** Stops the microphone immediately; the loaded model stays warm until releaseFollowing(). */
export async function stopFollowing(): Promise<void> {
    const wasActive = active;
    active = false;
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    disconnect?.();
    disconnect = null;
    const ctx = context;
    context = null;
    await ctx?.close().catch(() => { });
    worker?.postMessage({ type: 'reset' });
    if (wasActive) listener?.({ type: 'stopped' });
}

/** Frees the model's memory (~100 MB) when leaving the reader. */
export function releaseFollowing(): void {
    if (active) void stopFollowing();
    worker?.terminate();
    worker = null;
    ready = null;
    listener = null;
}
