from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta


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
    type: str  # 'agenda' | 'soiree' | 'workshop' | 'festival'
    title: str
    date: str  # ISO start date
    end_date: Optional[str] = None  # for festivals
    time: Optional[str] = ""  # "20:30" or "14:00 - 17:00"
    venue: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    instructor: Optional[str] = ""  # for workshops
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None
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
    ticket_link: Optional[str] = ""
    cover_photo: Optional[str] = None


class Teacher(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bio: Optional[str] = ""
    photo: Optional[str] = None
    instagram: Optional[str] = ""
    facebook: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeacherCreate(BaseModel):
    name: str
    bio: Optional[str] = ""
    photo: Optional[str] = None
    instagram: Optional[str] = ""
    facebook: Optional[str] = ""


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
async def list_entries(type: Optional[str] = None):
    query: dict = {}
    if type:
        if type not in VALID_TYPES:
            raise HTTPException(status_code=400, detail="Invalid type")
        query["type"] = type
    items = await db.entries.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    return [Entry(**e) for e in items]


@api_router.get("/entries/{entry_id}", response_model=Entry)
async def get_entry(entry_id: str):
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return Entry(**e)


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
    update = payload.dict()
    await db.entries.update_one({"id": entry_id}, {"$set": update})
    merged = {**existing, **update, "id": entry_id}
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
