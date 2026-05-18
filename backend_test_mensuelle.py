"""Backend tests for TÂCHE 2: Mensuelle type + instagram_post field.

Run:
    BACKEND_URL=https://rhythm-frames-3.preview.emergentagent.com/api \
        python /app/backend_test_mensuelle.py
"""
from __future__ import annotations
import json
import os
import sys
from typing import Any

import requests

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "https://rhythm-frames-3.preview.emergentagent.com/api",
).rstrip("/")
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

results: list[tuple[str, bool, str]] = []
created_ids: list[str] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    icon = "PASS" if ok else "FAIL"
    print(f"[{icon}] {name} — {detail}")


def jget(url: str, **kw: Any) -> requests.Response:
    return requests.get(url, timeout=15, **kw)


def jpost(url: str, **kw: Any) -> requests.Response:
    return requests.post(url, timeout=15, **kw)


def jput(url: str, **kw: Any) -> requests.Response:
    return requests.put(url, timeout=15, **kw)


def jdel(url: str, **kw: Any) -> requests.Response:
    return requests.delete(url, timeout=15, **kw)


def show(r: requests.Response) -> str:
    try:
        body = json.dumps(r.json())[:300]
    except Exception:
        body = r.text[:300]
    return f"HTTP {r.status_code}: {body}"


