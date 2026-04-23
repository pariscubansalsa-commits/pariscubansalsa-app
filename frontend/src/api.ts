import Constants from "expo-constants";

const fromEnv =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_BACKEND_URL;

export const BACKEND_URL = fromEnv;
export const API = `${BACKEND_URL}/api`;

export type EventItem = {
  id: string;
  name: string;
  date: string;
  description?: string;
  cover_photo?: string | null;
  created_at?: string;
};

export type TagItem = {
  id: string;
  photo_id: string;
  label: string;
  created_at?: string;
};

export type PhotoItem = {
  id: string;
  event_id: string;
  data: string;
  created_at?: string;
  tags: TagItem[];
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listEvents: () => fetch(`${API}/events`).then((r) => handle<EventItem[]>(r)),
  getEvent: (id: string) =>
    fetch(`${API}/events/${id}`).then((r) => handle<EventItem>(r)),
  listPhotos: (id: string) =>
    fetch(`${API}/events/${id}/photos`).then((r) => handle<PhotoItem[]>(r)),

  createEvent: (token: string, body: Partial<EventItem>) =>
    fetch(`${API}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify(body),
    }).then((r) => handle<EventItem>(r)),

  deleteEvent: (token: string, id: string) =>
    fetch(`${API}/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).then((r) => handle<any>(r)),

  uploadPhotos: (token: string, id: string, photos: string[]) =>
    fetch(`${API}/events/${id}/photos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({ photos }),
    }).then((r) => handle<{ inserted: number }>(r)),

  deletePhoto: (token: string, id: string) =>
    fetch(`${API}/photos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).then((r) => handle<any>(r)),

  addTag: (photoId: string, label: string) =>
    fetch(`${API}/photos/${photoId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).then((r) => handle<TagItem>(r)),

  authSession: (sessionId: string) =>
    fetch(`${API}/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId }),
    }).then((r) => handle<any>(r)),

  authMe: (token?: string) =>
    fetch(`${API}/auth/me`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => (r.ok ? r.json() : null)),

  logout: (token?: string) =>
    fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
};
