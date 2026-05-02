"""
Backend test for Paris Cuban Salsa — Google Calendar sync + admin moderation queue.

Coverage:
  A. Reject endpoint now archives instead of deleting.
  B. Approve endpoint accepts type query param.
  C. Google Calendar sync pipeline.
  D. Regression: /calendar/events, /entries?type=workshop, feature endpoint.

Auth: Bearer test_session_pcs_admin_000  (see /app/memory/test_credentials.md)
URL : EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env  (+ /api prefix)
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Optional

import requests

# ---------- Config ----------

FRONT_ENV = "/app/frontend/.env"


def load_backend_url() -> str:
    with open(FRONT_ENV) as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")


BASE = load_backend_url().rstrip("/") + "/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

print(f"BASE URL: {BASE}\n")


# ---------- Result tracking ----------

results: list[tuple[str, bool, str]] = []


def log(name: str, ok: bool, details: str = "") -> None:
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name}")
    if details:
        print(f"       {details}")
    results.append((name, ok, details))


def trim(obj: Any, length: int = 220) -> str:
    try:
        s = json.dumps(obj, default=str)
    except Exception:
        s = str(obj)
    return s if len(s) <= length else s[:length] + "..."


# ---------- Helpers ----------

manual_entry_ids: list[str] = []  # for cleanup


def submit_pending_workshop(title: str, date_str: str = "2026-10-12") -> Optional[str]:
    payload = {
        "type": "workshop",
        "title": title,
        "date": date_str,
        "time": "19:00 - 21:00",
        "venue": "Studio Test PCS",
        "address": "10 rue de Test, Paris",
        "description": "Atelier de test pour pipeline de modération.",
        "instructor": "Manolo Test",
        "level": "intermediate",
        "price": "20€",
        "category": "salsa",
        "submitter_name": "Test Submitter",
        "submitter_email": "submit-test@pcs.dev",
    }
    r = requests.post(f"{BASE}/entries/submit", json=payload, timeout=15)
    if r.status_code != 200:
        return None
    body = r.json()
    return body.get("id")


# ---------- A. Reject archives ----------

def section_A():
    print("\n=== SECTION A: Reject archives instead of deleting ===")

    # A.1 create pending submission
    eid = submit_pending_workshop("[TEST-A] Workshop reject archive")
    if not eid:
        log("A.1 submit pending workshop", False, "submit failed")
        return
    manual_entry_ids.append(eid)
    log("A.1 submit pending workshop", True, f"id={eid}")

    # A.4 (do this first so we still have pending) — reject without admin -> 401
    r = requests.post(f"{BASE}/entries/{eid}/reject", timeout=15)
    log(
        "A.4 reject without admin -> 401",
        r.status_code == 401,
        f"status={r.status_code} body={trim(r.text)}",
    )

    # A.2 reject with admin
    r = requests.post(f"{BASE}/entries/{eid}/reject", headers=ADMIN_HEADERS, timeout=15)
    body = None
    try:
        body = r.json()
    except Exception:
        pass
    ok = (
        r.status_code == 200
        and isinstance(body, dict)
        and body.get("ok") is True
        and body.get("id") == eid
        and body.get("status") == "rejected"
    )
    log("A.2 reject with admin returns ok+status=rejected", ok, f"status={r.status_code} body={trim(body)}")

    # A.3 GET still returns the entry with status=rejected (NOT 404)
    r = requests.get(f"{BASE}/entries/{eid}", timeout=15)
    body = None
    try:
        body = r.json()
    except Exception:
        pass
    ok = (
        r.status_code == 200
        and isinstance(body, dict)
        and body.get("status") == "rejected"
        and body.get("id") == eid
    )
    log(
        "A.3 GET rejected entry still returns it (status=rejected, not 404)",
        ok,
        f"status={r.status_code} body={trim(body)}",
    )


# ---------- B. Approve type query param ----------

def section_B():
    print("\n=== SECTION B: Approve endpoint accepts type query param ===")

    eid = submit_pending_workshop("[TEST-B] Workshop reclassify festival")
    if not eid:
        log("B.1 submit pending workshop", False, "submit failed")
        return
    manual_entry_ids.append(eid)
    log("B.1 submit pending workshop (type=workshop)", True, f"id={eid}")

    # B.3 invalid type first (so we don't approve before)
    r = requests.post(
        f"{BASE}/entries/{eid}/approve",
        params={"type": "invalid"},
        headers=ADMIN_HEADERS,
        timeout=15,
    )
    log(
        "B.3 approve?type=invalid -> 400",
        r.status_code == 400,
        f"status={r.status_code} body={trim(r.text)}",
    )

    # B.2 approve with type=festival
    r = requests.post(
        f"{BASE}/entries/{eid}/approve",
        params={"type": "festival"},
        headers=ADMIN_HEADERS,
        timeout=15,
    )
    body = None
    try:
        body = r.json()
    except Exception:
        pass
    ok = (
        r.status_code == 200
        and isinstance(body, dict)
        and body.get("type") == "festival"
        and body.get("status") == "approved"
        and body.get("id") == eid
    )
    log(
        "B.2 approve?type=festival -> type=festival, status=approved",
        ok,
        f"status={r.status_code} body={trim(body)}",
    )


# ---------- C. Google Calendar sync pipeline ----------

def section_C():
    print("\n=== SECTION C: Google Calendar sync pipeline ===")

    # C.5 unauth first (cheap)
    r = requests.post(f"{BASE}/calendar/sync", timeout=30)
    log(
        "C.5 POST /calendar/sync without admin -> 401",
        r.status_code == 401,
        f"status={r.status_code} body={trim(r.text)}",
    )

    # C.1 admin sync
    r = requests.post(f"{BASE}/calendar/sync", headers=ADMIN_HEADERS, timeout=60)
    body = None
    try:
        body = r.json()
    except Exception:
        pass
    keys = ("ok", "created", "updated", "unchanged", "skipped")
    ok_keys = isinstance(body, dict) and all(k in body for k in keys)
    ok_ints = (
        ok_keys
        and all(isinstance(body[k], int) and body[k] >= 0 for k in ("created", "updated", "unchanged", "skipped"))
        and body.get("ok") is True
    )
    total_visible = (body.get("created", 0) + body.get("updated", 0) + body.get("unchanged", 0)) if isinstance(body, dict) else 0
    ok_total = total_visible > 0
    ok = r.status_code == 200 and ok_ints and ok_total
    log(
        "C.1 admin /calendar/sync returns {ok,created,updated,unchanged,skipped} ints; total>0",
        ok,
        f"status={r.status_code} body={trim(body)} totalCUU={total_visible}",
    )

    # C.2 GET pending entries -> some have source=gcal and external_id
    r = requests.get(
        f"{BASE}/entries",
        params={"status": "pending"},
        headers=ADMIN_HEADERS,
        timeout=30,
    )
    pending = r.json() if r.status_code == 200 else []
    gcal_pending = [e for e in pending if e.get("source") == "gcal" and e.get("external_id")]
    log(
        "C.2 admin GET /entries?status=pending has gcal entries with external_id",
        r.status_code == 200 and len(gcal_pending) > 0,
        f"status={r.status_code} pending_total={len(pending)} gcal_pending={len(gcal_pending)} sample={trim(gcal_pending[0] if gcal_pending else None)}",
    )

    if not gcal_pending:
        log("C.3 reject gcal entry + re-sync skip", False, "no gcal pending entry available")
        log("C.4 GET /entries?status=rejected includes rejected gcal", False, "no gcal pending entry available")
        return

    target = gcal_pending[0]
    target_id = target["id"]
    target_external = target["external_id"]

    # C.3a reject the gcal entry
    r = requests.post(f"{BASE}/entries/{target_id}/reject", headers=ADMIN_HEADERS, timeout=15)
    rej_ok = r.status_code == 200 and r.json().get("status") == "rejected"
    log(
        "C.3a reject gcal pending entry",
        rej_ok,
        f"status={r.status_code} body={trim(r.text)}",
    )

    # C.3b re-run sync
    r = requests.post(f"{BASE}/calendar/sync", headers=ADMIN_HEADERS, timeout=60)
    body2 = r.json() if r.status_code == 200 else {}
    skipped2 = body2.get("skipped", 0)
    created2 = body2.get("created", 0)
    # Re-fetch all gcal entries for that external_id; expect exactly 1 (the rejected one)
    r2 = requests.get(
        f"{BASE}/entries",
        params={"status": "rejected"},
        headers=ADMIN_HEADERS,
        timeout=30,
    )
    rejected_list = r2.json() if r2.status_code == 200 else []
    same_uid_rejected = [e for e in rejected_list if e.get("external_id") == target_external and e.get("source") == "gcal"]

    # And ensure no NEW pending exists with same external_id
    r3 = requests.get(
        f"{BASE}/entries",
        params={"status": "pending"},
        headers=ADMIN_HEADERS,
        timeout=30,
    )
    pending2 = r3.json() if r3.status_code == 200 else []
    pending_same_uid = [e for e in pending2 if e.get("external_id") == target_external and e.get("source") == "gcal"]

    ok = skipped2 >= 1 and len(pending_same_uid) == 0 and len(same_uid_rejected) >= 1
    log(
        "C.3b re-sync after reject: skipped>=1, no re-creation as pending",
        ok,
        f"sync_body={trim(body2)} pending_same_uid={len(pending_same_uid)} rejected_same_uid={len(same_uid_rejected)}",
    )

    # C.4 GET rejected list includes our rejected entry
    log(
        "C.4 admin GET /entries?status=rejected includes rejected gcal entry",
        any(e.get("id") == target_id for e in rejected_list),
        f"rejected_total={len(rejected_list)} contains_target={any(e.get('id') == target_id for e in rejected_list)}",
    )


# ---------- D. Regression ----------

def section_D():
    print("\n=== SECTION D: Regression ===")

    # D.1 raw iCal payload
    r = requests.get(f"{BASE}/calendar/events", timeout=30)
    body = r.json() if r.status_code == 200 else None
    ok = r.status_code == 200 and isinstance(body, list)
    log(
        "D.1 GET /calendar/events returns iCal list",
        ok,
        f"status={r.status_code} count={(len(body) if isinstance(body, list) else 'NA')}",
    )

    # D.2 workshops feed has only approved+featured (no rejected, no pending)
    r = requests.get(f"{BASE}/entries", params={"type": "workshop"}, timeout=30)
    items = r.json() if r.status_code == 200 else []
    bad = [e for e in items if e.get("status") not in ("approved", "featured")]
    log(
        "D.2 GET /entries?type=workshop returns only approved+featured",
        r.status_code == 200 and len(bad) == 0,
        f"status={r.status_code} total={len(items)} non_approved={len(bad)}",
    )

    # D.3 feature an approved entry — submit one (use trusted teacher? simplest: create then approve)
    eid = submit_pending_workshop("[TEST-D] Workshop feature regression", "2026-11-20")
    if not eid:
        log("D.3 feature endpoint regression", False, "submit failed")
        return
    manual_entry_ids.append(eid)

    # approve first
    r = requests.post(f"{BASE}/entries/{eid}/approve", headers=ADMIN_HEADERS, timeout=15)
    if r.status_code != 200:
        log("D.3 feature endpoint regression", False, f"approve failed status={r.status_code} body={trim(r.text)}")
        return

    # feature it
    r = requests.post(f"{BASE}/entries/{eid}/feature", headers=ADMIN_HEADERS, timeout=15)
    body = None
    try:
        body = r.json()
    except Exception:
        pass
    ok = (
        r.status_code == 200
        and isinstance(body, dict)
        and body.get("status") == "featured"
        and body.get("featured") is True
    )
    log(
        "D.3 POST /entries/{id}/feature on approved -> status=featured",
        ok,
        f"status={r.status_code} body={trim(body)}",
    )


# ---------- Cleanup ----------

def cleanup():
    print("\n=== CLEANUP ===")
    for eid in manual_entry_ids:
        try:
            r = requests.delete(f"{BASE}/entries/{eid}", headers=ADMIN_HEADERS, timeout=15)
            print(f"  delete {eid} -> {r.status_code}")
        except Exception as e:
            print(f"  delete {eid} failed: {e}")


# ---------- Run ----------

def main() -> int:
    section_A()
    section_B()
    section_C()
    section_D()
    cleanup()

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [r for r in results if not r[1]]
    print(f"Passed: {passed}/{len(results)}")
    if failed:
        print("Failed cases:")
        for name, _, det in failed:
            print(f"  - {name}: {det}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
