import os
import pytest
import tempfile

# テスト用DBを一時ファイルに向ける（importより前に設定）
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = _tmp_db.name
os.environ["ENV"] = "development"

from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def test_session_create(client):
    r = client.post("/api/session")
    assert r.status_code == 200
    assert "session_id" in r.json()
    assert "session_id" in r.cookies


def test_session_reuse(client):
    r1 = client.post("/api/session")
    sid = r1.json()["session_id"]  # cookieではなくレスポンスボディから取得
    r2 = client.post("/api/session")
    assert r2.json()["session_id"] == sid


def test_get_light_no_session():
    with TestClient(app, cookies={}) as no_cookie:
        r = no_cookie.get("/api/light")
        assert r.status_code == 401


def test_get_light_ok(client):
    client.post("/api/session")
    r = client.get("/api/light")
    assert r.status_code == 200
    body = r.json()
    assert "light" in body
    assert body["light"]["status"] in ("on", "off")
    assert body["light"]["mode"] in ("auto", "manual")


def test_sensor_update(client):
    client.post("/api/session")
    r = client.post("/api/sensor", json={"sensor_index": 0, "detected": True, "lux": 200})
    assert r.status_code == 200
    assert "sensors" in r.json()


def test_manual_on(client):
    client.post("/api/session")
    r = client.post("/api/light/manual", json={"status": "on", "brightness": 80})
    assert r.status_code == 200
    assert r.json()["light"]["status"] == "on"
    assert r.json()["light"]["mode"] == "manual"


def test_manual_off(client):
    client.post("/api/session")
    client.post("/api/light/manual", json={"status": "on", "brightness": 80})
    r = client.post("/api/light/manual", json={"status": "off", "brightness": 0})
    assert r.status_code == 200
    assert r.json()["light"]["status"] == "off"


def test_auto_mode_restore(client):
    client.post("/api/session")
    client.post("/api/light/manual", json={"status": "on", "brightness": 80})
    r = client.post("/api/light/auto")
    assert r.status_code == 200
    assert r.json()["light"]["mode"] == "auto"


def test_get_energy(client):
    client.post("/api/session")
    r = client.get("/api/energy")
    assert r.status_code == 200
    assert "current" in r.json()
    assert "logs" in r.json()


def test_get_settings(client):
    client.post("/api/session")
    r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert "debounce_sec" in body
    assert "wait_sec" in body


def test_update_settings(client):
    client.post("/api/session")
    r = client.put("/api/settings", json={"debounce_sec": 5, "wait_sec": 120})
    assert r.status_code == 200
    assert r.json()["debounce_sec"] == 5
    assert r.json()["wait_sec"] == 120


def test_invalid_sensor_index(client):
    client.post("/api/session")
    r = client.post("/api/sensor", json={"sensor_index": 5, "detected": True, "lux": 100})
    assert r.status_code == 422


def test_admin_reset(client):
    client.post("/api/session")
    r = client.post("/api/admin/reset")
    assert r.status_code == 200
    assert r.json()["status"] == "reset complete"
