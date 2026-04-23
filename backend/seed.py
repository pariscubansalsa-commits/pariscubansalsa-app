"""Seed test admin + sample data across all content types."""
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

    # Admin user + session
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

    # Gallery events - keep existing
    if await db.events.count_documents({}) == 0:
        await db.events.insert_many([
            {
                "id": str(uuid.uuid4()),
                "name": "La Bodeguita Night Vol. 14",
                "date": "2026-01-25",
                "description": "Une soirée inoubliable au Cabaret Sauvage — orchestre cubain, rueda de casino, danseurs de toute l'Île-de-France.",
                "cover_photo": "https://images.unsplash.com/photo-1754684223462-6344053b91df?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Milonga Havana",
                "date": "2025-12-14",
                "description": "Social en plein air à Bastille. Salsa timba, son cubano, foule chaleureuse.",
                "cover_photo": "https://images.pexels.com/photos/16763609/pexels-photo-16763609.jpeg?auto=compress&cs=tinysrgb&w=1200",
                "created_at": datetime.now(timezone.utc),
            },
        ])

    # Entries - agenda / soirée / workshop / festival
    if await db.entries.count_documents({}) == 0:
        entries = [
            # AGENDA
            {
                "id": str(uuid.uuid4()), "type": "agenda",
                "title": "Salsa en plein air — Parc de la Villette",
                "date": "2026-03-14", "time": "19:00 - 23:00",
                "venue": "Parc de la Villette", "address": "211 Av. Jean Jaurès, 75019 Paris",
                "description": "Session gratuite en plein air avec DJ Rafa. Apportez vos chaussures !",
                "ticket_link": "", "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()), "type": "agenda",
                "title": "Concert Los Van Van — Salle Pleyel",
                "date": "2026-04-02", "time": "20:30",
                "venue": "Salle Pleyel", "address": "252 Rue du Faubourg Saint-Honoré, 75008 Paris",
                "description": "L'orchestre légendaire cubain de passage à Paris pour une date exceptionnelle.",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
            # SOIRÉE
            {
                "id": str(uuid.uuid4()), "type": "soiree",
                "title": "Soirée Callesol",
                "date": "2026-03-21", "time": "21:00 - 03:00",
                "venue": "La Scala", "address": "13 Bd de Strasbourg, 75010 Paris",
                "description": "La soirée mensuelle de référence. DJ Pablo aux platines, cours d'initiation à 21h.",
                "ticket_link": "https://www.helloasso.com/associations/callesol",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()), "type": "soiree",
                "title": "Cabeza Loca",
                "date": "2026-03-28", "time": "22:00 - 04:00",
                "venue": "Le Cabaret Sauvage", "address": "59 Bd Macdonald, 75019 Paris",
                "description": "Ambiance timba garantie. Show d'ouverture par la compagnie CUBAILA.",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()), "type": "soiree",
                "title": "CUBAILA Night",
                "date": "2026-04-11", "time": "21:30 - 03:00",
                "venue": "Petit Bain", "address": "7 Port de la Gare, 75013 Paris",
                "description": "Péniche, timba, son cubano sur la Seine.",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
            # WORKSHOP
            {
                "id": str(uuid.uuid4()), "type": "workshop",
                "title": "Stage rueda de casino — niveau intermédiaire",
                "date": "2026-03-15", "time": "14:00 - 17:00",
                "venue": "Studio Harmonic", "address": "4 Rue de la Main d'Or, 75011 Paris",
                "description": "3h de rueda intensive. 30 figures au programme, finale en grand cercle.",
                "instructor": "Yosmel Hernández",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()), "type": "workshop",
                "title": "Masterclass afro-cubain",
                "date": "2026-04-05", "time": "10:00 - 13:00",
                "venue": "Studio Bleu", "address": "10 Rue du Faubourg Poissonnière, 75010 Paris",
                "description": "Initiation aux orishas : Elegua, Yemaya, Ochun. Pour danseurs tous niveaux.",
                "instructor": "Yanet Fuentes",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
            # FESTIVAL
            {
                "id": str(uuid.uuid4()), "type": "festival",
                "title": "Paris Salsa Congress",
                "date": "2026-05-29", "end_date": "2026-06-01",
                "venue": "Paris Marriott Rive Gauche", "address": "17 Bd Saint-Jacques, 75014 Paris",
                "description": "4 jours de salsa cubaine, bachata et kizomba. 40 artistes internationaux.",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()), "type": "festival",
                "title": "Baila en Cuba — Festival",
                "date": "2026-07-10", "end_date": "2026-07-17",
                "venue": "La Havane", "address": "Cuba",
                "description": "Le festival de référence à La Havane. Cours quotidiens, soirées, excursions.",
                "ticket_link": "https://www.helloasso.com/",
                "created_at": datetime.now(timezone.utc),
            },
        ]
        await db.entries.insert_many(entries)
        print(f"Inserted {len(entries)} entries")

    # Teachers
    if await db.teachers.count_documents({}) == 0:
        teachers = [
            {
                "id": str(uuid.uuid4()),
                "name": "Yosmel Hernández",
                "bio": "Danseur et chorégraphe cubain installé à Paris depuis 2015. Spécialiste de la rueda de casino et du son cubano.",
                "photo": None,
                "instagram": "@yosmel_dance",
                "facebook": "",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Yanet Fuentes",
                "bio": "Professeure d'afro-cubain et de salsa. Formée à l'École Nationale d'Art de Cuba. 15 ans d'enseignement.",
                "photo": None,
                "instagram": "@yanet_afro",
                "facebook": "",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Pablo Ramos",
                "bio": "DJ et danseur. Résident de la soirée Callesol. Collectionneur de timba depuis 20 ans.",
                "photo": None,
                "instagram": "@dj_pablo_pcs",
                "facebook": "",
                "created_at": datetime.now(timezone.utc),
            },
        ]
        await db.teachers.insert_many(teachers)
        print(f"Inserted {len(teachers)} teachers")

    print("Seed complete.")
    print(f"TEST SESSION TOKEN: {TEST_SESSION_TOKEN}")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
