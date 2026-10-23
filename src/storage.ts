import { initialState, validateState, type AppState } from './engine.js';
import type { SmartBridge, AthanAlert, WidgetData } from './smart.js';
export interface Recording {
    id: string;
    surah: number;
    ayah: number;
    createdAt: number;
    duration: number;
    mime: string;
    blob: Blob;
}
interface NativeBridge {
    load: () => Promise<string | null>;
    save: (text: string) => Promise<void>;
    recordings: () => Promise<Recording[]>;
    putRecording: (r: Recording) => Promise<void>;
    deleteRecording: (id: string) => Promise<void>;
    clear: () => Promise<void>;
    exportFile: (text: string, name: string) => Promise<void>;
    shareRecording: (r: Recording) => Promise<void>;
    shareText: (title: string, text: string) => Promise<void>;
    remind: (time: string | null) => Promise<void>;
    haptic: () => void;
    smart: SmartBridge;
    scheduleAthan: (list: AthanAlert[]) => Promise<void>;
    setWidgetData: (data: WidgetData | null) => Promise<void>;
    saveCustomAthan: (a: { full: string; ext: string; alert: string; version: number; name: string }) => Promise<void>;
    customAthanUrl: (ext: string, version: number) => Promise<string>;
    deleteCustomAthan: () => Promise<void>;
    onDeepLink: (handler: (url: string) => void) => void;
}
let nativeBridge: NativeBridge | null = null;
let temporary = false;
let temporaryState: string | null = null;
const temporaryAudio = new Map<string, Recording>();
export function isTemporary(): boolean { return temporary; }
const STORAGE_KEY = 'ayahflow.v1';
export function isNative(): boolean { return Boolean((window as unknown as {
    Capacitor?: {
        isNativePlatform: () => boolean;
    };
}).Capacitor?.isNativePlatform()); }
export async function initializeBridge(): Promise<void> { if (!isNative()) {
    try {
        localStorage.getItem(STORAGE_KEY);
    }
    catch (e) {
        if (e instanceof DOMException && e.name === 'SecurityError') {
            temporary = true;
            return;
        }
        throw e;
    }
    return;
} const path = new URL('../native-bridge.js', import.meta.url).href; nativeBridge = (await import(path)).bridge as NativeBridge; }
function requireNativeStorage():void {if(isNative()&&!nativeBridge)throw new Error('Native storage adapter unavailable. Rebuild and sync the native bridge.');}
export async function loadState(): Promise<AppState> { requireNativeStorage(); const raw = temporary ? temporaryState : nativeBridge ? await nativeBridge.load() : localStorage.getItem(STORAGE_KEY); return raw ? validateState(JSON.parse(raw)) : initialState(); }
export async function saveState(s: AppState): Promise<void> { requireNativeStorage(); const text = JSON.stringify(s); if (temporary)
    temporaryState = text;
else if (nativeBridge)
    await nativeBridge.save(text);
else
    localStorage.setItem(STORAGE_KEY, text); }
let database: Promise<IDBDatabase> | null = null;
function openRecordings(): Promise<IDBDatabase> { database ??= new Promise((resolve, reject) => { const req = indexedDB.open('ayahflow-recordings', 1); req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('audio'))
    req.result.createObjectStore('audio', { keyPath: 'id' }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); return database; }
async function idbOperation<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> { const db = await openRecordings(); return new Promise((resolve, reject) => { const tx = db.transaction('audio', mode); const req = fn(tx.objectStore('audio')); let result: T; req.onsuccess = () => { result = req.result; }; tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error ?? req.error); tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted')); }); }
export async function listRecordings(): Promise<Recording[]> { requireNativeStorage(); return temporary ? [...temporaryAudio.values()] : nativeBridge ? nativeBridge.recordings() : idbOperation('readonly', s => s.getAll()); }
export async function putRecording(recording: Recording): Promise<void> { requireNativeStorage(); if (temporary)
    temporaryAudio.set(recording.id, recording);
else if (nativeBridge)
    await nativeBridge.putRecording(recording);
else
    await idbOperation('readwrite', s => s.put(recording)); }
export async function deleteRecording(id: string): Promise<void> { requireNativeStorage(); if (temporary)
    temporaryAudio.delete(id);
else if (nativeBridge)
    await nativeBridge.deleteRecording(id);
else
    await idbOperation('readwrite', s => s.delete(id)); }
export async function clearLocalData(): Promise<void> { requireNativeStorage(); if (temporary) {
    temporaryState = null;
    temporaryAudio.clear();
}
else if (nativeBridge)
    await nativeBridge.clear();
else {
    await idbOperation('readwrite', s => s.clear());
    localStorage.removeItem(STORAGE_KEY);
} }
export async function exportProgress(s: AppState): Promise<void> { requireNativeStorage(); const text = JSON.stringify(s, null, 2); if (nativeBridge) {
    await nativeBridge.exportFile(text, 'ayahflow-progress.json');
    return;
} downloadBlob(new Blob([text], { type: 'application/json' }), 'ayahflow-progress.json'); }
export function downloadBlob(blob: Blob, name: string): void { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
export async function shareAudio(r: Recording): Promise<void> { requireNativeStorage(); if (nativeBridge) {
    await nativeBridge.shareRecording(r);
    return;
} const ext = r.mime.includes('mp4') ? 'm4a' : r.mime.includes('ogg') ? 'ogg' : 'webm'; const name = `ayahflow-${r.surah}-${r.ayah}.${ext}`; const file = new File([r.blob], name, { type: r.mime }); if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `AyahFlow · ${r.surah}:${r.ayah}`, text: 'Please review my recitation. No automatic Tajweed assessment has been performed.' });
}
else
    downloadBlob(r.blob, name); }
/** User-initiated text share (e.g. a content report). Falls back to the clipboard; never sends anything itself. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied'> { requireNativeStorage(); if (nativeBridge) {
    await nativeBridge.shareText(title, text);
    return 'shared';
} if (navigator.share) {
    await navigator.share({ title, text });
    return 'shared';
} await navigator.clipboard.writeText(text); return 'copied'; }
export async function setReminder(time: string | null): Promise<void> { if (!nativeBridge)
    throw new Error('nativeOnly'); await nativeBridge.remind(time); }
export function haptic(): void { nativeBridge?.haptic(); }

/** Native smart-reminder engine, or null on the web (where automatic detection is not available). */
export function smartBridge(): SmartBridge | null { return nativeBridge?.smart ?? null; }
export function onDeepLink(handler: (url: string) => void): void { nativeBridge?.onDeepLink(handler); }
/** Athan alerts and widget data (native only). */
export async function scheduleAthan(list: AthanAlert[]): Promise<void> { await nativeBridge?.scheduleAthan(list); }
export async function setWidgetData(data: WidgetData | null): Promise<void> { await nativeBridge?.setWidgetData(data); }
export const nativeAthan = () => nativeBridge ? { save: nativeBridge.saveCustomAthan, url: nativeBridge.customAthanUrl, remove: nativeBridge.deleteCustomAthan } : null;
