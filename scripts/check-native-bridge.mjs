/** Capacitor hook (capacitor:copy:before): refuse to copy www/ into the native projects without the bundled native
 * bridge. `npm run build` recreates www/ without it, and an app shipped that way cannot open its storage. */
import { existsSync } from 'node:fs';
if (!existsSync('www/native-bridge.js')) {
    console.error('www/native-bridge.js is missing. Run `npm run native:sync` (or `npm run native:prepare`) instead of `cap sync` after `npm run build`.');
    process.exit(1);
}
