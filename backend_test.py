"""
Backend test suite for Paris Cuban Salsa - Profs & Workshops merge.
Tests the new endpoints and verifies regression of existing ones.
"""
import os
import sys
import json
import requests
from typing import Optional

# Resolve BACKEND URL from frontend/.env (EXPO_PUBLIC_BACKEND_URL)
def get_backend_url() -> str:
    env_path = "/app/frontend/.env"
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")


BASE = get_backend_url().rstrip("/") + "/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
PUBLIC_HEADERS = {"Content-Type": "application/json"}

results = []  # list of dicts: name, status, http, sample, detail


def record(name: str, ok: bool, http: Optional[int], sample, detail: str = ""):
    results.append({
        "name": name,
        "ok": ok,
        "http": http,
        "sample": sample,
        "detail": detail,
    })
    icon = "PASS" if ok else "FAIL"
    print(f"[{icon}] {name} | http={http} | {detail}")
    if sample is not None:
        try:
            s = json.dumps(sample, default=str)
        except Exception:
            s = str(sample)
        if len(s) > 400:
            s = s[:400] + "..."
        print(f"     sample: {s}")


# Track resources for cleanup
created_teacher_ids = []
created_entry_ids = []


def cleanup():
    print("\n=== CLEANUP ===")
    for eid in created_entry_ids:
        try:
            r = requests.delete(f"{BASE}/entries/{eid}", headers=ADMIN_HEADERS, timeout=15)
            print(f"  delete entry {eid}: {r.status_code}")
        except Exception as e:
            print(f"  delete entry {eid} failed: {e}")
    for tid in created_teacher_ids:
        try:
            r = requests.delete(f"{BASE}/teachers/{tid}", headers=ADMIN_HEADERS, timeout=15)
            print(f"  delete teacher {tid}: {r.status_code}")
        except Exception as e:
            print(f"  delete teacher {tid} failed: {e}")


