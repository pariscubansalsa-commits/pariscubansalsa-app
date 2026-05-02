"""
Backend regression tests for Paris Cuban Salsa — past-event filter rules + duplicate endpoint.

Covers (per review request):
  1. Public requests filter past events (date < today Europe/Paris)
  2. Admin History tab (include_past=true) returns past events only
  3. Featured carousel filter excludes past-dated featured entries
  4. Duplicate endpoint
  5. Sort: featured first then by date asc
  6. GCal sync skips past events on ingest
"""
import os
import sys
from datetime import timedelta, datetime
from zoneinfo import ZoneInfo

import requests

BASE = os.environ.get("BACKEND_URL", "https://rhythm-frames-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {TOKEN}"}
PARIS = ZoneInfo("Europe/Paris")
TODAY = datetime.now(PARIS).date()
TODAY_STR = TODAY.isoformat()
YESTERDAY = (TODAY - timedelta(days=1)).isoformat()

results = []


def rec(name, ok, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name} :: {detail}")


def ensure_future(d: str, end: str = "") -> bool:
    return (d and d >= TODAY_STR) or (end and end >= TODAY_STR)


def ensure_past(d: str, end: str = "") -> bool:
    if not d or d >= TODAY_STR:
        return False
    if end and end >= TODAY_STR:
        return False
    return True


# --------- 1) Public past-filter ---------
def test_1_public_filters():
    for path in ["/entries", "/entries?type=workshop", "/entries?featured=true"]:
        r = requests.get(f"{API}{path}", timeout=20)
        ok = r.status_code == 200
        if not ok:
            rec(f"GET {path} -> 200", False, f"status={r.status_code} body={r.text[:200]}")
            continue
        items = r.json()
        bad = [it for it in items if not ensure_future(it.get("date") or "", it.get("end_date") or "")]
        rec(
            f"GET {path} hides past events",
            len(bad) == 0,
            f"count={len(items)} past_leaks={len(bad)}"
            + (f" examples={[(b.get('id'), b.get('date'), b.get('end_date')) for b in bad[:3]]}" if bad else ""),
        )

    r = requests.get(f"{API}/calendar/events", timeout=20)
    if r.status_code != 200:
        rec("GET /calendar/events -> 200", False, f"status={r.status_code}")
        return
    items = r.json()
    bad = [it for it in items if not ensure_future(it.get("date") or "", it.get("end_date") or "")]
    rec("GET /calendar/events hides past events", len(bad) == 0, f"count={len(items)} past_leaks={len(bad)}")


