"""POST /create-weather — create a community weather report."""
import secrets
import uuid

import common

table = common.get_table()


def lambda_handler(event, context):
    try:
        fields = common.clean_report_fields(common.parse_body(event))
    except common.ValidationError as e:
        return common.error(400, str(e))

    edit_token = secrets.token_urlsafe(24)
    timestamp = common.now_iso()
    item = {
        "id": str(uuid.uuid4()),
        **{k: v for k, v in fields.items() if v is not None},
        "created_at": timestamp,
        "updated_at": timestamp,
        "edit_token_hash": common.hash_token(edit_token),
    }

    try:
        table.put_item(Item=item, ConditionExpression="attribute_not_exists(id)")
    except Exception as e:
        print(f"put_item failed: {e}")
        return common.error(500, "Could not save the report")

    # The edit token is returned once; the client keeps it to edit/delete later.
    return common.response(201, {**common.public(item), "edit_token": edit_token})
