"""GET /weather/{id} — fetch one community weather report."""
import common

table = common.get_table()


def lambda_handler(event, context):
    report_id = common.path_id(event)
    if not report_id:
        return common.error(400, "Missing report id")

    try:
        item = table.get_item(Key={"id": report_id}).get("Item")
    except Exception as e:
        print(f"get_item failed: {e}")
        return common.error(500, "Could not load the report")

    if not item:
        return common.error(404, "Report not found")
    return common.response(200, common.public(item))
