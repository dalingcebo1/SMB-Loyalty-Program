import os
import time
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


COMMON_HEADERS = {"host": "localhost"}


def test_ready_lite_returns_200():
    r = client.get("/health/ready-lite", headers=COMMON_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ready"
    assert data["mode"] == "lite"


def test_ready_skip_flag_bypasses_deep_checks(monkeypatch):
    monkeypatch.setenv("HEALTH_READY_SKIP_DEEP", "1")
    r = client.get("/health/ready", headers=COMMON_HEADERS)
    assert r.status_code == 200
    d = r.json()
    assert d["mode"] == "skip"
    assert "Skip flag active" in d["message"]


def test_ready_cache(monkeypatch):
    # Ensure skip not active
    monkeypatch.delenv("HEALTH_READY_SKIP_DEEP", raising=False)
    monkeypatch.setenv("HEALTH_READY_CACHE_TTL", "2")
    r1 = client.get("/health/ready", headers=COMMON_HEADERS)
    assert r1.status_code == 200
    ts1 = r1.json()["timestamp"]
    # Immediate second call should use cache (timestamp unchanged)
    r2 = client.get("/health/ready", headers=COMMON_HEADERS)
    assert r2.status_code == 200
    assert r2.json()["timestamp"] == ts1
    # Sleep slightly longer than TTL to guarantee expiry even on slow CI
    time.sleep(3.0)
    r3 = client.get("/health/ready", headers=COMMON_HEADERS)
    assert r3.status_code == 200
    assert r3.json()["timestamp"] != ts1  # cache expired


def test_startup_endpoint():
    # Set a tiny grace to test both modes quickly
    os.environ["STARTUP_GRACE_SECONDS"] = "1"
    r1 = client.get("/health/startup", headers=COMMON_HEADERS)
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["status"] in ("starting", "started")
    time.sleep(1.2)
    r2 = client.get("/health/startup", headers=COMMON_HEADERS)
    assert r2.status_code == 200
    d2 = r2.json()
    # After grace it should be started/steady
    assert d2["status"] == "started"
