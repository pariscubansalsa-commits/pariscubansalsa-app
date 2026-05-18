"""Test suite for Paris Cuban Salsa email notification (Resend) backend integration.

Tests:
1. Auth gating of /api/admin/notify/test
2. Response shape of POST /api/admin/notify/test (admin)
3. POST /api/entries/submit triggers background task without delay
4. All 5 entry types submit successfully
5. Missing submitter_name/submitter_email -> 400
6. Workshop with no teacher_id -> status='pending'
7. Cleanup of all created entries

Usage: python /app/backend_test_email_notify.py
"""
from __future__ import annotations
import os
import sys
import time
import json
import requests

# Backend URL: prefer EXPO_PUBLIC_BACKEND_URL (set in frontend/.env), fallback to localhost
BACKEND_URL = os.environ.get("BACKEND_URL") or "https://rhythm-frames-3.preview.emergentagent.com"
API = f"{BACKEND_URL.rstrip('/')}/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

results: list[tuple[str, bool, str]] = []
created_entry_ids: list[str] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name} :: {detail[:300]}")


def main() -> int:
    print(f"Testing against API: {API}\n")

    # ============================================================
    # 1) GET /api/admin/notify/test should NOT exist (only POST)
    # ============================================================
    r = requests.get(f"{API}/admin/notify/test", timeout=10)
    record(
        "1a GET /admin/notify/test returns 405 (method not allowed) or 404",
        r.status_code in (404, 405),
        f"status={r.status_code}",
    )

    # POST without auth -> 401/403
    r = requests.post(f"{API}/admin/notify/test", timeout=10)
    record(
        "1b POST /admin/notify/test without auth -> 401/403",
        r.status_code in (401, 403),
        f"status={r.status_code} body={r.text[:200]}",
    )

    # ============================================================
    # 2) POST /api/admin/notify/test with admin token
    # ============================================================
    r = requests.post(f"{API}/admin/notify/test", headers=ADMIN_HEADERS, timeout=15)
    record(
        "2a POST /admin/notify/test with admin token -> 200",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:300]}",
    )
    if r.status_code == 200:
        body = r.json()
        # ok is boolean
        record(
            "2b response.ok is boolean",
            isinstance(body.get("ok"), bool),
            f"ok={body.get('ok')!r} type={type(body.get('ok')).__name__}",
        )
        # sent_to is null or string
        sent_to = body.get("sent_to", "MISSING")
        record(
            "2c response.sent_to is null or string",
            sent_to is None or isinstance(sent_to, str),
            f"sent_to={sent_to!r}",
        )
        # sender is a string
        sender = body.get("sender")
        record(
            "2d response.sender is a string",
            isinstance(sender, str) and len(sender) > 0,
            f"sender={sender!r}",
        )
        # public_url is "https://pariscubansalsa.com" (or whatever PUBLIC_APP_URL is)
        public_url = body.get("public_url")
        record(
            "2e response.public_url is a string (default expected: https://pariscubansalsa.com)",
            isinstance(public_url, str) and public_url.startswith("http"),
            f"public_url={public_url!r}",
        )
        # api_key_configured is boolean
        api_key_configured = body.get("api_key_configured")
        record(
            "2f response.api_key_configured is boolean",
            isinstance(api_key_configured, bool),
            f"api_key_configured={api_key_configured!r}",
        )
        # In local dev: api_key_configured should be False and ok should be False (graceful)
        record(
            "2g graceful degradation: api_key_configured=False -> ok=False, no 500",
            (not api_key_configured and body.get("ok") is False) or api_key_configured,
            f"api_key_configured={api_key_configured} ok={body.get('ok')}",
        )

    # ============================================================
    # 3) POST /api/entries/submit with mensuelle payload — must be fast
    # ============================================================
    payload = {
        "type": "mensuelle",
        "title": "Email Notify Test",
        "date": "2027-08-20",
        "time": "21:00",
        "venue": "Test Venue",
        "submitter_name": "Test User",
        "submitter_email": "test@example.com",
    }
    t0 = time.monotonic()
    r = requests.post(f"{API}/entries/submit", json=payload, timeout=15)
    elapsed = time.monotonic() - t0
    record(
        "3a POST /entries/submit (mensuelle) -> 200",
        r.status_code == 200,
        f"status={r.status_code} elapsed={elapsed:.3f}s body={r.text[:200]}",
    )
    if r.status_code == 200:
        data = r.json()
        eid = data.get("id")
        if eid:
            created_entry_ids.append(eid)
        record(
            "3b response has valid id (uuid-like)",
            bool(eid) and isinstance(eid, str) and len(eid) >= 10,
            f"id={eid!r}",
        )
        record(
            "3c response.status == 'pending'",
            data.get("status") == "pending",
            f"status={data.get('status')!r}",
        )
        record(
            "3d response is fast (< 2s) — background task should not block",
            elapsed < 2.0,
            f"elapsed={elapsed:.3f}s",
        )

    # ============================================================
    # 4) Submit one entry per type
    # ============================================================
    type_payloads = {
        "soiree": {
            "type": "soiree", "title": "Soirée Cubaine Test E2E",
            "date": "2027-09-01", "time": "22:00",
            "venue": "La Casa",
            "submitter_name": "Marie Dupont", "submitter_email": "marie@test.fr",
        },
        "mensuelle": {
            "type": "mensuelle", "title": "Mensuelle Test E2E",
            "date": "2027-09-05", "time": "21:00",
            "venue": "Le Cabaret",
            "submitter_name": "Jean Martin", "submitter_email": "jean@test.fr",
        },
        "workshop": {
            "type": "workshop", "title": "Workshop Casino Test E2E",
            "date": "2027-09-10", "time": "14:00", "level": "intermediate",
            "venue": "Studio Salsa",
            "submitter_name": "Lucia Garcia", "submitter_email": "lucia@test.fr",
        },
        "festival": {
            "type": "festival", "title": "Festival Cubain Test E2E",
            "date": "2027-09-15", "end_date": "2027-09-17",
            "venue": "Parc Floral",
            "submitter_name": "Pierre Dubois", "submitter_email": "pierre@test.fr",
        },
        "agenda": {
            "type": "agenda", "title": "Sortie Agenda Test E2E",
            "date": "2027-09-20",
            "venue": "Café Latino",
            "submitter_name": "Sophie Bernard", "submitter_email": "sophie@test.fr",
        },
    }
    for t, payload in type_payloads.items():
        r = requests.post(f"{API}/entries/submit", json=payload, timeout=15)
        ok = r.status_code == 200
        eid = None
        if ok:
            data = r.json()
            eid = data.get("id")
            if eid:
                created_entry_ids.append(eid)
        record(
            f"4 submit type={t} -> 200 with valid id",
            ok and bool(eid),
            f"status={r.status_code} id={eid!r} body_snippet={r.text[:150]}",
        )

    # ============================================================
    # 5) Negative — missing submitter_name / submitter_email -> 400
    # ============================================================
    bad_payload_no_name = {
        "type": "soiree", "title": "Bad", "date": "2027-09-01",
        "submitter_email": "x@y.com",
    }
    r = requests.post(f"{API}/entries/submit", json=bad_payload_no_name, timeout=10)
    # FastAPI will return 422 if pydantic rejects (required field missing).
    # Endpoint code also returns 400 explicitly for empty strings.
    record(
        "5a POST /entries/submit missing submitter_name -> 4xx",
        r.status_code in (400, 422),
        f"status={r.status_code} body={r.text[:200]}",
    )
    bad_payload_no_email = {
        "type": "soiree", "title": "Bad", "date": "2027-09-01",
        "submitter_name": "X",
    }
    r = requests.post(f"{API}/entries/submit", json=bad_payload_no_email, timeout=10)
    record(
        "5b POST /entries/submit missing submitter_email -> 4xx",
        r.status_code in (400, 422),
        f"status={r.status_code} body={r.text[:200]}",
    )
    # Also try with explicitly empty strings (should be 400)
    bad_payload_empty = {
        "type": "soiree", "title": "Bad", "date": "2027-09-01",
        "submitter_name": "", "submitter_email": "",
    }
    r = requests.post(f"{API}/entries/submit", json=bad_payload_empty, timeout=10)
    record(
        "5c POST /entries/submit empty name+email -> 400",
        r.status_code == 400,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # ============================================================
    # 6) Workshop with NO teacher_id should still work + status=pending
    # ============================================================
    payload = {
        "type": "workshop", "title": "Workshop No Teacher E2E",
        "date": "2027-09-25", "time": "15:00",
        "venue": "Studio Test",
        "submitter_name": "Test NoTeacher", "submitter_email": "noteacher@test.fr",
    }
    r = requests.post(f"{API}/entries/submit", json=payload, timeout=15)
    ok = r.status_code == 200
    if ok:
        data = r.json()
        eid = data.get("id")
        if eid:
            created_entry_ids.append(eid)
        record(
            "6a workshop without teacher_id -> 200 with status='pending'",
            data.get("status") == "pending",
            f"status={r.status_code} body_status={data.get('status')!r}",
        )
    else:
        record(
            "6a workshop without teacher_id -> 200 with status='pending'",
            False,
            f"status={r.status_code} body={r.text[:200]}",
        )

    # ============================================================
    # 7) CLEANUP: delete all created entries
    # ============================================================
    print(f"\nCleaning up {len(created_entry_ids)} created entries...")
    deleted = 0
    failed_deletes = []
    for eid in created_entry_ids:
        r = requests.delete(f"{API}/entries/{eid}", headers=ADMIN_HEADERS, timeout=10)
        if r.status_code == 200:
            deleted += 1
        else:
            failed_deletes.append((eid, r.status_code, r.text[:100]))
    record(
        "7a all created entries deleted",
        deleted == len(created_entry_ids),
        f"deleted={deleted}/{len(created_entry_ids)} failed={failed_deletes}",
    )
    # Verify zero residuals by GET on each
    residuals = []
    for eid in created_entry_ids:
        r = requests.get(f"{API}/entries/{eid}", timeout=10)
        if r.status_code != 404:
            residuals.append((eid, r.status_code))
    record(
        "7b verify no residuals (GET each id -> 404)",
        len(residuals) == 0,
        f"residuals={residuals}",
    )

    # ============================================================
    # Summary
    # ============================================================
    pass_count = sum(1 for _, ok, _ in results if ok)
    fail_count = sum(1 for _, ok, _ in results if not ok)
    print("\n" + "=" * 70)
    print(f"SUMMARY: {pass_count} PASS / {fail_count} FAIL out of {len(results)}")
    print("=" * 70)
    if fail_count:
        print("\nFAILED ASSERTIONS:")
        for name, ok, detail in results:
            if not ok:
                print(f"  ❌ {name}\n     {detail}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
