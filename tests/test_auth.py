"""Authentication endpoint tests (Firebase-backed).

The /auth/firebase endpoint is the entry point: it accepts a Firebase ID token,
verifies it via firebase_admin, and returns a JWT signed by our AuthService.
Tests mock firebase_admin.auth.verify_id_token via the `firebase_verify`
fixture — no real Firebase call is ever made.
"""

from fastapi.testclient import TestClient

from tests.conftest import firebase_signup


class TestFirebaseSignup:
    """First /auth/firebase call for a new Firebase UID creates the user + workspace."""

    def test_firebase_signup_creates_user(self, client: TestClient, firebase_verify):
        data = firebase_signup(
            client, firebase_verify,
            token="tok-new", uid="fb-uid-new",
            email="new@example.com", name="Alice Example",
        )
        assert "user_id" in data
        assert "workspace_id" in data
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_firebase_signup_creates_workspace(self, client: TestClient, firebase_verify):
        data = firebase_signup(
            client, firebase_verify,
            token="tok-ws", uid="fb-uid-ws", email="ws@example.com",
        )
        workspace_id = data["workspace_id"]

        headers = {"Authorization": f"Bearer {data['access_token']}"}
        ws_resp = client.get("/api/v1/workspace", headers=headers)
        assert ws_resp.status_code == 200
        ws = ws_resp.json()
        assert ws["id"] == workspace_id
        assert ws["name"] == "Personal"

class TestFirebaseLogin:
    """Second /auth/firebase call for an existing Firebase UID logs the user in."""

    def test_repeat_firebase_login_reuses_user(self, client: TestClient, firebase_verify):
        first = firebase_signup(
            client, firebase_verify,
            token="tok-1", uid="fb-uid-repeat", email="repeat@example.com",
        )

        # Second call with a different token but same uid/email → same user + workspace
        second = firebase_signup(
            client, firebase_verify,
            token="tok-2", uid="fb-uid-repeat", email="repeat@example.com",
        )

        assert second["user_id"] == first["user_id"]
        assert second["workspace_id"] == first["workspace_id"]

    def test_firebase_login_by_email_backfills_uid(self, client: TestClient, firebase_verify):
        """User created with one uid can be found on next login by email
        (backfills firebase_uid), matching the endpoint's read_by_email fallback."""
        first = firebase_signup(
            client, firebase_verify,
            token="tok-orig", uid="fb-uid-orig", email="same@example.com",
        )
        # Different uid but same email → should still resolve to the same account
        second = firebase_signup(
            client, firebase_verify,
            token="tok-new", uid="fb-uid-different", email="same@example.com",
        )
        assert second["user_id"] == first["user_id"]

    def test_two_distinct_firebase_uids_get_distinct_users(self, client: TestClient, firebase_verify):
        a = firebase_signup(
            client, firebase_verify,
            token="tok-x", uid="fb-uid-x", email="x@example.com",
        )
        b = firebase_signup(
            client, firebase_verify,
            token="tok-y", uid="fb-uid-y", email="y@example.com",
        )
        assert a["user_id"] != b["user_id"]
        assert a["workspace_id"] != b["workspace_id"]


class TestMeEndpoint:
    """Test /auth/me endpoint"""

    def test_get_me_success(self, client: TestClient, firebase_verify):
        data = firebase_signup(
            client, firebase_verify,
            token="tok-me", uid="fb-uid-me",
            email="me@example.com", name="Me User",
        )

        headers = {"Authorization": f"Bearer {data['access_token']}"}
        resp = client.get("/auth/me", headers=headers)

        assert resp.status_code == 200
        me = resp.json()
        assert me["email"] == "me@example.com"
        assert me["first_name"] == "Me"
        assert me["last_name"] == "User"
        assert me["id"] == data["user_id"]

    def test_get_me_without_token(self, client: TestClient):
        resp = client.get("/auth/me")
        assert resp.status_code == 401
        assert "Not authenticated" in resp.json()["detail"]

    def test_get_me_invalid_token(self, client: TestClient):
        headers = {"Authorization": "Bearer invalid-token-xyz"}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401
        assert "Invalid or expired token" in resp.json()["detail"]

    def test_get_me_after_re_login_returns_same_identity(self, client: TestClient, firebase_verify):
        """A second login for the same Firebase UID produces a JWT that
        resolves back to the same user record via /auth/me."""
        first = firebase_signup(
            client, firebase_verify,
            token="tok-me-1", uid="fb-uid-relogin",
            email="relogin@example.com", name="Re Login",
        )
        second = firebase_signup(
            client, firebase_verify,
            token="tok-me-2", uid="fb-uid-relogin",
            email="relogin@example.com", name="Re Login",
        )
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {second['access_token']}"})
        assert me.status_code == 200
        assert me.json()["id"] == first["user_id"]
        assert me.json()["email"] == "relogin@example.com"


class TestTokenExpiry:
    """Test that a JWT issued by /auth/firebase gates protected endpoints."""

    def test_token_can_access_protected_endpoints(self, client: TestClient, firebase_verify):
        data = firebase_signup(
            client, firebase_verify,
            token="tok-access", uid="fb-uid-access", email="access@example.com",
        )
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        assert client.get("/auth/me", headers=headers).status_code == 200
        assert client.get("/api/v1/workspace", headers=headers).status_code == 200
