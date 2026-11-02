/** "Report a problem" in Settings: opens a mail draft the user reviews and sends from their own mail app. No network
 * endpoint and nothing attached. The button stays hidden while SUPPORT_EMAIL is empty; set it only to an address the
 * project owner has chosen for support (never a personal address by default). */
export const SUPPORT_EMAIL = '';
export const APP_VERSION = '0.1.0';
/** The mailto link, or null when no support address is configured. The body names only the app version, content
 * version and platform; the user adds the rest. */
export function reportMailto(subject: string, intro: string, contentVersion: string, platform: string, email = SUPPORT_EMAIL): string | null {
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return null;
    const body = `${intro}\n\n\n—\nAyahFlow ${APP_VERSION} · ${contentVersion} · ${platform}\n`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
