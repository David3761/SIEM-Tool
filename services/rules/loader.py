import json
import os
from typing import Any

import psycopg2.extensions
import yaml


RULES_FILE: str = os.path.join(os.path.dirname(__file__), "default_rules.yaml")


def load_default_rules(conn: Any) -> None:
    with open(RULES_FILE, "r") as f:
        data: dict[str, Any] = yaml.safe_load(f)

    rules: list[dict[str, Any]] = data.get("rules", [])
    cursor = conn.cursor()

    rule: dict[str, Any]
    for rule in rules:
        cursor.execute("SELECT title FROM rules WHERE title = %s", (rule["title"],))
        if cursor.fetchone() is not None:
            continue

        cursor.execute(
            """
            INSERT INTO rules (title, name, description, rule_type, severity, config, enabled, created_at)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, NOW())
            """,
            (
                rule["title"],
                rule["name"],
                rule["description"],
                rule["type"],
                rule["severity"],
                json.dumps(rule["config"]),
                rule["enabled"],
            ),
        )

    conn.commit()
    cursor.close()