# --------- 2) Admin History tab ---------
def test_2_admin_history():
    r = requests.get(f"{API}/entries?include_past=true", timeout=20)
    rec("GET /entries?include_past=true without auth -> 401", r.status_code == 401, f"status={r.status_code}")

    r = requests.get(f"{API}/entries?include_past=true", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        rec("GET /entries?include_past=true admin -> 200", False, f"status={r.status_code} body={r.text[:300]}")
        return
    items = r.json()
    not_past = [it for it in items if not ensure_past(it.get("date") or "", it.get("end_date") or "")]
    rec(
        "admin History returns only strictly past events",
        len(not_past) == 0,
        f"count={len(items)} non_past={len(not_past)}"
        + (f" examples={[(n.get('id'), n.get('date'), n.get('end_date')) for n in not_past[:3]]}" if not_past else ""),
    )


# --------- 3) Featured carousel filter ---------
def test_3_featured_past_hidden():
    r = requests.get(f"{API}/entries?status=featured", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        rec("GET /entries?status=featured admin -> 200", False, f"status={r.status_code}")
        return
    feats = r.json()
    target = next((e for e in feats if e.get("type") == "workshop"), None) or (feats[0] if feats else None)
    created_ephemeral = False
    if not target:
        body = {
            "type": "workshop",
            "title": "Test Featured Workshop (past-filter regression)",
            "date": (TODAY + timedelta(days=30)).isoformat(),
            "featured": True,
            "status": "featured",
        }
        r = requests.post(f"{API}/entries", json=body, headers=ADMIN_HEADERS, timeout=20)
        if r.status_code != 200:
            rec("seed featured workshop for test 3", False, f"status={r.status_code} body={r.text[:300]}")
            return
        target = r.json()
        created_ephemeral = True

    eid = target["id"]
    original_date = target.get("date") or ""
    original_title = target.get("title") or ""
    original_type = target.get("type") or "workshop"

    put_body = {"type": original_type, "title": original_title, "date": YESTERDAY, "featured": True}
    r = requests.put(f"{API}/entries/{eid}", json=put_body, headers=ADMIN_HEADERS, timeout=20)
    ok = r.status_code == 200
    rec(f"PUT entry {eid[:8]} to yesterday -> 200", ok, f"status={r.status_code} body={r.text[:200]}")
    if not ok:
        return

    r = requests.get(f"{API}/entries?featured=true", timeout=20)
    if r.status_code != 200:
        rec("GET /entries?featured=true -> 200", False, f"status={r.status_code}")
    else:
        ids = [e.get("id") for e in r.json()]
        rec(
            "past-dated featured entry hidden from public featured list",
            eid not in ids,
            f"count={len(ids)} contains_target={(eid in ids)}",
        )

    r = requests.get(f"{API}/entries?include_past=true", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        rec("GET /entries?include_past=true -> 200 (test 3)", False, f"status={r.status_code}")
    else:
        ids = [e.get("id") for e in r.json()]
        rec(
            "past-dated featured entry appears in admin History",
            eid in ids,
            f"admin_history_count={len(ids)} contains_target={(eid in ids)}",
        )

    if created_ephemeral:
        r = requests.delete(f"{API}/entries/{eid}", headers=ADMIN_HEADERS, timeout=20)
        rec("cleanup ephemeral featured entry", r.status_code == 200, f"status={r.status_code}")
    else:
        restore = {"type": original_type, "title": original_title, "date": original_date, "featured": True}
        r = requests.put(f"{API}/entries/{eid}", json=restore, headers=ADMIN_HEADERS, timeout=20)
        rec(
            "restore original date for featured entry",
            r.status_code == 200,
            f"status={r.status_code} restored_date={original_date}",
        )


# --------- 4) Duplicate endpoint ---------
def test_4_duplicate():
    r = requests.get(f"{API}/entries?type=workshop", timeout=20)
    if r.status_code != 200:
        rec("GET /entries?type=workshop for duplicate seed", False, f"status={r.status_code}")
        return
    items = r.json()
    source = next((e for e in items if e.get("status") in ("approved", "featured")), None)
    if not source:
        rec("seed approved workshop for duplicate", False, "no approved/featured workshop found")
        return
    src_id = source["id"]
    src_title = source.get("title") or ""

    r = requests.post(f"{API}/entries/{src_id}/duplicate", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        rec("POST /entries/{id}/duplicate -> 200", False, f"status={r.status_code} body={r.text[:300]}")
        return
    dup = r.json()
    dup_id = dup.get("id")
    checks = [
        ("new id", bool(dup_id) and dup_id != src_id, f"src={src_id} dup={dup_id}"),
        ("status='pending'", dup.get("status") == "pending", f"got={dup.get('status')}"),
        ("featured=False", dup.get("featured") is False, f"got={dup.get('featured')}"),
        ("source='manual'", dup.get("source") == "manual", f"got={dup.get('source')}"),
        ("external_id None", dup.get("external_id") in (None, ""), f"got={dup.get('external_id')!r}"),
        (
            "title ends with ' (copie)'",
            (dup.get("title") or "").endswith(" (copie)") and (dup.get("title") or "").startswith(src_title),
            f"got={dup.get('title')!r}",
        ),
        ("date cleared to ''", dup.get("date") == "", f"got={dup.get('date')!r}"),
    ]
    for name, ok, detail in checks:
        rec(f"duplicate: {name}", ok, detail)

    r = requests.get(f"{API}/entries?status=pending", headers=ADMIN_HEADERS, timeout=20)
    if r.status_code != 200:
        rec("GET pending admin (duplicate)", False, f"status={r.status_code}")
    else:
        ids = [e.get("id") for e in r.json()]
        rec("duplicate appears in /entries?status=pending", dup_id in ids, f"pending={len(ids)} contains_dup={dup_id in ids}")

    r = requests.delete(f"{API}/entries/{dup_id}", headers=ADMIN_HEADERS, timeout=20)
    rec("cleanup duplicate entry", r.status_code == 200, f"status={r.status_code}")


# --------- 5) Sort: featured first, date asc ---------
def test_5_sort():
    r = requests.get(f"{API}/entries?type=workshop", timeout=20)
    if r.status_code != 200:
        rec("GET /entries?type=workshop for sort", False, f"status={r.status_code}")
        return
    items = r.json()
    saw_approved = False
    order_ok = True
    order_detail = ""
    for it in items:
        if it.get("status") == "approved":
            saw_approved = True
        elif it.get("status") == "featured" and saw_approved:
            order_ok = False
            order_detail = f"featured after approved: id={it.get('id')}"
            break
    rec("workshops: featured come before approved", order_ok, order_detail or f"count={len(items)}")

    def check_asc(group):
        sub = [it for it in items if it.get("status") == group]
        dates = [it.get("date") or "" for it in sub]
        asc = all(dates[i] <= dates[i + 1] for i in range(len(dates) - 1))
        return asc, dates

    for grp in ("featured", "approved"):
        asc, dates = check_asc(grp)
        rec(f"workshops {grp}: dates ascending", asc, f"dates={dates}")


# --------- 6) GCal sync skips past events ---------
def test_6_gcal_sync():
    r = requests.post(f"{API}/calendar/sync", headers=ADMIN_HEADERS, timeout=60)
    if r.status_code != 200:
        rec("POST /calendar/sync admin -> 200", False, f"status={r.status_code} body={r.text[:300]}")
        return
    stats = r.json()
    rec(
        "calendar/sync returns skipped counter",
        isinstance(stats.get("skipped"), int) and stats.get("skipped") >= 0,
        f"stats={stats}",
    )

    r3 = requests.get(f"{API}/entries?status=pending", headers=ADMIN_HEADERS, timeout=30)
    if r3.status_code != 200:
        rec("GET /entries?status=pending admin for gcal check", False, f"status={r3.status_code}")
        return
    pending = r3.json()
    gcal_pending = [e for e in pending if e.get("source") == "gcal"]
    past_pending = [
        e for e in gcal_pending
        if not ensure_future(e.get("date") or "", e.get("end_date") or "")
    ]
    rec(
        "all gcal pending entries are future (date >= today)",
        len(past_pending) == 0,
        f"gcal_pending={len(gcal_pending)} past_in_pending={len(past_pending)}"
        + (f" examples={[(p.get('id'), p.get('date'), p.get('end_date')) for p in past_pending[:3]]}" if past_pending else ""),
    )


def main():
    print(f"== Backend tests @ {API} ==")
    print(f"TODAY Europe/Paris = {TODAY_STR}")
    test_1_public_filters()
    test_2_admin_history()
    test_3_featured_past_hidden()
    test_4_duplicate()
    test_5_sort()
    test_6_gcal_sync()

    total = len(results)
    failed = [r for r in results if not r[1]]
    print("\n==================== SUMMARY ====================")
    print(f"Total: {total}  Passed: {total - len(failed)}  Failed: {len(failed)}")
    for name, ok, detail in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} :: {detail}")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
