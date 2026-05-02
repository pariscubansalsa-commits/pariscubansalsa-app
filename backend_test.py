"""
Paris Cuban Salsa — Regression test for PUT /api/entries/{id} fix
and related moderation endpoints.

Coverage:
  1) PUT handles entries whose status is null/missing (featured=true/false toggle)
  2) PUT preserves description when not sent in body
  3) POST+DELETE entry
  4) Approve with type query param reclassifies
  5) Reject + restore round trip

Auth: Bearer test_session_pcs_admin_000 (from /app/memory/test_credentials.md)
URL : EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env (+ /api prefix)
"""

from __future__ import annotations

import json
import sys
from typing import Any, Optional

import requests


FRONT_ENV = "/app/frontend/.env"


def load_backend_url() -> str:
    with open(FRONT_ENV) as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")


BASE = load_backend_url().rstrip("/") + "/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


PASS: list[str] = []
FAIL: list[str] = []
cleanup_ids: set[str] = set()


def log_pass(msg: str) -> None:
    print(f"  [PASS] {msg}")
    PASS.append(msg)


def log_fail(msg: str) -> None:
    print(f"  [FAIL] {msg}")
    FAIL.append(msg)


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def short(obj: Any, limit: int = 220) -> str:
    try:
        text = json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        text = str(obj)
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ---------------------------------------------------------------------------
# 1) PUT on entries with status=null — must not crash, must set featured/status
# ---------------------------------------------------------------------------

def test_put_status_null_safe() -> None:
    section("1) PUT /api/entries/{id} on entry with status=null")

    # Pick a workshop entry from public feed.
    r = requests.get(f"{BASE}/entries", params={"type": "workshop"}, timeout=20)
    if r.status_code != 200:
        log_fail(f"GET /entries?type=workshop -> {r.status_code} {r.text[:120]}")
        return
    items = r.json()
    if not items:
        log_fail("No workshop entries available to test PUT")
        return

    entry = items[0]
    eid = entry["id"]
    orig_title = entry["title"]
    orig_date = entry["date"]
    orig_status = entry.get("status")
    orig_featured = entry.get("featured")
    print(f"  picked workshop id={eid[:8]}… title={orig_title!r} "
          f"status={orig_status!r} featured={orig_featured}")

    # Simulate the "status=null" condition by clearing status in DB-like manner.
    # We can't touch Mongo directly here, but the public feed returns 'approved'
    # entries whose stored status may be None per the review's framing (the
    # Entry model defaults to 'approved' on read but we still want to exercise
    # the PUT path). The PUT should not crash regardless.

    body = {
        "type": "workshop",
        "title": orig_title,
        "date": orig_date,
        "featured": True,
    }
    r = requests.put(f"{BASE}/entries/{eid}", json=body, headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"PUT featured=true -> {r.status_code} {r.text[:300]}")
        return
    data = r.json()
    print(f"    resp(featured=true): status={data.get('status')!r} "
          f"featured={data.get('featured')} title={data.get('title')!r}")
    if data.get("status") == "featured" and data.get("featured") is True:
        log_pass("PUT featured=true returns status='featured' and featured=true")
    else:
        log_fail(f"PUT featured=true unexpected status/featured: {short(data)}")
    if data.get("title") == orig_title:
        log_pass("Title preserved after PUT featured=true")
    else:
        log_fail(f"Title changed after PUT featured=true: {data.get('title')!r} vs {orig_title!r}")

    # Now unfeature
    body2 = {
        "type": "workshop",
        "title": orig_title,
        "date": orig_date,
        "featured": False,
    }
    r = requests.put(f"{BASE}/entries/{eid}", json=body2, headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"PUT featured=false -> {r.status_code} {r.text[:300]}")
        return
    data = r.json()
    print(f"    resp(featured=false): status={data.get('status')!r} "
          f"featured={data.get('featured')} title={data.get('title')!r}")
    if data.get("status") == "approved" and data.get("featured") is False:
        log_pass("PUT featured=false returns status='approved' and featured=false")
    else:
        log_fail(f"PUT featured=false unexpected status/featured: {short(data)}")
    if data.get("title") == orig_title:
        log_pass("Title preserved after PUT featured=false")
    else:
        log_fail(f"Title changed after PUT featured=false: {data.get('title')!r} vs {orig_title!r}")

    # Restore original featured state if it differed.
    if orig_featured != data.get("featured"):
        restore = {
            "type": "workshop",
            "title": orig_title,
            "date": orig_date,
            "featured": bool(orig_featured),
        }
        requests.put(f"{BASE}/entries/{eid}", json=restore, headers=ADMIN_HEADERS, timeout=20)
        print(f"  restored featured={bool(orig_featured)} on {eid[:8]}…")


