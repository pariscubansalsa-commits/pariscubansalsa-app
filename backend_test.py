"""Phase 3 backend regression — fixes #1 (visibility), #2 (edit/approve),
#3 (tolerant date parser).

Run:
  python /app/backend_test.py

Targets the public preview backend via REACT_APP_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL.
Admin token: test_session_pcs_admin_000.
"""
from __future__ import annotations
import os
import sys
import time
import uuid
import json
from typing import Any, Dict, List, Optional, Tuple

import httpx

# ───────────────────────── Config ─────────────────────────
FRONT_ENV_PATH = "/app/frontend/.env"
BASE = None
try:
    with open(FRONT_ENV_PATH) as f:
        for ln in f:
            ln = ln.strip()
            if ln.startswith("EXPO_PUBLIC_BACKEND_URL"):
                BASE = ln.split("=", 1)[1].strip().strip('"').strip("'")
                break
except Exception:
    pass
if not BASE:
    BASE = "https://rhythm-frames-3.preview.emergentagent.com"
API = f"{BASE.rstrip('/')}/api"
ADMIN = "test_session_pcs_admin_000"
AUTH = {"Authorization": f"Bearer {ADMIN}"}

results: List[Tuple[str, bool, str]] = []
created_ids: List[str] = []

def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    short = detail if len(detail) < 280 else detail[:280] + "…"
    print(f"  [{flag}] {name}{(' :: ' + short) if short else ''}")


def submit_entry(payload: Dict[str, Any], expect_status: int = 200) -> Tuple[int, Dict[str, Any]]:
    body = {
        "type": "",
        "title": "",
        "date": "",
        "submitter_name": "QA Bot",
        "submitter_email": "qa@pariscubansalsa.test",
    }
    body.update(payload)
    r = httpx.post(f"{API}/entries/submit", json=body, timeout=30)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text}
    return r.status_code, data


def admin_create(payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    body = {"type": "soiree", "title": "", "date": "", "status": "approved"}
    body.update(payload)
    r = httpx.post(f"{API}/entries", json=body, headers=AUTH, timeout=30)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text}
    return r.status_code, data


def admin_update(entry_id: str, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """The review refers to PATCH /api/admin/entries/{id}; actual implementation
    is PUT /api/entries/{id} (admin protected). We also try PATCH /api/admin/entries
    first in case it was added.
    """
    # Try PATCH /api/admin/entries/{id} first (review request semantics)
    r = httpx.patch(f"{API}/admin/entries/{entry_id}", json=payload, headers=AUTH, timeout=30)
    if r.status_code == 404:
        # Fallback to actual PUT endpoint
        r = httpx.put(f"{API}/entries/{entry_id}?scope=this", json=payload, headers=AUTH, timeout=30)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text}
    return r.status_code, data


def get_entry(entry_id: str) -> Tuple[int, Dict[str, Any]]:
    r = httpx.get(f"{API}/entries/{entry_id}", timeout=30)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text}


def delete_entry(entry_id: str) -> None:
    try:
        httpx.delete(f"{API}/entries/{entry_id}", headers=AUTH, timeout=30)
    except Exception:
        pass


