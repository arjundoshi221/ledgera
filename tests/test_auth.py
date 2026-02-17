"""Authentication endpoint tests"""

import pytest
from fastapi.testclient import TestClient


class TestSignup:
    """Test user signup"""
    
    def test_signup_success(self, client: TestClient, test_user_data):
        """Test successful signup"""
        response = client.post("/auth/signup", json=test_user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert "user_id" in data
        assert "workspace_id" in data
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_signup_duplicate_email(self, client: TestClient, test_user_data):
        """Test signup with duplicate email"""
        # First signup
        response1 = client.post("/auth/signup", json=test_user_data)
        assert response1.status_code == 201
        
        # Second signup with same email
        response2 = client.post("/auth/signup", json=test_user_data)
        assert response2.status_code == 400
        assert "already registered" in response2.json()["detail"]
    
    def test_signup_creates_workspace(self, client: TestClient, test_user_data):
        """Test that signup automatically creates a workspace"""
        response = client.post("/auth/signup", json=test_user_data)
        
        assert response.status_code == 201
        data = response.json()
        workspace_id = data["workspace_id"]
        
        # Verify workspace can be accessed with the token
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        workspace_response = client.get("/api/v1/workspace", headers=headers)
        
        assert workspace_response.status_code == 200
        ws_data = workspace_response.json()
        assert ws_data["id"] == workspace_id
        assert ws_data["name"] == "Personal"
        assert ws_data["base_currency"] == "SGD"


class TestLogin:
    """Test user login"""
    
    def test_login_success(self, client: TestClient, test_user_data):
        """Test successful login"""
        # Signup first
        signup_response = client.post("/auth/signup", json=test_user_data)
        assert signup_response.status_code == 201
        
        # Login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "workspace_id" in data
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_email(self, client: TestClient):
        """Test login with non-existent email"""
        response = client.post("/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]
    
    def test_login_invalid_password(self, client: TestClient, test_user_data):
        """Test login with wrong password"""
        # Signup first
        client.post("/auth/signup", json=test_user_data)
        
        # Try login with wrong password
        response = client.post("/auth/login", json={
            "email": test_user_data["email"],
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]


class TestMeEndpoint:
    """Test /me endpoint"""
    
    def test_get_me_success(self, client: TestClient, test_user_data):
        """Test successful /me request"""
        # Signup
        signup_response = client.post("/auth/signup", json=test_user_data)
        token = signup_response.json()["access_token"]
        
        # Get /me
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["display_name"] == test_user_data["display_name"]
        assert "user_id" in data
    
    def test_get_me_without_token(self, client: TestClient):
        """Test /me without authentication token"""
        response = client.get("/auth/me")
        
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]
    
    def test_get_me_invalid_token(self, client: TestClient):
        """Test /me with invalid token"""
        headers = {"Authorization": "Bearer invalid-token-xyz"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == 401
        assert "Invalid or expired token" in response.json()["detail"]


class TestTokenExpiry:
    """Test token expiration and validity"""
    
    def test_token_can_access_protected_endpoints(self, client: TestClient, test_user_data):
        """Test that valid token can access protected endpoints"""
        # Signup and get token
        signup_response = client.post("/auth/signup", json=test_user_data)
        token = signup_response.json()["access_token"]
        
        # Use token on multiple endpoints
        headers = {"Authorization": f"Bearer {token}"}
        
        # /me
        me_response = client.get("/auth/me", headers=headers)
        assert me_response.status_code == 200
        
        # /workspace
        ws_response = client.get("/api/v1/workspace", headers=headers)
        assert ws_response.status_code == 200