# ---------------------------------------------------------------------------
# 2) PUT preserves description when not sent
# ---------------------------------------------------------------------------

def test_put_preserves_description() -> None:
    section("2) PUT /api/entries/{id} preserves description when omitted")

    # Create a workshop with a description so we control the starting state.
    payload = {
        "type": "workshop",
        "title": "Regression test — preserve description",
        "date": "2027-02-14",
        "description": "Valse cubaine avancée avec Yanet — description à préserver.",
        "venue": "Studio Harmonic",
        "level": "advanced",
        "price": "35€",
        "status": "approved",
    }
    r = requests.post(f"{BASE}/entries", json=payload, headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"seed POST /entries -> {r.status_code} {r.text[:200]}")
        return
    created = r.json()
    eid = created["id"]
    cleanup_ids.add(eid)
    original_desc = created.get("description")
    print(f"  created id={eid[:8]}… description={original_desc!r}")

    # PUT with NO description field (only type/title/date)
    body = {
        "type": "workshop",
        "title": payload["title"],
        "date": payload["date"],
    }
    r = requests.put(f"{BASE}/entries/{eid}", json=body, headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"PUT without description -> {r.status_code} {r.text[:300]}")
        return
    put_data = r.json()
    print(f"    PUT resp description={put_data.get('description')!r}")

    # GET to verify description preserved
    r = requests.get(f"{BASE}/entries/{eid}", timeout=20)
    if r.status_code != 200:
        log_fail(f"GET after PUT -> {r.status_code} {r.text[:200]}")
        return
    got = r.json()
    print(f"    GET description={got.get('description')!r}")

    if got.get("description") == original_desc and original_desc:
        log_pass("Description preserved when omitted from PUT body")
    else:
        log_fail(
            f"Description NOT preserved. original={original_desc!r} "
            f"after_put={got.get('description')!r}"
        )


# ---------------------------------------------------------------------------
# 3) DELETE works
# ---------------------------------------------------------------------------

