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
/** iOS plays the bundled adhkar chime (scripts/make-chime.mjs; the system default if it cannot be found). Without a
 * sound name the notification plugin posts silently. Android takes the sound from the notification channel. */
const ADHKAR_SOUND = Capacitor.getPlatform() === 'ios' ? { sound: 'public/sounds/adhkar-chime.caf' } : {};
/** Native geofence / vehicle / notification engine (plugins/smart-reminders). */
const Smart = registerPlugin('AyahFlowSmart');
/** Timed reminder ids: moment code * 1e6 + yymmdd (morning 1, evening 2, sleep 3). Kept clear of other ids. */
const TIMED = (id) => id >= 1000000 && id < 4000000;
/** Athan ids: prayer code (4-8) * 1e6 + yymmdd. */
const ATHAN = (id) => id >= 4000000 && id < 9000000;
const ISTIGHFAR = (id) => id >= 9000000 && id < 12000000;
const ROTATION = (id) => id >= 12000000 && id < 13000000;
/** Prayer check-in / tasbih reminders: (13 + prayer index) * 1e6 + yymmdd. */
const SALAH = (id) => id >= 13000000 && id < 18000000;
/** Reminders before a prayer: (18 + prayer index) * 1e6 + yymmdd. */
const BEFORE = (id) => id >= 18000000 && id < 23000000;
/** Test notifications from the prayer settings (src/smart.ts TEST_BEFORE_ID, TEST_ATHAN_ID). */
const TEST = (id) => id >= 23000000 && id < 23000100;
/** Jumu'ah (24), voluntary-fast (25), suhoor (27) and iftar (28) reminders: code * 1e6 + yymmdd (src/calendar.ts). */
const CALENDAR = (id) => (id >= 24000000 && id < 26000000) || (id >= 27000000 && id < 29000000);
/** Fajr alarm notifications where AlarmKit is unavailable (26 * 1e6 + yymmdd, src/alarm.ts). */
const ALARM = (id) => id >= 26000000 && id < 27000000;
let headingListener = null;
const ANDROID = Capacitor.getPlatform() === 'android';
/** iOS: the bundled chime, copied to Library/Sounds by the plugin (AthanSound.install), where iOS looks up a bare sound
 * name; if the file is missing iOS plays its default sound. Used before prayers and for the athan's "gentle alert"
 * (without a sound name the notification plugin posts silently). Android: the default sound of the channel. */
