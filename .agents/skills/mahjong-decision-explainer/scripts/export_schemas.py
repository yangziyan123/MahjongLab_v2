from __future__ import annotations

import json
from pathlib import Path

from _repo import add_api_to_path

add_api_to_path()

from app.review_assistant.schemas import DecisionExplanation, EvidenceItem  # noqa: E402


def context_schema() -> dict:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://mahjonglab.local/schemas/decision-context.v2.json",
        "title": "DecisionContextV2",
        "type": "object",
        "required": [
            "schema_version",
            "review",
            "decision",
            "visible_state",
            "engine_analysis",
            "derived_facts",
            "evidence_ledger",
        ],
        "properties": {
            "schema_version": {"const": "decision-context.v2"},
            "review": {"type": "object"},
            "decision": {"type": "object"},
            "visible_state": {"type": "object"},
            "engine_analysis": {"type": "object"},
            "derived_facts": {"type": "object"},
            "evidence_ledger": {
                "type": "array",
                "items": EvidenceItem.model_json_schema(),
            },
        },
        "additionalProperties": False,
    }


def main() -> None:
    references = Path(__file__).resolve().parents[1] / "references"
    references.mkdir(exist_ok=True)
    outputs = {
        "decision-context-v2.schema.json": context_schema(),
        "decision-explanation-v1.schema.json": DecisionExplanation.model_json_schema(),
    }
    for filename, schema in outputs.items():
        (references / filename).write_text(
            json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"wrote {filename}")


if __name__ == "__main__":
    main()

