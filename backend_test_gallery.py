"""
TÂCHE 4 — Festival galleries (entry_media) backend test suite.

Targets:
  GET    /api/entries/{entry_id}/media
  POST   /api/entries/{entry_id}/media
  DELETE /api/media/{media_id}
  PUT    /api/entries/{entry_id}/media/order
  GET    /api/festivals/past-with-gallery
"""
import os
import sys
import json
import requests

BACKEND_URL = os.environ.get("BACKEND_URL", "https://rhythm-frames-3.preview.emergentagent.com")
API = f"{BACKEND_URL}/api"
ADMIN_TOKEN = "test_session_pcs_admin_000"
H_ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
H_NOAUTH = {"Content-Type": "application/json"}

# Tiny 1x1 PNG base64
PNG1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABAQEAWk1v8QAAAABJRU5ErkJggg=="
PNG2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABAQEAWk1v8QAAAABJRU5ErkJggg=="
YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
IG = "https://www.instagram.com/p/CmHpAaNL_q5/"

results = []  # list of (name, ok, detail)

def report(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")


def main():
    fest_id = None
    media_ids = []
    try:
        # ---- a) Create a past festival ----
        body = {
            "type": "festival",
            "title": "Festival Past Test",
            "date": "2024-05-10",
            "end_date": "2024-05-12",
            "status": "approved",
            "dance_style": "salsa_cubaine",
        }
        r = requests.post(f"{API}/entries", headers=H_ADMIN, json=body, timeout=15)
        ok = r.status_code == 200
        detail = f"status={r.status_code}"
        if ok:
            j = r.json()
            fest_id = j.get("id")
            detail += f", id={fest_id}, status={j.get('status')}, type={j.get('type')}"
            ok = bool(fest_id) and j.get("status") == "approved" and j.get("type") == "festival"
        else:
            detail += f" body={r.text[:200]}"
        report("a) POST /entries create past festival approved", ok, detail)
        if not fest_id:
            print("Cannot continue without fest_id")
            return

        # ---- b) GET media — empty ----
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        ok = r.status_code == 200 and r.json() == []
        report("b) GET /entries/{id}/media empty", ok, f"status={r.status_code} body={r.text[:150]}")

        # ---- c) POST media with 4 items ----
        items = [
            {"kind": "photo", "data": PNG1, "title": "Photo 1"},
            {"kind": "photo", "data": PNG2, "title": "Photo 2"},
            {"kind": "video", "data": YT, "title": "Aftermovie"},
            {"kind": "video", "data": IG, "title": "Story IG"},
        ]
        r = requests.post(f"{API}/entries/{fest_id}/media", headers=H_ADMIN, json={"items": items}, timeout=15)
        ok = r.status_code == 200
        detail = f"status={r.status_code}"
        if ok:
            j = r.json()
            ok = isinstance(j, list) and len(j) == 4
            orders = [m.get("order") for m in j]
            entry_ids = {m.get("entry_id") for m in j}
            ids = [m.get("id") for m in j]
            media_ids = ids[:]
            detail += f", count={len(j)}, orders={orders}, entry_ids={entry_ids}"
            ok = ok and orders == [0, 1, 2, 3] and entry_ids == {fest_id} and all(ids)
        else:
            detail += f" body={r.text[:200]}"
        report("c) POST /entries/{id}/media 4 items", ok, detail)

        # ---- d) GET media → 4 items sorted by order asc ----
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        ok = r.status_code == 200
        detail = f"status={r.status_code}"
        if ok:
            j = r.json()
            orders = [m.get("order") for m in j]
            titles = [m.get("title") for m in j]
            ok = len(j) == 4 and orders == sorted(orders) and orders == [0, 1, 2, 3]
            detail += f", count={len(j)}, orders={orders}, titles={titles}"
        report("d) GET media sorted by order asc", ok, detail)

        # ---- e) GET /festivals/past-with-gallery includes FEST_ID ----
        r = requests.get(f"{API}/festivals/past-with-gallery", timeout=10)
        ok = r.status_code == 200
        detail = f"status={r.status_code}"
        if ok:
            j = r.json()
            ids = [e.get("id") for e in j]
            ok = fest_id in ids
            detail += f", count={len(j)}, fest_present={fest_id in ids}"
        else:
            detail += f" body={r.text[:200]}"
        report("e) GET /festivals/past-with-gallery includes FEST_ID", ok, detail)

        # ---- f) PUT reorder ----
        reversed_ids = list(reversed(media_ids))
        original_last_id = media_ids[-1]
        r = requests.put(f"{API}/entries/{fest_id}/media/order", headers=H_ADMIN, json={"ids": reversed_ids}, timeout=10)
        ok = r.status_code == 200
        detail = f"status={r.status_code}, body={r.text[:200]}"
        if ok:
            j = r.json()
            ok = j.get("ok") is True and j.get("count") == 4
        report("f1) PUT reorder returns {ok:true,count:4}", ok, detail)

        # Verify first item is now what was previously last
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        ok = r.status_code == 200
        if ok:
            j = r.json()
            first_id_now = j[0].get("id") if j else None
            ok = first_id_now == original_last_id
            detail = f"new first id={first_id_now} expected={original_last_id}"
        report("f2) After reorder, first media is previously last", ok, detail)

        # ---- g) DELETE first media item ----
        # After reorder, the "first" in DB is reversed_ids[0] = media_ids[-1]
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        current_first = r.json()[0]["id"]
        r = requests.delete(f"{API}/media/{current_first}", headers=H_ADMIN, timeout=10)
        ok = r.status_code == 200
        detail = f"status={r.status_code}, body={r.text[:200]}"
        report("g1) DELETE first media", ok, detail)

        # verify length 3
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        ok = r.status_code == 200 and len(r.json()) == 3
        report("g2) GET media length=3 after delete", ok, f"status={r.status_code}, count={len(r.json()) if r.status_code==200 else 'NA'}")

        # ---- h) Negative: POST without auth ----
        r = requests.post(f"{API}/entries/{fest_id}/media", headers=H_NOAUTH, json={"items": [{"kind":"photo","data":PNG1,"title":"X"}]}, timeout=10)
        ok = r.status_code in (401, 403)
        report("h) POST media without auth -> 401/403", ok, f"status={r.status_code}, body={r.text[:150]}")

        # ---- i) Negative: invalid kind ----
        r = requests.post(f"{API}/entries/{fest_id}/media", headers=H_ADMIN, json={"items": [{"kind":"audio","data":"x","title":"X"}]}, timeout=10)
        ok = r.status_code == 400
        report("i) POST media with invalid kind 'audio' -> 400", ok, f"status={r.status_code}, body={r.text[:200]}")

        # ---- j) CLEANUP: delete remaining media + festival ----
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        for m in r.json():
            requests.delete(f"{API}/media/{m['id']}", headers=H_ADMIN, timeout=10)
        # Verify empty
        r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
        ok = r.status_code == 200 and r.json() == []
        report("j1) After cleanup, media list empty", ok, f"count={len(r.json()) if r.status_code==200 else 'NA'}")

        # Verify past-with-gallery no longer lists FEST_ID
        r = requests.get(f"{API}/festivals/past-with-gallery", timeout=10)
        ok = r.status_code == 200 and fest_id not in [e.get("id") for e in r.json()]
        report("j2) past-with-gallery no longer lists FEST_ID", ok, f"present={fest_id in [e.get('id') for e in r.json()]}")

        # Delete the festival entry
        r = requests.delete(f"{API}/entries/{fest_id}", headers=H_ADMIN, timeout=10)
        ok = r.status_code == 200
        report("j3) DELETE festival entry", ok, f"status={r.status_code}")

    finally:
        # final cleanup fallback
        if fest_id:
            try:
                r = requests.get(f"{API}/entries/{fest_id}/media", timeout=10)
                if r.status_code == 200:
                    for m in r.json():
                        requests.delete(f"{API}/media/{m['id']}", headers=H_ADMIN, timeout=10)
                requests.delete(f"{API}/entries/{fest_id}", headers=H_ADMIN, timeout=10)
            except Exception:
                pass

        # summary
        total = len(results)
        passed = sum(1 for _, ok, _ in results if ok)
        print()
        print("=" * 60)
        print(f"TOTAL: {passed}/{total} PASS")
        for name, ok, detail in results:
            print(f"  [{ 'PASS' if ok else 'FAIL' }] {name}")
        sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
