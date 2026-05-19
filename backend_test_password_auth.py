"""Backend tests for password-login/set-password (PWA fallback auth).

Run against http://localhost:8001 per the review request.
"""
import os
import sys
import json
import time
import requests

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001") + "/api"
EMAIL = "sarah@pariscubansalsa.test"
ORIGINAL_PASSWORD = "motdepasse-test-pcs"
NEW_PASSWORD = "nouveau-mot-de-passe-pcs"
EXISTING_ADMIN_BEARER = "test_session_pcs_admin_000"

results = []  # list of (name, passed, info)


def record(name, passed, info=""):
    results.append((name, passed, info))
    flag = "PASS" if passed else "FAIL"
    print(f"[{flag}] {name} :: {info[:240]}")


def jpost(path, body=None, token=None, expect=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = requests.post(BASE + path, headers=h, data=json.dumps(body or {}), timeout=15)
    return r


def jget(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = requests.get(BASE + path, headers=h, timeout=15)
    return r


# ====== STEP 1: password-login with bootstrapped credentials ======
r = jpost("/auth/password-login", {"email": EMAIL, "password": ORIGINAL_PASSWORD})
record(
    "1a) POST /auth/password-login (correct creds) -> 200",
    r.status_code == 200,
    f"status={r.status_code} body={r.text[:200]}",
)
session_token_1 = None
if r.status_code == 200:
    data = r.json()
    checks = {
        "user_id": isinstance(data.get("user_id"), str) and bool(data.get("user_id")),
        "email_match": (data.get("email") or "").lower() == EMAIL.lower(),
        "name_present": "name" in data,
        "picture_present": "picture" in data,
        "is_admin_true": data.get("is_admin") is True,
        "role_admin": data.get("role") == "admin",
        "status_active": data.get("status") == "active",
        "session_token_64hex": isinstance(data.get("session_token"), str)
            and len(data["session_token"]) == 64
            and all(c in "0123456789abcdef" for c in data["session_token"]),
    }
    for k, ok in checks.items():
        record(f"1b) session payload {k}", ok, f"value={data.get(k.split('_')[0])}")
    session_token_1 = data.get("session_token")

# Verify token works on /auth/me
if session_token_1:
    r = jget("/auth/me", token=session_token_1)
    me = {}
    try:
        me = r.json()
    except Exception:
        me = {}
    record(
        "1c) GET /auth/me with new bearer -> 200",
        r.status_code == 200,
        f"status={r.status_code}",
    )
    record(
        "1c2) /auth/me email matches",
        (me.get("email") or "").lower() == EMAIL.lower(),
        f"email={me.get('email')}",
    )
    record(
        "1c3) /auth/me is_admin true",
        me.get("is_admin") is True,
        f"is_admin={me.get('is_admin')}",
    )

# ====== STEP 2: negative cases ======
r = jpost("/auth/password-login", {"email": EMAIL, "password": "wrong-password-xx"})
record(
    "2a) wrong password -> 401 + 'Identifiants invalides'",
    r.status_code == 401 and "Identifiants invalides" in r.text,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost(
    "/auth/password-login",
    {"email": "unknown.user@pariscubansalsa.test", "password": "whatever-secret"},
)
record(
    "2b) unknown email -> 401",
    r.status_code == 401 and "Identifiants invalides" in r.text,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost("/auth/password-login", {"email": "", "password": ""})
record(
    "2c) empty email+password -> 400 + 'Email et mot de passe requis'",
    r.status_code == 400 and "Email et mot de passe" in r.text,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost("/auth/password-login", {"email": EMAIL, "password": ""})
record(
    "2c2) empty password -> 400",
    r.status_code == 400 and "Email et mot de passe" in r.text,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost("/auth/password-login", {"email": "", "password": ORIGINAL_PASSWORD})
record(
    "2c3) empty email -> 400",
    r.status_code == 400 and "Email et mot de passe" in r.text,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost(
    "/auth/password-login",
    {"email": "SARAH@PARISCUBANSALSA.TEST", "password": ORIGINAL_PASSWORD},
)
record(
    "2d) email case-insensitive -> 200",
    r.status_code == 200,
    f"status={r.status_code} body={r.text[:120]}",
)

# ====== STEP 3: set-password flow ======
# Re-login to obtain a fresh token T1
r = jpost("/auth/password-login", {"email": EMAIL, "password": ORIGINAL_PASSWORD})
T1 = r.json().get("session_token") if r.status_code == 200 else None
record("3a) re-login to obtain T1", T1 is not None and len(T1) == 64, f"T1_len={len(T1 or '')}")

r = jpost("/auth/set-password", {"password": NEW_PASSWORD}, token=T1)
record(
    "3b) set-password with valid bearer T1 -> 200 {ok:true}",
    r.status_code == 200 and r.json().get("ok") is True,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost("/auth/password-login", {"email": EMAIL, "password": ORIGINAL_PASSWORD})
record(
    "3c) login with OLD password -> 401",
    r.status_code == 401,
    f"status={r.status_code} body={r.text[:120]}",
)

r = jpost("/auth/password-login", {"email": EMAIL, "password": NEW_PASSWORD})
record(
    "3d) login with NEW password -> 200",
    r.status_code == 200,
    f"status={r.status_code} body={r.text[:120]}",
)
T2 = r.json().get("session_token") if r.status_code == 200 else None

# Short password
r = jpost("/auth/set-password", {"password": "abc"}, token=T2)
record(
    "3e) set-password too-short -> 400 + 'Mot de passe trop court'",
    r.status_code == 400 and "trop court" in r.text,
    f"status={r.status_code} body={r.text[:150]}",
)

# Without auth
r = jpost("/auth/set-password", {"password": "anyvalidpassword123"})
record(
    "3f) set-password without auth -> 401/403",
    r.status_code in (401, 403),
    f"status={r.status_code} body={r.text[:120]}",
)

# ====== STEP 4: admin actions with new session_token ======
if T2:
    r = jget("/entries?status=pending", token=T2)
    record(
        "4a) GET /entries?status=pending (admin via T2) -> 200",
        r.status_code == 200,
        f"status={r.status_code} sample_len={len(r.text)}",
    )

    r = jpost("/admin/notify/test", token=T2)
    record(
        "4b) POST /admin/notify/test (admin via T2) -> 200",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:200]}",
    )

# ====== STEP 5: Reset back to original password (cleanup) ======
r = jpost("/auth/set-password", {"password": ORIGINAL_PASSWORD}, token=T2)
record(
    "5a) reset password back to original via T2 -> 200",
    r.status_code == 200 and r.json().get("ok") is True,
    f"status={r.status_code} body={r.text[:120]}",
)
r = jpost("/auth/password-login", {"email": EMAIL, "password": ORIGINAL_PASSWORD})
record(
    "5b) login with original password again -> 200",
    r.status_code == 200,
    f"status={r.status_code}",
)

# ====== STEP 6: stale/bogus token returns 401 ======
r = jget("/auth/me", token="bogus_token_does_not_exist_xyz123")
record(
    "6a) GET /auth/me bogus bearer -> 401 (not 500)",
    r.status_code == 401,
    f"status={r.status_code} body={r.text[:120]}",
)
r = jget("/auth/me", token="0" * 64)
record(
    "6b) GET /auth/me hex-shaped bogus -> 401",
    r.status_code == 401,
    f"status={r.status_code}",
)

# ====== SUMMARY ======
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
print()
print("=" * 60)
print(f"TOTAL: {passed}/{total} PASS, {total - passed} FAIL")
print("=" * 60)
if total - passed:
    for name, ok, info in results:
        if not ok:
            print(f"  ❌ {name}: {info}")

sys.exit(0 if passed == total else 1)
