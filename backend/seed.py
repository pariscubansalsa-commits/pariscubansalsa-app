"""Seed script to create a test admin user, session, and sample events."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

TEST_EMAIL = "admin.test@pariscubansalsa.dev"
TEST_USER_ID = "user_seeded_admin"
TEST_SESSION_TOKEN = "test_session_pcs_admin_000"


async def run():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    # Upsert admin user
    await db.users.update_one(
        {"email": TEST_EMAIL},
        {"$set": {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "name": "PCS Admin",
            "picture": "",
            "is_admin": True,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    # Upsert session
    await db.user_sessions.update_one(
        {"session_token": TEST_SESSION_TOKEN},
        {"$set": {
            "user_id": TEST_USER_ID,
            "session_token": TEST_SESSION_TOKEN,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    # Seed sample events only if none exist
    existing = await db.events.count_documents({})
    if existing == 0:
        samples = [
            {
                "id": str(uuid.uuid4()),
                "name": "La Bodeguita Night Vol. 14",
                "date": "2026-01-25",
                "description": "An unforgettable evening at Le Cabaret Sauvage — Cuban live band, rueda de casino, and dancers from all over Paris.",
                "cover_photo": "https://images.unsplash.com/photo-1754684223462-6344053b91df?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Milonga Havana",
                "date": "2025-12-14",
                "description": "Open-air social at Bastille. Salsa timba, son cubano, and a warm winter crowd.",
                "cover_photo": "https://images.pexels.com/photos/16763609/pexels-photo-16763609.jpeg?auto=compress&cs=tinysrgb&w=1200",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Rueda en el Parc",
                "date": "2025-07-06",
                "description": "Summer rueda session at Parc de la Villette — 60 dancers in a single circle.",
                "cover_photo": "https://images.pexels.com/photos/11362556/pexels-photo-11362556.jpeg?auto=compress&cs=tinysrgb&w=1200",
                "created_at": datetime.now(timezone.utc),
            },
        ]
        await db.events.insert_many(samples)
        print(f"Inserted {len(samples)} events")
    else:
        print(f"Skipped event seed — {existing} events already exist")

    print("Seed complete.")
    print(f"TEST SESSION TOKEN: {TEST_SESSION_TOKEN}")
    print(f"TEST ADMIN EMAIL: {TEST_EMAIL}")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