def main() -> int:
    print(f"BASE_URL = {BASE_URL}\n")

    # ----- 1) GET /entries?type=mensuelle -----
    r = jget(f"{BASE_URL}/entries", params={"type": "mensuelle"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    record(
        "1) GET /entries?type=mensuelle returns 200 + array",
        ok,
        show(r),
    )

    # ----- 2) POST /entries/submit (public) — mensuelle -----
    submit_body = {
        "type": "mensuelle",
        "title": "Mensuelle Test PCS",
        "date": "2027-06-15",
        "time": "21:00",
        "venue": "Cabaret Sauvage",
        "address": "59 Bd Macdonald, 75019 Paris",
        "description": "Soirée mensuelle de salsa cubaine.",
        "dance_style": "salsa_cubaine",
        "ticket_link": "https://www.helloasso.com/mensuelle",
        "instagram_post": "https://www.instagram.com/p/CmHpAaNL_q5/",
        "submitter_name": "Tester",
        "submitter_email": "tester@example.com",
    }
    r = jpost(f"{BASE_URL}/entries/submit", json=submit_body)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = (
        r.status_code == 200
        and body.get("status") == "pending"
        and body.get("type") == "mensuelle"
        and body.get("instagram_post") == submit_body["instagram_post"]
    )
    record(
        "2) POST /entries/submit type=mensuelle (public) -> 200 status=pending, type=mensuelle, instagram_post echoed",
        ok,
        show(r),
    )
    submitted_id = body.get("id") if r.status_code == 200 else None
    if submitted_id:
        created_ids.append(submitted_id)

    # ----- 3) POST /entries (admin) — mensuelle approved -----
    admin_body = {
        "type": "mensuelle",
        "title": "Mensuelle Test PCS Admin",
        "date": "2027-06-15",
        "time": "21:00",
        "venue": "Cabaret Sauvage",
        "address": "59 Bd Macdonald, 75019 Paris",
        "description": "Soirée mensuelle de salsa cubaine (admin).",
        "dance_style": "salsa_cubaine",
        "ticket_link": "https://www.helloasso.com/mensuelle",
        "instagram_post": "https://www.instagram.com/p/CmHpAaNL_q5/",
        "status": "approved",
    }
    r = jpost(f"{BASE_URL}/entries", json=admin_body, headers=ADMIN_HEADERS)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = (
        r.status_code == 200
        and body.get("type") == "mensuelle"
        and body.get("status") == "approved"
        and body.get("instagram_post") == admin_body["instagram_post"]
    )
    record(
        "3) POST /entries (admin) type=mensuelle status=approved with instagram_post persisted",
        ok,
        show(r),
    )
    admin_id = body.get("id") if r.status_code == 200 else None
    if admin_id:
        created_ids.append(admin_id)

    # ----- 4) GET /entries/{id} for entry created in step 3 -----
    if admin_id:
        r = jget(f"{BASE_URL}/entries/{admin_id}")
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        ok = (
            r.status_code == 200
            and body.get("instagram_post") == admin_body["instagram_post"]
            and body.get("type") == "mensuelle"
        )
        record(
            "4) GET /entries/{id} returns instagram_post",
            ok,
            show(r),
        )
    else:
        record("4) GET /entries/{id} returns instagram_post", False, "skipped: no admin_id")

    # ----- 5) PUT /entries/{id} (admin) — update instagram_post -----
    new_ig = "https://www.instagram.com/p/NEWCODE_X/"
    if admin_id:
        update_body = {
            "type": "mensuelle",
            "title": admin_body["title"],
            "date": admin_body["date"],
            "instagram_post": new_ig,
        }
        r = jput(
            f"{BASE_URL}/entries/{admin_id}",
            json=update_body,
            headers=ADMIN_HEADERS,
        )
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        put_ok = r.status_code == 200 and body.get("instagram_post") == new_ig

        # Confirm persistence with a fresh GET
        rg = jget(f"{BASE_URL}/entries/{admin_id}")
        gbody = rg.json() if rg.headers.get("content-type", "").startswith("application/json") else {}
        persisted = rg.status_code == 200 and gbody.get("instagram_post") == new_ig

        ok = put_ok and persisted
        record(
            "5) PUT /entries/{id} updates instagram_post and persists",
            ok,
            f"PUT {show(r)} | GET {show(rg)}",
        )
    else:
        record("5) PUT /entries/{id} updates instagram_post and persists", False, "skipped: no admin_id")

    # ----- 6) Negative — POST /entries/submit type=invalid_xyz -> 400 -----
    bad_body = dict(submit_body)
    bad_body["type"] = "invalid_xyz"
    r = jpost(f"{BASE_URL}/entries/submit", json=bad_body)
    ok = r.status_code == 400
    record(
        "6) POST /entries/submit type=invalid_xyz -> 400",
        ok,
        show(r),
    )
    # In case the server (unexpectedly) accepted it, cleanup:
    if r.status_code == 200:
        try:
            bad_id = r.json().get("id")
            if bad_id:
                created_ids.append(bad_id)
        except Exception:
            pass

    # ----- 7) Regression — POST /entries/submit type=soiree minimal -----
    soiree_body = {
        "type": "soiree",
        "title": "Regression Soiree PCS",
        "date": "2027-07-04",
        "submitter_name": "Tester",
        "submitter_email": "tester@example.com",
    }
    r = jpost(f"{BASE_URL}/entries/submit", json=soiree_body)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = (
        r.status_code == 200
        and body.get("type") == "soiree"
        and body.get("status") == "pending"
    )
    record(
        "7) Regression: POST /entries/submit type=soiree minimal -> 200 pending",
        ok,
        show(r),
    )
    soiree_id = body.get("id") if r.status_code == 200 else None
    if soiree_id:
        created_ids.append(soiree_id)

    # ----- 8) CLEANUP -----
    print("\n--- Cleanup ---")
    for eid in created_ids:
        r = jdel(f"{BASE_URL}/entries/{eid}", params={"scope": "all"}, headers=ADMIN_HEADERS)
        print(f"DELETE {eid} -> HTTP {r.status_code}: {r.text[:150]}")
        # Verify 404 after deletion
        rg = jget(f"{BASE_URL}/entries/{eid}")
        verify_ok = rg.status_code == 404
        record(
            f"8) Cleanup: GET deleted entry {eid[:8]}… -> 404",
            verify_ok,
            f"HTTP {rg.status_code}",
        )

    # ----- Final report -----
    print("\n========== RESULTS ==========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, detail in results:
        icon = "PASS" if ok else "FAIL"
        print(f"[{icon}] {name}")
    print(f"\n{passed}/{total} assertions PASS")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
