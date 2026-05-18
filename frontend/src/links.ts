/**
 * Centralized external-link opener.
 *
 * Problem: on mobile Web (iOS Safari especially), `window.open(url, "_blank")`
 * is often blocked by the popup blocker, returns `null`, and the click ends
 * up doing nothing (white screen or no-op). The most reliable pattern in a
 * user-gesture handler is to create a transient anchor element with
 * `target="_blank"` + `rel="noopener noreferrer"` and `.click()` it — browsers
 * treat this as a regular link navigation, never as a popup.
 *
 * On native (iOS/Android shell, not actually used for PCS which is Web-only)
 * we fall back to `Linking.openURL`.
 */
import { Platform, Linking } from "react-native";

/** Open `url` in a new browser tab from within a user-gesture handler.
 *  Returns true if a navigation was triggered, false otherwise. */
export function openExternal(url: string): boolean {
  if (!url) return false;

  if (Platform.OS === "web") {
    if (typeof document === "undefined") return false;
    // Anchor-click trick — most reliable on iOS Safari / Android Chrome.
    try {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      // Some browsers require the element to be in the DOM for .click()
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // remove after a tick so the click event has time to fully process
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 0);
      return true;
    } catch (_) {
      // Final fallback: try window.open (rarely needed)
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        return true;
      } catch {
        return false;
      }
    }
  }

  // Native shell (not used in production for PCS — we are Web-only):
  Linking.canOpenURL(url)
    .then((can) => {
      if (can) return Linking.openURL(url);
    })
    .catch(() => {});
  return true;
}

/** Normalize a handle (`@pariscubansalsa`, `pariscubansalsa`) or any URL
 *  into a fully-qualified Instagram profile/post URL. */
export function normalizeInstagramURL(handleOrUrl: string): string {
  if (!handleOrUrl) return "";
  const s = handleOrUrl.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@/, "").replace(/^instagram\.com\//, "");
  return `https://www.instagram.com/${handle}/`;
}

/** Shortcut for Instagram links: normalizes + opens in a new tab. */
export function openInstagram(handleOrUrl: string): boolean {
  return openExternal(normalizeInstagramURL(handleOrUrl));
}
