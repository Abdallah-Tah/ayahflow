/** Type of www/js/athan-data.js, generated at build time from content/athan/sources.json. */
export interface AthanRecording { id: string; name: { en: string; fr: string; ar: string }; kind: 'studio' | 'field'; title: string; page: string; author: string; licence: string; licenceUrl: string; reviewStatus: string }
/** Downloaded on request from AlAdhan (Islamic Network); never bundled. */
export interface OnlineAthan { id: string; file: string; url: string; sha256: string; bytes: number; seconds: number; fajrOnly: boolean; name: { en: string; fr: string; ar: string } }
declare const ATHAN_DATA: { reviewNotes: string; alertSeconds: number; recordings: AthanRecording[]; online: { provider: string; page: string; terms: string; notes: string; recordings: OnlineAthan[] } };
export default ATHAN_DATA;
