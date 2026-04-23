"""Add featured=true to a few existing entries with nice cover photos."""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

FEATURED_COVERS = {
    # title -> cover_photo URL
    "Soirée Callesol": "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=900&q=80",
    "Cabeza Loca": "https://images.unsplash.com/photo-1545959570-a94084071b5e?w=900&q=80",
    "CUBAILA Night": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=900&q=80",
    "Stage rueda de casino — niveau intermédiaire": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=80",
    "Paris Salsa Congress": "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=900&q=80",
}


async def run():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    count = 0
    for title, cover in FEATURED_COVERS.items():
        res = await db.entries.update_one(
            {"title": title},
            {"$set": {"featured": True, "cover_photo": cover}},
        )
        count += res.modified_count
    # Others → featured = False (idempotency)
    await db.entries.update_many(
        {"title": {"$nin": list(FEATURED_COVERS.keys())}},
        {"$set": {"featured": False}},
    )
    print(f"Marked {count} entries as featured (+ covers)")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
