/** Type of www/js/athan-data.js, generated at build time from content/athan/sources.json. */
export interface AthanRecording { id: string; name: { en: string; fr: string; ar: string }; kind: 'studio' | 'field'; title: string; page: string; author: string; licence: string; licenceUrl: string; reviewStatus: string }
declare const ATHAN_DATA: { reviewNotes: string; alertSeconds: number; recordings: AthanRecording[] };
export default ATHAN_DATA;
