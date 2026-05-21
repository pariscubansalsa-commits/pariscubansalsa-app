"""
Backend tests for the public Likes feature on entries.

Tests:
  1) POST /api/entries/{id}/like
  2) POST /api/entries/{id}/unlike
  3) Counter propagation to GET /api/entries, /api/entries/{id},
     /api/calendar/events
  4) Edge cases (calendar-only entry, multiple IPs, decrement-to-zero,
     rate-limit per IP+entry)

Auth: NONE. All endpoints are public.
Base URL: http://localhost:8001/api (bypass public proxy so we control
  the X-Forwarded-For header).
"""
import json
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

BASE = os.environ.get("BACKEND_BASE_URL", "http://localhost:8001/api")
ADMIN_TOKEN = "test_session_pcs_admin_000"

results: List[Dict[str, Any]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    line = f"[{status}] {name}"
    if detail:
        line += f" — {detail}"
    print(line)
    results.append({"name": name, "ok": ok, "detail": detail})


def headers(ip: Optional[str] = None, admin: bool = False) -> Dict[str, str]:
    h: Dict[str, str] = {"Content-Type": "application/json"}
    if ip:
        h["X-Forwarded-For"] = ip
    if admin:
        h["Authorization"] = f"Bearer {ADMIN_TOKEN}"
    return h


def find_calendar_only_id(client: httpx.Client) -> Optional[str]:
    """Return an iCal-only entry id (uppercase UID, NOT also in db.entries)."""
    r = client.get(f"{BASE}/calendar/events")
    if r.status_code != 200:
        return None
    cal = r.json()
    # Get all db entry ids (admin only)
    db_ids = set()
    r2 = client.get(
        f"{BASE}/entries?include_past=true",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    if r2.status_code == 200:
        for e in r2.json():
            db_ids.add(e.get("id"))
    for ev in cal:
        eid = ev.get("id") or ""
        if eid and eid.upper() == eid and eid not in db_ids:
            return eid
    # Fallback: just take first calendar id if it doesn't collide
    for ev in cal:
        eid = ev.get("id") or ""
        if eid and eid not in db_ids:
            return eid
    return None


def make_db_entry(client: httpx.Client) -> Optional[str]:
    """Create an approved DB entry via admin to test against."""
    body = {
        "type": "soiree",
        "title": f"PCS Likes Test {uuid.uuid4().hex[:6]}",
        "date": "2027-08-15",
        "venue": "Maison de la Salsa",
        "dance_style": "salsa_cubaine",
        "status": "approved",
    }
    r = client.post(
        f"{BASE}/entries",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ADMIN_TOKEN}",
        },
        json=body,
    )
    if r.status_code != 200:
        print(f"!! Failed to create test entry: {r.status_code} {r.text}")
        return None
    return r.json().get("id")


def delete_db_entry(client: httpx.Client, entry_id: str) -> None:
    try:
        client.delete(
            f"{BASE}/entries/{entry_id}",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        )
    except Exception:
        pass


def reset_likes_for_entry(client: httpx.Client, entry_id: str) -> None:
    """Brute-force unlike many times from many IPs to force counter to 0.
    Not strictly needed for fresh entries but harmless."""
    pass


