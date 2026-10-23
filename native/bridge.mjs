/** Native storage and OS integrations. No network endpoint or audio upload. */
import { App } from '@capacitor/app';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
const STATE = 'ayahflow.v1', INDEX = 'ayahflow.audio.v1';
const index = async () => JSON.parse((await Preferences.get({ key: INDEX })).value || '[]');
const saveIndex = async (rows) => Preferences.set({ key: INDEX, value: JSON.stringify(rows) });
function audioPath(id) { if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw Error('Invalid recording id'); return `ayahflow/audio/${id}.bin`; }
function base64(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = () => reject(r.error); r.readAsDataURL(blob); }); }
function blob64(text, type) { const raw = atob(text), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++)
    bytes[i] = raw.charCodeAt(i); return new Blob([bytes], { type }); }
async function shareFile(name, data, encoding) { if (!/^[\w.-]+$/.test(name))
    throw Error('Invalid file name'); const p = `ayahflow-exports/${name}`; await Filesystem.writeFile({ path: p, data, directory: Directory.Cache, recursive: true, ...(encoding ? { encoding } : {}) }); const { uri } = await Filesystem.getUri({ path: p, directory: Directory.Cache }); await Share.share({ title: 'AyahFlow', url: uri, dialogTitle: 'Save or share your practice' }); }
