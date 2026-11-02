/** Type of www/js/eid-data.js, generated at build time from content/eid/eid.json (scripts/build-eid.mjs). */
import type { HadithSource } from './adhkar-data.js';
export type EidId = 'our-eid' | 'fitr-dates' | 'eat-adha' | 'other-route' | 'ghusl' | 'zakat-fitr' | 'zakat-purpose' | 'arafah' | 'ashura' | 'tasua' | 'ten-days' | 'eid-greeting';
declare const EID_DATA: { dataset: string; items: { id: EidId; group: 'eid' | 'fitr' | 'zakat' | 'fast' | 'card'; athar: boolean; text: string; source: HadithSource }[] };
export default EID_DATA;
