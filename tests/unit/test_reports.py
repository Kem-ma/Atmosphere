import io
import json
from unittest import mock

from .conftest import call

REPORT = {"town": "Douala", "weather": "rainy", "temperature": 26.5, "note": "Heavy rain in Bonabéri", "reporter": "Alicia"}


def create(h, body=None):
    status, data, _ = call(h["create_weather"], body=body or REPORT)
    assert status == 201, data
    return data


# ---------- Create ----------
def test_create_returns_report_with_token_and_cors(handlers):
    status, data, headers = call(handlers["create_weather"], body=REPORT)
    assert status == 201
    assert data["town"] == "Douala" and data["weather"] == "rainy" and data["temperature"] == 26.5
    assert data["edit_token"] and "edit_token_hash" not in data
    assert len(data["id"]) == 36  # uuid4, no more 3-digit collisions
    assert headers["Access-Control-Allow-Origin"] == "*"


def test_create_normalises_town_without_accent(handlers):
    data = create(handlers, {"town": "yaounde", "weather": "sunny"})
    assert data["town"] == "Yaoundé"
    assert data["reporter"] == "Anonymous"
    assert "temperature" not in data


def test_create_rejects_bad_input(handlers):
    cases = [
        {"town": "Paris", "weather": "sunny"},
        {"town": "Douala", "weather": "snowstorm"},
        {"town": "Douala", "weather": "sunny", "temperature": 99},
        {"town": "Douala", "weather": "sunny", "temperature": "hot"},
        {"town": "Douala", "weather": "sunny", "note": "x" * 281},
    ]
    for body in cases:
        status, data, _ = call(handlers["create_weather"], body=body)
        assert status == 400, body
    status, _, _ = call(handlers["create_weather"], body="not json")
    assert status == 400


# ---------- Read / List ----------
def test_get_one_and_missing(handlers):
    created = create(handlers)
    status, data, _ = call(handlers["get_weather"], report_id=created["id"])
    assert status == 200 and data["note"] == REPORT["note"] and "edit_token_hash" not in data
    status, _, _ = call(handlers["get_weather"], report_id="does-not-exist")
    assert status == 404


def test_list_filters_by_town_newest_first(handlers):
    with mock.patch("common.now_iso", side_effect=["2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z", "2026-11-04T12:00:00Z"]):
        create(handlers, {"town": "Douala", "weather": "rainy"})
        create(handlers, {"town": "Garoua", "weather": "sunny"})
        create(handlers, {"town": "Douala", "weather": "stormy"})

    status, data, _ = call(handlers["get_weathers"])
    assert status == 200 and len(data) == 3
    assert [r["created_at"] for r in data] == sorted([r["created_at"] for r in data], reverse=True)
    assert all("edit_token_hash" not in r for r in data)

    status, data, _ = call(handlers["get_weathers"], query={"town": "douala"})
    assert [r["weather"] for r in data] == ["stormy", "rainy"]

    status, _, _ = call(handlers["get_weathers"], query={"town": "Atlantis"})
    assert status == 400


# ---------- Update ----------
def test_update_requires_matching_token(handlers):
    created = create(handlers)
    rid, token = created["id"], created["edit_token"]

    status, _, _ = call(handlers["update_weather"], report_id=rid, body={"note": "hack"})
    assert status == 403
    status, _, _ = call(handlers["update_weather"], report_id=rid, body={"note": "hack"}, headers={"X-Edit-Token": "wrong"})
    assert status == 403

    status, data, _ = call(handlers["update_weather"], report_id=rid, body={"weather": "cloudy", "note": "Rain stopped", "temperature": None},
                           headers={"x-edit-token": token})
    assert status == 200
    assert data["weather"] == "cloudy" and data["note"] == "Rain stopped"
    assert "temperature" not in data  # cleared
    assert data["town"] == "Douala"  # untouched
    assert data["updated_at"] >= data["created_at"]


