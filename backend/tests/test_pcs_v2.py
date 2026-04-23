"""PCS v2 — entries (agenda/soiree/workshop/festival) + teachers tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://rhythm-frames-3.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- Entries: list & filter ----
def test_entries_list_all(s):
    r = s.get(f"{BASE_URL}/api/entries")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # seed has 9 entries
    assert len(data) >= 9, f"expected at least 9 entries, got {len(data)}"
    for e in data:
        assert "_id" not in e
        assert "id" in e and "title" in e and "type" in e and "date" in e


def test_entries_filter_soiree(s):
    r = s.get(f"{BASE_URL}/api/entries", params={"type": "soiree"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 3
    assert all(e["type"] == "soiree" for e in data)
    titles = [e["title"] for e in data]
    assert "Soirée Callesol" in titles


def test_entries_filter_workshop(s):
    r = s.get(f"{BASE_URL}/api/entries", params={"type": "workshop"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    assert all(e["type"] == "workshop" for e in data)


def test_entries_filter_festival(s):
    r = s.get(f"{BASE_URL}/api/entries", params={"type": "festival"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    assert all(e["type"] == "festival" for e in data)
    # festivals should have end_date
    assert any(e.get("end_date") for e in data)


def test_entries_filter_invalid_type_400(s):
    r = s.get(f"{BASE_URL}/api/entries", params={"type": "invalid"})
    assert r.status_code == 400


def test_entries_get_by_id(s):
    lst = s.get(f"{BASE_URL}/api/entries").json()
    eid = lst[0]["id"]
    r = s.get(f"{BASE_URL}/api/entries/{eid}")
    assert r.status_code == 200
    assert r.json()["id"] == eid


def test_entries_get_404(s):
    r = s.get(f"{BASE_URL}/api/entries/nonexistent-xyz")
    assert r.status_code == 404


# ---- Entries: admin gating ----
def test_entries_create_no_auth_401(s):
    r = s.post(f"{BASE_URL}/api/entries", json={"type": "soiree", "title": "X", "date": "2026-01-01"})
    assert r.status_code == 401


def test_entries_update_no_auth_401(s):
    lst = s.get(f"{BASE_URL}/api/entries").json()
    eid = lst[0]["id"]
    r = s.put(f"{BASE_URL}/api/entries/{eid}", json={"type": "soiree", "title": "X", "date": "2026-01-01"})
    assert r.status_code == 401


def test_entries_delete_no_auth_401(s):
    r = s.delete(f"{BASE_URL}/api/entries/any")
    assert r.status_code == 401


def test_entries_create_invalid_type_400(s):
    payload = {"type": "badtype", "title": "TEST_bad", "date": "2026-06-01"}
    r = s.post(f"{BASE_URL}/api/entries", json=payload, headers=ADMIN_HEADERS)
    assert r.status_code == 400


# ---- Entries: admin CRUD lifecycle ----
class TestEntryLifecycle:
    entry_id = None

    def test_01_create(self, s):
        payload = {
            "type": "workshop",
            "title": "TEST_Entry_PCS",
            "date": "2026-05-10",
            "time": "15:00 - 18:00",
            "venue": "Test Studio",
            "address": "1 rue du test",
            "description": "desc",
            "instructor": "Test Teacher",
            "ticket_link": "https://example.com/t",
        }
        r = s.post(f"{BASE_URL}/api/entries", json=payload, headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == payload["title"]
        assert data["type"] == "workshop"
        assert data["instructor"] == "Test Teacher"
        TestEntryLifecycle.entry_id = data["id"]

        # GET to verify persistence
        g = s.get(f"{BASE_URL}/api/entries/{data['id']}")
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]

    def test_02_update(self, s):
        assert TestEntryLifecycle.entry_id
        payload = {
            "type": "soiree",
            "title": "TEST_Entry_PCS_Updated",
            "date": "2026-05-11",
            "venue": "New Venue",
        }
        r = s.put(f"{BASE_URL}/api/entries/{TestEntryLifecycle.entry_id}", json=payload, headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == "TEST_Entry_PCS_Updated"
        assert data["type"] == "soiree"

        g = s.get(f"{BASE_URL}/api/entries/{TestEntryLifecycle.entry_id}")
        assert g.json()["title"] == "TEST_Entry_PCS_Updated"
        assert g.json()["venue"] == "New Venue"

    def test_03_update_404(self, s):
        payload = {"type": "soiree", "title": "x", "date": "2026-01-01"}
        r = s.put(f"{BASE_URL}/api/entries/nonexistent-xxx", json=payload, headers=ADMIN_HEADERS)
        assert r.status_code == 404

    def test_04_delete(self, s):
        assert TestEntryLifecycle.entry_id
        r = s.delete(f"{BASE_URL}/api/entries/{TestEntryLifecycle.entry_id}", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        g = s.get(f"{BASE_URL}/api/entries/{TestEntryLifecycle.entry_id}")
        assert g.status_code == 404


# ---- Teachers: list & detail ----
def test_teachers_list_seeded(s):
    r = s.get(f"{BASE_URL}/api/teachers")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    names = [t["name"] for t in data]
    assert "Yosmel Hernández" in names
    for t in data:
        assert "_id" not in t
        assert "id" in t and "name" in t


def test_teacher_get_by_id(s):
    lst = s.get(f"{BASE_URL}/api/teachers").json()
    tid = lst[0]["id"]
    r = s.get(f"{BASE_URL}/api/teachers/{tid}")
    assert r.status_code == 200
    assert r.json()["id"] == tid


def test_teacher_get_404(s):
    r = s.get(f"{BASE_URL}/api/teachers/does-not-exist")
    assert r.status_code == 404


# ---- Teachers: admin gating ----
def test_teachers_create_no_auth_401(s):
    r = s.post(f"{BASE_URL}/api/teachers", json={"name": "X"})
    assert r.status_code == 401


def test_teachers_update_no_auth_401(s):
    lst = s.get(f"{BASE_URL}/api/teachers").json()
    r = s.put(f"{BASE_URL}/api/teachers/{lst[0]['id']}", json={"name": "X"})
    assert r.status_code == 401


def test_teachers_delete_no_auth_401(s):
    r = s.delete(f"{BASE_URL}/api/teachers/any")
    assert r.status_code == 401


# ---- Teachers: admin CRUD lifecycle ----
class TestTeacherLifecycle:
    teacher_id = None

    def test_01_create(self, s):
        payload = {
            "name": "TEST_Teacher_PCS",
            "bio": "test bio",
            "instagram": "@test_pcs",
            "facebook": "fb.test",
        }
        r = s.post(f"{BASE_URL}/api/teachers", json=payload, headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["instagram"] == "@test_pcs"
        TestTeacherLifecycle.teacher_id = data["id"]

        g = s.get(f"{BASE_URL}/api/teachers/{data['id']}")
        assert g.status_code == 200
        assert g.json()["name"] == payload["name"]

    def test_02_update(self, s):
        assert TestTeacherLifecycle.teacher_id
        payload = {"name": "TEST_Teacher_PCS_Updated", "bio": "updated bio"}
        r = s.put(f"{BASE_URL}/api/teachers/{TestTeacherLifecycle.teacher_id}", json=payload, headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST_Teacher_PCS_Updated"

        g = s.get(f"{BASE_URL}/api/teachers/{TestTeacherLifecycle.teacher_id}")
        assert g.json()["bio"] == "updated bio"

    def test_03_update_404(self, s):
        r = s.put(f"{BASE_URL}/api/teachers/nonexistent-zzz", json={"name": "x"}, headers=ADMIN_HEADERS)
        assert r.status_code == 404

    def test_04_delete(self, s):
        assert TestTeacherLifecycle.teacher_id
        r = s.delete(f"{BASE_URL}/api/teachers/{TestTeacherLifecycle.teacher_id}", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        g = s.get(f"{BASE_URL}/api/teachers/{TestTeacherLifecycle.teacher_id}")
        assert g.status_code == 404


# ---- Regression: existing gallery endpoints still work ----
def test_regression_events_still_works(s):
    r = s.get(f"{BASE_URL}/api/events")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_regression_auth_me(s):
    r = s.get(f"{BASE_URL}/api/auth/me", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json()["is_admin"] is True
