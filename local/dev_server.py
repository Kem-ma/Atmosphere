"""Run the Lambda handlers locally behind a tiny HTTP server — no AWS account or Docker needed.

DynamoDB is replaced by an in-memory mock (moto), so data disappears when you stop the server.
The /forecast route calls the real Open-Meteo API.

    .venv\\Scripts\\python local\\dev_server.py            # API on http://localhost:3000
    .venv\\Scripts\\python local\\dev_server.py --seed     # with a few sample reports

For the real deployed API use `sam deploy` and point frontend/config.js at the WeatherApiUrl output.
"""
import argparse
import importlib
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlparse

os.environ.setdefault("TABLE_NAME", "WeatherTable")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "local")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "local")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.stdout.reconfigure(line_buffering=True)  # show Lambda print() logs immediately

# Some Windows machines have outdated root certificates, which makes HTTPS calls to
# Open-Meteo fail locally. Use certifi's up-to-date bundle (not needed in AWS Lambda).
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except ImportError:
    pass

import boto3  # noqa: E402
from moto import mock_aws  # noqa: E402

mock = mock_aws()
mock.start()
boto3.client("dynamodb").create_table(
    TableName=os.environ["TABLE_NAME"],
    AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
    KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
    BillingMode="PAY_PER_REQUEST",
)

H = {name: importlib.import_module(name) for name in
     ["common", "create_weather", "get_weather", "get_weathers", "update_weather", "delete_weather", "get_forecast"]}

# Same routes as template.yaml
ROUTES = [
    ("POST", re.compile(r"^/create-weather$"), "create_weather"),
    ("GET", re.compile(r"^/weathers$"), "get_weathers"),
    ("GET", re.compile(r"^/weather/(?P<id>[^/]+)$"), "get_weather"),
    ("PUT", re.compile(r"^/weather/(?P<id>[^/]+)$"), "update_weather"),
    ("DELETE", re.compile(r"^/weather/(?P<id>[^/]+)$"), "delete_weather"),
    ("GET", re.compile(r"^/forecast$"), "get_forecast"),
]


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, headers, body):
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body.encode())

    def do_OPTIONS(self):
        self._send(200, H["common"].CORS_HEADERS, "")

    def _dispatch(self):
        url = urlparse(self.path)
        for method, pattern, name in ROUTES:
            match = pattern.match(url.path)
            if method == self.command and match:
                length = int(self.headers.get("Content-Length") or 0)
                event = {
                    "body": self.rfile.read(length).decode() if length else None,
                    "pathParameters": match.groupdict() or None,
                    "queryStringParameters": dict(parse_qsl(url.query)) or None,
                    "headers": dict(self.headers),
                }
                res = H[name].lambda_handler(event, None)
                return self._send(res["statusCode"], res.get("headers", {}), res["body"])
        self._send(404, H["common"].CORS_HEADERS, json.dumps({"message": "Not found"}))

    do_GET = do_POST = do_PUT = do_DELETE = _dispatch


def seed():
    samples = [
        {"town": "Douala", "weather": "rainy", "temperature": 26, "note": "Sample: heavy rain around Akwa, roads flooding.", "reporter": "Sample data"},
        {"town": "Yaoundé", "weather": "cloudy", "temperature": 23, "note": "Sample: grey sky over Bastos, light breeze.", "reporter": "Sample data"},
        {"town": "Garoua", "weather": "sunny", "temperature": 34, "note": "Sample: very hot and dry this afternoon.", "reporter": "Sample data"},
    ]
    for body in samples:
        H["create_weather"].lambda_handler({"body": json.dumps(body)}, None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--seed", action="store_true", help="add a few clearly-labelled sample reports")
    args = parser.parse_args()
    if args.seed:
        seed()
    print(f"Mboa Weather local API on http://localhost:{args.port}  (in-memory DynamoDB)")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