/** Native geofence / vehicle / notification engine (plugins/smart-reminders). */
const Smart = registerPlugin('AyahFlowSmart');
/** Timed reminder ids: moment code * 1e6 + yymmdd (morning 1, evening 2, sleep 3). Kept clear of other ids. */
const TIMED = (id) => id >= 1000000 && id < 4000000;
/** Athan ids: prayer code (4-8) * 1e6 + yymmdd. */
const ATHAN = (id) => id >= 4000000 && id < 9000000;
let deepLinkHandler = null;
const queuedLinks = [];
function deliver(url) { if (typeof url !== 'string' || !url.startsWith('ayahflow://')) return; if (deepLinkHandler) deepLinkHandler(url); else queuedLinks.push(url); }
export const bridge = {
    smart: {
        status: () => Smart.status(),
        currentPosition: () => Smart.currentPosition(),
        requestAlways: () => Smart.requestAlways(),
        requestMotion: () => Smart.requestMotion(),
        configure: (config) => Smart.configure({ config: JSON.stringify(config) }),
        async takeEvents() { return (await Smart.takeEvents()).events ?? []; },
        async simulate(event) { return (await Smart.simulate({ event })).moments ?? []; },
        reset: () => Smart.reset(),
        openSettings: () => Smart.openSettings(),
        steps: (days) => Smart.steps({ days }),
        async notificationPermission(request) { const p = request ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions(); return p.display; },
        /** Replaces all pending timed reminders with `list` ([{ id, at, title, body, url }]). */
        async scheduleTimed(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => TIMED(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await LocalNotifications.schedule({ notifications: list.filter(n => TIMED(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: n.url }, smallIcon: 'ic_stat_ayahflow' })) });
        },
    },
    /** Replaces pending athan alerts. iOS plays a ≤30 s sound from Library/Sounds (copied there by the plugin);
     * Android 8+ takes the sound from the notification channel (res/raw/ayahflow_athan.mp3). */
    async scheduleAthan(list) {
        const pending = (await LocalNotifications.getPending()).notifications.filter(n => ATHAN(Number(n.id)));
        if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
        if (!list.length) return;
        if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
        const android = Capacitor.getPlatform() === 'android';
        if (android) {
            await LocalNotifications.createChannel({ id: 'ayahflow-prayer', name: 'Prayer times', description: 'A quiet alert at prayer times', importance: 4, visibility: 1 });
        }
        const channel = (n) => n.reciter === null ? 'ayahflow-prayer' : n.reciter === 'custom' ? `ayahflow-athan-custom-${n.customVersion}` : `ayahflow-athan-${n.reciter}`; // online: ayahflow-athan-online-<id>
        if (android) for (const id of new Set(list.filter(n => n.reciter && n.reciter !== 'custom' && !n.reciter.startsWith('online-')).map(n => n.reciter)))
            await LocalNotifications.createChannel({ id: `ayahflow-athan-${id}`, name: `Athan · ${id}`, description: 'The athan at prayer times', importance: 5, sound: `ayahflow_athan_${id}.mp3`, visibility: 1, vibration: true });
        const local = (r) => r === 'custom' || r.startsWith('online-');
        const sound = (n) => n.reciter === null ? {} : { sound: android ? (local(n.reciter) ? undefined : `ayahflow_athan_${n.reciter}.mp3`) : n.reciter === 'custom' ? 'ayahflow-athan-custom.wav' : n.reciter.startsWith('online-') ? `ayahflow-athan-${n.reciter}.wav` : `ayahflow-athan-${n.reciter}.caf` };
        await LocalNotifications.schedule({ notifications: list.filter(n => ATHAN(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, ...sound(n), channelId: channel(n), extra: { url: 'ayahflow://prayer' }, smallIcon: 'ic_stat_ayahflow' })) });
    },
    /** Saves an imported athan: the full file for in-app playback (and Android's channel) and a ≤30 s WAV alert in
     * Library/Sounds for iOS. Stays on this device; never exported. */
    async saveCustomAthan({ full, ext, alert, version, name }) {
        await Filesystem.rmdir({ path: 'ayahflow/athan/custom', directory: Directory.Data, recursive: true }).catch(() => { });
        const path = `ayahflow/athan/custom/custom-${version}.${ext}`;
        await Filesystem.writeFile({ path, directory: Directory.Data, data: full, recursive: true });
        if (Capacitor.getPlatform() === 'ios') await Filesystem.writeFile({ path: 'Sounds/ayahflow-athan-custom.wav', directory: Directory.Library, data: alert, recursive: true });
        else await Smart.athanChannel({ path, id: `ayahflow-athan-custom-${version}`, name: `Athan · ${name}` });
    },
    async customAthanUrl(ext, version) { const { uri } = await Filesystem.getUri({ path: `ayahflow/athan/custom/custom-${version}.${ext}`, directory: Directory.Data }); return Capacitor.convertFileSrc(uri); },
    async deleteCustomAthan() {
        await Filesystem.rmdir({ path: 'ayahflow/athan/custom', directory: Directory.Data, recursive: true }).catch(() => { });
        if (Capacitor.getPlatform() === 'ios') await Filesystem.deleteFile({ path: 'Sounds/ayahflow-athan-custom.wav', directory: Directory.Library }).catch(() => { });
    },
    /** Online recordings (AlAdhan): native download with host and checksum checks, then a ≤30 s alert made on the device. */
    async downloadOnlineAthan(r) {
        const path = `ayahflow/athan/online/${r.id}.mp3`;
        await Smart.downloadAthan({ url: r.url, sha256: r.sha256, path });
        return (await Filesystem.readFile({ path, directory: Directory.Data })).data;
    },
    async saveOnlineAlert(id, alert, name) {
        if (Capacitor.getPlatform() === 'ios') await Filesystem.writeFile({ path: `Sounds/ayahflow-athan-online-${id}.wav`, directory: Directory.Library, data: alert, recursive: true });
        else await Smart.athanChannel({ path: `ayahflow/athan/online/${id}.mp3`, id: `ayahflow-athan-online-${id}`, name: `Athan · ${name}` });
    },
    async onlineAthanUrl(id) { const { uri } = await Filesystem.getUri({ path: `ayahflow/athan/online/${id}.mp3`, directory: Directory.Data }); return Capacitor.convertFileSrc(uri); },
    async deleteOnlineAthan(id) {
        await Filesystem.deleteFile({ path: `ayahflow/athan/online/${id}.mp3`, directory: Directory.Data }).catch(() => { });
        if (Capacitor.getPlatform() === 'ios') await Filesystem.deleteFile({ path: `Sounds/ayahflow-athan-online-${id}.wav`, directory: Directory.Library }).catch(() => { });
    },
    /** Hands the precomputed widget timeline to the native widgets and asks them to refresh. */
    setWidgetData: (data) => Smart.setWidgetData({ data: JSON.stringify(data) }),
    /** Notification taps, iOS Shortcuts and links call this; links that arrive before the app is ready are queued. */
    onDeepLink(handler) { deepLinkHandler = handler; queuedLinks.splice(0).forEach(handler); },
    async shareText(title, text) { await Share.share({ title, text, dialogTitle: title }); },
    async load() { return (await Preferences.get({ key: STATE })).value; },
    async save(value) { await Preferences.set({ key: STATE, value }); },
    async recordings() { const rows = await index(); return Promise.all(rows.map(async (r) => { const { data } = await Filesystem.readFile({ path: audioPath(r.id), directory: Directory.Data }); return { ...r, blob: data instanceof Blob ? data : blob64(data, r.mime) }; })); },
    async putRecording(r) { const { blob, ...meta } = r; await Filesystem.writeFile({ path: audioPath(r.id), directory: Directory.Data, data: await base64(blob), recursive: true }); const rows = await index(); await saveIndex([...rows.filter(x => x.id !== r.id), meta]); },
    async deleteRecording(id) { const rows = await index(); await Filesystem.deleteFile({ path: audioPath(id), directory: Directory.Data }); await saveIndex(rows.filter(x => x.id !== id)); },
    async clear() { await LocalNotifications.cancel({ notifications: [{ id: 701 }] }); await Smart.reset().catch(() => { }); await bridge.smart.scheduleTimed([]).catch(() => { }); await bridge.scheduleAthan([]).catch(() => { }); await bridge.deleteCustomAthan().catch(() => { }); await Filesystem.rmdir({ path: 'ayahflow/athan', directory: Directory.Data, recursive: true }).catch(() => { }); await bridge.setWidgetData(null).catch(() => { }); try {
        await Filesystem.rmdir({ path: 'ayahflow', directory: Directory.Data, recursive: true });
    }
    catch (e) {
        if (!String(e?.message).toLowerCase().match(/exist|not found/))
            throw e;
    } try {
        await Filesystem.rmdir({ path: 'ayahflow-exports', directory: Directory.Cache, recursive: true });
    }
    catch (e) {
        if (!String(e?.message).toLowerCase().match(/exist|not found/))
            throw e;
    } await Preferences.remove({ key: STATE }); await Preferences.remove({ key: INDEX }); },
    async exportFile(text, name) { await shareFile(name, text, Encoding.UTF8); },
    async shareRecording(r) { const ext = r.mime.includes('mp4') ? 'm4a' : r.mime.includes('ogg') ? 'ogg' : 'webm'; await shareFile(`ayahflow-${r.surah}-${r.ayah}.${ext}`, await base64(r.blob)); },
    async remind(time) { await LocalNotifications.cancel({ notifications: [{ id: 701 }] }); if (time === null)
        return; const permission = await LocalNotifications.requestPermissions(); if (permission.display !== 'granted')
        throw Error('Notification permission was not granted'); const [hour, minute] = time.split(':').map(Number); await LocalNotifications.schedule({ notifications: [{ id: 701, title: 'AyahFlow', body: 'A few minutes of Quran practice. Your next review is ready.', schedule: { on: { hour, minute }, repeats: true }, smallIcon: 'ic_stat_ayahflow' }] }); },
    haptic() { Haptics.impact({ style: ImpactStyle.Light }).catch(() => { }); }
};
await App.addListener('appStateChange', ({ isActive }) => { if (!isActive)
    window.dispatchEvent(new Event('ayahflow:background')); });
await App.addListener('backButton', () => window.dispatchEvent(new Event('ayahflow:back')));
await App.addListener('appUrlOpen', ({ url }) => deliver(url));
await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => deliver(notification?.extra?.url));
try { const launch = await App.getLaunchUrl(); if (launch?.url) deliver(launch.url); } catch { }
