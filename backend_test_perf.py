"""Backend perf-fix regression test.

Verifies:
 - GET /api/entries and GET /api/entries?featured=true strip `cover_photo`
   and `description` and expose `has_cover` boolean.
 - GET /api/entries/{id} still returns the full cover_photo + description.
 - GET /api/entries/{id}/cover streams binary for data: URIs and 302-redirects
   for http(s) URLs; 404 for missing cover or unknown id.
 - Likes still populated on /api/entries, /api/calendar/events, /api/entries/{id}.
 - Liking an entry increments the likes counter and is reflected in the list.
"""

import base64
import json
import sys
import time

import httpx

BASE = "http://localhost:8001/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
AUTH = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

# 1x1 transparent PNG
PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBg"
    "AAAABQABh6FO1AAAAABJRU5ErkJggg=="
)
PNG_DATA_URI = f"data:image/png;base64,{PNG_B64}"
REMOTE_URL = "https://images.unsplash.com/photo-1517363898874-737b62a7db91"

# Required fields on every list-entry item.
REQUIRED_FIELDS = [
    "id", "title", "date", "end_date", "time", "venue", "address",
    "type", "status", "dance_style", "ticket_link", "featured", "country",
    "likes", "is_mensuelle", "level", "price", "instructor", "teacher_id",
]

results = []  # (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name}  {detail}")


def check_list_item(item):
    issues = []
    # has_cover must be present and bool
    if "has_cover" not in item or not isinstance(item["has_cover"], bool):
        issues.append(f"has_cover missing/not bool: {item.get('has_cover')!r}")
    # cover_photo must be null or absent
    cp = item.get("cover_photo", None)
    if cp not in (None, ""):
        issues.append(f"cover_photo leaked (len={len(cp) if isinstance(cp, str) else 'n/a'})")
    # description must be empty string or absent
    desc = item.get("description", "")
    if desc not in (None, ""):
        issues.append(f"description leaked (len={len(desc)})")
    # required fields present
    for f in REQUIRED_FIELDS:
        if f not in item:
            issues.append(f"missing field '{f}'")
    return issues


