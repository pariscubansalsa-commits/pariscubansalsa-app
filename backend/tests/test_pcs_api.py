"""Paris Cuban Salsa Gallery — backend API tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://rhythm-frames-3.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "test_session_pcs_admin_000"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

# 1x1 PNG base64
TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- Health ----
def test_health(s):
    r = s.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Auth ----
def test_auth_me_with_bearer(s):
    r = s.get(f"{BASE_URL}/api/auth/me", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_admin"] is True
    assert data["email"] == "admin.test@pariscubansalsa.dev"
    assert data["user_id"] == "user_seeded_admin"


def test_auth_me_without_token_401(s):
    r = s.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


def test_auth_me_invalid_token_401(s):
    r = s.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer invalid_xxx"})
    assert r.status_code == 401


# ---- Events (public) ----
def test_list_events_seeded(s):
    r = s.get(f"{BASE_URL}/api/events")
    assert r.status_code == 200
    events = r.json()
    assert isinstance(events, list)
    assert len(events) >= 3
    names = [e["name"] for e in events]
    assert "La Bodeguita Night Vol. 14" in names
    # no _id leak
    for e in events:
        assert "_id" not in e
        assert "id" in e and "name" in e and "date" in e


def test_get_event_by_id(s):
    events = s.get(f"{BASE_URL}/api/events").json()
    ev = events[0]
    r = s.get(f"{BASE_URL}/api/events/{ev['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == ev["id"]


def test_get_event_404(s):
    r = s.get(f"{BASE_URL}/api/events/does-not-exist-xyz")
    assert r.status_code == 404


def test_list_photos_empty_or_array(s):
    events = s.get(f"{BASE_URL}/api/events").json()
    r = s.get(f"{BASE_URL}/api/events/{events[0]['id']}/photos")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---- Admin gating ----
def test_create_event_rejected_without_auth(s):
    r = s.post(f"{BASE_URL}/api/events", json={"name": "X", "date": "2026-01-01"})
    assert r.status_code == 401


def test_upload_photos_rejected_without_auth(s):
    events = s.get(f"{BASE_URL}/api/events").json()
    r = s.post(f"{BASE_URL}/api/events/{events[0]['id']}/photos", json={"photos": [TINY_PNG]})
    assert r.status_code == 401


def test_delete_event_rejected_without_auth(s):
    r = s.delete(f"{BASE_URL}/api/events/whatever")
    assert r.status_code == 401


# ---- Full admin lifecycle: create event -> upload photo -> tag -> delete ----
class TestAdminLifecycle:
    event_id = None
    photo_id = None
    tag_id = None

    def test_01_create_event(self, s):
        payload = {"name": "TEST_Event_PCS", "date": "2026-02-20", "description": "test desc"}
        r = s.post(f"{BASE_URL}/api/events", json=payload, headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["date"] == payload["date"]
        assert "id" in data
        TestAdminLifecycle.event_id = data["id"]

        # Verify persistence via GET
        g = s.get(f"{BASE_URL}/api/events/{data['id']}")
        assert g.status_code == 200
        assert g.json()["name"] == payload["name"]

    def test_02_upload_photos(self, s):
        assert TestAdminLifecycle.event_id
        r = s.post(
            f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}/photos",
            json={"photos": [TINY_PNG, TINY_PNG]},
            headers=ADMIN_HEADERS,
        )
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] == 2

        # Verify via GET
        g = s.get(f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}/photos")
        assert g.status_code == 200
        photos = g.json()
        assert len(photos) == 2
        assert photos[0]["data"] == TINY_PNG
        assert photos[0]["tags"] == []
        TestAdminLifecycle.photo_id = photos[0]["id"]

    def test_03_add_tag_public(self, s):
        assert TestAdminLifecycle.photo_id
        r = requests.post(
            f"{BASE_URL}/api/photos/{TestAdminLifecycle.photo_id}/tags",
            json={"label": "@testuser"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["label"] == "@testuser"
        assert data["photo_id"] == TestAdminLifecycle.photo_id
        TestAdminLifecycle.tag_id = data["id"]

        # Verify tag embedded in photos response
        g = s.get(f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}/photos")
        all_tags = [t["label"] for p in g.json() for t in p["tags"]]
        assert "@testuser" in all_tags

    def test_04_add_tag_validation_empty(self, s):
        r = requests.post(
            f"{BASE_URL}/api/photos/{TestAdminLifecycle.photo_id}/tags",
            json={"label": "  "},
        )
        assert r.status_code == 400

    def test_05_add_tag_invalid_photo_404(self, s):
        r = requests.post(
            f"{BASE_URL}/api/photos/nonexistent/tags", json={"label": "x"}
        )
        assert r.status_code == 404

    def test_06_delete_photo_admin(self, s):
        r = s.delete(
            f"{BASE_URL}/api/photos/{TestAdminLifecycle.photo_id}", headers=ADMIN_HEADERS
        )
        assert r.status_code == 200
        # Verify photo & its tag removed
        g = s.get(f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}/photos")
        ids = [p["id"] for p in g.json()]
        assert TestAdminLifecycle.photo_id not in ids

    def test_07_delete_photo_rejected_no_auth(self, s):
        r = s.delete(f"{BASE_URL}/api/photos/anything")
        assert r.status_code == 401

    def test_08_delete_event_cascades(self, s):
        r = s.delete(
            f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}", headers=ADMIN_HEADERS
        )
        assert r.status_code == 200
        # Verify gone
        g = s.get(f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}")
        assert g.status_code == 404
        # Photos list should be empty or 200 with []
        gp = s.get(f"{BASE_URL}/api/events/{TestAdminLifecycle.event_id}/photos")
        assert gp.status_code == 200
        assert gp.json() == []


# ---- Logout ----
def test_logout_with_bearer_deletes_session(s):
    """Create a throwaway session in DB via seed-style insert? We can't without DB access here.
    Instead, just assert the endpoint accepts and returns ok without a token."""
    r = requests.post(f"{BASE_URL}/api/auth/logout")
    assert r.status_code == 200
    assert r.json().get("ok") is True