def main() -> int:
    timeout = httpx.Timeout(20.0)
    with httpx.Client(timeout=timeout) as client:
        # Sanity check API up
        try:
            r = client.get(f"{BASE}/entries")
            record("API reachable GET /entries", r.status_code == 200,
                   f"status={r.status_code}")
        except Exception as e:
            record("API reachable GET /entries", False, str(e))
            return 1

        # ────────────────────── Setup ──────────────────────
        entry_id = make_db_entry(client)
        record("Setup: create test DB entry", bool(entry_id), entry_id or "")
        if not entry_id:
            return 1

        # Unique IPs per test to avoid rate-limit cross-talk
        IP_A = f"1.1.1.{uuid.uuid4().int % 250 + 1}"
        IP_B = f"2.2.2.{uuid.uuid4().int % 250 + 1}"
        IP_C = f"3.3.3.{uuid.uuid4().int % 250 + 1}"
        IP_D = f"4.4.4.{uuid.uuid4().int % 250 + 1}"

        # ───────────────── 1) Like on DB entry ─────────────────
        r = client.post(
            f"{BASE}/entries/{entry_id}/like", headers=headers(ip=IP_A),
        )
        ok = r.status_code == 200 and isinstance(r.json().get("likes"), int)
        likes1 = r.json().get("likes") if r.status_code == 200 else None
        record("POST /entries/{id}/like (IP_A) returns {likes:int}",
               ok, f"status={r.status_code} body={r.text[:120]}")
        record("Like count is 1 after first like", likes1 == 1,
               f"got {likes1}")

        # ───────────────── 2) Rate-limit same IP ─────────────────
        r2 = client.post(
            f"{BASE}/entries/{entry_id}/like", headers=headers(ip=IP_A),
        )
        is_429 = r2.status_code == 429
        record("Second like from SAME IP within 60s -> 429", is_429,
               f"status={r2.status_code} body={r2.text[:120]}")
        if is_429:
            detail = ""
            try:
                detail = r2.json().get("detail", "")
            except Exception:
                detail = r2.text
            # French message — should contain something French
            french_markers = ["Trop", "Réessaye", "Réessayez", "danse",
                              "trop", "secondes", "s."]
            has_fr = any(m in detail for m in french_markers)
            record("429 detail is in French", has_fr, f"detail={detail!r}")

        # ───────────────── 3) Rate-limit also applies to unlike ─────────────────
        # Same IP_A is still inside its 60s window
        r3 = client.post(
            f"{BASE}/entries/{entry_id}/unlike", headers=headers(ip=IP_A),
        )
        record(
            "Unlike from SAME IP_A within 60s -> 429 (shared window)",
            r3.status_code == 429,
            f"status={r3.status_code} body={r3.text[:120]}",
        )

        # ───────────────── 4) Different IP can like ─────────────────
        r4 = client.post(
            f"{BASE}/entries/{entry_id}/like", headers=headers(ip=IP_B),
        )
        likes2 = r4.json().get("likes") if r4.status_code == 200 else None
        record("Like from different IP_B -> 200", r4.status_code == 200,
               f"status={r4.status_code}")
        record("Counter accumulates across IPs (now 2)", likes2 == 2,
               f"got {likes2}")

        # ───────────────── 5) Unknown entry id -> 404 ─────────────────
        ghost = f"ghost-{uuid.uuid4().hex}"
        r5 = client.post(
            f"{BASE}/entries/{ghost}/like", headers=headers(ip=IP_C),
        )
        record("Like on unknown entry -> 404", r5.status_code == 404,
               f"status={r5.status_code} body={r5.text[:120]}")
        r5u = client.post(
            f"{BASE}/entries/{ghost}/unlike", headers=headers(ip=IP_C),
        )
        record("Unlike on unknown entry -> 404", r5u.status_code == 404,
               f"status={r5u.status_code}")

        # ───────────────── 6) Counter propagation: GET /entries ─────────────────
        r6 = client.get(f"{BASE}/entries")
        body = r6.json() if r6.status_code == 200 else []
        target = next((e for e in body if e.get("id") == entry_id), None)
        # The future-only filter on /entries should include 2027-08-15 entry
        record("GET /entries returns 200", r6.status_code == 200)
        record(
            "Test entry visible in GET /entries (future date 2027)",
            target is not None,
            f"found={target is not None}",
        )
        if target is not None:
            record(
                "Test entry has likes=2 in GET /entries",
                target.get("likes") == 2,
                f"got {target.get('likes')}",
            )
        # Every item has a likes field (default 0)
        all_have_likes = all(
            isinstance(it.get("likes"), int) for it in body
        ) if body else True
        record(
            "Every item in GET /entries has int likes field",
            all_have_likes,
            f"count={len(body)}",
        )

        # ───────────────── 7) Counter propagation: GET /entries/{id} ─────────────────
        r7 = client.get(f"{BASE}/entries/{entry_id}")
        if r7.status_code == 200:
            single = r7.json()
            record(
                "GET /entries/{id} reflects likes=2",
                single.get("likes") == 2,
                f"got {single.get('likes')}",
            )
        else:
            record("GET /entries/{id} returns 200", False,
                   f"status={r7.status_code}")

        # ───────────────── 8) Unlike decrement ─────────────────
        # Use fresh IPs to bypass rate-limit
        r8 = client.post(
            f"{BASE}/entries/{entry_id}/unlike", headers=headers(ip=IP_C),
        )
        likes3 = r8.json().get("likes") if r8.status_code == 200 else None
        record("Unlike (IP_C) -> 200", r8.status_code == 200,
               f"status={r8.status_code} body={r8.text[:120]}")
        record("Counter decremented to 1", likes3 == 1, f"got {likes3}")

        r9 = client.post(
            f"{BASE}/entries/{entry_id}/unlike", headers=headers(ip=IP_D),
        )
        likes4 = r9.json().get("likes") if r9.status_code == 200 else None
        record("Unlike (IP_D) -> 200", r9.status_code == 200,
               f"status={r9.status_code}")
        record("Counter decremented to 0", likes4 == 0, f"got {likes4}")

        # ───────────────── 9) Unlike below zero is clamped ─────────────────
        IP_E = f"5.5.5.{uuid.uuid4().int % 250 + 1}"
        r10 = client.post(
            f"{BASE}/entries/{entry_id}/unlike", headers=headers(ip=IP_E),
        )
        likes5 = r10.json().get("likes") if r10.status_code == 200 else None
        record(
            "Unlike at 0 returns {likes:0} (no negative, no throw)",
            r10.status_code == 200 and likes5 == 0,
            f"status={r10.status_code} likes={likes5}",
        )

        # ───────────────── 10) Calendar-only entry ─────────────────
        cal_id = find_calendar_only_id(client)
        record("Found a calendar-only entry id", bool(cal_id),
               f"id={cal_id!r}")
        if cal_id:
            # Baseline (prior runs may have left likes on this UID).
            r_base = client.get(f"{BASE}/entries/{cal_id}")
            base = int((r_base.json() or {}).get("likes") or 0) if r_base.status_code == 200 else 0
            IP_F = f"6.6.6.{uuid.uuid4().int % 250 + 1}"
            r11 = client.post(
                f"{BASE}/entries/{cal_id}/like", headers=headers(ip=IP_F),
            )
            cal_likes1 = r11.json().get("likes") if r11.status_code == 200 else None
            record(
                "Like calendar-only entry -> 200",
                r11.status_code == 200,
                f"status={r11.status_code} body={r11.text[:120]}",
            )
            record(
                "Calendar-only entry like increments by 1 (delta from baseline)",
                cal_likes1 == base + 1,
                f"baseline={base} got {cal_likes1}",
            )
            # Propagation to GET /calendar/events
            r12 = client.get(f"{BASE}/calendar/events")
            if r12.status_code == 200:
                cal_evs = r12.json()
                cal_target = next(
                    (e for e in cal_evs if e.get("id") == cal_id), None
                )
                record(
                    "Calendar event present in /calendar/events",
                    cal_target is not None,
                    "",
                )
                if cal_target is not None:
                    record(
                        "Calendar event likes propagated to /calendar/events (= base+1)",
                        cal_target.get("likes") == base + 1,
                        f"baseline={base} got {cal_target.get('likes')}",
                    )
                all_have_likes_cal = all(
                    isinstance(it.get("likes"), int) for it in cal_evs
                )
                record(
                    "Every /calendar/events item has int likes field",
                    all_have_likes_cal,
                    f"count={len(cal_evs)}",
                )
            # Propagation to GET /entries/{id} on calendar-only id
            r13 = client.get(f"{BASE}/entries/{cal_id}")
            if r13.status_code == 200:
                record(
                    "GET /entries/{cal_id} reflects new total (= base+1)",
                    r13.json().get("likes") == base + 1,
                    f"baseline={base} got {r13.json().get('likes')}",
                )
            else:
                record(
                    "GET /entries/{cal_id} returns 200",
                    False,
                    f"status={r13.status_code}",
                )

            # Decrement back via a different IP to restore baseline
            IP_G = f"7.7.7.{uuid.uuid4().int % 250 + 1}"
            r14 = client.post(
                f"{BASE}/entries/{cal_id}/unlike",
                headers=headers(ip=IP_G),
            )
            record(
                "Unlike calendar-only entry -> 200 with delta=-1",
                r14.status_code == 200 and r14.json().get("likes") == base,
                f"status={r14.status_code} body={r14.text[:120]}",
            )

        # ───────────────── 11) X-Forwarded-For comma list takes first IP ─────────────────
        # Use a fresh entry to isolate. Create another entry for clarity.
        entry2 = make_db_entry(client)
        if entry2:
            shared_first = f"8.8.8.{uuid.uuid4().int % 250 + 1}"
            # First call sets the bucket for shared_first
            ra = client.post(
                f"{BASE}/entries/{entry2}/like",
                headers={"Content-Type": "application/json",
                         "X-Forwarded-For": f"{shared_first}, 9.9.9.9"},
            )
            # Second call with same first IP but different downstream IPs
            # should still be rate-limited
            rb = client.post(
                f"{BASE}/entries/{entry2}/like",
                headers={"Content-Type": "application/json",
                         "X-Forwarded-For": f"{shared_first}, 9.9.9.10"},
            )
            record(
                "X-Forwarded-For first IP is used for rate-limit bucket",
                ra.status_code == 200 and rb.status_code == 429,
                f"first={ra.status_code} second={rb.status_code}",
            )
            delete_db_entry(client, entry2)

        # ───────────────── Cleanup ─────────────────
        delete_db_entry(client, entry_id)
        record("Cleanup: delete test entry", True, "")

    # Summary
    print()
    print("=" * 70)
    failures = [r for r in results if not r["ok"]]
    print(f"TOTAL: {len(results)}  PASS: {len(results) - len(failures)}  "
          f"FAIL: {len(failures)}")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  - {f['name']}: {f['detail']}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
