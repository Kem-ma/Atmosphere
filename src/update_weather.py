"""PUT /weather/{id} — edit a report. Requires the X-Edit-Token returned at creation."""
import common

table = common.get_table()
EDITABLE = ("town", "weather", "temperature", "note", "reporter")


def lambda_handler(event, context):
    report_id = common.path_id(event)
    if not report_id:
        return common.error(400, "Missing report id")

    try:
        fields = common.clean_report_fields(common.parse_body(event), partial=True)
    except common.ValidationError as e:
        return common.error(400, str(e))
    fields = {k: v for k, v in fields.items() if k in EDITABLE}
    if not fields:
        return common.error(400, "Nothing to update")

    try:
        item = table.get_item(Key={"id": report_id}).get("Item")
    except Exception as e:
        print(f"get_item failed: {e}")
        return common.error(500, "Could not load the report")
    if not item:
        return common.error(404, "Report not found")
    if not common.token_matches(item, common.header(event, "X-Edit-Token")):
        return common.error(403, "You can only edit your own reports")

    sets, removes, names, values = ["#updated_at = :updated_at"], [], {"#updated_at": "updated_at"}, {":updated_at": common.now_iso()}
    for key, value in fields.items():
        names[f"#{key}"] = key
        if value is None:
            removes.append(f"#{key}")
        else:
            sets.append(f"#{key} = :{key}")
            values[f":{key}"] = value
    expression = "SET " + ", ".join(sets) + (" REMOVE " + ", ".join(removes) if removes else "")

    try:
        result = table.update_item(
            Key={"id": report_id},
            UpdateExpression=expression,
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        return common.error(404, "Report not found")
    except Exception as e:
        print(f"update_item failed: {e}")
        return common.error(500, "Could not update the report")

    return common.response(200, common.public(result["Attributes"]))
