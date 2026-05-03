"""
Backend regression test — BLOC 5 (dance_style) + BLOC 1 (Recurrence / RRULE)
Run: python /app/backend_test.py
"""
import os
import sys
import json
import uuid
from datetime import datetime, date, timedelta
import requests

BACKEND_URL = os.environ.get(
    "BACKEND_URL",
    "https://rhythm-frames-3.preview.emergentagent.com",
).rstrip("/")
API = f"{BACKEND_URL}/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
H_ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

PASS = 0
FAIL = 0
FAILS = []

CREATED_IDS = set()  # track ids to clean up


def log(msg):
    print(msg, flush=True)


def assert_ok(cond, label, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        log(f"  PASS: {label}")
    else:
        FAIL += 1
        FAILS.append(f"{label}{(' — ' + detail) if detail else ''}")
        log(f"  FAIL: {label}  {detail}")


def track(entry_id):
    if entry_id:
        CREATED_IDS.add(entry_id)


def cleanup_id(entry_id, scope="all"):
    if not entry_id:
        return
    try:
        requests.delete(f"{API}/entries/{entry_id}", params={"scope": scope}, headers=H_ADMIN, timeout=10)
    except Exception:
        pass


# =========================================================================
# BLOC 5 — DANCE_STYLE
# =========================================================================
def test_bloc5_dance_style():
    log("\n=== BLOC 5 — dance_style ===")

    # ---- B5.1: filter ?dance_style=multi_styles
    r = requests.get(f"{API}/entries", params={"dance_style": "multi_styles"}, timeout=15)
    assert_ok(r.status_code == 200, "GET /entries?dance_style=multi_styles -> 200", f"got {r.status_code}")
    if r.status_code == 200:
        items = r.json()
        all_multi = all(e.get("dance_style") == "multi_styles" for e in items)
        assert_ok(all_multi, "All filtered entries have dance_style=='multi_styles'",
                  f"non-multi count={sum(1 for e in items if e.get('dance_style')!='multi_styles')}, total={len(items)}")

    # ---- B5.2: invalid filter -> 400
    r = requests.get(f"{API}/entries", params={"dance_style": "foobar"}, timeout=15)
    assert_ok(r.status_code == 400, "GET /entries?dance_style=foobar -> 400", f"got {r.status_code} body={r.text[:200]}")

    # ---- B5.3: POST /entries with dance_style="on2" -> persisted
    body = {
        "type": "soiree",
        "title": "ON2 Test BLOC5",
        "date": "2027-06-01",
        "dance_style": "on2",
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "POST /entries with dance_style=on2 -> 200",
              f"got {r.status_code} body={r.text[:300]}")
    on2_id = None
    if r.status_code == 200:
        d = r.json()
        on2_id = d.get("id")
        track(on2_id)
        assert_ok(d.get("dance_style") == "on2", "Response dance_style == 'on2'", f"got {d.get('dance_style')}")

    # ---- B5.4: POST /entries with invalid dance_style -> 400 with French msg
    body_bad = {
        "type": "soiree",
        "title": "Bad style",
        "date": "2027-06-02",
        "dance_style": "reggaeton",
    }
    r = requests.post(f"{API}/entries", json=body_bad, headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 400, "POST /entries with dance_style=reggaeton -> 400", f"got {r.status_code}")
    if r.status_code == 400:
        detail = r.json().get("detail", "")
        assert_ok("invalide" in detail.lower() or "doit" in detail.lower(),
                  "Error detail is in French", f"detail={detail}")

    # ---- B5.5: POST /entries with NO dance_style -> defaults to "multi_styles"
    body_default = {
        "type": "soiree",
        "title": "Default style test",
        "date": "2027-06-03",
    }
    r = requests.post(f"{API}/entries", json=body_default, headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "POST /entries without dance_style -> 200",
              f"got {r.status_code} body={r.text[:300]}")
    default_id = None
    if r.status_code == 200:
        d = r.json()
        default_id = d.get("id")
        track(default_id)
        assert_ok(d.get("dance_style") == "multi_styles",
                  "Default dance_style == 'multi_styles'", f"got {d.get('dance_style')}")

    # ---- B5.6: PUT /entries/{id} with dance_style="salsa_cubaine" -> persisted
    if on2_id:
        upd = {
            "type": "soiree",
            "title": "ON2 Test BLOC5",
            "date": "2027-06-01",
            "dance_style": "salsa_cubaine",
        }
        r = requests.put(f"{API}/entries/{on2_id}", json=upd, headers=H_ADMIN, timeout=15)
        assert_ok(r.status_code == 200, "PUT /entries/{id} dance_style=salsa_cubaine -> 200",
                  f"got {r.status_code} body={r.text[:300]}")
        if r.status_code == 200:
            r2 = requests.get(f"{API}/entries/{on2_id}", timeout=15)
            assert_ok(r2.status_code == 200 and r2.json().get("dance_style") == "salsa_cubaine",
                      "Updated dance_style persisted as 'salsa_cubaine'",
                      f"got {r2.json().get('dance_style') if r2.status_code==200 else r2.status_code}")

    # ---- B5.7: PUT with invalid dance_style -> 400
    if on2_id:
        bad = {
            "type": "soiree",
            "title": "ON2 Test BLOC5",
            "date": "2027-06-01",
            "dance_style": "kizomba",
        }
        r = requests.put(f"{API}/entries/{on2_id}", json=bad, headers=H_ADMIN, timeout=15)
        assert_ok(r.status_code == 400, "PUT /entries/{id} dance_style=kizomba -> 400",
                  f"got {r.status_code}")

    # ---- B5.8: Migration sanity — every entry has non-null dance_style
    r = requests.get(f"{API}/entries", timeout=15)
    if r.status_code == 200:
        items = r.json()
        assert_ok(len(items) > 0, "GET /entries returns >0 entries", f"count={len(items)}")
        all_have_ds = all(e.get("dance_style") not in (None, "") for e in items)
        nulls = [e.get("id") for e in items if e.get("dance_style") in (None, "")]
        assert_ok(all_have_ds, "All entries have non-null dance_style",
                  f"nulls count={len(nulls)} sample={nulls[:3]}")

    # cleanup
    cleanup_id(on2_id)
    cleanup_id(default_id)


# =========================================================================
# BLOC 1 — RECURRENCE
# =========================================================================
def get_entries_by_title(title, type_=None, include_past=True):
    """Fetch all entries (past+future for admin) matching title.

    Note: backend's include_past=true returns ONLY strictly past events,
    so we make two calls and merge.
    """
    seen = {}
    # Future + today via public GET (no auth needed)
    params_future = {}
    if type_:
        params_future["type"] = type_
    r = requests.get(f"{API}/entries", params=params_future, timeout=15)
    if r.status_code == 200:
        for e in r.json():
            if e.get("title") == title:
                seen[e["id"]] = e
    if include_past:
        params_past = {"include_past": "true"}
        if type_:
            params_past["type"] = type_
        r = requests.get(f"{API}/entries", params=params_past, headers=H_ADMIN, timeout=15)
        if r.status_code == 200:
            for e in r.json():
                if e.get("title") == title:
                    seen[e["id"]] = e
    return list(seen.values())


def test_bloc1_weekly_master():
    log("\n=== BLOC 1.A — Weekly master with count=4 ===")
    body = {
        "type": "soiree",
        "title": "Weekly Test BLOC1",
        "date": "2027-05-03",  # Monday
        "dance_style": "salsa_cubaine",
        "recurrence": {"freq": "weekly", "interval": 1, "count": 4},
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "POST /entries weekly master -> 200",
              f"got {r.status_code} body={r.text[:300]}")
    if r.status_code != 200:
        return None, []
    master = r.json()
    master_id = master.get("id")
    track(master_id)
    assert_ok(master.get("is_recurrence_master") is True,
              "Master is_recurrence_master == true", f"got {master.get('is_recurrence_master')}")
    assert_ok(master.get("parent_id") in (None, ""),
              "Master parent_id is None", f"got {master.get('parent_id')}")

    # Fetch all siblings
    items = get_entries_by_title("Weekly Test BLOC1")
    assert_ok(len(items) == 4, "Total entries with title 'Weekly Test BLOC1' == 4",
              f"got {len(items)}")
    children = [e for e in items if e.get("id") != master_id]
    for c in children:
        track(c["id"])
    assert_ok(len(children) == 3, "3 child occurrences created", f"got {len(children)}")

    # Check parent_id and occurrence_index on children
    parent_ids_correct = all(c.get("parent_id") == master_id for c in children)
    assert_ok(parent_ids_correct, "All children have parent_id == master_id")

    occ_indices = sorted([c.get("occurrence_index") for c in children])
    assert_ok(occ_indices == [1, 2, 3], "Occurrence indices are 1, 2, 3", f"got {occ_indices}")

    # Verify dates
    all_dates = sorted([e["date"] for e in items])
    expected = ["2027-05-03", "2027-05-10", "2027-05-17", "2027-05-24"]
    assert_ok(all_dates == expected, "Dates correct: 2027-05-03, 10, 17, 24", f"got {all_dates}")

    # Build sorted list of children by date for later use
    children_sorted = sorted(children, key=lambda e: e["date"])
    return master_id, children_sorted


def test_bloc1_monthly_weekday():
    log("\n=== BLOC 1.B — monthly_weekday ===")
    # 2027-02-05 = Friday, 1st Friday of February
    body = {
        "type": "soiree",
        "title": "MonthlyWeekday Test BLOC1",
        "date": "2027-02-05",
        "dance_style": "salsa_cubaine",
        "recurrence": {"freq": "monthly_weekday", "interval": 1, "count": 3},
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "POST /entries monthly_weekday -> 200",
              f"got {r.status_code} body={r.text[:300]}")
    if r.status_code != 200:
        return None
    master = r.json()
    master_id = master.get("id")
    track(master_id)

    items = get_entries_by_title("MonthlyWeekday Test BLOC1")
    for e in items:
        track(e["id"])
    all_dates = sorted([e["date"] for e in items])
    # Master 2027-02-05 (1st Fri Feb), child1 2027-03-05 (1st Fri Mar), child2 2027-04-02 (1st Fri Apr)
    expected = ["2027-02-05", "2027-03-05", "2027-04-02"]
    assert_ok(all_dates == expected, "Monthly weekday dates correct (1st Friday of Feb/Mar/Apr 2027)",
              f"got {all_dates}, expected {expected}")
    return master_id


def test_bloc1_scope_this(master_id, children_sorted):
    """children_sorted: [child1 @ 2027-05-10, child2 @ 2027-05-17, child3 @ 2027-05-24]"""
    log("\n=== BLOC 1.C — scope=this update ===")
    if not children_sorted or len(children_sorted) < 2:
        FAILS.append("scope=this prereq missing children")
        return
    child2 = children_sorted[1]  # 2027-05-17
    upd = {
        "type": "soiree",
        "title": "Changed",
        "date": child2["date"],
    }
    r = requests.put(f"{API}/entries/{child2['id']}", params={"scope": "this"}, json=upd,
                     headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "PUT child2 scope=this -> 200",
              f"got {r.status_code} body={r.text[:300]}")

    # Verify only child2 changed
    r2 = requests.get(f"{API}/entries/{child2['id']}", timeout=15)
    assert_ok(r2.status_code == 200 and r2.json().get("title") == "Changed",
              "child2 title now 'Changed'",
              f"got {r2.json().get('title') if r2.status_code==200 else r2.status_code}")

    siblings_check = []
    for sid in [master_id] + [c["id"] for c in children_sorted if c["id"] != child2["id"]]:
        rr = requests.get(f"{API}/entries/{sid}", timeout=15)
        if rr.status_code == 200:
            siblings_check.append((sid, rr.json().get("title")))
    others_unchanged = all(t == "Weekly Test BLOC1" for _, t in siblings_check)
    assert_ok(others_unchanged, "Master + child1 + child3 still have original title 'Weekly Test BLOC1'",
              f"got {siblings_check}")


def test_bloc1_scope_future(master_id, children_sorted):
    log("\n=== BLOC 1.D — scope=future update ===")
    if not children_sorted or len(children_sorted) < 3:
        FAILS.append("scope=future prereq missing children")
        return
    child2 = children_sorted[1]  # date 2027-05-17
    upd = {
        "type": "soiree",
        "title": "UPDATED",
        "date": child2["date"],
    }
    r = requests.put(f"{API}/entries/{child2['id']}", params={"scope": "future"}, json=upd,
                     headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "PUT child2 scope=future -> 200",
              f"got {r.status_code} body={r.text[:300]}")

    # Expected: child2 + child3 -> "UPDATED"; master + child1 unchanged
    titles = {}
    for sid in [master_id] + [c["id"] for c in children_sorted]:
        rr = requests.get(f"{API}/entries/{sid}", timeout=15)
        if rr.status_code == 200:
            titles[sid] = rr.json().get("title")

    child1_id = children_sorted[0]["id"]
    child2_id = children_sorted[1]["id"]
    child3_id = children_sorted[2]["id"]

    assert_ok(titles.get(master_id) == "Weekly Test BLOC1", "Master title unchanged",
              f"got {titles.get(master_id)}")
    assert_ok(titles.get(child1_id) == "Weekly Test BLOC1", "Child1 title unchanged",
              f"got {titles.get(child1_id)}")
    assert_ok(titles.get(child2_id) == "UPDATED", "Child2 title updated to 'UPDATED'",
              f"got {titles.get(child2_id)}")
    assert_ok(titles.get(child3_id) == "UPDATED", "Child3 title updated to 'UPDATED'",
              f"got {titles.get(child3_id)}")


def test_bloc1_scope_all(master_id, children_sorted):
    log("\n=== BLOC 1.E — scope=all update ===")
    if not children_sorted:
        FAILS.append("scope=all prereq missing children")
        return
    child1 = children_sorted[0]
    upd = {
        "type": "soiree",
        "title": "ALL UPDATE",
        "date": child1["date"],
    }
    r = requests.put(f"{API}/entries/{child1['id']}", params={"scope": "all"}, json=upd,
                     headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "PUT child1 scope=all -> 200",
              f"got {r.status_code} body={r.text[:300]}")

    titles = {}
    for sid in [master_id] + [c["id"] for c in children_sorted]:
        rr = requests.get(f"{API}/entries/{sid}", timeout=15)
        if rr.status_code == 200:
            titles[sid] = rr.json().get("title")
    all_updated = all(t == "ALL UPDATE" for t in titles.values())
    assert_ok(all_updated, "Master + all children have title 'ALL UPDATE'",
              f"got {titles}")


def test_bloc1_delete_all(master_id, children_sorted):
    log("\n=== BLOC 1.F — DELETE scope=all ===")
    if not master_id:
        FAILS.append("DELETE scope=all prereq missing master")
        return
    r = requests.delete(f"{API}/entries/{master_id}", params={"scope": "all"},
                        headers=H_ADMIN, timeout=15)
    assert_ok(r.status_code == 200, "DELETE master scope=all -> 200",
              f"got {r.status_code} body={r.text[:300]}")
    if r.status_code == 200:
        deleted = r.json().get("deleted")
        assert_ok(deleted == 4, "4 docs deleted (master + 3 children)", f"got {deleted}")

    # Verify all gone
    for sid in [master_id] + [c["id"] for c in (children_sorted or [])]:
        rr = requests.get(f"{API}/entries/{sid}", timeout=15)
        assert_ok(rr.status_code == 404, f"Entry {sid[:8]}.. now 404", f"got {rr.status_code}")
        if sid in CREATED_IDS:
            CREATED_IDS.discard(sid)


def test_bloc1_regenerate_non_master():
    log("\n=== BLOC 1.G — regenerate-occurrences on non-master -> 400 ===")
    # Create a simple non-master entry
    body = {
        "type": "soiree",
        "title": "NonMaster BLOC1",
        "date": "2027-07-15",
        "dance_style": "salsa_cubaine",
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    if r.status_code != 200:
        FAILS.append("Could not create non-master test entry")
        return
    eid = r.json().get("id")
    track(eid)
    r2 = requests.post(f"{API}/entries/{eid}/regenerate-occurrences", headers=H_ADMIN, timeout=15)
    assert_ok(r2.status_code == 400, "regenerate-occurrences on non-master -> 400",
              f"got {r2.status_code} body={r2.text[:200]}")
    cleanup_id(eid)


def test_bloc1_idempotency():
    log("\n=== BLOC 1.H — Idempotency: regenerate twice doesn't duplicate ===")
    body = {
        "type": "soiree",
        "title": "Idempotent BLOC1",
        "date": "2027-08-02",  # Monday
        "dance_style": "salsa_cubaine",
        "recurrence": {"freq": "weekly", "interval": 1, "count": 4},
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    if r.status_code != 200:
        FAILS.append("Idempotency setup failed")
        return
    master_id = r.json()["id"]
    track(master_id)

    # Get count before
    items_before = get_entries_by_title("Idempotent BLOC1")
    for e in items_before:
        track(e["id"])
    count_before = len(items_before)
    assert_ok(count_before == 4, "4 entries after master creation", f"got {count_before}")

    # Call regenerate-occurrences first time
    r1 = requests.post(f"{API}/entries/{master_id}/regenerate-occurrences", headers=H_ADMIN, timeout=15)
    assert_ok(r1.status_code == 200, "1st regenerate -> 200", f"got {r1.status_code}")
    if r1.status_code == 200:
        created1 = r1.json().get("created", 0)
        assert_ok(created1 == 0, "1st regenerate created=0 (already exist)", f"got {created1}")

    # Second time
    r2 = requests.post(f"{API}/entries/{master_id}/regenerate-occurrences", headers=H_ADMIN, timeout=15)
    assert_ok(r2.status_code == 200, "2nd regenerate -> 200", f"got {r2.status_code}")
    if r2.status_code == 200:
        created2 = r2.json().get("created", 0)
        assert_ok(created2 == 0, "2nd regenerate created=0 (idempotent)", f"got {created2}")

    items_after = get_entries_by_title("Idempotent BLOC1")
    assert_ok(len(items_after) == 4, "Still 4 entries after 2x regenerate (no duplicates)",
              f"got {len(items_after)}")

    # Cleanup
    requests.delete(f"{API}/entries/{master_id}", params={"scope": "all"},
                    headers=H_ADMIN, timeout=15)
    for e in items_after:
        CREATED_IDS.discard(e["id"])


def test_bloc1_public_filter_and_occurrences():
    log("\n=== BLOC 1.I — Public GET returns occurrence children individually ===")
    # Create a fresh weekly master in the future
    body = {
        "type": "soiree",
        "title": "PublicVisibility BLOC1",
        "date": "2027-09-06",  # Monday
        "dance_style": "salsa_cubaine",
        "recurrence": {"freq": "weekly", "interval": 1, "count": 3},
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    if r.status_code != 200:
        FAILS.append("Public visibility setup failed")
        return
    master_id = r.json()["id"]
    track(master_id)
    items = get_entries_by_title("PublicVisibility BLOC1")
    for e in items:
        track(e["id"])
    assert_ok(len(items) == 3, "3 entries created (master + 2 children)", f"got {len(items)}")

    # Public GET (no auth)
    r = requests.get(f"{API}/entries", params={"type": "soiree"}, timeout=15)
    assert_ok(r.status_code == 200, "Public GET /entries?type=soiree -> 200", f"got {r.status_code}")
    if r.status_code == 200:
        public_items = r.json()
        public_titles = [e for e in public_items if e.get("title") == "PublicVisibility BLOC1"]
        # Should see 3 individual entries (master + 2 children) as separate dates
        public_dates = sorted(set(e["date"] for e in public_titles))
        expected = ["2027-09-06", "2027-09-13", "2027-09-20"]
        assert_ok(public_dates == expected,
                  "Public sees 3 individual occurrence dates (not just master)",
                  f"got {public_dates}")
        # Make sure children are returned, not just master
        ids = [e["id"] for e in public_titles]
        children_visible = sum(1 for e in public_titles if e.get("parent_id") == master_id)
        assert_ok(children_visible == 2, "Both children visible in public list", f"got {children_visible}")

    # Cleanup
    requests.delete(f"{API}/entries/{master_id}", params={"scope": "all"}, headers=H_ADMIN, timeout=15)
    for e in items:
        CREATED_IDS.discard(e["id"])


def test_bloc1_past_filter():
    log("\n=== BLOC 1.J — Past occurrences filtered for public ===")
    # Date in the past with count=6 weekly
    # Choose a past date so some occurrences are past, some future
    today = date.today()
    # Pick a Monday 8 weeks ago
    past_start = today - timedelta(weeks=2)
    # find a date that yields some past + some future with count=6
    # Use 4 weeks before today so first 4 occurrences are past, last 2 future
    past_start = today - timedelta(weeks=4)
    body = {
        "type": "soiree",
        "title": "PastFilter BLOC1",
        "date": past_start.strftime("%Y-%m-%d"),
        "dance_style": "salsa_cubaine",
        "recurrence": {"freq": "weekly", "interval": 1, "count": 6},
    }
    r = requests.post(f"{API}/entries", json=body, headers=H_ADMIN, timeout=15)
    if r.status_code != 200:
        FAILS.append(f"Past filter setup failed: {r.status_code} {r.text[:200]}")
        return
    master_id = r.json()["id"]
    track(master_id)
    all_items = get_entries_by_title("PastFilter BLOC1")
    for e in all_items:
        track(e["id"])
    assert_ok(len(all_items) == 6, "6 entries created", f"got {len(all_items)}")

    # Admin sees all with include_past
    today_str = today.strftime("%Y-%m-%d")
    past_count = sum(1 for e in all_items if e["date"] < today_str)
    future_count = sum(1 for e in all_items if e["date"] >= today_str)
    assert_ok(past_count > 0, "At least 1 past occurrence in seed",
              f"past={past_count} future={future_count}")
    assert_ok(future_count > 0, "At least 1 future occurrence in seed",
              f"past={past_count} future={future_count}")

    # Public GET
    r = requests.get(f"{API}/entries", params={"type": "soiree"}, timeout=15)
    if r.status_code == 200:
        public = [e for e in r.json() if e.get("title") == "PastFilter BLOC1"]
        public_past = sum(1 for e in public if e["date"] < today_str)
        assert_ok(public_past == 0, "Public GET filters out past occurrences",
                  f"public past leaks={public_past}, public total={len(public)}")
        assert_ok(len(public) == future_count, "Public sees only future occurrences",
                  f"public={len(public)} expected_future={future_count}")

    # Cleanup
    requests.delete(f"{API}/entries/{master_id}", params={"scope": "all"}, headers=H_ADMIN, timeout=15)
    for e in all_items:
        CREATED_IDS.discard(e["id"])


# =========================================================================
# Cleanup
# =========================================================================
def final_cleanup():
    log("\n=== Final cleanup ===")
    for eid in list(CREATED_IDS):
        cleanup_id(eid)
    log(f"Cleaned up {len(CREATED_IDS)} entries")


def main():
    log(f"Backend: {API}")
    log(f"Admin token: {ADMIN_TOKEN}")

    # BLOC 5
    try:
        test_bloc5_dance_style()
    except Exception as e:
        log(f"BLOC 5 unexpected error: {e}")
        FAILS.append(f"BLOC 5 exception: {e}")

    # BLOC 1
    try:
        master_id, children_sorted = test_bloc1_weekly_master()
        if master_id and children_sorted:
            test_bloc1_scope_this(master_id, children_sorted)
            test_bloc1_scope_future(master_id, children_sorted)
            test_bloc1_scope_all(master_id, children_sorted)
            test_bloc1_delete_all(master_id, children_sorted)
    except Exception as e:
        log(f"BLOC 1 weekly chain error: {e}")
        FAILS.append(f"BLOC 1 weekly chain exception: {e}")

    try:
        test_bloc1_monthly_weekday()
    except Exception as e:
        FAILS.append(f"BLOC 1 monthly_weekday exception: {e}")

    try:
        test_bloc1_regenerate_non_master()
    except Exception as e:
        FAILS.append(f"BLOC 1 regenerate non-master exception: {e}")

    try:
        test_bloc1_idempotency()
    except Exception as e:
        FAILS.append(f"BLOC 1 idempotency exception: {e}")

    try:
        test_bloc1_public_filter_and_occurrences()
    except Exception as e:
        FAILS.append(f"BLOC 1 public filter exception: {e}")

    try:
        test_bloc1_past_filter()
    except Exception as e:
        FAILS.append(f"BLOC 1 past filter exception: {e}")

    final_cleanup()

    log("\n" + "=" * 60)
    log(f"TOTAL: {PASS} PASS, {FAIL} FAIL")
    if FAILS:
        log("\nFAILURES:")
        for f in FAILS:
            log(f"  - {f}")
    log("=" * 60)
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