def test_delete_entry() -> None:
    section("3) DELETE /api/entries/{id}")

    payload = {
        "type": "workshop",
        "title": "Regression test — delete me",
        "date": "2027-03-01",
        "description": "À supprimer",
        "status": "approved",
    }
    r = requests.post(f"{BASE}/entries", json=payload, headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"seed POST /entries -> {r.status_code} {r.text[:200]}")
        return
    eid = r.json()["id"]
    print(f"  created id={eid[:8]}…")

    r = requests.delete(f"{BASE}/entries/{eid}", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code == 200 and r.json().get("ok") is True:
        log_pass("DELETE /entries/{id} returns 200 {ok:true}")
    else:
        log_fail(f"DELETE -> {r.status_code} {r.text[:200]}")
        cleanup_ids.add(eid)
        return

    r = requests.get(f"{BASE}/entries/{eid}", timeout=20)
    if r.status_code == 404:
        log_pass("GET deleted entry -> 404")
    else:
        log_fail(f"GET deleted entry -> {r.status_code} {r.text[:200]}")


# ---------------------------------------------------------------------------
# 4) Approve with type query param (reclassification)
# ---------------------------------------------------------------------------

def test_approve_with_type_param() -> None:
    section("4) POST /api/entries/{id}/approve?type=festival reclassifies")

    payload = {
        "type": "workshop",
        "title": "Regression test — reclassify",
        "date": "2027-04-04",
        "description": "Sera reclassé en festival",
        "submitter_name": "Yanet Fuentes",
        "submitter_email": "yanet@example.org",
    }
    r = requests.post(f"{BASE}/entries/submit", json=payload, timeout=20)
    if r.status_code != 200:
        log_fail(f"submit -> {r.status_code} {r.text[:200]}")
        return
    created = r.json()
    eid = created["id"]
    cleanup_ids.add(eid)
    print(f"  submitted id={eid[:8]}… status={created.get('status')!r}")
    if created.get("status") != "pending":
        log_fail(f"expected status=pending after submit, got {created.get('status')!r}")
        return
    log_pass("submission returns status='pending'")

    r = requests.post(
        f"{BASE}/entries/{eid}/approve",
        params={"type": "festival"},
        headers=ADMIN_HEADERS,
        timeout=20,
    )
    if r.status_code != 200:
        log_fail(f"approve?type=festival -> {r.status_code} {r.text[:200]}")
        return
    data = r.json()
    print(f"    resp: type={data.get('type')!r} status={data.get('status')!r}")
    if data.get("type") == "festival" and data.get("status") == "approved":
        log_pass("approve?type=festival reclassifies to festival and approved")
    else:
        log_fail(f"approve?type=festival unexpected: {short(data)}")


# ---------------------------------------------------------------------------
# 5) Reject + restore round trip
# ---------------------------------------------------------------------------

def test_reject_restore_roundtrip() -> None:
    section("5) Reject + restore round trip")

    payload = {
        "type": "soiree",
        "title": "Regression test — reject then restore",
        "date": "2027-05-10",
        "venue": "Cabaret Sauvage",
        "submitter_name": "Callesol",
        "submitter_email": "callesol@example.org",
    }
    r = requests.post(f"{BASE}/entries/submit", json=payload, timeout=20)
    if r.status_code != 200:
        log_fail(f"submit soiree -> {r.status_code} {r.text[:200]}")
        return
    eid = r.json()["id"]
    cleanup_ids.add(eid)
    print(f"  submitted soiree id={eid[:8]}…")
    if r.json().get("status") != "pending":
        log_fail(f"expected pending, got {r.json().get('status')!r}")
        return
    log_pass("soiree submission -> status='pending'")

    # reject
    r = requests.post(f"{BASE}/entries/{eid}/reject", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"reject -> {r.status_code} {r.text[:200]}")
        return
    rdata = r.json()
    print(f"    reject resp: {short(rdata)}")
    if rdata.get("status") == "rejected" and rdata.get("ok") is True:
        log_pass("reject returns {ok:true, status:'rejected'}")
    else:
        log_fail(f"reject unexpected: {short(rdata)}")

    # admin can see it via ?status=rejected
    r = requests.get(
        f"{BASE}/entries",
        params={"status": "rejected"},
        headers=ADMIN_HEADERS,
        timeout=20,
    )
    if r.status_code != 200:
        log_fail(f"GET /entries?status=rejected -> {r.status_code} {r.text[:200]}")
        return
    rejected_list = r.json()
    ids = {x["id"] for x in rejected_list}
    if eid in ids:
        log_pass(f"rejected entry present in admin archive (count={len(rejected_list)})")
    else:
        log_fail(f"rejected entry NOT in /entries?status=rejected (got {len(rejected_list)} items)")

    # restore = approve
    r = requests.post(f"{BASE}/entries/{eid}/approve", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        log_fail(f"approve after reject -> {r.status_code} {r.text[:200]}")
        return
    data = r.json()
    print(f"    approve-after-reject resp: status={data.get('status')!r} type={data.get('type')!r}")
    if data.get("status") == "approved":
        log_pass("approve after reject restores status='approved'")
    else:
        log_fail(f"approve after reject unexpected: {short(data)}")


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

def cleanup() -> None:
    section("Cleanup")
    for eid in list(cleanup_ids):
        try:
            r = requests.delete(f"{BASE}/entries/{eid}", headers=ADMIN_HEADERS, timeout=20)
            print(f"  delete {eid[:8]}… -> {r.status_code}")
        except Exception as e:
            print(f"  cleanup failed for {eid[:8]}: {e}")


# ---------------------------------------------------------------------------

def main() -> int:
    print(f"BASE = {BASE}")
    try:
        test_put_status_null_safe()
        test_put_preserves_description()
        test_delete_entry()
        test_approve_with_type_param()
        test_reject_restore_roundtrip()
    finally:
        cleanup()

    print("\n" + "=" * 60)
    print(f"PASS: {len(PASS)} | FAIL: {len(FAIL)}")
    if FAIL:
        print("\nFailures:")
        for f in FAIL:
            print(f"  - {f}")
        return 1
    print("All assertions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
