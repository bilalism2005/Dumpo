import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    """
    Test public health check endpoint
    """
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_process_auth_required():
    """
    Test that /api/v1/process requires authentication
    """
    response = client.post("/api/v1/process", json={"message_id": "test-id", "text": "hello"})
    assert response.status_code == 401

def test_dashboard_auth_required():
    """
    Test that /api/v1/dashboard requires authentication
    """
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 401