# ───────────────────────── Tests ─────────────────────────
def t_fix1_visibility_and_type() -> None:
    print("\n=== FIX 1 — Submissions get a real type + visibility ===")
    # 1) "Soirée test FR" + type='agenda' → should become 'soiree'
    code, data = submit_entry({"type": "agenda", "title": "Soirée test FR Phase3",
                               "date": "2027-09-10"})
    ok = code == 200 and data.get("type") == "soiree"
    record("submit type='agenda' Soirée → resolves to 'soiree'",
           ok, f"status={code}, type={data.get('type')!r}")
    if data.get("id"):
        created_ids.append(data["id"])

    # 2) "Mensuelle ABC" + type='' → 'mensuelle'
    code, data = submit_entry({"type": "", "title": "Mensuelle ABC Phase3",
                               "date": "2027-09-12"})
    ok = code == 200 and data.get("type") == "mensuelle"
    record("submit type='' Mensuelle → resolves to 'mensuelle'",
           ok, f"status={code}, type={data.get('type')!r}")
    if data.get("id"):
        created_ids.append(data["id"])

    # 3) "Festival ABC" + type='' → 'festival'
    code, data = submit_entry({"type": "", "title": "Festival ABC Phase3",
                               "date": "2027-09-15"})
    ok = code == 200 and data.get("type") == "festival"
    record("submit type='' Festival → resolves to 'festival'",
           ok, f"status={code}, type={data.get('type')!r}")
    if data.get("id"):
        created_ids.append(data["id"])

    # 4) "Concert XXX" → is_live_music True (type defaults to soiree)
    code, data = submit_entry({"type": "soiree", "title": "Concert XXX Phase3",
                               "date": "2027-09-18"})
    ok = code == 200 and data.get("is_live_music") is True
    record("submit Concert title → is_live_music auto-true",
           ok, f"status={code}, is_live_music={data.get('is_live_music')!r}")
    if data.get("id"):
        created_ids.append(data["id"])

    # 5) Non-regression: explicit soiree stays soiree
    code, data = submit_entry({"type": "soiree", "title": "Plain Soirée Phase3",
                               "date": "2027-09-20"})
    ok = code == 200 and data.get("type") == "soiree"
    record("submit explicit type='soiree' stays 'soiree' (no regression)",
           ok, f"status={code}, type={data.get('type')!r}")
    if data.get("id"):
        created_ids.append(data["id"])


def t_fix2_edit_and_approve() -> None:
    print("\n=== FIX 2 — Edit (PATCH/PUT) and admin create approved ===")
    # Create a pending submission, then PATCH it as admin, ensure stays pending
    code, data = submit_entry({"type": "soiree", "title": "Edit Smoke Phase3",
                               "date": "2027-09-22", "venue": "Old Venue"})
    if code != 200:
        record("seed pending entry for edit", False, f"status={code} body={data}")
        return
    eid = data["id"]
    created_ids.append(eid)
    record("seed pending entry", data.get("status") == "pending",
           f"status_field={data.get('status')!r}")

    code, body = admin_update(eid, {"type": "soiree",
                                    "title": "Edit Smoke Phase3 — modified",
                                    "date": "2027-09-22",
                                    "venue": "New Venue"})
    record("admin PATCH/PUT on pending entry succeeds",
           code == 200, f"status={code} body_keys={list(body.keys()) if isinstance(body, dict) else type(body)}")
    # Verify status stayed pending
    code2, after = get_entry(eid)
    same_status = code2 == 200 and after.get("status") == "pending"
    record("after admin edit, status stays 'pending' (no auto-approve)",
           same_status, f"status_after_edit={after.get('status')!r}, venue={after.get('venue')!r}")

    # Admin create with explicit status='approved' → must appear in GET /api/entries
    code, data = admin_create({"type": "soiree", "title": "Admin Approved Phase3",
                               "date": "2027-09-25", "status": "approved"})
    record("admin POST /entries status='approved' returns 200",
           code == 200, f"status={code} type={data.get('type')!r} status_field={data.get('status')!r}")
    if data.get("id"):
        created_ids.append(data["id"])
        new_id = data["id"]
        # Verify in GET /entries
        r = httpx.get(f"{API}/entries", timeout=30)
        ok = r.status_code == 200 and any(e.get("id") == new_id for e in r.json())
        record("admin-created approved entry visible in GET /api/entries",
               ok, f"list_status={r.status_code}, len={len(r.json()) if r.status_code == 200 else 'n/a'}")


def _check_normalises(label: str, code: int, body: Dict[str, Any]) -> Tuple[bool, str]:
    if code != 200:
        return False, f"{label}: HTTP {code} body={body}"
    if body.get("date") != "2026-07-04":
        return False, f"{label}: date={body.get('date')!r} (expected 2026-07-04)"
    return True, f"{label}: OK date={body.get('date')!r}"


