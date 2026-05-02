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
class Entry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    level: Optional[str] = ""  # 'beginner' | 'intermediate' | 'advanced' | ''
    price: Optional[str] = ""  # free text e.g. "25€" or "Gratuit"
    category: Optional[str] = ""  # 'salsa' | 'afro-cuban' | 'rumba' | 'son' | 'rueda' | ''
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None
    featured: bool = False  # legacy: use status='featured' instead
    status: str = "approved"  # 'pending' | 'approved' | 'featured'
    submitter_name: Optional[str] = ""
    submitter_email: Optional[str] = ""
    source: str = "manual"  # 'manual' | 'gcal' | 'submission' | 'organizer'
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
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None
    featured: bool = False
    status: Optional[str] = None


class EntrySubmit(BaseModel):
    type: str
    title: str
    date: str
    time: Optional[str] = ""
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    instructor: Optional[str] = ""
    teacher_id: Optional[str] = None
    level: Optional[str] = ""
    price: Optional[str] = ""
    category: Optional[str] = ""
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None
    submitter_name: str
    submitter_email: str


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


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    is_admin: bool = False


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
    if not user or not user.is_admin:
        raise HTTPException(status_code=401, detail="Admin authentication required")
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
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "is_admin": admin_flag}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_admin": admin_flag,
            "created_at": datetime.now(timezone.utc),
        })

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

VALID_TYPES = {"agenda", "soiree", "workshop", "festival"}


@api_router.get("/entries", response_model=List[Entry])
async def list_entries(
    request: Request,
    type: Optional[str] = None,
    featured: Optional[bool] = None,
    status: Optional[str] = None,
    level: Optional[str] = None,
    category: Optional[str] = None,
    teacher_id: Optional[str] = None,
):
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
    if teacher_id:
        query["teacher_id"] = teacher_id
    if status:
        user = await get_current_user(request)
        if not user or not user.is_admin:
            raise HTTPException(status_code=401, detail="Admin only")
        # Override status filter for admin
        if isinstance(query.get("status"), dict) or "status" in query:
            query["status"] = status
        else:
            query["status"] = status
    elif "status" not in query:
        query["status"] = {"$in": ["approved", "featured"]}

    items = await db.entries.find(query, {"_id": 0}).to_list(1000)

    # Sort: featured first, then by date asc
    def sort_key(e):
        priority = 0 if e.get("status") == "featured" else 1
        return (priority, e.get("date") or "")
    items.sort(key=sort_key)

    return [Entry(**e) for e in items]


@api_router.post("/entries/submit", response_model=Entry)
async def submit_entry(payload: EntrySubmit):
    """Public endpoint: teachers/organizers submit an event for admin review."""
    if payload.type not in {"soiree", "workshop"}:
        raise HTTPException(status_code=400, detail="Seuls soirées et workshops sont acceptés")
    if not payload.submitter_name.strip() or not payload.submitter_email.strip():
        raise HTTPException(status_code=400, detail="Nom et email requis")

    data = payload.dict()

    # Trusted teacher → auto-approve
    auto_approved = False
    if data.get("teacher_id"):
        teacher = await db.teachers.find_one({"id": data["teacher_id"]}, {"_id": 0})
        if teacher and teacher.get("trusted_teacher"):
            auto_approved = True

    data["status"] = "approved" if auto_approved else "pending"
    data["featured"] = False
    data["end_date"] = None
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
    (soiree | concert | workshop | festival) — used when validating GCal imports."""
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
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
    items = await db.entries.find(
        {
            "teacher_id": teacher_id,
            "type": "workshop",
            "status": {"$in": ["approved", "featured"]},
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
    entry = Entry(**payload.dict())
    await db.entries.insert_one(entry.dict())
    return entry


@api_router.put("/entries/{entry_id}", response_model=Entry)
async def update_entry(entry_id: str, payload: EntryCreate, _user: User = Depends(require_admin)):
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")
    existing = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    update = payload.dict(exclude_none=True)
    # If the client sends featured=True, ensure status is featured (and vice versa)
    if "featured" in update:
        if update["featured"]:
            update["status"] = "featured"
        else:
            # only downgrade to approved if currently featured
            if existing.get("status") == "featured":
                update["status"] = "approved"
    await db.entries.update_one({"id": entry_id}, {"$set": update})
    merged = {**existing, **update, "id": entry_id}
    if not merged.get("status"):
        merged["status"] = "approved"
    return Entry(**merged)


@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, _user: User = Depends(require_admin)):
    await db.entries.delete_one({"id": entry_id})
    return {"ok": True}


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


@api_router.get("/calendar/events")
async def calendar_events():
    return fetch_calendar_entries()


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

    for item in items:
        ical_uid = item.get("id") or ""
        if not ical_uid:
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
