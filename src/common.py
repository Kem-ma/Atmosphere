"""Shared helpers for the Mboa Weather Lambdas: responses, CORS, validation, cities."""
import hashlib
import hmac
import json
import os
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal

import boto3

CORS_HEADERS = {
    "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,X-Edit-Token",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
    "Content-Type": "application/json",
}

# Regional capitals of Cameroon (name, region, latitude, longitude)
CITIES = [
    ("Yaoundé", "Centre", 3.848, 11.502),
    ("Douala", "Littoral", 4.051, 9.768),
    ("Bamenda", "North-West", 5.963, 10.159),
    ("Buea", "South-West", 4.155, 9.241),
    ("Bafoussam", "West", 5.478, 10.418),
    ("Garoua", "North", 9.301, 13.397),
    ("Maroua", "Far North", 10.591, 14.316),
    ("Ngaoundéré", "Adamawa", 7.327, 13.584),
    ("Bertoua", "East", 4.577, 13.684),
    ("Ebolowa", "South", 2.900, 11.150),
]

CONDITIONS = {"sunny", "partly_cloudy", "cloudy", "rainy", "stormy", "foggy", "windy"}
MAX_NOTE = 280
MAX_REPORTER = 40


class ValidationError(Exception):
    pass


def get_table():
    return boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def _default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    raise TypeError(f"Not serializable: {type(obj)}")


def response(status, body):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(body, default=_default)}


def error(status, message):
    return response(status, {"message": message})


def parse_body(event):
    raw = event.get("body") or "{}"
    try:
        body = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        raise ValidationError("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object")
    return body


def path_id(event):
    return ((event.get("pathParameters") or {}).get("id") or "").strip()


def header(event, name):
    headers = event.get("headers") or {}
    for key, value in headers.items():
        if key.lower() == name.lower():
            return value
    return None


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _fold(text):
    """Lowercase and strip accents so 'yaounde' matches 'Yaoundé'."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn").lower().strip()


def find_city(name):
    if not isinstance(name, str):
        return None
    folded = _fold(name)
    return next((c for c in CITIES if _fold(c[0]) == folded), None)


# ---------- Report validation ----------
def clean_report_fields(body, partial=False):
    """Validate user input. With partial=True only the provided fields are checked."""
    out = {}

    if "town" in body or not partial:
        city = find_city(body.get("town"))
        if not city:
            raise ValidationError("town must be one of: " + ", ".join(c[0] for c in CITIES))
        out["town"] = city[0]

    if "weather" in body or not partial:
        weather = body.get("weather")
        if weather not in CONDITIONS:
            raise ValidationError("weather must be one of: " + ", ".join(sorted(CONDITIONS)))
        out["weather"] = weather

    if "temperature" in body:
        temp = body.get("temperature")
        if temp in (None, ""):
            out["temperature"] = None
        else:
            if isinstance(temp, bool):
                raise ValidationError("temperature must be a number")
            try:
                temp = Decimal(str(temp))
            except Exception:
                raise ValidationError("temperature must be a number")
            if not temp.is_finite() or not (-10 <= temp <= 60):
                raise ValidationError("temperature must be between -10 and 60 °C")
            out["temperature"] = temp.quantize(Decimal("0.1"))

    if "note" in body:
        note = body.get("note") or ""
        if not isinstance(note, str):
            raise ValidationError("note must be text")
        note = note.strip()
        if len(note) > MAX_NOTE:
            raise ValidationError(f"note must be at most {MAX_NOTE} characters")
        out["note"] = note

    if not partial or "reporter" in body:
        reporter = body.get("reporter") or ""
        if not isinstance(reporter, str):
            raise ValidationError("reporter must be text")
        reporter = reporter.strip()[:MAX_REPORTER]
        out["reporter"] = reporter or "Anonymous"

    return out


# ---------- Edit tokens (only the author can edit/delete) ----------
def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def token_matches(item, token):
    stored = item.get("edit_token_hash")
    if not stored or not token:
        return False
    return hmac.compare_digest(stored, hash_token(token))


def public(item):
    """Strip private fields before returning an item to the client."""
    return {k: v for k, v in item.items() if k != "edit_token_hash"}