def t_fix3_date_parser() -> None:
    print("\n=== FIX 3 — Tolerant date parser on 3 endpoints ===")

    formats = [
        ("FR slash", "04/07/2026"),
        ("FR dash", "04-07-2026"),
        ("ISO dash", "2026-07-04"),
        ("ISO slash", "2026/07/04"),
    ]

    # --- POST /api/entries (admin) ---
    for label, val in formats:
        code, body = admin_create({"type": "soiree",
                                   "title": f"DateNorm admin {label} Phase3",
                                   "date": val})
        ok, msg = _check_normalises(f"admin POST date={val}", code, body)
        record(f"admin POST /entries date={val!r} normalises to 2026-07-04",
               ok, msg)
        if body.get("id"):
            created_ids.append(body["id"])
    # end_date normalisation on admin POST
    code, body = admin_create({"type": "festival",
                               "title": "DateNorm admin end_date Phase3",
                               "date": "2026-07-04",
                               "end_date": "06/07/2026"})
    ok = code == 200 and body.get("end_date") == "2026-07-06"
    record("admin POST /entries end_date FR-style normalises",
           ok, f"end_date={body.get('end_date')!r}")
    if body.get("id"):
        created_ids.append(body["id"])
    # invalid date
    code, body = admin_create({"type": "soiree",
                               "title": "DateNorm admin INVALID",
                               "date": "invalid"})
    detail = body.get("detail", "") if isinstance(body, dict) else ""
    ok = code == 400 and "Date invalide" in str(detail)
    record("admin POST /entries date='invalid' → 400 French detail",
           ok, f"code={code}, detail={detail!r}")

    # --- POST /api/entries/submit (public) ---
    for label, val in formats:
        code, body = submit_entry({"type": "soiree",
                                   "title": f"DateNorm submit {label} Phase3",
                                   "date": val})
        ok, msg = _check_normalises(f"submit date={val}", code, body)
        record(f"public /entries/submit date={val!r} normalises",
               ok, msg)
        if body.get("id"):
            created_ids.append(body["id"])
    # end_date normalisation
    code, body = submit_entry({"type": "festival",
                               "title": "DateNorm submit end_date Phase3",
                               "date": "2026-07-04",
                               "end_date": "06-07-2026"})
    ok = code == 200 and body.get("end_date") == "2026-07-06"
    record("public /entries/submit end_date FR-style normalises",
           ok, f"end_date={body.get('end_date')!r}")
    if body.get("id"):
        created_ids.append(body["id"])
    # invalid date
    code, body = submit_entry({"type": "soiree",
                               "title": "DateNorm submit INVALID",
                               "date": "invalid"})
    detail = body.get("detail", "") if isinstance(body, dict) else ""
    ok = code == 400 and "Date invalide" in str(detail)
    record("public /entries/submit date='invalid' → 400 French detail",
           ok, f"code={code}, detail={detail!r}")

    # --- PATCH /api/admin/entries/{id} (admin) — actual endpoint is PUT /api/entries/{id} ---
    # Seed an entry, then patch with each format
    code, seed = admin_create({"type": "soiree",
                               "title": "DateNorm patch seed Phase3",
                               "date": "2026-01-01"})
    if code != 200 or not seed.get("id"):
        record("seed entry for PATCH date tests", False, f"code={code} body={seed}")
        return
    seed_id = seed["id"]
    created_ids.append(seed_id)
    for label, val in formats:
        code, body = admin_update(seed_id, {"type": "soiree",
                                            "title": "DateNorm patch Phase3",
                                            "date": val})
        ok, msg = _check_normalises(f"PATCH date={val}", code, body)
        record(f"PATCH admin entries/{{id}} date={val!r} normalises",
               ok, msg)
    # end_date normalisation via PATCH
    code, body = admin_update(seed_id, {"type": "festival",
                                        "title": "DateNorm patch end_date Phase3",
                                        "date": "2026-07-04",
                                        "end_date": "06/07/2026"})
    ok = code == 200 and body.get("end_date") == "2026-07-06"
    record("PATCH admin entries/{id} end_date FR-style normalises",
           ok, f"end_date={body.get('end_date')!r}")
    # invalid date
    code, body = admin_update(seed_id, {"type": "soiree",
                                        "title": "DateNorm patch INVALID",
                                        "date": "invalid"})
    detail = body.get("detail", "") if isinstance(body, dict) else ""
    ok = code == 400 and "Date invalide" in str(detail)
    record("PATCH admin entries/{id} date='invalid' → 400 French detail",
           ok, f"code={code}, detail={detail!r}")


