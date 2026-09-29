export interface Clip {
    blob: Blob;
    duration: number;
    mime: string;
}
let audio: HTMLAudioElement | null = null;
let activeUrl = '';
let objectURL: string | null = null;
function audioEvent(status: string): void { window.dispatchEvent(new CustomEvent('ayahflow:audio', { detail: { status, url: activeUrl } })); }
export function stopAudio(): void { if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
} activeUrl = ''; if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = null;
} audioEvent('stopped'); }
export async function playAudio(source: string | Blob, rate = 1, repeat = false): Promise<void> {
    stopAudio();
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    if (typeof source !== 'string')
        objectURL = url;
    activeUrl = url;
    const player = new Audio(url);
    audio = player;
    player.playbackRate = rate;
    player.preservesPitch = true;
    player.loop = repeat;
    player.onended = () => { if (audio === player)
        stopAudio(); };
    player.onerror = () => { if (audio === player) {
        audioEvent('error');
        stopAudio();
    } };
    audioEvent('loading');
    const timeout = setTimeout(() => { if (audio === player && player.readyState < 2) {
        audioEvent('error');
        stopAudio();
    } }, 15000);
    player.onplaying = () => { clearTimeout(timeout); audioEvent('playing'); };
    try {
        await player.play();
    }
    catch (e) {
        clearTimeout(timeout);
        if (audio === player) {
            audioEvent('error');
            stopAudio();
        }
        throw e;
    }
}
let recorder: MediaRecorder | null = null;
let micStream: MediaStream | null = null;
let startedAt = 0;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let stopPromise: Promise<Clip> | null = null;
let chunks: Blob[] = [];
export function recordingActive(): boolean { return recorder !== null; }
export async function startRecording(): Promise<void> { if (recorder)
    throw new Error('Already recording'); if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
    throw new Error('Microphone unavailable'); stopAudio(); micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false }); try {
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    stopPromise = null;
    recorder.ondataavailable = e => { if (e.data.size)
        chunks.push(e.data); };
    recorder.onerror = () => { window.dispatchEvent(new Event('ayahflow:record-error')); };
    startedAt = Date.now();
    recorder.start(500);
    stopTimer = setTimeout(() => window.dispatchEvent(new Event('ayahflow:record-limit')), 90000);
}
catch (e) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
    recorder = null;
    throw e;
} }
export function stopRecording(): Promise<Clip> {
    if (stopPromise)
        return stopPromise;
    const r = recorder;
    if (!r)
        return Promise.reject(new Error('Not recording'));
    if (stopTimer)
        clearTimeout(stopTimer);
    stopPromise = new Promise((resolve, reject) => {
        let complete = false;
        const cleanup = () => { micStream?.getTracks().forEach(t => t.stop()); micStream = null; recorder = null; chunks = []; };
        const watchdog = setTimeout(() => { if (complete)
            return; complete = true; cleanup(); reject(new Error('Recording did not finish')); }, 5000);
        const finish = () => { if (complete)
            return; complete = true; clearTimeout(watchdog); const duration = (Date.now() - startedAt) / 1000; const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' }); cleanup(); if (!blob.size || duration < .25) {
            reject(new Error('Empty recording'));
            return;
        } resolve({ blob, duration, mime: blob.type }); };
        r.onstop = finish;
        try {
            if (r.state === 'inactive')
                finish();
            else
                r.stop();
        }
        catch (e) {
            complete = true;
            clearTimeout(watchdog);
            cleanup();
            reject(e);
        }
    });
    return stopPromise;
}
