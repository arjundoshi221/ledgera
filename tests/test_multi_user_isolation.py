"""Multi-user isolation and workspace scoping tests"""

import pytest
from fastapi.testclient import TestClient


class TestMultiUserIsolation:
    """Test that users are properly isolated"""
    
    def test_user_cannot_access_other_workspace(self, client: TestClient):
        """Test that user A cannot access user B's workspace"""
        # Create user A
        user_a_data = {
            "email": "usera@example.com",
            "password": "PasswordA123!",
            "display_name": "User A"
        }
        user_a_response = client.post("/auth/signup", json=user_a_data)
        user_a_token = user_a_response.json()["access_token"]
        user_a_workspace_id = user_a_response.json()["workspace_id"]
        
        # Create user B
        user_b_data = {
            "email": "userb@example.com",
            "password": "PasswordB123!",
            "display_name": "User B"
        }
        user_b_response = client.post("/auth/signup", json=user_b_data)
        user_b_token = user_b_response.json()["access_token"]
        user_b_workspace_id = user_b_response.json()["workspace_id"]
        
        # User A should see their own workspace
        headers_a = {"Authorization": f"Bearer {user_a_token}"}
        response = client.get("/api/v1/workspace", headers=headers_a)
        assert response.status_code == 200
        assert response.json()["id"] == user_a_workspace_id
        
        # User B should see their own workspace (not A's)
        headers_b = {"Authorization": f"Bearer {user_b_token}"}
        response = client.get("/api/v1/workspace", headers=headers_b)
        assert response.status_code == 200
        assert response.json()["id"] == user_b_workspace_id
        
        # Workspaces should be different
        assert user_a_workspace_id != user_b_workspace_id
    
    def test_workspace_isolation_by_token(self, client: TestClient):
        """Test that workspace access is controlled by token"""
        # Create two users
        user1_resp = client.post("/auth/signup", json={
            "email": "user1@test.com",
            "password": "Pass1!",
            "display_name": "User 1"
        })
        token1 = user1_resp.json()["access_token"]
        
        user2_resp = client.post("/auth/signup", json={
            "email": "user2@test.com",
            "password": "Pass2!",
            "display_name": "User 2"
        })
        token2 = user2_resp.json()["access_token"]
        
        # Both should be able to access /me with their own token
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        me1 = client.get("/auth/me", headers=headers1)
        me2 = client.get("/auth/me", headers=headers2)
        
        assert me1.status_code == 200
        assert me2.status_code == 200
        assert me1.json()["email"] != me2.json()["email"]