def test_update_missing_and_invalid(handlers):
    status, _, _ = call(handlers["update_weather"], report_id="nope", body={"note": "x"}, headers={"X-Edit-Token": "t"})
    assert status == 404
    created = create(handlers)
    status, _, _ = call(handlers["update_weather"], report_id=created["id"], body={"weather": "lava"}, headers={"X-Edit-Token": created["edit_token"]})
    assert status == 400
    status, _, _ = call(handlers["update_weather"], report_id=created["id"], body={}, headers={"X-Edit-Token": created["edit_token"]})
    assert status == 400


# ---------- Delete ----------
def test_delete_requires_token_then_removes(handlers):
    created = create(handlers)
    status, _, _ = call(handlers["delete_weather"], report_id=created["id"])
    assert status == 403
    status, _, _ = call(handlers["delete_weather"], report_id=created["id"], headers={"X-Edit-Token": created["edit_token"]})
    assert status == 200
    status, _, _ = call(handlers["get_weather"], report_id=created["id"])
    assert status == 404
    status, _, _ = call(handlers["delete_weather"], report_id=created["id"], headers={"X-Edit-Token": created["edit_token"]})
    assert status == 404


def test_errors_return_500_instead_of_crashing(handlers):
    with mock.patch.object(handlers["get_weathers"].table, "scan", side_effect=RuntimeError("boom")):
        status, data, _ = call(handlers["get_weathers"])
    assert status == 500 and data["message"]


# ---------- Forecast ----------
def _fake_urlopen(payload):
    class Resp(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False
    return mock.patch("urllib.request.urlopen", return_value=Resp(json.dumps(payload).encode()))


def test_forecast_for_one_city(handlers):
    payload = {"current": {"temperature_2m": 31.2, "weather_code": 0}}
    with _fake_urlopen(payload) as urlopen:
        status, data, _ = call(handlers["get_forecast"], query={"city": "Garoua"})
        call(handlers["get_forecast"], query={"city": "garoua"})  # served from cache
    assert status == 200 and data == payload
    assert urlopen.call_count == 1
    assert "latitude=9.301" in urlopen.call_args[0][0].full_url


def test_forecast_overview_and_errors(handlers):
    payload = [{"current": {"temperature_2m": 20 + i}} for i in range(10)]
    with _fake_urlopen(payload):
        status, data, _ = call(handlers["get_forecast"])
    assert status == 200 and len(data) == 10 and data[0]["city"] == "Yaoundé"

    status, _, _ = call(handlers["get_forecast"], query={"city": "Lagos"})
    assert status == 400
    with mock.patch("urllib.request.urlopen", side_effect=OSError("down")):
        status, _, _ = call(handlers["get_forecast"], query={"city": "Bertoua"})
    assert status == 502


def test_forecast_retries_after_a_hung_request(handlers):
    payload = {"current": {"temperature_2m": 25.0}}

    class Resp(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False

    calls = {"n": 0}
    def flaky(req, timeout):
        calls["n"] += 1
        if calls["n"] == 1:
            raise TimeoutError("The read operation timed out")
        return Resp(json.dumps(payload).encode())

    with mock.patch("urllib.request.urlopen", side_effect=flaky), mock.patch("time.sleep"):
        status, data, _ = call(handlers["get_forecast"], query={"city": "Maroua"})
    assert status == 200 and data == payload and calls["n"] == 2


def test_forecast_serves_stale_cache_when_provider_is_down(handlers):
    fc = handlers["get_forecast"]
    payload = {"current": {"temperature_2m": 22.0}}
    with _fake_urlopen(payload):
        call(fc, query={"city": "Bamenda"})
    # Age the cache past the fresh window but within the stale window
    for key, (ts, data) in list(fc._cache.items()):
        fc._cache[key] = (ts - fc.CACHE_SECONDS - 60, data)
    with mock.patch("urllib.request.urlopen", side_effect=TimeoutError("timed out")), mock.patch("time.sleep"):
        status, data, _ = call(fc, query={"city": "Bamenda"})
    assert status == 200 and data == payload
