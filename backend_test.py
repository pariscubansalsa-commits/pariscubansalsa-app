"""BLOC 2+3+4 backend test suite — security & user roles for Paris Cuban Salsa.

Covers:
1. require_role / require_admin returns 403 vs 401 vs 200 correctly
2. Organisateur full CRUD on /api/organisateur/entries
3. Approval blocking when organizer status=pending (French message)
4. Admin user management (list, approve-organizer, suspend, reactivate)
   - suspend on admin must 400; suspending must revoke sessions
5. Artiste profile + workshops CRUD; PUT must NOT mutate name or trusted_teacher
6. Artist claim flow: signup-artiste → approve-artist (with teacher_id) → reject-artist
7. Regression: /api/auth/me admin includes role+status; public /api/entries no leak
"""

import os
import sys
import uuid
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BACKEND_URL = os.environ.get(
    "BACKEND_URL",
    "https://rhythm-frames-3.preview.emergentagent.com",
)
API = f"{BACKEND_URL.rstrip('/')}/api"

ADMIN_TOKEN = "test_session_pcs_admin_000"
ORG_TOKEN = "test_session_pcs_org_000"
ART_TOKEN = "test_session_pcs_art_000"

ADMIN_USER_ID = "user_seeded_admin"
ORG_USER_ID = "user_seeded_organizer"
ART_USER_ID = "user_seeded_artiste"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mc = MongoClient(MONGO_URL)
mdb = mc[DB_NAME]


