"""DELETE /weather/{id} — delete a report. Requires the X-Edit-Token returned at creation."""
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
    if not common.token_matches(item, common.header(event, "X-Edit-Token")):
        return common.error(403, "You can only delete your own reports")

    try:
        table.delete_item(Key={"id": report_id})
    except Exception as e:
        print(f"delete_item failed: {e}")
        return common.error(500, "Could not delete the report")

    return common.response(200, {"message": "Report deleted", "id": report_id})
