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

export type EntryType = "agenda" | "soiree" | "workshop" | "festival" | "mensuelle";

export type EntryItem = {
  id: string;
  type: EntryType;
  title: string;
  date: string;
  end_date?: string | null;
  time?: string;
  venue?: string;
  address?: string;
  country?: string;
  description?: string;
  instructor?: string;
  teacher_id?: string | null;
  level?: string;
  price?: string;
  category?: string;
  dance_style?: "salsa_cubaine" | "on2" | "multi_styles" | "autre";
  recurrence?: {
    freq: string;
    interval?: number;
    until?: string | null;
    count?: number | null;
  } | null;
  parent_id?: string | null;
  is_recurrence_master?: boolean;
  occurrence_index?: number | null;
  ticket_link?: string;
  instagram_post?: string;
  is_mensuelle?: boolean;
  cover_photo?: string | null;
  featured?: boolean;
  status?: "pending" | "approved" | "featured" | "rejected";
  submitter_name?: string;
  submitter_email?: string;
  source?: "manual" | "gcal" | "submission" | "organizer";
  external_id?: string | null;
  last_modified_at?: string | null;
  likes?: number;
  created_at?: string;
};

export type TeacherItem = {
  id: string;
  name: string;
  bio?: string;
  photo?: string | null;
  instagram?: string;
  facebook?: string;
  dance_styles?: string[];
  trusted_teacher?: boolean;
  created_at?: string;
};

