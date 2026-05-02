/**
 * Lightweight analytics client.
 *  - Logs custom events to the backend (collection: analytics_events).
 *  - Mirrors them to GA4 via gtag when available (web only).
 *  - Generates a stable per-browser visitor_id stored in localStorage.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

function getBackendUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "") + "/api";
  return "/api";
}

const API = getBackendUrl();
const STORAGE_KEY = "pcs_visitor_id";

let cachedVisitorId: string | null = null;

function visitorId(): string {
  if (cachedVisitorId) return cachedVisitorId;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      let v = window.localStorage.getItem(STORAGE_KEY);
      if (!v) {
        v =
          "v_" +
          (typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2));
        window.localStorage.setItem(STORAGE_KEY, v);
      }
      cachedVisitorId = v;
      return v;
    } catch {}
  }
  cachedVisitorId = "v_anon_" + Date.now().toString(36);
  return cachedVisitorId;
}

export type TrackPayload = {
  entry_id?: string;
  teacher_id?: string;
  photo_id?: string;
  event_id?: string;
  channel?: string;
  url?: string;
  extra?: Record<string, any>;
};

export function track(name: string, payload: TrackPayload = {}) {
  const body = JSON.stringify({
    name,
    visitor_id: visitorId(),
    url: Platform.OS === "web" ? window.location.href : undefined,
    ...payload,
  });
  // Use beacon when possible to survive page navigations (web)
  try {
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.sendBeacon
    ) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API}/analytics/track`, blob);
    } else {
      fetch(`${API}/analytics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    }
  } catch {}

  // Mirror to GA4 if loaded (gtag is injected in +html.tsx)
  try {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      (window as any).gtag
    ) {
      (window as any).gtag("event", name, {
        ...payload,
        ...payload.extra,
      });
    }
  } catch {}
}

export const Analytics = { track, visitorId };
export default Analytics;