def main():
    print(f"BASE = {BASE}")
    print(f"ADMIN_TOKEN = {ADMIN_TOKEN[:12]}...")

    # ---- Sanity: admin auth check ----
    r = requests.get(f"{BASE}/auth/me", headers=ADMIN_HEADERS, timeout=15)
    if r.status_code != 200:
        record("auth/me admin precheck", False, r.status_code, r.text[:300],
               "Admin token not valid; tests will be unreliable")
    else:
        me = r.json()
        record("auth/me admin precheck", me.get("is_admin") is True, r.status_code, me,
               f"is_admin={me.get('is_admin')}")

    # =======================================================================
    # 1. REJECT ENDPOINT
    # =======================================================================
    print("\n=== 1. REJECT ENDPOINT ===")

    # 1a. Submit a pending workshop (no teacher_id => default pending)
    submit_payload = {
        "type": "workshop",
        "title": "Rumba Columbia masterclass — test reject",
        "date": "2026-03-15",
        "time": "19:00",
        "venue": "Studio Harmonic",
        "address": "5 passage des Taillandiers, 75011 Paris",
        "description": "Workshop technique de rumba columbia",
        "instructor": "Yoannis Tamayo",
        "level": "intermediate",
        "price": "30€",
        "category": "rumba",
        "submitter_name": "Lucia Fernandez",
        "submitter_email": "lucia.fernandez@example.com",
    }
    r = requests.post(f"{BASE}/entries/submit", json=submit_payload, headers=PUBLIC_HEADERS, timeout=15)
    if r.status_code != 200:
        record("submit pending workshop (no teacher_id)", False, r.status_code, r.text[:400], "submit failed")
        cleanup()
        return
    pending_entry = r.json()
    pending_id = pending_entry["id"]
    is_pending = pending_entry.get("status") == "pending"
    record("submit pending workshop (no teacher_id)", is_pending, r.status_code, pending_entry,
           f"status={pending_entry.get('status')} (expected pending)")

    # 1b. Reject without admin token -> 401
    r = requests.post(f"{BASE}/entries/{pending_id}/reject", headers=PUBLIC_HEADERS, timeout=15)
    record("reject WITHOUT admin returns 401", r.status_code == 401, r.status_code,
           r.text[:200], f"got {r.status_code}, expected 401")

    # 1c. Reject with admin -> 200 {ok:true,id}
    r = requests.post(f"{BASE}/entries/{pending_id}/reject", headers=ADMIN_HEADERS, timeout=15)
    body = None
    try:
        body = r.json()
    except Exception:
        body = r.text
    ok = r.status_code == 200 and isinstance(body, dict) and body.get("ok") is True and body.get("id") == pending_id
    record("reject WITH admin returns 200 {ok,id}", ok, r.status_code, body, "")

    # 1d. GET on rejected entry -> 404
    r = requests.get(f"{BASE}/entries/{pending_id}", timeout=15)
    record("GET rejected entry returns 404 (deleted)", r.status_code == 404, r.status_code,
           r.text[:200], "")

    # =======================================================================
    # 2. TEACHER dance_styles FIELD
    # =======================================================================
    print("\n=== 2. TEACHER dance_styles FIELD ===")

    teacher_payload = {
        "name": "Yoel Marrero",
        "bio": "Maître de rumba et son cubain, basé à Paris depuis 2015.",
        "dance_styles": ["Salsa cubaine", "Rumba"],
        "instagram": "@yoelmarrero",
    }
    r = requests.post(f"{BASE}/teachers", json=teacher_payload, headers=ADMIN_HEADERS, timeout=15)
    if r.status_code != 200:
        record("POST /teachers with dance_styles", False, r.status_code, r.text[:400], "create failed")
        cleanup()
        return
    t1 = r.json()
    t1_id = t1["id"]
    created_teacher_ids.append(t1_id)
    ds_match = t1.get("dance_styles") == ["Salsa cubaine", "Rumba"]
    record("POST /teachers with dance_styles", ds_match, r.status_code, t1,
           f"dance_styles={t1.get('dance_styles')}")

    # GET single teacher
    r = requests.get(f"{BASE}/teachers/{t1_id}", timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    ds_get_match = isinstance(body, dict) and body.get("dance_styles") == ["Salsa cubaine", "Rumba"]
    record("GET /teachers/{id} returns dance_styles", ds_get_match, r.status_code, body, "")

    # PUT update dance_styles
    update_payload = {
        "name": "Yoel Marrero",
        "bio": "Maître de rumba et son cubain, basé à Paris depuis 2015.",
        "dance_styles": ["Son", "Rueda de casino", "Afro-cubain"],
        "instagram": "@yoelmarrero",
    }
    r = requests.put(f"{BASE}/teachers/{t1_id}", json=update_payload, headers=ADMIN_HEADERS, timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    ds_put_match = (isinstance(body, dict)
                    and body.get("dance_styles") == ["Son", "Rueda de casino", "Afro-cubain"])
    record("PUT /teachers/{id} updates dance_styles", ds_put_match, r.status_code, body, "")

    # =======================================================================
    # 3. trusted_teacher AUTO-APPROVE WORKSHOP
    # =======================================================================
    print("\n=== 3. trusted_teacher AUTO-APPROVE WORKSHOP ===")

    # 3a. Trusted teacher
    trusted_payload = {
        "name": "Adriana Alvarez",
        "bio": "Profesora vérifiée, casino & rueda.",
        "dance_styles": ["Salsa cubaine", "Rueda de casino"],
        "trusted_teacher": True,
    }
    r = requests.post(f"{BASE}/teachers", json=trusted_payload, headers=ADMIN_HEADERS, timeout=15)
    trusted_t = r.json()
    trusted_id = trusted_t["id"]
    created_teacher_ids.append(trusted_id)
    record("create trusted teacher", trusted_t.get("trusted_teacher") is True, r.status_code, trusted_t, "")

    # Submit workshop with that teacher_id
    sub_trusted = {
        "type": "workshop",
        "title": "Casino fundamentals avec Adriana",
        "date": "2026-04-10",
        "time": "18:30",
        "venue": "La Chapelle des Lombards",
        "address": "19 rue de Lappe, 75011 Paris",
        "description": "Workshop casino tous niveaux",
        "instructor": "Adriana Alvarez",
        "teacher_id": trusted_id,
        "level": "beginner",
        "category": "salsa",
        "submitter_name": "Adriana Alvarez",
        "submitter_email": "adriana@example.com",
    }
    r = requests.post(f"{BASE}/entries/submit", json=sub_trusted, headers=PUBLIC_HEADERS, timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    if isinstance(body, dict) and body.get("id"):
        created_entry_ids.append(body["id"])
        trusted_workshop_id = body["id"]
    else:
        trusted_workshop_id = None
    auto_approved = isinstance(body, dict) and body.get("status") == "approved"
    record("submit workshop with trusted teacher_id => status=approved",
           auto_approved, r.status_code, body, f"status={body.get('status') if isinstance(body, dict) else 'N/A'}")

    # 3b. Untrusted teacher (default trusted_teacher=False)
    untrusted_payload = {
        "name": "Carlos Mendez",
        "bio": "Nouveau prof, pas encore vérifié.",
        "dance_styles": ["Salsa cubaine"],
        # trusted_teacher omitted -> default False
    }
    r = requests.post(f"{BASE}/teachers", json=untrusted_payload, headers=ADMIN_HEADERS, timeout=15)
    untrusted_t = r.json()
    untrusted_id = untrusted_t["id"]
    created_teacher_ids.append(untrusted_id)
    record("create untrusted teacher (default trusted=false)",
           untrusted_t.get("trusted_teacher") is False, r.status_code, untrusted_t, "")

    sub_untrusted = {
        "type": "workshop",
        "title": "Salsa cubaine débutants — Carlos",
        "date": "2026-04-12",
        "time": "20:00",
        "venue": "Studio Body Form",
        "description": "Workshop débutants",
        "instructor": "Carlos Mendez",
        "teacher_id": untrusted_id,
        "level": "beginner",
        "category": "salsa",
        "submitter_name": "Carlos Mendez",
        "submitter_email": "carlos@example.com",
    }
    r = requests.post(f"{BASE}/entries/submit", json=sub_untrusted, headers=PUBLIC_HEADERS, timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    if isinstance(body, dict) and body.get("id"):
        created_entry_ids.append(body["id"])
        untrusted_workshop_id = body["id"]
    else:
        untrusted_workshop_id = None
    is_pending = isinstance(body, dict) and body.get("status") == "pending"
    record("submit workshop with untrusted teacher_id => status=pending",
           is_pending, r.status_code, body, f"status={body.get('status') if isinstance(body, dict) else 'N/A'}")

    # =======================================================================
    # 4. GET /api/teachers/{id}/workshops
    # =======================================================================
    print("\n=== 4. GET /teachers/{id}/workshops ===")

    # 4a. Trusted teacher's approved workshop should be in list
    r = requests.get(f"{BASE}/teachers/{trusted_id}/workshops", timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    contains = isinstance(body, list) and any(
        w.get("id") == trusted_workshop_id for w in body
    )
    record("GET trusted teacher workshops includes approved workshop",
           contains, r.status_code, body[:3] if isinstance(body, list) else body, "")

    # Add a SECOND approved workshop for the trusted teacher (so we can verify ordering)
    sub2 = {
        "type": "workshop",
        "title": "Casino intermédiaire — Adriana 2",
        "date": "2026-04-05",  # earlier than the first one
        "venue": "Salle 2",
        "instructor": "Adriana Alvarez",
        "teacher_id": trusted_id,
        "submitter_name": "Adriana Alvarez",
        "submitter_email": "adriana@example.com",
    }
    r = requests.post(f"{BASE}/entries/submit", json=sub2, headers=PUBLIC_HEADERS, timeout=15)
    second_workshop = r.json() if r.status_code == 200 else None
    if second_workshop and second_workshop.get("id"):
        created_entry_ids.append(second_workshop["id"])

    # 4b. Feature the FIRST workshop (which has later date) → it should appear FIRST
    if trusted_workshop_id:
        r = requests.post(f"{BASE}/entries/{trusted_workshop_id}/feature",
                          headers=ADMIN_HEADERS, timeout=15)
        body = r.json() if r.status_code == 200 else r.text
        is_featured = isinstance(body, dict) and body.get("status") == "featured"
        record("feature trusted workshop returns status=featured",
               is_featured, r.status_code, body, "")

    # 4c. Reload and verify featured one is first
    r = requests.get(f"{BASE}/teachers/{trusted_id}/workshops", timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    if isinstance(body, list) and len(body) > 0:
        first = body[0]
        first_is_featured = first.get("status") == "featured" and first.get("id") == trusted_workshop_id
        record("featured workshop appears first in teacher's list",
               first_is_featured, r.status_code,
               [{"id": w.get("id"), "status": w.get("status"), "date": w.get("date"), "title": w.get("title")} for w in body],
               f"first.status={first.get('status')} first.id={first.get('id')}")
    else:
        record("featured workshop appears first in teacher's list",
               False, r.status_code, body, "list empty or non-list")

    # 4d. Verify only approved+featured returned (no pending, e.g. submit a pending one for trusted... but trusted auto-approves).
    # So instead: untrusted teacher's pending workshop must NOT appear in untrusted_id workshops list.
    r = requests.get(f"{BASE}/teachers/{untrusted_id}/workshops", timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    excludes_pending = isinstance(body, list) and not any(
        w.get("status") == "pending" for w in body
    ) and not any(w.get("id") == untrusted_workshop_id for w in body)
    record("untrusted teacher's pending workshop NOT in workshops list",
           excludes_pending, r.status_code,
           body if isinstance(body, list) else body, "")

    # =======================================================================
    # 5. EXISTING ENDPOINTS REGRESSION
    # =======================================================================
    print("\n=== 5. REGRESSION CHECKS ===")

    # 5a. GET /api/entries?type=workshop returns only approved+featured
    r = requests.get(f"{BASE}/entries?type=workshop", timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    ok = isinstance(body, list) and all(
        w.get("status") in ("approved", "featured") for w in body
    )
    record("GET /entries?type=workshop returns only approved+featured",
           ok, r.status_code,
           [{"id": w.get("id"), "status": w.get("status")} for w in body[:5]] if isinstance(body, list) else body,
           f"count={len(body) if isinstance(body, list) else 'N/A'}")

    # Check our trusted featured workshop is in there, untrusted pending is NOT
    if isinstance(body, list):
        ids = {w.get("id") for w in body}
        featured_present = trusted_workshop_id in ids
        pending_absent = untrusted_workshop_id not in ids
        record("workshop feed includes featured & excludes pending",
               featured_present and pending_absent, 200, None,
               f"featured_present={featured_present} pending_absent={pending_absent}")

    # 5b. GET /api/calendar/events still works
    r = requests.get(f"{BASE}/calendar/events", timeout=20)
    is_list = r.status_code == 200 and isinstance(r.json(), list)
    body = r.json() if r.status_code == 200 else r.text
    record("GET /calendar/events still works",
           is_list, r.status_code,
           body[:1] if isinstance(body, list) else body,
           f"count={len(body) if isinstance(body, list) else 'N/A'}")

    # 5c. GET /api/entries?status=pending requires admin
    r = requests.get(f"{BASE}/entries?status=pending", timeout=15)
    record("GET /entries?status=pending without admin returns 401",
           r.status_code == 401, r.status_code, r.text[:200], "")

    r = requests.get(f"{BASE}/entries?status=pending", headers=ADMIN_HEADERS, timeout=15)
    body = r.json() if r.status_code == 200 else r.text
    is_admin_ok = r.status_code == 200 and isinstance(body, list) and all(
        e.get("status") == "pending" for e in body
    )
    record("GET /entries?status=pending with admin returns pending list",
           is_admin_ok, r.status_code,
           [{"id": e.get("id"), "status": e.get("status"), "title": e.get("title")} for e in body[:3]] if isinstance(body, list) else body,
           f"count={len(body) if isinstance(body, list) else 'N/A'}")

    # =======================================================================
    # CLEANUP
    # =======================================================================
    cleanup()

    # Verify cleanup actually happened (sanity)
    print("\n=== POST-CLEANUP VERIFY ===")
    for tid in created_teacher_ids:
        r = requests.get(f"{BASE}/teachers/{tid}", timeout=10)
        print(f"  teacher {tid}: {r.status_code} (expect 404)")

    # Final summary
    print("\n=== SUMMARY ===")
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    print(f"PASSED: {passed} / {len(results)}")
    print(f"FAILED: {failed}")
    if failed:
        print("\nFailed cases:")
        for r in results:
            if not r["ok"]:
                print(f"  - {r['name']} (http={r['http']}) :: {r['detail']}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        cleanup()
        sys.exit(2)