export type EntryMediaItem = {
  id: string;
  entry_id: string;
  kind: "photo" | "video";
  data: string; // base64 data URI for photos, URL for videos
  title?: string;
  order: number;
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
      body: JSON.stringify(body),
    }).then((r) => handle<EventItem>(r)),

  deleteEvent: (token: string, id: string) =>
    fetch(`${API}/events/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  uploadPhotos: (token: string, id: string, photos: string[]) =>
    fetch(`${API}/events/${id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ photos }),
    }).then((r) => handle<{ inserted: number }>(r)),

  deletePhoto: (token: string, id: string) =>
    fetch(`${API}/photos/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  addTag: (photoId: string, label: string) =>
    fetch(`${API}/photos/${photoId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).then((r) => handle<TagItem>(r)),

  // Entries
  likeEntry: (id: string) =>
    fetch(`${API}/entries/${id}/like`, { method: "POST" }).then((r) =>
      handle<{ likes: number }>(r)
    ),
  unlikeEntry: (id: string) =>
    fetch(`${API}/entries/${id}/unlike`, { method: "POST" }).then((r) =>
      handle<{ likes: number }>(r)
    ),
  listEntries: (type?: EntryType, danceStyle?: string) => {
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (danceStyle && danceStyle !== "all") qs.set("dance_style", danceStyle);
    const q = qs.toString();
    return fetch(`${API}/entries${q ? `?${q}` : ""}`).then((r) =>
      handle<EntryItem[]>(r)
    );
  },
  listFeatured: () =>
    fetch(`${API}/entries?featured=true`).then((r) => handle<EntryItem[]>(r)),
  listCalendar: () =>
    fetch(`${API}/calendar/events`).then((r) => handle<EntryItem[]>(r)),
  listTeacherWorkshops: (teacherId: string) =>
    fetch(`${API}/teachers/${teacherId}/workshops`).then((r) =>
      handle<EntryItem[]>(r)
    ),

  featureEntry: (token: string, id: string) =>
    fetch(`${API}/entries/${id}/feature`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem>(r)),

  unfeatureEntry: (token: string, id: string) =>
    fetch(`${API}/entries/${id}/unfeature`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem>(r)),

  submitEntry: (body: {
    type: "soiree" | "workshop" | "festival" | "agenda" | "mensuelle";
    title: string;
    date: string;
    end_date?: string;
    time?: string;
    end_time?: string;
    venue?: string;
    address?: string;
    description?: string;
    instructor?: string;
    teacher_id?: string;
    level?: string;
    price?: string;
    category?: string;
    dance_style?: string;
    ticket_link?: string;
    instagram_post?: string;
    cover_photo?: string | null;
    submitter_name: string;
    submitter_email: string;
    submitter_link?: string;
  }) =>
    fetch(`${API}/entries/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),

  listPendingEntries: (token: string) =>
    fetch(`${API}/entries?status=pending`, {
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem[]>(r)),

  listRejectedEntries: (token: string) =>
    fetch(`${API}/entries?status=rejected`, {
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem[]>(r)),

  approveEntry: (token: string, id: string, type?: EntryType) => {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return fetch(`${API}/entries/${id}/approve${qs}`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem>(r));
  },

  rejectEntry: (token: string, id: string) =>
    fetch(`${API}/entries/${id}/reject`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<{ ok: boolean; id: string; status: string }>(r)),

  duplicateEntry: (token: string, id: string) =>
    fetch(`${API}/entries/${id}/duplicate`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem>(r)),

  listPastEntries: (token: string) =>
    fetch(`${API}/entries?include_past=true`, {
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem[]>(r)),

  syncCalendar: (token: string) =>
    fetch(`${API}/calendar/sync`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) =>
      handle<{
        ok: boolean;
        created: number;
        updated: number;
        unchanged: number;
        skipped: number;
      }>(r)
    ),
  getEntry: (id: string) =>
    fetch(`${API}/entries/${id}`).then((r) => handle<EntryItem>(r)),
  createEntry: (token: string, body: Partial<EntryItem>) =>
    fetch(`${API}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),
  updateEntry: (token: string, id: string, body: Partial<EntryItem>, scope: "this" | "future" | "all" = "this") =>
    fetch(`${API}/entries/${id}?scope=${scope}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),
  deleteEntry: (token: string, id: string, scope: "this" | "future" | "all" = "this") =>
    fetch(`${API}/entries/${id}?scope=${scope}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  /**
   * Duplicate a recurring (mensuelle) entry, advancing the date by 1 month.
   * - Admin → new entry is `approved`; full override fields allowed.
   * - Organisateur owner → new entry is `pending`; only `date`/`end_date` honored.
   */
  duplicateNextEntry: (
    token: string,
    id: string,
    overrides: Partial<{
      date: string;
      end_date: string;
      title: string;
      time: string;
      end_time: string;
      venue: string;
      address: string;
      description: string;
      ticket_link: string;
      instagram_post: string;
      price: string;
      dance_style: string;
      category: string;
    }> = {},
  ) =>
    fetch(`${API}/entries/${id}/duplicate-next`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(overrides),
    }).then((r) => handle<EntryItem>(r)),

  // Teachers
  listTeachers: () =>
    fetch(`${API}/teachers`).then((r) => handle<TeacherItem[]>(r)),
  getTeacher: (id: string) =>
    fetch(`${API}/teachers/${id}`).then((r) => handle<TeacherItem>(r)),

  // Entry media / Festival galleries
  listEntryMedia: (entryId: string) =>
    fetch(`${API}/entries/${entryId}/media`).then((r) => handle<EntryMediaItem[]>(r)),
  addEntryMedia: (
    token: string,
    entryId: string,
    items: { kind: "photo" | "video"; data: string; title?: string }[]
  ) =>
    fetch(`${API}/entries/${entryId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ items }),
    }).then((r) => handle<EntryMediaItem[]>(r)),
  deleteEntryMedia: (token: string, mediaId: string) =>
    fetch(`${API}/media/${mediaId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<{ ok: boolean; id: string }>(r)),
  reorderEntryMedia: (token: string, entryId: string, ids: string[]) =>
    fetch(`${API}/entries/${entryId}/media/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ ids }),
    }).then((r) => handle<{ ok: boolean; count: number }>(r)),
  listPastFestivalsWithGallery: () =>
    fetch(`${API}/festivals/past-with-gallery`).then((r) =>
      handle<EntryItem[]>(r)
    ),
  createTeacher: (token: string, body: Partial<TeacherItem>) =>
    fetch(`${API}/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<TeacherItem>(r)),
  updateTeacher: (token: string, id: string, body: Partial<TeacherItem>) =>
    fetch(`${API}/teachers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<TeacherItem>(r)),
  deleteTeacher: (token: string, id: string) =>
    fetch(`${API}/teachers/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  // Auth
  authSession: (sessionId: string) =>
    fetch(`${API}/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    }).then((r) => handle<any>(r)),

  passwordLogin: (email: string, password: string) =>
    // NOTE: we intentionally OMIT `credentials: "include"` here. The backend
    // returns `session_token` in the body and the frontend stores it in
    // localStorage. We rely on Bearer tokens for all subsequent requests, NOT
    // on cookies. This sidesteps Safari iOS' strict CORS rule that rejects
    // any cross-origin response combining `Allow-Origin: *` with
    // `Allow-Credentials: true`, which was the root cause of "Load failed"
    // on installed PWAs.
    fetch(`${API}/auth/password-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => handle<any>(r)),

  authMe: (token?: string) =>
    fetch(`${API}/auth/me`, {
      headers: authHeaders(token),
    }).then((r) => (r.ok ? r.json() : null)),

  logout: (token?: string) =>
    fetch(`${API}/auth/logout`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  // Roles — signup
  signupOrganisateur: (
    token: string,
    body: {
      structure_name: string;
      motivation?: string;
      phone?: string;
      website?: string;
    }
  ) =>
    fetch(`${API}/auth/signup/organisateur`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<any>(r)),

  signupArtiste: (
    token: string,
    body: {
      teacher_id?: string;
      requested_name?: string;
      message?: string;
    }
  ) =>
    fetch(`${API}/auth/signup/artiste`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<any>(r)),

  // Organisateur — own dashboard
  organisateurEntries: (token: string) =>
    fetch(`${API}/organisateur/entries`, {
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem[]>(r)),

  organisateurCreateEntry: (token: string, body: Partial<EntryItem>) =>
    fetch(`${API}/organisateur/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),

  organisateurUpdateEntry: (token: string, id: string, body: Partial<EntryItem>) =>
    fetch(`${API}/organisateur/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),

  organisateurDeleteEntry: (token: string, id: string) =>
    fetch(`${API}/organisateur/entries/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  // Artiste — own profile + workshops
  artisteProfile: (token: string) =>
    fetch(`${API}/artiste/profile`, {
      headers: authHeaders(token),
    }).then((r) => handle<TeacherItem>(r)),

  artisteUpdateProfile: (token: string, body: Partial<TeacherItem>) =>
    fetch(`${API}/artiste/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<TeacherItem>(r)),

  artisteWorkshops: (token: string) =>
    fetch(`${API}/artiste/workshops`, {
      headers: authHeaders(token),
    }).then((r) => handle<EntryItem[]>(r)),

  artisteCreateWorkshop: (token: string, body: Partial<EntryItem>) =>
    fetch(`${API}/artiste/workshops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),

  artisteUpdateWorkshop: (token: string, id: string, body: Partial<EntryItem>) =>
    fetch(`${API}/artiste/workshops/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<EntryItem>(r)),

  artisteDeleteWorkshop: (token: string, id: string) =>
    fetch(`${API}/artiste/workshops/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  // Admin — manage users
  adminListUsers: (token: string, params?: { role?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return fetch(`${API}/admin/users${q ? `?${q}` : ""}`, {
      headers: authHeaders(token),
    }).then((r) => handle<any[]>(r));
  },

  adminApproveOrganizer: (token: string, userId: string) =>
    fetch(`${API}/admin/users/${userId}/approve-organizer`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  adminSuspendUser: (token: string, userId: string) =>
    fetch(`${API}/admin/users/${userId}/suspend`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  adminReactivateUser: (token: string, userId: string) =>
    fetch(`${API}/admin/users/${userId}/reactivate`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  adminApproveArtist: (token: string, userId: string, body: { teacher_id?: string }) =>
    fetch(`${API}/admin/users/${userId}/approve-artist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<any>(r)),

  adminRejectArtist: (token: string, userId: string) =>
    fetch(`${API}/admin/users/${userId}/reject-artist`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  // ─── Highlights ──────────────────────────────────────────────────────────
  listHighlights: (token?: string, includeInactive = false) =>
    fetch(
      `${API}/highlights${includeInactive ? "?include_inactive=true" : ""}`,
      { headers: token ? authHeaders(token) : {} }
    ).then((r) => handle<any[]>(r)),

  createHighlight: (token: string, body: any) =>
    fetch(`${API}/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<any>(r)),

  updateHighlight: (token: string, id: string, body: any) =>
    fetch(`${API}/highlights/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    }).then((r) => handle<any>(r)),

  deleteHighlight: (token: string, id: string) =>
    fetch(`${API}/highlights/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }).then((r) => handle<any>(r)),

  reorderHighlights: (token: string, items: { id: string; order: number }[]) =>
    fetch(`${API}/highlights/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(items),
    }).then((r) => handle<any>(r)),
};