def main():
    client = httpx.Client(timeout=30.0)

    # ---------- 1) /api/entries strips heavy fields ----------
    r = client.get(f"{BASE}/entries")
    if r.status_code != 200:
        record("GET /api/entries status=200", False, f"status={r.status_code} body={r.text[:200]}")
        return
    body = r.text
    payload_size = len(body.encode("utf-8"))
    items = r.json()
    record("GET /api/entries 200", True, f"{len(items)} items, payload {payload_size} bytes")
    record(
        "GET /api/entries payload < 200KB",
        payload_size < 200_000,
        f"size={payload_size}",
    )
    bad = []
    for it in items:
        issues = check_list_item(it)
        if issues:
            bad.append((it.get("id"), issues))
    record(
        "GET /api/entries every item conforms (has_cover bool, no cover_photo, no description, required fields)",
        len(bad) == 0,
        f"{len(bad)} bad items: {bad[:3]}",
    )

    # ---------- 2) /api/entries?featured=true ----------
    r2 = client.get(f"{BASE}/entries", params={"featured": "true"})
    if r2.status_code != 200:
        record("GET /api/entries?featured=true 200", False, f"status={r2.status_code}")
    else:
        feat = r2.json()
        record("GET /api/entries?featured=true 200", True, f"{len(feat)} items")
        bad2 = []
        for it in feat:
            issues = check_list_item(it)
            if issues:
                bad2.append((it.get("id"), issues))
        record(
            "GET /api/entries?featured=true every item conforms",
            len(bad2) == 0,
            f"{len(bad2)} bad items",
        )
        # Also assert all are featured=true
        not_featured = [i["id"] for i in feat if not i.get("featured") and i.get("status") != "featured"]
        record(
            "featured=true returns only featured entries",
            len(not_featured) == 0,
            f"non-featured: {not_featured}",
        )

    # ---------- 3) Seed an entry with a real base64 cover_photo to test detail + cover endpoint ----------
    test_ids_to_cleanup = []

    seed_payload = {
        "type": "workshop",
        "title": "PERF test workshop with cover",
        "date": "2027-09-15",
        "venue": "Centre de test",
        "address": "1 rue de test, Paris",
        "description": "Description longue pour vérifier que /entries/{id} la retourne bien intégralement même quand /entries la cache.",
        "instructor": "Test Instructor",
        "level": "intermediate",
        "price": "30€",
        "dance_style": "salsa_cubaine",
        "ticket_link": "https://example.com/ticket",
        "cover_photo": PNG_DATA_URI,
        "status": "approved",
    }
    rc = client.post(f"{BASE}/entries", headers=AUTH, json=seed_payload)
    if rc.status_code != 200:
        record("seed workshop with cover", False, f"status={rc.status_code} body={rc.text[:300]}")
    else:
        created = rc.json()
        seed_id = created.get("id")
        test_ids_to_cleanup.append(seed_id)
        record("seed workshop with cover (200)", True, f"id={seed_id}")

        # 3a) GET /api/entries/{id} returns full cover_photo + description
        rd = client.get(f"{BASE}/entries/{seed_id}")
        if rd.status_code != 200:
            record("GET /api/entries/{id} 200", False, f"status={rd.status_code}")
        else:
            entry = rd.json()
            record(
                "GET /api/entries/{id} returns full cover_photo",
                entry.get("cover_photo") == PNG_DATA_URI,
                f"cover_photo prefix={(entry.get('cover_photo') or '')[:40]!r}",
            )
            record(
                "GET /api/entries/{id} returns full description",
                entry.get("description") == seed_payload["description"],
                f"description len={len(entry.get('description') or '')}",
            )
            record(
                "GET /api/entries/{id} likes int populated",
                isinstance(entry.get("likes"), int),
                f"likes={entry.get('likes')}",
            )

        # 3b) GET /api/entries/{id}/cover -> binary + correct Content-Type + Cache-Control
        rcover = client.get(f"{BASE}/entries/{seed_id}/cover")
        ct = rcover.headers.get("content-type", "")
        cc = rcover.headers.get("cache-control", "")
        ok_status = rcover.status_code == 200
        ok_ct = "image/png" in ct
        # The exact header value
        ok_cc = "public" in cc and "max-age=86400" in cc and "immutable" in cc
        # Body bytes should match decoded PNG
        expected_bytes = base64.b64decode(PNG_B64)
        ok_bytes = rcover.content == expected_bytes
        record(
            "GET /api/entries/{id}/cover binary stream (status,ct,cache,body)",
            ok_status and ok_ct and ok_cc and ok_bytes,
            f"status={rcover.status_code} ct={ct} cache={cc} body_len={len(rcover.content)} expected_len={len(expected_bytes)}",
        )

        # 3c) Confirm the LIST endpoint sets has_cover=True for this entry
        rl = client.get(f"{BASE}/entries", params={"type": "workshop"})
        if rl.status_code == 200:
            mine = next((i for i in rl.json() if i.get("id") == seed_id), None)
            if mine is None:
                record("list contains seeded workshop", False, "not found")
            else:
                record(
                    "list contains seeded workshop with has_cover=true and no base64",
                    mine.get("has_cover") is True
                    and mine.get("cover_photo") in (None, "")
                    and mine.get("description", "") in (None, ""),
                    f"has_cover={mine.get('has_cover')} cover_photo={'NULL' if mine.get('cover_photo') in (None,'') else 'LEAK'} desc={'EMPTY' if mine.get('description','') in (None,'') else 'LEAK'}",
                )

        # ---------- 4) Likes regression on this seeded entry ----------
        # Like once
        rk = client.post(f"{BASE}/entries/{seed_id}/like")
        if rk.status_code != 200:
            record("POST /api/entries/{id}/like 200", False, f"status={rk.status_code} body={rk.text[:200]}")
        else:
            new_likes = rk.json().get("likes")
            record("POST /api/entries/{id}/like 200 +incremented", isinstance(new_likes, int) and new_likes >= 1, f"likes={new_likes}")
            # GET list and verify likes is reflected
            rl2 = client.get(f"{BASE}/entries", params={"type": "workshop"})
            if rl2.status_code == 200:
                mine2 = next((i for i in rl2.json() if i.get("id") == seed_id), None)
                if mine2 is None:
                    record("list reflects incremented likes", False, "entry not found in list")
                else:
                    record(
                        "list reflects incremented likes",
                        isinstance(mine2.get("likes"), int) and mine2.get("likes") == new_likes,
                        f"list.likes={mine2.get('likes')} vs after-like={new_likes}",
                    )

    # ---------- 5) cover endpoint: 302 redirect for remote URL ----------
    seed_payload_remote = {
        "type": "workshop",
        "title": "PERF test workshop remote cover",
        "date": "2027-09-16",
        "venue": "Centre de test remote",
        "dance_style": "salsa_cubaine",
        "cover_photo": REMOTE_URL,
        "status": "approved",
    }
    rrm = client.post(f"{BASE}/entries", headers=AUTH, json=seed_payload_remote)
    if rrm.status_code != 200:
        record("seed workshop with remote cover URL", False, f"status={rrm.status_code} body={rrm.text[:300]}")
    else:
        rid = rrm.json().get("id")
        test_ids_to_cleanup.append(rid)
        rcover_remote = client.get(f"{BASE}/entries/{rid}/cover", follow_redirects=False)
        loc = rcover_remote.headers.get("location", "")
        record(
            "GET /api/entries/{id}/cover -> 302 redirect for remote URL",
            rcover_remote.status_code == 302 and loc == REMOTE_URL,
            f"status={rcover_remote.status_code} location={loc!r}",
        )

    # ---------- 6) cover endpoint: 404 when no cover ----------
    seed_no_cover = {
        "type": "soiree",
        "title": "PERF test no cover",
        "date": "2027-09-17",
        "venue": "Centre de test no cover",
        "dance_style": "salsa_cubaine",
        "status": "approved",
    }
    rnc = client.post(f"{BASE}/entries", headers=AUTH, json=seed_no_cover)
    if rnc.status_code != 200:
        record("seed soiree without cover", False, f"status={rnc.status_code} body={rnc.text[:300]}")
    else:
        ncid = rnc.json().get("id")
        test_ids_to_cleanup.append(ncid)
        r404 = client.get(f"{BASE}/entries/{ncid}/cover", follow_redirects=False)
        record(
            "GET /api/entries/{id}/cover -> 404 when entry has no cover",
            r404.status_code == 404,
            f"status={r404.status_code} body={r404.text[:120]}",
        )

    # ---------- 7) cover endpoint: 404 when entry id unknown ----------
    rmiss = client.get(f"{BASE}/entries/non_existing_id_zzzzzzzzz/cover", follow_redirects=False)
    record(
        "GET /api/entries/<unknown>/cover -> 404",
        rmiss.status_code == 404,
        f"status={rmiss.status_code} body={rmiss.text[:120]}",
    )

    # ---------- 8) /api/calendar/events still populates likes ----------
    rcal = client.get(f"{BASE}/calendar/events")
    if rcal.status_code != 200:
        record("GET /api/calendar/events 200", False, f"status={rcal.status_code}")
    else:
        cal = rcal.json()
        record("GET /api/calendar/events 200", True, f"{len(cal)} events")
        if cal:
            # `likes` should be present and int on every item
            missing = [c.get("id") for c in cal if not isinstance(c.get("likes"), int)]
            record(
                "calendar items have int `likes` field",
                len(missing) == 0,
                f"{len(missing)} items missing/non-int likes",
            )

    # ---------- CLEANUP ----------
    print("\n--- Cleanup ---")
    for eid in test_ids_to_cleanup:
        rdel = client.delete(f"{BASE}/entries/{eid}", headers=AUTH, params={"scope": "all"})
        print(f"DELETE {eid} -> {rdel.status_code}")

    # ---------- Summary ----------
    fails = [(n, d) for (n, ok, d) in results if not ok]
    print(f"\n========== SUMMARY: {len(results) - len(fails)}/{len(results)} PASS ==========")
    if fails:
        for n, d in fails:
            print(f"  FAIL: {n}  {d}")
        sys.exit(1)
    print("All assertions PASS.")


if __name__ == "__main__":
    main()
