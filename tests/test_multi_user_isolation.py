"""Multi-user isolation and workspace scoping tests.

Load-bearing security invariant: a JWT issued for user A must not read
user B's workspace or profile. Auth is now Firebase-backed — we mint two
distinct Firebase identities via the `firebase_verify` fixture.
"""

from fastapi.testclient import TestClient

from tests.conftest import firebase_signup


class TestMultiUserIsolation:
    """Two independently-signed-up Firebase users must see only their own data."""

    def test_user_cannot_access_other_workspace(self, client: TestClient, firebase_verify):
        user_a = firebase_signup(
            client, firebase_verify,
            token="tok-a", uid="fb-uid-a",
            email="usera@example.com", name="User A",
        )
        user_b = firebase_signup(
            client, firebase_verify,
            token="tok-b", uid="fb-uid-b",
            email="userb@example.com", name="User B",
        )

        assert user_a["workspace_id"] != user_b["workspace_id"]

        headers_a = {"Authorization": f"Bearer {user_a['access_token']}"}
        resp_a = client.get("/api/v1/workspace", headers=headers_a)
        assert resp_a.status_code == 200
        assert resp_a.json()["id"] == user_a["workspace_id"]

        headers_b = {"Authorization": f"Bearer {user_b['access_token']}"}
        resp_b = client.get("/api/v1/workspace", headers=headers_b)
        assert resp_b.status_code == 200
        assert resp_b.json()["id"] == user_b["workspace_id"]

    def test_workspace_isolation_by_token(self, client: TestClient, firebase_verify):
        user1 = firebase_signup(
            client, firebase_verify,
            token="tok-1", uid="fb-uid-1",
            email="user1@test.com", name="User One",
        )
        user2 = firebase_signup(
            client, firebase_verify,
            token="tok-2", uid="fb-uid-2",
            email="user2@test.com", name="User Two",
        )

        me1 = client.get("/auth/me", headers={"Authorization": f"Bearer {user1['access_token']}"})
        me2 = client.get("/auth/me", headers={"Authorization": f"Bearer {user2['access_token']}"})

        assert me1.status_code == 200
        assert me2.status_code == 200
        assert me1.json()["email"] != me2.json()["email"]
        assert me1.json()["email"] == "user1@test.com"
        assert me2.json()["email"] == "user2@test.com"