def H(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


passed = []
failed = []


def check(label, cond, detail=""):
    if cond:
        passed.append(label)
        print(f"  ✅ {label}")
    else:
        failed.append((label, detail))
        print(f"  ❌ {label} — {detail}")


def section(title):
    print(f"\n=== {title} ===")


def reset_org_to_pending():
    mdb.users.update_one({"user_id": ORG_USER_ID}, {"$set": {"status": "pending"}})


def reset_admin_session():
    mdb.user_sessions.update_one(
        {"session_token": ADMIN_TOKEN},
        {"$set": {
            "user_id": ADMIN_USER_ID,
            "session_token": ADMIN_TOKEN,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        }},
        upsert=True,
    )


def reset_art_session():
    mdb.user_sessions.update_one(
        {"session_token": ART_TOKEN},
        {"$set": {
            "user_id": ART_USER_ID,
            "session_token": ART_TOKEN,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        }},
        upsert=True,
    )


def reset_org_session():
    mdb.user_sessions.update_one(
        {"session_token": ORG_TOKEN},
        {"$set": {
            "user_id": ORG_USER_ID,
            "session_token": ORG_TOKEN,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        }},
        upsert=True,
    )


# Section 1 — Security
def test_security():
    section("1. Security — require_role / require_admin (401 vs 403 vs 200)")
    r = requests.get(f"{API}/admin/users")
    check("GET /admin/users no-auth -> 401", r.status_code == 401, f"got {r.status_code} {r.text[:120]}")

    r = requests.get(f"{API}/admin/users", headers=H(ORG_TOKEN))
    body = r.text
    check("GET /admin/users as organisateur -> 403",
          r.status_code == 403, f"got {r.status_code} body={body[:150]}")
    check("403 detail mentions Admin role required",
          "Admin role required" in body, f"body={body[:200]}")

    r = requests.get(f"{API}/organisateur/entries", headers=H(ART_TOKEN))
    check("GET /organisateur/entries as artiste -> 403",
          r.status_code == 403, f"got {r.status_code} {r.text[:120]}")

    r = requests.get(f"{API}/artiste/profile", headers=H(ORG_TOKEN))
    check("GET /artiste/profile as organisateur -> 403",
          r.status_code == 403, f"got {r.status_code} {r.text[:120]}")

    r = requests.get(f"{API}/admin/users", headers=H(ADMIN_TOKEN))
    check("GET /admin/users as admin -> 200",
          r.status_code == 200, f"got {r.status_code} {r.text[:120]}")

    r = requests.get(f"{API}/organisateur/entries")
    check("GET /organisateur/entries no-auth -> 401",
          r.status_code == 401, f"got {r.status_code}")

    r = requests.get(f"{API}/artiste/profile")
    check("GET /artiste/profile no-auth -> 401",
          r.status_code == 401, f"got {r.status_code}")


created_org_entry_ids = []


def test_organisateur_crud():
    section("2. Organisateur CRUD on /api/organisateur/entries")
    reset_org_to_pending()

    r = requests.get(f"{API}/organisateur/entries", headers=H(ORG_TOKEN))
    check("GET /organisateur/entries -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:120]}")

    body = {
        "type": "soiree",
        "title": "BLOC2 Test Soirée Callesol",
        "date": "2026-12-01",
        "venue": "La Scala (test)",
    }
    r = requests.post(f"{API}/organisateur/entries", headers=H(ORG_TOKEN), json=body)
    ok_create = r.status_code in (200, 201)
    check("POST /organisateur/entries -> 200/201",
          ok_create, f"{r.status_code} {r.text[:200]}")
    if not ok_create:
        return
    created = r.json()
    created_org_entry_ids.append(created["id"])
    check("created entry status=pending", created.get("status") == "pending",
          f"status={created.get('status')}")
    check("created entry submitted_by=user_seeded_organizer",
          created.get("submitted_by") == ORG_USER_ID,
          f"submitted_by={created.get('submitted_by')}")
    check("created entry source=organizer", created.get("source") == "organizer",
          f"source={created.get('source')}")

    entry_id = created["id"]
    r = requests.put(
        f"{API}/organisateur/entries/{entry_id}",
        headers=H(ORG_TOKEN),
        json={**body, "title": "BLOC2 Test Soirée Callesol (modifié)"},
    )
    check("PUT /organisateur/entries/{id} (pending) -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("PUT keeps status=pending",
              r.json().get("status") == "pending",
              f"status={r.json().get('status')}")

    r = requests.delete(f"{API}/organisateur/entries/{entry_id}", headers=H(ORG_TOKEN))
    check("DELETE /organisateur/entries/{id} (pending) -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200 and entry_id in created_org_entry_ids:
        created_org_entry_ids.remove(entry_id)


def test_approval_blocking():
    section("3. Approval blocking when organizer status=pending")
    reset_org_to_pending()

    body = {
        "type": "soiree",
        "title": "BLOC3 Test soirée à valider",
        "date": "2026-12-08",
        "venue": "Le Cabaret Sauvage (test)",
    }
    r = requests.post(f"{API}/organisateur/entries", headers=H(ORG_TOKEN), json=body)
    if r.status_code not in (200, 201):
        check("BLOC3 setup create entry", False, f"{r.status_code} {r.text[:200]}")
        return
    entry_id = r.json()["id"]
    created_org_entry_ids.append(entry_id)

    r = requests.post(f"{API}/entries/{entry_id}/approve", headers=H(ADMIN_TOKEN))
    check("approve while org pending -> 400",
          r.status_code == 400, f"{r.status_code} {r.text[:300]}")
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    check("FR message mentions 'compte de l'organisateur/artiste n'est pas encore approuvé'",
          "compte de l'organisateur/artiste n'est pas encore approuvé" in detail,
          f"detail={detail!r}")

    r = requests.post(f"{API}/admin/users/{ORG_USER_ID}/approve-organizer",
                      headers=H(ADMIN_TOKEN))
    check("POST approve-organizer -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("approve-organizer returns status=active",
              r.json().get("status") == "active",
              f"resp={r.text[:200]}")

    r = requests.post(f"{API}/entries/{entry_id}/approve", headers=H(ADMIN_TOKEN))
    check("approve entry after org active -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("approved entry status=approved",
              r.json().get("status") == "approved",
              f"status={r.json().get('status')}")

    r = requests.put(
        f"{API}/organisateur/entries/{entry_id}",
        headers=H(ORG_TOKEN),
        json={**body, "title": "BLOC3 Test (tentative modif après approbation)"},
    )
    check("PUT on approved entry as org -> 403",
          r.status_code == 403, f"{r.status_code} {r.text[:300]}")
    if r.status_code == 403:
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        check("403 detail = 'Seuls les événements en attente sont modifiables'",
              "Seuls les événements en attente sont modifiables" in detail,
              f"detail={detail!r}")


def test_admin_user_mgmt():
    section("4. Admin user management")

    r = requests.get(f"{API}/admin/users?role=organisateur", headers=H(ADMIN_TOKEN))
    check("GET /admin/users?role=organisateur -> 200",
          r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        users = r.json()
        org = next((u for u in users if u.get("user_id") == ORG_USER_ID), None)
        check("admin/users includes seeded organizer", org is not None,
              f"users={[u.get('user_id') for u in users][:5]}")
        if org:
            check("organizer entry has status field",
                  "status" in org, f"keys={list(org.keys())}")
            check("organizer.organizer.structure_name present",
                  isinstance(org.get("organizer"), dict)
                  and "structure_name" in (org.get("organizer") or {}),
                  f"organizer={org.get('organizer')}")
            check("organizer has submitted_entries field",
                  "submitted_entries" in org, f"keys={list(org.keys())}")
            check("organizer has pending_entries field",
                  "pending_entries" in org, f"keys={list(org.keys())}")

    r = requests.post(f"{API}/admin/users/{ADMIN_USER_ID}/suspend",
                      headers=H(ADMIN_TOKEN))
    check("suspend admin -> 400", r.status_code == 400,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 400:
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        check("FR message 'Impossible de suspendre un admin'",
              "Impossible de suspendre un admin" in detail,
              f"detail={detail!r}")

    r = requests.post(f"{API}/admin/users/{ORG_USER_ID}/suspend",
                      headers=H(ADMIN_TOKEN))
    check("suspend organizer -> 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("suspended user status=suspended",
              r.json().get("status") == "suspended",
              f"resp={r.text[:200]}")

    r = requests.get(f"{API}/auth/me", headers=H(ORG_TOKEN))
    check("suspended org Bearer is invalid (-> 401)",
          r.status_code == 401, f"{r.status_code} {r.text[:120]}")

    r = requests.post(f"{API}/admin/users/{ORG_USER_ID}/reactivate",
                      headers=H(ADMIN_TOKEN))
    check("reactivate organizer -> 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("reactivated user status=active",
              r.json().get("status") == "active",
              f"resp={r.text[:200]}")

    reset_org_session()


artist_workshop_ids = []
artiste_original_profile = None


def test_artiste_flow():
    section("5. Artiste profile + workshops CRUD")
    global artiste_original_profile

    r = requests.get(f"{API}/artiste/profile", headers=H(ART_TOKEN))
    check("GET /artiste/profile -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return
    artiste_original_profile = r.json()
    teacher_id = artiste_original_profile["id"]
    original_name = artiste_original_profile.get("name")
    original_trusted = artiste_original_profile.get("trusted_teacher", False)

    payload = {
        "bio": "hola — bio mise à jour par BLOC4 test",
        "name": "HACKER NAME (should be ignored)",
        "trusted_teacher": True,
    }
    r = requests.put(f"{API}/artiste/profile", headers=H(ART_TOKEN), json=payload)
    check("PUT /artiste/profile -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check("bio persisted", body.get("bio") == payload["bio"],
              f"bio={body.get('bio')!r}")
        check("name NOT mutated", body.get("name") == original_name,
              f"name={body.get('name')!r} expected {original_name!r}")
        check("trusted_teacher NOT mutated",
              body.get("trusted_teacher") == original_trusted,
              f"trusted_teacher={body.get('trusted_teacher')} expected {original_trusted}")

    r = requests.get(f"{API}/artiste/workshops", headers=H(ART_TOKEN))
    check("GET /artiste/workshops -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    body = {"title": "BLOC4 Atelier rueda Test", "date": "2026-12-15"}
    r = requests.post(f"{API}/artiste/workshops", headers=H(ART_TOKEN), json=body)
    check("POST /artiste/workshops -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return
    ws = r.json()
    artist_workshop_ids.append(ws["id"])
    check("workshop status=pending", ws.get("status") == "pending",
          f"status={ws.get('status')}")
    check("workshop type=workshop", ws.get("type") == "workshop",
          f"type={ws.get('type')}")
    check("workshop teacher_id == artist_teacher_id",
          ws.get("teacher_id") == teacher_id,
          f"teacher_id={ws.get('teacher_id')} expected {teacher_id}")
    check("workshop submitted_by=user_seeded_artiste",
          ws.get("submitted_by") == ART_USER_ID,
          f"submitted_by={ws.get('submitted_by')}")
    check("workshop source=artiste", ws.get("source") == "artiste",
          f"source={ws.get('source')}")

    ws_id = ws["id"]
    r = requests.put(
        f"{API}/artiste/workshops/{ws_id}",
        headers=H(ART_TOKEN),
        json={"title": "BLOC4 Atelier rueda Test (modifié)", "date": "2026-12-16"},
    )
    check("PUT /artiste/workshops/{id} (pending) -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    r = requests.delete(f"{API}/artiste/workshops/{ws_id}", headers=H(ART_TOKEN))
    check("DELETE /artiste/workshops/{id} (pending) -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200 and ws_id in artist_workshop_ids:
        artist_workshop_ids.remove(ws_id)


test_visitor_user_id = f"user_test_visitor_{uuid.uuid4().hex[:8]}"
test_visitor_token = f"test_visitor_session_{uuid.uuid4().hex[:8]}"


def setup_visitor():
    mdb.users.update_one(
        {"user_id": test_visitor_user_id},
        {"$set": {
            "user_id": test_visitor_user_id,
            "email": f"{test_visitor_user_id}@test.local",
            "name": "BLOC4 Test Visitor",
            "is_admin": False,
            "role": "visiteur",
            "status": "active",
            "organizer": None,
            "artist_teacher_id": None,
            "pending_artist_claim": None,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    mdb.user_sessions.update_one(
        {"session_token": test_visitor_token},
        {"$set": {
            "session_token": test_visitor_token,
            "user_id": test_visitor_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        }},
        upsert=True,
    )


def cleanup_visitor():
    mdb.users.delete_one({"user_id": test_visitor_user_id})
    mdb.user_sessions.delete_many({"user_id": test_visitor_user_id})


def test_artist_claim_flow():
    section("6. Artist claim flow (signup-artiste / approve-artist / reject-artist)")
    setup_visitor()

    teachers = list(mdb.teachers.find({}, {"_id": 0}))
    if not teachers:
        check("teachers exist", False, "no teacher in db")
        return

    linked_ids = set()
    for u in mdb.users.find({"status": "active", "artist_teacher_id": {"$ne": None}},
                            {"artist_teacher_id": 1}):
        if u.get("artist_teacher_id"):
            linked_ids.add(u["artist_teacher_id"])
    free_teacher = next((t for t in teachers if t["id"] not in linked_ids), None)
    if not free_teacher:
        check("free teacher available for claim", False,
              f"all teachers linked: {linked_ids}")
        cleanup_visitor()
        return
    teacher_id = free_teacher["id"]

    r = requests.post(
        f"{API}/auth/signup/artiste",
        headers=H(test_visitor_token),
        json={"teacher_id": teacher_id, "message": "Je suis cet artiste."},
    )
    check("POST /auth/signup/artiste -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:300]}")
    if r.status_code == 200:
        body = r.json()
        check("signup-artiste sets role=artiste",
              body.get("role") == "artiste", f"role={body.get('role')}")
        check("signup-artiste sets status=pending",
              body.get("status") == "pending", f"status={body.get('status')}")
        check("pending_artist_claim populated",
              isinstance(body.get("pending_artist_claim"), dict)
              and body["pending_artist_claim"].get("teacher_id") == teacher_id,
              f"claim={body.get('pending_artist_claim')}")

    r = requests.get(f"{API}/admin/users?role=artiste", headers=H(ADMIN_TOKEN))
    found = False
    if r.status_code == 200:
        for u in r.json():
            if u.get("user_id") == test_visitor_user_id:
                found = True
                break
    check("admin users?role=artiste includes new claimant",
          found, f"status={r.status_code}")

    r = requests.post(
        f"{API}/admin/users/{test_visitor_user_id}/approve-artist",
        headers=H(ADMIN_TOKEN),
        json={"teacher_id": teacher_id},
    )
    check("POST approve-artist -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:300]}")

    u = mdb.users.find_one({"user_id": test_visitor_user_id})
    if u:
        check("approved artist status=active",
              u.get("status") == "active", f"status={u.get('status')}")
        check("approved artist artist_teacher_id set",
              u.get("artist_teacher_id") == teacher_id,
              f"artist_teacher_id={u.get('artist_teacher_id')}")
        check("approved artist pending_artist_claim cleared",
              u.get("pending_artist_claim") is None,
              f"pending_artist_claim={u.get('pending_artist_claim')}")

    r = requests.post(
        f"{API}/admin/users/{test_visitor_user_id}/reject-artist",
        headers=H(ADMIN_TOKEN),
    )
    check("POST reject-artist -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:300]}")
    u = mdb.users.find_one({"user_id": test_visitor_user_id})
    if u:
        check("rejected artist role=visiteur",
              u.get("role") == "visiteur", f"role={u.get('role')}")
        check("rejected artist status=active (default)",
              u.get("status") == "active", f"status={u.get('status')}")
        check("rejected artist artist_teacher_id cleared",
              u.get("artist_teacher_id") is None,
              f"artist_teacher_id={u.get('artist_teacher_id')}")

    cleanup_visitor()


def test_regression():
    section("7. Regression — /auth/me, public /entries no leak")

    r = requests.get(f"{API}/auth/me", headers=H(ADMIN_TOKEN))
    check("GET /auth/me admin -> 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check("auth/me admin has role=admin",
              body.get("role") == "admin", f"role={body.get('role')}")
        check("auth/me admin has status=active",
              body.get("status") == "active", f"status={body.get('status')}")

    reset_org_to_pending()
    body = {
        "type": "soiree",
        "title": "BLOC7 Hidden Pending Org Entry",
        "date": "2026-12-22",
        "venue": "Hidden venue",
    }
    r = requests.post(f"{API}/organisateur/entries", headers=H(ORG_TOKEN), json=body)
    if r.status_code in (200, 201):
        leaked_id = r.json()["id"]
        created_org_entry_ids.append(leaked_id)

        r2 = requests.get(f"{API}/entries")
        if r2.status_code == 200:
            ids = [e.get("id") for e in r2.json()]
            check("public /entries does NOT include pending org entry",
                  leaked_id not in ids,
                  f"leaked_id={leaked_id} in {len(ids)} entries")
        else:
            check("public /entries returns 200", False,
                  f"{r2.status_code} {r2.text[:200]}")
    else:
        check("setup pending entry for leak test", False,
              f"{r.status_code} {r.text[:200]}")


def cleanup():
    section("CLEANUP")
    for eid in list(created_org_entry_ids):
        res = mdb.entries.delete_one({"id": eid})
        if res.deleted_count:
            print(f"  cleaned org entry {eid}")
    for wid in list(artist_workshop_ids):
        res = mdb.entries.delete_one({"id": wid})
        if res.deleted_count:
            print(f"  cleaned workshop {wid}")
    reset_org_to_pending()
    reset_admin_session()
    reset_org_session()
    reset_art_session()
    if artiste_original_profile:
        mdb.teachers.update_one(
            {"id": artiste_original_profile["id"]},
            {"$set": {
                "bio": artiste_original_profile.get("bio") or "",
                "name": artiste_original_profile.get("name"),
                "trusted_teacher": artiste_original_profile.get("trusted_teacher", False),
            }},
        )
    print("  cleanup complete")


def main():
    print(f"Backend: {API}")
    test_security()
    test_organisateur_crud()
    test_approval_blocking()
    test_admin_user_mgmt()
    test_artiste_flow()
    test_artist_claim_flow()
    test_regression()
    cleanup()

    print(f"\n=== RESULTS: {len(passed)} passed, {len(failed)} failed ===")
    if failed:
        print("\nFAILED:")
        for label, detail in failed:
            print(f"  ❌ {label}\n     {detail}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
