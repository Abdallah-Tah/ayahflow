/** Athan recordings: the bundled catalogue and the user's own imported file.
 * An imported file stays on this device. It is decoded here to make the ≤30 s iOS alert (WAV); nothing is uploaded. */
import ATHAN_DATA, { type AthanRecording, type OnlineAthan } from './athan-data.js';
export type { AthanRecording, OnlineAthan };
export const ONLINE_RECORDINGS: readonly OnlineAthan[] = ATHAN_DATA.online.recordings;
export const ONLINE_PROVIDER = ATHAN_DATA.online;
export function online(id: string): OnlineAthan | null { return ONLINE_RECORDINGS.find(r => r.id === id) ?? null; }
export function fromBase64(b64: string): ArrayBuffer { const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out.buffer; }
export const ATHAN_RECORDINGS: readonly AthanRecording[] = ATHAN_DATA.recordings;
export const ATHAN_REVIEW_NOTES = ATHAN_DATA.reviewNotes;
export const ALERT_SECONDS = ATHAN_DATA.alertSeconds;
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
export function recording(id: string): AthanRecording | null { return ATHAN_RECORDINGS.find(r => r.id === id) ?? null; }
export const bundledUrl = (id: string) => new URL(`./sounds/athan-${id}.mp3`, document.baseURI).href;

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
    const out = new ArrayBuffer(44 + samples.length * 2), v = new DataView(out);
    const text = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, samples.length * 2, true);
    samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
    return out;
}
export function toBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}
/** Decodes an audio file and renders the first ALERT_SECONDS (from where sound begins) as a faded mono 44.1 kHz 16-bit WAV. */
export async function makeAlert(file: ArrayBuffer): Promise<{ wav: ArrayBuffer; duration: number }> {
    const rate = 44100, ctx = new AudioContext();
    let decoded: AudioBuffer;
    try { decoded = await ctx.decodeAudioData(file.slice(0)); }
    finally { void ctx.close(); }
    // Skip leading silence (first sample above about -40 dBFS).
    const ch = decoded.getChannelData(0);
    let start = 0;
    while (start < ch.length && Math.abs(ch[start]!) < 0.01) start++;
    const offset = Math.max(0, start / decoded.sampleRate - 0.2), seconds = Math.min(ALERT_SECONDS, decoded.duration - offset);
    if (seconds < 3) throw new Error('too short');
    const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
    const src = off.createBufferSource(), gain = off.createGain();
    src.buffer = decoded;
    gain.gain.setValueAtTime(1, Math.max(0, seconds - 2.5));
    gain.gain.linearRampToValueAtTime(0, seconds);
    src.connect(gain).connect(off.destination);
    src.start(0, offset, seconds);
    const rendered = await off.startRendering();
    return { wav: encodeWav(rendered.getChannelData(0), rate), duration: decoded.duration };
}
