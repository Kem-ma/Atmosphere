"""GET /forecast?city=Douala — live forecast from Open-Meteo for one city.
GET /forecast            — current conditions for all regional capitals.

Responses are cached in memory for a few minutes so repeated page loads
don't hit Open-Meteo every time (it asks for fair use on the free tier).
"""
import json
import time
import urllib.parse
import urllib.request

import common

API = "https://api.open-meteo.com/v1/forecast"
TZ = "Africa/Douala"
CACHE_SECONDS = 600
_cache = {}

CURRENT = "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl"
HOURLY = "temperature_2m,weather_code,precipitation_probability,is_day"
DAILY = "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max"


def _fetch(params):
    key = urllib.parse.urlencode(sorted(params.items()))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    req = urllib.request.Request(f"{API}?{key}", headers={"User-Agent": "mboa-weather/1.0"})
    with urllib.request.urlopen(req, timeout=8) as res:
        data = json.loads(res.read())
    _cache[key] = (time.time(), data)
    return data


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}
    city_name = params.get("city")

    if city_name:
        city = common.find_city(city_name)
        if not city:
            return common.error(400, "Unknown city")
        query = {
            "latitude": city[2], "longitude": city[3], "timezone": TZ, "forecast_days": 7,
            "current": CURRENT, "hourly": HOURLY, "daily": DAILY,
        }
    else:
        query = {
            "latitude": ",".join(str(c[2]) for c in common.CITIES),
            "longitude": ",".join(str(c[3]) for c in common.CITIES),
            "timezone": TZ, "current": "temperature_2m,weather_code,is_day",
        }

    try:
        data = _fetch(query)
    except Exception as e:
        print(f"Open-Meteo request failed: {e}")
        return common.error(502, "Weather provider is unavailable, try again shortly")

    if not city_name:
        data = data if isinstance(data, list) else [data]
        data = [{"city": c[0], "region": c[1], "current": d.get("current")} for c, d in zip(common.CITIES, data)]
    return common.response(200, data)
