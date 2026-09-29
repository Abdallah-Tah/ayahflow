/** Native storage and OS integrations. No network endpoint or audio upload. */
import { App } from '@capacitor/app';
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
export const bridge = {
    async load() { return (await Preferences.get({ key: STATE })).value; },
    async save(value) { await Preferences.set({ key: STATE, value }); },
    async recordings() { const rows = await index(); return Promise.all(rows.map(async (r) => { const { data } = await Filesystem.readFile({ path: audioPath(r.id), directory: Directory.Data }); return { ...r, blob: data instanceof Blob ? data : blob64(data, r.mime) }; })); },
    async putRecording(r) { const { blob, ...meta } = r; await Filesystem.writeFile({ path: audioPath(r.id), directory: Directory.Data, data: await base64(blob), recursive: true }); const rows = await index(); await saveIndex([...rows.filter(x => x.id !== r.id), meta]); },
    async deleteRecording(id) { const rows = await index(); await Filesystem.deleteFile({ path: audioPath(id), directory: Directory.Data }); await saveIndex(rows.filter(x => x.id !== id)); },
    async clear() { await LocalNotifications.cancel({ notifications: [{ id: 701 }] }); try {
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
