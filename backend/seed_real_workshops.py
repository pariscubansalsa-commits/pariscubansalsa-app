"""Seed real upcoming workshops attached to real Paris Cuban Salsa teachers.
Sets them as 'featured' so they appear at the top of teacher profiles.

Requested by user:
- Bootcamp Lady Cuban Style
- Formation intensive Lorenys y Manolo
- Stages OBINISA Relámpago
"""
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


async def upsert_teacher(db, name, bio, instagram, facebook, dance_styles, trusted=True):
    """Find by name, create or update."""
    existing = await db.teachers.find_one({"name": name}, {"_id": 0})
    if existing:
        await db.teachers.update_one(
            {"id": existing["id"]},
            {"$set": {
                "bio": bio,
                "instagram": instagram,
                "facebook": facebook,
                "dance_styles": dance_styles,
                "trusted_teacher": trusted,
            }},
        )
        return existing["id"]
    tid = str(uuid.uuid4())
    await db.teachers.insert_one({
        "id": tid,
        "name": name,
        "bio": bio,
        "photo": None,
        "instagram": instagram,
        "facebook": facebook,
        "dance_styles": dance_styles,
        "trusted_teacher": trusted,
        "created_at": datetime.now(timezone.utc),
    })
    return tid


async def upsert_workshop(db, title, date, time, venue, address, description,
                          instructor, teacher_id, level, category, price,
                          ticket_link, status="featured"):
    """Find by title, replace or create."""
    existing = await db.entries.find_one({"title": title, "type": "workshop"}, {"_id": 0})
    payload = {
        "type": "workshop",
        "title": title,
        "date": date,
        "end_date": None,
        "time": time,
        "venue": venue,
        "address": address,
        "description": description,
        "instructor": instructor,
        "teacher_id": teacher_id,
        "level": level,
        "price": price,
        "category": category,
        "ticket_link": ticket_link,
        "cover_photo": None,
        "featured": status == "featured",
        "status": status,
        "submitter_name": "",
        "submitter_email": "",
    }
    if existing:
        await db.entries.update_one({"id": existing["id"]}, {"$set": payload})
        return existing["id"]
    eid = str(uuid.uuid4())
    payload["id"] = eid
    payload["created_at"] = datetime.now(timezone.utc)
    await db.entries.insert_one(payload)
    return eid


async def run():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    # Update existing teachers with dance_styles + trusted
    existing_seed = [
        ("Yosmel Hernández", ["Salsa cubaine", "Rueda de casino", "Son cubano"], True),
        ("Yanet Fuentes", ["Afro-cubain", "Rumba", "Lady Cuban Style"], True),
        ("Pablo Ramos", ["Salsa cubaine", "Son cubano"], False),
    ]
    for name, styles, trusted in existing_seed:
        await db.teachers.update_one(
            {"name": name},
            {"$set": {"dance_styles": styles, "trusted_teacher": trusted}},
        )

    # 1. Lady Cuban Style — solo féminin, par Yanet Fuentes (already exists)
    yanet = await db.teachers.find_one({"name": "Yanet Fuentes"}, {"_id": 0})
    if not yanet:
        # safety net
        yanet_id = await upsert_teacher(
            db,
            name="Yanet Fuentes",
            bio="Professeure d'afro-cubain, rumba et Lady Cuban Style. Formée à l'École Nationale d'Art de Cuba.",
            instagram="@yanet_afro",
            facebook="",
            dance_styles=["Afro-cubain", "Rumba", "Lady Cuban Style"],
            trusted=True,
        )
    else:
        yanet_id = yanet["id"]

    # 2. Lorenys & Manolo — duo
    lorenys_id = await upsert_teacher(
        db,
        name="Lorenys & Manolo",
        bio="Duo cubain de référence à Paris. Lorenys, danseuse de la compagnie Folklórico Nacional, et Manolo, percussionniste et danseur de timba, partagent leur expertise en salsa cubaine, son et rumba.",
        instagram="@lorenys_y_manolo",
        facebook="https://www.facebook.com/LorenysYManolo",
        dance_styles=["Salsa cubaine", "Son cubano", "Rumba"],
        trusted=True,
    )

    # 3. OBINISA Relámpago — compagnie / collectif
    obinisa_id = await upsert_teacher(
        db,
        name="OBINISA Relámpago",
        bio="Compagnie cubaine OBINISA — formation Relámpago dirigée par les artistes de la troupe : transmission du folklore afro-cubain et de la rumba authentique avec un focus haute intensité.",
        instagram="@obinisa_relampago",
        facebook="",
        dance_styles=["Afro-cubain", "Rumba", "Folklore"],
        trusted=True,
    )

    # ---- 3 featured workshops ----
    await upsert_workshop(
        db,
        title="Bootcamp Lady Cuban Style",
        date="2026-06-14",
        time="11:00 - 17:00",
        venue="Studio Harmonic",
        address="4 Rue de la Main d'Or, 75011 Paris",
        description=(
            "Bootcamp 100% féminin animé par Yanet Fuentes. 6h intensives autour du "
            "Lady Cuban Style : posture, isolations, féminité cubaine, choré finale."
        ),
        instructor="Yanet Fuentes",
        teacher_id=yanet_id,
        level="intermediate",
        category="other",
        price="65€",
        ticket_link="https://www.helloasso.com/",
        status="featured",
    )

    await upsert_workshop(
        db,
        title="Formation intensive Lorenys y Manolo",
        date="2026-05-30",
        time="10:30 - 18:00",
        venue="Centre Momboye",
        address="25 Rue Boyer, 75020 Paris",
        description=(
            "Stage week-end avec le duo Lorenys & Manolo. Salsa cubaine partner work, "
            "structures de son et bases de rumba. Tous niveaux à partir d'intermédiaire."
        ),
        instructor="Lorenys & Manolo",
        teacher_id=lorenys_id,
        level="intermediate",
        category="salsa",
        price="95€",
        ticket_link="https://www.helloasso.com/",
        status="featured",
    )

    await upsert_workshop(
        db,
        title="Stage OBINISA Relámpago",
        date="2026-07-04",
        time="14:00 - 19:00",
        venue="La Bellevilloise",
        address="19-21 Rue Boyer, 75020 Paris",
        description=(
            "5h non-stop de folklore afro-cubain et rumba authentique avec la compagnie "
            "OBINISA. Format Relámpago : haute intensité, immersion totale."
        ),
        instructor="OBINISA Relámpago",
        teacher_id=obinisa_id,
        level="advanced",
        category="afro-cuban",
        price="80€",
        ticket_link="https://www.helloasso.com/",
        status="featured",
    )

    print("Seed real workshops complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
