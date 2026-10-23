import { readFile, writeFile, copyFile, mkdir, access } from 'node:fs/promises';
const exists = async (p) => { try {
    await access(p);
    return true;
}
catch {
    return false;
} };
const plist = 'ios/App/App/Info.plist';
if (await exists(plist)) {
    let s = await readFile(plist, 'utf8');
    if (!s.includes('NSMicrophoneUsageDescription')) {
        s = s.replace(/<\/dict>\s*<\/plist>\s*$/, '<key>NSMicrophoneUsageDescription</key><string>AyahFlow uses the microphone to record your practice and, only when you turn on Follow my recitation, to follow your place in the text. Everything stays on this device; nothing is uploaded.</string>\n</dict>\n</plist>');
        await writeFile(plist, s);
    }
    // Smart reminders: location/motion purpose strings and the ayahflow:// link scheme (added once; edits are preserved).
    const keys = [
        ['NSLocationWhenInUseUsageDescription', 'AyahFlow uses your location only to save places you choose, such as Home, Work or your mosque. They stay on this device.'],
        ['NSLocationAlwaysAndWhenInUseUsageDescription', 'With “Always”, AyahFlow can remind you of the fitting dhikr when you leave or arrive at a saved place, even when the app is closed. Places and detections stay on this device.'],
        ['NSMotionUsageDescription', 'AyahFlow checks recent motion to remind you of the riding dua when you travel by vehicle. Motion data stays on this device.'],
    ];
    for (const [key, text] of keys) if (!s.includes(`<key>${key}</key>`)) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `<key>${key}</key><string>${text}</string>\n</dict>\n</plist>`);
    if (!s.includes('<string>ayahflow</string>')) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, '<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>app.ayahflow.moment</string><key>CFBundleURLSchemes</key><array><string>ayahflow</string></array></dict></array>\n</dict>\n</plist>');
    await writeFile(plist, s);
    const privacy = 'ios/App/App/PrivacyInfo.xcprivacy';
    if (!await exists(privacy))
        await copyFile('native/PrivacyInfo.xcprivacy', privacy);
    console.log('iOS: verify PrivacyInfo.xcprivacy target membership in Xcode and review privacy declarations before release.');
}
const manifest = 'android/app/src/main/AndroidManifest.xml';
if (await exists(manifest)) {
    let s = await readFile(manifest, 'utf8');
    if (!s.includes('android:scheme="ayahflow"'))
        s = s.replace(/(<category android:name="android.intent.category.LAUNCHER" \/>\s*<\/intent-filter>)/, '$1\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="ayahflow" android:host="moment" />\n            </intent-filter>');
    if (!s.includes('android.permission.RECORD_AUDIO'))
        s = s.replace('<application', '<uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <application');
    await writeFile(manifest, s);
    await mkdir('android/app/src/main/res/drawable', { recursive: true });
    await writeFile('android/app/src/main/res/drawable/ic_stat_ayahflow.xml', '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M3,3 L11,5 L11,22 L3,20 Z M13,5 L21,3 L21,20 L13,22 Z"/></vector>');
    console.log('Android: microphone declaration added. Test WebView permission prompts on a real device.');
}
// Install starter launcher assets once; subsequent syncs preserve manual refinements.
if (await exists(plist) && !await exists('ios/App/.ayahflow-assets-configured')) {
    const dir='ios/App/App/Assets.xcassets/AppIcon.appiconset';
    await mkdir(dir,{recursive:true});
    await copyFile('public/assets/icon-1024.png',dir+'/AppIcon-1024.png');
    await writeFile(dir+'/Contents.json',JSON.stringify({images:[{filename:'AppIcon-1024.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'AyahFlow',version:1}},null,2));
    await writeFile('ios/App/.ayahflow-assets-configured','AyahFlow starter icon installed.\n');
}
if (await exists(manifest) && !await exists('android/.ayahflow-assets-configured')) {
    const root='android/app/src/main/res';
    for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
        const dir=`${root}/mipmap-${density}`;await mkdir(dir,{recursive:true});
        for(const name of ['ic_launcher.png','ic_launcher_round.png'])await copyFile(`native/icons/${density}/ic_launcher.png`,`${dir}/${name}`);
    }
    await mkdir(root+'/mipmap-anydpi-v26',{recursive:true});
    await mkdir(root+'/values',{recursive:true});
    await writeFile(root+'/values/ayahflow_icon_colors.xml','<resources><color name="ayahflow_icon_background">#101411</color></resources>');
    await writeFile(root+'/drawable/ayahflow_icon_foreground.xml',`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512"><group android:pivotX="256" android:pivotY="256" android:scaleX="0.72" android:scaleY="0.72"><path android:fillColor="#00000000" android:strokeColor="#D9BB79" android:strokeWidth="8" android:pathData="M120,392V213C120,151 219,99 256,66C293,99 392,151 392,213V392"/><path android:fillColor="#00000000" android:strokeColor="#D9BB79" android:strokeWidth="9" android:pathData="M176,229Q216,217 256,241Q296,217 336,229V339Q296,327 256,351Q216,327 176,339Z M256,242V348 M200,266H228 M200,290H228 M284,266H312 M284,290H312"/><path android:fillColor="#D9BB79" android:pathData="M270,131A29,29 0,1 0,295 173A27,27 0,0 1,270 131"/></group></vector>`);
    const xml='<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ayahflow_icon_background"/><foreground android:drawable="@drawable/ayahflow_icon_foreground"/></adaptive-icon>';
    await writeFile(root+'/mipmap-anydpi-v26/ic_launcher.xml',xml);await writeFile(root+'/mipmap-anydpi-v26/ic_launcher_round.xml',xml);
    await writeFile('android/.ayahflow-assets-configured','AyahFlow starter icon installed.\n');
}
