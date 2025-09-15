from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from app.core.client_ip import get_client_ip

app = FastAPI()

@app.get('/ip')
async def ip_endpoint(request: Request):
    return {"ip": get_client_ip(request)}

def test_client_ip_from_xff_first():
    client = TestClient(app)
    resp = client.get('/ip', headers={"X-Forwarded-For": "203.0.113.10, 10.0.0.1"})
    assert resp.status_code == 200
    assert resp.json()["ip"] == "203.0.113.10"

def test_client_ip_fallback_host():
    client = TestClient(app)
    resp = client.get('/ip')
    assert resp.status_code == 200
    # TestClient sets client host as 'testserver'
    assert resp.json()["ip"] in ("testserver", "127.0.0.1")
