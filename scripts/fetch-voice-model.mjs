/** Build-time download of the optional voice-following model (Tilawa / Quran-Lab Zipformer).
 * The files are NPL-1.2 (no charge for the Work or any feature it powers; share-alike) and are
 * NOT committed: they land in vendor/tilawa/ (gitignored) and are copied into www/ by build.mjs.
 * Checksums are pinned so a changed upstream release fails loudly instead of shipping silently.
 * Nothing here runs inside the app; the app makes no network call to use the model. */
import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VOICE_DIR = path.join(root, 'vendor', 'tilawa');
export const VOICE_ASSETS = [
    { name: 'zipformer_interp_gentle_a05.int8.onnx', url: 'https://github.com/yazinsai/tilawa/releases/download/v0.3.0/zipformer_interp_gentle_a05.int8.onnx', sha256: 'eaf099afefbe5cc8c9aee74df864ce7cc69744271e4f3bb46ef6c17612fbe335' },
    { name: 'zipformer_quran.json', url: 'https://github.com/yazinsai/tilawa/releases/download/v0.3.0/zipformer_quran.json', sha256: '24360c05ec88fcacf3419c1fe6cd81d69e653326a0bf0e4fb507e7b98fc88127' },
];
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
async function present(asset) { try { await access(path.join(VOICE_DIR, asset.name)); return sha256(await readFile(path.join(VOICE_DIR, asset.name))) === asset.sha256; } catch { return false; } }
if (import.meta.url === `file://${process.argv[1]}`) {
    await mkdir(VOICE_DIR, { recursive: true });
    for (const asset of VOICE_ASSETS) {
        if (await present(asset)) { console.log(`ok  ${asset.name} (already verified)`); continue; }
        console.log(`get ${asset.url}`);
        const res = await fetch(asset.url);
        if (!res.ok) throw new Error(`${asset.name}: HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const hash = sha256(buf);
        if (hash !== asset.sha256) throw new Error(`${asset.name}: checksum ${hash} does not match pinned ${asset.sha256}. Review the upstream release before updating the pin.`);
        const tmp = path.join(VOICE_DIR, asset.name + '.part');
        await writeFile(tmp, buf);
        await rename(tmp, path.join(VOICE_DIR, asset.name));
        console.log(`ok  ${asset.name} (${(buf.length / 1e6).toFixed(1)} MB, sha256 verified)`);
    }
    console.log('Voice model ready in vendor/tilawa/. Licence: licenses/NPL-1.2.txt. Run npm run build.');
}