const CHIME_SOUND = 'ayahflow-prayer-chime.caf';
const beforeContent = () => ANDROID ? { channelId: 'ayahflow-prayer-before' } : { sound: CHIME_SOUND };
async function beforeChannel() { if (ANDROID) await LocalNotifications.createChannel({ id: 'ayahflow-prayer-before', name: 'Before prayer', description: 'A gentle reminder shortly before prayer times', importance: 4, visibility: 1 }); }
/** Sound and channel of an athan alert: the chosen recording's ≤30 s alert, or the chime for the gentle alert. */
const isLocal = (r) => r === 'custom' || r.startsWith('online-');
const athanSoundName = (n) => n.reciter === null ? (ANDROID ? null : CHIME_SOUND) : ANDROID ? (isLocal(n.reciter) ? null : `ayahflow_athan_${n.reciter}.mp3`) : n.reciter === 'custom' ? 'ayahflow-athan-custom.wav' : n.reciter.startsWith('online-') ? `ayahflow-athan-${n.reciter}.wav` : `ayahflow-athan-${n.reciter}.caf`;
/** iOS: re-sounds pending home-only athan alerts for where the phone is now (the plugin also does this on Home entry/exit). */
const placeAthan = () => ANDROID ? Promise.resolve() : Smart.placeAthan().catch(() => { });
const athanContent = (n) => { const sound = athanSoundName(n); return { ...(sound ? { sound } : {}), extra: { url: 'ayahflow://prayer', ...(n.homeOnly && !ANDROID && sound ? { homeOnly: true, athanSound: sound, awaySound: CHIME_SOUND } : {}) }, channelId: n.reciter === null ? 'ayahflow-prayer' : n.reciter === 'custom' ? `ayahflow-athan-custom-${n.customVersion}` : `ayahflow-athan-${n.reciter}` }; }; // online: ayahflow-athan-online-<id>
async function athanChannels(list) {
    if (!ANDROID) return;
    await LocalNotifications.createChannel({ id: 'ayahflow-prayer', name: 'Prayer times', description: 'A quiet alert at prayer times', importance: 4, visibility: 1 });
    for (const id of new Set(list.filter(n => n.reciter && !isLocal(n.reciter)).map(n => n.reciter)))
        await LocalNotifications.createChannel({ id: `ayahflow-athan-${id}`, name: `Athan · ${id}`, description: 'The athan at prayer times', importance: 5, sound: `ayahflow_athan_${id}.mp3`, visibility: 1, vibration: true });
}
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
        async scheduleCalendar(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => CALENDAR(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await LocalNotifications.schedule({ notifications: list.filter(n => CALENDAR(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, largeBody: n.body, ...ADHKAR_SOUND, schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: n.url }, smallIcon: 'ic_stat_ayahflow' })) });
        },
        /** iOS: CLLocationManager heading, only while the Qibla screen is open. Android has no compass here yet. */
        async startHeading(onHeading) {
            if (ANDROID) return false;
            await bridge.smart.stopHeading();
            headingListener = await Smart.addListener('heading', onHeading);
            try { return (await Smart.startHeading()).available === true; } catch { await bridge.smart.stopHeading(); return false; }
        },
        async stopHeading() {
            const l = headingListener; headingListener = null;
            if (l) await l.remove();
            if (!ANDROID) await Smart.stopHeading().catch(() => { });
        },
        /** Fajr alarm: AlarmKit through the plugin on iOS 26+; Android and older iPhones get a notification instead. */
        async alarmStatus() { if (ANDROID) return { available: false }; try { return await Smart.alarmStatus(); } catch { return { available: false }; } },
        async alarmRequest() { if (ANDROID) return 'unavailable'; return (await Smart.alarmRequest()).authorization; },
        async scheduleAlarm(plan, fallback) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => ALARM(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if ((await bridge.smart.alarmStatus()).available) { await Smart.alarmSchedule({ plan: JSON.stringify(plan) }); return 'alarm'; }
            if (!fallback.length) return 'notification';
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            if (ANDROID) await LocalNotifications.createChannel({ id: 'ayahflow-fajr-alarm', name: 'Fajr alarm', description: 'Wakes you for Fajr', importance: 5, visibility: 1, vibration: true });
            await LocalNotifications.schedule({ notifications: fallback.filter(n => ALARM(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, largeBody: n.body, ...(ANDROID ? { channelId: 'ayahflow-fajr-alarm' } : { sound: CHIME_SOUND }), schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: 'ayahflow://wake' }, smallIcon: 'ic_stat_ayahflow' })) });
            return 'notification';
        },
        alarmAwake: () => ANDROID ? Promise.resolve() : Smart.alarmAwake().catch(() => { }),
        async scheduleRotation(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => ROTATION(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await LocalNotifications.schedule({ notifications: list.filter(n => ROTATION(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, largeBody: n.body, ...ADHKAR_SOUND, schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: n.url } })) });
        },
        async scheduleSalah(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => SALAH(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await LocalNotifications.schedule({ notifications: list.filter(n => SALAH(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, largeBody: n.body, ...ADHKAR_SOUND, schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: n.url } })) });
        },
        async scheduleIstighfar(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => ISTIGHFAR(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await LocalNotifications.schedule({ notifications: list.filter(n => ISTIGHFAR(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, largeBody: n.body, ...ADHKAR_SOUND, schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: n.url } })) });
        },
        /** Replaces the pending reminders before prayers. Never touches athan ids. */
        async scheduleBefore(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => BEFORE(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await beforeChannel();
            await LocalNotifications.schedule({ notifications: list.filter(n => BEFORE(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, ...beforeContent(), schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: 'ayahflow://prayer' }, smallIcon: 'ic_stat_ayahflow' })) });
        },
        /** One test notification `seconds` from now with the same sound as the real one, then whether iOS kept it.
         * `n` is { id, kind: 'before' | 'athan', title, body, reciter?, customVersion? }. */
        async scheduleTest(n, seconds) {
            if (!TEST(n.id)) throw Error('Not a test id');
            await LocalNotifications.cancel({ notifications: [{ id: n.id }] });
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            if (n.kind === 'before') await beforeChannel(); else await athanChannels([n]);
            const at = Date.now() + seconds * 1000, content = n.kind === 'before' ? beforeContent() : athanContent(n);
            await LocalNotifications.schedule({ notifications: [{ id: n.id, title: n.title, body: n.body, extra: { url: 'ayahflow://prayer' }, ...content, schedule: { at: new Date(at), allowWhileIdle: true }, smallIcon: 'ic_stat_ayahflow' }] });
            if (n.homeOnly) await placeAthan();
            const pending = (await LocalNotifications.getPending()).notifications.some(p => Number(p.id) === n.id);
            return { at, pending, sound: content.sound ?? null };
        },
        /** iOS notification settings and where each sound file is (Library/Sounds, the app bundle or missing). Android has
         * no such check here, so the answer is empty there. */
        async notificationCheck(sounds) { try { return await Smart.notificationCheck({ sounds }); } catch { return {}; } },
        soundFor: (n) => n.kind === 'before' ? (ANDROID ? null : CHIME_SOUND) : athanSoundName(n),
        async notificationPermission(request) { const p = request ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions(); return p.display; },
        /** Replaces all pending timed reminders with `list` ([{ id, at, title, body, url }]). */
        async scheduleTimed(list) {
            const pending = (await LocalNotifications.getPending()).notifications.filter(n => TIMED(Number(n.id)));
            if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
            if (!list.length) return;
            if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
            await LocalNotifications.schedule({ notifications: list.filter(n => TIMED(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, largeBody: n.body, ...ADHKAR_SOUND, schedule: { at: new Date(n.at), allowWhileIdle: true }, extra: { url: n.url }, smallIcon: 'ic_stat_ayahflow' })) });
        },
    },
    /** Replaces pending athan alerts. iOS plays a ≤30 s sound from Library/Sounds (copied there by the plugin);
     * Android 8+ takes the sound from the notification channel (res/raw/ayahflow_athan.mp3). */
    async scheduleAthan(list) {
        const pending = (await LocalNotifications.getPending()).notifications.filter(n => ATHAN(Number(n.id)));
        if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: Number(n.id) })) });
        if (!list.length) return;
        if ((await LocalNotifications.checkPermissions()).display !== 'granted') throw Error('Notification permission was not granted');
        await athanChannels(list);
        await LocalNotifications.schedule({ notifications: list.filter(n => ATHAN(n.id) && n.at > Date.now()).map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, ...athanContent(n), smallIcon: 'ic_stat_ayahflow' })) });
        if (list.some(n => n.homeOnly)) await placeAthan();
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
    async clear() { await LocalNotifications.cancel({ notifications: [{ id: 701 }] }); await Smart.reset().catch(() => { }); await bridge.smart.scheduleTimed([]).catch(() => { }); await bridge.smart.scheduleIstighfar([]).catch(() => { }); await bridge.smart.scheduleRotation([]).catch(() => { }); await bridge.smart.scheduleSalah([]).catch(() => { }); await bridge.smart.scheduleBefore([]).catch(() => { }); await LocalNotifications.cancel({ notifications: [{ id: 23000001 }, { id: 23000002 }] }).catch(() => { }); await bridge.scheduleAthan([]).catch(() => { }); await bridge.deleteCustomAthan().catch(() => { }); await Filesystem.rmdir({ path: 'ayahflow/athan', directory: Directory.Data, recursive: true }).catch(() => { }); await bridge.setWidgetData(null).catch(() => { }); try {
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
