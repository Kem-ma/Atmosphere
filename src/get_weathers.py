"""GET /weathers?town=Douala&limit=50 — list community weather reports, newest first."""
from boto3.dynamodb.conditions import Attr

import common

table = common.get_table()
DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}

    scan_kwargs = {}
    town = params.get("town")
    if town:
        city = common.find_city(town)
        if not city:
            return common.error(400, "Unknown town")
        scan_kwargs["FilterExpression"] = Attr("town").eq(city[0])

    try:
        limit = min(max(int(params.get("limit", DEFAULT_LIMIT)), 1), MAX_LIMIT)
    except ValueError:
        return common.error(400, "limit must be a number")

    try:
        items = []
        while True:
            page = table.scan(**scan_kwargs)
            items.extend(page.get("Items", []))
            if "LastEvaluatedKey" not in page:
                break
            scan_kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    except Exception as e:
        print(f"scan failed: {e}")
        return common.error(500, "Could not load reports")

    items.sort(key=lambda i: i.get("created_at", ""), reverse=True)
    return common.response(200, [common.public(i) for i in items[:limit]])
