import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_root():
    """Test the root endpoint (if it exists) or health check."""
    # Assuming there's a basic health check or root
    response = client.get("/")
    # If root is not defined, it might be 404, which is fine for a stub test
    # Or we can check a known open endpoint like auth/me (which should be 401 without token)
    assert response.status_code in [200, 404]

def test_auth_me_unauthorized():
    """Test that /api/auth/me requires authentication."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_projects_unauthorized():
    """Test that /api/projects requires authentication."""
    response = client.get("/api/projects/")
    assert response.status_code == 401
