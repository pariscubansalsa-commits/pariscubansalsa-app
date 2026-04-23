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

export type EntryType = "agenda" | "soiree" | "workshop" | "festival";

export type EntryItem = {
  id: string;
  type: EntryType;
  title: string;
  date: string;
  end_date?: string | null;
  time?: string;
  venue?: string;
  address?: string;
  description?: string;
  instructor?: string;
  ticket_link?: string;
  cover_photo?: string | null;
  featured?: boolean;
  created_at?: string;
};

export type TeacherItem = {
  id: string;
  name: string;
  bio?: string;
  photo?: string | null;
  instagram?: string;
  facebook?: string;
  created_at?: string;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Gallery events
  listEvents: () => fetch(`${API}/events`).then((r) => handle<EventItem[]>(r)),
  getEvent: (id: string) =>
    fetch(`${API}/events/${id}`).then((r) => handle<EventItem>(r)),
  listPhotos: (id: string) =>
    fetch(`${API}/events/${id}/photos`).then((r) => handle<PhotoItem[]>(r)),

  createEvent: (token: string, body: Partial<EventItem>) =>
    fetch(`${API}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      credentials: "include",
      body: JSON.stringify(body),
    }).then((r) => handle<EventItem>(r)),

  deleteEvent: (token: string, id: string) =>
    fetch(`${API}/events/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
      credentials: "include",
    }).then((r) => handle<any>(r)),

  uploadPhotos: (token: string, id: string, photos: string[]) =>
    fetch(`${API}/events/${id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      credentials: "include",
      body: JSON.stringify({ photos }),
    }).then((r) => handle<{ inserted: number }>(r)),

  deletePhoto: (token: string, id: string) =>
    fetch(`${API}/photos/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
      credentials: "include",
    }).then((r) => handle<any>(r)),

  addTag: (photoId: string, label: string) =>
    fetch(`${API}/photos/${photoId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).then((r) => handle<TagItem>(r)),

  // Entries
  listEntries: (type?: EntryType) =>
    fetch(`${API}/entries${type ? `?type=${type}` : ""}`).then((r) =>
      handle<EntryItem[]>(r)
    ),
  listFeatured: () =>
    fetch(`${API}/entries?featured=true`).then((r) => handle<EntryItem[]>(r)),
  listCalendar: () =>
    fetch(`${API}/calendar/events`).then((r) => handle<EntryItem[]>(r)),
  getEntry: (id: string) =>
    fetch(`${API}/entries/${id}`).then((r) => handle<EntryItem>(r)),
  createEntry: (token: string, body: Partial<EntryItem>) =>
    fetch(`${API}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      credentials: "include",
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),
  updateEntry: (token: string, id: string, body: Partial<EntryItem>) =>
    fetch(`${API}/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      credentials: "include",
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),
  deleteEntry: (token: string, id: string) =>
    fetch(`${API}/entries/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
      credentials: "include",
    }).then((r) => handle<any>(r)),

  // Teachers
  listTeachers: () =>
    fetch(`${API}/teachers`).then((r) => handle<TeacherItem[]>(r)),
  getTeacher: (id: string) =>
    fetch(`${API}/teachers/${id}`).then((r) => handle<TeacherItem>(r)),
  createTeacher: (token: string, body: Partial<TeacherItem>) =>
    fetch(`${API}/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      credentials: "include",
      body: JSON.stringify(body),
    }).then((r) => handle<TeacherItem>(r)),
  updateTeacher: (token: string, id: string, body: Partial<TeacherItem>) =>
    fetch(`${API}/teachers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      credentials: "include",
      body: JSON.stringify(body),
    }).then((r) => handle<TeacherItem>(r)),
  deleteTeacher: (token: string, id: string) =>
    fetch(`${API}/teachers/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
      credentials: "include",
    }).then((r) => handle<any>(r)),

  // Auth
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
      headers: authHeaders(token),
    }).then((r) => (r.ok ? r.json() : null)),

  logout: (token?: string) =>
    fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(token),
    }),
};
