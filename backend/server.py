from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import requests
import re
from icalendar import Calendar
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date as date_type
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
    PARIS_TZ = ZoneInfo("Europe/Paris")
except Exception:
    PARIS_TZ = timezone.utc


def today_paris() -> date_type:
    """Return today's date in Europe/Paris timezone (Cuban salsa is in Paris :)."""
    return datetime.now(PARIS_TZ).date()


def today_paris_str() -> str:
    """ISO date string YYYY-MM-DD for today in Europe/Paris."""
    return today_paris().isoformat()


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Admin allowlist. Empty = any authenticated Google user is admin (owner's Google account).
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ========= Models =========

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: str  # ISO date (YYYY-MM-DD)
    description: Optional[str] = ""
    cover_photo: Optional[str] = None  # base64 data uri
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EventCreate(BaseModel):
    name: str
    date: str
    description: Optional[str] = ""
    cover_photo: Optional[str] = None


class Tag(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    photo_id: str
    label: str  # name or @instagram handle
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TagCreate(BaseModel):
    label: str


class Photo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    data: str  # base64 data URI
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PhotoMeta(BaseModel):
    id: str
    event_id: str
    thumb: str  # base64 thumbnail (we just reuse data for simplicity)
    created_at: datetime
    tags: List[Tag] = []


class PhotosUpload(BaseModel):
    photos: List[str]  # list of base64 data URIs


# Generic entry for agenda / soirées / workshops / festivals
DANCE_STYLES = {"salsa_cubaine", "on2", "multi_styles", "autre"}
DEFAULT_DANCE_STYLE = "multi_styles"

# Recurrence ----------------------------------------------------------------
RECURRENCE_FREQS = {
    "none",           # Not recurring
    "daily",          # Every N days
    "weekly",         # Every N weeks (same weekday)
    "biweekly",       # Alias: weekly with interval=2
    "monthly_weekday",# Every N months, same weekday of month (e.g. 2nd Friday)
    "monthly_date",   # Every N months, same date of month
    "custom",         # Raw RRULE string provided
}


class Recurrence(BaseModel):
    """Defines how an entry repeats. Stored on the "master" entry; each
    generated occurrence has `parent_id` pointing to the master."""
    freq: str = "none"  # see RECURRENCE_FREQS
    interval: int = 1
    until: Optional[str] = None  # "YYYY-MM-DD" inclusive
    count: Optional[int] = None  # stop after N occurrences
    byweekday: Optional[List[int]] = None  # 0=Mon..6=Sun (for custom weekly)
    rrule: Optional[str] = None  # raw RRULE for custom


class Entry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    title: str
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = ""
    end_time: Optional[str] = ""
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    instructor: Optional[str] = ""
    teacher_id: Optional[str] = None
    level: Optional[str] = ""  # 'beginner' | 'intermediate' | 'advanced' | ''
    price: Optional[str] = ""  # free text e.g. "25€" or "Gratuit"
    category: Optional[str] = ""  # legacy free-text style — kept for back-compat
    dance_style: str = DEFAULT_DANCE_STYLE  # 'salsa_cubaine' | 'on2' | 'multi_styles' | 'autre'
    ticket_link: Optional[str] = ""
    instagram_post: Optional[str] = ""  # URL d'un post Instagram à intégrer (mensuelles, etc.)
    # Recurrence metadata ------------------------------------------------
    recurrence: Optional[Recurrence] = None
    parent_id: Optional[str] = None  # set on each generated occurrence
    is_recurrence_master: bool = False
    occurrence_index: Optional[int] = None  # 0, 1, 2… for each child
    cover_photo: Optional[str] = None
    featured: bool = False  # legacy: use status='featured' instead
    status: str = "approved"  # 'pending' | 'approved' | 'featured'
    submitter_name: Optional[str] = ""
    submitter_email: Optional[str] = ""
    submitter_link: Optional[str] = ""
    submitted_by: Optional[str] = None  # user_id of the user who submitted (organizer/artist)
    source: str = "manual"  # 'manual' | 'gcal' | 'submission' | 'organizer' | 'artiste'
    external_id: Optional[str] = None  # iCal UID for gcal sync
    last_modified_at: Optional[datetime] = None  # for gcal change detection
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EntryCreate(BaseModel):
    type: str
    title: str
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = ""
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    instructor: Optional[str] = ""
    teacher_id: Optional[str] = None
    level: Optional[str] = ""
    price: Optional[str] = ""
    category: Optional[str] = ""
    dance_style: Optional[str] = None
    ticket_link: Optional[str] = ""
    instagram_post: Optional[str] = ""
    cover_photo: Optional[str] = None
    featured: bool = False
    status: Optional[str] = None
    recurrence: Optional[Recurrence] = None


class EntrySubmit(BaseModel):
    type: str
    title: str
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = ""
    end_time: Optional[str] = ""
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    instructor: Optional[str] = ""
    teacher_id: Optional[str] = None
    level: Optional[str] = ""
    price: Optional[str] = ""
    category: Optional[str] = ""
    dance_style: Optional[str] = None
    ticket_link: Optional[str] = ""
    instagram_post: Optional[str] = ""
    cover_photo: Optional[str] = None
    submitter_name: str
    submitter_email: str
    submitter_link: Optional[str] = ""  # Instagram or website


class Teacher(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bio: Optional[str] = ""
    photo: Optional[str] = None
    instagram: Optional[str] = ""
    facebook: Optional[str] = ""
    dance_styles: List[str] = []
    trusted_teacher: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeacherCreate(BaseModel):
    name: str
    bio: Optional[str] = ""
    photo: Optional[str] = None
    instagram: Optional[str] = ""
    facebook: Optional[str] = ""
    dance_styles: List[str] = []
    trusted_teacher: bool = False


class OrganizerProfile(BaseModel):
    structure_name: Optional[str] = ""
    motivation: Optional[str] = ""
    phone: Optional[str] = ""
    website: Optional[str] = ""


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    is_admin: bool = False
    role: str = "visiteur"  # 'admin' | 'organisateur' | 'artiste' | 'visiteur'
    status: str = "active"  # 'active' | 'pending' | 'suspended'
    organizer: Optional[OrganizerProfile] = None
    artist_teacher_id: Optional[str] = None  # linked Teacher.id once claim approved
    pending_artist_claim: Optional[dict] = None  # {teacher_id?, requested_name?, message?}
    created_at: Optional[datetime] = None


VALID_ROLES = {"admin", "organisateur", "artiste", "visiteur"}
VALID_USER_STATUSES = {"active", "pending", "suspended"}


# ========= Auth =========

async def get_current_user(request: Request) -> Optional[User]:
    """Return the authenticated user from session cookie or Authorization header, else None."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)


async def require_admin(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not user.is_admin and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


def require_role(*allowed_roles: str):
    """FastAPI dependency factory: require one of the given roles.

    Returns 401 if not authenticated, 403 if role is not allowed.
    Admin always passes.
    """
    allowed = set(allowed_roles)

    async def _dep(request: Request) -> User:
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        if user.role == "admin" or user.is_admin:
            return user
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail=f"Role required: {', '.join(allowed)}")
        # Suspended accounts are denied even if role matches
        if user.status == "suspended":
            raise HTTPException(status_code=403, detail="Account suspended")
        return user

    return _dep


async def require_authenticated(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def is_admin_email(email: str) -> bool:
    if not ADMIN_EMAILS:
        return True  # Open mode: any Google-authenticated user (the owner) is admin
    return email.lower() in ADMIN_EMAILS


# ========= Auth routes =========

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id (from Emergent Auth fragment) for a persistent session_token."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Auth upstream error: {e}")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture", "")
    session_token = data["session_token"]

    admin_flag = is_admin_email(email)

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        update_doc = {"name": name, "picture": picture, "is_admin": admin_flag}
        # If admin email, force role=admin / status=active
        if admin_flag:
            update_doc["role"] = "admin"
            update_doc["status"] = "active"
        else:
            # Preserve existing role/status if set, otherwise default to visiteur/active
            if not existing.get("role"):
                update_doc["role"] = "visiteur"
            if not existing.get("status"):
                update_doc["status"] = "active"
        await db.users.update_one({"user_id": user_id}, {"$set": update_doc})
        # Reload merged user for response
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_admin": admin_flag,
            "role": "admin" if admin_flag else "visiteur",
            "status": "active",
            "organizer": None,
            "artist_teacher_id": None,
            "pending_artist_claim": None,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(dict(user_doc))

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )

    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "is_admin": admin_flag,
        "role": user_doc.get("role", "visiteur"),
        "status": user_doc.get("status", "active"),
        "organizer": user_doc.get("organizer"),
        "artist_teacher_id": user_doc.get("artist_teacher_id"),
        "session_token": session_token,
    }


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.dict()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ========= Events =========

@api_router.get("/events", response_model=List[Event])
async def list_events():
    events = await db.events.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return [Event(**e) for e in events]


@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str):
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    return Event(**e)


@api_router.post("/events", response_model=Event)
async def create_event(payload: EventCreate, _user: User = Depends(require_admin)):
    event = Event(**payload.dict())
    await db.events.insert_one(event.dict())
    return event


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, _user: User = Depends(require_admin)):
    await db.events.delete_one({"id": event_id})
    # also delete photos and tags
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0, "id": 1}).to_list(5000)
    ids = [p["id"] for p in photos]
    if ids:
        await db.tags.delete_many({"photo_id": {"$in": ids}})
    await db.photos.delete_many({"event_id": event_id})
    return {"ok": True}


# ========= Photos =========

@api_router.get("/events/{event_id}/photos")
async def list_photos(event_id: str):
    """Returns all photos for an event with tags. For gallery/lightbox."""
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    out = []
    for p in photos:
        tags = await db.tags.find({"photo_id": p["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
        out.append({
            "id": p["id"],
            "event_id": p["event_id"],
            "data": p["data"],
            "created_at": p["created_at"],
            "tags": tags,
        })
    return out


@api_router.post("/events/{event_id}/photos")
async def upload_photos(event_id: str, payload: PhotosUpload, _user: User = Depends(require_admin)):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    docs = []
    for data in payload.photos:
        p = Photo(event_id=event_id, data=data)
        docs.append(p.dict())
    if docs:
        await db.photos.insert_many(docs)
    return {"inserted": len(docs)}


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, _user: User = Depends(require_admin)):
    await db.tags.delete_many({"photo_id": photo_id})
    await db.photos.delete_one({"id": photo_id})
    return {"ok": True}


# ========= Tags =========

@api_router.post("/photos/{photo_id}/tags", response_model=Tag)
async def add_tag(photo_id: str, payload: TagCreate):
    """Public endpoint: users can tag themselves."""
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Label cannot be empty")
    if len(label) > 60:
        raise HTTPException(status_code=400, detail="Label too long")

    photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    tag = Tag(photo_id=photo_id, label=label)
    await db.tags.insert_one(tag.dict())
    return tag


@api_router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: str, _user: User = Depends(require_admin)):
    await db.tags.delete_one({"id": tag_id})
    return {"ok": True}


# ========= Health =========

@api_router.get("/")
async def root():
    return {"service": "paris-cuban-salsa-gallery", "status": "ok"}


# ========= Entries (agenda / soirées / workshops / festivals) =========

VALID_TYPES = {"agenda", "soiree", "workshop", "festival", "mensuelle"}


def normalize_dance_style(value: Optional[str]) -> str:
    """Validate dance_style. Returns the value if valid, else default."""
    if not value:
        return DEFAULT_DANCE_STYLE
    if value not in DANCE_STYLES:
        raise HTTPException(status_code=400, detail=f"dance_style invalide. Doit être l'un de: {', '.join(sorted(DANCE_STYLES))}")
    return value


# ========= Recurrence =========

RECURRENCE_WINDOW_MONTHS = 3  # when no until/count, generate 3 months ahead


def _parse_date_str(s: str) -> datetime:
    return datetime.strptime(s[:10], "%Y-%m-%d")


def _fmt_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def expand_recurrence_dates(base_date: str, rec: dict) -> List[str]:
    """Return a list of ISO dates (YYYY-MM-DD) for the given recurrence rule.

    Skips the base_date itself (it is the master) and returns subsequent
    occurrences. Bounded by `until` (inclusive), `count`, or a 3-month
    rolling window."""
    from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY
    from dateutil.relativedelta import relativedelta

    freq = (rec or {}).get("freq", "none")
    if freq in {"none", None, ""}:
        return []
    start = _parse_date_str(base_date)
    interval = int(rec.get("interval") or 1)

    freq_map = {
        "daily": DAILY,
        "weekly": WEEKLY,
        "biweekly": WEEKLY,
        "monthly_weekday": MONTHLY,
        "monthly_date": MONTHLY,
    }
    if freq == "biweekly":
        interval = 2
    if freq == "custom":
        # Custom RRULE string not implemented for MVP; fall back to no expansion
        return []
    rrule_freq = freq_map.get(freq)
    if rrule_freq is None:
        return []

    kwargs = {"dtstart": start, "interval": interval}
    # monthly_weekday uses byweekday=start's weekday with occurrence index
    # dateutil default behavior for MONTHLY is to repeat on same day-of-month,
    # which is what monthly_date wants. For monthly_weekday we set bysetpos.
    if freq == "monthly_weekday":
        from dateutil.rrule import MO, TU, WE, TH, FR, SA, SU
        wd_map = [MO, TU, WE, TH, FR, SA, SU]
        # Which weekday of the month is base_date? e.g. 2nd Friday
        day_in_month = start.day
        week_index = (day_in_month - 1) // 7 + 1  # 1..5
        kwargs["byweekday"] = wd_map[start.weekday()]
        kwargs["bysetpos"] = week_index

    until_str = rec.get("until")
    count = rec.get("count")
    if until_str:
        kwargs["until"] = _parse_date_str(until_str)
    elif count:
        # count includes the master; generate (count - 1) additional + skip first
        kwargs["count"] = int(count)
    else:
        # 3-month rolling window
        kwargs["until"] = start + relativedelta(months=+RECURRENCE_WINDOW_MONTHS)

    dates = list(rrule(rrule_freq, **kwargs))
    # Drop the first one (it's the master/base)
    if dates and dates[0].date() == start.date():
        dates = dates[1:]
    # Cap at 100 occurrences defensively
    dates = dates[:100]
    return [_fmt_date(d) for d in dates]


async def generate_occurrences(master: dict) -> int:
    """Create occurrence documents for a master entry.

    Returns the count created. Idempotent: skips dates that already exist
    for this parent_id."""
    rec = master.get("recurrence") or {}
    if not rec or rec.get("freq") in {"none", None, ""}:
        return 0
    dates = expand_recurrence_dates(master["date"], rec)
    if not dates:
        return 0

    # Find existing occurrence dates to avoid dupes
    existing_cursor = db.entries.find(
        {"parent_id": master["id"]}, {"_id": 0, "date": 1}
    )
    existing_dates = {d["date"] async for d in existing_cursor}

    created = 0
    for idx, d in enumerate(dates, start=1):
        if d in existing_dates:
            continue
        child = {
            k: v for k, v in master.items()
            if k not in {"_id", "id", "recurrence", "is_recurrence_master", "parent_id", "occurrence_index"}
        }
        child["id"] = str(uuid.uuid4())
        child["date"] = d
        child["parent_id"] = master["id"]
        child["is_recurrence_master"] = False
        child["occurrence_index"] = idx
        child["recurrence"] = None
        await db.entries.insert_one(child)
        created += 1
    return created


@api_router.get("/entries", response_model=List[Entry])
async def list_entries(
    request: Request,
    type: Optional[str] = None,
    featured: Optional[bool] = None,
    status: Optional[str] = None,
    level: Optional[str] = None,
    category: Optional[str] = None,
    dance_style: Optional[str] = None,
    teacher_id: Optional[str] = None,
    include_past: Optional[bool] = False,
):
    """List entries.

    By default only future entries are returned (date >= today, server-side
    timezone Europe/Paris). Admin can pass ?include_past=true to bypass that
    filter for the History tab.
    """
    query: dict = {}
    if type:
        if type not in VALID_TYPES:
            raise HTTPException(status_code=400, detail="Invalid type")
        query["type"] = type
    if featured is not None:
        # Legacy: also map to status='featured'
        if featured:
            query["status"] = "featured"
        else:
            query["status"] = {"$ne": "featured"}
    if level:
        query["level"] = level
    if category:
        query["category"] = category
    if dance_style:
        if dance_style not in DANCE_STYLES:
            raise HTTPException(status_code=400, detail="Invalid dance_style")
        query["dance_style"] = dance_style
    if teacher_id:
        query["teacher_id"] = teacher_id

    user_admin = False
    if status or include_past:
        user = await get_current_user(request)
        user_admin = bool(user and user.is_admin)
        if not user_admin:
            raise HTTPException(status_code=401, detail="Admin only")

    if status:
        # Override status filter for admin
        query["status"] = status
    elif "status" not in query:
        query["status"] = {"$in": ["approved", "featured"]}

    # Date filter — public users only see today and upcoming events.
    # For festivals we use end_date when present (a 3-day festival starting
    # yesterday is still "upcoming" until end_date passes).
    today_str = today_paris_str()
    if include_past and user_admin:
        # Admin History tab: show STRICTLY past events
        query["$and"] = [
            {"date": {"$lt": today_str}},
            {"$or": [{"end_date": {"$in": [None, ""]}}, {"end_date": {"$lt": today_str}}]},
        ]
    elif user_admin and status:
        # Admin queries with an explicit status (pending / rejected / etc)
        # do NOT filter by date — drafts can have empty dates and we must
        # show them in the moderation queue.
        pass
    else:
        # Public listing: only today/upcoming events
        query["$or"] = [
            {"date": {"$gte": today_str}},
            {"end_date": {"$gte": today_str}},
        ]

    items = await db.entries.find(query, {"_id": 0}).to_list(2000)

    # Sort: featured first, then by date asc
    def sort_key(e):
        priority = 0 if e.get("status") == "featured" else 1
        return (priority, e.get("date") or "")
    items.sort(key=sort_key)

    return [Entry(**e) for e in items]


@api_router.post("/entries/submit", response_model=Entry)
async def submit_entry(payload: EntrySubmit):
    """Public endpoint: anyone (no auth required) can submit an event for admin review.

    Accepts the 4 entry types (soiree, workshop, festival, agenda). The event
    lands in the admin pending queue, with the submitter's contact info
    (name, email, optional link).
    """
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Type d'event invalide")
    if not payload.submitter_name.strip() or not payload.submitter_email.strip():
        raise HTTPException(status_code=400, detail="Nom et email requis")
    if not payload.title.strip() or not payload.date.strip():
        raise HTTPException(status_code=400, detail="Titre et date requis")

    data = payload.dict()
    data["dance_style"] = normalize_dance_style(data.get("dance_style"))

    # Trusted teacher → auto-approve workshops
    auto_approved = False
    if data.get("teacher_id") and payload.type == "workshop":
        teacher = await db.teachers.find_one({"id": data["teacher_id"]}, {"_id": 0})
        if teacher and teacher.get("trusted_teacher"):
            auto_approved = True

    data["status"] = "approved" if auto_approved else "pending"
    data["featured"] = False
    data["source"] = "submission"
    entry = Entry(**data)
    await db.entries.insert_one(entry.dict())
    return entry


@api_router.post("/entries/{entry_id}/approve", response_model=Entry)
async def approve_entry(
    entry_id: str,
    type: Optional[str] = None,
    _user: User = Depends(require_admin),
):
    """Approve a pending entry. Optionally re-categorise its type
    (soiree | concert | workshop | festival) — used when validating GCal imports.

    If the entry was submitted by an organizer/artist whose account is not yet
    'active', refuse the approval and explain why.
    """
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")

    submitted_by = existing.get("submitted_by")
    if submitted_by:
        submitter = await db.users.find_one({"user_id": submitted_by}, {"_id": 0})
        if submitter and submitter.get("status") != "active":
            raise HTTPException(
                status_code=400,
                detail="Le compte de l'organisateur/artiste n'est pas encore approuvé. "
                       "Approuvez son compte avant de valider ses événements.",
            )

    update: dict = {"status": "approved"}
    if type:
        if type not in VALID_TYPES:
            raise HTTPException(status_code=400, detail="Invalid type")
        update["type"] = type
    await db.entries.update_one({"id": entry_id}, {"$set": update})
    existing.update(update)
    return Entry(**existing)


@api_router.post("/entries/{entry_id}/reject")
async def reject_entry(entry_id: str, _user: User = Depends(require_admin)):
    """Reject a pending entry. It is archived (status=rejected) so it remains
    visible in the admin "Archivés" tab and can be restored later."""
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.entries.update_one({"id": entry_id}, {"$set": {"status": "rejected"}})
    return {"ok": True, "id": entry_id, "status": "rejected"}


@api_router.post("/entries/{entry_id}/feature", response_model=Entry)
async def feature_entry(entry_id: str, _user: User = Depends(require_admin)):
    """Promote an entry to 'featured' (highlighted in carousel + top of feed)."""
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.entries.update_one(
        {"id": entry_id}, {"$set": {"status": "featured", "featured": True}}
    )
    existing["status"] = "featured"
    existing["featured"] = True
    return Entry(**existing)


@api_router.post("/entries/{entry_id}/unfeature", response_model=Entry)
async def unfeature_entry(entry_id: str, _user: User = Depends(require_admin)):
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.entries.update_one(
        {"id": entry_id}, {"$set": {"status": "approved", "featured": False}}
    )
    existing["status"] = "approved"
    existing["featured"] = False
    return Entry(**existing)


@api_router.get("/teachers/{teacher_id}/workshops", response_model=List[Entry])
async def teacher_workshops(teacher_id: str):
    today = today_paris_str()
    items = await db.entries.find(
        {
            "teacher_id": teacher_id,
            "type": "workshop",
            "status": {"$in": ["approved", "featured"]},
            "$or": [
                {"date": {"$gte": today}},
                {"end_date": {"$gte": today}},
            ],
        },
        {"_id": 0},
    ).to_list(500)
    items.sort(
        key=lambda e: (0 if e.get("status") == "featured" else 1, e.get("date") or "")
    )
    return [Entry(**e) for e in items]


@api_router.get("/entries/{entry_id}", response_model=Entry)
async def get_entry(entry_id: str):
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if e:
        return Entry(**e)
    # Fallback: check calendar feed (read-only events)
    for cal_ev in fetch_calendar_entries():
        if cal_ev.get("id") == entry_id:
            return Entry(**cal_ev)
    raise HTTPException(status_code=404, detail="Entry not found")


@api_router.post("/entries", response_model=Entry)
async def create_entry(payload: EntryCreate, _user: User = Depends(require_admin)):
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")
    data = payload.dict()
    data["dance_style"] = normalize_dance_style(data.get("dance_style"))
    if not data.get("status"):
        data["status"] = "featured" if data.get("featured") else "approved"
    # Detect recurrence intent
    rec = data.get("recurrence") or {}
    has_recurrence = rec and rec.get("freq") not in {None, "", "none"}
    if has_recurrence:
        data["is_recurrence_master"] = True
    entry = Entry(**data)
    doc = entry.dict()
    await db.entries.insert_one(doc)
    if has_recurrence:
        created = await generate_occurrences(doc)
        logger.info("Created %s occurrences for master %s", created, doc["id"])
    return entry


@api_router.post("/entries/{entry_id}/regenerate-occurrences")
async def regenerate_occurrences(
    entry_id: str,
    _user: User = Depends(require_admin),
):
    """Regenerate missing occurrences for a recurrence master (used when the
    rolling 3-month window advances, or after editing the master's recurrence
    rule)."""
    master = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not master:
        raise HTTPException(status_code=404, detail="Entry not found")
    if not master.get("is_recurrence_master"):
        raise HTTPException(status_code=400, detail="Cette entrée n'est pas un maître de récurrence")
    created = await generate_occurrences(master)
    return {"ok": True, "created": created}


@api_router.put("/entries/{entry_id}", response_model=Entry)
async def update_entry(
    entry_id: str,
    payload: EntryCreate,
    scope: Optional[str] = "this",
    _user: User = Depends(require_admin),
):
    """Update an entry. For recurring events, `scope` controls the reach:
    - 'this' (default): only this occurrence
    - 'future': this occurrence and all following occurrences (same parent_id)
    - 'all': this + all siblings + master
    """
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")
    if scope not in {"this", "future", "all"}:
        raise HTTPException(status_code=400, detail="scope must be 'this' | 'future' | 'all'")
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    # Only update fields the client actually sent — preserves existing values
    update = payload.dict(exclude_unset=True)
    # Do not let scope updates mutate recurrence metadata on children
    if not existing.get("is_recurrence_master"):
        update.pop("recurrence", None)
    if "dance_style" in update:
        update["dance_style"] = normalize_dance_style(update["dance_style"])
    if "featured" in update:
        if update["featured"]:
            update["status"] = "featured"
        else:
            if existing.get("status") == "featured":
                update["status"] = "approved"

    # Determine ID set to update
    ids_to_update = [entry_id]
    if scope in {"future", "all"} and (existing.get("parent_id") or existing.get("is_recurrence_master")):
        master_id = existing.get("parent_id") or existing["id"]
        sibling_query: dict = {"$or": [{"id": master_id}, {"parent_id": master_id}]}
        siblings = await db.entries.find(sibling_query, {"_id": 0, "id": 1, "date": 1}).to_list(500)
        if scope == "future":
            ids_to_update = [s["id"] for s in siblings if s["date"] >= existing["date"]]
        else:  # all
            ids_to_update = [s["id"] for s in siblings]

    # For bulk updates we cannot change the date (would create collisions)
    bulk_update = {k: v for k, v in update.items() if k != "date"}
    if len(ids_to_update) > 1 and "date" in update:
        # Only the single entry gets the date change
        await db.entries.update_one({"id": entry_id}, {"$set": update})
        other_ids = [i for i in ids_to_update if i != entry_id]
        if other_ids and bulk_update:
            await db.entries.update_many({"id": {"$in": other_ids}}, {"$set": bulk_update})
    else:
        await db.entries.update_many({"id": {"$in": ids_to_update}}, {"$set": update})

    merged = {**existing, **update, "id": entry_id}
    if not merged.get("status"):
        merged["status"] = "approved"
    return Entry(**merged)


@api_router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: str,
    scope: Optional[str] = "this",
    _user: User = Depends(require_admin),
):
    """Delete an entry. `scope` semantics identical to update_entry."""
    if scope not in {"this", "future", "all"}:
        raise HTTPException(status_code=400, detail="scope must be 'this' | 'future' | 'all'")
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")

    ids_to_delete = [entry_id]
    if scope in {"future", "all"} and (existing.get("parent_id") or existing.get("is_recurrence_master")):
        master_id = existing.get("parent_id") or existing["id"]
        sibling_query: dict = {"$or": [{"id": master_id}, {"parent_id": master_id}]}
        siblings = await db.entries.find(sibling_query, {"_id": 0, "id": 1, "date": 1}).to_list(500)
        if scope == "future":
            ids_to_delete = [s["id"] for s in siblings if s["date"] >= existing["date"]]
        else:
            ids_to_delete = [s["id"] for s in siblings]

    result = await db.entries.delete_many({"id": {"$in": ids_to_delete}})
    return {"ok": True, "deleted": result.deleted_count}


@api_router.post("/entries/{entry_id}/duplicate", response_model=Entry)
async def duplicate_entry(entry_id: str, _user: User = Depends(require_admin)):
    """Duplicate an event. The new entry is a draft (status='pending') with all
    fields copied except the date which is cleared so the admin must set a new
    one before publishing."""
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    copy = dict(existing)
    copy.pop("_id", None)
    copy["id"] = str(uuid.uuid4())
    copy["status"] = "pending"
    copy["featured"] = False
    copy["source"] = "manual"
    copy["external_id"] = None
    copy["last_modified_at"] = None
    copy["created_at"] = datetime.now(timezone.utc)
    copy["date"] = ""
    copy["end_date"] = None
    copy["title"] = (existing.get("title") or "") + " (copie)"
    await db.entries.insert_one(copy)
    return Entry(**copy)


# ========= Teachers =========

@api_router.get("/teachers", response_model=List[Teacher])
async def list_teachers():
    items = await db.teachers.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return [Teacher(**t) for t in items]


@api_router.get("/teachers/{teacher_id}", response_model=Teacher)
async def get_teacher(teacher_id: str):
    t = await db.teachers.find_one({"id": teacher_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return Teacher(**t)


@api_router.post("/teachers", response_model=Teacher)
async def create_teacher(payload: TeacherCreate, _user: User = Depends(require_admin)):
    teacher = Teacher(**payload.dict())
    await db.teachers.insert_one(teacher.dict())
    return teacher


@api_router.put("/teachers/{teacher_id}", response_model=Teacher)
async def update_teacher(teacher_id: str, payload: TeacherCreate, _user: User = Depends(require_admin)):
    existing = await db.teachers.find_one({"id": teacher_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Teacher not found")
    update = payload.dict()
    await db.teachers.update_one({"id": teacher_id}, {"$set": update})
    merged = {**existing, **update, "id": teacher_id}
    return Teacher(**merged)


@api_router.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str, _user: User = Depends(require_admin)):
    await db.teachers.delete_one({"id": teacher_id})
    return {"ok": True}


# ========= Google Calendar iCal feed =========

DEFAULT_ICAL_URL = (
    "https://calendar.google.com/calendar/ical/"
    "18f1fd2cff2d67fce177c8dacaeb77df976c4906c5ee4661365bd38d6d216d33"
    "%40group.calendar.google.com/public/basic.ics"
)
ICAL_URL = os.environ.get("GOOGLE_CALENDAR_ICAL_URL", DEFAULT_ICAL_URL)
_ical_cache: dict = {"at": None, "data": []}
ICAL_CACHE_TTL = timedelta(minutes=10)


def _html_strip(text: str) -> str:
    # Google Calendar descriptions may contain basic HTML tags + entities
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_url(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"https?://[^\s<>\"]+", text)
    return m.group(0) if m else ""


def _to_iso_date(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date_type):
        return value.isoformat()
    return str(value)


def _to_time_str(start, end) -> str:
    def fmt(v):
        if isinstance(v, datetime):
            return v.strftime("%H:%M")
        return ""
    s = fmt(start)
    e = fmt(end)
    if s and e and s != "00:00":
        return f"{s} - {e}"
    if s and s != "00:00":
        return s
    return ""


def fetch_calendar_entries() -> List[dict]:
    now = datetime.now(timezone.utc)
    if _ical_cache["at"] and now - _ical_cache["at"] < ICAL_CACHE_TTL:
        return _ical_cache["data"]

    try:
        r = requests.get(ICAL_URL, timeout=10)
        r.raise_for_status()
    except Exception as e:
        logging.error("ical fetch failed: %s", e)
        # Return stale cache if any, else empty
        return _ical_cache.get("data") or []

    try:
        cal = Calendar.from_ical(r.content)
    except Exception as e:
        logging.error("ical parse failed: %s", e)
        return _ical_cache.get("data") or []

    items: List[dict] = []
    cutoff = (now - timedelta(days=1)).date()
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        try:
            dtstart = component.get("dtstart").dt
            dtend_prop = component.get("dtend")
            dtend = dtend_prop.dt if dtend_prop else dtstart
            summary = str(component.get("summary") or "").strip()
            raw_desc = str(component.get("description") or "")
            desc_clean = _html_strip(raw_desc)
            location = str(component.get("location") or "").strip()
            uid = str(component.get("uid") or uuid.uuid4())

            start_date = dtstart.date() if isinstance(dtstart, datetime) else dtstart
            if start_date < cutoff:
                continue

            # Venue vs address: take first line as venue, rest as address
            venue = ""
            address = location
            if "," in location:
                parts = [p.strip() for p in location.split(",", 1)]
                venue, address = parts[0], parts[1]

            items.append({
                "id": uid,
                "type": "agenda",
                "title": summary or "Événement",
                "date": _to_iso_date(dtstart),
                "end_date": _to_iso_date(dtend) if dtend and dtend != dtstart else None,
                "time": _to_time_str(dtstart, dtend),
                "venue": venue,
                "address": address,
                "description": desc_clean,
                "instructor": "",
                "ticket_link": _extract_url(raw_desc),
                "cover_photo": None,
                "featured": False,
                "created_at": now.isoformat(),
            })
        except Exception as e:
            logging.warning("skip event: %s", e)
            continue

    items.sort(key=lambda x: x["date"])
    _ical_cache["at"] = now
    _ical_cache["data"] = items
    return items


def _is_future_or_today(item: dict) -> bool:
    """An iCal item is considered upcoming if its date (or end_date for
    multi-day festivals) is >= today in Europe/Paris."""
    today = today_paris_str()
    d = item.get("date") or ""
    end = item.get("end_date") or ""
    return (d >= today) or (end >= today)


@api_router.get("/calendar/events")
async def calendar_events():
    """Return upcoming iCal events only (server-side filter)."""
    return [e for e in fetch_calendar_entries() if _is_future_or_today(e)]


# ========= Google Calendar Sync — pending queue =========

GCAL_SYNC_INTERVAL = int(os.environ.get("GCAL_SYNC_INTERVAL_SECONDS", "900"))  # 15 min default


async def sync_gcal_to_pending() -> dict:
    """Pull events from the Google Calendar iCal feed and upsert them into the
    Mongo `entries` collection with status=pending so the admin can validate
    them. Existing entries are matched by (source=gcal, external_id=ical UID).

    Returns a stats dict: {created, updated, unchanged}.
    """
    items = fetch_calendar_entries()
    stats = {"created": 0, "updated": 0, "unchanged": 0, "skipped": 0}
    now = datetime.now(timezone.utc)
    today = today_paris_str()

    for item in items:
        ical_uid = item.get("id") or ""
        if not ical_uid:
            stats["skipped"] += 1
            continue

        # Skip past events on ingestion (rule: "ne pas importer les events passés")
        d = item.get("date") or ""
        end = item.get("end_date") or ""
        if d < today and (not end or end < today):
            # Already-imported but now-past entries are kept in DB (for History tab)
            stats["skipped"] += 1
            continue

        existing = await db.entries.find_one(
            {"source": "gcal", "external_id": ical_uid}, {"_id": 0}
        )

        # Build a comparable signature of the relevant fields
        signature = {
            "title": item.get("title") or "",
            "date": item.get("date") or "",
            "end_date": item.get("end_date"),
            "time": item.get("time") or "",
            "venue": item.get("venue") or "",
            "address": item.get("address") or "",
            "description": item.get("description") or "",
            "ticket_link": item.get("ticket_link") or "",
        }

        if existing:
            # Skip already-rejected (admin chose to archive it)
            if existing.get("status") == "rejected":
                stats["skipped"] += 1
                continue
            existing_sig = {k: existing.get(k) or ("" if k != "end_date" else None) for k in signature}
            if existing_sig == signature:
                stats["unchanged"] += 1
                continue
            # Content changed → reset to pending for re-validation
            update = {**signature, "status": "pending", "last_modified_at": now}
            await db.entries.update_one(
                {"id": existing["id"]}, {"$set": update}
            )
            stats["updated"] += 1
        else:
            new_id = str(uuid.uuid4())
            doc = {
                "id": new_id,
                "type": "agenda",  # generic — admin reassigns during validation
                "title": signature["title"],
                "date": signature["date"],
                "end_date": signature["end_date"],
                "time": signature["time"],
                "venue": signature["venue"],
                "address": signature["address"],
                "description": signature["description"],
                "instructor": "",
                "teacher_id": None,
                "level": "",
                "price": "",
                "category": "",
                "ticket_link": signature["ticket_link"],
                "cover_photo": None,
                "featured": False,
                "status": "pending",
                "submitter_name": "Google Calendar",
                "submitter_email": "",
                "source": "gcal",
                "external_id": ical_uid,
                "last_modified_at": now,
                "created_at": now,
            }
            await db.entries.insert_one(doc)
            stats["created"] += 1

    logger.info("gcal sync done: %s", stats)
    return stats


@api_router.post("/calendar/sync")
async def trigger_gcal_sync(_user: User = Depends(require_admin)):
    """Manually trigger a Google Calendar sync. Admin only."""
    # Bust the cache so we always get fresh data
    _ical_cache["at"] = None
    stats = await sync_gcal_to_pending()
    return {"ok": True, **stats}


import asyncio  # noqa: E402


async def _gcal_periodic_loop():
    """Background task: re-sync GCal every GCAL_SYNC_INTERVAL seconds."""
    # First sync ~30s after startup so the app is ready
    await asyncio.sleep(30)
    while True:
        try:
            await sync_gcal_to_pending()
        except Exception as e:
            logger.exception("gcal periodic sync failed: %s", e)
        await asyncio.sleep(GCAL_SYNC_INTERVAL)


@app.on_event("startup")
async def _startup_tasks():
    asyncio.create_task(_gcal_periodic_loop())
    logger.info("Google Calendar background sync scheduled every %ss", GCAL_SYNC_INTERVAL)


# ========= Roles — Organisateur & Artiste signups =========


class OrganizerSignupInput(BaseModel):
    structure_name: str
    motivation: Optional[str] = ""
    phone: Optional[str] = ""
    website: Optional[str] = ""


class ArtistClaimInput(BaseModel):
    teacher_id: Optional[str] = None  # if claiming an existing teacher profile
    requested_name: Optional[str] = ""  # if asking the admin to create a new profile
    message: Optional[str] = ""


def _user_public(u: dict) -> dict:
    """Return only the public-facing fields of a user document."""
    return {
        "user_id": u.get("user_id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture", ""),
        "is_admin": u.get("is_admin", False),
        "role": u.get("role", "visiteur"),
        "status": u.get("status", "active"),
        "organizer": u.get("organizer"),
        "artist_teacher_id": u.get("artist_teacher_id"),
        "pending_artist_claim": u.get("pending_artist_claim"),
        "created_at": u.get("created_at"),
    }


@api_router.post("/auth/signup/organisateur")
async def signup_organisateur(
    payload: OrganizerSignupInput,
    user: User = Depends(require_authenticated),
):
    """An authenticated visitor becomes an organizer. Account starts as 'pending'.
    Once the admin approves it, status flips to 'active' and they can have their
    submitted events validated."""
    if not payload.structure_name.strip():
        raise HTTPException(status_code=400, detail="Nom de structure requis")
    # Admins keep being admins; they don't go through this flow
    if user.is_admin or user.role == "admin":
        raise HTTPException(status_code=400, detail="Compte admin déjà actif")
    organizer = {
        "structure_name": payload.structure_name.strip(),
        "motivation": (payload.motivation or "").strip(),
        "phone": (payload.phone or "").strip(),
        "website": (payload.website or "").strip(),
    }
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"role": "organisateur", "status": "pending", "organizer": organizer}},
    )
    fresh = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return _user_public(fresh)


@api_router.post("/auth/signup/artiste")
async def signup_artiste(
    payload: ArtistClaimInput,
    user: User = Depends(require_authenticated),
):
    """An authenticated visitor claims an artist profile.

    Two flows:
    - teacher_id provided → claim an existing Teacher (admin must validate the link)
    - requested_name provided → ask admin to create a new Teacher profile

    Status starts at 'pending' until admin approves the claim.
    """
    if user.is_admin or user.role == "admin":
        raise HTTPException(status_code=400, detail="Compte admin déjà actif")
    if not payload.teacher_id and not (payload.requested_name or "").strip():
        raise HTTPException(status_code=400, detail="Choisissez un profil ou saisissez un nom")

    claim: dict = {"message": (payload.message or "").strip()}
    if payload.teacher_id:
        teacher = await db.teachers.find_one({"id": payload.teacher_id}, {"_id": 0})
        if not teacher:
            raise HTTPException(status_code=404, detail="Profil artiste introuvable")
        # Refuse if another user already claimed this teacher (active link)
        existing_link = await db.users.find_one(
            {"artist_teacher_id": payload.teacher_id, "status": "active"}, {"_id": 0}
        )
        if existing_link and existing_link["user_id"] != user.user_id:
            raise HTTPException(status_code=400, detail="Ce profil est déjà revendiqué par un autre utilisateur")
        claim["teacher_id"] = payload.teacher_id
        claim["teacher_name"] = teacher.get("name", "")
    else:
        claim["requested_name"] = payload.requested_name.strip()

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "role": "artiste",
            "status": "pending",
            "pending_artist_claim": claim,
            "artist_teacher_id": None,
        }},
    )
    fresh = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return _user_public(fresh)


# ========= Organisateur — own dashboard =========


@api_router.get("/organisateur/entries", response_model=List[Entry])
async def organisateur_entries(user: User = Depends(require_role("organisateur"))):
    """List the entries submitted by the current organizer (any status)."""
    items = await db.entries.find({"submitted_by": user.user_id}, {"_id": 0}).to_list(500)
    items.sort(key=lambda e: e.get("created_at") or "", reverse=True)
    return [Entry(**e) for e in items]


class OrganizerEntryInput(BaseModel):
    type: str
    title: str
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = ""
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    instructor: Optional[str] = ""
    level: Optional[str] = ""
    price: Optional[str] = ""
    category: Optional[str] = ""
    dance_style: Optional[str] = None
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None


@api_router.post("/organisateur/entries", response_model=Entry)
async def organisateur_create_entry(
    payload: OrganizerEntryInput,
    user: User = Depends(require_role("organisateur")),
):
    """Submit a new event. Always lands as 'pending' regardless of organizer status."""
    if payload.type not in {"soiree", "workshop", "festival", "agenda"}:
        raise HTTPException(status_code=400, detail="Type invalide")
    if not payload.title.strip() or not payload.date.strip():
        raise HTTPException(status_code=400, detail="Titre et date requis")
    data = payload.dict()
    data["dance_style"] = normalize_dance_style(data.get("dance_style"))
    data["status"] = "pending"
    data["featured"] = False
    data["submitter_name"] = (user.organizer.structure_name if user.organizer else user.name) or user.name
    data["submitter_email"] = user.email
    data["submitted_by"] = user.user_id
    data["source"] = "organizer"
    entry = Entry(**data)
    await db.entries.insert_one(entry.dict())
    return entry


@api_router.put("/organisateur/entries/{entry_id}", response_model=Entry)
async def organisateur_update_entry(
    entry_id: str,
    payload: OrganizerEntryInput,
    user: User = Depends(require_role("organisateur")),
):
    """Update an own pending event. Approved/rejected events are read-only for organizer."""
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    if existing.get("submitted_by") != user.user_id:
        raise HTTPException(status_code=403, detail="Cet événement ne vous appartient pas")
    if existing.get("status") not in {"pending", None}:
        raise HTTPException(status_code=403, detail="Seuls les événements en attente sont modifiables")
    update = payload.dict(exclude_unset=True)
    if "dance_style" in update:
        update["dance_style"] = normalize_dance_style(update["dance_style"])
    update["status"] = "pending"
    await db.entries.update_one({"id": entry_id}, {"$set": update})
    merged = {**existing, **update, "id": entry_id}
    return Entry(**merged)


@api_router.delete("/organisateur/entries/{entry_id}")
async def organisateur_delete_entry(
    entry_id: str,
    user: User = Depends(require_role("organisateur")),
):
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    if existing.get("submitted_by") != user.user_id:
        raise HTTPException(status_code=403, detail="Cet événement ne vous appartient pas")
    if existing.get("status") not in {"pending", None}:
        raise HTTPException(status_code=403, detail="Seuls les événements en attente sont supprimables")
    await db.entries.delete_one({"id": entry_id})
    return {"ok": True}


# ========= Artiste — own profile + workshops =========


@api_router.get("/artiste/profile", response_model=Teacher)
async def artiste_profile(user: User = Depends(require_role("artiste"))):
    """Return the linked Teacher profile of the current artist."""
    if not user.artist_teacher_id:
        raise HTTPException(status_code=404, detail="Aucun profil artiste lié à ton compte")
    t = await db.teachers.find_one({"id": user.artist_teacher_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Profil artiste introuvable")
    return Teacher(**t)


class ArtisteProfileUpdate(BaseModel):
    bio: Optional[str] = None
    photo: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    dance_styles: Optional[List[str]] = None


@api_router.put("/artiste/profile", response_model=Teacher)
async def artiste_update_profile(
    payload: ArtisteProfileUpdate,
    user: User = Depends(require_role("artiste")),
):
    """Update the linked Teacher profile.
    Cannot change name or trusted_teacher flag — admin-only fields."""
    if not user.artist_teacher_id:
        raise HTTPException(status_code=404, detail="Aucun profil artiste lié à ton compte")
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Aucune modification")
    await db.teachers.update_one({"id": user.artist_teacher_id}, {"$set": update})
    t = await db.teachers.find_one({"id": user.artist_teacher_id}, {"_id": 0})
    return Teacher(**t)


@api_router.get("/artiste/workshops", response_model=List[Entry])
async def artiste_workshops(user: User = Depends(require_role("artiste"))):
    """All workshops linked to the artist (any status)."""
    if not user.artist_teacher_id:
        raise HTTPException(status_code=404, detail="Aucun profil artiste lié à ton compte")
    items = await db.entries.find(
        {"$or": [
            {"submitted_by": user.user_id},
            {"teacher_id": user.artist_teacher_id, "type": "workshop"},
        ]},
        {"_id": 0},
    ).to_list(500)
    items.sort(key=lambda e: e.get("date") or "", reverse=True)
    return [Entry(**e) for e in items]


class ArtisteWorkshopInput(BaseModel):
    title: str
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = ""
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    level: Optional[str] = ""
    price: Optional[str] = ""
    category: Optional[str] = ""
    dance_style: Optional[str] = None
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None


@api_router.post("/artiste/workshops", response_model=Entry)
async def artiste_create_workshop(
    payload: ArtisteWorkshopInput,
    user: User = Depends(require_role("artiste")),
):
    if not user.artist_teacher_id:
        raise HTTPException(status_code=404, detail="Aucun profil artiste lié à ton compte")
    if not payload.title.strip() or not payload.date.strip():
        raise HTTPException(status_code=400, detail="Titre et date requis")
    data = payload.dict()
    data["dance_style"] = normalize_dance_style(data.get("dance_style"))
    data["type"] = "workshop"
    data["teacher_id"] = user.artist_teacher_id
    data["instructor"] = user.name
    data["status"] = "pending"
    data["featured"] = False
    data["submitter_name"] = user.name
    data["submitter_email"] = user.email
    data["submitted_by"] = user.user_id
    data["source"] = "artiste"
    entry = Entry(**data)
    await db.entries.insert_one(entry.dict())
    return entry


@api_router.put("/artiste/workshops/{entry_id}", response_model=Entry)
async def artiste_update_workshop(
    entry_id: str,
    payload: ArtisteWorkshopInput,
    user: User = Depends(require_role("artiste")),
):
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Workshop introuvable")
    if existing.get("submitted_by") != user.user_id:
        raise HTTPException(status_code=403, detail="Ce workshop ne vous appartient pas")
    if existing.get("status") not in {"pending", None}:
        raise HTTPException(status_code=403, detail="Seuls les workshops en attente sont modifiables")
    update = payload.dict(exclude_unset=True)
    if "dance_style" in update:
        update["dance_style"] = normalize_dance_style(update["dance_style"])
    update["status"] = "pending"
    update["type"] = "workshop"
    update["teacher_id"] = user.artist_teacher_id
    await db.entries.update_one({"id": entry_id}, {"$set": update})
    merged = {**existing, **update, "id": entry_id}
    return Entry(**merged)


@api_router.delete("/artiste/workshops/{entry_id}")
async def artiste_delete_workshop(
    entry_id: str,
    user: User = Depends(require_role("artiste")),
):
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Workshop introuvable")
    if existing.get("submitted_by") != user.user_id:
        raise HTTPException(status_code=403, detail="Ce workshop ne vous appartient pas")
    if existing.get("status") not in {"pending", None}:
        raise HTTPException(status_code=403, detail="Seuls les workshops en attente sont supprimables")
    await db.entries.delete_one({"id": entry_id})
    return {"ok": True}


# ========= Admin — manage organisateur & artiste accounts =========


@api_router.get("/admin/users")
async def admin_list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    _admin: User = Depends(require_admin),
):
    """List all user accounts. Filter by role / status if provided."""
    query: dict = {}
    if role:
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Rôle invalide")
        query["role"] = role
    if status:
        if status not in VALID_USER_STATUSES:
            raise HTTPException(status_code=400, detail="Statut invalide")
        query["status"] = status
    users = await db.users.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich with submitted_entries counts (small N expected)
    out = []
    for u in users:
        public = _user_public(u)
        if u.get("role") in {"organisateur", "artiste"}:
            count = await db.entries.count_documents({"submitted_by": u.get("user_id")})
            pending = await db.entries.count_documents({"submitted_by": u.get("user_id"), "status": "pending"})
            public["submitted_entries"] = count
            public["pending_entries"] = pending
        out.append(public)
    return out


@api_router.post("/admin/users/{user_id}/approve-organizer")
async def admin_approve_organizer(user_id: str, _admin: User = Depends(require_admin)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if u.get("role") != "organisateur":
        raise HTTPException(status_code=400, detail="Cet utilisateur n'est pas un organisateur")
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "active"}})
    return {"ok": True, "user_id": user_id, "status": "active"}


@api_router.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, _admin: User = Depends(require_admin)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if u.get("is_admin") or u.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Impossible de suspendre un admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "suspended"}})
    # Also revoke active sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"ok": True, "user_id": user_id, "status": "suspended"}


@api_router.post("/admin/users/{user_id}/reactivate")
async def admin_reactivate_user(user_id: str, _admin: User = Depends(require_admin)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "active"}})
    return {"ok": True, "user_id": user_id, "status": "active"}


class ArtistApprovalInput(BaseModel):
    teacher_id: Optional[str] = None  # if admin creates a new teacher, pass its id here


@api_router.post("/admin/users/{user_id}/approve-artist")
async def admin_approve_artist(
    user_id: str,
    payload: ArtistApprovalInput,
    _admin: User = Depends(require_admin),
):
    """Approve an artist claim. Admin may provide a teacher_id (e.g. one they
    just created for an unlisted artist), otherwise we use the teacher_id from
    the original claim."""
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if u.get("role") != "artiste":
        raise HTTPException(status_code=400, detail="Cet utilisateur n'est pas un artiste")
    claim = u.get("pending_artist_claim") or {}
    teacher_id = payload.teacher_id or claim.get("teacher_id")
    if not teacher_id:
        raise HTTPException(status_code=400, detail="teacher_id requis (sélection ou création préalable)")
    teacher = await db.teachers.find_one({"id": teacher_id}, {"_id": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="Profil artiste introuvable")
    # Refuse if already linked to another active artist
    other = await db.users.find_one(
        {"artist_teacher_id": teacher_id, "status": "active", "user_id": {"$ne": user_id}},
        {"_id": 0},
    )
    if other:
        raise HTTPException(status_code=400, detail="Ce profil est déjà lié à un autre artiste actif")
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "active",
            "artist_teacher_id": teacher_id,
            "pending_artist_claim": None,
        }},
    )
    return {"ok": True, "user_id": user_id, "teacher_id": teacher_id, "status": "active"}


@api_router.post("/admin/users/{user_id}/reject-artist")
async def admin_reject_artist(user_id: str, _admin: User = Depends(require_admin)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": "visiteur",
            "status": "active",
            "pending_artist_claim": None,
            "artist_teacher_id": None,
        }},
    )
    return {"ok": True, "user_id": user_id}


app.include_router(api_router)


# ========= Analytics — events custom (P. 7a + 7b) =========


class AnalyticsEvent(BaseModel):
    """One user interaction logged in MongoDB."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # 'click_ticket' | 'click_share' | 'click_artist' | 'click_address'
               # | 'photo_download' | 'photo_tag' | 'click_featured' | 'pwa_install'
               # | 'view_entry' | 'view_artist'
    entry_id: Optional[str] = None
    teacher_id: Optional[str] = None
    photo_id: Optional[str] = None
    event_id: Optional[str] = None  # gallery event id
    channel: Optional[str] = None  # for click_share: 'whatsapp' | 'instagram' | etc
    url: Optional[str] = None
    referrer: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None  # anonymized hash, set client-side
    extra: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrackEventInput(BaseModel):
    name: str
    entry_id: Optional[str] = None
    teacher_id: Optional[str] = None
    photo_id: Optional[str] = None
    event_id: Optional[str] = None
    channel: Optional[str] = None
    url: Optional[str] = None
    visitor_id: Optional[str] = None
    extra: Optional[dict] = None


@api_router.post("/analytics/track")
async def track_event(payload: TrackEventInput, request: Request):
    """Public endpoint — anyone can log an analytics event. We trust the
    client name (whitelisted on the dashboard side anyway)."""
    if not payload.name or len(payload.name) > 64:
        raise HTTPException(status_code=400, detail="Invalid event name")
    doc = AnalyticsEvent(
        **payload.dict(),
        referrer=request.headers.get("referer") or "",
        user_agent=(request.headers.get("user-agent") or "")[:500],
    ).dict()
    await db.analytics_events.insert_one(doc)
    return {"ok": True}


def _period_to_after(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now - timedelta(days=7)
    if period == "90d":
        return now - timedelta(days=90)
    return now - timedelta(days=30)  # default 30d


@api_router.get("/analytics/dashboard")
async def analytics_dashboard(period: str = "30d", _user: User = Depends(require_admin)):
    """Aggregate stats for the admin dashboard.

    period: '7d' | '30d' | '90d'
    """
    after = _period_to_after(period)
    match = {"created_at": {"$gte": after}}
    coll = db.analytics_events

    # --- Visitors timeline (unique visitor_id per day) ---
    daily_pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {
                    "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "visitor": "$visitor_id",
                },
            }
        },
        {"$group": {"_id": "$_id.day", "uniques": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily = await coll.aggregate(daily_pipeline).to_list(200)

    # --- Today, week, month uniques ---
    today_start = datetime.combine(today_paris(), datetime.min.time(), tzinfo=PARIS_TZ).astimezone(timezone.utc)
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    month_start = datetime.now(timezone.utc) - timedelta(days=30)

    async def unique_count(after_dt: datetime) -> int:
        res = await coll.aggregate([
            {"$match": {"created_at": {"$gte": after_dt}}},
            {"$group": {"_id": "$visitor_id"}},
            {"$count": "total"},
        ]).to_list(1)
        return res[0]["total"] if res else 0

    visitors = {
        "today": await unique_count(today_start),
        "week": await unique_count(week_start),
        "month": await unique_count(month_start),
    }

    # --- Top entries (by view_entry events) ---
    top_views_p = [
        {"$match": {**match, "name": "view_entry", "entry_id": {"$ne": None}}},
        {"$group": {"_id": "$entry_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_views_raw = await coll.aggregate(top_views_p).to_list(20)
    entry_ids = [r["_id"] for r in top_views_raw]
    entries_idx = {e["id"]: e async for e in coll.database.entries.find({"id": {"$in": entry_ids}}, {"_id": 0, "id": 1, "title": 1, "type": 1, "date": 1})}
    top_views = [
        {
            "entry_id": r["_id"],
            "count": r["count"],
            "title": entries_idx.get(r["_id"], {}).get("title", "?"),
            "type": entries_idx.get(r["_id"], {}).get("type", "?"),
            "date": entries_idx.get(r["_id"], {}).get("date", ""),
        }
        for r in top_views_raw
    ]

    # --- Top tickets (click_ticket) ---
    top_tickets_p = [
        {"$match": {**match, "name": "click_ticket", "entry_id": {"$ne": None}}},
        {"$group": {"_id": "$entry_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_tickets_raw = await coll.aggregate(top_tickets_p).to_list(20)
    ticket_ids = [r["_id"] for r in top_tickets_raw]
    tickets_idx = {e["id"]: e async for e in coll.database.entries.find({"id": {"$in": ticket_ids}}, {"_id": 0, "id": 1, "title": 1, "type": 1})}
    top_tickets = [
        {
            "entry_id": r["_id"],
            "count": r["count"],
            "title": tickets_idx.get(r["_id"], {}).get("title", "?"),
            "type": tickets_idx.get(r["_id"], {}).get("type", "?"),
        }
        for r in top_tickets_raw
    ]

    # --- Top artists (click_artist) ---
    top_artists_p = [
        {"$match": {**match, "name": "click_artist", "teacher_id": {"$ne": None}}},
        {"$group": {"_id": "$teacher_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_artists_raw = await coll.aggregate(top_artists_p).to_list(20)
    artist_ids = [r["_id"] for r in top_artists_raw]
    artists_idx = {t["id"]: t async for t in coll.database.teachers.find({"id": {"$in": artist_ids}}, {"_id": 0, "id": 1, "name": 1})}
    top_artists = [
        {
            "teacher_id": r["_id"],
            "count": r["count"],
            "name": artists_idx.get(r["_id"], {}).get("name", "?"),
        }
        for r in top_artists_raw
    ]

    # --- Top gallery events (photo_download + photo_tag) ---
    top_gallery_p = [
        {"$match": {**match, "name": {"$in": ["photo_download", "photo_tag"]}}},
        {"$group": {"_id": "$event_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_gallery_raw = await coll.aggregate(top_gallery_p).to_list(20)

    # --- Channel breakdown for shares ---
    channels_p = [
        {"$match": {**match, "name": "click_share"}},
        {"$group": {"_id": "$channel", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    channels = await coll.aggregate(channels_p).to_list(50)

    # --- Conversion: views → ticket clicks per entry ---
    # Build a quick map for entries that have at least 1 view in period.
    conversions = []
    view_map = {r["_id"]: r["count"] for r in top_views_raw}
    ticket_map = {r["_id"]: r["count"] for r in top_tickets_raw}
    for eid in view_map:
        v = view_map.get(eid, 0)
        t = ticket_map.get(eid, 0)
        if v > 0:
            conversions.append({
                "entry_id": eid,
                "views": v,
                "tickets": t,
                "rate": round(t / v * 100, 1),
                "title": entries_idx.get(eid, {}).get("title", "?"),
            })
    conversions.sort(key=lambda x: x["rate"], reverse=True)

    # --- Featured (coup de cœur) performance ---
    featured_pipeline = [
        {"$match": {**match, "name": {"$in": ["click_featured", "click_ticket"]}}},
        {"$group": {"_id": {"name": "$name", "entry_id": "$entry_id"}, "count": {"$sum": 1}}},
    ]
    featured_raw = await coll.aggregate(featured_pipeline).to_list(500)
    featured_perf: dict = {}
    for r in featured_raw:
        eid = r["_id"]["entry_id"] or "_"
        featured_perf.setdefault(eid, {"impressions": 0, "tickets": 0})
        if r["_id"]["name"] == "click_featured":
            featured_perf[eid]["impressions"] += r["count"]
        elif r["_id"]["name"] == "click_ticket":
            featured_perf[eid]["tickets"] += r["count"]

    # Pull the entries that are still currently featured for context
    cur_featured = await db.entries.find({"status": "featured"}, {"_id": 0, "id": 1, "title": 1}).to_list(50)
    featured_summary = []
    for e in cur_featured:
        p = featured_perf.get(e["id"], {"impressions": 0, "tickets": 0})
        rate = round((p["tickets"] / p["impressions"]) * 100, 1) if p["impressions"] > 0 else 0
        featured_summary.append({
            "entry_id": e["id"],
            "title": e.get("title", "?"),
            "impressions": p["impressions"],
            "tickets": p["tickets"],
            "rate": rate,
        })
    featured_summary.sort(key=lambda x: x["impressions"], reverse=True)

    return {
        "period": period,
        "visitors": visitors,
        "daily": [{"date": d["_id"], "uniques": d["uniques"]} for d in daily],
        "top_views": top_views,
        "top_tickets": top_tickets,
        "top_artists": top_artists,
        "top_gallery": top_gallery_raw,
        "channels": [{"channel": c["_id"] or "(autre)", "count": c["count"]} for c in channels],
        "conversions": conversions[:10],
        "featured": featured_summary,
    }


# Re-include router so the analytics endpoints above are mounted
app.include_router(api_router)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