def t_non_regression() -> None:
    print("\n=== NON-REGRESSION ===")
    # GET /api/entries returns only approved + featured (no pending) for non-admin
    r = httpx.get(f"{API}/entries", timeout=30)
    ok = r.status_code == 200
    if ok:
        items = r.json()
        pending_leaks = [e for e in items if e.get("status") == "pending"]
        ok = len(pending_leaks) == 0
        record("GET /api/entries (no auth) returns no pending entries",
               ok, f"count={len(items)}, pending_leaks={len(pending_leaks)}")
    else:
        record("GET /api/entries (no auth)", False, f"code={r.status_code}")

    # GET /api/calendar/events
    r = httpx.get(f"{API}/calendar/events", timeout=30)
    record("GET /api/calendar/events still works",
           r.status_code == 200, f"code={r.status_code}, len={len(r.json()) if r.status_code == 200 else 'n/a'}")

    # GET /api/highlights
    r = httpx.get(f"{API}/highlights", timeout=30)
    record("GET /api/highlights still works",
           r.status_code == 200, f"code={r.status_code}")

    # Likes: create an entry then like it, then second like → 429
    code, seed = admin_create({"type": "soiree", "title": "Likes Smoke Phase3",
                               "date": "2027-10-10"})
    if code == 200 and seed.get("id"):
        like_id = seed["id"]
        created_ids.append(like_id)
        # Use unique forwarded IP to avoid collision with prior tests
        fake_ip = f"203.0.113.{int(time.time()) % 240 + 1}"
        h1 = {"X-Forwarded-For": fake_ip}
        r1 = httpx.post(f"{API}/entries/{like_id}/like", headers=h1, timeout=30)
        ok = r1.status_code == 200 and isinstance(r1.json().get("likes"), int) and r1.json().get("likes") >= 1
        record("POST /entries/{id}/like → 200 with increment",
               ok, f"code={r1.status_code}, body={r1.json() if r1.status_code == 200 else r1.text}")
        r2 = httpx.post(f"{API}/entries/{like_id}/like", headers=h1, timeout=30)
        record("POST /entries/{id}/like same IP → 429",
               r2.status_code == 429,
               f"code={r2.status_code}, detail={r2.text[:120]}")
    else:
        record("seed for likes test", False, f"code={code}, body={seed}")

    # migrate-gcal-categories dry_run
    r = httpx.post(f"{API}/admin/migrate-gcal-categories?dry_run=true",
                   headers=AUTH, timeout=60)
    ok = r.status_code == 200 and r.json().get("ok") is True and r.json().get("dry_run") is True
    detail = ""
    if r.status_code == 200:
        c = r.json().get("counters", {})
        detail = f"counters={c}"
    else:
        detail = f"code={r.status_code} body={r.text[:200]}"
    record("POST /admin/migrate-gcal-categories?dry_run=true → 200 ok dry_run",
           ok, detail)


def cleanup() -> None:
    print(f"\n=== CLEANUP — deleting {len(created_ids)} test entries ===")
    seen = set()
    for eid in created_ids:
        if not eid or eid in seen:
            continue
        seen.add(eid)
        delete_entry(eid)
    print(f"  cleanup attempted on {len(seen)} unique ids")


def main() -> int:
    print(f"Backend base: {API}")
    # Quick sanity ping
    r = httpx.get(f"{API}/", timeout=15)
    print(f"  health: {r.status_code}")

    try:
        t_fix1_visibility_and_type()
        t_fix2_edit_and_approve()
        t_fix3_date_parser()
        t_non_regression()
    finally:
        cleanup()

    passed = sum(1 for _, ok, _ in results if ok)
    failed = [(n, d) for n, ok, d in results if not ok]
    print("\n=========================================")
    print(f"TOTAL: {passed}/{len(results)} PASSED  —  {len(failed)} FAILED")
    if failed:
        print("\nFAILED:")
        for n, d in failed:
            print(f"  - {n} :: {d}")
    print("=========================================")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
