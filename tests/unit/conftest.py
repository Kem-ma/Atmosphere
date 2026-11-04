import importlib
import json
import os
import sys

import boto3
import pytest
from moto import mock_aws

SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if SRC not in sys.path:
    sys.path.insert(0, SRC)

HANDLERS = ["common", "create_weather", "get_weather", "get_weathers", "update_weather", "delete_weather", "get_forecast"]


@pytest.fixture()
def handlers(monkeypatch):
    """Fresh handler modules wired to an in-memory (moto) DynamoDB table."""
    monkeypatch.setenv("TABLE_NAME", "WeatherTable")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    with mock_aws():
        boto3.client("dynamodb").create_table(
            TableName="WeatherTable",
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            BillingMode="PAY_PER_REQUEST",
        )
        for name in HANDLERS:
            sys.modules.pop(name, None)
        yield {name: importlib.import_module(name) for name in HANDLERS}


def event(body=None, report_id=None, query=None, headers=None):
    return {
        "body": json.dumps(body) if isinstance(body, (dict, list)) else body,
        "pathParameters": {"id": report_id} if report_id else None,
        "queryStringParameters": query,
        "headers": headers or {},
    }


def call(module, **kwargs):
    res = module.lambda_handler(event(**kwargs), None)
    return res["statusCode"], json.loads(res["body"]), res.get("headers", {})
